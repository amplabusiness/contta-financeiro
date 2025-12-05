-- =====================================================
-- Migrate recurring expenses to consolidated expenses table
-- Migration: 20251203000100
-- =====================================================

-- Only migrate if recurring_expenses table exists and has data
DO $$ 
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if recurring_expenses table exists
  SELECT COUNT(*) INTO v_count FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'recurring_expenses';
  
  IF v_count > 0 THEN
    -- Migrate monthly recurring expenses (most common case)
    INSERT INTO expenses (
      client_id,
      category,
      description,
      amount,
      due_date,
      payment_date,
      status,
      competence,
      notes,
      created_by,
      created_at,
      updated_at,
      is_recurring,
      recurrence_day
    )
    SELECT
      NULL as client_id,  -- recurring_expenses don't have client_id
      re.category,
      re.description,
      re.amount,
      CURRENT_DATE as due_date,  -- Will be set to recurrence_day each month
      NULL as payment_date,
      CASE WHEN re.is_active THEN 'pending' ELSE 'canceled' END as status,
      TO_CHAR(CURRENT_DATE, 'MM/YYYY') as competence,  -- Current month
      re.notes || COALESCE(' [Supplier: ' || re.supplier_name || ']', ''),
      re.created_by,
      re.created_at,
      re.updated_at,
      true as is_recurring,
      COALESCE(re.due_day, 10) as recurrence_day
    FROM recurring_expenses re
    WHERE re.frequency = 'monthly' 
      AND re.is_active = true
      AND NOT EXISTS (
        -- Avoid duplicates: don't migrate if already exists in expenses
        SELECT 1 FROM expenses e 
        WHERE e.description = re.description 
          AND e.amount = re.amount 
          AND e.is_recurring = true
          AND e.category = re.category
      )
    ON CONFLICT DO NOTHING;

  END IF;
END $$;
