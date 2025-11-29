import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    console.log('Starting AI cash flow analysis...');

    // Buscar dados do fluxo de caixa
    const [bankBalanceRes, invoicesRes, payablesRes, expensesRes, transactionsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/bank_balance?is_active=eq.true&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': authHeader }
      }),
      fetch(`${supabaseUrl}/rest/v1/invoices?status=eq.pending&select=*,clients(name)`, {
        headers: { 'apikey': supabaseKey, 'Authorization': authHeader }
      }),
      fetch(`${supabaseUrl}/rest/v1/accounts_payable?status=in.(pending,approved)&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': authHeader }
      }),
      fetch(`${supabaseUrl}/rest/v1/expenses?status=eq.pending&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': authHeader }
      }),
      fetch(`${supabaseUrl}/rest/v1/cash_flow_transactions?select=*&order=transaction_date.asc`, {
        headers: { 'apikey': supabaseKey, 'Authorization': authHeader }
      })
    ]);

    const bankBalance = await bankBalanceRes.json();
    const invoices = await invoicesRes.json();
    const payables = await payablesRes.json();
    const expenses = await expensesRes.json();
    const transactions = await transactionsRes.json();

    console.log(`Dados coletados: ${bankBalance.length} contas, ${invoices.length} faturas, ${payables.length} contas a pagar`);

    // Calcular saldo atual e projeções
    const currentBalance = bankBalance.reduce((sum: number, acc: any) => sum + Number(acc.balance), 0);
    const totalReceivables = invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
    const totalPayables = [...payables, ...expenses].reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const projectedBalance = currentBalance + totalReceivables - totalPayables;

    // Preparar dados para IA
    const analysisData = {
      currentBalance,
      totalReceivables,
      totalPayables,
      projectedBalance,
      bankAccounts: bankBalance.length,
      pendingInvoices: invoices.length,
      pendingPayables: payables.length + expenses.length,
      upcomingPayments: [...payables, ...expenses].sort((a: any, b: any) => 
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      ).slice(0, 5),
      upcomingReceivables: invoices.sort((a: any, b: any) => 
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      ).slice(0, 5),
      willGoNegative: projectedBalance < 0,
      negativeDate: projectedBalance < 0 ? calculateNegativeDate(transactions, currentBalance) : null
    };

    // Chamar IA para análise
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
            content: `Você é um analista financeiro especializado em fluxo de caixa. Analise os dados e forneça:
1. RESUMO EXECUTIVO: Situação atual em 2-3 frases
2. ALERTAS CRÍTICOS: Problemas urgentes que precisam de ação imediata (se houver)
3. OPORTUNIDADES: Melhorias e otimizações possíveis
4. AÇÕES RECOMENDADAS: Lista de 3-5 ações específicas e práticas, priorizadas por urgência

Seja direto, objetivo e orientado a ação. Use números e datas específicas.`
          },
          {
            role: 'user',
            content: `Analise este fluxo de caixa:

SITUAÇÃO ATUAL:
- Saldo bancário: R$ ${currentBalance.toFixed(2)}
- A receber: R$ ${totalReceivables.toFixed(2)} (${invoices.length} faturas)
- A pagar: R$ ${totalPayables.toFixed(2)} (${payables.length + expenses.length} contas)
- Saldo projetado: R$ ${projectedBalance.toFixed(2)}
${analysisData.willGoNegative ? `⚠️ ALERTA: Saldo ficará NEGATIVO em ${analysisData.negativeDate}` : ''}

PRÓXIMOS PAGAMENTOS (5 mais urgentes):
${analysisData.upcomingPayments.map((p: any, i: number) => 
  `${i + 1}. ${p.supplier_name || p.description} - R$ ${Number(p.amount).toFixed(2)} - Venc: ${p.due_date}`
).join('\n')}

PRÓXIMOS RECEBIMENTOS (5 mais urgentes):
${analysisData.upcomingReceivables.map((r: any, i: number) => 
  `${i + 1}. ${r.clients?.name || 'Cliente'} - R$ ${Number(r.amount).toFixed(2)} - Venc: ${r.due_date}`
).join('\n')}

Forneça análise completa e ações específicas.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    console.log('AI analysis completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisData,
        analysis,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in AI cash flow analyst:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateNegativeDate(transactions: any[], currentBalance: number): string {
  let balance = currentBalance;
  const sortedTxs = [...transactions].sort((a, b) => 
    new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  for (const tx of sortedTxs) {
    if (tx.transaction_type === 'inflow') {
      balance += Number(tx.amount);
    } else {
      balance -= Number(tx.amount);
    }
    
    if (balance < 0) {
      return new Date(tx.transaction_date).toLocaleDateString('pt-BR');
    }
  }

  return 'Data indeterminada';
}
