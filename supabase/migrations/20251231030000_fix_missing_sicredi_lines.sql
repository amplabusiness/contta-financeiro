-- Migration: Fix missing Sicredi credit lines for partner advance entries
-- Some entries only have the debit line (partner account) but missing the credit line (Sicredi)

BEGIN;

-- Find entries with only 1 line and add the missing Sicredi credit line
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND (
    SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  ) = 1;

-- Also fix any recebimento entries that might be missing their credit line
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01' OR name = 'Clientes a Receber' LIMIT 1),
    'C - Clientes a Receber',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'recebimento'
  AND (
    SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  ) = 1;

-- Fix any pagamento_despesa entries that might be missing their credit line
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'pagamento_despesa'
  AND (
    SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  ) = 1;

COMMIT;
