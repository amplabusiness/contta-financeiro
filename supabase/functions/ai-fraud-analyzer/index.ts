import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentData {
  supplier_name: string;
  supplier_document?: string;
  description: string;
  amount: number;
  category: string;
  payment_method?: string;
  bank_account?: string;
  document_number?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    const { payment } = await req.json() as { payment: PaymentData };

    console.log('Analyzing payment for fraud:', payment);

    // Buscar histórico de pagamentos similares
    const similarPaymentsResponse = await fetch(
      `${supabaseUrl}/rest/v1/accounts_payable?supplier_name=eq.${encodeURIComponent(payment.supplier_name)}&order=created_at.desc&limit=10`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    const similarPayments = similarPaymentsResponse.ok ? await similarPaymentsResponse.json() : [];

    // Buscar média de valores para este fornecedor
    const supplierStatsResponse = await fetch(
      `${supabaseUrl}/rest/v1/accounts_payable?supplier_name=eq.${encodeURIComponent(payment.supplier_name)}&select=amount`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    const supplierStats = supplierStatsResponse.ok ? await supplierStatsResponse.json() : [];

    const avgAmount = supplierStats && supplierStats.length > 0
      ? supplierStats.reduce((sum: any, p: any) => sum + Number(p.amount), 0) / supplierStats.length
      : 0;

    // Preparar prompt para análise de IA
    const prompt = `Você é um especialista em detecção de fraudes financeiras da Ampla Contabilidade.

Analise este pagamento e identifique possíveis riscos de fraude:

DADOS DO PAGAMENTO:
- Fornecedor: ${payment.supplier_name}
- Documento: ${payment.supplier_document || 'Não informado'}
- Descrição: ${payment.description}
- Valor: R$ ${payment.amount.toFixed(2)}
- Categoria: ${payment.category}
- Método de Pagamento: ${payment.payment_method || 'Não informado'}
- Conta Bancária: ${payment.bank_account || 'Não informado'}
- Nº Documento: ${payment.document_number || 'Não informado'}

HISTÓRICO DO FORNECEDOR:
- Pagamentos anteriores: ${similarPayments?.length || 0}
- Valor médio de pagamentos: R$ ${avgAmount.toFixed(2)}

INDICADORES DE ANÁLISE:
1. Valor muito acima da média (> 150%)
2. Primeiro pagamento para fornecedor novo
3. Dados bancários inconsistentes
4. Descrição vaga ou suspeita
5. Documento fiscal ausente
6. Método de pagamento incomum
7. Padrões anômalos de valores

Forneça uma análise estruturada com:
1. Score de risco de fraude (0-100, onde 100 é altíssimo risco)
2. Lista de motivos de alerta (se houver)
3. Recomendações de ação
4. Análise detalhada

Seja rigoroso e específico.`;

    // Chamar Lovable AI para análise
    const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${geminiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // model moved to URL,
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em detecção de fraudes financeiras. Analise pagamentos com rigor e forneça análises estruturadas e detalhadas.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'fraud_analysis',
            description: 'Retorna análise estruturada de fraude',
            parameters: {
              type: 'object',
              properties: {
                fraud_score: {
                  type: 'number',
                  description: 'Score de risco de fraude de 0 a 100'
                },
                risk_level: {
                  type: 'string',
                  enum: ['baixo', 'médio', 'alto', 'crítico'],
                  description: 'Nível de risco'
                },
                fraud_reasons: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Lista de motivos de alerta'
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Recomendações de ação'
                },
                detailed_analysis: {
                  type: 'string',
                  description: 'Análise detalhada do pagamento'
                },
                approval_suggestion: {
                  type: 'string',
                  enum: ['approve', 'reject', 'flag_for_review'],
                  description: 'Sugestão de aprovação'
                }
              },
              required: ['fraud_score', 'risk_level', 'fraud_reasons', 'recommendations', 'detailed_analysis', 'approval_suggestion'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'fraud_analysis' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData, null, 2));

    // Extrair resultado da análise
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    let analysis;
    
    if (toolCall && toolCall.function) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback para análise básica
      const avgVariation = avgAmount > 0 ? ((payment.amount - avgAmount) / avgAmount) * 100 : 0;
      const isNewSupplier = !similarPayments || similarPayments.length === 0;
      
      let fraudScore = 0;
      const fraudReasons = [];
      const recommendations = [];
      
      if (avgVariation > 150) {
        fraudScore += 40;
        fraudReasons.push(`Valor ${avgVariation.toFixed(0)}% acima da média`);
      }
      
      if (isNewSupplier) {
        fraudScore += 30;
        fraudReasons.push('Primeiro pagamento para este fornecedor');
        recommendations.push('Verificar cadastro e documentação do fornecedor');
      }
      
      if (!payment.document_number) {
        fraudScore += 20;
        fraudReasons.push('Documento fiscal não informado');
        recommendations.push('Solicitar nota fiscal antes do pagamento');
      }
      
      if (!payment.supplier_document) {
        fraudScore += 10;
        fraudReasons.push('CNPJ/CPF do fornecedor não informado');
        recommendations.push('Cadastrar documento do fornecedor');
      }

      analysis = {
        fraud_score: Math.min(fraudScore, 100),
        risk_level: fraudScore >= 70 ? 'crítico' : fraudScore >= 50 ? 'alto' : fraudScore >= 30 ? 'médio' : 'baixo',
        fraud_reasons: fraudReasons.length > 0 ? fraudReasons : ['Nenhum alerta identificado'],
        recommendations: recommendations.length > 0 ? recommendations : ['Pagamento dentro dos padrões normais'],
        detailed_analysis: `Análise automática: ${fraudReasons.length} alertas identificados`,
        approval_suggestion: fraudScore >= 70 ? 'flag_for_review' : fraudScore >= 50 ? 'flag_for_review' : 'approve'
      };
    }

    console.log('Final analysis:', analysis);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          fraud_score: analysis.fraud_score,
          risk_level: analysis.risk_level,
          fraud_reasons: analysis.fraud_reasons,
          recommendations: analysis.recommendations,
          detailed_analysis: analysis.detailed_analysis,
          approval_suggestion: analysis.approval_suggestion,
          supplier_history: {
            previous_payments: similarPayments?.length || 0,
            average_amount: avgAmount
          }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in ai-fraud-analyzer:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
