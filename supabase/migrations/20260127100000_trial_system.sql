-- =====================================================
-- SISTEMA DE TRIAL - CONTTA FINANCEIRO
-- =====================================================
-- Cria subscription trial automaticamente para novos tenants
-- Bloqueia acesso após expiração do trial sem pagamento
-- =====================================================

-- Função para criar subscription trial para novo tenant
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS TRIGGER AS $$
DECLARE
    v_trial_days INTEGER := 14;
BEGIN
    -- Criar subscription em modo trial
    INSERT INTO subscriptions (
        tenant_id,
        plan,
        billing_cycle,
        status,
        trial_start,
        trial_end,
        current_period_start,
        current_period_end,
        amount_cents,
        currency
    ) VALUES (
        NEW.id,
        'starter', -- Plano inicial
        'monthly',
        'trialing',
        NOW(),
        NOW() + (v_trial_days || ' days')::INTERVAL,
        NOW(),
        NOW() + (v_trial_days || ' days')::INTERVAL,
        0, -- Trial é gratuito
        'BRL'
    );

    -- Atualizar tenant com data de fim do trial
    UPDATE tenants SET
        status = 'trial',
        trial_ends_at = NOW() + (v_trial_days || ' days')::INTERVAL
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar trial quando tenant é criado
DROP TRIGGER IF EXISTS trg_create_trial_on_tenant ON tenants;
CREATE TRIGGER trg_create_trial_on_tenant
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION create_trial_subscription();

-- Função para verificar status da assinatura do tenant
CREATE OR REPLACE FUNCTION check_subscription_status(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    has_active_subscription BOOLEAN,
    subscription_status TEXT,
    is_trial BOOLEAN,
    trial_days_remaining INTEGER,
    trial_expired BOOLEAN,
    needs_payment BOOLEAN,
    plan TEXT,
    current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_subscription RECORD;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    -- Buscar subscription ativa ou em trial
    SELECT * INTO v_subscription
    FROM subscriptions s
    WHERE s.tenant_id = v_tenant_id
    AND s.status IN ('active', 'trialing', 'past_due')
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_subscription IS NULL THEN
        -- Sem subscription - precisa criar conta ou pagar
        RETURN QUERY SELECT
            FALSE,
            'none'::TEXT,
            FALSE,
            0,
            FALSE,
            TRUE,
            NULL::TEXT,
            NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        v_subscription.status IN ('active', 'trialing'),
        v_subscription.status,
        v_subscription.status = 'trialing',
        CASE
            WHEN v_subscription.trial_end IS NOT NULL
            THEN GREATEST(0, EXTRACT(DAY FROM v_subscription.trial_end - NOW())::INTEGER)
            ELSE 0
        END,
        CASE
            WHEN v_subscription.status = 'trialing' AND v_subscription.trial_end < NOW()
            THEN TRUE
            ELSE FALSE
        END,
        CASE
            WHEN v_subscription.status = 'trialing' AND v_subscription.trial_end < NOW() THEN TRUE
            WHEN v_subscription.status = 'past_due' THEN TRUE
            WHEN v_subscription.status = 'canceled' THEN TRUE
            ELSE FALSE
        END,
        v_subscription.plan,
        v_subscription.current_period_end;
END;
$$;

-- Função para expirar trials automaticamente (rodar via cron)
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Atualizar subscriptions com trial expirado
    UPDATE subscriptions
    SET status = 'canceled',
        canceled_at = NOW(),
        updated_at = NOW()
    WHERE status = 'trialing'
    AND trial_end < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Atualizar status dos tenants correspondentes
    UPDATE tenants t
    SET status = 'suspended',
        updated_at = NOW()
    FROM subscriptions s
    WHERE s.tenant_id = t.id
    AND s.status = 'canceled'
    AND t.status = 'trial';

    RETURN v_count;
END;
$$;

-- View para facilitar consulta de status de trial
CREATE OR REPLACE VIEW v_tenant_subscription_status AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    t.status as tenant_status,
    t.trial_ends_at,
    s.id as subscription_id,
    s.plan,
    s.status as subscription_status,
    s.trial_start,
    s.trial_end,
    s.current_period_end,
    CASE
        WHEN s.status = 'trialing' THEN
            GREATEST(0, EXTRACT(DAY FROM s.trial_end - NOW())::INTEGER)
        ELSE NULL
    END as trial_days_remaining,
    CASE
        WHEN s.status = 'trialing' AND s.trial_end < NOW() THEN TRUE
        ELSE FALSE
    END as trial_expired,
    CASE
        WHEN s.status IN ('active', 'trialing') AND
             (s.trial_end IS NULL OR s.trial_end > NOW()) THEN TRUE
        ELSE FALSE
    END as has_access
FROM tenants t
LEFT JOIN subscriptions s ON s.tenant_id = t.id
    AND s.status IN ('active', 'trialing', 'past_due')
ORDER BY t.created_at DESC;

-- Comentários
COMMENT ON FUNCTION create_trial_subscription() IS 'Cria subscription trial de 14 dias para novos tenants';
COMMENT ON FUNCTION check_subscription_status(UUID) IS 'Verifica status da assinatura do tenant';
COMMENT ON FUNCTION expire_trials() IS 'Expira trials vencidos (executar via cron diário)';
COMMENT ON VIEW v_tenant_subscription_status IS 'View com status de subscription de todos os tenants';
