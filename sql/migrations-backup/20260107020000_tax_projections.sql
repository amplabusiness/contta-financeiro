-- ============================================================================
-- PHASE 8.1: TAX ENGINE & PROJECTIONS
-- 📊 Motor de Cálculo e Projeção de Tributos
-- ============================================================================

-- 1. Tabela de Configuração de Impostos Recorrentes
-- Define quais impostos a empresa paga e suas regras básicas
CREATE TABLE IF NOT EXISTS tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Ex: "Simples Nacional", "ISS Próprio", "IPTU Sede"
    tax_code TEXT UNIQUE NOT NULL, -- Ex: "DAS", "ISS", "IPTU"
    recurrence_type TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
    payment_day INTEGER DEFAULT 20, -- Dia do vencimento (Ex: 20 para DAS)
    calculation_method TEXT DEFAULT 'fixed', -- 'fixed' (Valor Fixo), 'revenue_percentage' (Percentual Faturamento)
    default_rate NUMERIC(10,4), -- Ex: 0.0600 (6%) se for percentual
    fixed_amount NUMERIC(10,2), -- Ex: 150.00 se for fixo
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed básico: Simples Nacional (Estimado) e ISS (Exemplo)
INSERT INTO tax_configurations (name, tax_code, payment_day, calculation_method, default_rate)
VALUES ('Simples Nacional', 'DAS', 20, 'revenue_percentage', 0.0600)
ON CONFLICT (tax_code) DO NOTHING;

INSERT INTO tax_configurations (name, tax_code, payment_day, calculation_method, fixed_amount)
VALUES ('ISS Fixo / Taxas', 'ISS_FIXO', 10, 'fixed', 0.00) -- Ajustar valor real depois
ON CONFLICT (tax_code) DO NOTHING;


-- 2. Tabela de Parcelamentos (Passivos Tributários)
-- Controla "Parcelamento Simples 2024", "Parcelamento IPTU", etc.
CREATE TABLE IF NOT EXISTS tax_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL, -- Ex: "Parcelamento Simples 2023"
    total_amount NUMERIC(15,2) NOT NULL, -- Valor total da dívida original
    remaining_balance NUMERIC(15,2), -- Quanto falta pagar (opcional, calculado via parcelas)
    installment_value NUMERIC(10,2) NOT NULL, -- Valor fixo da parcela (ou média)
    start_date DATE NOT NULL, -- Data da 1ª parcela
    end_date DATE NOT NULL, -- Data da última parcela
    payment_day INTEGER NOT NULL, -- Dia de vencimento todo mês
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. View de Projeção de Tributos (Próximos 12 meses)
-- Combina impostos recorrentes (DAS estimado) + Parcelamentos
CREATE OR REPLACE VIEW v_projections_taxes AS
WITH 
    -- A. Calcular Faturamento Médio (Base para DAS)
    -- Pega média dos últimos 3 meses de invoices emitidos para estimar DAS futuro
    avg_revenue AS (
        SELECT COALESCE(AVG(amount), 0) as monthly_avg
        FROM invoices
        WHERE type = 'honorario_mensal' 
          AND competence IN (
            TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'MM/YYYY'),
            TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'MM/YYYY'),
            TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'MM/YYYY')
          )
    ),
    
    -- B. Gerar Datas Futuras (Próximos 12 meses)
    future_months AS (
        SELECT generate_series(
            DATE_TRUNC('month', CURRENT_DATE),
            DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '11 months',
            '1 month'::interval
        )::DATE as ref_date
    )

SELECT 
    'TAX_RECURRING' as projection_type,
    tc.name as description,
    fm.ref_date + (tc.payment_day - 1 || ' days')::INTERVAL as due_date,
    CASE 
        WHEN tc.calculation_method = 'fixed' THEN tc.fixed_amount
        WHEN tc.calculation_method = 'revenue_percentage' THEN (
            SELECT monthly_avg * tc.default_rate FROM avg_revenue
        )
        ELSE 0
    END as amount,
    'high' as confidence_level
FROM 
    future_months fm
    CROSS JOIN tax_configurations tc
WHERE 
    tc.active = TRUE

UNION ALL

SELECT 
    'TAX_INSTALLMENT' as projection_type,
    ti.description,
    -- Constrói a data de vencimento para aquele mês
    make_date(
        EXTRACT(YEAR FROM fm.ref_date)::INTEGER,
        EXTRACT(MONTH FROM fm.ref_date)::INTEGER,
        ti.payment_day
    ) as due_date,
    ti.installment_value as amount,
    'certain' as confidence_level
FROM 
    tax_installments ti
    JOIN future_months fm ON 
        fm.ref_date >= DATE_TRUNC('month', ti.start_date) AND 
        fm.ref_date <= DATE_TRUNC('month', ti.end_date)
WHERE 
    ti.active = TRUE;

-- 4. Permissões
GRANT SELECT ON v_projections_taxes TO authenticated;
GRANT SELECT ON v_projections_taxes TO service_role;
