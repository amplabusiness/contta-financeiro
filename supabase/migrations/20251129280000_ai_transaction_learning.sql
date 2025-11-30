-- =====================================================
-- SISTEMA DE APRENDIZADO DE CLASSIFICAÇÃO DE TRANSAÇÕES
-- Armazena classificações do humano para treinar a IA
-- =====================================================

-- Tabela de entidades conhecidas (pessoas, empresas, etc)
CREATE TABLE IF NOT EXISTS ai_known_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Padrões de identificação
  name_pattern TEXT NOT NULL, -- ex: "SERGIO CARNEIRO LEAO"
  normalized_pattern TEXT NOT NULL, -- padrão normalizado para matching

  -- Identificação
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'company', 'supplier', 'partner', 'employee', 'client', 'other')),
  display_name TEXT NOT NULL, -- nome amigável ex: "Sérgio Carneiro Leão"
  document TEXT, -- CPF ou CNPJ se conhecido
  relationship TEXT, -- ex: "Sócio", "Fornecedor de TI", "Funcionário"

  -- Informações adicionais da IA
  notes TEXT, -- observações do humano sobre esta entidade

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INT DEFAULT 1
);

-- Tabela de padrões de classificação aprendidos
CREATE TABLE IF NOT EXISTS ai_classification_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Padrão de transação
  transaction_pattern TEXT NOT NULL, -- padrão regex ou literal
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('literal', 'regex', 'contains')),

  -- Classificação definida
  category TEXT NOT NULL,
  subcategory TEXT,

  -- Contas contábeis
  debit_account_code TEXT NOT NULL,
  credit_account_code TEXT NOT NULL,

  -- Entidade relacionada (opcional)
  entity_id UUID REFERENCES ai_known_entities(id),

  -- Contexto
  transaction_type TEXT CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'ANY')),
  min_amount DECIMAL(15,2),
  max_amount DECIMAL(15,2),

  -- Metadados
  confidence DECIMAL(3,2) DEFAULT 1.0, -- 1.0 = definido pelo humano
  source TEXT DEFAULT 'human' CHECK (source IN ('human', 'ai_confirmed', 'ai_suggested')),
  priority INT DEFAULT 100, -- maior = mais prioritário
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INT DEFAULT 0
);

-- Tabela de histórico de classificações (para aprendizado)
CREATE TABLE IF NOT EXISTS ai_classification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Transação original
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  original_description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_date DATE NOT NULL,

  -- Classificação da IA (antes da revisão humana)
  ai_category TEXT,
  ai_debit_account TEXT,
  ai_credit_account TEXT,
  ai_confidence DECIMAL(3,2),
  ai_reasoning TEXT,

  -- Classificação final (após revisão humana)
  final_category TEXT NOT NULL,
  final_debit_account TEXT NOT NULL,
  final_credit_account TEXT NOT NULL,

  -- Entidade identificada
  entity_id UUID REFERENCES ai_known_entities(id),
  entity_relationship TEXT,

  -- Status
  was_corrected BOOLEAN DEFAULT false, -- true se humano corrigiu a IA
  human_notes TEXT, -- explicação do humano

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ
);

-- Tabela de perguntas pendentes da IA para o humano
CREATE TABLE IF NOT EXISTS ai_pending_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Transação relacionada
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  import_id UUID REFERENCES bank_imports(id),

  -- Dados da transação
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_date DATE NOT NULL,

  -- Pergunta da IA
  question_type TEXT NOT NULL CHECK (question_type IN ('who_is', 'what_is', 'category', 'account', 'confirm')),
  question_text TEXT NOT NULL,
  ai_suggestion TEXT, -- sugestão da IA se houver
  ai_confidence DECIMAL(3,2),

  -- Opções de resposta (JSON array)
  options JSONB, -- ex: [{"value": "partner", "label": "Sócio"}, ...]

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped')),

  -- Resposta do humano
  answer TEXT,
  answer_details JSONB, -- detalhes adicionais da resposta
  answered_by UUID REFERENCES auth.users(id),
  answered_at TIMESTAMPTZ,

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  priority INT DEFAULT 50 -- maior = mais urgente
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ai_known_entities_pattern ON ai_known_entities(normalized_pattern);
CREATE INDEX IF NOT EXISTS idx_ai_known_entities_type ON ai_known_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_ai_classification_patterns_pattern ON ai_classification_patterns(transaction_pattern);
CREATE INDEX IF NOT EXISTS idx_ai_classification_patterns_active ON ai_classification_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_pending_questions_status ON ai_pending_questions(status);
CREATE INDEX IF NOT EXISTS idx_ai_pending_questions_import ON ai_pending_questions(import_id);

-- Função para normalizar texto para matching
CREATE OR REPLACE FUNCTION normalize_for_matching(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN UPPER(
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(input_text, '[^A-Za-z0-9\s]', '', 'g'),
        '\s+', ' ', 'g'
      )
    )
  );
END;
$$;

-- Função para buscar padrão conhecido
CREATE OR REPLACE FUNCTION find_known_pattern(description TEXT, txn_type TEXT, amount DECIMAL)
RETURNS TABLE (
  pattern_id UUID,
  category TEXT,
  debit_account TEXT,
  credit_account TEXT,
  entity_name TEXT,
  entity_relationship TEXT,
  confidence DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := normalize_for_matching(description);

  RETURN QUERY
  SELECT
    p.id AS pattern_id,
    p.category,
    p.debit_account_code AS debit_account,
    p.credit_account_code AS credit_account,
    e.display_name AS entity_name,
    e.relationship AS entity_relationship,
    p.confidence
  FROM ai_classification_patterns p
  LEFT JOIN ai_known_entities e ON p.entity_id = e.id
  WHERE p.is_active = true
    AND (p.transaction_type = 'ANY' OR p.transaction_type = txn_type)
    AND (p.min_amount IS NULL OR amount >= p.min_amount)
    AND (p.max_amount IS NULL OR amount <= p.max_amount)
    AND (
      (p.pattern_type = 'literal' AND normalized = normalize_for_matching(p.transaction_pattern))
      OR (p.pattern_type = 'contains' AND normalized LIKE '%' || normalize_for_matching(p.transaction_pattern) || '%')
      OR (p.pattern_type = 'regex' AND normalized ~ p.transaction_pattern)
    )
  ORDER BY p.priority DESC, p.usage_count DESC
  LIMIT 1;
END;
$$;

-- Trigger para atualizar contador de uso em entidades
CREATE OR REPLACE FUNCTION update_entity_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.entity_id IS NOT NULL THEN
    UPDATE ai_known_entities
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_entity_usage
AFTER INSERT ON ai_classification_history
FOR EACH ROW
EXECUTE FUNCTION update_entity_usage();

-- Trigger para atualizar contador de uso em padrões
CREATE OR REPLACE FUNCTION update_pattern_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Buscar padrão que foi usado
  UPDATE ai_classification_patterns
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id IN (
    SELECT p.id
    FROM ai_classification_patterns p
    WHERE p.debit_account_code = NEW.final_debit_account
      AND p.credit_account_code = NEW.final_credit_account
      AND p.category = NEW.final_category
    LIMIT 1
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_pattern_usage
AFTER INSERT ON ai_classification_history
FOR EACH ROW
EXECUTE FUNCTION update_pattern_usage();

-- RLS Policies
ALTER TABLE ai_known_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_classification_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_classification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pending_questions ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para usuários autenticados
CREATE POLICY "Users can manage known entities"
  ON ai_known_entities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage classification patterns"
  ON ai_classification_patterns FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage classification history"
  ON ai_classification_history FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage pending questions"
  ON ai_pending_questions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE ai_known_entities IS 'Entidades conhecidas (pessoas, empresas) para classificação automática';
COMMENT ON TABLE ai_classification_patterns IS 'Padrões de classificação aprendidos da interação humano-IA';
COMMENT ON TABLE ai_classification_history IS 'Histórico de todas as classificações para treinamento da IA';
COMMENT ON TABLE ai_pending_questions IS 'Perguntas da IA aguardando resposta do humano';
