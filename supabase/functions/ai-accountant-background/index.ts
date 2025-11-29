import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Accountant Background Processor
 *
 * Esta Edge Function processa lançamentos contábeis em background:
 * - Valida lançamentos na fila de validação
 * - Processa faturas sem contabilização
 * - Executa validações em lote
 *
 * Actions:
 * - process_validation_queue: Processa N itens da fila de validação
 * - validate_batch: Valida lançamentos específicos
 * - process_invoices: Processa faturas sem contabilidade
 * - stats: Retorna estatísticas de validação
 */

interface BackgroundRequest {
  action: 'process_validation_queue' | 'validate_batch' | 'process_invoices' | 'stats' | 'health';
  batch_size?: number;
  entry_ids?: string[];
  competence?: string; // formato YYYY-MM para process_invoices
}

// NBC Knowledge para validação
const NBC_VALIDATION_PROMPT = `Você é um auditor contábil CRC brasileiro especialista em NBC.

## VALIDAÇÕES OBRIGATÓRIAS:

1. **PARTIDAS DOBRADAS** - CRÍTICO
   - SOMA DÉBITOS = SOMA CRÉDITOS (obrigatório)
   - Cada linha tem APENAS débito OU crédito (nunca ambos)
   - Mínimo 2 linhas por lançamento

2. **CONTAS ANALÍTICAS**
   - Lançamentos APENAS em contas analíticas (folha)
   - Contas sintéticas (grupos) NÃO recebem lançamentos

3. **REGIME DE COMPETÊNCIA**
   - Receitas e despesas reconhecidas no período de ocorrência
   - Independente de recebimento/pagamento

4. **CLASSIFICAÇÃO CONTÁBIL**
   - Débito: aumenta Ativo/Despesa, diminui Passivo/PL/Receita
   - Crédito: aumenta Passivo/PL/Receita, diminui Ativo/Despesa

5. **HISTÓRICO**
   - Deve ser claro, objetivo e identificar a operação

Retorne JSON com:
{
  "result": "valid" | "invalid" | "warning",
  "confidence": 0.0-1.0,
  "issues": ["lista de problemas encontrados"],
  "suggestions": ["sugestões de correção"],
  "nbc_references": ["NBC aplicáveis"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Usar service role para background processing
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, batch_size = 10, entry_ids, competence } = await req.json() as BackgroundRequest;

    console.log(`[AI-Background] Action: ${action}, batch_size: ${batch_size}`);

    let result: any;

    switch (action) {
      case 'health':
        result = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          gemini_configured: !!geminiApiKey
        };
        break;

      case 'stats':
        const { data: stats, error: statsError } = await supabase
          .from('v_ai_validation_stats')
          .select('*')
          .single();

        if (statsError) throw statsError;

        const { data: queueStats } = await supabase
          .from('ai_validation_queue')
          .select('status', { count: 'exact' });

        result = {
          entries: stats,
          queue: {
            pending: queueStats?.filter(q => q.status === 'pending').length || 0,
            processing: queueStats?.filter(q => q.status === 'processing').length || 0,
            failed: queueStats?.filter(q => q.status === 'failed').length || 0
          }
        };
        break;

      case 'process_validation_queue':
        result = await processValidationQueue(supabase, geminiApiKey, batch_size);
        break;

      case 'validate_batch':
        if (!entry_ids || entry_ids.length === 0) {
          throw new Error('entry_ids required for validate_batch');
        }
        result = await validateBatch(supabase, geminiApiKey, entry_ids);
        break;

      case 'process_invoices':
        result = await processInvoicesWithoutAccounting(supabase, competence);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[AI-Background] Completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        result,
        duration_ms: duration
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[AI-Background] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

/**
 * Processa itens da fila de validação
 */
async function processValidationQueue(
  supabase: any,
  geminiApiKey: string,
  batchSize: number
): Promise<{ processed: number; errors: number; results: any[] }> {
  const results: any[] = [];
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < batchSize; i++) {
    // Pegar próximo item da fila
    const { data: items, error } = await supabase.rpc('get_next_validation_item');

    if (error || !items || items.length === 0) {
      console.log('[AI-Background] No more items in queue');
      break;
    }

    const item = items[0];
    console.log(`[AI-Background] Processing queue item ${item.queue_id}`);

    try {
      // Validar com IA
      const validation = await validateEntryWithAI(geminiApiKey, item.entry_data);

      // Marcar como concluído
      await supabase.rpc('complete_ai_validation', {
        p_queue_id: item.queue_id,
        p_result: validation.result,
        p_message: validation.message,
        p_confidence: validation.confidence,
        p_model: 'gemini-2.0-flash'
      });

      results.push({
        entry_id: item.entry_id,
        result: validation.result,
        confidence: validation.confidence
      });

      processed++;
    } catch (err) {
      console.error(`[AI-Background] Failed to validate ${item.entry_id}:`, err);

      await supabase.rpc('fail_ai_validation', {
        p_queue_id: item.queue_id,
        p_error: err instanceof Error ? err.message : 'Unknown error'
      });

      errors++;
    }
  }

  return { processed, errors, results };
}

/**
 * Valida um lote específico de entries
 */
async function validateBatch(
  supabase: any,
  geminiApiKey: string,
  entryIds: string[]
): Promise<{ processed: number; results: any[] }> {
  const results: any[] = [];

  for (const entryId of entryIds) {
    // Buscar entry com linhas
    const { data: entry, error } = await supabase
      .from('accounting_entries')
      .select(`
        *,
        lines:accounting_entry_lines(
          *,
          account:chart_of_accounts(code, name, type, is_synthetic)
        )
      `)
      .eq('id', entryId)
      .single();

    if (error || !entry) {
      results.push({ entry_id: entryId, error: 'Entry not found' });
      continue;
    }

    try {
      const validation = await validateEntryWithAI(geminiApiKey, entry);

      // Atualizar entry
      await supabase
        .from('accounting_entries')
        .update({
          ai_validated: true,
          ai_validated_at: new Date().toISOString(),
          ai_validation_result: validation.result,
          ai_validation_message: validation.message,
          ai_confidence: validation.confidence,
          ai_model: 'gemini-2.0-flash'
        })
        .eq('id', entryId);

      results.push({
        entry_id: entryId,
        result: validation.result,
        confidence: validation.confidence
      });
    } catch (err) {
      results.push({
        entry_id: entryId,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  return { processed: results.filter(r => !r.error).length, results };
}

/**
 * Processa faturas sem contabilização
 */
async function processInvoicesWithoutAccounting(
  supabase: any,
  competence?: string
): Promise<{ processed: number; errors: number; created_entries: string[] }> {
  // Chamar função do banco que processa faturas
  const { data, error } = await supabase.rpc('process_invoices_without_accounting', {
    p_limit: 100
  });

  if (error) throw error;

  return {
    processed: data?.[0]?.processed_count || 0,
    errors: data?.[0]?.error_count || 0,
    created_entries: []
  };
}

/**
 * Valida um lançamento usando a API Gemini
 */
async function validateEntryWithAI(
  geminiApiKey: string,
  entryData: any
): Promise<{ result: string; message: string; confidence: number }> {
  const prompt = `${NBC_VALIDATION_PROMPT}

Valide este lançamento contábil:

${JSON.stringify(entryData, null, 2)}

Retorne APENAS o JSON de resultado, sem markdown ou explicações adicionais.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON da resposta
  let parsed;
  try {
    // Remove possíveis marcadores de código
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    // Se não conseguir parsear, assumir válido com baixa confiança
    console.warn('[AI-Background] Could not parse AI response:', text);
    return {
      result: 'warning',
      message: 'Não foi possível validar automaticamente. Revisão manual recomendada.',
      confidence: 0.5
    };
  }

  // Construir mensagem
  let message = '';
  if (parsed.issues && parsed.issues.length > 0) {
    message += 'Problemas: ' + parsed.issues.join('; ');
  }
  if (parsed.suggestions && parsed.suggestions.length > 0) {
    message += (message ? ' | ' : '') + 'Sugestões: ' + parsed.suggestions.join('; ');
  }
  if (parsed.nbc_references && parsed.nbc_references.length > 0) {
    message += (message ? ' | ' : '') + 'NBC: ' + parsed.nbc_references.join(', ');
  }

  return {
    result: parsed.result || 'warning',
    message: message || 'Validação concluída sem observações.',
    confidence: parsed.confidence || 0.8
  };
}
