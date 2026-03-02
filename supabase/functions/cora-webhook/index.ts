import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Cora Webhook Endpoint
 *
 * Public endpoint (JWT verification disabled) that receives payment events from Cora Bank.
 *
 * Supported events:
 *   - charge.paid      → boleto pago pelo cliente
 *   - pix.received     → PIX recebido pelo escritório
 *   - charge.overdue   → boleto vencido
 *   - charge.canceled  → cobrança cancelada
 *
 * Configure no painel Cora:
 *   URL: https://xdtlhzysrpoinqtsglmr.supabase.co/functions/v1/cora-webhook
 *
 * SECURITY: Em produção, validar assinatura HMAC do header x-cora-signature.
 */

const CORA_WEBHOOK_SECRET = Deno.env.get('CORA_WEBHOOK_SECRET') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.text()

    // Validate HMAC signature if secret is configured
    if (CORA_WEBHOOK_SECRET) {
      const signature = req.headers.get('x-cora-signature') || ''
      const isValid = await validateHmac(body, signature, CORA_WEBHOOK_SECRET)
      if (!isValid) {
        console.warn('Invalid webhook signature')
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const webhookData = JSON.parse(body)
    console.log('Cora webhook received:', webhookData.event, webhookData.id)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const result = await processWebhookEvent(supabase, webhookData)

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Cora webhook error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Validate HMAC-SHA256 signature from Cora
 */
async function validateHmac(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(body)

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Remove "sha256=" prefix if present
    const receivedSig = signature.replace(/^sha256=/, '')
    return expectedSignature === receivedSig
  } catch {
    return false
  }
}

/**
 * Process webhook event
 */
async function processWebhookEvent(supabase: any, webhookData: any) {
  const event = webhookData.event

  switch (event) {
    case 'charge.paid':
    case 'pix.received':
      return await handlePaymentReceived(supabase, webhookData)

    case 'charge.overdue':
      return await handleChargeOverdue(supabase, webhookData)

    case 'charge.canceled':
      return await handleChargeCanceled(supabase, webhookData)

    default:
      console.log('Unhandled event type:', event)
      return { message: `Event ${event} acknowledged` }
  }
}

/**
 * Handle received payment (boleto paid or PIX received)
 */
async function handlePaymentReceived(supabase: any, webhookData: any) {
  const chargeId = webhookData.charge?.id || webhookData.pix?.charge_id || webhookData.data?.id

  if (!chargeId) {
    console.log('No charge ID in webhook data')
    return { message: 'No charge ID' }
  }

  // Find invoice by external_charge_id
  const { data: invoice, error: findError } = await supabase
    .from('invoices')
    .select('*')
    .eq('external_charge_id', chargeId)
    .single()

  if (findError || !invoice) {
    console.log('Invoice not found for charge:', chargeId)
    // Still return 200 so Cora doesn't retry
    return { message: 'Invoice not found, ignoring' }
  }

  // Avoid double processing
  if (invoice.status === 'paid') {
    console.log('Invoice already paid:', invoice.id)
    return { message: 'Invoice already paid' }
  }

  const paymentDate = webhookData.charge?.paid_at
    || webhookData.pix?.paid_at
    || webhookData.data?.paid_at
    || new Date().toISOString()

  const paymentMethod = webhookData.event.includes('pix') ? 'pix' : 'boleto'

  // Update invoice status
  await supabase
    .from('invoices')
    .update({
      status: 'paid',
      payment_date: paymentDate,
      payment_method: paymentMethod
    })
    .eq('id', invoice.id)

  // Create accounting entry for the receipt
  try {
    await supabase.functions.invoke('create-accounting-entry', {
      body: {
        type: 'invoice',
        operation: 'payment',
        referenceId: invoice.id,
        amount: invoice.amount,
        date: paymentDate,
        clientId: invoice.client_id
      }
    })
  } catch (accErr) {
    console.error('Accounting entry error (non-fatal):', accErr)
  }

  // Send notification
  try {
    await supabase.functions.invoke('notification-dispatcher', {
      body: {
        event: 'invoice_paid',
        client_id: invoice.client_id,
        invoice_id: invoice.id,
        channels: ['email']
      }
    })
  } catch (notifErr) {
    console.error('Notification error (non-fatal):', notifErr)
  }

  console.log('Invoice paid:', invoice.id, 'via', paymentMethod)
  return { message: 'Invoice marked as paid', invoice_id: invoice.id, payment_method: paymentMethod }
}

/**
 * Handle overdue charge
 */
async function handleChargeOverdue(supabase: any, webhookData: any) {
  const chargeId = webhookData.charge?.id || webhookData.data?.id

  if (!chargeId) return { message: 'No charge ID' }

  await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('external_charge_id', chargeId)
    .eq('status', 'pending')

  return { message: 'Invoice marked as overdue' }
}

/**
 * Handle canceled charge
 */
async function handleChargeCanceled(supabase: any, webhookData: any) {
  const chargeId = webhookData.charge?.id || webhookData.data?.id

  if (!chargeId) return { message: 'No charge ID' }

  // Clear Cora fields so a new charge can be generated
  await supabase
    .from('invoices')
    .update({
      external_charge_id: null,
      boleto_url: null,
      boleto_barcode: null,
      boleto_digitable_line: null,
      pix_qrcode: null,
      pix_copy_paste: null,
      pix_txid: null,
      payment_link: null
    })
    .eq('external_charge_id', chargeId)

  return { message: 'Invoice charge cleared' }
}
