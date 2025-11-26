-- Create economic groups tables and functions

-- 1. Create economic_groups table
CREATE TABLE IF NOT EXISTS economic_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  main_payer_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  total_monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_day INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create economic_group_members table
CREATE TABLE IF NOT EXISTS economic_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  economic_group_id UUID NOT NULL REFERENCES economic_groups(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  individual_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(economic_group_id, client_id)
);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_economic_group_members_group_id ON economic_group_members(economic_group_id);
CREATE INDEX IF NOT EXISTS idx_economic_group_members_client_id ON economic_group_members(client_id);
CREATE INDEX IF NOT EXISTS idx_economic_groups_main_payer ON economic_groups(main_payer_client_id);

-- 4. Enable RLS
ALTER TABLE economic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_group_members ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for economic_groups
CREATE POLICY "Admins and accountants can view economic groups"
ON economic_groups FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins and accountants can create economic groups"
ON economic_groups FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins and accountants can update economic groups"
ON economic_groups FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins can delete economic groups"
ON economic_groups FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Create RLS policies for economic_group_members
CREATE POLICY "Admins and accountants can view group members"
ON economic_group_members FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins and accountants can create group members"
ON economic_group_members FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins and accountants can update group members"
ON economic_group_members FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins can delete group members"
ON economic_group_members FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Create function to get all invoices for a group in a specific competence
CREATE OR REPLACE FUNCTION get_group_invoices_for_competence(
  p_client_id UUID,
  p_competence TEXT
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  amount NUMERIC,
  due_date DATE,
  status TEXT,
  competence TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.client_id, i.amount, i.due_date, i.status, i.competence
  FROM invoices i
  JOIN economic_group_members egm ON i.client_id = egm.client_id
  WHERE egm.economic_group_id = (
    SELECT economic_group_id 
    FROM economic_group_members 
    WHERE client_id = p_client_id
    LIMIT 1
  )
  AND i.competence = p_competence
  AND i.status IN ('pending', 'overdue');
END;
$$;

-- 8. Create function to check if a client belongs to an economic group
CREATE OR REPLACE FUNCTION is_in_economic_group(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM economic_group_members 
    WHERE client_id = p_client_id
  );
END;
$$;

-- 9. Create function to get economic group by client
CREATE OR REPLACE FUNCTION get_economic_group_by_client(p_client_id UUID)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  main_payer_client_id UUID,
  total_monthly_fee NUMERIC,
  payment_day INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT eg.id, eg.name, eg.main_payer_client_id, eg.total_monthly_fee, eg.payment_day
  FROM economic_groups eg
  JOIN economic_group_members egm ON eg.id = egm.economic_group_id
  WHERE egm.client_id = p_client_id
  AND eg.is_active = true
  LIMIT 1;
END;
$$;

-- 10. Create trigger to update updated_at on economic_groups
CREATE OR REPLACE FUNCTION update_economic_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_economic_groups_updated_at_trigger
BEFORE UPDATE ON economic_groups
FOR EACH ROW
EXECUTE FUNCTION update_economic_groups_updated_at();