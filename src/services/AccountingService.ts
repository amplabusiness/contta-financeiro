/**
 * AccountingService - Serviço Central de Contabilidade
 *
 * Este serviço é o ÚNICO ponto de entrada para criação de lançamentos contábeis.
 * Todos os formulários e importações DEVEM usar este serviço para garantir
 * que todo dado inserido no sistema tenha seu lançamento contábil correspondente.
 *
 * ARQUITETURA:
 * - Chamado automaticamente quando dados são inseridos
 * - Garante partida dobrada (débito = crédito)
 * - Cria contas automaticamente quando necessário
 * - Idempotente (não cria duplicatas)
 *
 * TIPOS DE LANÇAMENTO:
 * - receita_honorarios: Provisionamento de receita (D: Cliente, C: Receita)
 * - recebimento: Entrada de caixa (D: Caixa, C: Cliente)
 * - saldo_abertura: Saldo inicial de cliente (D: Cliente, C: Receita)
 * - despesa: Provisionamento de despesa (D: Despesa, C: Fornecedor)
 * - pagamento_despesa: Saída de caixa (D: Fornecedor, C: Caixa)
 * - transferencia_bancaria: Movimentação entre contas (D: Banco Dest, C: Banco Orig)
 */

import { supabase } from '@/integrations/supabase/client';

// Tipos de lançamento contábil suportados
export type EntryType =
  | 'receita_honorarios'    // Fatura emitida / honorário gerado
  | 'recebimento'           // Pagamento recebido
  | 'saldo_abertura'        // Saldo inicial do cliente
  | 'despesa'               // Despesa provisionada
  | 'pagamento_despesa'     // Despesa paga
  | 'transferencia_bancaria' // Transferência entre contas
  | 'importacao_ofx'        // Lançamento via OFX
  | 'ajuste_manual';        // Ajuste contábil manual

// Parâmetros para criação de lançamento
export interface AccountingEntryParams {
  entryType: EntryType;
  amount: number;
  date: string;                    // YYYY-MM-DD
  description: string;
  competence?: string;             // MM/YYYY
  clientId?: string;
  clientName?: string;
  supplierId?: string;
  supplierName?: string;
  referenceType: string;           // Tabela de origem (invoice, expense, etc)
  referenceId: string;             // ID do registro origem
  bankAccountId?: string;          // Para lançamentos bancários
  expenseCategory?: string;        // Categoria da despesa
  metadata?: Record<string, any>;  // Dados adicionais
}

// Resultado da operação contábil
export interface AccountingResult {
  success: boolean;
  entryId?: string;
  message?: string;
  error?: string;
  debitAccountId?: string;
  creditAccountId?: string;
}

// Mapeamento de categorias de despesa para contas contábeis
const EXPENSE_ACCOUNT_MAP: Record<string, { code: string; name: string; parent: string }> = {
  'salarios': { code: '4.1.1.01', name: 'Salários e Ordenados', parent: '4.1.1' },
  'encargos': { code: '4.1.1.02', name: 'Encargos Sociais', parent: '4.1.1' },
  'aluguel': { code: '4.1.2.01', name: 'Aluguel', parent: '4.1.2' },
  'energia': { code: '4.1.2.02', name: 'Energia Elétrica', parent: '4.1.2' },
  'telefone': { code: '4.1.2.03', name: 'Telefone e Internet', parent: '4.1.2' },
  'internet': { code: '4.1.2.03', name: 'Telefone e Internet', parent: '4.1.2' },
  'material': { code: '4.1.2.04', name: 'Material de Escritório', parent: '4.1.2' },
  'servicos': { code: '4.1.2.05', name: 'Serviços de Terceiros', parent: '4.1.2' },
  'software': { code: '4.1.2.06', name: 'Software e Licenças', parent: '4.1.2' },
  'marketing': { code: '4.1.2.07', name: 'Marketing e Publicidade', parent: '4.1.2' },
  'viagem': { code: '4.1.2.08', name: 'Viagens e Deslocamentos', parent: '4.1.2' },
  'juros': { code: '4.1.3.01', name: 'Juros e Multas', parent: '4.1.3' },
  'tarifas': { code: '4.1.3.02', name: 'Tarifas Bancárias', parent: '4.1.3' },
  'impostos': { code: '4.1.4.01', name: 'Impostos e Taxas', parent: '4.1.4' },
  'default': { code: '4.1.2.99', name: 'Outras Despesas Administrativas', parent: '4.1.2' },
};

/**
 * Serviço Central de Contabilidade
 */
class AccountingService {
  private static instance: AccountingService;

  private constructor() {}

  static getInstance(): AccountingService {
    if (!AccountingService.instance) {
      AccountingService.instance = new AccountingService();
    }
    return AccountingService.instance;
  }

  /**
   * Cria um lançamento contábil de forma atômica
   * Este é o método principal que deve ser chamado por todos os formulários
   */
  async createEntry(params: AccountingEntryParams): Promise<AccountingResult> {
    console.log('[AccountingService] Creating entry:', params);

    try {
      // Validações básicas
      if (!params.amount || params.amount <= 0) {
        return { success: false, error: 'Valor deve ser maior que zero' };
      }

      if (!params.date) {
        return { success: false, error: 'Data é obrigatória' };
      }

      // Verificar se já existe lançamento para esta referência (idempotência)
      const existing = await this.checkExistingEntry(params.referenceType, params.referenceId, params.entryType);
      if (existing) {
        console.log('[AccountingService] Entry already exists:', existing);
        return {
          success: true,
          entryId: existing,
          message: 'Lançamento já existia'
        };
      }

      // Chamar a Edge Function para criar o lançamento
      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: {
          action: 'create_entry',
          entry_type: params.entryType,
          amount: params.amount,
          date: params.date,
          description: params.description,
          competence: params.competence,
          client_id: params.clientId,
          client_name: params.clientName,
          reference_type: params.referenceType,
          reference_id: params.referenceId,
          expense_category: params.expenseCategory,
          metadata: params.metadata,
        }
      });

      if (error) {
        console.error('[AccountingService] Edge function error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        console.error('[AccountingService] Entry creation failed:', data);
        return { success: false, error: data?.error || 'Erro ao criar lançamento' };
      }

      console.log('[AccountingService] Entry created successfully:', data);
      return {
        success: true,
        entryId: data.entry_id,
        message: data.message || 'Lançamento criado com sucesso'
      };

    } catch (error: any) {
      console.error('[AccountingService] Unexpected error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifica se já existe um lançamento para a referência
   */
  private async checkExistingEntry(
    referenceType: string,
    referenceId: string,
    entryType: string
  ): Promise<string | null> {
    const { data } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .eq('entry_type', entryType)
      .maybeSingle();

    return data?.id || null;
  }

  // ============================================
  // MÉTODOS DE CONVENIÊNCIA POR TIPO DE OPERAÇÃO
  // ============================================

  /**
   * Registra receita de honorários (fatura emitida)
   * D: Cliente a Receber
   * C: Receita de Honorários
   */
  async registrarHonorario(params: {
    invoiceId: string;
    clientId: string;
    clientName: string;
    amount: number;
    competence: string;
    dueDate: string;
    description?: string;
  }): Promise<AccountingResult> {
    return this.createEntry({
      entryType: 'receita_honorarios',
      amount: params.amount,
      date: params.dueDate,
      description: params.description || `Honorários ${params.competence} - ${params.clientName}`,
      competence: params.competence,
      clientId: params.clientId,
      clientName: params.clientName,
      referenceType: 'invoice',
      referenceId: params.invoiceId,
    });
  }

  /**
   * Registra recebimento de cliente
   * D: Caixa/Banco
   * C: Cliente a Receber
   */
  async registrarRecebimento(params: {
    paymentId: string;
    invoiceId: string;
    clientId: string;
    clientName: string;
    amount: number;
    paymentDate: string;
    bankAccountId?: string;
    description?: string;
  }): Promise<AccountingResult> {
    return this.createEntry({
      entryType: 'recebimento',
      amount: params.amount,
      date: params.paymentDate,
      description: params.description || `Recebimento de ${params.clientName}`,
      clientId: params.clientId,
      clientName: params.clientName,
      referenceType: 'invoice_payment',
      referenceId: params.paymentId || params.invoiceId,
      bankAccountId: params.bankAccountId,
    });
  }

  /**
   * Registra saldo de abertura de cliente
   * D: Cliente a Receber
   * C: Receita de Honorários (ou Saldos Iniciais)
   */
  async registrarSaldoAbertura(params: {
    balanceId: string;
    clientId: string;
    clientName: string;
    amount: number;
    competence: string;
    dueDate: string;
    description?: string;
  }): Promise<AccountingResult> {
    return this.createEntry({
      entryType: 'saldo_abertura',
      amount: params.amount,
      date: params.dueDate,
      description: params.description || `Saldo de Abertura ${params.competence} - ${params.clientName}`,
      competence: params.competence,
      clientId: params.clientId,
      clientName: params.clientName,
      referenceType: 'opening_balance',
      referenceId: params.balanceId,
    });
  }

  /**
   * Registra despesa (provisionamento)
   * D: Conta de Despesa
   * C: Fornecedor a Pagar
   */
  async registrarDespesa(params: {
    expenseId: string;
    amount: number;
    expenseDate: string;
    category: string;
    description: string;
    supplierId?: string;
    supplierName?: string;
    competence?: string;
  }): Promise<AccountingResult> {
    return this.createEntry({
      entryType: 'despesa',
      amount: params.amount,
      date: params.expenseDate,
      description: params.description,
      competence: params.competence,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      referenceType: 'expense',
      referenceId: params.expenseId,
      expenseCategory: params.category,
    });
  }

  /**
   * Registra pagamento de despesa
   * D: Fornecedor a Pagar
   * C: Caixa/Banco
   */
  async registrarPagamentoDespesa(params: {
    paymentId: string;
    expenseId: string;
    amount: number;
    paymentDate: string;
    description: string;
    bankAccountId?: string;
  }): Promise<AccountingResult> {
    return this.createEntry({
      entryType: 'pagamento_despesa',
      amount: params.amount,
      date: params.paymentDate,
      description: `Pagamento: ${params.description}`,
      referenceType: 'expense_payment',
      referenceId: params.paymentId || params.expenseId,
      bankAccountId: params.bankAccountId,
    });
  }

  /**
   * Registra lançamento de importação OFX
   * Analisa automaticamente se é débito ou crédito
   */
  async registrarLancamentoOFX(params: {
    transactionId: string;
    amount: number;
    transactionDate: string;
    description: string;
    bankAccountId: string;
    isCredit: boolean;
    suggestedCategory?: string;
  }): Promise<AccountingResult> {
    // Se é crédito (dinheiro entrando), pode ser recebimento
    // Se é débito (dinheiro saindo), pode ser pagamento de despesa
    const entryType = params.isCredit ? 'recebimento' : 'pagamento_despesa';

    return this.createEntry({
      entryType: params.isCredit ? 'recebimento' : 'pagamento_despesa',
      amount: Math.abs(params.amount),
      date: params.transactionDate,
      description: params.description,
      referenceType: 'ofx_transaction',
      referenceId: params.transactionId,
      bankAccountId: params.bankAccountId,
      expenseCategory: !params.isCredit ? params.suggestedCategory : undefined,
    });
  }

  /**
   * Registra transferência entre contas bancárias
   * D: Banco Destino
   * C: Banco Origem
   */
  async registrarTransferencia(params: {
    transferId: string;
    amount: number;
    transferDate: string;
    fromBankAccountId: string;
    toBankAccountId: string;
    description?: string;
  }): Promise<AccountingResult> {
    return this.createEntry({
      entryType: 'transferencia_bancaria',
      amount: params.amount,
      date: params.transferDate,
      description: params.description || 'Transferência entre contas',
      referenceType: 'bank_transfer',
      referenceId: params.transferId,
      bankAccountId: params.toBankAccountId,
      metadata: {
        fromBankAccountId: params.fromBankAccountId,
        toBankAccountId: params.toBankAccountId,
      },
    });
  }

  // ============================================
  // MÉTODOS UTILITÁRIOS
  // ============================================

  /**
   * Inicializa o plano de contas padrão
   */
  async initializeChartOfAccounts(): Promise<AccountingResult> {
    try {
      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'init_chart' }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: data?.success || false,
        message: data?.message,
        error: data?.error,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém status de debug das tabelas contábeis
   */
  async getDebugStatus(): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'debug_status' }
      });

      if (error) {
        throw error;
      }

      return data?.debug;
    } catch (error: any) {
      console.error('[AccountingService] Debug status error:', error);
      return null;
    }
  }

  /**
   * Mapeia categoria de despesa para conta contábil
   */
  getExpenseAccountCode(category: string): { code: string; name: string; parent: string } {
    const key = category?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || 'default';
    return EXPENSE_ACCOUNT_MAP[key] || EXPENSE_ACCOUNT_MAP['default'];
  }
}

// Exportar instância singleton
export const accountingService = AccountingService.getInstance();

// Exportar também a classe para testes
export { AccountingService };
