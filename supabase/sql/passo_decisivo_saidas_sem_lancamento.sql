-- =============================================================================
-- PASSO DECISIVO - IDENTIFICAR SAÍDAS SEM LANÇAMENTO CONTÁBIL
-- Dr. Cícero - 29/01/2026
-- =============================================================================

-- 1. SAÍDAS SEM NENHUM LANÇAMENTO (journal_entry_id IS NULL)
SELECT
    bt.id,
    bt.transaction_date as data,
    bt.amount as valor,
    ABS(bt.amount) as valor_absoluto,
    bt.description as descricao
FROM bank_transactions bt
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND bt.amount < 0
AND bt.journal_entry_id IS NULL
ORDER BY bt.transaction_date;

-- 2. RESUMO: QUANTAS SAÍDAS SEM LANÇAMENTO?
SELECT 
    'SAIDAS SEM LANCAMENTO' as tipo,
    COUNT(*) as quantidade,
    SUM(ABS(amount)) as valor_total
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND amount < 0
AND journal_entry_id IS NULL;

-- 3. SAÍDAS COM LANÇAMENTO DE IMPORTAÇÃO MAS SEM CLASSIFICAÇÃO
SELECT 
    bt.id,
    bt.transaction_date as data,
    bt.amount as valor,
    bt.description as descricao,
    e.source_type,
    e.internal_code
FROM bank_transactions bt
JOIN accounting_entries e ON e.id = bt.journal_entry_id
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND bt.amount < 0
AND e.source_type = 'ofx_import'
ORDER BY bt.transaction_date
LIMIT 20;
