-- =============================================================================
-- Dr. Cícero - Análise de Classificação Transitória Débitos (01/2025)
-- Objetivo: preparar dados para reclassificar e zerar conta 1.1.9.01
-- =============================================================================

-- PARAMETROS
-- Tenant: a53a4957-fe97-4856-b3ca-70045157b421
-- Conta transitória (account_id) = 3e1fd22f-fba2-4cc2-b628-9d729233bca0  (1.1.9.01)
-- Competência: 2025-01

-- 0) CHECAGEM: saldo da transitória
SELECT * FROM vw_transitory_balances;

-- 1) LISTA COMPLETA: lançamentos que DEBITARAM a transitória (pendências)
SELECT
  e.id                  AS lancamento_id,
  e.entry_date          AS data,
  e.description         AS descricao,
  e.internal_code,
  e.source_type,
  l.debit               AS valor,
  bt.id                 AS bank_transaction_id,
  bt.transaction_date   AS bank_data,
  bt.description        AS bank_descricao,
  bt.amount             AS bank_valor,
  bt.transaction_type   AS bank_tipo,
  bt.fitid              AS bank_fitid
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
LEFT JOIN bank_transactions bt ON bt.journal_entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
  AND l.debit > 0
ORDER BY e.entry_date, l.debit DESC;

-- 2) AGRUPAMENTO POR PADRÃO + EXEMPLOS (para decisão em lote)
WITH base AS (
  SELECT
    e.id AS lancamento_id,
    e.entry_date AS data,
    e.description AS descricao,
    l.debit AS valor
  FROM accounting_entries e
  JOIN accounting_entry_lines l ON l.entry_id = e.id
  WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND l.debit > 0
),
cat AS (
  SELECT
    *,
    CASE
      WHEN descricao ILIKE '%TARIFA%' OR descricao ILIKE '%TAXA%' THEN 'TARIFAS BANCÁRIAS'
      WHEN descricao ILIKE '%IOF%' THEN 'IOF'
      WHEN descricao ILIKE '%ALUGUEL%' THEN 'ALUGUEL'
      WHEN descricao ILIKE '%ENERGIA%' OR descricao ILIKE '%ENEL%' OR descricao ILIKE '%CELG%' THEN 'ENERGIA'
      WHEN descricao ILIKE '%VIVO%' OR descricao ILIKE '%TIM%' OR descricao ILIKE '%CLARO%' OR descricao ILIKE '%TELEF%' THEN 'TELEFONIA/INTERNET'
      WHEN descricao ILIKE '%DAS%' THEN 'DAS (SIMPLES)'
      WHEN descricao ILIKE '%FGTS%' THEN 'FGTS'
      WHEN descricao ILIKE '%GPS%' OR descricao ILIKE '%INSS%' THEN 'INSS/GPS'
      WHEN descricao ILIKE '%DARF%' THEN 'DARF'
      WHEN descricao ILIKE '%PIX%' THEN 'PIX (DIVERSOS)'
      WHEN descricao ILIKE '%BOLETO%' THEN 'BOLETOS (DIVERSOS)'
      WHEN descricao ILIKE '%TRANSFER%' OR descricao ILIKE '%TED%' THEN 'TRANSFERÊNCIAS'
      ELSE 'OUTROS (ANÁLISE MANUAL)'
    END AS categoria
  FROM base
)
SELECT
  categoria,
  COUNT(*) AS qtd,
  SUM(valor) AS total,
  MIN(valor) AS menor,
  MAX(valor) AS maior,
  (ARRAY_AGG(descricao ORDER BY valor DESC))[1] AS exemplo_1,
  (ARRAY_AGG(descricao ORDER BY valor DESC))[2] AS exemplo_2,
  (ARRAY_AGG(descricao ORDER BY valor DESC))[3] AS exemplo_3
FROM cat
GROUP BY categoria
ORDER BY total DESC;

-- 3) PLANO DE CONTAS DISPONÍVEL (somente ANALÍTICAS para reclassificar)
SELECT
  c.id,
  c.code,
  c.name,
  c.account_type
FROM chart_of_accounts c
WHERE c.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND c.is_active = true
  AND (
    c.code LIKE '3.%'
    OR c.code LIKE '4.%'
    OR c.code LIKE '5.%'
    OR c.name ILIKE '%PRÓ-LABORE%'
    OR c.name ILIKE '%RETIRADA%'
    OR c.name ILIKE '%IMPOSTO%'
    OR c.name ILIKE '%TRIBUTO%'
    OR c.name ILIKE '%TARIFA%'
    OR c.name ILIKE '%ALUGUEL%'
  )
ORDER BY c.code;

-- 4) CONFERÊNCIA: total pendente (saldo da transitória)
SELECT
  SUM(l.debit) - SUM(l.credit) AS saldo_transitoria_debitos
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
