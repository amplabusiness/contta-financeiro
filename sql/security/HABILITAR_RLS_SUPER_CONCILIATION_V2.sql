-- ============================================================================
-- RLS PARA TABELAS DA SUPER CONCILIAÇÃO V2
-- Data: 31/01/2026
-- Autor: Dr. Cícero / Dev Team
-- Descrição: Habilita RLS nas tabelas de reclassificação e regras de classificação
-- ============================================================================

-- ============================================================================
-- 1. accounting_reclassifications
-- ============================================================================

ALTER TABLE public.accounting_reclassifications ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
DROP POLICY IF EXISTS "tenant_isolation" ON public.accounting_reclassifications;
CREATE POLICY "tenant_isolation" ON public.accounting_reclassifications
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============================================================================
-- 2. accounting_reclassification_lines
-- ============================================================================

ALTER TABLE public.accounting_reclassification_lines ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
DROP POLICY IF EXISTS "tenant_isolation" ON public.accounting_reclassification_lines;
CREATE POLICY "tenant_isolation" ON public.accounting_reclassification_lines
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============================================================================
-- 3. classification_rules
-- ============================================================================

ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
DROP POLICY IF EXISTS "tenant_isolation" ON public.classification_rules;
CREATE POLICY "tenant_isolation" ON public.classification_rules
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============================================================================
-- 4. classification_rule_applications
-- ============================================================================

ALTER TABLE public.classification_rule_applications ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
DROP POLICY IF EXISTS "tenant_isolation" ON public.classification_rule_applications;
CREATE POLICY "tenant_isolation" ON public.classification_rule_applications
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============================================================================
-- 5. SECURITY INVOKER para views
-- ============================================================================

ALTER VIEW IF EXISTS vw_classification_rules_with_account SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_pending_reclassifications SET (security_invoker = true);

-- ============================================================================
-- 6. SEARCH_PATH para funções
-- ============================================================================

ALTER FUNCTION rpc_create_reclassification SET search_path = public;
ALTER FUNCTION rpc_approve_reclassification SET search_path = public;
ALTER FUNCTION rpc_reject_reclassification SET search_path = public;
ALTER FUNCTION rpc_find_matching_rule SET search_path = public;
ALTER FUNCTION rpc_apply_classification_rule SET search_path = public;
ALTER FUNCTION rpc_create_classification_rule SET search_path = public;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

DO $$
DECLARE
    tabela TEXT;
    rls_enabled BOOLEAN;
BEGIN
    FOR tabela IN 
        SELECT unnest(ARRAY[
            'accounting_reclassifications',
            'accounting_reclassification_lines',
            'classification_rules',
            'classification_rule_applications'
        ])
    LOOP
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class
        WHERE relname = tabela AND relnamespace = 'public'::regnamespace;
        
        IF rls_enabled THEN
            RAISE NOTICE '✅ RLS habilitado: %', tabela;
        ELSE
            RAISE WARNING '❌ RLS não habilitado: %', tabela;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- FIM
-- ============================================================================

COMMENT ON SCHEMA public IS 'RLS Super Conciliação V2 - 31/01/2026';
