-- Migration: Add client opening balance system
-- Purpose: Track detailed opening balance by competence (month/year) for pre-2025 debts
-- Date: 2025-11-27

-- 1. Add opening balance fields to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS opening_balance_details JSONB,
ADD COLUMN IF NOT EXISTS opening_balance_date DATE DEFAULT '2024-12-31';

COMMENT ON COLUMN clients.opening_balance IS 'Total opening balance amount (auto-calculated from client_opening_balance)';
COMMENT ON COLUMN clients.opening_balance_details IS 'Additional JSON details about opening balance';
COMMENT ON COLUMN clients.opening_balance_date IS 'Reference date for opening balance (default: 2024-12-31)';

-- 2. Create client_opening_balance table for detailed tracking
CREATE TABLE IF NOT EXISTS client_opening_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competence VARCHAR(7) NOT NULL, -- Format: 'MM/YYYY' (e.g., '01/2024', '03/2024')
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  original_invoice_id UUID, -- Reference to original invoice if exists
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'partial'
  paid_amount DECIMAL(15,2) DEFAULT 0 CHECK (paid_amount >= 0),
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT competence_format_check CHECK (competence ~ '^\d{2}/\d{4}$'),
  CONSTRAINT paid_amount_not_greater CHECK (paid_amount <= amount)
);

COMMENT ON TABLE client_opening_balance IS 'Detailed opening balance by competence - tracks pre-2025 outstanding fees';
COMMENT ON COLUMN client_opening_balance.competence IS 'Month/Year format: MM/YYYY (e.g., 01/2024, 03/2024)';
COMMENT ON COLUMN client_opening_balance.status IS 'Payment status: pending (unpaid), paid (fully paid), partial (partially paid)';
COMMENT ON COLUMN client_opening_balance.amount IS 'Original amount for this competence';
COMMENT ON COLUMN client_opening_balance.paid_amount IS 'Amount already paid towards this competence';

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_opening_balance_client ON client_opening_balance(client_id);
CREATE INDEX IF NOT EXISTS idx_opening_balance_status ON client_opening_balance(status);
CREATE INDEX IF NOT EXISTS idx_opening_balance_competence ON client_opening_balance(competence);
CREATE INDEX IF NOT EXISTS idx_opening_balance_due_date ON client_opening_balance(due_date);
CREATE INDEX IF NOT EXISTS idx_opening_balance_created_at ON client_opening_balance(created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE client_opening_balance ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON client_opening_balance;
CREATE POLICY "Enable all for authenticated users"
ON client_opening_balance FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Create function to auto-update client opening_balance field
CREATE OR REPLACE FUNCTION update_client_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  -- Determine which client_id to update
  IF (TG_OP = 'DELETE') THEN
    v_client_id := OLD.client_id;
  ELSE
    v_client_id := NEW.client_id;
  END IF;

  -- Update the client's opening_balance field
  UPDATE clients
  SET opening_balance = (
    SELECT COALESCE(SUM(amount - paid_amount), 0)
    FROM client_opening_balance
    WHERE client_id = v_client_id
    AND status != 'paid'
  )
  WHERE id = v_client_id;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_client_opening_balance() IS 'Automatically updates client.opening_balance when opening balance entries change';

-- 7. Create trigger to auto-update opening balance
DROP TRIGGER IF EXISTS trigger_update_opening_balance ON client_opening_balance;
CREATE TRIGGER trigger_update_opening_balance
AFTER INSERT OR UPDATE OR DELETE ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION update_client_opening_balance();

-- 8. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_opening_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_opening_balance_timestamp ON client_opening_balance;
CREATE TRIGGER trigger_opening_balance_timestamp
BEFORE UPDATE ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION update_opening_balance_timestamp();

-- 9. Create view for easy querying
CREATE OR REPLACE VIEW v_client_opening_balance_summary AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.cnpj,
  COUNT(cob.id) as total_competences,
  SUM(cob.amount) as total_amount,
  SUM(cob.paid_amount) as total_paid,
  SUM(cob.amount - cob.paid_amount) as total_pending,
  COUNT(CASE WHEN cob.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN cob.status = 'paid' THEN 1 END) as paid_count,
  COUNT(CASE WHEN cob.status = 'partial' THEN 1 END) as partial_count,
  MIN(cob.due_date) as oldest_due_date,
  MAX(cob.due_date) as newest_due_date
FROM clients c
LEFT JOIN client_opening_balance cob ON c.id = cob.client_id
GROUP BY c.id, c.name, c.cnpj;

COMMENT ON VIEW v_client_opening_balance_summary IS 'Summary view of opening balance per client with aggregated statistics';

-- 10. Grant permissions
GRANT SELECT ON v_client_opening_balance_summary TO authenticated;
