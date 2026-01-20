-- =====================================================
-- SISTEMA DE FECHAMENTO MENSAL
-- Controle de períodos fechados e transferência de saldos
-- =====================================================

-- Tabela de fechamentos mensais
CREATE TABLE IF NOT EXISTS monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Período
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- Status do fechamento
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'reopened')),

  -- Data/hora do fechamento
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),

  -- Data/hora de reabertura (se aplicável)
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES auth.users(id),
  reopened_reason TEXT,

  -- Saldos do período
  total_revenue DECIMAL(15,2) DEFAULT 0,        -- Total de receitas
  total_expenses DECIMAL(15,2) DEFAULT 0,       -- Total de despesas
  net_result DECIMAL(15,2) DEFAULT 0,           -- Resultado líquido

  -- Saldos bancários no fechamento
  bank_balances JSONB DEFAULT '[]',
  -- Formato: [{"bank_account_id": "uuid", "account_name": "...", "closing_balance": 1000.00}]

  -- Saldos contábeis resumidos
  total_assets DECIMAL(15,2) DEFAULT 0,         -- Total de ativos
  total_liabilities DECIMAL(15,2) DEFAULT 0,    -- Total de passivos
  total_equity DECIMAL(15,2) DEFAULT 0,         -- Patrimônio líquido

  -- Contas a receber/pagar ao final do período
  accounts_receivable DECIMAL(15,2) DEFAULT 0,  -- Contas a receber
  accounts_payable DECIMAL(15,2) DEFAULT 0,     -- Contas a pagar

  -- Transferência de saldo para próximo mês
  balance_transferred BOOLEAN DEFAULT false,
  transferred_at TIMESTAMPTZ,

  -- Notas e observações
  notes TEXT,

  -- Controle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Garantir unicidade de período
  UNIQUE(year, month)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_monthly_closings_period ON monthly_closings(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_status ON monthly_closings(status);

-- Tabela de saldos de abertura por conta bancária
CREATE TABLE IF NOT EXISTS bank_opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

  -- Período
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- Saldos
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(15,2),

  -- Origem do saldo de abertura
  source_closing_id UUID REFERENCES monthly_closings(id),

  -- Controle
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Garantir unicidade
  UNIQUE(bank_account_id, year, month)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_opening_balances_period ON bank_opening_balances(year, month);
CREATE INDEX IF NOT EXISTS idx_bank_opening_balances_account ON bank_opening_balances(bank_account_id);

-- =====================================================
-- FUNÇÕES
-- =====================================================

-- Função para verificar se um período está fechado
CREATE OR REPLACE FUNCTION is_period_closed(p_year INTEGER, p_month INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM monthly_closings
  WHERE year = p_year AND month = p_month;

  RETURN COALESCE(v_status = 'closed', false);
END;
$$ LANGUAGE plpgsql;

-- Função para obter o próximo período
CREATE OR REPLACE FUNCTION get_next_period(p_year INTEGER, p_month INTEGER)
RETURNS TABLE(next_year INTEGER, next_month INTEGER) AS $$
BEGIN
  IF p_month = 12 THEN
    RETURN QUERY SELECT p_year + 1, 1;
  ELSE
    RETURN QUERY SELECT p_year, p_month + 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para fechar o mês
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

  -- Calcular total de receitas (invoices pagas no período)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
  FROM invoices
  WHERE payment_date BETWEEN v_start_date AND v_end_date
    AND status = 'paid';

  -- Calcular total de despesas (expenses pagas no período)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM expenses
  WHERE payment_date BETWEEN v_start_date AND v_end_date
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

-- Função para reabrir o mês
CREATE OR REPLACE FUNCTION reopen_month(
  p_year INTEGER,
  p_month INTEGER,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_next_year INTEGER;
  v_next_month INTEGER;
BEGIN
  -- Verificar se está fechado
  IF NOT is_period_closed(p_year, p_month) THEN
    RAISE EXCEPTION 'O período %/% não está fechado', p_month, p_year;
  END IF;

  -- Obter próximo período
  SELECT * INTO v_next_year, v_next_month FROM get_next_period(p_year, p_month);

  -- Verificar se o próximo mês não está fechado
  IF is_period_closed(v_next_year, v_next_month) THEN
    RAISE EXCEPTION 'Não é possível reabrir %/% porque o período seguinte (%/%) já está fechado',
      p_month, p_year, v_next_month, v_next_year;
  END IF;

  -- Reabrir o período
  UPDATE monthly_closings
  SET
    status = 'reopened',
    reopened_at = now(),
    reopened_by = p_user_id,
    reopened_reason = p_reason,
    updated_at = now()
  WHERE year = p_year AND month = p_month;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS DE PROTEÇÃO
-- =====================================================

-- Trigger para proteger invoices em períodos fechados
CREATE OR REPLACE FUNCTION protect_invoice_in_closed_period()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_check_date DATE;
BEGIN
  -- Determinar a data relevante
  IF TG_OP = 'DELETE' THEN
    v_check_date := OLD.due_date;
  ELSE
    v_check_date := COALESCE(NEW.due_date, NEW.created_at::DATE);
  END IF;

  v_year := EXTRACT(YEAR FROM v_check_date);
  v_month := EXTRACT(MONTH FROM v_check_date);

  -- Verificar se o período está fechado
  IF is_period_closed(v_year, v_month) THEN
    RAISE EXCEPTION 'Não é possível modificar faturas no período fechado (%/%)', v_month, v_year;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_invoice_closed_period ON invoices;
CREATE TRIGGER trigger_protect_invoice_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION protect_invoice_in_closed_period();

-- Trigger para proteger expenses em períodos fechados
CREATE OR REPLACE FUNCTION protect_expense_in_closed_period()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_check_date DATE;
BEGIN
  -- Determinar a data relevante
  IF TG_OP = 'DELETE' THEN
    v_check_date := OLD.due_date;
  ELSE
    v_check_date := COALESCE(NEW.due_date, NEW.created_at::DATE);
  END IF;

  v_year := EXTRACT(YEAR FROM v_check_date);
  v_month := EXTRACT(MONTH FROM v_check_date);

  -- Verificar se o período está fechado
  IF is_period_closed(v_year, v_month) THEN
    RAISE EXCEPTION 'Não é possível modificar despesas no período fechado (%/%)', v_month, v_year;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_expense_closed_period ON expenses;
CREATE TRIGGER trigger_protect_expense_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION protect_expense_in_closed_period();

-- Trigger para proteger transações bancárias em períodos fechados
CREATE OR REPLACE FUNCTION protect_bank_transaction_in_closed_period()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_check_date DATE;
BEGIN
  -- Determinar a data relevante
  IF TG_OP = 'DELETE' THEN
    v_check_date := OLD.transaction_date;
  ELSE
    v_check_date := NEW.transaction_date;
  END IF;

  v_year := EXTRACT(YEAR FROM v_check_date);
  v_month := EXTRACT(MONTH FROM v_check_date);

  -- Verificar se o período está fechado
  IF is_period_closed(v_year, v_month) THEN
    RAISE EXCEPTION 'Não é possível modificar transações bancárias no período fechado (%/%)', v_month, v_year;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_bank_transaction_closed_period ON bank_transactions;
CREATE TRIGGER trigger_protect_bank_transaction_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION protect_bank_transaction_in_closed_period();

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all closings" ON monthly_closings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert closings" ON monthly_closings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update closings" ON monthly_closings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view all opening balances" ON bank_opening_balances
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert opening balances" ON bank_opening_balances
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update opening balances" ON bank_opening_balances
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE monthly_closings IS 'Controle de fechamento mensal - bloqueia alterações em períodos encerrados';
COMMENT ON TABLE bank_opening_balances IS 'Saldos de abertura de contas bancárias por período';
COMMENT ON FUNCTION close_month IS 'Fecha o mês, calcula totais e transfere saldos para o próximo período';
COMMENT ON FUNCTION reopen_month IS 'Reabre um mês fechado (somente se o próximo mês não estiver fechado)';
COMMENT ON FUNCTION is_period_closed IS 'Verifica se um período (ano/mês) está fechado';
