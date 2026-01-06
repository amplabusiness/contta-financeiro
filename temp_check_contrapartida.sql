-- Verificar estrutura de um lançamento de pagamento de despesa
-- para entender onde está a informação da conta de despesa
SELECT 
  ae.id,
  ae.entry_date,
  ae.description as entry_description,
  ae.entry_type,
  ae.reference_type,
  ael.id as line_id,
  ael.description as line_description,
  ael.debit,
  ael.credit,
  coa.code as account_code,
  coa.name as account_name
FROM accounting_entries ae
JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE ae.entry_type = 'pagamento_despesa'
ORDER BY ae.entry_date DESC, ae.id, ael.debit DESC
LIMIT 20;
