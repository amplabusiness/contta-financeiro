-- Migration: Fix RLS policies for accounting_entry_lines
-- Date: 2025-11-29
-- Purpose: Allow all authenticated users to view and manage entry lines

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins and accountants can view entry lines" ON public.accounting_entry_lines;
DROP POLICY IF EXISTS "Admins and accountants can insert entry lines" ON public.accounting_entry_lines;
DROP POLICY IF EXISTS "Admins and accountants can update entry lines" ON public.accounting_entry_lines;
DROP POLICY IF EXISTS "Admins can delete entry lines" ON public.accounting_entry_lines;

-- Create simpler policies for authenticated users (drop first if exists)
DROP POLICY IF EXISTS "Authenticated users can view entry lines" ON public.accounting_entry_lines;
CREATE POLICY "Authenticated users can view entry lines"
  ON public.accounting_entry_lines FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert entry lines" ON public.accounting_entry_lines;
CREATE POLICY "Authenticated users can insert entry lines"
  ON public.accounting_entry_lines FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update entry lines" ON public.accounting_entry_lines;
CREATE POLICY "Authenticated users can update entry lines"
  ON public.accounting_entry_lines FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete entry lines" ON public.accounting_entry_lines;
CREATE POLICY "Authenticated users can delete entry lines"
  ON public.accounting_entry_lines FOR DELETE
  TO authenticated
  USING (true);

-- Also fix accounting_entries if needed
DROP POLICY IF EXISTS "Admins and accountants can view entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Admins and accountants can create entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Admins and accountants can update entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Admins can delete entries" ON public.accounting_entries;

-- Create simpler policies for accounting_entries (drop first if exists)
DROP POLICY IF EXISTS "Authenticated users can view entries" ON public.accounting_entries;
CREATE POLICY "Authenticated users can view entries"
  ON public.accounting_entries FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert entries" ON public.accounting_entries;
CREATE POLICY "Authenticated users can insert entries"
  ON public.accounting_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update entries" ON public.accounting_entries;
CREATE POLICY "Authenticated users can update entries"
  ON public.accounting_entries FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete entries" ON public.accounting_entries;
CREATE POLICY "Authenticated users can delete entries"
  ON public.accounting_entries FOR DELETE
  TO authenticated
  USING (true);
