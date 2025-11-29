-- =====================================================
-- SISTEMA DE AUTOMAÇÃO INTELIGENTE COM IA
-- Despesas recorrentes, Boletos, Contratos e Distratos
-- =====================================================

-- =====================================================
-- 1. TEMPLATES DE DOCUMENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('contract', 'distract', 'addendum', 'receipt', 'letter')),
  content TEXT NOT NULL, -- Template com placeholders {{variavel}}
  variables JSONB DEFAULT '[]', -- Lista de variáveis esperadas
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- 2. CONTRATOS DE CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS client_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES document_templates(id),
  contract_number TEXT UNIQUE,
  type TEXT NOT NULL DEFAULT 'service' CHECK (type IN ('service', 'consulting', 'partnership', 'other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'suspended', 'terminated', 'expired')),

  -- Dados do contrato
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = prazo indeterminado
  monthly_fee DECIMAL(10,2),
  payment_day INTEGER CHECK (payment_day BETWEEN 1 AND 31),

  -- Conteúdo gerado pela IA
  content TEXT, -- Conteúdo final do contrato
  ai_generated BOOLEAN DEFAULT false,
  ai_generation_date TIMESTAMPTZ,

  -- Arquivo no Storage
  storage_path TEXT,
  signed_storage_path TEXT,

  -- Metadados
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_client_contracts_client ON client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_status ON client_contracts(status);

-- =====================================================
-- 3. DISTRATOS
-- =====================================================
CREATE TABLE IF NOT EXISTS client_distracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES client_contracts(id),
  template_id UUID REFERENCES document_templates(id),
  distract_number TEXT UNIQUE,

  -- Motivo do distrato
  reason TEXT NOT NULL CHECK (reason IN ('client_request', 'company_suspended', 'company_inactive', 'non_payment', 'mutual_agreement', 'other')),
  reason_details TEXT,

  -- Datas
  termination_date DATE NOT NULL,
  notification_date DATE,

  -- Valores pendentes
  pending_amount DECIMAL(10,2) DEFAULT 0,
  settlement_amount DECIMAL(10,2) DEFAULT 0,
  settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'partial', 'settled', 'waived')),

  -- Conteúdo gerado pela IA
  content TEXT,
  ai_generated BOOLEAN DEFAULT false,
  ai_generation_date TIMESTAMPTZ,

  -- Arquivo no Storage
  storage_path TEXT,
  signed_storage_path TEXT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'signed', 'archived')),

  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_client_distracts_client ON client_distracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_distracts_contract ON client_distracts(contract_id);

-- =====================================================
-- 4. DESPESAS RECORRENTES (melhorado)
-- =====================================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_document TEXT,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,

  -- Recorrência
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual')),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = sem fim

  -- Parcelamento
  is_installment BOOLEAN DEFAULT false,
  total_installments INTEGER,
  current_installment INTEGER DEFAULT 1,
  installment_amount DECIMAL(10,2),

  -- Controle
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE,
  next_due_date DATE,

  -- IA
  ai_detected BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2),
  ai_pattern_id TEXT,

  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due ON recurring_expenses(next_due_date) WHERE is_active = true;

-- =====================================================
-- 5. REGRAS DE GERAÇÃO DE BOLETOS
-- =====================================================
CREATE TABLE IF NOT EXISTS invoice_generation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Regras
  generation_day INTEGER DEFAULT 1 CHECK (generation_day BETWEEN 1 AND 28), -- Dia do mês para gerar
  due_day INTEGER DEFAULT 10 CHECK (due_day BETWEEN 1 AND 31),

  -- Valores
  base_amount DECIMAL(10,2),
  additional_services JSONB DEFAULT '[]', -- Serviços adicionais

  -- Validações IA
  respect_opening_date BOOLEAN DEFAULT true, -- Não gerar antes da abertura
  validate_company_status BOOLEAN DEFAULT true, -- Verificar se empresa está ativa

  -- Controle
  is_active BOOLEAN DEFAULT true,
  last_generated_competence TEXT, -- YYYY-MM

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(client_id)
);

-- =====================================================
-- 6. LOG DE AUTOMAÇÕES DA IA
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type TEXT NOT NULL CHECK (automation_type IN (
    'recurring_expense', 'invoice_generation', 'contract_generation',
    'distract_generation', 'installment_creation', 'status_check'
  )),
  entity_type TEXT, -- 'expense', 'invoice', 'contract', 'distract'
  entity_id UUID,
  client_id UUID REFERENCES clients(id),

  -- Resultado
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'pending_review')),
  message TEXT,
  details JSONB DEFAULT '{}',

  -- IA
  ai_model TEXT,
  ai_tokens_used INTEGER,
  ai_response_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ai_automation_logs_type ON ai_automation_logs(automation_type);
CREATE INDEX IF NOT EXISTS idx_ai_automation_logs_status ON ai_automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_ai_automation_logs_date ON ai_automation_logs(created_at DESC);

-- =====================================================
-- 7. CONFIGURAÇÕES DO ESCRITÓRIO
-- =====================================================
CREATE TABLE IF NOT EXISTS office_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Inserir configurações padrão
INSERT INTO office_settings (key, value, description) VALUES
  ('company_info', '{
    "name": "Escritório Ampla Contabilidade",
    "cnpj": "",
    "address": "",
    "city": "",
    "state": "",
    "zip": "",
    "phone": "",
    "email": ""
  }', 'Dados do escritório para contratos'),
  ('contract_defaults', '{
    "payment_day": 10,
    "contract_duration": "indeterminate",
    "termination_notice_days": 30
  }', 'Configurações padrão de contratos'),
  ('automation_settings', '{
    "auto_generate_invoices": true,
    "auto_generate_contracts": true,
    "auto_generate_distracts": true,
    "auto_detect_recurring": true,
    "invoice_generation_day": 1,
    "check_company_status": true
  }', 'Configurações de automação')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 8. TRIGGERS PARA AUTOMAÇÃO
-- =====================================================

-- Trigger: Gerar contrato quando cliente é criado
CREATE OR REPLACE FUNCTION trigger_generate_contract_on_client()
RETURNS TRIGGER AS $$
DECLARE
  v_template_id UUID;
  v_contract_number TEXT;
BEGIN
  -- Só gera para clientes pagantes (não pro-bono, não permuta)
  IF NEW.is_pro_bono = true OR NEW.is_barter = true THEN
    RETURN NEW;
  END IF;

  -- Buscar template padrão de contrato
  SELECT id INTO v_template_id
  FROM document_templates
  WHERE type = 'contract' AND is_default = true AND is_active = true
  LIMIT 1;

  -- Gerar número do contrato
  v_contract_number := 'CTR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('contract_number_seq')::TEXT, 5, '0');

  -- Criar registro do contrato (conteúdo será gerado pela IA)
  INSERT INTO client_contracts (
    client_id,
    template_id,
    contract_number,
    type,
    status,
    start_date,
    end_date,
    monthly_fee,
    payment_day,
    created_by
  ) VALUES (
    NEW.id,
    v_template_id,
    v_contract_number,
    'service',
    'draft', -- IA vai processar e mudar para 'active'
    COALESCE(NEW.data_abertura, CURRENT_DATE),
    NULL, -- Prazo indeterminado
    NEW.monthly_fee,
    NEW.payment_day,
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar sequência para número de contrato
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS distract_number_seq START 1;

-- Trigger: Gerar distrato quando empresa é suspensa/inativa
CREATE OR REPLACE FUNCTION trigger_generate_distract_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_distract_number TEXT;
  v_reason TEXT;
BEGIN
  -- Verificar se mudou para suspensa ou inativa
  IF NEW.situacao_cadastral IN ('SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA')
     AND (OLD.situacao_cadastral IS NULL OR OLD.situacao_cadastral NOT IN ('SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA')) THEN

    -- Buscar contrato ativo
    SELECT id INTO v_contract_id
    FROM client_contracts
    WHERE client_id = NEW.id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_contract_id IS NOT NULL THEN
      -- Determinar motivo
      v_reason := CASE
        WHEN NEW.situacao_cadastral = 'SUSPENSA' THEN 'company_suspended'
        ELSE 'company_inactive'
      END;

      -- Gerar número do distrato
      v_distract_number := 'DST-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('distract_number_seq')::TEXT, 5, '0');

      -- Criar distrato
      INSERT INTO client_distracts (
        client_id,
        contract_id,
        distract_number,
        reason,
        reason_details,
        termination_date,
        notification_date,
        status
      ) VALUES (
        NEW.id,
        v_contract_id,
        v_distract_number,
        v_reason,
        'Empresa com situação cadastral: ' || NEW.situacao_cadastral,
        CURRENT_DATE,
        CURRENT_DATE,
        'draft' -- IA vai processar
      );

      -- Atualizar contrato para terminated
      UPDATE client_contracts
      SET status = 'terminated', updated_at = NOW()
      WHERE id = v_contract_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers (com verificação)
DO $$
BEGIN
  -- Trigger para gerar contrato
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_contract_on_client'
  ) THEN
    CREATE TRIGGER trg_generate_contract_on_client
      AFTER INSERT ON clients
      FOR EACH ROW
      EXECUTE FUNCTION trigger_generate_contract_on_client();
  END IF;

  -- Trigger para gerar distrato
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_distract_on_status'
  ) THEN
    CREATE TRIGGER trg_generate_distract_on_status
      AFTER UPDATE ON clients
      FOR EACH ROW
      EXECUTE FUNCTION trigger_generate_distract_on_status_change();
  END IF;
END $$;

-- =====================================================
-- 9. INSERIR TEMPLATE PADRÃO DE CONTRATO
-- =====================================================
INSERT INTO document_templates (name, type, content, variables, is_default) VALUES
(
  'Contrato Padrão de Prestação de Serviços Contábeis',
  'contract',
  E'CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS

CONTRATO Nº {{contract_number}}

Pelo presente instrumento particular, de um lado:

CONTRATADA:
{{office_name}}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº {{office_cnpj}}, com sede em {{office_address}}, {{office_city}}/{{office_state}}, CEP {{office_zip}}, neste ato representada por seu responsável legal, doravante denominada CONTRATADA.

CONTRATANTE:
{{client_name}}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº {{client_cnpj}}, com sede em {{client_address}}, {{client_city}}/{{client_state}}, CEP {{client_zip}}, neste ato representada por seu responsável legal, doravante denominada CONTRATANTE.

As partes acima qualificadas têm entre si justo e acertado o presente Contrato de Prestação de Serviços Contábeis, que se regerá pelas cláusulas e condições seguintes:

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços contábeis pela CONTRATADA à CONTRATANTE, compreendendo:
a) Escrituração contábil e fiscal;
b) Elaboração e envio de declarações e obrigações acessórias;
c) Folha de pagamento e encargos trabalhistas;
d) Assessoria contábil e fiscal;
e) Demais serviços inerentes à atividade contábil.

CLÁUSULA SEGUNDA - DO PRAZO
O presente contrato vigorará a partir de {{start_date}}, por prazo {{contract_duration}}, podendo ser rescindido por qualquer das partes mediante aviso prévio de {{termination_notice_days}} dias.

CLÁUSULA TERCEIRA - DO VALOR E FORMA DE PAGAMENTO
Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor mensal de R$ {{monthly_fee}} ({{monthly_fee_text}}), com vencimento todo dia {{payment_day}} de cada mês.

CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATADA
São obrigações da CONTRATADA:
a) Executar os serviços contratados com zelo, diligência e boa técnica;
b) Manter sigilo sobre as informações da CONTRATANTE;
c) Cumprir os prazos legais para entrega de declarações e obrigações;
d) Orientar a CONTRATANTE sobre procedimentos fiscais e contábeis.

CLÁUSULA QUINTA - DAS OBRIGAÇÕES DA CONTRATANTE
São obrigações da CONTRATANTE:
a) Fornecer todos os documentos necessários à execução dos serviços;
b) Efetuar o pagamento dos honorários nas datas acordadas;
c) Informar tempestivamente sobre alterações em suas atividades;
d) Não praticar atos que possam dificultar a execução dos serviços.

CLÁUSULA SEXTA - DA RESCISÃO
O presente contrato poderá ser rescindido:
a) Por acordo mútuo das partes;
b) Por inadimplemento de qualquer das partes;
c) Por justa causa;
d) Por denúncia imotivada, com aviso prévio de {{termination_notice_days}} dias.

CLÁUSULA SÉTIMA - DO FORO
Fica eleito o foro da comarca de {{office_city}}/{{office_state}} para dirimir quaisquer dúvidas oriundas do presente contrato.

E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma.

{{office_city}}, {{signature_date}}.

_______________________________
{{office_name}}
CONTRATADA

_______________________________
{{client_name}}
CONTRATANTE',
  '["contract_number", "office_name", "office_cnpj", "office_address", "office_city", "office_state", "office_zip", "client_name", "client_cnpj", "client_address", "client_city", "client_state", "client_zip", "start_date", "contract_duration", "termination_notice_days", "monthly_fee", "monthly_fee_text", "payment_day", "signature_date"]',
  true
),
(
  'Distrato Padrão de Contrato de Serviços',
  'distract',
  E'DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS

DISTRATO Nº {{distract_number}}
Referente ao Contrato nº {{contract_number}}

Pelo presente instrumento particular de DISTRATO, de um lado:

CONTRATADA:
{{office_name}}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº {{office_cnpj}}, com sede em {{office_address}}, {{office_city}}/{{office_state}}.

CONTRATANTE:
{{client_name}}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº {{client_cnpj}}, com sede em {{client_address}}, {{client_city}}/{{client_state}}.

As partes acima qualificadas resolvem, de comum acordo, DISTRATAR o Contrato de Prestação de Serviços Contábeis firmado entre as partes, mediante as seguintes cláusulas:

CLÁUSULA PRIMEIRA - DO MOTIVO
O presente distrato decorre de: {{reason_text}}

{{reason_details}}

CLÁUSULA SEGUNDA - DA DATA DE ENCERRAMENTO
As partes concordam que o contrato será considerado encerrado a partir de {{termination_date}}.

CLÁUSULA TERCEIRA - DAS PENDÊNCIAS
{{#if pending_amount > 0}}
A CONTRATANTE reconhece possuir débito no valor de R$ {{pending_amount}} ({{pending_amount_text}}), relativo aos honorários devidos até a data do encerramento.
{{else}}
Não há pendências financeiras entre as partes.
{{/if}}

CLÁUSULA QUARTA - DA QUITAÇÃO
Com a assinatura do presente distrato e a regularização de eventuais pendências, as partes dão-se mútua e geral quitação para nada mais reclamar uma da outra, a qualquer título, em relação ao contrato ora distratado.

CLÁUSULA QUINTA - DA DOCUMENTAÇÃO
A CONTRATADA compromete-se a entregar toda a documentação contábil e fiscal da CONTRATANTE no prazo de 30 (trinta) dias a contar da assinatura deste instrumento.

E por estarem assim acordadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma.

{{office_city}}, {{signature_date}}.

_______________________________
{{office_name}}
CONTRATADA

_______________________________
{{client_name}}
CONTRATANTE',
  '["distract_number", "contract_number", "office_name", "office_cnpj", "office_address", "office_city", "office_state", "client_name", "client_cnpj", "client_address", "client_city", "client_state", "reason_text", "reason_details", "termination_date", "pending_amount", "pending_amount_text", "signature_date"]',
  true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. RLS POLICIES
-- =====================================================
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_distracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_generation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_settings ENABLE ROW LEVEL SECURITY;

-- Policies permissivas (para autenticados)
CREATE POLICY "Allow all for authenticated" ON document_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON client_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON client_distracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON recurring_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON invoice_generation_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON ai_automation_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON office_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role acesso total
CREATE POLICY "Service role full access" ON document_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON client_contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON client_distracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON recurring_expenses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON invoice_generation_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_automation_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON office_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 11. FUNÇÃO PARA VALIDAR DATA DE ABERTURA x COMPETÊNCIA
-- =====================================================
CREATE OR REPLACE FUNCTION validate_invoice_competence(
  p_client_id UUID,
  p_competence TEXT -- formato YYYY-MM
) RETURNS JSONB AS $$
DECLARE
  v_client RECORD;
  v_opening_date DATE;
  v_competence_date DATE;
  v_result JSONB;
BEGIN
  -- Buscar cliente
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;

  IF v_client IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Cliente não encontrado');
  END IF;

  -- Data de abertura
  v_opening_date := v_client.data_abertura;

  IF v_opening_date IS NULL THEN
    -- Se não tem data de abertura, permitir
    RETURN jsonb_build_object('valid', true, 'reason', 'Data de abertura não informada');
  END IF;

  -- Converter competência para data (primeiro dia do mês)
  v_competence_date := (p_competence || '-01')::DATE;

  -- Verificar se competência é anterior à abertura
  IF v_competence_date < DATE_TRUNC('month', v_opening_date) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Competência anterior à data de abertura da empresa',
      'opening_date', v_opening_date,
      'first_valid_competence', TO_CHAR(DATE_TRUNC('month', v_opening_date), 'YYYY-MM')
    );
  END IF;

  -- Verificar situação cadastral
  IF v_client.situacao_cadastral IN ('SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA') THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Empresa com situação cadastral irregular: ' || v_client.situacao_cadastral
    );
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 12. ADICIONAR CAMPOS NA TABELA CLIENTS SE NÃO EXISTIR
-- =====================================================
DO $$
BEGIN
  -- Data de abertura
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'data_abertura') THEN
    ALTER TABLE clients ADD COLUMN data_abertura DATE;
  END IF;

  -- Situação cadastral
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'situacao_cadastral') THEN
    ALTER TABLE clients ADD COLUMN situacao_cadastral TEXT;
  END IF;
END $$;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
