-- ============================================================================
-- CLASSIFICAÇÃO FINAL - Restante de 4.1.2.99
-- ============================================================================

-- Criar contas adicionais que faltam
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  ('4.1.2.04', 'Telefone e Comunicação', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.05', 'Internet', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.06', 'Gás', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.3.04', 'Tarifas Bancárias', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.3')),
  ('4.1.1.01', 'Folha de Pagamento', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'))
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  v_entry RECORD;
  v_old_account_id UUID;
  v_new_account_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_old_account_id FROM chart_of_accounts WHERE code = '4.1.2.99';

  RAISE NOTICE '=== CLASSIFICAÇÃO FINAL ===';

  -- FOLHA DE PAGAMENTO (nomes de pessoas) -> 4.1.1.01
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.1.01';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (
          ae.description ILIKE '%DEUZA%'
          OR ae.description ILIKE '%FABRICIO%'
          OR ae.description ILIKE '%OLIVEIRA%'
          OR ae.description ILIKE '%Tharson%'
          OR ae.description ILIKE '%MIGUEL%'
          OR ae.description ILIKE '%LUIZ ALVES%'
          OR ae.description ILIKE '%Vonoria%'
        )
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Folha Pagamento: % -> 4.1.1.01 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- ENERGIA (despesa da empresa, não pessoal) -> 4.1.2.02
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.02';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Energia%'
        AND ae.description NOT ILIKE '%Sergio%'
        AND ae.description NOT ILIKE '%pessoal%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Energia: % -> 4.1.2.02 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- CAIXA ECONÔMICA (financiamento/empréstimo?) -> 4.1.3.02
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.3.02';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%CAIXA ECONOMICA%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Juros/Financiamento: % -> 4.1.3.02 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- INTERNET -> 4.1.2.05
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.05';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Internet%'
        AND ae.description NOT ILIKE '%Sergio%'
        AND ae.description NOT ILIKE '%pessoal%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Internet: % -> 4.1.2.05 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- TELEFONE -> 4.1.2.04
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.04';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (ae.description ILIKE '%Telefone%' OR ae.description ILIKE '%Celular%')
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Telefone: % -> 4.1.2.04 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- GÁS -> 4.1.2.06
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.06';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND ae.description ILIKE '%Gás%'
        AND ae.description NOT ILIKE '%Sergio%'
        AND ae.description NOT ILIKE '%pessoal%'
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Gás: % -> 4.1.2.06 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- TARIFAS BANCÁRIAS -> 4.1.3.04
  SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.3.04';
  IF v_new_account_id IS NOT NULL THEN
    FOR v_entry IN
      SELECT ael.id, ae.description, ael.debit
      FROM accounting_entry_lines ael
      JOIN accounting_entries ae ON ae.id = ael.entry_id
      WHERE ael.account_id = v_old_account_id AND ael.debit > 0
        AND (
          ae.description ILIKE '%Tarifa%'
          OR ae.description ILIKE '%manutenção conta%'
          OR ae.description ILIKE '%manutenção de título%'
        )
    LOOP
      UPDATE accounting_entry_lines SET account_id = v_new_account_id WHERE id = v_entry.id;
      v_count := v_count + 1;
      RAISE NOTICE 'Tarifa Bancária: % -> 4.1.3.04 | R$ %', LEFT(v_entry.description, 40), v_entry.debit;
    END LOOP;
  END IF;

  -- PIX (provavelmente pagamento diversos) - manter em outros
  -- Outros - manter em outros

  RAISE NOTICE '=== TOTAL MOVIDO: % lançamentos ===', v_count;
END $$;

-- DRE FINAL
DO $$
DECLARE
  v_rec RECORD;
  v_total_despesas NUMERIC := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║            DRE - DESPESAS POR CONTA (FINAL)                  ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════════════════╣';

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
    RAISE NOTICE '║ % - % | R$ %',
      RPAD(v_rec.code, 10),
      RPAD(v_rec.name, 30),
      v_rec.total;
    v_total_despesas := v_total_despesas + v_rec.total;
  END LOOP;

  RAISE NOTICE '╠══════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║ TOTAL DESPESAS: R$ %', v_total_despesas;
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
END $$;

-- O que sobrou em 4.1.2.99
DO $$
DECLARE
  v_total NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(ael.debit), 0)
  INTO v_count, v_total
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '4.1.2.99' AND ael.debit > 0;

  RAISE NOTICE '';
  RAISE NOTICE 'Restante em 4.1.2.99: % lançamentos = R$ %', v_count, v_total;
END $$;
