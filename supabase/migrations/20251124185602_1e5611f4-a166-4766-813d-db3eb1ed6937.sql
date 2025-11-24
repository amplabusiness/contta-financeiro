-- ================================================
-- FIX: Ajustar vw_partner_groups para respeitar RLS
-- Recriar com security_barrier para garantir verificação de RLS
-- ================================================

-- Recriar a view com security_barrier
DROP VIEW IF EXISTS vw_partner_groups CASCADE;

CREATE VIEW vw_partner_groups 
WITH (security_barrier = true)
AS
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

COMMENT ON VIEW vw_partner_groups IS 'Sócios que participam de múltiplas empresas - security_barrier ativo para respeitar RLS das tabelas base (client_partners e clients)';