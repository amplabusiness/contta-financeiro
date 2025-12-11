-- =====================================================
-- DR. CÍCERO: SISTEMA DE CONCILIAÇÃO AUTOMÁTICA
-- =====================================================
-- O Dr. Cícero agora tem mais autonomia para:
-- 1. Detectar automaticamente despesas aprovadas/pagas
-- 2. Vincular transações bancárias com despesas
-- 3. Marcar transações como conciliadas automaticamente
-- =====================================================

-- Adicionar coluna ai_suggestion se não existir
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS ai_suggestion TEXT;

-- =====================================================
-- FUNÇÃO: Conciliar despesa paga com transação bancária
-- =====================================================
CREATE OR REPLACE FUNCTION auto_reconcile_expense_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id UUID;
  v_match_found BOOLEAN := false;
BEGIN
  -- Só executa quando despesa muda para status 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN

    -- Buscar transação bancária correspondente
    -- Critérios: mesmo valor, tipo débito, data próxima (±7 dias)
    SELECT bt.id INTO v_transaction_id
    FROM bank_transactions bt
    WHERE bt.transaction_type = 'debit'
      AND ABS(bt.amount) = NEW.amount
      AND bt.matched = false
      AND bt.transaction_date >= COALESCE(NEW.payment_date, NEW.due_date) - INTERVAL '7 days'
      AND bt.transaction_date <= COALESCE(NEW.payment_date, NEW.due_date) + INTERVAL '7 days'
    ORDER BY ABS(bt.transaction_date - COALESCE(NEW.payment_date, NEW.due_date))
    LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
      -- Marcar transação como conciliada
      UPDATE bank_transactions
      SET matched = true,
          ai_suggestion = 'Dr. Cícero: Conciliado automaticamente com despesa paga #' || NEW.id::TEXT
      WHERE id = v_transaction_id;

      -- Criar registro de match
      INSERT INTO bank_transaction_matches (
        bank_transaction_id,
        expense_id,
        amount,
        description,
        confidence,
        created_by
      ) VALUES (
        v_transaction_id,
        NEW.id,
        NEW.amount,
        'Dr. Cícero: Conciliação automática - Despesa paga',
        0.95,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID)
      );

      v_match_found := true;

      RAISE NOTICE 'Dr. Cícero: Despesa % conciliada automaticamente com transação %', NEW.id, v_transaction_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela expenses
DROP TRIGGER IF EXISTS trigger_auto_reconcile_expense ON expenses;
CREATE TRIGGER trigger_auto_reconcile_expense
  AFTER UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_reconcile_expense_payment();

-- =====================================================
-- FUNÇÃO: Conciliar nova transação bancária com despesas existentes
-- =====================================================
CREATE OR REPLACE FUNCTION auto_reconcile_new_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_expense_id UUID;
  v_match_found BOOLEAN := false;
BEGIN
  -- Só executa para transações novas de débito não conciliadas
  IF NEW.transaction_type = 'debit' AND NEW.matched = false THEN

    -- Buscar despesa correspondente
    -- Critérios: mesmo valor, status paid, data próxima (±7 dias)
    SELECT e.id INTO v_expense_id
    FROM expenses e
    WHERE e.amount = ABS(NEW.amount)
      AND e.status = 'paid'
      AND COALESCE(e.payment_date, e.due_date) >= NEW.transaction_date - INTERVAL '7 days'
      AND COALESCE(e.payment_date, e.due_date) <= NEW.transaction_date + INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM bank_transaction_matches btm
        WHERE btm.expense_id = e.id
      )
    ORDER BY ABS(COALESCE(e.payment_date, e.due_date) - NEW.transaction_date)
    LIMIT 1;

    IF v_expense_id IS NOT NULL THEN
      -- Marcar transação como conciliada
      NEW.matched := true;
      NEW.ai_suggestion := 'Dr. Cícero: Conciliado automaticamente com despesa existente #' || v_expense_id::TEXT;

      -- Criar registro de match
      INSERT INTO bank_transaction_matches (
        bank_transaction_id,
        expense_id,
        amount,
        description,
        confidence,
        created_by
      ) VALUES (
        NEW.id,
        v_expense_id,
        ABS(NEW.amount),
        'Dr. Cícero: Conciliação automática - Transação importada',
        0.95,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID)
      );

      v_match_found := true;

      RAISE NOTICE 'Dr. Cícero: Transação % conciliada automaticamente com despesa %', NEW.id, v_expense_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela bank_transactions
DROP TRIGGER IF EXISTS trigger_auto_reconcile_transaction ON bank_transactions;
CREATE TRIGGER trigger_auto_reconcile_transaction
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_reconcile_new_transaction();

-- =====================================================
-- FUNÇÃO: Conciliar fatura paga com transação bancária (crédito)
-- =====================================================
CREATE OR REPLACE FUNCTION auto_reconcile_invoice_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Só executa quando fatura muda para status 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN

    -- Buscar transação bancária correspondente
    SELECT bt.id INTO v_transaction_id
    FROM bank_transactions bt
    WHERE bt.transaction_type = 'credit'
      AND ABS(bt.amount) = NEW.amount
      AND bt.matched = false
      AND bt.transaction_date >= NEW.due_date - INTERVAL '7 days'
      AND bt.transaction_date <= NEW.due_date + INTERVAL '7 days'
    ORDER BY ABS(bt.transaction_date - NEW.due_date)
    LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
      -- Marcar transação como conciliada
      UPDATE bank_transactions
      SET matched = true,
          ai_suggestion = 'Dr. Cícero: Conciliado automaticamente com fatura paga #' || NEW.id::TEXT
      WHERE id = v_transaction_id;

      -- Criar registro de match
      INSERT INTO bank_transaction_matches (
        bank_transaction_id,
        invoice_id,
        client_id,
        amount,
        description,
        confidence,
        created_by
      ) VALUES (
        v_transaction_id,
        NEW.id,
        NEW.client_id,
        NEW.amount,
        'Dr. Cícero: Conciliação automática - Fatura paga',
        0.95,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID)
      );

      RAISE NOTICE 'Dr. Cícero: Fatura % conciliada automaticamente com transação %', NEW.id, v_transaction_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela invoices
DROP TRIGGER IF EXISTS trigger_auto_reconcile_invoice ON invoices;
CREATE TRIGGER trigger_auto_reconcile_invoice
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_reconcile_invoice_payment();

-- =====================================================
-- CONCILIAÇÃO RETROATIVA: Aplicar para transações existentes
-- =====================================================
DO $$
DECLARE
  v_matched_expenses INTEGER := 0;
  v_matched_invoices INTEGER := 0;
BEGIN
  -- Conciliar despesas pagas existentes
  WITH matches AS (
    SELECT DISTINCT ON (bt.id)
      bt.id AS transaction_id,
      e.id AS expense_id,
      e.amount
    FROM bank_transactions bt
    INNER JOIN expenses e ON
      ABS(bt.amount) = e.amount
      AND bt.transaction_type = 'debit'
      AND e.status = 'paid'
      AND bt.transaction_date >= COALESCE(e.payment_date, e.due_date) - INTERVAL '7 days'
      AND bt.transaction_date <= COALESCE(e.payment_date, e.due_date) + INTERVAL '7 days'
    WHERE bt.matched = false
    ORDER BY bt.id, ABS(bt.transaction_date - COALESCE(e.payment_date, e.due_date))
  )
  UPDATE bank_transactions bt
  SET matched = true,
      ai_suggestion = 'Dr. Cícero: Conciliado retroativamente com despesa paga'
  FROM matches m
  WHERE bt.id = m.transaction_id;

  GET DIAGNOSTICS v_matched_expenses = ROW_COUNT;

  -- Conciliar faturas pagas existentes
  WITH matches AS (
    SELECT DISTINCT ON (bt.id)
      bt.id AS transaction_id,
      i.id AS invoice_id,
      i.amount
    FROM bank_transactions bt
    INNER JOIN invoices i ON
      ABS(bt.amount) = i.amount
      AND bt.transaction_type = 'credit'
      AND i.status = 'paid'
      AND bt.transaction_date >= i.due_date - INTERVAL '7 days'
      AND bt.transaction_date <= i.due_date + INTERVAL '7 days'
    WHERE bt.matched = false
    ORDER BY bt.id, ABS(bt.transaction_date - i.due_date)
  )
  UPDATE bank_transactions bt
  SET matched = true,
      ai_suggestion = 'Dr. Cícero: Conciliado retroativamente com fatura paga'
  FROM matches m
  WHERE bt.id = m.transaction_id;

  GET DIAGNOSTICS v_matched_invoices = ROW_COUNT;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'DR. CÍCERO: CONCILIAÇÃO RETROATIVA';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Despesas conciliadas: %', v_matched_expenses;
  RAISE NOTICE 'Faturas conciliadas: %', v_matched_invoices;
  RAISE NOTICE 'Total: %', v_matched_expenses + v_matched_invoices;
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Triggers instalados para conciliação automática futura';
  RAISE NOTICE '==========================================';
END $$;

COMMENT ON FUNCTION auto_reconcile_expense_payment() IS 'Dr. Cícero: Concilia automaticamente despesas pagas com transações bancárias';
COMMENT ON FUNCTION auto_reconcile_new_transaction() IS 'Dr. Cícero: Concilia automaticamente novas transações com despesas existentes';
COMMENT ON FUNCTION auto_reconcile_invoice_payment() IS 'Dr. Cícero: Concilia automaticamente faturas pagas com transações bancárias';
