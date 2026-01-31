-- ============================================================================
-- CORREÇÃO TÉCNICA JANEIRO/2025 — DR. CÍCERO
-- ============================================================================
-- Protocolo: AUD-202501-ML1AZROS
-- Autorizado por: Dr. Cícero (Auditor Contábil)
-- Data: 30/01/2026
-- 
-- FRENTE 1: Criar lançamentos transitórios para 158 transações sem lastro
-- FRENTE 2: Estornar 106 lançamentos desbalanceados
-- ============================================================================

-- Variáveis
DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_banco_sicredi UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56';
    v_trans_debitos UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
    v_trans_creditos UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1';
    v_entry_id UUID;
    v_tx RECORD;
    v_entry RECORD;
    v_line RECORD;
    v_internal_code TEXT;
    v_amount NUMERIC;
    v_count_trans INT := 0;
    v_count_estorno INT := 0;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  CORREÇÃO TÉCNICA JANEIRO/2025 — DR. CÍCERO';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';

    -- ========================================================================
    -- FRENTE 1: Lançamentos Transitórios
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '  FRENTE 1: Criando lançamentos transitórios...';
    
    FOR v_tx IN 
        SELECT id, fitid, amount, transaction_date, description
        FROM bank_transactions
        WHERE tenant_id = v_tenant_id
          AND journal_entry_id IS NULL
          AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
        ORDER BY transaction_date
    LOOP
        v_entry_id := gen_random_uuid();
        v_internal_code := 'OFX_TRANS_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || LEFT(v_tx.fitid, 8);
        v_amount := ABS(v_tx.amount);
        
        -- Inserir cabeçalho
        INSERT INTO accounting_entries (
            id, tenant_id, entry_date, competence_date, description,
            internal_code, source_type, entry_type, reference_type, reference_id
        ) VALUES (
            v_entry_id,
            v_tenant_id,
            v_tx.transaction_date,
            v_tx.transaction_date,
            '[TRANSITÓRIO] ' || COALESCE(v_tx.description, 'Sem descrição'),
            v_internal_code,
            'ofx_transit',
            'MOVIMENTO',
            'bank_transaction',
            v_tx.id
        );
        
        -- Inserir linhas conforme tipo (entrada ou saída)
        IF v_tx.amount > 0 THEN
            -- ENTRADA: D Banco / C Transitória Créditos
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES 
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_banco_sicredi, v_amount, 0, 'Entrada conforme extrato'),
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_trans_creditos, 0, v_amount, 'Pendente classificação');
        ELSE
            -- SAÍDA: D Transitória Débitos / C Banco
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES 
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_trans_debitos, v_amount, 0, 'Pendente classificação'),
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_banco_sicredi, 0, v_amount, 'Saída conforme extrato');
        END IF;
        
        -- Vincular transação ao lançamento
        UPDATE bank_transactions 
        SET journal_entry_id = v_entry_id 
        WHERE id = v_tx.id;
        
        v_count_trans := v_count_trans + 1;
        
        IF v_count_trans % 20 = 0 THEN
            RAISE NOTICE '    ... % lançamentos criados', v_count_trans;
        END IF;
    END LOOP;
    
    RAISE NOTICE '  ✅ FRENTE 1: % lançamentos transitórios criados', v_count_trans;

    -- ========================================================================
    -- FRENTE 2: Estornos de Lançamentos Desbalanceados
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '  FRENTE 2: Criando estornos para lançamentos desbalanceados...';
    
    FOR v_entry IN 
        SELECT e.id, e.internal_code, e.description, e.entry_date
        FROM accounting_entries e
        WHERE e.tenant_id = v_tenant_id
          AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
          AND EXISTS (
              SELECT 1 
              FROM accounting_entry_lines l 
              WHERE l.entry_id = e.id
              GROUP BY l.entry_id
              HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
          )
          AND NOT EXISTS (
              SELECT 1 
              FROM accounting_entries e2 
              WHERE e2.internal_code = 'ESTORNO_' || e.internal_code
          )
    LOOP
        v_entry_id := gen_random_uuid();
        v_internal_code := 'ESTORNO_' || COALESCE(v_entry.internal_code, LEFT(v_entry.id::TEXT, 8));
        
        -- Verificar se já existe estorno
        IF EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = v_internal_code AND tenant_id = v_tenant_id) THEN
            CONTINUE;
        END IF;
        
        -- Inserir cabeçalho do estorno
        INSERT INTO accounting_entries (
            id, tenant_id, entry_date, competence_date, description,
            internal_code, source_type, entry_type, reference_type, reference_id
        ) VALUES (
            v_entry_id,
            v_tenant_id,
            v_entry.entry_date,
            v_entry.entry_date,
            '[ESTORNO TÉCNICO] ' || COALESCE(v_entry.description, 'Lançamento desbalanceado'),
            v_internal_code,
            'reversal',
            'ESTORNO',
            'accounting_entry',
            v_entry.id
        );
        
        -- Inserir linhas invertidas (D↔C)
        FOR v_line IN 
            SELECT account_id, debit, credit, description
            FROM accounting_entry_lines
            WHERE entry_id = v_entry.id
        LOOP
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry_id,
                v_line.account_id,
                COALESCE(v_line.credit, 0),  -- Inverte: crédito vira débito
                COALESCE(v_line.debit, 0),   -- Inverte: débito vira crédito
                '[ESTORNO] ' || COALESCE(v_line.description, '')
            );
        END LOOP;
        
        v_count_estorno := v_count_estorno + 1;
        
        IF v_count_estorno % 20 = 0 THEN
            RAISE NOTICE '    ... % estornos criados', v_count_estorno;
        END IF;
    END LOOP;
    
    RAISE NOTICE '  ✅ FRENTE 2: % estornos criados', v_count_estorno;

    -- ========================================================================
    -- VERIFICAÇÃO FINAL
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  VERIFICAÇÃO FINAL';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    
    -- Transações sem lançamento
    SELECT COUNT(*) INTO v_count_trans
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND journal_entry_id IS NULL
      AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31';
    
    RAISE NOTICE '  Transações sem lançamento: %', v_count_trans;
    
    -- Partidas dobradas
    SELECT 
        SUM(COALESCE(l.debit, 0)),
        SUM(COALESCE(l.credit, 0))
    INTO v_amount, v_count_estorno -- reutilizando variáveis
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    WHERE e.tenant_id = v_tenant_id
      AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';
    
    RAISE NOTICE '  Total Débitos:    R$ %', TO_CHAR(v_amount, 'FM999G999G999D00');
    RAISE NOTICE '  Total Créditos:   R$ %', TO_CHAR(v_count_estorno, 'FM999G999G999D00');
    RAISE NOTICE '  Diferença Global: R$ %', TO_CHAR(ABS(v_amount - v_count_estorno), 'FM999G999G999D00');
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  CORREÇÃO CONCLUÍDA';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    
END $$;
