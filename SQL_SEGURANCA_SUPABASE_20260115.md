# Script SQL de Segurança Executado (Supabase)

**Data de execução:** 15/01/2026

Este script foi executado para aumentar a segurança do banco de dados, conforme orientação do Supabase, corrigindo configurações de views e ativando Row Level Security (RLS) em diversas tabelas.

---

```sql
BEGIN;

-- =================================================================
-- PARTE 1: CORREÇÃO DAS VIEWS (De Security Definer para Invoker)
-- Isso garante que as views respeitem as regras de segurança do usuário
-- =================================================================

ALTER VIEW public.vw_videos_to_show SET (security_invoker = true);
ALTER VIEW public.vw_program_readiness SET (security_invoker = true);
ALTER VIEW public.vw_product_price_history SET (security_invoker = true);
ALTER VIEW public.v_trial_balance SET (security_invoker = true);
ALTER VIEW public.vw_plr_by_employee SET (security_invoker = true);
ALTER VIEW public.vw_pending_classification SET (security_invoker = true);
ALTER VIEW public.vw_sergio_advances_balance SET (security_invoker = true);
ALTER VIEW public.vw_evolution_metrics SET (security_invoker = true);
ALTER VIEW public.vw_growth_opportunities SET (security_invoker = true);
ALTER VIEW public.v_clients_pending_adjustment SET (security_invoker = true);
ALTER VIEW public.vw_partner_advances_summary SET (security_invoker = true);
ALTER VIEW public.v_adiantamentos_socios SET (security_invoker = true);
ALTER VIEW public.v_projections_recurring SET (security_invoker = true);
ALTER VIEW public.vw_plr_summary SET (security_invoker = true);
ALTER VIEW public.v_ai_validation_stats SET (security_invoker = true);
ALTER VIEW public.v_analise_cobranca SET (security_invoker = true);
ALTER VIEW public.vw_cost_center_with_accounts SET (security_invoker = true);
ALTER VIEW public.vw_economic_groups_summary SET (security_invoker = true);
ALTER VIEW public.v_saldo_banco SET (security_invoker = true);
ALTER VIEW public.v_despesas SET (security_invoker = true);
ALTER VIEW public.v_cash_flow_daily SET (security_invoker = true);
ALTER VIEW public.vw_ai_company_context SET (security_invoker = true);
ALTER VIEW public.vw_work_orders_with_details SET (security_invoker = true);
ALTER VIEW public.vw_content_metrics SET (security_invoker = true);
ALTER VIEW public.vw_ai_labor_context SET (security_invoker = true);
ALTER VIEW public.v_accounts_receivable SET (security_invoker = true);
ALTER VIEW public.vw_labor_risk_summary SET (security_invoker = true);
ALTER VIEW public.v_tracking_summary SET (security_invoker = true);
ALTER VIEW public.vw_costs_by_department SET (security_invoker = true);
ALTER VIEW public.v_projections_contractors SET (security_invoker = true);
ALTER VIEW public.vw_salary_comparison SET (security_invoker = true);
ALTER VIEW public.v_debt_confessions_summary SET (security_invoker = true);
ALTER VIEW public.v_payroll_summary SET (security_invoker = true);
ALTER VIEW public.v_dre_summary SET (security_invoker = true);
ALTER VIEW public.v_client_opening_balance_summary SET (security_invoker = true);
ALTER VIEW public.v_bank_balance_from_entries SET (security_invoker = true);
ALTER VIEW public.vw_partner_groups SET (security_invoker = true);
ALTER VIEW public.vw_all_labor_alerts SET (security_invoker = true);
ALTER VIEW public.vw_pending_commissions SET (security_invoker = true);
ALTER VIEW public.v_clients_for_negotiation SET (security_invoker = true);
ALTER VIEW public.v_contas_a_receber SET (security_invoker = true);
ALTER VIEW public.v_cash_flow_summary SET (security_invoker = true);
ALTER VIEW public.vw_payroll_events_detailed SET (security_invoker = true);
ALTER VIEW public.v_honorarios_por_cliente_ano SET (security_invoker = true);
ALTER VIEW public.vw_livro_razao SET (security_invoker = true);
ALTER VIEW public.vw_pending_feature_requests SET (security_invoker = true);
ALTER VIEW public.v_minimum_wage_history SET (security_invoker = true);
ALTER VIEW public.account_ledger_detail SET (security_invoker = true);
ALTER VIEW public.v_dre_mensal SET (security_invoker = true);
ALTER VIEW public.vw_sora_videos_ready SET (security_invoker = true);
ALTER VIEW public.vw_nfse_tomadas_detalhada SET (security_invoker = true);
ALTER VIEW public.vw_low_stock_products SET (security_invoker = true);
ALTER VIEW public.v_projections_payroll SET (security_invoker = true);
ALTER VIEW public.vw_clients_variable_fees SET (security_invoker = true);
ALTER VIEW public.v_account_ledger SET (security_invoker = true);
ALTER VIEW public.v_accounting_entries_with_source SET (security_invoker = true);
ALTER VIEW public.vw_employee_sales_ranking SET (security_invoker = true);
ALTER VIEW public.vw_provider_compliance SET (security_invoker = true);
ALTER VIEW public.v_projections_taxes SET (security_invoker = true);
ALTER VIEW public.vw_business_maturity_summary SET (security_invoker = true);
ALTER VIEW public.vw_economic_group_members SET (security_invoker = true);
ALTER VIEW public.v_balanco_patrimonial SET (security_invoker = true);
ALTER VIEW public.v_rentabilidade_cliente SET (security_invoker = true);
ALTER VIEW public.vw_terminations_detailed SET (security_invoker = true);
ALTER VIEW public.v_pending_responsibility_letters SET (security_invoker = true);
ALTER VIEW public.vw_jurisprudence_by_risk SET (security_invoker = true);
ALTER VIEW public.vw_expenses_with_accounts SET (security_invoker = true);
ALTER VIEW public.v_balancete SET (security_invoker = true);
ALTER VIEW public.v_receitas SET (security_invoker = true);
ALTER VIEW public.vw_balancete SET (security_invoker = true);
ALTER VIEW public.vw_labor_risks_with_solutions SET (security_invoker = true);
ALTER VIEW public.v_bank_balance_by_period SET (security_invoker = true);
ALTER VIEW public.vw_content_to_publish SET (security_invoker = true);
ALTER VIEW public.vw_payroll_summary SET (security_invoker = true);
ALTER VIEW public.v_contracts_complete SET (security_invoker = true);
ALTER VIEW public.v_invoices_with_13th SET (security_invoker = true);
ALTER VIEW public.vw_livro_diario SET (security_invoker = true);
ALTER VIEW public.vw_person_labor_analysis SET (security_invoker = true);
ALTER VIEW public.vw_sora_queue_status SET (security_invoker = true);
ALTER VIEW public.vw_irpf_summary SET (security_invoker = true);
ALTER VIEW public.vw_expenses_by_cost_center SET (security_invoker = true);
ALTER VIEW public.vw_agent_dashboard SET (security_invoker = true);
ALTER VIEW public.v_client_classification_check SET (security_invoker = true);

-- =================================================================
-- PARTE 2: ATIVAR RLS NAS TABELAS (PROTEÇÃO DE DADOS)
-- Nota: Isso nega todo acesso por padrão até que Policies sejam criadas.
-- =================================================================

-- Tabelas Principais
ALTER TABLE public.accounting_entry_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_opening_balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codigos_servico_lc116 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_variable_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_adjustment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minimum_wage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materialized_view_refresh_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commission_payments ENABLE ROW LEVEL SECURITY;
-- ATENÇÃO: A tabela abaixo continha dados bancários expostos
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleto_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_service_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irpf_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Tabelas de Backup (Sugestão: mover para schema privado em vez de usar RLS)
-- Mas ativando RLS para garantir segurança imediata
ALTER TABLE public.bkp_20260106_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_accounting_entry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_suppliers ENABLE ROW LEVEL SECURITY;

COMMIT;
```

---

**Observações:**
- As views agora respeitam as permissões do usuário conectado.
- O acesso às tabelas está negado por padrão até que políticas (policies) sejam criadas.
- Recomenda-se migrar tabelas de backup para um schema privado para maior segurança.
