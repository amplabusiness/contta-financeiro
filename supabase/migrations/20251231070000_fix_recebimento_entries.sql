-- Migration: Fix recebimento entries to use correct accounts
-- Receipts in January are from prior competences, so they should:
-- D - Sicredi (bank increases)
-- C - Clientes a Receber (accounts receivable decreases)
-- NOT affecting revenue accounts (already recorded in competence period)

BEGIN;

-- Delete incorrect credit lines from recebimento entries
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
    SELECT id FROM accounting_entries
    WHERE entry_type = 'recebimento'
      AND entry_date >= '2025-01-01'
      AND entry_date <= '2025-01-31'
)
AND description LIKE '%C - Clientes%';

-- Recreate credit lines correctly (C - Clientes a Receber)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01' LIMIT 1),
    'C - Clientes a Receber',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_type = 'recebimento'
  AND ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND (
    SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  ) = 1;

COMMIT;
