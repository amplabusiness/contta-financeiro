-- =============================================================================
-- LISTAR LANÇAMENTOS NA TRANSITÓRIA DE DÉBITOS
-- Dr. Cícero - 29/01/2026
-- =============================================================================
-- Estes são os lançamentos que compõem os R$ 112.501,41 pendentes
-- =============================================================================

-- 1️⃣ LANÇAMENTOS QUE DEBITARAM A TRANSITÓRIA (não foram reclassificados)
SELECT
    e.id as lancamento_id,
    e.entry_date as data,
    e.description as descricao,
    e.internal_code,
    e.source_type,
    l.debit as valor_debito,
    l.credit as valor_credito
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'  -- Transitória Débitos (1.1.9.01)
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.debit > 0  -- Apenas débitos (entradas na transitória)
ORDER BY e.entry_date, l.debit DESC;

-- 2️⃣ RESUMO: DÉBITOS vs CRÉDITOS NA TRANSITÓRIA
SELECT
    'DEBITOS (entradas)' as tipo,
    COUNT(*) as qtd_lancamentos,
    SUM(l.debit) as valor_total
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.debit > 0

UNION ALL

SELECT
    'CREDITOS (classificações)' as tipo,
    COUNT(*) as qtd_lancamentos,
    SUM(l.credit) as valor_total
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.credit > 0;

-- 3️⃣ IDENTIFICAR LANÇAMENTOS QUE AINDA NÃO TÊM RECLASSIFICAÇÃO
-- (Debitaram a transitória mas não tem crédito correspondente)
WITH debitos AS (
    SELECT 
        e.id,
        e.entry_date,
        e.description,
        e.internal_code,
        l.debit as valor
    FROM accounting_entries e
    JOIN accounting_entry_lines l ON l.entry_id = e.id
    WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
    AND l.debit > 0
),
creditos AS (
    SELECT 
        e.internal_code,
        SUM(l.credit) as valor_classificado
    FROM accounting_entries e
    JOIN accounting_entry_lines l ON l.entry_id = e.id
    WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
    AND l.credit > 0
    GROUP BY e.internal_code
)
SELECT 
    d.entry_date as data,
    d.description as descricao,
    d.valor as valor_original,
    COALESCE(c.valor_classificado, 0) as valor_classificado,
    d.valor - COALESCE(c.valor_classificado, 0) as pendente
FROM debitos d
LEFT JOIN creditos c ON c.internal_code = REPLACE(d.internal_code, 'OFX_IMP_', 'CLASS_')
WHERE d.valor - COALESCE(c.valor_classificado, 0) > 0
ORDER BY d.entry_date;

-- 4️⃣ AGRUPAMENTO POR PADRÃO DE DESCRIÇÃO (para classificação em lote)
SELECT 
    CASE 
        WHEN e.description ILIKE '%TARIFA%' THEN 'TARIFAS BANCÁRIAS'
        WHEN e.description ILIKE '%IOF%' THEN 'IOF'
        WHEN e.description ILIKE '%PIX%' THEN 'PIX (diversos)'
        WHEN e.description ILIKE '%TED%' THEN 'TED (diversos)'
        WHEN e.description ILIKE '%BOLETO%' THEN 'BOLETOS (diversos)'
        WHEN e.description ILIKE '%FGTS%' THEN 'FGTS'
        WHEN e.description ILIKE '%GPS%' OR e.description ILIKE '%INSS%' THEN 'INSS/GPS'
        WHEN e.description ILIKE '%DAS%' THEN 'DAS (Simples)'
        WHEN e.description ILIKE '%DARF%' THEN 'DARF (tributos)'
        WHEN e.description ILIKE '%ENERGIA%' OR e.description ILIKE '%ENEL%' THEN 'ENERGIA'
        WHEN e.description ILIKE '%ALUGUEL%' THEN 'ALUGUEL'
        WHEN e.description ILIKE '%TELEFON%' OR e.description ILIKE '%VIVO%' OR e.description ILIKE '%TIM%' THEN 'TELEFONIA'
        ELSE 'OUTROS'
    END as categoria,
    COUNT(*) as quantidade,
    SUM(l.debit) as valor_total
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
AND l.debit > 0
GROUP BY 1
ORDER BY valor_total DESC;
