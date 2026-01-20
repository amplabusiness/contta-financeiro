-- =====================================================
-- CONTINUAÇÃO DA CORREÇÃO DO BALANÇO PATRIMONIAL
-- =====================================================

-- 1. Desativar contas de Caixa (empresa não usa dinheiro físico)
UPDATE chart_of_accounts
SET is_active = false
WHERE code IN ('1.1.1.01', '1.1.01.001')
  AND LOWER(name) LIKE '%caixa%';

-- 2. VERIFICAR contas de Saldo de Abertura no PL
DO $$
DECLARE
  v_saldo RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTAS DE SALDO DE ABERTURA NO PL:';
  RAISE NOTICE '========================================';

  FOR v_saldo IN
    SELECT
      coa.id,
      coa.code,
      coa.name,
      COALESCE(SUM(ael.debit), 0) as total_debit,
      COALESCE(SUM(ael.credit), 0) as total_credit
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.code LIKE '5.3.02%' OR coa.code LIKE '5.2.1.02%'
    GROUP BY coa.id, coa.code, coa.name
    ORDER BY coa.code
  LOOP
    RAISE NOTICE 'Conta: % - % | D: % | C: %',
      v_saldo.code, v_saldo.name, v_saldo.total_debit, v_saldo.total_credit;
  END LOOP;
END;
$$;

-- 3. ANALISAR: Ver todas as contas com saldo no PL (grupo 5)
DO $$
DECLARE
  v_pl RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTAS DO PATRIMÔNIO LÍQUIDO COM SALDO:';
  RAISE NOTICE '========================================';

  FOR v_pl IN
    SELECT
      coa.code,
      coa.name,
      COALESCE(SUM(ael.credit - ael.debit), 0) as saldo
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.code LIKE '5%'
    GROUP BY coa.id, coa.code, coa.name
    HAVING COALESCE(SUM(ael.credit - ael.debit), 0) != 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% - %: R$ %', v_pl.code, v_pl.name, v_pl.saldo;
  END LOOP;
END;
$$;

-- 4. VERIFICAR: Lançamentos órfãos (sem conta válida)
DO $$
DECLARE
  v_orfao_count INTEGER;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(ael.debit), 0),
    COALESCE(SUM(ael.credit), 0)
  INTO v_orfao_count, v_total_debit, v_total_credit
  FROM accounting_entry_lines ael
  LEFT JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.id IS NULL;

  IF v_orfao_count > 0 THEN
    RAISE WARNING '[PROBLEMA] Encontrados % lançamentos órfãos (conta não existe)', v_orfao_count;
    RAISE NOTICE '  Total Débitos órfãos: R$ %', v_total_debit;
    RAISE NOTICE '  Total Créditos órfãos: R$ %', v_total_credit;
  ELSE
    RAISE NOTICE 'Nenhum lançamento órfão encontrado';
  END IF;
END;
$$;

-- 5. VERIFICAR: Contas desativadas com saldo
DO $$
DECLARE
  v_inativa RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTAS DESATIVADAS COM SALDO:';
  RAISE NOTICE '========================================';

  FOR v_inativa IN
    SELECT
      coa.code,
      coa.name,
      COALESCE(SUM(ael.debit), 0) as total_debit,
      COALESCE(SUM(ael.credit), 0) as total_credit
    FROM chart_of_accounts coa
    JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.is_active = false
    GROUP BY coa.id, coa.code, coa.name
    HAVING COALESCE(SUM(ael.debit), 0) != 0 OR COALESCE(SUM(ael.credit), 0) != 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% - %: D=% C=%', v_inativa.code, v_inativa.name, v_inativa.total_debit, v_inativa.total_credit;
  END LOOP;
END;
$$;

-- 6. DESATIVAR contas antigas do padrão 1.1.01.xxx e 1.1.02.xxx sem lançamentos
DO $$
DECLARE
  v_old RECORD;
  v_entry_count INTEGER;
  v_desativadas INTEGER := 0;
BEGIN
  FOR v_old IN
    SELECT id, code, name
    FROM chart_of_accounts
    WHERE (code LIKE '1.1.01%' OR code LIKE '1.1.02%')
      AND is_active = true
  LOOP
    SELECT COUNT(*) INTO v_entry_count
    FROM accounting_entry_lines
    WHERE account_id = v_old.id;

    IF v_entry_count = 0 THEN
      UPDATE chart_of_accounts SET is_active = false WHERE id = v_old.id;
      v_desativadas := v_desativadas + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '[Limpeza] % contas antigas desativadas', v_desativadas;
END;
$$;

-- 7. RESUMO FINAL DO BALANÇO
DO $$
DECLARE
  v_total_ativo NUMERIC;
  v_total_passivo NUMERIC;
  v_total_receitas NUMERIC;
  v_total_despesas NUMERIC;
  v_total_pl NUMERIC;
  v_resultado NUMERIC;
  v_diferenca NUMERIC;
BEGIN
  -- Total Ativo (contas 1.x): D - C
  SELECT COALESCE(SUM(ael.debit - ael.credit), 0)
  INTO v_total_ativo
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '1%';

  -- Total Passivo (contas 2.x): C - D
  SELECT COALESCE(SUM(ael.credit - ael.debit), 0)
  INTO v_total_passivo
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '2%';

  -- Total Receitas (contas 3.x): C - D
  SELECT COALESCE(SUM(ael.credit - ael.debit), 0)
  INTO v_total_receitas
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3%';

  -- Total Despesas (contas 4.x): D - C
  SELECT COALESCE(SUM(ael.debit - ael.credit), 0)
  INTO v_total_despesas
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4%';

  -- Total PL puro (contas 5.x): C - D
  SELECT COALESCE(SUM(ael.credit - ael.debit), 0)
  INTO v_total_pl
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '5%';

  v_resultado := v_total_receitas - v_total_despesas;
  v_diferenca := v_total_ativo - (v_total_passivo + v_total_pl + v_resultado);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'BALANÇO PATRIMONIAL - RESUMO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ATIVO:';
  RAISE NOTICE '  Total Ativo: R$ %', v_total_ativo;
  RAISE NOTICE '';
  RAISE NOTICE 'PASSIVO:';
  RAISE NOTICE '  Total Passivo: R$ %', v_total_passivo;
  RAISE NOTICE '';
  RAISE NOTICE 'PATRIMÔNIO LÍQUIDO:';
  RAISE NOTICE '  PL (contas 5.x): R$ %', v_total_pl;
  RAISE NOTICE '  Receitas (3.x): R$ %', v_total_receitas;
  RAISE NOTICE '  Despesas (4.x): R$ %', v_total_despesas;
  RAISE NOTICE '  Resultado: R$ %', v_resultado;
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICAÇÃO:';
  RAISE NOTICE '  Passivo + PL + Resultado: R$ %', v_total_passivo + v_total_pl + v_resultado;
  RAISE NOTICE '  Diferença: R$ %', v_diferenca;
  RAISE NOTICE '========================================';

  IF ABS(v_diferenca) < 0.01 THEN
    RAISE NOTICE 'BALANÇO EQUILIBRADO!';
  ELSE
    RAISE WARNING 'BALANÇO DESBALANCEADO!';
    RAISE NOTICE 'A diferença pode ser causada por:';
    RAISE NOTICE '1. Saldos de abertura incorretos';
    RAISE NOTICE '2. Lançamentos não balanceados';
    RAISE NOTICE '3. Contas classificadas incorretamente';
  END IF;
END;
$$;
