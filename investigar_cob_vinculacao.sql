-- Investigar por que COB000005 não está vinculada a cliente
-- Baseado em MAPEAMENTO_BANCO_DADOS.md

-- 1. Verificar se existe padrão entre COB e invoices
SELECT 
  'Invoices com COB' as tipo,
  i.id,
  i.client_id,
  c.name as cliente_name,
  i.amount,
  i.status,
  SUBSTRING(i.document_number FROM 1 10) as codigo_cobranca
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.document_number ILIKE '%COB%'
  OR i.document_number ILIKE '%COB000005%'
LIMIT 20;

-- 2. Buscar todas as transações com padrão COB no mês
SELECT 
  bt.transaction_date,
  SUBSTRING(bt.description FROM POSITION('COB' IN bt.description) FOR 12) as codigo_cobranca_extraido,
  COUNT(*) as qtd_operacoes,
  SUM(bt.amount) as total_movimento
FROM bank_transactions bt
WHERE bt.description ILIKE '%COB%'
  AND EXTRACT(YEAR FROM bt.transaction_date) = 2025
  AND EXTRACT(MONTH FROM bt.transaction_date) = 1
GROUP BY SUBSTRING(bt.description FROM POSITION('COB' IN bt.description) FOR 12), bt.transaction_date
ORDER BY codigo_cobranca_extraido, bt.transaction_date;

-- 3. Verificar invoices em janeiro 2025 
SELECT 
  'Invoices Jan 2025' as tipo,
  id,
  client_id,
  c.name,
  amount,
  document_number,
  status
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE EXTRACT(YEAR FROM i.created_at) = 2025
  AND EXTRACT(MONTH FROM i.created_at) = 1
LIMIT 20;

-- 4. Ver se há invoice_id preenchido em bank_transactions com COB
SELECT 
  'Bank Transactions com invoice_id' as tipo,
  bt.id,
  bt.transaction_date,
  bt.description,
  bt.invoice_id,
  bt.amount,
  CASE WHEN bt.invoice_id IS NOT NULL THEN 'TEM INVOICE' ELSE 'SEM INVOICE' END as vinculacao
FROM bank_transactions bt
WHERE bt.description ILIKE '%COB%'
  AND EXTRACT(YEAR FROM bt.transaction_date) = 2025
  AND EXTRACT(MONTH FROM bt.transaction_date) = 1
LIMIT 20;
