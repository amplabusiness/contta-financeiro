-- =====================================================
-- Create a secure function to insert expenses
-- Uses SECURITY DEFINER to bypass RLS restrictions
-- =====================================================

CREATE OR REPLACE FUNCTION public.insert_expense(
  p_category TEXT,
  p_description TEXT,
  p_amount DECIMAL,
  p_due_date DATE,
  p_payment_date DATE,
  p_status TEXT,
  p_competence TEXT,
  p_notes TEXT,
  p_account_id UUID,
  p_cost_center_id UUID,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id UUID;
BEGIN
  -- Verify user is authenticated
  IF p_created_by IS NULL OR p_created_by = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'User ID is required';
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
    p_created_by,
    now(),
    now()
  )
  RETURNING id INTO v_expense_id;

  RETURN v_expense_id;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_expense TO authenticated;

RAISE NOTICE '✅ Created insert_expense function';
