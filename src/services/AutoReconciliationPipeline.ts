/**
 * AutoReconciliationPipeline - Pipeline de Conciliação Automática
 *
 * Sprint 3: Automação completa do fluxo de conciliação bancária
 *
 * FLUXO:
 * 1. Busca transação bancária
 * 2. Verifica se já está conciliada
 * 3. Verifica identificação do pagador
 * 4. Busca fatura correspondente
 * 5. Cria lançamento contábil
 * 6. Atualiza transação e fatura
 * 7. Registra feedback para aprendizado
 */

import { supabase } from '@/integrations/supabase/client';
import { accountingService } from '@/services/AccountingService';

// Passos do pipeline
export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  duration?: number;
}

// Resultado do processamento de uma transação
export interface PipelineResult {
  transactionId: string;
  success: boolean;
  steps: PipelineStep[];
  finalStatus: 'reconciled' | 'needs_review' | 'failed' | 'already_reconciled';
  accountingEntryId?: string;
  invoiceId?: string;
  clientId?: string;
  clientName?: string;
  confidence?: number;
  method?: string;
}

// Estatísticas de processamento em lote
export interface BatchProcessingStats {
  processed: number;
  reconciled: number;
  needsReview: number;
  failed: number;
  alreadyReconciled: number;
  totalAmount: number;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
}

// Configuração do pipeline
export interface PipelineConfig {
  autoReconcileThreshold: number;  // Confiança mínima para auto-conciliar (default: 90)
  reviewThreshold: number;          // Confiança mínima para sugerir (default: 70)
  createAccountingEntry: boolean;   // Se deve criar lançamento contábil
  updateInvoiceStatus: boolean;     // Se deve atualizar status da fatura
  registerFeedback: boolean;        // Se deve registrar feedback para aprendizado
  maxRetries: number;               // Tentativas em caso de erro
}

const DEFAULT_CONFIG: PipelineConfig = {
  autoReconcileThreshold: 90,
  reviewThreshold: 70,
  createAccountingEntry: true,
  updateInvoiceStatus: true,
  registerFeedback: true,
  maxRetries: 2,
};

/**
 * Pipeline de Conciliação Automática
 */
class AutoReconciliationPipelineService {
  private static instance: AutoReconciliationPipelineService;
  private config: PipelineConfig;

  private constructor() {
    this.config = DEFAULT_CONFIG;
  }

  static getInstance(): AutoReconciliationPipelineService {
    if (!AutoReconciliationPipelineService.instance) {
      AutoReconciliationPipelineService.instance = new AutoReconciliationPipelineService();
    }
    return AutoReconciliationPipelineService.instance;
  }

  /**
   * Configura o pipeline
   */
  configure(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Processa uma única transação pelo pipeline completo
   */
  async processTransaction(transactionId: string): Promise<PipelineResult> {
    const result: PipelineResult = {
      transactionId,
      success: false,
      steps: [],
      finalStatus: 'failed',
    };

    const startTime = Date.now();

    try {
      // STEP 1: Buscar transação
      const step1 = this.createStep('fetch_transaction');
      result.steps.push(step1);

      const { data: tx, error: txError } = await supabase
        .from('bank_transactions')
        .select(`
          *,
          clients:suggested_client_id (
            id, name, accounting_account_id,
            chart_of_accounts:accounting_account_id (id, code, name)
          ),
          bank_accounts:bank_account_id (id, name, account_number)
        `)
        .eq('id', transactionId)
        .single();

      if (txError || !tx) {
        step1.status = 'failed';
        step1.error = txError?.message || 'Transação não encontrada';
        step1.duration = Date.now() - startTime;
        return result;
      }

      step1.status = 'completed';
      step1.result = {
        amount: tx.amount,
        type: tx.transaction_type,
        description: tx.description?.substring(0, 50)
      };
      step1.duration = Date.now() - startTime;

      // STEP 2: Verificar se já está conciliada
      const step2 = this.createStep('check_reconciled');
      result.steps.push(step2);

      if (tx.matched || tx.journal_entry_id) {
        step2.status = 'completed';
        step2.result = { alreadyReconciled: true };
        result.success = true;
        result.finalStatus = 'already_reconciled';
        return result;
      }

      step2.status = 'completed';
      step2.result = { needsProcessing: true };

      // STEP 3: Verificar identificação do pagador
      const step3 = this.createStep('check_identification');
      result.steps.push(step3);

      let clientId = tx.suggested_client_id;
      let confidence = tx.identification_confidence || 0;
      let method = tx.identification_method;

      // Se não tem identificação, tentar identificar agora
      if (!clientId) {
        const identResult = await this.identifyPayer(tx);
        if (identResult.clientId) {
          clientId = identResult.clientId;
          confidence = identResult.confidence;
          method = identResult.method;
        }
      }

      if (!clientId || confidence < this.config.reviewThreshold) {
        step3.status = 'completed';
        step3.result = {
          identified: false,
          confidence,
          reason: 'Confiança insuficiente ou pagador não identificado'
        };
        result.finalStatus = 'needs_review';
        result.success = true;
        result.confidence = confidence;
        return result;
      }

      step3.status = 'completed';
      step3.result = { clientId, confidence, method };
      result.clientId = clientId;
      result.confidence = confidence;
      result.method = method;

      // Buscar dados do cliente
      const { data: client } = await supabase
        .from('clients')
        .select('id, name, accounting_account_id, chart_of_accounts:accounting_account_id(code)')
        .eq('id', clientId)
        .single();

      if (client) {
        result.clientName = client.name;
      }

      // Se confiança abaixo do threshold de auto-conciliação, marcar para revisão
      if (confidence < this.config.autoReconcileThreshold) {
        result.finalStatus = 'needs_review';
        result.success = true;

        // Atualizar transação com sugestão
        await supabase
          .from('bank_transactions')
          .update({
            suggested_client_id: clientId,
            identification_confidence: confidence,
            identification_method: method,
            needs_review: true,
            auto_matched: false
          })
          .eq('id', transactionId);

        return result;
      }

      // STEP 4: Buscar fatura correspondente
      const step4 = this.createStep('find_invoice');
      result.steps.push(step4);

      const invoice = await this.findMatchingInvoice(tx, clientId);

      step4.status = 'completed';
      step4.result = invoice
        ? { invoiceId: invoice.id, amount: invoice.amount }
        : { invoiceId: null };

      if (invoice) {
        result.invoiceId = invoice.id;
      }

      // STEP 5: Criar lançamento contábil (se configurado)
      if (this.config.createAccountingEntry) {
        const step5 = this.createStep('create_accounting_entry');
        result.steps.push(step5);

        if (!client?.accounting_account_id) {
          step5.status = 'failed';
          step5.error = 'Cliente não possui conta contábil vinculada';
          result.finalStatus = 'needs_review';
          result.success = true;

          await supabase
            .from('bank_transactions')
            .update({ needs_review: true })
            .eq('id', transactionId);

          return result;
        }

        try {
          const entryResult = await accountingService.registrarRecebimento({
            paymentId: tx.id,
            invoiceId: invoice?.id || tx.id,
            clientId: clientId,
            clientName: client?.name || 'Cliente',
            amount: Number(tx.amount),
            paymentDate: tx.transaction_date,
            bankAccountId: tx.bank_account_id,
            description: `Recebimento automático - ${tx.description?.substring(0, 100)}`
          });

          if (!entryResult.success) {
            step5.status = 'failed';
            step5.error = entryResult.error || 'Erro ao criar lançamento';
            result.finalStatus = 'failed';
            return result;
          }

          step5.status = 'completed';
          step5.result = { entryId: entryResult.entryId };
          result.accountingEntryId = entryResult.entryId;
        } catch (err: any) {
          step5.status = 'failed';
          step5.error = err.message;
          result.finalStatus = 'failed';
          return result;
        }
      }

      // STEP 6: Atualizar registros
      const step6 = this.createStep('update_records');
      result.steps.push(step6);

      // RECONCILIAR VIA RPC OFICIAL
      // Dr. Cícero: Toda reconciliação DEVE passar pelo RPC
      const { data: reconcileResult, error: rpcError } = await supabase.rpc('reconcile_transaction', {
        p_transaction_id: transactionId,
        p_journal_entry_id: result.accountingEntryId,
        p_actor: 'auto-pipeline'
      });

      // Atualizar campos adicionais (não cobertos pelo RPC)
      await supabase
        .from('bank_transactions')
        .update({
          auto_matched: true,
          needs_review: false,
          suggested_client_id: clientId,
          identification_confidence: confidence,
          identification_method: method,
          reconciliation_method: 'auto_pipeline'
        })
        .eq('id', transactionId);

      // Atualizar fatura (se configurado e encontrada)
      if (this.config.updateInvoiceStatus && invoice) {
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_date: tx.transaction_date,
            paid_amount: tx.amount
          })
          .eq('id', invoice.id);
      }

      step6.status = 'completed';
      step6.result = { transactionUpdated: true, invoiceUpdated: !!invoice, rpcUsed: !rpcError };

      // STEP 7: Registrar feedback para aprendizado (se configurado)
      if (this.config.registerFeedback) {
        const step7 = this.createStep('register_feedback');
        result.steps.push(step7);

        try {
          await supabase.rpc('fn_confirm_suggestion', {
            p_transaction_id: transactionId,
            p_user_id: null // Sistema
          });
          step7.status = 'completed';
        } catch {
          step7.status = 'skipped';
          step7.error = 'Feedback não registrado (não crítico)';
        }
      }

      result.success = true;
      result.finalStatus = 'reconciled';

    } catch (error: any) {
      result.steps.push({
        name: 'unexpected_error',
        status: 'failed',
        error: error.message
      });
    }

    return result;
  }

  /**
   * Processa todas as transações pendentes de um tenant
   */
  async processAllPending(tenantId: string, limit = 100): Promise<BatchProcessingStats> {
    const stats: BatchProcessingStats = {
      processed: 0,
      reconciled: 0,
      needsReview: 0,
      failed: 0,
      alreadyReconciled: 0,
      totalAmount: 0,
      startTime: new Date()
    };

    // Buscar transações pendentes com identificação suficiente
    const { data: pendingTx, error } = await supabase
      .from('bank_transactions')
      .select('id, amount')
      .eq('tenant_id', tenantId)
      .eq('matched', false)
      .gt('amount', 0) // Apenas créditos
      .order('transaction_date', { ascending: true })
      .limit(limit);

    if (error || !pendingTx) {
      console.error('Erro ao buscar transações pendentes:', error);
      return stats;
    }

    console.log(`[Pipeline] Processando ${pendingTx.length} transações pendentes`);

    for (const tx of pendingTx) {
      const result = await this.processTransaction(tx.id);
      stats.processed++;
      stats.totalAmount += Number(tx.amount);

      switch (result.finalStatus) {
        case 'reconciled':
          stats.reconciled++;
          break;
        case 'needs_review':
          stats.needsReview++;
          break;
        case 'already_reconciled':
          stats.alreadyReconciled++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    }

    stats.endTime = new Date();
    stats.durationMs = stats.endTime.getTime() - stats.startTime.getTime();

    console.log(`[Pipeline] Concluído: ${stats.reconciled} conciliados, ${stats.needsReview} para revisão, ${stats.failed} falhas`);

    return stats;
  }

  /**
   * Obtém estatísticas do pipeline
   */
  async getStats(tenantId: string): Promise<{
    pending: number;
    reconciled: number;
    needsReview: number;
    autoMatchRate: number;
    avgConfidence: number;
  }> {
    const { data, error } = await supabase
      .from('v_identification_stats')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return {
        pending: 0,
        reconciled: 0,
        needsReview: 0,
        autoMatchRate: 0,
        avgConfidence: 0
      };
    }

    return {
      pending: data.unmatched_credits || 0,
      reconciled: data.matched_credits || 0,
      needsReview: data.needs_review || 0,
      autoMatchRate: data.match_rate_percent || 0,
      avgConfidence: data.avg_confidence || 0
    };
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  private createStep(name: string): PipelineStep {
    return {
      name,
      status: 'running'
    };
  }

  private async identifyPayer(tx: any): Promise<{
    clientId?: string;
    confidence: number;
    method?: string;
  }> {
    try {
      const { data } = await supabase.rpc('fn_identify_payer_sql', {
        p_transaction_id: tx.id
      });

      if (data?.success && data?.client_id) {
        return {
          clientId: data.client_id,
          confidence: data.confidence || 0,
          method: data.method
        };
      }
    } catch (err) {
      console.warn('[Pipeline] Erro na identificação:', err);
    }

    return { confidence: 0 };
  }

  private async findMatchingInvoice(tx: any, clientId: string): Promise<any | null> {
    const txDate = new Date(tx.transaction_date);
    const startDate = new Date(txDate.getTime() - 30 * 24 * 60 * 60 * 1000); // -30 dias

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, amount, due_date, competence')
      .eq('client_id', clientId)
      .in('status', ['pending', 'overdue'])
      .gte('due_date', startDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (!invoices || invoices.length === 0) {
      return null;
    }

    // Prioridade 1: Match exato de valor
    const exactMatch = invoices.find(inv =>
      Math.abs(Number(inv.amount) - Number(tx.amount)) < 0.02
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Prioridade 2: Fatura mais antiga do cliente
    return invoices[0];
  }
}

// Exportar instância singleton
export const autoReconciliationPipeline = AutoReconciliationPipelineService.getInstance();
export default autoReconciliationPipeline;
