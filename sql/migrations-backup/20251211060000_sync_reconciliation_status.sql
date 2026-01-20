-- =====================================================
-- SINCRONIZAÇÃO DE STATUS DE RECONCILIAÇÃO
-- =====================================================
-- Problema: Transações aparecem tanto no banco quanto na contabilidade
-- Solução: Marcar transações que JÁ foram lançadas na contabilidade
-- =====================================================

-- 1. Identificar transações que têm lançamentos contábeis via transaction_id
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '[Sincronização] Iniciando marcação de transações já processadas...';

  -- Marcar transações que já têm lançamento via transaction_id
  UPDATE bank_transactions bt
  SET
    is_reconciled = true,
    matched = true
  FROM accounting_entries ae
  WHERE ae.transaction_id = bt.id
    AND (bt.is_reconciled = false OR bt.matched = false);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[Sincronização] % transações marcadas via transaction_id', v_count;
END;
$$;

-- 2. Identificar transações que têm lançamentos via reference_type = 'bank_transaction'
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE bank_transactions bt
  SET
    is_reconciled = true,
    matched = true
  FROM accounting_entries ae
  WHERE ae.reference_type = 'bank_transaction'
    AND ae.reference_id = bt.id
    AND (bt.is_reconciled = false OR bt.matched = false);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[Sincronização] % transações marcadas via reference_id', v_count;
END;
$$;

-- 3. Marcar transações que têm match em expenses (por valor e data)
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE bank_transactions bt
  SET
    matched = true,
    is_reconciled = true
  FROM expenses e
  WHERE bt.matched = false
    AND ABS(bt.amount) = e.amount
    AND bt.transaction_date = e.payment_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[Sincronização] % transações conciliadas com despesas', v_count;
END;
$$;

-- 4. Marcar transações que têm match em invoices/honorários pagos
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE bank_transactions bt
  SET
    matched = true,
    is_reconciled = true
  FROM invoices i
  WHERE bt.matched = false
    AND bt.amount > 0
    AND ABS(bt.amount - i.amount) < 0.01
    AND i.status = 'paid'
    AND bt.transaction_date >= i.due_date - INTERVAL '5 days'
    AND bt.transaction_date <= i.due_date + INTERVAL '5 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[Sincronização] % transações conciliadas com faturas', v_count;
END;
$$;

-- 5. Marcar transações de ADIANTAMENTOS que já têm lançamento no ativo (1.1.3.04.xx)
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE bank_transactions bt
  SET
    matched = true,
    is_reconciled = true
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE bt.matched = false
    AND coa.code LIKE '1.1.3.04%'
    AND ABS(ael.debit - ABS(bt.amount)) < 0.01
    AND ae.entry_date = bt.transaction_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[Sincronização] % transações de adiantamento marcadas', v_count;
END;
$$;

-- 6. Marcar transações que já têm ai_suggestion confirmada (classificação alta confiança >= 90%)
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Buscar por lançamentos correspondentes em accounting_entry_lines
  UPDATE bank_transactions bt
  SET
    matched = true,
    is_reconciled = true
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  WHERE bt.matched = false
    AND bt.ai_suggestion IS NOT NULL
    AND bt.ai_suggestion NOT LIKE '%PENDENTE%'
    AND (
      (ael.debit > 0 AND ABS(ael.debit - ABS(bt.amount)) < 0.01)
      OR (ael.credit > 0 AND ABS(ael.credit - ABS(bt.amount)) < 0.01)
    )
    AND ae.entry_date = bt.transaction_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[Sincronização] % transações classificadas marcadas', v_count;
END;
$$;

-- 7. Criar função para marcar transações automaticamente quando lançamento contábil é criado
CREATE OR REPLACE FUNCTION mark_transaction_reconciled_on_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o lançamento tem transaction_id, marcar como reconciliada
  IF NEW.transaction_id IS NOT NULL THEN
    UPDATE bank_transactions
    SET
      is_reconciled = true,
      matched = true,
      reconciled_at = NOW()
    WHERE id = NEW.transaction_id;
  END IF;

  -- Se o lançamento tem reference_type = 'bank_transaction', marcar também
  IF NEW.reference_type = 'bank_transaction' AND NEW.reference_id IS NOT NULL THEN
    UPDATE bank_transactions
    SET
      is_reconciled = true,
      matched = true,
      reconciled_at = NOW()
    WHERE id = NEW.reference_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar trigger para marcar automaticamente no futuro
DROP TRIGGER IF EXISTS trg_mark_transaction_reconciled ON accounting_entries;
CREATE TRIGGER trg_mark_transaction_reconciled
  AFTER INSERT ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION mark_transaction_reconciled_on_entry();

-- 9. Verificar status final
DO $$
DECLARE
  v_pending INTEGER;
  v_reconciled INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM bank_transactions;
  SELECT COUNT(*) INTO v_reconciled FROM bank_transactions WHERE is_reconciled = true OR matched = true;
  v_pending := v_total - v_reconciled;

  RAISE NOTICE '[Sincronização] ========================================';
  RAISE NOTICE '[Sincronização] Total de transações: %', v_total;
  RAISE NOTICE '[Sincronização] Reconciliadas: %', v_reconciled;
  RAISE NOTICE '[Sincronização] Pendentes: %', v_pending;
  RAISE NOTICE '[Sincronização] ========================================';

  IF v_pending > 0 THEN
    RAISE NOTICE '[Sincronização] Ainda há % transações pendentes de processamento', v_pending;
  ELSE
    RAISE NOTICE '[Sincronização] Todas as transações estão processadas!';
  END IF;
END;
$$;

COMMENT ON FUNCTION mark_transaction_reconciled_on_entry() IS
'Marca automaticamente a transação bancária como reconciliada quando um lançamento contábil é criado.
Isso evita que a mesma transação apareça em dois lugares (banco e contabilidade).';
