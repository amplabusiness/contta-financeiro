-- Migration: Cleanup orphan accounting entries (entries without lines) v2
-- Date: 2025-11-29
-- Purpose: Remove accounting entries that have no corresponding entry lines

-- First, let's see how many entries exist and how many have lines
DO $$
DECLARE
  total_entries INTEGER;
  entries_with_lines INTEGER;
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_entries FROM accounting_entries;
  SELECT COUNT(DISTINCT entry_id) INTO entries_with_lines FROM accounting_entry_lines;
  orphan_count := total_entries - entries_with_lines;

  RAISE NOTICE 'Total entries: %, Entries with lines: %, Orphan entries: %',
    total_entries, entries_with_lines, orphan_count;
END $$;

-- Delete entries that have no lines using a subquery
DELETE FROM accounting_entries ae
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id
);

-- Verify the cleanup
DO $$
DECLARE
  remaining_entries INTEGER;
  entries_with_lines INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_entries FROM accounting_entries;
  SELECT COUNT(DISTINCT entry_id) INTO entries_with_lines FROM accounting_entry_lines;

  RAISE NOTICE 'After cleanup - Entries: %, All have lines: %',
    remaining_entries,
    CASE WHEN remaining_entries = entries_with_lines THEN 'YES' ELSE 'NO' END;
END $$;
