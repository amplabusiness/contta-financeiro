-- Drop and recreate the get_economic_group_impact function to fix type casting issues
DROP FUNCTION IF EXISTS get_economic_group_impact(INT);

CREATE FUNCTION get_economic_group_impact(
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
      ARRAY_AGG(DISTINCT COALESCE(cpf, name) ORDER BY COALESCE(cpf, name))::TEXT[] as partners_array
    FROM client_partners
    GROUP BY client_id
  ),
  grouped_companies AS (
    SELECT
      ARRAY_TO_STRING(partners_array, '|') as group_key,
      partners_array,
      ARRAY_AGG(client_id)::UUID[] as company_ids
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
      )::TEXT[] as company_names,
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
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_economic_group_impact IS 'Calcula o impacto financeiro de grupos econômicos (empresas com sócios em comum)';
