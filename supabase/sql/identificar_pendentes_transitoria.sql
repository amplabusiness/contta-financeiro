-- =============================================================================
-- IDENTIFICAR OS R$ 2.604,90 PENDENTES NA TRANSITÓRIA
-- Dr. Cícero - 29/01/2026
-- =============================================================================

-- VERIFICAR: Quais lançamentos estão na transitória SEM contrapartida de classificação?
-- Ou seja: entraram na transitória mas não saíram

-- 1. LANÇAMENTOS QUE DEBITARAM A TRANSITÓRIA (saídas do banco)
SELECT 
    e.id as entry_id,
    e.entry_date as data,
    e.description as descricao,
    e.internal_code,
    e.source_type,
    l.debit as valor_debito,
    l.credit as valor_credito
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'  -- Transitória Débitos
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.debit > 0  -- Apenas débitos (entradas na transitória)
ORDER BY e.entry_date, l.debit DESC
LIMIT 30;

-- 2. LANÇAMENTOS QUE CREDITARAM A TRANSITÓRIA (classificações)
SELECT 
    e.id as entry_id,
    e.entry_date as data,
    e.description as descricao,
    e.internal_code,
    e.source_type,
    l.debit as valor_debito,
    l.credit as valor_credito
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'  -- Transitória Débitos
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.credit > 0  -- Apenas créditos (saídas da transitória = classificações)
ORDER BY e.entry_date, l.credit DESC
LIMIT 30;

-- 3. TOTAIS PARA CONFERÊNCIA
SELECT 
    'DEBITOS (entradas na transitória)' as tipo,
    COUNT(*) as qtd,
    SUM(l.debit) as total
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.debit > 0

UNION ALL

SELECT 
    'CREDITOS (classificações)' as tipo,
    COUNT(*) as qtd,
    SUM(l.credit) as total
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.credit > 0;
