/**
 * ============================================================================
 * DR. CÍCERO - SERVIÇO CONTÁBIL GATEKEEPER
 * ============================================================================
 * 
 * Este serviço é o ÚNICO ponto de entrada para operações contábeis.
 * Todas as operações passam por validação obrigatória.
 * 
 * Princípios:
 * 1. Partidas dobradas (∑D = ∑C)
 * 2. Rastreabilidade total (internal_code)
 * 3. Transação atômica (entry + lines ou nada)
 * 4. Transitórias devem zerar
 * 
 * @author Dr. Cícero - Contador Responsável
 * @date 2026-01-29
 */

import { supabase } from '@/integrations/supabase/client';

// IDs das contas transitórias (HARDCODED por segurança)
const TRANSITORY_DEBIT_ID = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';  // 1.1.9.01
const TRANSITORY_CREDIT_ID = '28085461-9e5a-4fb4-847d-c9fc047fe0a1'; // 2.1.9.01
const BANK_SICREDI_ID = '10d5892d-a843-4034-8d62-9fec95b8fd56';      // 1.1.1.05
const TENANT_AMPLA = 'a53a4957-fe97-4856-b3ca-70045157b421';

export interface AccountingLine {
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateEntryParams {
  tenant_id?: string;
  entry_date: string;
  description: string;
  internal_code: string;
  source_type: 'ofx_import' | 'classification' | 'manual' | 'opening_balance' | 'provision' | 'reversal';
  entry_type?: string;
  reference_type?: string;
  reference_id?: string;
  lines: AccountingLine[];
}

export interface ClassifyBankTransactionParams {
  tenant_id?: string;
  bank_transaction_id: string;
  destination_account_id: string;
  description: string;
}

export interface DrCiceroResult {
  success: boolean;
  entry_id?: string;
  import_entry_id?: string;
  classification_entry_id?: string;
  error?: string;
  error_detail?: string;
  total_debit?: number;
  total_credit?: number;
  lines_count?: number;
}

/**
 * Dr. Cícero Service - Gatekeeper Contábil
 */
export const DrCiceroService = {
  
  /**
   * Cria um lançamento contábil com validação completa
   * TODA operação contábil DEVE passar por aqui
   */
  async createEntry(params: CreateEntryParams): Promise<DrCiceroResult> {
    console.log('[Dr. Cícero] Criando lançamento:', params.internal_code);
    
    // Validação prévia no cliente
    const validation = this.validateEntry(params);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    try {
      const { data, error } = await supabase.rpc('rpc_create_accounting_entry', {
        p_tenant_id: params.tenant_id || TENANT_AMPLA,
        p_entry_date: params.entry_date,
        p_description: params.description,
        p_internal_code: params.internal_code,
        p_source_type: params.source_type,
        p_entry_type: params.entry_type || 'MOVIMENTO',
        p_reference_type: params.reference_type || null,
        p_reference_id: params.reference_id || null,
        p_lines: params.lines
      });
      
      if (error) {
        console.error('[Dr. Cícero] Erro RPC:', error);
        return { success: false, error: error.message };
      }
      
      if (!data?.success) {
        console.error('[Dr. Cícero] Falha na criação:', data);
        return { success: false, error: data?.error || 'Erro desconhecido' };
      }
      
      console.log('[Dr. Cícero] Lançamento criado:', data.entry_id);
      return data as DrCiceroResult;
      
    } catch (err: any) {
      console.error('[Dr. Cícero] Exceção:', err);
      return { success: false, error: err.message };
    }
  },
  
  /**
   * Classifica uma transação bancária (cria 2 lançamentos: importação + classificação)
   */
  async classifyBankTransaction(params: ClassifyBankTransactionParams): Promise<DrCiceroResult> {
    console.log('[Dr. Cícero] Classificando transação:', params.bank_transaction_id);
    
    try {
      const { data, error } = await supabase.rpc('rpc_classify_bank_transaction', {
        p_tenant_id: params.tenant_id || TENANT_AMPLA,
        p_bank_transaction_id: params.bank_transaction_id,
        p_destination_account_id: params.destination_account_id,
        p_description: params.description,
        p_approved_by: 'Dr. Cícero'
      });
      
      if (error) {
        console.error('[Dr. Cícero] Erro RPC classificação:', error);
        return { success: false, error: error.message };
      }
      
      if (!data?.success) {
        console.error('[Dr. Cícero] Falha na classificação:', data);
        return { success: false, error: data?.error || 'Erro desconhecido' };
      }
      
      console.log('[Dr. Cícero] Transação classificada:', {
        import: data.import_entry_id,
        classification: data.classification_entry_id
      });
      
      return data as DrCiceroResult;
      
    } catch (err: any) {
      console.error('[Dr. Cícero] Exceção classificação:', err);
      return { success: false, error: err.message };
    }
  },
  
  /**
   * Verifica integridade do sistema contábil
   */
  async checkIntegrity(tenant_id?: string): Promise<any> {
    console.log('[Dr. Cícero] Verificando integridade...');
    
    try {
      const { data, error } = await supabase.rpc('rpc_check_accounting_integrity', {
        p_tenant_id: tenant_id || TENANT_AMPLA
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return data;
      
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
  
  /**
   * Verifica saldo das contas transitórias
   */
  async checkTransitoryBalances(): Promise<{ debit: number; credit: number; healthy: boolean }> {
    try {
      const { data, error } = await supabase
        .from('vw_transitory_balances')
        .select('*');
      
      if (error) throw error;
      
      const debit = data?.find(r => r.code === '1.1.9.01')?.balance || 0;
      const credit = data?.find(r => r.code === '2.1.9.01')?.balance || 0;
      
      return {
        debit: Number(debit),
        credit: Number(credit),
        healthy: Math.abs(debit) < 0.01 && Math.abs(credit) < 0.01
      };
    } catch (err) {
      console.error('[Dr. Cícero] Erro verificando transitórias:', err);
      return { debit: -1, credit: -1, healthy: false };
    }
  },
  
  /**
   * Gera internal_code padronizado
   */
  generateInternalCode(
    type: 'OFX_IMP' | 'CLASS' | 'MANUAL' | 'ESTORNO' | 'ABERTURA',
    fitidOrId: string
  ): string {
    const timestamp = Date.now();
    return `${type}_${timestamp}_${fitidOrId}`;
  },
  
  /**
   * Valida lançamento antes de enviar
   */
  validateEntry(params: CreateEntryParams): { valid: boolean; error?: string } {
    // internal_code obrigatório
    if (!params.internal_code || params.internal_code.trim() === '') {
      return { valid: false, error: 'internal_code é obrigatório' };
    }
    
    // Mínimo 2 linhas
    if (!params.lines || params.lines.length < 2) {
      return { valid: false, error: 'Mínimo 2 linhas (partidas dobradas)' };
    }
    
    // Calcular totais
    let totalDebit = 0;
    let totalCredit = 0;
    
    for (let i = 0; i < params.lines.length; i++) {
      const line = params.lines[i];
      
      // Cada linha deve ter débito XOR crédito
      if (line.debit > 0 && line.credit > 0) {
        return { valid: false, error: `Linha ${i + 1}: não pode ter débito E crédito` };
      }
      
      if (line.debit === 0 && line.credit === 0) {
        return { valid: false, error: `Linha ${i + 1}: deve ter débito OU crédito` };
      }
      
      // account_id obrigatório
      if (!line.account_id) {
        return { valid: false, error: `Linha ${i + 1}: account_id obrigatório` };
      }
      
      totalDebit += line.debit || 0;
      totalCredit += line.credit || 0;
    }
    
    // Partidas dobradas
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { 
        valid: false, 
        error: `Não balanceado: Débitos (${totalDebit.toFixed(2)}) ≠ Créditos (${totalCredit.toFixed(2)})` 
      };
    }
    
    return { valid: true };
  },
  
  // Constantes exportadas para uso externo
  ACCOUNTS: {
    TRANSITORY_DEBIT: TRANSITORY_DEBIT_ID,
    TRANSITORY_CREDIT: TRANSITORY_CREDIT_ID,
    BANK_SICREDI: BANK_SICREDI_ID
  },
  
  TENANT: TENANT_AMPLA
};

export default DrCiceroService;
