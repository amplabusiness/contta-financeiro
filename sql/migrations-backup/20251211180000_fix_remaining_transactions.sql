-- =====================================================
-- CORREÇÃO FINAL DAS TRANSAÇÕES BANCÁRIAS
-- =====================================================
-- Saldo Real (OFX): R$ 18.553,54
-- Saldo Atual: R$ 121.051,98
-- Diferença: R$ 102.498,44
-- =====================================================

-- 1. Verificar transações que estão com sinal invertido
-- No OFX original, vimos que LIQUIDACAO BOLETO pode ser DEBIT (pagamento)
-- Exemplo: LIQUIDACAO BOLETO-44422513000166 = -10836.96 (pagamento de boleto)

-- Primeiro, vamos verificar LIQUIDACAO BOLETO que estão positivas mas deveriam ser negativas
DO $$
DECLARE
  v_trans RECORD;
  v_total NUMERIC := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LIQUIDAÇÃO BOLETO COM VALOR POSITIVO:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE amount > 0
    AND description LIKE '%LIQUIDACAO BOLETO%'
    ORDER BY amount DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      LEFT(v_trans.description, 50);
    v_total := v_total + v_trans.amount;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Total de Liquidação Boleto positivos: R$ %', v_total;
END;
$$;

-- 2. Identificar padrão: Se a descrição tem CNPJ (números) pode ser pagamento de conta
-- Boletos de cobrança (recebimento) geralmente são para clientes conhecidos
-- Boletos de pagamento são para fornecedores, concessionárias, etc.

-- Padrões de PAGAMENTO de boletos (deveriam ser negativos):
-- - Condomínio
-- - Faculdade (pagamento de faculdade dos sócios)
-- - Energia, Água, Telefone
-- - CAIXA ECONOMICA (empréstimo)
-- - CRC (anuidade)

DO $$
DECLARE
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total
  FROM bank_transactions
  WHERE amount > 0
  AND description LIKE '%LIQUIDACAO BOLETO%'
  AND (
    UPPER(description) LIKE '%CONDOMIN%'
    OR UPPER(description) LIKE '%FACULDADE%'
    OR UPPER(description) LIKE '%CAIXA ECONOMICA%'
    OR UPPER(description) LIKE '%CAIXA D%'
    OR UPPER(description) LIKE '%CRC%'
    OR UPPER(description) LIKE '%ALGARTE%'
    OR UPPER(description) LIKE '%ANUIDADE%'
    -- Adicionar mais padrões conforme necessário
  );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BOLETOS QUE PARECEM PAGAMENTOS (a inverter):';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Quantidade: %', v_count;
  RAISE NOTICE 'Valor total: R$ %', v_total;
END;
$$;

-- 3. Analisar as maiores transações positivas que podem estar erradas
DO $$
DECLARE
  v_trans RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '20 MAIORES ENTRADAS (verificar se corretas):';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE amount > 0
    ORDER BY amount DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      LEFT(v_trans.description, 50);
  END LOOP;
END;
$$;

-- 4. Cálculo preciso do ajuste necessário
DO $$
DECLARE
  v_saldo_inicial NUMERIC := 90725.10;
  v_saldo_final_real NUMERIC := 18553.54;  -- Do arquivo OFX
  v_mov_atual NUMERIC;
  v_mov_esperada NUMERIC;
  v_ajuste NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_mov_atual FROM bank_transactions;
  v_mov_esperada := v_saldo_final_real - v_saldo_inicial;
  v_ajuste := v_mov_atual - v_mov_esperada;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CÁLCULO DO AJUSTE PRECISO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Saldo Final Real (OFX): R$ %', v_saldo_final_real;
  RAISE NOTICE 'Movimentação Esperada: R$ %', v_mov_esperada;
  RAISE NOTICE 'Movimentação Atual: R$ %', v_mov_atual;
  RAISE NOTICE '';
  RAISE NOTICE 'DIFERENÇA: R$ %', v_ajuste;
  RAISE NOTICE '(Transações a inverter somam R$ %)', v_ajuste / 2;
END;
$$;

-- 5. Verificar se ACTION SOL são entradas corretas (são de clientes?)
DO $$
DECLARE
  v_trans RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES ACTION SOL:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE UPPER(description) LIKE '%ACTION%'
    ORDER BY transaction_date
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      v_trans.description;
  END LOOP;
END;
$$;

-- 6. Inverter boletos que são claramente pagamentos
-- Baseado no padrão do OFX: LIQUIDACAO BOLETO pode ser pagamento de conta
UPDATE bank_transactions
SET amount = -ABS(amount)
WHERE amount > 0
AND description LIKE '%LIQUIDACAO BOLETO%'
AND (
  -- Boletos de concessionárias e fornecedores
  UPPER(description) LIKE '%CONDOMIN%'
  OR UPPER(description) LIKE '%FACULDADE%'
  OR UPPER(description) LIKE '%CAIXA ECONOMICA%'
  OR UPPER(description) LIKE '%CAIXA D%' -- CAIXA DE ASSISTÊNCIA
  OR UPPER(description) LIKE '%ALGARTE%'
  OR UPPER(description) LIKE '%SINDISEAC%'
  -- CRC e anuidades
  OR UPPER(description) LIKE '%01015676%' -- CRC
);

-- 7. Verificar resultado parcial
DO $$
DECLARE
  v_saldo_inicial NUMERIC := 90725.10;
  v_mov NUMERIC;
  v_saldo_atual NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_mov FROM bank_transactions;
  v_saldo_atual := v_saldo_inicial + v_mov;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESULTADO APÓS CORREÇÃO PARCIAL:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Atual: R$ %', v_saldo_atual;
  RAISE NOTICE 'Saldo Esperado: R$ 18553.54';
  RAISE NOTICE 'Diferença: R$ %', v_saldo_atual - 18553.54;
END;
$$;

