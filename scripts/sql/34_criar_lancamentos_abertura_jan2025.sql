-- ============================================================================
-- CRIAÇÃO DE LANÇAMENTOS DE ABERTURA - EXERCÍCIO 01/01/2025
-- ============================================================================
-- Regra: Saldo inicial é LANÇAMENTO CONTÁBIL
-- Data: 01/01/2025 (exercício atual)
-- Tipo: SALDO_ABERTURA / document_type: ABERTURA / origin: saldo_inicial
-- Partidas dobradas: D-1.1.2.01.xxxx (Cliente) | C-5.2.1.01 (Lucros Acumulados)
-- ============================================================================

-- Constantes
DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_data_abertura DATE := '2025-01-01';
    v_conta_contrapartida_id UUID;
    v_entry_id UUID;
    v_conta_cliente_id UUID;
    v_saldo RECORD;
    v_total_processados INT := 0;
    v_total_valor NUMERIC := 0;
BEGIN
    -- Desabilitar triggers temporariamente
    ALTER TABLE accounting_entries DISABLE TRIGGER USER;
    ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
    
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'CRIANDO LANÇAMENTOS CONTÁBEIS - SALDO DE ABERTURA 01/01/2025';
    RAISE NOTICE '=================================================================';
    
    -- Buscar conta contrapartida (5.2.1.01 - Lucros Acumulados)
    SELECT id INTO v_conta_contrapartida_id
    FROM chart_of_accounts
    WHERE code = '5.2.1.01' AND tenant_id = v_tenant_id;
    
    IF v_conta_contrapartida_id IS NULL THEN
        RAISE EXCEPTION 'Conta 5.2.1.01 (Lucros Acumulados) não encontrada!';
    END IF;
    
    RAISE NOTICE 'Conta contrapartida: 5.2.1.01 (ID: %)', v_conta_contrapartida_id;
    
    -- Processar cada saldo pendente
    FOR v_saldo IN 
        SELECT 
            cob.id,
            cob.client_id,
            cob.competence,
            cob.value,
            c.name AS client_name,
            ca.id AS conta_id,
            ca.code AS conta_code
        FROM client_opening_balance cob
        JOIN clients c ON c.id = cob.client_id
        LEFT JOIN chart_of_accounts ca ON ca.client_id = cob.client_id 
            AND ca.code LIKE '1.1.2.01.%'
            AND ca.tenant_id = v_tenant_id
        WHERE cob.status = 'pending'
        AND cob.tenant_id = v_tenant_id
        ORDER BY ca.code, cob.competence
    LOOP
        -- Verificar se tem conta analítica do cliente
        IF v_saldo.conta_id IS NULL THEN
            RAISE NOTICE 'AVISO: Cliente % (%) sem conta analítica - pulando', 
                v_saldo.client_name, v_saldo.client_id;
            CONTINUE;
        END IF;
        
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
            origin,
            total_debit,
            total_credit,
            is_balanced,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_data_abertura,
            v_data_abertura,
            'SALDO_ABERTURA',
            'ABERTURA',
            'saldo_inicial',
            'Saldo de abertura ' || to_char(v_data_abertura, 'DD/MM/YYYY') || 
                ' - ' || v_saldo.client_name || ' (' || v_saldo.competence || ')',
            'saldo_inicial',
            v_saldo.value,
            v_saldo.value,
            true,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_entry_id;
        
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
            v_saldo.conta_id,
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
        WHERE id = v_saldo.id;
        
        v_total_processados := v_total_processados + 1;
        v_total_valor := v_total_valor + v_saldo.value;
        
    END LOOP;
    
    -- Reativar triggers
    ALTER TABLE accounting_entries ENABLE TRIGGER USER;
    ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
    
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'RESUMO:';
    RAISE NOTICE '  Lançamentos criados: %', v_total_processados;
    RAISE NOTICE '  Total lançado: R$ %', TO_CHAR(v_total_valor, 'FM999,999,990.00');
    RAISE NOTICE '=================================================================';
    
END $$;

-- Verificar resultado
SELECT 
    'Lançamentos ABERTURA 01/01/2025' AS tipo,
    COUNT(*) AS total,
    TO_CHAR(SUM(total_debit), 'FM999,999,990.00') AS total_debit
FROM accounting_entries
WHERE entry_type = 'SALDO_ABERTURA'
AND entry_date = '2025-01-01'
AND tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- Verificar saldos pendentes restantes
SELECT 
    'Saldos ainda pendentes' AS status,
    COUNT(*) AS total,
    TO_CHAR(SUM(value), 'FM999,999,990.00') AS valor
FROM client_opening_balance
WHERE status = 'pending'
AND tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- Verificar equação contábil
SELECT 
    'Equação Contábil' AS verificacao,
    TO_CHAR(SUM(debit), 'FM999,999,990.00') AS total_debitos,
    TO_CHAR(SUM(credit), 'FM999,999,990.00') AS total_creditos,
    CASE 
        WHEN ABS(SUM(debit) - SUM(credit)) < 0.01 THEN 'OK ✓'
        ELSE 'ERRO! Diferença: R$ ' || TO_CHAR(ABS(SUM(debit) - SUM(credit)), 'FM999,999,990.00')
    END AS status
FROM accounting_entry_lines
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';
