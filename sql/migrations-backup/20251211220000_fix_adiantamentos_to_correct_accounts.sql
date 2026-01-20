-- Migration: Corrigir lançamentos de adiantamentos da família Leão
-- Problema: Lançamentos de despesas pessoais estão em 4.1.2.99 (Despesas Administrativas)
-- Correção: Mover para contas de Adiantamento a Sócios (1.1.3.04.xx)

-- Total a corrigir: R$ 233.873,02 em 27 lançamentos

-- Primeiro, identificar os IDs das contas de destino
DO $$
DECLARE
  conta_sergio_id UUID;
  conta_victor_id UUID;
  conta_nayara_id UUID;
  conta_sergio_augusto_id UUID;
  conta_outros_id UUID;
  conta_origem_id UUID;
  rows_updated INTEGER := 0;
BEGIN
  -- Buscar conta de origem (4.1.2.99)
  SELECT id INTO conta_origem_id FROM chart_of_accounts WHERE code = '4.1.2.99';

  -- Buscar contas de destino
  SELECT id INTO conta_sergio_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';
  SELECT id INTO conta_victor_id FROM chart_of_accounts WHERE code = '1.1.3.04.03';
  SELECT id INTO conta_nayara_id FROM chart_of_accounts WHERE code = '1.1.3.04.04';
  SELECT id INTO conta_sergio_augusto_id FROM chart_of_accounts WHERE code = '1.1.3.04.05';
  SELECT id INTO conta_outros_id FROM chart_of_accounts WHERE code = '1.1.3.04.02';

  RAISE NOTICE 'Conta origem (4.1.2.99): %', conta_origem_id;
  RAISE NOTICE 'Sergio (1.1.3.04.01): %', conta_sergio_id;
  RAISE NOTICE 'Victor (1.1.3.04.03): %', conta_victor_id;
  RAISE NOTICE 'Nayara (1.1.3.04.04): %', conta_nayara_id;
  RAISE NOTICE 'Sérgio Augusto (1.1.3.04.05): %', conta_sergio_augusto_id;

  IF conta_sergio_id IS NULL THEN
    RAISE EXCEPTION 'Conta de Sergio não encontrada!';
  END IF;

  -- 1. Corrigir lançamentos do Sérgio Augusto
  UPDATE accounting_entry_lines ael
  SET account_id = conta_sergio_augusto_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
  AND ael.account_id = conta_origem_id
  AND (
    ae.description ILIKE '%Sérgio Augusto%'
    OR ae.description ILIKE '%Sergio Augusto%'
  );
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Sérgio Augusto: % linhas atualizadas', rows_updated;

  -- 2. Corrigir lançamentos do Victor Hugo
  UPDATE accounting_entry_lines ael
  SET account_id = conta_victor_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
  AND ael.account_id = conta_origem_id
  AND (
    ae.description ILIKE '%Victor%'
    OR ae.description ILIKE '%BMW%Victor%'
  );
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Victor Hugo: % linhas atualizadas', rows_updated;

  -- 3. Corrigir lançamentos da Nayara (incluindo Babá)
  UPDATE accounting_entry_lines ael
  SET account_id = conta_nayara_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
  AND ael.account_id = conta_origem_id
  AND (
    ae.description ILIKE '%Nayara%'
    OR ae.description ILIKE '%Babá%'
    OR ae.description ILIKE '%Baba%'
  );
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Nayara: % linhas atualizadas', rows_updated;

  -- 4. Corrigir lançamentos do Sérgio Carneiro (tudo que tiver "Sergio" mas não "Augusto")
  UPDATE accounting_entry_lines ael
  SET account_id = conta_sergio_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
  AND ael.account_id = conta_origem_id
  AND (
    (ae.description ILIKE '%Sergio%' AND ae.description NOT ILIKE '%Augusto%')
    OR ae.description ILIKE '%Condomínio%'
    OR ae.description ILIKE '%Condominio%'
    OR ae.description ILIKE '%IPVA%' AND ae.description NOT ILIKE '%Victor%'
    OR ae.description ILIKE '%Obras%'
    OR ae.description ILIKE '%Personal%'
    OR ae.description ILIKE '%Plano de Saúde%'
  );
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Sergio Carneiro: % linhas atualizadas', rows_updated;

  -- 5. Mover o item "Empréstimos - Scala" para Outros Sócios
  UPDATE accounting_entry_lines ael
  SET account_id = conta_outros_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
  AND ael.account_id = conta_origem_id
  AND ae.description ILIKE '%Scala%';
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Empréstimos Scala: % linhas atualizadas', rows_updated;

END $$;

-- Verificar o que restou em 4.1.2.99
SELECT
  ae.description,
  ael.debit,
  ael.credit
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '4.1.2.99'
ORDER BY ael.debit DESC;
