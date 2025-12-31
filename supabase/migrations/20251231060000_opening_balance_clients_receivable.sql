-- Migration: Create opening balance for clients receivable
-- The R$ 298,527.29 received in January are from previous competences (December and before)
-- These are not January revenue - they are collection of prior accounts receivable
-- Entry: D - Clientes a Receber (1.1.2.01), C - Saldo de Abertura Clientes (5.3.02.02)

BEGIN;

-- Create opening balance entry for clients receivable
-- This represents the accounts receivable balance at the start of January 2025
INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced
)
SELECT
    '2025-01-01',
    '2025-01-01',
    'Saldo de Abertura - Clientes a Receber Janeiro/2025',
    'saldo_abertura',
    298527.29,
    298527.29,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE description = 'Saldo de Abertura - Clientes a Receber Janeiro/2025'
);

-- Debit line (D - Clientes a Receber)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01' LIMIT 1),
    'D - Clientes a Receber',
    298527.29,
    0
FROM accounting_entries ae
WHERE ae.description = 'Saldo de Abertura - Clientes a Receber Janeiro/2025'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  );

-- Credit line (C - Saldo de Abertura - Clientes)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '5.3.02.02' LIMIT 1),
    'C - Saldo de Abertura - Clientes',
    0,
    298527.29
FROM accounting_entries ae
WHERE ae.description = 'Saldo de Abertura - Clientes a Receber Janeiro/2025'
  AND (
    SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  ) = 1;

COMMIT;
