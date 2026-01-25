-- =====================================================
-- MÉTRICAS E VALIDAÇÃO DE AUTOMAÇÃO
-- Checklist item 2 - Automação e IA
-- =====================================================

-- =====================================================
-- 2.1 IDENTIFICAÇÃO DE PAGADORES
-- =====================================================

-- Função: Métricas de identificação de pagadores
CREATE OR REPLACE FUNCTION fn_metricas_identificacao_pagadores(
    p_tenant_id UUID DEFAULT NULL,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_data_inicio DATE;
    v_data_fim DATE;
    v_total_transacoes INTEGER;
    v_com_cnpj INTEGER;
    v_com_cpf INTEGER;
    v_com_cliente_sugerido INTEGER;
    v_auto_matched INTEGER;
    v_needs_review INTEGER;
    v_confirmados INTEGER;
    v_por_metodo JSONB;
    v_taxa_acerto NUMERIC;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_data_inicio := COALESCE(p_data_inicio, DATE_TRUNC('month', CURRENT_DATE)::DATE);
    v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

    -- Total de transações de entrada (recebimentos)
    SELECT COUNT(*) INTO v_total_transacoes
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND amount > 0;  -- Apenas entradas

    -- Transações com CNPJ extraído
    SELECT COUNT(*) INTO v_com_cnpj
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND amount > 0
      AND extracted_cnpj IS NOT NULL;

    -- Transações com CPF extraído
    SELECT COUNT(*) INTO v_com_cpf
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND amount > 0
      AND extracted_cpf IS NOT NULL
      AND extracted_cnpj IS NULL;

    -- Transações com cliente sugerido
    SELECT COUNT(*) INTO v_com_cliente_sugerido
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND amount > 0
      AND suggested_client_id IS NOT NULL;

    -- Transações auto-matched (confirmadas automaticamente)
    SELECT COUNT(*) INTO v_auto_matched
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND amount > 0
      AND auto_matched = TRUE;

    -- Transações que precisam revisão
    SELECT COUNT(*) INTO v_needs_review
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND amount > 0
      AND needs_review = TRUE;

    -- Transações confirmadas (matched = true)
    SELECT COUNT(*) INTO v_confirmados
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND amount > 0
      AND matched = TRUE;

    -- Distribuição por método de identificação
    SELECT COALESCE(jsonb_object_agg(method, cnt), '{}'::jsonb)
    INTO v_por_metodo
    FROM (
        SELECT
            COALESCE(identification_method, 'manual') AS method,
            COUNT(*) AS cnt
        FROM bank_transactions
        WHERE tenant_id = v_tenant_id
          AND transaction_date BETWEEN v_data_inicio AND v_data_fim
          AND amount > 0
          AND matched = TRUE
        GROUP BY identification_method
    ) AS methods;

    -- Calcula taxa de acerto (transações com cliente sugerido que foram confirmadas)
    IF v_com_cliente_sugerido > 0 THEN
        SELECT COUNT(*) INTO v_taxa_acerto
        FROM bank_transactions
        WHERE tenant_id = v_tenant_id
          AND transaction_date BETWEEN v_data_inicio AND v_data_fim
          AND amount > 0
          AND suggested_client_id IS NOT NULL
          AND matched = TRUE;
        v_taxa_acerto := ROUND((v_taxa_acerto::NUMERIC / v_com_cliente_sugerido) * 100, 1);
    ELSE
        v_taxa_acerto := 0;
    END IF;

    RETURN jsonb_build_object(
        'periodo', jsonb_build_object('inicio', v_data_inicio, 'fim', v_data_fim),
        'total_recebimentos', v_total_transacoes,
        'extracao', jsonb_build_object(
            'com_cnpj', v_com_cnpj,
            'com_cpf', v_com_cpf,
            'taxa_extracao', CASE WHEN v_total_transacoes > 0
                THEN ROUND(((v_com_cnpj + v_com_cpf)::NUMERIC / v_total_transacoes) * 100, 1)
                ELSE 0 END
        ),
        'identificacao', jsonb_build_object(
            'com_cliente_sugerido', v_com_cliente_sugerido,
            'auto_matched', v_auto_matched,
            'needs_review', v_needs_review,
            'confirmados', v_confirmados,
            'taxa_acerto', v_taxa_acerto
        ),
        'por_metodo', v_por_metodo,
        'meta_atingida', v_taxa_acerto >= 90
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Verificar duplicidade de clientes
CREATE OR REPLACE FUNCTION fn_verificar_clientes_duplicados(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    client_id UUID,
    client_name TEXT,
    cnpj TEXT,
    duplicates JSONB
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    WITH duplicados AS (
        SELECT
            c1.id,
            c1.name,
            c1.cnpj AS doc,
            jsonb_agg(jsonb_build_object(
                'id', c2.id,
                'name', c2.name,
                'similarity', ROUND(similarity(c1.name, c2.name)::NUMERIC, 2)
            )) AS dups
        FROM clients c1
        JOIN clients c2 ON c1.tenant_id = c2.tenant_id
            AND c1.id != c2.id
            AND (
                -- Mesmo CNPJ
                (c1.cnpj IS NOT NULL AND c1.cnpj = c2.cnpj)
                -- Ou nome muito similar (>80%)
                OR similarity(c1.name, c2.name) > 0.8
            )
        WHERE c1.tenant_id = v_tenant_id
        GROUP BY c1.id, c1.name, c1.cnpj
    )
    SELECT
        d.id AS client_id,
        d.name AS client_name,
        d.doc AS cnpj,
        d.dups AS duplicates
    FROM duplicados d
    ORDER BY d.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2.2 CONCILIAÇÃO BANCÁRIA
-- =====================================================

-- Função: Métricas de conciliação bancária
CREATE OR REPLACE FUNCTION fn_metricas_conciliacao(
    p_tenant_id UUID DEFAULT NULL,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_data_inicio DATE;
    v_data_fim DATE;
    v_total_transacoes INTEGER;
    v_conciliadas INTEGER;
    v_pendentes INTEGER;
    v_por_tipo JSONB;
    v_duplicadas INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_data_inicio := COALESCE(p_data_inicio, DATE_TRUNC('month', CURRENT_DATE)::DATE);
    v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

    -- Total de transações no período
    SELECT COUNT(*) INTO v_total_transacoes
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim;

    -- Transações conciliadas
    SELECT COUNT(*) INTO v_conciliadas
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND matched = TRUE;

    -- Transações pendentes
    SELECT COUNT(*) INTO v_pendentes
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN v_data_inicio AND v_data_fim
      AND matched = FALSE;

    -- Distribuição por tipo
    SELECT COALESCE(jsonb_object_agg(tipo, cnt), '{}'::jsonb)
    INTO v_por_tipo
    FROM (
        SELECT
            CASE WHEN amount > 0 THEN 'entrada' ELSE 'saida' END AS tipo,
            COUNT(*) AS cnt
        FROM bank_transactions
        WHERE tenant_id = v_tenant_id
          AND transaction_date BETWEEN v_data_inicio AND v_data_fim
        GROUP BY CASE WHEN amount > 0 THEN 'entrada' ELSE 'saida' END
    ) AS tipos;

    -- Verificar duplicatas (mesmo fitid)
    SELECT COUNT(*) INTO v_duplicadas
    FROM (
        SELECT fitid
        FROM bank_transactions
        WHERE tenant_id = v_tenant_id
          AND fitid IS NOT NULL
        GROUP BY fitid
        HAVING COUNT(*) > 1
    ) AS dups;

    RETURN jsonb_build_object(
        'periodo', jsonb_build_object('inicio', v_data_inicio, 'fim', v_data_fim),
        'total_transacoes', v_total_transacoes,
        'conciliadas', v_conciliadas,
        'pendentes', v_pendentes,
        'taxa_conciliacao', CASE WHEN v_total_transacoes > 0
            THEN ROUND((v_conciliadas::NUMERIC / v_total_transacoes) * 100, 1)
            ELSE 0 END,
        'por_tipo', v_por_tipo,
        'duplicatas_detectadas', v_duplicadas,
        'sem_duplicatas', v_duplicadas = 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Verificar transações duplicadas
CREATE OR REPLACE FUNCTION fn_verificar_transacoes_duplicadas(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    fitid TEXT,
    count BIGINT,
    transactions JSONB
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    SELECT
        bt.fitid,
        COUNT(*) AS count,
        jsonb_agg(jsonb_build_object(
            'id', bt.id,
            'date', bt.transaction_date,
            'amount', bt.amount,
            'description', bt.description
        )) AS transactions
    FROM bank_transactions bt
    WHERE bt.tenant_id = v_tenant_id
      AND bt.fitid IS NOT NULL
    GROUP BY bt.fitid
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2.3 PROVISÕES
-- =====================================================

-- Função: Métricas de provisões
CREATE OR REPLACE FUNCTION fn_metricas_provisoes(
    p_tenant_id UUID DEFAULT NULL,
    p_competencia TEXT DEFAULT NULL  -- Formato: 'MM/YYYY'
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_competencia TEXT;
    v_clientes_ativos INTEGER;
    v_com_provisao INTEGER;
    v_sem_provisao INTEGER;
    v_valor_total NUMERIC;
    v_duplicadas INTEGER;
    v_clientes_sem JSONB;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_competencia := COALESCE(p_competencia, TO_CHAR(CURRENT_DATE, 'MM/YYYY'));

    -- Total de clientes ativos com honorário
    SELECT COUNT(*) INTO v_clientes_ativos
    FROM clients
    WHERE tenant_id = v_tenant_id
      AND is_active = TRUE
      AND monthly_fee > 0;

    -- Clientes com provisão no mês
    SELECT COUNT(DISTINCT c.id), COALESCE(SUM(cob.amount), 0)
    INTO v_com_provisao, v_valor_total
    FROM clients c
    JOIN client_opening_balance cob ON cob.client_id = c.id
    WHERE c.tenant_id = v_tenant_id
      AND c.is_active = TRUE
      AND cob.competence = v_competencia;

    v_sem_provisao := v_clientes_ativos - v_com_provisao;

    -- Verificar duplicatas (mesmo cliente, mesma competência)
    SELECT COUNT(*) INTO v_duplicadas
    FROM (
        SELECT client_id, competence
        FROM client_opening_balance
        WHERE tenant_id = v_tenant_id
          AND competence = v_competencia
        GROUP BY client_id, competence
        HAVING COUNT(*) > 1
    ) AS dups;

    -- Lista de clientes sem provisão
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'monthly_fee', c.monthly_fee
    )), '[]'::jsonb)
    INTO v_clientes_sem
    FROM clients c
    WHERE c.tenant_id = v_tenant_id
      AND c.is_active = TRUE
      AND c.monthly_fee > 0
      AND NOT EXISTS (
          SELECT 1 FROM client_opening_balance cob
          WHERE cob.client_id = c.id
            AND cob.competence = v_competencia
      );

    RETURN jsonb_build_object(
        'competencia', v_competencia,
        'clientes_ativos', v_clientes_ativos,
        'com_provisao', v_com_provisao,
        'sem_provisao', v_sem_provisao,
        'valor_total_provisionado', v_valor_total,
        'taxa_cobertura', CASE WHEN v_clientes_ativos > 0
            THEN ROUND((v_com_provisao::NUMERIC / v_clientes_ativos) * 100, 1)
            ELSE 0 END,
        'provisoes_duplicadas', v_duplicadas,
        'sem_duplicatas', v_duplicadas = 0,
        'clientes_sem_provisao', v_clientes_sem,
        'todos_provisionados', v_sem_provisao = 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Gerar provisões faltantes
CREATE OR REPLACE FUNCTION fn_gerar_provisoes_faltantes(
    p_tenant_id UUID DEFAULT NULL,
    p_competencia TEXT DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_competencia TEXT;
    v_count INTEGER := 0;
    v_total NUMERIC := 0;
    v_client RECORD;
    v_due_date DATE;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_competencia := COALESCE(p_competencia, TO_CHAR(CURRENT_DATE, 'MM/YYYY'));

    -- Calcula data de vencimento (dia 10 do mês seguinte)
    v_due_date := (TO_DATE('01/' || v_competencia, 'DD/MM/YYYY') + INTERVAL '1 month' + INTERVAL '9 days')::DATE;

    FOR v_client IN (
        SELECT c.id, c.name, c.monthly_fee
        FROM clients c
        WHERE c.tenant_id = v_tenant_id
          AND c.is_active = TRUE
          AND c.monthly_fee > 0
          AND NOT EXISTS (
              SELECT 1 FROM client_opening_balance cob
              WHERE cob.client_id = c.id
                AND cob.competence = v_competencia
          )
    )
    LOOP
        IF NOT p_dry_run THEN
            INSERT INTO client_opening_balance (
                tenant_id, client_id, competence, amount, due_date,
                description, status, fee_type
            ) VALUES (
                v_tenant_id, v_client.id, v_competencia, v_client.monthly_fee, v_due_date,
                'Honorários ' || v_competencia || ' - ' || v_client.name, 'pending', 'monthly'
            );
        END IF;

        v_count := v_count + 1;
        v_total := v_total + v_client.monthly_fee;
    END LOOP;

    RETURN jsonb_build_object(
        'competencia', v_competencia,
        'dry_run', p_dry_run,
        'provisoes_criadas', v_count,
        'valor_total', v_total,
        'due_date', v_due_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DASHBOARD CONSOLIDADO DE AUTOMAÇÃO
-- =====================================================

CREATE OR REPLACE FUNCTION fn_dashboard_automacao(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_identificacao JSONB;
    v_conciliacao JSONB;
    v_provisoes JSONB;
    v_score_geral INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Métricas de identificação
    v_identificacao := fn_metricas_identificacao_pagadores(v_tenant_id);

    -- Métricas de conciliação
    v_conciliacao := fn_metricas_conciliacao(v_tenant_id);

    -- Métricas de provisões
    v_provisoes := fn_metricas_provisoes(v_tenant_id);

    -- Calcula score geral (0-100)
    v_score_geral := 0;

    -- +30 pontos se taxa de acerto >= 90%
    IF (v_identificacao->'identificacao'->>'taxa_acerto')::NUMERIC >= 90 THEN
        v_score_geral := v_score_geral + 30;
    ELSIF (v_identificacao->'identificacao'->>'taxa_acerto')::NUMERIC >= 70 THEN
        v_score_geral := v_score_geral + 20;
    ELSIF (v_identificacao->'identificacao'->>'taxa_acerto')::NUMERIC >= 50 THEN
        v_score_geral := v_score_geral + 10;
    END IF;

    -- +30 pontos se taxa de conciliação >= 90%
    IF (v_conciliacao->>'taxa_conciliacao')::NUMERIC >= 90 THEN
        v_score_geral := v_score_geral + 30;
    ELSIF (v_conciliacao->>'taxa_conciliacao')::NUMERIC >= 70 THEN
        v_score_geral := v_score_geral + 20;
    ELSIF (v_conciliacao->>'taxa_conciliacao')::NUMERIC >= 50 THEN
        v_score_geral := v_score_geral + 10;
    END IF;

    -- +20 pontos se sem duplicatas
    IF (v_conciliacao->>'sem_duplicatas')::BOOLEAN THEN
        v_score_geral := v_score_geral + 20;
    END IF;

    -- +20 pontos se todos clientes provisionados
    IF (v_provisoes->>'todos_provisionados')::BOOLEAN THEN
        v_score_geral := v_score_geral + 20;
    ELSIF (v_provisoes->>'taxa_cobertura')::NUMERIC >= 90 THEN
        v_score_geral := v_score_geral + 15;
    ELSIF (v_provisoes->>'taxa_cobertura')::NUMERIC >= 70 THEN
        v_score_geral := v_score_geral + 10;
    END IF;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'data_geracao', NOW(),
        'score_automacao', v_score_geral,
        'identificacao_pagadores', v_identificacao,
        'conciliacao_bancaria', v_conciliacao,
        'provisoes', v_provisoes,
        'status', CASE
            WHEN v_score_geral >= 80 THEN 'EXCELENTE'
            WHEN v_score_geral >= 60 THEN 'BOM'
            WHEN v_score_geral >= 40 THEN 'REGULAR'
            ELSE 'PRECISA ATENÇÃO'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_metricas_identificacao_pagadores(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_verificar_clientes_duplicados(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_metricas_conciliacao(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_verificar_transacoes_duplicadas(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_metricas_provisoes(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_gerar_provisoes_faltantes(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_dashboard_automacao(UUID) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
