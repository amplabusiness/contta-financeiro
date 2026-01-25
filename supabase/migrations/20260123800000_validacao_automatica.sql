-- =====================================================
-- VALIDAÇÃO AUTOMÁTICA DE INTEGRIDADE CONTÁBIL
-- Checklist item 1.1 - Validações Automáticas
-- =====================================================

-- 1. TABELA DE ALERTAS CONTÁBEIS
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'UNBALANCED_ENTRY',      -- Lançamento com débito != crédito
        'NEGATIVE_CLIENT_BALANCE', -- Cliente com saldo negativo (pagou mais que faturou)
        'ORPHAN_ENTRY_LINE',     -- Linha sem entry_id válido
        'INVERTED_BALANCE',      -- Conta com saldo invertido
        'DUPLICATE_PROVISION',   -- Provisão duplicada no mês
        'MISSING_PROVISION',     -- Cliente ativo sem provisão no mês
        'INTEGRITY_CHECK'        -- Resultado da verificação diária
    )),
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    entry_id UUID REFERENCES accounting_entries(id),
    account_id UUID REFERENCES chart_of_accounts(id),
    client_id UUID REFERENCES clients(id),
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_accounting_alerts_tenant ON accounting_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounting_alerts_type ON accounting_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_accounting_alerts_severity ON accounting_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_accounting_alerts_unresolved ON accounting_alerts(tenant_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_alerts_entry ON accounting_alerts(entry_id) WHERE entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_alerts_created ON accounting_alerts(created_at DESC);

-- RLS para alertas
ALTER TABLE accounting_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem alertas do próprio tenant" ON accounting_alerts
    FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Sistema pode inserir alertas" ON accounting_alerts
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Usuários podem resolver alertas do próprio tenant" ON accounting_alerts
    FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- 2. TRIGGER: LANÇAMENTO DESBALANCEADO
-- =====================================================
-- Alerta quando total_debit != total_credit em um lançamento

CREATE OR REPLACE FUNCTION fn_check_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_diff NUMERIC;
BEGIN
    -- Calcula diferença (tolerância de 0.01 para arredondamentos)
    v_diff := ABS(COALESCE(NEW.total_debit, 0) - COALESCE(NEW.total_credit, 0));

    IF v_diff > 0.01 THEN
        -- Insere alerta
        INSERT INTO accounting_alerts (
            tenant_id,
            alert_type,
            severity,
            entry_id,
            description,
            details
        ) VALUES (
            NEW.tenant_id,
            'UNBALANCED_ENTRY',
            'critical',
            NEW.id,
            FORMAT('Lançamento desbalanceado: Débito R$ %s ≠ Crédito R$ %s (diferença: R$ %s)',
                TO_CHAR(NEW.total_debit, 'FM999G999G999D00'),
                TO_CHAR(NEW.total_credit, 'FM999G999G999D00'),
                TO_CHAR(v_diff, 'FM999G999G999D00')),
            jsonb_build_object(
                'total_debit', NEW.total_debit,
                'total_credit', NEW.total_credit,
                'difference', v_diff,
                'entry_description', NEW.description,
                'competence_date', NEW.competence_date
            )
        );

        -- Opcionalmente pode bloquear o lançamento (descomentando abaixo)
        -- RAISE EXCEPTION 'Lançamento desbalanceado: débito (%) ≠ crédito (%)', NEW.total_debit, NEW.total_credit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que dispara após INSERT ou UPDATE em accounting_entries
DROP TRIGGER IF EXISTS trg_check_entry_balance ON accounting_entries;
CREATE TRIGGER trg_check_entry_balance
    AFTER INSERT OR UPDATE OF total_debit, total_credit ON accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_entry_balance();

-- 3. FUNÇÃO: VERIFICAR SALDO NEGATIVO DE CLIENTES
-- =====================================================
-- Detecta contas de clientes (1.1.2.01.*) com saldo negativo

CREATE OR REPLACE FUNCTION fn_check_negative_client_balances(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    account_code TEXT,
    account_name TEXT,
    client_id UUID,
    client_name TEXT,
    balance NUMERIC,
    alert_created BOOLEAN
) AS $$
DECLARE
    v_tenant_id UUID;
    r RECORD;
BEGIN
    -- Usa tenant do parâmetro ou do contexto
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    FOR r IN (
        SELECT
            coa.id AS acc_id,
            coa.code AS acc_code,
            coa.name AS acc_name,
            c.id AS cli_id,
            c.name AS cli_name,
            COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) AS saldo
        FROM chart_of_accounts coa
        LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
        LEFT JOIN clients c ON LOWER(coa.name) = LOWER(c.name) AND c.tenant_id = v_tenant_id
        WHERE coa.tenant_id = v_tenant_id
          AND coa.code LIKE '1.1.2.01.%'  -- Contas de clientes a receber
        GROUP BY coa.id, coa.code, coa.name, c.id, c.name
        HAVING COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) < -100  -- Tolerância de R$ 100
    )
    LOOP
        -- Verifica se já existe alerta não resolvido para esta conta
        IF NOT EXISTS (
            SELECT 1 FROM accounting_alerts aa
            WHERE aa.tenant_id = v_tenant_id
              AND aa.alert_type = 'NEGATIVE_CLIENT_BALANCE'
              AND aa.account_id = r.acc_id
              AND aa.resolved_at IS NULL
        ) THEN
            -- Cria novo alerta
            INSERT INTO accounting_alerts (
                tenant_id,
                alert_type,
                severity,
                account_id,
                client_id,
                description,
                details
            ) VALUES (
                v_tenant_id,
                'NEGATIVE_CLIENT_BALANCE',
                'error',
                r.acc_id,
                r.cli_id,
                FORMAT('Conta %s (%s) com saldo negativo: R$ %s',
                    r.acc_code, r.acc_name, TO_CHAR(r.saldo, 'FM999G999G999D00')),
                jsonb_build_object(
                    'balance', r.saldo,
                    'client_name', r.cli_name,
                    'possible_cause', 'Cliente pagou mais do que foi faturado'
                )
            );

            account_id := r.acc_id;
            account_code := r.acc_code;
            account_name := r.acc_name;
            client_id := r.cli_id;
            client_name := r.cli_name;
            balance := r.saldo;
            alert_created := true;
            RETURN NEXT;
        ELSE
            account_id := r.acc_id;
            account_code := r.acc_code;
            account_name := r.acc_name;
            client_id := r.cli_id;
            client_name := r.cli_name;
            balance := r.saldo;
            alert_created := false;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNÇÃO: VERIFICAÇÃO DIÁRIA DE INTEGRIDADE
-- =====================================================
-- Job que verifica toda a integridade contábil

CREATE OR REPLACE FUNCTION fn_daily_integrity_check(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSONB;
    v_unbalanced_count INTEGER;
    v_negative_count INTEGER;
    v_orphan_count INTEGER;
    v_sum_debits NUMERIC;
    v_sum_credits NUMERIC;
    v_global_diff NUMERIC;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- 1. Conta lançamentos desbalanceados
    SELECT COUNT(*) INTO v_unbalanced_count
    FROM accounting_entries
    WHERE tenant_id = v_tenant_id
      AND ABS(COALESCE(total_debit, 0) - COALESCE(total_credit, 0)) > 0.01;

    -- 2. Conta clientes com saldo negativo
    SELECT COUNT(*) INTO v_negative_count
    FROM (
        SELECT coa.id
        FROM chart_of_accounts coa
        LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
        WHERE coa.tenant_id = v_tenant_id
          AND coa.code LIKE '1.1.2.01.%'
        GROUP BY coa.id
        HAVING COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) < -100
    ) AS neg;

    -- 3. Conta linhas órfãs (sem entry válido)
    SELECT COUNT(*) INTO v_orphan_count
    FROM accounting_entry_lines ael
    WHERE ael.tenant_id = v_tenant_id
      AND NOT EXISTS (
          SELECT 1 FROM accounting_entries ae
          WHERE ae.id = ael.entry_id
      );

    -- 4. Verifica soma global de débitos = créditos
    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO v_sum_debits, v_sum_credits
    FROM accounting_entry_lines
    WHERE tenant_id = v_tenant_id;

    v_global_diff := ABS(v_sum_debits - v_sum_credits);

    -- Monta resultado
    v_result := jsonb_build_object(
        'check_date', NOW(),
        'tenant_id', v_tenant_id,
        'unbalanced_entries', v_unbalanced_count,
        'negative_client_balances', v_negative_count,
        'orphan_entry_lines', v_orphan_count,
        'global_debits', v_sum_debits,
        'global_credits', v_sum_credits,
        'global_difference', v_global_diff,
        'is_healthy', (v_unbalanced_count = 0 AND v_orphan_count = 0 AND v_global_diff < 1)
    );

    -- Se há problemas, cria alerta
    IF v_unbalanced_count > 0 OR v_orphan_count > 0 OR v_global_diff >= 1 THEN
        INSERT INTO accounting_alerts (
            tenant_id,
            alert_type,
            severity,
            description,
            details
        ) VALUES (
            v_tenant_id,
            'INTEGRITY_CHECK',
            CASE
                WHEN v_unbalanced_count > 0 OR v_global_diff >= 1 THEN 'critical'
                WHEN v_orphan_count > 0 THEN 'error'
                ELSE 'warning'
            END,
            FORMAT('Verificação diária: %s lançamentos desbalanceados, %s saldos negativos, %s linhas órfãs',
                v_unbalanced_count, v_negative_count, v_orphan_count),
            v_result
        );
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNÇÃO AUXILIAR: RESOLVER ALERTA
-- =====================================================

-- Drop existing function to avoid parameter name conflicts
DROP FUNCTION IF EXISTS fn_resolve_alert(UUID, TEXT);

CREATE OR REPLACE FUNCTION fn_resolve_alert(
    p_alert_id UUID,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE accounting_alerts
    SET resolved_at = NOW(),
        resolved_by = auth.uid(),
        resolution_notes = p_resolution_notes,
        updated_at = NOW()
    WHERE id = p_alert_id
      AND tenant_id = get_my_tenant_id()
      AND resolved_at IS NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. VIEW: ALERTAS PENDENTES
-- =====================================================

CREATE OR REPLACE VIEW vw_pending_alerts AS
SELECT
    a.id,
    a.alert_type,
    a.severity,
    a.description,
    a.details,
    a.created_at,
    ae.description AS entry_description,
    coa.code AS account_code,
    coa.name AS account_name,
    c.name AS client_name
FROM accounting_alerts a
LEFT JOIN accounting_entries ae ON ae.id = a.entry_id
LEFT JOIN chart_of_accounts coa ON coa.id = a.account_id
LEFT JOIN clients c ON c.id = a.client_id
WHERE a.resolved_at IS NULL
ORDER BY
    CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'error' THEN 2
        WHEN 'warning' THEN 3
        ELSE 4
    END,
    a.created_at DESC;

-- 7. GRANTS
-- =====================================================

GRANT SELECT ON accounting_alerts TO authenticated;
GRANT INSERT ON accounting_alerts TO authenticated;
GRANT UPDATE ON accounting_alerts TO authenticated;
GRANT SELECT ON vw_pending_alerts TO authenticated;

GRANT EXECUTE ON FUNCTION fn_check_negative_client_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_daily_integrity_check(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_resolve_alert(UUID, TEXT) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
