-- Allow unauthenticated clients to read category tables
-- =====================================================

BEGIN;

-- Ensure RLS is enabled on both tables
ALTER TABLE IF EXISTS expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS revenue_categories ENABLE ROW LEVEL SECURITY;

-- Expense categories read policy for all roles (anon + authenticated)
DROP POLICY IF EXISTS "Allow public read access to expense categories" ON expense_categories;
CREATE POLICY "Allow public read access to expense categories" ON expense_categories
  FOR SELECT
  TO public
  USING (true);

-- Revenue categories read policy for all roles (anon + authenticated)
DROP POLICY IF EXISTS "Allow public read access to revenue categories" ON revenue_categories;
CREATE POLICY "Allow public read access to revenue categories" ON revenue_categories
  FOR SELECT
  TO public
  USING (true);

COMMIT;
