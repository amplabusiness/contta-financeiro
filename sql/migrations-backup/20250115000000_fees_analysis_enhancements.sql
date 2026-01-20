-- ================================================
-- FEES ANALYSIS AND COLLECTION MANAGEMENT
-- Migration for Fees Analysis and Work Orders
-- ================================================

-- ================================================
-- 1. ADD PRO BONO FLAG TO CLIENTS
-- ================================================

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_pro_bono BOOLEAN DEFAULT false;

COMMENT ON COLUMN clients.is_pro_bono IS 'Indica se o cliente é atendido gratuitamente (pro bono)';

CREATE INDEX IF NOT EXISTS idx_clients_pro_bono ON clients(is_pro_bono)
WHERE is_pro_bono = true;

-- ================================================
-- 2. COLLECTION WORK ORDERS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS collection_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Assignment
  assigned_to TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),

  -- Priority and Status
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled')),

  -- Action Details
  action_type TEXT NOT NULL CHECK (action_type IN ('phone_call', 'email', 'whatsapp', 'meeting', 'other')),
  description TEXT,

  -- Scheduling
  next_action_date DATE NOT NULL,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_work_orders_client ON collection_work_orders(client_id);
CREATE INDEX idx_work_orders_invoice ON collection_work_orders(invoice_id);
CREATE INDEX idx_work_orders_assigned ON collection_work_orders(assigned_to);
CREATE INDEX idx_work_orders_status ON collection_work_orders(status);
CREATE INDEX idx_work_orders_priority ON collection_work_orders(priority);
CREATE INDEX idx_work_orders_next_action ON collection_work_orders(next_action_date);
CREATE INDEX idx_work_orders_created ON collection_work_orders(created_at DESC);

COMMENT ON TABLE collection_work_orders IS 'Ordens de serviço para gestão de cobranças com histórico de ações';

-- ================================================
-- 3. WORK ORDER LOGS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS collection_work_order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES collection_work_orders(id) ON DELETE CASCADE,

  -- Log Details
  action TEXT NOT NULL,
  description TEXT,
  result TEXT,
  next_step TEXT,
  next_contact_date DATE,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_work_order_logs_order ON collection_work_order_logs(work_order_id);
CREATE INDEX idx_work_order_logs_created ON collection_work_order_logs(created_at DESC);

COMMENT ON TABLE collection_work_order_logs IS 'Histórico completo de ações realizadas em ordens de serviço de cobrança';

-- ================================================
-- 4. AUTOMATIC UPDATED_AT TRIGGER FOR WORK ORDERS
-- ================================================

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON collection_work_orders;
CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON collection_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 5. FUNCTION TO AUTO-UPDATE WORK ORDER STATUS
-- ================================================

CREATE OR REPLACE FUNCTION update_work_order_status_on_log()
RETURNS TRIGGER AS $$
BEGIN
  -- When a log is added, update work order to in_progress if it's still pending
  UPDATE collection_work_orders
  SET
    status = 'in_progress',
    updated_at = now()
  WHERE id = NEW.work_order_id
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_update_work_order_status ON collection_work_order_logs;
CREATE TRIGGER auto_update_work_order_status
  AFTER INSERT ON collection_work_order_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_status_on_log();

-- ================================================
-- 6. VIEW FOR WORK ORDERS WITH CLIENT INFO
-- ================================================

CREATE OR REPLACE VIEW vw_work_orders_with_details AS
SELECT
  wo.id,
  wo.client_id,
  c.name as client_name,
  c.cnpj as client_cnpj,
  c.email as client_email,
  c.phone as client_phone,
  wo.invoice_id,
  i.competence as invoice_competence,
  i.amount as invoice_amount,
  i.due_date as invoice_due_date,
  i.status as invoice_status,
  wo.assigned_to,
  wo.assigned_at,
  wo.priority,
  wo.status,
  wo.action_type,
  wo.description,
  wo.next_action_date,
  wo.resolved_at,
  wo.resolution_notes,
  wo.created_at,
  wo.updated_at,
  (SELECT COUNT(*) FROM collection_work_order_logs WHERE work_order_id = wo.id) as logs_count,
  (SELECT created_at FROM collection_work_order_logs WHERE work_order_id = wo.id ORDER BY created_at DESC LIMIT 1) as last_log_date
FROM collection_work_orders wo
LEFT JOIN clients c ON wo.client_id = c.id
LEFT JOIN invoices i ON wo.invoice_id = i.id
ORDER BY
  CASE wo.priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  wo.next_action_date ASC;

COMMENT ON VIEW vw_work_orders_with_details IS 'View completa de ordens de serviço com informações de clientes e faturas';

-- ================================================
-- 7. FUNCTION TO GET OVERDUE SUMMARY
-- ================================================

CREATE OR REPLACE FUNCTION get_overdue_summary(
  p_year INT DEFAULT NULL,
  p_month INT DEFAULT NULL
)
RETURNS TABLE (
  one_month_count BIGINT,
  one_month_amount NUMERIC,
  two_months_count BIGINT,
  two_months_amount NUMERIC,
  three_plus_months_count BIGINT,
  three_plus_months_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH overdue_categorized AS (
    SELECT
      i.id,
      i.amount,
      CASE
        WHEN DATE_PART('day', CURRENT_DATE - i.due_date) >= 90 THEN '3+'
        WHEN DATE_PART('day', CURRENT_DATE - i.due_date) >= 60 THEN '2'
        WHEN DATE_PART('day', CURRENT_DATE - i.due_date) >= 30 THEN '1'
        ELSE '0'
      END as category
    FROM invoices i
    WHERE i.status = 'overdue'
      AND (p_year IS NULL OR EXTRACT(YEAR FROM i.due_date) = p_year)
      AND (p_month IS NULL OR EXTRACT(MONTH FROM i.due_date) = p_month)
  )
  SELECT
    COUNT(*) FILTER (WHERE category = '1') as one_month_count,
    COALESCE(SUM(amount) FILTER (WHERE category = '1'), 0) as one_month_amount,
    COUNT(*) FILTER (WHERE category = '2') as two_months_count,
    COALESCE(SUM(amount) FILTER (WHERE category = '2'), 0) as two_months_amount,
    COUNT(*) FILTER (WHERE category = '3+') as three_plus_months_count,
    COALESCE(SUM(amount) FILTER (WHERE category = '3+'), 0) as three_plus_months_amount
  FROM overdue_categorized;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_overdue_summary IS 'Retorna sumário de inadimplência segmentado por período de atraso';

-- ================================================
-- 8. ROW LEVEL SECURITY
-- ================================================

ALTER TABLE collection_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_work_order_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver work orders"
  ON collection_work_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar work orders"
  ON collection_work_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar work orders"
  ON collection_work_orders FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver logs"
  ON collection_work_order_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar logs"
  ON collection_work_order_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ================================================
-- 9. SAMPLE DATA (OPTIONAL - COMMENT OUT IN PRODUCTION)
-- ================================================

-- Mark some example clients as pro bono (adjust IDs as needed)
-- UPDATE clients SET is_pro_bono = true WHERE name ILIKE '%associa%';
-- UPDATE clients SET is_pro_bono = true WHERE name ILIKE '%ong%';

-- ================================================
-- END OF MIGRATION
-- ================================================
