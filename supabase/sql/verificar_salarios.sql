-- ============================================================================
-- VERIFICAR CONTA SALÁRIOS E ORDENADOS (4.1.1.01)
-- ============================================================================

-- 1. Ver se a conta existe
SELECT id, code, name, account_type, is_analytical 
FROM chart_of_accounts 
WHERE code LIKE '4.1.1%';

-- 2. Ver lançamentos na conta de salários
SELECT 
  ae.entry_date,
  ae.description,
  ael.debit,
  ael.credit
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ae.id = ael.entry_id
WHERE ael.account_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')
ORDER BY ae.entry_date DESC
LIMIT 20;

-- 3. Ver se há despesas com categoria salarios
SELECT 
  id,
  supplier_name,
  description,
  amount,
  category,
  expense_date,
  status
FROM expenses
WHERE category ILIKE '%salario%' 
   OR category ILIKE '%folha%'
   OR description ILIKE '%salario%'
   OR description ILIKE '%folha%'
ORDER BY expense_date DESC
LIMIT 20;

-- 4. Ver totais da folha por mês
SELECT 
  DATE_TRUNC('month', ae.entry_date) as mes,
  SUM(ael.debit) as total_debito,
  SUM(ael.credit) as total_credito
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ae.id = ael.entry_id
WHERE ael.account_id IN (
  SELECT id FROM chart_of_accounts WHERE code LIKE '4.1.1%'
)
GROUP BY DATE_TRUNC('month', ae.entry_date)
ORDER BY mes DESC;
