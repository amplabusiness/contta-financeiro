-- =====================================================
-- SISTEMA DE HONORÁRIOS ESPECIAIS - AMPLA CONTABILIDADE
-- =====================================================
-- 1. Honorários Variáveis (% sobre faturamento)
-- 2. Abertura/Alteração de Empresas
-- 3. Comissões por Indicação
-- 4. Declaração de IRPF
-- =====================================================

-- =====================================================
-- 1. HONORÁRIOS VARIÁVEIS (% sobre faturamento)
-- =====================================================
-- Exemplo: Mata Pragas paga honorário fixo + 2.87% do faturamento dia 20

CREATE TABLE IF NOT EXISTS client_variable_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Configuração do honorário variável
  fee_name VARCHAR(100) NOT NULL DEFAULT 'Honorário Variável',
  fee_type VARCHAR(50) NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'fixed_per_unit'
  percentage_rate DECIMAL(5,2), -- Ex: 2.87 para 2.87%
  fixed_amount DECIMAL(15,2), -- Valor fixo por unidade (se aplicável)

  -- Dia de vencimento
  due_day INTEGER NOT NULL DEFAULT 20,

  -- Base de cálculo
  calculation_base VARCHAR(50) NOT NULL DEFAULT 'faturamento', -- 'faturamento', 'receita_bruta', 'folha_pagamento'

  -- Período de referência
  reference_month_offset INTEGER DEFAULT -1, -- -1 = mês anterior, 0 = mês atual

  -- Status
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela para lançar o faturamento mensal do cliente
CREATE TABLE IF NOT EXISTS client_monthly_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Período
  reference_year INTEGER NOT NULL,
  reference_month INTEGER NOT NULL CHECK (reference_month BETWEEN 1 AND 12),

  -- Valores
  gross_revenue DECIMAL(15,2) NOT NULL DEFAULT 0, -- Faturamento bruto
  net_revenue DECIMAL(15,2), -- Receita líquida (se aplicável)
  payroll_total DECIMAL(15,2), -- Folha de pagamento (se aplicável)

  -- Honorário calculado
  calculated_fee DECIMAL(15,2), -- Valor calculado automaticamente
  final_fee DECIMAL(15,2), -- Valor final (pode ser ajustado)

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'calculated', 'invoiced', 'paid'
  invoice_id UUID REFERENCES invoices(id),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(client_id, reference_year, reference_month)
);

-- =====================================================
-- 2. ABERTURA/ALTERAÇÃO DE EMPRESAS
-- =====================================================
-- Exemplo: Recebe R$ 2.500 por abertura, paga taxas, lucro = diferença

CREATE TABLE IF NOT EXISTS company_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id), -- NULL se for novo cliente

  -- Tipo de serviço
  service_type VARCHAR(50) NOT NULL, -- 'abertura', 'alteracao', 'baixa', 'transformacao'
  service_status VARCHAR(30) DEFAULT 'em_andamento', -- 'em_andamento', 'concluido', 'cancelado'

  -- Dados da empresa (pode ser nova)
  company_name VARCHAR(255),
  company_cnpj VARCHAR(20),
  company_type VARCHAR(50), -- 'MEI', 'ME', 'EPP', 'LTDA', 'SA', 'EIRELI'

  -- Valores
  total_charged DECIMAL(15,2) NOT NULL, -- Valor cobrado do cliente (ex: 2500)
  total_costs DECIMAL(15,2) DEFAULT 0, -- Total de taxas pagas
  profit DECIMAL(15,2) GENERATED ALWAYS AS (total_charged - total_costs) STORED, -- Lucro automático

  -- Datas
  start_date DATE DEFAULT CURRENT_DATE,
  expected_completion DATE,
  completion_date DATE,

  -- Pagamento do cliente
  payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'partial', 'paid'
  amount_received DECIMAL(15,2) DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Taxas/despesas do serviço de abertura
CREATE TABLE IF NOT EXISTS company_service_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES company_services(id) ON DELETE CASCADE,

  -- Descrição da taxa
  description VARCHAR(255) NOT NULL, -- 'Taxa Junta Comercial', 'DARE', 'Certificado Digital', etc.
  cost_type VARCHAR(50), -- 'taxa_governo', 'cartorio', 'certificado', 'outros'

  -- Valores
  amount DECIMAL(15,2) NOT NULL,

  -- Pagamento
  payment_date DATE,
  bank_transaction_id UUID REFERENCES bank_transactions(id),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para atualizar total_costs automaticamente
CREATE OR REPLACE FUNCTION update_service_total_costs()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE company_services
  SET total_costs = (
    SELECT COALESCE(SUM(amount), 0)
    FROM company_service_costs
    WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_service_costs ON company_service_costs;
CREATE TRIGGER trg_update_service_costs
AFTER INSERT OR UPDATE OR DELETE ON company_service_costs
FOR EACH ROW EXECUTE FUNCTION update_service_total_costs();

-- =====================================================
-- 3. COMISSÕES POR INDICAÇÃO
-- =====================================================
-- Exemplo: 10% do honorário por 5 meses para quem indicou

CREATE TABLE IF NOT EXISTS referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados do parceiro/corretor
  name VARCHAR(255) NOT NULL,
  cpf VARCHAR(14),
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Dados bancários para pagamento
  pix_key VARCHAR(255), -- Chave PIX para pagamento
  pix_key_type VARCHAR(20), -- 'cpf', 'cnpj', 'email', 'telefone', 'aleatoria'
  bank_name VARCHAR(100),
  bank_agency VARCHAR(10),
  bank_account VARCHAR(20),

  -- Status
  is_active BOOLEAN DEFAULT true,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indicações feitas pelo parceiro
CREATE TABLE IF NOT EXISTS client_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referral_partner_id UUID NOT NULL REFERENCES referral_partners(id),

  -- Configuração da comissão
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 10, -- Ex: 10%
  commission_months INTEGER NOT NULL DEFAULT 5, -- Número de meses

  -- Período de vigência
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE, -- Calculado via trigger ou na aplicação

  -- Controle
  months_paid INTEGER DEFAULT 0, -- Quantos meses já foram pagos
  total_commission_paid DECIMAL(15,2) DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para calcular end_date automaticamente
CREATE OR REPLACE FUNCTION calculate_referral_end_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.end_date := NEW.start_date + (NEW.commission_months || ' months')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_referral_end_date ON client_referrals;
CREATE TRIGGER trg_calculate_referral_end_date
BEFORE INSERT OR UPDATE ON client_referrals
FOR EACH ROW EXECUTE FUNCTION calculate_referral_end_date();

-- Pagamentos de comissão
CREATE TABLE IF NOT EXISTS referral_commission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES client_referrals(id) ON DELETE CASCADE,

  -- Referência
  reference_year INTEGER NOT NULL,
  reference_month INTEGER NOT NULL,
  month_number INTEGER NOT NULL, -- 1º mês, 2º mês, etc.

  -- Valores
  client_fee_amount DECIMAL(15,2) NOT NULL, -- Honorário do cliente no mês
  commission_percentage DECIMAL(5,2) NOT NULL, -- % aplicado
  commission_amount DECIMAL(15,2) NOT NULL, -- Valor da comissão

  -- Pagamento
  payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid'
  payment_date DATE,
  bank_transaction_id UUID REFERENCES bank_transactions(id),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. DECLARAÇÃO DE IRPF
-- =====================================================

CREATE TABLE IF NOT EXISTS irpf_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ano-calendário e exercício
  calendar_year INTEGER NOT NULL, -- Ano-calendário (ex: 2024)
  fiscal_year INTEGER NOT NULL, -- Exercício (ex: 2025)

  -- Contribuinte
  taxpayer_type VARCHAR(20) NOT NULL, -- 'socio', 'particular'
  taxpayer_name VARCHAR(255) NOT NULL,
  taxpayer_cpf VARCHAR(14) NOT NULL,

  -- Vínculo com cliente (se for sócio)
  client_id UUID REFERENCES clients(id), -- Empresa onde é sócio

  -- Valores
  fee_amount DECIMAL(15,2) NOT NULL DEFAULT 300, -- Honorário cobrado

  -- Status do serviço
  status VARCHAR(30) DEFAULT 'pendente',
  -- 'pendente', 'documentos_solicitados', 'em_elaboracao', 'enviada', 'retificadora', 'concluida'

  -- Datas importantes
  documents_received_date DATE,
  submission_date DATE,
  rectification_date DATE,

  -- Resultado da declaração
  result_type VARCHAR(20), -- 'restituir', 'pagar', 'zero'
  result_amount DECIMAL(15,2), -- Valor a restituir ou pagar

  -- Pagamento do honorário
  payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid'
  invoice_id UUID REFERENCES invoices(id),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(taxpayer_cpf, calendar_year)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_variable_fees_client ON client_variable_fees(client_id);
CREATE INDEX IF NOT EXISTS idx_monthly_revenue_client_period ON client_monthly_revenue(client_id, reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_company_services_client ON company_services(client_id);
CREATE INDEX IF NOT EXISTS idx_company_services_status ON company_services(service_status);
CREATE INDEX IF NOT EXISTS idx_referrals_client ON client_referrals(client_id);
CREATE INDEX IF NOT EXISTS idx_referrals_partner ON client_referrals(referral_partner_id);
CREATE INDEX IF NOT EXISTS idx_irpf_year ON irpf_declarations(calendar_year);
CREATE INDEX IF NOT EXISTS idx_irpf_cpf ON irpf_declarations(taxpayer_cpf);

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View de comissões pendentes de pagamento
DROP VIEW IF EXISTS vw_pending_commissions;
CREATE VIEW vw_pending_commissions AS
SELECT
  rp.name as partner_name,
  rp.pix_key,
  rp.pix_key_type,
  c.name as client_name,
  cr.commission_percentage,
  cr.commission_months,
  cr.months_paid,
  cr.commission_months - cr.months_paid as months_remaining,
  c.monthly_fee,
  (c.monthly_fee * cr.commission_percentage / 100) as next_commission_amount
FROM client_referrals cr
JOIN referral_partners rp ON rp.id = cr.referral_partner_id
JOIN clients c ON c.id = cr.client_id
WHERE cr.status = 'active'
  AND cr.months_paid < cr.commission_months;

-- View de clientes com honorário variável
DROP VIEW IF EXISTS vw_clients_variable_fees;
CREATE VIEW vw_clients_variable_fees AS
SELECT
  c.id as client_id,
  c.name as client_name,
  c.nome_fantasia,
  cvf.fee_name,
  cvf.percentage_rate,
  cvf.due_day,
  cvf.calculation_base,
  cvf.is_active
FROM clients c
JOIN client_variable_fees cvf ON cvf.client_id = c.id
WHERE cvf.is_active = true;

-- View de IRPF pendentes por ano
DROP VIEW IF EXISTS vw_irpf_summary;
CREATE VIEW vw_irpf_summary AS
SELECT
  calendar_year,
  fiscal_year,
  COUNT(*) as total_declarations,
  COUNT(*) FILTER (WHERE status = 'pendente') as pending,
  COUNT(*) FILTER (WHERE status = 'documentos_solicitados') as awaiting_docs,
  COUNT(*) FILTER (WHERE status = 'em_elaboracao') as in_progress,
  COUNT(*) FILTER (WHERE status IN ('enviada', 'concluida')) as completed,
  SUM(fee_amount) as total_fees,
  SUM(fee_amount) FILTER (WHERE payment_status = 'paid') as fees_received
FROM irpf_declarations
GROUP BY calendar_year, fiscal_year
ORDER BY calendar_year DESC;

-- =====================================================
-- FUNÇÃO: Gerar previsão de IRPF dos sócios
-- =====================================================

CREATE OR REPLACE FUNCTION generate_irpf_forecast(p_calendar_year INTEGER)
RETURNS TABLE (
  taxpayer_name VARCHAR,
  taxpayer_cpf VARCHAR,
  client_name VARCHAR,
  client_id UUID,
  already_registered BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    (s.socio->>'nome')::VARCHAR as taxpayer_name,
    -- Tentar extrair CPF do QSA (pode não ter)
    COALESCE(s.socio->>'cpf', '')::VARCHAR as taxpayer_cpf,
    c.name::VARCHAR as client_name,
    c.id as client_id,
    EXISTS (
      SELECT 1 FROM irpf_declarations ir
      WHERE ir.taxpayer_cpf = COALESCE(s.socio->>'cpf', '')
        AND ir.calendar_year = p_calendar_year
    ) as already_registered
  FROM clients c,
  LATERAL jsonb_array_elements(c.qsa) as s(socio)
  WHERE c.is_active = true
    AND c.qsa IS NOT NULL
    AND jsonb_array_length(c.qsa) > 0
  ORDER BY taxpayer_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO: Calcular honorário variável do mês
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_variable_fee(
  p_client_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  v_config RECORD;
  v_revenue RECORD;
  v_calculated_fee DECIMAL := 0;
BEGIN
  -- Buscar configuração do honorário variável
  SELECT * INTO v_config
  FROM client_variable_fees
  WHERE client_id = p_client_id
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Buscar faturamento do período de referência
  SELECT * INTO v_revenue
  FROM client_monthly_revenue
  WHERE client_id = p_client_id
    AND reference_year = p_year
    AND reference_month = p_month;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calcular baseado no tipo
  IF v_config.fee_type = 'percentage' THEN
    CASE v_config.calculation_base
      WHEN 'faturamento' THEN
        v_calculated_fee := v_revenue.gross_revenue * v_config.percentage_rate / 100;
      WHEN 'receita_bruta' THEN
        v_calculated_fee := COALESCE(v_revenue.net_revenue, v_revenue.gross_revenue) * v_config.percentage_rate / 100;
      WHEN 'folha_pagamento' THEN
        v_calculated_fee := COALESCE(v_revenue.payroll_total, 0) * v_config.percentage_rate / 100;
    END CASE;
  ELSE
    v_calculated_fee := v_config.fixed_amount;
  END IF;

  -- Atualizar o registro com o valor calculado
  UPDATE client_monthly_revenue
  SET calculated_fee = v_calculated_fee,
      updated_at = NOW()
  WHERE id = v_revenue.id;

  RETURN v_calculated_fee;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE client_variable_fees IS 'Configuração de honorários variáveis (% sobre faturamento)';
COMMENT ON TABLE client_monthly_revenue IS 'Faturamento mensal dos clientes para cálculo de honorário variável';
COMMENT ON TABLE company_services IS 'Serviços de abertura, alteração e baixa de empresas';
COMMENT ON TABLE company_service_costs IS 'Taxas e custos de serviços de abertura de empresas';
COMMENT ON TABLE referral_partners IS 'Parceiros/corretores que indicam clientes';
COMMENT ON TABLE client_referrals IS 'Indicações de clientes com configuração de comissão';
COMMENT ON TABLE referral_commission_payments IS 'Pagamentos de comissões por indicação';
COMMENT ON TABLE irpf_declarations IS 'Declarações de IRPF (sócios e particulares)';
