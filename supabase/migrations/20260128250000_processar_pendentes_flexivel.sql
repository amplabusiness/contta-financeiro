-- Migration: Processar saldos pendentes usando busca flexível de contas
-- Data: 28/01/2025 - Fase F1-01 (finalização)
-- Estratégia: usar ILIKE e busca parcial para encontrar contas

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
    v_nome_busca TEXT;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'PROCESSANDO SALDOS PENDENTES (BUSCA FLEXÍVEL)';
    RAISE NOTICE '================================================================';

    -- Buscar conta contrapartida
    SELECT id INTO v_conta_contrapartida_id
    FROM chart_of_accounts
    WHERE code = '5.2.1.01'
    AND tenant_id = v_tenant_id;

    IF v_conta_contrapartida_id IS NULL THEN
        RAISE EXCEPTION 'Conta 5.2.1.01 não encontrada!';
    END IF;

    -- Processar cada saldo pendente
    FOR v_saldo IN
        SELECT
            cob.id AS cob_id,
            cob.client_id,
            cob.competence,
            cob.amount AS value,
            c.name AS client_name
        FROM client_opening_balance cob
        JOIN clients c ON c.id = cob.client_id
        WHERE cob.status = 'pending'
        AND cob.tenant_id = v_tenant_id
        ORDER BY c.name, cob.competence
    LOOP
        -- Preparar nome para busca (remover LTDA, ME, etc para busca mais flexível)
        v_nome_busca := REGEXP_REPLACE(
            UPPER(TRIM(v_saldo.client_name)), 
            '\s*(LTDA|ME|EIRELI|S\.?A\.?|LTDA\.?)\s*$', 
            '', 
            'gi'
        );
        
        -- Tentar busca exata primeiro
        SELECT id INTO v_conta_cliente_id
        FROM chart_of_accounts
        WHERE code LIKE '1.1.2.01.%'
        AND code NOT LIKE '%CONSOLIDADO%'
        AND tenant_id = v_tenant_id
        AND UPPER(TRIM(name)) = UPPER(TRIM(v_saldo.client_name))
        LIMIT 1;
        
        -- Se não achou, tentar busca parcial
        IF v_conta_cliente_id IS NULL THEN
            SELECT id INTO v_conta_cliente_id
            FROM chart_of_accounts
            WHERE code LIKE '1.1.2.01.%'
            AND code NOT LIKE '%CONSOLIDADO%'
            AND tenant_id = v_tenant_id
            AND UPPER(name) LIKE v_nome_busca || '%'
            LIMIT 1;
        END IF;
        
        -- Se ainda não achou, buscar por similaridade
        IF v_conta_cliente_id IS NULL THEN
            SELECT id INTO v_conta_cliente_id
            FROM chart_of_accounts
            WHERE code LIKE '1.1.2.01.%'
            AND name NOT LIKE '%CONSOLIDADO%'
            AND tenant_id = v_tenant_id
            AND (
                UPPER(name) LIKE '%' || v_nome_busca || '%'
                OR v_nome_busca LIKE '%' || REGEXP_REPLACE(UPPER(name), '\s*(LTDA|ME|EIRELI|S\.?A\.?)\s*$', '', 'gi') || '%'
            )
            ORDER BY LENGTH(name)  -- Preferir nomes mais curtos (menos qualificadores)
            LIMIT 1;
        END IF;

        IF v_conta_cliente_id IS NULL THEN
            RAISE NOTICE 'AVISO: Cliente % (busca: %) sem conta analítica', v_saldo.client_name, v_nome_busca;
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

        -- Débito na conta do cliente
        INSERT INTO accounting_entry_lines (
            id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES (
            gen_random_uuid(), v_tenant_id, v_entry_id, v_conta_cliente_id,
            v_saldo.value, 0, 'D - Saldo devedor abertura - ' || v_saldo.client_name, NOW()
        );

        -- Crédito na contrapartida
        INSERT INTO accounting_entry_lines (
            id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES (
            gen_random_uuid(), v_tenant_id, v_entry_id, v_conta_contrapartida_id,
            0, v_saldo.value, 'C - Contrapartida abertura - ' || v_saldo.client_name, NOW()
        );

        -- Atualizar status
        UPDATE client_opening_balance
        SET status = 'processed', updated_at = NOW()
        WHERE id = v_saldo.cob_id;

        v_total_processados := v_total_processados + 1;
        v_total_valor := v_total_valor + v_saldo.value;

    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'RESUMO FINAL:';
    RAISE NOTICE '  Lançamentos criados: %', v_total_processados;
    RAISE NOTICE '  Ainda sem conta: %', v_sem_conta;
    RAISE NOTICE '  Total lançado: R$ %', TO_CHAR(v_total_valor, 'FM999,999,990.00');
    RAISE NOTICE '================================================================';
END $$;

-- Reabilitar triggers
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE client_opening_balance ENABLE TRIGGER USER;
