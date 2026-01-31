-- ============================================================================
-- RESTAURAÇÃO DE SEGURANÇA DO BANCO — PÓS-AUDITORIA
-- ============================================================================
-- Protocolo: AUD-202501-ML1AZROS
-- Data: 31/01/2026
-- ============================================================================
-- 
-- OBJETIVO: Garantir que todos os triggers e funções de segurança
--           estejam reabilitados após o saneamento de Janeiro/2025
--
-- ============================================================================

-- ============================================================================
-- PASSO 1: REABILITAR TRIGGERS DE USUÁRIO
-- ============================================================================

-- Reabilitar triggers na tabela accounting_entries
ALTER TABLE accounting_entries ENABLE TRIGGER USER;

-- Reabilitar triggers na tabela accounting_entry_lines
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;

-- Reabilitar triggers na tabela bank_transactions
ALTER TABLE bank_transactions ENABLE TRIGGER USER;

-- ============================================================================
-- PASSO 1.1: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS nas tabelas principais
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASSO 2: VERIFICAR STATUS DOS TRIGGERS
-- ============================================================================

SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name,
    CASE WHEN t.tgenabled = 'O' THEN 'HABILITADO'
         WHEN t.tgenabled = 'D' THEN 'DESABILITADO'
         WHEN t.tgenabled = 'R' THEN 'REPLICA'
         WHEN t.tgenabled = 'A' THEN 'ALWAYS'
         ELSE t.tgenabled::TEXT
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('accounting_entries', 'accounting_entry_lines', 'bank_transactions')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- ============================================================================
-- PASSO 3: CRIAR FUNÇÃO RPC PARA AUDITORIA (SEM PAGINAÇÃO)
-- ============================================================================

-- Função para totais de partidas dobradas
CREATE OR REPLACE FUNCTION audit_totals_month(
    p_tenant UUID,
    p_start DATE,
    p_end DATE
)
RETURNS TABLE (
    total_debit NUMERIC,
    total_credit NUMERIC,
    difference NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(l.debit), 0)::NUMERIC as total_debit,
        COALESCE(SUM(l.credit), 0)::NUMERIC as total_credit,
        ABS(COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0))::NUMERIC as difference
    FROM accounting_entries e
    JOIN accounting_entry_lines l ON l.entry_id = e.id
    WHERE e.tenant_id = p_tenant
      AND e.entry_date BETWEEN p_start AND p_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para contagem de desbalanceados
CREATE OR REPLACE FUNCTION audit_count_unbalanced(
    p_tenant UUID,
    p_start DATE,
    p_end DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM accounting_entries e
    WHERE e.tenant_id = p_tenant
      AND e.entry_date BETWEEN p_start AND p_end
      AND EXISTS (
          SELECT 1 
          FROM accounting_entry_lines l 
          WHERE l.entry_id = e.id
          GROUP BY l.entry_id
          HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
      );
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para contagem de transações órfãs
CREATE OR REPLACE FUNCTION audit_count_orphan_transactions(
    p_tenant UUID,
    p_start DATE,
    p_end DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM bank_transactions bt
    WHERE bt.tenant_id = p_tenant
      AND bt.transaction_date BETWEEN p_start AND p_end
      AND bt.journal_entry_id IS NULL;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para saldo de conta transitória
CREATE OR REPLACE FUNCTION audit_account_balance(
    p_tenant UUID,
    p_account UUID,
    p_start DATE,
    p_end DATE
)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) INTO v_balance
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    WHERE e.tenant_id = p_tenant
      AND l.account_id = p_account
      AND e.entry_date BETWEEN p_start AND p_end;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função completa de auditoria mensal
CREATE OR REPLACE FUNCTION audit_monthly_complete(
    p_tenant UUID,
    p_start DATE,
    p_end DATE
)
RETURNS TABLE (
    verificacao TEXT,
    valor TEXT,
    status TEXT
) AS $$
DECLARE
    v_orphans INTEGER;
    v_total_d NUMERIC;
    v_total_c NUMERIC;
    v_diff NUMERIC;
    v_unbalanced INTEGER;
    v_trans_d NUMERIC;
    v_trans_c NUMERIC;
    v_total_entries INTEGER;
    v_reversals INTEGER;
BEGIN
    -- 1. Transações órfãs
    SELECT audit_count_orphan_transactions(p_tenant, p_start, p_end) INTO v_orphans;
    
    -- 2. Partidas dobradas
    SELECT t.total_debit, t.total_credit, t.difference 
    INTO v_total_d, v_total_c, v_diff
    FROM audit_totals_month(p_tenant, p_start, p_end) t;
    
    -- 3. Desbalanceados
    SELECT audit_count_unbalanced(p_tenant, p_start, p_end) INTO v_unbalanced;
    
    -- 4. Transitórias
    SELECT audit_account_balance(p_tenant, '3e1fd22f-fba2-4cc2-b628-9d729233bca0', p_start, p_end) INTO v_trans_d;
    SELECT -1 * audit_account_balance(p_tenant, '28085461-9e5a-4fb4-847d-c9fc047fe0a1', p_start, p_end) INTO v_trans_c;
    
    -- 5. Estatísticas
    SELECT COUNT(*) INTO v_total_entries
    FROM accounting_entries e
    WHERE e.tenant_id = p_tenant AND e.entry_date BETWEEN p_start AND p_end;
    
    SELECT COUNT(*) INTO v_reversals
    FROM accounting_entries e
    WHERE e.tenant_id = p_tenant AND e.entry_date BETWEEN p_start AND p_end AND e.source_type = 'reversal';
    
    -- Retornar resultados
    RETURN QUERY SELECT 
        '1. Transações órfãs'::TEXT,
        v_orphans::TEXT,
        CASE WHEN v_orphans = 0 THEN '✅' ELSE '❌' END;
    
    RETURN QUERY SELECT 
        '2. Total Débitos'::TEXT,
        TO_CHAR(v_total_d, 'FM999G999G999D00'),
        '—';
    
    RETURN QUERY SELECT 
        '3. Total Créditos'::TEXT,
        TO_CHAR(v_total_c, 'FM999G999G999D00'),
        '—';
    
    RETURN QUERY SELECT 
        '4. Diferença (D-C)'::TEXT,
        TO_CHAR(v_diff, 'FM999G999G999D00'),
        CASE WHEN v_diff < 0.01 THEN '✅' ELSE '❌' END;
    
    RETURN QUERY SELECT 
        '5. Desbalanceados'::TEXT,
        v_unbalanced::TEXT,
        CASE WHEN v_unbalanced = 0 THEN '✅' ELSE '❌' END;
    
    RETURN QUERY SELECT 
        '6. Transitória Débitos'::TEXT,
        TO_CHAR(v_trans_d, 'FM999G999G999D00'),
        CASE WHEN ABS(v_trans_d) < 0.01 THEN '✅' ELSE '⚠️' END;
    
    RETURN QUERY SELECT 
        '7. Transitória Créditos'::TEXT,
        TO_CHAR(v_trans_c, 'FM999G999G999D00'),
        CASE WHEN ABS(v_trans_c) < 0.01 THEN '✅' ELSE '⚠️' END;
    
    RETURN QUERY SELECT 
        '8. Total Lançamentos'::TEXT,
        v_total_entries::TEXT,
        '—';
    
    RETURN QUERY SELECT 
        '9. Estornos Técnicos'::TEXT,
        v_reversals::TEXT,
        '—';
    
    -- Status final
    RETURN QUERY SELECT 
        'STATUS FINAL'::TEXT,
        CASE WHEN v_orphans = 0 AND v_diff < 0.01 AND v_unbalanced = 0 
             THEN 'APROVADO' ELSE 'PENDENTE' END,
        CASE WHEN v_orphans = 0 AND v_diff < 0.01 AND v_unbalanced = 0 
             THEN '✅' ELSE '⚠️' END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PASSO 4: TESTAR AS FUNÇÕES
-- ============================================================================

-- Testar auditoria completa de Janeiro/2025
SELECT * FROM audit_monthly_complete(
    'a53a4957-fe97-4856-b3ca-70045157b421'::UUID,
    '2025-01-01'::DATE,
    '2025-01-31'::DATE
);

-- ============================================================================
-- PASSO 5: VERIFICAR FUNÇÃO fn_auto_set_tenant_id (RESTAURAR SE NECESSÁRIO)
-- ============================================================================

-- Mostrar definição atual da função
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'fn_auto_set_tenant_id';

-- ============================================================================
-- PASSO 6: CORRIGIR VIEW COM SECURITY DEFINER → SECURITY INVOKER
-- ============================================================================

-- Recriar a view vw_honorarios_por_tipo com SECURITY INVOKER
-- (respeita RLS do usuário que consulta, não do criador)

DROP VIEW IF EXISTS vw_honorarios_por_tipo;

CREATE VIEW vw_honorarios_por_tipo 
WITH (security_invoker = true)
AS
SELECT
    fee_type,
    COUNT(*) AS quantidade,
    SUM(amount) AS valor_total,
    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS valor_recebido,
    SUM(CASE WHEN status IN ('pending', 'overdue') THEN amount ELSE 0 END) AS valor_pendente
FROM invoices
WHERE fee_type IS NOT NULL
GROUP BY fee_type
ORDER BY valor_total DESC;

COMMENT ON VIEW vw_honorarios_por_tipo IS
'Resumo de honorários por tipo (SECURITY INVOKER - respeita RLS)';

-- ============================================================================
-- PASSO 7: VERIFICAR SE HÁ OUTRAS VIEWS COM SECURITY DEFINER
-- ============================================================================

SELECT 
    schemaname,
    viewname,
    CASE WHEN definition LIKE '%security_barrier%' THEN 'security_barrier' 
         ELSE 'normal' END as type
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;
