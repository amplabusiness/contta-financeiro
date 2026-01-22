-- ============================================================================
-- SPRINT 2: INFRAESTRUTURA PARA IDENTIFICACAO AUTOMATICA DE PAGADORES
-- Configura indices, funcoes auxiliares e integracao com Edge Function
-- ============================================================================

-- ============================================================================
-- PARTE 1: INDICES PARA BUSCA RAPIDA
-- ============================================================================

-- Indice para busca por CNPJ extraido
CREATE INDEX IF NOT EXISTS idx_bank_transactions_extracted_cnpj
  ON bank_transactions(extracted_cnpj)
  WHERE extracted_cnpj IS NOT NULL;

-- Indice para busca por CPF extraido
CREATE INDEX IF NOT EXISTS idx_bank_transactions_extracted_cpf
  ON bank_transactions(extracted_cpf)
  WHERE extracted_cpf IS NOT NULL;

-- Indice para busca por COB extraido
CREATE INDEX IF NOT EXISTS idx_bank_transactions_extracted_cob
  ON bank_transactions(extracted_cob)
  WHERE extracted_cob IS NOT NULL;

-- Indice para transacoes pendentes de identificacao
CREATE INDEX IF NOT EXISTS idx_bank_transactions_pending_identification
  ON bank_transactions(tenant_id, matched, amount)
  WHERE matched = false AND amount > 0 AND suggested_client_id IS NULL;

-- Indice para confianca de identificacao
CREATE INDEX IF NOT EXISTS idx_bank_transactions_confidence
  ON bank_transactions(identification_confidence DESC)
  WHERE identification_confidence IS NOT NULL;

-- Indice para busca de clientes por CNPJ
CREATE INDEX IF NOT EXISTS idx_clients_cnpj_search
  ON clients(tenant_id, cnpj)
  WHERE cnpj IS NOT NULL AND is_active = true;

-- Indice para busca de clientes por CPF
CREATE INDEX IF NOT EXISTS idx_clients_cpf_search
  ON clients(tenant_id, cpf)
  WHERE cpf IS NOT NULL AND is_active = true;

-- ============================================================================
-- PARTE 2: FUNCAO DE IDENTIFICACAO EM SQL (ALTERNATIVA A EDGE FUNCTION)
-- ============================================================================

-- Funcao SQL para identificar pagador (pode ser chamada diretamente)
CREATE OR REPLACE FUNCTION fn_identify_payer_sql(
  p_transaction_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_client RECORD;
  v_result JSONB;
  v_cnpj_clean TEXT;
  v_cpf_clean TEXT;
  v_confidence NUMERIC;
  v_method TEXT;
  v_reasoning TEXT;
  v_pattern RECORD;
BEGIN
  -- Buscar transacao
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  -- Se ja tem cliente sugerido, retornar
  IF v_tx.suggested_client_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_identified', true,
      'client_id', v_tx.suggested_client_id,
      'confidence', v_tx.identification_confidence
    );
  END IF;

  -- ESTRATEGIA 1: Match por CNPJ (100%)
  IF v_tx.extracted_cnpj IS NOT NULL THEN
    v_cnpj_clean := regexp_replace(v_tx.extracted_cnpj, '\D', '', 'g');

    SELECT c.id, c.name, coa.code as account_code
    INTO v_client
    FROM clients c
    LEFT JOIN chart_of_accounts coa ON coa.id = c.accounting_account_id
    WHERE c.tenant_id = v_tx.tenant_id
      AND c.is_active = true
      AND (c.cnpj = v_tx.extracted_cnpj OR regexp_replace(c.cnpj, '\D', '', 'g') = v_cnpj_clean)
    LIMIT 1;

    IF v_client.id IS NOT NULL THEN
      v_confidence := 100;
      v_method := 'cnpj_match';
      v_reasoning := 'CNPJ ' || v_tx.extracted_cnpj || ' encontrado no cadastro';

      UPDATE bank_transactions
      SET suggested_client_id = v_client.id,
          identification_confidence = v_confidence,
          identification_method = v_method,
          identification_reasoning = v_reasoning,
          auto_matched = true,
          matched = true,
          needs_review = false
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.id,
        'client_name', v_client.name,
        'confidence', v_confidence,
        'method', v_method,
        'reasoning', v_reasoning
      );
    END IF;
  END IF;

  -- ESTRATEGIA 2: Match por CPF (95%)
  IF v_tx.extracted_cpf IS NOT NULL THEN
    v_cpf_clean := regexp_replace(v_tx.extracted_cpf, '\D', '', 'g');

    SELECT c.id, c.name, coa.code as account_code
    INTO v_client
    FROM clients c
    LEFT JOIN chart_of_accounts coa ON coa.id = c.accounting_account_id
    WHERE c.tenant_id = v_tx.tenant_id
      AND c.is_active = true
      AND (c.cpf = v_tx.extracted_cpf OR regexp_replace(c.cpf, '\D', '', 'g') = v_cpf_clean)
    LIMIT 1;

    IF v_client.id IS NOT NULL THEN
      v_confidence := 95;
      v_method := 'cpf_match';
      v_reasoning := 'CPF ' || v_tx.extracted_cpf || ' encontrado no cadastro';

      UPDATE bank_transactions
      SET suggested_client_id = v_client.id,
          identification_confidence = v_confidence,
          identification_method = v_method,
          identification_reasoning = v_reasoning,
          auto_matched = true,
          matched = true,
          needs_review = false
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.id,
        'client_name', v_client.name,
        'confidence', v_confidence,
        'method', v_method,
        'reasoning', v_reasoning
      );
    END IF;
  END IF;

  -- ESTRATEGIA 3: Match por CPF no QSA (92%)
  IF v_tx.extracted_cpf IS NOT NULL THEN
    v_cpf_clean := regexp_replace(v_tx.extracted_cpf, '\D', '', 'g');

    SELECT c.id, c.name, coa.code as account_code
    INTO v_client
    FROM clients c
    LEFT JOIN chart_of_accounts coa ON coa.id = c.accounting_account_id
    WHERE c.tenant_id = v_tx.tenant_id
      AND c.is_active = true
      AND c.qsa IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(c.qsa) socio
        WHERE regexp_replace(socio->>'cpf_cnpj', '\D', '', 'g') = v_cpf_clean
      )
    LIMIT 1;

    IF v_client.id IS NOT NULL THEN
      v_confidence := 92;
      v_method := 'qsa_match';
      v_reasoning := 'CPF ' || v_tx.extracted_cpf || ' e socio da empresa ' || v_client.name;

      UPDATE bank_transactions
      SET suggested_client_id = v_client.id,
          identification_confidence = v_confidence,
          identification_method = v_method,
          identification_reasoning = v_reasoning,
          auto_matched = true,
          matched = true,
          needs_review = false
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.id,
        'client_name', v_client.name,
        'confidence', v_confidence,
        'method', v_method,
        'reasoning', v_reasoning
      );
    END IF;
  END IF;

  -- ESTRATEGIA 4: Match por valor + data com faturas (85%)
  IF v_tx.amount > 0 THEN
    WITH matching_invoices AS (
      SELECT
        i.id as invoice_id,
        i.amount,
        i.due_date,
        c.id as client_id,
        c.name as client_name,
        coa.code as account_code
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN chart_of_accounts coa ON coa.id = c.accounting_account_id
      WHERE i.tenant_id = v_tx.tenant_id
        AND i.status IN ('pending', 'overdue')
        AND ABS(i.amount - v_tx.amount) < 0.02
        AND i.due_date BETWEEN v_tx.transaction_date - INTERVAL '5 days'
                          AND v_tx.transaction_date + INTERVAL '2 days'
    )
    SELECT * INTO v_client
    FROM matching_invoices
    LIMIT 1;

    IF v_client.client_id IS NOT NULL AND (SELECT COUNT(*) FROM matching_invoices) = 1 THEN
      v_confidence := 85;
      v_method := 'invoice_match';
      v_reasoning := 'Valor R$ ' || v_tx.amount || ' coincide com fatura unica do cliente ' || v_client.client_name;

      UPDATE bank_transactions
      SET suggested_client_id = v_client.client_id,
          identification_confidence = v_confidence,
          identification_method = v_method,
          identification_reasoning = v_reasoning,
          auto_matched = false,
          needs_review = true
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.client_id,
        'client_name', v_client.client_name,
        'confidence', v_confidence,
        'method', v_method,
        'reasoning', v_reasoning
      );
    END IF;
  END IF;

  -- ESTRATEGIA 5: Padroes aprendidos
  SELECT * INTO v_pattern
  FROM fn_find_matching_pattern(v_tx.description, v_tx.tenant_id)
  LIMIT 1;

  IF v_pattern.client_id IS NOT NULL THEN
    v_confidence := v_pattern.confidence;
    v_method := 'pattern_learned';
    v_reasoning := 'Padrao aprendido: ' || COALESCE(v_pattern.pattern_text, 'descricao similar');

    UPDATE bank_transactions
    SET suggested_client_id = v_pattern.client_id,
        identification_confidence = v_confidence,
        identification_method = v_method,
        identification_reasoning = v_reasoning,
        auto_matched = (v_confidence >= 90),
        matched = (v_confidence >= 90),
        needs_review = (v_confidence < 90)
    WHERE id = p_transaction_id;

    -- Incrementar uso do padrao
    UPDATE ai_classification_patterns
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = v_pattern.pattern_id;

    RETURN jsonb_build_object(
      'success', true,
      'client_id', v_pattern.client_id,
      'client_name', v_pattern.client_name,
      'confidence', v_confidence,
      'method', v_method,
      'reasoning', v_reasoning
    );
  END IF;

  -- Nao identificado
  UPDATE bank_transactions
  SET identification_confidence = 0,
      identification_method = 'none',
      identification_reasoning = 'Nao foi possivel identificar o pagador automaticamente',
      needs_review = true
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'identified', false,
    'confidence', 0,
    'method', 'none',
    'reasoning', 'Nao foi possivel identificar o pagador automaticamente'
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 3: FUNCAO PARA PROCESSAR LOTE DE TRANSACOES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_identify_payers_batch(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 100
) RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_result JSONB;
  v_stats JSONB := jsonb_build_object(
    'processed', 0,
    'identified', 0,
    'auto_matched', 0,
    'needs_review', 0,
    'failed', 0
  );
BEGIN
  FOR v_tx IN
    SELECT id
    FROM bank_transactions
    WHERE tenant_id = p_tenant_id
      AND matched = false
      AND amount > 0
      AND suggested_client_id IS NULL
    ORDER BY transaction_date DESC
    LIMIT p_limit
  LOOP
    BEGIN
      v_result := fn_identify_payer_sql(v_tx.id);
      v_stats := jsonb_set(v_stats, '{processed}', to_jsonb((v_stats->>'processed')::int + 1));

      IF (v_result->>'success')::boolean AND (v_result->>'client_id') IS NOT NULL THEN
        v_stats := jsonb_set(v_stats, '{identified}', to_jsonb((v_stats->>'identified')::int + 1));

        IF (v_result->>'confidence')::numeric >= 90 THEN
          v_stats := jsonb_set(v_stats, '{auto_matched}', to_jsonb((v_stats->>'auto_matched')::int + 1));
        ELSE
          v_stats := jsonb_set(v_stats, '{needs_review}', to_jsonb((v_stats->>'needs_review')::int + 1));
        END IF;
      ELSE
        v_stats := jsonb_set(v_stats, '{needs_review}', to_jsonb((v_stats->>'needs_review')::int + 1));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_stats := jsonb_set(v_stats, '{failed}', to_jsonb((v_stats->>'failed')::int + 1));
    END;
  END LOOP;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 4: TRIGGER PARA IDENTIFICACAO AUTOMATICA (OPCIONAL)
-- ============================================================================

-- Funcao de trigger que chama identificacao automatica
CREATE OR REPLACE FUNCTION fn_trigger_payer_identification()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas para creditos (recebimentos) nao conciliados
  IF NEW.amount > 0 AND NEW.matched = false AND NEW.suggested_client_id IS NULL THEN
    -- Chamar identificacao em background (nao bloqueia o INSERT)
    PERFORM fn_identify_payer_sql(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Trigger que executa apos INSERT
-- NOTA: Desabilitado por padrao para nao impactar performance de imports em massa
-- Habilite com: ALTER TABLE bank_transactions ENABLE TRIGGER trg_auto_identify_payer;
DROP TRIGGER IF EXISTS trg_auto_identify_payer ON bank_transactions;
CREATE TRIGGER trg_auto_identify_payer
  AFTER INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_payer_identification();

-- Desabilitar por padrao (pode ser habilitado conforme necessidade)
ALTER TABLE bank_transactions DISABLE TRIGGER trg_auto_identify_payer;

-- ============================================================================
-- PARTE 5: VIEW DE ESTATISTICAS DE IDENTIFICACAO
-- ============================================================================

CREATE OR REPLACE VIEW v_identification_stats AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE amount > 0) as total_credits,
  COUNT(*) FILTER (WHERE amount > 0 AND matched = true) as matched_credits,
  COUNT(*) FILTER (WHERE amount > 0 AND matched = false) as unmatched_credits,
  COUNT(*) FILTER (WHERE amount > 0 AND auto_matched = true) as auto_matched,
  COUNT(*) FILTER (WHERE amount > 0 AND needs_review = true) as needs_review,
  COUNT(*) FILTER (WHERE amount > 0 AND suggested_client_id IS NOT NULL) as identified,
  ROUND(
    COUNT(*) FILTER (WHERE amount > 0 AND matched = true)::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE amount > 0), 0) * 100,
    1
  ) as match_rate_percent,
  ROUND(
    AVG(identification_confidence) FILTER (WHERE identification_confidence > 0),
    1
  ) as avg_confidence,
  COUNT(DISTINCT identification_method) FILTER (WHERE identification_method IS NOT NULL) as methods_used
FROM bank_transactions
GROUP BY tenant_id;

COMMENT ON VIEW v_identification_stats IS 'Estatisticas de identificacao automatica de pagadores por tenant';

-- ============================================================================
-- PARTE 6: GRANTS
-- ============================================================================

-- Permitir chamada das funcoes via RPC
GRANT EXECUTE ON FUNCTION fn_identify_payer_sql(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_identify_payers_batch(UUID, INTEGER) TO authenticated;
