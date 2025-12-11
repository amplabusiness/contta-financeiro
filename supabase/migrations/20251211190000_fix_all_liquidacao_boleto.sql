-- =====================================================
-- CORREÇÃO DE TODOS OS BOLETOS QUE SÃO PAGAMENTOS
-- =====================================================
-- Baseado no OFX original, LIQUIDACAO BOLETO pode ser:
-- - Pagamento de boleto (DEBIT = valor negativo)
-- - Recebimento de cobrança (CREDIT = valor positivo)
--
-- Os boletos de PAGAMENTO que estão errados incluem:
-- - DETRAN/DEPARTAMENTO ESTADUAL
-- - FACULDADE
-- - CAIXA ECONOMICA/CAIXA DE ASSISTÊNCIA
-- - CONDOMÍNIO
-- - CRC (01015676)
-- - ALGARTE
-- - SINDISEAC
-- - E possivelmente outros
-- =====================================================

-- 1. Listar TODOS os LIQUIDACAO BOLETO positivos para análise
DO $$
DECLARE
  v_trans RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TODOS LIQUIDAÇÃO BOLETO POSITIVOS:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT transaction_date, description, amount
    FROM bank_transactions
    WHERE amount > 0
    AND description LIKE '%LIQUIDACAO BOLETO%'
    ORDER BY transaction_date, amount DESC
  LOOP
    RAISE NOTICE '% | R$ % | %',
      v_trans.transaction_date,
      v_trans.amount,
      v_trans.description;
  END LOOP;
END;
$$;

-- 2. Inverter TODOS os LIQUIDACAO BOLETO que estão positivos
-- Baseado no OFX, todos os "LIQUIDACAO BOLETO" são DEBIT (pagamentos)
-- Os recebimentos vêm como "LIQ.COBRANCA SIMPLES" (nota: sem espaço)
UPDATE bank_transactions
SET amount = -ABS(amount)
WHERE amount > 0
AND description LIKE '%LIQUIDACAO BOLETO%';

-- 3. Também inverter PAGAMENTO PIX SICREDI que são claramente pagamentos
UPDATE bank_transactions
SET amount = -ABS(amount)
WHERE amount > 0
AND description LIKE '%PAGAMENTO PIX SICREDI%';

-- 4. Verificar resultado
DO $$
DECLARE
  v_saldo_inicial NUMERIC := 90725.10;
  v_mov NUMERIC;
  v_saldo_atual NUMERIC;
  v_saldo_esperado NUMERIC := 18553.54;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_mov FROM bank_transactions;
  v_saldo_atual := v_saldo_inicial + v_mov;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESULTADO APÓS CORREÇÃO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE 'Movimentação: R$ %', v_mov;
  RAISE NOTICE 'Saldo Atual: R$ %', v_saldo_atual;
  RAISE NOTICE 'Saldo Esperado: R$ %', v_saldo_esperado;
  RAISE NOTICE 'Diferença: R$ %', v_saldo_atual - v_saldo_esperado;

  IF ABS(v_saldo_atual - v_saldo_esperado) < 1 THEN
    RAISE NOTICE 'SALDOS CONFEREM!';
  ELSE
    RAISE WARNING 'Ainda há diferença. Verificar transações restantes.';
  END IF;
END;
$$;

-- 5. Se ainda houver diferença, mostrar resumo por tipo
DO $$
DECLARE
  v_tipo RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMO ATUAL POR TIPO:';
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
        ELSE 'OUTROS'
      END as tipo,
      COUNT(*) as qtd,
      SUM(amount) as saldo
    FROM bank_transactions
    GROUP BY 1
    ORDER BY ABS(SUM(amount)) DESC
  LOOP
    RAISE NOTICE '%: % transações | Saldo: R$ %', v_tipo.tipo, v_tipo.qtd, v_tipo.saldo;
  END LOOP;
END;
$$;

