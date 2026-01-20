-- =====================================================
-- SISTEMA CONTÁBIL COMPLETO
-- Conformidade com Normas Brasileiras de Contabilidade
-- =====================================================

-- =====================================================
-- 1. PLANO DE CONTAS
-- Estrutura hierárquica de contas contábeis
-- =====================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE, -- Ex: 1.1.01.001
  name VARCHAR(200) NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- 'ATIVO', 'PASSIVO', 'RECEITA', 'DESPESA', 'PATRIMONIO_LIQUIDO'
  nature VARCHAR(10) NOT NULL, -- 'DEVEDORA' ou 'CREDORA'
  parent_id UUID REFERENCES chart_of_accounts(id),
  level INTEGER NOT NULL, -- Nível hierárquico (1, 2, 3, 4...)
  is_analytical BOOLEAN DEFAULT false, -- Conta analítica (recebe lançamentos) ou sintética
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chart_accounts_code ON chart_of_accounts(code);
CREATE INDEX idx_chart_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX idx_chart_accounts_parent ON chart_of_accounts(parent_id);

-- =====================================================
-- 2. LANÇAMENTOS CONTÁBEIS
-- Sistema de partidas dobradas
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number SERIAL, -- Número sequencial do lançamento
  entry_date DATE NOT NULL, -- Data do lançamento
  competence_date DATE NOT NULL, -- Data de competência (importante para regime de competência)
  description TEXT NOT NULL,
  history TEXT, -- Histórico detalhado
  entry_type VARCHAR(50) NOT NULL, -- 'PROVISAO_RECEITA', 'BAIXA_RECEITA', 'DESPESA', 'PAGAMENTO', 'MANUAL'
  document_type VARCHAR(50), -- 'BOLETO', 'PIX', 'TED', 'DINHEIRO', 'MANUAL'
  document_number VARCHAR(100),
  invoice_id UUID REFERENCES invoices(id), -- Referência ao honorário
  transaction_id UUID REFERENCES bank_transactions(id), -- Referência à transação bancária
  total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_draft BOOLEAN DEFAULT false, -- Rascunho ou definitivo
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT check_balanced CHECK (total_debit = total_credit)
);

CREATE INDEX idx_accounting_entries_date ON accounting_entries(entry_date);
CREATE INDEX idx_accounting_entries_competence ON accounting_entries(competence_date);
CREATE INDEX idx_accounting_entries_invoice ON accounting_entries(invoice_id);
CREATE INDEX idx_accounting_entries_transaction ON accounting_entries(transaction_id);
CREATE INDEX idx_accounting_entries_number ON accounting_entries(entry_number);

-- =====================================================
-- 3. ITENS DOS LANÇAMENTOS (PARTIDAS)
-- Cada lançamento tem múltiplas partidas (débito e crédito)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  history TEXT, -- Histórico específico desta partida
  client_id UUID REFERENCES clients(id), -- Para rastreabilidade por cliente
  cost_center VARCHAR(100), -- Centro de custo (opcional)
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT check_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE INDEX idx_entry_items_entry ON accounting_entry_items(entry_id);
CREATE INDEX idx_entry_items_account ON accounting_entry_items(account_id);
CREATE INDEX idx_entry_items_client ON accounting_entry_items(client_id);

-- =====================================================
-- 4. RELATÓRIOS DE BOLETOS IMPORTADOS
-- Armazena relatórios de boletos para processamento
-- =====================================================
CREATE TABLE IF NOT EXISTS boleto_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50), -- 'CSV', 'XLSX', 'PDF', 'TXT'
  upload_date TIMESTAMPTZ DEFAULT now(),
  period_start DATE,
  period_end DATE,
  total_boletos INTEGER DEFAULT 0,
  total_emitidos DECIMAL(15,2) DEFAULT 0,
  total_pagos DECIMAL(15,2) DEFAULT 0,
  total_pendentes DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'ERROR'
  processing_log JSONB, -- Log do processamento
  entries_created INTEGER DEFAULT 0, -- Quantidade de lançamentos criados
  uploaded_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_boleto_reports_status ON boleto_reports(status);
CREATE INDEX idx_boleto_reports_period ON boleto_reports(period_start, period_end);

-- =====================================================
-- 5. ITENS DO RELATÓRIO DE BOLETOS
-- Detalhamento de cada boleto no relatório
-- =====================================================
CREATE TABLE IF NOT EXISTS boleto_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES boleto_reports(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  client_name VARCHAR(255),
  invoice_id UUID REFERENCES invoices(id), -- Link com o honorário existente
  boleto_number VARCHAR(100),
  emission_date DATE,
  due_date DATE,
  payment_date DATE,
  competence VARCHAR(20), -- Ex: "01/2025"
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(50), -- 'EMITIDO', 'PAGO', 'VENCIDO', 'CANCELADO'
  payment_method VARCHAR(50), -- 'BOLETO', 'PIX', 'TED', 'DINHEIRO'
  accounting_entry_id UUID REFERENCES accounting_entries(id), -- Lançamento gerado
  is_provisioned BOOLEAN DEFAULT false, -- Se já foi feita a provisão
  is_settled BOOLEAN DEFAULT false, -- Se já foi feita a baixa
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_boleto_items_report ON boleto_report_items(report_id);
CREATE INDEX idx_boleto_items_client ON boleto_report_items(client_id);
CREATE INDEX idx_boleto_items_invoice ON boleto_report_items(invoice_id);
CREATE INDEX idx_boleto_items_status ON boleto_report_items(status);

-- =====================================================
-- 6. HISTÓRICO DE CONCILIAÇÃO BANCÁRIA
-- Rastreamento de conciliações automáticas
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
  invoice_id UUID REFERENCES invoices(id),
  boleto_item_id UUID REFERENCES boleto_report_items(id),
  accounting_entry_id UUID REFERENCES accounting_entries(id),
  reconciliation_date TIMESTAMPTZ DEFAULT now(),
  reconciliation_method VARCHAR(50), -- 'AUTO_EXACT', 'AUTO_FUZZY', 'MANUAL'
  confidence_score DECIMAL(5,2), -- Score de confiança (0-100)
  match_criteria JSONB, -- Critérios usados para o match
  notes TEXT,
  reconciled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reconciliation_transaction ON bank_reconciliation(transaction_id);
CREATE INDEX idx_reconciliation_invoice ON bank_reconciliation(invoice_id);
CREATE INDEX idx_reconciliation_entry ON bank_reconciliation(accounting_entry_id);

-- =====================================================
-- 7. SALDOS CONTÁBEIS (PARA PERFORMANCE)
-- Cache de saldos por conta e período
-- =====================================================
CREATE TABLE IF NOT EXISTS account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  opening_balance DECIMAL(15,2) DEFAULT 0, -- Saldo inicial
  total_debit DECIMAL(15,2) DEFAULT 0,
  total_credit DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2) DEFAULT 0, -- Saldo final
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(account_id, period_year, period_month)
);

CREATE INDEX idx_account_balances_account ON account_balances(account_id);
CREATE INDEX idx_account_balances_period ON account_balances(period_year, period_month);

-- =====================================================
-- 8. TRIGGERS PARA ATUALIZAR SALDOS
-- =====================================================
CREATE OR REPLACE FUNCTION update_account_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar saldos quando um lançamento é criado ou modificado
  -- Implementação simplificada - pode ser expandida
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balances_on_entry
AFTER INSERT OR UPDATE ON accounting_entry_items
FOR EACH ROW
EXECUTE FUNCTION update_account_balances();

-- =====================================================
-- 9. PLANO DE CONTAS PADRÃO BRASILEIRO
-- Contas essenciais para escritório contábil
-- =====================================================

-- ATIVO (Natureza Devedora)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('1', 'ATIVO', 'ATIVO', 'DEVEDORA', 1, false, 'Ativo Total'),
('1.1', 'ATIVO CIRCULANTE', 'ATIVO', 'DEVEDORA', 2, false, 'Bens e direitos realizáveis no curto prazo'),
('1.1.01', 'DISPONÍVEL', 'ATIVO', 'DEVEDORA', 3, false, 'Recursos financeiros disponíveis'),
('1.1.01.001', 'Caixa', 'ATIVO', 'DEVEDORA', 4, true, 'Dinheiro em espécie'),
('1.1.01.002', 'Bancos Conta Movimento', 'ATIVO', 'DEVEDORA', 4, true, 'Conta corrente bancária'),
('1.1.01.003', 'Aplicações Financeiras', 'ATIVO', 'DEVEDORA', 4, true, 'Investimentos de curto prazo'),
('1.1.02', 'CLIENTES', 'ATIVO', 'DEVEDORA', 3, false, 'Valores a receber de clientes'),
('1.1.02.001', 'Honorários a Receber', 'ATIVO', 'DEVEDORA', 4, true, 'Honorários contábeis a receber'),
('1.1.02.002', 'Boletos a Receber', 'ATIVO', 'DEVEDORA', 4, true, 'Boletos emitidos não pagos'),
('1.1.02.003', 'PIX a Receber', 'ATIVO', 'DEVEDORA', 4, true, 'Valores a receber via PIX'),
('1.1.02.004', '(-) Provisão para Créditos de Liquidação Duvidosa', 'ATIVO', 'CREDORA', 4, true, 'PCLD');

-- PASSIVO (Natureza Credora)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('2', 'PASSIVO', 'PASSIVO', 'CREDORA', 1, false, 'Passivo Total'),
('2.1', 'PASSIVO CIRCULANTE', 'PASSIVO', 'CREDORA', 2, false, 'Obrigações de curto prazo'),
('2.1.01', 'FORNECEDORES', 'PASSIVO', 'CREDORA', 3, false, 'Valores a pagar a fornecedores'),
('2.1.01.001', 'Fornecedores Nacionais', 'PASSIVO', 'CREDORA', 4, true, 'Fornecedores do Brasil'),
('2.1.02', 'OBRIGAÇÕES TRIBUTÁRIAS', 'PASSIVO', 'CREDORA', 3, false, 'Tributos a recolher'),
('2.1.02.001', 'IRPJ a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'Imposto de Renda Pessoa Jurídica'),
('2.1.02.002', 'CSLL a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'Contribuição Social sobre Lucro Líquido'),
('2.1.02.003', 'PIS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'PIS a Recolher'),
('2.1.02.004', 'COFINS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'COFINS a Recolher'),
('2.1.02.005', 'ISS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'Imposto Sobre Serviços');

-- PATRIMÔNIO LÍQUIDO (Natureza Credora)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('2.2', 'PATRIMÔNIO LÍQUIDO', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, 'Recursos próprios'),
('2.2.01', 'CAPITAL SOCIAL', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, 'Capital subscrito'),
('2.2.01.001', 'Capital Social Integralizado', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, 'Capital efetivamente integralizado'),
('2.2.02', 'RESERVAS', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, 'Reservas de lucros'),
('2.2.02.001', 'Reservas de Lucros', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, 'Lucros retidos'),
('2.2.03', 'LUCROS ACUMULADOS', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, 'Resultado do período'),
('2.2.03.001', 'Lucros/Prejuízos Acumulados', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, 'Resultado acumulado');

-- RECEITAS (Natureza Credora)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('3', 'RECEITAS', 'RECEITA', 'CREDORA', 1, false, 'Receitas Operacionais'),
('3.1', 'RECEITA BRUTA', 'RECEITA', 'CREDORA', 2, false, 'Receita de serviços prestados'),
('3.1.01', 'RECEITA DE SERVIÇOS', 'RECEITA', 'CREDORA', 3, false, 'Prestação de serviços contábeis'),
('3.1.01.001', 'Honorários Contábeis', 'RECEITA', 'CREDORA', 4, true, 'Receita de honorários contábeis'),
('3.1.01.002', 'Serviços de Consultoria', 'RECEITA', 'CREDORA', 4, true, 'Receita de consultoria'),
('3.1.01.003', 'Serviços Extraordinários', 'RECEITA', 'CREDORA', 4, true, 'Serviços fora do contrato'),
('3.2', 'DEDUÇÕES DA RECEITA', 'RECEITA', 'DEVEDORA', 2, false, 'Impostos e deduções'),
('3.2.01', 'IMPOSTOS SOBRE SERVIÇOS', 'RECEITA', 'DEVEDORA', 3, false, 'Tributos sobre receita'),
('3.2.01.001', 'ISS', 'RECEITA', 'DEVEDORA', 4, true, 'Imposto Sobre Serviços'),
('3.2.01.002', 'PIS', 'RECEITA', 'DEVEDORA', 4, true, 'PIS sobre faturamento'),
('3.2.01.003', 'COFINS', 'RECEITA', 'DEVEDORA', 4, true, 'COFINS sobre faturamento');

-- DESPESAS (Natureza Devedora)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('4', 'DESPESAS', 'DESPESA', 'DEVEDORA', 1, false, 'Despesas Operacionais'),
('4.1', 'DESPESAS ADMINISTRATIVAS', 'DESPESA', 'DEVEDORA', 2, false, 'Despesas administrativas'),
('4.1.01', 'PESSOAL', 'DESPESA', 'DEVEDORA', 3, false, 'Despesas com pessoal'),
('4.1.01.001', 'Salários', 'DESPESA', 'DEVEDORA', 4, true, 'Salários de funcionários'),
('4.1.01.002', 'Encargos Sociais', 'DESPESA', 'DEVEDORA', 4, true, 'INSS, FGTS, etc'),
('4.1.01.003', 'Férias', 'DESPESA', 'DEVEDORA', 4, true, 'Férias de funcionários'),
('4.1.01.004', '13º Salário', 'DESPESA', 'DEVEDORA', 4, true, 'Décimo terceiro salário'),
('4.1.02', 'OCUPAÇÃO', 'DESPESA', 'DEVEDORA', 3, false, 'Despesas com ocupação'),
('4.1.02.001', 'Aluguel', 'DESPESA', 'DEVEDORA', 4, true, 'Aluguel do escritório'),
('4.1.02.002', 'Energia Elétrica', 'DESPESA', 'DEVEDORA', 4, true, 'Conta de luz'),
('4.1.02.003', 'Água', 'DESPESA', 'DEVEDORA', 4, true, 'Conta de água'),
('4.1.02.004', 'Telefone/Internet', 'DESPESA', 'DEVEDORA', 4, true, 'Telecomunicações'),
('4.1.03', 'GERAIS', 'DESPESA', 'DEVEDORA', 3, false, 'Despesas gerais'),
('4.1.03.001', 'Material de Escritório', 'DESPESA', 'DEVEDORA', 4, true, 'Papelaria e materiais'),
('4.1.03.002', 'Softwares e Licenças', 'DESPESA', 'DEVEDORA', 4, true, 'Sistemas e licenças'),
('4.1.03.003', 'Manutenção e Conservação', 'DESPESA', 'DEVEDORA', 4, true, 'Manutenção do escritório');

-- =====================================================
-- 10. VIEWS PARA RELATÓRIOS CONTÁBEIS
-- =====================================================

-- VIEW: Livro Diário
CREATE OR REPLACE VIEW vw_livro_diario AS
SELECT
  ae.entry_number as numero_lancamento,
  ae.entry_date as data_lancamento,
  ae.competence_date as data_competencia,
  ae.description as descricao,
  ae.entry_type as tipo_lancamento,
  ae.document_number as numero_documento,
  aei.account_id,
  coa.code as codigo_conta,
  coa.name as nome_conta,
  aei.debit as debito,
  aei.credit as credito,
  aei.history as historico,
  c.name as cliente_nome,
  ae.created_at
FROM accounting_entries ae
INNER JOIN accounting_entry_items aei ON ae.id = aei.entry_id
INNER JOIN chart_of_accounts coa ON aei.account_id = coa.id
LEFT JOIN clients c ON aei.client_id = c.id
WHERE ae.is_draft = false
ORDER BY ae.entry_number, ae.entry_date, coa.code;

-- VIEW: Livro Razão
CREATE OR REPLACE VIEW vw_livro_razao AS
SELECT
  coa.id as account_id,
  coa.code as codigo_conta,
  coa.name as nome_conta,
  coa.nature as natureza,
  ae.entry_date as data_lancamento,
  ae.entry_number as numero_lancamento,
  ae.description as descricao,
  aei.debit as debito,
  aei.credit as credito,
  aei.history as historico,
  c.name as cliente_nome
FROM chart_of_accounts coa
LEFT JOIN accounting_entry_items aei ON coa.id = aei.account_id
LEFT JOIN accounting_entries ae ON aei.entry_id = ae.id AND ae.is_draft = false
LEFT JOIN clients c ON aei.client_id = c.id
WHERE coa.is_analytical = true
ORDER BY coa.code, ae.entry_date, ae.entry_number;

-- VIEW: Balancete de Verificação
CREATE OR REPLACE VIEW vw_balancete AS
SELECT
  coa.code as codigo_conta,
  coa.name as nome_conta,
  coa.account_type as tipo_conta,
  coa.nature as natureza,
  COALESCE(SUM(aei.debit), 0) as total_debito,
  COALESCE(SUM(aei.credit), 0) as total_credito,
  CASE
    WHEN coa.nature = 'DEVEDORA' THEN COALESCE(SUM(aei.debit), 0) - COALESCE(SUM(aei.credit), 0)
    ELSE COALESCE(SUM(aei.credit), 0) - COALESCE(SUM(aei.debit), 0)
  END as saldo
FROM chart_of_accounts coa
LEFT JOIN accounting_entry_items aei ON coa.id = aei.account_id
LEFT JOIN accounting_entries ae ON aei.entry_id = ae.id AND ae.is_draft = false
WHERE coa.is_analytical = true
GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.nature
ORDER BY coa.code;

-- =====================================================
-- 11. RLS (Row Level Security)
-- =====================================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE boleto_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE boleto_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir acesso autenticado)
CREATE POLICY "Usuários autenticados podem ver plano de contas"
  ON chart_of_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver lançamentos"
  ON accounting_entries FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver itens de lançamentos"
  ON accounting_entry_items FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver relatórios de boletos"
  ON boleto_reports FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver itens de boletos"
  ON boleto_report_items FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver conciliações"
  ON bank_reconciliation FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver saldos"
  ON account_balances FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 12. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================
COMMENT ON TABLE chart_of_accounts IS 'Plano de contas contábil estruturado hierarquicamente';
COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis (cabeçalho) - Sistema de partidas dobradas';
COMMENT ON TABLE accounting_entry_items IS 'Itens dos lançamentos contábeis (débito e crédito)';
COMMENT ON TABLE boleto_reports IS 'Relatórios de boletos importados para processamento automático';
COMMENT ON TABLE boleto_report_items IS 'Detalhamento de cada boleto no relatório importado';
COMMENT ON TABLE bank_reconciliation IS 'Histórico de conciliações bancárias automáticas e manuais';
COMMENT ON TABLE account_balances IS 'Cache de saldos contábeis por conta e período para performance';

COMMENT ON COLUMN accounting_entries.competence_date IS 'Data de competência - crucial para regime de competência';
COMMENT ON COLUMN accounting_entries.entry_type IS 'PROVISAO_RECEITA: quando emitido boleto | BAIXA_RECEITA: quando recebido';
COMMENT ON CONSTRAINT check_balanced ON accounting_entries IS 'Garante que débito = crédito (partidas dobradas)';
