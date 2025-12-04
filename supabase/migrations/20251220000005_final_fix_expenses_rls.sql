-- Enable RLS on the expenses table
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins and accountants can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins and accountants can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins and accountants can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "authenticated_select_expenses" ON public.expenses;
DROP POLICY IF EXISTS "authenticated_insert_expenses" ON public.expenses;
DROP POLICY IF EXISTS "authenticated_update_expenses" ON public.expenses;
DROP POLICY IF EXISTS "authenticated_delete_expenses" ON public.expenses;
DROP POLICY IF EXISTS "authenticated_all_expenses" ON public.expenses;
DROP POLICY IF EXISTS "authenticated_all_operations" ON public.expenses;
DROP POLICY IF EXISTS "expenses_authenticated_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_authenticated_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_authenticated_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_authenticated_delete" ON public.expenses;

-- Create simple permissive policies
CREATE POLICY "expenses_authenticated_insert"
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "expenses_authenticated_select"
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "expenses_authenticated_update"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "expenses_authenticated_delete"
  ON public.expenses
  FOR DELETE
  TO authenticated
  USING (true);
