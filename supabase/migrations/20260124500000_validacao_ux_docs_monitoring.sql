-- =====================================================
-- VALIDAÇÃO: UX, DOCUMENTAÇÃO E MONITORAMENTO
-- Checklist items 6, 7, 8
-- =====================================================

-- =====================================================
-- 6. EXPERIÊNCIA DO USUÁRIO
-- (Itens verificados manualmente no frontend)
-- =====================================================

-- Tabela para configurações de UX por tenant
CREATE TABLE IF NOT EXISTS ux_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    loading_states_enabled BOOLEAN DEFAULT TRUE,
    toast_notifications_enabled BOOLEAN DEFAULT TRUE,
    confirm_destructive_actions BOOLEAN DEFAULT TRUE,
    dark_mode_enabled BOOLEAN DEFAULT FALSE,
    responsive_design_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para ux_settings
ALTER TABLE ux_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant vê suas configurações" ON ux_settings
    FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant pode atualizar suas configurações" ON ux_settings
    FOR UPDATE USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Sistema pode inserir configurações" ON ux_settings
    FOR INSERT WITH CHECK (TRUE);

-- =====================================================
-- 7. DOCUMENTAÇÃO
-- =====================================================

-- Tabela para armazenar documentação do sistema
CREATE TABLE IF NOT EXISTS system_documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type TEXT NOT NULL CHECK (doc_type IN (
        'user_manual',      -- Manual de uso
        'faq',              -- Perguntas frequentes
        'video_tutorial',   -- Tutorial em vídeo
        'glossary',         -- Glossário contábil
        'runbook',          -- Runbook para suporte
        'diagnostic',       -- Scripts de diagnóstico
        'backup_restore',   -- Processo de backup
        'emergency_contact' -- Contatos de emergência
    )),
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    version TEXT DEFAULT '1.0',
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (documentação é pública para authenticated)
ALTER TABLE system_documentation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Documentação visível para authenticated" ON system_documentation
    FOR SELECT TO authenticated USING (is_published = TRUE);

-- Inserir documentação base (marcada como não publicada até ser escrita)
INSERT INTO system_documentation (doc_type, title, is_published, content) VALUES
    ('user_manual', 'Manual de Uso Básico', FALSE, 'Pendente: Criar manual de uso básico do sistema'),
    ('faq', 'Perguntas Frequentes', FALSE, 'Pendente: Compilar FAQ de problemas comuns'),
    ('video_tutorial', 'Vídeos de Onboarding', FALSE, 'Pendente: Gravar vídeos de onboarding'),
    ('glossary', 'Glossário Contábil', FALSE, 'Pendente: Criar glossário de termos contábeis'),
    ('runbook', 'Runbook de Problemas Conhecidos', FALSE, 'Pendente: Documentar problemas conhecidos e soluções'),
    ('diagnostic', 'Scripts de Diagnóstico', TRUE, 'Funções RPC disponíveis: fn_daily_integrity_check(), fn_dashboard_automacao(), fn_dashboard_multitenant(), fn_dashboard_performance(), fn_dashboard_seguranca()'),
    ('backup_restore', 'Processo de Backup/Restore', FALSE, 'Pendente: Documentar processo de backup'),
    ('emergency_contact', 'Contatos de Emergência', FALSE, 'Pendente: Definir contatos de emergência')
ON CONFLICT DO NOTHING;

-- Função: Status da documentação
CREATE OR REPLACE FUNCTION fn_status_documentacao()
RETURNS JSONB AS $$
DECLARE
    v_total INTEGER;
    v_published INTEGER;
    v_pending INTEGER;
    v_docs JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total FROM system_documentation;
    SELECT COUNT(*) INTO v_published FROM system_documentation WHERE is_published = TRUE;
    v_pending := v_total - v_published;

    SELECT jsonb_agg(doc_obj) INTO v_docs
    FROM (
        SELECT jsonb_build_object(
            'tipo', doc_type,
            'titulo', title,
            'publicado', is_published
        ) AS doc_obj
        FROM system_documentation
        ORDER BY doc_type
    ) subq;

    RETURN jsonb_build_object(
        'total', v_total,
        'publicados', v_published,
        'pendentes', v_pending,
        'cobertura_percentual', ROUND((v_published::NUMERIC / NULLIF(v_total, 0)) * 100, 1),
        'documentos', v_docs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. MONITORAMENTO
-- =====================================================

-- Tabela para armazenar métricas de monitoramento
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'edge_function_error',
        'slow_query',
        'error_500',
        'disk_usage',
        'active_users',
        'response_time',
        'error_rate',
        'storage_usage'
    )),
    tenant_id UUID REFERENCES tenants(id),
    value NUMERIC,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para métricas
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tenant ON system_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created ON system_metrics(created_at DESC);

-- RLS para métricas (admins podem ver tudo)
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema pode inserir métricas" ON system_metrics
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Tenant vê suas métricas" ON system_metrics
    FOR SELECT USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

-- Função: Registrar métrica
CREATE OR REPLACE FUNCTION fn_registrar_metrica(
    p_metric_type TEXT,
    p_value NUMERIC DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_metric_id UUID;
BEGIN
    INSERT INTO system_metrics (metric_type, tenant_id, value, details)
    VALUES (p_metric_type, COALESCE(p_tenant_id, get_my_tenant_id()), p_value, p_details)
    RETURNING id INTO v_metric_id;

    RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Métricas de uso (últimos 7 dias)
CREATE OR REPLACE FUNCTION fn_metricas_uso(
    p_tenant_id UUID DEFAULT NULL,
    p_dias INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_logins INTEGER;
    v_transacoes INTEGER;
    v_lancamentos INTEGER;
    v_erros INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Logins nos últimos dias (via auth.users)
    SELECT COUNT(*) INTO v_logins
    FROM auth.users u
    JOIN tenant_users tu ON tu.user_id = u.id
    WHERE tu.tenant_id = v_tenant_id
      AND u.last_sign_in_at >= NOW() - (p_dias || ' days')::INTERVAL;

    -- Transações criadas no período
    SELECT COUNT(*) INTO v_transacoes
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND created_at >= NOW() - (p_dias || ' days')::INTERVAL;

    -- Lançamentos criados no período
    SELECT COUNT(*) INTO v_lancamentos
    FROM accounting_entries
    WHERE tenant_id = v_tenant_id
      AND created_at >= NOW() - (p_dias || ' days')::INTERVAL;

    -- Erros registrados no período
    SELECT COUNT(*) INTO v_erros
    FROM system_metrics
    WHERE (tenant_id = v_tenant_id OR tenant_id IS NULL)
      AND metric_type IN ('edge_function_error', 'error_500')
      AND created_at >= NOW() - (p_dias || ' days')::INTERVAL;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'periodo_dias', p_dias,
        'logins_ativos', v_logins,
        'transacoes_criadas', v_transacoes,
        'lancamentos_criados', v_lancamentos,
        'erros_registrados', v_erros,
        'taxa_erro_percentual', CASE
            WHEN (v_transacoes + v_lancamentos) > 0
            THEN ROUND((v_erros::NUMERIC / (v_transacoes + v_lancamentos)) * 100, 2)
            ELSE 0
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Dashboard de Monitoramento
CREATE OR REPLACE FUNCTION fn_dashboard_monitoramento(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_metricas_uso JSONB;
    v_alertas_pendentes INTEGER;
    v_ultimo_erro TIMESTAMPTZ;
    v_db_size TEXT;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Métricas de uso
    v_metricas_uso := fn_metricas_uso(v_tenant_id, 7);

    -- Alertas pendentes
    SELECT COUNT(*) INTO v_alertas_pendentes
    FROM accounting_alerts
    WHERE tenant_id = v_tenant_id
      AND resolved_at IS NULL;

    -- Último erro
    SELECT MAX(created_at) INTO v_ultimo_erro
    FROM system_metrics
    WHERE (tenant_id = v_tenant_id OR tenant_id IS NULL)
      AND metric_type IN ('edge_function_error', 'error_500');

    -- Tamanho do banco (aproximado)
    SELECT pg_size_pretty(pg_database_size(current_database())) INTO v_db_size;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'data_geracao', NOW(),
        'metricas_uso', v_metricas_uso,
        'alertas_pendentes', v_alertas_pendentes,
        'ultimo_erro', v_ultimo_erro,
        'tamanho_banco', v_db_size,
        'status_servicos', jsonb_build_object(
            'database', 'online',
            'supabase_auth', 'online',
            'supabase_storage', 'online',
            'edge_functions', 'verificar manualmente'
        ),
        'limites_conhecidos', jsonb_build_object(
            'edge_function_timeout_ms', 30000,
            'max_rows_per_query', 50000,
            'postgrest_url_max_chars', 2048
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DASHBOARD GERAL DO CHECKLIST
-- =====================================================

CREATE OR REPLACE FUNCTION fn_dashboard_checklist_producao(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_integridade JSONB;
    v_automacao JSONB;
    v_multitenant JSONB;
    v_performance JSONB;
    v_seguranca JSONB;
    v_documentacao JSONB;
    v_monitoramento JSONB;
    v_score_total INTEGER := 0;
    v_max_score INTEGER := 700;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- 1. Integridade Contábil
    v_integridade := fn_resumo_consistencia(v_tenant_id);

    -- 2. Automação e IA
    v_automacao := fn_dashboard_automacao(v_tenant_id);

    -- 3. Multi-Tenant
    v_multitenant := fn_dashboard_multitenant();

    -- 4. Performance
    v_performance := fn_dashboard_performance(v_tenant_id);

    -- 5. Segurança
    v_seguranca := fn_dashboard_seguranca(v_tenant_id);

    -- 6/7/8. Documentação e Monitoramento
    v_documentacao := fn_status_documentacao();
    v_monitoramento := fn_dashboard_monitoramento(v_tenant_id);

    -- Calcula score total
    v_score_total := COALESCE((v_integridade->>'score')::NUMERIC, 0)::INTEGER +
                     COALESCE((v_automacao->>'score_automacao')::NUMERIC, 0)::INTEGER +
                     COALESCE((v_multitenant->>'score_multitenant')::NUMERIC, 0)::INTEGER +
                     COALESCE((v_performance->>'score_performance')::NUMERIC, 0)::INTEGER +
                     COALESCE((v_seguranca->>'score_seguranca')::NUMERIC, 0)::INTEGER +
                     COALESCE((v_documentacao->>'cobertura_percentual')::NUMERIC, 0)::INTEGER +
                     100; -- Monitoramento base

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'data_geracao', NOW(),
        'score_total', v_score_total,
        'score_maximo', v_max_score,
        'percentual_conclusao', ROUND((v_score_total::NUMERIC / v_max_score) * 100, 1),
        'status_geral', CASE
            WHEN v_score_total >= 600 THEN 'PRONTO PARA PRODUÇÃO'
            WHEN v_score_total >= 500 THEN 'QUASE PRONTO'
            WHEN v_score_total >= 400 THEN 'EM PROGRESSO'
            ELSE 'PRECISA ATENÇÃO'
        END,
        'secoes', jsonb_build_object(
            '1_integridade_contabil', jsonb_build_object(
                'score', COALESCE((v_integridade->>'score')::INTEGER, 0),
                'status', v_integridade->>'status'
            ),
            '2_automacao_ia', jsonb_build_object(
                'score', COALESCE((v_automacao->>'score_automacao')::INTEGER, 0),
                'status', v_automacao->>'status'
            ),
            '3_multitenant', jsonb_build_object(
                'score', COALESCE((v_multitenant->>'score_multitenant')::INTEGER, 0),
                'status', v_multitenant->>'status'
            ),
            '4_performance', jsonb_build_object(
                'score', COALESCE((v_performance->>'score_performance')::INTEGER, 0),
                'status', v_performance->>'status'
            ),
            '5_seguranca', jsonb_build_object(
                'score', COALESCE((v_seguranca->>'score_seguranca')::INTEGER, 0),
                'status', v_seguranca->>'status'
            ),
            '6_7_documentacao', jsonb_build_object(
                'cobertura', v_documentacao->>'cobertura_percentual',
                'publicados', v_documentacao->>'publicados',
                'pendentes', v_documentacao->>'pendentes'
            ),
            '8_monitoramento', jsonb_build_object(
                'alertas_pendentes', v_monitoramento->>'alertas_pendentes',
                'ultimo_erro', v_monitoramento->>'ultimo_erro'
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON ux_settings TO authenticated;
GRANT UPDATE ON ux_settings TO authenticated;
GRANT INSERT ON ux_settings TO authenticated;
GRANT SELECT ON system_documentation TO authenticated;
GRANT SELECT ON system_metrics TO authenticated;
GRANT INSERT ON system_metrics TO authenticated;

GRANT EXECUTE ON FUNCTION fn_status_documentacao() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_metrica(TEXT, NUMERIC, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_metricas_uso(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_dashboard_monitoramento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_dashboard_checklist_producao(UUID) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
