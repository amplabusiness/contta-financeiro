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

    console.log('📊 AI Financial Analyst started');

    // Buscar dados financeiros dos últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .gte('due_date', sixMonthsAgo.toISOString());

    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', sixMonthsAgo.toISOString());

    const { data: transactions } = await supabase
      .from('bank_transactions')
      .select('*')
      .gte('date', sixMonthsAgo.toISOString());

    // Calcular métricas
    const totalRevenue = invoices?.reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, exp) => sum + parseFloat(exp.amount), 0) || 0;
    const paidInvoices = invoices?.filter(inv => inv.status === 'paid').length || 0;
    const pendingInvoices = invoices?.filter(inv => inv.status === 'pending').length || 0;
    const overdueInvoices = invoices?.filter(inv => 
      inv.status === 'pending' && new Date(inv.due_date) < new Date()
    ).length || 0;

    const prompt = `Você é um analista financeiro expert. Analise os dados abaixo e forneça insights acionáveis e previsões.

DADOS FINANCEIROS (Últimos 6 meses):
- Receita Total: R$ ${totalRevenue.toFixed(2)}
- Despesas Totais: R$ ${totalExpenses.toFixed(2)}
- Lucro: R$ ${(totalRevenue - totalExpenses).toFixed(2)}
- Margem: ${((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1)}%
- Boletos Pagos: ${paidInvoices}
- Boletos Pendentes: ${pendingInvoices}
- Boletos Vencidos: ${overdueInvoices}
- Taxa de Pagamento: ${(paidInvoices / (paidInvoices + pendingInvoices) * 100).toFixed(1)}%
- Transações Bancárias: ${transactions?.length || 0}

Por mês (receitas):
${getMonthlyBreakdown(invoices)}

Por mês (despesas):
${getMonthlyBreakdown(expenses)}

Forneça sua análise em JSON com:
{
  "health_score": 0-100,
  "trend": "improving" | "stable" | "declining",
  "key_insights": ["insight1", "insight2", "insight3"],
  "predictions_next_month": {
    "revenue": número estimado,
    "expenses": número estimado,
    "profit": número estimado
  },
  "recommendations": ["recomendação1", "recomendação2", "recomendação3"],
  "alerts": ["alerta1", "alerta2"] se houver problemas críticos
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
          { role: 'system', content: 'Você é um CFO virtual expert em análise financeira e previsões. Sempre responda com JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
      }),
    });

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    console.log('📈 AI Analysis:', analysis);

    // Salvar análise no banco
    const { error: insertError } = await supabase
      .from('financial_analysis')
      .insert({
        analysis_date: new Date().toISOString(),
        health_score: analysis.health_score,
        trend: analysis.trend,
        insights: analysis.key_insights,
        predictions: analysis.predictions_next_month,
        recommendations: analysis.recommendations,
        alerts: analysis.alerts || [],
        metrics: {
          total_revenue: totalRevenue,
          total_expenses: totalExpenses,
          profit: totalRevenue - totalExpenses,
          paid_invoices: paidInvoices,
          pending_invoices: pendingInvoices,
          overdue_invoices: overdueInvoices
        }
      });

    if (insertError) {
      console.error('Error saving analysis:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        metrics: {
          totalRevenue,
          totalExpenses,
          profit: totalRevenue - totalExpenses,
          paidInvoices,
          pendingInvoices,
          overdueInvoices
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in AI financial analyst:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getMonthlyBreakdown(items: any[] | null): string {
  if (!items || items.length === 0) return 'Sem dados';
  
  const monthlyData: { [key: string]: number } = {};
  
  items.forEach(item => {
    const date = new Date(item.due_date || item.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + parseFloat(item.amount);
  });
  
  return Object.entries(monthlyData)
    .sort()
    .map(([month, total]) => `  ${month}: R$ ${total.toFixed(2)}`)
    .join('\n');
}
