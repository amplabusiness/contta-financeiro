import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Log event for debugging
    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object,
    });

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await supabase
      .from('stripe_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);

    // Log error
    await supabase.from('stripe_webhook_events').update({
      error_message: error.message,
    }).eq('stripe_event_id', (error as any).eventId);

    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
});

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenant_id;
  const plan = session.metadata?.plan;

  if (!tenantId || !plan) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // Subscription will be created via subscription.created event
  console.log(`Checkout completed for tenant ${tenantId}, plan ${plan}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  const plan = subscription.metadata?.plan;

  if (!tenantId) {
    // Try to find tenant by customer
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('tenant_id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();

    if (!customer) {
      console.error('Could not find tenant for subscription');
      return;
    }
  }

  const finalTenantId = tenantId || (await getTenantByCustomer(subscription.customer as string));

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    trialing: 'trialing',
    paused: 'paused',
    unpaid: 'past_due',
  };

  // Get price to determine plan and billing cycle
  const priceId = subscription.items.data[0]?.price.id;
  let determinedPlan = plan;
  let billingCycle: 'monthly' | 'yearly' = 'monthly';

  if (priceId) {
    const { data: planData } = await supabase
      .from('plan_limits')
      .select('plan')
      .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
      .single();

    if (planData) {
      determinedPlan = planData.plan;
    }

    // Check if yearly based on interval
    const price = subscription.items.data[0]?.price;
    if (price?.recurring?.interval === 'year') {
      billingCycle = 'yearly';
    }
  }

  // Upsert subscription
  await supabase.from('subscriptions').upsert({
    tenant_id: finalTenantId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    plan: determinedPlan || 'starter',
    billing_cycle: billingCycle,
    status: statusMap[subscription.status] || subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    amount_cents: subscription.items.data[0]?.price.unit_amount || 0,
    currency: subscription.currency.toUpperCase(),
  }, {
    onConflict: 'stripe_subscription_id',
  });

  // Update tenant plan and status
  await supabase.from('tenants').update({
    plan: determinedPlan || 'starter',
    status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'suspended',
    updated_at: new Date().toISOString(),
  }).eq('id', finalTenantId);

  console.log(`Updated subscription for tenant ${finalTenantId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Update subscription status
  await supabase.from('subscriptions').update({
    status: 'canceled',
    canceled_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', subscription.id);

  // Update tenant
  const tenantId = await getTenantByCustomer(subscription.customer as string);
  if (tenantId) {
    await supabase.from('tenants').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', tenantId);
  }

  console.log(`Subscription ${subscription.id} deleted`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const tenantId = await getTenantByCustomer(customerId);

  if (!tenantId) {
    console.error('Could not find tenant for invoice');
    return;
  }

  // Get subscription ID
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', invoice.subscription as string)
    .single();

  // Record payment
  await supabase.from('subscription_payments').insert({
    tenant_id: tenantId,
    subscription_id: sub?.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    stripe_invoice_id: invoice.id,
    amount_cents: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    status: 'succeeded',
    payment_method: invoice.collection_method,
    paid_at: new Date().toISOString(),
    invoice_url: invoice.hosted_invoice_url,
    receipt_url: invoice.invoice_pdf,
  });

  console.log(`Invoice ${invoice.id} paid for tenant ${tenantId}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const tenantId = await getTenantByCustomer(customerId);

  if (!tenantId) {
    console.error('Could not find tenant for invoice');
    return;
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', invoice.subscription as string)
    .single();

  // Record failed payment
  await supabase.from('subscription_payments').insert({
    tenant_id: tenantId,
    subscription_id: sub?.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    stripe_invoice_id: invoice.id,
    amount_cents: invoice.amount_due,
    currency: invoice.currency.toUpperCase(),
    status: 'failed',
    payment_method: invoice.collection_method,
    failure_message: 'Payment failed',
    invoice_url: invoice.hosted_invoice_url,
  });

  // Update tenant status
  await supabase.from('tenants').update({
    status: 'suspended',
    updated_at: new Date().toISOString(),
  }).eq('id', tenantId);

  console.log(`Invoice ${invoice.id} failed for tenant ${tenantId}`);
}

async function getTenantByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('stripe_customers')
    .select('tenant_id')
    .eq('stripe_customer_id', customerId)
    .single();

  return data?.tenant_id || null;
}
