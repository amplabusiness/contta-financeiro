-- =====================================================
-- Fix RLS policies for expenses table
-- Allow authenticated users to view and update expenses
-- =====================================================

-- Drop restrictive policies
DROP POLICY IF EXISTS "Admins and accountants can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins and accountants can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins and accountants can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;

-- Allow authenticated users to view all expenses
CREATE POLICY "Authenticated users can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update their own expenses
CREATE POLICY "Authenticated users can update their own expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Allow only users who created an expense to delete it
CREATE POLICY "Users can delete their own expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- INSERT policy handled by insert_expense RPC function (SECURITY DEFINER)
-- No direct INSERT policy needed

RAISE NOTICE '✅ Fixed RLS policies for expenses table';
RAISE NOTICE 'Authenticated users can now:';
RAISE NOTICE '  - View all expenses';
RAISE NOTICE '  - Create expenses via insert_expense function';
RAISE NOTICE '  - Update their own expenses';
RAISE NOTICE '  - Delete their own expenses';
