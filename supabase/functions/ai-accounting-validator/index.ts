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

    const { entryData } = await req.json();

    if (!entryData) {
      throw new Error("entryData é obrigatório");
    }

    console.log("Validando lançamento contábil");

    // Buscar plano de contas
    const { data: accounts } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("is_active", true)
      .order("code");

    // Preparar informações do lançamento
    const {
      description,
      entry_date,
      entry_type,
      document_number,
      lines,
    } = entryData;

    const totalDebit = lines?.reduce((sum: number, l: any) => sum + (l.debit || 0), 0) || 0;
    const totalCredit = lines?.reduce((sum: number, l: any) => sum + (l.credit || 0), 0) || 0;
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const context = `
Validação de Lançamento Contábil

DADOS DO LANÇAMENTO:
- Data: ${entry_date}
- Tipo: ${entry_type}
- Descrição: ${description}
- Número do Documento: ${document_number || "N/A"}

PARTIDAS:
${
      lines
        ?.map(
          (l: any, idx: number) =>
            `${idx + 1}. Conta: ${l.account_code || "??"} - ${l.account_name || "??"}
   Débito: R$ ${(l.debit || 0).toFixed(2)}
   Crédito: R$ ${(l.credit || 0).toFixed(2)}`
        )
        .join("\n") || "Nenhuma partida"
    }

TOTALIZAÇÃO:
- Total Débito: R$ ${totalDebit.toFixed(2)}
- Total Crédito: R$ ${totalCredit.toFixed(2)}
- Diferença: R$ ${Math.abs(totalDebit - totalCredit).toFixed(2)}
- Balanceado: ${isBalanced ? "SIM" : "NÃO"}

PLANO DE CONTAS DISPONÍVEL:
${accounts
  ?.slice(0, 20)
  .map((a: any) => `- ${a.code} - ${a.name} (${a.type})`)
  .join("\n")}

VALIDAÇÕES SOLICITADAS:
1. Verificar se o lançamento está balanceado
2. Validar contas contábeis usadas
3. Verificar método das partidas dobradas
4. Identificar possíveis erros de classificação
5. Sugerir correções se necessário
6. Validar conformidade NBC/CFC
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
                "Você é um contador experiente e perito em normas NBC/CFC. Valide lançamentos contábeis com rigor técnico e sugira correções quando necessário.",
            },
            { role: "user", content: context },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "validate_accounting_entry",
                description: "Valida lançamento contábil",
                parameters: {
                  type: "object",
                  properties: {
                    is_valid: {
                      type: "boolean",
                      description: "Se o lançamento é válido",
                    },
                    validation_score: {
                      type: "number",
                      minimum: 0,
                      maximum: 100,
                      description: "Score de validação (0-100)",
                    },
                    errors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          severity: {
                            type: "string",
                            enum: ["low", "medium", "high", "critical"],
                          },
                          message: { type: "string" },
                          suggestion: { type: "string" },
                        },
                      },
                      description: "Lista de erros encontrados",
                    },
                    warnings: {
                      type: "array",
                      items: { type: "string" },
                      description: "Avisos não críticos",
                    },
                    suggested_accounts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          account_code: { type: "string" },
                          account_name: { type: "string" },
                          reason: { type: "string" },
                        },
                      },
                      description: "Contas alternativas sugeridas",
                    },
                    compliance_issues: {
                      type: "array",
                      items: { type: "string" },
                      description: "Problemas de conformidade NBC/CFC",
                    },
                    recommendations: {
                      type: "array",
                      items: { type: "string" },
                      description: "Recomendações de melhoria",
                    },
                  },
                  required: [
                    "is_valid",
                    "validation_score",
                    "errors",
                    "warnings",
                    "suggested_accounts",
                    "compliance_issues",
                    "recommendations",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "validate_accounting_entry" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const validation = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!validation) {
      throw new Error("IA não retornou validação estruturada");
    }

    return new Response(
      JSON.stringify({
        success: true,
        entry: {
          description,
          entry_date,
          total_debit: totalDebit,
          total_credit: totalCredit,
          is_balanced: isBalanced,
        },
        validation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-accounting-validator:", error);
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
