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

    const { clientId, invoiceId } = await req.json();

    if (!clientId || !invoiceId) {
      throw new Error("clientId e invoiceId são obrigatórios");
    }

    console.log(`Analisando estratégia de cobrança para cliente ${clientId}, fatura ${invoiceId}`);

    // Buscar dados do cliente
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    // Buscar histórico de faturas
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientId)
      .order("due_date", { ascending: false });

    // Buscar fatura específica
    const { data: currentInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    // Buscar ordens de serviço anteriores
    const { data: workOrders } = await supabase
      .from("collection_work_orders")
      .select("*, collection_work_order_logs(*)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calcular métricas
    const totalInvoices = invoices?.length || 0;
    const paidInvoices = invoices?.filter((i) => i.status === "paid").length || 0;
    const overdueInvoices = invoices?.filter((i) => i.status === "pending").length || 0;
    const paymentRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;

    const today = new Date();
    const dueDate = new Date(currentInvoice?.due_date || "");
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Preparar contexto para a IA
    const context = `
Análise de Cobrança - Cliente: ${client?.name}

DADOS DO CLIENTE:
- Razão Social: ${client?.razao_social || "N/A"}
- CNPJ: ${client?.cnpj || "N/A"}
- Email: ${client?.email || "N/A"}
- Telefone: ${client?.phone || "N/A"}
- Honorário Mensal: R$ ${client?.monthly_fee?.toFixed(2) || "0.00"}

HISTÓRICO DE PAGAMENTOS:
- Total de Faturas: ${totalInvoices}
- Faturas Pagas: ${paidInvoices}
- Faturas em Atraso: ${overdueInvoices}
- Taxa de Pagamento: ${paymentRate.toFixed(1)}%

FATURA ATUAL:
- Valor: R$ ${currentInvoice?.amount?.toFixed(2) || "0.00"}
- Vencimento: ${currentInvoice?.due_date || "N/A"}
- Dias de Atraso: ${daysOverdue > 0 ? daysOverdue : 0}
- Status: ${currentInvoice?.status || "N/A"}

HISTÓRICO DE COBRANÇA:
${
      workOrders
        ?.slice(0, 3)
        .map(
          (wo: any) =>
            `- ${wo.action_type} (${wo.status}): ${wo.description || "Sem descrição"}`
        )
        .join("\n") || "Sem histórico anterior"
    }

TAREFA: Analise o histórico e o contexto atual para recomendar:
1. Melhor canal de contato (telefone, email, WhatsApp)
2. Melhor horário para contato (manhã, tarde, noite)
3. Tom da mensagem (cordial, firme, urgente)
4. Probabilidade de pagamento (0-100%)
5. Estratégia de negociação específica
6. Próximos passos recomendados
`;

    // Chamar Lovable AI com tool calling para resposta estruturada
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
              "Você é um especialista em cobrança e análise de crédito. Analise o contexto fornecido e retorne recomendações estruturadas.",
          },
          { role: "user", content: context },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_collection_strategy",
              description: "Retorna recomendações estruturadas de cobrança",
              parameters: {
                type: "object",
                properties: {
                  best_channel: {
                    type: "string",
                    enum: ["phone", "email", "whatsapp", "in_person"],
                    description: "Melhor canal de contato",
                  },
                  best_time: {
                    type: "string",
                    enum: ["morning", "afternoon", "evening"],
                    description: "Melhor horário para contato",
                  },
                  message_tone: {
                    type: "string",
                    enum: ["cordial", "firm", "urgent"],
                    description: "Tom da mensagem",
                  },
                  payment_probability: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    description: "Probabilidade de pagamento (0-100)",
                  },
                  negotiation_strategy: {
                    type: "string",
                    description: "Estratégia de negociação específica",
                  },
                  recommended_actions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de próximos passos recomendados",
                  },
                  reasoning: {
                    type: "string",
                    description: "Justificativa da análise",
                  },
                },
                required: [
                  "best_channel",
                  "best_time",
                  "message_tone",
                  "payment_probability",
                  "negotiation_strategy",
                  "recommended_actions",
                  "reasoning",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "recommend_collection_strategy" },
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", errorText);
      throw new Error(`Lovable AI retornou erro: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI Response:", JSON.stringify(aiData, null, 2));

    // Extrair argumentos do tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const recommendations = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!recommendations) {
      throw new Error("IA não retornou recomendações estruturadas");
    }

    console.log("Recomendações extraídas:", recommendations);

    return new Response(
      JSON.stringify({
        success: true,
        client: {
          id: client?.id,
          name: client?.name,
          email: client?.email,
          phone: client?.phone,
        },
        invoice: {
          id: currentInvoice?.id,
          amount: currentInvoice?.amount,
          due_date: currentInvoice?.due_date,
          days_overdue: daysOverdue,
        },
        metrics: {
          total_invoices: totalInvoices,
          paid_invoices: paidInvoices,
          overdue_invoices: overdueInvoices,
          payment_rate: paymentRate,
        },
        recommendations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-collection-agent:", error);
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
