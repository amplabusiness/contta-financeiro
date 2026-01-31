-- ============================================================================
-- CORRIGIR POLÍTICAS RLS PERMISSIVAS (WITH CHECK = true)
-- ============================================================================
-- Estas políticas permitem INSERT irrestrito, o que é uma vulnerabilidade
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. audit_logs - Política "Sistema pode inserir logs"
-- ============================================================================
-- Audit logs devem ser inseridos apenas pelo sistema (service_role)
-- ou por usuários autenticados para seu próprio tenant

DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.audit_logs;
CREATE POLICY "Sistema pode inserir logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        -- Service role pode inserir qualquer coisa
        auth.role() = 'service_role'
        OR
        -- Usuários autenticados só podem inserir logs do seu tenant
        (auth.role() = 'authenticated' AND tenant_id = public.get_my_tenant_id())
    );

-- ============================================================================
-- 2. cash_flow_projections - Política "Users can insert projections to their tenant"
-- ============================================================================
-- Usuários só podem inserir projeções para seu próprio tenant

DROP POLICY IF EXISTS "Users can insert projections to their tenant" ON public.cash_flow_projections;
CREATE POLICY "Users can insert projections to their tenant" ON public.cash_flow_projections
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============================================================================
-- 3. system_metrics - Política "Sistema pode inserir métricas"
-- ============================================================================
-- Métricas de sistema devem ser inseridas apenas pelo service_role

DROP POLICY IF EXISTS "Sistema pode inserir métricas" ON public.system_metrics;
CREATE POLICY "Sistema pode inserir métricas" ON public.system_metrics
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. ux_settings - Política "Sistema pode inserir configurações"
-- ============================================================================
-- Configurações UX devem respeitar o tenant do usuário

DROP POLICY IF EXISTS "Sistema pode inserir configurações" ON public.ux_settings;
CREATE POLICY "Sistema pode inserir configurações" ON public.ux_settings
    FOR INSERT
    WITH CHECK (
        -- Service role pode inserir qualquer coisa
        auth.role() = 'service_role'
        OR
        -- Usuários autenticados só podem inserir para seu tenant
        (auth.role() = 'authenticated' AND tenant_id = public.get_my_tenant_id())
    );

-- ============================================================================
-- VERIFICAR RESULTADO
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('audit_logs', 'cash_flow_projections', 'system_metrics', 'ux_settings')
ORDER BY tablename, policyname;
