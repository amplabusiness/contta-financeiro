import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@system.com'
const SENDGRID_FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') || 'Sistema Contábil'

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

interface NotificationRequest {
  event: 'invoice_created' | 'invoice_due' | 'invoice_overdue' | 'invoice_paid'
  client_id: string
  invoice_id: string
  channels: ('email' | 'whatsapp' | 'sms')[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const request: NotificationRequest = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get invoice and client data
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('id', request.invoice_id)
      .single()

    if (!invoice) {
      throw new Error('Invoice not found')
    }

    // Get message template
    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('type', request.event)
      .eq('is_active', true)

    const results = []

    for (const channel of request.channels) {
      const template = templates?.find(t => t.channel === channel)

      if (!template) {
        console.log(`No template found for ${request.event} / ${channel}`)
        continue
      }

      const message = renderTemplate(template.body, {
        client_name: invoice.clients.name,
        amount: formatCurrency(invoice.amount),
        due_date: formatDate(invoice.due_date),
        competence: invoice.competence,
        boleto_url: invoice.boleto_url || '',
        pix_copy_paste: invoice.pix_copy_paste || '',
        payment_link: invoice.payment_link || ''
      })

      const subject = template.subject ? renderTemplate(template.subject, {
        client_name: invoice.clients.name,
        competence: invoice.competence
      }) : undefined

      try {
        let externalId = ''

        if (channel === 'email' && invoice.clients.email) {
          externalId = await sendEmail(invoice.clients.email, subject!, message)
        } else if (channel === 'whatsapp' && invoice.clients.phone) {
          externalId = await sendWhatsApp(invoice.clients.phone, message)
        } else if (channel === 'sms' && invoice.clients.phone) {
          externalId = await sendSMS(invoice.clients.phone, message)
        }

        // Log notification
        await supabase.from('notifications_log').insert({
          client_id: request.client_id,
          invoice_id: request.invoice_id,
          type: request.event,
          channel,
          recipient: channel === 'email' ? invoice.clients.email : invoice.clients.phone,
          subject,
          message,
          status: 'sent',
          external_id: externalId,
          sent_at: new Date().toISOString()
        })

        results.push({ channel, status: 'sent', external_id: externalId })
      } catch (error) {
        // Log failed notification
        await supabase.from('notifications_log').insert({
          client_id: request.client_id,
          invoice_id: request.invoice_id,
          type: request.event,
          channel,
          recipient: channel === 'email' ? invoice.clients.email : invoice.clients.phone,
          subject,
          message,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })

        results.push({ channel, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Notification dispatcher error:', error)

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
 * Send email via SendGrid
 */
async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid API key not configured')
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }]
      }],
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME
      },
      subject,
      content: [{
        type: 'text/html',
        value: html
      }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SendGrid error: ${error}`)
  }

  // SendGrid returns message ID in X-Message-Id header
  return response.headers.get('X-Message-Id') || 'sent'
}

/**
 * Send WhatsApp via Evolution API
 */
async function sendWhatsApp(phone: string, message: string): Promise<string> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    throw new Error('Evolution API not configured')
  }

  // Clean phone number (remove non-digits)
  const cleanPhone = phone.replace(/\D/g, '')

  const response = await fetch(`${EVOLUTION_API_URL}/message/sendText`, {
    method: 'POST',
    headers: {
      'apikey': EVOLUTION_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: `55${cleanPhone}`, // Add country code if needed
      text: message
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Evolution API error: ${error}`)
  }

  const result = await response.json()
  return result.key?.id || 'sent'
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(phone: string, message: string): Promise<string> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio not configured')
  }

  const cleanPhone = phone.replace(/\D/g, '')

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER!,
        To: `+55${cleanPhone}`,
        Body: message
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twilio error: ${error}`)
  }

  const result = await response.json()
  return result.sid
}

/**
 * Render template with variables
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    // Escapar HTML para prevenir injeção
    const escaped = escapeHtml(value)
    result = result.replace(new RegExp(`{${key}}`, 'g'), escaped)
  }
  return result
}

/**
 * Format currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('pt-BR').format(date)
}
