-- Migration: Fix balances to use source of truth
-- Source of truth: accounting_entries (from bank statements and invoice generation)
-- All screens should read from accounting_entries, not auxiliary tables

BEGIN;

-- ============================================
-- STEP 1: Update bank account balance to match audited value
-- ============================================

-- Update Sicredi balance to January 2025 closing balance
UPDATE bank_accounts
SET
    current_balance = 18553.54,
    updated_at = NOW()
WHERE name LIKE '%Sicredi%';

-- ============================================
-- STEP 2: Clear client opening balances (already received in January)
-- These R$ 192,995.01 were received in January 2025
-- ============================================

-- First, archive the opening balances for audit trail
CREATE TABLE IF NOT EXISTS client_opening_balance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    original_balance DECIMAL(15,2),
    cleared_at TIMESTAMPTZ DEFAULT NOW(),
    cleared_reason TEXT,
    period_closed VARCHAR(20)
);

-- Archive before clearing
INSERT INTO client_opening_balance_history (client_id, original_balance, cleared_reason, period_closed)
SELECT
    id,
    opening_balance,
    'Saldos recebidos em Janeiro 2025 - baixados no fechamento do mes',
    '01/2025'
FROM clients
WHERE opening_balance > 0;

-- Clear the opening balances
UPDATE clients
SET
    opening_balance = 0,
    updated_at = NOW()
WHERE opening_balance > 0;

-- ============================================
-- STEP 3: Create view for correct "A Receber" balance
-- Source: invoices with status pending (competence based)
-- ============================================

CREATE OR REPLACE VIEW v_accounts_receivable AS
SELECT
    SUM(amount) as total_receivable,
    COUNT(*) as invoice_count,
    competence
FROM invoices
WHERE status = 'pending'
GROUP BY competence
ORDER BY competence;

-- ============================================
-- STEP 4: Create view for bank balance from accounting entries
-- Source: accounting_entries (the source of truth)
-- ============================================

CREATE OR REPLACE VIEW v_bank_balance_from_entries AS
SELECT
    coa.code as account_code,
    coa.name as account_name,
    SUM(ael.debit) as total_debit,
    SUM(ael.credit) as total_credit,
    SUM(ael.debit) - SUM(ael.credit) as balance
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON coa.id = ael.account_id
JOIN accounting_entries ae ON ae.id = ael.entry_id
WHERE coa.code = '1.1.1.05'  -- Sicredi
GROUP BY coa.code, coa.name;

-- ============================================
-- STEP 5: Create function to sync bank_accounts from accounting
-- ============================================

CREATE OR REPLACE FUNCTION sync_bank_balance_from_accounting()
RETURNS void AS $$
DECLARE
    v_balance DECIMAL(15,2);
BEGIN
    -- Calculate balance from accounting entries
    SELECT COALESCE(SUM(ael.debit) - SUM(ael.credit), 0)
    INTO v_balance
    FROM accounting_entry_lines ael
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE coa.code = '1.1.1.05';  -- Sicredi

    -- Update bank_accounts
    UPDATE bank_accounts
    SET current_balance = v_balance,
        updated_at = NOW()
    WHERE name LIKE '%Sicredi%';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 6: Create summary view for cash flow screen
-- ============================================

CREATE OR REPLACE VIEW v_cash_flow_summary AS
SELECT
    -- Bank balance from accounting (source of truth)
    (SELECT COALESCE(SUM(ael.debit) - SUM(ael.credit), 0)
     FROM accounting_entry_lines ael
     JOIN chart_of_accounts coa ON coa.id = ael.account_id
     WHERE coa.code = '1.1.1.05') as bank_balance,

    -- Accounts receivable (pending invoices)
    (SELECT COALESCE(SUM(amount), 0)
     FROM invoices
     WHERE status = 'pending') as accounts_receivable,

    -- Accounts receivable count
    (SELECT COUNT(*)
     FROM invoices
     WHERE status = 'pending') as receivable_count,

    -- Accounts payable (pending expenses)
    (SELECT COALESCE(SUM(amount), 0)
     FROM expenses
     WHERE status IN ('pending', 'scheduled')) as accounts_payable,

    -- Accounts payable count
    (SELECT COUNT(*)
     FROM expenses
     WHERE status IN ('pending', 'scheduled')) as payable_count;

-- Add comment
COMMENT ON VIEW v_cash_flow_summary IS 'Summary for cash flow screen - uses accounting_entries as source of truth';

COMMIT;
