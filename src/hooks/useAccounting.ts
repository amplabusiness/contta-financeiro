/**
 * useAccounting - Hook React para Contabilidade Integrada
 *
 * DR. CÍCERO - NBC TG 26: REGRA SUPREMA
 * Todo lançamento DEVE ter origem rastreável (referenceType + referenceId)
 * O internal_code é gerado automaticamente pelo banco de dados
 *
 * Este hook fornece acesso fácil ao AccountingService em qualquer componente React.
 * Use este hook em todos os formulários que inserem dados financeiros.
 *
 * EXEMPLO DE USO:
 *
 * ```tsx
 * const { registrarHonorario, loading, error, lastResult } = useAccounting();
 *
 * const handleSaveInvoice = async (invoice) => {
 *   // Salvar a fatura
 *   const { data: newInvoice } = await supabase.from('invoices').insert(invoice).select().single();
 *
 *   // Criar lançamento contábil automaticamente
 *   const result = await registrarHonorario({
 *     invoiceId: newInvoice.id,
 *     clientId: newInvoice.client_id,
 *     clientName: client.name,
 *     amount: newInvoice.amount,
 *     competence: newInvoice.competence,
 *     dueDate: newInvoice.due_date,
 *   });
 *
 *   // DR. CÍCERO: Acessar código de rastreabilidade
 *   console.log('Código interno:', result.internalCode);
 * };
 * ```
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  accountingService,
  AccountingEntryParams,
  AccountingResult,
} from '@/services/AccountingService';

interface UseAccountingOptions {
  showToasts?: boolean;        // Mostrar toasts de sucesso/erro
  throwOnError?: boolean;      // Lançar exceção em caso de erro
  sourceModule?: string;       // DR. CÍCERO: Módulo de origem para rastreabilidade
}

export function useAccounting(options: UseAccountingOptions = {}) {
  const { showToasts = true, throwOnError = false, sourceModule } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AccountingResult | null>(null);
  const [lastInternalCode, setLastInternalCode] = useState<string | null>(null);

  // Handler genérico para processar resultados
  // DR. CÍCERO: Capturar e expor código interno de rastreabilidade
  const handleResult = useCallback((result: AccountingResult, operationName: string) => {
    setLastResult(result);

    // DR. CÍCERO: Armazenar código interno para rastreabilidade
    if (result.internalCode) {
      setLastInternalCode(result.internalCode);
      console.log(`[Dr. Cícero] Lançamento rastreável: ${result.internalCode}`);
    }

    if (!result.success) {
      const errorMsg = result.error || 'Erro ao criar lançamento contábil';
      setError(errorMsg);

      if (showToasts) {
        toast.error(`Erro contábil: ${errorMsg}`);
      }

      if (throwOnError) {
        throw new Error(errorMsg);
      }

      return result;
    }

    setError(null);

    if (showToasts && result.message) {
      // Toast discreto para não poluir a interface
      console.log(`[Contabilidade] ${operationName}: ${result.message}`);
    }

    return result;
  }, [showToasts, throwOnError]);

  // Wrapper genérico para operações assíncronas
  const executeOperation = useCallback(async <T>(
    operation: () => Promise<AccountingResult>,
    operationName: string
  ): Promise<AccountingResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await operation();
      return handleResult(result, operationName);
    } catch (err: any) {
      const errorResult: AccountingResult = {
        success: false,
        error: err.message || 'Erro inesperado',
      };
      return handleResult(errorResult, operationName);
    } finally {
      setLoading(false);
    }
  }, [handleResult]);

  // ============================================
  // MÉTODOS EXPOSTOS PELO HOOK
  // ============================================

  /**
   * Registra receita de honorários (quando fatura é emitida)
   */
  const registrarHonorario = useCallback(async (params: {
    invoiceId: string;
    clientId: string;
    clientName: string;
    amount: number;
    competence: string;
    dueDate: string;
    description?: string;
  }) => {
    return executeOperation(
      () => accountingService.registrarHonorario(params),
      'Honorário registrado'
    );
  }, [executeOperation]);

  /**
   * Registra recebimento de cliente (quando pagamento é confirmado)
   */
  const registrarRecebimento = useCallback(async (params: {
    paymentId: string;
    invoiceId: string;
    clientId: string;
    clientName: string;
    amount: number;
    paymentDate: string;
    bankAccountId?: string;
    description?: string;
  }) => {
    return executeOperation(
      () => accountingService.registrarRecebimento(params),
      'Recebimento registrado'
    );
  }, [executeOperation]);

  /**
   * Registra saldo de abertura de cliente
   */
  const registrarSaldoAbertura = useCallback(async (params: {
    balanceId: string;
    clientId: string;
    clientName: string;
    amount: number;
    competence: string;
    dueDate: string;
    description?: string;
  }) => {
    return executeOperation(
      () => accountingService.registrarSaldoAbertura(params),
      'Saldo de abertura registrado'
    );
  }, [executeOperation]);

  /**
   * Registra despesa (provisionamento)
   */
  const registrarDespesa = useCallback(async (params: {
    expenseId: string;
    amount: number;
    expenseDate: string;
    category: string;
    description: string;
    supplierId?: string;
    supplierName?: string;
    competence?: string;
  }) => {
    return executeOperation(
      () => accountingService.registrarDespesa(params),
      'Despesa registrada'
    );
  }, [executeOperation]);

  /**
   * Registra pagamento de despesa
   */
  const registrarPagamentoDespesa = useCallback(async (params: {
    paymentId: string;
    expenseId: string;
    amount: number;
    paymentDate: string;
    description: string;
    bankAccountId?: string;
  }) => {
    return executeOperation(
      () => accountingService.registrarPagamentoDespesa(params),
      'Pagamento de despesa registrado'
    );
  }, [executeOperation]);

  /**
   * Registra lançamento de importação OFX
   */
  const registrarLancamentoOFX = useCallback(async (params: {
    transactionId: string;
    amount: number;
    transactionDate: string;
    description: string;
    bankAccountId: string;
    isCredit: boolean;
    suggestedCategory?: string;
  }) => {
    return executeOperation(
      () => accountingService.registrarLancamentoOFX(params),
      'Lançamento OFX registrado'
    );
  }, [executeOperation]);

  /**
   * Registra transferência entre contas
   */
  const registrarTransferencia = useCallback(async (params: {
    transferId: string;
    amount: number;
    transferDate: string;
    fromBankAccountId: string;
    toBankAccountId: string;
    description?: string;
  }) => {
    return executeOperation(
      () => accountingService.registrarTransferencia(params),
      'Transferência registrada'
    );
  }, [executeOperation]);

  /**
   * Cria lançamento genérico (para casos especiais)
   */
  const criarLancamento = useCallback(async (params: AccountingEntryParams) => {
    return executeOperation(
      () => accountingService.createEntry(params),
      'Lançamento criado'
    );
  }, [executeOperation]);

  /**
   * Inicializa o plano de contas
   */
  const initializeChart = useCallback(async () => {
    return executeOperation(
      () => accountingService.initializeChartOfAccounts(),
      'Plano de contas inicializado'
    );
  }, [executeOperation]);

  /**
   * Obtém status de debug
   */
  const getDebugStatus = useCallback(async () => {
    setLoading(true);
    try {
      const debug = await accountingService.getDebugStatus();
      return debug;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deleta lançamentos contábeis de uma despesa (provisionamento + pagamento)
   */
  const deletarLancamentosDespesa = useCallback(async (expenseId: string) => {
    return executeOperation(
      () => accountingService.deletarLancamentosDespesa(expenseId),
      'Lançamentos da despesa excluídos'
    );
  }, [executeOperation]);

  /**
   * Deleta lançamentos contábeis por referência genérica
   */
  const deletarLancamentoPorReferencia = useCallback(async (params: {
    referenceType: string;
    referenceId: string;
  }) => {
    return executeOperation(
      () => accountingService.deletarLancamentoPorReferencia(params),
      'Lançamento excluído'
    );
  }, [executeOperation]);

  return {
    // Estado
    loading,
    error,
    lastResult,
    lastInternalCode,          // DR. CÍCERO: Código de rastreabilidade do último lançamento

    // Métodos de registro
    registrarHonorario,
    registrarRecebimento,
    registrarSaldoAbertura,
    registrarDespesa,
    registrarPagamentoDespesa,
    registrarLancamentoOFX,
    registrarTransferencia,

    // Métodos genéricos
    criarLancamento,
    initializeChart,
    getDebugStatus,

    // Métodos de exclusão
    deletarLancamentosDespesa,
    deletarLancamentoPorReferencia,

    // Acesso direto ao serviço (para casos especiais)
    service: accountingService,

    // DR. CÍCERO: Módulo de origem configurado
    sourceModule,
  };
}

export default useAccounting;
