-- =====================================================
-- SISTEMA DE CONFISSÃO DE DÍVIDA
-- Título Executivo Extrajudicial - Art. 585, II do CPC
-- =====================================================

-- Tabela principal de confissões de dívida
CREATE TABLE IF NOT EXISTS debt_confessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  confession_number TEXT UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Valores
  total_debt DECIMAL(15,2) NOT NULL, -- Valor total original da dívida
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  final_amount DECIMAL(15,2) NOT NULL, -- Valor após desconto

  -- Parcelamento
  installments INTEGER NOT NULL DEFAULT 1,
  installment_value DECIMAL(15,2) NOT NULL,
  first_due_date DATE NOT NULL,
  payment_day INTEGER DEFAULT 10 CHECK (payment_day BETWEEN 1 AND 31),

  -- Faturas incluídas
  invoice_ids UUID[] DEFAULT '{}',

  -- Conteúdo do documento
  content TEXT,

  -- Arquivos
  document_url TEXT,
  signed_document_url TEXT,

  -- Assinatura
  signature_status TEXT DEFAULT 'pending'
    CHECK (signature_status IN ('pending', 'sent', 'signed', 'refused')),
  signed_at TIMESTAMPTZ,
  signed_by TEXT, -- Nome de quem assinou

  -- Status do acordo
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'active', 'defaulted', 'cancelled', 'completed')),

  -- Pagamentos
  paid_installments INTEGER DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  last_payment_date DATE,

  -- Inadimplência
  defaulted_at DATE,
  defaulted_reason TEXT,

  -- Controle
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de parcelas da confissão
CREATE TABLE IF NOT EXISTS debt_confession_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id UUID NOT NULL REFERENCES debt_confessions(id) ON DELETE CASCADE,

  installment_number INTEGER NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,

  -- Pagamento
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
  paid_amount DECIMAL(15,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,

  -- Encargos por atraso
  fine_amount DECIMAL(15,2) DEFAULT 0,
  interest_amount DECIMAL(15,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(confession_id, installment_number)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debt_confessions_client ON debt_confessions(client_id);
CREATE INDEX IF NOT EXISTS idx_debt_confessions_status ON debt_confessions(status);
CREATE INDEX IF NOT EXISTS idx_debt_confessions_number ON debt_confessions(confession_number);
CREATE INDEX IF NOT EXISTS idx_debt_confession_installments_confession ON debt_confession_installments(confession_id);
CREATE INDEX IF NOT EXISTS idx_debt_confession_installments_due_date ON debt_confession_installments(due_date);

-- Função para gerar número de confissão
CREATE OR REPLACE FUNCTION generate_confession_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(confession_number FROM 'CDV-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM debt_confessions
  WHERE confession_number LIKE 'CDV-' || year_part || '-%';

  new_number := 'CDV-' || year_part || '-' || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger para numeração automática
CREATE OR REPLACE FUNCTION set_confession_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confession_number IS NULL THEN
    NEW.confession_number := generate_confession_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_confession_number ON debt_confessions;
CREATE TRIGGER trigger_set_confession_number
  BEFORE INSERT ON debt_confessions
  FOR EACH ROW
  EXECUTE FUNCTION set_confession_number();

-- Trigger para criar parcelas automaticamente
CREATE OR REPLACE FUNCTION create_confession_installments()
RETURNS TRIGGER AS $$
DECLARE
  i INTEGER;
  due_date DATE;
BEGIN
  -- Só criar se for nova confissão com status signed ou active
  IF NEW.status IN ('signed', 'active') AND
     (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status = 'draft')) THEN

    -- Deletar parcelas existentes se houver
    DELETE FROM debt_confession_installments WHERE confession_id = NEW.id;

    -- Criar novas parcelas
    FOR i IN 1..NEW.installments LOOP
      due_date := NEW.first_due_date + ((i - 1) * INTERVAL '1 month');

      INSERT INTO debt_confession_installments (
        confession_id,
        installment_number,
        amount,
        due_date,
        status
      ) VALUES (
        NEW.id,
        i,
        NEW.installment_value,
        due_date,
        'pending'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_confession_installments ON debt_confessions;
CREATE TRIGGER trigger_create_confession_installments
  AFTER INSERT OR UPDATE ON debt_confessions
  FOR EACH ROW
  EXECUTE FUNCTION create_confession_installments();

-- Trigger para atualizar parcelas vencidas
CREATE OR REPLACE FUNCTION update_overdue_confession_installments()
RETURNS void AS $$
BEGIN
  UPDATE debt_confession_installments
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;

  -- Marcar confissões como inadimplentes se tiver parcela vencida há mais de 30 dias
  UPDATE debt_confessions dc
  SET status = 'defaulted',
      defaulted_at = CURRENT_DATE,
      defaulted_reason = 'Parcela vencida há mais de 30 dias'
  FROM debt_confession_installments dci
  WHERE dc.id = dci.confession_id
    AND dc.status = 'active'
    AND dci.status = 'overdue'
    AND dci.due_date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- View de confissões com resumo de parcelas
CREATE OR REPLACE VIEW v_debt_confessions_summary AS
SELECT
  dc.*,
  c.name AS client_name,
  c.cnpj AS client_cnpj,
  COALESCE(
    (SELECT COUNT(*) FROM debt_confession_installments dci
     WHERE dci.confession_id = dc.id AND dci.status = 'paid'),
    0
  ) AS paid_count,
  COALESCE(
    (SELECT COUNT(*) FROM debt_confession_installments dci
     WHERE dci.confession_id = dc.id AND dci.status = 'overdue'),
    0
  ) AS overdue_count,
  COALESCE(
    (SELECT SUM(paid_amount) FROM debt_confession_installments dci
     WHERE dci.confession_id = dc.id),
    0
  ) AS total_paid,
  COALESCE(
    (SELECT MIN(due_date) FROM debt_confession_installments dci
     WHERE dci.confession_id = dc.id AND dci.status IN ('pending', 'overdue')),
    NULL
  ) AS next_due_date
FROM debt_confessions dc
LEFT JOIN clients c ON dc.client_id = c.id;

-- RLS Policies
ALTER TABLE debt_confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_confession_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all confessions" ON debt_confessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert confessions" ON debt_confessions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update confessions" ON debt_confessions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view all installments" ON debt_confession_installments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert installments" ON debt_confession_installments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update installments" ON debt_confession_installments
  FOR UPDATE TO authenticated USING (true);

-- Comentários
COMMENT ON TABLE debt_confessions IS 'Confissões de dívida - Título Executivo Extrajudicial (Art. 585, II CPC)';
COMMENT ON TABLE debt_confession_installments IS 'Parcelas das confissões de dívida';
