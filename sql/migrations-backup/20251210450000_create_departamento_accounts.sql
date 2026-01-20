-- ============================================================================
-- CRIAR CONTAS POR DEPARTAMENTO E PRESTADOR
-- ============================================================================
-- Desmembrar "Serviços Terceirizados" (4.1.2.13) em contas específicas
-- para saber quanto custa cada departamento
-- ============================================================================

-- Criar grupo sintético para Serviços Terceirizados
UPDATE chart_of_accounts
SET is_analytical = false, is_synthetic = true
WHERE code = '4.1.2.13';

-- Criar contas analíticas por departamento
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  -- Departamentos
  ('4.1.2.13.01', 'Dep. Pessoal (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.02', 'Dep. Contábil (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.03', 'Dep. Fiscal (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.04', 'Dep. Financeiro (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.05', 'Dep. Legalização (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.06', 'Dep. Limpeza (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.07', 'Dep. Psicologia (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  -- Prestadores específicos
  ('4.1.2.13.08', 'Andrea Ferreira (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.09', 'Andrea Leone (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.10', 'Andreia (Terceirizado)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13')),
  ('4.1.2.13.99', 'Outros Terceirizados', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.13'))
ON CONFLICT (code) DO NOTHING;

-- Mover lançamentos de 4.1.2.13 para as contas específicas
DO $$
DECLARE
  v_entry RECORD;
  v_old_account_id UUID;
  v_new_account_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Buscar conta genérica de serviços terceirizados
  SELECT id INTO v_old_account_id FROM chart_of_accounts WHERE code = '4.1.2.13';

  RAISE NOTICE '=== SEPARANDO SERVIÇOS TERCEIRIZADOS POR DEPARTAMENTO ===';

  -- DEP. PESSOAL -> 4.1.2.13.01
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.01';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Dep. Pessoal%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Dep. Pessoal: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- DEP. CONTÁBIL -> 4.1.2.13.02
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.02';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Dep. Contábil%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Dep. Contábil: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- DEP. FISCAL -> 4.1.2.13.03
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.03';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Dep. Fiscal%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Dep. Fiscal: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- DEP. FINANCEIRO -> 4.1.2.13.04
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.04';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Dep. Financeiro%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Dep. Financeiro: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- DEP. LEGALIZAÇÃO -> 4.1.2.13.05
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.05';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Dep. Legalização%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Dep. Legalização: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- DEP. LIMPEZA -> 4.1.2.13.06
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.06';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Dep. Limpeza%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Dep. Limpeza: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- DEP. PSICOLOGIA -> 4.1.2.13.07
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.07';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Dep. Psicologia%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Dep. Psicologia: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- ANDREA FERREIRA -> 4.1.2.13.08
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.08';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%ANDREA FERREIRA%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Andrea Ferreira: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- ANDREA LEONE -> 4.1.2.13.09
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.09';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%ANDREA LEONE%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Andrea Leone: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- ANDREIA -> 4.1.2.13.10
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.10';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%ANDREIA%'
        AND ae.description NOT ILIKE '%ANDREA%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Andreia: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- Resto vai para OUTROS -> 4.1.2.13.99
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.99';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Outros: % | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== TOTAL SEPARADO: % lançamentos ===', v_count;
END $$;

-- Mostrar resultado por departamento
DO $$
DECLARE
  v_rec RECORD;
  v_total NUMERIC := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== SERVIÇOS TERCEIRIZADOS POR DEPARTAMENTO ===';

  FOR v_rec IN
    SELECT coa.code, coa.name, COALESCE(SUM(ael.debit), 0) as total
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id AND ael.debit > 0
    WHERE coa.code LIKE '4.1.2.13.%'
      AND coa.is_analytical = true
    GROUP BY coa.code, coa.name
    HAVING COALESCE(SUM(ael.debit), 0) > 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% | % | R$ %', v_rec.code, RPAD(v_rec.name, 30), v_rec.total;
    v_total := v_total + v_rec.total;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== TOTAL TERCEIRIZADOS: R$ % ===', v_total;
END $$;
