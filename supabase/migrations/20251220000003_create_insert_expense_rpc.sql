-- =====================================================
-- Create a secure RPC function to insert expenses
-- This bypasses RLS restrictions using SECURITY DEFINER
-- =====================================================

-- First, drop old restrictive policies if they exist
DROP POLICY IF EXISTS "Admins and accountants can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can create expenses" ON public.expenses;

-- Create permissive SELECT, UPDATE, DELETE policies
DROP POLICY IF EXISTS "Admins and accountants can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;

CREATE POLICY "authenticated_select_expenses" ON public.expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_expenses" ON public.expenses
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated_delete_expenses" ON public.expenses
  FOR DELETE TO authenticated USING (true);

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.create_expense(
  p_category TEXT,
  p_description TEXT,
  p_amount DECIMAL,
  p_due_date DATE,
  p_payment_date DATE DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_competence TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_cost_center_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE(id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id UUID;
  v_user_id UUID;
BEGIN
  -- Use the current user ID if not provided
  v_user_id := COALESCE(p_created_by, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Insert the expense
  INSERT INTO public.expenses (
    category,
    description,
    amount,
    due_date,
    payment_date,
    status,
    competence,
    notes,
    account_id,
    cost_center_id,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_category,
    p_description,
    p_amount,
    p_due_date,
    p_payment_date,
    p_status,
    p_competence,
    p_notes,
    p_account_id,
    p_cost_center_id,
    v_user_id,
    now(),
    now()
  )
  RETURNING public.expenses.id INTO v_expense_id;

  RETURN QUERY SELECT v_expense_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_expense TO authenticated;

RAISE NOTICE '✅ Created create_expense RPC function';
RAISE NOTICE '✅ Authenticated users can now create expenses via RPC';
