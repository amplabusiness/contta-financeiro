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

    // Get client data with enrichment
    const { data: client } = await supabase
      .from('clients')
      .select('*, client_enrichment(*)')
      .eq('id', client_id)
      .single()

    if (!client) {
      throw new Error('Client not found')
    }

    // Get market average (other clients' fees)
    const { data: allClients } = await supabase
      .from('clients')
      .select('monthly_fee')
      .eq('status', 'active')
      .gt('monthly_fee', 0)

    const avgMarketFee = allClients && allClients.length > 0
      ? allClients.reduce((sum, c) => sum + c.monthly_fee, 0) / allClients.length
      : 0

    const medianMarketFee = allClients && allClients.length > 0
      ? allClients.sort((a, b) => a.monthly_fee - b.monthly_fee)[Math.floor(allClients.length / 2)].monthly_fee
      : 0

    // Calculate complexity score
    const enrichment = client.client_enrichment?.[0]

    const complexityFactors = {
      has_qsa: enrichment?.qsa ? 1 : 0,
      num_partners: enrichment?.qsa ? JSON.parse(enrichment.qsa).length : 0,
      company_size: enrichment?.porte || 'unknown',
      activities_count: enrichment?.atividade_principal ? 1 : 0,
      has_multiple_activities: enrichment?.atividades_secundarias ? 1 : 0
    }

    // Prepare data for AI
    const pricingData = {
      client: {
        name: client.name,
        current_fee: client.monthly_fee,
        cnpj: client.cnpj,
        status: client.status
      },
      enrichment: {
        razao_social: enrichment?.razao_social,
        porte: enrichment?.porte,
        natureza_juridica: enrichment?.natureza_juridica,
        atividade_principal: enrichment?.atividade_principal,
        capital_social: enrichment?.capital_social,
        situacao_cadastral: enrichment?.situacao_cadastral
      },
      complexity_factors: complexityFactors,
      market: {
        average_fee: avgMarketFee,
        median_fee: medianMarketFee,
        current_vs_market: client.monthly_fee / avgMarketFee * 100
      }
    }

    // Call AI for pricing optimization
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
            content: `Você é um especialista em precificação de serviços contábeis no Brasil.

Analise os dados do cliente e retorne um JSON com:
{
  "suggested_fee": <valor recomendado em R$>,
  "min_fee": <valor mínimo em R$>,
  "max_fee": <valor máximo em R$>,
  "complexity_score": <0-100>,
  "price_positioning": "<underpriced|fair|overpriced>",
  "justification": "explicação da sugestão",
  "upsell_opportunities": ["oportunidade 1", "oportunidade 2"],
  "risk_factors": ["risco 1", "risco 2"]
}

Considere:
- Porte da empresa (ME < EPP < Grande)
- Natureza jurídica (mais complexo = maior valor)
- Número de sócios/atividades
- Situação cadastral
- Comparação com mercado (média e mediana)
- Margem de lucro desejada: 40-60%

Honorários típicos no Brasil 2025:
- MEI: R$ 150-300
- ME (Simples): R$ 400-800
- EPP (Simples): R$ 800-2.000
- Lucro Presumido: R$ 1.500-4.000
- Lucro Real: R$ 3.000+`
          },
          {
            role: 'user',
            content: `Analise este cliente e sugira o honorário ideal:\n${JSON.stringify(pricingData, null, 2)}`
          }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI API error: ${error}`)
    }

    const aiResult = await response.json()
    const optimization = JSON.parse(aiResult.choices[0].message.content)

    // Log execution
    await supabase.from('ai_executions').insert({
      agent_id: (await supabase.from('ai_agents').select('id').eq('type', 'pricing_optimizer').single()).data?.id,
      client_id,
      input_data: pricingData,
      output_data: optimization,
      status: 'completed',
      tokens_used: aiResult.usage?.total_tokens,
      executed_at: new Date().toISOString()
    })

    return new Response(JSON.stringify({
      success: true,
      current_fee: client.monthly_fee,
      market_data: pricingData.market,
      optimization
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Pricing optimizer error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
