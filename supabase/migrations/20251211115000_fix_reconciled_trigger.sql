-- =====================================================
-- CORREÇÃO DO TRIGGER DE RECONCILIAÇÃO
-- =====================================================
-- Remover referência a coluna reconciled_at que não existe

CREATE OR REPLACE FUNCTION mark_transaction_reconciled_on_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o lançamento tem transaction_id, marcar como reconciliada
  IF NEW.transaction_id IS NOT NULL THEN
    UPDATE bank_transactions
    SET
      is_reconciled = true,
      matched = true
    WHERE id = NEW.transaction_id;
  END IF;

  -- Se o lançamento tem reference_type = 'bank_transaction', marcar também
  IF NEW.reference_type = 'bank_transaction' AND NEW.reference_id IS NOT NULL THEN
    UPDATE bank_transactions
    SET
      is_reconciled = true,
      matched = true
    WHERE id = NEW.reference_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_transaction_reconciled_on_entry() IS
'Marca automaticamente a transação bancária como reconciliada quando um lançamento contábil é criado.';

