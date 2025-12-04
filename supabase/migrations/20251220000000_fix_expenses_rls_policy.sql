-- =====================================================
-- Fix Row Level Security policy for expenses table
-- Allow authenticated users to create expenses (as themselves)
-- =====================================================

-- Drop the overly restrictive INSERT policy
DROP POLICY IF EXISTS "Admins and accountants can create expenses" ON public.expenses;

-- Create a more permissive INSERT policy that allows authenticated users to create expenses
-- as long as they set themselves as the creator
CREATE POLICY "Authenticated users can create expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Keep the SELECT policy that allows authorized roles to view
-- (no change needed - it already allows admin, accountant, and viewer roles)

-- Keep the UPDATE policy 
-- (no change needed - admins and accountants can update)

-- Keep the DELETE policy
-- (no change needed - only admins can delete)

RAISE NOTICE '✅ Fixed RLS policy for expenses table';
RAISE NOTICE 'Authenticated users can now create expenses (setting themselves as creator)';
