import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { callGemini } from '../_shared/gemini.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client_id, message, conversation_history } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get client context
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()

    // Get recent invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Build context
    const context = {
      client: {
        name: client?.name,
        monthly_fee: client?.monthly_fee,
        status: client?.status
      },
      recent_invoices: invoices?.map(inv => ({
        competence: inv.competence,
        amount: inv.amount,
        status: inv.status,
        due_date: inv.due_date
      }))
    }

    // Prepare messages for AI
    const messages = [
      {
        role: 'system',
        content: `Você é um assistente virtual de um escritório contábil brasileiro.

Suas responsabilidades:
- Responder dúvidas sobre faturas, pagamentos e honorários
- Explicar como fazer pagamentos (boleto, PIX)
- Informar sobre datas de vencimento
- Esclarecer dúvidas sobre serviços contábeis
- Ser sempre educado, profissional e prestativo

IMPORTANTE:
- Sempre responda em português do Brasil
- Se não souber algo, sugira que o cliente entre em contato com o contador
- Nunca forneça orientações fiscais ou contábeis complexas
- Mantenha tom profissional mas amigável

Contexto do cliente:
${JSON.stringify(context, null, 2)}`
      },
      ...(conversation_history || []),
      {
        role: 'user',
        content: message
      }
    ]

    // Call Gemini API directly
    const aiResult = await callGemini(messages, {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxOutputTokens: 500
    })

    const botMessage = aiResult.text

    // Log conversation
    await supabase.from('ai_executions').insert({
      agent_id: (await supabase.from('ai_agents').select('id').eq('type', 'chatbot').single()).data?.id,
      client_id,
      input_data: { message, context },
      output_data: { response: botMessage },
      status: 'completed',
      tokens_used: aiResult.tokensUsed,
      executed_at: new Date().toISOString()
    })

    return new Response(JSON.stringify({
      success: true,
      message: botMessage,
      conversation_id: crypto.randomUUID()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Chatbot error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
