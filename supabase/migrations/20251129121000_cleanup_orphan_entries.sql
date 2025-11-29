-- Migration: Cleanup orphan accounting entries (entries without lines)
-- Date: 2025-11-29
-- Purpose: Remove accounting entries that have no corresponding entry lines

-- Delete entries that have no lines
DELETE FROM accounting_entries
WHERE id NOT IN (
  SELECT DISTINCT entry_id FROM accounting_entry_lines
);

-- Log the cleanup
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphan accounting entries', deleted_count;
END $$;
