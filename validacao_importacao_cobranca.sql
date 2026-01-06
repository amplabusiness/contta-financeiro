-- ============================================================================
-- VALIDAÇÃO E VERIFICAÇÃO PÓS-IMPORTAÇÃO DE COBRANÇA
-- ============================================================================
-- Após executar a importação via UI, rode essas queries para validar os dados
-- ============================================================================

-- 1. RESUMO GERAL DA IMPORTAÇÃO
-- Quantas invoices foram marcadas como "paid" após a importação?
SELECT 
  'Invoices Marcadas como Pagas (Jan 2025)' as diagnostico,
  COUNT(*) as total_invoices_pagas,
  SUM(amount) as total_valor,
  COUNT(DISTINCT client_id) as total_clientes_unicos,
  MIN(paid_date) as primeira_data,
  MAX(paid_date) as ultima_data
FROM invoices
WHERE status = 'paid'
  AND EXTRACT(YEAR FROM paid_date) = 2025
  AND EXTRACT(MONTH FROM paid_date) = 1;

-- 2. DETALHE POR COBRANÇA
-- COB000005 deve ter 5 clientes vinculados com total de 5.913,78
SELECT 
  'Detalhe COB000005' as cobranca,
  COUNT(i.id) as clientes_count,
  SUM(i.amount) as total_valor,
  STRING_AGG(c.name, ' | ') as clientes_nomes
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.paid_date::date = '2025-01-02'
  AND i.status = 'paid'
  AND i.amount IN (
    -- Valores da COB000005
    1412.00, 300.00, 760.00, 2029.78, 1412.00
  );

-- 3. INVOICES QUE NÃO FORAM ENCONTRADAS (Cliente não existe)
-- Se houver muitas, pode haver problema com normalização de nomes
SELECT 
  'Invoices com Cliente Não Encontrado' as diagnostico,
  COUNT(*) as total,
  ARRAY_AGG(DISTINCT client_id) as client_ids_not_found
FROM invoices
WHERE client_id IS NULL
  AND EXTRACT(YEAR FROM created_at) = 2025
  AND EXTRACT(MONTH FROM created_at) = 1;

-- 4. BANK TRANSACTIONS VINCULADAS
-- Quantas bank_transactions têm invoices vinculadas?
-- Nota: Match por valor + data_pagamento
SELECT 
  'Bank Transactions com Invoices Vinculadas' as diagnostico,
  COUNT(DISTINCT bt.id) as transacoes_com_invoices,
  SUM(bt.amount) as total_valor_vinculado,
  COUNT(i.id) as total_invoices_vinculadas
FROM bank_transactions bt
LEFT JOIN invoices i ON (
  i.amount = bt.amount 
  AND i.paid_date::date = bt.transaction_date::date
)
WHERE bt.description ILIKE '%COB%'
  AND EXTRACT(YEAR FROM bt.transaction_date) = 2025
  AND EXTRACT(MONTH FROM bt.transaction_date) = 1;

-- 5. MAPEAMENTO COMPLETO: COB → Clientes → Valores
-- Mostra exatamente que cada COB foi mapeado para quais clientes
SELECT 
  bt.description,
  bt.amount as total_cobranca,
  COUNT(i.id) as clientes_vinculados,
  STRING_AGG(DISTINCT c.name, ', ' ORDER BY c.name) as clientes,
  STRING_AGG(DISTINCT i.amount::text, ' + ' ORDER BY i.amount::text) as valores
FROM bank_transactions bt
LEFT JOIN invoices i ON (
  i.amount = bt.amount 
  AND i.paid_date::date = bt.transaction_date::date
)
LEFT JOIN clients c ON i.client_id = c.id
WHERE bt.description ILIKE '%COB%'
  AND EXTRACT(YEAR FROM bt.transaction_date) = 2025
  AND EXTRACT(MONTH FROM bt.transaction_date) = 1
GROUP BY bt.id, bt.description, bt.amount
ORDER BY bt.transaction_date;

-- 6. VALIDAÇÃO DE INTEGRIDADE
-- Os totais das invoices devem bater com bank_transaction
SELECT 
  'Validação Integridade (D/C = R$ 0)' as validacao,
  bt.description,
  bt.amount as bank_amount,
  COALESCE(SUM(i.amount), 0) as sum_invoices,
  ABS(bt.amount - COALESCE(SUM(i.amount), 0)) as diferenca,
  CASE 
    WHEN ABS(bt.amount - COALESCE(SUM(i.amount), 0)) < 0.01 THEN 'OK ✅'
    ELSE 'ERRO ❌'
  END as status
FROM bank_transactions bt
LEFT JOIN invoices i ON (
  i.amount = bt.amount 
  AND i.paid_date::date = bt.transaction_date::date
)
WHERE bt.description ILIKE '%COB%'
  AND EXTRACT(YEAR FROM bt.transaction_date) = 2025
  AND EXTRACT(MONTH FROM bt.transaction_date) = 1
GROUP BY bt.id, bt.description, bt.amount
ORDER BY diferenca DESC;

-- 7. ESTATÍSTICAS DE IMPORTAÇÃO
-- Resumo completo dos números
SELECT 
  'Estatística de Importação Jan 2025' as metrica,
  (SELECT COUNT(DISTINCT description) FROM bank_transactions 
   WHERE description ILIKE '%COB%'
     AND EXTRACT(YEAR FROM transaction_date) = 2025
     AND EXTRACT(MONTH FROM transaction_date) = 1) as total_cobracas,
  (SELECT COUNT(*) FROM invoices 
   WHERE status = 'paid'
     AND EXTRACT(YEAR FROM paid_date) = 2025
     AND EXTRACT(MONTH FROM paid_date) = 1) as total_invoices_pagas,
  (SELECT COUNT(DISTINCT client_id) FROM invoices 
   WHERE status = 'paid'
     AND EXTRACT(YEAR FROM paid_date) = 2025
     AND EXTRACT(MONTH FROM paid_date) = 1) as clientes_unicos_pagamento,
  (SELECT SUM(amount) FROM invoices 
   WHERE status = 'paid'
     AND EXTRACT(YEAR FROM paid_date) = 2025
     AND EXTRACT(MONTH FROM paid_date) = 1) as total_valor_pago,
  (SELECT SUM(amount) FROM bank_transactions 
   WHERE amount > 0
     AND EXTRACT(YEAR FROM transaction_date) = 2025
     AND EXTRACT(MONTH FROM transaction_date) = 1) as total_recebido_banco;

-- 8. CLIENTES COM MAIS DE UMA INVOICE PAGA
-- Alguns clientes podem ter múltiplas faturas pagas na mesma cobrança
SELECT 
  'Clientes com Múltiplas Invoices Pagas' as diagnostico,
  c.name as cliente,
  COUNT(i.id) as invoices_pagas,
  SUM(i.amount) as total_valor,
  STRING_AGG(DISTINCT i.id::text, ', ') as invoice_ids
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.status = 'paid'
  AND EXTRACT(YEAR FROM i.paid_date) = 2025
  AND EXTRACT(MONTH FROM i.paid_date) = 1
GROUP BY c.id, c.name
HAVING COUNT(i.id) > 1
ORDER BY COUNT(i.id) DESC;

-- 9. ANÁLISE POR DATA (Para encontrar padrões)
-- Como foram distribuídos os pagamentos por data?
SELECT 
  'Distribuição de Pagamentos por Data' as analise,
  i.paid_date::date as data_pagamento,
  COUNT(*) as invoices_pagas,
  COUNT(DISTINCT i.client_id) as clientes,
  SUM(i.amount) as total_valor
FROM invoices i
WHERE i.status = 'paid'
  AND EXTRACT(YEAR FROM i.paid_date) = 2025
  AND EXTRACT(MONTH FROM i.paid_date) = 1
GROUP BY i.paid_date::date
ORDER BY i.paid_date::date;

-- 10. REPORT FINAL PARA AUDITORIA
-- Tudo que você precisa saber sobre a importação em um lugar
WITH summary AS (
  SELECT 
    COUNT(DISTINCT CASE WHEN description ILIKE '%COB%' THEN id END) as cobracas_total,
    COUNT(DISTINCT CASE WHEN status = 'paid' AND paid_date >= '2025-01-01' THEN id END) as invoices_pagas,
    SUM(CASE WHEN status = 'paid' AND paid_date >= '2025-01-01' THEN amount ELSE 0 END) as total_pago,
    COUNT(DISTINCT CASE WHEN status = 'paid' AND paid_date >= '2025-01-01' THEN client_id END) as clientes_unicos
  FROM invoices
)
SELECT 
  'RELATÓRIO FINAL DE IMPORTAÇÃO' as tipo,
  cobracas_total || ' cobranças processadas' as metrica,
  invoices_pagas || ' invoices marcadas como pagas' as detalhe,
  'R$ ' || TO_CHAR(total_pago, '999,999.99') as valor_total,
  clientes_unicos || ' clientes com pagamento confirmado' as clientes
FROM summary;

-- ============================================================================
-- TROUBLESHOOTING QUERIES
-- ============================================================================

-- Se houver discrepâncias, use essas queries:

-- A. Invoices marcadas como 'pending' que deveriam estar 'paid'
SELECT 
  'Invoices NÃO Atualizadas (Possível Problema)' as problema,
  i.id,
  c.name as cliente,
  i.amount,
  i.status,
  i.paid_date,
  EXTRACT(MONTH FROM i.created_at) as mes_criacao
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.status = 'pending'
  AND i.amount IN (
    -- Valores conhecidos de COB000005
    1412.00, 300.00, 760.00, 2029.78
  )
  AND EXTRACT(YEAR FROM i.created_at) = 2025;

-- B. Bank transactions que não encontraram invoice correspondente
SELECT 
  'Bank Transactions Não Conciliadas' as problema,
  id,
  description,
  amount,
  transaction_date
FROM bank_transactions
WHERE description ILIKE '%COB%'
  AND EXTRACT(YEAR FROM transaction_date) = 2025
  AND EXTRACT(MONTH FROM transaction_date) = 1
  AND id NOT IN (
    SELECT DISTINCT bank_transaction_id 
    FROM invoices 
    WHERE bank_transaction_id IS NOT NULL
  );

-- C. Clientes não encontrados (client_id = NULL)
SELECT 
  'Clientes Não Encontrados no Sistema' as problema,
  COUNT(*) as total,
  COUNT(DISTINCT client_id) as unicos
FROM invoices
WHERE client_id IS NULL
  AND EXTRACT(YEAR FROM created_at) = 2025;

-- ============================================================================
-- LIMPEZA (Se necessário desfazer importação)
-- ============================================================================

-- CUIDADO: Essas queries deletam dados. Use apenas se necessário.

-- Desfazer todas as invoices criadas em jan/2025
-- DELETE FROM invoices 
-- WHERE EXTRACT(YEAR FROM created_at) = 2025
--   AND EXTRACT(MONTH FROM created_at) = 1;

-- Marcar invoices como 'pending' novamente (undo paid status)
-- UPDATE invoices 
-- SET status = 'pending', paid_date = NULL
-- WHERE EXTRACT(YEAR FROM paid_date) = 2025
--   AND EXTRACT(MONTH FROM paid_date) = 1;

-- Desvincularlicione
-- UPDATE invoices 
-- SET bank_transaction_id = NULL 
-- WHERE bank_transaction_id IS NOT NULL;
