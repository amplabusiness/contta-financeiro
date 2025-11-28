import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'credit' | 'debit';
}

interface MatchSuggestion {
  type: 'invoice' | 'expense' | 'accounts_payable';
  id: string;
  client_id?: string;
  client_name?: string;
  amount: number;
  description: string;
  confidence: number;
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const { action, transaction, filters } = await req.json();

    console.log('Smart Reconciliation:', action, transaction?.id);

    if (action === 'suggest_matches') {
      // Buscar dados pendentes
      const isCredit = transaction.type === 'credit';

      let suggestions: MatchSuggestion[] = [];

      if (isCredit) {
        // Para créditos, buscar honorários pendentes
        const { data: invoices } = await supabase
          .from('invoices')
          .select('*, clients(id, name, cnpj)')
          .eq('status', 'pending')
          .order('due_date', { ascending: true })
          .limit(100);

        if (invoices && invoices.length > 0) {
          // Estratégia 1: Match por valor exato
          const exactMatches = invoices.filter(inv =>
            Math.abs(inv.amount - transaction.amount) < 0.01
          );

          for (const inv of exactMatches) {
            suggestions.push({
              type: 'invoice',
              id: inv.id,
              client_id: inv.client_id,
              client_name: inv.clients?.name || 'Cliente',
              amount: inv.amount,
              description: `${inv.clients?.name} - ${inv.competence}`,
              confidence: 0.95,
              reason: 'Valor exato correspondente'
            });
          }

          // Estratégia 2: Match por múltiplos honorários que somam o valor
          if (suggestions.length === 0 || transaction.amount > (suggestions[0]?.amount || 0)) {
            const combinations = findCombinations(
              invoices.map(inv => ({
                ...inv,
                client_name: inv.clients?.name
              })),
              transaction.amount,
              0.01, // tolerância
              5 // máximo de itens
            );

            for (const combo of combinations.slice(0, 3)) {
              // Adicionar cada item da combinação como sugestão
              for (const item of combo.items) {
                if (!suggestions.some(s => s.id === item.id)) {
                  suggestions.push({
                    type: 'invoice',
                    id: item.id,
                    client_id: item.client_id,
                    client_name: item.client_name || 'Cliente',
                    amount: item.amount,
                    description: `${item.client_name} - ${item.competence}`,
                    confidence: combo.confidence,
                    reason: `Parte de combinação de ${combo.items.length} honorários`
                  });
                }
              }
            }
          }

          // Estratégia 3: Match por texto (CNPJ, nome do cliente na descrição)
          const txDesc = transaction.description.toLowerCase();
          for (const inv of invoices) {
            if (suggestions.some(s => s.id === inv.id)) continue;

            const clientName = (inv.clients?.name || '').toLowerCase();
            const clientCnpj = (inv.clients?.cnpj || '').replace(/\D/g, '');

            let confidence = 0;
            let reason = '';

            // Verificar se nome do cliente está na descrição
            if (clientName && txDesc.includes(clientName.split(' ')[0])) {
              confidence = 0.75;
              reason = 'Nome do cliente encontrado na descrição';
            }
            // Verificar se CNPJ está na descrição
            else if (clientCnpj && clientCnpj.length > 8 && txDesc.includes(clientCnpj.slice(0, 8))) {
              confidence = 0.85;
              reason = 'CNPJ encontrado na descrição';
            }
            // Verificar valor aproximado (dentro de 10%)
            else if (Math.abs(inv.amount - transaction.amount) / transaction.amount < 0.1) {
              confidence = 0.5;
              reason = 'Valor aproximado (diferença < 10%)';
            }

            if (confidence > 0) {
              suggestions.push({
                type: 'invoice',
                id: inv.id,
                client_id: inv.client_id,
                client_name: inv.clients?.name || 'Cliente',
                amount: inv.amount,
                description: `${inv.clients?.name} - ${inv.competence}`,
                confidence,
                reason
              });
            }
          }
        }
      } else {
        // Para débitos, buscar despesas e contas a pagar
        const [expensesResult, apResult] = await Promise.all([
          supabase
            .from('expenses')
            .select('*')
            .eq('status', 'pending')
            .order('due_date', { ascending: true })
            .limit(100),
          supabase
            .from('accounts_payable')
            .select('*')
            .eq('status', 'pending')
            .order('due_date', { ascending: true })
            .limit(100)
        ]);

        const expenses = expensesResult.data || [];
        const accountsPayable = apResult.data || [];

        // Match por valor exato - Despesas
        for (const exp of expenses) {
          if (Math.abs(exp.amount - transaction.amount) < 0.01) {
            suggestions.push({
              type: 'expense',
              id: exp.id,
              amount: exp.amount,
              description: `${exp.description} - ${exp.category}`,
              confidence: 0.95,
              reason: 'Valor exato correspondente'
            });
          }
        }

        // Match por valor exato - Contas a Pagar
        for (const ap of accountsPayable) {
          if (Math.abs(ap.amount - transaction.amount) < 0.01) {
            suggestions.push({
              type: 'accounts_payable',
              id: ap.id,
              amount: ap.amount,
              description: `${ap.supplier_name} - ${ap.description}`,
              confidence: 0.95,
              reason: 'Valor exato correspondente'
            });
          }
        }

        // Match por texto
        const txDesc = transaction.description.toLowerCase();

        for (const exp of expenses) {
          if (suggestions.some(s => s.id === exp.id)) continue;

          const expDesc = (exp.description || '').toLowerCase();
          const supplier = (exp.supplier_name || '').toLowerCase();

          if (expDesc && txDesc.includes(expDesc.slice(0, 10))) {
            suggestions.push({
              type: 'expense',
              id: exp.id,
              amount: exp.amount,
              description: `${exp.description} - ${exp.category}`,
              confidence: 0.7,
              reason: 'Descrição similar'
            });
          } else if (supplier && txDesc.includes(supplier.split(' ')[0])) {
            suggestions.push({
              type: 'expense',
              id: exp.id,
              amount: exp.amount,
              description: `${exp.description} - ${exp.category}`,
              confidence: 0.65,
              reason: 'Fornecedor encontrado na descrição'
            });
          }
        }

        for (const ap of accountsPayable) {
          if (suggestions.some(s => s.id === ap.id)) continue;

          const supplier = (ap.supplier_name || '').toLowerCase();
          const apDesc = (ap.description || '').toLowerCase();

          if (supplier && txDesc.includes(supplier.split(' ')[0])) {
            suggestions.push({
              type: 'accounts_payable',
              id: ap.id,
              amount: ap.amount,
              description: `${ap.supplier_name} - ${ap.description}`,
              confidence: 0.7,
              reason: 'Fornecedor encontrado na descrição'
            });
          } else if (apDesc && txDesc.includes(apDesc.slice(0, 10))) {
            suggestions.push({
              type: 'accounts_payable',
              id: ap.id,
              amount: ap.amount,
              description: `${ap.supplier_name} - ${ap.description}`,
              confidence: 0.65,
              reason: 'Descrição similar'
            });
          }
        }
      }

      // Ordenar por confiança
      suggestions.sort((a, b) => b.confidence - a.confidence);

      // Usar IA para refinar sugestões se houver muitas opções
      if (suggestions.length > 10 && LOVABLE_API_KEY) {
        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                {
                  role: 'system',
                  content: `Você é um especialista em conciliação bancária. Analise a transação e as sugestões, e retorne os IDs das 5 melhores correspondências em ordem de relevância. Retorne APENAS um array JSON de IDs, exemplo: ["id1", "id2", "id3"]`
                },
                {
                  role: 'user',
                  content: `Transação: ${transaction.description} - R$ ${transaction.amount} - ${transaction.date}

Sugestões (top 15):
${suggestions.slice(0, 15).map((s, i) => `${i+1}. ID: ${s.id} | ${s.description} | R$ ${s.amount} | Confiança: ${s.confidence} | Motivo: ${s.reason}`).join('\n')}`
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            let content = aiData.choices[0].message.content;
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

            const topIds: string[] = JSON.parse(content);

            // Reordenar sugestões com base na IA
            const aiSorted = topIds
              .map(id => suggestions.find(s => s.id === id))
              .filter(Boolean) as MatchSuggestion[];

            // Adicionar o resto que a IA não selecionou
            const remaining = suggestions.filter(s => !topIds.includes(s.id));
            suggestions = [...aiSorted, ...remaining];
          }
        } catch (aiError) {
          console.error('Erro na IA:', aiError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          suggestions: suggestions.slice(0, 20),
          totalFound: suggestions.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'auto_reconcile_batch') {
      // Conciliar em lote transações com match de alta confiança
      const { data: pendingTx } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('matched', false)
        .order('transaction_date', { ascending: false })
        .limit(100);

      let reconciled = 0;
      const results = [];

      for (const tx of pendingTx || []) {
        // Buscar sugestões
        const isCredit = tx.transaction_type === 'credit';

        if (isCredit) {
          // Match exato com honorário
          const { data: invoice } = await supabase
            .from('invoices')
            .select('*, clients(name)')
            .eq('status', 'pending')
            .gte('amount', tx.amount - 0.01)
            .lte('amount', tx.amount + 0.01)
            .limit(1)
            .single();

          if (invoice) {
            // Auto-conciliar
            await supabase
              .from('bank_transactions')
              .update({
                matched: true,
                matched_invoice_id: invoice.id,
                ai_confidence: 0.99,
                ai_suggestion: `Match automático: ${invoice.clients?.name}`
              })
              .eq('id', tx.id);

            await supabase
              .from('invoices')
              .update({ status: 'paid', payment_date: tx.transaction_date })
              .eq('id', invoice.id);

            // Lançamento contábil
            await supabase.functions.invoke('smart-accounting', {
              body: {
                action: 'create_entry',
                entry: {
                  type: 'invoice',
                  operation: 'payment',
                  referenceId: invoice.id,
                  referenceType: 'invoice',
                  amount: invoice.amount,
                  date: tx.transaction_date,
                  description: `Recebimento: ${invoice.clients?.name}`,
                  clientId: invoice.client_id
                }
              }
            });

            reconciled++;
            results.push({
              transactionId: tx.id,
              matchedWith: invoice.id,
              type: 'invoice',
              amount: invoice.amount
            });
          }
        } else {
          // Match com despesa ou conta a pagar
          const { data: expense } = await supabase
            .from('expenses')
            .select('*')
            .eq('status', 'pending')
            .gte('amount', tx.amount - 0.01)
            .lte('amount', tx.amount + 0.01)
            .limit(1)
            .single();

          if (expense) {
            await supabase
              .from('bank_transactions')
              .update({
                matched: true,
                matched_expense_id: expense.id,
                ai_confidence: 0.99,
                ai_suggestion: `Match automático: ${expense.description}`
              })
              .eq('id', tx.id);

            await supabase
              .from('expenses')
              .update({ status: 'paid', payment_date: tx.transaction_date })
              .eq('id', expense.id);

            // Lançamento contábil
            await supabase.functions.invoke('smart-accounting', {
              body: {
                action: 'create_entry',
                entry: {
                  type: 'expense',
                  operation: 'payment',
                  referenceId: expense.id,
                  referenceType: 'expense',
                  amount: expense.amount,
                  date: tx.transaction_date,
                  description: `Pagamento: ${expense.description}`
                }
              }
            });

            reconciled++;
            results.push({
              transactionId: tx.id,
              matchedWith: expense.id,
              type: 'expense',
              amount: expense.amount
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: pendingTx?.length || 0,
          reconciled,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Função para encontrar combinações de valores que somam um total
function findCombinations(
  items: any[],
  targetAmount: number,
  tolerance: number,
  maxItems: number
): { items: any[], total: number, confidence: number }[] {
  const results: { items: any[], total: number, confidence: number }[] = [];

  // Ordenar por valor decrescente para otimizar
  const sorted = [...items].sort((a, b) => b.amount - a.amount);

  // Busca recursiva com limite
  function search(
    index: number,
    current: any[],
    currentSum: number,
    depth: number
  ) {
    // Verificar se encontrou uma combinação válida
    if (Math.abs(currentSum - targetAmount) <= tolerance) {
      const confidence = 0.9 - (current.length - 1) * 0.1; // Menos itens = mais confiança
      results.push({
        items: [...current],
        total: currentSum,
        confidence: Math.max(0.5, confidence)
      });
      return;
    }

    // Limitar profundidade e resultados
    if (depth >= maxItems || results.length >= 5 || index >= sorted.length) {
      return;
    }

    // Poda: se já passou do valor, não continuar
    if (currentSum > targetAmount + tolerance) {
      return;
    }

    // Tentar adicionar próximo item
    for (let i = index; i < sorted.length && results.length < 5; i++) {
      const item = sorted[i];
      if (currentSum + item.amount <= targetAmount + tolerance) {
        current.push(item);
        search(i + 1, current, currentSum + item.amount, depth + 1);
        current.pop();
      }
    }
  }

  search(0, [], 0, 0);

  return results.sort((a, b) => b.confidence - a.confidence);
}
