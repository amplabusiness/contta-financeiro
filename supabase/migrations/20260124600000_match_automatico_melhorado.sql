-- =====================================================
-- MATCH AUTOMÁTICO BOLETO X EXTRATO - MELHORADO
-- Checklist item 2.2 - Conciliação Bancária
-- =====================================================

-- =====================================================
-- 1. FUNÇÃO: MATCH BOLETO POR COB
-- =====================================================

-- Match direto por código COB extraído do extrato
CREATE OR REPLACE FUNCTION fn_match_boleto_por_cob(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    transaction_id UUID,
    boleto_id UUID,
    cob VARCHAR(50),
    valor_transacao NUMERIC,
    valor_boleto NUMERIC,
    diferenca NUMERIC,
    data_transacao DATE,
    data_liquidacao DATE,
    confidence INTEGER,
    match_method TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    SELECT
        bt.id AS transaction_id,
        bp.id AS boleto_id,
        bt.extracted_cob AS cob,
        bt.amount AS valor_transacao,
        bp.valor_liquidado AS valor_boleto,
        ABS(bt.amount - bp.valor_liquidado) AS diferenca,
        bt.transaction_date AS data_transacao,
        bp.data_liquidacao,
        100 AS confidence,  -- COB match é 100% confiável
        'cob_direto'::TEXT AS match_method
    FROM bank_transactions bt
    JOIN boleto_payments bp ON bt.extracted_cob = bp.cob
    WHERE bt.tenant_id = v_tenant_id
      AND bt.transaction_type = 'credit'
      AND bt.matched = FALSE
      AND bt.extracted_cob IS NOT NULL
      AND bp.tenant_id = v_tenant_id
      AND ABS(bt.amount - bp.valor_liquidado) < 1.00;  -- Tolerância de R$ 1,00
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. FUNÇÃO: MATCH BOLETO POR NOSSO NÚMERO
-- =====================================================

CREATE OR REPLACE FUNCTION fn_match_boleto_por_nosso_numero(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    transaction_id UUID,
    boleto_id UUID,
    nosso_numero VARCHAR(50),
    valor_transacao NUMERIC,
    valor_boleto NUMERIC,
    diferenca NUMERIC,
    confidence INTEGER,
    match_method TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    SELECT
        bt.id AS transaction_id,
        bp.id AS boleto_id,
        bp.nosso_numero,
        bt.amount AS valor_transacao,
        bp.valor_liquidado AS valor_boleto,
        ABS(bt.amount - bp.valor_liquidado) AS diferenca,
        95 AS confidence,  -- Nosso número é bem confiável
        'nosso_numero'::TEXT AS match_method
    FROM bank_transactions bt
    JOIN boleto_payments bp ON bp.nosso_numero IS NOT NULL
        AND bt.description ILIKE '%' || bp.nosso_numero || '%'
    WHERE bt.tenant_id = v_tenant_id
      AND bt.transaction_type = 'credit'
      AND bt.matched = FALSE
      AND bp.tenant_id = v_tenant_id
      AND ABS(bt.amount - bp.valor_liquidado) < 1.00;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. FUNÇÃO: MATCH POR VALOR + DATA + CLIENTE
-- =====================================================

CREATE OR REPLACE FUNCTION fn_match_por_valor_data_cliente(
    p_tenant_id UUID DEFAULT NULL,
    p_tolerancia_valor NUMERIC DEFAULT 0.50,
    p_tolerancia_dias INTEGER DEFAULT 5
)
RETURNS TABLE (
    transaction_id UUID,
    opening_balance_id UUID,
    client_id UUID,
    client_name TEXT,
    valor_transacao NUMERIC,
    valor_fatura NUMERIC,
    diferenca NUMERIC,
    data_transacao DATE,
    vencimento DATE,
    dias_diferenca INTEGER,
    confidence INTEGER,
    match_method TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    SELECT
        bt.id AS transaction_id,
        cob.id AS opening_balance_id,
        c.id AS client_id,
        c.name AS client_name,
        bt.amount AS valor_transacao,
        cob.amount AS valor_fatura,
        ABS(bt.amount - cob.amount) AS diferenca,
        bt.transaction_date AS data_transacao,
        cob.due_date AS vencimento,
        ABS(bt.transaction_date - cob.due_date)::INTEGER AS dias_diferenca,
        CASE
            -- Match perfeito: mesmo valor, mesmo cliente identificado
            WHEN bt.suggested_client_id = c.id AND ABS(bt.amount - cob.amount) < 0.01 THEN 98
            -- Mesmo cliente, valor próximo
            WHEN bt.suggested_client_id = c.id AND ABS(bt.amount - cob.amount) <= p_tolerancia_valor THEN 95
            -- Cliente identificado por nome similar na descrição
            WHEN bt.description ILIKE '%' || SPLIT_PART(c.name, ' ', 1) || '%'
                 AND ABS(bt.amount - cob.amount) <= p_tolerancia_valor THEN 85
            -- Apenas valor e data batem
            WHEN ABS(bt.amount - cob.amount) <= p_tolerancia_valor
                 AND ABS(bt.transaction_date - cob.due_date) <= p_tolerancia_dias THEN 70
            ELSE 60
        END AS confidence,
        'valor_data_cliente'::TEXT AS match_method
    FROM bank_transactions bt
    CROSS JOIN LATERAL (
        SELECT cob2.*, c2.id AS cli_id, c2.name AS cli_name
        FROM client_opening_balance cob2
        JOIN clients c2 ON c2.id = cob2.client_id
        WHERE cob2.tenant_id = v_tenant_id
          AND cob2.status = 'pending'
          AND ABS(bt.amount - cob2.amount) <= p_tolerancia_valor
          AND ABS(bt.transaction_date - cob2.due_date) <= p_tolerancia_dias
        ORDER BY
            ABS(bt.amount - cob2.amount),
            ABS(bt.transaction_date - cob2.due_date)
        LIMIT 1
    ) match_cob
    JOIN client_opening_balance cob ON cob.id = match_cob.id
    JOIN clients c ON c.id = cob.client_id
    WHERE bt.tenant_id = v_tenant_id
      AND bt.transaction_type = 'credit'
      AND bt.matched = FALSE
      AND bt.amount > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. FUNÇÃO: MATCH CONSOLIDADO (MULTI-ESTRATÉGIA)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_encontrar_matches_automaticos(
    p_tenant_id UUID DEFAULT NULL,
    p_min_confidence INTEGER DEFAULT 85
)
RETURNS TABLE (
    transaction_id UUID,
    match_type TEXT,  -- 'boleto' ou 'opening_balance'
    match_id UUID,
    client_id UUID,
    client_name TEXT,
    valor_transacao NUMERIC,
    valor_match NUMERIC,
    diferenca NUMERIC,
    confidence INTEGER,
    match_method TEXT,
    recomendacao TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    -- Prioridade 1: Match por COB (100% confiança)
    SELECT
        m.transaction_id,
        'boleto'::TEXT AS match_type,
        m.boleto_id AS match_id,
        NULL::UUID AS client_id,
        NULL::TEXT AS client_name,
        m.valor_transacao,
        m.valor_boleto AS valor_match,
        m.diferenca,
        m.confidence,
        m.match_method,
        'AUTO-APLICAR: Match por COB'::TEXT AS recomendacao
    FROM fn_match_boleto_por_cob(v_tenant_id) m
    WHERE m.confidence >= p_min_confidence

    UNION ALL

    -- Prioridade 2: Match por nosso_numero (95% confiança)
    SELECT
        m.transaction_id,
        'boleto'::TEXT AS match_type,
        m.boleto_id AS match_id,
        NULL::UUID AS client_id,
        NULL::TEXT AS client_name,
        m.valor_transacao,
        m.valor_boleto AS valor_match,
        m.diferenca,
        m.confidence,
        m.match_method,
        'AUTO-APLICAR: Match por Nosso Número'::TEXT AS recomendacao
    FROM fn_match_boleto_por_nosso_numero(v_tenant_id) m
    WHERE m.confidence >= p_min_confidence
      AND m.transaction_id NOT IN (
          SELECT m2.transaction_id FROM fn_match_boleto_por_cob(v_tenant_id) m2
      )

    UNION ALL

    -- Prioridade 3: Match por valor/data/cliente
    SELECT
        m.transaction_id,
        'opening_balance'::TEXT AS match_type,
        m.opening_balance_id AS match_id,
        m.client_id,
        m.client_name,
        m.valor_transacao,
        m.valor_fatura AS valor_match,
        m.diferenca,
        m.confidence,
        m.match_method,
        CASE
            WHEN m.confidence >= 95 THEN 'AUTO-APLICAR: Alta confiança'
            WHEN m.confidence >= 85 THEN 'REVISAR: Média-alta confiança'
            ELSE 'REVISAR MANUAL: Baixa confiança'
        END AS recomendacao
    FROM fn_match_por_valor_data_cliente(v_tenant_id, 0.50, 5) m
    WHERE m.confidence >= p_min_confidence
      AND m.transaction_id NOT IN (
          SELECT m2.transaction_id FROM fn_match_boleto_por_cob(v_tenant_id) m2
          UNION
          SELECT m3.transaction_id FROM fn_match_boleto_por_nosso_numero(v_tenant_id) m3
      )

    ORDER BY confidence DESC, diferenca ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. FUNÇÃO: APLICAR MATCH AUTOMÁTICO
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aplicar_match_automatico(
    p_transaction_id UUID,
    p_match_type TEXT,
    p_match_id UUID,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_transaction RECORD;
    v_result JSONB;
BEGIN
    v_tenant_id := get_my_tenant_id();

    -- Busca transação
    SELECT * INTO v_transaction
    FROM bank_transactions
    WHERE id = p_transaction_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Transação não encontrada');
    END IF;

    IF v_transaction.matched THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Transação já conciliada');
    END IF;

    IF p_dry_run THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'dry_run', TRUE,
            'transaction_id', p_transaction_id,
            'match_type', p_match_type,
            'match_id', p_match_id,
            'acao', 'Simulação - nenhuma alteração feita'
        );
    END IF;

    -- Aplica o match
    IF p_match_type = 'boleto' THEN
        -- Atualiza boleto_payments
        UPDATE boleto_payments
        SET data_extrato = v_transaction.transaction_date
        WHERE id = p_match_id AND tenant_id = v_tenant_id;

        -- Marca transação como conciliada
        UPDATE bank_transactions
        SET matched = TRUE,
            is_reconciled = TRUE,
            reconciliation_method = 'auto',
            status = 'reconciled',
            updated_at = NOW()
        WHERE id = p_transaction_id;

    ELSIF p_match_type = 'opening_balance' THEN
        -- Atualiza client_opening_balance
        UPDATE client_opening_balance
        SET status = 'paid',
            paid_date = v_transaction.transaction_date,
            paid_amount = v_transaction.amount,
            updated_at = NOW()
        WHERE id = p_match_id AND tenant_id = v_tenant_id;

        -- Marca transação como conciliada
        UPDATE bank_transactions
        SET matched = TRUE,
            is_reconciled = TRUE,
            reconciliation_method = 'auto',
            status = 'reconciled',
            updated_at = NOW()
        WHERE id = p_transaction_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'transaction_id', p_transaction_id,
        'match_type', p_match_type,
        'match_id', p_match_id,
        'acao', 'Match aplicado com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNÇÃO: EXECUTAR CONCILIAÇÃO EM LOTE
-- =====================================================

CREATE OR REPLACE FUNCTION fn_conciliar_lote_automatico(
    p_tenant_id UUID DEFAULT NULL,
    p_min_confidence INTEGER DEFAULT 95,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_match RECORD;
    v_total INTEGER := 0;
    v_aplicados INTEGER := 0;
    v_erros INTEGER := 0;
    v_resultado JSONB;
    v_detalhes JSONB[] := ARRAY[]::JSONB[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    FOR v_match IN (
        SELECT * FROM fn_encontrar_matches_automaticos(v_tenant_id, p_min_confidence)
        WHERE confidence >= p_min_confidence
    ) LOOP
        v_total := v_total + 1;

        IF NOT p_dry_run THEN
            v_resultado := fn_aplicar_match_automatico(
                v_match.transaction_id,
                v_match.match_type,
                v_match.match_id,
                FALSE
            );

            IF (v_resultado->>'success')::BOOLEAN THEN
                v_aplicados := v_aplicados + 1;
            ELSE
                v_erros := v_erros + 1;
            END IF;
        ELSE
            v_aplicados := v_aplicados + 1;  -- Simulação
        END IF;

        v_detalhes := array_append(v_detalhes, jsonb_build_object(
            'transaction_id', v_match.transaction_id,
            'match_type', v_match.match_type,
            'client_name', v_match.client_name,
            'valor', v_match.valor_transacao,
            'confidence', v_match.confidence,
            'method', v_match.match_method
        ));
    END LOOP;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'dry_run', p_dry_run,
        'min_confidence', p_min_confidence,
        'total_matches', v_total,
        'aplicados', v_aplicados,
        'erros', v_erros,
        'taxa_sucesso', CASE WHEN v_total > 0 THEN ROUND((v_aplicados::NUMERIC / v_total) * 100, 1) ELSE 0 END,
        'detalhes', to_jsonb(v_detalhes)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNÇÃO: DASHBOARD DE CONCILIAÇÃO AUTOMÁTICA
-- =====================================================

CREATE OR REPLACE FUNCTION fn_dashboard_conciliacao_automatica(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_pendentes INTEGER;
    v_conciliados INTEGER;
    v_matches_disponiveis INTEGER;
    v_matches_alta_confianca INTEGER;
    v_matches_media_confianca INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Conta transações pendentes
    SELECT COUNT(*) INTO v_pendentes
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_type = 'credit'
      AND matched = FALSE
      AND amount > 0;

    -- Conta transações já conciliadas
    SELECT COUNT(*) INTO v_conciliados
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_type = 'credit'
      AND matched = TRUE;

    -- Conta matches disponíveis por faixa de confiança
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE confidence >= 95),
        COUNT(*) FILTER (WHERE confidence >= 85 AND confidence < 95)
    INTO v_matches_disponiveis, v_matches_alta_confianca, v_matches_media_confianca
    FROM fn_encontrar_matches_automaticos(v_tenant_id, 70);

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'data_geracao', NOW(),
        'transacoes', jsonb_build_object(
            'pendentes', v_pendentes,
            'conciliadas', v_conciliados,
            'taxa_conciliacao', CASE
                WHEN (v_pendentes + v_conciliados) > 0
                THEN ROUND((v_conciliados::NUMERIC / (v_pendentes + v_conciliados)) * 100, 1)
                ELSE 100
            END
        ),
        'matches_automaticos', jsonb_build_object(
            'total_disponiveis', v_matches_disponiveis,
            'alta_confianca_95', v_matches_alta_confianca,
            'media_confianca_85_94', v_matches_media_confianca,
            'recomendacao', CASE
                WHEN v_matches_alta_confianca > 0
                THEN FORMAT('Executar: SELECT fn_conciliar_lote_automatico(NULL, 95, FALSE) -- %s matches', v_matches_alta_confianca)
                ELSE 'Nenhum match automático disponível com alta confiança'
            END
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_match_boleto_por_cob(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_match_boleto_por_nosso_numero(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_match_por_valor_data_cliente(UUID, NUMERIC, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_encontrar_matches_automaticos(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aplicar_match_automatico(UUID, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_conciliar_lote_automatico(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_dashboard_conciliacao_automatica(UUID) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
