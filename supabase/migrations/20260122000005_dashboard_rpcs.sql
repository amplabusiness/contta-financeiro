-- ============================================================================
-- SPRINT 3: RPCs PARA DASHBOARD DE AUTOMACAO
-- Funcoes para fornecer estatisticas em tempo real
-- ============================================================================

-- ============================================================================
-- PARTE 1: ESTATISTICAS DE TRANSACOES DO DIA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_transaction_stats(
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  -- Obter tenant do usuario
  v_tenant_id := get_my_tenant_id();

  SELECT jsonb_build_object(
    'totalTransactions', COUNT(*),
    'autoReconciled', COUNT(*) FILTER (WHERE auto_matched = true),
    'needsReview', COUNT(*) FILTER (WHERE needs_review = true AND matched = false),
    'failed', COUNT(*) FILTER (WHERE matched = false AND identification_confidence = 0),
    'totalCredits', COUNT(*) FILTER (WHERE amount > 0),
    'totalDebits', COUNT(*) FILTER (WHERE amount < 0),
    'totalCreditAmount', COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0),
    'totalDebitAmount', COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0)), 0),
    'avgConfidence', COALESCE(ROUND(AVG(identification_confidence) FILTER (WHERE identification_confidence > 0), 1), 0)
  ) INTO v_result
  FROM bank_transactions
  WHERE tenant_id = v_tenant_id
    AND DATE(transaction_date) = p_date;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 2: RESUMO DE FLUXO DE CAIXA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cash_flow_summary()
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
  v_current_balance NUMERIC;
  v_pending_receivables NUMERIC;
  v_pending_payables NUMERIC;
  v_projected_7d NUMERIC;
BEGIN
  v_tenant_id := get_my_tenant_id();

  -- Saldo atual em bancos
  SELECT COALESCE(SUM(bt.amount), 0) INTO v_current_balance
  FROM bank_transactions bt
  WHERE bt.tenant_id = v_tenant_id
    AND bt.matched = true;

  -- Recebiveis pendentes (faturas)
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_receivables
  FROM invoices
  WHERE tenant_id = v_tenant_id
    AND status IN ('pending', 'overdue');

  -- Pagaveis pendentes (contas a pagar)
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_payables
  FROM accounts_payable
  WHERE tenant_id = v_tenant_id
    AND status = 'pending';

  -- Projecao 7 dias (recebiveis com vencimento nos proximos 7 dias)
  SELECT v_current_balance + COALESCE(SUM(amount), 0)
  INTO v_projected_7d
  FROM invoices
  WHERE tenant_id = v_tenant_id
    AND status IN ('pending', 'overdue')
    AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';

  v_result := jsonb_build_object(
    'currentBalance', ROUND(v_current_balance, 2),
    'pendingReceivables', ROUND(v_pending_receivables, 2),
    'pendingPayables', ROUND(v_pending_payables, 2),
    'projected7Days', ROUND(v_projected_7d, 2),
    'netPosition', ROUND(v_pending_receivables - v_pending_payables, 2)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 3: RESUMO DE COBRANCA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_collection_summary()
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  v_tenant_id := get_my_tenant_id();

  SELECT jsonb_build_object(
    'onTime', COUNT(DISTINCT client_id) FILTER (
      WHERE status = 'paid'
        OR (status IN ('pending', 'overdue') AND due_date >= CURRENT_DATE)
    ),
    'overdue1to30', COUNT(DISTINCT client_id) FILTER (
      WHERE status IN ('pending', 'overdue')
        AND due_date < CURRENT_DATE
        AND due_date >= CURRENT_DATE - INTERVAL '30 days'
    ),
    'overdue30plus', COUNT(DISTINCT client_id) FILTER (
      WHERE status IN ('pending', 'overdue')
        AND due_date < CURRENT_DATE - INTERVAL '30 days'
    ),
    'totalPending', COUNT(*) FILTER (WHERE status IN ('pending', 'overdue')),
    'totalOverdue', COUNT(*) FILTER (WHERE status = 'overdue'),
    'overdueAmount', COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0)
  ) INTO v_result
  FROM invoices
  WHERE tenant_id = v_tenant_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 4: ESTATISTICAS DE PERFORMANCE DA IA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_ai_performance_stats(
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
  v_patterns_count INTEGER;
  v_feedback_today INTEGER;
  v_confirmations INTEGER;
  v_corrections INTEGER;
BEGIN
  v_tenant_id := get_my_tenant_id();

  -- Total de padroes aprendidos
  SELECT COUNT(*) INTO v_patterns_count
  FROM ai_classification_patterns
  WHERE tenant_id = v_tenant_id
    AND effectiveness >= 0.7;

  -- Feedback do dia
  SELECT
    COUNT(*) FILTER (WHERE feedback_type = 'confirmed'),
    COUNT(*) FILTER (WHERE feedback_type = 'corrected')
  INTO v_confirmations, v_corrections
  FROM ai_classification_feedback
  WHERE tenant_id = v_tenant_id
    AND DATE(created_at) = p_date;

  -- Calcular metricas
  SELECT jsonb_build_object(
    'identificationsToday', COUNT(*) FILTER (WHERE identification_confidence > 0),
    'accuracy', CASE
      WHEN (v_confirmations + v_corrections) > 0
      THEN ROUND(v_confirmations::NUMERIC / (v_confirmations + v_corrections) * 100, 1)
      ELSE 100
    END,
    'patternsLearned', v_patterns_count,
    'confirmationsToday', v_confirmations,
    'correctionsToday', v_corrections,
    'avgConfidenceToday', COALESCE(ROUND(AVG(identification_confidence) FILTER (
      WHERE identification_confidence > 0 AND DATE(transaction_date) = p_date
    ), 1), 0),
    'methodBreakdown', (
      SELECT jsonb_object_agg(method, cnt)
      FROM (
        SELECT identification_method as method, COUNT(*) as cnt
        FROM bank_transactions
        WHERE tenant_id = v_tenant_id
          AND DATE(transaction_date) = p_date
          AND identification_method IS NOT NULL
        GROUP BY identification_method
      ) sub
    )
  ) INTO v_result
  FROM bank_transactions
  WHERE tenant_id = v_tenant_id
    AND DATE(transaction_date) = p_date;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 5: RESUMO GERAL DO DASHBOARD
-- ============================================================================

CREATE OR REPLACE FUNCTION get_automation_dashboard_summary()
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_daily JSONB;
  v_cash_flow JSONB;
  v_collection JSONB;
  v_ai JSONB;
  v_alerts JSONB;
BEGIN
  v_tenant_id := get_my_tenant_id();

  -- Buscar cada componente
  v_daily := get_daily_transaction_stats(CURRENT_DATE);
  v_cash_flow := get_cash_flow_summary();
  v_collection := get_collection_summary();
  v_ai := get_ai_performance_stats(CURRENT_DATE);

  -- Buscar alertas pendentes
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'type', alert_type,
    'severity', severity,
    'title', title,
    'actionUrl', action_url
  ) ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
    created_at DESC
  )
  INTO v_alerts
  FROM system_alerts
  WHERE tenant_id = v_tenant_id
    AND is_resolved = false
  LIMIT 10;

  RETURN jsonb_build_object(
    'today', v_daily,
    'cashFlow', v_cash_flow,
    'collection', v_collection,
    'aiPerformance', v_ai,
    'alerts', COALESCE(v_alerts, '[]'::jsonb),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 6: HISTORICO DE PROCESSAMENTO
-- ============================================================================

-- Tabela para armazenar historico de execucoes do pipeline
CREATE TABLE IF NOT EXISTS automation_pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'batch'
  status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'failed'
  processed INTEGER DEFAULT 0,
  reconciled INTEGER DEFAULT 0,
  needs_review INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by UUID REFERENCES auth.users(id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_tenant ON automation_pipeline_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_date ON automation_pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON automation_pipeline_runs(status);

-- RLS
ALTER TABLE automation_pipeline_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for pipeline runs" ON automation_pipeline_runs;
CREATE POLICY "Tenant isolation for pipeline runs"
  ON automation_pipeline_runs
  FOR ALL
  USING (tenant_id = get_my_tenant_id());

-- Funcao para registrar execucao do pipeline
CREATE OR REPLACE FUNCTION register_pipeline_run(
  p_run_type VARCHAR,
  p_processed INTEGER,
  p_reconciled INTEGER,
  p_needs_review INTEGER,
  p_failed INTEGER,
  p_total_amount NUMERIC,
  p_duration_ms INTEGER,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
BEGIN
  INSERT INTO automation_pipeline_runs (
    run_type,
    status,
    processed,
    reconciled,
    needs_review,
    failed,
    total_amount,
    completed_at,
    duration_ms,
    metadata,
    tenant_id
  ) VALUES (
    p_run_type,
    'completed',
    p_processed,
    p_reconciled,
    p_needs_review,
    p_failed,
    p_total_amount,
    NOW(),
    p_duration_ms,
    p_metadata,
    get_my_tenant_id()
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 7: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_daily_transaction_stats(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cash_flow_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_performance_stats(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_automation_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION register_pipeline_run(VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, INTEGER, JSONB) TO authenticated;

COMMENT ON FUNCTION get_daily_transaction_stats IS 'Retorna estatisticas de transacoes do dia para o dashboard';
COMMENT ON FUNCTION get_cash_flow_summary IS 'Retorna resumo do fluxo de caixa para o dashboard';
COMMENT ON FUNCTION get_collection_summary IS 'Retorna resumo de cobranca para o dashboard';
COMMENT ON FUNCTION get_ai_performance_stats IS 'Retorna metricas de performance da IA para o dashboard';
COMMENT ON FUNCTION get_automation_dashboard_summary IS 'Retorna todos os dados do dashboard de automacao em uma unica chamada';
