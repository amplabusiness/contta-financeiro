-- =====================================================
-- ARQUITETURA SAAS ENTERPRISE-GRADE
-- Foundation Migration - Multi-Tenant + CQRS + Event-Driven
-- =====================================================

-- 1. TENANT MANAGEMENT (Multi-tenancy)
-- =====================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cnpj TEXT UNIQUE,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários do tenant
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Configurações de feature flags por tenant
CREATE TABLE IF NOT EXISTS tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, feature_key)
);

-- 2. EVENT SOURCING & AUDIT
-- =====================================================

CREATE TABLE IF NOT EXISTS domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  aggregate_type TEXT NOT NULL, -- 'client', 'invoice', 'expense', 'transaction'
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed'
  event_version INTEGER DEFAULT 1,
  payload JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  correlation_id UUID, -- para rastrear operações relacionadas
  causation_id UUID, -- evento que causou este
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

-- Índices para consultas rápidas de eventos
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_tenant ON domain_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_correlation ON domain_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_pending ON domain_events(processed_at) WHERE processed_at IS NULL;

-- 3. CQRS - VIEWS MATERIALIZADAS (Read Models)
-- =====================================================

-- View materializada: Saldos consolidados por cliente (usando client_ledger)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_client_balances AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.cnpj,
  c.is_active,
  COALESCE(SUM(cl.debit), 0) AS total_debits,
  COALESCE(SUM(cl.credit), 0) AS total_credits,
  COALESCE((SELECT balance FROM client_ledger WHERE client_id = c.id ORDER BY created_at DESC LIMIT 1), 0) AS balance,
  COUNT(DISTINCT cl.id) AS total_entries,
  MAX(cl.created_at) AS last_entry_at
FROM clients c
LEFT JOIN client_ledger cl ON cl.client_id = c.id
GROUP BY c.id, c.name, c.cnpj, c.is_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_client_balances_id ON mv_client_balances(client_id);

-- View materializada: Resumo de inadimplência
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_default_summary AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.cnpj,
  c.monthly_fee,
  c.payment_day,
  COUNT(CASE WHEN i.status = 'pending' AND i.due_date < CURRENT_DATE THEN 1 END) AS overdue_count,
  COALESCE(SUM(CASE WHEN i.status = 'pending' AND i.due_date < CURRENT_DATE THEN i.amount END), 0) AS overdue_amount,
  COUNT(CASE WHEN i.status = 'pending' AND i.due_date >= CURRENT_DATE THEN 1 END) AS pending_count,
  COALESCE(SUM(CASE WHEN i.status = 'pending' AND i.due_date >= CURRENT_DATE THEN i.amount END), 0) AS pending_amount,
  COUNT(CASE WHEN i.status = 'paid' THEN 1 END) AS paid_count,
  COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount END), 0) AS paid_amount,
  MIN(CASE WHEN i.status = 'pending' AND i.due_date < CURRENT_DATE THEN i.due_date END) AS oldest_overdue_date
FROM clients c
LEFT JOIN invoices i ON i.client_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.cnpj, c.monthly_fee, c.payment_day;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_default_summary_id ON mv_default_summary(client_id);

-- View materializada: DRE mensal (usando accounting_entry_items)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dre_monthly AS
WITH monthly_data AS (
  SELECT
    DATE_TRUNC('month', ae.entry_date) AS month,
    ca.account_type,
    ca.code AS account_code,
    ca.name AS account_name,
    SUM(aei.debit) AS debits,
    SUM(aei.credit) AS credits
  FROM accounting_entries ae
  JOIN accounting_entry_items aei ON aei.entry_id = ae.id
  JOIN chart_of_accounts ca ON ca.id = aei.account_id
  WHERE ae.entry_date >= DATE_TRUNC('year', CURRENT_DATE)
  GROUP BY DATE_TRUNC('month', ae.entry_date), ca.account_type, ca.code, ca.name
)
SELECT
  month,
  account_type,
  account_code,
  account_name,
  debits,
  credits,
  CASE
    WHEN account_type IN ('RECEITA', 'revenue', 'income') THEN credits - debits
    WHEN account_type IN ('DESPESA', 'expense', 'cost') THEN debits - credits
    ELSE debits - credits
  END AS net_value
FROM monthly_data;

CREATE INDEX IF NOT EXISTS idx_mv_dre_monthly_month ON mv_dre_monthly(month);

-- View materializada: Fluxo de caixa (baseado em invoices e expenses)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cash_flow AS
WITH daily_inflows AS (
  SELECT
    due_date AS date,
    SUM(amount) AS inflows
  FROM invoices
  WHERE status = 'paid'
    AND due_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY due_date
),
daily_outflows AS (
  SELECT
    due_date AS date,
    SUM(amount) AS outflows
  FROM expenses
  WHERE status = 'paid'
    AND due_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY due_date
)
SELECT
  COALESCE(i.date, o.date) AS date,
  COALESCE(i.inflows, 0) AS inflows,
  COALESCE(o.outflows, 0) AS outflows,
  COALESCE(i.inflows, 0) - COALESCE(o.outflows, 0) AS net_flow
FROM daily_inflows i
FULL OUTER JOIN daily_outflows o ON i.date = o.date;

CREATE INDEX IF NOT EXISTS idx_mv_cash_flow_date ON mv_cash_flow(date);

-- View materializada: Balancete (usando accounting_entry_items)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trial_balance AS
SELECT
  ca.id AS account_id,
  ca.code,
  ca.name,
  ca.account_type,
  ca.parent_id,
  COALESCE(SUM(aei.debit), 0) AS total_debits,
  COALESCE(SUM(aei.credit), 0) AS total_credits,
  COALESCE(SUM(aei.debit) - SUM(aei.credit), 0) AS balance
FROM chart_of_accounts ca
LEFT JOIN accounting_entry_items aei ON aei.account_id = ca.id
LEFT JOIN accounting_entries ae ON ae.id = aei.entry_id
  AND ae.entry_date >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY ca.id, ca.code, ca.name, ca.account_type, ca.parent_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_trial_balance_id ON mv_trial_balance(account_id);

-- 4. ROW LEVEL SECURITY (Multi-tenant)
-- =====================================================

-- Função para obter tenant_id do usuário atual
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  tenant_id UUID;
BEGIN
  SELECT tu.tenant_id INTO tenant_id
  FROM tenant_users tu
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
  LIMIT 1;

  RETURN tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função para verificar se usuário tem permissão específica
CREATE OR REPLACE FUNCTION user_has_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
  user_role TEXT;
BEGIN
  SELECT tu.permissions, tu.role INTO user_permissions, user_role
  FROM tenant_users tu
  WHERE tu.user_id = auth.uid()
    AND tu.tenant_id = get_current_tenant_id()
    AND tu.is_active = true
  LIMIT 1;

  -- Admin e owner têm todas as permissões
  IF user_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  -- Verificar permissão específica
  RETURN user_permissions ? required_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. FUNÇÕES DE REFRESH PARA VIEWS MATERIALIZADAS
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_balances;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_default_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dre_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cash_flow;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trial_balance;
END;
$$ LANGUAGE plpgsql;

-- Refresh individual com timestamp de última atualização
CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_name TEXT NOT NULL,
  refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_ms INTEGER,
  rows_affected INTEGER,
  triggered_by TEXT -- 'manual', 'scheduled', 'event'
);

CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT, trigger_source TEXT DEFAULT 'manual')
RETURNS void AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration INTEGER;
BEGIN
  start_time := clock_timestamp();

  EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);

  end_time := clock_timestamp();
  duration := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;

  INSERT INTO materialized_view_refresh_log (view_name, duration_ms, triggered_by)
  VALUES (view_name, duration, trigger_source);
END;
$$ LANGUAGE plpgsql;

-- 6. EVENT HANDLERS (Triggers para capturar eventos)
-- =====================================================

-- Função genérica para capturar eventos de domínio
CREATE OR REPLACE FUNCTION capture_domain_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT;
  payload JSONB;
  tenant_id UUID;
BEGIN
  -- Determinar tipo de evento
  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    WHEN 'DELETE' THEN 'deleted'
  END;

  -- Montar payload
  IF TG_OP = 'DELETE' THEN
    payload := to_jsonb(OLD);
  ELSE
    payload := to_jsonb(NEW);
    IF TG_OP = 'UPDATE' THEN
      payload := payload || jsonb_build_object('_previous', to_jsonb(OLD));
    END IF;
  END IF;

  -- Tentar obter tenant_id
  tenant_id := get_current_tenant_id();

  -- Inserir evento
  INSERT INTO domain_events (
    tenant_id,
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    user_id,
    metadata
  ) VALUES (
    tenant_id,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    event_type,
    payload,
    auth.uid(),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', NOW()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar triggers nas tabelas principais
DO $$
DECLARE
  tables TEXT[] := ARRAY['clients', 'invoices', 'expenses', 'bank_transactions', 'accounting_entries'];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS capture_events_%s ON %I;
      CREATE TRIGGER capture_events_%s
      AFTER INSERT OR UPDATE OR DELETE ON %I
      FOR EACH ROW EXECUTE FUNCTION capture_domain_event();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- 7. API FUNCTIONS (RPCs para operações CQRS)
-- =====================================================

-- Comando: Criar lançamento contábil completo (entry + items)
CREATE OR REPLACE FUNCTION cmd_create_accounting_entry(
  p_account_id UUID,
  p_entry_date DATE,
  p_entry_type TEXT, -- 'debit' ou 'credit'
  p_amount NUMERIC,
  p_description TEXT,
  p_client_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_entry_id UUID;
  account_exists BOOLEAN;
  debit_amount NUMERIC := 0;
  credit_amount NUMERIC := 0;
BEGIN
  -- Validação
  SELECT EXISTS(SELECT 1 FROM chart_of_accounts WHERE id = p_account_id) INTO account_exists;
  IF NOT account_exists THEN
    RAISE EXCEPTION 'Conta contábil não encontrada: %', p_account_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  IF p_entry_type NOT IN ('debit', 'credit') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido: %', p_entry_type;
  END IF;

  -- Definir valores de débito/crédito
  IF p_entry_type = 'debit' THEN
    debit_amount := p_amount;
  ELSE
    credit_amount := p_amount;
  END IF;

  -- Criar entrada principal (accounting_entries)
  INSERT INTO accounting_entries (
    entry_date, competence_date, description, entry_type,
    total_debit, total_credit, created_by
  ) VALUES (
    p_entry_date, p_entry_date, p_description, p_reference_type,
    debit_amount, credit_amount, auth.uid()
  ) RETURNING id INTO new_entry_id;

  -- Criar item do lançamento (accounting_entry_items)
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    new_entry_id, p_account_id, debit_amount, credit_amount, p_description, p_client_id
  );

  -- Marcar views para refresh
  PERFORM pg_notify('refresh_views', 'mv_client_balances,mv_trial_balance');

  RETURN new_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Query: Obter dashboard do cliente (usa view materializada)
CREATE OR REPLACE FUNCTION qry_client_dashboard(p_client_id UUID)
RETURNS TABLE (
  client_name TEXT,
  total_debits NUMERIC,
  total_credits NUMERIC,
  balance NUMERIC,
  overdue_count BIGINT,
  overdue_amount NUMERIC,
  pending_count BIGINT,
  pending_amount NUMERIC,
  paid_count BIGINT,
  paid_amount NUMERIC,
  last_entry_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.client_name,
    cb.total_debits,
    cb.total_credits,
    cb.balance,
    COALESCE(ds.overdue_count, 0),
    COALESCE(ds.overdue_amount, 0),
    COALESCE(ds.pending_count, 0),
    COALESCE(ds.pending_amount, 0),
    COALESCE(ds.paid_count, 0),
    COALESCE(ds.paid_amount, 0),
    cb.last_entry_at
  FROM mv_client_balances cb
  LEFT JOIN mv_default_summary ds ON ds.client_id = cb.client_id
  WHERE cb.client_id = p_client_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Query: Obter resumo executivo
CREATE OR REPLACE FUNCTION qry_executive_summary(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_expenses NUMERIC,
  net_profit NUMERIC,
  total_receivables NUMERIC,
  total_payables NUMERIC,
  cash_position NUMERIC,
  client_count BIGINT,
  default_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH revenue AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM invoices
    WHERE status = 'paid'
      AND payment_date BETWEEN p_start_date AND p_end_date
  ),
  expenses AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE status = 'paid'
      AND payment_date BETWEEN p_start_date AND p_end_date
  ),
  receivables AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM invoices
    WHERE status = 'pending'
  ),
  payables AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE status = 'pending'
  ),
  cash AS (
    SELECT COALESCE(SUM(net_flow), 0) AS total
    FROM mv_cash_flow
    WHERE date IS NOT NULL AND date BETWEEN p_start_date AND p_end_date
  ),
  clients AS (
    SELECT COUNT(*) AS total FROM clients WHERE is_active = true
  ),
  defaults AS (
    SELECT
      COUNT(CASE WHEN overdue_count > 0 THEN 1 END)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100 AS rate
    FROM mv_default_summary
  )
  SELECT
    r.total,
    e.total,
    r.total - e.total,
    rec.total,
    pay.total,
    c.total,
    cl.total,
    COALESCE(d.rate, 0)
  FROM revenue r, expenses e, receivables rec, payables pay,
       cash c, clients cl, defaults d;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. SCHEDULED JOBS (para refresh periódico)
-- =====================================================

-- Nota: Requer pg_cron extension ou Supabase Edge Function scheduled

COMMENT ON FUNCTION refresh_all_materialized_views IS
'Deve ser executada periodicamente (sugestão: a cada 5 minutos) para manter views atualizadas';

-- 9. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices(status, due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_expenses_status_due ON expenses(status, due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON accounting_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_items_client ON accounting_entry_items(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_ledger_client ON client_ledger(client_id, created_at DESC);

-- 10. GRANTS PARA RPCs
-- =====================================================

GRANT EXECUTE ON FUNCTION cmd_create_accounting_entry TO authenticated;
GRANT EXECUTE ON FUNCTION qry_client_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION qry_executive_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_tenant_id TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission TO authenticated;

-- Acesso às views materializadas
GRANT SELECT ON mv_client_balances TO authenticated;
GRANT SELECT ON mv_default_summary TO authenticated;
GRANT SELECT ON mv_dre_monthly TO authenticated;
GRANT SELECT ON mv_cash_flow TO authenticated;
GRANT SELECT ON mv_trial_balance TO authenticated;
