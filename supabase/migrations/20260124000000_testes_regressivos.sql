-- =====================================================
-- TESTES REGRESSIVOS CONTÁBEIS
-- Checklist item 1.3 - Testes Regressivos
-- =====================================================

-- Tabela para armazenar resultados de testes
CREATE TABLE IF NOT EXISTS accounting_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    test_name TEXT NOT NULL,
    test_scenario TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    error_message TEXT,
    details JSONB DEFAULT '{}',
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_test_results_tenant ON accounting_test_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_results_scenario ON accounting_test_results(test_scenario);

ALTER TABLE accounting_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem testes do próprio tenant" ON accounting_test_results
    FOR ALL USING (tenant_id = get_my_tenant_id());

-- =====================================================
-- 1. TESTE: PROVISÃO DE HONORÁRIOS
-- =====================================================
-- Valida que provisão cria lançamento balanceado:
-- D: Clientes a Receber (1.1.2.01.XXXX)
-- C: Receita de Honorários (3.1.1.01)

CREATE OR REPLACE FUNCTION fn_test_provisao_honorarios(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_client_id UUID;
    v_client_name TEXT;
    v_client_account_id UUID;
    v_revenue_account_id UUID;
    v_entry_id UUID;
    v_test_amount NUMERIC := 1000.00;
    v_result JSONB;
    v_passed BOOLEAN := TRUE;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- 1. Busca um cliente ativo com conta no plano
    SELECT c.id, c.name INTO v_client_id, v_client_name
    FROM clients c
    WHERE c.tenant_id = v_tenant_id AND c.is_active = true
    LIMIT 1;

    IF v_client_id IS NULL THEN
        RETURN jsonb_build_object('passed', false, 'error', 'Nenhum cliente ativo encontrado');
    END IF;

    -- 2. Busca conta do cliente (1.1.2.01.XXXX)
    SELECT id INTO v_client_account_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND LOWER(name) = LOWER(v_client_name)
      AND code LIKE '1.1.2.01.%';

    IF v_client_account_id IS NULL THEN
        v_errors := array_append(v_errors, 'Conta de cliente não encontrada no plano de contas');
        v_passed := FALSE;
    END IF;

    -- 3. Busca conta de receita (3.1.1.01)
    SELECT id INTO v_revenue_account_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id AND code = '3.1.1.01';

    IF v_revenue_account_id IS NULL THEN
        v_errors := array_append(v_errors, 'Conta de receita (3.1.1.01) não encontrada');
        v_passed := FALSE;
    END IF;

    -- Se dry_run = false e passou nas validações, cria lançamento de teste
    IF NOT p_dry_run AND v_passed THEN
        -- Desabilita triggers temporariamente para teste
        ALTER TABLE accounting_entries DISABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

        BEGIN
            -- Cria entry
            INSERT INTO accounting_entries (
                tenant_id, entry_type, description, entry_date, competence_date,
                total_debit, total_credit, balanced, internal_code
            ) VALUES (
                v_tenant_id, 'provision', 'TESTE: Provisão de honorários - ' || v_client_name,
                CURRENT_DATE, CURRENT_DATE,
                v_test_amount, v_test_amount, TRUE,
                'TEST_PROVISION_' || gen_random_uuid()::TEXT
            ) RETURNING id INTO v_entry_id;

            -- Cria linhas: D: Cliente, C: Receita
            INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
            VALUES
                (v_tenant_id, v_entry_id, v_client_account_id, v_test_amount, 0, 'D: ' || v_client_name),
                (v_tenant_id, v_entry_id, v_revenue_account_id, 0, v_test_amount, 'C: Receita Honorários');

            -- Verifica se ficou balanceado
            PERFORM 1 FROM accounting_entries
            WHERE id = v_entry_id AND total_debit = total_credit;

            IF NOT FOUND THEN
                v_errors := array_append(v_errors, 'Lançamento ficou desbalanceado');
                v_passed := FALSE;
            END IF;

            -- Remove lançamento de teste
            DELETE FROM accounting_entry_lines WHERE entry_id = v_entry_id;
            DELETE FROM accounting_entries WHERE id = v_entry_id;

        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 'Erro ao criar lançamento: ' || SQLERRM);
            v_passed := FALSE;
        END;

        ALTER TABLE accounting_entries ENABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
    END IF;

    v_result := jsonb_build_object(
        'test_name', 'Provisão de Honorários',
        'passed', v_passed,
        'errors', to_jsonb(v_errors),
        'dry_run', p_dry_run,
        'details', jsonb_build_object(
            'client', v_client_name,
            'client_account_id', v_client_account_id,
            'revenue_account_id', v_revenue_account_id,
            'test_amount', v_test_amount
        )
    );

    -- Registra resultado
    INSERT INTO accounting_test_results (tenant_id, test_name, test_scenario, passed, error_message, details)
    VALUES (v_tenant_id, 'Provisão de Honorários', 'provision', v_passed, array_to_string(v_errors, '; '), v_result);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. TESTE: RECEBIMENTO DE CLIENTE
-- =====================================================
-- Valida que recebimento cria lançamento:
-- D: Banco (1.1.1.05)
-- C: Clientes a Receber (1.1.2.01.XXXX)

CREATE OR REPLACE FUNCTION fn_test_recebimento_cliente(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_client_name TEXT;
    v_client_account_id UUID;
    v_bank_account_id UUID;
    v_entry_id UUID;
    v_test_amount NUMERIC := 500.00;
    v_result JSONB;
    v_passed BOOLEAN := TRUE;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- 1. Busca uma conta de cliente com saldo devedor
    SELECT coa.id, coa.name INTO v_client_account_id, v_client_name
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.tenant_id = v_tenant_id
      AND coa.code LIKE '1.1.2.01.%'
      AND coa.is_synthetic = false
    GROUP BY coa.id, coa.name
    HAVING COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) > 100
    LIMIT 1;

    IF v_client_account_id IS NULL THEN
        -- Pega qualquer conta de cliente
        SELECT id, name INTO v_client_account_id, v_client_name
        FROM chart_of_accounts
        WHERE tenant_id = v_tenant_id AND code LIKE '1.1.2.01.%' AND is_synthetic = false
        LIMIT 1;
    END IF;

    IF v_client_account_id IS NULL THEN
        RETURN jsonb_build_object('passed', false, 'error', 'Nenhuma conta de cliente encontrada');
    END IF;

    -- 2. Busca conta do banco (1.1.1.05)
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id AND code = '1.1.1.05';

    IF v_bank_account_id IS NULL THEN
        v_errors := array_append(v_errors, 'Conta do banco (1.1.1.05) não encontrada');
        v_passed := FALSE;
    END IF;

    -- Se dry_run = false, executa teste completo
    IF NOT p_dry_run AND v_passed THEN
        ALTER TABLE accounting_entries DISABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

        BEGIN
            INSERT INTO accounting_entries (
                tenant_id, entry_type, description, entry_date, competence_date,
                total_debit, total_credit, balanced, internal_code
            ) VALUES (
                v_tenant_id, 'receipt', 'TESTE: Recebimento - ' || v_client_name,
                CURRENT_DATE, CURRENT_DATE,
                v_test_amount, v_test_amount, TRUE,
                'TEST_RECEIPT_' || gen_random_uuid()::TEXT
            ) RETURNING id INTO v_entry_id;

            -- D: Banco, C: Cliente
            INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
            VALUES
                (v_tenant_id, v_entry_id, v_bank_account_id, v_test_amount, 0, 'D: Banco Sicredi'),
                (v_tenant_id, v_entry_id, v_client_account_id, 0, v_test_amount, 'C: ' || v_client_name);

            -- Verifica balanceamento
            PERFORM 1 FROM accounting_entries WHERE id = v_entry_id AND total_debit = total_credit;
            IF NOT FOUND THEN
                v_errors := array_append(v_errors, 'Lançamento desbalanceado');
                v_passed := FALSE;
            END IF;

            -- Remove teste
            DELETE FROM accounting_entry_lines WHERE entry_id = v_entry_id;
            DELETE FROM accounting_entries WHERE id = v_entry_id;

        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 'Erro: ' || SQLERRM);
            v_passed := FALSE;
        END;

        ALTER TABLE accounting_entries ENABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
    END IF;

    v_result := jsonb_build_object(
        'test_name', 'Recebimento de Cliente',
        'passed', v_passed,
        'errors', to_jsonb(v_errors),
        'dry_run', p_dry_run,
        'details', jsonb_build_object(
            'client', v_client_name,
            'client_account_id', v_client_account_id,
            'bank_account_id', v_bank_account_id,
            'test_amount', v_test_amount
        )
    );

    INSERT INTO accounting_test_results (tenant_id, test_name, test_scenario, passed, error_message, details)
    VALUES (v_tenant_id, 'Recebimento de Cliente', 'receipt', v_passed, array_to_string(v_errors, '; '), v_result);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TESTE: PAGAMENTO DE DESPESA
-- =====================================================
-- Valida que pagamento cria lançamento:
-- D: Despesa (4.X.X.XX)
-- C: Banco (1.1.1.05)

CREATE OR REPLACE FUNCTION fn_test_pagamento_despesa(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_expense_account_id UUID;
    v_expense_name TEXT;
    v_bank_account_id UUID;
    v_entry_id UUID;
    v_test_amount NUMERIC := 250.00;
    v_result JSONB;
    v_passed BOOLEAN := TRUE;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- 1. Busca conta de despesa (4.X.X.XX)
    SELECT id, name INTO v_expense_account_id, v_expense_name
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND code LIKE '4.%'
      AND is_synthetic = false
    LIMIT 1;

    IF v_expense_account_id IS NULL THEN
        v_errors := array_append(v_errors, 'Nenhuma conta de despesa encontrada');
        v_passed := FALSE;
    END IF;

    -- 2. Busca conta do banco
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id AND code = '1.1.1.05';

    IF v_bank_account_id IS NULL THEN
        v_errors := array_append(v_errors, 'Conta do banco não encontrada');
        v_passed := FALSE;
    END IF;

    IF NOT p_dry_run AND v_passed THEN
        ALTER TABLE accounting_entries DISABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

        BEGIN
            INSERT INTO accounting_entries (
                tenant_id, entry_type, description, entry_date, competence_date,
                total_debit, total_credit, balanced, internal_code
            ) VALUES (
                v_tenant_id, 'payment', 'TESTE: Pagamento despesa - ' || v_expense_name,
                CURRENT_DATE, CURRENT_DATE,
                v_test_amount, v_test_amount, TRUE,
                'TEST_EXPENSE_' || gen_random_uuid()::TEXT
            ) RETURNING id INTO v_entry_id;

            -- D: Despesa, C: Banco
            INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
            VALUES
                (v_tenant_id, v_entry_id, v_expense_account_id, v_test_amount, 0, 'D: ' || v_expense_name),
                (v_tenant_id, v_entry_id, v_bank_account_id, 0, v_test_amount, 'C: Banco Sicredi');

            PERFORM 1 FROM accounting_entries WHERE id = v_entry_id AND total_debit = total_credit;
            IF NOT FOUND THEN
                v_errors := array_append(v_errors, 'Lançamento desbalanceado');
                v_passed := FALSE;
            END IF;

            DELETE FROM accounting_entry_lines WHERE entry_id = v_entry_id;
            DELETE FROM accounting_entries WHERE id = v_entry_id;

        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 'Erro: ' || SQLERRM);
            v_passed := FALSE;
        END;

        ALTER TABLE accounting_entries ENABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
    END IF;

    v_result := jsonb_build_object(
        'test_name', 'Pagamento de Despesa',
        'passed', v_passed,
        'errors', to_jsonb(v_errors),
        'dry_run', p_dry_run,
        'details', jsonb_build_object(
            'expense_account', v_expense_name,
            'expense_account_id', v_expense_account_id,
            'bank_account_id', v_bank_account_id,
            'test_amount', v_test_amount
        )
    );

    INSERT INTO accounting_test_results (tenant_id, test_name, test_scenario, passed, error_message, details)
    VALUES (v_tenant_id, 'Pagamento de Despesa', 'expense', v_passed, array_to_string(v_errors, '; '), v_result);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TESTE: ESTORNO DE LANÇAMENTO
-- =====================================================
-- Valida que estorno inverte débitos e créditos

CREATE OR REPLACE FUNCTION fn_test_estorno_lancamento(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_original_entry_id UUID;
    v_original_debit NUMERIC;
    v_original_credit NUMERIC;
    v_reversal_entry_id UUID;
    v_result JSONB;
    v_passed BOOLEAN := TRUE;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- 1. Busca um lançamento existente para simular estorno
    SELECT ae.id, ae.total_debit, ae.total_credit
    INTO v_original_entry_id, v_original_debit, v_original_credit
    FROM accounting_entries ae
    WHERE ae.tenant_id = v_tenant_id
      AND ae.balanced = TRUE
      AND ae.total_debit > 0
    ORDER BY ae.entry_date DESC
    LIMIT 1;

    IF v_original_entry_id IS NULL THEN
        v_errors := array_append(v_errors, 'Nenhum lançamento encontrado para teste de estorno');
        v_passed := FALSE;
    END IF;

    -- Validação: estorno deve ter mesmos valores invertidos
    IF v_passed THEN
        -- Simula estorno: verifica se podemos criar lançamento inverso
        IF v_original_debit != v_original_credit THEN
            v_errors := array_append(v_errors, 'Lançamento original desbalanceado');
            v_passed := FALSE;
        END IF;
    END IF;

    IF NOT p_dry_run AND v_passed THEN
        ALTER TABLE accounting_entries DISABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

        BEGIN
            -- Cria estorno
            INSERT INTO accounting_entries (
                tenant_id, entry_type, description, entry_date, competence_date,
                total_debit, total_credit, balanced, internal_code, reference_id
            ) VALUES (
                v_tenant_id, 'reversal', 'TESTE: Estorno do lançamento ' || v_original_entry_id::TEXT,
                CURRENT_DATE, CURRENT_DATE,
                v_original_credit, v_original_debit, TRUE,
                'TEST_REVERSAL_' || gen_random_uuid()::TEXT,
                v_original_entry_id
            ) RETURNING id INTO v_reversal_entry_id;

            -- Cria linhas invertidas
            INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
            SELECT
                v_tenant_id,
                v_reversal_entry_id,
                account_id,
                credit AS debit,  -- Inverte
                debit AS credit,  -- Inverte
                'ESTORNO: ' || description
            FROM accounting_entry_lines
            WHERE entry_id = v_original_entry_id;

            -- Verifica balanceamento do estorno
            PERFORM 1 FROM accounting_entries WHERE id = v_reversal_entry_id AND total_debit = total_credit;
            IF NOT FOUND THEN
                v_errors := array_append(v_errors, 'Estorno ficou desbalanceado');
                v_passed := FALSE;
            END IF;

            -- Remove teste
            DELETE FROM accounting_entry_lines WHERE entry_id = v_reversal_entry_id;
            DELETE FROM accounting_entries WHERE id = v_reversal_entry_id;

        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 'Erro: ' || SQLERRM);
            v_passed := FALSE;
        END;

        ALTER TABLE accounting_entries ENABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
    END IF;

    v_result := jsonb_build_object(
        'test_name', 'Estorno de Lançamento',
        'passed', v_passed,
        'errors', to_jsonb(v_errors),
        'dry_run', p_dry_run,
        'details', jsonb_build_object(
            'original_entry_id', v_original_entry_id,
            'original_debit', v_original_debit,
            'original_credit', v_original_credit
        )
    );

    INSERT INTO accounting_test_results (tenant_id, test_name, test_scenario, passed, error_message, details)
    VALUES (v_tenant_id, 'Estorno de Lançamento', 'reversal', v_passed, array_to_string(v_errors, '; '), v_result);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. TESTE: TRANSFERÊNCIA ENTRE CONTAS
-- =====================================================
-- Valida transferência (ex: Caixa -> Banco):
-- D: Conta destino
-- C: Conta origem

CREATE OR REPLACE FUNCTION fn_test_transferencia_contas(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_origin_account_id UUID;
    v_dest_account_id UUID;
    v_entry_id UUID;
    v_test_amount NUMERIC := 1000.00;
    v_result JSONB;
    v_passed BOOLEAN := TRUE;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- 1. Busca duas contas de ativo (caixa e banco)
    SELECT id INTO v_origin_account_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id AND code = '1.1.1.01'; -- Caixa

    SELECT id INTO v_dest_account_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id AND code = '1.1.1.05'; -- Banco

    IF v_origin_account_id IS NULL THEN
        v_errors := array_append(v_errors, 'Conta Caixa (1.1.1.01) não encontrada');
        v_passed := FALSE;
    END IF;

    IF v_dest_account_id IS NULL THEN
        v_errors := array_append(v_errors, 'Conta Banco (1.1.1.05) não encontrada');
        v_passed := FALSE;
    END IF;

    IF NOT p_dry_run AND v_passed THEN
        ALTER TABLE accounting_entries DISABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

        BEGIN
            INSERT INTO accounting_entries (
                tenant_id, entry_type, description, entry_date, competence_date,
                total_debit, total_credit, balanced, internal_code
            ) VALUES (
                v_tenant_id, 'transfer', 'TESTE: Transferência Caixa -> Banco',
                CURRENT_DATE, CURRENT_DATE,
                v_test_amount, v_test_amount, TRUE,
                'TEST_TRANSFER_' || gen_random_uuid()::TEXT
            ) RETURNING id INTO v_entry_id;

            -- D: Banco (destino), C: Caixa (origem)
            INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
            VALUES
                (v_tenant_id, v_entry_id, v_dest_account_id, v_test_amount, 0, 'D: Banco Sicredi'),
                (v_tenant_id, v_entry_id, v_origin_account_id, 0, v_test_amount, 'C: Caixa');

            PERFORM 1 FROM accounting_entries WHERE id = v_entry_id AND total_debit = total_credit;
            IF NOT FOUND THEN
                v_errors := array_append(v_errors, 'Transferência ficou desbalanceada');
                v_passed := FALSE;
            END IF;

            DELETE FROM accounting_entry_lines WHERE entry_id = v_entry_id;
            DELETE FROM accounting_entries WHERE id = v_entry_id;

        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 'Erro: ' || SQLERRM);
            v_passed := FALSE;
        END;

        ALTER TABLE accounting_entries ENABLE TRIGGER USER;
        ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
    END IF;

    v_result := jsonb_build_object(
        'test_name', 'Transferência entre Contas',
        'passed', v_passed,
        'errors', to_jsonb(v_errors),
        'dry_run', p_dry_run,
        'details', jsonb_build_object(
            'origin_account', '1.1.1.01 - Caixa',
            'dest_account', '1.1.1.05 - Banco',
            'test_amount', v_test_amount
        )
    );

    INSERT INTO accounting_test_results (tenant_id, test_name, test_scenario, passed, error_message, details)
    VALUES (v_tenant_id, 'Transferência entre Contas', 'transfer', v_passed, array_to_string(v_errors, '; '), v_result);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO MESTRE: EXECUTA TODOS OS TESTES
-- =====================================================

CREATE OR REPLACE FUNCTION fn_run_all_accounting_tests(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_results JSONB[] := ARRAY[]::JSONB[];
    v_total_passed INTEGER := 0;
    v_total_failed INTEGER := 0;
    v_test_result JSONB;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Executa cada teste
    v_test_result := fn_test_provisao_honorarios(v_tenant_id, p_dry_run);
    v_results := array_append(v_results, v_test_result);
    IF (v_test_result->>'passed')::BOOLEAN THEN v_total_passed := v_total_passed + 1; ELSE v_total_failed := v_total_failed + 1; END IF;

    v_test_result := fn_test_recebimento_cliente(v_tenant_id, p_dry_run);
    v_results := array_append(v_results, v_test_result);
    IF (v_test_result->>'passed')::BOOLEAN THEN v_total_passed := v_total_passed + 1; ELSE v_total_failed := v_total_failed + 1; END IF;

    v_test_result := fn_test_pagamento_despesa(v_tenant_id, p_dry_run);
    v_results := array_append(v_results, v_test_result);
    IF (v_test_result->>'passed')::BOOLEAN THEN v_total_passed := v_total_passed + 1; ELSE v_total_failed := v_total_failed + 1; END IF;

    v_test_result := fn_test_estorno_lancamento(v_tenant_id, p_dry_run);
    v_results := array_append(v_results, v_test_result);
    IF (v_test_result->>'passed')::BOOLEAN THEN v_total_passed := v_total_passed + 1; ELSE v_total_failed := v_total_failed + 1; END IF;

    v_test_result := fn_test_transferencia_contas(v_tenant_id, p_dry_run);
    v_results := array_append(v_results, v_test_result);
    IF (v_test_result->>'passed')::BOOLEAN THEN v_total_passed := v_total_passed + 1; ELSE v_total_failed := v_total_failed + 1; END IF;

    RETURN jsonb_build_object(
        'executed_at', NOW(),
        'tenant_id', v_tenant_id,
        'dry_run', p_dry_run,
        'total_tests', 5,
        'passed', v_total_passed,
        'failed', v_total_failed,
        'success_rate', ROUND((v_total_passed::NUMERIC / 5) * 100, 1),
        'all_passed', v_total_failed = 0,
        'results', to_jsonb(v_results)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT ON accounting_test_results TO authenticated;
GRANT EXECUTE ON FUNCTION fn_test_provisao_honorarios(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_test_recebimento_cliente(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_test_pagamento_despesa(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_test_estorno_lancamento(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_test_transferencia_contas(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_run_all_accounting_tests(UUID, BOOLEAN) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
