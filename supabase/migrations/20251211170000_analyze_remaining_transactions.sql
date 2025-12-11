-- =====================================================
-- ANÁLISE DAS TRANSAÇÕES RESTANTES
-- =====================================================
-- Saldo atual: R$ 121.051,98
-- Saldo esperado: ~R$ 18.000
-- Diferença: ~R$ 103.000 (ainda há transações com sinal errado)

-- 1. Listar todas as transações POSITIVAS (entradas) restantes
DO $$
DECLARE
  v_trans RECORD;
  v_total NUMERIC := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES POSITIVAS (ENTRADAS):';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE amount > 0
    ORDER BY amount DESC
    LIMIT 30
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      LEFT(v_trans.description, 50);
    v_total := v_total + v_trans.amount;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Total das 30 maiores: R$ %', v_total;
END;
$$;

-- 2. Agrupar por tipo de descrição para entender padrão
DO $$
DECLARE
  v_tipo RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AGRUPAMENTO POR TIPO DE TRANSAÇÃO:';
  RAISE NOTICE '========================================';

  FOR v_tipo IN
    SELECT
      CASE
        WHEN description LIKE '%LIQUIDACAO BOLETO%' THEN 'LIQUIDACAO BOLETO'
        WHEN description LIKE '%LIQ.COBRANCA%' THEN 'LIQ.COBRANCA'
        WHEN description LIKE '%RECEBIMENTO PIX%' THEN 'RECEBIMENTO PIX'
        WHEN description LIKE '%PAGAMENTO PIX%' THEN 'PAGAMENTO PIX'
        WHEN description LIKE '%TARIFA%' THEN 'TARIFA'
        WHEN description LIKE '%DEBITO CONVENIOS%' THEN 'DEBITO CONVENIOS'
        WHEN description LIKE '%DEBITO ARRECADACAO%' THEN 'DEBITO ARRECADACAO'
        WHEN description LIKE '%MANUTENCAO%' THEN 'MANUTENCAO'
        WHEN description LIKE '%PAGAMENTO PIX SICREDI%' THEN 'PIX SICREDI'
        ELSE 'OUTROS'
      END as tipo,
      COUNT(*) as qtd,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as positivos,
      SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as negativos,
      SUM(amount) as saldo
    FROM bank_transactions
    GROUP BY 1
    ORDER BY ABS(SUM(amount)) DESC
  LOOP
    RAISE NOTICE '%: % transações | +R$ % | R$ % | Saldo: R$ %',
      v_tipo.tipo,
      v_tipo.qtd,
      v_tipo.positivos,
      v_tipo.negativos,
      v_tipo.saldo;
  END LOOP;
END;
$$;

-- 3. Verificar se há transações que parecem pagamentos mas estão positivas
DO $$
DECLARE
  v_suspeita RECORD;
  v_total NUMERIC := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES SUSPEITAS (positivas que parecem pagamentos):';
  RAISE NOTICE '========================================';

  FOR v_suspeita IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE amount > 0
    AND (
      -- Nomes de pessoas físicas (sócios/funcionários) - geralmente são saídas
      UPPER(description) LIKE '%SERGIO%'
      OR UPPER(description) LIKE '%VICTOR%'
      OR UPPER(description) LIKE '%NAYARA%'
      OR UPPER(description) LIKE '%ANTONIO%'
      -- Ou descrições que parecem pagamentos
      OR UPPER(description) LIKE '%ADIANTAMENTO%'
      OR UPPER(description) LIKE '%REEMBOLSO%'
      OR UPPER(description) LIKE '%ALUGUEL%'
      OR UPPER(description) LIKE '%CONDOMINIO%'
      OR UPPER(description) LIKE '%ENERGIA%'
      OR UPPER(description) LIKE '%AGUA%'
      OR UPPER(description) LIKE '%INTERNET%'
      OR UPPER(description) LIKE '%TELEFONE%'
      OR UPPER(description) LIKE '%IPTU%'
      OR UPPER(description) LIKE '%IPVA%'
      OR UPPER(description) LIKE '%SALARIO%'
      OR UPPER(description) LIKE '%FOLHA%'
      OR UPPER(description) LIKE '%PAGAMENTO PIX SICREDI%'  -- PIX Sicredi podem ser saídas
    )
    ORDER BY amount DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_suspeita.transaction_date,
      v_suspeita.amount,
      LEFT(v_suspeita.description, 50);
    v_total := v_total + v_suspeita.amount;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Total de transações suspeitas: R$ %', v_total;
END;
$$;

-- 4. Verificar PIX SICREDI (podem ser saídas para sócios)
DO $$
DECLARE
  v_sicredi RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES PIX SICREDI:';
  RAISE NOTICE '========================================';

  FOR v_sicredi IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE description LIKE '%PIX SICREDI%'
    ORDER BY transaction_date
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_sicredi.transaction_date,
      v_sicredi.amount,
      v_sicredi.description;
  END LOOP;
END;
$$;

-- 5. Calcular diferença exata
DO $$
DECLARE
  v_saldo_inicial NUMERIC := 90725.10;
  v_saldo_esperado NUMERIC := 18000;
  v_saldo_atual NUMERIC;
  v_mov_atual NUMERIC;
  v_mov_esperada NUMERIC;
  v_ajuste_necessario NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_mov_atual FROM bank_transactions;
  v_saldo_atual := v_saldo_inicial + v_mov_atual;
  v_mov_esperada := v_saldo_esperado - v_saldo_inicial;
  v_ajuste_necessario := v_mov_esperada - v_mov_atual;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CÁLCULO DO AJUSTE NECESSÁRIO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Saldo Atual: R$ %', v_saldo_atual;
  RAISE NOTICE 'Saldo Esperado: ~R$ %', v_saldo_esperado;
  RAISE NOTICE '';
  RAISE NOTICE 'Movimentação Atual: R$ %', v_mov_atual;
  RAISE NOTICE 'Movimentação Esperada: R$ %', v_mov_esperada;
  RAISE NOTICE '';
  RAISE NOTICE 'AJUSTE NECESSÁRIO: R$ %', v_ajuste_necessario;
  RAISE NOTICE '(Precisa inverter transações que somam R$ %)', ABS(v_ajuste_necessario) / 2;
END;
$$;

