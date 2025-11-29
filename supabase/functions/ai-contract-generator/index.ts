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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, contractType, customClauses } = await req.json();

    if (!clientId || !contractType) {
      throw new Error("clientId e contractType são obrigatórios");
    }

    console.log(
      `Gerando contrato tipo ${contractType} para cliente ${clientId}`
    );

    // Buscar dados completos do cliente
    const { data: client } = await supabase
      .from("clients")
      .select("*, client_partners(*), client_enrichment(*)")
      .eq("id", clientId)
      .single();

    // Buscar revenue types para o cliente
    const { data: revenueTypes } = await supabase
      .from("revenue_types")
      .select("*")
      .eq("is_active", true);

    const context = `
Geração de Contrato de Prestação de Serviços Contábeis

TIPO DE CONTRATO: ${contractType}

DADOS DO CONTRATANTE:
- Razão Social: ${client?.razao_social || client?.name}
- Nome Fantasia: ${client?.nome_fantasia || "N/A"}
- CNPJ: ${client?.cnpj || "N/A"}
- Endereço: ${client?.logradouro || ""}, ${client?.numero || ""} ${
      client?.complemento || ""
    }
- Bairro: ${client?.bairro || ""}, ${client?.municipio || ""}/${client?.uf || ""}
- CEP: ${client?.cep || "N/A"}
- Email: ${client?.email || "N/A"}
- Telefone: ${client?.phone || "N/A"}

INFORMAÇÕES EMPRESARIAIS:
- Porte: ${client?.porte || "N/A"}
- Natureza Jurídica: ${client?.natureza_juridica || "N/A"}
- Capital Social: R$ ${client?.capital_social?.toFixed(2) || "0.00"}
- Data de Abertura: ${client?.data_abertura || "N/A"}
- Atividade Principal: ${
      client?.client_enrichment?.[0]?.atividade_principal
        ? JSON.stringify(client.client_enrichment[0].atividade_principal)
        : "N/A"
    }

REPRESENTANTES LEGAIS:
${
      client?.client_partners
        ?.filter((p: any) => p.is_administrator)
        .map((p: any) => `- ${p.name}, CPF: ${p.cpf || "N/A"}`)
        .join("\n") || "Não informado"
    }

VALORES DOS SERVIÇOS:
- Honorário Mensal: R$ ${client?.monthly_fee?.toFixed(2) || "0.00"}
- Dia de Pagamento: ${client?.payment_day || "N/A"}

SERVIÇOS OFERECIDOS:
${
      revenueTypes
        ?.map((rt: any) => `- ${rt.name}: ${rt.description || ""}`)
        .join("\n") || "Serviços padrão de contabilidade"
    }

CLÁUSULAS CUSTOMIZADAS:
${customClauses || "Usar cláusulas padrão"}

INSTRUÇÕES:
Gere um contrato de prestação de serviços contábeis profissional, completo e em conformidade com:
- Código Civil Brasileiro
- Normas do Conselho Federal de Contabilidade (CFC)
- Legislação trabalhista e tributária aplicável
- Código de Defesa do Consumidor

O contrato deve incluir:
1. Qualificação das partes
2. Objeto do contrato (serviços a serem prestados)
3. Obrigações do contratante
4. Obrigações da contratada
5. Valor e forma de pagamento
6. Prazo de vigência
7. Rescisão
8. Confidencialidade
9. Foro
10. Disposições gerais

Use linguagem jurídica adequada, mas clara e acessível.
`;

    const aiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${geminiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // model moved to URL,
          messages: [
            {
              role: "system",
              content:
                "Você é um especialista em direito contratual e contabilidade, com profundo conhecimento das normas do CFC e legislação brasileira. Gere contratos profissionais, completos e juridicamente sólidos.",
            },
            { role: "user", content: context },
          ],
          temperature: 0.3, // Mais determinístico para contratos
          max_tokens: 4000,
        }),
      }
    );

    if (!aiResponse.ok) {
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const contractText = aiData.choices?.[0]?.message?.content;

    if (!contractText) {
      throw new Error("IA não retornou texto do contrato");
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: {
          id: client?.id,
          name: client?.name,
          cnpj: client?.cnpj,
        },
        contract: {
          type: contractType,
          text: contractText,
          generated_at: new Date().toISOString(),
        },
        metadata: {
          monthly_fee: client?.monthly_fee,
          payment_day: client?.payment_day,
          services_count: revenueTypes?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-contract-generator:", error);
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
