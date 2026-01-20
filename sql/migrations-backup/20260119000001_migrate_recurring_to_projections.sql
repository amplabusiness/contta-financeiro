-- ============================================================================
-- MIGRATE RECURRING EXPENSES TO CASH FLOW PROJECTIONS
-- 📦 Migra dados existentes de recurring_expenses para cash_flow_projections
-- ============================================================================

-- Migrar dados existentes da tabela antiga para a nova
INSERT INTO cash_flow_projections (
    description,
    amount,
    projection_date,
    projection_type,
    frequency,
    category,
    is_active,
    created_at
)
SELECT
    description,
    amount,
    -- Calcular a próxima data de ocorrência baseada no payment_day
    make_date(
        EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
        EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
        LEAST(payment_day, EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER)
    ) as projection_date,
    'DESPESA_RECORRENTE' as projection_type,
    'monthly' as frequency,
    COALESCE(category, 'Despesas Recorrentes') as category,
    active as is_active,
    created_at
FROM recurring_expenses
WHERE NOT EXISTS (
    -- Evitar duplicatas caso o script seja executado mais de uma vez
    SELECT 1 FROM cash_flow_projections cfp
    WHERE cfp.description = recurring_expenses.description
    AND cfp.amount = recurring_expenses.amount
);

-- Comentário
COMMENT ON TABLE cash_flow_projections IS
'Tabela unificada de projeções - substitui recurring_expenses com mais funcionalidades';
