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

    console.log("Iniciando segmentação de clientes");

    // Buscar todos os clientes ativos com suas faturas
    const { data: clients } = await supabase
      .from("clients")
      .select(
        `
        *,
        invoices (
          id,
          amount,
          status,
          due_date,
          payment_date
        )
      `
      )
      .eq("status", "active");

    if (!clients || clients.length === 0) {
      throw new Error("Nenhum cliente ativo encontrado");
    }

    // Preparar dados agregados de cada cliente
    const clientsData = clients.map((client: any) => {
      const invoices = client.invoices || [];
      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter((i: any) => i.status === "paid").length;
      const pendingInvoices = invoices.filter((i: any) => i.status === "pending").length;
      const totalRevenue = invoices
        .filter((i: any) => i.status === "paid")
        .reduce((sum: number, i: any) => sum + i.amount, 0);

      // Calcular atraso médio
      const delays = invoices
        .filter((i: any) => i.status === "paid" && i.payment_date && i.due_date)
        .map((i: any) => {
          const due = new Date(i.due_date).getTime();
          const paid = new Date(i.payment_date).getTime();
          return Math.max(0, Math.floor((paid - due) / (1000 * 60 * 60 * 24)));
        });

      const avgDelay = delays.length > 0 ? delays.reduce((a: number, b: number) => a + b, 0) / delays.length : 0;

      // Tempo como cliente (em meses)
      const clientSince = new Date(client.created_at);
      const monthsAsClient = Math.floor(
        (Date.now() - clientSince.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      return {
        id: client.id,
        name: client.name,
        monthly_fee: client.monthly_fee,
        is_pro_bono: client.is_pro_bono,
        total_invoices: totalInvoices,
        paid_invoices: paidInvoices,
        pending_invoices: pendingInvoices,
        payment_rate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
        total_revenue: totalRevenue,
        avg_delay: avgDelay,
        months_as_client: monthsAsClient,
        porte: client.porte,
        capital_social: client.capital_social,
      };
    });

    const context = `
Segmentação de Clientes para Estratégia Comercial

TOTAL DE CLIENTES ATIVOS: ${clients.length}

RESUMO ESTATÍSTICO:
- Receita Total: R$ ${clientsData
      .reduce((s, c) => s + c.total_revenue, 0)
      .toFixed(2)}
- Honorário Mensal Médio: R$ ${(
      clientsData.reduce((s, c) => s + c.monthly_fee, 0) / clients.length
    ).toFixed(2)}
- Taxa Média de Pagamento: ${(
      clientsData.reduce((s, c) => s + c.payment_rate, 0) / clients.length
    ).toFixed(1)}%
- Atraso Médio: ${(
      clientsData.reduce((s, c) => s + c.avg_delay, 0) / clients.length
    ).toFixed(0)} dias

AMOSTRA DE CLIENTES (top 10 por receita):
${clientsData
  .sort((a, b) => b.total_revenue - a.total_revenue)
  .slice(0, 10)
  .map(
    (c) =>
      `- ${c.name}: R$ ${c.total_revenue.toFixed(2)}, ${c.payment_rate.toFixed(1)}% pagamentos, ${c.avg_delay.toFixed(0)} dias atraso, ${c.months_as_client} meses como cliente`
  )
  .join("\n")}

ANÁLISE SOLICITADA:
Segmente os clientes em grupos estratégicos baseados em:
1. Valor (alto valor, médio valor, baixo valor)
2. Comportamento de pagamento (pontual, atrasa ocasionalmente, inadimplente)
3. Potencial de crescimento (expansão, estável, risco de churn)
4. Relacionamento (novo, estabelecido, veterano)
5. Perfil de risco (baixo, médio, alto)

Para cada segmento, forneça:
- Características do grupo
- Tamanho do segmento
- Receita total e % da receita
- Estratégias específicas de relacionamento
- Ações recomendadas
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
                "Você é um especialista em segmentação de clientes e marketing B2B, com experiência em análise RFM (Recency, Frequency, Monetary) e previsão de churn.",
            },
            { role: "user", content: context },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "segment_clients",
                description: "Segmenta clientes por comportamento e valor",
                parameters: {
                  type: "object",
                  properties: {
                    segments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          segment_name: { type: "string" },
                          description: { type: "string" },
                          client_count: { type: "number" },
                          total_revenue: { type: "number" },
                          revenue_percentage: { type: "number" },
                          characteristics: {
                            type: "array",
                            items: { type: "string" },
                          },
                          relationship_strategy: { type: "string" },
                          recommended_actions: {
                            type: "array",
                            items: { type: "string" },
                          },
                          churn_risk: {
                            type: "string",
                            enum: ["low", "medium", "high"],
                          },
                        },
                      },
                      description: "Lista de segmentos identificados",
                    },
                    high_value_clients: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          client_name: { type: "string" },
                          revenue: { type: "number" },
                          retention_priority: { type: "string" },
                        },
                      },
                      description: "Clientes de alto valor que requerem atenção especial",
                    },
                    churn_alerts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          client_name: { type: "string" },
                          churn_probability: { type: "number" },
                          warning_signs: { type: "array", items: { type: "string" } },
                          retention_actions: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                      },
                      description: "Alertas de clientes em risco de churn",
                    },
                    growth_opportunities: {
                      type: "array",
                      items: { type: "string" },
                      description: "Oportunidades de crescimento identificadas",
                    },
                    insights: {
                      type: "string",
                      description: "Insights estratégicos gerais",
                    },
                  },
                  required: [
                    "segments",
                    "high_value_clients",
                    "churn_alerts",
                    "growth_opportunities",
                    "insights",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "segment_clients" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const segmentation = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!segmentation) {
      throw new Error("IA não retornou segmentação estruturada");
    }

    const totalMonthlyFees = clientsData.reduce((s, c) => s + (c.is_pro_bono ? 0 : c.monthly_fee), 0);

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          total_clients: clients.length,
          total_revenue: clientsData.reduce((s, c) => s + c.total_revenue, 0),
          avg_monthly_fee: totalMonthlyFees / clients.length,
        },
        segmentation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-client-segmenter:", error);
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
