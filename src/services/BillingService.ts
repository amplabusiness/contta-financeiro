import { supabase } from '@/integrations/supabase/client';
import { getStripe, formatPrice, PlanLimit, Subscription, SubscriptionPayment, TenantUsage, UsageLimitCheck } from '@/lib/stripe';

class BillingService {
  // ==========================================
  // PLANOS
  // ==========================================

  async getPlans(): Promise<PlanLimit[]> {
    const { data, error } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data || [];
  }

  async getPlan(planId: string): Promise<PlanLimit | null> {
    const { data, error } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('plan', planId)
      .single();

    if (error) return null;
    return data;
  }

  // ==========================================
  // SUBSCRIPTION
  // ==========================================

  async getCurrentSubscription(tenantId?: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .rpc('get_tenant_subscription', { p_tenant_id: tenantId || null });

    if (error || !data || data.length === 0) return null;
    return data[0] as unknown as Subscription;
  }

  async getSubscriptionWithPlan(tenantId?: string): Promise<{
    subscription: Subscription | null;
    plan: PlanLimit | null;
    usage: TenantUsage | null;
  }> {
    const subscription = await this.getCurrentSubscription(tenantId);

    let plan: PlanLimit | null = null;
    if (subscription) {
      plan = await this.getPlan(subscription.plan);
    }

    const usage = await this.getCurrentUsage(tenantId);

    return { subscription, plan, usage };
  }

  // ==========================================
  // CHECKOUT & PAGAMENTO
  // ==========================================

  async createCheckoutSession(
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    couponCode?: string
  ): Promise<{ sessionId: string; url: string }> {
    // Chamar Edge Function para criar sessão de checkout
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        plan: planId,
        billing_cycle: billingCycle,
        coupon_code: couponCode,
        success_url: `${window.location.origin}/billing?success=true`,
        cancel_url: `${window.location.origin}/pricing?canceled=true`,
      },
    });

    if (error) throw error;
    return data;
  }

  async redirectToCheckout(
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    couponCode?: string
  ): Promise<void> {
    const { url } = await this.createCheckoutSession(planId, billingCycle, couponCode);
    window.location.href = url;
  }

  async createCustomerPortalSession(): Promise<{ url: string }> {
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: {
        return_url: `${window.location.origin}/billing`,
      },
    });

    if (error) throw error;
    return data;
  }

  async redirectToCustomerPortal(): Promise<void> {
    const { url } = await this.createCustomerPortalSession();
    window.location.href = url;
  }

  // ==========================================
  // PAGAMENTOS
  // ==========================================

  async getPaymentHistory(limit: number = 10): Promise<SubscriptionPayment[]> {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getPayment(paymentId: string): Promise<SubscriptionPayment | null> {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) return null;
    return data;
  }

  // ==========================================
  // USO & LIMITES
  // ==========================================

  async getCurrentUsage(tenantId?: string): Promise<TenantUsage | null> {
    const { data, error } = await supabase
      .rpc('calculate_tenant_usage', { p_tenant_id: tenantId || null });

    if (error) return null;
    return data as unknown as TenantUsage;
  }

  async checkLimit(resource: 'clients' | 'invoices' | 'bank_accounts' | 'users'): Promise<UsageLimitCheck> {
    const { data, error } = await supabase
      .rpc('check_tenant_limits', {
        p_tenant_id: null, // Usa tenant do usuário atual
        p_resource: resource
      });

    if (error) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        plan: 'unknown',
        error: error.message,
      };
    }

    return data as UsageLimitCheck;
  }

  async canAddResource(resource: 'clients' | 'invoices' | 'bank_accounts' | 'users'): Promise<boolean> {
    const check = await this.checkLimit(resource);
    return check.allowed;
  }

  // ==========================================
  // CUPONS
  // ==========================================

  async validateCoupon(code: string, planId?: string): Promise<{
    valid: boolean;
    discount_type?: 'percent' | 'fixed';
    discount_value?: number;
    description?: string;
    error?: string;
  }> {
    const { data, error } = await supabase
      .rpc('validate_coupon', {
        p_code: code,
        p_plan: planId || null
      });

    if (error) {
      return { valid: false, error: error.message };
    }

    return data;
  }

  // ==========================================
  // CANCELAMENTO
  // ==========================================

  async cancelSubscription(immediately: boolean = false): Promise<void> {
    const { error } = await supabase.functions.invoke('cancel-subscription', {
      body: { immediately },
    });

    if (error) throw error;
  }

  async reactivateSubscription(): Promise<void> {
    const { error } = await supabase.functions.invoke('reactivate-subscription', {
      body: {},
    });

    if (error) throw error;
  }

  // ==========================================
  // UPGRADE/DOWNGRADE
  // ==========================================

  async changePlan(newPlan: string, billingCycle?: 'monthly' | 'yearly'): Promise<void> {
    const { error } = await supabase.functions.invoke('change-subscription', {
      body: {
        new_plan: newPlan,
        billing_cycle: billingCycle,
      },
    });

    if (error) throw error;
  }

  // ==========================================
  // HELPERS
  // ==========================================

  formatPrice(cents: number, currency: string = 'BRL'): string {
    return formatPrice(cents, currency);
  }

  calculateYearlySavings(monthlyPriceCents: number, yearlyPriceCents: number): {
    savings: number;
    savingsPercent: number;
  } {
    const yearlyIfMonthly = monthlyPriceCents * 12;
    const savings = yearlyIfMonthly - yearlyPriceCents;
    const savingsPercent = Math.round((savings / yearlyIfMonthly) * 100);
    return { savings, savingsPercent };
  }

  getTrialDaysRemaining(trialEnd: string | null | undefined): number {
    if (!trialEnd) return 0;
    const end = new Date(trialEnd);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  isTrialExpired(trialEnd: string | null | undefined): boolean {
    if (!trialEnd) return false;
    return new Date(trialEnd) < new Date();
  }

  getPlanBadgeColor(plan: string): string {
    switch (plan) {
      case 'starter':
        return 'bg-blue-100 text-blue-800';
      case 'professional':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'canceled':
      case 'incomplete':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  translateStatus(status: string): string {
    const translations: Record<string, string> = {
      active: 'Ativa',
      trialing: 'Em Trial',
      past_due: 'Pagamento Pendente',
      canceled: 'Cancelada',
      incomplete: 'Incompleta',
      paused: 'Pausada',
    };
    return translations[status] || status;
  }

  translatePaymentStatus(status: string): string {
    const translations: Record<string, string> = {
      pending: 'Pendente',
      processing: 'Processando',
      succeeded: 'Pago',
      failed: 'Falhou',
      refunded: 'Reembolsado',
      partially_refunded: 'Parcialmente Reembolsado',
    };
    return translations[status] || status;
  }
}

export const billingService = new BillingService();
export default billingService;
