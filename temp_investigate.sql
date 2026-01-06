-- Investigar estrutura dos lançamentos na conta 1.1.2.01 (Clientes a Receber)

-- 1. Ver a conta 1.1.2.01
SELECT id, code, name FROM chart_of_accounts WHERE code = '1.1.2.01';

-- 2. Ver lançamentos na conta com invoice_id
SELECT
  ael.id,
  ael.debit,
  ael.credit,
  ael.description,
  ae.entry_date,
  ae.invoice_id,
  ae.description as entry_description,
  ae.entry_type
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.2.01'
LIMIT 20;

-- 3. Quantos lançamentos TEM invoice_id vs NÃO TEM
SELECT
  CASE WHEN ae.invoice_id IS NOT NULL THEN 'COM invoice_id' ELSE 'SEM invoice_id' END as tipo,
  COUNT(*) as qtd,
  SUM(ael.debit) as total_debit,
  SUM(ael.credit) as total_credit
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.2.01'
GROUP BY CASE WHEN ae.invoice_id IS NOT NULL THEN 'COM invoice_id' ELSE 'SEM invoice_id' END;

-- 4. Ver lançamentos SEM invoice_id para entender como identificar o cliente
SELECT
  ael.description,
  ae.description as entry_description,
  ae.entry_type,
  ae.reference_type,
  ae.reference_id,
  ael.debit,
  ael.credit
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.2.01'
  AND ae.invoice_id IS NULL
LIMIT 20;
