-- ============================================================================
-- MOVER LANÇAMENTOS RESTANTES DE 4.1.2.99 PARA CONTAS ESPECÍFICAS
-- ============================================================================
-- Agora que as contas específicas existem, mover os lançamentos restantes
-- ============================================================================

DO $$
DECLARE
  v_entry RECORD;
  v_old_account_id UUID;
  v_new_account_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Buscar conta genérica
  SELECT id INTO v_old_account_id FROM chart_of_accounts WHERE code = '4.1.2.99';

  IF v_old_account_id IS NULL THEN
    RAISE NOTICE 'Conta 4.1.2.99 não encontrada';
    RETURN;
  END IF;

  RAISE NOTICE '=== MOVENDO LANÇAMENTOS RESTANTES DE 4.1.2.99 ===';

  -- OUTSIDER CONSTRUTORA / OBRAS AMPLA -> 4.1.2.11 Obras e Reformas Sede
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.11';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%Outsider%' OR ae.description ILIKE '%Obras Ampla%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Obras/Reformas: % -> 4.1.2.11 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- DEP. PESSOAL, CONTÁBIL, FISCAL, etc -> 4.1.2.13 Serviços Terceirizados
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (
          ae.description ILIKE '%Dep. Pessoal%'
          OR ae.description ILIKE '%Dep. Contábil%'
          OR ae.description ILIKE '%Dep. Fiscal%'
          OR ae.description ILIKE '%Dep. Financeiro%'
          OR ae.description ILIKE '%Dep. Legalização%'
          OR ae.description ILIKE '%Dep. Limpeza%'
          OR ae.description ILIKE '%Dep. Psicologia%'
          OR ae.description ILIKE '%ANDREIA%'
          OR ae.description ILIKE '%ANDREA%'
        )
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Serviços Terceirizados: % -> 4.1.2.13 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- SISTEMAS/SOFTWARE -> 4.1.2.12 Software e Sistemas
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.12';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%Sistema%' OR ae.description ILIKE '%Software%' OR ae.description ILIKE '%Aplicativo%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Software: % -> 4.1.2.12 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- RESCISÃO -> 4.1.1.05 Rescisões Trabalhistas
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.1.05';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Rescisão%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Rescisão: % -> 4.1.1.05 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- CONDOMÍNIO GALERIA NACIONAL (sede) -> 4.1.2.10 Condomínio Sede
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.10';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Condomínio Galeria%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Condomínio Sede: % -> 4.1.2.10 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- SIMPLES NACIONAL -> 4.1.4.01
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.01';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Simples Nacional%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Simples Nacional: % -> 4.1.4.01 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- ISS -> 4.1.4.02
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.02';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%ISS%' AND ae.description NOT ILIKE '%comiss%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'ISS: % -> 4.1.4.02 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- IPTU -> 4.1.4.03
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.03';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%IPTU%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'IPTU: % -> 4.1.4.03 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- ANUIDADE CRC -> 4.1.4.04
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.04';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%CRC%' OR ae.description ILIKE '%Anuidade%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Taxas/CRC: % -> 4.1.4.04 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- FGTS/INSS -> 4.1.1.02 Encargos Sociais
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.1.02';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%FGTS%' OR ae.description ILIKE '%INSS%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Encargos: % -> 4.1.1.02 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- COMISSÃO -> 4.1.1.06
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.1.06';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Comissão%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Comissão: % -> 4.1.1.06 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- ÁGUA MINERAL -> 4.1.2.07
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.07';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Água Mineral%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Água: % -> 4.1.2.07 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- MATERIAL DE LIMPEZA -> 4.1.2.08
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.08';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Material de Limpeza%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Limpeza: % -> 4.1.2.08 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- CAFÉ, PÃO DE QUEIJO -> 4.1.2.09 Copa e Cozinha
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.09';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%Café%' OR ae.description ILIKE '%Pao de queijo%' OR ae.description ILIKE '%chá%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Copa: % -> 4.1.2.09 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- VALE ALIMENTAÇÃO/TRANSPORTE -> 4.1.1.03
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.1.03';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%Vale Alimentação%' OR ae.description ILIKE '%Vale Transporte%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Vale: % -> 4.1.1.03 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- PAPELARIA -> 4.1.2.14
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.14';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Papelaria%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Papelaria: % -> 4.1.2.14 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  RAISE NOTICE '=== TOTAL MOVIDO: % lançamentos ===', v_count;
END $$;

-- Estatísticas finais detalhadas
DO $$
DECLARE
  v_rec RECORD;
  v_total_despesas NUMERIC := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DRE - DESPESAS POR CONTA ===';

  FOR v_rec IN
    SELECT coa.code, coa.name, COALESCE(SUM(ael.debit), 0) as total
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id AND ael.debit > 0
    WHERE coa.code LIKE '4.%'
      AND coa.is_analytical = true
    GROUP BY coa.code, coa.name
    HAVING COALESCE(SUM(ael.debit), 0) > 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% - % | R$ %', v_rec.code, v_rec.name, v_rec.total;
    v_total_despesas := v_total_despesas + v_rec.total;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== TOTAL DESPESAS: R$ % ===', v_total_despesas;
END $$;

-- Verificar o que ainda está em 4.1.2.99
DO $$
DECLARE
  v_entry RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== LANÇAMENTOS AINDA EM 4.1.2.99 (para classificação manual) ===';

  FOR v_entry IN
    SELECT ae.description, ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE coa.code = '4.1.2.99' AND ael.debit > 0
    ORDER BY ael.debit DESC
    LIMIT 30
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '%: % | R$ %', v_count, LEFT(v_entry.description, 50), v_entry.debit;
  END LOOP;
END $$;
