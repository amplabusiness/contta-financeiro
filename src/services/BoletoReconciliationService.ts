/**
 * Serviço de Conciliação Automática de Boletos
 *
 * Este serviço realiza:
 * 1. Matching automático de transações OFX (LIQ.COBRANCA SIMPLES-COBxxxxxx) com boletos
 * 2. Criação de lançamentos contábeis automáticos (partidas dobradas)
 * 3. Geração de relatórios de conciliação
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface BoletoMatch {
  bankTransactionId: string;
  cobCode: string;
  transactionDate: string;
  totalAmount: number;
  description: string;
  clients: BoletoClientMatch[];
  matched: boolean;
  journalEntryId?: string;
  confidence: number; // 0-100
}

export interface BoletoClientMatch {
  clientName: string;
  clientId?: string;
  amount: number;
  invoiceId?: string;
  accountCode?: string; // Conta contábil do cliente (1.1.2.01.xxx)
  accountName?: string;
  matched: boolean;
  needsRegistration?: boolean; // Cliente não encontrado na tabela clients
}

export interface ReconciliationResult {
  success: boolean;
  bankTransactionId: string;
  journalEntryId?: string;
  entriesCreated: number;
  totalDebited: number;
  totalCredited: number;
  errors: string[];
  clientsNeedingRegistration?: string[]; // Lista de clientes que precisam ser cadastrados
}

export interface UnregisteredClient {
  name: string;
  amount: number;
  cobCode: string;
  transactionDate: string;
}

export interface ReconciliationReport {
  period: string;
  totalTransactions: number;
  reconciledCount: number;
  pendingCount: number;
  totalReconciled: number;
  totalPending: number;
  transactions: BoletoMatch[];
}

// ============================================
// CONSTANTS (baseados no plano de contas - fonte da verdade)
// ============================================

const BANK_ACCOUNT_CODE = '1.1.1.05'; // Sicredi (default) - Ativo Circulante > Disponibilidades
const CLIENTS_RECEIVABLE_PREFIX = '1.1.2.01'; // Clientes a Receber - cada cliente tem sua subconta
const COB_PATTERN = /[C]?OB\d+/i; // Pattern para extrair código COB das descrições OFX

/**
 * Estrutura do Plano de Contas para Recebimentos:
 *
 * 1.1.1.05 - Banco Sicredi (DEVEDORA - aumenta com débito)
 * 1.1.2.01 - Clientes a Receber (DEVEDORA - aumenta com débito)
 *   1.1.2.01.001 - Cliente A
 *   1.1.2.01.002 - Cliente B
 *   ...
 *
 * Lançamento de RECEBIMENTO (baixa):
 * D - 1.1.1.05 (Banco)       - Aumenta disponibilidade
 * C - 1.1.2.01.xxx (Cliente) - Diminui contas a receber
 *
 * A natureza DEVEDORA significa:
 * - Saldo = Débitos - Créditos
 * - Débito AUMENTA o saldo
 * - Crédito DIMINUI o saldo
 */

// ============================================
// MAIN SERVICE
// ============================================

export class BoletoReconciliationService {

  /**
   * Busca todas as transações bancárias que são liquidações de cobrança
   * e ainda não foram conciliadas
   */
  static async findPendingBoletoTransactions(
    startDate: string,
    endDate: string
  ): Promise<BoletoMatch[]> {
    const { data: transactions, error } = await supabase
      .from('bank_transactions')
      .select('id, amount, transaction_date, description, matched, journal_entry_id')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .gt('amount', 0) // Apenas créditos (recebimentos)
      .or('description.ilike.%LIQ.COBRANCA%,description.ilike.%COBRANCA SIMPLES%,description.ilike.%COB0%')
      .order('transaction_date', { ascending: true });

    if (error) {
      console.error('Erro ao buscar transações de boleto:', error);
      return [];
    }

    const matches: BoletoMatch[] = [];

    for (const tx of transactions || []) {
      const cobCode = this.extractCobCode(tx.description);
      if (!cobCode) continue;

      const clients = await this.findClientsForCobCode(cobCode, tx.amount, tx.transaction_date);

      matches.push({
        bankTransactionId: tx.id,
        cobCode,
        transactionDate: tx.transaction_date,
        totalAmount: Number(tx.amount),
        description: tx.description,
        clients,
        matched: tx.matched || false,
        journalEntryId: tx.journal_entry_id || undefined,
        confidence: this.calculateConfidence(clients, tx.amount)
      });
    }

    return matches;
  }

  /**
   * Extrai o código COB da descrição da transação
   * Ex: "LIQ.COBRANCA SIMPLES-COB000005" -> "COB000005"
   */
  static extractCobCode(description: string): string | null {
    const match = description.match(COB_PATTERN);
    if (!match) return null;

    // Normaliza para formato COBxxxxxx
    let code = match[0].toUpperCase();
    if (!code.startsWith('COB')) {
      code = 'COB' + code.replace(/^OB/i, '');
    }
    return code;
  }

  /**
   * Busca os clientes associados a um código COB
   * Tenta várias fontes: boleto_payments, CSV importado, invoices
   *
   * IMPORTANTE: A data_extrato no CSV de cobrança é 1 dia ANTES da data real
   * da transação no banco. Ex: CSV mostra data_extrato = 01/01, banco mostra 02/01.
   * Por isso buscamos com tolerância de ±1 dia.
   */
  static async findClientsForCobCode(
    cobCode: string,
    totalAmount: number,
    transactionDate: string
  ): Promise<BoletoClientMatch[]> {
    const clients: BoletoClientMatch[] = [];

    // Calcular intervalo de datas (±1 dia) para compensar diferença entre data_extrato e transaction_date
    const txDate = new Date(transactionDate);
    const startDate = new Date(txDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date(txDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Tentar buscar em boleto_payments por COB + data de extrato (com tolerância de ±1 dia)
    const { data: boletoPayments } = await supabase
      .from('boleto_payments')
      .select('*')
      .eq('cob', cobCode)
      .gte('data_extrato', startDate)
      .lte('data_extrato', endDate);

    if (boletoPayments && boletoPayments.length > 0) {
      for (const bp of boletoPayments) {
        // Usar findOrCreateClientAccount para buscar/criar a conta
        const clientMatch = await this.findOrCreateClientAccount(bp.pagador || '');

        // Verificar se o cliente precisa ser cadastrado
        if (clientMatch?.needsRegistration) {
          clients.push({
            clientName: bp.pagador || 'Cliente',
            amount: Number(bp.valor_liquidado),
            accountCode: undefined,
            accountName: undefined,
            matched: false,
            needsRegistration: true
          });
        } else {
          clients.push({
            clientName: bp.pagador || 'Cliente',
            clientId: clientMatch?.clientId,
            amount: Number(bp.valor_liquidado),
            accountCode: clientMatch?.code,
            accountName: clientMatch?.name,
            matched: !!clientMatch?.code
          });
        }
      }
      return clients;
    }

    // 2. Tentar buscar via invoices pagas na data (com tolerância de ±1 dia)
    const { data: invoices } = await supabase
      .from('invoices')
      .select(`
        id,
        amount,
        client_id,
        clients(id, name)
      `)
      .eq('status', 'paid')
      .gte('paid_date', startDate)
      .lte('paid_date', endDate);

    if (invoices && invoices.length > 0) {
      // Tentar encontrar combinação que soma ao total
      const targetCents = Math.round(totalAmount * 100);
      const items = invoices
        .map(inv => ({
          cents: Math.round(Number(inv.amount) * 100),
          invoice: inv
        }))
        .sort((a, b) => b.cents - a.cents);

      // Backtracking para encontrar combinação
      const solution = this.findCombination(items, targetCents);

      if (solution.length > 0) {
        for (const inv of solution) {
          const clientData = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
          const clientName = clientData?.name || 'Cliente';
          // Usar findOrCreateClientAccount para buscar/criar a conta
          const clientMatch = await this.findOrCreateClientAccount(clientName);

          if (clientMatch?.needsRegistration) {
            clients.push({
              clientName,
              clientId: inv.client_id,
              invoiceId: inv.id,
              amount: Number(inv.amount),
              accountCode: undefined,
              accountName: undefined,
              matched: false,
              needsRegistration: true
            });
          } else {
            clients.push({
              clientName,
              clientId: inv.client_id || clientMatch?.clientId,
              invoiceId: inv.id,
              amount: Number(inv.amount),
              accountCode: clientMatch?.code,
              accountName: clientMatch?.name,
              matched: !!clientMatch?.code
            });
          }
        }
      }
    }

    // 3. Se ainda não encontrou, criar um cliente genérico
    if (clients.length === 0) {
      clients.push({
        clientName: 'Clientes Diversos',
        amount: totalAmount,
        accountCode: `${CLIENTS_RECEIVABLE_PREFIX}.99`,
        accountName: 'Clientes a Receber - Diversos',
        matched: false
      });
    }

    return clients;
  }

  /**
   * Busca a conta contábil do cliente pelo nome
   *
   * O plano de contas é a FONTE DA VERDADE.
   * Cada cliente deve ter uma subconta em 1.1.2.01.xxx
   *
   * Estratégia de busca (em ordem de prioridade):
   * 1. Buscar em intelligence_rules (regras já aprendidas pelo Dr. Cícero)
   * 2. Buscar diretamente no plano de contas por nome exato
   * 3. Buscar por similaridade de nome (threshold 60%)
   * 4. Retornar null se não encontrar (precisa criar conta manualmente)
   */
  static async findClientAccount(clientName: string): Promise<{ code: string; name: string; id: string } | null> {
    const normalized = this.normalizeClientName(clientName);

    // 1. Buscar em intelligence_rules (regras aprendidas)
    const { data: rules } = await supabase
      .from('intelligence_rules')
      .select('account_code, account_name, pattern')
      .ilike('account_code', `${CLIENTS_RECEIVABLE_PREFIX}%`);

    if (rules) {
      for (const rule of rules) {
        const rulePattern = this.normalizeClientName(rule.pattern || '');
        if (this.similarity(normalized, rulePattern) > 0.6) {
          // Buscar o ID da conta no plano
          const { data: acc } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('code', rule.account_code)
            .single();

          return {
            code: rule.account_code || '',
            name: rule.account_name || '',
            id: acc?.id || ''
          };
        }
      }
    }

    // 2. Buscar diretamente no plano de contas usando RPC (bypassa RLS)
    const { data: accounts, error: accountsError } = await supabase
      .rpc('get_client_accounts', { p_parent_code: CLIENTS_RECEIVABLE_PREFIX });

    if (accountsError) {
      // Erro ao buscar contas - continuar sem log
    }

    if (accounts && accounts.length > 0) {
      // Match exato por nome (case insensitive)
      const exact = accounts.find(a =>
        this.normalizeClientName(a.name || '').includes(normalized) ||
        normalized.includes(this.normalizeClientName(a.name || ''))
      );
      if (exact) {
        return { code: exact.code, name: exact.name || '', id: exact.id };
      }

      // Match por similaridade (Jaccard com threshold de 60%)
      let best: { account: typeof accounts[0]; score: number } | null = null;
      for (const acc of accounts) {
        const score = this.similarity(normalized, this.normalizeClientName(acc.name || ''));
        if (!best || score > best.score) {
          best = { account: acc, score };
        }
      }
      if (best && best.score >= 0.6) {
        return {
          code: best.account.code,
          name: best.account.name || '',
          id: best.account.id
        };
      }
    }

    // 3. Não encontrou - cliente precisa ser cadastrado no plano de contas
    return null;
  }

  /**
   * Cria o lançamento contábil para uma transação de boleto
   *
   * PARTIDAS DOBRADAS (Método das Partidas Dobradas):
   * Para cada recebimento de boleto:
   *
   * D - Banco Sicredi (1.1.1.05)        [Aumenta disponibilidade]
   * C - Clientes a Receber (1.1.2.01.xxx) [Diminui contas a receber]
   *
   * Regra fundamental: Total Débitos = Total Créditos
   *
   * O lançamento é balanceado:
   * - total_debit = total_credit = valor do recebimento
   * - balanced = true
   */
  static async createAccountingEntry(
    match: BoletoMatch,
    bankAccountCode: string = BANK_ACCOUNT_CODE
  ): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      success: false,
      bankTransactionId: match.bankTransactionId,
      entriesCreated: 0,
      totalDebited: 0,
      totalCredited: 0,
      errors: []
    };

    try {
      // 1. Buscar conta do banco no plano de contas
      const { data: bankAccount, error: bankError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, nature')
        .eq('code', bankAccountCode)
        .single();

      if (bankError || !bankAccount) {
        result.errors.push(`Conta bancária ${bankAccountCode} não encontrada no plano de contas. Verifique se existe.`);
        return result;
      }

      // 2. Verificar se os clientes têm contas válidas no plano
      const clientsWithMissingAccounts: string[] = [];
      const validClients: Array<BoletoClientMatch & { accountId: string }> = [];

      for (const client of match.clients) {
        if (!client.accountCode) {
          clientsWithMissingAccounts.push(client.clientName);
          continue;
        }

        const { data: clientAccount } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('code', client.accountCode)
          .single();

        if (clientAccount) {
          validClients.push({ ...client, accountId: clientAccount.id });
        } else {
          clientsWithMissingAccounts.push(`${client.clientName} (${client.accountCode})`);
        }
      }

      // Se nenhum cliente tem conta válida, não podemos criar o lançamento
      if (validClients.length === 0) {
        const errorMsg = `Nenhum cliente com conta válida no plano de contas. ` +
          `Clientes sem conta: ${clientsWithMissingAccounts.join(', ')}. ` +
          `Cadastre subcontas em ${CLIENTS_RECEIVABLE_PREFIX}.xxx`;
        result.errors.push(errorMsg);
        return result;
      }

      // Avisar sobre clientes sem conta (mas continuar com os válidos)
      if (clientsWithMissingAccounts.length > 0) {
        result.errors.push(
          `Aviso: ${clientsWithMissingAccounts.length} cliente(s) sem conta no plano: ` +
          clientsWithMissingAccounts.join(', ')
        );
      }

      // 3. Verificar se já existe lançamento para esta transação
      const { data: existing } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('transaction_id', match.bankTransactionId)
        .maybeSingle();

      // 4. Calcular totais baseado nos clientes válidos
      const totalValidAmount = validClients.reduce((sum, c) => sum + c.amount, 0);

      // 5. Criar ou atualizar o lançamento principal (cabeçalho)
      const entryPayload = {
        entry_type: 'BAIXA_RECEITA',
        description: `Recebimento ${match.cobCode} - ${validClients.length} cliente(s)`,
        entry_date: match.transactionDate,
        competence_date: match.transactionDate,
        reference_type: 'bank_transaction',
        reference_id: match.bankTransactionId,
        document_number: match.cobCode,
        total_debit: totalValidAmount,
        total_credit: totalValidAmount,
        balanced: true, // FUNDAMENTAL: débitos = créditos
        ai_generated: true,
        ai_model: 'boleto-reconciliation-v2',
        transaction_id: match.bankTransactionId
      };

      let entryId: string;

      if (existing) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from('accounting_entries')
          .update(entryPayload)
          .eq('id', existing.id);

        if (updateError) {
          result.errors.push('Erro ao atualizar lançamento: ' + updateError.message);
          return result;
        }

        // Limpar linhas antigas para recriar
        await supabase
          .from('accounting_entry_lines')
          .delete()
          .eq('entry_id', existing.id);

        entryId = existing.id;
      } else {
        // Criar novo
        const { data: newEntry, error: insertError } = await supabase
          .from('accounting_entries')
          .insert(entryPayload)
          .select('id')
          .single();

        if (insertError || !newEntry) {
          result.errors.push('Erro ao criar lançamento: ' + insertError?.message);
          return result;
        }

        entryId = newEntry.id;
      }

      result.journalEntryId = entryId;

      // 6. Criar linhas do lançamento (partidas dobradas)
      const lines: {
        entry_id: string;
        account_id: string;
        debit: number;
        credit: number;
        description: string;
      }[] = [];

      // DÉBITO: Banco Sicredi (aumenta disponibilidade)
      lines.push({
        entry_id: entryId,
        account_id: bankAccount.id,
        debit: totalValidAmount,
        credit: 0,
        description: `Recebimento boletos ${match.cobCode}`
      });
      result.totalDebited = totalValidAmount;

      // CRÉDITOS: Uma linha para cada cliente (diminui contas a receber)
      for (const client of validClients) {
        lines.push({
          entry_id: entryId,
          account_id: client.accountId,
          debit: 0,
          credit: client.amount,
          description: `Baixa ${client.clientName}`
        });
        result.totalCredited += client.amount;
      }

      // Verificar balanceamento antes de inserir
      if (Math.abs(result.totalDebited - result.totalCredited) > 0.01) {
        result.errors.push(
          `Lançamento desbalanceado: Débitos=${result.totalDebited} Créditos=${result.totalCredited}`
        );
        return result;
      }

      // 7. Inserir linhas
      const { error: linesError } = await supabase
        .from('accounting_entry_lines')
        .insert(lines);

      if (linesError) {
        result.errors.push('Erro ao criar linhas do lançamento: ' + linesError.message);
        return result;
      }

      result.entriesCreated = lines.length;

      // 8. Marcar transação bancária como conciliada
      const { error: updateTxError } = await supabase
        .from('bank_transactions')
        .update({
          matched: true,
          journal_entry_id: entryId
        })
        .eq('id', match.bankTransactionId);

      if (updateTxError) {
        result.errors.push('Aviso: Lançamento criado mas transação não marcada como conciliada');
      }

      result.success = true;

    } catch (error: any) {
      result.errors.push('Erro inesperado: ' + error.message);
    }

    return result;
  }

  /**
   * Concilia automaticamente todas as transações de boleto pendentes
   */
  static async autoReconcileAll(
    startDate: string,
    endDate: string,
    minConfidence: number = 80
  ): Promise<{
    processed: number;
    success: number;
    failed: number;
    results: ReconciliationResult[];
    unregisteredClients: UnregisteredClient[];
  }> {
    const pendingMatches = await this.findPendingBoletoTransactions(startDate, endDate);

    const results: ReconciliationResult[] = [];
    const unregisteredClients: UnregisteredClient[] = [];
    let success = 0;
    let failed = 0;

    for (const match of pendingMatches) {
      // Pular já conciliados
      if (match.matched) {
        continue;
      }

      // Coletar clientes não cadastrados
      const clientsNeedingReg = match.clients.filter(c => c.needsRegistration);
      if (clientsNeedingReg.length > 0) {
        for (const c of clientsNeedingReg) {
          // Evitar duplicatas na lista
          const alreadyAdded = unregisteredClients.some(
            u => u.name.toLowerCase() === c.clientName.toLowerCase()
          );
          if (!alreadyAdded) {
            unregisteredClients.push({
              name: c.clientName,
              amount: c.amount,
              cobCode: match.cobCode,
              transactionDate: match.transactionDate
            });
          }
        }
      }

      // Pular baixa confiança
      if (match.confidence < minConfidence) {
        const clientNames = clientsNeedingReg.map(c => c.clientName);
        results.push({
          success: false,
          bankTransactionId: match.bankTransactionId,
          entriesCreated: 0,
          totalDebited: 0,
          totalCredited: 0,
          errors: [`Confiança baixa: ${match.confidence}% (mínimo: ${minConfidence}%)`],
          clientsNeedingRegistration: clientNames.length > 0 ? clientNames : undefined
        });
        failed++;
        continue;
      }

      const result = await this.createAccountingEntry(match);

      // Adicionar clientes não cadastrados ao resultado
      const clientNames = clientsNeedingReg.map(c => c.clientName);
      if (clientNames.length > 0) {
        result.clientsNeedingRegistration = clientNames;
      }

      results.push(result);

      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    return {
      processed: pendingMatches.length,
      success,
      failed,
      results,
      unregisteredClients
    };
  }

  /**
   * Gera relatório de conciliação para um período
   */
  static async generateReconciliationReport(
    startDate: string,
    endDate: string
  ): Promise<ReconciliationReport> {
    const transactions = await this.findPendingBoletoTransactions(startDate, endDate);

    const reconciledTx = transactions.filter(t => t.matched);
    const pendingTx = transactions.filter(t => !t.matched);

    return {
      period: `${startDate} a ${endDate}`,
      totalTransactions: transactions.length,
      reconciledCount: reconciledTx.length,
      pendingCount: pendingTx.length,
      totalReconciled: reconciledTx.reduce((sum, t) => sum + t.totalAmount, 0),
      totalPending: pendingTx.reduce((sum, t) => sum + t.totalAmount, 0),
      transactions
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Busca ou cria a conta contábil do cliente
   *
   * IMPORTANTE: O cliente DEVE existir na tabela `clients` primeiro.
   * Se não existir, retorna needsRegistration: true para informar o usuário.
   *
   * Fluxo:
   * 1. Buscar cliente na tabela `clients` pelo nome (similaridade)
   * 2. Se não encontrar -> retorna { needsRegistration: true }
   * 3. Se encontrar:
   *    a. Verificar se já tem accounting_account_id vinculado
   *    b. Se sim, retorna a conta existente
   *    c. Se não, cria uma nova conta no plano de contas e vincula ao cliente
   */
  static async findOrCreateClientAccount(
    clientName: string,
    tenantId?: string
  ): Promise<{ code: string; name: string; id: string; clientId?: string; needsRegistration?: boolean } | null> {
    const normalized = this.normalizeClientName(clientName);

    // 1. Buscar cliente na tabela clients pelo nome usando RPC (bypassa RLS)
    const { data: clients, error: clientsError } = await supabase
      .rpc('get_clients_for_matching');

    if (clientsError) {
      console.error('Erro ao buscar clientes para matching:', clientsError);
      return null;
    }

    // Buscar por similaridade de nome
    let matchedClient: { id: string; name: string; accounting_account_id: string | null } | null = null;
    let bestScore = 0;

    for (const client of clients || []) {
      const clientNormalized = this.normalizeClientName(client.name || '');
      const score = this.similarity(normalized, clientNormalized);

      // Match exato (contém)
      if (clientNormalized.includes(normalized) || normalized.includes(clientNormalized)) {
        matchedClient = client;
        break;
      }

      // Similaridade >= 60%
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        matchedClient = client;
      }
    }

    // 2. Se não encontrou cliente cadastrado, retorna indicando necessidade de cadastro
    if (!matchedClient) {
      return {
        code: '',
        name: clientName,
        id: '',
        needsRegistration: true
      };
    }

    // 3. Verificar se cliente já tem conta contábil vinculada
    if (matchedClient.accounting_account_id) {
      // Buscar dados da conta existente
      const { data: existingAccount, error: accError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('id', matchedClient.accounting_account_id)
        .single();

      if (existingAccount && !accError) {
        return {
          code: existingAccount.code,
          name: existingAccount.name || matchedClient.name,
          id: existingAccount.id,
          clientId: matchedClient.id
        };
      }
    }

    // 4. Cliente existe mas não tem conta contábil - criar uma nova
    try {
      // Buscar o tenant_id usando RPC (bypassa RLS)
      let effectiveTenantId = tenantId;
      if (!effectiveTenantId) {
        const { data: tenantIdResult } = await supabase
          .rpc('get_current_user_tenant_id');
        effectiveTenantId = tenantIdResult || undefined;
      }

      if (!effectiveTenantId) {
        return null;
      }

      // Buscar a conta pai usando RPC (bypassa RLS)
      const { data: parentAccountResult, error: parentError } = await supabase
        .rpc('get_clients_parent_account');

      if (parentError || !parentAccountResult || parentAccountResult.length === 0) {
        return null;
      }

      const parentAccount = parentAccountResult[0];
      // Usar o tenant_id da conta pai para manter consistência
      effectiveTenantId = parentAccount.account_tenant_id;

      // Buscar o próximo código disponível usando RPC (bypassa RLS)
      const { data: nextCode, error: nextCodeError } = await supabase
        .rpc('get_next_client_account_code', { p_parent_code: CLIENTS_RECEIVABLE_PREFIX });

      if (nextCodeError || !nextCode) {
        return null;
      }

      const newCode = nextCode as string;

      // Usar o nome do cliente cadastrado (não o nome do boleto)
      const cleanedName = (matchedClient.name || clientName)
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);

      // Criar a nova conta usando RPC (bypassa RLS)
      const { data: newAccountResult, error: insertError } = await supabase
        .rpc('create_client_account', {
          p_code: newCode,
          p_name: cleanedName,
          p_parent_id: parentAccount.account_id,
          p_tenant_id: effectiveTenantId,
          p_description: `Conta criada automaticamente para cliente: ${cleanedName}`
        });

      if (insertError || !newAccountResult || newAccountResult.length === 0) {
        return null;
      }

      const newAccount = newAccountResult[0];

      // 5. Vincular a nova conta ao cliente
      await supabase
        .from('clients')
        .update({ accounting_account_id: newAccount.id })
        .eq('id', matchedClient.id);

      return {
        code: newAccount.code,
        name: newAccount.name || cleanedName,
        id: newAccount.id,
        clientId: matchedClient.id
      };
    } catch {
      return null;
    }
  }

  private static normalizeClientName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\b(ltda|eireli|me|epp|s\/a|sa|-?\s*me)\b/gi, '') // Remove sufixos
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static similarity(a: string, b: string): number {
    const setA = new Set(a.split(' '));
    const setB = new Set(b.split(' '));
    if (setA.size === 0 || setB.size === 0) return 0;

    const intersection = [...setA].filter(w => setB.has(w)).length;
    return intersection / Math.max(setA.size, setB.size);
  }

  private static calculateConfidence(clients: BoletoClientMatch[], totalAmount: number): number {
    if (clients.length === 0) {
      return 0;
    }

    const clientsTotal = clients.reduce((sum, c) => sum + c.amount, 0);
    const amountMatch = Math.abs(clientsTotal - totalAmount) < 0.01 ? 40 : 0;

    const matchedClients = clients.filter(c => c.matched).length;
    const clientMatchScore = (matchedClients / clients.length) * 40;

    const hasAccounts = clients.every(c => c.accountCode) ? 20 :
                        clients.some(c => c.accountCode) ? 10 : 0;

    return Math.min(100, amountMatch + clientMatchScore + hasAccounts);
  }

  private static findCombination(
    items: { cents: number; invoice: any }[],
    targetCents: number
  ): any[] {
    let solution: any[] | null = null;

    function backtrack(start: number, sum: number, picked: any[]) {
      if (solution) return;
      if (sum === targetCents) {
        solution = [...picked];
        return;
      }
      if (sum > targetCents) return;

      for (let i = start; i < items.length; i++) {
        const next = items[i];
        if (sum + next.cents > targetCents) continue;
        picked.push(next.invoice);
        backtrack(i + 1, sum + next.cents, picked);
        picked.pop();
        if (solution) return;
      }
    }

    backtrack(0, 0, []);
    return solution || [];
  }
}

export default BoletoReconciliationService;
