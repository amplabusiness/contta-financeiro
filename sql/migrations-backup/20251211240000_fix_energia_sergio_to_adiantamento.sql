-- Migration: Mover "Energia - Sergio" para Adiantamento a Sócios
-- Problema: Energia da casa do Sergio está em Despesa de Energia Elétrica (4.1.2.02)
-- Correção: Mover para Adiantamentos - Sergio Carneiro Leão (1.1.3.04.01)

DO $$
DECLARE
  conta_energia_id UUID;
  conta_adiantamento_sergio_id UUID;
  rows_updated INTEGER := 0;
BEGIN
  -- Buscar contas
  SELECT id INTO conta_energia_id FROM chart_of_accounts WHERE code = '4.1.2.02';
  SELECT id INTO conta_adiantamento_sergio_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';

  RAISE NOTICE 'Conta Energia (4.1.2.02): %', conta_energia_id;
  RAISE NOTICE 'Conta Adiantamento Sergio (1.1.3.04.01): %', conta_adiantamento_sergio_id;

  IF conta_adiantamento_sergio_id IS NULL THEN
    RAISE EXCEPTION 'Conta de adiantamento Sergio não encontrada!';
  END IF;

  -- Mover lançamentos de "Energia - Sergio" para Adiantamento
  UPDATE accounting_entry_lines ael
  SET account_id = conta_adiantamento_sergio_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
  AND ael.account_id = conta_energia_id
  AND ae.description ILIKE '%Energia - Sergio%';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Energia - Sergio: % linhas movidas para Adiantamento', rows_updated;

END $$;

-- Verificar resultado
SELECT
  ae.description,
  ael.debit,
  coa.code,
  coa.name
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE ae.description ILIKE '%Energia%'
AND ael.debit > 0;
