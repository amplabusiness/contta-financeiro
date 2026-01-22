-- ============================================================================
-- FIX: Corrigir erro "matching_invoices does not exist"
-- O CTE só existe dentro do statement que o define
-- ============================================================================

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
  v_invoice_count INTEGER;
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
  -- CORRIGIDO: Contar primeiro, depois buscar o registro
  IF v_tx.amount > 0 THEN
    -- Primeiro contar quantas faturas coincidem
    SELECT COUNT(*) INTO v_invoice_count
    FROM invoices i
    WHERE i.tenant_id = v_tx.tenant_id
      AND i.status IN ('pending', 'overdue')
      AND ABS(i.amount - v_tx.amount) < 0.02
      AND i.due_date BETWEEN v_tx.transaction_date - INTERVAL '5 days'
                        AND v_tx.transaction_date + INTERVAL '2 days';

    -- Se exatamente uma fatura coincide, buscar os dados
    IF v_invoice_count = 1 THEN
      SELECT
        c.id as client_id,
        c.name as client_name,
        coa.code as account_code
      INTO v_client
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN chart_of_accounts coa ON coa.id = c.accounting_account_id
      WHERE i.tenant_id = v_tx.tenant_id
        AND i.status IN ('pending', 'overdue')
        AND ABS(i.amount - v_tx.amount) < 0.02
        AND i.due_date BETWEEN v_tx.transaction_date - INTERVAL '5 days'
                          AND v_tx.transaction_date + INTERVAL '2 days'
      LIMIT 1;

      IF v_client.client_id IS NOT NULL THEN
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

COMMENT ON FUNCTION fn_identify_payer_sql IS 'Identifica pagador de transacao bancaria usando multiplas estrategias (versao corrigida)';
