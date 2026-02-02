import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * AI-FIRST RAG CLASSIFIER
 * ========================
 * Agente classificador que usa RAG (Retrieval-Augmented Generation) para
 * classificar transações bancárias com base no conhecimento histórico.
 *
 * PRINCÍPIOS AI-FIRST:
 * 1. Nenhuma regra hardcoded - decisão baseada em contexto
 * 2. Data Lake como fonte única de verdade
 * 3. RAG antes de decidir - consulta histórico e padrões
 * 4. Feedback loop - toda decisão é registrada para aprendizado
 *
 * FLUXO:
 * 1. Receber transação para classificar
 * 2. Gerar embedding da descrição (OpenAI) ou usar busca textual (fallback)
 * 3. Buscar TOP N classificações similares via RAG
 * 4. Se confiança alta: usar classificação similar
 * 5. Se confiança baixa: usar LLM para decidir com contexto
 * 6. Registrar decisão no Data Lake (feedback loop)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// API Keys
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Embedding model config
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

interface Transaction {
  id?: string;
  description: string;
  amount: number;
  date?: string;
}

interface ClassificationResult {
  account_id: string;
  account_code: string;
  account_name: string;
  confidence: number;
  reasoning: string;
  source: "rag_embedding" | "rag_text" | "llm_decision" | "fallback";
  similar_matches?: any[];
}

// =============================================================================
// EMBEDDING FUNCTIONS
// =============================================================================

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.log("[RAG] OpenAI API key not configured, skipping embedding");
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      console.error("[RAG] OpenAI embedding error:", response.status);
      return null;
    }

    const result = await response.json();
    return result.data?.[0]?.embedding || null;
  } catch (error) {
    console.error("[RAG] Embedding generation failed:", error);
    return null;
  }
}

// =============================================================================
// LLM DECISION FUNCTION
// =============================================================================

async function callLLMForDecision(
  transaction: Transaction,
  context: any,
  accounts: any[]
): Promise<ClassificationResult | null> {
  const apiKey = GEMINI_API_KEY || OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[RAG] No LLM API key configured");
    return null;
  }

  const prompt = `Você é o Dr. Cícero, contador especialista em classificação contábil.

TRANSAÇÃO PARA CLASSIFICAR:
- Descrição: ${transaction.description}
- Valor: R$ ${Math.abs(transaction.amount).toFixed(2)}
- Tipo: ${transaction.amount > 0 ? "ENTRADA (crédito)" : "SAÍDA (débito)"}

CONTEXTO DO DATA LAKE:
${JSON.stringify(context, null, 2)}

CONTAS CONTÁBEIS DISPONÍVEIS (TOP 10 mais usadas para este tipo):
${accounts.map((a: any) => `- ${a.account_code}: ${a.account_name} (usado ${a.usage_count}x)`).join("\n")}

INSTRUÇÕES:
1. Analise a descrição da transação
2. Compare com classificações similares do Data Lake
3. Escolha a conta contábil mais apropriada

Responda APENAS com JSON:
{
  "account_code": "código da conta",
  "account_name": "nome da conta",
  "confidence": 0.0 a 1.0,
  "reasoning": "explicação breve da decisão"
}`;

  try {
    let result;

    if (GEMINI_API_KEY) {
      // Use Gemini
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
          }),
        }
      );

      if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
      const data = await response.json();
      result = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      // Use OpenAI
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 500,
            temperature: 0.1,
            messages: [{ role: "user", content: prompt }],
          }),
        }
      );

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      const data = await response.json();
      result = data.choices?.[0]?.message?.content;
    }

    // Parse JSON from response
    const jsonMatch = result?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Find account_id from code
    const account = accounts.find(
      (a: any) => a.account_code === parsed.account_code
    );

    return {
      account_id: account?.account_id || "",
      account_code: parsed.account_code,
      account_name: parsed.account_name,
      confidence: parsed.confidence || 0.7,
      reasoning: parsed.reasoning,
      source: "llm_decision",
    };
  } catch (error) {
    console.error("[RAG] LLM decision failed:", error);
    return null;
  }
}

// =============================================================================
// MAIN CLASSIFICATION FUNCTION
// =============================================================================

async function classifyTransaction(
  supabase: any,
  tenantId: string,
  transaction: Transaction
): Promise<ClassificationResult> {
  const direction = transaction.amount > 0 ? "credit" : "debit";
  console.log(
    `[RAG] Classifying: "${transaction.description}" (${direction}, R$ ${Math.abs(transaction.amount).toFixed(2)})`
  );

  // Step 1: Try RAG with embedding
  const embedding = await generateEmbedding(transaction.description);

  if (embedding) {
    console.log("[RAG] Generated embedding, searching similar...");

    const { data: similarByEmbedding, error: embError } = await supabase.rpc(
      "search_similar_classifications",
      {
        p_tenant_id: tenantId,
        p_embedding: `[${embedding.join(",")}]`,
        p_direction: direction,
        p_limit: 5,
      }
    );

    if (!embError && similarByEmbedding?.length > 0) {
      const best = similarByEmbedding[0];
      console.log(
        `[RAG] Found similar by embedding: ${best.account_code} (similarity: ${best.similarity})`
      );

      // High confidence match (>= 80% similarity)
      if (best.similarity >= 0.8) {
        return {
          account_id: best.account_id,
          account_code: best.account_code,
          account_name: best.account_name,
          confidence: best.similarity,
          reasoning: `RAG match por embedding: "${best.transaction_description}" → ${best.account_code}`,
          source: "rag_embedding",
          similar_matches: similarByEmbedding,
        };
      }
    }
  }

  // Step 2: Try RAG with text similarity (fallback)
  console.log("[RAG] Trying text similarity search...");

  const { data: similarByText, error: textError } = await supabase.rpc(
    "search_classifications_by_text",
    {
      p_tenant_id: tenantId,
      p_description: transaction.description,
      p_direction: direction,
      p_limit: 5,
    }
  );

  if (!textError && similarByText?.length > 0) {
    const best = similarByText[0];
    console.log(
      `[RAG] Found similar by text: ${best.account_code} (similarity: ${best.text_similarity})`
    );

    // High confidence match (>= 70% text similarity)
    if (best.text_similarity >= 0.7) {
      return {
        account_id: best.account_id,
        account_code: best.account_code,
        account_name: best.account_name,
        confidence: best.text_similarity,
        reasoning: `RAG match por texto: "${best.transaction_description}" → ${best.account_code}`,
        source: "rag_text",
        similar_matches: similarByText,
      };
    }
  }

  // Step 3: Get full context for LLM decision
  console.log("[RAG] Low confidence matches, getting full context for LLM...");

  const { data: context } = await supabase.rpc("get_classification_context", {
    p_tenant_id: tenantId,
    p_description: transaction.description,
    p_amount: transaction.amount,
  });

  // Step 4: Get top accounts for this direction
  const { data: topAccounts } = await supabase
    .from("classification_embeddings")
    .select("account_id, account_code, account_name")
    .eq("tenant_id", tenantId)
    .eq("direction", direction)
    .eq("was_corrected", false)
    .limit(100);

  // Aggregate by account
  const accountCounts = new Map<string, any>();
  for (const acc of topAccounts || []) {
    const key = acc.account_code;
    if (!accountCounts.has(key)) {
      accountCounts.set(key, { ...acc, usage_count: 0 });
    }
    accountCounts.get(key)!.usage_count++;
  }

  const sortedAccounts = Array.from(accountCounts.values())
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 10);

  // Step 5: Call LLM for decision
  const llmResult = await callLLMForDecision(
    transaction,
    context,
    sortedAccounts
  );

  if (llmResult) {
    return {
      ...llmResult,
      similar_matches: similarByText || similarByEmbedding,
    };
  }

  // Step 6: Fallback - use most common account for this direction
  console.log("[RAG] LLM failed, using most common account as fallback");

  if (sortedAccounts.length > 0) {
    const fallback = sortedAccounts[0];
    return {
      account_id: fallback.account_id,
      account_code: fallback.account_code,
      account_name: fallback.account_name,
      confidence: 0.3,
      reasoning: `Fallback: conta mais usada para ${direction}`,
      source: "fallback",
      similar_matches: similarByText || [],
    };
  }

  throw new Error("Não foi possível classificar a transação");
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

async function processUnclassifiedTransactions(
  supabase: any,
  tenantId: string,
  startDate: string,
  endDate: string,
  limit: number = 50
): Promise<any> {
  console.log(
    `[RAG] Processing unclassified transactions: ${startDate} to ${endDate}`
  );

  // Get unclassified transactions (have journal_entry_id but no classification entry)
  const { data: transactions, error } = await supabase
    .from("bank_transactions")
    .select("id, description, amount, transaction_date")
    .eq("tenant_id", tenantId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .not("journal_entry_id", "is", null) // Reconciliado
    .limit(limit);

  if (error) throw error;

  const results = {
    total: transactions?.length || 0,
    classified: 0,
    failed: 0,
    classifications: [] as any[],
    errors: [] as string[],
  };

  for (const tx of transactions || []) {
    try {
      const classification = await classifyTransaction(supabase, tenantId, {
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        date: tx.transaction_date,
      });

      // Record in Data Lake
      const { data: recordResult, error: recordError } = await supabase.rpc(
        "record_classification",
        {
          p_tenant_id: tenantId,
          p_description: tx.description,
          p_amount: tx.amount,
          p_account_id: classification.account_id,
          p_source: "ai_agent",
          p_confidence: classification.confidence,
          p_reasoning: classification.reasoning,
          p_source_reference: tx.id,
        }
      );

      if (recordError) {
        console.error("[RAG] Failed to record classification:", recordError);
      }

      results.classified++;
      results.classifications.push({
        transaction_id: tx.id,
        description: tx.description,
        amount: tx.amount,
        ...classification,
      });

      console.log(
        `[RAG] ✓ ${tx.description.substring(0, 30)}... → ${classification.account_code} (${classification.source})`
      );
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${tx.id}: ${err.message}`);
      console.error(`[RAG] ✗ ${tx.description}: ${err.message}`);
    }
  }

  return results;
}

// =============================================================================
// GENERATE EMBEDDINGS FOR EXISTING CLASSIFICATIONS
// =============================================================================

async function generatePendingEmbeddings(
  supabase: any,
  tenantId: string,
  limit: number = 100
): Promise<any> {
  console.log("[RAG] Generating embeddings for pending classifications...");

  // Get classifications without embeddings
  const { data: pending, error } = await supabase
    .from("vw_pending_embeddings")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(limit);

  if (error) throw error;

  const results = {
    total: pending?.length || 0,
    generated: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const item of pending || []) {
    try {
      const embedding = await generateEmbedding(item.normalized_description);

      if (embedding) {
        const { error: updateError } = await supabase.rpc(
          "update_classification_embedding",
          {
            p_id: item.id,
            p_embedding: `[${embedding.join(",")}]`,
          }
        );

        if (updateError) throw updateError;

        results.generated++;
        console.log(
          `[RAG] ✓ Generated embedding for: ${item.normalized_description.substring(0, 40)}...`
        );
      } else {
        results.failed++;
        results.errors.push(`${item.id}: Failed to generate embedding`);
      }
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${item.id}: ${err.message}`);
    }
  }

  return results;
}

// =============================================================================
// SERVER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[RAG Classifier] ${msg}`);
    logs.push(`${new Date().toISOString()} - ${msg}`);
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, tenant_id, ...params } = body;

    log(`Action: ${action}, Tenant: ${tenant_id}`);

    let result: any;

    switch (action) {
      case "classify_single":
        // Classify a single transaction
        result = await classifyTransaction(supabase, tenant_id, {
          description: params.description,
          amount: params.amount,
          date: params.date,
        });
        break;

      case "classify_batch":
        // Process unclassified transactions in date range
        result = await processUnclassifiedTransactions(
          supabase,
          tenant_id,
          params.start_date,
          params.end_date,
          params.limit || 50
        );
        break;

      case "generate_embeddings":
        // Generate embeddings for classifications without them
        result = await generatePendingEmbeddings(
          supabase,
          tenant_id,
          params.limit || 100
        );
        break;

      case "get_context":
        // Get classification context (for debugging/preview)
        const { data: context } = await supabase.rpc(
          "get_classification_context",
          {
            p_tenant_id: tenant_id,
            p_description: params.description,
            p_amount: params.amount,
          }
        );
        result = context;
        break;

      case "get_metrics":
        // Get Data Lake metrics
        const { data: metrics } = await supabase
          .from("vw_classification_metrics")
          .select("*")
          .eq("tenant_id", tenant_id)
          .single();
        result = metrics;
        break;

      default:
        throw new Error(
          `Unknown action: ${action}. Valid actions: classify_single, classify_batch, generate_embeddings, get_context, get_metrics`
        );
    }

    const executionTime = Date.now() - startTime;
    log(`Completed in ${executionTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        result,
        execution_time_ms: executionTime,
        logs,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    log(`Error: ${error.message}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        logs,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
