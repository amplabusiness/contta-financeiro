import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    console.log('🏷️ AI Expense Classifier started');

    // Buscar despesas sem classificação ou com conta não definida
    const { data: unclassifiedExpenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .is('account_id', null)
      .limit(100);

    if (expError) throw expError;

    // Buscar plano de contas para referência
    const { data: chartOfAccounts } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .like('code', '4.%') // Contas de despesa
      .order('code');

    console.log(`📋 Found ${unclassifiedExpenses?.length || 0} expenses to classify`);

    let classified = 0;
    const errors = [];

    for (const expense of unclassifiedExpenses || []) {
      try {
        const prompt = `Você é um contador expert em classificação de despesas. Analise a despesa abaixo e classifique-a no plano de contas adequado.

DESPESA:
- Descrição: ${expense.description}
- Valor: R$ ${expense.amount}
- Data: ${expense.date}

PLANO DE CONTAS DISPONÍVEL (Despesas):
${chartOfAccounts?.map(acc => `${acc.code} - ${acc.name}`).join('\n')}

Regras:
- 4.1 = Despesas Administrativas (aluguel, luz, água, internet, etc)
- 4.2 = Despesas com Pessoal (salários, benefícios, etc)
- 4.3 = Despesas Tributárias (impostos, taxas, etc)
- 4.4 = Despesas Financeiras (juros, tarifas bancárias, etc)
- 4.5 = Despesas com Marketing (publicidade, eventos, etc)
- 4.9 = Outras Despesas (quando não se encaixa em nenhuma categoria)

Responda APENAS com JSON:
{
  "account_code": "código da conta (ex: 4.1.1)",
  "category": "nome da categoria",
  "confidence": número de 0 a 1,
  "reasoning": "breve justificativa"
}`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é um contador expert em classificação de despesas.' },
              { role: 'user', content: prompt }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "classify_expense",
                  description: "Classifica uma despesa no plano de contas adequado",
                  parameters: {
                    type: "object",
                    properties: {
                      account_code: {
                        type: "string",
                        description: "Código da conta contábil (ex: 4.1.1)"
                      },
                      category: {
                        type: "string",
                        description: "Nome da categoria"
                      },
                      confidence: {
                        type: "number",
                        description: "Nível de confiança de 0 a 1",
                        minimum: 0,
                        maximum: 1
                      },
                      reasoning: {
                        type: "string",
                        description: "Breve justificativa da classificação"
                      }
                    },
                    required: ["account_code", "category", "confidence", "reasoning"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "classify_expense" } }
          }),
        });

        const aiData = await aiResponse.json();
        
        if (!aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
          throw new Error('AI não retornou classificação válida');
        }
        
        const classification = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);

        console.log(`🎯 AI Classification for expense ${expense.id}:`, classification);

        if (classification.confidence > 0.6) {
          // Buscar conta pelo código
          const { data: account } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('code', classification.account_code)
            .single();

          if (account) {
            // Atualizar despesa com classificação
            const { error: updateError } = await supabase
              .from('expenses')
              .update({ 
                account_id: account.id,
                category: classification.category
              })
              .eq('id', expense.id);

            if (updateError) {
              console.error('Error updating expense:', updateError);
              errors.push(`Expense ${expense.id}: ${updateError.message}`);
            } else {
              classified++;
              console.log(`✅ Classified expense ${expense.id} as ${classification.account_code}`);
            }
          } else {
            console.error(`Account ${classification.account_code} not found`);
            errors.push(`Expense ${expense.id}: Account not found`);
          }
        }

      } catch (error: any) {
        console.error(`Error classifying expense ${expense.id}:`, error);
        errors.push(`Expense ${expense.id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: unclassifiedExpenses?.length || 0,
        classified,
        errors,
        message: `🏷️ Agente classificou ${classified} de ${unclassifiedExpenses?.length || 0} despesas automaticamente`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in AI expense classifier:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
