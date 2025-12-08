-- Add is_paused column to control recurring expense generation
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;

-- Create index for paused recurring expenses lookup
CREATE INDEX IF NOT EXISTS idx_expenses_is_paused 
  ON public.expenses(is_paused)
  WHERE is_recurring = true AND is_paused = true;

-- Add comment
COMMENT ON COLUMN public.expenses.is_paused IS 'Pausa a geração de novas instâncias da despesa recorrente quando true';
