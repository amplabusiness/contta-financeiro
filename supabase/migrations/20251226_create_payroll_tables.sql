-- Migração: Criar tabelas de Folha de Pagamento e Rastreamento
-- Data: 2025-12-26
-- Descrição: Implementa estrutura de folha de pagamento com sistema de rastreamento

-- ============================================================
-- TABELA 1: PAYROLLS (Folhas de Pagamento)
-- ============================================================
CREATE TABLE IF NOT EXISTS payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação da folha (referencia clients que representa as empresas)
  company_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'provisioned', 'paid', 'closed')),
  
  -- Datas
  competence_date DATE NOT NULL,
  due_date DATE NOT NULL,
  closed_date DATE,
  
  -- Referência única para rastreamento
  reference_code VARCHAR(50) UNIQUE NOT NULL,
  
  -- Totalizações
  total_bruto DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_inss DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_irrf DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_liquido DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Informações adicionais
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payrolls_company ON payrolls(company_id);
CREATE INDEX idx_payrolls_year_month ON payrolls(year, month);
CREATE INDEX idx_payrolls_status ON payrolls(status);
CREATE INDEX idx_payrolls_reference ON payrolls(reference_code);

-- ============================================================
-- TABELA 2: PAYROLL_DETAILS (Detalhes da Folha por Funcionário)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência à folha
  payroll_id UUID NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  
  -- Dados do funcionário (desnormalizado para auditoria)
  employee_name VARCHAR(255) NOT NULL,
  employee_cpf VARCHAR(14),
  
  -- Valores
  salary_bruto DECIMAL(15,2) NOT NULL,
  inss_aliquota DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  inss_retido DECIMAL(15,2) NOT NULL,
  irrf_aliquota DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  irrf_retido DECIMAL(15,2) NOT NULL,
  outros_descontos DECIMAL(15,2) NOT NULL DEFAULT 0,
  salary_liquido DECIMAL(15,2) NOT NULL,
  
  -- Validação
  validation_status VARCHAR(20) DEFAULT 'valid'
    CHECK (validation_status IN ('valid', 'invalid', 'warning')),
  validation_message TEXT,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payroll_details_payroll ON payroll_details(payroll_id);
CREATE INDEX idx_payroll_details_employee ON payroll_details(employee_id);
CREATE INDEX idx_payroll_details_employee_cpf ON payroll_details(employee_cpf);

-- ============================================================
-- TABELA 3: ACCOUNTING_ENTRY_TRACKING (Rastreamento de Lançamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_entry_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Código único de rastreamento
  codigo_rastreamento VARCHAR(50) NOT NULL UNIQUE,
  
  -- Tipo de lançamento
  tipo VARCHAR(20) NOT NULL
    CHECK (tipo IN ('FOLD', 'PAGTO_SAL', 'RECOLH_INSS', 'RECOLH_IRRF')),
  
  -- Competência
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  
  -- Sequência
  sequencial INTEGER NOT NULL,
  
  -- Validação
  hash_validacao VARCHAR(6) NOT NULL,
  
  -- Referências
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  payroll_id UUID REFERENCES payrolls(id) ON DELETE SET NULL,
  reference_id VARCHAR(100),
  
  -- Dados originais (para auditoria)
  dados_originais JSONB,
  
  -- Rastreamento de duplicação
  original_codigo_rastreamento VARCHAR(50),
  foi_duplicado BOOLEAN DEFAULT FALSE,
  
  -- Auditoria
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_duplicacao TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tracking_codigo ON accounting_entry_tracking(codigo_rastreamento);
CREATE INDEX idx_tracking_tipo ON accounting_entry_tracking(tipo);
CREATE INDEX idx_tracking_competencia ON accounting_entry_tracking(competencia_ano, competencia_mes);
CREATE INDEX idx_tracking_entry_id ON accounting_entry_tracking(entry_id);
CREATE INDEX idx_tracking_payroll_id ON accounting_entry_tracking(payroll_id);
CREATE INDEX idx_tracking_duplicado ON accounting_entry_tracking(foi_duplicado);

-- ============================================================
-- TABELA 4: PAYROLL_PAYMENTS (Controle de Pagamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência
  payroll_id UUID NOT NULL REFERENCES payrolls(id) ON DELETE RESTRICT,
  
  -- Tipo de pagamento
  payment_type VARCHAR(20) NOT NULL
    CHECK (payment_type IN ('salario', 'inss', 'irrf')),
  
  -- Valores
  amount DECIMAL(15,2) NOT NULL,
  
  -- Datas
  payment_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled')),
  
  -- Referência bancária
  bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  
  -- Rastreamento
  tracking_codigo VARCHAR(50) REFERENCES accounting_entry_tracking(codigo_rastreamento),
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payroll_payments_payroll ON payroll_payments(payroll_id);
CREATE INDEX idx_payroll_payments_type ON payroll_payments(payment_type);
CREATE INDEX idx_payroll_payments_status ON payroll_payments(status);
CREATE INDEX idx_payroll_payments_tracking ON payroll_payments(tracking_codigo);

-- ============================================================
-- TRIGGER: Atualizar updated_at em payrolls
-- ============================================================
CREATE OR REPLACE FUNCTION update_payrolls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payrolls_updated_at_trigger
  BEFORE UPDATE ON payrolls
  FOR EACH ROW
  EXECUTE FUNCTION update_payrolls_updated_at();

-- ============================================================
-- TRIGGER: Validar integridade de payroll_details
-- ============================================================
CREATE OR REPLACE FUNCTION validate_payroll_details()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que salário líquido = bruto - descontos
  IF ABS(
    (NEW.salary_bruto - NEW.inss_retido - NEW.irrf_retido - NEW.outros_descontos) 
    - NEW.salary_liquido
  ) > 0.01 THEN
    NEW.validation_status = 'invalid';
    NEW.validation_message = 'Cálculo de salário líquido incorreto';
  END IF;
  
  -- Validar INSS
  IF ABS(
    (NEW.salary_bruto * NEW.inss_aliquota / 100) - NEW.inss_retido
  ) > 0.01 THEN
    NEW.validation_status = 'warning';
    NEW.validation_message = COALESCE(
      NEW.validation_message || ' | ',
      ''
    ) || 'INSS pode estar incorreto';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payroll_details_validation_trigger
  BEFORE INSERT OR UPDATE ON payroll_details
  FOR EACH ROW
  EXECUTE FUNCTION validate_payroll_details();

-- ============================================================
-- TRIGGERS: Atualizar totais em payrolls quando detalhe muda
-- ============================================================
CREATE OR REPLACE FUNCTION update_payroll_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE payrolls
  SET
    total_bruto = COALESCE(
      (SELECT SUM(salary_bruto) FROM payroll_details WHERE payroll_id = COALESCE(NEW.payroll_id, OLD.payroll_id)),
      0
    ),
    total_inss = COALESCE(
      (SELECT SUM(inss_retido) FROM payroll_details WHERE payroll_id = COALESCE(NEW.payroll_id, OLD.payroll_id)),
      0
    ),
    total_irrf = COALESCE(
      (SELECT SUM(irrf_retido) FROM payroll_details WHERE payroll_id = COALESCE(NEW.payroll_id, OLD.payroll_id)),
      0
    ),
    total_liquido = COALESCE(
      (SELECT SUM(salary_liquido) FROM payroll_details WHERE payroll_id = COALESCE(NEW.payroll_id, OLD.payroll_id)),
      0
    )
  WHERE id = COALESCE(NEW.payroll_id, OLD.payroll_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payroll_details_total_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_details
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_totals();

-- ============================================================
-- VIEW: Resumo de Folhas por Mês
-- ============================================================
CREATE OR REPLACE VIEW v_payroll_summary AS
SELECT
  year,
  month,
  COUNT(*) as total_folhas,
  SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as rascunhos,
  SUM(CASE WHEN status = 'provisioned' THEN 1 ELSE 0 END) as provisionadas,
  SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as pagas,
  SUM(total_bruto) as total_bruto_mes,
  SUM(total_inss) as total_inss_mes,
  SUM(total_irrf) as total_irrf_mes,
  SUM(total_liquido) as total_liquido_mes
FROM payrolls
WHERE deleted_at IS NULL
GROUP BY year, month
ORDER BY year DESC, month DESC;

-- ============================================================
-- VIEW: Rastreamento de Lançamentos
-- ============================================================
CREATE OR REPLACE VIEW v_tracking_summary AS
SELECT
  tipo,
  competencia_ano,
  competencia_mes,
  COUNT(*) as total_lancamentos,
  COUNT(*) FILTER (WHERE foi_duplicado = TRUE) as duplicados,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as ativos
FROM accounting_entry_tracking
GROUP BY tipo, competencia_ano, competencia_mes
ORDER BY competencia_ano DESC, competencia_mes DESC, tipo;
