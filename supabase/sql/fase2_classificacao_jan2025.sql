-- =============================================================================
-- FASE 2 - CLASSIFICAÇÃO JANEIRO/2025
-- Dr. Cícero - 29/01/2026
-- =============================================================================

-- PASSO 1: VERIFICAÇÃO DE INTEGRIDADE (confirmar base limpa)
SELECT rpc_check_accounting_integrity('a53a4957-fe97-4856-b3ca-70045157b421'::uuid);

-- PASSO 2: SALDO ATUAL DAS TRANSITÓRIAS
SELECT * FROM vw_transitory_balances;

-- PASSO 3: TRANSAÇÕES BANCÁRIAS PENDENTES DE CLASSIFICAÇÃO (Janeiro/2025)
SELECT 
    bt.id,
    bt.transaction_date,
    bt.amount,
    bt.description,
    bt.fitid,
    bt.status,
    bt.is_reconciled,
    CASE 
        WHEN bt.amount > 0 THEN 'ENTRADA (Crédito no banco)'
        ELSE 'SAÍDA (Débito no banco)'
    END as tipo_movimento,
    ABS(bt.amount) as valor_absoluto
FROM bank_transactions bt
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND (bt.is_reconciled = false OR bt.status = 'pending')
ORDER BY bt.transaction_date, bt.amount;

-- PASSO 4: RESUMO POR TIPO
SELECT 
    CASE WHEN amount > 0 THEN 'ENTRADAS' ELSE 'SAÍDAS' END as tipo,
    COUNT(*) as quantidade,
    SUM(ABS(amount)) as valor_total
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND (is_reconciled = false OR status = 'pending')
GROUP BY CASE WHEN amount > 0 THEN 'ENTRADAS' ELSE 'SAÍDAS' END;

-- PASSO 5: TOTAL GERAL PENDENTE
SELECT 
    COUNT(*) as total_transacoes_pendentes,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_entradas,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_saidas
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND (is_reconciled = false OR status = 'pending');
