-- =====================================================
-- ANÁLISE DETALHADA DAS TRANSAÇÕES BANCÁRIAS
-- =====================================================
-- Verificando se há problema na importação

-- 1. Resumo por tipo de valor
DO $$
DECLARE
  v_positivos INTEGER;
  v_negativos INTEGER;
  v_total_positivo NUMERIC;
  v_total_negativo NUMERIC;
BEGIN
  SELECT
    COUNT(CASE WHEN amount > 0 THEN 1 END),
    COUNT(CASE WHEN amount < 0 THEN 1 END),
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0)
  INTO v_positivos, v_negativos, v_total_positivo, v_total_negativo
  FROM bank_transactions;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMO DAS TRANSAÇÕES:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Transações POSITIVAS: % (total: R$ %)', v_positivos, v_total_positivo;
  RAISE NOTICE 'Transações NEGATIVAS: % (total: R$ %)', v_negativos, v_total_negativo;
  RAISE NOTICE 'SOMA TOTAL: R$ %', v_total_positivo + v_total_negativo;
END;
$$;

-- 2. Listar primeiras e últimas transações para verificar padrão
DO $$
DECLARE
  v_trans RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRIMEIRAS 10 TRANSAÇÕES:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    ORDER BY transaction_date, created_at
    LIMIT 10
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      LEFT(v_trans.description, 40);
  END LOOP;
END;
$$;

-- 3. Verificar se há transações duplicadas
DO $$
DECLARE
  v_dup RECORD;
  v_total_dup INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICANDO DUPLICADAS:';
  RAISE NOTICE '========================================';

  FOR v_dup IN
    SELECT
      transaction_date,
      description,
      amount,
      COUNT(*) as qtd
    FROM bank_transactions
    GROUP BY transaction_date, description, amount
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '% vezes: % | R$ % | %',
      v_dup.qtd,
      v_dup.transaction_date,
      v_dup.amount,
      LEFT(v_dup.description, 30);
    v_total_dup := v_total_dup + (v_dup.qtd - 1);
  END LOOP;

  IF v_total_dup = 0 THEN
    RAISE NOTICE 'Nenhuma duplicata encontrada.';
  ELSE
    RAISE NOTICE 'Total de transações duplicadas: %', v_total_dup;
  END IF;
END;
$$;

-- 4. Calcular saldo real considerando o esperado de ~18k
-- Se saldo inicial = 90725 e saldo final = 18000
-- Então movimentações = -72725
-- Mas temos +276013 de movimentações
-- Diferença = 276013 - (-72725) = 348738
DO $$
DECLARE
  v_saldo_esperado NUMERIC := 18000;  -- Aproximado
  v_saldo_inicial NUMERIC := 90725.10;
  v_mov_esperada NUMERIC;
  v_mov_atual NUMERIC;
  v_diferenca NUMERIC;
BEGIN
  v_mov_esperada := v_saldo_esperado - v_saldo_inicial;  -- = -72725.10

  SELECT COALESCE(SUM(amount), 0) INTO v_mov_atual FROM bank_transactions;

  v_diferenca := v_mov_atual - v_mov_esperada;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ANÁLISE DA DIFERENÇA:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Saldo Final Esperado: ~R$ %', v_saldo_esperado;
  RAISE NOTICE 'Movimentação Esperada: R$ %', v_mov_esperada;
  RAISE NOTICE 'Movimentação Atual: R$ %', v_mov_atual;
  RAISE NOTICE 'DIFERENÇA: R$ %', v_diferenca;
  RAISE NOTICE '';
  RAISE NOTICE 'Se a diferença for ~348k, pode significar que:';
  RAISE NOTICE '1. Saídas estão com sinal positivo ao invés de negativo';
  RAISE NOTICE '2. Há transações duplicadas';
  RAISE NOTICE '3. Transações faltando na importação';
END;
$$;

-- 5. Ver últimas transações do mês
DO $$
DECLARE
  v_trans RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ÚLTIMAS 10 TRANSAÇÕES:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      LEFT(v_trans.description, 40);
  END LOOP;
END;
$$;

-- 6. Verificar transações do tipo PAGAMENTO PIX (deveriam ser negativas)
DO $$
DECLARE
  v_pix_positivo INTEGER;
  v_pix_negativo INTEGER;
  v_total_pix_pos NUMERIC;
  v_total_pix_neg NUMERIC;
BEGIN
  SELECT
    COUNT(CASE WHEN amount > 0 THEN 1 END),
    COUNT(CASE WHEN amount < 0 THEN 1 END),
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0)
  INTO v_pix_positivo, v_pix_negativo, v_total_pix_pos, v_total_pix_neg
  FROM bank_transactions
  WHERE description LIKE '%PIX%' OR description LIKE '%PAGAMENTO%';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES PIX/PAGAMENTO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PIX/Pagamentos POSITIVOS: % (R$ %)', v_pix_positivo, v_total_pix_pos;
  RAISE NOTICE 'PIX/Pagamentos NEGATIVOS: % (R$ %)', v_pix_negativo, v_total_pix_neg;
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: Pagamentos deveriam ser NEGATIVOS (saída de dinheiro)';
END;
$$;

