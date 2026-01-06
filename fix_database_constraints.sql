BEGIN;

-- 1. Limpeza: Preencher bank_reference onde está nulo para evitar erros
UPDATE public.bank_transactions
SET bank_reference = 'LEGACY-' || id::text
WHERE bank_reference IS NULL;

-- 2. Limpeza: Remover transações duplicadas baseadas no bank_reference (mantendo a mais recente)
DELETE FROM public.bank_transactions T1
USING   public.bank_transactions T2
WHERE  T1.ctid < T2.ctid       -- deleta a linha "mais antiga" (menor ID físico)
  AND  T1.bank_reference = T2.bank_reference;

-- 3. Criar Índice Único para bank_reference
-- Isso é OBRIGATÓRIO para que o UPSERT do Supabase funcione corretamente sem erro 400.
DROP INDEX IF EXISTS idx_bank_transactions_bank_reference;
CREATE UNIQUE INDEX idx_bank_transactions_bank_reference ON public.bank_transactions(bank_reference);

-- 4. Adicionar Constraint Única explícita (ajuda o PostgREST a encontrar o índice)
ALTER TABLE public.bank_transactions
DROP CONSTRAINT IF EXISTS bank_transactions_bank_reference_key;

ALTER TABLE public.bank_transactions
ADD CONSTRAINT bank_transactions_bank_reference_key UNIQUE USING INDEX idx_bank_transactions_bank_reference;

COMMIT;
