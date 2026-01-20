-- =====================================================
-- SISTEMA DE NEGOCIAÇÃO DE DÍVIDAS
-- =====================================================
-- 1. Contatos do cliente (telefones, WhatsApp, etc)
-- 2. Planos de negociação
-- 3. Parcelas do acordo
-- 4. Histórico de tentativas de contato
-- 5. Confissão de dívida (contrato)
-- =====================================================

-- 1. TABELA DE CONTATOS DO CLIENTE
-- =====================================================
CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('phone', 'mobile', 'whatsapp', 'email', 'telegram', 'other')),
  contact_value TEXT NOT NULL,
  contact_name TEXT, -- Nome do contato (ex: "Financeiro", "Sócio João")
  is_primary BOOLEAN DEFAULT false,
  is_whatsapp BOOLEAN DEFAULT false, -- Se o número tem WhatsApp
  is_valid BOOLEAN DEFAULT true, -- Se o contato ainda é válido
  notes TEXT,
  last_contact_at TIMESTAMPTZ, -- Último contato realizado
  last_contact_result TEXT, -- Resultado do último contato
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE client_contacts IS 'Contatos do cliente para cobrança (telefones, WhatsApp, emails)';

CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_type ON client_contacts(contact_type);

-- 2. TABELA DE NEGOCIAÇÕES
-- =====================================================
CREATE TABLE IF NOT EXISTS debt_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  negotiation_number TEXT UNIQUE, -- Número sequencial da negociação

  -- Valores
  original_debt NUMERIC(12,2) NOT NULL, -- Dívida original total
  interest_amount NUMERIC(12,2) DEFAULT 0, -- Juros calculados
  fine_amount NUMERIC(12,2) DEFAULT 0, -- Multa
  discount_amount NUMERIC(12,2) DEFAULT 0, -- Desconto concedido
  discount_percentage NUMERIC(5,2) DEFAULT 0, -- Percentual de desconto
  final_amount NUMERIC(12,2) NOT NULL, -- Valor final negociado

  -- Forma de pagamento
  payment_type TEXT NOT NULL CHECK (payment_type IN ('single', 'installment')), -- À vista ou parcelado
  installments_count INTEGER DEFAULT 1, -- Número de parcelas
  first_due_date DATE NOT NULL, -- Vencimento da primeira parcela
  installment_amount NUMERIC(12,2), -- Valor de cada parcela

  -- Status e aprovação
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Rascunho
    'pending_approval', -- Aguardando aprovação
    'approved',        -- Aprovado
    'rejected',        -- Rejeitado
    'active',          -- Em andamento
    'completed',       -- Quitado
    'defaulted',       -- Inadimplente
    'cancelled'        -- Cancelado
  )),

  -- Aprovação
  requires_approval BOOLEAN DEFAULT false, -- Se precisa de aprovação (desconto > limite)
  approval_level TEXT, -- 'manager', 'director', 'owner'
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Contrato de confissão de dívida
  contract_generated BOOLEAN DEFAULT false,
  contract_signed BOOLEAN DEFAULT false,
  contract_signed_at TIMESTAMPTZ,
  contract_url TEXT, -- URL do contrato assinado

  -- Referência às faturas originais
  invoice_ids UUID[], -- IDs das faturas incluídas na negociação
  opening_balance_ids UUID[], -- IDs dos saldos de abertura incluídos

  -- Campos de controle
  negotiated_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  internal_notes TEXT, -- Notas internas (não vai no contrato)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE debt_negotiations IS 'Negociações de dívidas com clientes';

CREATE INDEX IF NOT EXISTS idx_debt_negotiations_client ON debt_negotiations(client_id);
CREATE INDEX IF NOT EXISTS idx_debt_negotiations_status ON debt_negotiations(status);
CREATE INDEX IF NOT EXISTS idx_debt_negotiations_number ON debt_negotiations(negotiation_number);

-- 3. SEQUÊNCIA PARA NÚMERO DA NEGOCIAÇÃO
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS negotiation_number_seq START 1;

-- Trigger para gerar número da negociação
CREATE OR REPLACE FUNCTION generate_negotiation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.negotiation_number IS NULL THEN
    NEW.negotiation_number := 'NEG-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('negotiation_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_negotiation_number ON debt_negotiations;
CREATE TRIGGER trg_generate_negotiation_number
  BEFORE INSERT ON debt_negotiations
  FOR EACH ROW
  EXECUTE FUNCTION generate_negotiation_number();

-- 4. TABELA DE PARCELAS DA NEGOCIAÇÃO
-- =====================================================
CREATE TABLE IF NOT EXISTS negotiation_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID NOT NULL REFERENCES debt_negotiations(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  paid_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),

  -- Dados de pagamento
  payment_method TEXT,
  payment_reference TEXT,
  boleto_url TEXT,
  boleto_barcode TEXT,
  pix_qrcode TEXT,
  pix_copy_paste TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (negotiation_id, installment_number)
);

COMMENT ON TABLE negotiation_installments IS 'Parcelas de uma negociação de dívida';

CREATE INDEX IF NOT EXISTS idx_negotiation_installments_negotiation ON negotiation_installments(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_installments_due_date ON negotiation_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_negotiation_installments_status ON negotiation_installments(status);

-- 5. HISTÓRICO DE CONTATOS/TENTATIVAS
-- =====================================================
CREATE TABLE IF NOT EXISTS negotiation_contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  negotiation_id UUID REFERENCES debt_negotiations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,

  contact_type TEXT NOT NULL CHECK (contact_type IN ('phone_call', 'whatsapp', 'email', 'sms', 'visit', 'meeting', 'letter', 'other')),
  contact_direction TEXT NOT NULL DEFAULT 'outbound' CHECK (contact_direction IN ('inbound', 'outbound')),
  contact_result TEXT NOT NULL CHECK (contact_result IN (
    'answered',        -- Atendeu
    'not_answered',    -- Não atendeu
    'busy',            -- Ocupado
    'voicemail',       -- Caixa postal
    'wrong_number',    -- Número errado
    'callback_scheduled', -- Agendou retorno
    'promise_to_pay',  -- Prometeu pagar
    'negotiation_started', -- Iniciou negociação
    'refused',         -- Recusou negociar
    'sent',            -- Enviado (email/whatsapp)
    'delivered',       -- Entregue
    'read',            -- Lido
    'replied',         -- Respondeu
    'other'            -- Outro
  )),

  -- Detalhes
  summary TEXT NOT NULL, -- Resumo do contato
  details TEXT, -- Detalhes completos
  next_action TEXT, -- Próxima ação sugerida
  next_contact_date TIMESTAMPTZ, -- Data do próximo contato

  -- Promessa de pagamento
  promise_date DATE, -- Data prometida para pagamento
  promise_amount NUMERIC(12,2), -- Valor prometido
  promise_fulfilled BOOLEAN,

  -- Controle
  contacted_by UUID NOT NULL REFERENCES auth.users(id),
  contact_duration INTEGER, -- Duração em segundos (para ligações)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE negotiation_contact_history IS 'Histórico de tentativas de contato com o cliente';

CREATE INDEX IF NOT EXISTS idx_contact_history_client ON negotiation_contact_history(client_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_negotiation ON negotiation_contact_history(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_date ON negotiation_contact_history(created_at);

-- 6. CONFIGURAÇÕES DE DESCONTO POR NÍVEL
-- =====================================================
CREATE TABLE IF NOT EXISTS discount_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_discount_percentage NUMERIC(5,2) NOT NULL, -- Desconto mínimo que precisa de aprovação
  max_discount_percentage NUMERIC(5,2) NOT NULL, -- Desconto máximo permitido neste nível
  approval_level TEXT NOT NULL CHECK (approval_level IN ('operator', 'manager', 'director', 'owner')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE discount_approval_rules IS 'Regras de aprovação baseadas em percentual de desconto';

-- Inserir regras padrão
INSERT INTO discount_approval_rules (min_discount_percentage, max_discount_percentage, approval_level, description) VALUES
  (0, 5, 'operator', 'Operador pode dar até 5% de desconto'),
  (5.01, 15, 'manager', 'Gerente pode aprovar de 5% a 15%'),
  (15.01, 30, 'director', 'Diretor pode aprovar de 15% a 30%'),
  (30.01, 100, 'owner', 'Sócio/Proprietário aprova acima de 30%')
ON CONFLICT DO NOTHING;

-- 7. FUNÇÃO PARA CALCULAR DÍVIDA DO CLIENTE
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_client_debt(p_client_id UUID)
RETURNS TABLE (
  total_invoices NUMERIC,
  total_opening_balance NUMERIC,
  total_debt NUMERIC,
  overdue_amount NUMERIC,
  overdue_days INTEGER,
  oldest_due_date DATE,
  pending_invoices INTEGER,
  pending_opening_balance INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH invoice_debt AS (
    SELECT
      COALESCE(SUM(amount), 0) AS total,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN amount ELSE 0 END), 0) AS overdue,
      MIN(CASE WHEN status = 'pending' THEN due_date END) AS oldest_date,
      COUNT(*) AS count
    FROM invoices
    WHERE client_id = p_client_id
      AND status IN ('pending', 'overdue')
  ),
  opening_debt AS (
    SELECT
      COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) AS total,
      COUNT(*) AS count
    FROM client_opening_balance
    WHERE client_id = p_client_id
      AND status IN ('pending', 'partial')
  )
  SELECT
    id.total AS total_invoices,
    od.total AS total_opening_balance,
    (id.total + od.total) AS total_debt,
    id.overdue AS overdue_amount,
    CASE WHEN id.oldest_date IS NOT NULL
      THEN (CURRENT_DATE - id.oldest_date)
      ELSE 0
    END AS overdue_days,
    id.oldest_date AS oldest_due_date,
    id.count::INTEGER AS pending_invoices,
    od.count::INTEGER AS pending_opening_balance
  FROM invoice_debt id, opening_debt od;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_client_debt IS 'Calcula a dívida total de um cliente incluindo faturas e saldo de abertura';

-- 8. FUNÇÃO PARA CRIAR NEGOCIAÇÃO
-- =====================================================
CREATE OR REPLACE FUNCTION create_debt_negotiation(
  p_client_id UUID,
  p_invoice_ids UUID[],
  p_opening_balance_ids UUID[],
  p_discount_percentage NUMERIC,
  p_installments_count INTEGER,
  p_first_due_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  negotiation_id UUID,
  negotiation_number TEXT,
  original_debt NUMERIC,
  discount_amount NUMERIC,
  final_amount NUMERIC,
  installment_amount NUMERIC,
  requires_approval BOOLEAN,
  approval_level TEXT,
  message TEXT
) AS $$
DECLARE
  v_original_debt NUMERIC := 0;
  v_invoice_total NUMERIC := 0;
  v_opening_total NUMERIC := 0;
  v_discount NUMERIC;
  v_final NUMERIC;
  v_installment NUMERIC;
  v_negotiation_id UUID;
  v_negotiation_number TEXT;
  v_requires_approval BOOLEAN := false;
  v_approval_level TEXT := 'operator';
  v_user_id UUID;
BEGIN
  -- Obter usuário atual
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  -- Calcular total das faturas selecionadas
  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_invoice_total
    FROM invoices
    WHERE id = ANY(p_invoice_ids)
      AND status IN ('pending', 'overdue');
  END IF;

  -- Calcular total dos saldos de abertura selecionados
  IF p_opening_balance_ids IS NOT NULL AND array_length(p_opening_balance_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0)
    INTO v_opening_total
    FROM client_opening_balance
    WHERE id = ANY(p_opening_balance_ids)
      AND status IN ('pending', 'partial');
  END IF;

  v_original_debt := v_invoice_total + v_opening_total;

  IF v_original_debt <= 0 THEN
    RETURN QUERY SELECT
      false, NULL::UUID, NULL::TEXT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, false, NULL::TEXT,
      'Nenhuma dívida encontrada para os itens selecionados'::TEXT;
    RETURN;
  END IF;

  -- Calcular desconto e valor final
  v_discount := ROUND(v_original_debt * (p_discount_percentage / 100), 2);
  v_final := v_original_debt - v_discount;
  v_installment := ROUND(v_final / p_installments_count, 2);

  -- Verificar necessidade de aprovação
  SELECT
    CASE WHEN p_discount_percentage > 0 THEN true ELSE false END,
    COALESCE(
      (SELECT dar.approval_level
       FROM discount_approval_rules dar
       WHERE dar.is_active = true
         AND p_discount_percentage >= dar.min_discount_percentage
         AND p_discount_percentage <= dar.max_discount_percentage
       LIMIT 1),
      'owner'
    )
  INTO v_requires_approval, v_approval_level;

  -- Criar a negociação
  INSERT INTO debt_negotiations (
    client_id,
    original_debt,
    discount_amount,
    discount_percentage,
    final_amount,
    payment_type,
    installments_count,
    first_due_date,
    installment_amount,
    status,
    requires_approval,
    approval_level,
    invoice_ids,
    opening_balance_ids,
    notes,
    negotiated_by
  ) VALUES (
    p_client_id,
    v_original_debt,
    v_discount,
    p_discount_percentage,
    v_final,
    CASE WHEN p_installments_count = 1 THEN 'single' ELSE 'installment' END,
    p_installments_count,
    p_first_due_date,
    v_installment,
    CASE WHEN v_requires_approval AND p_discount_percentage > 5 THEN 'pending_approval' ELSE 'draft' END,
    v_requires_approval,
    v_approval_level,
    p_invoice_ids,
    p_opening_balance_ids,
    p_notes,
    v_user_id
  )
  RETURNING id, negotiation_number INTO v_negotiation_id, v_negotiation_number;

  -- Gerar parcelas
  FOR i IN 1..p_installments_count LOOP
    INSERT INTO negotiation_installments (
      negotiation_id,
      installment_number,
      amount,
      due_date,
      status
    ) VALUES (
      v_negotiation_id,
      i,
      CASE WHEN i = p_installments_count
        THEN v_final - (v_installment * (p_installments_count - 1)) -- Última parcela ajusta diferença de arredondamento
        ELSE v_installment
      END,
      p_first_due_date + ((i - 1) * INTERVAL '1 month'),
      'pending'
    );
  END LOOP;

  RETURN QUERY SELECT
    true,
    v_negotiation_id,
    v_negotiation_number,
    v_original_debt,
    v_discount,
    v_final,
    v_installment,
    v_requires_approval,
    v_approval_level,
    CASE
      WHEN v_requires_approval AND p_discount_percentage > 5 THEN 'Negociação criada - aguardando aprovação de ' || v_approval_level
      ELSE 'Negociação criada com sucesso'
    END::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_debt_negotiation IS 'Cria uma nova negociação de dívida com desconto e parcelamento';

-- 9. FUNÇÃO PARA APROVAR NEGOCIAÇÃO
-- =====================================================
CREATE OR REPLACE FUNCTION approve_negotiation(
  p_negotiation_id UUID,
  p_approved BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  IF p_approved THEN
    UPDATE debt_negotiations
    SET
      status = 'approved',
      approved_by = v_user_id,
      approved_at = NOW(),
      approval_notes = p_notes,
      updated_at = NOW()
    WHERE id = p_negotiation_id
      AND status = 'pending_approval';
  ELSE
    UPDATE debt_negotiations
    SET
      status = 'rejected',
      approved_by = v_user_id,
      approved_at = NOW(),
      approval_notes = p_notes,
      updated_at = NOW()
    WHERE id = p_negotiation_id
      AND status = 'pending_approval';
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Negociação não encontrada ou já processada'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    CASE WHEN p_approved THEN 'Negociação aprovada com sucesso' ELSE 'Negociação rejeitada' END::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 10. FUNÇÃO PARA ATIVAR NEGOCIAÇÃO (APÓS ASSINATURA)
-- =====================================================
CREATE OR REPLACE FUNCTION activate_negotiation(
  p_negotiation_id UUID,
  p_contract_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  UPDATE debt_negotiations
  SET
    status = 'active',
    contract_signed = true,
    contract_signed_at = NOW(),
    contract_url = COALESCE(p_contract_url, contract_url),
    updated_at = NOW()
  WHERE id = p_negotiation_id
    AND status IN ('approved', 'draft');

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Negociação não encontrada ou não aprovada'::TEXT;
    RETURN;
  END IF;

  -- Marcar faturas originais como "em negociação"
  UPDATE invoices
  SET status = 'cancelled', -- Ou criar um status 'negotiated'
      notes = COALESCE(notes, '') || ' | Incluída na negociação ' || (SELECT negotiation_number FROM debt_negotiations WHERE id = p_negotiation_id)
  WHERE id = ANY(SELECT UNNEST(invoice_ids) FROM debt_negotiations WHERE id = p_negotiation_id);

  -- Marcar saldos de abertura como "em negociação"
  UPDATE client_opening_balance
  SET status = 'paid',
      notes = COALESCE(notes, '') || ' | Incluído na negociação ' || (SELECT negotiation_number FROM debt_negotiations WHERE id = p_negotiation_id)
  WHERE id = ANY(SELECT UNNEST(opening_balance_ids) FROM debt_negotiations WHERE id = p_negotiation_id);

  RETURN QUERY SELECT true, 'Negociação ativada com sucesso'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 11. VIEW DE CLIENTES COM DÍVIDAS PARA NEGOCIAÇÃO
-- =====================================================
CREATE OR REPLACE VIEW v_clients_for_negotiation AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.cnpj,
  c.cpf,
  c.email,
  c.phone,
  c.uf,
  c.municipio,

  -- Dívida
  debt.total_debt,
  debt.overdue_amount,
  debt.overdue_days,
  debt.oldest_due_date,
  debt.pending_invoices,
  debt.pending_opening_balance,

  -- Contatos
  (SELECT COUNT(*) FROM client_contacts cc WHERE cc.client_id = c.id AND cc.is_valid = true) AS contact_count,
  (SELECT json_agg(json_build_object(
    'id', cc.id,
    'type', cc.contact_type,
    'value', cc.contact_value,
    'name', cc.contact_name,
    'is_primary', cc.is_primary,
    'is_whatsapp', cc.is_whatsapp
  ))
  FROM client_contacts cc
  WHERE cc.client_id = c.id AND cc.is_valid = true
  ) AS contacts,

  -- Última tentativa de contato
  (SELECT MAX(nch.created_at) FROM negotiation_contact_history nch WHERE nch.client_id = c.id) AS last_contact_at,

  -- Negociações ativas
  (SELECT COUNT(*) FROM debt_negotiations dn WHERE dn.client_id = c.id AND dn.status IN ('active', 'pending_approval', 'approved')) AS active_negotiations

FROM clients c
CROSS JOIN LATERAL calculate_client_debt(c.id) debt
WHERE c.is_active = true
  AND debt.total_debt > 0
ORDER BY debt.overdue_days DESC, debt.total_debt DESC;

COMMENT ON VIEW v_clients_for_negotiation IS 'Clientes com dívidas pendentes e informações para negociação';

-- 12. GRANT PERMISSÕES
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON client_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON debt_negotiations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON negotiation_installments TO authenticated;
GRANT SELECT, INSERT ON negotiation_contact_history TO authenticated;
GRANT SELECT ON discount_approval_rules TO authenticated;
GRANT SELECT ON v_clients_for_negotiation TO authenticated;
GRANT USAGE ON SEQUENCE negotiation_number_seq TO authenticated;

GRANT EXECUTE ON FUNCTION calculate_client_debt TO authenticated;
GRANT EXECUTE ON FUNCTION create_debt_negotiation TO authenticated;
GRANT EXECUTE ON FUNCTION approve_negotiation TO authenticated;
GRANT EXECUTE ON FUNCTION activate_negotiation TO authenticated;

-- 13. RLS POLICIES
-- =====================================================
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_contact_history ENABLE ROW LEVEL SECURITY;

-- Policies permissivas para authenticated
CREATE POLICY "Allow all for authenticated users" ON client_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON debt_negotiations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON negotiation_installments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON negotiation_contact_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
