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

    const { invoiceIds } = await req.json();

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      throw new Error("invoiceIds array é obrigatório");
    }

    console.log(`Classificando risco de ${invoiceIds.length} faturas`);

    const results = [];

    for (const invoiceId of invoiceIds.slice(0, 50)) {
      // Limit to 50 per request
      try {
        // Buscar fatura e dados do cliente
        const { data: invoice } = await supabase
          .from("invoices")
          .select(
            `
          *,
          clients (
            *,
            client_enrichment (*)
          )
        `
          )
          .eq("id", invoiceId)
          .single();

        if (!invoice) {
          results.push({
            invoice_id: invoiceId,
            error: "Fatura não encontrada",
          });
          continue;
        }

        const client = invoice.clients as any;

        // Buscar histórico de pagamentos do cliente
        const { data: paymentHistory } = await supabase
          .from("invoices")
          .select("status, payment_date, due_date, amount")
          .eq("client_id", invoice.client_id)
          .neq("id", invoiceId)
          .order("due_date", { ascending: false })
          .limit(12);

        // Calcular métricas de pagamento
        const totalInvoices = paymentHistory?.length || 0;
        const paidInvoices =
          paymentHistory?.filter((i) => i.status === "paid").length || 0;
        const paymentRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 50;

        // Calcular atrasos médios
        const delays = paymentHistory
          ?.filter((i) => i.status === "paid" && i.payment_date && i.due_date)
          .map((i) => {
            const due = new Date(i.due_date!).getTime();
            const paid = new Date(i.payment_date!).getTime();
            return Math.max(0, Math.floor((paid - due) / (1000 * 60 * 60 * 24)));
          });

        const avgDelay = delays && delays.length > 0
          ? delays.reduce((a, b) => a + b, 0) / delays.length
          : 0;

        // Dias até vencimento da fatura atual
        const today = new Date();
        const dueDate = new Date(invoice.due_date);
        const daysUntilDue = Math.floor(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const context = `
Classificação de Risco de Inadimplência

FATURA:
- Valor: R$ ${invoice.amount?.toFixed(2)}
- Vencimento: ${new Date(invoice.due_date).toLocaleDateString("pt-BR")}
- Dias até vencimento: ${daysUntilDue}
- Status: ${invoice.status}

CLIENTE:
- Nome: ${client?.name}
- CNPJ: ${client?.cnpj || "N/A"}
- Porte: ${client?.porte || "N/A"}
- Natureza Jurídica: ${client?.natureza_juridica || "N/A"}
- Capital Social: R$ ${client?.capital_social?.toFixed(2) || "0.00"}
- Situação Cadastral: ${client?.situacao_cadastral || "N/A"}

HISTÓRICO DE PAGAMENTOS (últimas 12 faturas):
- Total de faturas: ${totalInvoices}
- Faturas pagas: ${paidInvoices}
- Taxa de pagamento: ${paymentRate.toFixed(1)}%
- Atraso médio: ${avgDelay.toFixed(0)} dias
- Última fatura paga: ${
          paymentHistory?.[0]?.status === "paid"
            ? new Date(paymentHistory[0].payment_date!).toLocaleDateString("pt-BR")
            : "Nunca"
        }

ANÁLISE SOLICITADA:
Classifique o risco de inadimplência desta fatura considerando:
1. Histórico de pagamentos
2. Situação cadastral da empresa
3. Valor da fatura vs. capacidade financeira (capital social)
4. Padrão de atrasos
5. Dias até o vencimento
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
                    "Você é um especialista em análise de crédito e previsão de inadimplência. Analise os dados fornecidos e classifique o risco com base em evidências concretas.",
                },
                { role: "user", content: context },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "classify_default_risk",
                    description: "Classifica risco de inadimplência de fatura",
                    parameters: {
                      type: "object",
                      properties: {
                        risk_score: {
                          type: "number",
                          minimum: 0,
                          maximum: 100,
                          description: "Score de risco (0=baixo, 100=alto)",
                        },
                        risk_level: {
                          type: "string",
                          enum: ["low", "medium", "high", "critical"],
                          description: "Classificação do risco",
                        },
                        probability_of_default: {
                          type: "number",
                          minimum: 0,
                          maximum: 100,
                          description: "Probabilidade de inadimplência (%)",
                        },
                        predicted_payment_date: {
                          type: "string",
                          description: "Data prevista de pagamento (YYYY-MM-DD)",
                        },
                        risk_factors: {
                          type: "array",
                          items: { type: "string" },
                          description: "Principais fatores de risco identificados",
                        },
                        positive_factors: {
                          type: "array",
                          items: { type: "string" },
                          description: "Fatores positivos identificados",
                        },
                        recommended_actions: {
                          type: "array",
                          items: { type: "string" },
                          description: "Ações recomendadas",
                        },
                        reasoning: {
                          type: "string",
                          description: "Justificativa da classificação",
                        },
                      },
                      required: [
                        "risk_score",
                        "risk_level",
                        "probability_of_default",
                        "predicted_payment_date",
                        "risk_factors",
                        "positive_factors",
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
                function: { name: "classify_default_risk" },
              },
            }),
          }
        );

        if (!aiResponse.ok) {
          throw new Error(`Lovable AI error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        const classification = toolCall?.function?.arguments
          ? JSON.parse(toolCall.function.arguments)
          : null;

        if (!classification) {
          results.push({
            invoice_id: invoiceId,
            error: "IA não retornou classificação",
          });
          continue;
        }

        results.push({
          invoice_id: invoiceId,
          invoice: {
            amount: invoice.amount,
            due_date: invoice.due_date,
            days_until_due: daysUntilDue,
          },
          client: {
            id: client?.id,
            name: client?.name,
            payment_rate: paymentRate,
            avg_delay: avgDelay,
          },
          classification,
        });
      } catch (error) {
        console.error(`Error classifying invoice ${invoiceId}:`, error);
        results.push({
          invoice_id: invoiceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        classified: results.filter((r) => !r.error).length,
        errors: results.filter((r) => r.error).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-invoice-classifier:", error);
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
