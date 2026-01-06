
-- ============================================================================
-- SCRIPT DE CORREÇÃO COMPLETA - FEVEREIRO 2025
-- ============================================================================
-- Este script faz 3 coisas:
-- 1. Atualiza a função de contabilidade para usar a lógica CORRETA de Sinais.
-- 2. Apaga os lançamentos contábeis "invertidos" de Fev 2025.
-- 3. Gera novos lançamentos corretos.
-- ============================================================================

-- A. ATUALIZAR A FUNÇÃO (GARANTIA DE LÓGICA CORRETA)
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

    -- Check if entry already exists (SKIP CHECK FOR REGENERATION IF NEEDED, BUT KEEP SAFE)
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
    -- CORRECÇÃO: Verifica transaction_type ('credit' ou 'debit')
    IF v_tx.transaction_type = 'credit' THEN
        -- Credit (receipt / incoming money) -> DEBITA BANCO, CREDITA CLIENTES
        v_entry_type := 'recebimento';
        v_debit_account_id := v_bank_account_id; -- D: Banco (Aumenta Ativo)
        SELECT id INTO v_credit_account_id
        FROM chart_of_accounts WHERE code = '1.1.2.01'; -- C: Clientes a Receber
        v_description := CONCAT('Recebimento: ', LEFT(v_tx.description, 70));
    ELSE
        -- Debit (payment / outgoing money) -> CREDITA BANCO, DEBITA DESPESA
        IF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%'
           OR UPPER(v_tx.description) LIKE '%NAYARA%'
           OR UPPER(v_tx.description) LIKE '%VICTOR HUGO%'
           OR UPPER(v_tx.description) LIKE '%SERGIO AUGUSTO%'
           OR UPPER(v_tx.description) LIKE '%AMPLA CONTABILIDADE%'
           OR UPPER(v_tx.description) LIKE '%AMPLA SAUDE%' THEN
            -- Partner advance
            v_entry_type := 'adiantamento_socio';
            v_credit_account_id := v_bank_account_id; -- C: Banco (Diminui Ativo)

            -- Determine which partner account
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
        ELSE
            -- Regular expense
            v_entry_type := 'pagamento_despesa';
            v_credit_account_id := v_bank_account_id; -- C: Banco (Diminui Ativo)
            SELECT id INTO v_debit_account_id
            FROM chart_of_accounts WHERE code = '4.1.1.08'; -- D: Outras Despesas
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
        true,
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
        v_tx.amount, -- Absolute amount
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
        v_tx.amount, -- Absolute amount
        CONCAT('C - ', (SELECT name FROM chart_of_accounts WHERE id = v_credit_account_id))
    );

    -- Link back to bank transaction
    UPDATE bank_transactions
    SET journal_entry_id = v_entry_id
    WHERE id = p_transaction_id;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- B. LIMPEZA DE DADOS (RESET)
DO $$
BEGIN
    RAISE NOTICE 'Iniciando limpeza de lançamentos de Fev 2025...';
    
    -- 1. Desvincular transações
    UPDATE bank_transactions 
    SET journal_entry_id = NULL 
    WHERE transaction_date >= '2025-02-01' AND transaction_date <= '2025-02-28';

    -- 2. Apagar lançamentos contábeis
    DELETE FROM accounting_entries 
    WHERE entry_date >= '2025-02-01' 
      AND entry_date <= '2025-02-28' 
      AND source_type = 'bank_transaction';
      
    RAISE NOTICE 'Limpeza concluída.';
END $$;

-- C. REGENERAÇÃO
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
