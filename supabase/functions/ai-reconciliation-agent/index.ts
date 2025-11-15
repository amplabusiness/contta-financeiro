import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getErrorMessage } from '../_shared/types.ts';

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

    console.log('🤖 AI Reconciliation Agent started');

    // Buscar transações não conciliadas
    const { data: pendingTransactions, error: txError } = await supabase
      .from('bank_transactions')
      .select('*')
      .is('matched_invoice_id', null)
      .is('matched_expense_id', null)
      .order('transaction_date', { ascending: false })
      .limit(50);

    if (txError) throw txError;

    // Buscar boletos pendentes
    const { data: pendingInvoices, error: invError } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('status', 'pending')
      .order('due_date', { ascending: true });

    if (invError) throw invError;

    // Buscar despesas pendentes
    const { data: pendingExpenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('status', 'pending')
      .order('date', { ascending: true });

    if (expError) throw expError;

    console.log(`📊 Found: ${pendingTransactions?.length || 0} transactions, ${pendingInvoices?.length || 0} invoices, ${pendingExpenses?.length || 0} expenses`);

    let reconciled = 0;
    const errors = [];

    // Processar cada transação com IA
    for (const transaction of pendingTransactions || []) {
      try {
        const prompt = `Você é um agente de conciliação bancária. Analise esta transação e encontre a melhor correspondência.

TRANSAÇÃO BANCÁRIA:
- Descrição: ${transaction.description}
- Valor: R$ ${transaction.amount}
- Data: ${transaction.transaction_date}
- Tipo: ${transaction.transaction_type}

BOLETOS PENDENTES:
${pendingInvoices?.map((inv, i) => `${i + 1}. Cliente: ${inv.clients?.name}, Valor: R$ ${inv.amount}, Vencimento: ${inv.due_date}`).join('\n')}

DESPESAS PENDENTES:
${pendingExpenses?.map((exp, i) => `${i + 1}. Descrição: ${exp.description}, Valor: R$ ${exp.amount}, Data: ${exp.due_date}`).join('\n')}

Responda APENAS com um JSON no formato:
{
  "match_type": "invoice" ou "expense" ou "none",
  "match_index": número do item correspondente (1-based) ou null,
  "confidence": número de 0 a 1,
  "reasoning": "breve explicação"
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
              { role: 'system', content: 'Você é um especialista em conciliação bancária.' },
              { role: 'user', content: prompt }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "reconcile_transaction",
                  description: "Encontra correspondência para uma transação bancária",
                  parameters: {
                    type: "object",
                    properties: {
                      match_type: {
                        type: "string",
                        enum: ["invoice", "expense", "none"],
                        description: "Tipo de correspondência encontrada"
                      },
                      match_index: {
                        type: ["number", "null"],
                        description: "Índice do item correspondente (1-based) ou null"
                      },
                      confidence: {
                        type: "number",
                        description: "Nível de confiança de 0 a 1",
                        minimum: 0,
                        maximum: 1
                      },
                      reasoning: {
                        type: "string",
                        description: "Breve explicação da correspondência"
                      }
                    },
                    required: ["match_type", "confidence", "reasoning"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "reconcile_transaction" } }
          }),
        });

        const aiData = await aiResponse.json();
        
        if (!aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
          throw new Error('AI não retornou resultado de conciliação válido');
        }
        
        const aiResult = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);

        console.log(`🎯 AI Match for transaction ${transaction.id}:`, aiResult);

        if (aiResult.confidence > 0.7 && aiResult.match_type !== 'none') {
          const matchIndex = aiResult.match_index - 1; // Convert to 0-based

          if (aiResult.match_type === 'invoice' && pendingInvoices[matchIndex]) {
            const invoice = pendingInvoices[matchIndex];
            
            // Atualizar transação
            await supabase
              .from('bank_transactions')
              .update({ 
                matched_invoice_id: invoice.id,
                confidence_score: aiResult.confidence
              })
              .eq('id', transaction.id);

            // Marcar boleto como pago
            await supabase
              .from('invoices')
              .update({ status: 'paid', paid_at: transaction.date })
              .eq('id', invoice.id);

            // Criar lançamento contábil de recebimento
            await supabase.functions.invoke('create-accounting-entry', {
              body: {
                type: 'invoice',
                operation: 'payment',
                referenceId: invoice.id,
                amount: invoice.amount,
                date: transaction.date,
                description: `Recebimento ${invoice.clients?.name}`,
                clientId: invoice.client_id
              }
            });

            reconciled++;
            console.log(`✅ Reconciled invoice ${invoice.id} with transaction ${transaction.id}`);

          } else if (aiResult.match_type === 'expense' && pendingExpenses[matchIndex]) {
            const expense = pendingExpenses[matchIndex];
            
            // Atualizar transação
            await supabase
              .from('bank_transactions')
              .update({ 
                matched_expense_id: expense.id,
                confidence_score: aiResult.confidence
              })
              .eq('id', transaction.id);

            // Marcar despesa como paga
            await supabase
              .from('expenses')
              .update({ status: 'paid', paid_at: transaction.date })
              .eq('id', expense.id);

            // Criar lançamento contábil de pagamento
            await supabase.functions.invoke('create-accounting-entry', {
              body: {
                type: 'expense',
                operation: 'payment',
                referenceId: expense.id,
                amount: expense.amount,
                date: transaction.date,
                description: `Pagamento ${expense.description}`,
                accountCode: expense.account_code
              }
            });

            reconciled++;
            console.log(`✅ Reconciled expense ${expense.id} with transaction ${transaction.id}`);
          }
        }

      } catch (error: unknown) {
        console.error(`Error processing transaction ${transaction.id}:`, error);
        errors.push(`Transaction ${transaction.id}: ${getErrorMessage(error)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingTransactions?.length || 0,
        reconciled,
        errors,
        message: `🤖 Agente processou ${pendingTransactions?.length || 0} transações e conciliou ${reconciled} automaticamente`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in AI reconciliation agent:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
