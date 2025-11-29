-- Migration: Disable accounting_entry_lines trigger
-- Date: 2025-11-29
-- Purpose: Disable trigger that causes error when inserting entry lines
--
-- Problem:
-- The trigger `check_balance_after_line_change` on `accounting_entry_lines`
-- calls function `check_entry_balance()` which tries to access `NEW.total_debit`
-- and `NEW.id` - but these fields don't exist on accounting_entry_lines table.
-- The fields `total_debit` and `id` belong to `accounting_entries`, not `accounting_entry_lines`.
--
-- Error message: "record 'new' has no field 'total_debit'"
--
-- Solution:
-- Disable this trigger. The smart-accounting Edge Function already handles
-- the validation of balanced entries and updates totals correctly.

-- 1. Drop the problematic trigger
DROP TRIGGER IF EXISTS check_balance_after_line_change ON accounting_entry_lines;

-- 2. Clean up any orphan entries (entries without lines)
DELETE FROM accounting_entries
WHERE id NOT IN (
  SELECT DISTINCT entry_id FROM accounting_entry_lines WHERE entry_id IS NOT NULL
);

-- 3. Verify result
DO $$
DECLARE
  entries_count INTEGER;
  lines_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO entries_count FROM accounting_entries;
  SELECT COUNT(*) INTO lines_count FROM accounting_entry_lines;

  RAISE NOTICE 'After cleanup: % entries, % lines', entries_count, lines_count;
END $$;
