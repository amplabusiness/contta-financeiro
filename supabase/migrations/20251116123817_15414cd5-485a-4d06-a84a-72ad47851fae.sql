
-- ================================================
-- COLLECTION WORK ORDERS TABLE
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

CREATE INDEX IF NOT EXISTS idx_work_orders_client ON collection_work_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_invoice ON collection_work_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON collection_work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON collection_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON collection_work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_next_action ON collection_work_orders(next_action_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_created ON collection_work_orders(created_at DESC);

COMMENT ON TABLE collection_work_orders IS 'Ordens de serviço para gestão de cobranças com histórico de ações';

-- ================================================
-- WORK ORDER LOGS TABLE
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

CREATE INDEX IF NOT EXISTS idx_work_order_logs_order ON collection_work_order_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_logs_created ON collection_work_order_logs(created_at DESC);

COMMENT ON TABLE collection_work_order_logs IS 'Histórico completo de ações realizadas em ordens de serviço de cobrança';

-- ================================================
-- AUTOMATIC UPDATED_AT TRIGGER FOR WORK ORDERS
-- ================================================

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON collection_work_orders;
CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON collection_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- FUNCTION TO AUTO-UPDATE WORK ORDER STATUS
-- ================================================

CREATE OR REPLACE FUNCTION update_work_order_status_on_log()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE collection_work_orders
  SET 
    status = CASE 
      WHEN status = 'pending' THEN 'in_progress'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.work_order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_work_order_status ON collection_work_order_logs;
CREATE TRIGGER trigger_update_work_order_status
  AFTER INSERT ON collection_work_order_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_status_on_log();

-- ================================================
-- RLS POLICIES FOR WORK ORDERS
-- ================================================

ALTER TABLE collection_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_work_order_logs ENABLE ROW LEVEL SECURITY;

-- Work Orders Policies
DROP POLICY IF EXISTS "Users can view their own work orders" ON collection_work_orders;
CREATE POLICY "Users can view their own work orders"
  ON collection_work_orders FOR SELECT
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create work orders" ON collection_work_orders;
CREATE POLICY "Users can create work orders"
  ON collection_work_orders FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own work orders" ON collection_work_orders;
CREATE POLICY "Users can update their own work orders"
  ON collection_work_orders FOR UPDATE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own work orders" ON collection_work_orders;
CREATE POLICY "Users can delete their own work orders"
  ON collection_work_orders FOR DELETE
  USING (auth.uid() = created_by);

-- Work Order Logs Policies  
DROP POLICY IF EXISTS "Users can view logs for their work orders" ON collection_work_order_logs;
CREATE POLICY "Users can view logs for their work orders"
  ON collection_work_order_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collection_work_orders
      WHERE id = work_order_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create logs for their work orders" ON collection_work_order_logs;
CREATE POLICY "Users can create logs for their work orders"
  ON collection_work_order_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_work_orders
      WHERE id = work_order_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update logs for their work orders" ON collection_work_order_logs;
CREATE POLICY "Users can update logs for their work orders"
  ON collection_work_order_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collection_work_orders
      WHERE id = work_order_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete logs for their work orders" ON collection_work_order_logs;
CREATE POLICY "Users can delete logs for their work orders"
  ON collection_work_order_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collection_work_orders
      WHERE id = work_order_id AND created_by = auth.uid()
    )
  );
