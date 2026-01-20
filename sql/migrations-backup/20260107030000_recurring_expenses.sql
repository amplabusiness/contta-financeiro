-- ============================================================================
-- PHASE 8.2: RECURRING EXPENSES & UNIFIED CASH FLOW VIEW
-- 📅 Despesas Recorrentes e Visão Unificada
-- ============================================================================

-- 1. Create table for Recurring Expenses (Fixed Costs)
-- Ex: Rent, Internet, Softwares, etc.
-- DROP to ensure clean state (fix "column does not exist" errors if table exists from previous migrations)
DROP TABLE IF EXISTS recurring_expenses CASCADE;

CREATE TABLE recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL, -- Ex: "Aluguel Sede"
    amount NUMERIC(15,2) NOT NULL, -- Ex: 3500.00
    payment_day INTEGER NOT NULL, -- Ex: 05 (Day of month)
    category TEXT, -- Optional category for grouping
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Data (Examples based on typical accounting office costs)
INSERT INTO recurring_expenses (description, amount, payment_day, category)
VALUES 
    ('Aluguel Escritório', 2500.00, 5, 'INSTALACOES'),
    ('Energia Elétrica Estimada', 450.00, 10, 'INSTALACOES'),
    ('Internet Link 1', 150.00, 15, 'TECNOLOGIA'),
    ('Licença Sistema Contábil', 800.00, 20, 'SOFTWARE')
ON CONFLICT DO NOTHING;

-- 2. Create View for Recurring Expenses Projection (Next 12 Months)
CREATE OR REPLACE VIEW v_projections_recurring AS
WITH future_months AS (
    SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE),
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '11 months',
        '1 month'::interval
    )::DATE as ref_date
)
SELECT 
    'RECURRING' as projection_type,
    re.description,
    -- Construct Due Date
    make_date(
        EXTRACT(YEAR FROM fm.ref_date)::INTEGER,
        EXTRACT(MONTH FROM fm.ref_date)::INTEGER,
        CASE 
            -- Handle February 30th etc by capping at last day of month? 
            -- For simplicity, let's assume valid days or PostgreSQL might error/adjust.
            -- make_date handles this? verify. creating a safer date construction:
            WHEN re.payment_day > EXTRACT(DAY FROM (fm.ref_date + INTERVAL '1 month' - INTERVAL '1 day')) 
            THEN EXTRACT(DAY FROM (fm.ref_date + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER
            ELSE re.payment_day
        END
    ) as due_date,
    re.amount,
    'fixed' as confidence_level
FROM 
    recurring_expenses re
    CROSS JOIN future_months fm
WHERE 
    re.active = TRUE;


-- 3. Create UNIFIED CASH FLOW DAILY VIEW
-- This view aggregates ALL sources of future movement + Current Balance (optional conceptual inclusion)
-- Note: This view focuses on FLOW (Future movements). Current Balance is a state, not a flow, but acts as starting point.
-- Here we list the Daily Movments.

CREATE OR REPLACE VIEW v_cash_flow_daily AS
-- A. Receivables (Confirmed Invoices)
SELECT 
    due_date,
    description::text,
    amount::numeric as value, -- Positive = Entering
    'RECEIVABLE' as type,
    'CONFIRMED' as status
FROM invoices
WHERE status = 'pending' 

UNION ALL

-- B. Payroll Projections (Expenses)
SELECT 
    due_date,
    description::text,
    -(amount)::numeric as value, -- Negative = Leaving
    'PAYROLL' as type,
    'PROJECTED' as status
FROM v_projections_payroll

UNION ALL

-- C. Contractor Projections (Expenses)
SELECT 
    due_date,
    description::text,
    -(amount)::numeric as value, -- Negative = Leaving
    'CONTRACTOR' as type,
    'PROJECTED' as status
FROM v_projections_contractors

UNION ALL

-- D. Tax Projections (Expenses - Phase 8.1)
SELECT 
    due_date,
    description::text,
    -(amount)::numeric as value, -- Negative = Leaving
    'TAX' as type,
    CASE WHEN confidence_level = 'certain' THEN 'CONFIRMED' ELSE 'PROJECTED' END as status
FROM v_projections_taxes

UNION ALL

-- E. Recurring Expenses (Expenses - Phase 8.2)
SELECT 
    due_date,
    description::text,
    -(amount)::numeric as value, -- Negative = Leaving
    'RECURRING' as type,
    'PROJECTED' as status
FROM v_projections_recurring;

-- 4. Permissions
GRANT SELECT ON recurring_expenses TO authenticated;
GRANT SELECT ON recurring_expenses TO service_role;
GRANT SELECT ON v_projections_recurring TO authenticated;
GRANT SELECT ON v_projections_recurring TO service_role;
GRANT SELECT ON v_cash_flow_daily TO authenticated;
GRANT SELECT ON v_cash_flow_daily TO service_role;
