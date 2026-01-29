-- =============================================================================
-- DIAGNÓSTICO COMPLETO - JANEIRO/2025
-- Dr. Cícero - 29/01/2026
-- =============================================================================
-- Execute este script INTEIRO e cole TODOS os resultados
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1️⃣ INTEGRIDADE DO SISTEMA
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '1. INTEGRIDADE' as secao;
SELECT rpc_check_accounting_integrity('a53a4957-fe97-4856-b3ca-70045157b421'::uuid) as resultado_integridade;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2️⃣ SALDO DAS TRANSITÓRIAS (VERDADE CONTÁBIL)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '2. TRANSITORIAS' as secao;
SELECT * FROM vw_transitory_balances;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3️⃣ TODAS AS TRANSAÇÕES DE JANEIRO (sem filtro de status)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '3. TODAS TRANSACOES JAN/2025' as secao;
SELECT 
    bt.id,
    bt.transaction_date as data,
    bt.amount as valor,
    LEFT(bt.description, 50) as descricao,
    bt.status,
    bt.is_reconciled as reconciliado,
    bt.journal_entry_id IS NOT NULL as tem_lancamento,
    CASE WHEN bt.amount > 0 THEN 'ENTRADA' ELSE 'SAIDA' END as tipo
FROM bank_transactions bt
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY bt.transaction_date, bt.amount
LIMIT 50;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4️⃣ RESUMO REAL (sem filtro de status)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '4. RESUMO REAL JAN/2025' as secao;
SELECT 
    CASE WHEN amount > 0 THEN 'ENTRADAS' ELSE 'SAIDAS' END as tipo,
    COUNT(*) as qtd_total,
    SUM(CASE WHEN is_reconciled = false THEN 1 ELSE 0 END) as qtd_pendentes,
    SUM(CASE WHEN is_reconciled = true THEN 1 ELSE 0 END) as qtd_reconciliadas,
    SUM(ABS(amount)) as valor_total
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY CASE WHEN amount > 0 THEN 'ENTRADAS' ELSE 'SAIDAS' END;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5️⃣ TRANSAÇÕES SEM LANÇAMENTO CONTÁBIL
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '5. SEM LANCAMENTO CONTABIL' as secao;
SELECT 
    CASE WHEN amount > 0 THEN 'ENTRADAS' ELSE 'SAIDAS' END as tipo,
    COUNT(*) as quantidade,
    SUM(ABS(amount)) as valor_total
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND journal_entry_id IS NULL
GROUP BY CASE WHEN amount > 0 THEN 'ENTRADAS' ELSE 'SAIDAS' END;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6️⃣ MOVIMENTAÇÃO CONTÁBIL NAS TRANSITÓRIAS (Janeiro)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '6. MOVIMENTACAO TRANSITORIAS JAN/2025' as secao;
SELECT 
    c.code,
    c.name,
    SUM(l.debit) as total_debitos,
    SUM(l.credit) as total_creditos,
    SUM(l.debit) - SUM(l.credit) as saldo
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND c.code IN ('1.1.9.01', '2.1.9.01')
GROUP BY c.id, c.code, c.name;
