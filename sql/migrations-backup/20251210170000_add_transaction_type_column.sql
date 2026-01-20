-- Migration para adicionar coluna transaction_type à tabela bank_transactions
-- A coluna não existia, causando erro PGRST204 na importação OFX

-- Adicionar coluna transaction_type se não existir
ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS transaction_type TEXT CHECK (transaction_type IN ('debit', 'credit'));

-- Adicionar outras colunas que podem estar faltando
ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS fitid TEXT;

ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS matched BOOLEAN DEFAULT false;

ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS bank_reference TEXT;

ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS imported_from TEXT;

-- Criar índice único para evitar duplicatas de OFX
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_fitid_unique
ON public.bank_transactions(bank_account_id, fitid)
WHERE fitid IS NOT NULL;

-- Atualizar transações existentes que não têm transaction_type
-- Inferir baseado na descrição
UPDATE public.bank_transactions
SET transaction_type = 'credit'
WHERE transaction_type IS NULL
  AND (
    description ILIKE '%RECEBIMENTO PIX%'
    OR description ILIKE '%PIX_CRED%'
    OR description ILIKE '%LIQ.COBRANCA%'
  );

UPDATE public.bank_transactions
SET transaction_type = 'debit'
WHERE transaction_type IS NULL;
