-- =============================================================================
-- FASE 2A - LISTAR TODAS AS SAÍDAS DE JANEIRO/2025
-- Dr. Cícero - 29/01/2026
-- =============================================================================

-- TODAS AS SAÍDAS (amount < 0) - SEM FILTRO DE STATUS
SELECT
    id,
    transaction_date as data,
    amount as valor,
    ABS(amount) as valor_absoluto,
    description as descricao,
    is_reconciled as reconciliado,
    status,
    journal_entry_id IS NOT NULL as tem_lancamento_importacao
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND amount < 0
ORDER BY transaction_date, amount;

-- RESUMO DAS SAÍDAS
SELECT 
    'SAIDAS JANEIRO/2025' as tipo,
    COUNT(*) as quantidade,
    SUM(ABS(amount)) as valor_total,
    SUM(CASE WHEN is_reconciled = false THEN 1 ELSE 0 END) as nao_reconciliadas,
    SUM(CASE WHEN is_reconciled = true THEN 1 ELSE 0 END) as reconciliadas
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND amount < 0;
