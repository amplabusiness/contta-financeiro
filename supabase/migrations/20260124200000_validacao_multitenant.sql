-- =====================================================
-- VALIDAÇÃO MULTI-TENANT
-- Checklist item 3 - Multi-Tenant
-- =====================================================

-- =====================================================
-- 3.1 VERIFICAÇÃO DE RLS
-- =====================================================

-- Função: Verificar status de RLS em todas as tabelas
CREATE OR REPLACE FUNCTION fn_verificar_rls_status()
RETURNS TABLE (
    tabela TEXT,
    rls_habilitado BOOLEAN,
    tem_politica BOOLEAN,
    usa_tenant_id BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tablename::TEXT AS tabela,
        t.rowsecurity AS rls_habilitado,
        EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = t.tablename
        ) AS tem_politica,
        EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public'
              AND p.tablename = t.tablename
              AND (p.qual::TEXT LIKE '%tenant_id%' OR p.with_check::TEXT LIKE '%tenant_id%')
        ) AS usa_tenant_id
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename NOT LIKE 'bkp_%'
    ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Resumo de conformidade RLS
CREATE OR REPLACE FUNCTION fn_resumo_rls()
RETURNS JSONB AS $$
DECLARE
    v_total INTEGER;
    v_com_rls INTEGER;
    v_com_politica INTEGER;
    v_com_tenant INTEGER;
    v_tabelas_problema JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'bkp_%';

    SELECT COUNT(*) INTO v_com_rls
    FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'bkp_%' AND rowsecurity = TRUE;

    SELECT COUNT(DISTINCT tablename) INTO v_com_politica
    FROM pg_policies WHERE schemaname = 'public';

    SELECT COUNT(DISTINCT p.tablename) INTO v_com_tenant
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (p.qual::TEXT LIKE '%tenant_id%' OR p.with_check::TEXT LIKE '%tenant_id%');

    -- Tabelas sem RLS ou sem política
    SELECT COALESCE(jsonb_agg(t.tablename), '[]'::JSONB)
    INTO v_tabelas_problema
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename NOT LIKE 'bkp_%'
      AND (
          t.rowsecurity = FALSE
          OR NOT EXISTS (
              SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = t.tablename
          )
      );

    RETURN jsonb_build_object(
        'total_tabelas', v_total,
        'com_rls', v_com_rls,
        'com_politica', v_com_politica,
        'com_tenant_id', v_com_tenant,
        'taxa_conformidade', ROUND((v_com_tenant::NUMERIC / v_total) * 100, 1),
        'tabelas_problema', v_tabelas_problema,
        'conformidade_total', jsonb_array_length(v_tabelas_problema) = 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3.2 TESTE DE ISOLAMENTO
-- =====================================================

-- Função: Testar isolamento entre tenants
CREATE OR REPLACE FUNCTION fn_testar_isolamento_tenant()
RETURNS JSONB AS $$
DECLARE
    v_tenants JSONB;
    v_tenant_a UUID;
    v_tenant_b UUID;
    v_clients_a INTEGER;
    v_clients_b INTEGER;
    v_passed BOOLEAN := TRUE;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Lista todos os tenants
    SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name))
    INTO v_tenants
    FROM tenants;

    -- Pega os dois primeiros tenants
    SELECT id INTO v_tenant_a FROM tenants ORDER BY name LIMIT 1;
    SELECT id INTO v_tenant_b FROM tenants ORDER BY name LIMIT 1 OFFSET 1;

    IF v_tenant_a IS NULL OR v_tenant_b IS NULL THEN
        RETURN jsonb_build_object(
            'passed', FALSE,
            'error', 'Necessário pelo menos 2 tenants para testar isolamento',
            'tenants', v_tenants
        );
    END IF;

    -- Conta clientes de cada tenant (como superuser, sem RLS)
    SELECT COUNT(*) INTO v_clients_a FROM clients WHERE tenant_id = v_tenant_a;
    SELECT COUNT(*) INTO v_clients_b FROM clients WHERE tenant_id = v_tenant_b;

    -- Verifica se não há sobreposição de IDs
    IF EXISTS (
        SELECT 1 FROM clients c1
        JOIN clients c2 ON c1.id = c2.id
        WHERE c1.tenant_id = v_tenant_a AND c2.tenant_id = v_tenant_b
    ) THEN
        v_errors := array_append(v_errors, 'Detectados IDs de clientes duplicados entre tenants');
        v_passed := FALSE;
    END IF;

    -- Verifica se não há dados órfãos (sem tenant_id)
    IF EXISTS (SELECT 1 FROM clients WHERE tenant_id IS NULL) THEN
        v_errors := array_append(v_errors, 'Existem clientes sem tenant_id');
        v_passed := FALSE;
    END IF;

    IF EXISTS (SELECT 1 FROM bank_transactions WHERE tenant_id IS NULL) THEN
        v_errors := array_append(v_errors, 'Existem transações sem tenant_id');
        v_passed := FALSE;
    END IF;

    IF EXISTS (SELECT 1 FROM accounting_entries WHERE tenant_id IS NULL) THEN
        v_errors := array_append(v_errors, 'Existem lançamentos sem tenant_id');
        v_passed := FALSE;
    END IF;

    RETURN jsonb_build_object(
        'passed', v_passed,
        'errors', to_jsonb(v_errors),
        'tenants', v_tenants,
        'detalhes', jsonb_build_object(
            'tenant_a', jsonb_build_object('id', v_tenant_a, 'clientes', v_clients_a),
            'tenant_b', jsonb_build_object('id', v_tenant_b, 'clientes', v_clients_b)
        ),
        'verificacoes', jsonb_build_object(
            'sem_ids_duplicados', NOT EXISTS (
                SELECT 1 FROM clients c1
                JOIN clients c2 ON c1.id = c2.id
                WHERE c1.tenant_id = v_tenant_a AND c2.tenant_id = v_tenant_b
            ),
            'sem_orfaos_clients', NOT EXISTS (SELECT 1 FROM clients WHERE tenant_id IS NULL),
            'sem_orfaos_transactions', NOT EXISTS (SELECT 1 FROM bank_transactions WHERE tenant_id IS NULL),
            'sem_orfaos_entries', NOT EXISTS (SELECT 1 FROM accounting_entries WHERE tenant_id IS NULL)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3.3 ONBOARDING DE TENANT
-- =====================================================

-- Função: Verificar requisitos de onboarding
CREATE OR REPLACE FUNCTION fn_verificar_onboarding_tenant(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_name TEXT;
    v_tem_plano_contas BOOLEAN;
    v_tem_banco BOOLEAN;
    v_tem_cliente BOOLEAN;
    v_tem_usuario BOOLEAN;
    v_qtd_contas INTEGER;
    v_qtd_clientes INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Nome do tenant
    SELECT name INTO v_tenant_name FROM tenants WHERE id = v_tenant_id;

    -- Verifica plano de contas
    SELECT COUNT(*) > 0, COUNT(*) INTO v_tem_plano_contas, v_qtd_contas
    FROM chart_of_accounts WHERE tenant_id = v_tenant_id;

    -- Verifica conta bancária
    SELECT EXISTS (SELECT 1 FROM bank_accounts WHERE tenant_id = v_tenant_id AND is_active = TRUE)
    INTO v_tem_banco;

    -- Verifica clientes
    SELECT COUNT(*) > 0, COUNT(*) INTO v_tem_cliente, v_qtd_clientes
    FROM clients WHERE tenant_id = v_tenant_id;

    -- Verifica usuários
    SELECT EXISTS (
        SELECT 1 FROM tenant_users WHERE tenant_id = v_tenant_id
    ) INTO v_tem_usuario;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'tenant_name', v_tenant_name,
        'onboarding_completo', v_tem_plano_contas AND v_tem_banco AND v_tem_cliente AND v_tem_usuario,
        'checklist', jsonb_build_object(
            'plano_contas', jsonb_build_object('ok', v_tem_plano_contas, 'qtd', v_qtd_contas),
            'conta_bancaria', jsonb_build_object('ok', v_tem_banco),
            'clientes', jsonb_build_object('ok', v_tem_cliente, 'qtd', v_qtd_clientes),
            'usuarios', jsonb_build_object('ok', v_tem_usuario)
        ),
        'proximo_passo', CASE
            WHEN NOT v_tem_usuario THEN 'Criar usuário para o tenant'
            WHEN NOT v_tem_plano_contas THEN 'Importar plano de contas padrão'
            WHEN NOT v_tem_banco THEN 'Configurar conta bancária'
            WHEN NOT v_tem_cliente THEN 'Cadastrar primeiro cliente'
            ELSE 'Onboarding completo!'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Dashboard Multi-Tenant
CREATE OR REPLACE FUNCTION fn_dashboard_multitenant()
RETURNS JSONB AS $$
DECLARE
    v_rls JSONB;
    v_isolamento JSONB;
    v_tenants JSONB;
    v_score INTEGER := 0;
BEGIN
    -- Resumo RLS
    v_rls := fn_resumo_rls();

    -- Teste de isolamento
    v_isolamento := fn_testar_isolamento_tenant();

    -- Status de cada tenant
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'clientes', (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id),
            'transacoes', (SELECT COUNT(*) FROM bank_transactions WHERE tenant_id = t.id),
            'lancamentos', (SELECT COUNT(*) FROM accounting_entries WHERE tenant_id = t.id)
        )
    ), '[]'::JSONB)
    INTO v_tenants
    FROM tenants t;

    -- Calcula score
    IF (v_rls->>'conformidade_total')::BOOLEAN THEN v_score := v_score + 40; END IF;
    IF (v_isolamento->>'passed')::BOOLEAN THEN v_score := v_score + 40; END IF;
    IF jsonb_array_length(v_tenants) >= 2 THEN v_score := v_score + 20; END IF;

    RETURN jsonb_build_object(
        'data_geracao', NOW(),
        'score_multitenant', v_score,
        'status', CASE
            WHEN v_score >= 80 THEN 'EXCELENTE'
            WHEN v_score >= 60 THEN 'BOM'
            WHEN v_score >= 40 THEN 'REGULAR'
            ELSE 'PRECISA ATENÇÃO'
        END,
        'rls', v_rls,
        'isolamento', v_isolamento,
        'tenants', v_tenants
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_verificar_rls_status() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_resumo_rls() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_testar_isolamento_tenant() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_verificar_onboarding_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_dashboard_multitenant() TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
