-- Diagnóstico completo: descobrir como as invoices estão vinculadas
-- Baseado em MAPEAMENTO_BANCO_DADOS.md

-- 1. Ver TODAS as invoices em janeiro/2025
SELECT 
  'Todas Invoices Jan 2025' as diagnostico,
  COUNT(*) as total_invoices,
  SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as status_paid,
  SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) as status_pending,
  SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as status_overdue,
  SUM(i.amount) as total_amount
FROM invoices i
WHERE EXTRACT(YEAR FROM i.created_at) = 2025
  AND EXTRACT(MONTH FROM i.created_at) = 1;

-- 2. Ver estrutura de uma invoice de exemplo
SELECT 
  'Exemplo Invoice' as diagnostico,
  i.id,
  c.name as cliente_name,
  i.amount,
  i.status,
  i.created_at,
  i.due_date,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE EXTRACT(YEAR FROM i.created_at) = 2025
LIMIT 3;

-- 3. Ver se há invoices com paid_date IS NULL (não foi marcada como paga)
SELECT 
  'Invoices Sem Data de Pagamento' as diagnostico,
  i.id,
  c.name as cliente_name,
  i.amount,
  i.status,
  i.due_date,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.paid_date IS NULL
  AND EXTRACT(YEAR FROM i.created_at) = 2024
  AND EXTRACT(MONTH FROM i.created_at) = 12
LIMIT 10;

-- 4. Ver banco_transactions que NÃO tem invoice_id preenchido
SELECT 
  'Bank Transactions sem Invoice' as diagnostico,
  COUNT(*) as total_transacoes,
  SUM(amount) as total_recebimentos
FROM bank_transactions
WHERE invoice_id IS NULL
  AND amount > 0
  AND EXTRACT(YEAR FROM transaction_date) = 2025
  AND EXTRACT(MONTH FROM transaction_date) = 1;

-- 5. Ver status das invoices em jan/2025
SELECT 
  'Status Invoices Jan 2025' as diagnostico,
  i.id,
  c.name as cliente_name,
  i.amount,
  i.status,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE EXTRACT(YEAR FROM i.created_at) = 2025
  AND EXTRACT(MONTH FROM i.created_at) = 1
LIMIT 10;

-- 6. Verificar total de invoices vs total de recebimentos em janeiro
SELECT 
  'Reconciliação Jan 2025' as diagnostico,
  SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END) as total_invoices_pagas,
  (SELECT SUM(amount) FROM bank_transactions 
   WHERE amount > 0 
     AND EXTRACT(YEAR FROM transaction_date) = 2025
     AND EXTRACT(MONTH FROM transaction_date) = 1) as total_banco_recebido,
  SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END) - 
  (SELECT SUM(amount) FROM bank_transactions 
   WHERE amount > 0 
     AND EXTRACT(YEAR FROM transaction_date) = 2025
     AND EXTRACT(MONTH FROM transaction_date) = 1) as diferenca
FROM invoices i
WHERE EXTRACT(YEAR FROM i.created_at) = 2025
  AND EXTRACT(MONTH FROM i.created_at) = 1;
