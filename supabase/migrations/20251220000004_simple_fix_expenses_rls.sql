-- =====================================================
-- SIMPLE FIX: Remove all restrictive RLS policies
-- Allow all authenticated users full access to expenses
-- =====================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins and accountants can create expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Admins and accountants can view expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Admins and accountants can update expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Authenticated users can create expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "authenticated_select_expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "authenticated_insert_expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "authenticated_update_expenses" ON public.expenses CASCADE;
DROP POLICY IF EXISTS "authenticated_delete_expenses" ON public.expenses CASCADE;

-- Create single permissive policy for all operations
-- This allows all authenticated users to do anything with expenses
CREATE POLICY "authenticated_all_expenses" ON public.expenses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

RAISE NOTICE '✅ RLS policies fixed for expenses table';
RAISE NOTICE 'All authenticated users can now create, read, update, and delete expenses';
