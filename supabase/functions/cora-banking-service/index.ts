import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Cora Bank Service — Integração Direta com mTLS
 *
 * Fluxo de autenticação (2 etapas):
 *   1) Token: POST para CORA_TOKEN_URL com mTLS (certificado + chave privada)
 *   2) API:   Bearer token no header Authorization em CORA_API_BASE/v2/...
 *
 * URLs por ambiente:
 *   Stage  token: https://matls-clients.api.stage.cora.com.br/token
 *   Stage  API:   https://api.stage.cora.com.br
 *   Prod   token: https://matls-clients.api.cora.com.br/token
 *   Prod   API:   https://api.cora.com.br
 *
 * Secrets necessários no Supabase (Dashboard → Edge Functions → Secrets):
 *   CORA_CLIENT_ID        → client-id obtido no app Cora (ex: int-xxx)
 *   CORA_CERT_PEM_B64     → certificate.pem em base64 (uma linha)
 *   CORA_PRIVATE_KEY_B64  → private-key.key em base64 (uma linha)
 *   CORA_TOKEN_URL        → (opcional) padrão: https://matls-clients.api.cora.com.br/token
 *   CORA_API_URL          → (opcional) padrão: https://api.cora.com.br
 *
 * Como gerar base64 do certificado (Linux/Mac/WSL):
 *   base64 -w 0 certificate.pem
 *   base64 -w 0 private-key.key
 */

const CORA_CLIENT_ID  = Deno.env.get('CORA_CLIENT_ID') || ''
const CORA_CERT_B64   = Deno.env.get('CORA_CERT_PEM_B64') || ''
const CORA_KEY_B64    = Deno.env.get('CORA_PRIVATE_KEY_B64') || ''
// Token endpoint usa mTLS; API endpoint usa Bearer token
const CORA_TOKEN_URL  = Deno.env.get('CORA_TOKEN_URL') || 'https://matls-clients.api.cora.com.br/token'
const CORA_API_BASE   = Deno.env.get('CORA_API_URL') || 'https://api.cora.com.br'

// Simple in-memory token cache (válido enquanto a função estiver warm)
let _cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Decode base64 string to PEM text
 */
function decodePem(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Create Deno HTTP client with mTLS certificate for Cora
 */
function createMtlsClient() {
  if (!CORA_CERT_B64 || !CORA_KEY_B64) {
    throw new Error(
      'Certificado Cora não configurado. ' +
      'Configure CORA_CERT_PEM_B64 e CORA_PRIVATE_KEY_B64 nos Supabase Secrets.'
    )
  }
  return Deno.createHttpClient({
    certChain: decodePem(CORA_CERT_B64),
    privateKey: decodePem(CORA_KEY_B64),
  })
}

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
      case 'send_payment':
        result = await sendPayment(data)
        break
      case 'list_payments':
        result = await listPayments(data)
        break
      case 'test_connection':
        result = await testConnection()
        break
      case 'list_charges':
        result = await listCharges(data)
        break
      case 'get_charge':
        result = await getCharge(data.charge_id)
        break
      case 'cancel_charge':
        result = await cancelCharge(data.charge_id)
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
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Get OAuth2 access token via mTLS client_credentials
 * Token tem validade de 24h — mantido em cache enquanto a função estiver warm
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now()

  // Retorna token cacheado se ainda válido (com margem de 5 min)
  if (_cachedToken && _cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return _cachedToken.token
  }

  if (!CORA_CLIENT_ID) {
    throw new Error('CORA_CLIENT_ID não configurado nos Supabase Secrets.')
  }

  const client = createMtlsClient()

  // Token via mTLS — usa URL específica do token endpoint
  const response = await fetch(CORA_TOKEN_URL, {
    // @ts-ignore — Deno fetch aceita opção client para mTLS
    client,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CORA_CLIENT_ID
      // SEM client_secret — autenticação é feita pelo certificado mTLS
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Falha ao obter token Cora (${response.status}): ${errText}`)
  }

  const { access_token, expires_in } = await response.json()

  // Cache: expires_in em segundos (geralmente 86400 = 24h)
  _cachedToken = {
    token: access_token,
    expiresAt: now + (expires_in * 1000)
  }

  return access_token
}

/**
 * Authenticated API call to Cora — Bearer token apenas (sem mTLS)
 * mTLS só é necessário para obter o token, não para as chamadas de API
 */
async function coraFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()

  return fetch(`${CORA_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept': 'application/json',
      ...options.headers,
    },
  })
}

/**
 * Test connection — verifica se credenciais estão funcionando
 */
async function testConnection() {
  const token = await getAccessToken()
  return {
    connected: true,
    api_base: CORA_API_BASE,
    client_id: CORA_CLIENT_ID,
    token_preview: token.substring(0, 30) + '...'
  }
}

/**
 * Create charge (boleto + PIX) for an invoice
 */
async function createCharge(invoiceData: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*)')
    .eq('id', invoiceData.invoice_id)
    .single()

  if (!invoice) throw new Error('Invoice not found')

  const document = invoice.clients.cnpj?.replace(/\D/g, '') || ''
  const docType = document.length === 14 ? 'CNPJ' : 'CPF'

  // Formato correto da API Cora V2 — POST /v2/invoices/
  const response = await coraFetch('/v2/invoices/', {
    method: 'POST',
    headers: {
      'Idempotency-Key': invoice.id  // UUID do invoice como chave de idempotência
    },
    body: JSON.stringify({
      code: invoice.id,  // referência interna (nosso ID)
      customer: {
        name: invoice.clients.name,
        email: invoice.clients.email || undefined,
        document: {
          identity: document,
          type: docType
        }
      },
      services: [
        {
          name: `Honorários ${invoice.competence || ''}`,
          description: `Honorários contábeis - ${invoice.competence || 'Mensal'}`,
          amount: Math.round(invoice.amount * 100)  // em centavos
        }
      ],
      payment_terms: {
        due_date: invoice.due_date  // formato YYYY-MM-DD
      },
      payment_forms: ['BANK_SLIP', 'PIX'],  // boleto + QR Code PIX
      notification: invoice.clients.email ? {
        name: invoice.clients.name,
        channels: [
          {
            contact: invoice.clients.email,
            channel: 'EMAIL',
            rules: ['NOTIFY_THREE_DAYS_BEFORE_DUE_DATE', 'NOTIFY_ON_DUE_DATE', 'NOTIFY_WHEN_PAID']
          }
        ]
      } : undefined
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Falha ao criar cobrança Cora: ${error}`)
  }

  const charge = await response.json()

  // Mapeamento da resposta V2 da Cora
  await supabase
    .from('invoices')
    .update({
      boleto_url:            charge.payment_options?.bank_slip?.url,
      boleto_barcode:        charge.payment_options?.bank_slip?.barcode,
      boleto_digitable_line: charge.payment_options?.bank_slip?.digitable,
      pix_copy_paste:        charge.pix?.emv,
      external_charge_id:    charge.id,
    })
    .eq('id', invoice.id)

  return {
    charge_id:       charge.id,
    status:          charge.status,
    boleto_url:      charge.payment_options?.bank_slip?.url,
    boleto_barcode:  charge.payment_options?.bank_slip?.barcode,
    boleto_digitable: charge.payment_options?.bank_slip?.digitable,
    pix_copy_paste:  charge.pix?.emv,
  }
}

/**
 * Create PIX charge only
 */
async function createPixCharge(invoiceData: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*)')
    .eq('id', invoiceData.invoice_id)
    .single()

  if (!invoice) throw new Error('Invoice not found')

  const response = await coraFetch('/pix/charges', {
    method: 'POST',
    headers: { 'Idempotency-Key': invoice.id + '-pix' },
    body: JSON.stringify({
      amount: Math.round(invoice.amount * 100),
      expiration_date: invoice.due_date,
      payer_name: invoice.clients.name,
      payer_document: invoice.clients.cnpj?.replace(/\D/g, ''),
      description: `Honorários ${invoice.competence}`
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Falha ao criar PIX Cora: ${err}`)
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
  const response = await coraFetch('/balance')

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Falha ao consultar saldo Cora (${response.status}): ${err}`)
  }

  return await response.json()
}

/**
 * Get bank statement and import to bank_transactions
 */
async function getStatement(startDate: string, endDate: string) {
  const response = await coraFetch(
    `/statements?start_date=${startDate}&end_date=${endDate}`
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Falha ao consultar extrato Cora: ${err}`)
  }

  const body = await response.json()
  const txList = Array.isArray(body) ? body : (body.items || body.data || [])

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (txList.length > 0) {
    await supabase
      .from('bank_transactions')
      .upsert(txList.map((t: any) => ({
        bank_reference: t.id,
        amount: t.type === 'CREDIT'
          ? Math.abs(t.amount / 100)
          : -Math.abs(t.amount / 100),
        description: t.description,
        transaction_type: t.type === 'CREDIT' ? 'credit' : 'debit',
        transaction_date: (t.created_at || t.date || '').split('T')[0],
        imported_from: 'cora',
        matched: false,
        metadata: t
      })), {
        onConflict: 'bank_reference',
        ignoreDuplicates: true
      })
  }

  return { imported: txList.length }
}

/**
 * Send outbound PIX payment
 * Usado para pagar MEI/PJ prestadores no dia 10 de cada mês
 */
async function sendPayment(paymentData: {
  amount: number
  pix_key: string
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'evp'
  description: string
  beneficiary_name: string
  scheduled_date?: string
}) {
  const idempotencyKey = [
    'payment',
    paymentData.pix_key.replace(/\D/g, '').substring(0, 11),
    paymentData.scheduled_date || new Date().toISOString().split('T')[0]
  ].join('-')

  const response = await coraFetch('/transfers/pix', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({
      amount: Math.round(paymentData.amount * 100),
      pix_alias: {
        key: paymentData.pix_key,
        key_type: paymentData.pix_key_type.toUpperCase()
      },
      description: paymentData.description,
      ...(paymentData.scheduled_date && { scheduled_at: paymentData.scheduled_date })
    })
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Falha ao enviar PIX para ${paymentData.beneficiary_name}: ${errBody}`)
  }

  const result = await response.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  await supabase.from('bank_transactions').insert({
    bank_reference: result.id || `cora-pix-out-${Date.now()}`,
    amount: -paymentData.amount,
    description: `PIX OUT - ${paymentData.beneficiary_name} - ${paymentData.description}`,
    transaction_type: 'debit',
    transaction_date: (paymentData.scheduled_date || new Date().toISOString()).split('T')[0],
    imported_from: 'cora',
    matched: false,
    metadata: { ...result, pix_key: paymentData.pix_key, beneficiary: paymentData.beneficiary_name }
  })

  return {
    payment_id: result.id,
    status: result.status,
    beneficiary: paymentData.beneficiary_name,
    amount: paymentData.amount,
    scheduled_date: paymentData.scheduled_date
  }
}

/**
 * List outbound payments from Cora
 */
async function listPayments(data: { start_date?: string; end_date?: string }) {
  const params = new URLSearchParams()
  if (data.start_date) params.set('start_date', data.start_date)
  if (data.end_date)   params.set('end_date', data.end_date)

  const response = await coraFetch(`/transfers/pix?${params}`)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Falha ao consultar pagamentos: ${err}`)
  }

  return await response.json()
}

/**
 * List charges (boletos emitidos)
 * GET /v2/invoices/?page=0&size=50&status=OPEN
 */
async function listCharges(data: { page?: number; size?: number; status?: string }) {
  const params = new URLSearchParams()
  params.set('page', String(data.page ?? 0))
  params.set('size', String(data.size ?? 50))
  if (data.status) params.set('status', data.status)

  const response = await coraFetch(`/v2/invoices/?${params}`)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Falha ao listar cobranças: ${err}`)
  }

  return await response.json()
}

/**
 * Get charge details
 * GET /v2/invoices/{id}
 */
async function getCharge(chargeId: string) {
  const response = await coraFetch(`/v2/invoices/${chargeId}`)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Falha ao consultar cobrança ${chargeId}: ${err}`)
  }

  return await response.json()
}

/**
 * Cancel a charge
 * DELETE /v2/invoices/{id}
 */
async function cancelCharge(chargeId: string) {
  const response = await coraFetch(`/v2/invoices/${chargeId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Falha ao cancelar cobrança ${chargeId}: ${err}`)
  }

  return { cancelled: true, charge_id: chargeId }
}

/**
 * Handle webhook from Cora (chamado pela função cora-webhook pública)
 */
async function handleWebhook(webhookData: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (webhookData.event === 'charge.paid' || webhookData.event === 'pix.received') {
    const chargeId = webhookData.charge?.id || webhookData.pix?.charge_id

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('external_charge_id', chargeId)
      .single()

    if (!invoice) return { message: 'Invoice not found' }

    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        payment_date: webhookData.charge?.paid_at || new Date().toISOString(),
        payment_method: webhookData.event.includes('pix') ? 'pix' : 'boleto'
      })
      .eq('id', invoice.id)

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

    return { message: 'Invoice updated successfully', invoice_id: invoice.id }
  }

  return { message: 'Event processed' }
}
