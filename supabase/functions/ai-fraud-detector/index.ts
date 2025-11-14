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
    const { transaction_id, client_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get transaction
    const { data: transaction } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single()

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    // Get client data if provided
    let client = null
    if (client_id) {
      const { data } = await supabase
        .from('clients')
        .select('*, invoices(*)')
        .eq('id', client_id)
        .single()
      client = data
    }

    // Get transaction patterns for this client/amount range
    const { data: similarTransactions } = await supabase
      .from('bank_transactions')
      .select('*')
      .gte('amount', transaction.amount * 0.8)
      .lte('amount', transaction.amount * 1.2)
      .eq('transaction_type', transaction.transaction_type)
      .limit(20)

    // Calculate anomaly indicators
    const indicators = {
      unusual_amount: false,
      unusual_time: false,
      unusual_description: false,
      multiple_same_day: false,
      round_number: false
    }

    // Check if amount is round number (more suspicious)
    indicators.round_number = transaction.amount % 100 === 0 || transaction.amount % 1000 === 0

    // Check transaction hour (if available)
    const transactionHour = new Date(transaction.transaction_date).getHours()
    indicators.unusual_time = transactionHour < 6 || transactionHour > 22

    // Check for suspicious keywords in description
    const suspiciousKeywords = ['teste', 'test', 'fraude', 'fake', 'dummy']
    indicators.unusual_description = suspiciousKeywords.some(keyword =>
      transaction.description.toLowerCase().includes(keyword)
    )

    // Check multiple transactions same day
    const { count } = await supabase
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_date', transaction.transaction_date)
      .gte('amount', transaction.amount * 0.9)
      .lte('amount', transaction.amount * 1.1)

    indicators.multiple_same_day = !!(count && count > 3)

    // If client provided, check against expected patterns
    let clientPatterns = null
    if (client) {
      const avgInvoiceAmount = client.invoices?.length > 0
        ? client.invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0) / client.invoices.length
        : 0

      const deviationFromAvg = Math.abs(transaction.amount - avgInvoiceAmount) / avgInvoiceAmount * 100

      indicators.unusual_amount = deviationFromAvg > 50 // 50% deviation

      clientPatterns = {
        avg_invoice_amount: avgInvoiceAmount,
        monthly_fee: client.monthly_fee,
        deviation_percent: deviationFromAvg.toFixed(2)
      }
    }

    // Prepare data for AI
    const fraudData = {
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.transaction_date,
        type: transaction.transaction_type,
        imported_from: transaction.imported_from
      },
      indicators,
      client_patterns: clientPatterns,
      similar_transactions_count: similarTransactions?.length || 0
    }

    // Call AI for fraud detection
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
            content: `Você é um especialista em detecção de fraudes financeiras.

Analise a transação e retorne um JSON com:
{
  "fraud_score": <0-100, onde 100 é certeza de fraude>,
  "risk_level": "<low|medium|high|critical>",
  "is_likely_fraud": <true|false>,
  "red_flags": ["flag 1", "flag 2"],
  "safe_indicators": ["indicador seguro 1", "indicador seguro 2"],
  "recommendation": "<approve|review|block>",
  "reasoning": "explicação detalhada"
}

Red flags (sinais de alerta):
- Valor muito diferente do padrão
- Horário incomum (madrugada/noite)
- Descrição suspeita
- Múltiplas transações idênticas no mesmo dia
- Valor redondo (ex: 1000.00, 5000.00)
- Primeira transação de valor alto
- Padrão inconsistente com histórico

Safe indicators:
- Valor próximo ao honorário mensal
- Horário comercial
- Descrição clara e profissional
- Padrão consistente com histórico`
          },
          {
            role: 'user',
            content: `Analise esta transação:\n${JSON.stringify(fraudData, null, 2)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI API error: ${error}`)
    }

    const aiResult = await response.json()
    const fraudAnalysis = JSON.parse(aiResult.choices[0].message.content)

    // Update transaction with fraud analysis
    await supabase
      .from('bank_transactions')
      .update({
        ai_confidence: fraudAnalysis.fraud_score / 100,
        ai_suggestion: fraudAnalysis.recommendation,
        metadata: {
          ...transaction.metadata,
          fraud_analysis: fraudAnalysis
        }
      })
      .eq('id', transaction_id)

    // Log execution
    await supabase.from('ai_executions').insert({
      agent_id: (await supabase.from('ai_agents').select('id').eq('type', 'fraud_detector').single()).data?.id,
      client_id: client_id || null,
      input_data: fraudData,
      output_data: fraudAnalysis,
      status: 'completed',
      tokens_used: aiResult.usage?.total_tokens,
      executed_at: new Date().toISOString()
    })

    // If high risk, create alert
    if (fraudAnalysis.fraud_score > 70) {
      // Could send notification to admin here
      console.warn(`HIGH FRAUD RISK detected on transaction ${transaction_id}`)
    }

    return new Response(JSON.stringify({
      success: true,
      transaction_id,
      fraud_analysis: fraudAnalysis
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Fraud detector error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
