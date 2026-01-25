-- =====================================================
-- RELATÓRIOS DE CONSISTÊNCIA CONTÁBIL
-- Checklist item 1.2 - Relatórios de Consistência
-- =====================================================

-- 1. BALANCETE DE VERIFICAÇÃO
-- =====================================================
-- Retorna todas as contas com seus saldos, validando débitos = créditos

CREATE OR REPLACE FUNCTION fn_balancete_verificacao(
    p_tenant_id UUID DEFAULT NULL,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    code VARCHAR(20),
    name VARCHAR(255),
    account_type VARCHAR(20),
    parent_id UUID,
    level INTEGER,
    total_debit NUMERIC,
    total_credit NUMERIC,
    saldo_anterior NUMERIC,
    saldo_periodo NUMERIC,
    saldo_final NUMERIC,
    is_synthetic BOOLEAN
) AS $$
DECLARE
    v_tenant_id UUID;
    v_data_inicio DATE;
    v_data_fim DATE;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_data_inicio := COALESCE(p_data_inicio, DATE_TRUNC('year', CURRENT_DATE)::DATE);
    v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

    RETURN QUERY
    WITH movimentos AS (
        SELECT
            ael.account_id AS acc_id,
            SUM(CASE WHEN ae.competence_date < v_data_inicio THEN COALESCE(ael.debit, 0) ELSE 0 END) AS debit_anterior,
            SUM(CASE WHEN ae.competence_date < v_data_inicio THEN COALESCE(ael.credit, 0) ELSE 0 END) AS credit_anterior,
            SUM(CASE WHEN ae.competence_date BETWEEN v_data_inicio AND v_data_fim THEN COALESCE(ael.debit, 0) ELSE 0 END) AS debit_periodo,
            SUM(CASE WHEN ae.competence_date BETWEEN v_data_inicio AND v_data_fim THEN COALESCE(ael.credit, 0) ELSE 0 END) AS credit_periodo
        FROM accounting_entry_lines ael
        JOIN accounting_entries ae ON ae.id = ael.entry_id
        WHERE ael.tenant_id = v_tenant_id
          AND ae.competence_date <= v_data_fim
        GROUP BY ael.account_id
    )
    SELECT
        coa.id AS account_id,
        coa.code,
        coa.name,
        coa.account_type,
        coa.parent_id,
        (LENGTH(coa.code) - LENGTH(REPLACE(coa.code, '.', '')))::INTEGER AS level,
        COALESCE(m.debit_periodo, 0) AS total_debit,
        COALESCE(m.credit_periodo, 0) AS total_credit,
        CASE
            WHEN coa.account_type IN ('asset', 'expense') THEN
                COALESCE(m.debit_anterior, 0) - COALESCE(m.credit_anterior, 0)
            ELSE
                COALESCE(m.credit_anterior, 0) - COALESCE(m.debit_anterior, 0)
        END AS saldo_anterior,
        CASE
            WHEN coa.account_type IN ('asset', 'expense') THEN
                COALESCE(m.debit_periodo, 0) - COALESCE(m.credit_periodo, 0)
            ELSE
                COALESCE(m.credit_periodo, 0) - COALESCE(m.debit_periodo, 0)
        END AS saldo_periodo,
        CASE
            WHEN coa.account_type IN ('asset', 'expense') THEN
                (COALESCE(m.debit_anterior, 0) + COALESCE(m.debit_periodo, 0)) -
                (COALESCE(m.credit_anterior, 0) + COALESCE(m.credit_periodo, 0))
            ELSE
                (COALESCE(m.credit_anterior, 0) + COALESCE(m.credit_periodo, 0)) -
                (COALESCE(m.debit_anterior, 0) + COALESCE(m.debit_periodo, 0))
        END AS saldo_final,
        coa.is_synthetic
    FROM chart_of_accounts coa
    LEFT JOIN movimentos m ON m.acc_id = coa.id
    WHERE coa.tenant_id = v_tenant_id
      AND coa.is_active = true
    ORDER BY coa.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RAZÃO POR CONTA
-- =====================================================
-- Retorna movimentos detalhados de uma conta específica

CREATE OR REPLACE FUNCTION fn_razao_conta(
    p_account_code TEXT,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    entry_id UUID,
    entry_date DATE,
    competence_date DATE,
    description TEXT,
    document_number TEXT,
    debit NUMERIC,
    credit NUMERIC,
    saldo_acumulado NUMERIC,
    entry_type TEXT,
    reference_type TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
    v_account_id UUID;
    v_account_type TEXT;
    v_saldo_anterior NUMERIC;
    v_data_inicio DATE;
    v_data_fim DATE;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_data_inicio := COALESCE(p_data_inicio, DATE_TRUNC('year', CURRENT_DATE)::DATE);
    v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

    -- Busca conta
    SELECT id, account_type INTO v_account_id, v_account_type
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id AND code = p_account_code;

    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'Conta % não encontrada', p_account_code;
    END IF;

    -- Calcula saldo anterior
    SELECT
        CASE
            WHEN v_account_type IN ('asset', 'expense') THEN
                COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0)
            ELSE
                COALESCE(SUM(ael.credit), 0) - COALESCE(SUM(ael.debit), 0)
        END
    INTO v_saldo_anterior
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.tenant_id = v_tenant_id
      AND ael.account_id = v_account_id
      AND ae.competence_date < v_data_inicio;

    v_saldo_anterior := COALESCE(v_saldo_anterior, 0);

    -- Retorna movimentos com saldo acumulado
    RETURN QUERY
    WITH movimentos AS (
        SELECT
            ae.id AS entry_id,
            ae.entry_date,
            ae.competence_date,
            ae.description,
            ae.document_number,
            COALESCE(ael.debit, 0) AS debit,
            COALESCE(ael.credit, 0) AS credit,
            ae.entry_type,
            ae.reference_type,
            ROW_NUMBER() OVER (ORDER BY ae.competence_date, ae.entry_date, ae.id) AS rn
        FROM accounting_entry_lines ael
        JOIN accounting_entries ae ON ae.id = ael.entry_id
        WHERE ael.tenant_id = v_tenant_id
          AND ael.account_id = v_account_id
          AND ae.competence_date BETWEEN v_data_inicio AND v_data_fim
    )
    SELECT
        m.entry_id,
        m.entry_date,
        m.competence_date,
        m.description,
        m.document_number,
        m.debit,
        m.credit,
        v_saldo_anterior + SUM(
            CASE
                WHEN v_account_type IN ('asset', 'expense') THEN m.debit - m.credit
                ELSE m.credit - m.debit
            END
        ) OVER (ORDER BY m.rn) AS saldo_acumulado,
        m.entry_type,
        m.reference_type
    FROM movimentos m
    ORDER BY m.competence_date, m.entry_date, m.entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CONCILIAÇÃO BANCO X CONTABILIDADE
-- =====================================================
-- Compara saldo do extrato bancário com saldo contábil

CREATE OR REPLACE FUNCTION fn_conciliacao_bancaria(
    p_bank_account_code TEXT DEFAULT '1.1.1.05',
    p_data_referencia DATE DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_data_ref DATE;
    v_account_id UUID;
    v_saldo_contabil NUMERIC;
    v_saldo_extrato NUMERIC;
    v_tx_nao_conciliadas JSONB;
    v_divergencia NUMERIC;
    v_saldo_inicial NUMERIC := 0;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_data_ref := COALESCE(p_data_referencia, CURRENT_DATE);

    -- Busca conta contábil do banco
    SELECT id INTO v_account_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id AND code = p_bank_account_code;

    -- Saldo contábil (conta devedora: D - C)
    SELECT COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0)
    INTO v_saldo_contabil
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.tenant_id = v_tenant_id
      AND ael.account_id = v_account_id
      AND ae.competence_date <= v_data_ref;

    -- Saldo do extrato bancário (soma de transações)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_saldo_extrato
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date <= v_data_ref;

    -- Buscar saldo inicial do banco se existir
    SELECT COALESCE(initial_balance, 0) INTO v_saldo_inicial
    FROM bank_accounts
    WHERE tenant_id = v_tenant_id
      AND is_active = true
    LIMIT 1;

    v_saldo_extrato := v_saldo_extrato + v_saldo_inicial;

    -- Transações não conciliadas
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'date', transaction_date,
        'description', description,
        'amount', amount
    )), '[]'::jsonb)
    INTO v_tx_nao_conciliadas
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND matched = false
      AND transaction_date <= v_data_ref;

    v_divergencia := v_saldo_contabil - v_saldo_extrato;

    RETURN jsonb_build_object(
        'data_referencia', v_data_ref,
        'conta_bancaria', p_bank_account_code,
        'saldo_contabil', v_saldo_contabil,
        'saldo_extrato', v_saldo_extrato,
        'divergencia', v_divergencia,
        'is_conciliado', ABS(v_divergencia) < 0.01,
        'transacoes_nao_conciliadas', v_tx_nao_conciliadas,
        'qtd_pendentes', jsonb_array_length(v_tx_nao_conciliadas)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CONTAS COM SALDO INVERTIDO
-- =====================================================
-- Lista contas com saldo anormal (ativo negativo, passivo positivo credora, etc.)

CREATE OR REPLACE FUNCTION fn_contas_saldo_invertido(
    p_tenant_id UUID DEFAULT NULL,
    p_data_referencia DATE DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    code VARCHAR(20),
    name VARCHAR(255),
    account_type VARCHAR(20),
    expected_nature TEXT,
    saldo NUMERIC,
    status TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
    v_data_ref DATE;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_data_ref := COALESCE(p_data_referencia, CURRENT_DATE);

    RETURN QUERY
    WITH saldos AS (
        SELECT
            coa.id,
            coa.code,
            coa.name,
            coa.account_type,
            COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) AS saldo_devedor
        FROM chart_of_accounts coa
        LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
        LEFT JOIN accounting_entries ae ON ae.id = ael.entry_id AND ae.competence_date <= v_data_ref
        WHERE coa.tenant_id = v_tenant_id
          AND coa.is_active = true
          AND coa.is_synthetic = false
        GROUP BY coa.id, coa.code, coa.name, coa.account_type
        HAVING COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) != 0
    )
    SELECT
        s.id AS account_id,
        s.code,
        s.name,
        s.account_type,
        CASE
            WHEN s.account_type IN ('asset', 'expense') THEN 'DEVEDOR (positivo)'
            ELSE 'CREDOR (negativo)'
        END::TEXT AS expected_nature,
        CASE
            WHEN s.account_type IN ('asset', 'expense') THEN s.saldo_devedor
            ELSE -s.saldo_devedor
        END AS saldo,
        CASE
            WHEN s.account_type = 'asset' AND s.saldo_devedor < -10 THEN 'INVERTIDO'
            WHEN s.account_type = 'liability' AND s.saldo_devedor > 10 THEN 'INVERTIDO'
            WHEN s.account_type = 'revenue' AND s.saldo_devedor > 10 THEN 'INVERTIDO'
            WHEN s.account_type = 'expense' AND s.saldo_devedor < -10 THEN 'INVERTIDO'
            WHEN s.account_type = 'equity' AND s.saldo_devedor > 10 THEN 'INVERTIDO'
            ELSE 'NORMAL'
        END::TEXT AS status
    FROM saldos s
    WHERE
        (s.account_type = 'asset' AND s.saldo_devedor < -10)
        OR (s.account_type = 'liability' AND s.saldo_devedor > 10)
        OR (s.account_type = 'revenue' AND s.saldo_devedor > 10)
        OR (s.account_type = 'expense' AND s.saldo_devedor < -10)
        OR (s.account_type = 'equity' AND s.saldo_devedor > 10)
    ORDER BY s.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RESUMO DE CONSISTÊNCIA
-- =====================================================
-- Dashboard consolidado de saúde contábil

CREATE OR REPLACE FUNCTION fn_resumo_consistencia(
    p_tenant_id UUID DEFAULT NULL,
    p_data_referencia DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_data_ref DATE;
    v_total_debitos NUMERIC;
    v_total_creditos NUMERIC;
    v_contas_invertidas INTEGER;
    v_alertas_pendentes INTEGER;
    v_tx_nao_conciliadas INTEGER;
    v_entries_desbalanceados INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());
    v_data_ref := COALESCE(p_data_referencia, CURRENT_DATE);

    -- Total de débitos e créditos
    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO v_total_debitos, v_total_creditos
    FROM accounting_entry_lines
    WHERE tenant_id = v_tenant_id;

    -- Contas com saldo invertido
    SELECT COUNT(*)
    INTO v_contas_invertidas
    FROM fn_contas_saldo_invertido(v_tenant_id, v_data_ref);

    -- Alertas pendentes
    SELECT COUNT(*)
    INTO v_alertas_pendentes
    FROM accounting_alerts
    WHERE tenant_id = v_tenant_id AND resolved_at IS NULL;

    -- Transações não conciliadas
    SELECT COUNT(*)
    INTO v_tx_nao_conciliadas
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id AND matched = false;

    -- Lançamentos desbalanceados
    SELECT COUNT(*)
    INTO v_entries_desbalanceados
    FROM accounting_entries
    WHERE tenant_id = v_tenant_id
      AND ABS(COALESCE(total_debit, 0) - COALESCE(total_credit, 0)) > 0.01;

    RETURN jsonb_build_object(
        'data_referencia', v_data_ref,
        'total_debitos', v_total_debitos,
        'total_creditos', v_total_creditos,
        'diferenca_global', ABS(v_total_debitos - v_total_creditos),
        'is_balanceado', ABS(v_total_debitos - v_total_creditos) < 1,
        'contas_saldo_invertido', v_contas_invertidas,
        'alertas_pendentes', v_alertas_pendentes,
        'transacoes_nao_conciliadas', v_tx_nao_conciliadas,
        'entries_desbalanceados', v_entries_desbalanceados,
        'score_saude', CASE
            WHEN v_entries_desbalanceados > 0 THEN 0
            WHEN v_contas_invertidas > 5 THEN 25
            WHEN v_alertas_pendentes > 10 THEN 50
            WHEN v_tx_nao_conciliadas > 50 THEN 75
            ELSE 100
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_balancete_verificacao(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_razao_conta(TEXT, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_conciliacao_bancaria(TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_contas_saldo_invertido(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_resumo_consistencia(UUID, DATE) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
