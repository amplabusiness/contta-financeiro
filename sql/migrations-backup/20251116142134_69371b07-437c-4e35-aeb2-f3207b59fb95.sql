-- Add fields for recurring expenses to accounts_payable
ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS recurrence_day integer,
  ADD COLUMN IF NOT EXISTS parent_expense_id uuid REFERENCES public.accounts_payable(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cost_center text;

-- Create index for recurring expenses lookup
CREATE INDEX IF NOT EXISTS idx_accounts_payable_recurring 
  ON public.accounts_payable(is_recurring, status)
  WHERE is_recurring = true;

-- Create index for parent expenses
CREATE INDEX IF NOT EXISTS idx_accounts_payable_parent
  ON public.accounts_payable(parent_expense_id)
  WHERE parent_expense_id IS NOT NULL;

-- Function to generate next month's recurring expenses
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses()
RETURNS TABLE(
  generated_count integer,
  expenses_created uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recurring_expense RECORD;
  new_expense_id uuid;
  expense_ids uuid[] := '{}';
  count integer := 0;
  next_month_date date;
BEGIN
  next_month_date := date_trunc('month', CURRENT_DATE + interval '1 month')::date;
  
  FOR recurring_expense IN
    SELECT * FROM accounts_payable
    WHERE is_recurring = true
      AND is_suspended = false
      AND status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM accounts_payable ap2
        WHERE ap2.parent_expense_id = accounts_payable.id
          AND date_trunc('month', ap2.due_date) = date_trunc('month', next_month_date)
      )
  LOOP
    INSERT INTO accounts_payable (
      supplier_name,
      supplier_document,
      description,
      category,
      amount,
      due_date,
      payment_method,
      bank_account,
      notes,
      status,
      created_by,
      is_recurring,
      recurrence_frequency,
      recurrence_day,
      parent_expense_id,
      cost_center
    ) VALUES (
      recurring_expense.supplier_name,
      recurring_expense.supplier_document,
      recurring_expense.description,
      recurring_expense.category,
      recurring_expense.amount,
      (next_month_date + (COALESCE(recurring_expense.recurrence_day, 10) - 1))::date,
      recurring_expense.payment_method,
      recurring_expense.bank_account,
      'Gerado automaticamente de despesa recorrente',
      'pending',
      recurring_expense.created_by,
      false,
      recurring_expense.recurrence_frequency,
      recurring_expense.recurrence_day,
      recurring_expense.id,
      recurring_expense.cost_center
    )
    RETURNING id INTO new_expense_id;
    
    expense_ids := array_append(expense_ids, new_expense_id);
    count := count + 1;
  END LOOP;
  
  RETURN QUERY SELECT count, expense_ids;
END;
$$;