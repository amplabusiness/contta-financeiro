-- Add cost_center column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN cost_center TEXT;

-- Add index for better query performance
CREATE INDEX idx_expenses_cost_center ON public.expenses(cost_center);