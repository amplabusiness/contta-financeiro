-- =====================================================
-- SISTEMA DE BILLING E ASSINATURAS - CONTTA FINANCEIRO
-- =====================================================
-- Integração com Stripe para cobrança de planos SaaS
-- =====================================================

-- 1. TABELA DE LIMITES POR PLANO
-- Define as quotas e limites de cada plano
CREATE TABLE IF NOT EXISTS plan_limits (
    plan TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    -- Limites de recursos
    max_clients INTEGER NOT NULL DEFAULT 0, -- 0 = ilimitado
    max_invoices_per_month INTEGER NOT NULL DEFAULT 0,
    max_bank_accounts INTEGER NOT NULL DEFAULT 0,
    max_users INTEGER NOT NULL DEFAULT 0,
    max_storage_mb INTEGER NOT NULL DEFAULT 0,
    -- Features habilitadas
    features JSONB NOT NULL DEFAULT '{}',
    -- Preços (em centavos para evitar problemas de floating point)
    price_monthly_cents INTEGER NOT NULL DEFAULT 0,
    price_yearly_cents INTEGER NOT NULL DEFAULT 0,
    -- Stripe
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir planos padrão
INSERT INTO plan_limits (plan, display_name, description, max_clients, max_invoices_per_month, max_bank_accounts, max_users, max_storage_mb, price_monthly_cents, price_yearly_cents, features, sort_order) VALUES
('starter', 'Starter', 'Ideal para escritórios pequenos', 50, 500, 2, 2, 1024, 9900, 99000,
 '{"conciliacao_automatica": true, "relatorios_basicos": true, "suporte_email": true}', 1),
('professional', 'Professional', 'Para escritórios em crescimento', 200, 2000, 5, 5, 5120, 19900, 199000,
 '{"conciliacao_automatica": true, "relatorios_avancados": true, "ia_classificacao": true, "suporte_prioritario": true, "api_access": true}', 2),
('enterprise', 'Enterprise', 'Para grandes operações', 0, 0, 0, 0, 0, 49900, 499000,
 '{"conciliacao_automatica": true, "relatorios_avancados": true, "ia_classificacao": true, "ia_agentes": true, "suporte_dedicado": true, "api_access": true, "white_label": true, "sla_garantido": true}', 3)
ON CONFLICT (plan) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    max_clients = EXCLUDED.max_clients,
    max_invoices_per_month = EXCLUDED.max_invoices_per_month,
    max_bank_accounts = EXCLUDED.max_bank_accounts,
    max_users = EXCLUDED.max_users,
    max_storage_mb = EXCLUDED.max_storage_mb,
    price_monthly_cents = EXCLUDED.price_monthly_cents,
    price_yearly_cents = EXCLUDED.price_yearly_cents,
    features = EXCLUDED.features,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- 2. TABELA DE CLIENTES STRIPE
-- Vincula tenant ao customer do Stripe
CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    email TEXT,
    name TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id)
);

-- 3. TABELA DE ASSINATURAS
-- Gerencia assinaturas ativas
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT REFERENCES stripe_customers(stripe_customer_id),
    -- Plano
    plan TEXT NOT NULL REFERENCES plan_limits(plan),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'paused')),
    -- Datas
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    -- Valores
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    -- Desconto
    discount_percent INTEGER DEFAULT 0,
    discount_ends_at TIMESTAMPTZ,
    coupon_code TEXT,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELA DE PAGAMENTOS
-- Histórico de todos os pagamentos
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_invoice_id TEXT,
    -- Valores
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
    -- Método de pagamento
    payment_method TEXT, -- 'card', 'pix', 'boleto'
    payment_method_details JSONB DEFAULT '{}',
    -- Datas
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    -- Fatura
    invoice_url TEXT,
    receipt_url TEXT,
    -- Erros
    failure_code TEXT,
    failure_message TEXT,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELA DE CUPONS
-- Gerencia cupons de desconto
CREATE TABLE IF NOT EXISTS billing_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    stripe_coupon_id TEXT,
    -- Desconto
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value INTEGER NOT NULL, -- percent (0-100) ou centavos
    -- Aplicabilidade
    applicable_plans TEXT[] DEFAULT ARRAY['starter', 'professional', 'enterprise'],
    -- Limites
    max_redemptions INTEGER, -- NULL = ilimitado
    redemptions_count INTEGER NOT NULL DEFAULT 0,
    -- Validade
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ,
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TABELA DE USO/CONSUMO
-- Rastreia uso de recursos por tenant (para limites)
CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    -- Contadores
    clients_count INTEGER NOT NULL DEFAULT 0,
    invoices_count INTEGER NOT NULL DEFAULT 0,
    bank_accounts_count INTEGER NOT NULL DEFAULT 0,
    users_count INTEGER NOT NULL DEFAULT 0,
    storage_used_mb INTEGER NOT NULL DEFAULT 0,
    api_calls_count INTEGER NOT NULL DEFAULT 0,
    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, period_start, period_end)
);

-- 7. WEBHOOK EVENTS LOG
-- Log de eventos do Stripe para debugging e auditoria
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_stripe_customers_tenant ON stripe_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_period ON tenant_usage(tenant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed) WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_billing_coupons_code ON billing_coupons(code);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Plan limits são públicos (todos podem ver os planos)
CREATE POLICY "plan_limits_select_all" ON plan_limits FOR SELECT USING (true);

-- Stripe customers - apenas próprio tenant
CREATE POLICY "stripe_customers_tenant_isolation" ON stripe_customers
    FOR ALL USING (tenant_id = get_my_tenant_id());

-- Subscriptions - apenas próprio tenant
CREATE POLICY "subscriptions_tenant_isolation" ON subscriptions
    FOR ALL USING (tenant_id = get_my_tenant_id());

-- Payments - apenas próprio tenant
CREATE POLICY "subscription_payments_tenant_isolation" ON subscription_payments
    FOR ALL USING (tenant_id = get_my_tenant_id());

-- Coupons - todos podem ver cupons ativos
CREATE POLICY "billing_coupons_select_active" ON billing_coupons
    FOR SELECT USING (is_active = true);

-- Tenant usage - apenas próprio tenant
CREATE POLICY "tenant_usage_tenant_isolation" ON tenant_usage
    FOR ALL USING (tenant_id = get_my_tenant_id());

-- Webhook events - apenas service role (não visível para usuários)
CREATE POLICY "stripe_webhook_events_service_only" ON stripe_webhook_events
    FOR ALL USING (false);

-- =====================================================
-- FUNÇÕES
-- =====================================================

-- Função para verificar se tenant está dentro dos limites
CREATE OR REPLACE FUNCTION check_tenant_limits(p_tenant_id UUID, p_resource TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan TEXT;
    v_limits RECORD;
    v_current_count INTEGER;
    v_max_allowed INTEGER;
    v_result JSONB;
BEGIN
    -- Pegar plano atual do tenant
    SELECT plan INTO v_plan FROM tenants WHERE id = p_tenant_id;

    IF v_plan IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'error', 'Tenant não encontrado');
    END IF;

    -- Pegar limites do plano
    SELECT * INTO v_limits FROM plan_limits WHERE plan = v_plan;

    -- Verificar recurso específico
    CASE p_resource
        WHEN 'clients' THEN
            SELECT COUNT(*) INTO v_current_count FROM clients WHERE tenant_id = p_tenant_id;
            v_max_allowed := v_limits.max_clients;
        WHEN 'invoices' THEN
            SELECT COUNT(*) INTO v_current_count
            FROM invoices
            WHERE tenant_id = p_tenant_id
            AND created_at >= date_trunc('month', CURRENT_DATE);
            v_max_allowed := v_limits.max_invoices_per_month;
        WHEN 'bank_accounts' THEN
            SELECT COUNT(*) INTO v_current_count FROM bank_accounts WHERE tenant_id = p_tenant_id;
            v_max_allowed := v_limits.max_bank_accounts;
        WHEN 'users' THEN
            SELECT COUNT(*) INTO v_current_count FROM tenant_users WHERE tenant_id = p_tenant_id;
            v_max_allowed := v_limits.max_users;
        ELSE
            RETURN jsonb_build_object('allowed', false, 'error', 'Recurso desconhecido');
    END CASE;

    -- 0 significa ilimitado
    IF v_max_allowed = 0 THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'current', v_current_count,
            'max', 'unlimited',
            'plan', v_plan
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_current_count < v_max_allowed,
        'current', v_current_count,
        'max', v_max_allowed,
        'remaining', v_max_allowed - v_current_count,
        'plan', v_plan,
        'upgrade_needed', v_current_count >= v_max_allowed
    );
END;
$$;

-- Função para calcular uso do tenant
CREATE OR REPLACE FUNCTION calculate_tenant_usage(p_tenant_id UUID)
RETURNS tenant_usage
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage tenant_usage;
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
    v_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    INSERT INTO tenant_usage (
        tenant_id,
        period_start,
        period_end,
        clients_count,
        invoices_count,
        bank_accounts_count,
        users_count,
        storage_used_mb,
        api_calls_count,
        calculated_at
    )
    SELECT
        p_tenant_id,
        v_period_start,
        v_period_end,
        (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id),
        (SELECT COUNT(*) FROM invoices WHERE tenant_id = p_tenant_id AND created_at >= v_period_start),
        (SELECT COUNT(*) FROM bank_accounts WHERE tenant_id = p_tenant_id),
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = p_tenant_id),
        0, -- Storage será calculado separadamente
        0, -- API calls será calculado separadamente
        now()
    ON CONFLICT (tenant_id, period_start, period_end)
    DO UPDATE SET
        clients_count = EXCLUDED.clients_count,
        invoices_count = EXCLUDED.invoices_count,
        bank_accounts_count = EXCLUDED.bank_accounts_count,
        users_count = EXCLUDED.users_count,
        calculated_at = now()
    RETURNING * INTO v_usage;

    RETURN v_usage;
END;
$$;

-- Função para obter subscription atual do tenant
CREATE OR REPLACE FUNCTION get_tenant_subscription(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    subscription_id UUID,
    plan TEXT,
    plan_display_name TEXT,
    status TEXT,
    billing_cycle TEXT,
    current_period_end TIMESTAMPTZ,
    amount_cents INTEGER,
    features JSONB,
    limits JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, get_my_tenant_id());

    RETURN QUERY
    SELECT
        s.id as subscription_id,
        s.plan,
        pl.display_name as plan_display_name,
        s.status,
        s.billing_cycle,
        s.current_period_end,
        s.amount_cents,
        pl.features,
        jsonb_build_object(
            'max_clients', pl.max_clients,
            'max_invoices_per_month', pl.max_invoices_per_month,
            'max_bank_accounts', pl.max_bank_accounts,
            'max_users', pl.max_users,
            'max_storage_mb', pl.max_storage_mb
        ) as limits
    FROM subscriptions s
    JOIN plan_limits pl ON pl.plan = s.plan
    WHERE s.tenant_id = v_tenant_id
    AND s.status IN ('active', 'trialing', 'past_due')
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$;

-- Função para validar cupom
CREATE OR REPLACE FUNCTION validate_coupon(p_code TEXT, p_plan TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coupon billing_coupons;
BEGIN
    SELECT * INTO v_coupon
    FROM billing_coupons
    WHERE code = UPPER(p_code)
    AND is_active = true
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_redemptions IS NULL OR redemptions_count < max_redemptions);

    IF v_coupon IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Cupom inválido ou expirado');
    END IF;

    -- Verificar se aplica ao plano
    IF p_plan IS NOT NULL AND NOT (p_plan = ANY(v_coupon.applicable_plans)) THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Cupom não aplicável a este plano');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'code', v_coupon.code,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'description', v_coupon.description
    );
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plan_limits_updated_at
    BEFORE UPDATE ON plan_limits
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trg_stripe_customers_updated_at
    BEFORE UPDATE ON stripe_customers
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trg_subscription_payments_updated_at
    BEFORE UPDATE ON subscription_payments
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER trg_billing_coupons_updated_at
    BEFORE UPDATE ON billing_coupons
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

-- Trigger para sincronizar status do tenant com subscription
CREATE OR REPLACE FUNCTION sync_tenant_subscription_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Quando subscription muda de status, atualiza tenant
    IF NEW.status = 'active' OR NEW.status = 'trialing' THEN
        UPDATE tenants SET status = 'active', plan = NEW.plan, updated_at = now()
        WHERE id = NEW.tenant_id;
    ELSIF NEW.status = 'canceled' THEN
        UPDATE tenants SET status = 'cancelled', updated_at = now()
        WHERE id = NEW.tenant_id;
    ELSIF NEW.status = 'past_due' THEN
        UPDATE tenants SET status = 'suspended', updated_at = now()
        WHERE id = NEW.tenant_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_tenant_subscription
    AFTER INSERT OR UPDATE OF status ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION sync_tenant_subscription_status();

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE plan_limits IS 'Define os limites e preços de cada plano SaaS';
COMMENT ON TABLE stripe_customers IS 'Vincula tenants aos customers do Stripe';
COMMENT ON TABLE subscriptions IS 'Assinaturas ativas dos tenants';
COMMENT ON TABLE subscription_payments IS 'Histórico de pagamentos de assinaturas';
COMMENT ON TABLE billing_coupons IS 'Cupons de desconto para assinaturas';
COMMENT ON TABLE tenant_usage IS 'Rastreamento de uso de recursos por tenant';
COMMENT ON TABLE stripe_webhook_events IS 'Log de eventos recebidos do Stripe';
