-- Buscar detalhes do lançamento específico
-- LIQ.COBRANCA SIMPLES-COB000005 de R$ 5.913,78 em 2025-01-03

-- 1. Encontrar a transação exata
SELECT 
  'Transação Exata' as info,
  id,
  transaction_date,
  description,
  amount,
  status,
  invoice_id,
  matched,
  created_at
FROM bank_transactions
WHERE amount = 5913.78
  AND description ILIKE '%LIQ.COBRANCA SIMPLES-COB000005%'
  AND transaction_date = '2025-01-03';

-- 2. Se encontrou, buscar a invoice vinculada
SELECT 
  'Invoice Vinculada' as info,
  i.id as invoice_id,
  i.client_id,
  c.name as cliente_name,
  c.id,
  i.amount,
  i.status,
  i.created_at,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.amount = 5913.78
  OR i.id IN (
    SELECT DISTINCT invoice_id 
    FROM bank_transactions 
    WHERE amount = 5913.78
      AND description ILIKE '%LIQ.COBRANCA%COB000005%'
  );

-- 3. Buscar todas as invoices de janeiro 2025 para ver padrão
SELECT 
  'Invoices Jan 2025' as info,
  i.id,
  c.name as cliente,
  i.amount,
  i.status,
  i.created_at,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE EXTRACT(YEAR FROM i.created_at) = 2025
  AND EXTRACT(MONTH FROM i.created_at) = 1
ORDER BY i.created_at DESC
LIMIT 20;

-- 4. Buscar lançamentos contábeis criados em 03/01/2025
SELECT 
  'Lançamentos Contábeis em 03/01' as info,
  ae.id,
  ae.description,
  ae.entry_date,
  ae.entry_type,
  ae.total_debit,
  ae.total_credit,
  ae.reference_id,
  ae.reference_type
FROM accounting_entries ae
WHERE ae.entry_date = '2025-01-03'
  AND ae.total_debit = 5913.78
  OR ae.total_credit = 5913.78;
