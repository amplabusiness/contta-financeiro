/**
 * ============================================================================
 * RECONCILIATION SERVICE - FONTE ÚNICA DE RECONCILIAÇÃO
 * ============================================================================
 * Autor: Dr. Cícero - Contador Responsável
 * Data: 01/02/2026
 * 
 * 🎯 REGRA: Toda reconciliação DEVE passar por este serviço
 * 
 * Este serviço:
 * - Chama o RPC `reconcile_transaction()` no banco
 * - Garante consistência entre UI, IA e jobs
 * - Registra auditoria automaticamente
 * - Impede estado inválido
 * ============================================================================
 */

import { supabase } from '@/integrations/supabase/client';

export interface ReconciliationResult {
  success: boolean;
  transaction_id?: string;
  journal_entry_id?: string;
  action?: 'RECONCILE' | 'RECLASSIFY' | 'UNRECONCILE';
  actor?: string;
  error?: string;
}

export interface ReconciliationInput {
  transactionId: string;
  journalEntryId: string;
  actor?: 'ui' | 'dr-cicero' | 'auto-pipeline' | 'boleto-service' | 'system';
}

/**
 * 🔴 RECONCILIAR TRANSAÇÃO (via RPC)
 * 
 * Esta é a ÚNICA forma correta de reconciliar uma transação.
 * Nunca faça UPDATE direto na tabela bank_transactions.
 */
export async function reconcileTransaction(
  input: ReconciliationInput
): Promise<ReconciliationResult> {
  const { transactionId, journalEntryId, actor = 'system' } = input;

  const { data, error } = await supabase.rpc('reconcile_transaction', {
    p_transaction_id: transactionId,
    p_journal_entry_id: journalEntryId,
    p_actor: actor
  });

  if (error) {
    console.error('[ReconciliationService] Erro no RPC:', error);
    return {
      success: false,
      error: error.message
    };
  }

  // O RPC retorna jsonb, então data já é o objeto
  return data as ReconciliationResult;
}

/**
 * 🔴 DESFAZER RECONCILIAÇÃO (via RPC)
 * 
 * Remove a reconciliação e registra auditoria.
 * O lançamento contábil NÃO é deletado automaticamente.
 */
export async function unreconcileTransaction(
  transactionId: string,
  actor: string = 'system',
  reason?: string
): Promise<ReconciliationResult> {
  const { data, error } = await supabase.rpc('unreconcile_transaction', {
    p_transaction_id: transactionId,
    p_actor: actor,
    p_reason: reason || null
  });

  if (error) {
    console.error('[ReconciliationService] Erro ao desfazer:', error);
    return {
      success: false,
      error: error.message
    };
  }

  return data as ReconciliationResult;
}

/**
 * 🟡 VERIFICAR STATUS DE RECONCILIAÇÃO
 * 
 * Verifica se uma transação está reconciliada.
 * Fonte de verdade: journal_entry_id IS NOT NULL
 */
export async function isReconciled(transactionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('journal_entry_id')
    .eq('id', transactionId)
    .single();

  if (error || !data) return false;
  return data.journal_entry_id !== null;
}

/**
 * 🟢 BUSCAR HISTÓRICO DE AUDITORIA
 * 
 * Retorna todas as operações de reconciliação de uma transação.
 */
export async function getReconciliationHistory(transactionId: string) {
  const { data, error } = await supabase
    .from('reconciliation_audit_log')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ReconciliationService] Erro ao buscar histórico:', error);
    return [];
  }

  return data || [];
}

/**
 * 🔵 MÉTRICAS DE RECONCILIAÇÃO
 * 
 * Retorna estatísticas para o dashboard.
 */
export async function getReconciliationMetrics(tenantId: string, month?: Date) {
  let query = supabase
    .from('bank_transactions')
    .select('status, journal_entry_id', { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (month) {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    query = query
      .gte('transaction_date', startOfMonth.toISOString().split('T')[0])
      .lte('transaction_date', endOfMonth.toISOString().split('T')[0]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ReconciliationService] Erro ao buscar métricas:', error);
    return null;
  }

  const reconciliadas = data?.filter(t => t.journal_entry_id !== null).length || 0;
  const pendentes = data?.filter(t => t.journal_entry_id === null).length || 0;
  const total = data?.length || 0;

  return {
    reconciliadas,
    pendentes,
    total,
    percentual: total > 0 ? Math.round((reconciliadas / total) * 100) : 0
  };
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================
export const ReconciliationService = {
  reconcile: reconcileTransaction,
  unreconcile: unreconcileTransaction,
  isReconciled,
  getHistory: getReconciliationHistory,
  getMetrics: getReconciliationMetrics
};

export default ReconciliationService;
