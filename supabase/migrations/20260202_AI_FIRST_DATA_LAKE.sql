-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | AI-FIRST ARCHITECTURE - DATA LAKE DE CLASSIFICAÇÕES
-- Migration: 20260202_AI_FIRST_DATA_LAKE
-- Data: 02/02/2026
-- Autor: Dr. Cícero (Sistema Contta)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PRINCÍPIOS AI-FIRST:
-- 1. NENHUMA regra hardcoded - o agente decide com base em contexto
-- 2. Data Lake é fonte única de verdade - toda decisão é registrada
-- 3. RAG antes de decidir - agente consulta histórico e padrões
-- 4. Self-Healing - sistema detecta e corrige divergências automaticamente
--
-- IMPORTANTE: Este é um Data Lake de CLASSIFICAÇÕES CONTÁBEIS.
-- O DataLakePage.tsx existente é para DOCUMENTOS (XMLs, PDFs).
-- São estruturas diferentes e complementares.
--
-- COMPONENTES:
-- 1. Tabela classification_embeddings (vetores semânticos + classificação)
-- 2. RPC search_similar_classifications() - busca RAG via cosine distance
-- 3. RPC record_classification() - registra decisão
-- 4. RPC get_classification_context() - contexto completo para agente
-- ═══════════════════════════════════════════════════════════════════════════════

-- 0) Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) TABELA: classification_embeddings
-- Data Lake de classificações contábeis com embeddings para RAG
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.classification_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Transação original (descrição é a chave semântica)
  transaction_description TEXT NOT NULL,
  normalized_description TEXT NOT NULL,  -- UPPER, sem espaços extras
  transaction_amount NUMERIC(15,2),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),

  -- Classificação aplicada (a conta destino, não a transitória/banco)
  account_id UUID REFERENCES chart_of_accounts(id),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,

  -- Embedding (pgvector - OpenAI text-embedding-3-small = 1536 dimensões)
  embedding vector(1536),

  -- Feedback loop (aprendizado contínuo)
  confidence NUMERIC(5,4) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  validated BOOLEAN DEFAULT FALSE,
  was_corrected BOOLEAN DEFAULT FALSE,
  correction_reason TEXT,

  -- Rastreabilidade
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'rule', 'ai_agent', 'historical', 'self_healing')),
  source_reference TEXT,  -- ID da transação original, regra, etc.
  decision_reasoning TEXT,  -- Explicação da classificação

  -- Metadados para busca
  category_tags TEXT[],
  payer_name TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

-- Índice HNSW para busca vetorial via cosine distance (<=>)
CREATE INDEX IF NOT EXISTS idx_ce_embedding_hnsw
  ON classification_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_ce_tenant_direction
  ON classification_embeddings(tenant_id, direction);
CREATE INDEX IF NOT EXISTS idx_ce_account
  ON classification_embeddings(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_ce_description_trgm
  ON classification_embeddings USING GIN(normalized_description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ce_tags
  ON classification_embeddings USING GIN(category_tags);

-- RLS
ALTER TABLE classification_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - embeddings" ON classification_embeddings
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "Service role full access - embeddings" ON classification_embeddings
  FOR ALL TO service_role USING (true);

COMMENT ON TABLE classification_embeddings IS
'AI-FIRST: Data Lake de classificações contábeis com embeddings para RAG. Cada registro representa uma decisão de classificação que serve como conhecimento para futuras decisões.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) RPC: search_similar_classifications()
-- Busca RAG por classificações similares usando cosine distance (<=>)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_similar_classifications(
  p_tenant_id UUID,
  p_embedding vector(1536),
  p_direction TEXT,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  transaction_description TEXT,
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  confidence NUMERIC,
  similarity NUMERIC,
  category_tags TEXT[],
  decision_reasoning TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH similar AS (
    SELECT
      ce.id,
      ce.transaction_description,
      ce.account_id,
      ce.account_code,
      ce.account_name,
      ce.confidence,
      -- Cosine similarity = 1 - cosine distance
      (1 - (ce.embedding <=> p_embedding))::NUMERIC AS similarity,
      ce.category_tags,
      ce.decision_reasoning
    FROM classification_embeddings ce
    WHERE ce.tenant_id = p_tenant_id
      AND ce.direction = p_direction
      AND ce.was_corrected = FALSE
      AND ce.embedding IS NOT NULL
    ORDER BY ce.embedding <=> p_embedding  -- Cosine distance ordering
    LIMIT p_limit * 3  -- Pegar mais para agrupar por conta
  ),
  with_count AS (
    SELECT
      s.*,
      COUNT(*) OVER (PARTITION BY s.account_code) AS usage_count
    FROM similar s
  )
  SELECT DISTINCT ON (w.account_code)
    w.id,
    w.transaction_description,
    w.account_id,
    w.account_code,
    w.account_name,
    ROUND(w.confidence, 4),
    ROUND(w.similarity, 4),
    w.category_tags,
    w.decision_reasoning,
    w.usage_count
  FROM with_count w
  WHERE w.similarity >= 0.5  -- Threshold mínimo de 50%
  ORDER BY w.account_code, w.similarity DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_similar_classifications(UUID, vector(1536), TEXT, INT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.search_similar_classifications IS
'RAG: Busca classificações similares usando cosine distance (<=>). Retorna TOP N contas distintas mais similares.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) RPC: search_classifications_by_text()
-- Busca RAG por texto usando trigramas (fallback quando não tem embedding)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_classifications_by_text(
  p_tenant_id UUID,
  p_description TEXT,
  p_direction TEXT,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  transaction_description TEXT,
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  confidence NUMERIC,
  text_similarity NUMERIC,
  category_tags TEXT[],
  decision_reasoning TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  -- Normalizar descrição de busca
  v_normalized := UPPER(TRIM(regexp_replace(p_description, '\s+', ' ', 'g')));

  RETURN QUERY
  WITH candidates AS (
    SELECT
      ce.id,
      ce.transaction_description,
      ce.normalized_description,
      ce.account_id,
      ce.account_code,
      ce.account_name,
      ce.confidence,
      ce.category_tags,
      ce.decision_reasoning,
      -- Similaridade por trigramas
      similarity(ce.normalized_description, v_normalized) AS trgm_sim
    FROM classification_embeddings ce
    WHERE ce.tenant_id = p_tenant_id
      AND ce.direction = p_direction
      AND ce.was_corrected = FALSE
      -- Filtro rápido usando índice GIN de trigramas
      AND ce.normalized_description % v_normalized
  ),
  with_count AS (
    SELECT
      c.*,
      COUNT(*) OVER (PARTITION BY c.account_code) AS usage_count
    FROM candidates c
  )
  SELECT DISTINCT ON (w.account_code)
    w.id,
    w.transaction_description,
    w.account_id,
    w.account_code,
    w.account_name,
    ROUND(w.confidence, 4),
    ROUND(w.trgm_sim::NUMERIC, 4) AS text_similarity,
    w.category_tags,
    w.decision_reasoning,
    w.usage_count
  FROM with_count w
  WHERE w.trgm_sim >= 0.3  -- Threshold mínimo 30%
  ORDER BY w.account_code, w.trgm_sim DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_classifications_by_text(UUID, TEXT, TEXT, INT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.search_classifications_by_text IS
'RAG: Busca classificações por similaridade textual (trigramas). Usar quando não tiver embedding pronto.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4) RPC: record_classification()
-- Registra uma decisão de classificação no Data Lake (feedback loop)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.record_classification(
  p_tenant_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_account_id UUID,
  p_source TEXT DEFAULT 'ai_agent',
  p_confidence NUMERIC DEFAULT 0.9,
  p_reasoning TEXT DEFAULT NULL,
  p_payer_name TEXT DEFAULT NULL,
  p_category_tags TEXT[] DEFAULT NULL,
  p_source_reference TEXT DEFAULT NULL,
  p_embedding vector(1536) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_direction TEXT;
  v_normalized TEXT;
  v_account_code TEXT;
  v_account_name TEXT;
BEGIN
  -- Determinar direção baseada no valor
  v_direction := CASE WHEN p_amount > 0 THEN 'credit' ELSE 'debit' END;

  -- Normalizar descrição para busca
  v_normalized := UPPER(TRIM(regexp_replace(p_description, '\s+', ' ', 'g')));

  -- Buscar dados da conta
  SELECT code, name INTO v_account_code, v_account_name
  FROM chart_of_accounts WHERE id = p_account_id;

  IF v_account_code IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada: %', p_account_id;
  END IF;

  -- Inserir no Data Lake
  INSERT INTO classification_embeddings (
    tenant_id,
    transaction_description,
    normalized_description,
    transaction_amount,
    direction,
    account_id,
    account_code,
    account_name,
    embedding,
    confidence,
    validated,
    source,
    source_reference,
    decision_reasoning,
    category_tags,
    payer_name
  ) VALUES (
    p_tenant_id,
    p_description,
    v_normalized,
    p_amount,
    v_direction,
    p_account_id,
    v_account_code,
    v_account_name,
    p_embedding,
    p_confidence,
    (p_source = 'manual'),  -- Manual = validado
    p_source,
    p_source_reference,
    p_reasoning,
    p_category_tags,
    p_payer_name
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_classification(
  UUID, TEXT, NUMERIC, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT[], TEXT, vector(1536)
) TO authenticated, service_role;

COMMENT ON FUNCTION public.record_classification IS
'AI-FIRST: Registra decisão de classificação no Data Lake. Cada registro alimenta o RAG.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5) RPC: get_classification_context()
-- Retorna contexto completo para o agente tomar decisão (RAG)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_classification_context(
  p_tenant_id UUID,
  p_description TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_direction TEXT;
  v_similar_by_text JSONB;
  v_top_accounts JSONB;
  v_stats JSONB;
  v_payer_name TEXT;
BEGIN
  -- Determinar direção
  v_direction := CASE WHEN p_amount > 0 THEN 'credit' ELSE 'debit' END;

  -- Buscar classificações similares por texto (sem embedding)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_similar_by_text
  FROM (
    SELECT
      transaction_description,
      account_code,
      account_name,
      text_similarity,
      usage_count
    FROM search_classifications_by_text(p_tenant_id, p_description, v_direction, 5)
  ) t;

  -- Top contas mais usadas para esta direção
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_top_accounts
  FROM (
    SELECT
      account_code,
      account_name,
      COUNT(*) AS usage_count,
      ROUND(AVG(confidence)::NUMERIC, 2) AS avg_confidence
    FROM classification_embeddings
    WHERE tenant_id = p_tenant_id
      AND direction = v_direction
      AND was_corrected = FALSE
    GROUP BY account_code, account_name
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) t;

  -- Estatísticas do Data Lake
  SELECT jsonb_build_object(
    'total_classifications', COUNT(*),
    'avg_confidence', ROUND(AVG(confidence)::NUMERIC, 3),
    'correction_rate', ROUND(
      COUNT(*) FILTER (WHERE was_corrected)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      1
    ),
    'by_source', jsonb_build_object(
      'ai_agent', COUNT(*) FILTER (WHERE source = 'ai_agent'),
      'manual', COUNT(*) FILTER (WHERE source = 'manual'),
      'historical', COUNT(*) FILTER (WHERE source = 'historical'),
      'rule', COUNT(*) FILTER (WHERE source = 'rule')
    )
  )
  INTO v_stats
  FROM classification_embeddings
  WHERE tenant_id = p_tenant_id
    AND direction = v_direction;

  -- Extrair nome do pagador
  v_payer_name := CASE
    WHEN p_description ~* 'PIX.*DE\s+(.+)$' THEN
      TRIM(regexp_replace(p_description, '.*PIX.*DE\s+', '', 'i'))
    WHEN p_description ~* 'RECEBIMENTO.*-\s*(.+)$' THEN
      TRIM(regexp_replace(p_description, '.*RECEBIMENTO.*-\s*', '', 'i'))
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'transaction', jsonb_build_object(
      'description', p_description,
      'amount', p_amount,
      'direction', v_direction,
      'extracted_payer', v_payer_name
    ),
    'similar_classifications', v_similar_by_text,
    'top_accounts', v_top_accounts,
    'data_lake_stats', v_stats,
    'recommendation', CASE
      WHEN jsonb_array_length(v_similar_by_text) > 0 AND
           (v_similar_by_text->0->>'text_similarity')::NUMERIC >= 0.7 THEN
        jsonb_build_object(
          'action', 'USE_SIMILAR',
          'account_code', v_similar_by_text->0->>'account_code',
          'account_name', v_similar_by_text->0->>'account_name',
          'confidence', 'high',
          'reason', 'Match por similaridade textual >= 70%'
        )
      WHEN jsonb_array_length(v_similar_by_text) > 0 THEN
        jsonb_build_object(
          'action', 'REVIEW_OPTIONS',
          'confidence', 'medium',
          'reason', 'Similaridade abaixo de 70% - requer análise'
        )
      ELSE
        jsonb_build_object(
          'action', 'NEW_CLASSIFICATION',
          'confidence', 'low',
          'reason', 'Nenhuma classificação similar encontrada - usar análise contextual'
        )
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_classification_context(UUID, TEXT, NUMERIC)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_classification_context IS
'AI-FIRST: Retorna contexto completo (RAG) para agente tomar decisão de classificação.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6) RPC: mark_classification_corrected()
-- Marca uma classificação como corrigida (feedback negativo - não usar no RAG)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mark_classification_corrected(
  p_id UUID,
  p_correction_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE classification_embeddings
  SET
    was_corrected = TRUE,
    correction_reason = p_correction_reason,
    updated_at = NOW()
  WHERE id = p_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_classification_corrected(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.mark_classification_corrected IS
'Feedback negativo: marca classificação como incorreta para exclusão do RAG.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7) RPC: update_embedding()
-- Atualiza o embedding de uma classificação existente
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_classification_embedding(
  p_id UUID,
  p_embedding vector(1536)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE classification_embeddings
  SET embedding = p_embedding, updated_at = NOW()
  WHERE id = p_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_classification_embedding(UUID, vector(1536))
  TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8) VIEW: vw_classification_metrics
-- Métricas de aprendizado do sistema AI-First
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.vw_classification_metrics AS
SELECT
  tenant_id,
  COUNT(*) AS total_classifications,
  COUNT(*) FILTER (WHERE source = 'ai_agent') AS ai_classifications,
  COUNT(*) FILTER (WHERE source = 'manual') AS manual_classifications,
  COUNT(*) FILTER (WHERE source = 'historical') AS historical_classifications,
  COUNT(*) FILTER (WHERE source = 'rule') AS rule_classifications,
  COUNT(*) FILTER (WHERE was_corrected) AS corrected_count,
  ROUND(
    COUNT(*) FILTER (WHERE was_corrected)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    2
  ) AS correction_rate_percent,
  ROUND(AVG(confidence)::NUMERIC, 3) AS avg_confidence,
  COUNT(DISTINCT account_code) AS unique_accounts,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS pending_embeddings,
  MIN(created_at) AS first_classification,
  MAX(created_at) AS last_classification
FROM classification_embeddings
GROUP BY tenant_id;

COMMENT ON VIEW vw_classification_metrics IS
'Métricas de aprendizado do sistema AI-First de classificação.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9) VIEW: vw_pending_embeddings
-- Classificações que precisam de embedding gerado
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.vw_pending_embeddings AS
SELECT
  id,
  tenant_id,
  transaction_description,
  normalized_description,
  direction,
  account_code,
  account_name
FROM classification_embeddings
WHERE embedding IS NULL
  AND was_corrected = FALSE
ORDER BY created_at DESC;

COMMENT ON VIEW vw_pending_embeddings IS
'Classificações que ainda não têm embedding gerado (para processamento batch).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10) TRIGGER: auto_update_timestamp
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_classification_embeddings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classification_embeddings_updated ON classification_embeddings;
CREATE TRIGGER trg_classification_embeddings_updated
  BEFORE UPDATE ON classification_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_classification_embeddings_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ AI-FIRST DATA LAKE ARCHITECTURE instalada com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabela principal:';
  RAISE NOTICE '  - classification_embeddings (Data Lake de classificações + vetores)';
  RAISE NOTICE '';
  RAISE NOTICE 'RPCs disponíveis:';
  RAISE NOTICE '  - search_similar_classifications(tenant, embedding, direction, limit)';
  RAISE NOTICE '      → Busca RAG via cosine distance (<=>)';
  RAISE NOTICE '  - search_classifications_by_text(tenant, description, direction, limit)';
  RAISE NOTICE '      → Busca fallback via trigramas';
  RAISE NOTICE '  - record_classification(tenant, description, amount, account_id, ...)';
  RAISE NOTICE '      → Registra decisão no Data Lake (feedback loop)';
  RAISE NOTICE '  - get_classification_context(tenant, description, amount)';
  RAISE NOTICE '      → Retorna contexto completo para o agente decidir';
  RAISE NOTICE '  - mark_classification_corrected(id, reason)';
  RAISE NOTICE '      → Feedback negativo (exclui do RAG)';
  RAISE NOTICE '  - update_classification_embedding(id, embedding)';
  RAISE NOTICE '      → Atualiza embedding de classificação existente';
  RAISE NOTICE '';
  RAISE NOTICE 'Views:';
  RAISE NOTICE '  - vw_classification_metrics';
  RAISE NOTICE '  - vw_pending_embeddings';
  RAISE NOTICE '';
  RAISE NOTICE 'PRINCÍPIOS AI-FIRST IMPLEMENTADOS:';
  RAISE NOTICE '  ✓ Nenhuma regra hardcoded - agente decide com contexto';
  RAISE NOTICE '  ✓ Data Lake como fonte única de verdade';
  RAISE NOTICE '  ✓ RAG antes de decidir (cosine distance + trigramas)';
  RAISE NOTICE '  ✓ Feedback loop (classificações corrigidas excluídas do RAG)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END $$;
