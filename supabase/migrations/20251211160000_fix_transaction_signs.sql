-- =====================================================
-- CORREÇÃO DOS SINAIS DAS TRANSAÇÕES BANCÁRIAS
-- =====================================================
-- Problema identificado: Transações com PAGAMENTO/PIX_DEB que deveriam
-- ser negativas (saída) estão com valor positivo

-- 1. Primeiro verificar o que será alterado
DO $$
DECLARE
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total
  FROM bank_transactions
  WHERE amount > 0
  AND (
    description LIKE '%PAGAMENTO PIX-PIX_DEB%'
    OR description LIKE '%TARIFA%'
    OR description LIKE '%DEBITO CONVENIOS%'
    OR description LIKE '%DEBITO ARRECADACAO%'
    OR description LIKE '%MANUTENCAO DE TITULOS%'
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES A SEREM CORRIGIDAS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Quantidade: %', v_count;
  RAISE NOTICE 'Valor total (será invertido): R$ %', v_total;
END;
$$;

-- 2. Mostrar algumas transações que serão alteradas
DO $$
DECLARE
  v_trans RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'AMOSTRA DE TRANSAÇÕES A CORRIGIR:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE amount > 0
    AND (
      description LIKE '%PAGAMENTO PIX-PIX_DEB%'
      OR description LIKE '%TARIFA%'
      OR description LIKE '%DEBITO CONVENIOS%'
      OR description LIKE '%DEBITO ARRECADACAO%'
      OR description LIKE '%MANUTENCAO DE TITULOS%'
    )
    ORDER BY amount DESC
    LIMIT 15
  LOOP
    RAISE NOTICE '% | R$ % -> R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      -v_trans.amount,
      LEFT(v_trans.description, 40);
  END LOOP;
END;
$$;

-- 3. CORREÇÃO: Inverter o sinal das transações de saída que estão positivas
UPDATE bank_transactions
SET amount = -ABS(amount)
WHERE amount > 0
AND (
  description LIKE '%PAGAMENTO PIX-PIX_DEB%'
  OR description LIKE '%TARIFA%'
  OR description LIKE '%DEBITO CONVENIOS%'
  OR description LIKE '%DEBITO ARRECADACAO%'
  OR description LIKE '%MANUTENCAO DE TITULOS%'
);

-- 4. Verificar resultado após correção
DO $$
DECLARE
  v_positivos INTEGER;
  v_negativos INTEGER;
  v_total_pos NUMERIC;
  v_total_neg NUMERIC;
  v_saldo_inicial NUMERIC;
  v_saldo_final NUMERIC;
BEGIN
  SELECT
    COUNT(CASE WHEN amount > 0 THEN 1 END),
    COUNT(CASE WHEN amount < 0 THEN 1 END),
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0)
  INTO v_positivos, v_negativos, v_total_pos, v_total_neg
  FROM bank_transactions;

  SELECT COALESCE(initial_balance, 0) INTO v_saldo_inicial FROM bank_accounts LIMIT 1;
  v_saldo_final := v_saldo_inicial + v_total_pos + v_total_neg;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESULTADO APÓS CORREÇÃO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Transações POSITIVAS: % (R$ %)', v_positivos, v_total_pos;
  RAISE NOTICE 'Transações NEGATIVAS: % (R$ %)', v_negativos, v_total_neg;
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Movimentação: R$ %', v_total_pos + v_total_neg;
  RAISE NOTICE 'SALDO FINAL: R$ %', v_saldo_final;
END;
$$;

-- 5. Também precisamos remover os lançamentos contábeis criados anteriormente
-- que usaram valores errados (positivos quando deveriam ser negativos)
-- e recriá-los com os valores corretos

-- Primeiro, deletar lançamentos de receita criados para transações que eram na verdade saídas
DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  -- Deletar entry lines primeiro (FK)
  DELETE FROM accounting_entry_lines
  WHERE entry_id IN (
    SELECT ae.id
    FROM accounting_entries ae
    JOIN bank_transactions bt ON ae.transaction_id = bt.id
    WHERE bt.amount < 0  -- Agora são negativas após correção
    AND ae.entry_type = 'receipt'  -- Foram lançadas como receita erroneamente
  );

  -- Deletar entries
  DELETE FROM accounting_entries
  WHERE id IN (
    SELECT ae.id
    FROM accounting_entries ae
    JOIN bank_transactions bt ON ae.transaction_id = bt.id
    WHERE bt.amount < 0
    AND ae.entry_type = 'receipt'
  );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Lançamentos incorretos removidos: %', v_deleted;
END;
$$;

