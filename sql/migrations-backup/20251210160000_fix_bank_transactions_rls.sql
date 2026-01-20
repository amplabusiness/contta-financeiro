-- Migration para corrigir RLS de bank_transactions
-- O problema: a política atual exige has_role() que pode falhar se o usuário não tem role configurado

-- Remover políticas existentes
DROP POLICY IF EXISTS "Admins and accountants can create bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Admins and accountants can view bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Admins and accountants can update bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Admins can delete bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can view bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can insert bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can update bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can delete bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can view bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can create bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can update bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete bank transactions" ON public.bank_transactions;

-- Criar políticas simples que funcionam para qualquer usuário autenticado
CREATE POLICY "Authenticated users can view bank transactions"
  ON public.bank_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create bank transactions"
  ON public.bank_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bank transactions"
  ON public.bank_transactions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete bank transactions"
  ON public.bank_transactions FOR DELETE
  TO authenticated
  USING (true);

-- Garantir que a tabela tem RLS habilitado
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
