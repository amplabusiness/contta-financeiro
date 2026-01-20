-- =====================================================
-- AI VALIDATION ENHANCEMENTS
-- Complementa a migration anterior com colunas adicionais
-- =====================================================

-- 1. Adicionar colunas extras
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- 2. Criar tabela de fila de validação
CREATE TABLE IF NOT EXISTS ai_validation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES accounting_entries(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(entry_id)
);

-- 3. Índices para fila
CREATE INDEX IF NOT EXISTS idx_validation_queue_status ON ai_validation_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_validation_queue_entry ON ai_validation_queue(entry_id);

-- 4. RLS para fila
ALTER TABLE ai_validation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view validation queue" ON ai_validation_queue
  FOR SELECT USING (true);

CREATE POLICY "System can manage queue" ON ai_validation_queue
  FOR ALL USING (true);

-- 5. Função para adicionar na fila
CREATE OR REPLACE FUNCTION queue_entry_for_ai_validation(
  p_entry_id UUID,
  p_priority INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  INSERT INTO ai_validation_queue (entry_id, priority)
  VALUES (p_entry_id, p_priority)
  ON CONFLICT (entry_id) DO UPDATE SET
    status = 'pending',
    priority = GREATEST(ai_validation_queue.priority, EXCLUDED.priority),
    attempts = 0,
    error_message = NULL
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para pegar próximo item
CREATE OR REPLACE FUNCTION get_next_validation_item()
RETURNS TABLE (
  queue_id UUID,
  entry_id UUID,
  entry_date DATE,
  description TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC
) AS $$
DECLARE
  v_queue_id UUID;
  v_entry_id UUID;
BEGIN
  -- Pegar próximo item pendente
  SELECT q.id, q.entry_id INTO v_queue_id, v_entry_id
  FROM ai_validation_queue q
  WHERE q.status = 'pending' AND q.attempts < q.max_attempts
  ORDER BY q.priority DESC, q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_queue_id IS NULL THEN
    RETURN;
  END IF;

  -- Marcar como processando
  UPDATE ai_validation_queue
  SET status = 'processing', started_at = NOW(), attempts = attempts + 1
  WHERE id = v_queue_id;

  -- Retornar dados do lançamento
  RETURN QUERY
  SELECT
    v_queue_id as queue_id,
    ae.id as entry_id,
    ae.entry_date,
    ae.description,
    COALESCE(SUM(ael.debit_amount), 0) as total_debit,
    COALESCE(SUM(ael.credit_amount), 0) as total_credit
  FROM accounting_entries ae
  LEFT JOIN accounting_entry_lines ael ON ae.id = ael.entry_id
  WHERE ae.id = v_entry_id
  GROUP BY ae.id, ae.entry_date, ae.description;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para completar validação
CREATE OR REPLACE FUNCTION complete_ai_validation(
  p_queue_id UUID,
  p_status TEXT,
  p_score INTEGER,
  p_confidence DECIMAL,
  p_message TEXT,
  p_model TEXT DEFAULT 'gemini-2.5-flash'
)
RETURNS VOID AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  -- Buscar entry_id
  SELECT entry_id INTO v_entry_id
  FROM ai_validation_queue
  WHERE id = p_queue_id;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Queue item not found: %', p_queue_id;
  END IF;

  -- Atualizar lançamento
  UPDATE accounting_entries
  SET
    ai_validated = (p_status = 'approved'),
    ai_validation_status = p_status,
    ai_validation_score = p_score,
    ai_confidence = p_confidence,
    ai_validation_message = p_message,
    ai_model = p_model,
    ai_validated_at = NOW()
  WHERE id = v_entry_id;

  -- Atualizar fila
  UPDATE ai_validation_queue
  SET
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_queue_id;

  -- Registrar atividade
  PERFORM log_ai_accountant_activity(
    v_entry_id,
    'validation',
    CASE
      WHEN p_status = 'approved' THEN 'success'
      WHEN p_status = 'warning' THEN 'warning'
      ELSE 'error'
    END,
    p_score,
    p_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função para falhar validação
CREATE OR REPLACE FUNCTION fail_ai_validation(
  p_queue_id UUID,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_validation_queue
  SET
    status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
    error_message = p_error_message,
    completed_at = CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END
  WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger para adicionar novos lançamentos na fila
CREATE OR REPLACE FUNCTION queue_new_entry_for_validation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM queue_entry_for_ai_validation(NEW.id, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_queue_new_entry ON accounting_entries;
CREATE TRIGGER trg_queue_new_entry
  AFTER INSERT ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION queue_new_entry_for_validation();

-- 10. Adicionar lançamentos existentes na fila
INSERT INTO ai_validation_queue (entry_id, priority)
SELECT id, 0
FROM accounting_entries
WHERE ai_validation_status = 'pending'
  AND id NOT IN (SELECT entry_id FROM ai_validation_queue WHERE entry_id IS NOT NULL)
ON CONFLICT (entry_id) DO NOTHING;

COMMENT ON TABLE ai_validation_queue IS 'Fila de lançamentos aguardando validação do Contador IA';
COMMENT ON COLUMN accounting_entries.ai_confidence IS 'Nível de confiança da IA (0.0 a 1.0)';
COMMENT ON COLUMN accounting_entries.ai_generated IS 'Se o lançamento foi gerado automaticamente pela IA';
COMMENT ON COLUMN accounting_entries.ai_model IS 'Modelo de IA usado na validação';
