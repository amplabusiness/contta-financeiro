
-- ============================================================================
-- Correção de Políticas RLS Permissivas
-- ============================================================================
-- Problema: Tabelas bank_accounts e bank_imports permitem acesso irrestrito
-- com USING (true), permitindo que qualquer usuário autenticado veja/modifique
-- todos os dados bancários de todos os clientes.
-- ============================================================================

-- Remover políticas permissivas de bank_accounts
DROP POLICY IF EXISTS "Users can view bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can delete bank accounts" ON public.bank_accounts;

-- Criar políticas restritas baseadas em roles para bank_accounts
CREATE POLICY "Admins and accountants can view bank accounts"
ON public.bank_accounts FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can update bank accounts"
ON public.bank_accounts FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete bank accounts"
ON public.bank_accounts FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Remover políticas permissivas de bank_imports
DROP POLICY IF EXISTS "Users can view bank imports" ON public.bank_imports;
DROP POLICY IF EXISTS "Users can update bank imports" ON public.bank_imports;
DROP POLICY IF EXISTS "Users can delete bank imports" ON public.bank_imports;

-- Criar políticas restritas baseadas em roles para bank_imports
CREATE POLICY "Admins and accountants can view bank imports"
ON public.bank_imports FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can update bank imports"
ON public.bank_imports FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete bank imports"
ON public.bank_imports FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Adicionar política INSERT que estava faltando em bank_accounts
CREATE POLICY "Admins and accountants can create bank accounts"
ON public.bank_accounts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant'));

-- Adicionar política INSERT que estava faltando em bank_imports
CREATE POLICY "Admins and accountants can create bank imports"
ON public.bank_imports FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant'));
