-- ============================================================================
-- HABILITAR RLS EM TABELAS FALTANTES
-- ============================================================================
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- PASSO 1: HABILITAR RLS NAS TABELAS
-- ============================================================================

ALTER TABLE public.accounting_reclassifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_reclassification_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_rule_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_maintenance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASSO 2: CRIAR POLICIES PARA CADA TABELA
-- ============================================================================

-- 2.1 accounting_reclassifications
DROP POLICY IF EXISTS "tenant_isolation" ON public.accounting_reclassifications;
CREATE POLICY "tenant_isolation" ON public.accounting_reclassifications
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- 2.2 accounting_reclassification_lines
DROP POLICY IF EXISTS "tenant_isolation" ON public.accounting_reclassification_lines;
CREATE POLICY "tenant_isolation" ON public.accounting_reclassification_lines
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- 2.3 classification_rules
DROP POLICY IF EXISTS "tenant_isolation" ON public.classification_rules;
CREATE POLICY "tenant_isolation" ON public.classification_rules
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- 2.4 classification_rule_applications
DROP POLICY IF EXISTS "tenant_isolation" ON public.classification_rule_applications;
CREATE POLICY "tenant_isolation" ON public.classification_rule_applications
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- 2.5 accounting_closures
DROP POLICY IF EXISTS "tenant_isolation" ON public.accounting_closures;
CREATE POLICY "tenant_isolation" ON public.accounting_closures
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- 2.6 system_maintenance (tabela de sistema - apenas service_role pode acessar)
DROP POLICY IF EXISTS "service_role_only" ON public.system_maintenance;
CREATE POLICY "service_role_only" ON public.system_maintenance
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PASSO 3: VERIFICAR RESULTADO
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'accounting_reclassifications',
    'accounting_reclassification_lines',
    'classification_rules',
    'classification_rule_applications',
    'accounting_closures',
    'system_maintenance'
  )
ORDER BY tablename;

-- ============================================================================
-- PASSO 4: LISTAR POLICIES CRIADAS
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'accounting_reclassifications',
    'accounting_reclassification_lines',
    'classification_rules',
    'classification_rule_applications',
    'accounting_closures',
    'system_maintenance'
  )
ORDER BY tablename, policyname;
