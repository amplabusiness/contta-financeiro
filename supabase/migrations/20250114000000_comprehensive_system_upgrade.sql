-- ==========================================
-- COMPREHENSIVE SYSTEM UPGRADE
-- Sistema de Honorários Contábeis - Super Ferramenta
-- ==========================================

-- ==========================================
-- 1. BANKING INTEGRATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS banking_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL, -- 'cora', 'pluggy', 'bb', 'itau'
  integration_type TEXT NOT NULL, -- 'api', 'open_finance'
  client_id TEXT,
  client_secret_encrypted TEXT, -- Encrypted
  access_token_encrypted TEXT, -- Encrypted
  refresh_token_encrypted TEXT, -- Encrypted
  expires_at TIMESTAMP WITH TIME ZONE,
  certificate_path TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- Additional configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_banking_credentials_bank ON banking_credentials(bank_name);
CREATE INDEX idx_banking_credentials_active ON banking_credentials(is_active);

-- ==========================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  account_type TEXT, -- 'checking', 'savings'
  agency TEXT,
  balance NUMERIC(15, 2) DEFAULT 0,
  pluggy_item_id TEXT, -- Para Open Finance
  pluggy_account_id TEXT,
  cora_account_id TEXT, -- Para Banco Cora
  is_active BOOLEAN DEFAULT true,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_client ON bank_accounts(client_id);
CREATE INDEX idx_bank_accounts_sync ON bank_accounts(sync_enabled, is_active);

COMMENT ON TABLE bank_accounts IS 'Contas bancárias conectadas via API ou Open Finance';

-- ==========================================

-- Extend invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS boleto_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS boleto_barcode TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS boleto_digitable_line TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pix_qrcode TEXT; -- Base64 image
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT; -- PIX copia e cola
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pix_txid TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_charge_id TEXT; -- ID no banco (Cora, Asaas)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT; -- 'boleto', 'pix', 'card', 'transfer'
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_external_charge ON invoices(external_charge_id);

-- ==========================================
-- 2. NOTIFICATIONS SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'invoice_created', 'invoice_due', 'invoice_overdue', 'invoice_paid'
  channel TEXT NOT NULL, -- 'email', 'whatsapp', 'sms'
  subject TEXT, -- Para email
  body TEXT NOT NULL, -- Template com variáveis: {client_name}, {amount}, {due_date}
  variables JSONB DEFAULT '[]', -- Lista de variáveis disponíveis
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_templates_type ON message_templates(type);
CREATE INDEX idx_message_templates_channel ON message_templates(channel);

COMMENT ON TABLE message_templates IS 'Templates de mensagens para notificações multi-canal';

-- ==========================================

CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL, -- Email, phone, etc
  subject TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'delivered'
  error_message TEXT,
  external_id TEXT, -- ID do provedor (SendGrid message ID, etc)
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_client ON notifications_log(client_id);
CREATE INDEX idx_notifications_invoice ON notifications_log(invoice_id);
CREATE INDEX idx_notifications_status ON notifications_log(status);
CREATE INDEX idx_notifications_created ON notifications_log(created_at DESC);

COMMENT ON TABLE notifications_log IS 'Log de todas as notificações enviadas';

-- ==========================================

CREATE TABLE IF NOT EXISTS collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_days INTEGER NOT NULL, -- -3 (3 dias antes), 0 (dia vencimento), 3 (3 dias depois)
  action TEXT NOT NULL, -- 'send_email', 'send_whatsapp', 'send_sms'
  channel TEXT NOT NULL,
  template_id UUID REFERENCES message_templates(id),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}', -- Condições adicionais
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_collection_rules_active ON collection_rules(is_active);

COMMENT ON TABLE collection_rules IS 'Régua de cobrança automática';

-- ==========================================
-- 3. DOCUMENTS & OCR
-- ==========================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'nota_fiscal', 'recibo', 'contrato', 'boleto', 'comprovante', 'other'
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage path
  file_size BIGINT,
  file_type TEXT, -- MIME type
  ocr_processed BOOLEAN DEFAULT false,
  ocr_data JSONB, -- Dados extraídos via OCR
  ocr_confidence NUMERIC(3, 2), -- 0-1
  version INTEGER DEFAULT 1,
  signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_id TEXT, -- ClickSign/DocuSign ID
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_client ON documents(client_id);
CREATE INDEX idx_documents_invoice ON documents(invoice_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_ocr ON documents(ocr_processed);

COMMENT ON TABLE documents IS 'Gerenciamento de documentos com OCR';

-- ==========================================
-- 4. WORKFLOWS & AUTOMATION
-- ==========================================

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'invoice_created', 'invoice_overdue', 'client_created', 'scheduled'
  trigger_config JSONB DEFAULT '{}', -- Configuração do trigger (cron, conditions, etc)
  actions JSONB NOT NULL DEFAULT '[]', -- Array de ações [{type: 'send_email', config: {...}}]
  conditions JSONB DEFAULT '{}', -- Condições para execução
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflows_trigger ON workflows(trigger_type);
CREATE INDEX idx_workflows_active ON workflows(is_active);

COMMENT ON TABLE workflows IS 'Workflows de automação configuráveis';

-- ==========================================

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_data JSONB, -- Dados que acionaram o workflow
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  steps_completed INTEGER DEFAULT 0,
  steps_total INTEGER DEFAULT 0,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  logs JSONB DEFAULT '[]' -- Array de logs de execução
);

CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started ON workflow_executions(started_at DESC);

COMMENT ON TABLE workflow_executions IS 'Histórico de execuções de workflows';

-- ==========================================
-- 5. AI AGENTS EXTENDED
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'financial_analyst', 'expense_classifier', 'chatbot', 'churn_predictor', 'pricing_optimizer', 'fraud_detector'
  description TEXT,
  model TEXT DEFAULT 'gemini-2.5-flash', -- AI model
  prompt_template TEXT NOT NULL,
  configuration JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_agents_type ON ai_agents(type);
CREATE INDEX idx_ai_agents_active ON ai_agents(is_active);

COMMENT ON TABLE ai_agents IS 'Configuração de agentes de IA';

-- ==========================================

CREATE TABLE IF NOT EXISTS ai_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  input_data JSONB,
  output_data JSONB,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  execution_time_ms INTEGER,
  tokens_used INTEGER,
  cost NUMERIC(10, 4),
  error_message TEXT,
  executed_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_executions_agent ON ai_executions(agent_id);
CREATE INDEX idx_ai_executions_client ON ai_executions(client_id);
CREATE INDEX idx_ai_executions_status ON ai_executions(status);
CREATE INDEX idx_ai_executions_executed ON ai_executions(executed_at DESC);

COMMENT ON TABLE ai_executions IS 'Histórico de execuções de agentes IA';

-- ==========================================
-- 6. CASH FLOW PROJECTION
-- ==========================================

CREATE TABLE IF NOT EXISTS cash_flow_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_date DATE NOT NULL,
  projected_inflow NUMERIC(15, 2) DEFAULT 0, -- Entradas previstas
  projected_outflow NUMERIC(15, 2) DEFAULT 0, -- Saídas previstas
  projected_balance NUMERIC(15, 2) DEFAULT 0, -- Saldo projetado
  actual_inflow NUMERIC(15, 2), -- Real quando a data passar
  actual_outflow NUMERIC(15, 2),
  actual_balance NUMERIC(15, 2),
  confidence_score NUMERIC(3, 2), -- 0-1 (confiança da projeção)
  scenario TEXT DEFAULT 'realistic', -- 'optimistic', 'realistic', 'pessimistic'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cash_flow_date ON cash_flow_projections(projection_date);
CREATE INDEX idx_cash_flow_scenario ON cash_flow_projections(scenario);

COMMENT ON TABLE cash_flow_projections IS 'Projeção de fluxo de caixa com IA';

-- ==========================================
-- 7. MULTI-TENANT & RBAC
-- ==========================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  subscription_plan TEXT DEFAULT 'basic', -- 'basic', 'pro', 'enterprise'
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organizations_active ON organizations(is_active);

COMMENT ON TABLE organizations IS 'Escritórios contábeis (multi-tenant)';

-- ==========================================

CREATE TABLE IF NOT EXISTS organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_users_org ON organization_users(organization_id);
CREATE INDEX idx_org_users_user ON organization_users(user_id);

-- ==========================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]', -- Array de permissões
  is_system BOOLEAN DEFAULT false, -- System roles não podem ser deletados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
('admin', 'Administrador completo', '["*"]', true),
('contador', 'Contador com acesso completo aos dados', '["clients.*", "invoices.*", "expenses.*", "reports.*", "ai.*"]', true),
('assistente', 'Assistente com acesso limitado', '["clients.read", "invoices.read", "expenses.read"]', true),
('financeiro', 'Responsável financeiro', '["invoices.*", "expenses.*", "bank_transactions.*", "reports.*"]', true),
('cliente', 'Cliente com acesso ao portal', '["portal.*"]', true)
ON CONFLICT (name) DO NOTHING;

-- ==========================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'read'
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Log de auditoria de todas as ações';

-- ==========================================
-- 8. ANALYTICS & REPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- 'kpi', 'chart', 'table', 'list'
  widget_config JSONB NOT NULL, -- Configuração do widget
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1,
  height INTEGER DEFAULT 1,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dashboard_widgets_user ON dashboard_widgets(user_id);

COMMENT ON TABLE dashboard_widgets IS 'Widgets customizáveis do dashboard';

-- ==========================================

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  metric_type TEXT NOT NULL, -- 'mrr', 'churn', 'ltv', 'cac', 'active_clients'
  metric_value NUMERIC(15, 2),
  metric_data JSONB, -- Dados detalhados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_metrics_date ON metrics_snapshots(snapshot_date DESC);
CREATE INDEX idx_metrics_type ON metrics_snapshots(metric_type);

COMMENT ON TABLE metrics_snapshots IS 'Snapshots diários de métricas para analytics';

-- ==========================================
-- 9. TAX COMPLIANCE (Calendário Fiscal)
-- ==========================================

CREATE TABLE IF NOT EXISTS tax_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  obligation_type TEXT NOT NULL, -- 'DCTF', 'EFD', 'SPED', 'DEFIS', 'DIRF'
  tax_regime TEXT, -- 'simples', 'lucro_real', 'lucro_presumido'
  due_date DATE NOT NULL,
  competence TEXT, -- MM/YYYY
  status TEXT DEFAULT 'pending', -- 'pending', 'filed', 'late'
  filed_at TIMESTAMP WITH TIME ZONE,
  protocol TEXT,
  responsible_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tax_obligations_client ON tax_obligations(client_id);
CREATE INDEX idx_tax_obligations_due ON tax_obligations(due_date);
CREATE INDEX idx_tax_obligations_status ON tax_obligations(status);

COMMENT ON TABLE tax_obligations IS 'Calendário de obrigações fiscais';

-- ==========================================
-- 10. CONTRACTS & PROPOSALS
-- ==========================================

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  proposed_fee NUMERIC(15, 2),
  payment_terms TEXT,
  services JSONB DEFAULT '[]', -- Array de serviços propostos
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'accepted', 'rejected'
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_proposals_client ON proposals(client_id);
CREATE INDEX idx_proposals_status ON proposals(status);

COMMENT ON TABLE proposals IS 'Propostas comerciais';

-- ==========================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES proposals(id),
  contract_number TEXT UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE,
  auto_renew BOOLEAN DEFAULT false,
  monthly_fee NUMERIC(15, 2) NOT NULL,
  services JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active', -- 'active', 'suspended', 'cancelled', 'expired'
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_id TEXT, -- ClickSign/DocuSign
  document_id UUID REFERENCES documents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_status ON contracts(status);

COMMENT ON TABLE contracts IS 'Contratos com clientes';

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE banking_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (usuarios autenticados podem ver/editar seus dados)
CREATE POLICY "Users can view their own data" ON banking_credentials FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can view their bank accounts" ON bank_accounts FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can view templates" ON message_templates FOR SELECT USING (true);
CREATE POLICY "Users can view notifications" ON notifications_log FOR SELECT USING (true);
CREATE POLICY "Users can view rules" ON collection_rules FOR SELECT USING (true);
CREATE POLICY "Users can view documents" ON documents FOR SELECT USING (auth.uid() = uploaded_by);
CREATE POLICY "Users can insert documents" ON documents FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can view workflows" ON workflows FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can view executions" ON workflow_executions FOR SELECT USING (true);
CREATE POLICY "Users can view agents" ON ai_agents FOR SELECT USING (true);
CREATE POLICY "Users can view AI executions" ON ai_executions FOR SELECT USING (true);
CREATE POLICY "Users can view cash flow" ON cash_flow_projections FOR SELECT USING (true);
CREATE POLICY "Users can view widgets" ON dashboard_widgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert widgets" ON dashboard_widgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update widgets" ON dashboard_widgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view metrics" ON metrics_snapshots FOR SELECT USING (true);
CREATE POLICY "Users can view tax obligations" ON tax_obligations FOR SELECT USING (true);
CREATE POLICY "Users can view proposals" ON proposals FOR SELECT USING (true);
CREATE POLICY "Users can view contracts" ON contracts FOR SELECT USING (true);

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_banking_credentials_updated_at BEFORE UPDATE ON banking_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collection_rules_updated_at BEFORE UPDATE ON collection_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cash_flow_projections_updated_at BEFORE UPDATE ON cash_flow_projections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_obligations_updated_at BEFORE UPDATE ON tax_obligations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Default message templates
INSERT INTO message_templates (name, type, channel, subject, body, variables) VALUES
('Fatura Criada - Email', 'invoice_created', 'email', 'Nova fatura disponível',
 'Olá {client_name},\n\nSua fatura de {competence} no valor de R$ {amount} está disponível.\n\nVencimento: {due_date}\n\nAcesse o portal para visualizar: {payment_link}',
 '["client_name", "amount", "due_date", "competence", "payment_link"]'),

('Fatura Vencendo - WhatsApp', 'invoice_due', 'whatsapp',  NULL,
 'Olá {client_name}! Sua fatura de R$ {amount} vence hoje ({due_date}). Pague pelo PIX: {pix_copy_paste}',
 '["client_name", "amount", "due_date", "pix_copy_paste"]'),

('Fatura Atrasada - Email', 'invoice_overdue', 'email', 'Fatura em atraso',
 'Olá {client_name},\n\nIdentificamos que sua fatura de {competence} no valor de R$ {amount} está em atraso desde {due_date}.\n\nPor favor, regularize o quanto antes.\n\nBoleto: {boleto_url}\nPIX: {pix_copy_paste}',
 '["client_name", "amount", "due_date", "competence", "boleto_url", "pix_copy_paste"]')
ON CONFLICT DO NOTHING;

-- Default AI Agents
INSERT INTO ai_agents (name, type, description, prompt_template, configuration) VALUES
('Analista Financeiro', 'financial_analyst', 'Análise completa da saúde financeira',
 'Você é um CFO virtual expert. Analise os dados financeiros e retorne insights acionáveis.',
 '{"model": "gemini-2.5-flash", "temperature": 0.7}'),

('Classificador de Despesas', 'expense_classifier', 'Classificação automática de despesas no plano de contas',
 'Classifique a despesa no plano de contas correto baseado na descrição.',
 '{"model": "gemini-2.5-flash", "temperature": 0.3}'),

('Chatbot de Atendimento', 'chatbot', 'Assistente virtual para dúvidas de clientes',
 'Você é um assistente de escritório contábil. Responda dúvidas sobre faturas, pagamentos e serviços.',
 '{"model": "gemini-2.5-flash", "temperature": 0.5}'),

('Preditor de Churn', 'churn_predictor', 'Prevê clientes em risco de cancelamento',
 'Analise o histórico do cliente e preveja o risco de cancelamento (0-100).',
 '{"model": "gemini-2.5-flash", "temperature": 0.4}'),

('Otimizador de Preços', 'pricing_optimizer', 'Sugere honorário ideal para cada cliente',
 'Baseado na complexidade e mercado, sugira o honorário ideal para este cliente.',
 '{"model": "gemini-2.5-flash", "temperature": 0.6}'),

('Detector de Fraude', 'fraud_detector', 'Detecta transações e padrões suspeitos',
 'Analise a transação e identifique sinais de fraude ou comportamento anômalo.',
 '{"model": "gemini-2.5-flash", "temperature": 0.2}')
ON CONFLICT DO NOTHING;

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON COLUMN invoices.boleto_url IS 'URL do boleto gerado pelo banco';
COMMENT ON COLUMN invoices.pix_qrcode IS 'QR Code PIX em base64';
COMMENT ON COLUMN invoices.pix_copy_paste IS 'Código PIX copia e cola';
COMMENT ON COLUMN invoices.external_charge_id IS 'ID da cobrança no banco (Cora, Asaas, etc)';
COMMENT ON COLUMN invoices.payment_method IS 'Método de pagamento utilizado';

-- ==========================================
-- FINAL MESSAGE
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '✅ COMPREHENSIVE SYSTEM UPGRADE COMPLETED!';
  RAISE NOTICE '📊 Created 20+ new tables';
  RAISE NOTICE '🔐 RLS policies applied';
  RAISE NOTICE '🤖 AI Agents configured';
  RAISE NOTICE '📧 Message templates ready';
  RAISE NOTICE '🚀 System ready for super features!';
END $$;
