-- =====================================================
-- VERIFICAÇÃO: RECEITAS E DESPESAS BATEM COM A DRE?
-- =====================================================

-- 1. Listar todas as contas de RECEITA (3.x) com saldo
DO $$
DECLARE
  v_receita RECORD;
  v_total_receitas NUMERIC := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTAS DE RECEITA (3.x) COM SALDO:';
  RAISE NOTICE '========================================';

  FOR v_receita IN
    SELECT
      coa.code,
      coa.name,
      COALESCE(SUM(ael.credit - ael.debit), 0) as saldo
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.code LIKE '3%'
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name
    HAVING COALESCE(SUM(ael.credit - ael.debit), 0) != 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% - %: R$ %', v_receita.code, v_receita.name, v_receita.saldo;
    v_total_receitas := v_total_receitas + v_receita.saldo;
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'TOTAL RECEITAS: R$ %', v_total_receitas;
END;
$$;

-- 2. Listar todas as contas de DESPESA (4.x) com saldo
DO $$
DECLARE
  v_despesa RECORD;
  v_total_despesas NUMERIC := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTAS DE DESPESA (4.x) COM SALDO:';
  RAISE NOTICE '========================================';

  FOR v_despesa IN
    SELECT
      coa.code,
      coa.name,
      COALESCE(SUM(ael.debit - ael.credit), 0) as saldo
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.code LIKE '4%'
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name
    HAVING COALESCE(SUM(ael.debit - ael.credit), 0) != 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% - %: R$ %', v_despesa.code, v_despesa.name, v_despesa.saldo;
    v_total_despesas := v_total_despesas + v_despesa.saldo;
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'TOTAL DESPESAS: R$ %', v_total_despesas;
END;
$$;

-- 3. Comparar com DRE esperada
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

  -- Valores esperados pela DRE que você mostrou:
  -- Receitas: R$ 136.821,59
  -- Despesas: R$ 137.297,65
  -- Resultado: -R$ 476,06

  IF ABS(v_total_receitas - 136821.59) < 1 THEN
    RAISE NOTICE 'Receitas BATEM com DRE!';
  ELSE
    RAISE WARNING 'Receitas DIFEREM da DRE! Esperado: 136821.59, Encontrado: %', v_total_receitas;
  END IF;

  IF ABS(v_total_despesas - 137297.65) < 1 THEN
    RAISE NOTICE 'Despesas BATEM com DRE!';
  ELSE
    RAISE WARNING 'Despesas DIFEREM da DRE! Esperado: 137297.65, Encontrado: %', v_total_despesas;
  END IF;
END;
$$;

-- 4. Verificar se há contas de resultado fora do padrão
DO $$
DECLARE
  v_fora RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICANDO CONTAS FORA DO PADRÃO:';
  RAISE NOTICE '========================================';

  -- Contas que começam com número diferente de 1-5
  FOR v_fora IN
    SELECT code, name,
      COALESCE(SUM(ael.debit), 0) as total_debit,
      COALESCE(SUM(ael.credit), 0) as total_credit
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.code !~ '^[1-5]'
    GROUP BY coa.id, coa.code, coa.name
    HAVING COALESCE(SUM(ael.debit), 0) != 0 OR COALESCE(SUM(ael.credit), 0) != 0
  LOOP
    RAISE WARNING 'Conta fora do padrão: % - % (D: % | C: %)',
      v_fora.code, v_fora.name, v_fora.total_debit, v_fora.total_credit;
  END LOOP;
END;
$$;
