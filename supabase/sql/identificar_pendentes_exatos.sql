-- =============================================================================
-- IDENTIFICAR EXATAMENTE OS R$ 112.501,41 PENDENTES
-- Dr. Cícero - 29/01/2026
-- =============================================================================

-- LANÇAMENTOS NA TRANSITÓRIA QUE NÃO TÊM CLASSIFICAÇÃO CORRESPONDENTE
-- Usando o internal_code para rastrear

-- 1️⃣ LISTA DOS PENDENTES COM DETALHES
WITH importacoes AS (
    -- Lançamentos que DEBITARAM a transitória (importação OFX)
    SELECT 
        e.id,
        e.entry_date,
        e.description,
        e.internal_code,
        l.debit as valor
    FROM accounting_entries e
    JOIN accounting_entry_lines l ON l.entry_id = e.id
    WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'  -- Transitória Débitos
    AND l.debit > 0
),
classificacoes AS (
    -- Lançamentos que CREDITARAM a transitória (classificação)
    SELECT 
        e.id,
        e.internal_code,
        l.credit as valor
    FROM accounting_entries e
    JOIN accounting_entry_lines l ON l.entry_id = e.id
    WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'  -- Transitória Débitos
    AND l.credit > 0
)
SELECT 
    i.id as lancamento_id,
    i.entry_date as data,
    i.description as descricao,
    i.internal_code,
    i.valor as valor_importado,
    CASE 
        WHEN i.description ILIKE '%PIX%' THEN 'PIX'
        WHEN i.description ILIKE '%BOLETO%' OR i.description ILIKE '%BOL%' THEN 'BOLETO'
        ELSE 'OUTRO'
    END as tipo
FROM importacoes i
LEFT JOIN classificacoes c ON c.id = i.id  -- Mesmo lançamento não pode ter D e C na transitória
WHERE NOT EXISTS (
    -- Não existe classificação para este valor
    SELECT 1 FROM classificacoes c2 
    WHERE c2.valor = i.valor
)
ORDER BY i.entry_date, i.valor DESC
LIMIT 50;

-- 2️⃣ ALTERNATIVA: Listar bank_transactions vinculadas a lançamentos na transitória
-- mas que não tem lançamento de classificação
SELECT 
    bt.id as transacao_id,
    bt.transaction_date as data,
    bt.description as descricao,
    ABS(bt.amount) as valor,
    CASE 
        WHEN bt.description ILIKE '%PIX%' THEN 'PIX'
        WHEN bt.description ILIKE '%BOLETO%' OR bt.description ILIKE '%BOL%' THEN 'BOLETO'
        WHEN bt.description ILIKE '%TARIFA%' THEN 'TARIFA'
        ELSE 'OUTRO'
    END as tipo
FROM bank_transactions bt
JOIN accounting_entries e ON e.id = bt.journal_entry_id
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND bt.amount < 0
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'  -- Transitória
AND l.debit > 0  -- Foi debitado na transitória
-- Verificar se NÃO existe crédito correspondente na transitória
AND NOT EXISTS (
    SELECT 1 
    FROM accounting_entry_lines l2
    JOIN accounting_entries e2 ON e2.id = l2.entry_id
    WHERE l2.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND l2.credit = l.debit  -- Mesmo valor
    AND e2.tenant_id = bt.tenant_id
)
ORDER BY bt.transaction_date, bt.amount
LIMIT 50;

-- 3️⃣ RESUMO POR TIPO DOS PENDENTES
SELECT 
    CASE 
        WHEN bt.description ILIKE '%PIX%' THEN 'PIX'
        WHEN bt.description ILIKE '%BOLETO%' OR bt.description ILIKE '%BOL%' THEN 'BOLETO'
        WHEN bt.description ILIKE '%TARIFA%' THEN 'TARIFA'
        ELSE 'OUTRO'
    END as tipo,
    COUNT(*) as quantidade,
    SUM(ABS(bt.amount)) as valor_total
FROM bank_transactions bt
JOIN accounting_entries e ON e.id = bt.journal_entry_id
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
AND bt.amount < 0
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
AND l.debit > 0
AND NOT EXISTS (
    SELECT 1 
    FROM accounting_entry_lines l2
    JOIN accounting_entries e2 ON e2.id = l2.entry_id
    WHERE l2.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND l2.credit = l.debit
    AND e2.tenant_id = bt.tenant_id
)
GROUP BY 1
ORDER BY valor_total DESC;
