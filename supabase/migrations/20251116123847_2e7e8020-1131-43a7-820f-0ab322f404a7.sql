
-- ================================================
-- CLIENT PARTNERS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS client_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Partner Information
  name TEXT NOT NULL,
  cpf VARCHAR(14),
  percentage DECIMAL(5,2),
  
  -- Partner Type
  partner_type TEXT CHECK (partner_type IN ('individual', 'company', 'administrator', 'director')),
  
  -- Additional Info
  is_administrator BOOLEAN DEFAULT false,
  email TEXT,
  phone TEXT,
  joined_date DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_partners_client ON client_partners(client_id);
CREATE INDEX IF NOT EXISTS idx_client_partners_cpf ON client_partners(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_partners_name ON client_partners(name);

COMMENT ON TABLE client_partners IS 'Sócios e administradores de empresas clientes para análise de grupo econômico';

-- ================================================
-- AUTOMATIC UPDATED_AT TRIGGER
-- ================================================

DROP TRIGGER IF EXISTS update_client_partners_updated_at ON client_partners;
CREATE TRIGGER update_client_partners_updated_at
  BEFORE UPDATE ON client_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- VIEW FOR PARTNER GROUPS
-- ================================================

CREATE OR REPLACE VIEW vw_partner_groups AS
WITH partner_companies AS (
  SELECT
    COALESCE(cpf, name) as partner_key,
    name as partner_name,
    cpf,
    client_id,
    percentage
  FROM client_partners
),
partner_stats AS (
  SELECT
    partner_key,
    MAX(partner_name) as partner_name,
    MAX(cpf) as cpf,
    COUNT(DISTINCT client_id) as companies_count,
    ARRAY_AGG(DISTINCT client_id) as company_ids
  FROM partner_companies
  GROUP BY partner_key
  HAVING COUNT(DISTINCT client_id) > 1
)
SELECT
  ps.partner_key,
  ps.partner_name,
  ps.cpf,
  ps.companies_count,
  ps.company_ids,
  ARRAY(
    SELECT c.name
    FROM clients c
    WHERE c.id = ANY(ps.company_ids)
  ) as company_names
FROM partner_stats ps
ORDER BY ps.companies_count DESC, ps.partner_name;

COMMENT ON VIEW vw_partner_groups IS 'Sócios que participam de múltiplas empresas clientes';

-- ================================================
-- FUNCTION TO GET ECONOMIC GROUP IMPACT
-- ================================================

CREATE OR REPLACE FUNCTION get_economic_group_impact(
  p_year INT DEFAULT NULL
)
RETURNS TABLE (
  group_key TEXT,
  partner_names TEXT[],
  company_count BIGINT,
  company_names TEXT[],
  company_ids UUID[],
  total_revenue NUMERIC,
  percentage_of_total NUMERIC,
  risk_level TEXT
) AS $$
DECLARE
  total_year_revenue NUMERIC;
BEGIN
  -- Calculate total revenue for the year
  SELECT COALESCE(SUM(amount), 0)
  INTO total_year_revenue
  FROM invoices
  WHERE status = 'paid'
    AND (p_year IS NULL OR EXTRACT(YEAR FROM payment_date::date) = p_year);

  -- If no revenue, return empty result
  IF total_year_revenue = 0 THEN
    total_year_revenue := 1; -- Avoid division by zero
  END IF;

  RETURN QUERY
  WITH company_partners AS (
    SELECT
      client_id,
      ARRAY_AGG(DISTINCT COALESCE(cpf, name) ORDER BY COALESCE(cpf, name)) as partners_array
    FROM client_partners
    GROUP BY client_id
  ),
  grouped_companies AS (
    SELECT
      ARRAY_TO_STRING(partners_array, '|') as group_key,
      partners_array,
      ARRAY_AGG(client_id) as company_ids
    FROM company_partners
    GROUP BY ARRAY_TO_STRING(partners_array, '|'), partners_array
    HAVING COUNT(*) > 1
  ),
  company_revenues AS (
    SELECT
      i.client_id,
      COALESCE(SUM(i.amount), 0) as revenue
    FROM invoices i
    WHERE i.status = 'paid'
      AND (p_year IS NULL OR EXTRACT(YEAR FROM i.payment_date::date) = p_year)
    GROUP BY i.client_id
  ),
  group_analysis AS (
    SELECT
      gc.group_key,
      gc.partners_array as partner_names,
      CARDINALITY(gc.company_ids) as company_count,
      ARRAY(
        SELECT c.name
        FROM clients c
        WHERE c.id = ANY(gc.company_ids)
      ) as company_names,
      gc.company_ids,
      COALESCE(SUM(cr.revenue), 0) as total_revenue,
      ROUND((COALESCE(SUM(cr.revenue), 0) / NULLIF(total_year_revenue, 0)) * 100, 2) as percentage_of_total
    FROM grouped_companies gc
    LEFT JOIN company_revenues cr ON cr.client_id = ANY(gc.company_ids)
    GROUP BY gc.group_key, gc.partners_array, gc.company_ids
  )
  SELECT
    ga.group_key,
    ga.partner_names,
    ga.company_count,
    ga.company_names,
    ga.company_ids,
    ga.total_revenue,
    ga.percentage_of_total,
    CASE
      WHEN ga.percentage_of_total >= 20 THEN 'high'
      WHEN ga.percentage_of_total >= 10 THEN 'medium'
      ELSE 'low'
    END as risk_level
  FROM group_analysis ga
  WHERE ga.total_revenue > 0
  ORDER BY ga.total_revenue DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_economic_group_impact IS 'Calcula o impacto financeiro de grupos econômicos (empresas com sócios em comum)';

-- ================================================
-- RLS POLICIES FOR CLIENT PARTNERS
-- ================================================

ALTER TABLE client_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view partners for their clients" ON client_partners;
CREATE POLICY "Users can view partners for their clients"
  ON client_partners FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE id = client_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create partners for their clients" ON client_partners;
CREATE POLICY "Users can create partners for their clients"
  ON client_partners FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE id = client_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update partners for their clients" ON client_partners;
CREATE POLICY "Users can update partners for their clients"
  ON client_partners FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE id = client_id AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete partners for their clients" ON client_partners;
CREATE POLICY "Users can delete partners for their clients"
  ON client_partners FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE id = client_id AND created_by = auth.uid()
    )
  );
