-- =====================================================
-- MÉTRICAS DE PERFORMANCE
-- Checklist item 4 - Performance
-- =====================================================

-- =====================================================
-- 4.1 BENCHMARK DE OPERAÇÕES
-- =====================================================

-- Função: Benchmark do Dashboard
CREATE OR REPLACE FUNCTION fn_benchmark_dashboard(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_t1 TIMESTAMPTZ;
    v_t2 TIMESTAMPTZ;
    v_clientes_count INTEGER;
    v_transacoes_count INTEGER;
    v_lancamentos_count INTEGER;
    v_contas_count INTEGER;
    v_ms_clientes INTEGER;
    v_ms_transacoes INTEGER;
    v_ms_lancamentos INTEGER;
    v_ms_balances INTEGER;
    v_ms_total INTEGER;
    v_dummy RECORD;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_start := clock_timestamp();

    -- 1. Benchmark: Contagem de clientes ativos
    v_t1 := clock_timestamp();
    SELECT COUNT(*) INTO v_clientes_count
    FROM clients WHERE tenant_id = v_tenant_id AND is_active = TRUE;
    v_t2 := clock_timestamp();
    v_ms_clientes := EXTRACT(EPOCH FROM (v_t2 - v_t1)) * 1000;

    -- 2. Benchmark: Contagem de transações do mês
    v_t1 := clock_timestamp();
    SELECT COUNT(*) INTO v_transacoes_count
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE);
    v_t2 := clock_timestamp();
    v_ms_transacoes := EXTRACT(EPOCH FROM (v_t2 - v_t1)) * 1000;

    -- 3. Benchmark: Contagem de lançamentos
    v_t1 := clock_timestamp();
    SELECT COUNT(*) INTO v_lancamentos_count
    FROM accounting_entries WHERE tenant_id = v_tenant_id;
    v_t2 := clock_timestamp();
    v_ms_lancamentos := EXTRACT(EPOCH FROM (v_t2 - v_t1)) * 1000;

    -- 4. Benchmark: Saldos de contas (operação mais pesada)
    v_t1 := clock_timestamp();
    SELECT COUNT(*) INTO v_contas_count
    FROM chart_of_accounts WHERE tenant_id = v_tenant_id;

    -- Simula cálculo de saldos como o Dashboard faz
    FOR v_dummy IN (
        SELECT
            coa.code,
            COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) AS saldo
        FROM chart_of_accounts coa
        LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
        WHERE coa.tenant_id = v_tenant_id
          AND coa.code LIKE '1.1.%'
        GROUP BY coa.id, coa.code
        LIMIT 100
    ) LOOP
        -- Apenas iterando para simular carga
    END LOOP;
    v_t2 := clock_timestamp();
    v_ms_balances := EXTRACT(EPOCH FROM (v_t2 - v_t1)) * 1000;

    v_end := clock_timestamp();
    v_ms_total := EXTRACT(EPOCH FROM (v_end - v_start)) * 1000;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'executed_at', v_start,
        'volumes', jsonb_build_object(
            'clientes_ativos', v_clientes_count,
            'transacoes_mes', v_transacoes_count,
            'lancamentos_total', v_lancamentos_count,
            'contas_plano', v_contas_count
        ),
        'tempos_ms', jsonb_build_object(
            'clientes', v_ms_clientes,
            'transacoes', v_ms_transacoes,
            'lancamentos', v_ms_lancamentos,
            'balances', v_ms_balances,
            'total', v_ms_total
        ),
        'limites', jsonb_build_object(
            'dashboard_ok', v_ms_total < 3000,
            'max_recomendado_ms', 3000
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Benchmark de Relatório de Inadimplência
CREATE OR REPLACE FUNCTION fn_benchmark_inadimplencia(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_ms_query INTEGER;
    v_faturas_count INTEGER;
    v_valor_total NUMERIC;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_start := clock_timestamp();

    -- Simula relatório de inadimplência
    SELECT
        COUNT(*),
        COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0)
    INTO v_faturas_count, v_valor_total
    FROM client_opening_balance
    WHERE tenant_id = v_tenant_id
      AND status = 'pending'
      AND due_date < CURRENT_DATE;

    v_end := clock_timestamp();
    v_ms_query := EXTRACT(EPOCH FROM (v_end - v_start)) * 1000;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'faturas_vencidas', v_faturas_count,
        'valor_total', v_valor_total,
        'tempo_ms', v_ms_query,
        'performance_ok', v_ms_query < 2000,
        'limite_testado', '1000+ faturas'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Benchmark de Busca de Contas
CREATE OR REPLACE FUNCTION fn_benchmark_busca_contas(
    p_tenant_id UUID DEFAULT NULL,
    p_termo TEXT DEFAULT 'cliente'
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_ms_query INTEGER;
    v_contas_encontradas INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_start := clock_timestamp();

    -- Simula busca de contas por nome
    SELECT COUNT(*) INTO v_contas_encontradas
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND (name ILIKE '%' || p_termo || '%' OR code ILIKE '%' || p_termo || '%');

    v_end := clock_timestamp();
    v_ms_query := EXTRACT(EPOCH FROM (v_end - v_start)) * 1000;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'termo_busca', p_termo,
        'contas_encontradas', v_contas_encontradas,
        'tempo_ms', v_ms_query,
        'performance_ok', v_ms_query < 500,
        'limite_testado', '500+ contas'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4.2 ANÁLISE DE ÍNDICES
-- =====================================================

-- Função: Verificar índices importantes
CREATE OR REPLACE FUNCTION fn_verificar_indices()
RETURNS TABLE (
    tabela TEXT,
    indice TEXT,
    colunas TEXT,
    tamanho TEXT,
    uso_estimado TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.relname::TEXT AS tabela,
        i.relname::TEXT AS indice,
        pg_get_indexdef(i.oid)::TEXT AS colunas,
        pg_size_pretty(pg_relation_size(i.oid))::TEXT AS tamanho,
        CASE
            WHEN s.idx_scan > 1000 THEN 'ALTO'
            WHEN s.idx_scan > 100 THEN 'MÉDIO'
            WHEN s.idx_scan > 0 THEN 'BAIXO'
            ELSE 'NÃO USADO'
        END AS uso_estimado
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.oid
    WHERE t.relkind = 'r'
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND t.relname IN ('clients', 'bank_transactions', 'accounting_entries', 'accounting_entry_lines', 'chart_of_accounts', 'client_opening_balance')
    ORDER BY t.relname, i.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Verificar tabelas sem índice em tenant_id
CREATE OR REPLACE FUNCTION fn_tabelas_sem_indice_tenant()
RETURNS TABLE (
    tabela TEXT,
    tem_coluna_tenant BOOLEAN,
    tem_indice_tenant BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tablename::TEXT AS tabela,
        EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = t.tablename
              AND c.column_name = 'tenant_id'
        ) AS tem_coluna_tenant,
        EXISTS (
            SELECT 1 FROM pg_indexes i
            WHERE i.schemaname = 'public'
              AND i.tablename = t.tablename
              AND i.indexdef LIKE '%tenant_id%'
        ) AS tem_indice_tenant
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename NOT LIKE 'bkp_%'
      AND EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = t.tablename
            AND c.column_name = 'tenant_id'
      )
      AND NOT EXISTS (
          SELECT 1 FROM pg_indexes i
          WHERE i.schemaname = 'public'
            AND i.tablename = t.tablename
            AND i.indexdef LIKE '%tenant_id%'
      )
    ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4.3 DASHBOARD DE PERFORMANCE
-- =====================================================

CREATE OR REPLACE FUNCTION fn_dashboard_performance(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_benchmark_dashboard JSONB;
    v_benchmark_inadimplencia JSONB;
    v_benchmark_busca JSONB;
    v_tabelas_sem_indice INTEGER;
    v_score INTEGER := 0;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Executa benchmarks
    v_benchmark_dashboard := fn_benchmark_dashboard(v_tenant_id);
    v_benchmark_inadimplencia := fn_benchmark_inadimplencia(v_tenant_id);
    v_benchmark_busca := fn_benchmark_busca_contas(v_tenant_id, 'cliente');

    -- Conta tabelas sem índice em tenant_id
    SELECT COUNT(*) INTO v_tabelas_sem_indice
    FROM fn_tabelas_sem_indice_tenant();

    -- Calcula score
    IF (v_benchmark_dashboard->'limites'->>'dashboard_ok')::BOOLEAN THEN
        v_score := v_score + 30;
    END IF;

    IF (v_benchmark_inadimplencia->>'performance_ok')::BOOLEAN THEN
        v_score := v_score + 30;
    END IF;

    IF (v_benchmark_busca->>'performance_ok')::BOOLEAN THEN
        v_score := v_score + 20;
    END IF;

    IF v_tabelas_sem_indice <= 5 THEN
        v_score := v_score + 20;
    ELSIF v_tabelas_sem_indice <= 10 THEN
        v_score := v_score + 10;
    END IF;

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'data_geracao', NOW(),
        'score_performance', v_score,
        'status', CASE
            WHEN v_score >= 80 THEN 'EXCELENTE'
            WHEN v_score >= 60 THEN 'BOM'
            WHEN v_score >= 40 THEN 'REGULAR'
            ELSE 'PRECISA OTIMIZAÇÃO'
        END,
        'benchmarks', jsonb_build_object(
            'dashboard', v_benchmark_dashboard,
            'inadimplencia', v_benchmark_inadimplencia,
            'busca_contas', v_benchmark_busca
        ),
        'indices', jsonb_build_object(
            'tabelas_sem_indice_tenant', v_tabelas_sem_indice
        ),
        'limites_conhecidos', jsonb_build_object(
            'postgrest_url_max_chars', 2048,
            'rpc_resolve_grupos_grandes', TRUE,
            'edge_function_timeout_ms', 30000,
            'max_rows_per_query', 50000
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_benchmark_dashboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_benchmark_inadimplencia(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_benchmark_busca_contas(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_verificar_indices() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_tabelas_sem_indice_tenant() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_dashboard_performance(UUID) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
