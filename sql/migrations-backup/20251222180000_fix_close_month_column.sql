-- =====================================================
-- CORREÇÃO: Função close_month
-- A coluna correta é "paid_date", não "payment_date"
-- Também corrigir expenses
-- =====================================================

CREATE OR REPLACE FUNCTION close_month(
  p_year INTEGER,
  p_month INTEGER,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_closing_id UUID;
  v_total_revenue DECIMAL(15,2);
  v_total_expenses DECIMAL(15,2);
  v_accounts_receivable DECIMAL(15,2);
  v_accounts_payable DECIMAL(15,2);
  v_bank_balances JSONB;
  v_next_year INTEGER;
  v_next_month INTEGER;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Calcular datas do período
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Verificar se já está fechado
  IF is_period_closed(p_year, p_month) THEN
    RAISE EXCEPTION 'O período %/% já está fechado', p_month, p_year;
  END IF;

  -- CORREÇÃO: Calcular total de receitas (invoices pagas no período)
  -- Coluna correta: paid_date (não payment_date)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
  FROM invoices
  WHERE paid_date BETWEEN v_start_date AND v_end_date
    AND status = 'paid';

  -- CORREÇÃO: Calcular total de despesas (expenses pagas no período)
  -- Coluna correta: paid_date (não payment_date)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM expenses
  WHERE paid_date BETWEEN v_start_date AND v_end_date
    AND status = 'paid';

  -- Calcular contas a receber (invoices pendentes até o fim do período)
  SELECT COALESCE(SUM(amount), 0) INTO v_accounts_receivable
  FROM invoices
  WHERE due_date <= v_end_date
    AND status IN ('pending', 'overdue');

  -- Calcular contas a pagar (expenses pendentes até o fim do período)
  SELECT COALESCE(SUM(amount), 0) INTO v_accounts_payable
  FROM expenses
  WHERE due_date <= v_end_date
    AND status IN ('pending', 'overdue');

  -- Capturar saldos bancários
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'bank_account_id', id,
        'account_name', name,
        'closing_balance', current_balance
      )
    ),
    '[]'::jsonb
  ) INTO v_bank_balances
  FROM bank_accounts
  WHERE is_active = true;

  -- Criar ou atualizar registro de fechamento
  INSERT INTO monthly_closings (
    year, month, status,
    closed_at, closed_by,
    total_revenue, total_expenses, net_result,
    accounts_receivable, accounts_payable,
    bank_balances, notes
  ) VALUES (
    p_year, p_month, 'closed',
    now(), p_user_id,
    v_total_revenue, v_total_expenses, v_total_revenue - v_total_expenses,
    v_accounts_receivable, v_accounts_payable,
    v_bank_balances, p_notes
  )
  ON CONFLICT (year, month) DO UPDATE SET
    status = 'closed',
    closed_at = now(),
    closed_by = p_user_id,
    total_revenue = EXCLUDED.total_revenue,
    total_expenses = EXCLUDED.total_expenses,
    net_result = EXCLUDED.net_result,
    accounts_receivable = EXCLUDED.accounts_receivable,
    accounts_payable = EXCLUDED.accounts_payable,
    bank_balances = EXCLUDED.bank_balances,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_closing_id;

  -- Obter próximo período
  SELECT * INTO v_next_year, v_next_month FROM get_next_period(p_year, p_month);

  -- Criar saldos de abertura para o próximo mês (para cada conta bancária)
  INSERT INTO bank_opening_balances (bank_account_id, year, month, opening_balance, source_closing_id)
  SELECT
    ba.id,
    v_next_year,
    v_next_month,
    ba.current_balance,
    v_closing_id
  FROM bank_accounts ba
  WHERE ba.is_active = true
  ON CONFLICT (bank_account_id, year, month) DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    source_closing_id = EXCLUDED.source_closing_id;

  -- Marcar saldo como transferido
  UPDATE monthly_closings
  SET balance_transferred = true, transferred_at = now()
  WHERE id = v_closing_id;

  RETURN v_closing_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION close_month IS 'Fecha o mês, calcula totais e transfere saldos para o próximo período';
