-- ============================================================================
-- DESABILITAR TRIGGER PROBLEMÁTICO EM BANK_TRANSACTIONS
-- Data: 2026-01-11
--
-- PROBLEMA: O trigger tenta inserir em accounting_entries com coluna client_id
-- que não existe na tabela accounting_entries.
-- ============================================================================

-- Desabilitar todos os triggers em bank_transactions que criam lançamentos
DROP TRIGGER IF EXISTS trg_auto_accounting_bank_transaction ON bank_transactions;
DROP TRIGGER IF EXISTS trg_bank_transaction_accounting ON bank_transactions;
DROP TRIGGER IF EXISTS trigger_bank_transaction_to_accounting ON bank_transactions;
DROP TRIGGER IF EXISTS bank_transaction_auto_entry ON bank_transactions;

-- Verificação
DO $$
BEGIN
  RAISE NOTICE 'Triggers de bank_transactions desabilitados.';
  RAISE NOTICE 'As transações bancárias agora podem ser importadas sem gerar lançamentos automáticos.';
END $$;
