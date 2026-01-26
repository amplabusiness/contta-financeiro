import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user and tenant
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id, tenants(id, name, email)')
      .eq('user_id', user.id)
      .single();

    if (!tenantUser) {
      throw new Error('Tenant not found');
    }

    const tenant = tenantUser.tenants as any;
    const tenantId = tenant.id;

    const { plan, billing_cycle, coupon_code, success_url, cancel_url } = await req.json();

    // Get plan details
    const { data: planData, error: planError } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('plan', plan)
      .single();

    if (planError || !planData) {
      throw new Error('Plan not found');
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;

    const { data: existingCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .single();

    if (existingCustomer) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email || tenant.email,
        name: tenant.name,
        metadata: {
          tenant_id: tenantId,
          user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      // Save to database
      await supabase.from('stripe_customers').insert({
        tenant_id: tenantId,
        stripe_customer_id: customer.id,
        email: user.email || tenant.email,
        name: tenant.name,
      });
    }

    // Get price ID based on billing cycle
    const priceId = billing_cycle === 'yearly'
      ? planData.stripe_price_id_yearly
      : planData.stripe_price_id_monthly;

    // If no Stripe price ID, create price on the fly
    let stripePriceId = priceId;
    if (!stripePriceId) {
      const amount = billing_cycle === 'yearly'
        ? planData.price_yearly_cents
        : planData.price_monthly_cents;

      const price = await stripe.prices.create({
        unit_amount: amount,
        currency: 'brl',
        recurring: {
          interval: billing_cycle === 'yearly' ? 'year' : 'month',
        },
        product_data: {
          name: `CONTTA ${planData.display_name}`,
          metadata: { plan: plan },
        },
      });

      stripePriceId = price.id;

      // Update plan with price ID
      const updateField = billing_cycle === 'yearly'
        ? 'stripe_price_id_yearly'
        : 'stripe_price_id_monthly';

      await supabase
        .from('plan_limits')
        .update({ [updateField]: stripePriceId })
        .eq('plan', plan);
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: success_url || `${req.headers.get('origin')}/billing?success=true`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          plan: plan,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      payment_method_types: ['card', 'boleto'],
      locale: 'pt-BR',
    };

    // Apply coupon if provided
    if (coupon_code) {
      const { data: couponData } = await supabase
        .rpc('validate_coupon', { p_code: coupon_code, p_plan: plan });

      if (couponData?.valid) {
        // Try to find or create Stripe coupon
        try {
          const coupons = await stripe.coupons.list({ limit: 100 });
          let stripeCoupon = coupons.data.find(c => c.name === coupon_code);

          if (!stripeCoupon) {
            const couponParams: Stripe.CouponCreateParams = {
              name: coupon_code,
              duration: 'once',
            };

            if (couponData.discount_type === 'percent') {
              couponParams.percent_off = couponData.discount_value;
            } else {
              couponParams.amount_off = couponData.discount_value;
              couponParams.currency = 'brl';
            }

            stripeCoupon = await stripe.coupons.create(couponParams);
          }

          sessionParams.discounts = [{ coupon: stripeCoupon.id }];
        } catch (couponError) {
          console.error('Error applying coupon:', couponError);
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
