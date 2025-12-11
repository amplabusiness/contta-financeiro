-- =====================================================
-- VERIFICAÇÃO FINAL DO SALDO BANCÁRIO
-- =====================================================

-- 1. Resumo do Razão Contábil - Bancos
DO $$
DECLARE
  v_total_debitos NUMERIC;
  v_total_creditos NUMERIC;
  v_saldo NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(ael.debit), 0),
    COALESCE(SUM(ael.credit), 0)
  INTO v_total_debitos, v_total_creditos
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02';

  v_saldo := v_total_debitos - v_total_creditos;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RAZÃO CONTÁBIL - BANCOS (1.1.1.02):';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de DÉBITOS: R$ %', v_total_debitos;
  RAISE NOTICE 'Total de CRÉDITOS: R$ %', v_total_creditos;
  RAISE NOTICE 'SALDO CONTÁBIL: R$ %', v_saldo;
END;
$$;

-- 2. Resumo das Transações Bancárias
DO $$
DECLARE
  v_saldo_inicial NUMERIC;
  v_total_entradas NUMERIC;
  v_total_saidas NUMERIC;
  v_saldo_final NUMERIC;
BEGIN
  SELECT COALESCE(initial_balance, 0) INTO v_saldo_inicial
  FROM bank_accounts LIMIT 1;

  SELECT
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
  INTO v_total_entradas, v_total_saidas
  FROM bank_transactions;

  v_saldo_final := v_saldo_inicial + v_total_entradas - v_total_saidas;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'EXTRATO BANCÁRIO (bank_transactions):';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Total Entradas (créditos): R$ %', v_total_entradas;
  RAISE NOTICE 'Total Saídas (débitos): R$ %', v_total_saidas;
  RAISE NOTICE 'SALDO FINAL ESPERADO: R$ %', v_saldo_final;
END;
$$;

-- 3. Análise detalhada - Entradas lançadas vs não lançadas
DO $$
DECLARE
  v_entradas_com_debito NUMERIC;
  v_entradas_sem_debito NUMERIC;
  v_qtd_com INTEGER;
  v_qtd_sem INTEGER;
BEGIN
  -- Transações de entrada COM débito no banco
  SELECT COUNT(*), COALESCE(SUM(bt.amount), 0)
  INTO v_qtd_com, v_entradas_com_debito
  FROM bank_transactions bt
  WHERE bt.amount > 0
  AND EXISTS (
    SELECT 1 FROM accounting_entries ae
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE (ae.transaction_id = bt.id OR (ae.reference_type = 'bank_transaction' AND ae.reference_id = bt.id))
      AND coa.code = '1.1.1.02'
      AND ael.debit > 0
  );

  -- Transações de entrada SEM débito no banco
  SELECT COUNT(*), COALESCE(SUM(bt.amount), 0)
  INTO v_qtd_sem, v_entradas_sem_debito
  FROM bank_transactions bt
  WHERE bt.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entries ae
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE (ae.transaction_id = bt.id OR (ae.reference_type = 'bank_transaction' AND ae.reference_id = bt.id))
      AND coa.code = '1.1.1.02'
      AND ael.debit > 0
  );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ANÁLISE DE ENTRADAS NO BANCO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Com débito no banco: % transações = R$ %', v_qtd_com, v_entradas_com_debito;
  RAISE NOTICE 'Sem débito no banco: % transações = R$ %', v_qtd_sem, v_entradas_sem_debito;
END;
$$;

-- 4. Análise de Saídas
DO $$
DECLARE
  v_saidas_com_credito NUMERIC;
  v_saidas_sem_credito NUMERIC;
  v_qtd_com INTEGER;
  v_qtd_sem INTEGER;
BEGIN
  -- Transações de saída COM crédito no banco
  SELECT COUNT(*), COALESCE(SUM(ABS(bt.amount)), 0)
  INTO v_qtd_com, v_saidas_com_credito
  FROM bank_transactions bt
  WHERE bt.amount < 0
  AND EXISTS (
    SELECT 1 FROM accounting_entries ae
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE (ae.transaction_id = bt.id OR (ae.reference_type = 'bank_transaction' AND ae.reference_id = bt.id))
      AND coa.code = '1.1.1.02'
      AND ael.credit > 0
  );

  -- Transações de saída SEM crédito no banco
  SELECT COUNT(*), COALESCE(SUM(ABS(bt.amount)), 0)
  INTO v_qtd_sem, v_saidas_sem_credito
  FROM bank_transactions bt
  WHERE bt.amount < 0
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entries ae
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE (ae.transaction_id = bt.id OR (ae.reference_type = 'bank_transaction' AND ae.reference_id = bt.id))
      AND coa.code = '1.1.1.02'
      AND ael.credit > 0
  );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ANÁLISE DE SAÍDAS DO BANCO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Com crédito no banco: % transações = R$ %', v_qtd_com, v_saidas_com_credito;
  RAISE NOTICE 'Sem crédito no banco: % transações = R$ %', v_qtd_sem, v_saidas_sem_credito;
END;
$$;

-- 5. Comparação Final
DO $$
DECLARE
  v_saldo_contabil NUMERIC;
  v_saldo_esperado NUMERIC;
  v_saldo_inicial NUMERIC;
  v_total_entradas NUMERIC;
  v_total_saidas NUMERIC;
BEGIN
  -- Saldo contábil
  SELECT COALESCE(SUM(ael.debit - ael.credit), 0)
  INTO v_saldo_contabil
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02';

  -- Saldo esperado
  SELECT COALESCE(initial_balance, 0) INTO v_saldo_inicial FROM bank_accounts LIMIT 1;

  SELECT
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
  INTO v_total_entradas, v_total_saidas
  FROM bank_transactions;

  v_saldo_esperado := v_saldo_inicial + v_total_entradas - v_total_saidas;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COMPARAÇÃO FINAL:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Contábil: R$ %', v_saldo_contabil;
  RAISE NOTICE 'Saldo Esperado: R$ %', v_saldo_esperado;
  RAISE NOTICE 'Diferença: R$ %', v_saldo_esperado - v_saldo_contabil;
  RAISE NOTICE '';

  IF ABS(v_saldo_esperado - v_saldo_contabil) < 1 THEN
    RAISE NOTICE 'SALDOS CONFEREM!';
  ELSE
    RAISE WARNING 'SALDOS NÃO CONFEREM!';
    RAISE NOTICE 'Ação necessária: Verificar lançamentos pendentes.';
  END IF;
END;
$$;

