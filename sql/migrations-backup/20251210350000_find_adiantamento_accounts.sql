-- ============================================================================
-- LOCALIZAR: Em qual conta estão os lançamentos de adiantamento?
-- ============================================================================

-- Buscar as contas usadas nos lançamentos tipo adiantamento_socio
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  RAISE NOTICE '=== CONTAS USADAS EM LANÇAMENTOS adiantamento_socio ===';

  FOR v_rec IN
    SELECT
      coa.code,
      coa.name,
      coa.account_type,
      SUM(ael.debit) as total_debito,
      SUM(ael.credit) as total_credito,
      COUNT(*) as qtd_linhas
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE ae.entry_type = 'adiantamento_socio'
    GROUP BY coa.code, coa.name, coa.account_type
    ORDER BY SUM(ael.debit) DESC NULLS LAST
  LOOP
    RAISE NOTICE '% - % | Tipo: % | Débito: R$ % | Crédito: R$ % | Linhas: %',
      v_rec.code, v_rec.name, v_rec.account_type,
      COALESCE(v_rec.total_debito, 0), COALESCE(v_rec.total_credito, 0), v_rec.qtd_linhas;
  END LOOP;
END $$;

-- Listar detalhes de alguns lançamentos de adiantamento
DO $$
DECLARE
  v_entry RECORD;
  v_line RECORD;
BEGIN
  RAISE NOTICE '=== EXEMPLO DE LANÇAMENTO DE ADIANTAMENTO ===';

  FOR v_entry IN
    SELECT ae.id, ae.description, ae.total_debit
    FROM accounting_entries ae
    WHERE ae.entry_type = 'adiantamento_socio'
    LIMIT 3
  LOOP
    RAISE NOTICE 'Lançamento: % | R$ %', v_entry.description, v_entry.total_debit;

    FOR v_line IN
      SELECT coa.code, coa.name, ael.debit, ael.credit
      FROM accounting_entry_lines ael
      JOIN chart_of_accounts coa ON coa.id = ael.account_id
      WHERE ael.entry_id = v_entry.id
    LOOP
      RAISE NOTICE '  -> % % | D: R$ % | C: R$ %',
        v_line.code, v_line.name, COALESCE(v_line.debit, 0), COALESCE(v_line.credit, 0);
    END LOOP;
  END LOOP;
END $$;
