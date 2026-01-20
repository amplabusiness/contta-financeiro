-- Migration: Add missing lines for Victor Hugo entries
-- The entries were created but lines were not because of case sensitivity

BEGIN;

-- Add debit lines (to Victor Hugo account)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.03'),
    'D - Adiant. Victor Hugo',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND UPPER(ae.description) LIKE '%VICTOR HUGO%'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  );

-- Add credit lines (from Sicredi)
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
  AND UPPER(ae.description) LIKE '%VICTOR HUGO%'
  AND (
    SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  ) = 1;

COMMIT;
