-- Migration: Reset orphan accounting entries (final cleanup)
-- Date: 2025-11-29
-- Purpose: Delete all accounting entries that have no lines (orphans)
-- These were created before the RLS fix and need to be recreated

-- First, log what we're about to delete
DO $$
DECLARE
  total_entries INTEGER;
  entries_with_lines INTEGER;
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_entries FROM accounting_entries;
  SELECT COUNT(DISTINCT entry_id) INTO entries_with_lines FROM accounting_entry_lines;
  orphan_count := total_entries - entries_with_lines;

  RAISE NOTICE 'BEFORE CLEANUP:';
  RAISE NOTICE '  Total entries: %', total_entries;
  RAISE NOTICE '  Entries with lines: %', entries_with_lines;
  RAISE NOTICE '  Orphan entries (to delete): %', orphan_count;
END $$;

-- Delete entries that have no lines
DELETE FROM accounting_entries ae
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
);

-- Verify cleanup
DO $$
DECLARE
  remaining_entries INTEGER;
  remaining_lines INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_entries FROM accounting_entries;
  SELECT COUNT(*) INTO remaining_lines FROM accounting_entry_lines;

  RAISE NOTICE 'AFTER CLEANUP:';
  RAISE NOTICE '  Remaining entries: %', remaining_entries;
  RAISE NOTICE '  Remaining lines: %', remaining_lines;

  IF remaining_entries > 0 AND remaining_lines > 0 THEN
    RAISE NOTICE '  All remaining entries have lines: YES';
  ELSIF remaining_entries = 0 THEN
    RAISE NOTICE '  Database is clean - ready for new entries';
  ELSE
    RAISE WARNING '  PROBLEM: Still have orphan entries!';
  END IF;
END $$;
