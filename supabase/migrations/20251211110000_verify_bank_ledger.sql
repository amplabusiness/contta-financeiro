-- =====================================================
-- RAZÃO CONTÁBIL - BANCOS CONTA MOVIMENTO (1.1.1.02)
-- =====================================================

-- 1. Ver todos os lançamentos na conta de Bancos
DO $$
DECLARE
  v_entry RECORD;
  v_saldo_acumulado NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RAZÃO CONTÁBIL - 1.1.1.02 Bancos Conta Movimento';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Data        | Descrição                          | Débito    | Crédito   | Saldo';
  RAISE NOTICE '----------------------------------------';

  FOR v_entry IN
    SELECT
      ae.entry_date,
      ae.description,
      ael.debit,
      ael.credit,
      ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE coa.code = '1.1.1.02'
    ORDER BY ae.entry_date, ae.created_at
    LIMIT 50  -- Limitando para não sobrecarregar
  LOOP
    v_saldo_acumulado := v_saldo_acumulado + v_entry.debit - v_entry.credit;
    v_count := v_count + 1;

    RAISE NOTICE '% | % | % | % | %',
      v_entry.entry_date,
      LEFT(v_entry.description, 35),
      v_entry.debit,
      v_entry.credit,
      v_saldo_acumulado;
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total de lançamentos mostrados: %', v_count;
  RAISE NOTICE 'Saldo final: R$ %', v_saldo_acumulado;
END;
$$;

-- 2. Resumo por tipo de operação (para entender o problema)
DO $$
DECLARE
  v_total_debitos NUMERIC;
  v_total_creditos NUMERIC;
  v_qtd_debitos INTEGER;
  v_qtd_creditos INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN ael.debit > 0 THEN ael.debit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ael.credit > 0 THEN ael.credit ELSE 0 END), 0),
    COUNT(CASE WHEN ael.debit > 0 THEN 1 END),
    COUNT(CASE WHEN ael.credit > 0 THEN 1 END)
  INTO v_total_debitos, v_total_creditos, v_qtd_debitos, v_qtd_creditos
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMO DOS LANÇAMENTOS EM BANCOS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Quantidade de DÉBITOS: % (total R$ %)', v_qtd_debitos, v_total_debitos;
  RAISE NOTICE 'Quantidade de CRÉDITOS: % (total R$ %)', v_qtd_creditos, v_total_creditos;
  RAISE NOTICE '';
  RAISE NOTICE 'ANÁLISE:';
  RAISE NOTICE '- Em conta de ATIVO, DÉBITO aumenta o saldo';
  RAISE NOTICE '- Em conta de ATIVO, CRÉDITO diminui o saldo';
  RAISE NOTICE '';
  RAISE NOTICE 'Se há mais CRÉDITOS que DÉBITOS, o saldo fica negativo!';
  RAISE NOTICE 'Isso indica que os lançamentos estão INVERTIDOS.';
END;
$$;

-- 3. Verificar se o problema é de inversão nos triggers de despesa/receita
DO $$
DECLARE
  v_entry RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AMOSTRA DE LANÇAMENTOS (últimos 20):';
  RAISE NOTICE '========================================';

  FOR v_entry IN
    SELECT
      ae.entry_date,
      ae.description,
      ael.debit,
      ael.credit,
      coa2.code as contrapartida_code,
      coa2.name as contrapartida_name
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    -- Buscar contrapartida
    LEFT JOIN accounting_entry_lines ael2 ON ael2.entry_id = ae.id AND ael2.id != ael.id
    LEFT JOIN chart_of_accounts coa2 ON coa2.id = ael2.account_id
    WHERE coa.code = '1.1.1.02'
    ORDER BY ae.entry_date DESC, ae.created_at DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '% | D:% C:% | % - %',
      v_entry.entry_date,
      v_entry.debit,
      v_entry.credit,
      v_entry.contrapartida_code,
      LEFT(v_entry.description, 40);
  END LOOP;
END;
$$;

-- 4. Problema identificado: Quando pagamos uma despesa:
-- CORRETO: D - Despesa (4.x) / C - Banco (1.1.1.02) -> Diminui banco
-- ERRADO:  D - Banco / C - Despesa -> Aumenta banco (INVERTIDO!)
--
-- Quando recebemos uma receita:
-- CORRETO: D - Banco (1.1.1.02) / C - Receita (3.x) -> Aumenta banco
-- ERRADO:  C - Banco / D - Receita -> Diminui banco (INVERTIDO!)

-- 5. Verificar qual é a lógica atual
DO $$
DECLARE
  v_receita_entry RECORD;
  v_despesa_entry RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICANDO LÓGICA DOS LANÇAMENTOS:';
  RAISE NOTICE '========================================';

  -- Exemplo de receita (conta 3.x como contrapartida)
  SELECT
    ae.description,
    ael.debit as banco_debit,
    ael.credit as banco_credit
  INTO v_receita_entry
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02'
  AND EXISTS (
    SELECT 1 FROM accounting_entry_lines ael2
    JOIN chart_of_accounts coa2 ON coa2.id = ael2.account_id
    WHERE ael2.entry_id = ae.id AND coa2.code LIKE '3%'
  )
  LIMIT 1;

  IF v_receita_entry IS NOT NULL THEN
    RAISE NOTICE 'RECEITA: "%" -> Banco D:% C:%',
      LEFT(v_receita_entry.description, 40),
      v_receita_entry.banco_debit,
      v_receita_entry.banco_credit;

    IF v_receita_entry.banco_debit > 0 THEN
      RAISE NOTICE '  -> CORRETO! Débito no banco aumenta saldo.';
    ELSE
      RAISE NOTICE '  -> ERRADO! Crédito no banco diminui saldo (deveria ser débito).';
    END IF;
  END IF;

  -- Exemplo de despesa (conta 4.x como contrapartida)
  SELECT
    ae.description,
    ael.debit as banco_debit,
    ael.credit as banco_credit
  INTO v_despesa_entry
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02'
  AND EXISTS (
    SELECT 1 FROM accounting_entry_lines ael2
    JOIN chart_of_accounts coa2 ON coa2.id = ael2.account_id
    WHERE ael2.entry_id = ae.id AND coa2.code LIKE '4%'
  )
  LIMIT 1;

  IF v_despesa_entry IS NOT NULL THEN
    RAISE NOTICE 'DESPESA: "%" -> Banco D:% C:%',
      LEFT(v_despesa_entry.description, 40),
      v_despesa_entry.banco_debit,
      v_despesa_entry.banco_credit;

    IF v_despesa_entry.banco_credit > 0 THEN
      RAISE NOTICE '  -> CORRETO! Crédito no banco diminui saldo.';
    ELSE
      RAISE NOTICE '  -> ERRADO! Débito no banco aumenta saldo (deveria ser crédito).';
    END IF;
  END IF;
END;
$$;

-- 6. Comparar com saldo esperado (inicial + transações)
DO $$
DECLARE
  v_saldo_inicial NUMERIC;
  v_total_entradas NUMERIC;
  v_total_saidas NUMERIC;
  v_saldo_esperado NUMERIC;
  v_saldo_contabil NUMERIC;
BEGIN
  -- Saldo inicial
  SELECT COALESCE(initial_balance, 0) INTO v_saldo_inicial
  FROM bank_accounts LIMIT 1;

  -- Transações
  SELECT
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
  INTO v_total_entradas, v_total_saidas
  FROM bank_transactions;

  -- Saldo esperado
  v_saldo_esperado := v_saldo_inicial + v_total_entradas - v_total_saidas;

  -- Saldo contábil atual
  SELECT COALESCE(SUM(debit - credit), 0) INTO v_saldo_contabil
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CÁLCULO DO SALDO ESPERADO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Inicial: R$ %', v_saldo_inicial;
  RAISE NOTICE '(+) Entradas (créditos bancários): R$ %', v_total_entradas;
  RAISE NOTICE '(-) Saídas (débitos bancários): R$ %', v_total_saidas;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'SALDO ESPERADO: R$ %', v_saldo_esperado;
  RAISE NOTICE 'SALDO CONTÁBIL: R$ %', v_saldo_contabil;
  RAISE NOTICE '----------------------------------------';

  IF ABS(v_saldo_esperado - v_saldo_contabil) < 1 THEN
    RAISE NOTICE 'SALDOS CONFEREM!';
  ELSE
    RAISE NOTICE 'DIFERENÇA: R$ %', v_saldo_esperado - v_saldo_contabil;
    RAISE NOTICE '';
    RAISE NOTICE 'O saldo contábil precisa de correção!';
    RAISE NOTICE 'Pode ser necessário inverter os lançamentos.';
  END IF;
END;
$$;

