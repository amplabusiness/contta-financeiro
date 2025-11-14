import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const CORA_API_BASE = Deno.env.get('CORA_API_URL') || 'https://api.cora.com.br'
const CORA_CLIENT_ID = Deno.env.get('CORA_CLIENT_ID')!
const CORA_CLIENT_SECRET = Deno.env.get('CORA_CLIENT_SECRET')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, data } = await req.json()

    let result

    switch (action) {
      case 'create_charge':
        result = await createCharge(data)
        break
      case 'get_balance':
        result = await getBalance()
        break
      case 'get_statement':
        result = await getStatement(data.start_date, data.end_date)
        break
      case 'webhook':
        result = await handleWebhook(data)
        break
      case 'create_pix':
        result = await createPixCharge(data)
        break
      default:
        throw new Error('Invalid action')
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Cora API error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Get OAuth2 access token
 */
async function getAccessToken(): Promise<string> {
  const response = await fetch(`${CORA_API_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CORA_CLIENT_ID,
      client_secret: CORA_CLIENT_SECRET
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`)
  }

  const { access_token } = await response.json()
  return access_token
}

/**
 * Create charge (boleto + PIX)
 */
async function createCharge(invoiceData: any) {
  const token = await getAccessToken()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get full invoice data
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*)')
    .eq('id', invoiceData.invoice_id)
    .single()

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  // Create charge in Cora
  const response = await fetch(`${CORA_API_BASE}/charges`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(invoice.amount * 100), // em centavos
      due_date: invoice.due_date,
      payer: {
        name: invoice.clients.name,
        document: invoice.clients.cnpj?.replace(/\D/g, ''),
        email: invoice.clients.email,
        phone: invoice.clients.phone?.replace(/\D/g, '')
      },
      payment_methods: ['boleto', 'pix'],
      description: `Honorários ${invoice.competence}`,
      metadata: {
        invoice_id: invoice.id,
        client_id: invoice.client_id
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create charge: ${error}`)
  }

  const charge = await response.json()

  // Update invoice with charge data
  await supabase
    .from('invoices')
    .update({
      boleto_url: charge.boleto?.url,
      boleto_barcode: charge.boleto?.barcode,
      boleto_digitable_line: charge.boleto?.digitable_line,
      pix_qrcode: charge.pix?.qrcode_base64,
      pix_copy_paste: charge.pix?.emv,
      pix_txid: charge.pix?.txid,
      external_charge_id: charge.id,
      payment_link: charge.payment_link
    })
    .eq('id', invoice.id)

  return {
    charge_id: charge.id,
    boleto_url: charge.boleto?.url,
    pix_qrcode: charge.pix?.qrcode_base64,
    pix_copy_paste: charge.pix?.emv,
    payment_link: charge.payment_link
  }
}

/**
 * Create PIX charge only
 */
async function createPixCharge(invoiceData: any) {
  const token = await getAccessToken()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*)')
    .eq('id', invoiceData.invoice_id)
    .single()

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  const response = await fetch(`${CORA_API_BASE}/pix/charges`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(invoice.amount * 100),
      expiration_date: invoice.due_date,
      payer_name: invoice.clients.name,
      payer_document: invoice.clients.cnpj?.replace(/\D/g, ''),
      description: `Honorários ${invoice.competence}`
    })
  })

  if (!response.ok) {
    throw new Error('Failed to create PIX charge')
  }

  const pix = await response.json()

  await supabase
    .from('invoices')
    .update({
      pix_qrcode: pix.qrcode_base64,
      pix_copy_paste: pix.emv,
      pix_txid: pix.txid,
      external_charge_id: pix.id
    })
    .eq('id', invoice.id)

  return pix
}

/**
 * Get account balance
 */
async function getBalance() {
  const token = await getAccessToken()

  const response = await fetch(`${CORA_API_BASE}/balance`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })

  if (!response.ok) {
    throw new Error('Failed to get balance')
  }

  return await response.json()
}

/**
 * Get bank statement
 */
async function getStatement(startDate: string, endDate: string) {
  const token = await getAccessToken()

  const response = await fetch(
    `${CORA_API_BASE}/statements?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  if (!response.ok) {
    throw new Error('Failed to get statement')
  }

  const transactions = await response.json()

  // Import to database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  await supabase
    .from('bank_transactions')
    .upsert(transactions.map((t: any) => ({
      bank_reference: t.id,
      amount: Math.abs(t.amount / 100),
      description: t.description,
      transaction_type: t.type === 'CREDIT' ? 'credit' : 'debit',
      transaction_date: t.created_at.split('T')[0],
      imported_from: 'cora',
      matched: false,
      metadata: t
    })), {
      onConflict: 'bank_reference',
      ignoreDuplicates: true
    })

  return { imported: transactions.length }
}

/**
 * Handle webhook from Cora
 */
async function handleWebhook(webhookData: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (webhookData.event === 'charge.paid' || webhookData.event === 'pix.received') {
    const chargeId = webhookData.charge?.id || webhookData.pix?.charge_id

    // Find invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('external_charge_id', chargeId)
      .single()

    if (!invoice) {
      console.log('Invoice not found for charge:', chargeId)
      return { message: 'Invoice not found' }
    }

    // Update invoice
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        payment_date: webhookData.charge?.paid_at || new Date().toISOString(),
        payment_method: webhookData.event.includes('pix') ? 'pix' : 'boleto'
      })
      .eq('id', invoice.id)

    // Create accounting entry
    await supabase.functions.invoke('create-accounting-entry', {
      body: {
        type: 'invoice',
        operation: 'payment',
        referenceId: invoice.id,
        amount: invoice.amount,
        date: webhookData.charge?.paid_at || new Date().toISOString(),
        clientId: invoice.client_id
      }
    })

    // Send notification
    await supabase.functions.invoke('notification-dispatcher', {
      body: {
        event: 'invoice_paid',
        client_id: invoice.client_id,
        invoice_id: invoice.id,
        channels: ['email', 'whatsapp']
      }
    })

    return { message: 'Invoice updated successfully', invoice_id: invoice.id }
  }

  return { message: 'Event processed' }
}
