-- =====================================================
-- CORREÇÃO DO SALDO DA CONTA BANCÁRIA
-- =====================================================
-- O current_balance está errado (R$ 585.858,46)
-- Deveria ser R$ 18.553,58 (saldo inicial + movimentações)
-- =====================================================

-- 1. Atualizar o current_balance da conta bancária
UPDATE bank_accounts
SET current_balance = 18553.58
WHERE account_number = '39500000000278068';

-- 2. Verificar
DO $$
DECLARE
  v_account RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTA BANCÁRIA ATUALIZADA:';
  RAISE NOTICE '========================================';

  FOR v_account IN
    SELECT name, bank_name, initial_balance, current_balance
    FROM bank_accounts
  LOOP
    RAISE NOTICE '% (%)', v_account.name, v_account.bank_name;
    RAISE NOTICE '  Saldo Inicial: R$ %', v_account.initial_balance;
    RAISE NOTICE '  Saldo Atual: R$ %', v_account.current_balance;
  END LOOP;
END;
$$;

-- 3. Remover lançamentos duplicados de receita que foram criados incorretamente
-- Esses lançamentos têm entry_type = 'receipt' e transaction_id de transações que
-- agora são negativas (saídas) após a correção de sinais

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  -- Deletar entry lines de lançamentos de receita para transações que são saídas
  DELETE FROM accounting_entry_lines
  WHERE entry_id IN (
    SELECT ae.id
    FROM accounting_entries ae
    JOIN bank_transactions bt ON ae.transaction_id = bt.id
    WHERE ae.entry_type = 'receipt'
      AND bt.amount < 0  -- Transação é saída (negativa)
  );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Entry lines removidas: %', v_deleted;

  -- Deletar as entries
  DELETE FROM accounting_entries
  WHERE id IN (
    SELECT ae.id
    FROM accounting_entries ae
    JOIN bank_transactions bt ON ae.transaction_id = bt.id
    WHERE ae.entry_type = 'receipt'
      AND bt.amount < 0
  );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Entries removidas: %', v_deleted;
END;
$$;

-- 4. Verificar DRE após limpeza
DO $$
DECLARE
  v_total_receitas NUMERIC;
  v_total_despesas NUMERIC;
BEGIN
  SELECT COALESCE(SUM(ael.credit - ael.debit), 0)
  INTO v_total_receitas
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3%';

  SELECT COALESCE(SUM(ael.debit - ael.credit), 0)
  INTO v_total_despesas
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '4%';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DRE APÓS LIMPEZA:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Receitas: R$ %', v_total_receitas;
  RAISE NOTICE 'Despesas: R$ %', v_total_despesas;
  RAISE NOTICE 'Resultado: R$ %', v_total_receitas - v_total_despesas;
  RAISE NOTICE '';
  RAISE NOTICE 'Esperado: Receitas R$ 136821.59, Despesas R$ 137297.65';
END;
$$;

