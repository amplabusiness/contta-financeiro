-- ============================================================================
-- CASH FLOW PROJECTIONS - CRUD System
-- 📊 Sistema completo de gerenciamento de projeções de fluxo de caixa
-- ============================================================================

-- 1. Create table for Custom Cash Flow Projections
-- This table allows users to create manual projections in addition to automatic ones
DROP TABLE IF EXISTS cash_flow_projections CASCADE;

CREATE TABLE cash_flow_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    projection_date DATE NOT NULL,
    projection_type TEXT NOT NULL CHECK (projection_type IN ('RECEITA', 'DESPESA_FOLHA', 'DESPESA_PJ', 'DESPESA_IMPOSTO', 'DESPESA_OUTROS', 'DESPESA_RECORRENTE')),
    frequency TEXT CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'yearly')),
    recurrence_end_date DATE,
    category TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX idx_cash_flow_projections_date ON cash_flow_projections(projection_date);
CREATE INDEX idx_cash_flow_projections_active ON cash_flow_projections(is_active);
CREATE INDEX idx_cash_flow_projections_type ON cash_flow_projections(projection_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_cash_flow_projections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cash_flow_projections_updated_at
    BEFORE UPDATE ON cash_flow_projections
    FOR EACH ROW
    EXECUTE FUNCTION update_cash_flow_projections_updated_at();

-- 2. Create View for Projections Expansion (handles recurring projections)
CREATE OR REPLACE VIEW v_projections_custom AS
WITH future_dates AS (
    SELECT generate_series(
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '12 months',
        '1 day'::interval
    )::DATE as ref_date
),
expanded_projections AS (
    -- One-time projections
    SELECT
        id,
        description,
        amount,
        projection_date as due_date,
        projection_type,
        category,
        'manual' as confidence_level
    FROM cash_flow_projections
    WHERE is_active = TRUE
        AND (frequency IS NULL OR frequency = 'once')
        AND projection_date >= CURRENT_DATE

    UNION ALL

    -- Daily recurring
    SELECT
        cp.id,
        cp.description,
        cp.amount,
        fd.ref_date as due_date,
        cp.projection_type,
        cp.category,
        'recurring' as confidence_level
    FROM cash_flow_projections cp
    CROSS JOIN future_dates fd
    WHERE cp.is_active = TRUE
        AND cp.frequency = 'daily'
        AND fd.ref_date >= cp.projection_date
        AND (cp.recurrence_end_date IS NULL OR fd.ref_date <= cp.recurrence_end_date)

    UNION ALL

    -- Weekly recurring
    SELECT
        cp.id,
        cp.description,
        cp.amount,
        fd.ref_date as due_date,
        cp.projection_type,
        cp.category,
        'recurring' as confidence_level
    FROM cash_flow_projections cp
    CROSS JOIN future_dates fd
    WHERE cp.is_active = TRUE
        AND cp.frequency = 'weekly'
        AND fd.ref_date >= cp.projection_date
        AND EXTRACT(DOW FROM fd.ref_date) = EXTRACT(DOW FROM cp.projection_date)
        AND (cp.recurrence_end_date IS NULL OR fd.ref_date <= cp.recurrence_end_date)

    UNION ALL

    -- Monthly recurring
    SELECT
        cp.id,
        cp.description,
        cp.amount,
        make_date(
            EXTRACT(YEAR FROM fd.ref_date)::INTEGER,
            EXTRACT(MONTH FROM fd.ref_date)::INTEGER,
            LEAST(
                EXTRACT(DAY FROM cp.projection_date)::INTEGER,
                EXTRACT(DAY FROM (DATE_TRUNC('month', fd.ref_date) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER
            )
        ) as due_date,
        cp.projection_type,
        cp.category,
        'recurring' as confidence_level
    FROM cash_flow_projections cp
    CROSS JOIN (
        SELECT DISTINCT DATE_TRUNC('month', ref_date)::DATE as ref_date
        FROM future_dates
    ) fd
    WHERE cp.is_active = TRUE
        AND cp.frequency = 'monthly'
        AND fd.ref_date >= DATE_TRUNC('month', cp.projection_date)::DATE
        AND (cp.recurrence_end_date IS NULL OR fd.ref_date <= cp.recurrence_end_date)

    UNION ALL

    -- Yearly recurring
    SELECT
        cp.id,
        cp.description,
        cp.amount,
        make_date(
            fd.year,
            EXTRACT(MONTH FROM cp.projection_date)::INTEGER,
            EXTRACT(DAY FROM cp.projection_date)::INTEGER
        ) as due_date,
        cp.projection_type,
        cp.category,
        'recurring' as confidence_level
    FROM cash_flow_projections cp
    CROSS JOIN (
        SELECT DISTINCT EXTRACT(YEAR FROM ref_date)::INTEGER as year
        FROM future_dates
    ) fd
    WHERE cp.is_active = TRUE
        AND cp.frequency = 'yearly'
        AND make_date(fd.year, EXTRACT(MONTH FROM cp.projection_date)::INTEGER, EXTRACT(DAY FROM cp.projection_date)::INTEGER) >= cp.projection_date
        AND (cp.recurrence_end_date IS NULL OR make_date(fd.year, EXTRACT(MONTH FROM cp.projection_date)::INTEGER, EXTRACT(DAY FROM cp.projection_date)::INTEGER) <= cp.recurrence_end_date)
)
SELECT DISTINCT
    description,
    amount,
    due_date,
    projection_type,
    category,
    confidence_level
FROM expanded_projections
ORDER BY due_date;

-- 3. Update UNIFIED CASH FLOW DAILY VIEW to include custom projections
CREATE OR REPLACE VIEW v_cash_flow_daily AS
-- A. Receivables (Confirmed Invoices)
SELECT
    due_date,
    description::text,
    amount::numeric as value,
    'RECEIVABLE' as type,
    'CONFIRMED' as status
FROM invoices
WHERE status = 'pending'

UNION ALL

-- B. Payroll Projections (Expenses)
SELECT
    due_date,
    description::text,
    -(amount)::numeric as value,
    'PAYROLL' as type,
    'PROJECTED' as status
FROM v_projections_payroll

UNION ALL

-- C. Contractor Projections (Expenses)
SELECT
    due_date,
    description::text,
    -(amount)::numeric as value,
    'CONTRACTOR' as type,
    'PROJECTED' as status
FROM v_projections_contractors

UNION ALL

-- D. Tax Projections (Expenses)
SELECT
    due_date,
    description::text,
    -(amount)::numeric as value,
    'TAX' as type,
    CASE WHEN confidence_level = 'certain' THEN 'CONFIRMED' ELSE 'PROJECTED' END as status
FROM v_projections_taxes

UNION ALL

-- E. Recurring Expenses (Expenses - from old table)
SELECT
    due_date,
    description::text,
    -(amount)::numeric as value,
    'RECURRING' as type,
    'PROJECTED' as status
FROM v_projections_recurring

UNION ALL

-- F. Custom Projections (New - Manual entries from users)
SELECT
    due_date,
    description::text,
    CASE
        WHEN projection_type = 'RECEITA' THEN amount::numeric
        ELSE -(amount)::numeric
    END as value,
    projection_type as type,
    CASE
        WHEN confidence_level = 'manual' THEN 'MANUAL'
        ELSE 'PROJECTED'
    END as status
FROM v_projections_custom;

-- 4. Row Level Security (RLS)
ALTER TABLE cash_flow_projections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all projections
CREATE POLICY "Users can view all projections"
    ON cash_flow_projections
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Users can insert projections
CREATE POLICY "Users can insert projections"
    ON cash_flow_projections
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Users can update projections
CREATE POLICY "Users can update projections"
    ON cash_flow_projections
    FOR UPDATE
    TO authenticated
    USING (true);

-- Policy: Users can delete projections
CREATE POLICY "Users can delete projections"
    ON cash_flow_projections
    FOR DELETE
    TO authenticated
    USING (true);

-- 5. Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_flow_projections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_flow_projections TO service_role;
GRANT SELECT ON v_projections_custom TO authenticated;
GRANT SELECT ON v_projections_custom TO service_role;
GRANT SELECT ON v_cash_flow_daily TO authenticated;
GRANT SELECT ON v_cash_flow_daily TO service_role;

-- 6. Initial seed data (optional examples) - DISABLED
-- Uncomment below to create example projections
-- INSERT INTO cash_flow_projections (description, amount, projection_date, projection_type, frequency, category)
-- VALUES
--     ('Projeção Manual - Exemplo', 5000.00, CURRENT_DATE + INTERVAL '7 days', 'RECEITA', 'once', 'Projeções'),
--     ('Despesa Recorrente - Exemplo', 1500.00, CURRENT_DATE, 'DESPESA_RECORRENTE', 'monthly', 'Fixos')
-- ON CONFLICT DO NOTHING;

-- 7. Comments for documentation
COMMENT ON TABLE cash_flow_projections IS 'Tabela de projeções customizadas de fluxo de caixa - permite criar projeções manuais e recorrentes';
COMMENT ON COLUMN cash_flow_projections.frequency IS 'Frequência da projeção: once, daily, weekly, monthly, yearly';
COMMENT ON COLUMN cash_flow_projections.projection_type IS 'Tipo: RECEITA, DESPESA_FOLHA, DESPESA_PJ, DESPESA_IMPOSTO, DESPESA_OUTROS, DESPESA_RECORRENTE';
COMMENT ON VIEW v_projections_custom IS 'View que expande projeções recorrentes em múltiplas datas';
COMMENT ON VIEW v_cash_flow_daily IS 'View unificada de fluxo de caixa incluindo todas as fontes + projeções customizadas';
