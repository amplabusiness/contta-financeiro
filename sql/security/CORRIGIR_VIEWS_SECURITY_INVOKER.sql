-- ============================================================================
-- CORREÇÃO DE VIEWS COM SECURITY DEFINER → SECURITY INVOKER
-- ============================================================================
-- Protocolo: AUD-202501-ML1AZROS
-- Data: 31/01/2026
-- ============================================================================
-- 
-- OBJETIVO: Converter todas as views para SECURITY INVOKER
--           para que respeitem as políticas RLS do usuário que consulta
--
-- ============================================================================

-- ============================================================================
-- PASSO 1: IDENTIFICAR VIEWS SEM security_invoker = true
-- ============================================================================

-- Query para listar views que precisam ser corrigidas
SELECT 
    c.relname as view_name,
    pg_get_viewdef(c.oid, true) as definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname NOT LIKE 'pg_%'
ORDER BY c.relname;

-- ============================================================================
-- PASSO 2: ATUALIZAR VIEWS PARA SECURITY INVOKER
-- ============================================================================

-- NOTA: PostgreSQL 15+ suporta ALTER VIEW ... SET (security_invoker = true)
-- Para versões anteriores, é necessário DROP + CREATE

-- Função auxiliar para converter views
CREATE OR REPLACE FUNCTION convert_views_to_security_invoker()
RETURNS TABLE (view_name TEXT, status TEXT) AS $$
DECLARE
    v_rec RECORD;
    v_def TEXT;
    v_sql TEXT;
BEGIN
    FOR v_rec IN 
        SELECT c.relname, pg_get_viewdef(c.oid, true) as def
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'v'
          AND n.nspname = 'public'
          AND c.relname NOT LIKE 'pg_%'
          -- Excluir views já convertidas
          AND NOT EXISTS (
              SELECT 1 FROM pg_options_to_table(c.reloptions)
              WHERE option_name = 'security_invoker' AND option_value = 'true'
          )
    LOOP
        BEGIN
            -- Dropar e recriar com security_invoker
            EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', v_rec.relname);
            
            v_sql := format(
                'CREATE VIEW %I WITH (security_invoker = true) AS %s',
                v_rec.relname,
                v_rec.def
            );
            
            EXECUTE v_sql;
            
            view_name := v_rec.relname;
            status := 'CONVERTIDA';
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            view_name := v_rec.relname;
            status := 'ERRO: ' || SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASSO 3: EXECUTAR CONVERSÃO MANUAL DAS VIEWS CONHECIDAS
-- ============================================================================

-- Lista das 22 views que precisam ser convertidas (executar uma por uma):

-- 1. vw_razao_cliente
ALTER VIEW IF EXISTS vw_razao_cliente SET (security_invoker = true);

-- 2. vw_reconciliacao_cliente
ALTER VIEW IF EXISTS vw_reconciliacao_cliente SET (security_invoker = true);

-- 3. vw_saldo_cliente
ALTER VIEW IF EXISTS vw_saldo_cliente SET (security_invoker = true);

-- 4. vw_balancete
ALTER VIEW IF EXISTS vw_balancete SET (security_invoker = true);

-- 5. vw_livro_diario
ALTER VIEW IF EXISTS vw_livro_diario SET (security_invoker = true);

-- 6. vw_livro_razao
ALTER VIEW IF EXISTS vw_livro_razao SET (security_invoker = true);

-- 7. vw_transitory_balances
ALTER VIEW IF EXISTS vw_transitory_balances SET (security_invoker = true);

-- 8. vw_pending_classification
ALTER VIEW IF EXISTS vw_pending_classification SET (security_invoker = true);

-- 9. v_balancete
ALTER VIEW IF EXISTS v_balancete SET (security_invoker = true);

-- 10. v_dre_mensal
ALTER VIEW IF EXISTS v_dre_mensal SET (security_invoker = true);

-- 11. v_dre_summary
ALTER VIEW IF EXISTS v_dre_summary SET (security_invoker = true);

-- 12. v_trial_balance
ALTER VIEW IF EXISTS v_trial_balance SET (security_invoker = true);

-- 13. v_account_ledger
ALTER VIEW IF EXISTS v_account_ledger SET (security_invoker = true);

-- 14. v_saldo_banco
ALTER VIEW IF EXISTS v_saldo_banco SET (security_invoker = true);

-- 15. v_cash_flow_daily
ALTER VIEW IF EXISTS v_cash_flow_daily SET (security_invoker = true);

-- 16. v_cash_flow_summary
ALTER VIEW IF EXISTS v_cash_flow_summary SET (security_invoker = true);

-- 17. v_contas_a_receber
ALTER VIEW IF EXISTS v_contas_a_receber SET (security_invoker = true);

-- 18. v_accounts_receivable
ALTER VIEW IF EXISTS v_accounts_receivable SET (security_invoker = true);

-- 19. v_despesas
ALTER VIEW IF EXISTS v_despesas SET (security_invoker = true);

-- 20. v_receitas
ALTER VIEW IF EXISTS v_receitas SET (security_invoker = true);

-- 21. v_balanco_patrimonial
ALTER VIEW IF EXISTS v_balanco_patrimonial SET (security_invoker = true);

-- 22. account_ledger_detail
ALTER VIEW IF EXISTS account_ledger_detail SET (security_invoker = true);

-- Outras views que podem ter o problema:
ALTER VIEW IF EXISTS v_adiantamentos_socios SET (security_invoker = true);
ALTER VIEW IF EXISTS v_bank_balance_by_period SET (security_invoker = true);
ALTER VIEW IF EXISTS v_bank_balance_from_entries SET (security_invoker = true);
ALTER VIEW IF EXISTS v_client_opening_balance_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS v_honorarios_por_cliente_ano SET (security_invoker = true);
ALTER VIEW IF EXISTS v_rentabilidade_cliente SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_aging_inadimplencia SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_aging_resumo SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_sergio_advances_balance SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_partner_advances_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_expenses_by_cost_center SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_expenses_with_accounts SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_cost_center_with_accounts SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_classification_rules_with_account SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_nfse_tomadas_detalhada SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_clients_variable_fees SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_irpf_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_payroll_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS vw_payroll_events_detailed SET (security_invoker = true);

-- Materialized views (se houver, não suportam security_invoker diretamente)
-- mv_client_balances, mv_default_summary - não podem usar ALTER VIEW

-- ============================================================================
-- PASSO 4: VERIFICAR RESULTADO
-- ============================================================================

-- Listar views que ainda não têm security_invoker
SELECT 
    c.relname as view_name,
    COALESCE(
        (SELECT option_value FROM pg_options_to_table(c.reloptions) 
         WHERE option_name = 'security_invoker'),
        'false'
    ) as security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname NOT LIKE 'pg_%'
ORDER BY 2, 1;

-- ============================================================================
-- PASSO 5: LIMPAR FUNÇÃO AUXILIAR
-- ============================================================================

DROP FUNCTION IF EXISTS convert_views_to_security_invoker();
