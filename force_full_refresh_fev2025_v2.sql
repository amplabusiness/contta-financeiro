
-- ============================================================================
-- SCRIPT DE CORREÇÃO COMPLETA V2 - FEVEREIRO 2025 (COM ECONET)
-- ============================================================================
-- Este script faz 4 coisas:
-- 1. Cria a conta "Assinaturas Econet" se não existir.
-- 2. Atualiza a função de contabilidade para mapear ECONET corretamente.
-- 3. Apaga os lançamentos contábeis de Fev 2025.
-- 4. Gera novos lançamentos corretos.
-- ============================================================================

-- 1. CRIAR CONTA ESPECÍFICA (SE NÃO EXISTIR)
DO $$
DECLARE
    v_parent_id UUID;
    v_exists INT;
BEGIN
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.1.2';
    
    SELECT count(*) INTO v_exists FROM chart_of_accounts WHERE code = '4.1.2.16';
    
    IF v_exists = 0 THEN
        INSERT INTO chart_of_accounts (
            id, code, name, parent_id, account_type, is_analytical, is_active, nature, level
        ) VALUES (
            gen_random_uuid(),
            '4.1.2.16',
            'Assinaturas Econet',
            v_parent_id,
            'expense',
            true,
            true,
            'debit',
            4
        );
        RAISE NOTICE 'Conta Assinaturas Econet criada.';
    ELSE
        RAISE NOTICE 'Conta Assinaturas Econet já existe.';
    END IF;
END $$;


-- 2. ATUALIZAR A FUNÇÃO (COM REGRA NOVA)
CREATE OR REPLACE FUNCTION create_entry_from_bank_transaction(
    p_transaction_id UUID
) RETURNS UUID AS $$
DECLARE
    v_tx RECORD;
    v_entry_id UUID;
    v_entry_type VARCHAR;
    v_debit_account_id UUID;
    v_credit_account_id UUID;
    v_bank_account_id UUID;
    v_description VARCHAR;
BEGIN
    -- Get transaction data
    SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

    IF v_tx IS NULL THEN
        RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
    END IF;

    -- Check if entry already exists
    SELECT id INTO v_entry_id
    FROM accounting_entries
    WHERE source_type = 'bank_transaction' AND source_id = p_transaction_id;

    IF v_entry_id IS NOT NULL THEN
        RETURN v_entry_id; 
    END IF;

    -- Get Sicredi account
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts WHERE code = '1.1.1.05';

    -- Determine entry type and accounts based on transaction
    IF v_tx.transaction_type = 'credit' THEN
        -- Credit (receipt)
        v_entry_type := 'recebimento';
        v_debit_account_id := v_bank_account_id;
        SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
        v_description := CONCAT('Recebimento: ', LEFT(v_tx.description, 70));
    ELSE
        -- Debit (payment)
        
        -- A. SOCIOS E ADIANTAMENTOS
        IF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%' OR UPPER(v_tx.description) LIKE '%NAYARA%' OR UPPER(v_tx.description) LIKE '%VICTOR HUGO%' OR UPPER(v_tx.description) LIKE '%SERGIO AUGUSTO%' OR UPPER(v_tx.description) LIKE '%AMPLA CONTABILIDADE%' OR UPPER(v_tx.description) LIKE '%AMPLA SAUDE%' THEN
            v_entry_type := 'adiantamento_socio';
            v_credit_account_id := v_bank_account_id;

            IF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';
            ELSIF UPPER(v_tx.description) LIKE '%NAYARA%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.04';
            ELSIF UPPER(v_tx.description) LIKE '%VICTOR HUGO%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.03';
            ELSIF UPPER(v_tx.description) LIKE '%SERGIO AUGUSTO%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.05';
            ELSE
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.02';
            END IF;
            v_description := CONCAT('Adiantamento Socio: ', LEFT(v_tx.description, 60));

        -- B. REGRA ESPECÍFICA: ECONET / REVISTAS
        ELSIF UPPER(v_tx.description) LIKE '%ECONET%' 
           OR UPPER(v_tx.description) LIKE '%REVISTA%' 
           OR UPPER(v_tx.description) LIKE '%PERIODICO%' THEN
           
            v_entry_type := 'pagamento_despesa';
            v_credit_account_id := v_bank_account_id;
            -- Usa a nova conta 4.1.2.16
            SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.2.16';
            v_description := CONCAT('Assinatura/Revista: ', LEFT(v_tx.description, 70));

        -- C. REGRA GERAL: OUTRAS DESPESAS
        ELSE
            v_entry_type := 'pagamento_despesa';
            v_credit_account_id := v_bank_account_id;
            SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.1.08';
            v_description := CONCAT('Despesa: ', LEFT(v_tx.description, 70));
        END IF;
    END IF;

    -- Create accounting entry
    INSERT INTO accounting_entries (
        description,
        entry_date,
        competence_date,
        entry_type,
        is_draft,
        source_type,
        source_id,
        created_at,
        updated_at
    ) VALUES (
        v_description,
        v_tx.transaction_date,
        v_tx.transaction_date,
        v_entry_type,
        true, -- Always draft for review
        'bank_transaction',
        p_transaction_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_entry_id;

    -- Create Debit Line
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description
    ) VALUES (
        v_entry_id,
        v_debit_account_id,
        v_tx.amount, 
        0,
        CONCAT('D - ', (SELECT name FROM chart_of_accounts WHERE id = v_debit_account_id))
    );

    -- Create Credit Line
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description
    ) VALUES (
        v_entry_id,
        v_credit_account_id,
        0,
        v_tx.amount,
        CONCAT('C - ', (SELECT name FROM chart_of_accounts WHERE id = v_credit_account_id))
    );

    -- Link back to bank transaction
    UPDATE bank_transactions
    SET journal_entry_id = v_entry_id
    WHERE id = p_transaction_id;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- 3. LIMPEZA DE DADOS (RESET)
DO $$
BEGIN
    RAISE NOTICE 'Iniciando limpeza de lançamentos de Fev 2025...';
    
    UPDATE bank_transactions 
    SET journal_entry_id = NULL 
    WHERE transaction_date >= '2025-02-01' AND transaction_date <= '2025-02-28';

    DELETE FROM accounting_entries 
    WHERE entry_date >= '2025-02-01' 
      AND entry_date <= '2025-02-28' 
      AND source_type = 'bank_transaction';
      
    RAISE NOTICE 'Limpeza concluída.';
END $$;

-- 4. REGENERAÇÃO
DO $$
DECLARE
    r RECORD;
    count_processed INT := 0;
BEGIN
    RAISE NOTICE 'Iniciando regeneração...';
    
    FOR r IN SELECT id FROM bank_transactions 
             WHERE transaction_date >= '2025-02-01' 
               AND transaction_date <= '2025-02-28' 
               AND journal_entry_id IS NULL
    LOOP
        PERFORM create_entry_from_bank_transaction(r.id);
        count_processed := count_processed + 1;
    END LOOP;
    
    RAISE NOTICE 'Regeneração concluída! Total processado: %', count_processed;
END $$;
