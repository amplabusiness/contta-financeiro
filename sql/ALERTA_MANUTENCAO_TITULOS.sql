-- ============================================================
-- ALERTA: MONITORAMENTO DE MANUTENÇÃO DE TÍTULOS BANCÁRIOS
-- ============================================================
-- PROBLEMA: O Sicredi cobra R$ 1,89 a R$ 2,02 por título/mês
-- após 30 dias em aberto. Em 90 dias pode custar R$ 6,00+
-- 
-- SOLUÇÃO: Cancelar título no banco e manter só no contas a receber
-- ============================================================

-- Função para verificar títulos que estão gerando despesa de manutenção
CREATE OR REPLACE FUNCTION get_titulos_manutencao_cara()
RETURNS TABLE (
  cob VARCHAR(20),
  total_manutencao NUMERIC(15,2),
  qtd_cobrancas INTEGER,
  primeira_cobranca DATE,
  ultima_cobranca DATE,
  status_sugerido TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH manutencoes AS (
    SELECT 
      SUBSTRING(e.description FROM 'COB\d+') as codigo_cob,
      ABS(COALESCE(l.debit, 0) + COALESCE(l.credit, 0)) as valor,
      e.entry_date
    FROM accounting_entries e
    JOIN accounting_entry_lines l ON l.entry_id = e.id
    JOIN chart_of_accounts c ON c.id = l.account_id
    WHERE e.description ILIKE '%MANUTENCAO DE TITULO%'
      AND c.code LIKE '4.%'  -- Conta de despesa
  ),
  agrupado AS (
    SELECT 
      codigo_cob,
      SUM(valor) as total,
      COUNT(*) as qtd,
      MIN(entry_date) as primeira,
      MAX(entry_date) as ultima
    FROM manutencoes
    WHERE codigo_cob IS NOT NULL
    GROUP BY codigo_cob
  )
  SELECT 
    codigo_cob::VARCHAR(20),
    total::NUMERIC(15,2),
    qtd::INTEGER,
    primeira,
    ultima,
    CASE 
      WHEN qtd >= 3 THEN '🚨 CANCELAR NO BANCO - já pagou ' || total::TEXT || ' de manutenção!'
      WHEN qtd = 2 THEN '⚠️ ATENÇÃO - 2 meses cobrando, avaliar cancelamento'
      ELSE '✓ Normal - primeiro mês'
    END as status_sugerido
  FROM agrupado
  WHERE total > 3  -- Ignorar valores zerados ou estornos
  ORDER BY total DESC;
END;
$$ LANGUAGE plpgsql STABLE;


-- Função para resumo mensal de gastos com manutenção
CREATE OR REPLACE FUNCTION get_resumo_manutencao_mensal(
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
) RETURNS TABLE (
  mes INTEGER,
  total_gasto NUMERIC(15,2),
  qtd_titulos INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM e.entry_date)::INTEGER as mes,
    SUM(ABS(COALESCE(l.debit, 0)))::NUMERIC(15,2) as total,
    COUNT(DISTINCT SUBSTRING(e.description FROM 'COB\d+'))::INTEGER as qtd
  FROM accounting_entries e
  JOIN accounting_entry_lines l ON l.entry_id = e.id
  JOIN chart_of_accounts c ON c.id = l.account_id
  WHERE e.description ILIKE '%MANUTENCAO DE TITULO%'
    AND c.code LIKE '4.%'
    AND EXTRACT(YEAR FROM e.entry_date) = p_ano
    AND l.debit > 0  -- Só débitos (despesas)
  GROUP BY EXTRACT(MONTH FROM e.entry_date)
  ORDER BY 1;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- TESTES
-- ============================================================

-- Ver títulos problemáticos
SELECT * FROM get_titulos_manutencao_cara();

-- Resumo mensal de gastos
SELECT * FROM get_resumo_manutencao_mensal(2025);


-- ============================================================
-- RESUMO DO PROBLEMA
-- ============================================================
/*
📊 ANÁLISE ATUAL:
- Total gasto com manutenção: R$ 235,03
- Principais vilões:
  - COB000016: R$ 64,64 (título de R$ 10.302)
  - COB000014: R$ 56,56
  - COB000009: R$ 36,36 (título de R$ 10.297)

💡 RECOMENDAÇÃO:
Quando um título ficar mais de 60 dias sem pagamento:
1. CANCELAR o boleto no banco (baixa sem pagamento)
2. MANTER o valor no contas a receber do sistema
3. COBRAR direto via PIX/transferência

💰 ECONOMIA:
- Cada título custa ~R$ 2/mês de manutenção
- 10 títulos x 12 meses = R$ 240/ano desperdiçado
*/
