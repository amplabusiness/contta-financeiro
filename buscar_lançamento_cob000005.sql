-- Buscar detalhes do lançamento COB000005
-- Encontrar qual cliente foi baixado nessa cobrança
-- Baseado em MAPEAMENTO_BANCO_DADOS.md

-- 1. Procurar a transação bancária específica
SELECT 
  'Transação Bancária' as tipo,
  id,
  transaction_date,
  description,
  amount,
  status,
  invoice_id,
  document_number
FROM bank_transactions
WHERE description ILIKE '%COB000005%'
  AND transaction_date >= '2025-01-01'
  AND transaction_date <= '2025-01-31'
ORDER BY transaction_date DESC
LIMIT 10;

-- 2. Se houver invoice_id, buscar a invoice (NFS-e / Recebimento) e cliente
SELECT 
  'Fatura/Invoice - Cliente' as tipo,
  i.id as invoice_id,
  i.client_id,
  c.name as cliente_name,
  i.amount as valor_invoice,
  i.status,
  i.paid_date
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.id IN (
  SELECT DISTINCT invoice_id 
  FROM bank_transactions 
  WHERE description ILIKE '%COB000005%'
    AND invoice_id IS NOT NULL
);

-- 3. Buscar accounting entries relacionadas ao lançamento
SELECT 
  'Lançamentos Contábeis' as tipo,
  ae.id,
  ae.description,
  ae.entry_date,
  ae.entry_type,
  ae.total_debit,
  ae.total_credit
FROM accounting_entries ae
WHERE ae.reference_type = 'bank_transaction'
  AND ae.reference_id IN (
    SELECT id 
    FROM bank_transactions 
    WHERE description ILIKE '%COB000005%'
  );

-- 4. Resumo completo: Transação + Cliente + Lançamento
SELECT 
  bt.transaction_date,
  bt.description as descricao_transacao,
  bt.amount,
  bt.status as status_transacao,
  CASE 
    WHEN bt.invoice_id IS NOT NULL THEN 'Recebimento de Cliente'
    ELSE 'Outra Operação'
  END as tipo_operacao,
  c.name as cliente_relacionado,
  i.amount as valor_invoice,
  ae.entry_type as tipo_lancamento,
  ae.entry_date as data_lancamento
FROM bank_transactions bt
LEFT JOIN invoices i ON bt.invoice_id = i.id
LEFT JOIN clients c ON i.client_id = c.id
LEFT JOIN accounting_entries ae ON ae.reference_type = 'bank_transaction' AND ae.reference_id = bt.id
WHERE bt.description ILIKE '%COB000005%'
  AND bt.transaction_date >= '2025-01-01'
ORDER BY bt.transaction_date DESC;
