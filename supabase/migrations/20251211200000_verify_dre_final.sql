-- =====================================================
-- VERIFICAÇÃO FINAL DA DRE APÓS CORREÇÕES
-- =====================================================

DO $$
DECLARE
  v_total_receitas NUMERIC;
  v_total_despesas NUMERIC;
  v_resultado NUMERIC;
BEGIN
  -- Receitas: crédito - débito
  SELECT COALESCE(SUM(ael.credit - ael.debit), 0)
  INTO v_total_receitas
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3%';

  -- Despesas: débito - crédito
  SELECT COALESCE(SUM(ael.debit - ael.credit), 0)
  INTO v_total_despesas
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4%';

  v_resultado := v_total_receitas - v_total_despesas;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DRE - DEMONSTRAÇÃO DO RESULTADO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Receitas (3.x): R$ %', v_total_receitas;
  RAISE NOTICE 'Despesas (4.x): R$ %', v_total_despesas;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'RESULTADO: R$ %', v_resultado;
  RAISE NOTICE '========================================';

  -- Valores esperados:
  -- Receitas: R$ 136.821,59
  -- Despesas: R$ 137.297,65
  -- Resultado: -R$ 476,06

  IF ABS(v_total_receitas - 136821.59) < 1 THEN
    RAISE NOTICE 'Receitas BATEM com esperado!';
  ELSE
    RAISE WARNING 'Receitas DIFEREM! Esperado: 136821.59';
  END IF;

  IF ABS(v_total_despesas - 137297.65) < 1 THEN
    RAISE NOTICE 'Despesas BATEM com esperado!';
  ELSE
    RAISE WARNING 'Despesas DIFEREM! Esperado: 137297.65';
  END IF;
END;
$$;

-- Verificar saldo bancário final
DO $$
DECLARE
  v_saldo_banco NUMERIC;
  v_saldo_inicial NUMERIC := 90725.10;
  v_saldo_extrato NUMERIC := 18553.54;
  v_mov NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_mov FROM bank_transactions;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SALDO BANCÁRIO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Movimentação: R$ %', v_mov;
  RAISE NOTICE 'Saldo Final: R$ %', v_saldo_inicial + v_mov;
  RAISE NOTICE 'Saldo OFX: R$ %', v_saldo_extrato;
  RAISE NOTICE 'Diferença: R$ %', (v_saldo_inicial + v_mov) - v_saldo_extrato;
END;
$$;

