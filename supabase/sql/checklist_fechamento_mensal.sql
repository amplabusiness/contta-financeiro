-- =============================================================================
-- SCRIPT DE FECHAMENTO MENSAL - PADRÃO DR. CÍCERO
-- Uso: Executar todas as etapas sequencialmente no Supabase SQL Editor
-- =============================================================================

-- PARÂMETROS (alterar conforme competência)
-- Tenant: a53a4957-fe97-4856-b3ca-70045157b421
-- Período: 2025-01-01 a 2025-01-31

-- =============================================================================
-- ETAPA 1: INTEGRIDADE DO SISTEMA
-- =============================================================================
SELECT '=== ETAPA 1: INTEGRIDADE ===' AS etapa;

-- 1.1 Verificar integridade geral
SELECT rpc_check_accounting_integrity('a53a4957-fe97-4856-b3ca-70045157b421') AS integridade;

-- 1.2 Lançamentos órfãos (linhas sem cabeçalho)
SELECT 
  'Linhas órfãs' AS verificacao,
  COUNT(*) AS quantidade,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FALHA' END AS status
FROM accounting_entry_lines l
LEFT JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.id IS NULL;

-- 1.3 Lançamentos desbalanceados
SELECT 
  'Lançamentos desbalanceados' AS verificacao,
  COUNT(*) AS quantidade,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FALHA' END AS status
FROM (
  SELECT e.id, SUM(l.debit) AS d, SUM(l.credit) AS c
  FROM accounting_entries e
  JOIN accounting_entry_lines l ON l.entry_id = e.id
  WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  GROUP BY e.id
  HAVING ABS(SUM(l.debit) - SUM(l.credit)) > 0.01
) x;

-- =============================================================================
-- ETAPA 2: CONCILIAÇÃO BANCÁRIA
-- =============================================================================
SELECT '=== ETAPA 2: CONCILIAÇÃO BANCÁRIA ===' AS etapa;

-- 2.1 Transações não reconciliadas
SELECT 
  'Transações pendentes' AS verificacao,
  COUNT(*) AS quantidade,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '⚠️ ATENÇÃO' END AS status
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND is_reconciled = false;

-- 2.2 Transações sem lançamento contábil
SELECT 
  'Transações sem lançamento' AS verificacao,
  COUNT(*) AS quantidade,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '⚠️ ATENÇÃO' END AS status
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND journal_entry_id IS NULL;

-- =============================================================================
-- ETAPA 3: CONTAS TRANSITÓRIAS
-- =============================================================================
SELECT '=== ETAPA 3: TRANSITÓRIAS ===' AS etapa;

-- 3.1 Saldo das transitórias (view)
SELECT * FROM vw_transitory_balances;

-- 3.2 Saldo detalhado 1.1.9.01 (Débitos)
SELECT 
  '1.1.9.01 - Transitória Débitos' AS conta,
  SUM(l.debit) AS total_debitos,
  SUM(l.credit) AS total_creditos,
  SUM(l.debit) - SUM(l.credit) AS saldo,
  CASE 
    WHEN ABS(SUM(l.debit) - SUM(l.credit)) < 0.01 THEN '✅ ZERADA'
    ELSE '⚠️ VERIFICAR (pode ser compensação lógica)'
  END AS status
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
  AND e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';

-- 3.3 Saldo detalhado 2.1.9.01 (Créditos)
SELECT 
  '2.1.9.01 - Transitória Créditos' AS conta,
  SUM(l.debit) AS total_debitos,
  SUM(l.credit) AS total_creditos,
  SUM(l.debit) - SUM(l.credit) AS saldo,
  CASE 
    WHEN ABS(SUM(l.debit) - SUM(l.credit)) < 0.01 THEN '✅ ZERADA'
    ELSE '⚠️ VERIFICAR (pode ser compensação lógica)'
  END AS status
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.account_id = '28085461-9e5a-4fb4-847d-c9fc047fe0a1'
  AND e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';

-- =============================================================================
-- ETAPA 4: CLASSIFICAÇÃO CONTÁBIL
-- =============================================================================
SELECT '=== ETAPA 4: CLASSIFICAÇÃO ===' AS etapa;

-- 4.1 Resumo por grupo de conta
SELECT 
  LEFT(c.code, 1) AS grupo,
  CASE LEFT(c.code, 1)
    WHEN '1' THEN 'ATIVO'
    WHEN '2' THEN 'PASSIVO'
    WHEN '3' THEN 'RECEITA'
    WHEN '4' THEN 'DESPESA'
    WHEN '5' THEN 'RESULTADO'
  END AS tipo,
  COUNT(DISTINCT e.id) AS qtd_lancamentos,
  SUM(l.debit) AS total_debitos,
  SUM(l.credit) AS total_creditos
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY LEFT(c.code, 1)
ORDER BY LEFT(c.code, 1);

-- =============================================================================
-- ETAPA 5: ANÁLISE DE COERÊNCIA
-- =============================================================================
SELECT '=== ETAPA 5: COERÊNCIA ===' AS etapa;

-- 5.1 Movimentação bancária total
SELECT 
  'Movimentação Bancária' AS item,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS entradas,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS saidas,
  SUM(amount) AS liquido
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31';

-- 5.2 Receitas contábeis
SELECT 
  'Receitas Contábeis (grupo 3.x)' AS item,
  SUM(l.credit) - SUM(l.debit) AS total_receitas
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND c.code LIKE '3.%';

-- 5.3 Despesas contábeis
SELECT 
  'Despesas Contábeis (grupo 4.x)' AS item,
  SUM(l.debit) - SUM(l.credit) AS total_despesas
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND c.code LIKE '4.%';

-- =============================================================================
-- ETAPA 6: ESTATÍSTICAS FINAIS
-- =============================================================================
SELECT '=== ESTATÍSTICAS FINAIS ===' AS etapa;

SELECT 
  'Janeiro/2025' AS competencia,
  (SELECT COUNT(*) FROM bank_transactions 
   WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
   AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31') AS transacoes_bancarias,
  (SELECT COUNT(*) FROM accounting_entries 
   WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
   AND entry_date BETWEEN '2025-01-01' AND '2025-01-31') AS lancamentos_contabeis,
  (SELECT COUNT(*) FROM accounting_entry_lines l
   JOIN accounting_entries e ON e.id = l.entry_id
   WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
   AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31') AS linhas_contabeis;

-- =============================================================================
-- RESULTADO: SE TUDO OK, EXECUTAR FECHAMENTO
-- =============================================================================
-- DESCOMENTE AS LINHAS ABAIXO APÓS VALIDAÇÃO

-- INSERT INTO period_closings (tenant_id, period_year, period_month, closed_at, closed_by, notes)
-- VALUES (
--   'a53a4957-fe97-4856-b3ca-70045157b421',
--   2025,
--   1,
--   NOW(),
--   'Dr. Cícero',
--   'Fechamento conforme checklist padrão. Integridade OK. Transitórias compensadas.'
-- );

SELECT '=== FIM DO CHECKLIST ===' AS etapa;
