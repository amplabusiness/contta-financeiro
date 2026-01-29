-- Migration: Criar lançamentos de abertura DESABILITANDO triggers temporariamente
-- Data: 28/01/2025 - Fase F1-01
-- Estratégia: DISABLE TRIGGER ALL (apenas nos statements de INSERT)

-- STEP 1: Primeiro, desabilitar apenas triggers de USUÁRIO nas tabelas relevantes
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
ALTER TABLE client_opening_balance DISABLE TRIGGER USER;

-- STEP 2: Agora criar os lançamentos
DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_data_abertura DATE := '2025-01-01';
    v_conta_contrapartida_id UUID;
    v_entry_id UUID;
    v_saldo RECORD;
    v_conta_cliente RECORD;
    v_total_processados INT := 0;
    v_total_valor NUMERIC := 0;
    v_sem_conta INT := 0;
    v_nome_normalizado TEXT;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'CRIANDO LANÇAMENTOS CONTÁBEIS - SALDO DE ABERTURA 01/01/2025';
    RAISE NOTICE '================================================================';

    -- Buscar conta contrapartida (5.2.1.01 - Lucros Acumulados)
    SELECT id INTO v_conta_contrapartida_id
    FROM chart_of_accounts
    WHERE code = '5.2.1.01'
    AND tenant_id = v_tenant_id;

    IF v_conta_contrapartida_id IS NULL THEN
        RAISE EXCEPTION 'Conta 5.2.1.01 (Lucros Acumulados) não encontrada!';
    END IF;

    RAISE NOTICE 'Conta contrapartida: 5.2.1.01 (ID: %)', v_conta_contrapartida_id;

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
        -- Normalizar nome do cliente para busca (sem usar unaccent)
        v_nome_normalizado := UPPER(TRIM(v_saldo.client_name));

        -- Buscar conta do cliente pelo nome (case insensitive)
        SELECT id, code INTO v_conta_cliente
        FROM chart_of_accounts
        WHERE code LIKE '1.1.2.01.%'
        AND tenant_id = v_tenant_id
        AND UPPER(TRIM(name)) = v_nome_normalizado
        LIMIT 1;

        -- Verificar se tem conta analítica do cliente
        IF v_conta_cliente.id IS NULL THEN
            RAISE NOTICE 'AVISO: Cliente % sem conta analítica - pulando', v_saldo.client_name;
            v_sem_conta := v_sem_conta + 1;
            CONTINUE;
        END IF;

        -- Gerar UUID para o lançamento
        v_entry_id := gen_random_uuid();

        -- Criar o lançamento contábil (accounting_entry)
        INSERT INTO accounting_entries (
            id,
            tenant_id,
            entry_date,
            competence_date,
            entry_type,
            document_type,
            reference_type,
            description,
            total_debit,
            total_credit,
            created_at,
            updated_at
        ) VALUES (
            v_entry_id,
            v_tenant_id,
            v_data_abertura,
            v_data_abertura,
            'SALDO_ABERTURA',
            'ABERTURA',
            'saldo_inicial',
            'Saldo de abertura 01/01/2025 - ' || v_saldo.client_name || ' (' || v_saldo.competence || ')',
            v_saldo.value,
            v_saldo.value,
            NOW(),
            NOW()
        );

        -- Linha 1: Débito na conta do cliente
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
            v_tenant_id,
            v_entry_id,
            v_conta_cliente.id,
            v_saldo.value,
            0,
            'D - Saldo devedor abertura - ' || v_saldo.client_name,
            NOW()
        );

        -- Linha 2: Crédito na contrapartida (5.2.1.01)
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
            v_tenant_id,
            v_entry_id,
            v_conta_contrapartida_id,
            0,
            v_saldo.value,
            'C - Contrapartida abertura - ' || v_saldo.client_name,
            NOW()
        );

        -- Atualizar status do saldo pendente
        UPDATE client_opening_balance
        SET status = 'processed',
            updated_at = NOW()
        WHERE id = v_saldo.cob_id;

        v_total_processados := v_total_processados + 1;
        v_total_valor := v_total_valor + v_saldo.value;

    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'RESUMO:';
    RAISE NOTICE '  Lançamentos criados: %', v_total_processados;
    RAISE NOTICE '  Clientes sem conta analítica: %', v_sem_conta;
    RAISE NOTICE '  Total lançado: R$ %', TO_CHAR(v_total_valor, 'FM999,999,990.00');
    RAISE NOTICE '================================================================';

END $$;

-- STEP 3: Reabilitar triggers de usuário
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE client_opening_balance ENABLE TRIGGER USER;
