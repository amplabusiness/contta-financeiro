-- ============================================================================
-- SPRINT 4: FECHAMENTO MENSAL AUTOMATICO
-- Funcoes para verificar pendencias e fechar o mes automaticamente
-- Compativel com estrutura existente de monthly_closings (year, month)
-- ============================================================================

-- ============================================================================
-- PARTE 1: FUNCAO PARA VERIFICAR PENDENCIAS DO MES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_check_month_pending(
  p_period VARCHAR,
  p_tenant_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_year INTEGER;
  v_month INTEGER;
  v_start_date DATE;
  v_end_date DATE;
  v_pending_tx INTEGER;
  v_unbalanced_entries INTEGER;
  v_pending_invoices INTEGER;
  v_result JSONB;
BEGIN
  v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

  -- Converter periodo MM/YYYY para year e month
  v_month := SUBSTRING(p_period FROM 1 FOR 2)::INTEGER;
  v_year := SUBSTRING(p_period FROM 4 FOR 4)::INTEGER;

  -- Calcular datas
  v_start_date := make_date(v_year, v_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Contar transacoes pendentes de conciliacao
  SELECT COUNT(*) INTO v_pending_tx
  FROM bank_transactions
  WHERE tenant_id = v_tenant_id
    AND matched = false
    AND amount > 0
    AND transaction_date BETWEEN v_start_date AND v_end_date;

  -- Contar lancamentos desbalanceados (se houver a coluna)
  v_unbalanced_entries := 0;

  -- Contar faturas pendentes do periodo
  SELECT COUNT(*) INTO v_pending_invoices
  FROM invoices
  WHERE tenant_id = v_tenant_id
    AND status IN ('pending', 'overdue')
    AND due_date BETWEEN v_start_date AND v_end_date;

  v_result := jsonb_build_object(
    'period', p_period,
    'year', v_year,
    'month', v_month,
    'start_date', v_start_date,
    'end_date', v_end_date,
    'pending_transactions', v_pending_tx,
    'unbalanced_entries', v_unbalanced_entries,
    'pending_invoices', v_pending_invoices,
    'can_close', (v_pending_tx = 0 AND v_unbalanced_entries = 0),
    'blocking_reasons', CASE
      WHEN v_pending_tx > 0 OR v_unbalanced_entries > 0 THEN
        jsonb_build_array(
          CASE WHEN v_pending_tx > 0
            THEN jsonb_build_object('type', 'pending_transactions', 'count', v_pending_tx)
            ELSE NULL END,
          CASE WHEN v_unbalanced_entries > 0
            THEN jsonb_build_object('type', 'unbalanced_entries', 'count', v_unbalanced_entries)
            ELSE NULL END
        ) - NULL
      ELSE '[]'::JSONB
    END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 2: FUNCAO PARA FECHAR O MES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_close_month(
  p_period VARCHAR,
  p_force BOOLEAN DEFAULT false,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_year INTEGER;
  v_month INTEGER;
  v_start_date DATE;
  v_end_date DATE;
  v_pending JSONB;
  v_total_revenue NUMERIC;
  v_total_expenses NUMERIC;
  v_closing_id UUID;
BEGIN
  v_tenant_id := get_my_tenant_id();

  -- Converter periodo MM/YYYY para year e month
  v_month := SUBSTRING(p_period FROM 1 FOR 2)::INTEGER;
  v_year := SUBSTRING(p_period FROM 4 FOR 4)::INTEGER;

  -- Calcular datas
  v_start_date := make_date(v_year, v_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Verificar se ja esta fechado
  IF EXISTS (
    SELECT 1 FROM monthly_closings
    WHERE tenant_id = v_tenant_id
      AND year = v_year
      AND month = v_month
      AND status = 'closed'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Periodo ja esta fechado',
      'period', p_period
    );
  END IF;

  -- Verificar pendencias
  v_pending := fn_check_month_pending(p_period, v_tenant_id);

  IF NOT (v_pending->>'can_close')::BOOLEAN AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Existem pendencias que impedem o fechamento',
      'period', p_period,
      'pending', v_pending
    );
  END IF;

  -- Calcular totais do periodo
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0),
    COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0)), 0)
  INTO v_total_revenue, v_total_expenses
  FROM bank_transactions
  WHERE tenant_id = v_tenant_id
    AND transaction_date BETWEEN v_start_date AND v_end_date;

  -- Criar ou atualizar registro de fechamento
  INSERT INTO monthly_closings (
    tenant_id,
    year,
    month,
    status,
    total_revenue,
    total_expenses,
    net_result,
    closed_at,
    closed_by
  ) VALUES (
    v_tenant_id,
    v_year,
    v_month,
    'closed',
    v_total_revenue,
    v_total_expenses,
    v_total_revenue - v_total_expenses,
    NOW(),
    COALESCE(p_user_id, auth.uid())
  )
  ON CONFLICT (year, month)
  DO UPDATE SET
    status = 'closed',
    total_revenue = EXCLUDED.total_revenue,
    total_expenses = EXCLUDED.total_expenses,
    net_result = EXCLUDED.net_result,
    closed_at = NOW(),
    closed_by = EXCLUDED.closed_by,
    updated_at = NOW()
  RETURNING id INTO v_closing_id;

  RETURN jsonb_build_object(
    'success', true,
    'period', p_period,
    'closing_id', v_closing_id,
    'stats', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_expenses', v_total_expenses,
      'net_result', v_total_revenue - v_total_expenses
    )
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 3: FUNCAO PARA REABRIR O MES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_reopen_month(
  p_period VARCHAR,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  v_tenant_id := get_my_tenant_id();

  -- Converter periodo MM/YYYY para year e month
  v_month := SUBSTRING(p_period FROM 1 FOR 2)::INTEGER;
  v_year := SUBSTRING(p_period FROM 4 FOR 4)::INTEGER;

  -- Verificar se esta fechado
  IF NOT EXISTS (
    SELECT 1 FROM monthly_closings
    WHERE tenant_id = v_tenant_id
      AND year = v_year
      AND month = v_month
      AND status = 'closed'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Periodo nao esta fechado'
    );
  END IF;

  -- Atualizar status
  UPDATE monthly_closings
  SET status = 'reopened',
      reopened_at = NOW(),
      reopened_by = auth.uid(),
      reopened_reason = p_reason,
      updated_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND year = v_year
    AND month = v_month;

  RETURN jsonb_build_object(
    'success', true,
    'period', p_period,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PARTE 4: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION fn_check_month_pending(VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_close_month(VARCHAR, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_reopen_month(VARCHAR, TEXT) TO authenticated;

COMMENT ON FUNCTION fn_check_month_pending IS 'Verifica pendencias para fechamento do mes';
COMMENT ON FUNCTION fn_close_month IS 'Fecha o mes contabil';
COMMENT ON FUNCTION fn_reopen_month IS 'Reabre um mes fechado';
