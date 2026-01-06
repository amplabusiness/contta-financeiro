-- Verificar quais contas de despesas existem e quantos lançamentos cada uma tem
SELECT 
  coa.code,
  coa.name,
  COUNT(ael.id) as qtd_lancamentos,
  SUM(ael.debit) as total_debitos
FROM chart_of_accounts coa
LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id AND ael.debit > 0
LEFT JOIN accounting_entries ae ON ael.entry_id = ae.id 
  AND ae.entry_date >= '2025-01-01' 
  AND ae.entry_date <= '2025-01-31'
WHERE coa.code LIKE '4.%'
  AND coa.is_analytical = true
GROUP BY coa.id, coa.code, coa.name
ORDER BY coa.code;
