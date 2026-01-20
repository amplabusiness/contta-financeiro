-- ============================================================================
-- INVESTIGAR: Quem compõe o valor de Dep. Pessoal R$ 12.968,01?
-- ============================================================================

-- Ver o que tem na descrição dos lançamentos
DO $$
DECLARE
  v_entry RECORD;
  v_account_id UUID;
BEGIN
  SELECT id INTO v_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.01';

  RAISE NOTICE '=== LANÇAMENTOS EM DEP. PESSOAL (4.1.2.13.01) ===';

  FOR v_entry IN
    SELECT ae.description, ae.entry_date, ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_account_id AND ael.debit > 0
    ORDER BY ael.debit DESC
  LOOP
    RAISE NOTICE '% | % | R$ %', v_entry.entry_date, v_entry.description, v_entry.debit;
  END LOOP;
END $$;

-- Ver as expenses originais que geraram esses lançamentos
DO $$
DECLARE
  v_exp RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== EXPENSES COM CATEGORIA DEP. PESSOAL ===';

  FOR v_exp IN
    SELECT id, description, category, amount, due_date
    FROM expenses
    WHERE category ILIKE '%Dep. Pessoal%'
       OR description ILIKE '%Dep. Pessoal%'
    ORDER BY amount DESC
  LOOP
    RAISE NOTICE '% | % | R$ %', v_exp.due_date, v_exp.description, v_exp.amount;
  END LOOP;
END $$;

-- Verificar se existem expenses separadas por pessoa no Dep. Pessoal
DO $$
DECLARE
  v_exp RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TODAS AS CATEGORIAS COM "PESSOAL" ===';

  FOR v_exp IN
    SELECT category, COUNT(*) as qtd, SUM(amount) as total
    FROM expenses
    WHERE category ILIKE '%pessoal%'
    GROUP BY category
    ORDER BY SUM(amount) DESC
  LOOP
    RAISE NOTICE '% | % registros | R$ %', v_exp.category, v_exp.qtd, v_exp.total;
  END LOOP;
END $$;
