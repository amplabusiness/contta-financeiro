import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Regras contábeis para o Contador IA
const ACCOUNTING_RULES = `
REGRAS CONTÁBEIS BRASILEIRAS (NBC/CFC):

1. SALDO DE ABERTURA (início do exercício):
   - Débito: Clientes a Receber (1.1.2.x)
   - Crédito: Patrimônio Líquido (5.x)
   - Depois zera contas de resultado (fecha 3.x e 4.x para PL)

2. PROVISIONAMENTO DE RECEITA (lançamentos mensais):
   - Débito: Clientes a Receber (1.1.2.x)
   - Crédito: Receita de Honorários (3.1.1.x)
   - Regime de competência - reconhece quando ganha

3. DESPESAS RECORRENTES PROVISIONADAS:
   - Débito: Despesas (4.x)
   - Crédito: Contas a Pagar / Passivo (2.x)
   - Reconhece quando incorre, não quando paga

4. PARTIDAS DOBRADAS:
   - Total Débito DEVE SER IGUAL Total Crédito
   - Cada lançamento afeta no mínimo 2 contas

5. NATUREZA DAS CONTAS:
   - Ativo (1.x): Natureza devedora - aumenta com débito
   - Passivo (2.x): Natureza credora - aumenta com crédito
   - Receita (3.x): Natureza credora - aumenta com crédito
   - Despesa (4.x): Natureza devedora - aumenta com débito
   - PL (5.x): Natureza credora - aumenta com crédito

6. EQUAÇÃO PATRIMONIAL:
   Ativo = Passivo + Patrimônio Líquido + Resultado do Exercício
`;

interface AccountingEntry {
  id: string;
  entry_date: string;
  description: string;
  entry_type: string;
  lines: Array<{
    account_code: string;
    account_name: string;
    debit_amount: number;
    credit_amount: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🤖 Contador IA Background - Iniciando validação automática...");

    // Buscar lançamentos pendentes
    const { data: pendingEntries, error: fetchError } = await supabase
      .from("accounting_entries")
      .select(`
        id,
        entry_date,
        description,
        entry_type,
        accounting_entry_lines (
          id,
          account_id,
          debit_amount,
          credit_amount,
          chart_of_accounts (
            code,
            name,
            type
          )
        )
      `)
      .eq("ai_validation_status", "pending")
      .limit(5); // Processar 5 por vez para não sobrecarregar

    if (fetchError) {
      throw new Error(`Erro ao buscar lançamentos: ${fetchError.message}`);
    }

    if (!pendingEntries || pendingEntries.length === 0) {
      console.log("✅ Nenhum lançamento pendente de validação");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum lançamento pendente",
          validated: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Encontrados ${pendingEntries.length} lançamentos para validar`);

    // Buscar plano de contas para contexto
    const { data: accounts } = await supabase
      .from("chart_of_accounts")
      .select("code, name, type")
      .eq("is_active", true)
      .order("code");

    const results = [];

    for (const entry of pendingEntries) {
      try {
        // Marcar como validando
        await supabase
          .from("accounting_entries")
          .update({ ai_validation_status: "validating" })
          .eq("id", entry.id);

        // Preparar dados do lançamento
        const lines = entry.accounting_entry_lines?.map((line: any) => ({
          account_code: line.chart_of_accounts?.code || "??",
          account_name: line.chart_of_accounts?.name || "??",
          account_type: line.chart_of_accounts?.type || "??",
          debit: line.debit_amount || 0,
          credit: line.credit_amount || 0,
        })) || [];

        const totalDebit = lines.reduce((sum: number, l: any) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum: number, l: any) => sum + l.credit, 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        // Contexto para o Contador IA
        const context = `
${ACCOUNTING_RULES}

LANÇAMENTO A VALIDAR:
- ID: ${entry.id}
- Data: ${entry.entry_date}
- Tipo: ${entry.entry_type || 'regular'}
- Descrição: ${entry.description}

PARTIDAS:
${lines.map((l: any, idx: number) =>
  `${idx + 1}. ${l.account_code} - ${l.account_name} (${l.account_type})
     Débito: R$ ${l.debit.toFixed(2)} | Crédito: R$ ${l.credit.toFixed(2)}`
).join('\n')}

TOTALIZAÇÃO:
- Total Débito: R$ ${totalDebit.toFixed(2)}
- Total Crédito: R$ ${totalCredit.toFixed(2)}
- Balanceado: ${isBalanced ? 'SIM ✓' : 'NÃO ✗'}

PLANO DE CONTAS DISPONÍVEL:
${accounts?.slice(0, 30).map((a: any) => `${a.code} - ${a.name}`).join('\n')}

VALIDAR E RETORNAR ANÁLISE ESTRUTURADA.
`;

        // Chamar Gemini para validação
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
                  content: `Você é o Contador IA da Ampla Contabilidade. Valide lançamentos contábeis automaticamente seguindo as normas NBC/CFC brasileiras. Seja objetivo e técnico.`,
                },
                { role: "user", content: context },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "validate_entry",
                    description: "Retorna resultado da validação do lançamento contábil",
                    parameters: {
                      type: "object",
                      properties: {
                        approved: {
                          type: "boolean",
                          description: "Se o lançamento está correto e pode ser aprovado",
                        },
                        score: {
                          type: "number",
                          minimum: 0,
                          maximum: 100,
                          description: "Score de qualidade do lançamento (0-100)",
                        },
                        status: {
                          type: "string",
                          enum: ["approved", "warning", "rejected"],
                          description: "Status da validação",
                        },
                        message: {
                          type: "string",
                          description: "Mensagem resumida da validação (max 200 caracteres)",
                        },
                        issues: {
                          type: "array",
                          items: { type: "string" },
                          description: "Lista de problemas encontrados",
                        },
                      },
                      required: ["approved", "score", "status", "message"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "validate_entry" },
              },
              temperature: 0.2,
              max_tokens: 500,
            }),
          }
        );

        if (!aiResponse.ok) {
          throw new Error(`AI Gateway error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        const validation = toolCall?.function?.arguments
          ? JSON.parse(toolCall.function.arguments)
          : null;

        if (!validation) {
          throw new Error("IA não retornou validação");
        }

        // Atualizar status no banco
        await supabase
          .from("accounting_entries")
          .update({
            ai_validated: validation.approved,
            ai_validation_status: validation.status,
            ai_validation_score: validation.score,
            ai_validation_message: validation.message,
            ai_validated_at: new Date().toISOString(),
          })
          .eq("id", entry.id);

        // Registrar atividade
        await supabase.from("ai_accountant_activity").insert({
          entry_id: entry.id,
          action_type: "validation",
          status: validation.status === "approved" ? "success" :
                  validation.status === "warning" ? "warning" : "error",
          score: validation.score,
          message: validation.message,
          details: {
            issues: validation.issues || [],
            total_debit: totalDebit,
            total_credit: totalCredit,
            is_balanced: isBalanced,
          },
        });

        console.log(`✅ Lançamento ${entry.id.substring(0, 8)}... validado: ${validation.status} (${validation.score})`);

        results.push({
          entry_id: entry.id,
          status: validation.status,
          score: validation.score,
          message: validation.message,
        });

      } catch (entryError) {
        console.error(`❌ Erro ao validar ${entry.id}:`, entryError);

        // Marcar como erro
        await supabase
          .from("accounting_entries")
          .update({
            ai_validation_status: "pending", // Volta para pendente para tentar novamente
            ai_validation_message: `Erro na validação: ${entryError instanceof Error ? entryError.message : 'Erro desconhecido'}`,
          })
          .eq("id", entry.id);

        results.push({
          entry_id: entry.id,
          status: "error",
          error: entryError instanceof Error ? entryError.message : "Erro desconhecido",
        });
      }
    }

    console.log(`🤖 Contador IA Background - Finalizado: ${results.length} lançamentos processados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Validação automática concluída`,
        validated: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro no Contador IA Background:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
