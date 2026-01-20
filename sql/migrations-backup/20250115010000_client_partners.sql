-- ================================================
-- CLIENT PARTNERS AND ECONOMIC GROUP ANALYSIS
-- Migration for Partners/Shareholders tracking
-- ================================================

-- ================================================
-- 1. CLIENT PARTNERS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS client_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Partner Information
  name TEXT NOT NULL,
  cpf VARCHAR(14), -- CPF format: 000.000.000-00
  percentage DECIMAL(5,2), -- Ownership percentage

  -- Partner Type
  partner_type TEXT CHECK (partner_type IN ('individual', 'company', 'administrator', 'director')),

  -- Additional Info
  is_administrator BOOLEAN DEFAULT false,
  email TEXT,
  phone TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_partners_client ON client_partners(client_id);
CREATE INDEX idx_client_partners_cpf ON client_partners(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_client_partners_name ON client_partners(name);

COMMENT ON TABLE client_partners IS 'Sócios e administradores de empresas clientes para análise de grupo econômico';

-- ================================================
-- 2. AUTOMATIC UPDATED_AT TRIGGER
-- ================================================

DROP TRIGGER IF EXISTS update_client_partners_updated_at ON client_partners;
CREATE TRIGGER update_client_partners_updated_at
  BEFORE UPDATE ON client_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 3. VIEW FOR PARTNER GROUPS
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
-- 4. FUNCTION TO GET ECONOMIC GROUP IMPACT
-- ================================================

CREATE OR REPLACE FUNCTION get_economic_group_impact(
  p_year INT DEFAULT NULL
)
RETURNS TABLE (
  group_key TEXT,
  partner_names TEXT[],
  company_count BIGINT,
  total_revenue NUMERIC,
  percentage_of_total NUMERIC
) AS $$
DECLARE
  total_year_revenue NUMERIC;
BEGIN
  -- Calculate total revenue for the year
  SELECT COALESCE(SUM(amount), 0)
  INTO total_year_revenue
  FROM invoices
  WHERE (p_year IS NULL OR competence LIKE '%/' || p_year::TEXT);

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
  group_revenues AS (
    SELECT
      gc.group_key,
      gc.partners_array as partner_names,
      ARRAY_LENGTH(gc.company_ids, 1) as company_count,
      COALESCE(SUM(i.amount), 0) as total_revenue
    FROM grouped_companies gc
    LEFT JOIN invoices i ON i.client_id = ANY(gc.company_ids)
      AND (p_year IS NULL OR i.competence LIKE '%/' || p_year::TEXT)
    GROUP BY gc.group_key, gc.partners_array, gc.company_ids
  )
  SELECT
    gr.group_key,
    gr.partner_names,
    gr.company_count,
    gr.total_revenue,
    CASE
      WHEN total_year_revenue > 0 THEN (gr.total_revenue / total_year_revenue) * 100
      ELSE 0
    END as percentage_of_total
  FROM group_revenues gr
  ORDER BY gr.total_revenue DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_economic_group_impact IS 'Calcula o impacto financeiro de grupos econômicos (empresas com sócios em comum)';

-- ================================================
-- 5. FUNCTION TO IMPORT PARTNERS FROM API BRASIL
-- ================================================

CREATE OR REPLACE FUNCTION import_partners_from_api_brasil(
  p_client_id UUID,
  p_partners_json JSONB
)
RETURNS INTEGER AS $$
DECLARE
  partner_record JSONB;
  inserted_count INTEGER := 0;
BEGIN
  -- Delete existing partners for this client
  DELETE FROM client_partners WHERE client_id = p_client_id;

  -- Insert new partners from JSON
  FOR partner_record IN SELECT * FROM jsonb_array_elements(p_partners_json)
  LOOP
    INSERT INTO client_partners (
      client_id,
      name,
      cpf,
      percentage,
      partner_type,
      is_administrator
    ) VALUES (
      p_client_id,
      partner_record->>'nome',
      partner_record->>'cpf',
      (partner_record->>'percentual_participacao')::DECIMAL,
      CASE
        WHEN (partner_record->>'tipo')::TEXT = 'PESSOA_FISICA' THEN 'individual'
        WHEN (partner_record->>'tipo')::TEXT = 'PESSOA_JURIDICA' THEN 'company'
        ELSE 'individual'
      END,
      COALESCE((partner_record->>'administrador')::BOOLEAN, false)
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION import_partners_from_api_brasil IS 'Importa sócios de um cliente a partir de dados da API Brasil';

-- ================================================
-- 6. ROW LEVEL SECURITY
-- ================================================

ALTER TABLE client_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver sócios"
  ON client_partners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar sócios"
  ON client_partners FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar sócios"
  ON client_partners FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem deletar sócios"
  ON client_partners FOR DELETE
  TO authenticated
  USING (true);

-- ================================================
-- 7. SAMPLE DATA (OPTIONAL - COMMENT OUT IN PRODUCTION)
-- ================================================

-- Example: Add partners to a client
-- INSERT INTO client_partners (client_id, name, cpf, percentage, partner_type, is_administrator)
-- VALUES
--   ('client-uuid-here', 'João Silva', '123.456.789-00', 60.00, 'individual', true),
--   ('client-uuid-here', 'Maria Santos', '987.654.321-00', 40.00, 'individual', false);

-- ================================================
-- END OF MIGRATION
-- ================================================
