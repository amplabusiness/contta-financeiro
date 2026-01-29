-- =============================================================================
-- DIAGNÓSTICO FINAL - JANEIRO/2025
-- Dr. Cícero - 29/01/2026
-- =============================================================================

-- 1️⃣ SAÍDAS SEM LANÇAMENTO CONTÁBIL (journal_entry_id IS NULL)
SELECT
    bt.id,
    bt.transaction_date as data,
    bt.description as descricao,
    bt.amount as valor,
    ABS(bt.amount) AS valor_absoluto,
    bt.status,
    bt.is_reconciled
FROM bank_transactions bt
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND bt.amount < 0
AND bt.journal_entry_id IS NULL
ORDER BY bt.transaction_date;

-- 2️⃣ RESUMO CONSOLIDADO (ENTRADAS x SAÍDAS)
SELECT
    CASE WHEN amount > 0 THEN 'ENTRADAS' ELSE 'SAIDAS' END AS tipo,
    COUNT(*) AS quantidade,
    SUM(ABS(amount)) AS valor_total,
    COUNT(*) FILTER (WHERE journal_entry_id IS NULL) AS sem_lancamento,
    SUM(ABS(amount)) FILTER (WHERE journal_entry_id IS NULL) AS valor_sem_lancamento
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY 1;

-- 3️⃣ SALDO ATUAL DAS TRANSITÓRIAS
SELECT * FROM vw_transitory_balances;
