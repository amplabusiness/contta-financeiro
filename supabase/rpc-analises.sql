-- ============================================
-- RPCs PARA DRE E ANÁLISES AVANÇADAS
-- ============================================

-- ============================================
-- 1. BUSCAR RECEITAS POR PERÍODO
-- ============================================

CREATE OR REPLACE FUNCTION buscar_receitas_periodo(
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  codigo TEXT,
  nome TEXT,
  valor NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    coa.code as codigo,
    coa.name as nome,
    COALESCE(SUM(ael.credit), 0) as valor
  FROM chart_of_accounts coa
  LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
  LEFT JOIN accounting_entries ae ON ae.id = ael.entry_id
  WHERE coa.code LIKE '3.%'
    AND (ae.entry_date IS NULL OR ae.entry_date BETWEEN p_inicio AND p_fim)
    AND ael.credit > 0
  GROUP BY coa.code, coa.name
  HAVING COALESCE(SUM(ael.credit), 0) > 0
  ORDER BY coa.code;
END;
$$;

-- ============================================
-- 2. BUSCAR DESPESAS POR PERÍODO
-- ============================================

CREATE OR REPLACE FUNCTION buscar_despesas_periodo(
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  codigo TEXT,
  nome TEXT,
  valor NUMERIC,
  quantidade BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    coa.code as codigo,
    coa.name as nome,
    COALESCE(SUM(ael.debit), 0) as valor,
    COUNT(*) as quantidade
  FROM chart_of_accounts coa
  LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
  LEFT JOIN accounting_entries ae ON ae.id = ael.entry_id
  WHERE coa.code LIKE '4.%'
    AND ae.entry_date BETWEEN p_inicio AND p_fim
    AND ael.debit > 0
  GROUP BY coa.code, coa.name
  HAVING COALESCE(SUM(ael.debit), 0) > 0
  ORDER BY SUM(ael.debit) DESC;
END;
$$;

-- ============================================
-- 3. BUSCAR RECEITA POR CLIENTE
-- ============================================

CREATE OR REPLACE FUNCTION buscar_receita_por_cliente(
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  cliente_id UUID,
  cliente_nome TEXT,
  receita NUMERIC,
  quantidade BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as cliente_id,
    c.name as cliente_nome,
    COALESCE(SUM(i.paid_amount), 0) as receita,
    COUNT(*) as quantidade
  FROM clients c
  LEFT JOIN invoices i ON i.client_id = c.id
  WHERE i.status = 'paid'
    AND i.paid_at BETWEEN p_inicio AND p_fim
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(i.paid_amount), 0) > 0
  ORDER BY SUM(i.paid_amount) DESC;
END;
$$;

-- ============================================
-- 4. BUSCAR TOTAL DESPESAS
-- ============================================

CREATE OR REPLACE FUNCTION buscar_total_despesas(
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(SUM(ael.debit), 0) as total
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4.%'
    AND ae.entry_date BETWEEN p_inicio AND p_fim
    AND ael.debit > 0;
END;
$$;

-- ============================================
-- 5. DRE COMPLETO (VIEW)
-- ============================================

CREATE OR REPLACE VIEW v_dre_mensal AS
WITH receitas AS (
  SELECT
    to_char(ae.entry_date, 'YYYY-MM') as competencia,
    coa.code,
    coa.name,
    SUM(ael.credit) as valor
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3.%' AND ael.credit > 0
  GROUP BY to_char(ae.entry_date, 'YYYY-MM'), coa.code, coa.name
),
despesas AS (
  SELECT
    to_char(ae.entry_date, 'YYYY-MM') as competencia,
    LEFT(coa.code, 3) as grupo,
    SUM(ael.debit) as valor
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4.%' AND ael.debit > 0
  GROUP BY to_char(ae.entry_date, 'YYYY-MM'), LEFT(coa.code, 3)
),
totais AS (
  SELECT
    competencia,
    SUM(valor) as total_receitas
  FROM receitas
  GROUP BY competencia
)
SELECT
  r.competencia,
  r.code as conta,
  r.name as descricao,
  r.valor,
  CASE WHEN t.total_receitas > 0
    THEN ROUND((r.valor / t.total_receitas * 100)::numeric, 2)
    ELSE 0
  END as av_percentual,
  'RECEITA' as tipo
FROM receitas r
JOIN totais t ON t.competencia = r.competencia
UNION ALL
SELECT
  d.competencia,
  d.grupo as conta,
  CASE d.grupo
    WHEN '4.1' THEN 'Despesas Operacionais'
    WHEN '4.2' THEN 'Despesas com Pessoal'
    WHEN '4.3' THEN 'Despesas Financeiras'
    WHEN '4.4' THEN 'Impostos e Taxas'
    ELSE 'Outras Despesas'
  END as descricao,
  d.valor,
  CASE WHEN t.total_receitas > 0
    THEN ROUND((d.valor / t.total_receitas * 100)::numeric, 2)
    ELSE 0
  END as av_percentual,
  'DESPESA' as tipo
FROM despesas d
JOIN totais t ON t.competencia = d.competencia
ORDER BY competencia, tipo, conta;

-- ============================================
-- 6. ANÁLISE COBRANÇA (VIEW)
-- ============================================

CREATE OR REPLACE VIEW v_analise_cobranca AS
SELECT
  competence as competencia,
  COUNT(*) as boletos_gerados,
  SUM(amount) as valor_gerado,
  COUNT(*) FILTER (WHERE status = 'paid') as boletos_pagos,
  COALESCE(SUM(paid_amount) FILTER (WHERE status = 'paid'), 0) as valor_recebido,
  COUNT(*) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE) as boletos_atrasados,
  COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE), 0) as valor_atrasado,
  CASE WHEN SUM(amount) > 0
    THEN ROUND((COALESCE(SUM(paid_amount) FILTER (WHERE status = 'paid'), 0) / SUM(amount) * 100)::numeric, 2)
    ELSE 0
  END as percentual_recebimento
FROM invoices
WHERE competence IS NOT NULL
GROUP BY competence
ORDER BY competence DESC;

-- ============================================
-- 7. RENTABILIDADE POR CLIENTE (VIEW)
-- ============================================

CREATE OR REPLACE VIEW v_rentabilidade_cliente AS
WITH receita_cliente AS (
  SELECT
    c.id as cliente_id,
    c.name as cliente_nome,
    COALESCE(SUM(i.paid_amount), 0) as receita_total,
    COUNT(i.id) as qtd_faturas
  FROM clients c
  LEFT JOIN invoices i ON i.client_id = c.id AND i.status = 'paid'
  GROUP BY c.id, c.name
),
total_despesas AS (
  SELECT COALESCE(SUM(ael.debit), 0) as total
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4.%' AND ael.debit > 0
),
total_clientes AS (
  SELECT COUNT(DISTINCT cliente_id) as qtd FROM receita_cliente WHERE receita_total > 0
)
SELECT
  rc.cliente_id,
  rc.cliente_nome,
  rc.receita_total,
  rc.qtd_faturas,
  ROUND((td.total / NULLIF(tc.qtd, 0))::numeric, 2) as custo_alocado,
  ROUND((rc.receita_total - (td.total / NULLIF(tc.qtd, 0)))::numeric, 2) as lucro_estimado,
  CASE WHEN rc.receita_total > 0
    THEN ROUND(((rc.receita_total - (td.total / NULLIF(tc.qtd, 0))) / rc.receita_total * 100)::numeric, 2)
    ELSE 0
  END as margem_percentual
FROM receita_cliente rc
CROSS JOIN total_despesas td
CROSS JOIN total_clientes tc
WHERE rc.receita_total > 0
ORDER BY rc.receita_total DESC;

-- ============================================
-- 8. COMPARATIVO MENSAL
-- ============================================

CREATE OR REPLACE FUNCTION comparar_meses(
  p_mes_atual TEXT,  -- formato 'YYYY-MM'
  p_mes_anterior TEXT
)
RETURNS TABLE (
  indicador TEXT,
  valor_atual NUMERIC,
  valor_anterior NUMERIC,
  variacao_percentual NUMERIC,
  variacao_absoluta NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receita_atual NUMERIC;
  v_receita_anterior NUMERIC;
  v_despesa_atual NUMERIC;
  v_despesa_anterior NUMERIC;
BEGIN
  -- Receitas mês atual
  SELECT COALESCE(SUM(ael.credit), 0) INTO v_receita_atual
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3.%'
    AND to_char(ae.entry_date, 'YYYY-MM') = p_mes_atual
    AND ael.credit > 0;

  -- Receitas mês anterior
  SELECT COALESCE(SUM(ael.credit), 0) INTO v_receita_anterior
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3.%'
    AND to_char(ae.entry_date, 'YYYY-MM') = p_mes_anterior
    AND ael.credit > 0;

  -- Despesas mês atual
  SELECT COALESCE(SUM(ael.debit), 0) INTO v_despesa_atual
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4.%'
    AND to_char(ae.entry_date, 'YYYY-MM') = p_mes_atual
    AND ael.debit > 0;

  -- Despesas mês anterior
  SELECT COALESCE(SUM(ael.debit), 0) INTO v_despesa_anterior
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4.%'
    AND to_char(ae.entry_date, 'YYYY-MM') = p_mes_anterior
    AND ael.debit > 0;

  -- Retornar comparativo
  RETURN QUERY
  SELECT 'Receitas'::TEXT, v_receita_atual, v_receita_anterior,
    CASE WHEN v_receita_anterior > 0
      THEN ROUND(((v_receita_atual - v_receita_anterior) / v_receita_anterior * 100)::numeric, 2)
      ELSE 0
    END,
    v_receita_atual - v_receita_anterior
  UNION ALL
  SELECT 'Despesas'::TEXT, v_despesa_atual, v_despesa_anterior,
    CASE WHEN v_despesa_anterior > 0
      THEN ROUND(((v_despesa_atual - v_despesa_anterior) / v_despesa_anterior * 100)::numeric, 2)
      ELSE 0
    END,
    v_despesa_atual - v_despesa_anterior
  UNION ALL
  SELECT 'Lucro'::TEXT,
    v_receita_atual - v_despesa_atual,
    v_receita_anterior - v_despesa_anterior,
    CASE WHEN (v_receita_anterior - v_despesa_anterior) > 0
      THEN ROUND((((v_receita_atual - v_despesa_atual) - (v_receita_anterior - v_despesa_anterior)) / (v_receita_anterior - v_despesa_anterior) * 100)::numeric, 2)
      ELSE 0
    END,
    (v_receita_atual - v_despesa_atual) - (v_receita_anterior - v_despesa_anterior);
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================

GRANT EXECUTE ON FUNCTION buscar_receitas_periodo TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_despesas_periodo TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_receita_por_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_total_despesas TO authenticated;
GRANT EXECUTE ON FUNCTION comparar_meses TO authenticated;

GRANT SELECT ON v_dre_mensal TO authenticated;
GRANT SELECT ON v_analise_cobranca TO authenticated;
GRANT SELECT ON v_rentabilidade_cliente TO authenticated;
