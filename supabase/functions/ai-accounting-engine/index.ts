import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI ACCOUNTING ENGINE
 *
 * Motor contábil inteligente que:
 * 1. Processa todos os eventos e gera lançamentos no Livro Diário
 * 2. Mantém o Razão Contábil atualizado
 * 3. Gera Balancetes mensais/trimestrais/anuais
 * 4. Executa Apuração de Resultado (ARE) em 31/12
 * 5. Gera Balanço Patrimonial
 * 6. Provisiona honorários automaticamente
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[AI-Accounting] ${msg}`);
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

    log(`🧮 AI Accounting Engine started (using ${AI_PROVIDER})`);

    const { action, params } = await req.json();

    let result: any = { success: true, action };

    switch (action) {
      case 'process_all_pending':
        result = await processAllPending(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'process_invoices':
        result = await processInvoices(supabase, log);
        break;

      case 'process_expenses':
        result = await processExpenses(supabase, log);
        break;

      case 'process_contracts':
        result = await processContracts(supabase, log);
        break;

      case 'provision_monthly_fees':
        result = await provisionMonthlyFees(supabase, params?.competence, log);
        break;

      case 'generate_trial_balance':
        result = await generateTrialBalance(supabase, params?.period_type, params?.competence, log);
        break;

      case 'close_fiscal_year':
        result = await closeFiscalYear(supabase, params?.fiscal_year, AI_KEY, AI_PROVIDER, log);
        break;

      case 'generate_balance_sheet':
        result = await generateBalanceSheet(supabase, params?.fiscal_year, log);
        break;

      case 'refresh_ledger':
        await supabase.rpc('refresh_account_ledger');
        result = { success: true, message: 'Ledger refreshed' };
        break;

      case 'full_accounting_cycle':
        // Ciclo completo de contabilização
        const pending = await processAllPending(supabase, AI_KEY, AI_PROVIDER, log);
        const currentDate = new Date();
        const currentCompetence = currentDate.toISOString().slice(0, 7);

        // Provisionar honorários do mês
        const provisions = await provisionMonthlyFees(supabase, currentCompetence, log);

        // Gerar balancete mensal
        const trialBalance = await generateTrialBalance(supabase, 'monthly', currentCompetence, log);

        // Se for dezembro, fechar exercício
        let yearClose = null;
        if (currentDate.getMonth() === 11 && currentDate.getDate() === 31) {
          yearClose = await closeFiscalYear(supabase, currentDate.getFullYear(), AI_KEY, AI_PROVIDER, log);
        }

        result = {
          success: true,
          action: 'full_accounting_cycle',
          pending,
          provisions,
          trialBalance,
          yearClose
        };
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
 * Conhecimento das Normas Brasileiras de Contabilidade (NBC) - CFC
 * Usado para garantir que todos os lançamentos automáticos estejam em conformidade
 */
const NBC_KNOWLEDGE = `
## NORMAS BRASILEIRAS DE CONTABILIDADE (NBC) - CFC

### Princípios Fundamentais
1. ENTIDADE: Patrimônio da empresa separado do dos sócios
2. CONTINUIDADE: Pressupõe operação contínua
3. COMPETÊNCIA: Receitas e despesas no período em que ocorrem
4. PRUDÊNCIA: Menor ativo, maior passivo em caso de dúvida

### Regras de Débito e Crédito
- ATIVO (natureza devedora): Aumenta com DÉBITO, diminui com CRÉDITO
- PASSIVO (natureza credora): Aumenta com CRÉDITO, diminui com DÉBITO
- RECEITAS (natureza credora): Aumenta com CRÉDITO
- DESPESAS (natureza devedora): Aumenta com DÉBITO
- PL (natureza credora): Lucros a CRÉDITO, Prejuízos a DÉBITO

### Contas Sintéticas vs Analíticas
- SINTÉTICAS: Apenas agrupam (NÃO recebem lançamentos)
- ANALÍTICAS: Recebem lançamentos diretos

### PARTIDAS MÚLTIPLAS (Lançamentos Compostos)
Um lançamento contábil pode ter MÚLTIPLAS LINHAS de débito e/ou crédito.
A regra fundamental é: SOMA DOS DÉBITOS = SOMA DOS CRÉDITOS

**Exemplos de Partidas Múltiplas:**

1. **Rateio de Despesa (1 crédito, múltiplos débitos):**
   D - Despesa Administrativa     R$ 500,00
   D - Despesa Comercial          R$ 300,00
   D - Despesa Financeira         R$ 200,00
   C - Banco c/ Movimento         R$ 1.000,00

2. **Pagamento a Múltiplos Fornecedores (1 débito bancário, múltiplos créditos):**
   D - Fornecedor A               R$ 500,00
   D - Fornecedor B               R$ 300,00
   C - Banco c/ Movimento         R$ 800,00

3. **Recebimento com Desconto (múltiplos débitos/créditos):**
   D - Banco c/ Movimento         R$ 950,00
   D - Descontos Concedidos       R$ 50,00
   C - Clientes a Receber         R$ 1.000,00

4. **Provisão de Folha (1 crédito, múltiplos débitos):**
   D - Salários                   R$ 10.000,00
   D - INSS Patronal              R$ 2.000,00
   D - FGTS                       R$ 800,00
   C - Salários a Pagar           R$ 10.000,00
   C - INSS a Recolher            R$ 2.000,00
   C - FGTS a Recolher            R$ 800,00

**Validação:**
- TOTAL DÉBITOS deve ser IGUAL a TOTAL CRÉDITOS
- Cada linha pode ter APENAS débito OU crédito (nunca ambos)
- Mínimo de 2 linhas por lançamento

### Livros Contábeis
1. Livro Diário: Cronológico
2. Livro Razão: Por conta
3. Balancete: Verificação de saldos

### Encerramento do Exercício (31/12)
1. Apurar resultado (Receitas - Despesas)
2. Transferir para ARE (Apuração de Resultado)
3. Lucro vai para 5.2 Lucros Acumulados
4. Prejuízo vai para 5.3 Prejuízos Acumulados
5. Zerar contas de resultado para novo exercício
`;

/**
 * Helper: Chamar IA
 */
async function callAI(apiKey: string, provider: string, systemPrompt: string, userPrompt: string) {
  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4000 }
        })
      }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
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
        ]
      }),
    });

    if (!response.ok) throw new Error(`Lovable API error: ${response.status}`);
    const result = await response.json();
    return result.choices[0].message.content;
  }
}

/**
 * Helper: Criar lançamento no Livro Diário
 *
 * SUPORTA PARTIDAS MÚLTIPLAS:
 * - Um lançamento pode ter múltiplas linhas de débito e/ou crédito
 * - A regra é: SOMA(débitos) = SOMA(créditos)
 * - Cada linha deve ter APENAS débito OU crédito (nunca ambos)
 *
 * Exemplos válidos:
 * - 1 débito + 1 crédito (partida simples)
 * - 1 débito + N créditos (ex: recebimento de múltiplos clientes)
 * - N débitos + 1 crédito (ex: rateio de despesa)
 * - N débitos + M créditos (ex: folha de pagamento)
 */
async function createJournalEntry(
  supabase: any,
  data: {
    entry_date: string;
    description: string;
    document_type: string;
    document_id?: string;
    lines: Array<{
      account_code: string;
      debit_amount?: number;
      credit_amount?: number;
      description?: string;
      client_id?: string;
    }>;
    ai_generated?: boolean;
  },
  log: Function
) {
  const fiscalYear = new Date(data.entry_date).getFullYear();
  const competence = data.entry_date.slice(0, 7);

  // Validação de partidas múltiplas
  if (!data.lines || data.lines.length < 2) {
    throw new Error('Lançamento deve ter no mínimo 2 linhas (partida dobrada)');
  }

  // Validar que cada linha tem apenas débito OU crédito
  for (const line of data.lines) {
    const hasDebit = (line.debit_amount || 0) > 0;
    const hasCredit = (line.credit_amount || 0) > 0;

    if (hasDebit && hasCredit) {
      throw new Error(`Linha com conta ${line.account_code} tem débito e crédito. Cada linha deve ter apenas um.`);
    }

    if (!hasDebit && !hasCredit) {
      throw new Error(`Linha com conta ${line.account_code} não tem valor de débito nem crédito.`);
    }
  }

  // Buscar contas pelo código
  const accountCodes = data.lines.map(l => l.account_code);
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .in('code', accountCodes);

  if (accountsError) throw accountsError;

  const accountMap = new Map(accounts.map((a: any) => [a.code, a]));

  // Verificar se todas as contas existem
  for (const line of data.lines) {
    if (!accountMap.has(line.account_code)) {
      throw new Error(`Conta não encontrada: ${line.account_code}`);
    }
  }

  // Calcular totais (PARTIDAS MÚLTIPLAS: soma de todos os débitos e créditos)
  const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
  const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);

  // Validação fundamental: débitos = créditos (tolerância de 0.01 para arredondamentos)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Lançamento desbalanceado: Débitos (R$ ${totalDebit.toFixed(2)}) ≠ Créditos (R$ ${totalCredit.toFixed(2)}). ` +
      `Diferença: R$ ${Math.abs(totalDebit - totalCredit).toFixed(2)}`
    );
  }

  // Criar lançamento
  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      entry_date: data.entry_date,
      competence,
      description: data.description,
      document_type: data.document_type,
      document_id: data.document_id,
      total_debit: totalDebit,
      total_credit: totalCredit,
      fiscal_year: fiscalYear,
      ai_generated: data.ai_generated || false,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single();

  if (entryError) throw entryError;

  // Criar linhas do lançamento
  const lines = data.lines.map((line, index) => {
    const account = accountMap.get(line.account_code)!;
    return {
      journal_entry_id: entry.id,
      line_number: index + 1,
      account_id: account.id,
      account_code: account.code,
      account_name: account.name,
      debit_amount: line.debit_amount || 0,
      credit_amount: line.credit_amount || 0,
      description: line.description,
      client_id: line.client_id
    };
  });

  const { error: linesError } = await supabase
    .from('journal_entry_lines')
    .insert(lines);

  if (linesError) throw linesError;

  log(`📝 Journal entry created: ${entry.id} - ${data.description}`);

  return entry;
}

/**
 * PROCESSAR TODOS OS PENDENTES
 */
async function processAllPending(supabase: any, aiKey: string | undefined, provider: string, log: Function) {
  log('🔄 Processing all pending entries...');

  const results = {
    invoices: await processInvoices(supabase, log),
    expenses: await processExpenses(supabase, log),
    contracts: await processContracts(supabase, log),
    payments: await processPayments(supabase, log)
  };

  // Atualizar razão contábil
  try {
    await supabase.rpc('refresh_account_ledger');
    log('📊 Account ledger refreshed');
  } catch {
    log('⚠️ Could not refresh ledger (may not exist yet)');
  }

  return results;
}

/**
 * PROCESSAR FATURAS (Receitas)
 */
async function processInvoices(supabase: any, log: Function) {
  log('💰 Processing invoices...');

  // Buscar faturas sem lançamento contábil
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      id, client_id, amount, due_date, competence, status, description,
      clients(name)
    `)
    .is('journal_entry_id', null)
    .not('amount', 'is', null)
    .gt('amount', 0);

  if (error) throw error;

  log(`Found ${invoices?.length || 0} invoices to process`);

  let processed = 0;

  for (const invoice of invoices || []) {
    try {
      const entryDate = invoice.due_date || new Date().toISOString().slice(0, 10);
      const clientName = invoice.clients?.name || 'Cliente';

      // Lançamento: D - Clientes a Receber / C - Receita de Serviços
      const entry = await createJournalEntry(supabase, {
        entry_date: entryDate,
        description: `Honorários ${invoice.competence} - ${clientName}`,
        document_type: 'invoice',
        document_id: invoice.id,
        ai_generated: true,
        lines: [
          {
            account_code: '1.1.2.01', // Honorários a Receber
            debit_amount: invoice.amount,
            description: `Fatura ${invoice.competence}`,
            client_id: invoice.client_id
          },
          {
            account_code: '3.1.1.01', // Honorários Contábeis
            credit_amount: invoice.amount,
            description: `Honorários ${invoice.competence}`,
            client_id: invoice.client_id
          }
        ]
      }, log);

      // Atualizar fatura com referência ao lançamento
      await supabase
        .from('invoices')
        .update({ journal_entry_id: entry.id })
        .eq('id', invoice.id);

      processed++;
    } catch (err: any) {
      log(`❌ Error processing invoice ${invoice.id}: ${err.message}`);
    }
  }

  return { success: true, processed, total: invoices?.length || 0 };
}

/**
 * PROCESSAR DESPESAS
 */
async function processExpenses(supabase: any, log: Function) {
  log('💸 Processing expenses...');

  // Buscar despesas sem lançamento contábil
  const { data: expenses, error } = await supabase
    .from('accounts_payable')
    .select('*')
    .is('journal_entry_id', null)
    .not('amount', 'is', null)
    .gt('amount', 0);

  if (error) throw error;

  log(`Found ${expenses?.length || 0} expenses to process`);

  let processed = 0;

  // Mapeamento de categorias para contas contábeis (contas analíticas)
  const categoryAccountMap: Record<string, string> = {
    'Aluguel': '4.1.1',
    'Energia': '4.1.2',
    'Água': '4.1.3',
    'Internet': '4.1.4',
    'Telefone': '4.1.4',
    'Material de Escritório': '4.1.5',
    'Material de Limpeza': '4.1.6',
    'Salários': '4.2.1',
    'INSS': '4.2.2',
    'FGTS': '4.2.3',
    'Vale Transporte': '4.2.4',
    'Vale Alimentação': '4.2.5',
    'Plano de Saúde': '4.2.6',
    'Pro-Labore': '4.2.8',
    'ISS': '4.3.1',
    'PIS': '4.3.2',
    'COFINS': '4.3.3',
    'Impostos': '4.3.6',
    'Taxas': '4.3.6',
    'Juros': '4.4.1',
    'Tarifas Bancárias': '4.4.2',
    'IOF': '4.4.3',
    'Combustível': '4.5.1',
    'Manutenção Veículos': '4.5.2',
    'Sistemas e Softwares': '4.1.9',
    'Assinaturas': '4.1.10',
    'Outras Despesas': '4.9.1',
    'Despesas Diversas': '4.9.1'
  };

  for (const expense of expenses || []) {
    try {
      const entryDate = expense.due_date || new Date().toISOString().slice(0, 10);
      const accountCode = categoryAccountMap[expense.category] || '4.9.1';

      // Lançamento: D - Despesa / C - Fornecedores a Pagar
      const entry = await createJournalEntry(supabase, {
        entry_date: entryDate,
        description: `${expense.description} - ${expense.supplier_name || 'Fornecedor'}`,
        document_type: 'expense',
        document_id: expense.id,
        ai_generated: true,
        lines: [
          {
            account_code: accountCode,
            debit_amount: expense.amount,
            description: expense.description
          },
          {
            account_code: '2.1.1.01', // Fornecedores a Pagar
            credit_amount: expense.amount,
            description: `${expense.supplier_name || 'Fornecedor'}`
          }
        ]
      }, log);

      // Atualizar despesa com referência
      await supabase
        .from('accounts_payable')
        .update({ journal_entry_id: entry.id })
        .eq('id', expense.id);

      processed++;
    } catch (err: any) {
      log(`❌ Error processing expense ${expense.id}: ${err.message}`);
    }
  }

  return { success: true, processed, total: expenses?.length || 0 };
}

/**
 * PROCESSAR CONTRATOS
 */
async function processContracts(supabase: any, log: Function) {
  log('📄 Processing contracts...');

  // Buscar contratos sem lançamento
  const { data: contracts, error } = await supabase
    .from('client_contracts')
    .select(`
      id, client_id, contract_number, monthly_fee, start_date,
      clients(name)
    `)
    .is('journal_entry_id', null)
    .eq('status', 'active')
    .not('monthly_fee', 'is', null)
    .gt('monthly_fee', 0);

  if (error) throw error;

  log(`Found ${contracts?.length || 0} contracts to process`);

  let processed = 0;

  for (const contract of contracts || []) {
    try {
      const entryDate = contract.start_date || new Date().toISOString().slice(0, 10);
      const clientName = contract.clients?.name || 'Cliente';

      // Lançamento informativo do contrato (sem valor, apenas registro)
      // Pode ser usado para controle interno
      // O valor real será lançado nas faturas mensais

      // Atualizar contrato
      await supabase
        .from('client_contracts')
        .update({ journal_entry_id: 'processed' })
        .eq('id', contract.id);

      processed++;
      log(`📄 Contract ${contract.contract_number} registered for ${clientName}`);
    } catch (err: any) {
      log(`❌ Error processing contract ${contract.id}: ${err.message}`);
    }
  }

  return { success: true, processed, total: contracts?.length || 0 };
}

/**
 * PROCESSAR PAGAMENTOS RECEBIDOS
 */
async function processPayments(supabase: any, log: Function) {
  log('💳 Processing payments...');

  // Buscar faturas pagas sem lançamento de recebimento
  const { data: paidInvoices, error } = await supabase
    .from('invoices')
    .select(`
      id, client_id, amount, payment_date, competence,
      clients(name)
    `)
    .eq('status', 'paid')
    .not('payment_date', 'is', null)
    .is('payment_journal_entry_id', null);

  if (error) throw error;

  log(`Found ${paidInvoices?.length || 0} payments to process`);

  let processed = 0;

  for (const invoice of paidInvoices || []) {
    try {
      const clientName = invoice.clients?.name || 'Cliente';

      // Lançamento: D - Banco / C - Clientes a Receber
      const entry = await createJournalEntry(supabase, {
        entry_date: invoice.payment_date,
        description: `Recebimento honorários ${invoice.competence} - ${clientName}`,
        document_type: 'payment',
        document_id: invoice.id,
        ai_generated: true,
        lines: [
          {
            account_code: '1.1.1.02', // Banco Sicredi C/C
            debit_amount: invoice.amount,
            description: `Recebimento fatura ${invoice.competence}`,
            client_id: invoice.client_id
          },
          {
            account_code: '1.1.2.01', // Honorários a Receber
            credit_amount: invoice.amount,
            description: `Baixa recebimento`,
            client_id: invoice.client_id
          }
        ]
      }, log);

      // Atualizar fatura
      await supabase
        .from('invoices')
        .update({ payment_journal_entry_id: entry.id })
        .eq('id', invoice.id);

      processed++;
    } catch (err: any) {
      log(`❌ Error processing payment ${invoice.id}: ${err.message}`);
    }
  }

  return { success: true, processed, total: paidInvoices?.length || 0 };
}

/**
 * PROVISIONAR HONORÁRIOS MENSAIS
 */
async function provisionMonthlyFees(supabase: any, competence: string | undefined, log: Function) {
  const comp = competence || new Date().toISOString().slice(0, 7);
  log(`📋 Provisioning monthly fees for ${comp}...`);

  // Buscar clientes ativos com honorário
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, monthly_fee')
    .eq('is_active', true)
    .eq('is_pro_bono', false)
    .eq('is_barter', false)
    .not('monthly_fee', 'is', null)
    .gt('monthly_fee', 0);

  if (error) throw error;

  // Verificar provisões já existentes
  const { data: existingProvisions } = await supabase
    .from('accounting_provisions')
    .select('client_id')
    .eq('competence', comp)
    .eq('provision_type', 'monthly_fee');

  const existingClientIds = new Set((existingProvisions || []).map((p: any) => p.client_id));

  let provisioned = 0;
  const [year, month] = comp.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const provisionDate = `${comp}-${String(lastDay).padStart(2, '0')}`;

  for (const client of clients || []) {
    if (existingClientIds.has(client.id)) {
      continue; // Já provisionado
    }

    try {
      // Criar lançamento de provisão
      // D - Clientes a Receber / C - Receita de Honorários
      const entry = await createJournalEntry(supabase, {
        entry_date: provisionDate,
        description: `Provisão honorários ${comp} - ${client.name}`,
        document_type: 'provision',
        ai_generated: true,
        lines: [
          {
            account_code: '1.1.2.01', // Honorários a Receber
            debit_amount: client.monthly_fee,
            description: `Provisão a receber`,
            client_id: client.id
          },
          {
            account_code: '3.1.1.01', // Honorários Contábeis
            credit_amount: client.monthly_fee,
            description: `Provisão honorários`,
            client_id: client.id
          }
        ]
      }, log);

      // Registrar provisão
      await supabase.from('accounting_provisions').insert({
        provision_type: 'monthly_fee',
        client_id: client.id,
        competence: comp,
        amount: client.monthly_fee,
        journal_entry_id: entry.id,
        status: 'provisioned',
        created_by: '00000000-0000-0000-0000-000000000000'
      });

      provisioned++;
    } catch (err: any) {
      log(`❌ Error provisioning for ${client.name}: ${err.message}`);
    }
  }

  return { success: true, provisioned, competence: comp };
}

/**
 * GERAR BALANCETE
 */
async function generateTrialBalance(supabase: any, periodType: string, competence: string, log: Function) {
  log(`📊 Generating ${periodType} trial balance for ${competence}...`);

  // Determinar período
  const [year, month] = competence.split('-').map(Number);
  let periodStart: string, periodEnd: string;

  switch (periodType) {
    case 'monthly':
      periodStart = `${competence}-01`;
      periodEnd = `${competence}-${new Date(year, month, 0).getDate()}`;
      break;
    case 'quarterly':
      const quarter = Math.ceil(month / 3);
      const quarterStart = (quarter - 1) * 3 + 1;
      periodStart = `${year}-${String(quarterStart).padStart(2, '0')}-01`;
      periodEnd = `${year}-${String(quarterStart + 2).padStart(2, '0')}-${new Date(year, quarterStart + 2, 0).getDate()}`;
      break;
    case 'annual':
      periodStart = `${year}-01-01`;
      periodEnd = `${year}-12-31`;
      break;
    default:
      throw new Error(`Invalid period type: ${periodType}`);
  }

  // Buscar todas as contas com movimento no período
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type, nature')
    .order('code');

  if (accountsError) throw accountsError;

  // Buscar movimentos do período
  const { data: movements, error: movError } = await supabase
    .from('journal_entry_lines')
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      journal_entries!inner(entry_date)
    `)
    .gte('journal_entries.entry_date', periodStart)
    .lte('journal_entries.entry_date', periodEnd);

  if (movError) throw movError;

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
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      competence,
      fiscal_year: year,
      status: 'draft',
      ai_generated: true,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single();

  if (tbError) throw tbError;

  // Criar linhas do balancete
  const lines = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of accounts || []) {
    const mov = accountMovements[account.id] || { debit: 0, credit: 0 };

    // Calcular saldo
    const balance = account.nature === 'debit'
      ? mov.debit - mov.credit
      : mov.credit - mov.debit;

    if (mov.debit > 0 || mov.credit > 0 || balance !== 0) {
      lines.push({
        trial_balance_id: trialBalance.id,
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_type: account.type,
        account_nature: account.nature,
        previous_balance: 0, // TODO: calcular saldo anterior
        debit_movement: mov.debit,
        credit_movement: mov.credit,
        current_balance: balance
      });

      totalDebit += mov.debit;
      totalCredit += mov.credit;
    }
  }

  if (lines.length > 0) {
    await supabase.from('trial_balance_lines').insert(lines);
  }

  // Atualizar totais
  await supabase
    .from('trial_balances')
    .update({ total_debit: totalDebit, total_credit: totalCredit })
    .eq('id', trialBalance.id);

  log(`✅ Trial balance generated with ${lines.length} accounts`);

  return {
    success: true,
    trial_balance_id: trialBalance.id,
    period: { start: periodStart, end: periodEnd },
    accounts_count: lines.length,
    totals: { debit: totalDebit, credit: totalCredit },
    is_balanced: Math.abs(totalDebit - totalCredit) < 0.01
  };
}

/**
 * FECHAR EXERCÍCIO FISCAL (Apuração de Resultado)
 */
async function closeFiscalYear(supabase: any, fiscalYear: number, aiKey: string | undefined, provider: string, log: Function) {
  log(`📅 Closing fiscal year ${fiscalYear}...`);

  // Verificar se já foi fechado
  const { data: existing } = await supabase
    .from('fiscal_year_closings')
    .select('id')
    .eq('fiscal_year', fiscalYear)
    .eq('status', 'completed')
    .single();

  if (existing) {
    return { success: false, error: `Fiscal year ${fiscalYear} already closed` };
  }

  const closingDate = `${fiscalYear}-12-31`;

  // Buscar saldo de todas as contas de resultado (receitas e despesas)
  const { data: resultAccounts, error: accError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type, nature')
    .eq('is_result_account', true)
    .order('code');

  if (accError) throw accError;

  // Calcular saldos
  let totalRevenue = 0;
  let totalExpenses = 0;
  const closingLines: any[] = [];

  for (const account of resultAccounts || []) {
    const { data: movements } = await supabase
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount')
      .eq('account_id', account.id);

    const debit = (movements || []).reduce((s: number, m: any) => s + (m.debit_amount || 0), 0);
    const credit = (movements || []).reduce((s: number, m: any) => s + (m.credit_amount || 0), 0);

    const balance = account.nature === 'debit' ? debit - credit : credit - debit;

    if (balance !== 0) {
      if (account.type === 'revenue') {
        totalRevenue += balance;
        // Zerar receita: D - Receita / C - ARE
        closingLines.push({
          account_code: account.code,
          debit_amount: balance,
          description: `Transferência para ARE`
        });
      } else if (account.type === 'expense') {
        totalExpenses += balance;
        // Zerar despesa: D - ARE / C - Despesa
        closingLines.push({
          account_code: account.code,
          credit_amount: balance,
          description: `Transferência para ARE`
        });
      }
    }
  }

  // Calcular resultado
  const netResult = totalRevenue - totalExpenses;
  const resultType = netResult > 0 ? 'profit' : netResult < 0 ? 'loss' : 'break_even';

  log(`📈 Revenue: R$ ${totalRevenue.toFixed(2)}`);
  log(`📉 Expenses: R$ ${totalExpenses.toFixed(2)}`);
  log(`${resultType === 'profit' ? '✅' : '⚠️'} Net Result: R$ ${netResult.toFixed(2)} (${resultType})`);

  // Conta destino do resultado
  const resultAccountCode = netResult >= 0 ? '5.2' : '5.3'; // Lucros ou Prejuízos Acumulados

  // Criar lançamento de encerramento (zerar contas de resultado)
  let closingEntry = null;
  if (closingLines.length > 0) {
    // Adicionar contrapartida ARE
    closingLines.push({
      account_code: '5.1', // ARE
      [totalRevenue > totalExpenses ? 'credit_amount' : 'debit_amount']: Math.abs(totalRevenue - totalExpenses),
      description: 'Apuração do Resultado'
    });

    closingEntry = await createJournalEntry(supabase, {
      entry_date: closingDate,
      description: `Encerramento das contas de resultado - Exercício ${fiscalYear}`,
      document_type: 'closing',
      ai_generated: true,
      lines: closingLines
    }, log);
  }

  // Criar lançamento de transferência do resultado para PL
  let transferEntry = null;
  if (netResult !== 0) {
    transferEntry = await createJournalEntry(supabase, {
      entry_date: closingDate,
      description: `Transferência do resultado para ${netResult > 0 ? 'Lucros' : 'Prejuízos'} Acumulados`,
      document_type: 'closing',
      ai_generated: true,
      lines: [
        {
          account_code: '5.1', // ARE
          [netResult > 0 ? 'debit_amount' : 'credit_amount']: Math.abs(netResult),
          description: 'Transferência do resultado'
        },
        {
          account_code: resultAccountCode,
          [netResult > 0 ? 'credit_amount' : 'debit_amount']: Math.abs(netResult),
          description: resultType === 'profit' ? 'Lucro do Exercício' : 'Prejuízo do Exercício'
        }
      ]
    }, log);
  }

  // Registrar fechamento
  const { data: closing, error: closeError } = await supabase
    .from('fiscal_year_closings')
    .insert({
      fiscal_year: fiscalYear,
      closing_date: closingDate,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      closing_journal_entry_id: closingEntry?.id,
      result_transfer_entry_id: transferEntry?.id,
      status: 'completed',
      ai_generated: true,
      completed_at: new Date().toISOString(),
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single();

  if (closeError) throw closeError;

  log(`✅ Fiscal year ${fiscalYear} closed successfully`);

  return {
    success: true,
    fiscal_year: fiscalYear,
    closing_id: closing.id,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_result: netResult,
    result_type: resultType,
    closing_entry_id: closingEntry?.id,
    transfer_entry_id: transferEntry?.id
  };
}

/**
 * GERAR BALANÇO PATRIMONIAL
 */
async function generateBalanceSheet(supabase: any, fiscalYear: number, log: Function) {
  log(`📋 Generating balance sheet for ${fiscalYear}...`);

  const referenceDate = `${fiscalYear}-12-31`;

  // Buscar contas patrimoniais com saldos
  const { data: accounts, error: accError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type, nature')
    .in('type', ['asset', 'liability', 'equity'])
    .order('code');

  if (accError) throw accError;

  // Calcular saldos
  const balanceData: any = {
    current_assets: [],
    non_current_assets: [],
    current_liabilities: [],
    non_current_liabilities: [],
    equity: []
  };

  let totalCurrentAssets = 0;
  let totalNonCurrentAssets = 0;
  let totalCurrentLiabilities = 0;
  let totalNonCurrentLiabilities = 0;
  let totalEquity = 0;

  for (const account of accounts || []) {
    const { data: movements } = await supabase
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount, journal_entries!inner(entry_date)')
      .eq('account_id', account.id)
      .lte('journal_entries.entry_date', referenceDate);

    const debit = (movements || []).reduce((s: number, m: any) => s + (m.debit_amount || 0), 0);
    const credit = (movements || []).reduce((s: number, m: any) => s + (m.credit_amount || 0), 0);

    const balance = account.nature === 'debit' ? debit - credit : credit - debit;

    if (balance === 0) continue;

    // Classificar conta
    let groupType: string;
    if (account.code.startsWith('1.1')) {
      groupType = 'current_asset';
      totalCurrentAssets += balance;
      balanceData.current_assets.push({ account, balance });
    } else if (account.code.startsWith('1.2')) {
      groupType = 'non_current_asset';
      totalNonCurrentAssets += balance;
      balanceData.non_current_assets.push({ account, balance });
    } else if (account.code.startsWith('2.1')) {
      groupType = 'current_liability';
      totalCurrentLiabilities += balance;
      balanceData.current_liabilities.push({ account, balance });
    } else if (account.code.startsWith('2.2')) {
      groupType = 'non_current_liability';
      totalNonCurrentLiabilities += balance;
      balanceData.non_current_liabilities.push({ account, balance });
    } else if (account.code.startsWith('5.')) {
      groupType = 'equity';
      totalEquity += balance;
      balanceData.equity.push({ account, balance });
    } else {
      continue;
    }
  }

  // Criar balanço
  const { data: balanceSheet, error: bsError } = await supabase
    .from('balance_sheets')
    .insert({
      reference_date: referenceDate,
      fiscal_year: fiscalYear,
      total_current_assets: totalCurrentAssets,
      total_non_current_assets: totalNonCurrentAssets,
      total_current_liabilities: totalCurrentLiabilities,
      total_non_current_liabilities: totalNonCurrentLiabilities,
      share_capital: balanceData.equity.find((e: any) => e.account.code === '5.4')?.balance || 0,
      accumulated_profits: balanceData.equity.find((e: any) => e.account.code === '5.2')?.balance || 0,
      accumulated_losses: balanceData.equity.find((e: any) => e.account.code === '5.3')?.balance || 0,
      status: 'draft',
      ai_generated: true,
      created_by: '00000000-0000-0000-0000-000000000000'
    })
    .select()
    .single();

  if (bsError) throw bsError;

  // Criar linhas detalhadas
  const lines = [];
  let order = 1;

  for (const group of ['current_assets', 'non_current_assets', 'current_liabilities', 'non_current_liabilities', 'equity']) {
    const groupType = group.replace('_', '_');
    for (const item of balanceData[group]) {
      lines.push({
        balance_sheet_id: balanceSheet.id,
        account_id: item.account.id,
        account_code: item.account.code,
        account_name: item.account.name,
        account_type: item.account.type,
        group_type: groupType.replace('_assets', '_asset').replace('_liabilities', '_liability'),
        balance: item.balance,
        display_order: order++
      });
    }
  }

  if (lines.length > 0) {
    await supabase.from('balance_sheet_lines').insert(lines);
  }

  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilitiesPL = totalCurrentLiabilities + totalNonCurrentLiabilities + totalEquity;

  log(`✅ Balance sheet generated`);
  log(`📊 Total Assets: R$ ${totalAssets.toFixed(2)}`);
  log(`📊 Total Liabilities + Equity: R$ ${totalLiabilitiesPL.toFixed(2)}`);
  log(`${Math.abs(totalAssets - totalLiabilitiesPL) < 0.01 ? '✅' : '⚠️'} Balanced: ${Math.abs(totalAssets - totalLiabilitiesPL) < 0.01}`);

  return {
    success: true,
    balance_sheet_id: balanceSheet.id,
    fiscal_year: fiscalYear,
    totals: {
      current_assets: totalCurrentAssets,
      non_current_assets: totalNonCurrentAssets,
      total_assets: totalAssets,
      current_liabilities: totalCurrentLiabilities,
      non_current_liabilities: totalNonCurrentLiabilities,
      equity: totalEquity,
      total_liabilities_equity: totalLiabilitiesPL
    },
    is_balanced: Math.abs(totalAssets - totalLiabilitiesPL) < 0.01
  };
}
