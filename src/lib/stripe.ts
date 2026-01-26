import { loadStripe, Stripe } from '@stripe/stripe-js';

// Chave pública do Stripe (segura para expor no frontend)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise || Promise.resolve(null);
};

// Formatar preço de centavos para display
export const formatPrice = (cents: number, currency: string = 'BRL'): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
};

// Calcular desconto
export const calculateDiscount = (
  originalCents: number,
  discountType: 'percent' | 'fixed',
  discountValue: number
): number => {
  if (discountType === 'percent') {
    return Math.round(originalCents * (discountValue / 100));
  }
  return discountValue;
};

// Tipos para o sistema de billing
export interface PlanLimit {
  plan: string;
  display_name: string;
  description: string;
  max_clients: number;
  max_invoices_per_month: number;
  max_bank_accounts: number;
  max_users: number;
  max_storage_mb: number;
  features: Record<string, boolean>;
  price_monthly_cents: number;
  price_yearly_cents: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  stripe_subscription_id?: string;
  plan: string;
  billing_cycle: 'monthly' | 'yearly';
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | 'paused';
  current_period_start?: string;
  current_period_end?: string;
  trial_start?: string;
  trial_end?: string;
  canceled_at?: string;
  cancel_at_period_end: boolean;
  amount_cents: number;
  currency: string;
  discount_percent?: number;
  discount_ends_at?: string;
  coupon_code?: string;
}

export interface SubscriptionPayment {
  id: string;
  tenant_id: string;
  subscription_id?: string;
  stripe_payment_intent_id?: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
  payment_method?: string;
  paid_at?: string;
  invoice_url?: string;
  receipt_url?: string;
  failure_message?: string;
}

export interface TenantUsage {
  clients_count: number;
  invoices_count: number;
  bank_accounts_count: number;
  users_count: number;
  storage_used_mb: number;
}

export interface UsageLimitCheck {
  allowed: boolean;
  current: number;
  max: number | 'unlimited';
  remaining?: number;
  plan: string;
  upgrade_needed?: boolean;
  error?: string;
}
