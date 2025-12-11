-- ============================================================================
-- CORRIGIR CONTAS DUPLICADAS E CONSOLIDAR
-- ============================================================================

-- Problema: 4.1.3.02 e 4.1.3.04 são ambas "Tarifas Bancárias"
-- Solução: Mover tudo para 4.1.3.02 e renomear adequadamente

DO $$
DECLARE
  v_old_account_id UUID;
  v_new_account_id UUID;
  v_count INTEGER;
BEGIN
  -- Buscar as duas contas
  SELECT id INTO v_old_account_id FROM chart_of_accounts WHERE code = '4.1.3.04';
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.3.02';

  IF v_old_account_id IS NOT NULL AND v_new_account_id IS NOT NULL THEN
    -- Mover lançamentos de 4.1.3.04 para 4.1.3.02
    UPDATE accounting_entry_lines
    SET account_id = v_new_account_id
    WHERE account_id = v_old_account_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Movidos % lançamentos de 4.1.3.04 para 4.1.3.02', v_count;

    -- Desativar conta duplicada
    UPDATE chart_of_accounts
    SET is_active = false, name = 'DESATIVADA - Tarifas Bancárias (usar 4.1.3.02)'
    WHERE id = v_old_account_id;
  END IF;

  -- Renomear 4.1.3.02 para nome mais claro
  UPDATE chart_of_accounts
  SET name = 'Tarifas Bancárias'
  WHERE code = '4.1.3.02';
END $$;

-- Corrigir nomes das contas que estão confusos
UPDATE chart_of_accounts SET name = 'Telefone e Comunicação' WHERE code = '4.1.2.04';
UPDATE chart_of_accounts SET name = 'Internet' WHERE code = '4.1.2.05';

-- Verificar contas duplicadas por nome
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  RAISE NOTICE '=== VERIFICANDO DUPLICATAS ===';

  FOR v_rec IN
    SELECT name, COUNT(*) as qtd, STRING_AGG(code, ', ') as codigos
    FROM chart_of_accounts
    WHERE is_active = true AND code LIKE '4.%'
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'DUPLICATA: % (%) - códigos: %', v_rec.name, v_rec.qtd, v_rec.codigos;
  END LOOP;
END $$;

-- Corrigir contas com nomes duplicados
-- 4.1.2.09 era "Água" mas deveria ser "Copa e Cozinha"
UPDATE chart_of_accounts SET name = 'Copa e Cozinha' WHERE code = '4.1.2.09';

-- 4.1.2.10 era "Obras e Reformas" mas deveria ser "Condomínio Sede"
UPDATE chart_of_accounts SET name = 'Condomínio Sede' WHERE code = '4.1.2.10';

-- 4.1.4.02 era "Taxas e Licenças" mas deveria ser "ISS"
UPDATE chart_of_accounts SET name = 'ISS' WHERE code = '4.1.4.02';

-- Verificar DRE final
DO $$
DECLARE
  v_rec RECORD;
  v_total NUMERIC := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DRE CORRIGIDO ===';

  FOR v_rec IN
    SELECT coa.code, coa.name, COALESCE(SUM(ael.debit), 0) as total
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id AND ael.debit > 0
    WHERE coa.code LIKE '4.%'
      AND coa.is_analytical = true
      AND coa.is_active = true
    GROUP BY coa.code, coa.name
    HAVING COALESCE(SUM(ael.debit), 0) > 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% | % | R$ %', v_rec.code, RPAD(v_rec.name, 30), v_rec.total;
    v_total := v_total + v_rec.total;
  END LOOP;

  RAISE NOTICE '=== TOTAL: R$ % ===', v_total;
END $$;
