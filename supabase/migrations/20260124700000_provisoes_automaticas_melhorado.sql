-- =====================================================
-- PROVISÕES AUTOMÁTICAS MELHORADO
-- Checklist item 2.3 - Provisões
-- =====================================================

-- =====================================================
-- 1. FUNÇÃO: GERAR PROVISÕES COM LANÇAMENTO CONTÁBIL
-- =====================================================

CREATE OR REPLACE FUNCTION fn_gerar_provisao_com_lancamento(
    p_tenant_id UUID,
    p_client_id UUID,
    p_competencia TEXT,
    p_valor NUMERIC,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_due_date DATE;
    v_competence_date DATE;
    v_client RECORD;
    v_conta_cliente UUID;
    v_conta_receita UUID;
    v_entry_id UUID;
    v_cob_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Busca dados do cliente
    SELECT * INTO v_client
    FROM clients
    WHERE id = p_client_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Cliente não encontrado');
    END IF;

    -- Calcula datas
    v_competence_date := TO_DATE('01/' || p_competencia, 'DD/MM/YYYY');
    v_due_date := (v_competence_date + INTERVAL '1 month' + INTERVAL '9 days')::DATE;

    -- Verifica se já existe provisão
    IF EXISTS (
        SELECT 1 FROM client_opening_balance
        WHERE client_id = p_client_id
          AND competence = p_competencia
          AND tenant_id = v_tenant_id
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Provisão já existe para esta competência');
    END IF;

    IF p_dry_run THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'dry_run', TRUE,
            'client_id', p_client_id,
            'client_name', v_client.name,
            'competencia', p_competencia,
            'valor', p_valor,
            'due_date', v_due_date
        );
    END IF;

    -- Busca conta contábil do cliente (1.1.2.01.XXX)
    SELECT id INTO v_conta_cliente
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND LOWER(name) = LOWER(v_client.name)
      AND code LIKE '1.1.2.01.%'
    LIMIT 1;

    -- Busca conta de receita (3.1.1.01)
    SELECT id INTO v_conta_receita
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND code = '3.1.1.01'
    LIMIT 1;

    -- Se não encontrou conta de receita, tenta alternativas
    IF v_conta_receita IS NULL THEN
        SELECT id INTO v_conta_receita
        FROM chart_of_accounts
        WHERE tenant_id = v_tenant_id
          AND code LIKE '3.1.%'
          AND is_analytic = TRUE
        ORDER BY code
        LIMIT 1;
    END IF;

    -- Cria o client_opening_balance
    INSERT INTO client_opening_balance (
        tenant_id, client_id, competence, amount, due_date,
        description, status, fee_type, created_at
    ) VALUES (
        v_tenant_id, p_client_id, p_competencia, p_valor, v_due_date,
        'Honorários ' || p_competencia || ' - ' || v_client.name,
        'pending', 'monthly', NOW()
    )
    RETURNING id INTO v_cob_id;

    -- Se temos contas contábeis, cria o lançamento
    IF v_conta_cliente IS NOT NULL AND v_conta_receita IS NOT NULL THEN
        -- Cria entry
        INSERT INTO accounting_entries (
            tenant_id, competence_date, entry_date, description,
            entry_type, total_debit, total_credit, status
        ) VALUES (
            v_tenant_id, v_competence_date, CURRENT_DATE,
            'Provisão Honorários ' || p_competencia || ' - ' || v_client.name,
            'provision', p_valor, p_valor, 'posted'
        )
        RETURNING id INTO v_entry_id;

        -- Cria linha de débito (Cliente a Receber)
        INSERT INTO accounting_entry_lines (
            tenant_id, entry_id, account_id, debit, credit, description
        ) VALUES (
            v_tenant_id, v_entry_id, v_conta_cliente, p_valor, 0,
            'D - ' || v_client.name || ' - ' || p_competencia
        );

        -- Cria linha de crédito (Receita)
        INSERT INTO accounting_entry_lines (
            tenant_id, entry_id, account_id, debit, credit, description
        ) VALUES (
            v_tenant_id, v_entry_id, v_conta_receita, 0, p_valor,
            'C - Receita Honorários - ' || p_competencia
        );

        -- Vincula à provisão
        UPDATE client_opening_balance
        SET journal_entry_id = v_entry_id
        WHERE id = v_cob_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'client_id', p_client_id,
        'client_name', v_client.name,
        'competencia', p_competencia,
        'valor', p_valor,
        'due_date', v_due_date,
        'cob_id', v_cob_id,
        'entry_id', v_entry_id,
        'tem_lancamento', v_entry_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. FUNÇÃO: GERAR PROVISÕES EM LOTE (MELHORADA)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_gerar_provisoes_lote(
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
    v_erros INTEGER := 0;
    v_com_lancamento INTEGER := 0;
    v_client RECORD;
    v_resultado JSONB;
    v_detalhes JSONB[] := ARRAY[]::JSONB[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_competencia := COALESCE(p_competencia, TO_CHAR(CURRENT_DATE, 'MM/YYYY'));

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
                AND cob.tenant_id = v_tenant_id
          )
        ORDER BY c.name
    )
    LOOP
        v_resultado := fn_gerar_provisao_com_lancamento(
            v_tenant_id,
            v_client.id,
            v_competencia,
            v_client.monthly_fee,
            p_dry_run
        );

        IF (v_resultado->>'success')::BOOLEAN THEN
            v_count := v_count + 1;
            v_total := v_total + v_client.monthly_fee;
            IF (v_resultado->>'tem_lancamento')::BOOLEAN THEN
                v_com_lancamento := v_com_lancamento + 1;
            END IF;
        ELSE
            v_erros := v_erros + 1;
        END IF;

        v_detalhes := array_append(v_detalhes, jsonb_build_object(
            'client_name', v_client.name,
            'valor', v_client.monthly_fee,
            'success', (v_resultado->>'success')::BOOLEAN
        ));
    END LOOP;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'competencia', v_competencia,
        'dry_run', p_dry_run,
        'provisoes_criadas', v_count,
        'com_lancamento_contabil', v_com_lancamento,
        'erros', v_erros,
        'valor_total', v_total,
        'detalhes', to_jsonb(v_detalhes)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. FUNÇÃO: GERAR PROVISÕES MÚLTIPLOS MESES
-- =====================================================

CREATE OR REPLACE FUNCTION fn_gerar_provisoes_periodo(
    p_tenant_id UUID DEFAULT NULL,
    p_mes_inicio TEXT DEFAULT NULL,
    p_mes_fim TEXT DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_data_inicio DATE;
    v_data_fim DATE;
    v_data_atual DATE;
    v_competencia TEXT;
    v_resultado JSONB;
    v_total_provisoes INTEGER := 0;
    v_total_valor NUMERIC := 0;
    v_meses JSONB[] := ARRAY[]::JSONB[];
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Define período (padrão: mês atual)
    v_data_inicio := TO_DATE('01/' || COALESCE(p_mes_inicio, TO_CHAR(CURRENT_DATE, 'MM/YYYY')), 'DD/MM/YYYY');
    v_data_fim := TO_DATE('01/' || COALESCE(p_mes_fim, TO_CHAR(CURRENT_DATE, 'MM/YYYY')), 'DD/MM/YYYY');

    v_data_atual := v_data_inicio;

    WHILE v_data_atual <= v_data_fim LOOP
        v_competencia := TO_CHAR(v_data_atual, 'MM/YYYY');

        v_resultado := fn_gerar_provisoes_lote(v_tenant_id, v_competencia, p_dry_run);

        v_total_provisoes := v_total_provisoes + COALESCE((v_resultado->>'provisoes_criadas')::INTEGER, 0);
        v_total_valor := v_total_valor + COALESCE((v_resultado->>'valor_total')::NUMERIC, 0);

        v_meses := array_append(v_meses, jsonb_build_object(
            'competencia', v_competencia,
            'provisoes', (v_resultado->>'provisoes_criadas')::INTEGER,
            'valor', (v_resultado->>'valor_total')::NUMERIC
        ));

        v_data_atual := v_data_atual + INTERVAL '1 month';
    END LOOP;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'periodo', jsonb_build_object(
            'inicio', p_mes_inicio,
            'fim', p_mes_fim
        ),
        'dry_run', p_dry_run,
        'total_provisoes', v_total_provisoes,
        'total_valor', v_total_valor,
        'meses', to_jsonb(v_meses)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. FUNÇÃO: DASHBOARD DE PROVISÕES
-- =====================================================

CREATE OR REPLACE FUNCTION fn_dashboard_provisoes(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_mes_atual TEXT;
    v_clientes_ativos INTEGER;
    v_clientes_com_honorario INTEGER;
    v_provisoes_mes INTEGER;
    v_valor_provisionado NUMERIC;
    v_faltantes INTEGER;
    v_valor_faltante NUMERIC;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_mes_atual := TO_CHAR(CURRENT_DATE, 'MM/YYYY');

    -- Clientes ativos
    SELECT COUNT(*) INTO v_clientes_ativos
    FROM clients
    WHERE tenant_id = v_tenant_id AND is_active = TRUE;

    -- Clientes com honorário definido
    SELECT COUNT(*) INTO v_clientes_com_honorario
    FROM clients
    WHERE tenant_id = v_tenant_id AND is_active = TRUE AND monthly_fee > 0;

    -- Provisões do mês atual
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_provisoes_mes, v_valor_provisionado
    FROM client_opening_balance
    WHERE tenant_id = v_tenant_id
      AND competence = v_mes_atual;

    -- Clientes faltando provisão
    SELECT COUNT(*), COALESCE(SUM(c.monthly_fee), 0)
    INTO v_faltantes, v_valor_faltante
    FROM clients c
    WHERE c.tenant_id = v_tenant_id
      AND c.is_active = TRUE
      AND c.monthly_fee > 0
      AND NOT EXISTS (
          SELECT 1 FROM client_opening_balance cob
          WHERE cob.client_id = c.id
            AND cob.competence = v_mes_atual
            AND cob.tenant_id = v_tenant_id
      );

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'mes_referencia', v_mes_atual,
        'data_geracao', NOW(),
        'clientes', jsonb_build_object(
            'ativos', v_clientes_ativos,
            'com_honorario', v_clientes_com_honorario
        ),
        'provisoes_mes', jsonb_build_object(
            'quantidade', v_provisoes_mes,
            'valor_total', v_valor_provisionado,
            'cobertura_percentual', CASE
                WHEN v_clientes_com_honorario > 0
                THEN ROUND((v_provisoes_mes::NUMERIC / v_clientes_com_honorario) * 100, 1)
                ELSE 100
            END
        ),
        'faltantes', jsonb_build_object(
            'quantidade', v_faltantes,
            'valor_total', v_valor_faltante
        ),
        'recomendacao', CASE
            WHEN v_faltantes > 0
            THEN FORMAT('Executar: SELECT fn_gerar_provisoes_lote(NULL, ''%s'', FALSE) -- %s provisões faltantes', v_mes_atual, v_faltantes)
            ELSE 'Todas as provisões do mês estão em dia'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_gerar_provisao_com_lancamento(UUID, UUID, TEXT, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_gerar_provisoes_lote(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_gerar_provisoes_periodo(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_dashboard_provisoes(UUID) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
