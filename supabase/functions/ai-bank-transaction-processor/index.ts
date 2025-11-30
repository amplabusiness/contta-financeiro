import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LogFunction = (msg: string) => void;

/**
 * AI BANK TRANSACTION PROCESSOR
 *
 * Processa transações bancárias importadas de OFX e:
 * 1. Classifica automaticamente cada transação
 * 2. Identifica clientes (para recebimentos) ou fornecedores (para pagamentos)
 * 3. Define as contas contábeis corretas (Débito e Crédito)
 * 4. Gera lançamentos no Livro Diário automaticamente
 * 5. Trata recebimentos de períodos anteriores (Ajustes de Exercícios Anteriores)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[AI-BankProcessor] ${msg}`);
    logs.push(`${new Date().toISOString()} - ${msg}`);
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    log('🏦 AI Bank Transaction Processor started');

    const { action, transactions, bank_account_id, import_id, opening_date } = await req.json();

    let result: any = { success: true, action };

    switch (action) {
      case 'process_transactions':
        result = await processTransactions(supabase, GEMINI_API_KEY, transactions, bank_account_id, import_id, opening_date, log);
        break;

      case 'classify_single':
        result = await classifySingleTransaction(supabase, GEMINI_API_KEY, transactions[0], log);
        break;

      case 'process_unclassified':
        result = await processUnclassifiedTransactions(supabase, GEMINI_API_KEY, bank_account_id, log);
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
 * CONHECIMENTO CONTÁBIL PARA CLASSIFICAÇÃO
 */
const ACCOUNTING_KNOWLEDGE = `
## CONTEXTO: ESCRITÓRIO DE CONTABILIDADE (Ampla Contabilidade)

### REGRAS FUNDAMENTAIS
1. Controle de caixa iniciado em Janeiro/2025
2. Saldo de abertura em 31/12/2024 já registrado
3. Recebimentos de DEZEMBRO/2024 em JANEIRO/2025 = Ajustes de Exercícios Anteriores (NÃO é receita do período)

### PLANO DE CONTAS RELEVANTE

**ATIVO (Grupo 1)**
- 1.1.1.02 = Banco Sicredi C/C (conta principal)
- 1.1.2.01 = Honorários a Receber (Clientes a Receber)

**PASSIVO (Grupo 2)**
- 2.1.1.01 = Fornecedores a Pagar

**RECEITAS (Grupo 3)**
- 3.1.1.01 = Honorários Contábeis
- 3.1.1.02 = Consultoria Tributária
- 3.2.1.01 = Juros Recebidos

**DESPESAS (Grupo 4)**
- 4.1.1 = Aluguel e Condomínio
- 4.1.2 = Energia Elétrica
- 4.1.3 = Água e Esgoto
- 4.1.4 = Telecomunicações
- 4.1.5 = Material de Escritório
- 4.1.9 = Sistemas e Softwares
- 4.2.1 = Salários
- 4.2.8 = Pro-Labore
- 4.3.1 = ISS
- 4.3.6 = Outras Taxas e Impostos
- 4.4.1 = Juros e Multas
- 4.4.2 = Tarifas Bancárias
- 4.5.1 = Combustível
- 4.9.1 = Outras Despesas Operacionais

**PATRIMÔNIO LÍQUIDO (Grupo 5)**
- 5.3.02.01 = Saldo de Abertura - Disponibilidades
- 5.3.03.01 = Ajustes Positivos de Exercícios Anteriores (Recebimentos de períodos anteriores)
- 5.3.03.02 = Ajustes Negativos de Exercícios Anteriores

### REGRAS DE LANÇAMENTO

**RECEBIMENTO (Crédito bancário):**
- Se cliente identificado E competência do período atual:
  D - 1.1.1.02 (Banco) / C - 1.1.2.01 (Honorários a Receber) [baixa do cliente]

- Se cliente identificado E competência de período ANTERIOR (ex: recebimento de dezembro em janeiro):
  D - 1.1.1.02 (Banco) / C - 5.3.03.01 (Ajustes Positivos de Exercícios Anteriores)

- Se PIX/TED sem identificação clara:
  D - 1.1.1.02 (Banco) / C - 3.1.1.01 (Honorários Contábeis) ou identificar

**PAGAMENTO (Débito bancário):**
- Despesa operacional:
  D - 4.x.x (Conta de Despesa apropriada) / C - 1.1.1.02 (Banco)

- Pagamento a fornecedor já provisionado:
  D - 2.1.1.01 (Fornecedores a Pagar) / C - 1.1.1.02 (Banco)

**TARIFAS BANCÁRIAS:**
  D - 4.4.2 (Tarifas Bancárias) / C - 1.1.1.02 (Banco)
`;

/**
 * Chamar Gemini para classificação
 */
async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * PROCESSAR LOTE DE TRANSAÇÕES
 */
async function processTransactions(
  supabase: any,
  apiKey: string,
  transactions: any[],
  bankAccountId: string,
  importId: string,
  openingDate: string,
  log: LogFunction
) {
  log(`🔄 Processing ${transactions.length} transactions...`);

  // Buscar dados auxiliares
  const [{ data: clients }, { data: chartOfAccounts }, { data: expenses }] = await Promise.all([
    supabase.from('clients').select('id, name, document').eq('is_active', true),
    supabase.from('chart_of_accounts').select('id, code, name, account_type, nature').eq('is_analytical', true),
    supabase.from('accounts_payable').select('id, supplier_name, amount, status').eq('status', 'pending')
  ]);

  const accountMap = new Map(chartOfAccounts?.map((a: any) => [a.code, a]) || []);

  // Criar mapa de clientes por nome (para matching)
  const clientNameMap = new Map();
  for (const client of clients || []) {
    clientNameMap.set(client.name.toLowerCase(), client);
    // Adicionar primeiras palavras do nome
    const firstName = client.name.split(' ')[0].toLowerCase();
    if (firstName.length > 3) {
      clientNameMap.set(firstName, client);
    }
  }

  const results = {
    processed: 0,
    classified: 0,
    entries_created: 0,
    errors: [] as string[],
    classifications: [] as any[]
  };

  // Processar em lotes de 10 para evitar timeout
  const batchSize = 10;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);

    // Criar prompt para classificação em lote
    const prompt = `${ACCOUNTING_KNOWLEDGE}

## TRANSAÇÕES PARA CLASSIFICAR

${batch.map((txn: any, idx: number) => `
### Transação ${idx + 1}
- Data: ${txn.date}
- Tipo: ${txn.type} (${txn.type === 'CREDIT' ? 'Entrada/Recebimento' : 'Saída/Pagamento'})
- Valor: R$ ${txn.amount.toFixed(2)}
- Descrição: ${txn.description}
- FITID: ${txn.fitid}
`).join('\n')}

## CLIENTES CADASTRADOS (para identificar recebimentos)
${(clients || []).slice(0, 50).map((c: any) => `- ${c.name}`).join('\n')}

## DATA DE ABERTURA DO CONTROLE: ${openingDate}
Se a transação é um recebimento de competência ANTERIOR a ${openingDate}, usar conta 5.3.03.01 (Ajustes Positivos).

## INSTRUÇÕES
Para CADA transação, responda com JSON:
{
  "transactions": [
    {
      "fitid": "id da transação",
      "classification": {
        "category": "categoria geral (Honorários, Despesa Administrativa, Tarifa Bancária, etc)",
        "client_id": "id do cliente se identificado, null caso contrário",
        "client_name": "nome do cliente se identificado",
        "is_prior_period": true/false (se é recebimento de período anterior),
        "debit_account": "código da conta de débito (ex: 1.1.1.02)",
        "credit_account": "código da conta de crédito (ex: 3.1.1.01)",
        "description": "descrição para o lançamento contábil",
        "confidence": 0.0 a 1.0,
        "reasoning": "justificativa breve"
      }
    }
  ]
}

IMPORTANTE:
- Para CRÉDITOS bancários (entradas): Débito em Banco (1.1.1.02), Crédito varia
- Para DÉBITOS bancários (saídas): Débito na despesa/fornecedor, Crédito em Banco (1.1.1.02)
- Responda APENAS com JSON válido`;

    try {
      const response = await callGemini(apiKey, prompt);

      // Extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log(`⚠️ Could not parse AI response for batch ${i / batchSize + 1}`);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      for (const txnResult of parsed.transactions || []) {
        try {
          const originalTxn = batch.find((t: any) => t.fitid === txnResult.fitid);
          if (!originalTxn) continue;

          const classification = txnResult.classification;

          // Validar contas existem
          const debitAccount = accountMap.get(classification.debit_account);
          const creditAccount = accountMap.get(classification.credit_account);

          if (!debitAccount || !creditAccount) {
            log(`⚠️ Account not found: ${classification.debit_account} or ${classification.credit_account}`);
            results.errors.push(`Conta não encontrada para transação ${txnResult.fitid}`);
            continue;
          }

          // Criar lançamento contábil
          const { data: entry, error: entryError } = await supabase
            .from('accounting_entries')
            .insert({
              entry_date: originalTxn.date,
              competence_date: originalTxn.date,
              description: classification.description || `${classification.category} - ${originalTxn.description}`,
              document_number: originalTxn.fitid,
              entry_type: 'BANK_IMPORT',
              total_debit: originalTxn.amount,
              total_credit: originalTxn.amount,
              balanced: true,
              notes: `Classificado automaticamente. Confiança: ${(classification.confidence * 100).toFixed(0)}%. ${classification.reasoning}`,
              reference_type: 'bank_transaction',
              reference_id: originalTxn.fitid
            })
            .select()
            .single();

          if (entryError) {
            log(`❌ Error creating entry: ${entryError.message}`);
            results.errors.push(`Erro ao criar lançamento: ${entryError.message}`);
            continue;
          }

          // Criar linhas do lançamento
          const lines = [
            {
              entry_id: entry.id,
              account_id: debitAccount.id,
              debit: originalTxn.amount,
              credit: 0,
              description: `D - ${debitAccount.name}`
            },
            {
              entry_id: entry.id,
              account_id: creditAccount.id,
              debit: 0,
              credit: originalTxn.amount,
              description: `C - ${creditAccount.name}`
            }
          ];

          await supabase.from('accounting_entry_lines').insert(lines);

          results.entries_created++;
          results.classified++;
          results.classifications.push({
            fitid: originalTxn.fitid,
            description: originalTxn.description,
            amount: originalTxn.amount,
            type: originalTxn.type,
            classification: classification,
            entry_id: entry.id
          });

          log(`✅ ${originalTxn.type}: ${originalTxn.description} -> ${classification.category}`);

        } catch (err: any) {
          log(`❌ Error processing transaction: ${err.message}`);
          results.errors.push(err.message);
        }
      }

      results.processed += batch.length;

    } catch (err: any) {
      log(`❌ Batch error: ${err.message}`);
      results.errors.push(`Batch error: ${err.message}`);
    }
  }

  log(`📊 Summary: ${results.processed} processed, ${results.classified} classified, ${results.entries_created} entries created`);

  return results;
}

/**
 * CLASSIFICAR UMA ÚNICA TRANSAÇÃO (para preview)
 */
async function classifySingleTransaction(
  supabase: any,
  apiKey: string,
  transaction: any,
  log: LogFunction
) {
  log(`🔍 Classifying single transaction: ${transaction.description}`);

  const [{ data: clients }, { data: chartOfAccounts }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('is_active', true).limit(50),
    supabase.from('chart_of_accounts').select('code, name').eq('is_analytical', true)
  ]);

  const prompt = `${ACCOUNTING_KNOWLEDGE}

## TRANSAÇÃO PARA CLASSIFICAR
- Data: ${transaction.date}
- Tipo: ${transaction.type} (${transaction.type === 'CREDIT' ? 'Entrada/Recebimento' : 'Saída/Pagamento'})
- Valor: R$ ${transaction.amount.toFixed(2)}
- Descrição: ${transaction.description}

## CLIENTES CADASTRADOS
${(clients || []).map((c: any) => `- ${c.name}`).join('\n')}

Responda com JSON:
{
  "category": "categoria",
  "client_name": "nome do cliente se identificado",
  "is_prior_period": true/false,
  "debit_account": "código conta débito",
  "credit_account": "código conta crédito",
  "description": "descrição do lançamento",
  "confidence": 0.0-1.0,
  "reasoning": "justificativa"
}`;

  const response = await callGemini(apiKey, prompt);
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return { success: true, classification: JSON.parse(jsonMatch[0]) };
  }

  return { success: false, error: 'Could not classify transaction' };
}

/**
 * PROCESSAR TRANSAÇÕES NÃO CLASSIFICADAS
 */
async function processUnclassifiedTransactions(
  supabase: any,
  apiKey: string,
  bankAccountId: string,
  log: LogFunction
) {
  log(`🔄 Processing unclassified transactions for account ${bankAccountId}`);

  // Buscar transações sem lançamento contábil
  const { data: unclassified, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('bank_account_id', bankAccountId)
    .is('accounting_entry_id', null)
    .limit(50);

  if (error) throw error;

  if (!unclassified || unclassified.length === 0) {
    return { success: true, message: 'No unclassified transactions found', processed: 0 };
  }

  // Converter para formato esperado
  const transactions = unclassified.map((t: any) => ({
    fitid: t.bank_reference || t.id,
    date: t.transaction_date,
    type: t.transaction_type === 'credit' ? 'CREDIT' : 'DEBIT',
    amount: t.amount,
    description: t.description
  }));

  return await processTransactions(supabase, apiKey, transactions, bankAccountId, '', '2024-12-31', log);
}
