-- ============================================================================
-- INVESTIGAÇÃO: De onde vêm os R$ 154.606,93 em 4.1.2.99?
-- ============================================================================

-- Listar todos os lançamentos na conta 4.1.2.99
DO $$
DECLARE
  v_entry RECORD;
  v_despesa_account_id UUID;
  v_total NUMERIC := 0;
BEGIN
  SELECT id INTO v_despesa_account_id FROM chart_of_accounts WHERE code = '4.1.2.99';

  RAISE NOTICE '=== LANÇAMENTOS EM 4.1.2.99 (Outras Despesas) ===';

  FOR v_entry IN
    SELECT
      ae.entry_date,
      ae.description,
      ae.entry_type,
      ae.reference_type,
      ael.debit,
      ael.description as line_desc
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
    ORDER BY ael.debit DESC
    LIMIT 30
  LOOP
    RAISE NOTICE '% | % | R$ % | Tipo: % | Ref: %',
      v_entry.entry_date,
      LEFT(v_entry.description, 50),
      v_entry.debit,
      v_entry.entry_type,
      v_entry.reference_type;
    v_total := v_total + v_entry.debit;
  END LOOP;

  RAISE NOTICE '=== Total listado: R$ % ===', v_total;
END $$;

-- Verificar se há expenses com categoria adiantamento
DO $$
DECLARE
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total
  FROM expenses
  WHERE category ILIKE '%adiantamento%';

  RAISE NOTICE '=== EXPENSES COM ADIANTAMENTO ===';
  RAISE NOTICE 'Quantidade: %, Total: R$ %', v_count, v_total;
END $$;

-- Verificar as categorias únicas
DO $$
DECLARE
  v_cat RECORD;
BEGIN
  RAISE NOTICE '=== CATEGORIAS DE EXPENSES ===';
  FOR v_cat IN
    SELECT category, COUNT(*) as qtd, SUM(amount) as total
    FROM expenses
    GROUP BY category
    ORDER BY SUM(amount) DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '% | % registros | R$ %', v_cat.category, v_cat.qtd, v_cat.total;
  END LOOP;
END $$;
