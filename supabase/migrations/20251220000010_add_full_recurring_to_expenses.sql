-- Add full recurring expense metadata columns to expenses table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT DEFAULT 'monthly' CHECK (recurrence_frequency IN ('weekly', 'biweekly', 'monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_count INTEGER,
  ADD COLUMN IF NOT EXISTS recurrence_specific_days INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Add a check constraint to ensure valid specific days
ALTER TABLE public.expenses
  ADD CONSTRAINT check_recurrence_specific_days CHECK (
    recurrence_specific_days IS NULL OR 
    (array_length(recurrence_specific_days, 1) IS NULL OR array_length(recurrence_specific_days, 1) > 0)
  );

-- Create an index for recurring expenses lookup
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_frequency 
  ON public.expenses(recurrence_frequency) 
  WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_expenses_recurrence_start_date 
  ON public.expenses(recurrence_start_date) 
  WHERE is_recurring = true;
