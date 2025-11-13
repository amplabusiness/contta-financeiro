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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting AI PIX Reconciliation Agent...');

    // Buscar transações PIX sem match
    const { data: pixTransactions, error: pixError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('transaction_type', 'credit')
      .eq('matched', false)
      .ilike('description', '%PIX%')
      .order('transaction_date', { ascending: false });

    if (pixError) throw pixError;

    console.log(`Found ${pixTransactions?.length || 0} unmatched PIX transactions`);

    // Buscar todos os clientes com dados enriquecidos e pagadores
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        *,
        enrichment:client_enrichment(*),
        payers:client_payers(*)
      `)
      .eq('status', 'active');

    if (clientsError) throw clientsError;

    // Buscar faturas pendentes
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*, clients(id, name, cnpj)')
      .in('status', ['pending', 'overdue']);

    if (invoicesError) throw invoicesError;

    let processed = 0;
    let reconciled = 0;
    const results = [];

    for (const pix of pixTransactions || []) {
      try {
        // Extrair CNPJ/CPF e nome da descrição
        const descriptionMatch = pix.description.match(/PIX_CRED\s+(\d+)\s+(.+)/);
        const cnpjCpf = descriptionMatch?.[1] || '';
        const payerName = descriptionMatch?.[2]?.trim() || '';

        console.log(`Processing PIX: ${pix.description}, CNPJ/CPF: ${cnpjCpf}, Name: ${payerName}`);

        // Buscar cliente correspondente por CNPJ/CPF
        let matchedClient = clients?.find(c => 
          c.cnpj && cnpjCpf && c.cnpj.replace(/\D/g, '') === cnpjCpf.replace(/\D/g, '')
        );

        // Se não encontrou por CNPJ, buscar por pagador conhecido (sócio, representante)
        if (!matchedClient && payerName) {
          matchedClient = clients?.find(c => 
            c.payers?.some((p: any) => 
              p.is_active && 
              (p.payer_name.toLowerCase().includes(payerName.toLowerCase()) ||
               payerName.toLowerCase().includes(p.payer_name.toLowerCase()) ||
               (p.payer_document && cnpjCpf && p.payer_document.replace(/\D/g, '') === cnpjCpf.replace(/\D/g, '')))
            )
          );

          if (matchedClient) {
            console.log(`Cliente encontrado via pagador conhecido: ${matchedClient.name}`);
          }
        }

        // Se ainda não encontrou, usar IA para buscar por nome similar
        if (!matchedClient && payerName) {
          const prompt = `Analise o nome do pagador PIX "${payerName}" e encontre o cliente correspondente na lista abaixo.
          
Clientes disponíveis:
${clients?.map(c => `- ID: ${c.id}, Nome: ${c.name}, CNPJ: ${c.cnpj || 'N/A'}`).join('\n')}

Retorne apenas o ID do cliente mais provável ou "NONE" se não houver correspondência clara.`;

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'Você é um especialista em reconciliação financeira. Retorne apenas o ID do cliente ou NONE.' },
                { role: 'user', content: prompt }
              ],
            }),
          });

          const aiData = await aiResponse.json();
          const clientId = aiData.choices[0].message.content.trim();
          
          if (clientId !== 'NONE') {
            matchedClient = clients?.find(c => c.id === clientId);
          }
        }

        if (!matchedClient) {
          console.log(`No client found for PIX: ${pix.description}`);
          results.push({
            pixId: pix.id,
            status: 'no_client',
            cnpjCpf,
            payerName
          });
          processed++;
          continue;
        }

        console.log(`Matched client: ${matchedClient.name}`);

        // Buscar faturas do cliente que correspondam ao valor e período
        const clientInvoices = invoices?.filter(inv => 
          inv.clients?.id === matchedClient.id
        ) || [];

        if (clientInvoices.length === 0) {
          console.log(`No invoices found for client: ${matchedClient.name}`);
          results.push({
            pixId: pix.id,
            status: 'no_invoices',
            clientId: matchedClient.id,
            clientName: matchedClient.name
          });
          processed++;
          continue;
        }

        // Usar IA para fazer o match inteligente
        const matchPrompt = `Analise esta transação PIX e encontre a fatura correspondente:

PIX:
- Data: ${pix.transaction_date}
- Valor: R$ ${pix.amount}
- Descrição: ${pix.description}
- Cliente: ${matchedClient.name}

Faturas disponíveis do cliente:
${clientInvoices.map(inv => `
- ID: ${inv.id}
- Vencimento: ${inv.due_date}
- Valor: R$ ${inv.amount}
- Status: ${inv.status}
- Competência: ${inv.competence || 'N/A'}
`).join('\n')}

Analise a correspondência considerando:
1. Proximidade de valores (pode ter pequena diferença por taxas)
2. Proximidade de datas (PIX geralmente paga próximo ao vencimento)
3. Status da fatura

Retorne no formato JSON:
{
  "invoice_id": "id_da_fatura" ou null,
  "confidence": 0-100,
  "reason": "explicação breve"
}`;

        const matchResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é um especialista em reconciliação financeira. Retorne apenas JSON válido.' },
              { role: 'user', content: matchPrompt }
            ],
          }),
        });

        const matchData = await matchResponse.json();
        const matchResult = JSON.parse(
          matchData.choices[0].message.content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()
        );

        console.log(`AI Match Result:`, matchResult);

        // Se confiança >= 80%, fazer reconciliação automática
        if (matchResult.confidence >= 80 && matchResult.invoice_id) {
          // Atualizar transação PIX
          await supabase
            .from('bank_transactions')
            .update({
              matched: true,
              matched_invoice_id: matchResult.invoice_id,
              ai_confidence: matchResult.confidence,
              ai_suggestion: matchResult.reason
            })
            .eq('id', pix.id);

          // Atualizar fatura para paga
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              payment_date: pix.transaction_date
            })
            .eq('id', matchResult.invoice_id);

          // Criar lançamento contábil
          await supabase.functions.invoke('create-accounting-entry', {
            body: {
              type: 'invoice_payment',
              invoiceId: matchResult.invoice_id,
              transactionId: pix.id,
              amount: pix.amount,
              date: pix.transaction_date
            }
          });

          reconciled++;
          results.push({
            pixId: pix.id,
            status: 'reconciled',
            invoiceId: matchResult.invoice_id,
            confidence: matchResult.confidence,
            reason: matchResult.reason
          });
        } else {
          results.push({
            pixId: pix.id,
            status: 'low_confidence',
            suggestion: matchResult,
            clientId: matchedClient.id
          });
        }

        processed++;
      } catch (error) {
        console.error(`Error processing PIX ${pix.id}:`, error);
        results.push({
          pixId: pix.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
        processed++;
      }
    }

    console.log(`AI PIX Reconciliation completed: ${processed} processed, ${reconciled} reconciled`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} PIX transactions, ${reconciled} reconciled`,
        processed,
        reconciled,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in AI PIX Reconciliation:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
