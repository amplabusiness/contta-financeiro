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
import { BoletoReconciliationService } from './BoletoReconciliationService';

export interface ConciliationResult {
  documento: string;
  dataExtrato: Date;
  totalRecebido: number;
  clientesCount: number;
  clientesLinked: number;
  invoicesCreated: number;
  accountsCreated: number;
  bankTransactionMatched: boolean;
  matchedBankTransactionId?: string;
  invoiceId?: string;
  clientes: {
    nome: string;
    valor: number;
    invoiceId?: string;
    invoiceCreated: boolean;
    accountCode?: string;
    accountCreated: boolean;
  }[];
}

/**
 * Importa arquivo de cobrança e concilia com invoices
 * 1. Parse o CSV
 * 2. Salva registros na tabela boleto_payments (para matching posterior)
 * 3. Agrupa por documento (COB000005, etc)
 * 4. Para cada documento, cria/atualiza invoices
 * 5. Vincula ao bank_transaction correspondente
 */
export async function importCobrancaFile(
  csvContent: string
): Promise<ConciliationResult[]> {
  const records = parseCobrancaCSV(csvContent);

  // IMPORTANTE: Salvar todos os registros em boleto_payments primeiro
  // Isso permite que BoletoReconciliationService.findClientsForCobCode encontre os dados
  await saveBoletoPayments(records);

  const groups = groupByDocumento(records);
  const results: ConciliationResult[] = [];

  for (const [, group] of groups) {
    const result = await processCobrancaGroup(group);
    results.push(result);
  }

  return results;
}

/**
 * Salva os registros do CSV na tabela boleto_payments
 * Usa upsert para evitar duplicatas (baseado em cob + pagador + valor + data_extrato)
 */
async function saveBoletoPayments(records: CobrancaRecord[]): Promise<void> {
  // Obter tenant do usuário atual usando RPC (bypassa RLS)
  const { data: tenantIdResult } = await supabase.rpc('get_current_user_tenant_id');
  let tenantId: string | null = tenantIdResult || null;

  if (!tenantId) {
    // Fallback para primeiro tenant
    const { data: defaultTenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .single();
    tenantId = defaultTenant?.id || null;
  }

  if (!tenantId) {
    return;
  }

  // Processar em batches para melhor performance
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const payloads = batch.map(record => ({
      cob: record.documento,
      nosso_numero: record.numeroboleto,
      pagador: record.pagador,
      data_vencimento: formatDateForDB(record.dataVencimento),
      data_liquidacao: formatDateForDB(record.dataLiquidacao),
      data_extrato: formatDateForDB(record.dataExtrato),
      valor_original: record.valorBoleto,
      valor_liquidado: record.valorRecebido,
      tenant_id: tenantId
    }));

    const { error } = await supabase
      .from('boleto_payments')
      .upsert(payloads, {
        onConflict: 'cob,pagador,valor_liquidado,data_extrato,tenant_id',
        ignoreDuplicates: true
      });

    if (error) {
      // Se der erro de unique constraint, tentar insert individual ignorando duplicatas
      for (const payload of payloads) {
        await supabase.from('boleto_payments').insert(payload).select();
      }
    }
  }
}

/**
 * Formata Date para string YYYY-MM-DD para o banco
 */
function formatDateForDB(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    accountsCreated: 0,
    bankTransactionMatched: false,
    clientes: [],
  };

  // 1. Processar cada cliente (cria conta contábil automaticamente se não existir)
  for (const record of group.clientes) {
    const clientResult = await processCobrancaRecord(record);
    result.clientes.push(clientResult);
    if (clientResult.invoiceId) {
      result.clientesLinked++;
    }
    if (clientResult.invoiceCreated) {
      result.invoicesCreated++;
    }
    if (clientResult.accountCreated) {
      result.accountsCreated++;
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
 * NOVO: Cria automaticamente a conta contábil do cliente se não existir
 */
async function processCobrancaRecord(
  record: CobrancaRecord
): Promise<{
  nome: string;
  valor: number;
  invoiceId?: string;
  invoiceCreated: boolean;
  accountCode?: string;
  accountCreated: boolean;
}> {
  const result: {
    nome: string;
    valor: number;
    invoiceId?: string;
    invoiceCreated: boolean;
    accountCode?: string;
    accountCreated: boolean;
  } = {
    nome: record.pagador,
    valor: record.valorRecebido,
    invoiceCreated: false,
    accountCreated: false,
  };

  // 1. Buscar cliente pelo nome (normalize)
  const clientName = normalizeClientName(record.pagador);
  const { data: clients } = await supabase
    .from('clients')
    .select('id, accounting_account_id')
    .ilike('name', `%${clientName}%`)
    .limit(1);

  // 2. Criar/buscar conta contábil automaticamente usando BoletoReconciliationService
  const accountInfo = await BoletoReconciliationService.findOrCreateClientAccount(record.pagador);
  if (accountInfo) {
    result.accountCode = accountInfo.code;
    // Verificar se a conta foi criada agora (se não existia antes)
    if (!clients || clients.length === 0 || !clients[0].accounting_account_id) {
      result.accountCreated = true;
    }
  }

  if (!clients || clients.length === 0) {
    return result;
  }

  const clientId = clients[0].id;

  // 3. Se o cliente não tinha conta contábil vinculada, vincular agora
  if (accountInfo && !clients[0].accounting_account_id) {
    await supabase
      .from('clients')
      .update({ accounting_account_id: accountInfo.id })
      .eq('id', clientId);
  }

  // 4. Buscar invoice existente com este valor e cliente
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

  // 5. Se não existe, criar invoice
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
 * Usa RPC com SECURITY DEFINER para bypass RLS
 * Estratégia:
 * 1. Tentar match exato por Descrição (contém documento) + Valor + Data (+/- 1 dia)
 * 2. Se falhar, tentar match por Valor + Data (+/- 1 dia)
 */
async function findBankTransaction(
  documento: string,
  dataExtrato: Date,
  totalRecebido: number
) {
  const startDate = new Date(dataExtrato.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(dataExtrato.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // Arredondar para 2 casas decimais para evitar problemas de precisão de ponto flutuante
  // Ex: 17076.850000000002 -> 17076.85
  const roundedAmount = Math.round(totalRecebido * 100) / 100;

  // Usar RPC com SECURITY DEFINER para bypass RLS
  const { data: matchResult, error } = await supabase
    .rpc('find_bank_transaction_for_reconciliation', {
      p_documento: documento,
      p_amount: roundedAmount,
      p_start_date: startDate,
      p_end_date: endDate
    });

  if (error) {
    return null;
  }

  if (matchResult && matchResult.length > 0) {
    const tx = matchResult[0];
    return {
      id: tx.id,
      reference_id: tx.reference_id,
      amount: tx.amount,
      transaction_date: tx.transaction_date,
      description: tx.description
    };
  }

  return null;
}

/**
 * Vincula invoices ao bank_transaction
 * Nota: A relação é inversa - bank_transactions têm invoice_id, não o contrário
 * Aqui apenas marcamos as invoices como "paid", o matching pode ser feito manualmente
 */
async function linkInvoicesToBankTransaction(
  invoiceIds: string[],
  _bankTransactionId: string,
  _referenceId?: string
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
