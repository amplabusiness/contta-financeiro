-- ============================================================================
-- AUDITORIA DE CONSISTÊNCIA DE RECONCILIAÇÃO
-- Autor: Dr. Cícero - Contador Responsável
-- Data: 01/02/2026
-- Descrição: Query de auditoria mensal para detectar inconsistências entre
--            estado contábil e operacional das transações bancárias
-- ============================================================================

-- ==========================================================================
-- PARTE 1: RELATÓRIO DE SITUAÇÃO ATUAL
-- ==========================================================================
SELECT 
    '📊 RELATÓRIO DE CONSISTÊNCIA - RECONCILIAÇÃO' as titulo,
    CURRENT_TIMESTAMP as data_auditoria;

-- ==========================================================================
-- PARTE 2: MÉTRICAS POR STATUS
-- ==========================================================================
SELECT 
    'MÉTRICAS POR STATUS' as secao,
    COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL AND status = 'reconciled') as corretas_reconciliadas,
    COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL AND (status IS NULL OR status != 'reconciled')) as inconsistentes_com_entry,
    COUNT(*) FILTER (WHERE journal_entry_id IS NULL AND status = 'reconciled') as inconsistentes_sem_entry,
    COUNT(*) FILTER (WHERE journal_entry_id IS NULL AND (status IS NULL OR status = 'pending')) as pendentes_ok,
    COUNT(*) as total_transacoes
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- ==========================================================================
-- PARTE 3: TRANSAÇÕES INCONSISTENTES (journal_entry_id existe, status != reconciled)
-- NOTA: Com o trigger enforce_reconciliation_state, isso NÃO DEVE acontecer
-- ==========================================================================
SELECT 
    'INCONSISTENTES: TEM LANÇAMENTO MAS STATUS ERRADO' as tipo_problema,
    id,
    transaction_date,
    description,
    amount,
    status,
    journal_entry_id,
    is_reconciled,
    reconciled_at
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND journal_entry_id IS NOT NULL
  AND (status IS NULL OR status != 'reconciled')
ORDER BY transaction_date DESC
LIMIT 50;

-- ==========================================================================
-- PARTE 4: TRANSAÇÕES ÓRFÃS (status = reconciled, mas SEM journal_entry_id)
-- ISSO É UM BUG GRAVE - indica reconciliação "falsa"
-- ==========================================================================
SELECT 
    '⚠️ ÓRFÃS: MARCADAS RECONCILIADAS SEM LANÇAMENTO' as tipo_problema,
    id,
    transaction_date,
    description,
    amount,
    status,
    matched,
    is_reconciled
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND status = 'reconciled'
  AND journal_entry_id IS NULL
ORDER BY transaction_date DESC
LIMIT 50;

-- ==========================================================================
-- PARTE 5: RESUMO POR MÊS (últimos 6 meses)
-- ==========================================================================
SELECT 
    DATE_TRUNC('month', transaction_date) as mes,
    COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL) as classificadas,
    COUNT(*) FILTER (WHERE journal_entry_id IS NULL) as pendentes,
    COUNT(*) as total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as pct_classificacao
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', transaction_date)
ORDER BY mes DESC;

-- ==========================================================================
-- PARTE 6: VERIFICAR INTEGRIDADE DAS TRANSITÓRIAS
-- Regra Dr. Cícero: Transitórias devem zerar ao fim do período
-- ==========================================================================
SELECT 
    '📋 SALDO DAS TRANSITÓRIAS' as verificacao,
    c.code,
    c.name,
    COALESCE(SUM(l.debit), 0) as total_debitos,
    COALESCE(SUM(l.credit), 0) as total_creditos,
    COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as saldo,
    CASE 
        WHEN ABS(COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)) < 0.01 THEN '✅ OK'
        ELSE '⚠️ PENDENTE'
    END as status
FROM chart_of_accounts c
LEFT JOIN accounting_entry_lines l ON l.account_id = c.id
LEFT JOIN accounting_entries e ON e.id = l.entry_id
WHERE c.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND c.code IN ('1.1.9.01', '2.1.9.01')
GROUP BY c.id, c.code, c.name
ORDER BY c.code;

-- ==========================================================================
-- PARTE 7: AÇÃO CORRETIVA AUTOMÁTICA (SE NECESSÁRIO)
-- Descomente para executar - usa o mesmo trigger que fizemos
-- ==========================================================================
-- UPDATE bank_transactions
-- SET status = 'reconciled',
--     is_reconciled = true,
--     reconciled_at = COALESCE(reconciled_at, NOW())
-- WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
--   AND journal_entry_id IS NOT NULL
--   AND (status IS NULL OR status != 'reconciled');

-- ============================================================================
-- FIM DO RELATÓRIO
-- ============================================================================
SELECT 
    '✅ AUDITORIA CONCLUÍDA' as resultado,
    'Execute mensalmente para garantir consistência' as recomendacao,
    'Dr. Cícero - Sistema Contta' as responsavel;
