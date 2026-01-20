-- =====================================================
-- CORRIGIR POLÍTICAS RLS PARA CHART_OF_ACCOUNTS
-- Permitir leitura pública do plano de contas
-- =====================================================

BEGIN;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Usuários autenticados podem ver plano de contas" ON chart_of_accounts;
DROP POLICY IF EXISTS "Allow authenticated users to read chart_of_accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "chart_of_accounts_select_policy" ON chart_of_accounts;

-- Criar política permissiva para leitura
CREATE POLICY "chart_of_accounts_public_read"
ON chart_of_accounts
FOR SELECT
USING (true);

-- Verificar que RLS está habilitado
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Também corrigir para accounting_entries e accounting_entry_lines
DROP POLICY IF EXISTS "accounting_entries_select_policy" ON accounting_entries;
DROP POLICY IF EXISTS "accounting_entry_lines_select_policy" ON accounting_entry_lines;

-- Políticas para accounting_entries
CREATE POLICY "accounting_entries_public_read"
ON accounting_entries
FOR SELECT
USING (true);

-- Políticas para accounting_entry_lines
CREATE POLICY "accounting_entry_lines_public_read"
ON accounting_entry_lines
FOR SELECT
USING (true);

COMMIT;
