-- =====================================================
-- Add recurring expense support to expenses table
-- Migration: 20251203000000
-- =====================================================

-- Add recurring expense columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_day INTEGER DEFAULT 10 CHECK (recurrence_day BETWEEN 1 AND 31);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS cost_center TEXT;

-- Create index for recurring expenses queries
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_expenses_competence ON expenses(competence);
