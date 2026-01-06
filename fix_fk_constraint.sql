BEGIN;

-- 1. Remover a constraint errada que aponta para 'journal_entries' (tabela antiga/incorreta neste contexto)
ALTER TABLE public.bank_transactions 
DROP CONSTRAINT IF EXISTS bank_transactions_journal_entry_id_fkey;

-- 2. Adicionar a constraint correta apontando para 'accounting_entries'
-- O trigger 'tr_auto_entry_bank_transaction' gera registros em accounting_entries.
ALTER TABLE public.bank_transactions
ADD CONSTRAINT bank_transactions_journal_entry_id_fkey 
FOREIGN KEY (journal_entry_id) 
REFERENCES public.accounting_entries(id)
ON DELETE SET NULL;

COMMIT;
