-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | ARQUITETURA AI-FIRST - DATA LAKE & RAG
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- Este script implementa a infraestrutura para classificação baseada em IA:
-- 1. Extensão pgvector para embeddings
-- 2. Tabela de embeddings de classificações
-- 3. RPCs para busca por similaridade
-- 4. Feedback loop para aprendizado
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. HABILITAR PGVECTOR (se não existir)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TABELA: classification_knowledge (Data Lake de Conhecimento)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Armazena cada classificação aprovada como conhecimento reutilizável

CREATE TABLE IF NOT EXISTS public.classification_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Dados da transação original
  original_description TEXT NOT NULL,
  normalized_description TEXT NOT NULL,  -- UPPER, sem acentos, limpo
  amount NUMERIC(15,2),
  direction TEXT CHECK (direction IN ('credit', 'debit')),
  
  -- Classificação aplicada
  destination_account_id UUID REFERENCES chart_of_accounts(id),
  destination_account_code TEXT,
  destination_account_name TEXT,
  
  -- Contexto semântico
  embedding vector(1536),  -- OpenAI ada-002 ou similar
  keywords TEXT[],         -- Palavras-chave extraídas
  category TEXT,           -- Categoria inferida (tarifa, honorario, etc)
  
  -- Rastreabilidade
  source_entry_id UUID REFERENCES accounting_entries(id),
  source_transaction_id UUID REFERENCES bank_transactions(id),
  
  -- Feedback e confiança
  times_used INT DEFAULT 1,
  times_approved INT DEFAULT 1,
  times_rejected INT DEFAULT 0,
  confidence_score NUMERIC(5,2) DEFAULT 100.00,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'dr-cicero',
  
  -- Índices para busca
  CONSTRAINT unique_classification_knowledge UNIQUE (tenant_id, normalized_description, destination_account_id)
);

-- Índice para busca vetorial (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_classification_knowledge_embedding 
ON classification_knowledge USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Índice para busca textual
CREATE INDEX IF NOT EXISTS idx_classification_knowledge_description 
ON classification_knowledge USING gin (to_tsvector('portuguese', normalized_description));

-- Índice para keywords
CREATE INDEX IF NOT EXISTS idx_classification_knowledge_keywords 
ON classification_knowledge USING gin (keywords);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. TABELA: classification_decisions (Histórico de Decisões)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Registra TODA decisão de classificação para auditoria e aprendizado

CREATE TABLE IF NOT EXISTS public.classification_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Transação avaliada
  transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
  transaction_description TEXT,
  transaction_amount NUMERIC(15,2),
  
  -- Decisão tomada
  decision_type TEXT CHECK (decision_type IN ('auto', 'suggested', 'manual', 'rejected')),
  suggested_account_id UUID REFERENCES chart_of_accounts(id),
  final_account_id UUID REFERENCES chart_of_accounts(id),
  
  -- Base da decisão (RAG)
  similar_knowledge_ids UUID[],  -- IDs do classification_knowledge usados
  similarity_scores NUMERIC[],   -- Scores de similaridade
  reasoning TEXT,                -- Explicação da decisão
  
  -- Resultado
  was_approved BOOLEAN,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_time_ms INT
);

CREATE INDEX IF NOT EXISTS idx_classification_decisions_transaction 
ON classification_decisions(transaction_id);

CREATE INDEX IF NOT EXISTS idx_classification_decisions_tenant_date 
ON classification_decisions(tenant_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. FUNÇÃO: Normalizar descrição
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION normalize_description(p_description TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(
    TRIM(
      regexp_replace(
        regexp_replace(
          translate(p_description, 
            'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
          ),
          '[^A-Za-z0-9 ]', ' ', 'g'  -- Remove caracteres especiais
        ),
        '\s+', ' ', 'g'  -- Múltiplos espaços → um
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. FUNÇÃO: Extrair keywords
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION extract_keywords(p_description TEXT)
RETURNS TEXT[] AS $$
DECLARE
  v_normalized TEXT;
  v_words TEXT[];
  v_stopwords TEXT[] := ARRAY[
    'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'PARA', 'POR', 'COM',
    'PIX', 'RECEBIDO', 'ENVIADO', 'PAGAMENTO', 'TRANSFERENCIA',
    'SICREDI', 'BANCO', 'AGENCIA', 'CONTA'
  ];
BEGIN
  v_normalized := normalize_description(p_description);
  
  -- Separar palavras
  v_words := string_to_array(v_normalized, ' ');
  
  -- Filtrar stopwords e palavras muito curtas
  SELECT array_agg(w) INTO v_words
  FROM unnest(v_words) w
  WHERE length(w) > 2 
    AND w != ANY(v_stopwords);
  
  RETURN COALESCE(v_words, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. RPC: search_similar_classifications
-- ═══════════════════════════════════════════════════════════════════════════════
-- Busca classificações similares usando keywords (fallback sem embedding)

CREATE OR REPLACE FUNCTION search_similar_classifications(
  p_tenant UUID,
  p_description TEXT,
  p_direction TEXT DEFAULT NULL,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  knowledge_id UUID,
  original_description TEXT,
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  similarity_score NUMERIC,
  times_used INT,
  confidence NUMERIC
) AS $$
DECLARE
  v_normalized TEXT;
  v_keywords TEXT[];
BEGIN
  v_normalized := normalize_description(p_description);
  v_keywords := extract_keywords(p_description);
  
  RETURN QUERY
  SELECT 
    ck.id AS knowledge_id,
    ck.original_description,
    ck.destination_account_id AS account_id,
    ck.destination_account_code AS account_code,
    ck.destination_account_name AS account_name,
    -- Score baseado em keywords em comum
    (
      SELECT COUNT(*)::NUMERIC / GREATEST(array_length(v_keywords, 1), 1)
      FROM unnest(v_keywords) kw
      WHERE kw = ANY(ck.keywords)
    ) * 100 AS similarity_score,
    ck.times_used,
    ck.confidence_score AS confidence
  FROM classification_knowledge ck
  WHERE ck.tenant_id = p_tenant
    AND (p_direction IS NULL OR ck.direction = p_direction)
    AND (
      -- Match por keywords
      ck.keywords && v_keywords
      -- OU match por texto similar
      OR ck.normalized_description % v_normalized  -- trigram similarity
    )
  ORDER BY 
    -- Priorizar matches exatos
    CASE WHEN ck.normalized_description = v_normalized THEN 0 ELSE 1 END,
    -- Depois por similaridade
    similarity(ck.normalized_description, v_normalized) DESC,
    -- Depois por confiança
    ck.confidence_score DESC,
    -- Depois por uso
    ck.times_used DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. RPC: get_ai_classification_suggestion
-- ═══════════════════════════════════════════════════════════════════════════════
-- Retorna sugestão de classificação baseada em RAG

CREATE OR REPLACE FUNCTION get_ai_classification_suggestion(
  p_tenant UUID,
  p_transaction_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_suggestion RECORD;
BEGIN
  -- Buscar transação
  SELECT * INTO v_tx
  FROM bank_transactions
  WHERE id = p_transaction_id AND tenant_id = p_tenant;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transação não encontrada');
  END IF;
  
  -- Buscar classificações similares
  SELECT * INTO v_suggestion
  FROM search_similar_classifications(
    p_tenant,
    v_tx.description,
    CASE WHEN v_tx.amount > 0 THEN 'credit' ELSE 'debit' END,
    3
  )
  LIMIT 1;
  
  -- Montar resposta
  IF v_suggestion.knowledge_id IS NOT NULL AND v_suggestion.similarity_score >= 50 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'has_suggestion', true,
      'confidence', LEAST(v_suggestion.similarity_score, v_suggestion.confidence),
      'suggestion', jsonb_build_object(
        'account_id', v_suggestion.account_id,
        'account_code', v_suggestion.account_code,
        'account_name', v_suggestion.account_name,
        'based_on', v_suggestion.original_description,
        'knowledge_id', v_suggestion.knowledge_id,
        'times_used', v_suggestion.times_used
      ),
      'reasoning', format(
        'Baseado em classificação anterior: "%s" → %s (%s vezes usado, %s%% confiança)',
        v_suggestion.original_description,
        v_suggestion.account_code,
        v_suggestion.times_used,
        ROUND(v_suggestion.confidence)
      )
    );
  ELSE
    RETURN jsonb_build_object(
      'ok', true,
      'has_suggestion', false,
      'confidence', 0,
      'reasoning', 'Nenhuma classificação similar encontrada. Requer análise manual.'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. RPC: learn_from_classification
-- ═══════════════════════════════════════════════════════════════════════════════
-- Aprende com uma classificação aprovada (feedback loop)

CREATE OR REPLACE FUNCTION learn_from_classification(
  p_tenant UUID,
  p_transaction_id UUID,
  p_entry_id UUID,
  p_account_id UUID,
  p_approved_by TEXT DEFAULT 'dr-cicero'
)
RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_account RECORD;
  v_normalized TEXT;
  v_keywords TEXT[];
  v_knowledge_id UUID;
BEGIN
  -- Buscar transação
  SELECT * INTO v_tx
  FROM bank_transactions
  WHERE id = p_transaction_id AND tenant_id = p_tenant;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transação não encontrada');
  END IF;
  
  -- Buscar conta
  SELECT id, code, name INTO v_account
  FROM chart_of_accounts
  WHERE id = p_account_id AND tenant_id = p_tenant;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Conta não encontrada');
  END IF;
  
  -- Normalizar e extrair keywords
  v_normalized := normalize_description(v_tx.description);
  v_keywords := extract_keywords(v_tx.description);
  
  -- Inserir ou atualizar conhecimento
  INSERT INTO classification_knowledge (
    tenant_id,
    original_description,
    normalized_description,
    amount,
    direction,
    destination_account_id,
    destination_account_code,
    destination_account_name,
    keywords,
    source_entry_id,
    source_transaction_id,
    created_by,
    last_used_at
  ) VALUES (
    p_tenant,
    v_tx.description,
    v_normalized,
    ABS(v_tx.amount),
    CASE WHEN v_tx.amount > 0 THEN 'credit' ELSE 'debit' END,
    p_account_id,
    v_account.code,
    v_account.name,
    v_keywords,
    p_entry_id,
    p_transaction_id,
    p_approved_by,
    NOW()
  )
  ON CONFLICT (tenant_id, normalized_description, destination_account_id) 
  DO UPDATE SET
    times_used = classification_knowledge.times_used + 1,
    times_approved = classification_knowledge.times_approved + 1,
    confidence_score = LEAST(100, classification_knowledge.confidence_score + 5),
    last_used_at = NOW()
  RETURNING id INTO v_knowledge_id;
  
  RETURN jsonb_build_object(
    'ok', true,
    'knowledge_id', v_knowledge_id,
    'learned_from', v_tx.description,
    'account', v_account.code || ' - ' || v_account.name,
    'keywords', v_keywords
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. RPC: index_january_classifications
-- ═══════════════════════════════════════════════════════════════════════════════
-- Indexa todas as classificações de Janeiro no Data Lake

CREATE OR REPLACE FUNCTION index_january_classifications(p_tenant UUID)
RETURNS JSONB AS $$
DECLARE
  v_count INT := 0;
  v_errors INT := 0;
  r RECORD;
BEGIN
  -- Buscar classificações de Janeiro que ainda não foram indexadas
  FOR r IN
    SELECT 
      ae.id AS entry_id,
      ae.reference_id AS transaction_id,
      bt.description,
      bt.amount,
      ael.account_id,
      coa.code AS account_code,
      coa.name AS account_name
    FROM accounting_entries ae
    JOIN bank_transactions bt ON bt.id = ae.reference_id
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE ae.tenant_id = p_tenant
      AND ae.source_type = 'classification'
      AND ae.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
      -- Pegar a conta que NÃO é transitória
      AND coa.code NOT LIKE '1.1.9.%'
      AND coa.code NOT LIKE '2.1.9.%'
      -- Não já indexado
      AND NOT EXISTS (
        SELECT 1 FROM classification_knowledge ck
        WHERE ck.source_entry_id = ae.id
      )
  LOOP
    BEGIN
      PERFORM learn_from_classification(
        p_tenant,
        r.transaction_id,
        r.entry_id,
        r.account_id,
        'indexador-janeiro'
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'ok', true,
    'indexed', v_count,
    'errors', v_errors,
    'message', format('Indexadas %s classificações de Janeiro', v_count)
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. RPC: classify_with_ai
-- ═══════════════════════════════════════════════════════════════════════════════
-- Classifica uma transação usando RAG (substitui regras hardcoded)

CREATE OR REPLACE FUNCTION classify_with_ai(
  p_tenant UUID,
  p_transaction_id UUID,
  p_created_by TEXT DEFAULT 'dr-cicero'
)
RETURNS JSONB AS $$
DECLARE
  v_suggestion JSONB;
  v_tx RECORD;
  v_entry_id UUID;
  v_decision_id UUID;
  v_trans_debit_id UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
  v_trans_credit_id UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1';
  v_account_id UUID;
  v_abs_amount NUMERIC;
BEGIN
  -- Obter sugestão
  v_suggestion := get_ai_classification_suggestion(p_tenant, p_transaction_id);
  
  IF NOT (v_suggestion->>'ok')::boolean THEN
    RETURN v_suggestion;
  END IF;
  
  -- Se não tem sugestão com confiança suficiente, retornar para revisão
  IF NOT (v_suggestion->>'has_suggestion')::boolean OR 
     (v_suggestion->>'confidence')::numeric < 70 THEN
    
    -- Registrar decisão pendente
    INSERT INTO classification_decisions (
      tenant_id, transaction_id, decision_type, reasoning, was_approved
    ) VALUES (
      p_tenant, p_transaction_id, 'suggested', 
      v_suggestion->>'reasoning', false
    );
    
    RETURN jsonb_build_object(
      'ok', true,
      'classified', false,
      'reason', 'Confiança insuficiente para classificação automática',
      'confidence', v_suggestion->>'confidence',
      'suggestion', v_suggestion->'suggestion'
    );
  END IF;
  
  -- Buscar transação
  SELECT * INTO v_tx
  FROM bank_transactions
  WHERE id = p_transaction_id AND tenant_id = p_tenant;
  
  v_account_id := (v_suggestion->'suggestion'->>'account_id')::UUID;
  v_abs_amount := ABS(v_tx.amount);
  
  -- Criar lançamento de classificação
  v_entry_id := gen_random_uuid();
  
  INSERT INTO accounting_entries (
    id, tenant_id, entry_date, competence_date,
    description, internal_code, source_type,
    entry_type, reference_type, reference_id,
    created_by
  ) VALUES (
    v_entry_id, p_tenant, v_tx.transaction_date, v_tx.transaction_date,
    format('AI: %s → %s', LEFT(v_tx.description, 40), v_suggestion->'suggestion'->>'account_code'),
    'AI_CLASS_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || LEFT(v_tx.fitid, 8),
    'classification',
    'CLASSIFICACAO', 'bank_transaction', p_transaction_id,
    p_created_by
  );
  
  -- Linhas do lançamento
  IF v_tx.amount > 0 THEN
    -- Entrada: D-Transitória Créditos / C-Conta destino
    INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (gen_random_uuid(), p_tenant, v_entry_id, v_trans_credit_id, v_abs_amount, 0, 'Baixa transitória'),
      (gen_random_uuid(), p_tenant, v_entry_id, v_account_id, 0, v_abs_amount, 'Classificado via AI');
  ELSE
    -- Saída: D-Conta destino / C-Transitória Débitos
    INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (gen_random_uuid(), p_tenant, v_entry_id, v_account_id, v_abs_amount, 0, 'Classificado via AI'),
      (gen_random_uuid(), p_tenant, v_entry_id, v_trans_debit_id, 0, v_abs_amount, 'Baixa transitória');
  END IF;
  
  -- Registrar decisão
  INSERT INTO classification_decisions (
    tenant_id, transaction_id, decision_type,
    suggested_account_id, final_account_id,
    similar_knowledge_ids, reasoning,
    was_approved, approved_by, approved_at
  ) VALUES (
    p_tenant, p_transaction_id, 'auto',
    v_account_id, v_account_id,
    ARRAY[(v_suggestion->'suggestion'->>'knowledge_id')::UUID],
    v_suggestion->>'reasoning',
    true, 'auto-ai', NOW()
  ) RETURNING id INTO v_decision_id;
  
  -- Feedback: aprender com esta classificação
  PERFORM learn_from_classification(p_tenant, p_transaction_id, v_entry_id, v_account_id, 'auto-ai');
  
  RETURN jsonb_build_object(
    'ok', true,
    'classified', true,
    'entry_id', v_entry_id,
    'decision_id', v_decision_id,
    'account', v_suggestion->'suggestion'->>'account_code',
    'confidence', v_suggestion->>'confidence',
    'reasoning', v_suggestion->>'reasoning'
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. RPC: classify_month_with_ai
-- ═══════════════════════════════════════════════════════════════════════════════
-- Classifica todas as transações de um mês usando AI

CREATE OR REPLACE FUNCTION classify_month_with_ai(
  p_tenant UUID,
  p_start DATE,
  p_end DATE
)
RETURNS JSONB AS $$
DECLARE
  v_classified INT := 0;
  v_pending INT := 0;
  v_errors INT := 0;
  v_result JSONB;
  r RECORD;
BEGIN
  -- Processar cada transação não classificada
  FOR r IN
    SELECT bt.id
    FROM bank_transactions bt
    WHERE bt.tenant_id = p_tenant
      AND bt.transaction_date BETWEEN p_start AND p_end
      AND bt.journal_entry_id IS NOT NULL  -- Tem OFX entry
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.reference_id = bt.id
          AND ae.source_type = 'classification'
      )
  LOOP
    BEGIN
      v_result := classify_with_ai(p_tenant, r.id, 'batch-ai');
      
      IF (v_result->>'classified')::boolean THEN
        v_classified := v_classified + 1;
      ELSE
        v_pending := v_pending + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'ok', true,
    'classified', v_classified,
    'pending_review', v_pending,
    'errors', v_errors,
    'message', format('AI classificou %s transações, %s para revisão', v_classified, v_pending)
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. HABILITAR EXTENSÃO pg_trgm (para similaridade de texto)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para busca por similaridade
CREATE INDEX IF NOT EXISTS idx_classification_knowledge_trgm 
ON classification_knowledge USING gin (normalized_description gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════
GRANT ALL ON classification_knowledge TO authenticated;
GRANT ALL ON classification_knowledge TO service_role;
GRANT ALL ON classification_decisions TO authenticated;
GRANT ALL ON classification_decisions TO service_role;

GRANT EXECUTE ON FUNCTION normalize_description(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION extract_keywords(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_similar_classifications(UUID, TEXT, TEXT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_ai_classification_suggestion(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION learn_from_classification(UUID, UUID, UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION index_january_classifications(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION classify_with_ai(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION classify_month_with_ai(UUID, DATE, DATE) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'CONTTA AI-FIRST ARCHITECTURE - INSTALAÇÃO COMPLETA';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  • classification_knowledge (Data Lake de conhecimento)';
  RAISE NOTICE '  • classification_decisions (Histórico de decisões)';
  RAISE NOTICE '';
  RAISE NOTICE 'Funções criadas:';
  RAISE NOTICE '  • normalize_description(text)';
  RAISE NOTICE '  • extract_keywords(text)';
  RAISE NOTICE '  • search_similar_classifications(tenant, desc, dir, limit)';
  RAISE NOTICE '  • get_ai_classification_suggestion(tenant, transaction_id)';
  RAISE NOTICE '  • learn_from_classification(tenant, tx_id, entry_id, account_id)';
  RAISE NOTICE '  • index_january_classifications(tenant)';
  RAISE NOTICE '  • classify_with_ai(tenant, transaction_id)';
  RAISE NOTICE '  • classify_month_with_ai(tenant, start, end)';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '  1. Execute: SELECT index_january_classifications(tenant_id)';
  RAISE NOTICE '  2. Execute: SELECT classify_month_with_ai(tenant_id, start, end)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END $$;
