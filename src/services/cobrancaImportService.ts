/**
 * Serviço para importar arquivo de cobrança e conciliar invoices/bank_transactions
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  parseCobrancaCSV, 
  groupByDocumento, 
  CobrancaRecord, 
  CobrancaGroup 
} from '@/utils/parseCobrancaFile';

export interface ConciliationResult {
  documento: string;
  dataExtrato: Date;
  totalRecebido: number;
  clientesCount: number;
  clientesLinked: number;
  invoicesCreated: number;
  bankTransactionMatched: boolean;
  matchedBankTransactionId?: string;  invoiceId?: string;  clientes: {
    nome: string;
    valor: number;
    invoiceId?: string;
    invoiceCreated: boolean;
  }[];
}

/**
 * Importa arquivo de cobrança e concilia com invoices
 * 1. Parse o CSV
 * 2. Agrupa por documento (COB000005, etc)
 * 3. Para cada documento, cria/atualiza invoices
 * 4. Vincula ao bank_transaction correspondente
 */
export async function importCobrancaFile(
  csvContent: string
): Promise<ConciliationResult[]> {
  const records = parseCobrancaCSV(csvContent);
  const groups = groupByDocumento(records);
  const results: ConciliationResult[] = [];

  for (const [documento, group] of groups) {
    const result = await processCobrancaGroup(group);
    results.push(result);
  }

  return results;
}

/**
 * Processa um grupo de cobrança (ex: COB000005 com 5 clientes)
 */
async function processCobrancaGroup(group: CobrancaGroup): Promise<ConciliationResult> {
  const result: ConciliationResult = {
    documento: group.documento,
    dataExtrato: group.dataExtrato,
    totalRecebido: group.totalRecebido,
    clientesCount: group.clientes.length,
    clientesLinked: 0,
    invoicesCreated: 0,
    bankTransactionMatched: false,
    clientes: [],
  };

  // 1. Processar cada cliente
  for (const record of group.clientes) {
    const clientResult = await processCobrancaRecord(record);
    result.clientes.push(clientResult);
    if (clientResult.invoiceId) {
      result.clientesLinked++;
    }
    if (clientResult.invoiceCreated) {
      result.invoicesCreated++;
    }
  }

  // 2. Tentar encontrar bank_transaction correspondente
  const bankTx = await findBankTransaction(
    group.documento,
    group.dataExtrato,
    group.totalRecebido
  );

  if (bankTx) {
    result.bankTransactionMatched = true;
    result.matchedBankTransactionId = bankTx.id;

    // 3. Vincular todas as invoices ao bank_transaction
    await linkInvoicesToBankTransaction(
      result.clientes.map(c => c.invoiceId).filter(Boolean) as string[],
      bankTx.id,
      bankTx.reference_id
    );
  }

  return result;
}

/**
 * Processa um registro de cobrança individual
 * Busca/cria invoice para o cliente
 */
async function processCobrancaRecord(
  record: CobrancaRecord
): Promise<{
  nome: string;
  valor: number;
  invoiceId?: string;
  invoiceCreated: boolean;
}> {
  const result = {
    nome: record.pagador,
    valor: record.valorRecebido,
    invoiceCreated: false,
  };

  // 1. Buscar cliente pelo nome (normalize)
  const clientName = normalizeClientName(record.pagador);
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', `%${clientName}%`)
    .limit(1);

  if (!clients || clients.length === 0) {
    console.warn(`Cliente não encontrado: ${record.pagador}`);
    return result;
  }

  const clientId = clients[0].id;

  // 2. Buscar invoice existente com este valor e cliente
  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('id, status, paid_date')
    .eq('client_id', clientId)
    .eq('amount', record.valorRecebido)
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingInvoices && existingInvoices.length > 0) {
    const invoice = existingInvoices[0];
    result.invoiceId = invoice.id;

    // Se ainda não está marcada como paga, marcar agora
    if (!invoice.paid_date) {
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_date: record.dataLiquidacao.toISOString(),
        })
        .eq('id', invoice.id);
    }

    return result;
  }

  // 3. Se não existe, criar invoice
  const { data: newInvoice } = await supabase
    .from('invoices')
    .insert({
      client_id: clientId,
      amount: record.valorRecebido,
      status: 'paid',
      created_at: record.dataVencimento.toISOString(),
      due_date: record.dataVencimento.toISOString(),
      paid_date: record.dataLiquidacao.toISOString(),
    })
    .select('id')
    .single();

  if (newInvoice) {
    result.invoiceId = newInvoice.id;
    result.invoiceCreated = true;
  }

  return result;
}

/**
 * Busca bank_transaction que corresponde a este documento/data/valor
 */
async function findBankTransaction(
  documento: string,
  dataExtrato: Date,
  totalRecebido: number
) {
  // Buscar por descrição (contém o documento) e valor
  const { data } = await supabase
    .from('bank_transactions')
    .select('id, reference_id, amount, transaction_date, description')
    .ilike('description', `%${documento}%`)
    .eq('amount', totalRecebido)
    .gte(
      'transaction_date',
      new Date(dataExtrato.getTime() - 24 * 60 * 60 * 1000).toISOString()
    )
    .lte(
      'transaction_date',
      new Date(dataExtrato.getTime() + 24 * 60 * 60 * 1000).toISOString()
    )
    .single();

  return data || null;
}

/**
 * Vincula invoices ao bank_transaction
 * Nota: A relação é inversa - bank_transactions têm invoice_id, não o contrário
 * Aqui apenas marcamos as invoices como "paid", o matching pode ser feito manualmente
 */
async function linkInvoicesToBankTransaction(
  invoiceIds: string[],
  bankTransactionId: string,
  referenceId?: string
) {
  // Não há coluna bank_transaction_id em invoices
  // A linkagem acontece via accounting_entries ou manualmente
  // Apenas garantir que invoices estão marcadas como paid
  
  for (const invoiceId of invoiceIds) {
    await supabase
      .from('invoices')
      .update({
        status: 'paid' // Já feito em processCobrancaRecord, mas garante
      })
      .eq('id', invoiceId);
  }
}

/**
 * Normalize nome de cliente para busca (remove acentos, extra spaces, etc)
 */
function normalizeClientName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}
