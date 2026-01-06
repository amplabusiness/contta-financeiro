-- Descobrir qual cliente foi quitado em 03/01/2025
-- Lançamento: D: Banco Sicredi | C: Clientes a Receber 5913.78

-- 1. Buscar invoices que somam exatamente 5913.78 e venciam antes de 03/01
SELECT 
  'Invoices a Receber' as tipo,
  i.id,
  c.id as client_id,
  c.name as cliente_name,
  i.amount,
  i.status,
  i.created_at,
  i.due_date,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.status = 'paid'
  AND i.paid_date = '2025-01-03'
  AND i.amount = 5913.78;

-- 2. Se não encontrar uma invoice exata, buscar múltiplas invoices
SELECT 
  'Invoices Quitadas em 03/01' as tipo,
  i.id,
  c.name as cliente_name,
  i.amount,
  i.status,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.status = 'paid'
  AND DATE(i.paid_date) = '2025-01-03'
ORDER BY i.amount DESC
LIMIT 20;

-- 3. Ver saldo de clientes a receber antes e depois da transação
-- Para ver qual cliente teve redução de 5913.78
SELECT 
  'Clientes com Movimentação em 03/01' as tipo,
  c.id,
  c.name as cliente_name,
  SUM(CASE WHEN i.paid_date IS NULL THEN i.amount ELSE 0 END) as saldo_pendente,
  COUNT(i.id) as qtd_invoices_pendentes,
  SUM(CASE WHEN DATE(i.paid_date) = '2025-01-03' THEN i.amount ELSE 0 END) as quitado_em_03_01
FROM clients c
LEFT JOIN invoices i ON c.id = i.client_id
WHERE EXTRACT(YEAR FROM i.created_at) = 2025
  AND EXTRACT(MONTH FROM i.created_at) IN (12, 1)
GROUP BY c.id, c.name
HAVING SUM(CASE WHEN DATE(i.paid_date) = '2025-01-03' THEN i.amount ELSE 0 END) > 0
ORDER BY quitado_em_03_01 DESC;

-- 4. Ver a invoice exata com outro filtro
SELECT 
  'Busca Ampla de Invoices' as tipo,
  i.id,
  c.name as cliente_name,
  i.amount,
  i.status,
  i.due_date,
  i.paid_date,
  EXTRACT(DAY FROM i.paid_date) as dia_pagamento
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE EXTRACT(YEAR FROM i.created_at) = 2024
  AND EXTRACT(MONTH FROM i.created_at) = 12
  AND i.status = 'paid'
  AND i.paid_date >= '2025-01-01'
  AND i.paid_date <= '2025-01-05'
ORDER BY i.paid_date DESC, i.amount DESC
LIMIT 20;
