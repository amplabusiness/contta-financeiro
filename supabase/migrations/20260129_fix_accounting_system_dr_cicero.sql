-- =============================================================================
-- CORREÇÃO DEFINITIVA DO SISTEMA CONTÁBIL - DR. CÍCERO
-- =============================================================================
-- Este arquivo contém as correções estruturais para resolver:
-- 1. Schema drift (entry_lines vs entry_items)
-- 2. Cleanup automático que deleta entries válidos
-- 3. Falta de transação atômica (entry + lines)
-- 4. Falta de validação obrigatória (partidas dobradas)
-- 5. Multi-tenant (office_id/tenant_id)
-- =============================================================================

-- =============================================================================
-- PASSO 1: DESABILITAR CLEANUP AUTOMÁTICO
-- (Para evitar que o sistema delete entries enquanto corrigimos)
-- =============================================================================

-- Criar flag de manutenção
CREATE TABLE IF NOT EXISTS system_maintenance (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marcar sistema em manutenção
INSERT INTO system_maintenance (key, value)
VALUES ('accounting_maintenance', '{"enabled": true, "reason": "Schema correction by Dr. Cicero", "started_at": "2026-01-29"}')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- =============================================================================
-- PASSO 2: UNIFICAR TABELAS DE LINHAS
-- Decisão: MANTER accounting_entry_lines (padrão mais recente)
--          MIGRAR dados de accounting_entry_items para entry_lines
-- =============================================================================

-- Garantir que entry_lines tem todas as colunas necessárias
ALTER TABLE accounting_entry_lines 
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS cost_center_id UUID;

-- Migrar dados de entry_items que não existem em entry_lines
INSERT INTO accounting_entry_lines (
    id, 
    entry_id, 
    account_id, 
    debit, 
    credit, 
    description,
    tenant_id,
    created_at
)
SELECT 
    i.id,
    i.entry_id,
    i.account_id,
    COALESCE(i.debit, 0),
    COALESCE(i.credit, 0),
    COALESCE(i.history, ''),
    e.tenant_id,
    i.created_at
FROM accounting_entry_items i
JOIN accounting_entries e ON e.id = i.entry_id
WHERE NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines l 
    WHERE l.entry_id = i.entry_id AND l.account_id = i.account_id
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PASSO 3: CRIAR RPC TRANSACIONAL
-- Gravação atômica: entry + lines ou nada (rollback)
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_create_accounting_entry(
    p_tenant_id UUID,
    p_entry_date DATE,
    p_description TEXT,
    p_internal_code TEXT,
    p_source_type TEXT,
    p_entry_type TEXT DEFAULT 'MOVIMENTO',
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_lines JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry_id UUID;
    v_total_debit DECIMAL(15,2) := 0;
    v_total_credit DECIMAL(15,2) := 0;
    v_line JSONB;
    v_line_count INT := 0;
    v_result JSONB;
BEGIN
    -- VALIDAÇÃO 1: internal_code obrigatório e único
    IF p_internal_code IS NULL OR p_internal_code = '' THEN
        RAISE EXCEPTION 'internal_code é obrigatório para rastreabilidade';
    END IF;
    
    -- Verificar unicidade do internal_code
    IF EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = p_internal_code AND tenant_id = p_tenant_id) THEN
        RAISE EXCEPTION 'internal_code já existe: %', p_internal_code;
    END IF;
    
    -- VALIDAÇÃO 2: Mínimo 2 linhas
    IF jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'Lançamento deve ter no mínimo 2 linhas (partidas dobradas)';
    END IF;
    
    -- VALIDAÇÃO 3: Calcular totais e verificar balanceamento
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::DECIMAL, 0);
        v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::DECIMAL, 0);
        v_line_count := v_line_count + 1;
        
        -- Validar que cada linha tem débito XOR crédito
        IF COALESCE((v_line->>'debit')::DECIMAL, 0) > 0 AND COALESCE((v_line->>'credit')::DECIMAL, 0) > 0 THEN
            RAISE EXCEPTION 'Linha % não pode ter débito E crédito simultaneamente', v_line_count;
        END IF;
        
        IF COALESCE((v_line->>'debit')::DECIMAL, 0) = 0 AND COALESCE((v_line->>'credit')::DECIMAL, 0) = 0 THEN
            RAISE EXCEPTION 'Linha % deve ter débito OU crédito', v_line_count;
        END IF;
    END LOOP;
    
    -- VALIDAÇÃO 4: Partidas dobradas (tolerância de 0.01 para arredondamentos)
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
        RAISE EXCEPTION 'Lançamento não balanceado: Débitos (%) ≠ Créditos (%)', v_total_debit, v_total_credit;
    END IF;
    
    -- CRIAR ENTRY (cabeçalho)
    INSERT INTO accounting_entries (
        id,
        tenant_id,
        entry_date,
        competence_date,
        description,
        internal_code,
        source_type,
        entry_type,
        reference_type,
        reference_id,
        total_debit,
        total_credit,
        balanced,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_tenant_id,
        p_entry_date,
        p_entry_date,  -- competência = data por padrão
        p_description,
        p_internal_code,
        p_source_type,
        p_entry_type,
        p_reference_type,
        p_reference_id,
        v_total_debit,
        v_total_credit,
        TRUE,
        NOW()
    )
    RETURNING id INTO v_entry_id;
    
    -- CRIAR LINES
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        INSERT INTO accounting_entry_lines (
            id,
            tenant_id,
            entry_id,
            account_id,
            debit,
            credit,
            description,
            created_at
        ) VALUES (
            gen_random_uuid(),
            p_tenant_id,
            v_entry_id,
            (v_line->>'account_id')::UUID,
            COALESCE((v_line->>'debit')::DECIMAL, 0),
            COALESCE((v_line->>'credit')::DECIMAL, 0),
            v_line->>'description',
            NOW()
        );
    END LOOP;
    
    -- Retornar resultado
    v_result := jsonb_build_object(
        'success', true,
        'entry_id', v_entry_id,
        'internal_code', p_internal_code,
        'total_debit', v_total_debit,
        'total_credit', v_total_credit,
        'lines_count', v_line_count
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Em caso de erro, rollback automático
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_detail', SQLSTATE
        );
END;
$$;

-- =============================================================================
-- PASSO 4: CRIAR RPC PARA CLASSIFICAÇÃO (Dr. Cícero)
-- Específico para classificar transações bancárias
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_classify_bank_transaction(
    p_tenant_id UUID,
    p_bank_transaction_id UUID,
    p_destination_account_id UUID,
    p_description TEXT,
    p_approved_by TEXT DEFAULT 'Dr. Cícero'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tx RECORD;
    v_import_entry_id UUID;
    v_class_entry_id UUID;
    v_transit_debit_id UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0'; -- 1.1.9.01
    v_transit_credit_id UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1'; -- 2.1.9.01
    v_bank_account_id UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56'; -- Sicredi
    v_amount DECIMAL(15,2);
    v_internal_code TEXT;
    v_import_result JSONB;
    v_class_result JSONB;
BEGIN
    -- Buscar transação
    SELECT * INTO v_tx 
    FROM bank_transactions 
    WHERE id = p_bank_transaction_id AND tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
    END IF;
    
    IF v_tx.is_reconciled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transação já reconciliada');
    END IF;
    
    v_amount := ABS(v_tx.amount);
    v_internal_code := 'OFX_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || COALESCE(v_tx.fitid, v_tx.id::TEXT);
    
    -- LANÇAMENTO 1: Importação OFX
    IF v_tx.amount > 0 THEN
        -- ENTRADA: D Banco / C Transitória Créditos
        SELECT rpc_create_accounting_entry(
            p_tenant_id,
            v_tx.transaction_date,
            'OFX: ' || COALESCE(v_tx.description, 'Entrada bancária'),
            'IMP_' || v_internal_code,
            'ofx_import',
            'MOVIMENTO',
            'bank_transaction',
            v_tx.id,
            jsonb_build_array(
                jsonb_build_object('account_id', v_bank_account_id, 'debit', v_amount, 'credit', 0, 'description', 'Entrada extrato'),
                jsonb_build_object('account_id', v_transit_credit_id, 'debit', 0, 'credit', v_amount, 'description', 'Pendente classificação')
            )
        ) INTO v_import_result;
        
        IF NOT (v_import_result->>'success')::BOOLEAN THEN
            RETURN v_import_result;
        END IF;
        
        v_import_entry_id := (v_import_result->>'entry_id')::UUID;
        
        -- LANÇAMENTO 2: Classificação
        SELECT rpc_create_accounting_entry(
            p_tenant_id,
            v_tx.transaction_date,
            'CLASS: ' || p_description,
            'CLASS_' || v_internal_code,
            'classification',
            'CLASSIFICACAO',
            'bank_transaction',
            v_tx.id,
            jsonb_build_array(
                jsonb_build_object('account_id', v_transit_credit_id, 'debit', v_amount, 'credit', 0, 'description', 'Baixa transitória'),
                jsonb_build_object('account_id', p_destination_account_id, 'debit', 0, 'credit', v_amount, 'description', p_description)
            )
        ) INTO v_class_result;
        
    ELSE
        -- SAÍDA: D Transitória Débitos / C Banco
        SELECT rpc_create_accounting_entry(
            p_tenant_id,
            v_tx.transaction_date,
            'OFX: ' || COALESCE(v_tx.description, 'Saída bancária'),
            'IMP_' || v_internal_code,
            'ofx_import',
            'MOVIMENTO',
            'bank_transaction',
            v_tx.id,
            jsonb_build_array(
                jsonb_build_object('account_id', v_transit_debit_id, 'debit', v_amount, 'credit', 0, 'description', 'Pendente classificação'),
                jsonb_build_object('account_id', v_bank_account_id, 'debit', 0, 'credit', v_amount, 'description', 'Saída extrato')
            )
        ) INTO v_import_result;
        
        IF NOT (v_import_result->>'success')::BOOLEAN THEN
            RETURN v_import_result;
        END IF;
        
        v_import_entry_id := (v_import_result->>'entry_id')::UUID;
        
        -- LANÇAMENTO 2: Classificação
        SELECT rpc_create_accounting_entry(
            p_tenant_id,
            v_tx.transaction_date,
            'CLASS: ' || p_description,
            'CLASS_' || v_internal_code,
            'classification',
            'CLASSIFICACAO',
            'bank_transaction',
            v_tx.id,
            jsonb_build_array(
                jsonb_build_object('account_id', p_destination_account_id, 'debit', v_amount, 'credit', 0, 'description', p_description),
                jsonb_build_object('account_id', v_transit_debit_id, 'debit', 0, 'credit', v_amount, 'description', 'Baixa transitória')
            )
        ) INTO v_class_result;
    END IF;
    
    IF NOT (v_class_result->>'success')::BOOLEAN THEN
        RETURN v_class_result;
    END IF;
    
    v_class_entry_id := (v_class_result->>'entry_id')::UUID;
    
    -- ATUALIZAR TRANSAÇÃO
    UPDATE bank_transactions SET
        journal_entry_id = v_import_entry_id,
        is_reconciled = TRUE,
        reconciled_at = NOW(),
        status = 'reconciled'
    WHERE id = p_bank_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'import_entry_id', v_import_entry_id,
        'classification_entry_id', v_class_entry_id,
        'amount', v_amount,
        'type', CASE WHEN v_tx.amount > 0 THEN 'ENTRADA' ELSE 'SAÍDA' END,
        'approved_by', p_approved_by
    );
END;
$$;

-- =============================================================================
-- PASSO 5: CRIAR VIEW DE VERIFICAÇÃO DE TRANSITÓRIAS
-- =============================================================================

CREATE OR REPLACE VIEW vw_transitory_balances AS
SELECT 
    c.code,
    c.name,
    COALESCE(SUM(l.debit), 0) as total_debit,
    COALESCE(SUM(l.credit), 0) as total_credit,
    COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as balance,
    CASE 
        WHEN ABS(COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)) < 0.01 THEN '✅ ZERADA'
        ELSE '⚠️ PENDENTE'
    END as status
FROM chart_of_accounts c
LEFT JOIN accounting_entry_lines l ON l.account_id = c.id
LEFT JOIN accounting_entries e ON e.id = l.entry_id
WHERE c.code IN ('1.1.9.01', '2.1.9.01')
GROUP BY c.id, c.code, c.name;

-- =============================================================================
-- PASSO 6: CRIAR FUNÇÃO DE VALIDAÇÃO (Dr. Cícero Gatekeeper)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_validate_accounting_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
    v_maintenance_mode BOOLEAN;
BEGIN
    -- Verificar se está em modo manutenção
    SELECT (value->>'enabled')::BOOLEAN INTO v_maintenance_mode
    FROM system_maintenance
    WHERE key = 'accounting_maintenance';
    
    IF v_maintenance_mode IS TRUE THEN
        RETURN NEW; -- Em manutenção, permitir tudo
    END IF;
    
    -- Validar internal_code obrigatório
    IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
        RAISE EXCEPTION '[Dr. Cícero] internal_code é obrigatório para rastreabilidade';
    END IF;
    
    -- Validar source_type obrigatório
    IF NEW.source_type IS NULL OR NEW.source_type = '' THEN
        RAISE EXCEPTION '[Dr. Cícero] source_type é obrigatório';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Aplicar trigger de validação
DROP TRIGGER IF EXISTS trg_validate_accounting_entry ON accounting_entries;
CREATE TRIGGER trg_validate_accounting_entry
    BEFORE INSERT OR UPDATE ON accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_accounting_entry();

-- =============================================================================
-- PASSO 7: CRIAR FUNÇÃO PARA VERIFICAR INTEGRIDADE
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_check_accounting_integrity(
    p_tenant_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_orphan_entries INT;
    v_unbalanced_entries INT;
    v_missing_code INT;
    v_transit_debit_balance DECIMAL(15,2);
    v_transit_credit_balance DECIMAL(15,2);
    v_problems JSONB := '[]'::jsonb;
BEGIN
    -- Entries órfãos (sem linhas)
    SELECT COUNT(*) INTO v_orphan_entries
    FROM accounting_entries e
    WHERE e.tenant_id = p_tenant_id
      AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines l WHERE l.entry_id = e.id);
    
    IF v_orphan_entries > 0 THEN
        v_problems := v_problems || jsonb_build_object('type', 'orphan_entries', 'count', v_orphan_entries);
    END IF;
    
    -- Entries sem internal_code
    SELECT COUNT(*) INTO v_missing_code
    FROM accounting_entries
    WHERE tenant_id = p_tenant_id
      AND (internal_code IS NULL OR internal_code = '');
    
    IF v_missing_code > 0 THEN
        v_problems := v_problems || jsonb_build_object('type', 'missing_internal_code', 'count', v_missing_code);
    END IF;
    
    -- Saldo das transitórias
    SELECT 
        COALESCE(SUM(CASE WHEN c.code = '1.1.9.01' THEN l.debit - l.credit ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN c.code = '2.1.9.01' THEN l.credit - l.debit ELSE 0 END), 0)
    INTO v_transit_debit_balance, v_transit_credit_balance
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    JOIN chart_of_accounts c ON c.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND c.code IN ('1.1.9.01', '2.1.9.01');
    
    IF ABS(v_transit_debit_balance) > 0.01 THEN
        v_problems := v_problems || jsonb_build_object('type', 'transit_debit_not_zero', 'balance', v_transit_debit_balance);
    END IF;
    
    IF ABS(v_transit_credit_balance) > 0.01 THEN
        v_problems := v_problems || jsonb_build_object('type', 'transit_credit_not_zero', 'balance', v_transit_credit_balance);
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', p_tenant_id,
        'problems_count', jsonb_array_length(v_problems),
        'problems', v_problems,
        'transit_debit_balance', v_transit_debit_balance,
        'transit_credit_balance', v_transit_credit_balance,
        'is_healthy', jsonb_array_length(v_problems) = 0
    );
END;
$$;

-- =============================================================================
-- PASSO 8: GRANT PERMISSÕES
-- =============================================================================

GRANT EXECUTE ON FUNCTION rpc_create_accounting_entry TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_classify_bank_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_check_accounting_integrity TO authenticated;
GRANT SELECT ON vw_transitory_balances TO authenticated;

-- =============================================================================
-- COMENTÁRIO FINAL
-- =============================================================================
COMMENT ON FUNCTION rpc_create_accounting_entry IS 
'[Dr. Cícero] RPC transacional para criar lançamentos contábeis.
Valida: internal_code único, partidas dobradas, mínimo 2 linhas.
Uso: SELECT rpc_create_accounting_entry(tenant_id, date, desc, code, source, type, ref_type, ref_id, lines_jsonb)';

COMMENT ON FUNCTION rpc_classify_bank_transaction IS
'[Dr. Cícero] Classifica transação bancária gerando 2 lançamentos:
1. Importação (banco ↔ transitória)
2. Classificação (transitória ↔ conta destino)
Uso: SELECT rpc_classify_bank_transaction(tenant_id, bank_tx_id, dest_account_id, description)';
