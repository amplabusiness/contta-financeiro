-- =====================================================
-- COLUNAS DE VALIDAÇÃO IA EM ACCOUNTING_ENTRIES
-- Para rastrear validação automática feita pela IA
-- =====================================================

-- Adicionar colunas de validação IA na tabela accounting_entries
DO $$
BEGIN
  -- Campo para status de validação da IA
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validated') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validated BOOLEAN DEFAULT false;
  END IF;

  -- Data/hora da última validação
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validated_at') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validated_at TIMESTAMPTZ;
  END IF;

  -- Resultado da validação (valid, invalid, warning)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validation_result') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validation_result TEXT CHECK (ai_validation_result IN ('valid', 'invalid', 'warning', 'pending'));
  END IF;

  -- Mensagem/feedback da IA
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validation_message') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validation_message TEXT;
  END IF;

  -- Confiança da validação (0.0 a 1.0)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_confidence') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_confidence DECIMAL(3,2);
  END IF;

  -- Se foi gerado automaticamente pela IA
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_generated') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_generated BOOLEAN DEFAULT false;
  END IF;

  -- Modelo de IA usado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_model') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_model TEXT;
  END IF;
END $$;

-- Índices para buscas por status de validação
CREATE INDEX IF NOT EXISTS idx_accounting_entries_ai_validated
  ON accounting_entries(ai_validated)
  WHERE ai_validated = false;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_ai_result
  ON accounting_entries(ai_validation_result);

-- =====================================================
-- TABELA DE FILA DE VALIDAÇÃO IA (Background Jobs)
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_validation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = alta, 10 = baixa
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(entry_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_validation_queue_status
  ON ai_validation_queue(status, priority)
  WHERE status IN ('pending', 'retry');

-- =====================================================
-- FUNÇÃO PARA ADICIONAR ENTRY NA FILA DE VALIDAÇÃO
-- =====================================================
CREATE OR REPLACE FUNCTION queue_entry_for_ai_validation(
  p_entry_id UUID,
  p_priority INTEGER DEFAULT 5
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  -- Inserir ou atualizar na fila
  INSERT INTO ai_validation_queue (entry_id, priority)
  VALUES (p_entry_id, p_priority)
  ON CONFLICT (entry_id) DO UPDATE SET
    status = 'pending',
    priority = EXCLUDED.priority,
    attempts = 0,
    last_error = NULL
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;

-- =====================================================
-- FUNÇÃO PARA PEGAR PRÓXIMO ITEM DA FILA
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_validation_item()
RETURNS TABLE(
  queue_id UUID,
  entry_id UUID,
  entry_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_item AS (
    SELECT q.id, q.entry_id
    FROM ai_validation_queue q
    WHERE q.status IN ('pending', 'retry')
      AND q.attempts < q.max_attempts
    ORDER BY q.priority ASC, q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ai_validation_queue SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1
  FROM next_item
  WHERE ai_validation_queue.id = next_item.id
  RETURNING
    next_item.id as queue_id,
    next_item.entry_id,
    (SELECT to_jsonb(e.*) || jsonb_build_object(
      'lines', (
        SELECT jsonb_agg(to_jsonb(l.*) || jsonb_build_object(
          'account_code', c.code,
          'account_name', c.name
        ))
        FROM accounting_entry_lines l
        JOIN chart_of_accounts c ON c.id = l.account_id
        WHERE l.entry_id = next_item.entry_id
      )
    ) FROM accounting_entries e WHERE e.id = next_item.entry_id) as entry_data;
END;
$$;

-- =====================================================
-- FUNÇÃO PARA MARCAR VALIDAÇÃO CONCLUÍDA
-- =====================================================
CREATE OR REPLACE FUNCTION complete_ai_validation(
  p_queue_id UUID,
  p_result TEXT, -- 'valid', 'invalid', 'warning'
  p_message TEXT,
  p_confidence DECIMAL DEFAULT 0.9,
  p_model TEXT DEFAULT 'gemini-2.0-flash'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  -- Buscar entry_id
  SELECT entry_id INTO v_entry_id FROM ai_validation_queue WHERE id = p_queue_id;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Queue item not found: %', p_queue_id;
  END IF;

  -- Atualizar accounting_entry
  UPDATE accounting_entries SET
    ai_validated = true,
    ai_validated_at = now(),
    ai_validation_result = p_result,
    ai_validation_message = p_message,
    ai_confidence = p_confidence,
    ai_model = p_model
  WHERE id = v_entry_id;

  -- Marcar fila como concluída
  UPDATE ai_validation_queue SET
    status = 'completed',
    completed_at = now()
  WHERE id = p_queue_id;
END;
$$;

-- =====================================================
-- FUNÇÃO PARA MARCAR FALHA NA VALIDAÇÃO
-- =====================================================
CREATE OR REPLACE FUNCTION fail_ai_validation(
  p_queue_id UUID,
  p_error TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_max_attempts INTEGER;
BEGIN
  -- Buscar tentativas
  SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
  FROM ai_validation_queue WHERE id = p_queue_id;

  -- Atualizar status baseado nas tentativas
  UPDATE ai_validation_queue SET
    status = CASE WHEN v_attempts >= v_max_attempts THEN 'failed' ELSE 'retry' END,
    last_error = p_error,
    completed_at = CASE WHEN v_attempts >= v_max_attempts THEN now() ELSE NULL END
  WHERE id = p_queue_id;
END;
$$;

-- =====================================================
-- TRIGGER PARA AUTO-ENFILEIRAR NOVOS ENTRIES
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_queue_new_entry_for_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enfileirar para validação (prioridade normal)
  PERFORM queue_entry_for_ai_validation(NEW.id, 5);
  RETURN NEW;
END;
$$;

-- Criar trigger (apenas para novos lançamentos)
DROP TRIGGER IF EXISTS trg_queue_ai_validation ON accounting_entries;
CREATE TRIGGER trg_queue_ai_validation
  AFTER INSERT ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_queue_new_entry_for_validation();

-- =====================================================
-- VIEW PARA ESTATÍSTICAS DE VALIDAÇÃO
-- =====================================================
CREATE OR REPLACE VIEW v_ai_validation_stats AS
SELECT
  COUNT(*) FILTER (WHERE ai_validated = true) as validated_count,
  COUNT(*) FILTER (WHERE ai_validated = false) as pending_count,
  COUNT(*) FILTER (WHERE ai_validation_result = 'valid') as valid_count,
  COUNT(*) FILTER (WHERE ai_validation_result = 'invalid') as invalid_count,
  COUNT(*) FILTER (WHERE ai_validation_result = 'warning') as warning_count,
  AVG(ai_confidence) FILTER (WHERE ai_confidence IS NOT NULL) as avg_confidence,
  COUNT(*) as total_entries
FROM accounting_entries;

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE ai_validation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON ai_validation_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON ai_validation_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================
COMMENT ON COLUMN accounting_entries.ai_validated IS 'Indica se o lançamento foi validado pela IA';
COMMENT ON COLUMN accounting_entries.ai_validation_result IS 'Resultado da validação: valid, invalid, warning, pending';
COMMENT ON COLUMN accounting_entries.ai_confidence IS 'Nível de confiança da IA (0.0 a 1.0)';
COMMENT ON COLUMN accounting_entries.ai_generated IS 'True se o lançamento foi gerado automaticamente pela IA';

COMMENT ON TABLE ai_validation_queue IS 'Fila de lançamentos aguardando validação pela IA';
COMMENT ON FUNCTION queue_entry_for_ai_validation IS 'Adiciona um lançamento na fila de validação IA';
COMMENT ON FUNCTION get_next_validation_item IS 'Retorna o próximo item da fila para processar';
COMMENT ON FUNCTION complete_ai_validation IS 'Marca uma validação como concluída';
