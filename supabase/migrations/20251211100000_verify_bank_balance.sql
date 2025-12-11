-- =====================================================
-- VERIFICAÇÃO: SALDO BANCÁRIO BATE COM EXTRATO?
-- =====================================================

-- 1. Ver saldo atual na contabilidade (conta 1.1.1.02 - Bancos Conta Movimento)
DO $$
DECLARE
  v_banco_id UUID;
  v_saldo_contabil NUMERIC;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  SELECT id INTO v_banco_id
  FROM chart_of_accounts
  WHERE code = '1.1.1.02';

  IF v_banco_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM accounting_entry_lines
    WHERE account_id = v_banco_id;

    v_saldo_contabil := v_total_debit - v_total_credit;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONTA 1.1.1.02 - Bancos Conta Movimento:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '  Total Débitos: R$ %', v_total_debit;
    RAISE NOTICE '  Total Créditos: R$ %', v_total_credit;
    RAISE NOTICE '  SALDO CONTÁBIL: R$ %', v_saldo_contabil;
  ELSE
    RAISE WARNING 'Conta 1.1.1.02 não encontrada!';
  END IF;
END;
$$;

-- 2. Ver saldo nas transações bancárias (bank_transactions)
DO $$
DECLARE
  v_account RECORD;
  v_saldo_extrato NUMERIC;
  v_total_creditos NUMERIC;
  v_total_debitos NUMERIC;
  v_qtd_transacoes INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SALDO POR CONTA BANCÁRIA (bank_transactions):';
  RAISE NOTICE '========================================';

  FOR v_account IN
    SELECT
      ba.id,
      ba.name,
      ba.bank_name,
      ba.account_number,
      COALESCE(SUM(CASE WHEN bt.amount > 0 THEN bt.amount ELSE 0 END), 0) as total_creditos,
      COALESCE(SUM(CASE WHEN bt.amount < 0 THEN bt.amount ELSE 0 END), 0) as total_debitos,
      COALESCE(SUM(bt.amount), 0) as saldo,
      COUNT(bt.id) as qtd
    FROM bank_accounts ba
    LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id
    GROUP BY ba.id, ba.name, ba.bank_name, ba.account_number
    ORDER BY ba.name
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '% (%)', v_account.name, v_account.bank_name;
    RAISE NOTICE '  Conta: %', v_account.account_number;
    RAISE NOTICE '  Transações: %', v_account.qtd;
    RAISE NOTICE '  Créditos: R$ %', v_account.total_creditos;
    RAISE NOTICE '  Débitos: R$ %', v_account.total_debitos;
    RAISE NOTICE '  SALDO: R$ %', v_account.saldo;
  END LOOP;
END;
$$;

-- 3. Verificar se há saldo de abertura registrado nas contas bancárias
DO $$
DECLARE
  v_account RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SALDO INICIAL CONFIGURADO (bank_accounts):';
  RAISE NOTICE '========================================';

  FOR v_account IN
    SELECT name, bank_name, initial_balance, current_balance
    FROM bank_accounts
    ORDER BY name
  LOOP
    RAISE NOTICE '% (%): Inicial=R$ % | Atual=R$ %',
      v_account.name, v_account.bank_name,
      COALESCE(v_account.initial_balance, 0),
      COALESCE(v_account.current_balance, 0);
  END LOOP;
END;
$$;

-- 4. Comparar saldo contábil vs saldo do extrato
DO $$
DECLARE
  v_saldo_contabil NUMERIC;
  v_saldo_transacoes NUMERIC;
  v_saldo_abertura_pl NUMERIC;
  v_diferenca NUMERIC;
BEGIN
  -- Saldo na conta contábil de bancos
  SELECT COALESCE(SUM(ael.debit - ael.credit), 0)
  INTO v_saldo_contabil
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02';

  -- Saldo total das transações bancárias
  SELECT COALESCE(SUM(amount), 0)
  INTO v_saldo_transacoes
  FROM bank_transactions;

  -- Saldo de abertura no PL (5.3.02.01 - Disponibilidades)
  SELECT COALESCE(SUM(ael.credit - ael.debit), 0)
  INTO v_saldo_abertura_pl
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '5.3.02.01';

  v_diferenca := v_saldo_contabil - v_saldo_transacoes;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COMPARAÇÃO DE SALDOS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Contábil (1.1.1.02): R$ %', v_saldo_contabil;
  RAISE NOTICE 'Saldo Transações (bank_transactions): R$ %', v_saldo_transacoes;
  RAISE NOTICE 'Saldo Abertura PL (5.3.02.01): R$ %', v_saldo_abertura_pl;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Diferença Contábil vs Transações: R$ %', v_diferenca;

  IF ABS(v_diferenca) < 0.01 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'SALDOS CONFEREM!';
  ELSE
    RAISE NOTICE '';
    RAISE WARNING 'SALDOS NÃO CONFEREM!';
    RAISE NOTICE 'Possíveis causas:';
    RAISE NOTICE '1. Saldo de abertura não considerado nas transações';
    RAISE NOTICE '2. Transações não lançadas na contabilidade';
    RAISE NOTICE '3. Lançamentos contábeis sem transação correspondente';
  END IF;
END;
$$;

-- 5. Verificar transações não lançadas na contabilidade
DO $$
DECLARE
  v_nao_lancadas INTEGER;
  v_valor_nao_lancado NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(ABS(bt.amount)), 0)
  INTO v_nao_lancadas, v_valor_nao_lancado
  FROM bank_transactions bt
  WHERE bt.is_reconciled = false
    AND bt.matched = false;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES PENDENTES DE LANÇAMENTO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Quantidade: %', v_nao_lancadas;
  RAISE NOTICE 'Valor Total: R$ %', v_valor_nao_lancado;

  IF v_nao_lancadas > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Estas transações ainda não foram lançadas na contabilidade.';
    RAISE NOTICE 'O Dr. Cícero deve processá-las para manter os saldos sincronizados.';
  END IF;
END;
$$;
