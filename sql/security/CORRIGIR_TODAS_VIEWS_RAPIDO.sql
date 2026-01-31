-- ============================================================================
-- CORREÇÃO RÁPIDA: CONVERTER TODAS AS VIEWS PARA SECURITY INVOKER
-- ============================================================================
-- Execute este script inteiro no Supabase Dashboard > SQL Editor
-- ============================================================================

-- Converter todas as views para SECURITY INVOKER
-- (respeita RLS do usuário que consulta, não do criador)

ALTER VIEW IF EXISTS account_ledger_detail SET (security_invoker = true);
ALTER VIEW IF EXISTS mv_client_balances SET (security_invoker = true);
ALTER VIEW IF EXISTS mv_default_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_account_ledger SET (security_invoker = true);
ALTER VIEW IF EXISTS v_accounting_entries_with_source SET (security_invoker = true);
ALTER VIEW IF EXISTS v_accounts_receivable SET (security_invoker = true);
ALTER VIEW IF EXISTS v_adiantamentos_socios SET (security_invoker = true);
ALTER VIEW IF EXISTS v_ai_validation_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS v_alerts_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_analise_cobranca SET (security_invoker = true);
ALTER VIEW IF EXISTS v_balancete SET (security_invoker = true);
ALTER VIEW IF EXISTS v_balanco_patrimonial SET (security_invoker = true);
ALTER VIEW IF EXISTS v_bank_balance_by_period SET (security_invoker = true);
ALTER VIEW IF EXISTS v_bank_balance_from_entries SET (security_invoker = true);
ALTER VIEW IF EXISTS v_cash_flow_daily SET (security_invoker = true);
ALTER VIEW IF EXISTS v_cash_flow_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_client_classification_check SET (security_invoker = true);
ALTER VIEW IF EXISTS v_client_opening_balance_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_clients_for_negotiation SET (security_invoker = true);
ALTER VIEW IF EXISTS v_clients_pending_adjustment SET (security_invoker = true);
ALTER VIEW IF EXISTS v_contas_a_receber SET (security_invoker = true);
ALTER VIEW IF EXISTS v_contracts_complete SET (security_invoker = true);
ALTER VIEW IF EXISTS v_debt_confessions_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_despesas SET (security_invoker = true);
ALTER VIEW IF EXISTS v_dre_mensal SET (security_invoker = true);
ALTER VIEW IF EXISTS v_dre_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_honorarios_por_cliente_ano SET (security_invoker = true);
ALTER VIEW IF EXISTS v_identification_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS v_invoices_with_13th SET (security_invoker = true);
ALTER VIEW IF EXISTS v_learning_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS v_minimum_wage_history SET (security_invoker = true);
ALTER VIEW IF EXISTS v_pattern_effectiveness SET (security_invoker = true);
ALTER VIEW IF EXISTS v_payroll_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_pending_responsibility_letters SET (security_invoker = true);
ALTER VIEW IF EXISTS v_projections_contractors SET (security_invoker = true);
ALTER VIEW IF EXISTS v_projections_custom SET (security_invoker = true);
ALTER VIEW IF EXISTS v_projections_payroll SET (security_invoker = true);
ALTER VIEW IF EXISTS v_projections_recurring SET (security_invoker = true);
ALTER VIEW IF EXISTS v_projections_taxes SET (security_invoker = true);
ALTER VIEW IF EXISTS v_receitas SET (security_invoker = true);
ALTER VIEW IF EXISTS v_rentabilidade_cliente SET (security_invoker = true);
ALTER VIEW IF EXISTS v_saldo_banco SET (security_invoker = true);
ALTER VIEW IF EXISTS v_tenant_subscription_status SET (security_invoker = true);
ALTER VIEW IF EXISTS v_tracking_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_trial_balance SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_agent_dashboard SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_aging_inadimplencia SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_aging_resumo SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_ai_company_context SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_ai_labor_context SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_all_labor_alerts SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_balancete SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_business_maturity_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_classification_rules_with_account SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_clients_variable_fees SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_content_metrics SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_content_to_publish SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_cost_center_with_accounts SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_costs_by_department SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_economic_group_members SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_economic_groups_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_employee_sales_ranking SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_evolution_metrics SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_expenses_by_cost_center SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_expenses_with_accounts SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_growth_opportunities SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_honorarios_por_tipo SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_irpf_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_jurisprudence_by_risk SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_labor_risk_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_labor_risks_with_solutions SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_livro_diario SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_livro_razao SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_low_stock_products SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_nfse_tomadas_detalhada SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_partner_advances_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_partner_groups SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_payroll_events_detailed SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_payroll_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_pending_alerts SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_pending_classification SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_pending_commissions SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_pending_feature_requests SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_pending_reclassifications SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_person_labor_analysis SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_plr_by_employee SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_plr_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_product_price_history SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_program_readiness SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_provider_compliance SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_razao_cliente SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_reconciliacao_cliente SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_salary_comparison SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_saldo_cliente SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_sergio_advances_balance SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_sora_queue_status SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_sora_videos_ready SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_terminations_detailed SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_transitory_balances SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_videos_to_show SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_work_orders_with_details SET (security_invoker = true);

-- ============================================================================
-- VERIFICAR RESULTADO
-- ============================================================================

SELECT 
    c.relname as view_name,
    COALESCE(
        (SELECT option_value FROM pg_options_to_table(c.reloptions) 
         WHERE option_name = 'security_invoker'),
        'NAO_DEFINIDO'
    ) as security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname NOT LIKE 'pg_%'
ORDER BY 2 DESC, 1;
