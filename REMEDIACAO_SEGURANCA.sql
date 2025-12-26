-- ============================================================
-- SCRIPT DE REMEDIAÇÃO DE SEGURANÇA - PROJETO HONORARIO
-- ============================================================
-- Executar como: superuser ou owner das tabelas
-- Data: 26 de Dezembro de 2025
-- ============================================================

-- ============================================================
-- FASE 1: HABILITAR RLS nas 24 TABELAS
-- ============================================================

-- 1. codigos_servico_lc116
ALTER TABLE public.codigos_servico_lc116 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view codigos_servico_lc116" 
  ON public.codigos_servico_lc116 FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 2. nfse
ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view nfse" 
  ON public.nfse FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 3. nfse_config
ALTER TABLE public.nfse_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view nfse_config" 
  ON public.nfse_config FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 4. nfse_log
ALTER TABLE public.nfse_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view nfse_log" 
  ON public.nfse_log FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 5. recurring_expense_templates
ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view recurring_expense_templates" 
  ON public.recurring_expense_templates FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 6. empresas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view empresas" 
  ON public.empresas FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 7. client_variable_fees
ALTER TABLE public.client_variable_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view client_variable_fees" 
  ON public.client_variable_fees FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 8. discount_approval_rules
ALTER TABLE public.discount_approval_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view discount_approval_rules" 
  ON public.discount_approval_rules FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 9. holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view holidays" 
  ON public.holidays FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 10. minimum_wage_history
ALTER TABLE public.minimum_wage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view minimum_wage_history" 
  ON public.minimum_wage_history FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 11. fee_adjustment_history
ALTER TABLE public.fee_adjustment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view fee_adjustment_history" 
  ON public.fee_adjustment_history FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 12. enrichment_logs (já tem policies, só falta habilitar RLS)
ALTER TABLE public.enrichment_logs ENABLE ROW LEVEL SECURITY;

-- 13. irpf_declarations
ALTER TABLE public.irpf_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view irpf_declarations" 
  ON public.irpf_declarations FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 14. referral_commission_payments
ALTER TABLE public.referral_commission_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view referral_commission_payments" 
  ON public.referral_commission_payments FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 15. materialized_view_refresh_log
ALTER TABLE public.materialized_view_refresh_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view materialized_view_refresh_log" 
  ON public.materialized_view_refresh_log FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 16. referral_partners
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view referral_partners" 
  ON public.referral_partners FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 17. client_referrals
ALTER TABLE public.client_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view client_referrals" 
  ON public.client_referrals FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 18. company_service_costs
ALTER TABLE public.company_service_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view company_service_costs" 
  ON public.company_service_costs FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 19. company_services
ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view company_services" 
  ON public.company_services FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 20. domain_events
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view domain_events" 
  ON public.domain_events FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 21. tenant_features
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view tenant_features" 
  ON public.tenant_features FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 22. tenant_users
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view tenant_users" 
  ON public.tenant_users FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 23. tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view tenants" 
  ON public.tenants FOR SELECT 
  USING (auth.role() = 'authenticated');

-- ============================================================
-- FASE 2: REVOGAR ACESSO ANON DAS MATERIALIZED VIEWS
-- ============================================================

-- Revogar SELECT do papel 'anon' (anonymous users)
REVOKE SELECT ON public.mv_dashboard_kpis FROM anon;
REVOKE SELECT ON public.mv_default_summary FROM anon;
REVOKE SELECT ON public.mv_client_balances FROM anon;
REVOKE SELECT ON public.mv_dre_monthly FROM anon;
REVOKE SELECT ON public.mv_cash_flow FROM anon;
REVOKE SELECT ON public.mv_trial_balance FROM anon;
REVOKE SELECT ON public.account_ledger FROM anon;

-- Garantir que apenas authenticated users podem acessar
GRANT SELECT ON public.mv_dashboard_kpis TO authenticated;
GRANT SELECT ON public.mv_default_summary TO authenticated;
GRANT SELECT ON public.mv_client_balances TO authenticated;
GRANT SELECT ON public.mv_dre_monthly TO authenticated;
GRANT SELECT ON public.mv_cash_flow TO authenticated;
GRANT SELECT ON public.mv_trial_balance TO authenticated;
GRANT SELECT ON public.account_ledger TO authenticated;

-- ============================================================
-- VALIDAÇÃO: Verificar RLS habilitado
-- ============================================================

-- Execute após aplicar as mudanças para validar:
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'codigos_servico_lc116', 'nfse', 'nfse_config', 'nfse_log',
    'recurring_expense_templates', 'empresas', 'client_variable_fees',
    'discount_approval_rules', 'holidays', 'minimum_wage_history',
    'fee_adjustment_history', 'enrichment_logs', 'irpf_declarations',
    'referral_commission_payments', 'materialized_view_refresh_log',
    'referral_partners', 'client_referrals', 'company_service_costs',
    'company_services', 'domain_events', 'tenant_features',
    'tenant_users', 'tenants'
  )
ORDER BY tablename;

-- ============================================================
-- VALIDAÇÃO: Verificar policies criadas
-- ============================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  qual as policy_definition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- NOTAS IMPORTANTES
-- ============================================================
/*

1. TESTAR ANTES DE APLICAR EM PRODUÇÃO
   - Execute em ambiente de staging/development
   - Validar que aplicações continuam funcionando
   - Testar com diferentes roles (anon, authenticated)

2. RLS POLICIES - POSSÍVEIS REFINAMENTOS
   - As policies acima são genéricas (permite todos authenticated)
   - Você pode refinar para:
     * Acessar apenas dados do seu próprio tenant
     * Acessar apenas dados da sua empresa
     * Acessar baseado em roles/permissões

3. EXEMPLO DE POLICY MAIS REFINADA:
   CREATE POLICY "Users can view their own company data"
     ON public.companies FOR SELECT
     USING (id = (SELECT company_id FROM auth.users WHERE id = auth.uid()));

4. VIEWS COM SECURITY DEFINER
   - Precisam ser revisadas manualmente
   - Decidir se precisam realmente de SECURITY DEFINER
   - Ou se podem ser protegidas por RLS

5. FUNCTIONS COM ROLE MUTABLE
   - Precisam ser revisadas manualmente
   - Remover 'SET search_path = public, pg_temp;'
   - Adicionar validações de segurança

6. BACKUP IMPORTANTE
   - Fazer backup ANTES de aplicar
   - Estar preparado para rollback rápido

7. COMUNICAÇÃO
   - Notificar time de desenvolvimento
   - Verificar se há queries hardcoded que possam quebrar
   - Planejar downtime se necessário (mínimo 5 minutos)

*/
