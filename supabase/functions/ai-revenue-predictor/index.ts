import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { months = 3, clientId } = await req.json();

    console.log(
      `Prevendo receita para os próximos ${months} meses${
        clientId ? ` (cliente ${clientId})` : " (geral)"
      }`
    );

    // Buscar histórico de faturas dos últimos 12 meses
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    let query = supabase
      .from("invoices")
      .select(
        `
        *,
        clients (
          id,
          name,
          monthly_fee,
          status,
          is_pro_bono
        )
      `
      )
      .gte("due_date", twelveMonthsAgo.toISOString().split("T")[0])
      .order("due_date", { ascending: true });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: historicalInvoices } = await query;

    // Agrupar por mês
    const monthlyData: { [key: string]: { revenue: number; count: number; paid: number } } = {};
    historicalInvoices?.forEach((inv) => {
      const monthKey = inv.due_date.substring(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, count: 0, paid: 0 };
      }
      monthlyData[monthKey].revenue += inv.amount;
      monthlyData[monthKey].count++;
      if (inv.status === "paid") {
        monthlyData[monthKey].paid += inv.amount;
      }
    });

    // Buscar clientes ativos para projeção
    let clientsQuery = supabase
      .from("clients")
      .select("id, name, monthly_fee, status, is_pro_bono")
      .eq("status", "active");

    if (clientId) {
      clientsQuery = clientsQuery.eq("id", clientId);
    }

    const { data: activeClients } = await clientsQuery;

    const totalMonthlyFees =
      activeClients?.reduce(
        (sum, c) => sum + (c.is_pro_bono ? 0 : c.monthly_fee),
        0
      ) || 0;

    const context = `
Previsão de Receita ${clientId ? "- Cliente Específico" : "- Visão Geral"}

HISTÓRICO DOS ÚLTIMOS 12 MESES:
${Object.entries(monthlyData)
  .map(
    ([month, data]) =>
      `${month}: R$ ${data.revenue.toFixed(2)} (${data.count} faturas, ${data.paid} pagas = R$ ${(
        (data.paid / data.revenue) *
        100
      ).toFixed(1)}%)`
  )
  .join("\n")}

SITUAÇÃO ATUAL:
- Clientes Ativos: ${activeClients?.length || 0}
- Honorários Mensais Totais: R$ ${totalMonthlyFees.toFixed(2)}
- Clientes Pro Bono: ${activeClients?.filter((c) => c.is_pro_bono).length || 0}

ANÁLISE SOLICITADA:
Preveja a receita para os próximos ${months} meses considerando:
1. Tendência histórica de crescimento/queda
2. Sazonalidade identificada
3. Taxa de conversão (faturas emitidas vs. pagas)
4. Novos clientes ou cancelamentos prováveis
5. Impacto de clientes em risco
6. Eventos externos (economia, legislação, etc.)
`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você é um analista financeiro especializado em previsão de receita, com conhecimento profundo de análise de séries temporais e modelagem preditiva.",
            },
            { role: "user", content: context },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "predict_revenue",
                description: "Prevê receita futura",
                parameters: {
                  type: "object",
                  properties: {
                    predictions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          month: { type: "string", description: "Mês (YYYY-MM)" },
                          predicted_revenue: {
                            type: "number",
                            description: "Receita prevista",
                          },
                          confidence: {
                            type: "number",
                            minimum: 0,
                            maximum: 100,
                            description: "Confiança da previsão (%)",
                          },
                          min_revenue: {
                            type: "number",
                            description: "Receita mínima esperada",
                          },
                          max_revenue: {
                            type: "number",
                            description: "Receita máxima esperada",
                          },
                        },
                      },
                      description: "Previsões mensais",
                    },
                    trend: {
                      type: "string",
                      enum: ["growing", "stable", "declining"],
                      description: "Tendência identificada",
                    },
                    growth_rate: {
                      type: "number",
                      description: "Taxa de crescimento mensal (%)",
                    },
                    seasonality: {
                      type: "object",
                      properties: {
                        detected: { type: "boolean" },
                        pattern: { type: "string" },
                      },
                      description: "Padrões sazonais identificados",
                    },
                    risk_factors: {
                      type: "array",
                      items: { type: "string" },
                      description: "Fatores de risco identificados",
                    },
                    opportunities: {
                      type: "array",
                      items: { type: "string" },
                      description: "Oportunidades de crescimento",
                    },
                    recommendations: {
                      type: "array",
                      items: { type: "string" },
                      description: "Recomendações estratégicas",
                    },
                    insights: {
                      type: "string",
                      description: "Análise detalhada",
                    },
                  },
                  required: [
                    "predictions",
                    "trend",
                    "growth_rate",
                    "seasonality",
                    "risk_factors",
                    "opportunities",
                    "recommendations",
                    "insights",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "predict_revenue" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const prediction = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!prediction) {
      throw new Error("IA não retornou previsão estruturada");
    }

    return new Response(
      JSON.stringify({
        success: true,
        historical_data: monthlyData,
        current_metrics: {
          active_clients: activeClients?.length || 0,
          monthly_recurring: totalMonthlyFees,
        },
        prediction,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-revenue-predictor:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
