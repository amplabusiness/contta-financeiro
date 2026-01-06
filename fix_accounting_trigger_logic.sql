
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
        RETURN v_entry_id; -- Already exists, return existing
    END IF;

    -- Get Sicredi account
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts WHERE code = '1.1.1.05';

    -- Determine entry type and accounts based on transaction
    -- CORRECTION: Check transaction_type instead of amount > 0 (since amount is absolute)
    IF v_tx.transaction_type = 'credit' THEN
        -- Credit (receipt / incoming money)
        v_entry_type := 'recebimento';
        v_debit_account_id := v_bank_account_id; -- D: Banco (Increased Asset)
        SELECT id INTO v_credit_account_id
        FROM chart_of_accounts WHERE code = '1.1.2.01'; -- C: Clientes a Receber
        v_description := CONCAT('Recebimento: ', LEFT(v_tx.description, 70));
    ELSE
        -- Debit (payment / outgoing money) - check if partner advance or expense
        IF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%'
           OR UPPER(v_tx.description) LIKE '%NAYARA%'
           OR UPPER(v_tx.description) LIKE '%VICTOR HUGO%'
           OR UPPER(v_tx.description) LIKE '%SERGIO AUGUSTO%'
           OR UPPER(v_tx.description) LIKE '%AMPLA CONTABILIDADE%'
           OR UPPER(v_tx.description) LIKE '%AMPLA SAUDE%' THEN
            -- Partner advance
            v_entry_type := 'adiantamento_socio';
            v_credit_account_id := v_bank_account_id; -- C: Banco (Decreased Asset)

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
            v_credit_account_id := v_bank_account_id; -- C: Banco (Decreased Asset)
            SELECT id INTO v_debit_account_id
            FROM chart_of_accounts WHERE code = '4.1.1.08'; -- D: Outras Despesas
            v_description := CONCAT('Despesa: ', LEFT(v_tx.description, 70));
        END IF;
    END IF;

    -- Create accounting entry
    INSERT INTO accounting_entries (
        entry_date,
        competence_date,
        description,
        entry_type,
        total_debit,
        total_credit,
        balanced,
        source_type,
        source_id,
        reference_type,
        reference_id
    ) VALUES (
        v_tx.transaction_date,
        v_tx.transaction_date,
        v_description,
        v_entry_type,
        ABS(v_tx.amount),
        ABS(v_tx.amount),
        TRUE,
        'bank_transaction',
        p_transaction_id,
        'bank_transaction',
        p_transaction_id
    )
    RETURNING id INTO v_entry_id;

    -- Create debit line
    INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
    VALUES (v_entry_id, v_debit_account_id, 'D - ' || (SELECT name FROM chart_of_accounts WHERE id = v_debit_account_id), ABS(v_tx.amount), 0);

    -- Create credit line
    INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
    VALUES (v_entry_id, v_credit_account_id, 'C - ' || (SELECT name FROM chart_of_accounts WHERE id = v_credit_account_id), 0, ABS(v_tx.amount));

    -- Update bank_transaction with journal_entry_id
    UPDATE bank_transactions SET journal_entry_id = v_entry_id WHERE id = p_transaction_id;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;
