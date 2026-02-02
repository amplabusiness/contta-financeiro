-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | AI-FIRST: Indexar Janeiro/2025 no Data Lake
-- Migration: 20260202_INDEX_JANEIRO_2025
-- Data: 02/02/2026
-- Autor: Dr. Cícero (Sistema Contta)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Este script indexa as 183 transações classificadas de Janeiro/2025 no Data Lake.
-- Essas classificações servirão como "conhecimento base" para o RAG classificar
-- automaticamente as 211 transações de Fevereiro/2025.
--
-- IMPORTANTE: As classificações de Janeiro estão em accounting_entries/items,
-- NÃO há link direto com bank_transactions. Usamos match por data + valor.
--
-- PRINCÍPIO: Passado é conhecimento, futuro é decisão baseada em contexto.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tenant alvo
DO $$
DECLARE
  v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_start_date DATE := '2025-01-01';
  v_end_date DATE := '2025-01-31';
  v_indexed_count INT := 0;
  v_skipped_count INT := 0;
  r RECORD;
  v_id UUID;
  v_direction TEXT;
  v_normalized TEXT;
  v_category_tags TEXT[];
  v_payer_name TEXT;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🚀 Iniciando indexação de Janeiro/2025 no Data Lake AI-First';
  RAISE NOTICE '   Tenant: %', v_tenant_id;
  RAISE NOTICE '   Período: % a %', v_start_date, v_end_date;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';

  -- Query: Match transações bancárias com classificações contábeis por data+valor
  -- Exclui contas de banco/transitórias (queremos a conta destino)
  FOR r IN
    SELECT DISTINCT ON (bt.id)
      bt.id AS bank_transaction_id,
      bt.description,
      bt.amount,
      bt.transaction_date,
      aei.account_id,
      coa.code AS account_code,
      coa.name AS account_name,
      ae.description AS entry_description
    FROM bank_transactions bt
    JOIN accounting_entries ae
      ON ae.entry_date = bt.transaction_date
      AND ABS(ABS(bt.amount) - ae.total_debit) < 0.01
      AND ae.tenant_id = bt.tenant_id
    JOIN accounting_entry_lines aei
      ON aei.entry_id = ae.id
    JOIN chart_of_accounts coa
      ON coa.id = aei.account_id
    WHERE bt.tenant_id = v_tenant_id
      AND bt.transaction_date BETWEEN v_start_date AND v_end_date
      -- Excluir contas de banco/transitórias (pegar a conta destino)
      AND coa.code NOT LIKE '1.1.1.%'  -- Não é conta banco
      AND coa.code NOT LIKE '1.1.9.%'  -- Não é transitória ativo
      AND coa.code NOT LIKE '2.1.9.%'  -- Não é transitória passivo
    ORDER BY bt.id, aei.id
  LOOP
    -- Verificar se já existe no Data Lake
    IF EXISTS (
      SELECT 1 FROM classification_embeddings
      WHERE tenant_id = v_tenant_id
        AND normalized_description = UPPER(TRIM(regexp_replace(r.description, '\s+', ' ', 'g')))
        AND account_code = r.account_code
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Determinar direção
    v_direction := CASE WHEN r.amount > 0 THEN 'credit' ELSE 'debit' END;

    -- Normalizar descrição
    v_normalized := UPPER(TRIM(regexp_replace(r.description, '\s+', ' ', 'g')));

    -- Extrair tags semânticas da descrição
    v_category_tags := ARRAY[]::TEXT[];

    IF r.description ILIKE '%PIX%' THEN
      v_category_tags := array_append(v_category_tags, 'pix');
    END IF;
    IF r.description ILIKE '%TARIFA%' THEN
      v_category_tags := array_append(v_category_tags, 'tarifa');
      v_category_tags := array_append(v_category_tags, 'bancaria');
    END IF;
    IF r.description ILIKE '%RECEBIMENTO%' THEN
      v_category_tags := array_append(v_category_tags, 'recebimento');
    END IF;
    IF r.description ILIKE '%PAGAMENTO%' THEN
      v_category_tags := array_append(v_category_tags, 'pagamento');
    END IF;
    IF r.description ILIKE '%COBRANCA%' OR r.description ILIKE '%COB %' THEN
      v_category_tags := array_append(v_category_tags, 'boleto');
      v_category_tags := array_append(v_category_tags, 'cobranca');
    END IF;
    IF r.description ILIKE '%FGTS%' THEN
      v_category_tags := array_append(v_category_tags, 'trabalhista');
      v_category_tags := array_append(v_category_tags, 'fgts');
    END IF;
    IF r.description ILIKE '%INSS%' THEN
      v_category_tags := array_append(v_category_tags, 'trabalhista');
      v_category_tags := array_append(v_category_tags, 'inss');
    END IF;
    IF r.description ILIKE '%DAS%' OR r.description ILIKE '%SIMPLES%' THEN
      v_category_tags := array_append(v_category_tags, 'imposto');
      v_category_tags := array_append(v_category_tags, 'simples');
    END IF;
    IF r.description ILIKE '%ENERGIA%' OR r.description ILIKE '%ENEL%' THEN
      v_category_tags := array_append(v_category_tags, 'utilidade');
      v_category_tags := array_append(v_category_tags, 'energia');
    END IF;
    IF r.description ILIKE '%TELEFONE%' OR r.description ILIKE '%VIVO%' OR r.description ILIKE '%CLARO%' THEN
      v_category_tags := array_append(v_category_tags, 'utilidade');
      v_category_tags := array_append(v_category_tags, 'telecom');
    END IF;
    IF r.description ILIKE '%SICREDI%' THEN
      v_category_tags := array_append(v_category_tags, 'bancaria');
      v_category_tags := array_append(v_category_tags, 'sicredi');
    END IF;
    IF r.description ILIKE '%LIQ%' OR r.description ILIKE '%LIQUIDACAO%' THEN
      v_category_tags := array_append(v_category_tags, 'liquidacao');
    END IF;

    -- Extrair nome do pagador (se PIX)
    v_payer_name := NULL;
    IF r.description ~* 'PIX.*DE\s+(.+)$' THEN
      v_payer_name := TRIM(regexp_replace(r.description, '.*PIX.*DE\s+', '', 'i'));
    ELSIF r.description ~* 'RECEBIMENTO.*-\s*(.+)$' THEN
      v_payer_name := TRIM(regexp_replace(r.description, '.*RECEBIMENTO.*-\s*', '', 'i'));
    ELSIF r.description ~* 'COB\d+\s+(.+)$' THEN
      v_payer_name := TRIM(regexp_replace(r.description, '.*COB\d+\s+', '', 'i'));
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
      confidence,
      validated,
      source,
      source_reference,
      decision_reasoning,
      category_tags,
      payer_name,
      created_by
    ) VALUES (
      v_tenant_id,
      r.description,
      v_normalized,
      r.amount,
      v_direction,
      r.account_id,
      r.account_code,
      r.account_name,
      1.0,  -- Confiança máxima (dados históricos validados)
      TRUE,  -- Validado (veio de classificação aprovada)
      'historical',
      r.bank_transaction_id::TEXT,
      'Classificação histórica de Janeiro/2025. Conta: ' || r.account_code || ' - ' || r.account_name,
      v_category_tags,
      v_payer_name,
      'dr-cicero'
    )
    RETURNING id INTO v_id;

    v_indexed_count := v_indexed_count + 1;

    -- Log a cada 50 registros
    IF v_indexed_count % 50 = 0 THEN
      RAISE NOTICE '   ... % transações indexadas', v_indexed_count;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Indexação concluída!';
  RAISE NOTICE '';
  RAISE NOTICE '   Transações indexadas: %', v_indexed_count;
  RAISE NOTICE '   Já existentes (skip): %', v_skipped_count;
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMO PASSO:';
  RAISE NOTICE '   Executar Edge Function ai-rag-classifier para:';
  RAISE NOTICE '   1. Gerar embeddings das classificações indexadas';
  RAISE NOTICE '   2. Classificar Fevereiro/2025 usando RAG';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: Estatísticas do Data Lake
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT
  'classification_embeddings' AS tabela,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE direction = 'credit') AS entradas,
  COUNT(*) FILTER (WHERE direction = 'debit') AS saidas,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS com_embedding,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS sem_embedding,
  COUNT(DISTINCT account_code) AS contas_distintas
FROM classification_embeddings
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- Top 10 contas mais classificadas (conhecimento aprendido)
SELECT
  account_code,
  account_name,
  direction,
  COUNT(*) AS frequencia,
  ROUND(AVG(confidence)::NUMERIC, 2) AS confianca_media,
  array_agg(DISTINCT unnest) FILTER (WHERE unnest IS NOT NULL) AS tags_comuns
FROM classification_embeddings,
     LATERAL unnest(category_tags) WITH ORDINALITY
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
GROUP BY account_code, account_name, direction
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Exemplos de classificações indexadas
SELECT
  LEFT(transaction_description, 50) AS descricao,
  account_code,
  account_name,
  direction,
  category_tags,
  payer_name
FROM classification_embeddings
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
LIMIT 10;
