-- Verificar invoices com amount 5913.78
SELECT 
  id, 
  client_id, 
  amount, 
  status, 
  paid_date,
  created_at
FROM invoices 
WHERE amount = 5913.78
LIMIT 20;

-- Verificar qual é a soma de invoices com status paid até 2025-01-03
SELECT 
  SUM(amount) as total,
  COUNT(*) as total_invoices,
  MIN(paid_date) as first_paid,
  MAX(paid_date) as last_paid
FROM invoices 
WHERE status = 'paid' 
  AND paid_date IS NOT NULL
  AND paid_date <= '2025-01-03'::date;

-- Buscar invoices próximas a 5913.78
SELECT 
  id,
  client_id, 
  amount, 
  status, 
  paid_date
FROM invoices 
WHERE status = 'paid'
  AND amount BETWEEN 5900 AND 5920
ORDER BY amount DESC;

-- Ver transações bancárias COB000005
SELECT 
  id,
  description,
  amount,
  transaction_date
FROM bank_transactions 
WHERE description ILIKE '%COB000005%'
  AND amount = 5913.78;
