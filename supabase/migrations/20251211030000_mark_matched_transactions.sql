-- =====================================================
-- MARCAR TRANSAÇÕES JÁ CONCILIADAS
-- Transações que já possuem match na tabela bank_transaction_matches
-- devem ter matched = true para não aparecer no Conciliador
-- =====================================================

-- 1. Marcar transações que já têm registro em bank_transaction_matches
UPDATE bank_transactions bt
SET matched = true
WHERE matched = false
  AND EXISTS (
    SELECT 1 FROM bank_transaction_matches btm
    WHERE btm.bank_transaction_id = bt.id
  );

-- 2. Marcar transações de débito que correspondem a despesas PAGAS
-- Vinculando por valor e data aproximada (mesmo mês)
WITH matched_expenses AS (
  SELECT DISTINCT bt.id AS transaction_id
  FROM bank_transactions bt
  INNER JOIN expenses e ON
    ABS(bt.amount) = e.amount
    AND bt.transaction_type = 'debit'
    AND e.status = 'paid'
    AND bt.transaction_date >= e.due_date - INTERVAL '7 days'
    AND bt.transaction_date <= e.due_date + INTERVAL '7 days'
  WHERE bt.matched = false
)
UPDATE bank_transactions bt
SET matched = true
FROM matched_expenses me
WHERE bt.id = me.transaction_id;

-- 3. Marcar transações de crédito que correspondem a faturas PAGAS
WITH matched_invoices AS (
  SELECT DISTINCT bt.id AS transaction_id
  FROM bank_transactions bt
  INNER JOIN invoices i ON
    ABS(bt.amount) = i.amount
    AND bt.transaction_type = 'credit'
    AND i.status = 'paid'
    AND bt.transaction_date >= i.due_date - INTERVAL '7 days'
    AND bt.transaction_date <= i.due_date + INTERVAL '7 days'
  WHERE bt.matched = false
)
UPDATE bank_transactions bt
SET matched = true
FROM matched_invoices mi
WHERE bt.id = mi.transaction_id;

-- 4. Relatório das transações marcadas
DO $$
DECLARE
  v_matched_count INTEGER;
  v_pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_matched_count FROM bank_transactions WHERE matched = true;
  SELECT COUNT(*) INTO v_pending_count FROM bank_transactions WHERE matched = false;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'CONCILIAÇÃO AUTOMÁTICA EXECUTADA';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Transações conciliadas: %', v_matched_count;
  RAISE NOTICE 'Transações pendentes: %', v_pending_count;
  RAISE NOTICE '==========================================';
END $$;
