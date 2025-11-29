-- Migration: Reset accounting entries to allow recreation
-- Date: 2025-11-29
-- Purpose: Delete all accounting entries so they can be recreated with proper lines

-- Log current state
DO $$
DECLARE
  entries_count INTEGER;
  lines_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO entries_count FROM accounting_entries;
  SELECT COUNT(*) INTO lines_count FROM accounting_entry_lines;
  RAISE NOTICE 'Before reset - Entries: %, Lines: %', entries_count, lines_count;
END $$;

-- Delete all entry lines first (cascading would handle this, but being explicit)
DELETE FROM accounting_entry_lines;

-- Delete all entries
DELETE FROM accounting_entries;

-- Also clear client_ledger entries created by smart-accounting
DELETE FROM client_ledger
WHERE reference_type IN ('opening_balance', 'invoice', 'invoice_payment', 'expense', 'expense_payment', 'receita_honorarios', 'saldo_abertura', 'recebimento');

-- Log final state
DO $$
DECLARE
  entries_count INTEGER;
  lines_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO entries_count FROM accounting_entries;
  SELECT COUNT(*) INTO lines_count FROM accounting_entry_lines;
  RAISE NOTICE 'After reset - Entries: %, Lines: %', entries_count, lines_count;
END $$;
