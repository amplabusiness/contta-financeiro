-- =====================================================
-- SISTEMA PROFISSIONAL DE CONTRATOS CONTÁBEIS
-- Conforme Resolução CFC 1.590/2020
-- =====================================================

-- =====================================================
-- 1. PROPOSTAS DE SERVIÇOS (Pré-contrato obrigatório)
-- NBC PG 01 - Código de Ética exige proposta escrita
-- =====================================================

CREATE TABLE IF NOT EXISTS service_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  proposal_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Dados do cliente (para prospects não cadastrados)
  prospect_name TEXT,
  prospect_cnpj TEXT,
  prospect_email TEXT,
  prospect_phone TEXT,
  prospect_address TEXT,
  prospect_city TEXT,
  prospect_state TEXT,

  -- Tipo de proposta
  proposal_type TEXT NOT NULL DEFAULT 'accounting'
    CHECK (proposal_type IN ('accounting', 'payroll', 'tax', 'consulting', 'opening', 'full_package')),

  -- Serviços propostos (detalhamento obrigatório)
  services JSONB NOT NULL DEFAULT '[]',
  -- Formato: [{"service": "Escrituração Contábil", "description": "...", "frequency": "mensal", "value": 500.00}]

  -- Valores
  monthly_fee DECIMAL(12,2),
  setup_fee DECIMAL(12,2) DEFAULT 0,
  total_annual DECIMAL(12,2),

  -- Condições comerciais
  payment_day INTEGER CHECK (payment_day BETWEEN 1 AND 31),
  payment_method TEXT DEFAULT 'boleto',
  adjustment_index TEXT DEFAULT 'IGPM',
  discount_percentage DECIMAL(5,2) DEFAULT 0,

  -- Validade da proposta
  valid_until DATE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'negotiating', 'accepted', 'rejected', 'expired', 'converted')),

  -- Histórico
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Conversão para contrato
  converted_contract_id UUID,

  -- Observações
  notes TEXT,
  internal_notes TEXT,

  -- Controle
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_service_proposals_client ON service_proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_service_proposals_status ON service_proposals(status);
CREATE INDEX IF NOT EXISTS idx_service_proposals_number ON service_proposals(proposal_number);

-- =====================================================
-- 2. CONTRATOS DE PRESTAÇÃO DE SERVIÇOS (Principal)
-- Resolução CFC 1.590/2020
-- =====================================================

-- Verificar se a tabela contracts existe e tem a estrutura correta
DO $$
BEGIN
  -- Se a tabela não existir, criar
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'accounting_contracts') THEN
    CREATE TABLE accounting_contracts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Identificação
      contract_number TEXT UNIQUE NOT NULL,
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      proposal_id UUID REFERENCES service_proposals(id),

      -- Tipo de contrato
      contract_type TEXT NOT NULL DEFAULT 'service'
        CHECK (contract_type IN ('service', 'consulting', 'partnership', 'opening', 'irpf', 'special')),

      -- Datas
      start_date DATE NOT NULL,
      end_date DATE, -- NULL = prazo indeterminado
      signature_date DATE,

      -- Valores e pagamento
      monthly_fee DECIMAL(12,2) NOT NULL,
      setup_fee DECIMAL(12,2) DEFAULT 0,
      payment_day INTEGER DEFAULT 10 CHECK (payment_day BETWEEN 1 AND 31),
      payment_method TEXT DEFAULT 'boleto',
      adjustment_index TEXT DEFAULT 'IGPM',
      last_adjustment_date DATE,

      -- Serviços contratados (obrigatório: detalhamento)
      services JSONB NOT NULL DEFAULT '[]',

      -- Serviços do contratante (obrigatório: o que o cliente deve fazer)
      client_obligations JSONB DEFAULT '[]',

      -- Cláusulas especiais
      special_clauses TEXT,

      -- COAF - Lei 9.613/98 (obrigatório)
      coaf_clause_accepted BOOLEAN DEFAULT true,
      coaf_acceptance_date DATE,

      -- Carta de Responsabilidade (ITG 1000)
      requires_responsibility_letter BOOLEAN DEFAULT true,
      last_responsibility_letter_date DATE,

      -- Conteúdo do contrato
      content TEXT, -- Contrato completo gerado
      ai_generated BOOLEAN DEFAULT false,

      -- Arquivos
      document_url TEXT,
      signed_document_url TEXT,

      -- Assinatura digital
      signature_provider TEXT, -- clicksign, docusign, d4sign, etc
      signature_request_id TEXT,
      signature_status TEXT DEFAULT 'pending'
        CHECK (signature_status IN ('pending', 'sent', 'viewed', 'signed', 'refused', 'expired')),

      -- Status do contrato
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_signature', 'active', 'suspended', 'terminated', 'expired', 'cancelled')),

      -- Motivo de suspensão/cancelamento
      suspension_reason TEXT,
      termination_reason TEXT,
      termination_date DATE,

      -- Controle
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_accounting_contracts_client ON accounting_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_accounting_contracts_status ON accounting_contracts(status);
CREATE INDEX IF NOT EXISTS idx_accounting_contracts_number ON accounting_contracts(contract_number);

-- =====================================================
-- 3. ADITIVOS CONTRATUAIS
-- Para alterações de contrato
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_addendums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  addendum_number TEXT UNIQUE NOT NULL,
  contract_id UUID NOT NULL REFERENCES accounting_contracts(id) ON DELETE CASCADE,

  -- Tipo de aditivo
  addendum_type TEXT NOT NULL
    CHECK (addendum_type IN (
      'value_change',      -- Alteração de valor
      'service_add',       -- Adição de serviços
      'service_remove',    -- Remoção de serviços
      'term_extension',    -- Prorrogação
      'term_reduction',    -- Redução de prazo
      'general_change',    -- Alteração geral
      'correction'         -- Correção/retificação
    )),

  -- Dados anteriores (para histórico)
  previous_monthly_fee DECIMAL(12,2),
  previous_services JSONB,
  previous_end_date DATE,

  -- Novos dados
  new_monthly_fee DECIMAL(12,2),
  new_services JSONB,
  new_end_date DATE,

  -- Descrição da alteração
  change_description TEXT NOT NULL,
  justification TEXT,

  -- Data de vigência
  effective_date DATE NOT NULL,

  -- Conteúdo do aditivo
  content TEXT,

  -- Arquivos
  document_url TEXT,
  signed_document_url TEXT,

  -- Assinatura
  signature_status TEXT DEFAULT 'pending'
    CHECK (signature_status IN ('pending', 'sent', 'signed', 'refused')),
  signed_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_signature', 'active', 'cancelled')),

  -- Controle
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_contract_addendums_contract ON contract_addendums(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_addendums_status ON contract_addendums(status);

-- =====================================================
-- 4. DISTRATOS (Rescisão - Obrigatório CFC 1.590/2020)
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  termination_number TEXT UNIQUE NOT NULL,
  contract_id UUID NOT NULL REFERENCES accounting_contracts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Motivo da rescisão
  termination_type TEXT NOT NULL
    CHECK (termination_type IN (
      'mutual_agreement',      -- Acordo mútuo
      'client_request',        -- Solicitação do cliente
      'accountant_request',    -- Solicitação do contador
      'non_payment',           -- Inadimplência
      'company_closed',        -- Empresa encerrada
      'company_suspended',     -- Empresa suspensa
      'contract_breach',       -- Descumprimento contratual
      'force_majeure',         -- Força maior
      'other'                  -- Outro motivo
    )),

  termination_reason TEXT NOT NULL,
  detailed_justification TEXT,

  -- Datas
  request_date DATE NOT NULL,
  notice_date DATE, -- Data da notificação
  effective_date DATE NOT NULL, -- Data efetiva do término
  notice_period_days INTEGER DEFAULT 30,

  -- Situação financeira
  pending_fees DECIMAL(12,2) DEFAULT 0,
  pending_months INTEGER DEFAULT 0,
  fine_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_settlement DECIMAL(12,2) DEFAULT 0,

  -- Pagamento do acerto
  settlement_status TEXT DEFAULT 'pending'
    CHECK (settlement_status IN ('pending', 'partial', 'paid', 'waived', 'negotiating')),
  settlement_date DATE,
  settlement_notes TEXT,

  -- Documentos a devolver
  documents_returned BOOLEAN DEFAULT false,
  documents_return_date DATE,
  documents_return_protocol TEXT,
  documents_list JSONB DEFAULT '[]', -- Lista de documentos devolvidos

  -- Obrigações pendentes
  pending_obligations JSONB DEFAULT '[]',
  -- Formato: [{"obligation": "DCTF Dezembro", "deadline": "2024-01-15", "status": "pending"}]

  -- Cessação de responsabilidades
  responsibilities_end_date DATE,
  responsibilities_description TEXT,

  -- Conteúdo do distrato
  content TEXT,

  -- Arquivos
  document_url TEXT,
  signed_document_url TEXT,
  notification_url TEXT, -- Notificação enviada ao cliente

  -- Assinatura
  signature_status TEXT DEFAULT 'pending'
    CHECK (signature_status IN ('pending', 'sent', 'signed', 'refused', 'notified_only')),
  signed_at TIMESTAMPTZ,

  -- Se cliente se recusar a assinar, usar notificação
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  notification_method TEXT, -- email, carta_ar, cartorio
  notification_proof_url TEXT,

  -- Status
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_signature', 'signed', 'notified', 'completed', 'cancelled')),

  -- Controle
  notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_contract_terminations_contract ON contract_terminations(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_terminations_client ON contract_terminations(client_id);
CREATE INDEX IF NOT EXISTS idx_contract_terminations_status ON contract_terminations(status);

-- =====================================================
-- 5. CARTA DE RESPONSABILIDADE DA ADMINISTRAÇÃO
-- ITG 1000 - Obrigatória anualmente
-- =====================================================

CREATE TABLE IF NOT EXISTS responsibility_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  letter_number TEXT UNIQUE NOT NULL,
  contract_id UUID REFERENCES accounting_contracts(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Período de referência
  reference_year INTEGER NOT NULL,
  reference_start_date DATE NOT NULL,
  reference_end_date DATE NOT NULL,

  -- Responsável pela administração (sócio/administrador)
  administrator_name TEXT NOT NULL,
  administrator_cpf TEXT NOT NULL,
  administrator_role TEXT, -- Sócio-Administrador, Diretor, etc

  -- Declarações do administrador
  declarations JSONB NOT NULL DEFAULT '[
    {"code": "D1", "text": "Reconheço minha responsabilidade pela elaboração das demonstrações contábeis"},
    {"code": "D2", "text": "Confirmo que todas as transações foram devidamente registradas"},
    {"code": "D3", "text": "Declaro que não tenho conhecimento de fraudes envolvendo a administração"},
    {"code": "D4", "text": "Confirmo a integridade e completude das informações fornecidas"},
    {"code": "D5", "text": "Declaro ciência das responsabilidades legais e tributárias"}
  ]',

  -- Declarações específicas (opcionais)
  specific_declarations JSONB DEFAULT '[]',

  -- Conteúdo da carta
  content TEXT,

  -- Arquivos
  document_url TEXT,
  signed_document_url TEXT,

  -- Assinatura
  signature_status TEXT DEFAULT 'pending'
    CHECK (signature_status IN ('pending', 'sent', 'signed', 'refused')),
  signed_at TIMESTAMPTZ,

  -- Se recusado
  refusal_date DATE,
  refusal_reason TEXT,
  safeguards_adopted TEXT, -- Salvaguardas adotadas pelo contador

  -- Status
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'refused', 'archived')),

  -- Lembrete automático
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,

  -- Controle
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_responsibility_letters_client ON responsibility_letters(client_id);
CREATE INDEX IF NOT EXISTS idx_responsibility_letters_contract ON responsibility_letters(contract_id);
CREATE INDEX IF NOT EXISTS idx_responsibility_letters_year ON responsibility_letters(reference_year);
CREATE INDEX IF NOT EXISTS idx_responsibility_letters_status ON responsibility_letters(status);

-- =====================================================
-- 6. TEMPLATES DE DOCUMENTOS
-- =====================================================

-- Inserir templates padrão se não existirem
INSERT INTO document_templates (name, type, content, variables, is_active, is_default)
SELECT
  'Contrato de Prestação de Serviços Contábeis - Padrão CFC',
  'contract',
  '{{contract_content}}',
  '["contract_number", "client_name", "client_cnpj", "client_address", "office_name", "office_cnpj", "office_crc", "services", "monthly_fee", "payment_day", "start_date", "signature_date"]'::jsonb,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates WHERE type = 'contract' AND is_default = true
);

INSERT INTO document_templates (name, type, content, variables, is_active, is_default)
SELECT
  'Distrato de Prestação de Serviços Contábeis',
  'distract',
  '{{distract_content}}',
  '["termination_number", "contract_number", "client_name", "client_cnpj", "termination_reason", "effective_date", "pending_fees", "documents_list"]'::jsonb,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates WHERE type = 'distract' AND is_default = true
);

INSERT INTO document_templates (name, type, content, variables, is_active, is_default)
SELECT
  'Carta de Responsabilidade da Administração - ITG 1000',
  'letter',
  '{{letter_content}}',
  '["letter_number", "client_name", "client_cnpj", "reference_year", "administrator_name", "administrator_cpf", "declarations"]'::jsonb,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates WHERE type = 'letter' AND is_default = true
);

INSERT INTO document_templates (name, type, content, variables, is_active, is_default)
SELECT
  'Proposta de Prestação de Serviços Contábeis',
  'receipt',
  '{{proposal_content}}',
  '["proposal_number", "client_name", "services", "monthly_fee", "valid_until"]'::jsonb,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates WHERE name LIKE '%Proposta%'
);

-- =====================================================
-- 7. SEQUÊNCIAS PARA NUMERAÇÃO
-- =====================================================

-- Função para gerar número de proposta
CREATE OR REPLACE FUNCTION generate_proposal_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(proposal_number FROM 'PROP-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM service_proposals
  WHERE proposal_number LIKE 'PROP-' || year_part || '-%';

  new_number := 'PROP-' || year_part || '-' || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar número de contrato
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_number FROM 'CTR-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM accounting_contracts
  WHERE contract_number LIKE 'CTR-' || year_part || '-%';

  new_number := 'CTR-' || year_part || '-' || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar número de distrato
CREATE OR REPLACE FUNCTION generate_termination_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(termination_number FROM 'DST-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM contract_terminations
  WHERE termination_number LIKE 'DST-' || year_part || '-%';

  new_number := 'DST-' || year_part || '-' || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar número de carta de responsabilidade
CREATE OR REPLACE FUNCTION generate_letter_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(letter_number FROM 'CRA-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM responsibility_letters
  WHERE letter_number LIKE 'CRA-' || year_part || '-%';

  new_number := 'CRA-' || year_part || '-' || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar número de aditivo
CREATE OR REPLACE FUNCTION generate_addendum_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(addendum_number FROM 'ADT-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM contract_addendums
  WHERE addendum_number LIKE 'ADT-' || year_part || '-%';

  new_number := 'ADT-' || year_part || '-' || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGERS PARA NUMERAÇÃO AUTOMÁTICA
-- =====================================================

-- Trigger para proposta
CREATE OR REPLACE FUNCTION set_proposal_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proposal_number IS NULL THEN
    NEW.proposal_number := generate_proposal_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_proposal_number ON service_proposals;
CREATE TRIGGER trigger_set_proposal_number
  BEFORE INSERT ON service_proposals
  FOR EACH ROW
  EXECUTE FUNCTION set_proposal_number();

-- Trigger para contrato
CREATE OR REPLACE FUNCTION set_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_number IS NULL THEN
    NEW.contract_number := generate_contract_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_contract_number ON accounting_contracts;
CREATE TRIGGER trigger_set_contract_number
  BEFORE INSERT ON accounting_contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_contract_number();

-- Trigger para distrato
CREATE OR REPLACE FUNCTION set_termination_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.termination_number IS NULL THEN
    NEW.termination_number := generate_termination_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_termination_number ON contract_terminations;
CREATE TRIGGER trigger_set_termination_number
  BEFORE INSERT ON contract_terminations
  FOR EACH ROW
  EXECUTE FUNCTION set_termination_number();

-- Trigger para carta de responsabilidade
CREATE OR REPLACE FUNCTION set_letter_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.letter_number IS NULL THEN
    NEW.letter_number := generate_letter_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_letter_number ON responsibility_letters;
CREATE TRIGGER trigger_set_letter_number
  BEFORE INSERT ON responsibility_letters
  FOR EACH ROW
  EXECUTE FUNCTION set_letter_number();

-- Trigger para aditivo
CREATE OR REPLACE FUNCTION set_addendum_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.addendum_number IS NULL THEN
    NEW.addendum_number := generate_addendum_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_addendum_number ON contract_addendums;
CREATE TRIGGER trigger_set_addendum_number
  BEFORE INSERT ON contract_addendums
  FOR EACH ROW
  EXECUTE FUNCTION set_addendum_number();

-- =====================================================
-- 9. VIEW DE CONTRATOS COM INFORMAÇÕES COMPLETAS
-- =====================================================

CREATE OR REPLACE VIEW v_contracts_complete AS
SELECT
  c.id,
  c.contract_number,
  c.contract_type,
  c.status,
  c.start_date,
  c.end_date,
  c.monthly_fee,
  c.payment_day,
  c.signature_status,
  c.created_at,

  -- Cliente
  cl.id AS client_id,
  cl.name AS client_name,
  cl.cnpj AS client_cnpj,
  cl.email AS client_email,
  cl.phone AS client_phone,

  -- Proposta origem
  p.proposal_number,
  p.status AS proposal_status,

  -- Último aditivo
  (SELECT addendum_number FROM contract_addendums
   WHERE contract_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_addendum,

  -- Carta de responsabilidade
  (SELECT status FROM responsibility_letters
   WHERE contract_id = c.id AND reference_year = EXTRACT(YEAR FROM CURRENT_DATE)
   ORDER BY created_at DESC LIMIT 1) AS current_year_letter_status,

  -- Distrato (se houver)
  (SELECT termination_number FROM contract_terminations
   WHERE contract_id = c.id AND status != 'cancelled' LIMIT 1) AS termination_number

FROM accounting_contracts c
LEFT JOIN clients cl ON c.client_id = cl.id
LEFT JOIN service_proposals p ON c.proposal_id = p.id;

-- =====================================================
-- 10. VIEW DE CARTAS PENDENTES DO ANO
-- =====================================================

CREATE OR REPLACE VIEW v_pending_responsibility_letters AS
SELECT
  c.id AS contract_id,
  c.contract_number,
  cl.id AS client_id,
  cl.name AS client_name,
  cl.cnpj AS client_cnpj,
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS reference_year,
  COALESCE(rl.status, 'not_created') AS letter_status,
  rl.id AS letter_id
FROM accounting_contracts c
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN responsibility_letters rl ON
  rl.contract_id = c.id AND
  rl.reference_year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE c.status = 'active'
  AND c.requires_responsibility_letter = true
  AND (rl.id IS NULL OR rl.status NOT IN ('signed', 'archived'));

-- =====================================================
-- 11. RLS POLICIES
-- =====================================================

-- Habilitar RLS
ALTER TABLE service_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_addendums ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_terminations ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsibility_letters ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados
CREATE POLICY "Users can view all proposals" ON service_proposals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert proposals" ON service_proposals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update proposals" ON service_proposals
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view all contracts" ON accounting_contracts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert contracts" ON accounting_contracts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update contracts" ON accounting_contracts
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view all addendums" ON contract_addendums
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert addendums" ON contract_addendums
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update addendums" ON contract_addendums
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view all terminations" ON contract_terminations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert terminations" ON contract_terminations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update terminations" ON contract_terminations
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view all letters" ON responsibility_letters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert letters" ON responsibility_letters
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update letters" ON responsibility_letters
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- 12. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE service_proposals IS 'Propostas de serviços contábeis - NBC PG 01 exige proposta escrita antes do contrato';
COMMENT ON TABLE accounting_contracts IS 'Contratos de prestação de serviços contábeis - Resolução CFC 1.590/2020';
COMMENT ON TABLE contract_addendums IS 'Aditivos contratuais para alterações nos contratos';
COMMENT ON TABLE contract_terminations IS 'Distratos - Resolução CFC 1.590/2020 exige rescisão formal';
COMMENT ON TABLE responsibility_letters IS 'Carta de Responsabilidade da Administração - ITG 1000 exige anualmente';
