-- Script para remover o lançamento órfão específico (Dep. Contábil - Ampla)
-- Data: 09/01/2025, Valor: R$ 11.338,04, Conta: 4.1.2.13.02

-- Step 1: Identificar o lançamento órfão
-- Encontrar a conta 4.1.2.13.02
WITH conta_alvo AS (
  SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13.02'
),
-- Encontrar entradas contábeis de 09/01/2025 nesta conta
entries_to_delete AS (
  SELECT DISTINCT ae.id as entry_id
  FROM accounting_entries ae
  JOIN accounting_entry_lines ael ON ae.id = ael.entry_id
  WHERE DATE(ae.entry_date) = '2025-01-09'
    AND ael.account_id IN (SELECT id FROM conta_alvo)
    AND ael.debit = 11338.04
    AND ae.reference_type = 'expense'
    AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = ae.reference_id)
)
-- Visualizar o que será deletado
SELECT 
  ae.id,
  ae.entry_date,
  ae.description,
  ae.reference_type,
  ae.reference_id,
  ael.debit,
  ael.credit,
  coa.code,
  coa.name
FROM accounting_entries ae
JOIN accounting_entry_lines ael ON ae.id = ael.entry_id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
JOIN entries_to_delete etd ON ae.id = etd.entry_id
ORDER BY ae.entry_date, ael.account_id;

-- Step 2: Deletar os lançamentos (executar separadamente após confirmar)
-- Com a query acima, copie os IDs das entradas e execute:
-- DELETE FROM accounting_entry_lines WHERE entry_id IN ('id1', 'id2', ...);
-- DELETE FROM accounting_entries WHERE id IN ('id1', 'id2', ...);
