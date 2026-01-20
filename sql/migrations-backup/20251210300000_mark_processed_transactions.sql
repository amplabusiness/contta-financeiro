-- ============================================================================
-- CORREÇÃO: Marcar transações bancárias já processadas como conciliadas
-- ============================================================================
-- Problema: Transações que já têm lançamentos contábeis associados ainda
-- aparecem como "pendentes" no Conciliador porque matched = false
-- ============================================================================

-- Passo 1: Estatísticas antes da correção
DO $$
DECLARE
  v_total_transactions INTEGER;
  v_matched INTEGER;
  v_pending INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_transactions FROM bank_transactions;
  SELECT COUNT(*) INTO v_matched FROM bank_transactions WHERE matched = TRUE;
  SELECT COUNT(*) INTO v_pending FROM bank_transactions WHERE matched = FALSE OR matched IS NULL;

  RAISE NOTICE '=== ESTATÍSTICAS DE TRANSAÇÕES BANCÁRIAS ===';
  RAISE NOTICE 'Total de transações: %', v_total_transactions;
  RAISE NOTICE 'Conciliadas (matched=true): %', v_matched;
  RAISE NOTICE 'Pendentes (matched=false/null): %', v_pending;
END $$;

-- Passo 2: Marcar como matched todas as transações que têm lançamentos contábeis
UPDATE bank_transactions bt
SET matched = TRUE
WHERE matched = FALSE
  AND EXISTS (
    SELECT 1 FROM accounting_entries ae
    WHERE ae.reference_type = 'bank_transaction'
      AND ae.reference_id = bt.id
  );

-- Passo 3: Marcar transações que têm matches múltiplos
UPDATE bank_transactions bt
SET matched = TRUE
WHERE matched = FALSE
  AND has_multiple_matches = TRUE;

-- Passo 4: Marcar transações que têm matches na tabela bank_transaction_matches
UPDATE bank_transactions bt
SET matched = TRUE
WHERE matched = FALSE
  AND EXISTS (
    SELECT 1 FROM bank_transaction_matches btm
    WHERE btm.bank_transaction_id = bt.id
  );

-- Passo 5: Estatísticas finais
DO $$
DECLARE
  v_total_transactions INTEGER;
  v_matched INTEGER;
  v_pending INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_transactions FROM bank_transactions;
  SELECT COUNT(*) INTO v_matched FROM bank_transactions WHERE matched = TRUE;
  SELECT COUNT(*) INTO v_pending FROM bank_transactions WHERE matched = FALSE OR matched IS NULL;

  RAISE NOTICE '=== APÓS CORREÇÃO ===';
  RAISE NOTICE 'Conciliadas: %', v_matched;
  RAISE NOTICE 'Pendentes: %', v_pending;
END $$;

-- ============================================================================
-- COMENTÁRIO
-- ============================================================================
COMMENT ON TABLE bank_transactions IS 'Transações bancárias importadas - matched indica se já foi conciliada';
