-- Migration: Mapeamento manual para clientes com nomes diferentes
-- Data: 28/01/2025 - Fase F1-01 (mapeamento manual)

-- Mapeamento de nomes:
-- 'JULLYANA MENDONÇA RODRIGUES' -> '1.1.2.01.0001' (JULLYANA MENDONCA RODRIGUES SILVA)
-- 'KORSICA COM ATAC DE PNEUS LTDA' -> '1.1.2.01.0093' (KORSICA COMERCIO ATACADISTA DE PNEUS LTDA ME)
-- 'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA' -> Criar nova conta (razão social diferente)

ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
ALTER TABLE client_opening_balance DISABLE TRIGGER USER;

DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_data_abertura DATE := '2025-01-01';
    v_conta_contrapartida_id UUID;
    v_entry_id UUID;
    v_saldo RECORD;
    v_conta_cliente_id UUID;
    v_total_processados INT := 0;
    v_total_valor NUMERIC := 0;
    v_sem_conta INT := 0;
    v_parent_id UUID;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'PROCESSANDO SALDOS PENDENTES (MAPEAMENTO MANUAL)';
    RAISE NOTICE '================================================================';

    -- Buscar conta contrapartida
    SELECT id INTO v_conta_contrapartida_id
    FROM chart_of_accounts WHERE code = '5.2.1.01' AND tenant_id = v_tenant_id;

    -- Buscar conta pai para criar novas contas
    SELECT id INTO v_parent_id
    FROM chart_of_accounts WHERE code = '1.1.2.01' AND tenant_id = v_tenant_id;

    -- Processar cada saldo pendente
    FOR v_saldo IN
        SELECT
            cob.id AS cob_id,
            cob.amount AS value,
            cob.competence,
            c.name AS client_name
        FROM client_opening_balance cob
        JOIN clients c ON c.id = cob.client_id
        WHERE cob.status = 'pending'
        AND cob.tenant_id = v_tenant_id
    LOOP
        -- Mapeamento manual
        v_conta_cliente_id := NULL;
        
        IF v_saldo.client_name ILIKE '%JULLYANA%' THEN
            SELECT id INTO v_conta_cliente_id FROM chart_of_accounts 
            WHERE code = '1.1.2.01.0001' AND tenant_id = v_tenant_id;
            
        ELSIF v_saldo.client_name ILIKE '%KORSICA%' THEN
            SELECT id INTO v_conta_cliente_id FROM chart_of_accounts 
            WHERE code = '1.1.2.01.0093' AND tenant_id = v_tenant_id;
            
        ELSIF v_saldo.client_name ILIKE '%UNICAIXAS%' THEN
            -- Criar conta específica para UNICAIXAS INDUSTRIA
            SELECT id INTO v_conta_cliente_id FROM chart_of_accounts 
            WHERE UPPER(name) LIKE '%UNICAIXAS INDUSTRIA%' 
            AND code LIKE '1.1.2.01.%' 
            AND tenant_id = v_tenant_id;
            
            IF v_conta_cliente_id IS NULL THEN
                v_conta_cliente_id := gen_random_uuid();
                INSERT INTO chart_of_accounts (
                    id, tenant_id, code, name, account_type, nature, parent_id, level,
                    is_analytical, accepts_entries, is_active, created_at, updated_at
                ) VALUES (
                    v_conta_cliente_id, v_tenant_id, '1.1.2.01.9001', 
                    'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA',
                    'ATIVO', 'DEVEDORA', v_parent_id, 5, true, true, true, NOW(), NOW()
                );
                RAISE NOTICE 'Criada conta 1.1.2.01.9001 para UNICAIXAS INDUSTRIA';
            END IF;
        END IF;

        IF v_conta_cliente_id IS NULL THEN
            RAISE NOTICE 'AVISO: Cliente % sem mapeamento', v_saldo.client_name;
            v_sem_conta := v_sem_conta + 1;
            CONTINUE;
        END IF;

        -- Criar lançamento
        v_entry_id := gen_random_uuid();

        INSERT INTO accounting_entries (
            id, tenant_id, entry_date, competence_date, entry_type, document_type,
            reference_type, description, total_debit, total_credit, created_at, updated_at
        ) VALUES (
            v_entry_id, v_tenant_id, v_data_abertura, v_data_abertura,
            'SALDO_ABERTURA', 'ABERTURA', 'saldo_inicial',
            'Saldo de abertura 01/01/2025 - ' || v_saldo.client_name || ' (' || v_saldo.competence || ')',
            v_saldo.value, v_saldo.value, NOW(), NOW()
        );

        INSERT INTO accounting_entry_lines (
            id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES (
            gen_random_uuid(), v_tenant_id, v_entry_id, v_conta_cliente_id,
            v_saldo.value, 0, 'D - Saldo devedor abertura - ' || v_saldo.client_name, NOW()
        );

        INSERT INTO accounting_entry_lines (
            id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES (
            gen_random_uuid(), v_tenant_id, v_entry_id, v_conta_contrapartida_id,
            0, v_saldo.value, 'C - Contrapartida abertura - ' || v_saldo.client_name, NOW()
        );

        UPDATE client_opening_balance SET status = 'processed', updated_at = NOW() WHERE id = v_saldo.cob_id;

        v_total_processados := v_total_processados + 1;
        v_total_valor := v_total_valor + v_saldo.value;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'RESUMO FINAL:';
    RAISE NOTICE '  Lançamentos criados: %', v_total_processados;
    RAISE NOTICE '  Sem mapeamento: %', v_sem_conta;
    RAISE NOTICE '  Total lançado: R$ %', TO_CHAR(v_total_valor, 'FM999,999,990.00');
    RAISE NOTICE '================================================================';
END $$;

ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE client_opening_balance ENABLE TRIGGER USER;
