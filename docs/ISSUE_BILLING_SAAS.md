## 🚀 Feature: Sistema de Billing SaaS + Landing Page + Trial de 14 dias

### Descrição

Implementação completa do sistema de monetização do CONTTA, incluindo:
- Landing page de vendas
- Sistema de planos e preços
- Integração com Stripe para pagamentos
- Trial gratuito de 14 dias
- Gestão de assinaturas

---

### 📋 Funcionalidades Implementadas

#### 1. Landing Page (`/`)
- Hero section com CTA
- Seção de features do sistema
- Seção do Dr. Cícero (IA)
- Tabela de preços com 3 planos
- Depoimentos de clientes
- Footer com links legais

#### 2. Página de Preços (`/pricing`)
- Toggle mensal/anual (17% desconto no anual)
- Validação de cupons de desconto
- Integração com Stripe Checkout
- Comparativo de features por plano

#### 3. Dashboard de Faturamento (`/billing`)
- Visualização do plano atual
- Métricas de uso (clientes, faturas, contas, usuários)
- Histórico de pagamentos
- Botão para gerenciar assinatura (Stripe Portal)
- Sugestões de upgrade

#### 4. Sistema de Trial
- 14 dias gratuitos ao cadastrar
- Banner de countdown no topo do sistema
- Página de trial expirado com CTA
- Bloqueio de acesso após expiração

#### 5. Páginas Legais
- Termos de Serviço (`/terms`)
- Política de Privacidade (`/privacy`) - LGPD compliant

---

### 🗄️ Estrutura de Dados (Migrations)

#### `20260127000000_billing_system.sql`
```sql
-- Tabelas criadas:
- plan_limits          -- Limites e preços de cada plano
- stripe_customers     -- Vínculo tenant <-> Stripe
- subscriptions        -- Assinaturas ativas
- subscription_payments -- Histórico de pagamentos
- billing_coupons      -- Cupons de desconto
- tenant_usage         -- Métricas de uso por tenant
- stripe_webhook_events -- Log de webhooks

-- Funções criadas:
- check_tenant_limits()      -- Verifica limites do plano
- calculate_tenant_usage()   -- Calcula uso atual
- get_tenant_subscription()  -- Retorna subscription ativa
- validate_coupon()          -- Valida cupom de desconto
```

#### `20260127100000_trial_system.sql`
```sql
-- Funções criadas:
- create_trial_subscription()  -- Trigger: cria trial ao cadastrar
- check_subscription_status()  -- Verifica status da assinatura
- expire_trials()              -- Expira trials vencidos (cron)

-- View criada:
- v_tenant_subscription_status -- Status de todos os tenants
```

---

### 📁 Arquivos Criados/Modificados

#### Novos Arquivos
```
src/
├── lib/
│   └── stripe.ts                    # Cliente Stripe + tipos
├── services/
│   └── BillingService.ts            # Serviço de billing
├── components/
│   ├── SubscriptionGuard.tsx        # Guard de acesso
│   └── TrialBanner.tsx              # Banner de trial
├── pages/
│   ├── Landing.tsx                  # Landing page
│   ├── Pricing.tsx                  # Página de preços
│   ├── Billing.tsx                  # Dashboard de faturamento
│   ├── Terms.tsx                    # Termos de Serviço
│   ├── Privacy.tsx                  # Política de Privacidade
│   └── TrialExpired.tsx             # Página trial expirado

supabase/
├── functions/
│   ├── create-checkout-session/     # Cria sessão Stripe
│   ├── create-portal-session/       # Portal do cliente
│   └── stripe-webhook/              # Webhook do Stripe
├── migrations/
│   ├── 20260127000000_billing_system.sql
│   └── 20260127100000_trial_system.sql
```

#### Arquivos Modificados
```
src/App.tsx                    # Novas rotas
src/components/Layout.tsx      # TrialBanner
src/components/AppSidebar.tsx  # Link "Faturamento"
src/pages/Auth.tsx             # Suporte a ?mode=signup
.env.example                   # Variáveis do Stripe
```

---

### 💰 Planos Configurados

| Plano | Mensal | Anual | Clientes | Faturas/mês | Usuários |
|-------|--------|-------|----------|-------------|----------|
| **Starter** | R$ 99 | R$ 990 | 50 | 500 | 2 |
| **Professional** | R$ 199 | R$ 1.990 | 200 | 2.000 | 5 |
| **Enterprise** | R$ 499 | R$ 4.990 | ∞ | ∞ | ∞ |

---

### ⚙️ Configuração Necessária

#### Variáveis de Ambiente
```bash
# Frontend (.env)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Supabase Edge Function Secrets
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Webhook Stripe
Configurar endpoint no Stripe Dashboard:
```
URL: https://[PROJECT].supabase.co/functions/v1/stripe-webhook
Eventos: checkout.session.completed, customer.subscription.*, invoice.*
```

#### Cron Job (Supabase)
Executar diariamente para expirar trials:
```sql
SELECT expire_trials();
```

---

### 🔄 Fluxo do Usuário

```
1. Visitante acessa / (Landing Page)
   ↓
2. Clica "Começar Grátis" → /auth?mode=signup
   ↓
3. Cadastra → Trigger cria trial de 14 dias
   ↓
4. Completa onboarding → /dashboard
   ↓
5. Banner mostra "Restam X dias de trial"
   ↓
6. Trial expira → Redirecionado para /trial-expired
   ↓
7. Escolhe plano → Stripe Checkout
   ↓
8. Paga → Webhook atualiza subscription
   ↓
9. Acesso liberado com plano ativo
```

---

### ✅ Checklist de Deploy

- [ ] Configurar variáveis de ambiente no Vercel
- [ ] Configurar secrets no Supabase
- [ ] Rodar migrations em produção
- [ ] Configurar webhook no Stripe
- [ ] Configurar cron job para `expire_trials()`
- [ ] Dar plano Enterprise ao tenant Ampla
- [ ] Testar fluxo completo de cadastro → trial → pagamento

---

### 📝 Notas

- O sistema usa **fail-open**: se houver erro na verificação de subscription, o acesso é permitido (para não bloquear usuários por falhas técnicas)
- Tenant Ampla (proprietário) deve receber plano Enterprise vitalício manualmente após deploy
- Todos os dados existentes são preservados - migrations são 100% aditivas

---

### 🔧 SQL para dar Enterprise ao Ampla

Executar após deploy das migrations:

```sql
-- Dar Enterprise vitalício ao Ampla
INSERT INTO subscriptions (tenant_id, plan, billing_cycle, status, current_period_start, current_period_end, amount_cents, currency, metadata)
SELECT id, 'enterprise', 'yearly', 'active', NOW(), '2099-12-31'::TIMESTAMPTZ, 0, 'BRL',
       '{"type": "founder", "reason": "Sistema proprietário", "is_lifetime": true}'::JSONB
FROM tenants WHERE cnpj LIKE '%23893032%' OR UPPER(name) LIKE '%AMPLA%';

UPDATE tenants SET plan = 'enterprise', status = 'active', trial_ends_at = NULL
WHERE cnpj LIKE '%23893032%' OR UPPER(name) LIKE '%AMPLA%';
```
