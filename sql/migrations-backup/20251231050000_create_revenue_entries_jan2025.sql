-- Migration: Create revenue entries for January 2025 based on competence
-- Revenue uses accrual basis (regime de competencia)
-- This creates entries for all invoices with competence='01/2025'
-- Total expected: R$ 136,821.59

BEGIN;

-- ============================================
-- STEP 1: Create revenue entries from invoices
-- For each invoice: D - Clientes a Receber, C - Receita de Honorarios
-- ============================================

-- First, create the accounting entries
INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced,
    reference_type,
    reference_id
)
SELECT
    DATE('2025-01-31'),  -- Entry at end of month
    DATE('2025-01-31'),  -- Competence January 2025
    CONCAT('Receita Honorarios: ', COALESCE(c.name, 'Cliente')),
    'receita_honorarios',
    i.amount,
    i.amount,
    true,
    'invoice',
    i.id
FROM invoices i
LEFT JOIN clients c ON c.id = i.client_id
WHERE i.competence = '01/2025'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entries ae
    WHERE ae.reference_id = i.id
      AND ae.reference_type = 'invoice'
      AND ae.entry_type = 'receita_honorarios'
  );

-- Create debit lines (D - Clientes a Receber)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01' LIMIT 1),
    'D - Clientes a Receber',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_type = 'receita_honorarios'
  AND ae.competence_date >= '2025-01-01'
  AND ae.competence_date <= '2025-01-31'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  );

-- Create credit lines (C - Receita de Honorarios)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '3.1.01.001' OR code = '3.1.1.01' LIMIT 1),
    'C - Receita de Honorarios',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_type = 'receita_honorarios'
  AND ae.competence_date >= '2025-01-01'
  AND ae.competence_date <= '2025-01-31'
  AND (
    SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
  ) = 1;

COMMIT;
