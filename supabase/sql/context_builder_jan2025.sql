-- =============================================================================
-- CONTEXT BUILDER — FECHAMENTO 01/2025 (RAG PACKAGE)
-- Gera os insumos oficiais para avaliação do Dr. Cícero
-- Tenant: a53a4957-fe97-4856-b3ca-70045157b421
-- Período: 2025-01-01 a 2025-01-31
-- =============================================================================

-- 0) STATUS DO FECHAMENTO
SELECT status, input_hash, approved_at, closed_at
FROM accounting_closures
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND year = 2025
  AND month = 1
ORDER BY created_at DESC
LIMIT 1;

-- 1) PLANO DE CONTAS ATIVO
SELECT id, code, name, account_type
FROM chart_of_accounts
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND is_active = true
ORDER BY code;

-- 2) BALANCETE (fallback)
SELECT
  c.code,
  c.name,
  SUM(l.debit) AS total_debit,
  SUM(l.credit) AS total_credit,
  SUM(l.debit - l.credit) AS balance
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY c.code, c.name
ORDER BY c.code;

-- 3) TRANSITÓRIAS
SELECT
  c.code,
  c.name,
  COALESCE(SUM(l.debit), 0) AS total_debit,
  COALESCE(SUM(l.credit), 0) AS total_credit,
  COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS balance,
  CASE
    WHEN ABS(COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)) < 0.01 THEN '✅ ZERADA'
    ELSE '⚠️ PENDENTE'
  END AS status
FROM chart_of_accounts c
LEFT JOIN accounting_entry_lines l ON l.account_id = c.id
LEFT JOIN accounting_entries e ON e.id = l.entry_id
WHERE c.code IN ('1.1.9.01', '2.1.9.01')
  AND e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY c.id, c.code, c.name
ORDER BY c.code;

-- 4) RESUMO DE LANÇAMENTOS
SELECT
  COUNT(*) AS entries_count,
  SUM(total_debit) AS total_debit,
  SUM(total_credit) AS total_credit
FROM (
  SELECT e.id,
         SUM(l.debit) AS total_debit,
         SUM(l.credit) AS total_credit
  FROM accounting_entries e
  JOIN accounting_entry_lines l ON l.entry_id = e.id
  WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  GROUP BY e.id
) t;

-- 5) LANÇAMENTOS GENÉRICOS/SUSPEITOS
SELECT e.id, e.entry_date, e.description, SUM(l.debit - l.credit) AS value
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND (
    e.description ILIKE '%OUTROS%'
    OR e.description ILIKE '%DIVERSOS%'
    OR c.name ILIKE '%PENDENTE%'
  )
GROUP BY e.id, e.entry_date, e.description
ORDER BY ABS(SUM(l.debit - l.credit)) DESC;

-- 6) DRE (insumos)
SELECT
  c.code,
  c.name,
  SUM(l.debit) AS debit,
  SUM(l.credit) AS credit,
  SUM(l.credit - l.debit) AS result
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND (c.code LIKE '3.%' OR c.code LIKE '4.%' OR c.code LIKE '5.%')
GROUP BY c.code, c.name
ORDER BY c.code;

-- 7) EVENTOS DE INVALIDAÇÃO
SELECT id, status, input_hash, approved_at, closed_at, invalidated_at, invalidated_reason, created_at
FROM accounting_closures
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND year = 2025
  AND month = 1
ORDER BY created_at DESC;
