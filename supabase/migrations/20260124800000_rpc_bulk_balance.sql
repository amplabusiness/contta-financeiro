-- =====================================================
-- RPC: CÁLCULO DE SALDOS EM LOTE
-- Resolve problema de URL muito longa no PostgREST
-- =====================================================

-- Função: Calcular saldos de múltiplas contas
CREATE OR REPLACE FUNCTION fn_get_accounts_balance(
    p_tenant_id UUID DEFAULT NULL,
    p_account_ids UUID[] DEFAULT NULL,
    p_group_prefix TEXT DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_start_date DATE DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    account_code TEXT,
    account_name TEXT,
    total_debit NUMERIC,
    total_credit NUMERIC,
    balance NUMERIC
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    WITH target_accounts AS (
        SELECT coa.id, coa.code, coa.name
        FROM chart_of_accounts coa
        WHERE coa.tenant_id = v_tenant_id
          AND coa.is_active = TRUE
          AND (
              -- Filtrar por IDs específicos
              (p_account_ids IS NOT NULL AND coa.id = ANY(p_account_ids))
              OR
              -- Ou filtrar por prefixo de código
              (p_group_prefix IS NOT NULL AND coa.code LIKE p_group_prefix || '%')
          )
    ),
    account_movements AS (
        SELECT
            ael.account_id,
            COALESCE(SUM(ael.debit), 0) AS total_debit,
            COALESCE(SUM(ael.credit), 0) AS total_credit
        FROM accounting_entry_lines ael
        JOIN accounting_entries ae ON ae.id = ael.entry_id AND ae.tenant_id = v_tenant_id
        WHERE ael.account_id IN (SELECT id FROM target_accounts)
          AND (p_start_date IS NULL OR ae.entry_date >= p_start_date)
          AND (p_end_date IS NULL OR ae.entry_date <= p_end_date)
        GROUP BY ael.account_id
    )
    SELECT
        ta.id AS account_id,
        ta.code::TEXT AS account_code,
        ta.name::TEXT AS account_name,
        COALESCE(am.total_debit, 0) AS total_debit,
        COALESCE(am.total_credit, 0) AS total_credit,
        COALESCE(am.total_debit, 0) - COALESCE(am.total_credit, 0) AS balance
    FROM target_accounts ta
    LEFT JOIN account_movements am ON am.account_id = ta.id
    ORDER BY ta.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Calcular saldo de grupo inteiro (soma todas as contas)
CREATE OR REPLACE FUNCTION fn_get_group_balance(
    p_tenant_id UUID DEFAULT NULL,
    p_group_prefix TEXT DEFAULT '1.1.2.01',
    p_end_date DATE DEFAULT NULL,
    p_start_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_total_debit NUMERIC := 0;
    v_total_credit NUMERIC := 0;
    v_balance NUMERIC := 0;
    v_count INTEGER := 0;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    SELECT
        COUNT(*),
        COALESCE(SUM(total_debit), 0),
        COALESCE(SUM(total_credit), 0),
        COALESCE(SUM(balance), 0)
    INTO v_count, v_total_debit, v_total_credit, v_balance
    FROM fn_get_accounts_balance(
        v_tenant_id,
        NULL,
        p_group_prefix,
        p_end_date,
        p_start_date
    );

    RETURN jsonb_build_object(
        'group_prefix', p_group_prefix,
        'accounts_count', v_count,
        'total_debit', v_total_debit,
        'total_credit', v_total_credit,
        'balance', v_balance,
        'period', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Obter saldos de clientes (grupo 1.1.2.01)
CREATE OR REPLACE FUNCTION fn_get_client_balances(
    p_tenant_id UUID DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    client_name TEXT,
    total_debit NUMERIC,
    total_credit NUMERIC,
    balance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ab.account_id,
        ab.account_name AS client_name,
        ab.total_debit,
        ab.total_credit,
        ab.balance
    FROM fn_get_accounts_balance(
        p_tenant_id,
        NULL,
        '1.1.2.01',
        p_end_date,
        NULL
    ) ab
    WHERE ab.balance != 0
    ORDER BY ab.balance DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_get_accounts_balance(UUID, UUID[], TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_group_balance(UUID, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_client_balances(UUID, DATE) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
