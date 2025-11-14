import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get client data
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    if (!client) {
      throw new Error('Client not found')
    }

    // Get invoice history (last 12 months)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', client_id)
      .gte('created_at', oneYearAgo.toISOString())
      .order('created_at', { ascending: false })

    // Calculate metrics
    const totalInvoices = invoices?.length || 0
    const paidInvoices = invoices?.filter(inv => inv.status === 'paid').length || 0
    const overdueInvoices = invoices?.filter(inv => inv.status === 'overdue').length || 0
    const pendingInvoices = invoices?.filter(inv => inv.status === 'pending').length || 0

    const paymentRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0

    // Calculate average days to pay
    const paidInvoicesWithDates = invoices?.filter(inv =>
      inv.status === 'paid' && inv.payment_date && inv.due_date
    ) || []

    const avgDaysToPay = paidInvoicesWithDates.length > 0
      ? paidInvoicesWithDates.reduce((sum, inv) => {
          const dueDate = new Date(inv.due_date)
          const paymentDate = new Date(inv.payment_date)
          const days = Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0) / paidInvoicesWithDates.length
      : 0

    // Get last interaction date
    const lastInvoiceDate = invoices?.[0]?.created_at

    const daysSinceLastInvoice = lastInvoiceDate
      ? Math.floor((Date.now() - new Date(lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    // Prepare data for AI
    const clientData = {
      name: client.name,
      status: client.status,
      monthly_fee: client.monthly_fee,
      total_invoices: totalInvoices,
      paid_invoices: paidInvoices,
      overdue_invoices: overdueInvoices,
      pending_invoices: pendingInvoices,
      payment_rate: paymentRate.toFixed(2),
      avg_days_to_pay: avgDaysToPay.toFixed(0),
      days_since_last_invoice: daysSinceLastInvoice
    }

    // Call AI for churn prediction
    const response = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em análise de churn (cancelamento) de clientes.

Analise os dados do cliente e retorne um JSON com:
{
  "churn_risk_score": <0-100, onde 100 é altíssimo risco>,
  "risk_level": "<low|medium|high|critical>",
  "main_reasons": ["razão 1", "razão 2", "razão 3"],
  "recommendations": ["ação 1", "ação 2", "ação 3"],
  "predicted_churn_date": "<data estimada YYYY-MM-DD ou null>"
}

Fatores de risco:
- Taxa de pagamento < 70% = alto risco
- Média de dias de atraso > 15 = alto risco
- Nenhuma fatura em 60+ dias = altíssimo risco
- Faturas em atraso > 3 = alto risco
- Status inactive = altíssimo risco`
          },
          {
            role: 'user',
            content: `Analise este cliente:\n${JSON.stringify(clientData, null, 2)}`
          }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI API error: ${error}`)
    }

    const aiResult = await response.json()
    const prediction = JSON.parse(aiResult.choices[0].message.content)

    // Log execution
    await supabase.from('ai_executions').insert({
      agent_id: (await supabase.from('ai_agents').select('id').eq('type', 'churn_predictor').single()).data?.id,
      client_id,
      input_data: clientData,
      output_data: prediction,
      status: 'completed',
      tokens_used: aiResult.usage?.total_tokens,
      executed_at: new Date().toISOString()
    })

    return new Response(JSON.stringify({
      success: true,
      client_data: clientData,
      prediction
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Churn predictor error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
