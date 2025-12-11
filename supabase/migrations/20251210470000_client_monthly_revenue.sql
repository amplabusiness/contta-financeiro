-- =====================================================
-- Tabela para armazenar o faturamento mensal dos clientes
-- Usado para calcular honorários variáveis (ex: 2,87% do faturamento)
-- =====================================================

-- Criar tabela de faturamento mensal
CREATE TABLE IF NOT EXISTS client_monthly_revenue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    reference_month DATE NOT NULL, -- Primeiro dia do mês de referência (ex: 2025-01-01)
    gross_revenue DECIMAL(15,2) NOT NULL DEFAULT 0, -- Faturamento bruto
    net_revenue DECIMAL(15,2), -- Receita líquida (opcional)
    payroll_amount DECIMAL(15,2), -- Folha de pagamento (opcional, para cálculo sobre folha)
    notes TEXT,
    source VARCHAR(50) DEFAULT 'manual', -- manual, bling, nfe, imported
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Garantir apenas um registro por cliente/mês
    UNIQUE(client_id, reference_month)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_client_monthly_revenue_client ON client_monthly_revenue(client_id);
CREATE INDEX IF NOT EXISTS idx_client_monthly_revenue_month ON client_monthly_revenue(reference_month);
CREATE INDEX IF NOT EXISTS idx_client_monthly_revenue_client_month ON client_monthly_revenue(client_id, reference_month);

-- RLS
ALTER TABLE client_monthly_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client monthly revenue"
    ON client_monthly_revenue FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert client monthly revenue"
    ON client_monthly_revenue FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update client monthly revenue"
    ON client_monthly_revenue FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Users can delete client monthly revenue"
    ON client_monthly_revenue FOR DELETE
    TO authenticated
    USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_monthly_revenue_updated_at
    BEFORE UPDATE ON client_monthly_revenue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Tabela para honorários calculados (gerados a partir do faturamento)
-- =====================================================

CREATE TABLE IF NOT EXISTS variable_fee_calculations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variable_fee_id UUID NOT NULL REFERENCES client_variable_fees(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    reference_month DATE NOT NULL,
    revenue_base DECIMAL(15,2) NOT NULL, -- Valor base usado no cálculo
    percentage_rate DECIMAL(5,2) NOT NULL, -- Taxa aplicada
    calculated_amount DECIMAL(15,2) NOT NULL, -- Valor calculado
    invoice_id UUID REFERENCES invoices(id), -- Fatura gerada (se houver)
    status VARCHAR(20) DEFAULT 'pending', -- pending, invoiced, paid, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(variable_fee_id, reference_month)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_variable_fee_calc_fee ON variable_fee_calculations(variable_fee_id);
CREATE INDEX IF NOT EXISTS idx_variable_fee_calc_client ON variable_fee_calculations(client_id);
CREATE INDEX IF NOT EXISTS idx_variable_fee_calc_month ON variable_fee_calculations(reference_month);
CREATE INDEX IF NOT EXISTS idx_variable_fee_calc_status ON variable_fee_calculations(status);

-- RLS
ALTER TABLE variable_fee_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view variable fee calculations"
    ON variable_fee_calculations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert variable fee calculations"
    ON variable_fee_calculations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update variable fee calculations"
    ON variable_fee_calculations FOR UPDATE
    TO authenticated
    USING (true);

-- =====================================================
-- Função para calcular honorário variável
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_variable_fee(
    p_client_id UUID,
    p_reference_month DATE
) RETURNS TABLE (
    fee_id UUID,
    fee_name VARCHAR,
    percentage_rate DECIMAL,
    revenue_base DECIMAL,
    calculated_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cvf.id as fee_id,
        cvf.fee_name,
        cvf.percentage_rate,
        CASE cvf.calculation_base
            WHEN 'faturamento' THEN COALESCE(cmr.gross_revenue, 0)
            WHEN 'receita_bruta' THEN COALESCE(cmr.net_revenue, cmr.gross_revenue, 0)
            WHEN 'folha_pagamento' THEN COALESCE(cmr.payroll_amount, 0)
            ELSE COALESCE(cmr.gross_revenue, 0)
        END as revenue_base,
        ROUND(
            (CASE cvf.calculation_base
                WHEN 'faturamento' THEN COALESCE(cmr.gross_revenue, 0)
                WHEN 'receita_bruta' THEN COALESCE(cmr.net_revenue, cmr.gross_revenue, 0)
                WHEN 'folha_pagamento' THEN COALESCE(cmr.payroll_amount, 0)
                ELSE COALESCE(cmr.gross_revenue, 0)
            END * cvf.percentage_rate / 100)::DECIMAL, 2
        ) as calculated_amount
    FROM client_variable_fees cvf
    LEFT JOIN client_monthly_revenue cmr ON cmr.client_id = cvf.client_id
        AND cmr.reference_month = p_reference_month
    WHERE cvf.client_id = p_client_id
      AND cvf.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Adicionar campos de comissão do funcionário na tabela client_variable_fees
-- =====================================================

DO $$
BEGIN
    -- Adicionar campo para comissão do funcionário
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'client_variable_fees' AND column_name = 'employee_commission_rate') THEN
        ALTER TABLE client_variable_fees ADD COLUMN employee_commission_rate DECIMAL(5,2) DEFAULT 0;
    END IF;

    -- Nome do funcionário que recebe a comissão
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'client_variable_fees' AND column_name = 'employee_name') THEN
        ALTER TABLE client_variable_fees ADD COLUMN employee_name VARCHAR(255);
    END IF;

    -- Chave PIX do funcionário
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'client_variable_fees' AND column_name = 'employee_pix_key') THEN
        ALTER TABLE client_variable_fees ADD COLUMN employee_pix_key VARCHAR(255);
    END IF;

    -- Tipo de chave PIX
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'client_variable_fees' AND column_name = 'employee_pix_type') THEN
        ALTER TABLE client_variable_fees ADD COLUMN employee_pix_type VARCHAR(20);
    END IF;
END $$;

-- Adicionar campos de comissão na tabela de cálculos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'variable_fee_calculations' AND column_name = 'employee_commission') THEN
        ALTER TABLE variable_fee_calculations ADD COLUMN employee_commission DECIMAL(15,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'variable_fee_calculations' AND column_name = 'employee_commission_paid') THEN
        ALTER TABLE variable_fee_calculations ADD COLUMN employee_commission_paid BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'variable_fee_calculations' AND column_name = 'employee_commission_paid_at') THEN
        ALTER TABLE variable_fee_calculations ADD COLUMN employee_commission_paid_at TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON TABLE client_monthly_revenue IS 'Faturamento mensal dos clientes para cálculo de honorários variáveis';
COMMENT ON TABLE variable_fee_calculations IS 'Honorários variáveis calculados por mês';
COMMENT ON FUNCTION calculate_variable_fee(UUID, DATE) IS 'Calcula honorário variável baseado no faturamento do mês';
