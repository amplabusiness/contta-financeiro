-- ============================================================================
-- REPARO: Completar marcação de transações processadas
-- ============================================================================
-- A migration anterior falhou - esta completa o trabalho
-- ============================================================================

-- Marcar transações que têm matches múltiplos
UPDATE bank_transactions bt
SET matched = TRUE
WHERE (matched = FALSE OR matched IS NULL)
  AND has_multiple_matches = TRUE;

-- Marcar transações que têm matches na tabela bank_transaction_matches
UPDATE bank_transactions bt
SET matched = TRUE
WHERE (matched = FALSE OR matched IS NULL)
  AND EXISTS (
    SELECT 1 FROM bank_transaction_matches btm
    WHERE btm.bank_transaction_id = bt.id
  );

-- Estatísticas finais
DO $$
DECLARE
  v_total INTEGER;
  v_matched INTEGER;
  v_pending INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM bank_transactions;
  SELECT COUNT(*) INTO v_matched FROM bank_transactions WHERE matched = TRUE;
  SELECT COUNT(*) INTO v_pending FROM bank_transactions WHERE matched = FALSE OR matched IS NULL;

  RAISE NOTICE '=== SITUAÇÃO ATUAL ===';
  RAISE NOTICE 'Total: %, Conciliadas: %, Pendentes: %', v_total, v_matched, v_pending;
END $$;
