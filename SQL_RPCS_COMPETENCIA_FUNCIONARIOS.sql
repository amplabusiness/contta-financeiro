-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | RPC de Filtro de Funcionários por Competência
-- Dr. Cícero - Contador Responsável
-- Data: 02/02/2026
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- REGRA DE NEGÓCIO:
-- Um funcionário é considerado ATIVO em uma competência se:
-- 1. Foi admitido ATÉ o último dia do mês da competência (hire_date <= fim_mes)
-- 2. NÃO foi demitido ANTES do primeiro dia do mês (termination_date IS NULL OR >= inicio_mes)
-- 
-- Exemplo para competência 02/2025:
-- - Admitido 15/02/2025 → ATIVO (admitido no mês)
-- - Admitido 01/03/2025 → NÃO ATIVO (admitido depois)
-- - Demitido 15/01/2025 → NÃO ATIVO (demitido antes)
-- - Demitido 28/02/2025 → ATIVO (demitido no mês, ainda trabalhou)
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- 1) RPC: LISTAR FUNCIONÁRIOS ATIVOS NA COMPETÊNCIA
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_employees_by_competencia(
  p_tenant UUID,
  p_ano INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cpf TEXT,
  department TEXT,
  role TEXT,
  hire_date DATE,
  termination_date DATE,
  is_active BOOLEAN,
  contract_type TEXT,
  official_salary NUMERIC,
  unofficial_salary NUMERIC,
  payment_day INTEGER,
  status_competencia TEXT  -- 'ativo', 'nao_admitido', 'demitido'
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inicio_mes DATE;
  v_fim_mes DATE;
BEGIN
  -- Calcular datas da competência
  v_inicio_mes := make_date(p_ano, p_mes, 1);
  v_fim_mes := (v_inicio_mes + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.cpf,
    e.department,
    e.role,
    e.hire_date,
    e.termination_date,
    e.is_active,
    e.contract_type,
    e.official_salary,
    e.unofficial_salary,
    e.payment_day,
    CASE
      -- Não tem data de admissão ou foi admitido DEPOIS do fim do mês
      WHEN e.hire_date IS NULL OR e.hire_date > v_fim_mes THEN 'nao_admitido'
      -- Foi demitido ANTES do início do mês
      WHEN e.termination_date IS NOT NULL AND e.termination_date < v_inicio_mes THEN 'demitido'
      -- Estava ativo no período
      ELSE 'ativo'
    END AS status_competencia
  FROM employees e
  WHERE e.tenant_id = p_tenant
  ORDER BY e.name;
END;
$$;

-- =============================================================================
-- 2) RPC: LISTAR APENAS FUNCIONÁRIOS ATIVOS NA COMPETÊNCIA (SIMPLIFICADO)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_active_employees_by_competencia(
  p_tenant UUID,
  p_ano INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cpf TEXT,
  department TEXT,
  role TEXT,
  hire_date DATE,
  termination_date DATE,
  contract_type TEXT,
  official_salary NUMERIC,
  unofficial_salary NUMERIC,
  payment_day INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inicio_mes DATE;
  v_fim_mes DATE;
BEGIN
  v_inicio_mes := make_date(p_ano, p_mes, 1);
  v_fim_mes := (v_inicio_mes + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.cpf,
    e.department,
    e.role,
    e.hire_date,
    e.termination_date,
    e.contract_type,
    e.official_salary,
    e.unofficial_salary,
    e.payment_day
  FROM employees e
  WHERE e.tenant_id = p_tenant
    -- Admitido ATÉ o fim do mês
    AND e.hire_date IS NOT NULL
    AND e.hire_date <= v_fim_mes
    -- NÃO demitido ANTES do início do mês
    AND (e.termination_date IS NULL OR e.termination_date >= v_inicio_mes)
  ORDER BY e.name;
END;
$$;

-- =============================================================================
-- 3) RPC: RESUMO DA FOLHA POR COMPETÊNCIA
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_folha_resumo_by_competencia(
  p_tenant UUID,
  p_ano INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  competencia TEXT,
  total_ativos INTEGER,
  total_clt INTEGER,
  total_pj INTEGER,
  valor_clt NUMERIC,
  valor_pj NUMERIC,
  valor_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inicio_mes DATE;
  v_fim_mes DATE;
BEGIN
  v_inicio_mes := make_date(p_ano, p_mes, 1);
  v_fim_mes := (v_inicio_mes + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  RETURN QUERY
  WITH ativos AS (
    SELECT 
      e.contract_type,
      e.official_salary,
      e.unofficial_salary
    FROM employees e
    WHERE e.tenant_id = p_tenant
      AND e.hire_date IS NOT NULL
      AND e.hire_date <= v_fim_mes
      AND (e.termination_date IS NULL OR e.termination_date >= v_inicio_mes)
  )
  SELECT 
    TO_CHAR(v_inicio_mes, 'YYYY-MM') AS competencia,
    COUNT(*)::INTEGER AS total_ativos,
    COUNT(*) FILTER (WHERE contract_type = 'clt')::INTEGER AS total_clt,
    COUNT(*) FILTER (WHERE contract_type IN ('pj', 'mei'))::INTEGER AS total_pj,
    COALESCE(SUM(official_salary) FILTER (WHERE contract_type = 'clt'), 0)::NUMERIC AS valor_clt,
    COALESCE(SUM(unofficial_salary) FILTER (WHERE contract_type IN ('pj', 'mei')), 0)::NUMERIC AS valor_pj,
    (
      COALESCE(SUM(official_salary) FILTER (WHERE contract_type = 'clt'), 0) +
      COALESCE(SUM(unofficial_salary) FILTER (WHERE contract_type IN ('pj', 'mei')), 0)
    )::NUMERIC AS valor_total
  FROM ativos;
END;
$$;

-- =============================================================================
-- 4) RPC: HISTÓRICO DE FOLHA (MÚLTIPLAS COMPETÊNCIAS)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_folha_historico(
  p_tenant UUID,
  p_ano_inicio INTEGER,
  p_mes_inicio INTEGER,
  p_ano_fim INTEGER,
  p_mes_fim INTEGER
)
RETURNS TABLE (
  competencia TEXT,
  total_ativos INTEGER,
  total_clt INTEGER,
  total_pj INTEGER,
  valor_clt NUMERIC,
  valor_pj NUMERIC,
  valor_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_data_atual DATE;
  v_data_fim DATE;
BEGIN
  v_data_atual := make_date(p_ano_inicio, p_mes_inicio, 1);
  v_data_fim := make_date(p_ano_fim, p_mes_fim, 1);
  
  WHILE v_data_atual <= v_data_fim LOOP
    RETURN QUERY
    SELECT * FROM get_folha_resumo_by_competencia(
      p_tenant,
      EXTRACT(YEAR FROM v_data_atual)::INTEGER,
      EXTRACT(MONTH FROM v_data_atual)::INTEGER
    );
    
    v_data_atual := v_data_atual + INTERVAL '1 month';
  END LOOP;
END;
$$;

-- =============================================================================
-- 5) VIEW: FUNCIONÁRIOS COM STATUS DE COMPETÊNCIA (PARA MÊS ATUAL)
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_employees_competencia_atual AS
WITH competencia AS (
  SELECT 
    date_trunc('month', CURRENT_DATE)::DATE AS inicio_mes,
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS fim_mes
)
SELECT 
  e.*,
  CASE
    WHEN e.hire_date IS NULL OR e.hire_date > c.fim_mes THEN 'nao_admitido'
    WHEN e.termination_date IS NOT NULL AND e.termination_date < c.inicio_mes THEN 'demitido'
    ELSE 'ativo'
  END AS status_competencia_atual
FROM employees e
CROSS JOIN competencia c;

-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ RPCs de Competência criadas com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'Funções disponíveis:';
  RAISE NOTICE '  • get_employees_by_competencia(tenant, ano, mes) → todos com status';
  RAISE NOTICE '  • get_active_employees_by_competencia(tenant, ano, mes) → apenas ativos';
  RAISE NOTICE '  • get_folha_resumo_by_competencia(tenant, ano, mes) → resumo da folha';
  RAISE NOTICE '  • get_folha_historico(tenant, ano_ini, mes_ini, ano_fim, mes_fim) → histórico';
  RAISE NOTICE '';
  RAISE NOTICE 'Views:';
  RAISE NOTICE '  • vw_employees_competencia_atual → funcionários com status do mês atual';
  RAISE NOTICE '';
  RAISE NOTICE 'Exemplo de uso:';
  RAISE NOTICE '  SELECT * FROM get_active_employees_by_competencia(';
  RAISE NOTICE '    ''a53a4957-fe97-4856-b3ca-70045157b421'', 2025, 2);';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════════';
END $$;
