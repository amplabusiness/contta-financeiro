
-- SANITIZATION SCRIPT FOR CHART OF ACCOUNTS
-- Objective: Resolve duplication between Pattern A (1.1.01) and Pattern B (1.1.1)
-- Winning Pattern: Pattern B (1.1.1) based on usage analysis.

BEGIN;

-- 1. Identify Safe IDs (Used Active Accounts) to prevent accidental deletion
CREATE TEMP TABLE safe_ids AS
SELECT DISTINCT account_id FROM accounting_entry_lines;

-- 2. Soft Delete "Pattern A" Accounts (Accounts where Level 3 has a leading zero, e.g. 1.1.01)
-- Regex '^[0-9]+\.[0-9]+\.0[0-9]' means: Start with Number, Dot, Number, Dot, Zero, Number...
-- This targets 1.1.01, 1.1.02, 2.1.01 but spares 1.1.1, 1.1.10, 4.1.10

UPDATE chart_of_accounts
SET is_active = false, 
    name = name || ' (OBSOLETO)'
WHERE code ~ '^[0-9]+\.[0-9]+\.0[0-9]' 
  AND id NOT IN (SELECT account_id FROM safe_ids)
  AND is_active = true;

-- 3. Also Target specific duplication if regex misses (e.g. 4 digit patterns elsewhere if inconsistent)
-- But based on user input (1.1.01 vs 1.1.1), the above is the main fix.

-- 4. Clean up "orphan" children of deactivated accounts
-- If we deactivated 1.1.01, we must deactivate 1.1.01.001 (Caixa)
UPDATE chart_of_accounts
SET is_active = false,
    name = name || ' (OBSOLETO)'
WHERE is_active = true
  AND parent_id IN (SELECT id FROM chart_of_accounts WHERE name LIKE '%(OBSOLETO)')
  AND id NOT IN (SELECT account_id FROM safe_ids);

-- Repeat once more for grandchildren (just in case depth is > 1)
UPDATE chart_of_accounts
SET is_active = false,
    name = name || ' (OBSOLETO)'
WHERE is_active = true
  AND parent_id IN (SELECT id FROM chart_of_accounts WHERE name LIKE '%(OBSOLETO)')
  AND id NOT IN (SELECT account_id FROM safe_ids);

COMMIT;

SELECT code, name, is_active FROM chart_of_accounts WHERE name LIKE '%(OBSOLETO)' ORDER BY code;
