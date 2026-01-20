-- =====================================================
-- ANÁLISE DOS LANÇAMENTOS DE DESPESA
-- =====================================================
-- Problema: Saídas bancárias não têm crédito na conta de Banco

-- 1. Ver como os lançamentos de despesa estão estruturados
DO $$
DECLARE
  v_entry RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ESTRUTURA DOS LANÇAMENTOS DE DESPESA:';
  RAISE NOTICE '========================================';

  FOR v_entry IN
    SELECT
      ae.id,
      ae.entry_date,
      ae.description,
      STRING_AGG(coa.code || ' (D:' || ael.debit || ' C:' || ael.credit || ')', ' | ' ORDER BY ael.id) as linhas
    FROM accounting_entries ae
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE ae.entry_type = 'payment'
    GROUP BY ae.id, ae.entry_date, ae.description
    ORDER BY ae.entry_date DESC
    LIMIT 15
  LOOP
    RAISE NOTICE '% | % | %',
      v_entry.entry_date,
      LEFT(v_entry.description, 30),
      v_entry.linhas;
  END LOOP;
END;
$$;

-- 2. Verificar se há lançamentos de despesa com contrapartida no banco
DO $$
DECLARE
  v_com_banco INTEGER;
  v_sem_banco INTEGER;
BEGIN
  -- Pagamentos COM contrapartida em Banco
  SELECT COUNT(DISTINCT ae.id) INTO v_com_banco
  FROM accounting_entries ae
  WHERE ae.entry_type = 'payment'
  AND EXISTS (
    SELECT 1 FROM accounting_entry_lines ael
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE ael.entry_id = ae.id AND coa.code = '1.1.1.02'
  );

  -- Pagamentos SEM contrapartida em Banco
  SELECT COUNT(DISTINCT ae.id) INTO v_sem_banco
  FROM accounting_entries ae
  WHERE ae.entry_type = 'payment'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines ael
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE ael.entry_id = ae.id AND coa.code = '1.1.1.02'
  );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LANÇAMENTOS DE PAGAMENTO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Com contrapartida em Banco (1.1.1.02): %', v_com_banco;
  RAISE NOTICE 'SEM contrapartida em Banco: %', v_sem_banco;
END;
$$;

-- 3. Ver qual conta está sendo usada como contrapartida
DO $$
DECLARE
  v_conta RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTRAPARTIDAS MAIS USADAS EM PAGAMENTOS:';
  RAISE NOTICE '========================================';

  FOR v_conta IN
    SELECT
      coa.code,
      coa.name,
      COUNT(DISTINCT ae.id) as qtd,
      SUM(ael.credit) as total_credit
    FROM accounting_entries ae
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE ae.entry_type = 'payment'
      AND ael.credit > 0
    GROUP BY coa.code, coa.name
    ORDER BY qtd DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '% - % | Qtd: % | Total: R$ %',
      v_conta.code, LEFT(v_conta.name, 25), v_conta.qtd, v_conta.total_credit;
  END LOOP;
END;
$$;

-- 4. O problema: lançamentos tipo D-Despesa/C-Passivo ao invés de D-Despesa/C-Banco
-- Vamos ver os lançamentos que usam Passivo (2.x) como contrapartida
DO $$
DECLARE
  v_entry RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PAGAMENTOS COM CONTRAPARTIDA EM PASSIVO:';
  RAISE NOTICE '========================================';

  FOR v_entry IN
    SELECT
      ae.id,
      ae.entry_date,
      ae.description,
      ae.transaction_id
    FROM accounting_entries ae
    WHERE ae.entry_type = 'payment'
    AND EXISTS (
      SELECT 1 FROM accounting_entry_lines ael
      JOIN chart_of_accounts coa ON coa.id = ael.account_id
      WHERE ael.entry_id = ae.id AND coa.code LIKE '2%' AND ael.credit > 0
    )
    ORDER BY ae.entry_date DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '% | % | Trans: %',
      v_entry.entry_date,
      LEFT(v_entry.description, 40),
      v_entry.transaction_id;
  END LOOP;
END;
$$;

-- 5. Verificar saldo real do extrato
DO $$
DECLARE
  v_saldo_inicial NUMERIC;
  v_movimentacoes NUMERIC;
  v_saldo_final NUMERIC;
BEGIN
  SELECT COALESCE(initial_balance, 0) INTO v_saldo_inicial FROM bank_accounts LIMIT 1;
  SELECT COALESCE(SUM(amount), 0) INTO v_movimentacoes FROM bank_transactions;
  v_saldo_final := v_saldo_inicial + v_movimentacoes;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SALDO REAL DO EXTRATO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Movimentações (soma): R$ %', v_movimentacoes;
  RAISE NOTICE 'SALDO FINAL: R$ %', v_saldo_final;
END;
$$;

