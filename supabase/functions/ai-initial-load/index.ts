import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI INITIAL LOAD - Carga Inicial Janeiro/2025
 *
 * Processa todos os dados existentes e gera:
 * 1. Lançamentos de saldo de abertura no Livro Diário
 * 2. Lançamentos de boletos de janeiro/2025
 * 3. Processamento do extrato bancário
 * 4. Balancete e Balanço de abertura
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[AI-InitialLoad] ${msg}`);
    logs.push(`${new Date().toISOString()} - ${msg}`);
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Suporte a múltiplas APIs de IA
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const AI_PROVIDER = GEMINI_API_KEY ? 'gemini' : 'lovable';
    const AI_KEY = GEMINI_API_KEY || GEMINI_API_KEY;

    log(`🚀 AI Initial Load started (using ${AI_PROVIDER})`);
    log(`📅 Processing initial load for January 2025`);

    const { action } = await req.json();

    let result: any = { success: true, action };

    switch (action) {
      case 'full_initial_load':
        // Executa carga completa
        result = await fullInitialLoad(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'process_opening_balances':
        result = await processOpeningBalances(supabase, log);
        break;

      case 'process_january_invoices':
        result = await processJanuaryInvoices(supabase, log);
        break;

      case 'process_bank_statement':
        result = await processBankStatement(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'generate_opening_reports':
        result = await generateOpeningReports(supabase, log);
        break;

      case 'setup_chart_of_accounts':
        result = await setupChartOfAccounts(supabase, log);
        break;

      case 'validate_bank_balance':
        result = await validateBankBalance(supabase, log);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const executionTime = Date.now() - startTime;
    log(`✅ Completed in ${executionTime}ms`);

    return new Response(
      JSON.stringify({ ...result, executionTime, logs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error: ${errorMsg}`);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg, logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * CARGA INICIAL COMPLETA
 */
async function fullInitialLoad(supabase: any, aiKey: string | undefined, provider: string, log: (...args: unknown[]) => void) {
  log('🔄 Starting full initial load for January 2025...');

  const results: any = {};

  // 1. Configurar plano de contas completo
  log('📋 Step 1: Setting up chart of accounts...');
  results.chartOfAccounts = await setupChartOfAccounts(supabase, log);

  // 2. Processar saldos de abertura
  log('💰 Step 2: Processing opening balances...');
  results.openingBalances = await processOpeningBalances(supabase, log);

  // 3. Processar boletos de janeiro/2025
  log('📄 Step 3: Processing January 2025 invoices...');
  results.januaryInvoices = await processJanuaryInvoices(supabase, log);

  // 4. Processar extrato bancário
  log('🏦 Step 4: Processing bank statement...');
  results.bankStatement = await processBankStatement(supabase, aiKey, provider, log);

  // 5. Gerar relatórios de abertura
  log('📊 Step 5: Generating opening reports...');
  results.openingReports = await generateOpeningReports(supabase, log);

  return {
    success: true,
    action: 'full_initial_load',
    ...results
  };
}

/**
 * CONFIGURAR PLANO DE CONTAS COMPLETO
 */
async function setupChartOfAccounts(supabase: any, log: (...args: unknown[]) => void) {
  log('Setting up complete chart of accounts...');

  // Plano de contas completo para escritório contábil
  const accounts = [
    // ATIVO
    { code: '1', name: 'ATIVO', type: 'asset', nature: 'debit', accepts_entries: false },
    { code: '1.1', name: 'ATIVO CIRCULANTE', type: 'asset', nature: 'debit', accepts_entries: false },
    { code: '1.1.1', name: 'Caixa e Equivalentes', type: 'asset', nature: 'debit', accepts_entries: false },
    { code: '1.1.1.01', name: 'Caixa Geral', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.1.1.02', name: 'Banco Sicredi C/C', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.1.1.03', name: 'Banco Sicredi Poupança', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.1.1.04', name: 'Aplicações Financeiras', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.1.2', name: 'Clientes a Receber', type: 'asset', nature: 'debit', accepts_entries: false },
    { code: '1.1.2.01', name: 'Honorários a Receber', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.1.2.02', name: 'Saldo de Abertura Clientes', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.1.3', name: 'Outros Créditos', type: 'asset', nature: 'debit', accepts_entries: false },
    { code: '1.1.3.01', name: 'Adiantamentos a Fornecedores', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.1.3.02', name: 'Impostos a Recuperar', type: 'asset', nature: 'debit', accepts_entries: true },

    { code: '1.2', name: 'ATIVO NÃO CIRCULANTE', type: 'asset', nature: 'debit', accepts_entries: false },
    { code: '1.2.1', name: 'Imobilizado', type: 'asset', nature: 'debit', accepts_entries: false },
    { code: '1.2.1.01', name: 'Móveis e Utensílios', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.2.1.02', name: 'Equipamentos de Informática', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.2.1.03', name: 'Veículos', type: 'asset', nature: 'debit', accepts_entries: true },
    { code: '1.2.1.99', name: '(-) Depreciação Acumulada', type: 'asset', nature: 'credit', accepts_entries: true },

    // PASSIVO
    { code: '2', name: 'PASSIVO', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.1', name: 'PASSIVO CIRCULANTE', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.1.1', name: 'Fornecedores', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.1.1.01', name: 'Fornecedores a Pagar', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.2', name: 'Obrigações Trabalhistas', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.1.2.01', name: 'Salários a Pagar', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.2.02', name: 'INSS a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.2.03', name: 'FGTS a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.2.04', name: 'IRRF a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.3', name: 'Obrigações Tributárias', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.1.3.01', name: 'ISS a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.3.02', name: 'PIS a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.3.03', name: 'COFINS a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.3.04', name: 'IRPJ a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.3.05', name: 'CSLL a Recolher', type: 'liability', nature: 'credit', accepts_entries: true },
    { code: '2.1.4', name: 'Outras Obrigações', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.1.4.01', name: 'Adiantamento de Clientes', type: 'liability', nature: 'credit', accepts_entries: true },

    { code: '2.2', name: 'PASSIVO NÃO CIRCULANTE', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.2.1', name: 'Empréstimos e Financiamentos', type: 'liability', nature: 'credit', accepts_entries: false },
    { code: '2.2.1.01', name: 'Empréstimos Bancários LP', type: 'liability', nature: 'credit', accepts_entries: true },

    // RECEITAS
    { code: '3', name: 'RECEITAS', type: 'revenue', nature: 'credit', accepts_entries: false, is_result_account: true },
    { code: '3.1', name: 'RECEITAS OPERACIONAIS', type: 'revenue', nature: 'credit', accepts_entries: false, is_result_account: true },
    { code: '3.1.1', name: 'Receita de Serviços', type: 'revenue', nature: 'credit', accepts_entries: false, is_result_account: true },
    { code: '3.1.1.01', name: 'Honorários Contábeis', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },
    { code: '3.1.1.02', name: 'Honorários Fiscais', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },
    { code: '3.1.1.03', name: 'Honorários Trabalhistas', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },
    { code: '3.1.1.04', name: 'Consultoria', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },
    { code: '3.1.1.05', name: '13º Honorário', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },
    { code: '3.2', name: 'RECEITAS FINANCEIRAS', type: 'revenue', nature: 'credit', accepts_entries: false, is_result_account: true },
    { code: '3.2.1', name: 'Rendimentos Aplicações', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },
    { code: '3.2.2', name: 'Juros Recebidos', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },
    { code: '3.2.3', name: 'Descontos Obtidos', type: 'revenue', nature: 'credit', accepts_entries: true, is_result_account: true },

    // DESPESAS
    { code: '4', name: 'DESPESAS', type: 'expense', nature: 'debit', accepts_entries: false, is_result_account: true },
    { code: '4.1', name: 'DESPESAS ADMINISTRATIVAS', type: 'expense', nature: 'debit', accepts_entries: false, is_result_account: true },
    { code: '4.1.1', name: 'Aluguel', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.2', name: 'Energia Elétrica', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.3', name: 'Água e Esgoto', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.4', name: 'Telefone e Internet', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.5', name: 'Material de Escritório', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.6', name: 'Material de Limpeza', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.7', name: 'Manutenção e Reparos', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.8', name: 'Seguros', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.9', name: 'Sistemas e Softwares', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.1.10', name: 'Assinaturas e Anuidades', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },

    { code: '4.2', name: 'DESPESAS COM PESSOAL', type: 'expense', nature: 'debit', accepts_entries: false, is_result_account: true },
    { code: '4.2.1', name: 'Salários', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.2.2', name: 'INSS Patronal', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.2.3', name: 'FGTS', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.2.4', name: 'Vale Transporte', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.2.5', name: 'Vale Alimentação', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.2.6', name: 'Plano de Saúde', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.2.7', name: 'Férias e 13º Salário', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.2.8', name: 'Pro-Labore', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },

    { code: '4.3', name: 'DESPESAS TRIBUTÁRIAS', type: 'expense', nature: 'debit', accepts_entries: false, is_result_account: true },
    { code: '4.3.1', name: 'ISS', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.3.2', name: 'PIS', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.3.3', name: 'COFINS', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.3.4', name: 'IRPJ', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.3.5', name: 'CSLL', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.3.6', name: 'Taxas e Multas', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },

    { code: '4.4', name: 'DESPESAS FINANCEIRAS', type: 'expense', nature: 'debit', accepts_entries: false, is_result_account: true },
    { code: '4.4.1', name: 'Juros Pagos', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.4.2', name: 'Tarifas Bancárias', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.4.3', name: 'IOF', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.4.4', name: 'Descontos Concedidos', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },

    { code: '4.5', name: 'DESPESAS COM VEÍCULOS', type: 'expense', nature: 'debit', accepts_entries: false, is_result_account: true },
    { code: '4.5.1', name: 'Combustível', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.5.2', name: 'Manutenção Veículos', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.5.3', name: 'Seguro Veículos', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.5.4', name: 'IPVA e Licenciamento', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },

    { code: '4.9', name: 'OUTRAS DESPESAS', type: 'expense', nature: 'debit', accepts_entries: false, is_result_account: true },
    { code: '4.9.1', name: 'Despesas Diversas', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },
    { code: '4.9.2', name: 'Depreciação', type: 'expense', nature: 'debit', accepts_entries: true, is_result_account: true },

    // PATRIMÔNIO LÍQUIDO
    { code: '5', name: 'PATRIMÔNIO LÍQUIDO', type: 'equity', nature: 'credit', accepts_entries: false },
    { code: '5.1', name: 'Apuração do Resultado', type: 'equity', nature: 'credit', accepts_entries: true },
    { code: '5.2', name: 'Lucros Acumulados', type: 'equity', nature: 'credit', accepts_entries: true },
    { code: '5.3', name: 'Prejuízos Acumulados', type: 'equity', nature: 'debit', accepts_entries: true },
    { code: '5.4', name: 'Capital Social', type: 'equity', nature: 'credit', accepts_entries: true },
    { code: '5.5', name: 'Reservas de Capital', type: 'equity', nature: 'credit', accepts_entries: true },
    { code: '5.6', name: 'Saldo de Abertura', type: 'equity', nature: 'credit', accepts_entries: true },
  ];

  let created = 0;
  let updated = 0;

  for (const account of accounts) {
    const { data: existing } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', account.code)
      .single();

    if (existing) {
      await supabase
        .from('chart_of_accounts')
        .update(account)
        .eq('code', account.code);
      updated++;
    } else {
      await supabase
        .from('chart_of_accounts')
        .insert(account);
      created++;
    }
  }

  log(`✅ Chart of accounts: ${created} created, ${updated} updated`);

  return { success: true, created, updated, total: accounts.length };
}

/**
 * PROCESSAR SALDOS DE ABERTURA
 */
async function processOpeningBalances(supabase: any, log: (...args: unknown[]) => void) {
  log('Processing opening balances...');

  // Buscar saldos de abertura de clientes
  const { data: openingBalances, error } = await supabase
    .from('client_opening_balance')
    .select(`
      *,
      clients(name)
    `);

  if (error) throw error;

  log(`Found ${openingBalances?.length || 0} opening balances to process`);

  if (!openingBalances || openingBalances.length === 0) {
    return { success: true, processed: 0, message: 'No opening balances found' };
  }

  // Buscar conta de saldo de abertura
  const { data: openingAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.02')
    .single();

  const { data: equityAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '5.6')
    .single();

  if (!openingAccount || !equityAccount) {
    throw new Error('Opening balance accounts not found in chart of accounts');
  }

  let processed = 0;
  let totalAmount = 0;

  // Criar lançamento de abertura consolidado
  const entryDate = '2025-01-01';

  // Criar entrada do diário
  const { data: journalEntry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      entry_date: entryDate,
      competence: '2025-01',
      description: 'Saldo de Abertura - Clientes a Receber',
      document_type: 'opening_balance',
      fiscal_year: 2025,
      ai_generated: true,
      is_closing_entry: false,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single();

  if (entryError) throw entryError;

  const lines: any[] = [];
  let lineNumber = 1;

  for (const balance of openingBalances) {
    if (!balance.amount || balance.amount <= 0) continue;

    const clientName = balance.clients?.name || 'Cliente';

    // Linha de débito - Clientes a Receber
    lines.push({
      journal_entry_id: journalEntry.id,
      line_number: lineNumber++,
      account_id: openingAccount.id,
      account_code: '1.1.2.02',
      account_name: 'Saldo de Abertura Clientes',
      debit_amount: balance.amount,
      credit_amount: 0,
      description: `Saldo abertura - ${clientName}`,
      client_id: balance.client_id
    });

    totalAmount += balance.amount;
    processed++;
  }

  // Linha de crédito - Saldo de Abertura (PL)
  if (totalAmount > 0) {
    lines.push({
      journal_entry_id: journalEntry.id,
      line_number: lineNumber,
      account_id: equityAccount.id,
      account_code: '5.6',
      account_name: 'Saldo de Abertura',
      debit_amount: 0,
      credit_amount: totalAmount,
      description: 'Contrapartida saldo abertura clientes'
    });
  }

  // Inserir linhas
  if (lines.length > 0) {
    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines);

    if (linesError) throw linesError;
  }

  // Atualizar totais do lançamento
  await supabase
    .from('journal_entries')
    .update({
      total_debit: totalAmount,
      total_credit: totalAmount
    })
    .eq('id', journalEntry.id);

  log(`✅ Opening balances processed: ${processed} clients, Total: R$ ${totalAmount.toFixed(2)}`);

  return {
    success: true,
    processed,
    total_amount: totalAmount,
    journal_entry_id: journalEntry.id
  };
}

/**
 * PROCESSAR BOLETOS DE JANEIRO/2025
 */
async function processJanuaryInvoices(supabase: any, log: (...args: unknown[]) => void) {
  log('Processing January 2025 invoices...');

  // Buscar faturas de janeiro/2025
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(name)
    `)
    .eq('competence', '2025-01')
    .order('due_date');

  if (error) throw error;

  log(`Found ${invoices?.length || 0} invoices for January 2025`);

  if (!invoices || invoices.length === 0) {
    return { success: true, processed: 0, message: 'No January invoices found' };
  }

  // Buscar contas
  const { data: receivableAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: revenueAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.1.01')
    .single();

  if (!receivableAccount || !revenueAccount) {
    throw new Error('Required accounts not found');
  }

  let processed = 0;
  let totalAmount = 0;

  for (const invoice of invoices) {
    try {
      // Verificar se já tem lançamento
      const { data: existingEntry } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('document_id', invoice.id)
        .eq('document_type', 'invoice')
        .single();

      if (existingEntry) {
        log(`Invoice ${invoice.id} already has journal entry, skipping`);
        continue;
      }

      const clientName = invoice.clients?.name || 'Cliente';
      const entryDate = invoice.due_date || '2025-01-10';

      // Criar lançamento
      const { data: journalEntry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: entryDate,
          competence: '2025-01',
          description: `Honorários 01/2025 - ${clientName}`,
          document_type: 'invoice',
          document_id: invoice.id,
          fiscal_year: 2025,
          ai_generated: true,
          total_debit: invoice.amount,
          total_credit: invoice.amount,
          created_by: '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Criar linhas
      await supabase.from('journal_entry_lines').insert([
        {
          journal_entry_id: journalEntry.id,
          line_number: 1,
          account_id: receivableAccount.id,
          account_code: '1.1.2.01',
          account_name: 'Honorários a Receber',
          debit_amount: invoice.amount,
          credit_amount: 0,
          description: `Fatura ${invoice.competence}`,
          client_id: invoice.client_id
        },
        {
          journal_entry_id: journalEntry.id,
          line_number: 2,
          account_id: revenueAccount.id,
          account_code: '3.1.1.01',
          account_name: 'Honorários Contábeis',
          debit_amount: 0,
          credit_amount: invoice.amount,
          description: `Receita honorários ${invoice.competence}`,
          client_id: invoice.client_id
        }
      ]);

      // Atualizar fatura com referência ao lançamento
      await supabase
        .from('invoices')
        .update({ journal_entry_id: journalEntry.id })
        .eq('id', invoice.id);

      processed++;
      totalAmount += invoice.amount;

      log(`✅ Invoice processed: ${clientName} - R$ ${invoice.amount}`);

    } catch (err: any) {
      log(`❌ Error processing invoice: ${err.message}`);
    }
  }

  log(`✅ January invoices processed: ${processed}, Total: R$ ${totalAmount.toFixed(2)}`);

  return {
    success: true,
    processed,
    total: invoices.length,
    total_amount: totalAmount
  };
}

/**
 * PROCESSAR EXTRATO BANCÁRIO
 */
async function processBankStatement(supabase: any, aiKey: string | undefined, provider: string, log: (...args: unknown[]) => void) {
  log('Processing bank statement for January 2025...');

  // Buscar transações bancárias de janeiro/2025
  const { data: transactions, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  if (error) throw error;

  log(`Found ${transactions?.length || 0} bank transactions for January 2025`);

  if (!transactions || transactions.length === 0) {
    // Criar conta bancária com saldo inicial se não houver transações
    log('No bank transactions found. Setting up bank account...');

    return {
      success: true,
      message: 'No bank transactions to process',
      note: 'Upload bank statement to process'
    };
  }

  // Buscar contas
  const { data: bankAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.02')
    .single();

  const { data: revenueAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.1.05') // 13º Honorário para recebimentos de janeiro
    .single();

  const { data: receivableAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  if (!bankAccount) {
    throw new Error('Bank account not found in chart of accounts');
  }

  let processed = 0;
  let totalCredits = 0;
  let totalDebits = 0;

  // Processar primeiro o saldo inicial (se houver)
  const initialBalance = transactions.find((t: any) =>
    t.description?.toLowerCase().includes('saldo') ||
    t.description?.toLowerCase().includes('anterior')
  );

  if (initialBalance && initialBalance.transaction_type === 'credit') {
    // Lançamento de saldo inicial do banco
    const { data: equityAccount } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '5.6')
      .single();

    if (equityAccount) {
      const { data: journalEntry } = await supabase
        .from('journal_entries')
        .insert({
          entry_date: '2025-01-01',
          competence: '2025-01',
          description: 'Saldo de Abertura - Banco Sicredi',
          document_type: 'opening_balance',
          document_id: initialBalance.id,
          fiscal_year: 2025,
          ai_generated: true,
          total_debit: initialBalance.amount,
          total_credit: initialBalance.amount,
          created_by: '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (journalEntry) {
        await supabase.from('journal_entry_lines').insert([
          {
            journal_entry_id: journalEntry.id,
            line_number: 1,
            account_id: bankAccount.id,
            account_code: '1.1.1.02',
            account_name: 'Banco Sicredi C/C',
            debit_amount: initialBalance.amount,
            credit_amount: 0,
            description: 'Saldo inicial banco'
          },
          {
            journal_entry_id: journalEntry.id,
            line_number: 2,
            account_id: equityAccount.id,
            account_code: '5.6',
            account_name: 'Saldo de Abertura',
            debit_amount: 0,
            credit_amount: initialBalance.amount,
            description: 'Contrapartida saldo banco'
          }
        ]);

        log(`✅ Bank opening balance: R$ ${initialBalance.amount}`);
        processed++;
      }
    }
  }

  // Processar entradas de dinheiro (provavelmente 13º e honorários 12/2024)
  for (const transaction of transactions) {
    if (transaction.id === initialBalance?.id) continue; // Já processado
    if (transaction.matched) continue; // Já conciliado

    try {
      // Verificar se já tem lançamento
      const { data: existingEntry } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('document_id', transaction.id)
        .single();

      if (existingEntry) continue;

      if (transaction.transaction_type === 'credit') {
        // Entrada de dinheiro - provavelmente recebimento de honorários
        // Como são de 12/2024 ou 13º, não vamos fazer controle detalhado
        // Apenas registrar como receita de período anterior

        const { data: journalEntry } = await supabase
          .from('journal_entries')
          .insert({
            entry_date: transaction.transaction_date,
            competence: '2025-01',
            description: `Recebimento - ${transaction.description || 'Honorários período anterior'}`,
            document_type: 'bank_receipt',
            document_id: transaction.id,
            fiscal_year: 2025,
            ai_generated: true,
            total_debit: transaction.amount,
            total_credit: transaction.amount,
            notes: 'Recebimento de 13º ou honorários 12/2024 - sem controle individual',
            created_by: '00000000-0000-0000-0000-000000000000'
          })
          .select()
          .single();

        if (journalEntry) {
          // D - Banco / C - Receita 13º (simplificado)
          await supabase.from('journal_entry_lines').insert([
            {
              journal_entry_id: journalEntry.id,
              line_number: 1,
              account_id: bankAccount.id,
              account_code: '1.1.1.02',
              account_name: 'Banco Sicredi C/C',
              debit_amount: transaction.amount,
              credit_amount: 0,
              description: transaction.description
            },
            {
              journal_entry_id: journalEntry.id,
              line_number: 2,
              account_id: revenueAccount?.id || receivableAccount?.id,
              account_code: revenueAccount ? '3.1.1.05' : '1.1.2.01',
              account_name: revenueAccount ? '13º Honorário' : 'Honorários a Receber',
              debit_amount: 0,
              credit_amount: transaction.amount,
              description: 'Recebimento período anterior'
            }
          ]);

          totalCredits += transaction.amount;
        }
      } else {
        // Saída de dinheiro - despesa
        totalDebits += transaction.amount;
      }

      processed++;

    } catch (err: any) {
      log(`❌ Error processing transaction: ${err.message}`);
    }
  }

  log(`✅ Bank transactions processed: ${processed}`);
  log(`📈 Total credits: R$ ${totalCredits.toFixed(2)}`);
  log(`📉 Total debits: R$ ${totalDebits.toFixed(2)}`);

  return {
    success: true,
    processed,
    total: transactions.length,
    total_credits: totalCredits,
    total_debits: totalDebits
  };
}

/**
 * GERAR RELATÓRIOS DE ABERTURA
 */
async function generateOpeningReports(supabase: any, log: (...args: unknown[]) => void) {
  log('Generating opening reports...');

  // Atualizar razão contábil
  try {
    await supabase.rpc('refresh_account_ledger');
    log('✅ Account ledger refreshed');
  } catch {
    log('⚠️ Could not refresh ledger');
  }

  // Gerar balancete de janeiro/2025
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type, nature')
    .eq('accepts_entries', true)
    .order('code');

  // Buscar movimentos de janeiro
  const { data: movements } = await supabase
    .from('journal_entry_lines')
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      journal_entries!inner(entry_date, competence)
    `)
    .eq('journal_entries.competence', '2025-01');

  // Agregar por conta
  const accountMovements: Record<string, { debit: number; credit: number }> = {};
  for (const mov of movements || []) {
    if (!accountMovements[mov.account_id]) {
      accountMovements[mov.account_id] = { debit: 0, credit: 0 };
    }
    accountMovements[mov.account_id].debit += mov.debit_amount || 0;
    accountMovements[mov.account_id].credit += mov.credit_amount || 0;
  }

  // Criar balancete
  const { data: trialBalance, error: tbError } = await supabase
    .from('trial_balances')
    .insert({
      period_type: 'monthly',
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      competence: '2025-01',
      fiscal_year: 2025,
      status: 'draft',
      ai_generated: true,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single();

  if (tbError) throw tbError;

  // Criar linhas
  const lines = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of accounts || []) {
    const mov = accountMovements[account.id] || { debit: 0, credit: 0 };

    if (mov.debit === 0 && mov.credit === 0) continue;

    const balance = account.nature === 'debit'
      ? mov.debit - mov.credit
      : mov.credit - mov.debit;

    lines.push({
      trial_balance_id: trialBalance.id,
      account_id: account.id,
      account_code: account.code,
      account_name: account.name,
      account_type: account.type,
      account_nature: account.nature,
      previous_balance: 0,
      debit_movement: mov.debit,
      credit_movement: mov.credit,
      current_balance: balance
    });

    totalDebit += mov.debit;
    totalCredit += mov.credit;
  }

  if (lines.length > 0) {
    await supabase.from('trial_balance_lines').insert(lines);
  }

  // Atualizar totais
  await supabase
    .from('trial_balances')
    .update({ total_debit: totalDebit, total_credit: totalCredit })
    .eq('id', trialBalance.id);

  log(`✅ Trial balance generated: ${lines.length} accounts`);
  log(`📊 Total Debit: R$ ${totalDebit.toFixed(2)}`);
  log(`📊 Total Credit: R$ ${totalCredit.toFixed(2)}`);
  log(`${Math.abs(totalDebit - totalCredit) < 0.01 ? '✅' : '⚠️'} Balanced: ${Math.abs(totalDebit - totalCredit) < 0.01}`);

  // Gerar balanço de abertura
  const { data: balanceSheet } = await supabase
    .from('balance_sheets')
    .insert({
      reference_date: '2025-01-31',
      fiscal_year: 2025,
      status: 'draft',
      ai_generated: true,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single();

  if (balanceSheet) {
    // Calcular totais por grupo
    let totalCurrentAssets = 0;
    let totalEquity = 0;

    for (const line of lines) {
      if (line.account_code.startsWith('1.1')) {
        totalCurrentAssets += line.current_balance;
      } else if (line.account_code.startsWith('5.')) {
        totalEquity += line.current_balance;
      }
    }

    await supabase
      .from('balance_sheets')
      .update({
        total_current_assets: totalCurrentAssets,
        total_equity: totalEquity
      })
      .eq('id', balanceSheet.id);

    log(`✅ Balance sheet generated`);
    log(`📊 Total Assets: R$ ${totalCurrentAssets.toFixed(2)}`);
    log(`📊 Total Equity: R$ ${totalEquity.toFixed(2)}`);
  }

  return {
    success: true,
    trial_balance_id: trialBalance.id,
    balance_sheet_id: balanceSheet?.id,
    accounts_with_movement: lines.length,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01
    }
  };
}

/**
 * VALIDAR SALDO BANCÁRIO COM EXTRATO
 * Compara o saldo contábil com o saldo do extrato bancário
 * para garantir que os lançamentos estão corretos
 */
async function validateBankBalance(supabase: any, log: (...args: unknown[]) => void) {
  log('Validating bank balance against statement...');

  // 1. Buscar saldo contábil do banco (soma de todos os lançamentos)
  const { data: bankAccount } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.02')
    .single();

  if (!bankAccount) {
    throw new Error('Bank account 1.1.1.02 not found');
  }

  // Buscar todos os lançamentos do banco
  const { data: journalLines } = await supabase
    .from('journal_entry_lines')
    .select('debit_amount, credit_amount')
    .eq('account_id', bankAccount.id);

  let accountingBalance = 0;
  for (const line of journalLines || []) {
    accountingBalance += (line.debit_amount || 0) - (line.credit_amount || 0);
  }

  log(`📊 Saldo Contábil do Banco: R$ ${accountingBalance.toFixed(2)}`);

  // 2. Buscar saldo do extrato bancário (última transação ou saldo declarado)
  const { data: lastTransaction } = await supabase
    .from('bank_transactions')
    .select('balance, transaction_date, amount, transaction_type')
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single();

  let statementBalance = 0;

  if (lastTransaction) {
    if (lastTransaction.balance) {
      // Se temos o saldo no extrato, usar diretamente
      statementBalance = lastTransaction.balance;
    } else {
      // Calcular saldo baseado nas transações
      const { data: allTransactions } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_type');

      for (const tx of allTransactions || []) {
        if (tx.transaction_type === 'credit') {
          statementBalance += tx.amount || 0;
        } else {
          statementBalance -= tx.amount || 0;
        }
      }
    }

    log(`📊 Saldo do Extrato: R$ ${statementBalance.toFixed(2)}`);
  } else {
    log('⚠️ Nenhuma transação bancária encontrada');
    return {
      success: true,
      validated: false,
      message: 'Sem transações bancárias para validar',
      accounting_balance: accountingBalance,
      statement_balance: 0
    };
  }

  // 3. Comparar saldos
  const difference = Math.abs(accountingBalance - statementBalance);
  const isBalanced = difference < 0.01;

  if (isBalanced) {
    log(`✅ Saldos conferem! Diferença: R$ ${difference.toFixed(2)}`);
  } else {
    log(`⚠️ DIFERENÇA DETECTADA: R$ ${difference.toFixed(2)}`);
    log(`   Contábil: R$ ${accountingBalance.toFixed(2)}`);
    log(`   Extrato:  R$ ${statementBalance.toFixed(2)}`);

    // Tentar identificar a origem da diferença
    if (accountingBalance > statementBalance) {
      log('   → Há lançamentos a mais na contabilidade (ou faltam saídas no extrato)');
    } else {
      log('   → Há lançamentos faltando na contabilidade (ou faltam entradas no extrato)');
    }
  }

  // 4. Buscar detalhamento para análise
  const { data: bankTransactions } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, amount, transaction_type, description, matched')
    .order('transaction_date');

  const unmatched = (bankTransactions || []).filter((tx: any) => !tx.matched);

  if (unmatched.length > 0) {
    log(`📌 ${unmatched.length} transações não conciliadas`);
  }

  // 5. Verificar se há ajuste necessário
  let adjustment = null;
  if (!isBalanced && difference > 0) {
    adjustment = {
      type: accountingBalance > statementBalance ? 'remove' : 'add',
      amount: difference,
      suggestion: accountingBalance > statementBalance
        ? 'Verificar lançamentos duplicados ou saídas não registradas no extrato'
        : 'Verificar entradas não lançadas ou estorno de saídas'
    };
    log(`💡 Sugestão: ${adjustment.suggestion}`);
  }

  return {
    success: true,
    validated: isBalanced,
    accounting_balance: accountingBalance,
    statement_balance: statementBalance,
    difference,
    unmatched_transactions: unmatched.length,
    adjustment,
    message: isBalanced
      ? 'Saldos conferem perfeitamente'
      : `Diferença de R$ ${difference.toFixed(2)} detectada`
  };
}
