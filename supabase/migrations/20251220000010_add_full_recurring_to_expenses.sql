-- Add full recurring expense metadata columns to expenses table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT DEFAULT 'monthly' CHECK (recurrence_frequency IN ('weekly', 'biweekly', 'monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_count INTEGER,
  ADD COLUMN IF NOT EXISTS recurrence_day INTEGER DEFAULT 10 CHECK (recurrence_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS recurrence_specific_days INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Create indexes for recurring expenses lookup
CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring 
  ON public.expenses(is_recurring) 
  WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring_frequency 
  ON public.expenses(recurrence_frequency);

CREATE INDEX IF NOT EXISTS idx_expenses_recurrence_start_date 
  ON public.expenses(recurrence_start_date);
