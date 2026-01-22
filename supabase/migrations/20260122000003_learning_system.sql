-- ============================================================================
-- SPRINT 2: SISTEMA DE APRENDIZADO CONTINUO
-- Permite que o sistema aprenda com correcoes do usuario
-- ============================================================================

-- ============================================================================
-- PARTE 1: TABELA DE PADROES APRENDIDOS
-- ============================================================================

-- Dropar tabela existente se tiver estrutura antiga
DROP TABLE IF EXISTS ai_classification_patterns CASCADE;

CREATE TABLE ai_classification_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type VARCHAR(50) NOT NULL, -- 'description', 'value_range', 'combination'
  pattern_value JSONB NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- 'client', 'account', 'category'
  target_value JSONB NOT NULL,
  confidence_base NUMERIC(3,2) DEFAULT 0.80,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  effectiveness NUMERIC(5,4) GENERATED ALWAYS AS (
    CASE WHEN usage_count > 0
    THEN success_count::NUMERIC / usage_count
    ELSE 0.80 END
  ) STORED,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id)
);

-- Indices para busca rapida
CREATE INDEX idx_patterns_tenant ON ai_classification_patterns(tenant_id);
CREATE INDEX idx_patterns_type ON ai_classification_patterns(pattern_type, target_type);
CREATE INDEX idx_patterns_effectiveness ON ai_classification_patterns(effectiveness DESC);

-- RLS
ALTER TABLE ai_classification_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for patterns"
  ON ai_classification_patterns
  FOR ALL
  USING (tenant_id = get_my_tenant_id());

-- ============================================================================
-- PARTE 2: TABELA DE FEEDBACK DO USUARIO
-- ============================================================================

DROP TABLE IF EXISTS ai_classification_feedback CASCADE;

CREATE TABLE ai_classification_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- 'bank_transaction'
  entity_id UUID NOT NULL,
  original_suggestion JSONB, -- O que a IA sugeriu
  user_correction JSONB,     -- O que o usuario corrigiu
  feedback_type VARCHAR(20) NOT NULL, -- 'confirmed', 'corrected', 'rejected'
  pattern_id UUID REFERENCES ai_classification_patterns(id),
  description_snapshot TEXT, -- Guarda a descricao original para aprendizado
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id)
);

-- Indices
CREATE INDEX idx_feedback_tenant ON ai_classification_feedback(tenant_id);
CREATE INDEX idx_feedback_entity ON ai_classification_feedback(entity_type, entity_id);
CREATE INDEX idx_feedback_type ON ai_classification_feedback(feedback_type);

-- RLS
ALTER TABLE ai_classification_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for feedback"
  ON ai_classification_feedback
  FOR ALL
  USING (tenant_id = get_my_tenant_id());

-- ============================================================================
-- PARTE 3: FUNCAO PARA APRENDER COM CORRECOES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_learn_from_correction()
RETURNS TRIGGER AS $$
DECLARE
  v_pattern_text TEXT;
  v_simplified_pattern TEXT;
  v_existing_pattern UUID;
  v_tx RECORD;
BEGIN
  -- So aprender se foi correcao
  IF NEW.feedback_type != 'corrected' THEN
    RETURN NEW;
  END IF;

  -- Buscar transacao original
  SELECT description INTO v_tx
  FROM bank_transactions
  WHERE id = NEW.entity_id;

  IF v_tx IS NULL THEN
    -- Usar snapshot se disponivel
    v_pattern_text := NEW.description_snapshot;
  ELSE
    v_pattern_text := v_tx.description;
  END IF;

  IF v_pattern_text IS NULL THEN
    RETURN NEW;
  END IF;

  -- Simplificar padrao (remover numeros variantes, manter palavras-chave)
  v_simplified_pattern := regexp_replace(v_pattern_text, '\d{2}/\d{2}/\d{4}', '', 'g'); -- Remove datas
  v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{2}:\d{2}(:\d{2})?', '', 'g'); -- Remove horas
  v_simplified_pattern := regexp_replace(v_simplified_pattern, 'R\$\s*[\d\.,]+', '', 'g'); -- Remove valores
  v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{14}', 'CNPJ', 'g'); -- Substitui CNPJ por placeholder
  v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{11}', 'CPF', 'g'); -- Substitui CPF por placeholder
  v_simplified_pattern := regexp_replace(v_simplified_pattern, '\s+', ' ', 'g'); -- Remove espacos extras
  v_simplified_pattern := TRIM(UPPER(v_simplified_pattern));

  -- Verificar se padrao ja existe
  SELECT id INTO v_existing_pattern
  FROM ai_classification_patterns
  WHERE tenant_id = NEW.tenant_id
    AND pattern_type = 'description'
    AND pattern_value->>'text' = v_simplified_pattern;

  IF v_existing_pattern IS NOT NULL THEN
    -- Atualizar padrao existente com nova correcao
    UPDATE ai_classification_patterns
    SET
      target_value = NEW.user_correction,
      failure_count = failure_count + 1,
      last_used_at = NOW()
    WHERE id = v_existing_pattern;
  ELSE
    -- Criar novo padrao
    INSERT INTO ai_classification_patterns (
      pattern_type,
      pattern_value,
      target_type,
      target_value,
      usage_count,
      success_count,
      tenant_id,
      created_by
    ) VALUES (
      'description',
      jsonb_build_object(
        'text', v_simplified_pattern,
        'original_example', v_pattern_text
      ),
      'client',
      NEW.user_correction,
      1,
      0, -- Comeca com 0 sucessos (foi uma correcao)
      NEW.tenant_id,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Trigger para aprender com correcoes
DROP TRIGGER IF EXISTS trg_learn_from_correction ON ai_classification_feedback;
CREATE TRIGGER trg_learn_from_correction
  AFTER INSERT ON ai_classification_feedback
  FOR EACH ROW
  EXECUTE FUNCTION fn_learn_from_correction();

-- ============================================================================
-- PARTE 4: FUNCAO PARA REGISTRAR CONFIRMACAO DE SUGESTAO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_confirm_suggestion(
  p_transaction_id UUID,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_pattern_text TEXT;
  v_simplified_pattern TEXT;
  v_pattern_id UUID;
BEGIN
  -- Buscar transacao
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transacao nao encontrada');
  END IF;

  -- Registrar feedback positivo
  INSERT INTO ai_classification_feedback (
    entity_type,
    entity_id,
    original_suggestion,
    feedback_type,
    description_snapshot,
    created_by,
    tenant_id
  ) VALUES (
    'bank_transaction',
    p_transaction_id,
    jsonb_build_object(
      'client_id', v_tx.suggested_client_id,
      'confidence', v_tx.identification_confidence,
      'method', v_tx.identification_method
    ),
    'confirmed',
    v_tx.description,
    p_user_id,
    v_tx.tenant_id
  );

  -- Se foi identificado por padrao, incrementar sucesso
  IF v_tx.identification_method = 'pattern_learned' THEN
    -- Simplificar descricao para encontrar padrao
    v_simplified_pattern := regexp_replace(UPPER(v_tx.description), '\d{2}/\d{2}/\d{4}', '', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{2}:\d{2}(:\d{2})?', '', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, 'R\$\s*[\d\.,]+', '', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{14}', 'CNPJ', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{11}', 'CPF', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\s+', ' ', 'g');
    v_simplified_pattern := TRIM(v_simplified_pattern);

    UPDATE ai_classification_patterns
    SET
      usage_count = usage_count + 1,
      success_count = success_count + 1,
      last_used_at = NOW()
    WHERE tenant_id = v_tx.tenant_id
      AND pattern_type = 'description'
      AND pattern_value->>'text' ILIKE '%' || LEFT(v_simplified_pattern, 50) || '%'
    RETURNING id INTO v_pattern_id;
  ELSE
    -- Para outros metodos, criar/atualizar padrao baseado na confirmacao
    v_simplified_pattern := regexp_replace(UPPER(v_tx.description), '\d{2}/\d{2}/\d{4}', '', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{2}:\d{2}(:\d{2})?', '', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, 'R\$\s*[\d\.,]+', '', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{14}', 'CNPJ', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\d{11}', 'CPF', 'g');
    v_simplified_pattern := regexp_replace(v_simplified_pattern, '\s+', ' ', 'g');
    v_simplified_pattern := TRIM(v_simplified_pattern);

    -- Verificar se ja existe padrao similar
    SELECT id INTO v_pattern_id
    FROM ai_classification_patterns
    WHERE tenant_id = v_tx.tenant_id
      AND pattern_type = 'description'
      AND pattern_value->>'text' = v_simplified_pattern;

    IF v_pattern_id IS NOT NULL THEN
      -- Incrementar uso e sucesso
      UPDATE ai_classification_patterns
      SET
        usage_count = usage_count + 1,
        success_count = success_count + 1,
        last_used_at = NOW()
      WHERE id = v_pattern_id;
    ELSE
      -- Criar novo padrao com base na confirmacao
      INSERT INTO ai_classification_patterns (
        pattern_type,
        pattern_value,
        target_type,
        target_value,
        usage_count,
        success_count,
        confidence_base,
        tenant_id,
        created_by
      ) VALUES (
        'description',
        jsonb_build_object(
          'text', v_simplified_pattern,
          'original_example', v_tx.description
        ),
        'client',
        jsonb_build_object(
          'client_id', v_tx.suggested_client_id,
          'method', v_tx.identification_method
        ),
        1,
        1, -- Ja comeca com 1 sucesso
        0.85,
        v_tx.tenant_id,
        p_user_id
      )
      RETURNING id INTO v_pattern_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pattern_id', v_pattern_id,
    'message', 'Confirmacao registrada com sucesso'
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 5: FUNCAO PARA REGISTRAR CORRECAO DO USUARIO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_register_correction(
  p_transaction_id UUID,
  p_correct_client_id UUID,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_client RECORD;
BEGIN
  -- Buscar transacao
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transacao nao encontrada');
  END IF;

  -- Buscar cliente correto
  SELECT id, name, accounting_account_id INTO v_client
  FROM clients WHERE id = p_correct_client_id;

  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente nao encontrado');
  END IF;

  -- Registrar feedback de correcao
  INSERT INTO ai_classification_feedback (
    entity_type,
    entity_id,
    original_suggestion,
    user_correction,
    feedback_type,
    description_snapshot,
    created_by,
    tenant_id
  ) VALUES (
    'bank_transaction',
    p_transaction_id,
    jsonb_build_object(
      'client_id', v_tx.suggested_client_id,
      'confidence', v_tx.identification_confidence,
      'method', v_tx.identification_method
    ),
    jsonb_build_object(
      'client_id', p_correct_client_id,
      'client_name', v_client.name,
      'accounting_account_id', v_client.accounting_account_id
    ),
    'corrected',
    v_tx.description,
    p_user_id,
    v_tx.tenant_id
  );

  -- Atualizar transacao com o cliente correto
  UPDATE bank_transactions
  SET
    suggested_client_id = p_correct_client_id,
    identification_method = 'user_correction',
    identification_confidence = 100,
    identification_reasoning = 'Corrigido manualmente pelo usuario'
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Correcao registrada e padrao aprendido'
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 6: FUNCAO PARA BUSCAR PADRAO CORRESPONDENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_find_matching_pattern(
  p_description TEXT,
  p_tenant_id UUID
) RETURNS TABLE(
  pattern_id UUID,
  client_id UUID,
  client_name TEXT,
  confidence NUMERIC,
  pattern_text TEXT
) AS $$
DECLARE
  v_simplified TEXT;
  v_pattern_record RECORD;
  v_pattern_text_value TEXT;
BEGIN
  -- Retornar vazio se parametros invalidos
  IF p_description IS NULL OR p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- Simplificar descricao para busca
  v_simplified := regexp_replace(UPPER(COALESCE(p_description, '')), '\d{2}/\d{2}/\d{4}', '', 'g');
  v_simplified := regexp_replace(v_simplified, '\d{2}:\d{2}(:\d{2})?', '', 'g');
  v_simplified := regexp_replace(v_simplified, 'R\$\s*[\d\.,]+', '', 'g');
  v_simplified := regexp_replace(v_simplified, '\d{14}', 'CNPJ', 'g');
  v_simplified := regexp_replace(v_simplified, '\d{11}', 'CPF', 'g');
  v_simplified := regexp_replace(v_simplified, '\s+', ' ', 'g');
  v_simplified := TRIM(v_simplified);

  -- Buscar padroes e verificar match
  FOR v_pattern_record IN
    SELECT
      p.id,
      p.target_value,
      p.effectiveness,
      p.pattern_value->>'text' as ptext
    FROM ai_classification_patterns p
    WHERE p.tenant_id = p_tenant_id
      AND p.pattern_type = 'description'
      AND p.effectiveness >= 0.7
      AND p.pattern_value->>'text' IS NOT NULL
    ORDER BY p.effectiveness DESC, p.usage_count DESC
  LOOP
    v_pattern_text_value := v_pattern_record.ptext;

    -- Verificar se ha match
    IF v_simplified ILIKE '%' || v_pattern_text_value || '%'
       OR v_pattern_text_value ILIKE '%' || LEFT(v_simplified, 30) || '%'
    THEN
      pattern_id := v_pattern_record.id;
      client_id := (v_pattern_record.target_value->>'client_id')::UUID;
      client_name := v_pattern_record.target_value->>'client_name';
      confidence := (v_pattern_record.effectiveness * 100)::NUMERIC;
      pattern_text := v_pattern_text_value;
      RETURN NEXT;
      RETURN; -- Retorna apenas o primeiro match
    END IF;
  END LOOP;

  -- Nenhum match encontrado
  RETURN;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 7: VIEW DE EFETIVIDADE DOS PADROES
-- ============================================================================

CREATE OR REPLACE VIEW v_pattern_effectiveness AS
SELECT
  tenant_id,
  pattern_type,
  target_type,
  COUNT(*) as total_patterns,
  ROUND(AVG(effectiveness) * 100, 1) as avg_effectiveness_pct,
  SUM(usage_count) as total_uses,
  SUM(success_count) as total_successes,
  SUM(failure_count) as total_failures,
  COUNT(*) FILTER (WHERE effectiveness >= 0.9) as high_confidence_patterns,
  COUNT(*) FILTER (WHERE effectiveness >= 0.7 AND effectiveness < 0.9) as medium_confidence_patterns,
  COUNT(*) FILTER (WHERE effectiveness < 0.7) as low_confidence_patterns
FROM ai_classification_patterns
GROUP BY tenant_id, pattern_type, target_type;

-- ============================================================================
-- PARTE 8: VIEW DE ESTATISTICAS DE APRENDIZADO
-- ============================================================================

CREATE OR REPLACE VIEW v_learning_stats AS
SELECT
  f.tenant_id,
  COUNT(*) as total_feedbacks,
  COUNT(*) FILTER (WHERE f.feedback_type = 'confirmed') as confirmations,
  COUNT(*) FILTER (WHERE f.feedback_type = 'corrected') as corrections,
  COUNT(*) FILTER (WHERE f.feedback_type = 'rejected') as rejections,
  ROUND(
    COUNT(*) FILTER (WHERE f.feedback_type = 'confirmed')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  ) as confirmation_rate_pct,
  COUNT(DISTINCT DATE(f.created_at)) as active_days,
  MAX(f.created_at) as last_feedback_at
FROM ai_classification_feedback f
GROUP BY f.tenant_id;

-- ============================================================================
-- PARTE 9: ATUALIZAR fn_identify_payer PARA USAR PADROES APRENDIDOS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_identify_payer(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_client RECORD;
  v_pattern RECORD;
  v_confidence NUMERIC;
  v_method TEXT;
  v_cnpj_digits TEXT;
  v_cpf_digits TEXT;
BEGIN
  -- Buscar transacao
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transacao nao encontrada');
  END IF;

  -- ESTRATEGIA 1: Match por CNPJ (100% confianca)
  IF v_tx.extracted_cnpj IS NOT NULL THEN
    v_cnpj_digits := regexp_replace(v_tx.extracted_cnpj, '[^\d]', '', 'g');

    SELECT * INTO v_client FROM fn_find_client_by_cnpj(v_cnpj_digits, v_tx.tenant_id);

    IF v_client.id IS NOT NULL THEN
      v_confidence := 100;
      v_method := 'cnpj_match';

      UPDATE bank_transactions SET
        suggested_client_id = v_client.id,
        identification_confidence = v_confidence,
        identification_method = v_method,
        identification_reasoning = 'CNPJ ' || v_tx.extracted_cnpj || ' corresponde ao cliente ' || v_client.name,
        auto_matched = true,
        needs_review = false
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.id,
        'client_name', v_client.name,
        'confidence', v_confidence,
        'method', v_method
      );
    END IF;
  END IF;

  -- ESTRATEGIA 2: Match por CPF no QSA (95% confianca)
  IF v_tx.extracted_cpf IS NOT NULL THEN
    v_cpf_digits := regexp_replace(v_tx.extracted_cpf, '[^\d]', '', 'g');

    SELECT * INTO v_client FROM fn_find_client_by_qsa_cpf(v_cpf_digits, v_tx.tenant_id);

    IF v_client.id IS NOT NULL THEN
      v_confidence := 95;
      v_method := 'qsa_match';

      UPDATE bank_transactions SET
        suggested_client_id = v_client.id,
        identification_confidence = v_confidence,
        identification_method = v_method,
        identification_reasoning = 'CPF ' || v_tx.extracted_cpf || ' e socio de ' || v_client.name,
        auto_matched = true,
        needs_review = false
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.id,
        'client_name', v_client.name,
        'confidence', v_confidence,
        'method', v_method
      );
    END IF;
  END IF;

  -- ESTRATEGIA 3: Match por padrao aprendido (confianca variavel)
  SELECT * INTO v_pattern
  FROM fn_find_matching_pattern(v_tx.description, v_tx.tenant_id);

  IF v_pattern.client_id IS NOT NULL THEN
    v_confidence := v_pattern.confidence;
    v_method := 'pattern_learned';

    -- Incrementar uso do padrao
    UPDATE ai_classification_patterns
    SET usage_count = usage_count + 1, last_used_at = NOW()
    WHERE id = v_pattern.pattern_id;

    UPDATE bank_transactions SET
      suggested_client_id = v_pattern.client_id,
      identification_confidence = v_confidence,
      identification_method = v_method,
      identification_reasoning = 'Padrao aprendido: ' || v_pattern.pattern_text,
      auto_matched = v_confidence >= 90,
      needs_review = v_confidence >= 70 AND v_confidence < 90
    WHERE id = p_transaction_id;

    RETURN jsonb_build_object(
      'success', true,
      'client_id', v_pattern.client_id,
      'client_name', v_pattern.client_name,
      'confidence', v_confidence,
      'method', v_method,
      'pattern_id', v_pattern.pattern_id
    );
  END IF;

  -- Nao identificado
  UPDATE bank_transactions SET
    identification_confidence = 0,
    identification_method = 'none',
    identification_reasoning = 'Nao foi possivel identificar o pagador automaticamente',
    needs_review = CASE WHEN v_tx.amount > 0 THEN true ELSE false END
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', false,
    'confidence', 0,
    'method', 'none',
    'message', 'Pagador nao identificado'
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- ============================================================================
-- PARTE 10: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_classification_patterns TO authenticated;
GRANT SELECT, INSERT ON ai_classification_feedback TO authenticated;
GRANT SELECT ON v_pattern_effectiveness TO authenticated;
GRANT SELECT ON v_learning_stats TO authenticated;
GRANT EXECUTE ON FUNCTION fn_confirm_suggestion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_register_correction(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_find_matching_pattern(TEXT, UUID) TO authenticated;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE ai_classification_patterns IS 'Padroes aprendidos pelo sistema para classificacao automatica';
COMMENT ON TABLE ai_classification_feedback IS 'Feedback do usuario sobre sugestoes da IA';
COMMENT ON FUNCTION fn_learn_from_correction() IS 'Trigger que aprende novos padroes a partir de correcoes';
COMMENT ON FUNCTION fn_confirm_suggestion(UUID, UUID) IS 'Registra confirmacao de sugestao correta da IA';
COMMENT ON FUNCTION fn_register_correction(UUID, UUID, UUID) IS 'Registra correcao do usuario e cria padrao para aprendizado';
COMMENT ON FUNCTION fn_find_matching_pattern(TEXT, UUID) IS 'Busca padrao aprendido correspondente a uma descricao';
COMMENT ON VIEW v_pattern_effectiveness IS 'Estatisticas de efetividade dos padroes por tenant';
COMMENT ON VIEW v_learning_stats IS 'Estatisticas gerais de aprendizado por tenant';
