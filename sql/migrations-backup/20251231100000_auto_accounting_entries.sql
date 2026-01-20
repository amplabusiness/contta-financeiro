-- Migration: Auto-generate accounting entries from source transactions
-- When a bank_transaction, invoice, or expense is created/updated,
-- automatically create the corresponding accounting entry

BEGIN;

-- ============================================
-- FUNCTION: Create accounting entry from bank transaction
-- ============================================
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
    IF v_tx.amount > 0 THEN
        -- Credit (receipt)
        v_entry_type := 'recebimento';
        v_debit_account_id := v_bank_account_id; -- D: Banco
        SELECT id INTO v_credit_account_id
        FROM chart_of_accounts WHERE code = '1.1.2.01'; -- C: Clientes a Receber
        v_description := CONCAT('Recebimento: ', LEFT(v_tx.description, 70));
    ELSE
        -- Debit (payment) - check if partner advance or expense
        IF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%'
           OR UPPER(v_tx.description) LIKE '%NAYARA%'
           OR UPPER(v_tx.description) LIKE '%VICTOR HUGO%'
           OR UPPER(v_tx.description) LIKE '%SERGIO AUGUSTO%'
           OR UPPER(v_tx.description) LIKE '%AMPLA CONTABILIDADE%'
           OR UPPER(v_tx.description) LIKE '%AMPLA SAUDE%' THEN
            -- Partner advance
            v_entry_type := 'adiantamento_socio';
            v_credit_account_id := v_bank_account_id; -- C: Banco

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
            v_credit_account_id := v_bank_account_id; -- C: Banco
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

-- ============================================
-- FUNCTION: Create accounting entry from invoice (revenue by competence)
-- ============================================
CREATE OR REPLACE FUNCTION create_entry_from_invoice(
    p_invoice_id UUID
) RETURNS UUID AS $$
DECLARE
    v_inv RECORD;
    v_entry_id UUID;
    v_receivable_account_id UUID;
    v_revenue_account_id UUID;
    v_client_name VARCHAR;
    v_competence_date DATE;
BEGIN
    -- Get invoice data
    SELECT i.*, c.name as client_name
    INTO v_inv
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.id = p_invoice_id;

    IF v_inv IS NULL THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
    END IF;

    -- Check if entry already exists
    SELECT id INTO v_entry_id
    FROM accounting_entries
    WHERE source_type = 'invoice' AND source_id = p_invoice_id;

    IF v_entry_id IS NOT NULL THEN
        RETURN v_entry_id; -- Already exists
    END IF;

    -- Parse competence to date (format: MM/YYYY)
    v_competence_date := TO_DATE('01/' || v_inv.competence, 'DD/MM/YYYY');
    -- Set to last day of competence month
    v_competence_date := (v_competence_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Get accounts
    SELECT id INTO v_receivable_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
    SELECT id INTO v_revenue_account_id FROM chart_of_accounts WHERE code = '3.1.01.001';

    v_client_name := COALESCE(v_inv.client_name, 'Cliente');

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
        v_competence_date,
        v_competence_date,
        CONCAT('Receita Honorarios: ', v_client_name),
        'receita_honorarios',
        v_inv.amount,
        v_inv.amount,
        TRUE,
        'invoice',
        p_invoice_id,
        'invoice',
        p_invoice_id
    )
    RETURNING id INTO v_entry_id;

    -- Create debit line (D - Clientes a Receber)
    INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
    VALUES (v_entry_id, v_receivable_account_id, 'D - Clientes a Receber', v_inv.amount, 0);

    -- Create credit line (C - Receita de Honorarios)
    INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
    VALUES (v_entry_id, v_revenue_account_id, 'C - Receita de Honorarios', 0, v_inv.amount);

    -- Update invoice with journal_entry_id
    UPDATE invoices SET journal_entry_id = v_entry_id WHERE id = p_invoice_id;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-create entry on bank_transaction insert
-- ============================================
CREATE OR REPLACE FUNCTION trigger_bank_transaction_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create entry for new transactions (not opening balance)
    IF NEW.is_opening_balance IS NOT TRUE THEN
        PERFORM create_entry_from_bank_transaction(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_entry_bank_transaction ON bank_transactions;
CREATE TRIGGER tr_auto_entry_bank_transaction
    AFTER INSERT ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_bank_transaction_entry();

-- ============================================
-- TRIGGER: Auto-create entry on invoice insert
-- ============================================
CREATE OR REPLACE FUNCTION trigger_invoice_entry()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_entry_from_invoice(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_entry_invoice ON invoices;
CREATE TRIGGER tr_auto_entry_invoice
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_invoice_entry();

-- ============================================
-- FUNCTION: Sync all entries (for existing data)
-- ============================================
CREATE OR REPLACE FUNCTION sync_all_accounting_entries(
    p_start_date DATE DEFAULT '2025-01-01',
    p_end_date DATE DEFAULT '2025-12-31'
) RETURNS TABLE (
    source_type VARCHAR,
    processed INT,
    created INT,
    skipped INT
) AS $$
DECLARE
    v_bt RECORD;
    v_inv RECORD;
    v_processed_bt INT := 0;
    v_created_bt INT := 0;
    v_processed_inv INT := 0;
    v_created_inv INT := 0;
    v_entry_id UUID;
BEGIN
    -- Process bank transactions
    FOR v_bt IN
        SELECT id FROM bank_transactions
        WHERE transaction_date >= p_start_date
          AND transaction_date <= p_end_date
          AND is_opening_balance IS NOT TRUE
          AND journal_entry_id IS NULL
    LOOP
        v_processed_bt := v_processed_bt + 1;
        v_entry_id := create_entry_from_bank_transaction(v_bt.id);
        IF v_entry_id IS NOT NULL THEN
            v_created_bt := v_created_bt + 1;
        END IF;
    END LOOP;

    -- Return bank transaction results
    source_type := 'bank_transaction';
    processed := v_processed_bt;
    created := v_created_bt;
    skipped := v_processed_bt - v_created_bt;
    RETURN NEXT;

    -- Process invoices
    FOR v_inv IN
        SELECT id FROM invoices
        WHERE competence LIKE '%/2025'
          AND journal_entry_id IS NULL
    LOOP
        v_processed_inv := v_processed_inv + 1;
        v_entry_id := create_entry_from_invoice(v_inv.id);
        IF v_entry_id IS NOT NULL THEN
            v_created_inv := v_created_inv + 1;
        END IF;
    END LOOP;

    -- Return invoice results
    source_type := 'invoice';
    processed := v_processed_inv;
    created := v_created_inv;
    skipped := v_processed_inv - v_created_inv;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMIT;
