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

    const { clientId, invoiceId, emailType, tone } = await req.json();

    if (!clientId || !invoiceId || !emailType) {
      throw new Error("clientId, invoiceId e emailType são obrigatórios");
    }

    console.log(
      `Gerando email tipo ${emailType} para cliente ${clientId}, fatura ${invoiceId}`
    );

    // Buscar dados do cliente
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    // Buscar fatura
    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    // Buscar histórico de pagamentos
    const { data: paymentHistory } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "paid")
      .order("payment_date", { ascending: false })
      .limit(5);

    // Calcular dias de atraso
    const today = new Date();
    const dueDate = new Date(invoice?.due_date || "");
    const daysOverdue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isOverdue = daysOverdue > 0;
    
    // Calcular taxa de pagamento
    const { count: pendingCount } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "pending");

    const totalCount = (paymentHistory?.length || 0) + (pendingCount || 0);
    const paymentRate =
      totalCount > 0
        ? ((paymentHistory?.length || 0) / totalCount) * 100
        : 50;

    // Definir tom baseado no tipo de email e histórico
    let suggestedTone = tone;
    if (!suggestedTone) {
      if (emailType === "reminder" && daysOverdue < 5) {
        suggestedTone = "cordial";
      } else if (emailType === "overdue" && daysOverdue < 30) {
        suggestedTone = "firm";
      } else if (emailType === "final_notice" || daysOverdue >= 30) {
        suggestedTone = "urgent";
      } else {
        suggestedTone = "cordial";
      }
    }

    const context = `
Composição de Email de Cobrança

TIPO DE EMAIL: ${emailType}
TOM SOLICITADO: ${suggestedTone}

DADOS DO CLIENTE:
- Nome: ${client?.name}
- Email: ${client?.email}
- Histórico: ${paymentHistory?.length || 0} pagamentos realizados
- Taxa de Pagamento: ${paymentRate.toFixed(1)}%

DADOS DA FATURA:
- Número: #${invoice?.id?.substring(0, 8)}
- Valor: R$ ${invoice?.amount?.toFixed(2)}
- Vencimento: ${
      invoice?.due_date
        ? new Date(invoice.due_date).toLocaleDateString("pt-BR")
        : "N/A"
    }
- Status: ${isOverdue ? `VENCIDA há ${daysOverdue} dias` : "A vencer"}
- Descrição: ${invoice?.description || "Serviços de contabilidade"}

CONTEXTO:
${
      emailType === "reminder"
        ? "Enviar lembrete amigável antes do vencimento"
        : ""
    }
${
      emailType === "overdue"
        ? `Fatura vencida há ${daysOverdue} dias. Cliente tem bom histórico (${paymentRate.toFixed(1)}% de pagamentos em dia)`
        : ""
    }
${
      emailType === "final_notice"
        ? `Último aviso antes de medidas legais. ${daysOverdue} dias de atraso`
        : ""
    }
${
      emailType === "thank_you"
        ? "Agradecer pagamento recebido e reforçar relacionamento"
        : ""
    }

INSTRUÇÕES:
Componha um email profissional de cobrança seguindo estas diretrizes:
- Use o tom ${suggestedTone} (cordial = amigável, firm = profissional e direto, urgent = formal e incisivo)
- Seja claro sobre o valor e vencimento
- ${
      isOverdue
        ? "Mencione os dias de atraso e solicite regularização urgente"
        : "Agradeça a atenção e reforce disponibilidade"
    }
- Inclua formas de pagamento e contato
- ${
      paymentRate > 80
        ? "Reconheça o bom histórico do cliente"
        : "Enfatize a importância da pontualidade"
    }
- Mantenha tom profissional mas humano
- NÃO use emojis
- Assine como "Equipe Financeira" ou nome apropriado
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
                "Você é um especialista em comunicação empresarial e cobrança, com expertise em manter relacionamentos positivos mesmo em situações delicadas. Componha emails profissionais, persuasivos e respeitosos.",
            },
            { role: "user", content: context },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "compose_email",
                description: "Compõe email de cobrança estruturado",
                parameters: {
                  type: "object",
                  properties: {
                    subject: {
                      type: "string",
                      description: "Assunto do email (máximo 70 caracteres)",
                    },
                    body: {
                      type: "string",
                      description: "Corpo do email em HTML ou texto simples",
                    },
                    tone_used: {
                      type: "string",
                      enum: ["cordial", "firm", "urgent"],
                      description: "Tom efetivamente usado",
                    },
                    call_to_action: {
                      type: "string",
                      description: "Principal call-to-action do email",
                    },
                    urgency_level: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                      description: "Nível de urgência transmitido",
                    },
                  },
                  required: [
                    "subject",
                    "body",
                    "tone_used",
                    "call_to_action",
                    "urgency_level",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "compose_email" },
          },
          temperature: 0.7,
        }),
      }
    );

    if (!aiResponse.ok) {
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const emailData = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!emailData) {
      throw new Error("IA não retornou dados do email estruturados");
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: {
          id: client?.id,
          name: client?.name,
          email: client?.email,
        },
        invoice: {
          id: invoice?.id,
          amount: invoice?.amount,
          due_date: invoice?.due_date,
          days_overdue: daysOverdue,
        },
        email: emailData,
        metadata: {
          type: emailType,
          requested_tone: tone,
          payment_rate: paymentRate,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-email-composer:", error);
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
