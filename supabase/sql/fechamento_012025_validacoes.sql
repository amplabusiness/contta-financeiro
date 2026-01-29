-- FECHAMENTO 01/2025 — VALIDAÇÕES FINAIS

-- 3.1 Integridade geral (mês)
SELECT
  SUM(total_debit) AS total_debit,
  SUM(total_credit) AS total_credit,
  ROUND((SUM(total_debit) - SUM(total_credit))::numeric, 2) AS diff
FROM accounting_entries
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND entry_date BETWEEN '2025-01-01' AND '2025-01-31';

-- 3.2 Lançamentos ainda desbalanceados (após reproc)
SELECT
  e.id,
  e.entry_date,
  e.description,
  e.internal_code,
  SUM(l.debit) AS total_debit,
  SUM(l.credit) AS total_credit,
  ROUND((SUM(l.debit) - SUM(l.credit))::numeric, 2) AS diff,
  COUNT(1) AS qtd_linhas
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entries r
    WHERE r.tenant_id = e.tenant_id
      AND r.reference_type = 'reversal_of'
      AND r.reference_id = e.id
      AND r.entry_type = 'reversal'
  )
GROUP BY e.id
HAVING ABS(SUM(l.debit) - SUM(l.credit)) > 0.01
    OR COUNT(*) < 2
ORDER BY ABS(SUM(l.debit) - SUM(l.credit)) DESC;

-- 3.3 Conferir se os REPROC foram criados
SELECT
  source_type,
  COUNT(*) qtd,
  ROUND(SUM(total_debit - total_credit)::numeric, 2) AS diff
FROM accounting_entries
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND internal_code LIKE 'REPROC_%'
GROUP BY source_type;
