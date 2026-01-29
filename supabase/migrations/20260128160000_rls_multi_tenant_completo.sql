-- =====================================================
-- RLS MULTI-TENANT COMPLETO (Seção 12)
-- Data: 2026-01-28
-- Objetivo: Garantir isolamento total por tenant
-- =====================================================

-- 1. FUNÇÃO HELPER PARA OBTER TENANT DO USUÁRIO
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Buscar tenant_id do usuário atual
  SELECT tu.tenant_id INTO v_tenant_id
  FROM tenant_users tu
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO service_role;

-- 2. RLS PARA TABELAS PRINCIPAIS
-- =====================================================

-- Helper macro para criar políticas
-- (não podemos usar macros em SQL, então vamos fazer manualmente)

-- 2.1 CLIENTS
-- =====================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_clients_select" ON clients;
CREATE POLICY "tenant_isolation_clients_select" ON clients
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL -- dados legados sem tenant
    OR auth.uid() IS NULL -- service role
  );

DROP POLICY IF EXISTS "tenant_isolation_clients_insert" ON clients;
CREATE POLICY "tenant_isolation_clients_insert" ON clients
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_clients_update" ON clients;
CREATE POLICY "tenant_isolation_clients_update" ON clients
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_clients_delete" ON clients;
CREATE POLICY "tenant_isolation_clients_delete" ON clients
  FOR DELETE USING (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

-- 2.2 INVOICES
-- =====================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_invoices_select" ON invoices;
CREATE POLICY "tenant_isolation_invoices_select" ON invoices
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_invoices_insert" ON invoices;
CREATE POLICY "tenant_isolation_invoices_insert" ON invoices
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_invoices_update" ON invoices;
CREATE POLICY "tenant_isolation_invoices_update" ON invoices
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_invoices_delete" ON invoices;
CREATE POLICY "tenant_isolation_invoices_delete" ON invoices
  FOR DELETE USING (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

-- 2.3 ACCOUNTING_ENTRIES
-- =====================================================
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_entries_select" ON accounting_entries;
CREATE POLICY "tenant_isolation_entries_select" ON accounting_entries
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_entries_insert" ON accounting_entries;
CREATE POLICY "tenant_isolation_entries_insert" ON accounting_entries
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_entries_update" ON accounting_entries;
CREATE POLICY "tenant_isolation_entries_update" ON accounting_entries
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_entries_delete" ON accounting_entries;
CREATE POLICY "tenant_isolation_entries_delete" ON accounting_entries
  FOR DELETE USING (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

-- 2.4 ACCOUNTING_ENTRY_ITEMS
-- =====================================================
ALTER TABLE accounting_entry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_items_select" ON accounting_entry_items;
CREATE POLICY "tenant_isolation_items_select" ON accounting_entry_items
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_items_insert" ON accounting_entry_items;
CREATE POLICY "tenant_isolation_items_insert" ON accounting_entry_items
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_items_update" ON accounting_entry_items;
CREATE POLICY "tenant_isolation_items_update" ON accounting_entry_items
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_items_delete" ON accounting_entry_items;
CREATE POLICY "tenant_isolation_items_delete" ON accounting_entry_items
  FOR DELETE USING (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

-- 2.5 BANK_TRANSACTIONS
-- =====================================================
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_bank_tx_select" ON bank_transactions;
CREATE POLICY "tenant_isolation_bank_tx_select" ON bank_transactions
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_bank_tx_insert" ON bank_transactions;
CREATE POLICY "tenant_isolation_bank_tx_insert" ON bank_transactions
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_bank_tx_update" ON bank_transactions;
CREATE POLICY "tenant_isolation_bank_tx_update" ON bank_transactions
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_bank_tx_delete" ON bank_transactions;
CREATE POLICY "tenant_isolation_bank_tx_delete" ON bank_transactions
  FOR DELETE USING (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

-- 2.6 BANK_ACCOUNTS
-- =====================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_bank_acc_select" ON bank_accounts;
CREATE POLICY "tenant_isolation_bank_acc_select" ON bank_accounts
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_bank_acc_insert" ON bank_accounts;
CREATE POLICY "tenant_isolation_bank_acc_insert" ON bank_accounts
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_bank_acc_update" ON bank_accounts;
CREATE POLICY "tenant_isolation_bank_acc_update" ON bank_accounts
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

-- 2.7 CHART_OF_ACCOUNTS (compartilhado, mas com opção de customização)
-- =====================================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_chart_select" ON chart_of_accounts;
CREATE POLICY "tenant_chart_select" ON chart_of_accounts
  FOR SELECT USING (
    -- Plano base compartilhado (tenant_id NULL) ou plano do tenant
    tenant_id IS NULL
    OR tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_chart_insert" ON chart_of_accounts;
CREATE POLICY "tenant_chart_insert" ON chart_of_accounts
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL  -- para contas base
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_chart_update" ON chart_of_accounts;
CREATE POLICY "tenant_chart_update" ON chart_of_accounts
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

-- 2.8 CLIENT_OPENING_BALANCE
-- =====================================================
ALTER TABLE client_opening_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_cob_select" ON client_opening_balance;
CREATE POLICY "tenant_isolation_cob_select" ON client_opening_balance
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_cob_insert" ON client_opening_balance;
CREATE POLICY "tenant_isolation_cob_insert" ON client_opening_balance
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_cob_update" ON client_opening_balance;
CREATE POLICY "tenant_isolation_cob_update" ON client_opening_balance
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

-- 2.9 CLIENT_LEDGER
-- =====================================================
ALTER TABLE client_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_ledger_select" ON client_ledger;
CREATE POLICY "tenant_isolation_ledger_select" ON client_ledger
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_ledger_insert" ON client_ledger;
CREATE POLICY "tenant_isolation_ledger_insert" ON client_ledger
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_ledger_update" ON client_ledger;
CREATE POLICY "tenant_isolation_ledger_update" ON client_ledger
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

-- 2.10 SUPPLIERS
-- =====================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_suppliers_select" ON suppliers;
CREATE POLICY "tenant_isolation_suppliers_select" ON suppliers
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_suppliers_insert" ON suppliers;
CREATE POLICY "tenant_isolation_suppliers_insert" ON suppliers
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_suppliers_update" ON suppliers;
CREATE POLICY "tenant_isolation_suppliers_update" ON suppliers
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

-- 2.11 COST_CENTERS
-- =====================================================
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_cc_select" ON cost_centers;
CREATE POLICY "tenant_isolation_cc_select" ON cost_centers
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_cc_insert" ON cost_centers;
CREATE POLICY "tenant_isolation_cc_insert" ON cost_centers
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "tenant_isolation_cc_update" ON cost_centers;
CREATE POLICY "tenant_isolation_cc_update" ON cost_centers
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant_id()
    OR tenant_id IS NULL
    OR auth.uid() IS NULL
  );

-- 3. VINCULAR USUÁRIO ATUAL AO TENANT AMPLA
-- =====================================================
-- Isso garante que o usuário atual tenha acesso aos dados

DO $$
DECLARE
  v_ampla_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_user_id UUID;
BEGIN
  -- Buscar primeiro usuário autenticado
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email IS NOT NULL
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Verificar se já está vinculado
    IF NOT EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_id = v_ampla_tenant_id
        AND user_id = v_user_id
    ) THEN
      -- Vincular
      INSERT INTO tenant_users (tenant_id, user_id, role, is_active, accepted_at)
      VALUES (v_ampla_tenant_id, v_user_id, 'owner', true, NOW());

      RAISE NOTICE 'Usuário % vinculado ao tenant AMPLA', v_user_id;
    END IF;
  END IF;
END;
$$;

-- 4. LOG FINAL
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '[Dr. Cícero] RLS Multi-Tenant configurado com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE '  Políticas criadas para:';
  RAISE NOTICE '    - clients';
  RAISE NOTICE '    - invoices';
  RAISE NOTICE '    - accounting_entries';
  RAISE NOTICE '    - accounting_entry_items';
  RAISE NOTICE '    - bank_transactions';
  RAISE NOTICE '    - bank_accounts';
  RAISE NOTICE '    - chart_of_accounts';
  RAISE NOTICE '    - client_opening_balance';
  RAISE NOTICE '    - client_ledger';
  RAISE NOTICE '    - suppliers';
  RAISE NOTICE '    - cost_centers';
  RAISE NOTICE '';
  RAISE NOTICE '  Função helper: public.get_user_tenant_id()';
  RAISE NOTICE '════════════════════════════════════════════════════════════════════';
END;
$$;
