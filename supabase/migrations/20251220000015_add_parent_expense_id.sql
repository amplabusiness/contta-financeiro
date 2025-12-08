-- Add parent_expense_id to link recurring expense instances
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;

-- Create index for parent lookup
CREATE INDEX IF NOT EXISTS idx_expenses_parent_id 
  ON public.expenses(parent_expense_id)
  WHERE parent_expense_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.expenses.parent_expense_id IS 'ID da despesa original que gerou esta instância recorrente';
