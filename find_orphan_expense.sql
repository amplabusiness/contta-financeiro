-- Script para encontrar e remover o lançamento órfão de Dep. Contábil

-- 1. Encontrar a conta 4.1.2.13.02
SELECT id, code, name FROM chart_of_accounts WHERE code = '4.1.2.13.02';

-- 2. Encontrar lançamentos nesta conta em 09/01/2025
SELECT 
  ael.id,
  ael.debit,
  ael.credit,
  ae.entry_date,
  ae.competence_date,
  ae.description,
  ael.account_id,
  ae.reference_type,
  ae.reference_id
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
WHERE ae.entry_date = '2025-01-09'
  AND ael.debit > 0
  AND ael.account_id IN (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13.02');

-- 3. Verificar se existe uma despesa vinculada (deve estar deletada)
SELECT * FROM expenses 
WHERE description LIKE '%Dep. Contábil%' 
  AND amount = 11338.04
  OR id IN (
    SELECT reference_id FROM accounting_entries 
    WHERE entry_date = '2025-01-09' 
      AND reference_type = 'expense'
  );

-- 4. Encontrar todos os lançamentos órfãos (sem despesa correspondente)
SELECT 
  ael.id as line_id,
  ae.id as entry_id,
  ae.entry_date,
  ae.description,
  ael.debit,
  ael.credit,
  ae.reference_type,
  ae.reference_id,
  (SELECT COUNT(*) FROM expenses e WHERE e.id = ae.reference_id) as expense_exists
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
WHERE ae.reference_type = 'expense'
  AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = ae.reference_id)
  AND ael.debit = 11338.04;

-- 5. Deletar o lançamento órfão (CUIDADO: Executar apenas se confirmado)
-- DELETE FROM accounting_entry_lines 
-- WHERE id IN (
--   SELECT ael.id FROM accounting_entry_lines ael
--   JOIN accounting_entries ae ON ael.entry_id = ae.id
--   WHERE ae.reference_type = 'expense'
--     AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = ae.reference_id)
--     AND ael.debit = 11338.04
-- );

-- 6. Deletar a entrada contábil órfã
-- DELETE FROM accounting_entries
-- WHERE reference_type = 'expense'
--   AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = reference_id)
--   AND entry_date = '2025-01-09';
