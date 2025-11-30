import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type LogFn = (message: string) => void;

/**
 * AI ORCHESTRATOR - Agente Orquestrador de IA
 *
 * Este é o cérebro do sistema. Ele:
 * 1. Monitora a saúde do sistema contábil
 * 2. Executa tarefas de manutenção automaticamente
 * 3. Coordena outros agentes de IA
 * 4. Toma decisões inteligentes sobre o que fazer
 *
 * Funciona como um cron job - pode ser chamado periodicamente via
 * pg_cron ou via scheduled edge function do Supabase
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorAction {
  action:
    | 'full_health_check'      // Verifica tudo e corrige problemas
    | 'process_pending_entries' // Processa dados sem lançamentos contábeis
    | 'cleanup_orphans'        // Limpa entries órfãos
    | 'reconcile_data'         // Reconcilia dados entre tabelas
    | 'generate_insights'      // Gera insights sobre a saúde financeira
    | 'auto_categorize'        // Categoriza transações automaticamente
    | 'predict_cash_flow';     // Prevê fluxo de caixa
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[Orchestrator] ${msg}`);
    logs.push(`${new Date().toISOString()} - ${msg}`);
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Suporte a múltiplas APIs de IA
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const aiApiKey = geminiApiKey || geminiApiKey; // Prioriza Gemini

    // Usar service role para operações automatizadas
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'full_health_check';

    log(`Starting action: ${action}`);

    let result: any = { success: true, action };

    switch (action) {
      case 'full_health_check':
        result = await fullHealthCheck(supabase, aiApiKey, log);
        break;

      case 'process_pending_entries':
        result = await processPendingEntries(supabase, log);
        break;

      case 'cleanup_orphans':
        result = await cleanupOrphanEntries(supabase, log);
        break;

      case 'reconcile_data':
        result = await reconcileData(supabase, log);
        break;

      case 'generate_insights':
        result = await generateInsights(supabase, aiApiKey, geminiApiKey ? 'gemini' : 'lovable', log);
        break;

      case 'auto_categorize':
        result = await autoCategorize(supabase, aiApiKey, geminiApiKey ? 'gemini' : 'lovable', log);
        break;

      case 'predict_cash_flow':
        result = await predictCashFlow(supabase, aiApiKey, geminiApiKey ? 'gemini' : 'lovable', log);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const executionTime = Date.now() - startTime;
    log(`Completed in ${executionTime}ms`);

    // Salvar log de execução (ignora se tabela não existe)
    try {
      await supabase.from('ai_orchestrator_logs').insert({
        action,
        result: JSON.stringify(result),
        execution_time_ms: executionTime,
        logs: logs.join('\n'),
        created_at: new Date().toISOString()
      });
    } catch {
      // Ignora erro - tabela pode não existir
    }

    return new Response(
      JSON.stringify({
        ...result,
        executionTime,
        logs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * FULL HEALTH CHECK - Verifica e corrige problemas automaticamente
 */
async function fullHealthCheck(supabase: any, aiKey: string | undefined, log: LogFn) {
  const issues: string[] = [];
  const fixes: string[] = [];

  // 1. Verificar Plano de Contas
  log('Checking chart of accounts...');
  const { count: chartCount } = await supabase
    .from('chart_of_accounts')
    .select('*', { count: 'exact', head: true });

  if (!chartCount || chartCount === 0) {
    issues.push('Chart of accounts is empty');
    log('Initializing chart of accounts...');

    // Chamar smart-accounting para inicializar
    const { error } = await supabase.functions.invoke('smart-accounting', {
      body: { action: 'init_chart' }
    });

    if (!error) {
      fixes.push('Chart of accounts initialized');
    }
  }

  // 2. Verificar entries órfãos
  log('Checking for orphan entries...');
  const orphanResult = await cleanupOrphanEntries(supabase, log);
  if (orphanResult.deleted > 0) {
    issues.push(`Found ${orphanResult.deleted} orphan entries`);
    fixes.push(`Deleted ${orphanResult.deleted} orphan entries`);
  }

  // 3. Verificar dados sem lançamentos
  log('Checking for pending data...');
  const pendingResult = await processPendingEntries(supabase, log);
  if (pendingResult.processed > 0) {
    issues.push(`Found ${pendingResult.pending} records without accounting entries`);
    fixes.push(`Created ${pendingResult.processed} accounting entries`);
  }

  // 4. Verificar consistência de saldos
  log('Checking balance consistency...');
  const balanceResult = await checkBalanceConsistency(supabase, log);
  if (balanceResult.issues.length > 0) {
    issues.push(...balanceResult.issues);
  }

  return {
    success: true,
    action: 'full_health_check',
    summary: {
      chartOfAccounts: chartCount || 0,
      issuesFound: issues.length,
      fixesApplied: fixes.length
    },
    issues,
    fixes
  };
}

/**
 * CLEANUP ORPHAN ENTRIES - Remove entries sem lines
 */
async function cleanupOrphanEntries(supabase: any, log: LogFn) {
  // Buscar entries com lines
  const { data: entriesWithLines } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id');

  const validIds = new Set((entriesWithLines || []).map((e: any) => e.entry_id));

  // Buscar todos os entries
  const { data: allEntries } = await supabase
    .from('accounting_entries')
    .select('id');

  // Identificar órfãos
  const orphanIds = (allEntries || [])
    .filter((e: any) => !validIds.has(e.id))
    .map((e: any) => e.id);

  if (orphanIds.length === 0) {
    log('No orphan entries found');
    return { success: true, deleted: 0 };
  }

  log(`Found ${orphanIds.length} orphan entries, deleting...`);

  // Deletar em batches
  let deleted = 0;
  for (let i = 0; i < orphanIds.length; i += 50) {
    const batch = orphanIds.slice(i, i + 50);
    const { error } = await supabase
      .from('accounting_entries')
      .delete()
      .in('id', batch);

    if (!error) {
      deleted += batch.length;
    }
  }

  log(`Deleted ${deleted} orphan entries`);
  return { success: true, deleted };
}

/**
 * PROCESS PENDING ENTRIES - Cria lançamentos para dados existentes
 */
async function processPendingEntries(supabase: any, log: LogFn) {
  let pending = 0;
  let processed = 0;
  const errors: string[] = [];

  // 1. Processar Invoices sem lançamento
  log('Processing invoices...');
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, client_id, amount, competence, due_date, status, clients(name)')
    .order('created_at')
    .limit(100);

  if (invoices) {
    for (const invoice of invoices) {
      // Verificar se já tem lançamento
      const { data: existing } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('reference_type', 'invoice')
        .eq('reference_id', invoice.id)
        .maybeSingle();

      if (!existing) {
        pending++;
        try {
          // Criar via smart-accounting
          await supabase.functions.invoke('smart-accounting', {
            body: {
              action: 'create_entry',
              entry_type: 'receita_honorarios',
              amount: invoice.amount,
              date: invoice.due_date,
              description: `Honorários ${invoice.competence} - ${invoice.clients?.name || 'Cliente'}`,
              client_id: invoice.client_id,
              client_name: invoice.clients?.name,
              reference_type: 'invoice',
              reference_id: invoice.id,
              competence: invoice.competence
            }
          });
          processed++;
        } catch (e) {
          errors.push(`Invoice ${invoice.id}: ${e}`);
        }
      }
    }
  }

  // 2. Processar Opening Balances sem lançamento
  log('Processing opening balances...');
  const { data: balances } = await supabase
    .from('client_opening_balance')
    .select('id, client_id, amount, competence, due_date, description, clients(name)')
    .order('created_at')
    .limit(100);

  if (balances) {
    for (const balance of balances) {
      const { data: existing } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('reference_type', 'opening_balance')
        .eq('reference_id', balance.id)
        .maybeSingle();

      if (!existing) {
        pending++;
        try {
          await supabase.functions.invoke('smart-accounting', {
            body: {
              action: 'create_entry',
              entry_type: 'saldo_abertura',
              amount: balance.amount,
              date: balance.due_date,
              description: balance.description || `Saldo de abertura ${balance.competence}`,
              client_id: balance.client_id,
              client_name: balance.clients?.name,
              reference_type: 'opening_balance',
              reference_id: balance.id,
              competence: balance.competence
            }
          });
          processed++;
        } catch (e) {
          errors.push(`Balance ${balance.id}: ${e}`);
        }
      }
    }
  }

  log(`Processed ${processed}/${pending} pending entries`);
  return { success: true, pending, processed, errors };
}

/**
 * CHECK BALANCE CONSISTENCY - Verifica se débitos = créditos
 */
async function checkBalanceConsistency(supabase: any, log: LogFn) {
  const issues: string[] = [];

  // Verificar se cada entry tem débito = crédito
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      description,
      total_debit,
      total_credit,
      accounting_entry_lines(debit, credit)
    `)
    .limit(100);

  if (entries) {
    for (const entry of entries) {
      const lines = entry.accounting_entry_lines || [];
      const totalDebit = lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
      const totalCredit = lines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        issues.push(`Entry ${entry.id}: Debit(${totalDebit}) != Credit(${totalCredit})`);
      }
    }
  }

  log(`Found ${issues.length} balance inconsistencies`);
  return { issues };
}

/**
 * RECONCILE DATA - Sincroniza dados entre tabelas
 */
async function reconcileData(supabase: any, log: LogFn) {
  const changes: string[] = [];

  // Atualizar status de invoices baseado em pagamentos
  log('Reconciling invoice status...');
  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('status', 'paid');

  // Verificar se há lançamentos de recebimento correspondentes
  for (const invoice of (paidInvoices || [])) {
    const { data: receivement } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('reference_type', 'invoice')
      .eq('reference_id', invoice.id)
      .eq('entry_type', 'recebimento')
      .maybeSingle();

    if (!receivement) {
      changes.push(`Invoice ${invoice.id} marked as paid but no receivement entry`);
    }
  }

  log(`Found ${changes.length} reconciliation issues`);
  return { success: true, changes };
}

/**
 * Helper function para chamar IA (suporta Gemini direto e Lovable)
 */
async function callAI(apiKey: string, provider: 'gemini' | 'lovable', systemPrompt: string, userPrompt: string) {
  if (provider === 'gemini') {
    // Chamar Gemini diretamente via API do Google
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    // Chamar via Lovable Gateway
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // model moved to URL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Lovable API error: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  }
}

/**
 * GENERATE INSIGHTS - Usa IA para gerar insights
 */
async function generateInsights(supabase: any, aiKey: string | undefined, provider: 'gemini' | 'lovable', log: LogFn) {
  if (!aiKey) {
    return { success: false, error: 'AI key not configured' };
  }

  log(`Gathering data for insights (using ${provider})...`);

  // Buscar dados agregados
  let invoiceSummary = null;
  let expenseSummary = null;
  try {
    const { data } = await supabase.rpc('get_invoice_summary');
    invoiceSummary = data;
  } catch { /* RPC may not exist */ }
  try {
    const { data } = await supabase.rpc('get_expense_summary');
    expenseSummary = data;
  } catch { /* RPC may not exist */ }

  const { count: totalClients } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  const { count: overdueInvoices } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'overdue');

  const context = {
    totalClients,
    overdueInvoices,
    invoiceSummary,
    expenseSummary
  };

  log('Calling AI for insights...');

  try {
    const content = await callAI(
      aiKey,
      provider,
      `Você é um consultor financeiro especializado em escritórios de contabilidade.
      Analise os dados e forneça 3-5 insights acionáveis em português.
      Seja direto e prático. Foque em oportunidades de melhoria.`,
      `Analise estes dados e forneça insights:
      ${JSON.stringify(context, null, 2)}

      Retorne em formato JSON: { "insights": [{ "title": "...", "description": "...", "priority": "high|medium|low" }] }`
    );

    try {
      const insights = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
      return { success: true, insights, provider };
    } catch {
      return { success: true, insights: [{ title: 'Análise', description: content, priority: 'medium' }], provider };
    }
  } catch (error: any) {
    log(`AI error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * AUTO CATEGORIZE - Categoriza transações automaticamente
 */
async function autoCategorize(supabase: any, aiKey: string | undefined, provider: 'gemini' | 'lovable', log: LogFn) {
  if (!aiKey) {
    return { success: false, error: 'AI key not configured' };
  }

  log(`Finding uncategorized transactions (using ${provider})...`);

  // Buscar transações sem categoria
  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('id, description, amount, transaction_type')
    .is('category', null)
    .limit(20);

  if (!transactions || transactions.length === 0) {
    return { success: true, categorized: 0, message: 'No uncategorized transactions', provider };
  }

  log(`Found ${transactions.length} uncategorized transactions`);

  // Buscar categorias existentes
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, name')
    .eq('is_active', true);

  const categoryList = (categories || []).map((c: any) => c.name).join(', ');

  let categorized = 0;

  for (const tx of transactions) {
    try {
      const suggestedCategory = await callAI(
        aiKey,
        provider,
        `Categorize transações bancárias. Categorias disponíveis: ${categoryList}. Retorne APENAS o nome da categoria mais apropriada, sem explicações.`,
        `Descrição: ${tx.description}\nValor: R$ ${tx.amount}\nTipo: ${tx.transaction_type}`
      );

      // Encontrar ID da categoria
      const category = (categories || []).find((c: any) =>
        c.name.toLowerCase() === suggestedCategory.trim().toLowerCase()
      );

      if (category) {
        await supabase
          .from('bank_transactions')
          .update({ category: category.name, category_id: category.id })
          .eq('id', tx.id);
        categorized++;
      }
    } catch (e) {
      log(`Error categorizing ${tx.id}: ${e}`);
    }
  }

  return { success: true, categorized, total: transactions.length, provider };
}

/**
 * PREDICT CASH FLOW - Prevê fluxo de caixa
 */
async function predictCashFlow(supabase: any, aiKey: string | undefined, provider: 'gemini' | 'lovable', log: LogFn) {
  if (!aiKey) {
    return { success: false, error: 'AI key not configured' };
  }

  log(`Gathering historical data (using ${provider})...`);

  // Buscar dados históricos dos últimos 6 meses
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('amount, due_date, status, payment_date')
    .gte('due_date', sixMonthsAgo.toISOString().split('T')[0]);

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, due_date, status, payment_date')
    .gte('due_date', sixMonthsAgo.toISOString().split('T')[0]);

  const context = {
    invoices: invoices?.slice(0, 100) || [],
    expenses: expenses?.slice(0, 100) || [],
    currentDate: new Date().toISOString().split('T')[0]
  };

  log('Calling AI for cash flow prediction...');

  try {
    const content = await callAI(
      aiKey,
      provider,
      `Você é um analista financeiro. Analise os dados históricos e faça uma previsão
      de fluxo de caixa para os próximos 3 meses.

      Considere:
      - Padrões de pagamento dos clientes
      - Sazonalidade
      - Taxa de inadimplência histórica

      Retorne em JSON: {
        "prediction": [{ "month": "2024-01", "expected_income": 0, "expected_expense": 0, "net": 0 }],
        "confidence": "high|medium|low",
        "insights": "..."
      }`,
      JSON.stringify(context)
    );

    try {
      const prediction = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
      return { success: true, ...prediction, provider };
    } catch {
      return { success: true, rawPrediction: content, provider };
    }
  } catch (error: any) {
    log(`AI error: ${error.message}`);
    return { success: false, error: error.message };
  }
}
