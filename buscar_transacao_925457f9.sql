-- Buscar detalhes completos usando o reference_id do lançamento contábil
-- reference_id: 925457f9-3426-43fb-bef4-240fd9014099

-- 1. Transação bancária completa
SELECT 
  'Transação Bancária' as tipo,
  id,
  transaction_date,
  description,
  amount,
  status,
  invoice_id,
  matched,
  category,
  ai_suggestion
FROM bank_transactions
WHERE id = '925457f9-3426-43fb-bef4-240fd9014099';

-- 2. Invoice vinculada (se houver invoice_id)
SELECT 
  'Invoice Vinculada' as tipo,
  i.id as invoice_id,
  i.client_id,
  c.name as cliente_name,
  i.amount as valor_invoice,
  i.status,
  i.created_at,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.id IN (
  SELECT invoice_id 
  FROM bank_transactions 
  WHERE id = '925457f9-3426-43fb-bef4-240fd9014099'
    AND invoice_id IS NOT NULL
);

-- 3. Se não houver invoice, buscar por padrão de description
SELECT 
  'Busca por Padrão' as tipo,
  i.id as invoice_id,
  c.name as cliente_name,
  i.amount,
  i.status
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.amount = 5913.78
  AND EXTRACT(YEAR FROM i.created_at) = 2025
  AND EXTRACT(MONTH FROM i.created_at) = 1;

-- 4. Ver accounting_entry_lines para saber em qual conta foi lançado
SELECT 
  'Linhas do Lançamento' as tipo,
  ael.id,
  ael.entry_id,
  ael.account_id,
  coa.code,
  coa.name as conta_nome,
  coa.account_type,
  ael.debit,
  ael.credit,
  ael.description
FROM accounting_entry_lines ael
LEFT JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE ael.entry_id = (
  SELECT id FROM accounting_entries 
  WHERE reference_id = '925457f9-3426-43fb-bef4-240fd9014099'
  LIMIT 1
);
