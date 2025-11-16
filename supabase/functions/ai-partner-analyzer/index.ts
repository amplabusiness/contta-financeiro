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

    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error("clientId é obrigatório");
    }

    console.log(`Analisando grupos econômicos para cliente ${clientId}`);

    // Buscar cliente e seus sócios
    const { data: client } = await supabase
      .from("clients")
      .select("*, client_partners(*)")
      .eq("id", clientId)
      .single();

    // Buscar grupos econômicos usando a função do banco
    const { data: economicGroups } = await supabase.rpc("get_economic_group_impact");

    // Buscar todos os clientes para análise de relacionamento
    const { data: allClients } = await supabase
      .from("clients")
      .select("id, name, cnpj, monthly_fee, status, client_partners(*)");

    // Buscar faturas do cliente para análise de receita
    const { data: clientInvoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "paid");

    const totalRevenue = clientInvoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

    // Calcular métricas gerais
    const totalClientsRevenue =
      allClients?.reduce((sum, c) => sum + (c.monthly_fee || 0) * 12, 0) || 0;
    const clientRevenuePercentage = (totalRevenue / totalClientsRevenue) * 100;

    // Identificar grupos onde o cliente participa
    const clientGroups = economicGroups?.filter((group: any) =>
      group.company_ids?.includes(clientId)
    );

    const context = `
Análise de Grupos Econômicos - Cliente: ${client?.name}

DADOS DO CLIENTE:
- Razão Social: ${client?.razao_social || "N/A"}
- CNPJ: ${client?.cnpj || "N/A"}
- Honorário Mensal: R$ ${client?.monthly_fee?.toFixed(2) || "0.00"}
- Receita Total Anual: R$ ${totalRevenue.toFixed(2)}
- % da Receita Total: ${clientRevenuePercentage.toFixed(2)}%

SÓCIOS DO CLIENTE:
${
      client?.client_partners
        ?.map(
          (p: any) =>
            `- ${p.name} (${p.partner_type || "N/A"}) ${p.cpf ? `CPF: ${p.cpf}` : ""}`
        )
        .join("\n") || "Sem sócios cadastrados"
    }

GRUPOS ECONÔMICOS IDENTIFICADOS:
${
      clientGroups
        ?.map(
          (g: any) =>
            `
- Grupo: ${g.partner_names?.join(", ") || "N/A"}
- Empresas: ${g.company_count}
- Nomes: ${g.company_names?.join(", ") || "N/A"}
- Receita Total: R$ ${g.total_revenue?.toFixed(2) || "0.00"}
- % Receita: ${g.percentage_of_total?.toFixed(2) || "0"}%
- Nível de Risco: ${g.risk_level || "N/A"}
`
        )
        .join("\n") || "Sem grupos identificados"
    }

ANÁLISE SOLICITADA:
1. Identificar relacionamentos entre empresas
2. Calcular concentração de risco
3. Avaliar impacto financeiro de perda do grupo
4. Identificar oportunidades de cross-selling
5. Sugerir estratégias de retenção
6. Alertar sobre dependência excessiva
`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              "Você é um especialista em análise de grupos econômicos e gestão de risco de concentração. Analise os dados e forneça insights estratégicos.",
          },
          { role: "user", content: context },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_economic_groups",
              description: "Analisa grupos econômicos e riscos de concentração",
              parameters: {
                type: "object",
                properties: {
                  risk_level: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                    description: "Nível de risco geral",
                  },
                  concentration_risk: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    description: "Score de risco de concentração (0-100)",
                  },
                  related_companies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        relationship: { type: "string" },
                      },
                    },
                    description: "Empresas relacionadas identificadas",
                  },
                  financial_impact: {
                    type: "object",
                    properties: {
                      potential_loss: { type: "number" },
                      percentage_of_total: { type: "number" },
                    },
                    description: "Impacto financeiro de perda do grupo",
                  },
                  cross_sell_opportunities: {
                    type: "array",
                    items: { type: "string" },
                    description: "Oportunidades de vendas cruzadas",
                  },
                  retention_strategies: {
                    type: "array",
                    items: { type: "string" },
                    description: "Estratégias de retenção recomendadas",
                  },
                  alerts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Alertas importantes",
                  },
                  insights: {
                    type: "string",
                    description: "Análise detalhada e insights estratégicos",
                  },
                },
                required: [
                  "risk_level",
                  "concentration_risk",
                  "related_companies",
                  "financial_impact",
                  "cross_sell_opportunities",
                  "retention_strategies",
                  "alerts",
                  "insights",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "analyze_economic_groups" },
        },
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!analysis) {
      throw new Error("IA não retornou análise estruturada");
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: {
          id: client?.id,
          name: client?.name,
          cnpj: client?.cnpj,
        },
        groups: clientGroups,
        metrics: {
          total_revenue: totalRevenue,
          revenue_percentage: clientRevenuePercentage,
          partners_count: client?.client_partners?.length || 0,
        },
        analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-partner-analyzer:", error);
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
