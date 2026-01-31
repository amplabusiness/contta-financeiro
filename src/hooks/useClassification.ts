/**
 * useClassification.ts
 * 
 * Hook centralizado para classificação contábil de transações bancárias.
 * 
 * REGRAS DE OURO DO DR. CÍCERO:
 * 1. NENHUMA transação pode ser conciliada sem classificação validada
 * 2. PIX de sócio NUNCA vira Receita
 * 3. Conta genérica requer justificativa (mín. 10 caracteres)
 * 4. Toda classificação gera aprendizado
 * 5. Reclassificação NÃO altera saldo bancário
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from './useTenantConfig';
import { toast } from 'sonner';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface BankTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  matched: boolean;
  journal_entry_id?: string;
  extracted_cnpj?: string;
  extracted_cpf?: string;
  extracted_cob?: string;
  suggested_client_id?: string;
  suggested_client_name?: string;
  identification_confidence?: number;
  identification_method?: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  is_analytical: boolean;
  is_active: boolean;
}

export interface ClassificationRule {
  id: string;
  rule_name: string;
  destination_account_id: string;
  destination_account_code: string;
  destination_account_name: string;
  confidence_score: number;
  status: 'learning' | 'semi_auto' | 'auto' | 'disabled';
  times_applied: number;
  times_approved: number;
}

export interface SplitLine {
  account_id: string;
  account_code?: string;
  account_name?: string;
  amount: number;
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface ClassificationResult {
  success: boolean;
  entry_id?: string;
  reclassification_id?: string;
  rule_id?: string;
  error?: string;
  warning?: string;
}

export interface ReclassificationRequest {
  parent_entry_id: string;
  lines: SplitLine[];
  justification: string;
  submit_for_approval: boolean;
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Contas genéricas que requerem justificativa
const GENERIC_ACCOUNT_CODES = [
  '4.1.1.08',  // Outras Despesas Operacionais
  '4.1.1.99',  // Outras Despesas
  '3.1.1.99',  // Outras Receitas
  '1.1.9.01',  // Transitória Débitos
  '2.1.9.01',  // Transitória Créditos
];

// Palavras-chave que NUNCA podem virar receita
const FORBIDDEN_REVENUE_KEYWORDS = [
  'sócio', 'socio', 'empréstimo', 'emprestimo', 
  'aporte', 'devolução', 'devoluçao', 'reembolso',
  'transferência própria', 'transferencia propria',
  'transferência para', 'transferencia para'
];

// IDs das contas transitórias (hardcoded conforme especificação)
const TRANSITORIA_DEBITOS_ID = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';  // 1.1.9.01
const TRANSITORIA_CREDITOS_ID = '28085461-9e5a-4fb4-847d-c9fc047fe0a1'; // 2.1.9.01

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useClassification(transaction?: BankTransaction) {
  const { tenant } = useTenantConfig();
  
  // Estados
  const [loading, setLoading] = useState(false);
  const [matchingRules, setMatchingRules] = useState<ClassificationRule[]>([]);
  const [suggestedAccount, setSuggestedAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Determinar tipo de transação
  const isIncome = transaction ? transaction.amount > 0 : false;
  const transactionType = isIncome ? 'credit' : 'debit';
  const absAmount = transaction ? Math.abs(transaction.amount) : 0;

  // ============================================================================
  // CARREGAR DADOS
  // ============================================================================

  useEffect(() => {
    if (tenant?.id) {
      loadAccounts();
      if (transaction) {
        loadMatchingRules();
      }
    }
  }, [tenant?.id, transaction?.id]);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, type, is_analytical, is_active')
      .eq('tenant_id', tenant?.id)
      .eq('is_active', true)
      .eq('is_analytical', true)
      .order('code');
    
    if (data) setAccounts(data);
  };

  const loadMatchingRules = async () => {
    if (!transaction) return;
    
    const { data, error } = await supabase.rpc('rpc_find_matching_rule', {
      p_tenant_id: tenant?.id,
      p_amount: absAmount,
      p_description: transaction.description,
      p_transaction_type: transactionType
    });
    
    if (!error && data && data.length > 0) {
      setMatchingRules(data);
      
      // Buscar conta sugerida da melhor regra
      const bestRule = data[0];
      const suggestedAcc = accounts.find(a => a.id === bestRule.destination_account_id);
      if (suggestedAcc) {
        setSuggestedAccount(suggestedAcc);
      }
    }
  };

  // ============================================================================
  // VALIDAÇÕES DO DR. CÍCERO
  // ============================================================================

  const validateClassification = useCallback((
    account: Account,
    justification?: string
  ): ValidationResult => {
    if (!transaction) {
      return { valid: false, error: 'Nenhuma transação selecionada' };
    }

    // Verificar se conta está ativa
    if (!account.is_active) {
      return {
        valid: false,
        error: '🚫 Conta inativa não pode receber lançamentos',
        severity: 'error'
      };
    }

    const descLower = transaction.description.toLowerCase();

    // Regra 1: PIX de sócio NUNCA vira receita
    if (isIncome && account.type === 'REVENUE') {
      const isForbidden = FORBIDDEN_REVENUE_KEYWORDS.some(kw => descLower.includes(kw));
      if (isForbidden) {
        return {
          valid: false,
          error: '🚫 PIX de sócio/empréstimo NÃO pode ser classificado como Receita. Use conta de Passivo (Empréstimos de Sócios) ou Patrimônio Líquido.',
          severity: 'error'
        };
      }
    }

    // Regra 2: Conta genérica requer justificativa
    const isGeneric = GENERIC_ACCOUNT_CODES.some(code => account.code.startsWith(code));
    if (isGeneric) {
      if (!justification || justification.trim().length < 10) {
        return {
          valid: false,
          error: '⚠️ Conta genérica requer justificativa detalhada (mínimo 10 caracteres)',
          severity: 'error'
        };
      }
      return {
        valid: true,
        warning: '⚠️ Conta genérica utilizada. Considere criar uma conta específica.',
        severity: 'warning'
      };
    }

    // Regra 3: Entrada classificada como Despesa
    if (isIncome && account.type === 'EXPENSE') {
      return {
        valid: true,
        warning: '⚠️ Entrada classificada como Despesa - verifique se é estorno ou reembolso',
        severity: 'warning'
      };
    }

    // Regra 4: Saída classificada como Receita
    if (!isIncome && account.type === 'REVENUE') {
      return {
        valid: true,
        warning: '⚠️ Saída classificada como Receita - verifique se é estorno ou ajuste',
        severity: 'warning'
      };
    }

    return { valid: true };
  }, [transaction, isIncome]);

  // ============================================================================
  // CLASSIFICAÇÃO SIMPLES
  // ============================================================================

  const classify = useCallback(async (
    account: Account,
    options?: {
      justification?: string;
      createRule?: boolean;
    }
  ): Promise<ClassificationResult> => {
    if (!transaction || !tenant?.id) {
      return { success: false, error: 'Configuração inválida' };
    }

    // Validar
    const validation = validateClassification(account, options?.justification);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    setLoading(true);

    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      const now = new Date().toISOString();
      const internalCode = `CLASS_${Date.now()}_${transaction.id.slice(0, 8)}`;

      // Criar lançamento contábil de classificação
      const { data: entry, error: entryError } = await supabase
        .from('accounting_entries')
        .insert({
          tenant_id: tenant.id,
          entry_date: transaction.date,
          description: `Classificação: ${transaction.description.slice(0, 100)}`,
          internal_code: internalCode,
          source_type: 'classification',
          entry_type: 'CLASSIFICACAO',
          reference_type: 'bank_transaction',
          reference_id: transaction.id,
          created_by: userId
        })
        .select()
        .single();

      if (entryError) throw new Error(entryError.message);

      // Criar linhas seguindo as regras do Dr. Cícero
      const lines = isIncome ? [
        // Entrada: D Transitória Créditos (zera) / C Conta Classificada
        { entry_id: entry.id, tenant_id: tenant.id, account_id: TRANSITORIA_CREDITOS_ID, debit: absAmount, credit: 0 },
        { entry_id: entry.id, tenant_id: tenant.id, account_id: account.id, debit: 0, credit: absAmount }
      ] : [
        // Saída: D Conta Classificada / C Transitória Débitos (zera)
        { entry_id: entry.id, tenant_id: tenant.id, account_id: account.id, debit: absAmount, credit: 0 },
        { entry_id: entry.id, tenant_id: tenant.id, account_id: TRANSITORIA_DEBITOS_ID, debit: 0, credit: absAmount }
      ];

      const { error: linesError } = await supabase
        .from('accounting_entry_lines')
        .insert(lines);

      if (linesError) throw new Error(linesError.message);

      // Atualizar transação bancária
      await supabase
        .from('bank_transactions')
        .update({
          matched: true,
          journal_entry_id: entry.id,
          reconciled_at: now,
          is_reconciled: true,
          status: 'reconciled'
        })
        .eq('id', transaction.id);

      // Criar regra de aprendizado
      let ruleId: string | undefined;
      if (options?.createRule) {
        ruleId = await createLearningRule(account, transaction.description);
      }

      toast.success('Transação classificada com sucesso!');

      return {
        success: true,
        entry_id: entry.id,
        rule_id: ruleId,
        warning: validation.warning
      };

    } catch (err: unknown) {
      console.error('Erro na classificação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro na classificação: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [transaction, tenant?.id, validateClassification, isIncome, absAmount]);

  // ============================================================================
  // RECLASSIFICAÇÃO (SPLIT)
  // ============================================================================

  const createReclassification = useCallback(async (
    parentEntryId: string,
    lines: SplitLine[],
    justification: string,
    submitForApproval: boolean = true
  ): Promise<ClassificationResult> => {
    if (!tenant?.id) {
      return { success: false, error: 'Configuração inválida' };
    }

    // Validar linhas
    if (lines.length < 2) {
      return { success: false, error: 'Split deve ter pelo menos 2 linhas' };
    }

    // Validar justificativa
    if (justification.trim().length < 10) {
      return { success: false, error: 'Justificativa deve ter pelo menos 10 caracteres' };
    }

    setLoading(true);

    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Buscar valor total do lançamento pai
      const { data: parentLines } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('entry_id', parentEntryId);

      if (!parentLines || parentLines.length === 0) {
        return { success: false, error: 'Lançamento pai não encontrado' };
      }

      const parentAmount = parentLines.reduce((sum, l) => sum + Math.max(l.debit, l.credit), 0) / 2;
      const splitTotal = lines.reduce((sum, l) => sum + l.amount, 0);

      // Validar que o split bate com o valor original
      if (Math.abs(parentAmount - splitTotal) > 0.01) {
        return { 
          success: false, 
          error: `Soma do split (${splitTotal.toFixed(2)}) difere do valor original (${parentAmount.toFixed(2)})` 
        };
      }

      // Criar reclassificação
      const { data: reclass, error: reclassError } = await supabase
        .from('accounting_reclassifications')
        .insert({
          tenant_id: tenant.id,
          parent_entry_id: parentEntryId,
          status: submitForApproval ? 'pending' : 'draft',
          total_amount: parentAmount,
          justification,
          created_by: userId
        })
        .select()
        .single();

      if (reclassError) throw new Error(reclassError.message);

      // Criar linhas da reclassificação
      const reclassLines = lines.map((line, index) => ({
        tenant_id: tenant.id,
        reclassification_id: reclass.id,
        account_id: line.account_id,
        amount: line.amount,
        description: line.description || '',
        line_order: index + 1
      }));

      const { error: linesError } = await supabase
        .from('accounting_reclassification_lines')
        .insert(reclassLines);

      if (linesError) throw new Error(linesError.message);

      const statusMsg = submitForApproval 
        ? 'Reclassificação enviada para aprovação do Dr. Cícero' 
        : 'Reclassificação salva como rascunho';
      
      toast.success(statusMsg);

      return {
        success: true,
        reclassification_id: reclass.id
      };

    } catch (err: unknown) {
      console.error('Erro na reclassificação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro na reclassificação: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  // ============================================================================
  // CRIAR REGRA DE APRENDIZADO
  // ============================================================================

  const createLearningRule = async (
    account: Account, 
    description: string
  ): Promise<string | undefined> => {
    try {
      const user = await supabase.auth.getUser();
      
      // Extrair palavras-chave da descrição
      const keywords = extractKeywords(description);
      
      const { data, error } = await supabase.rpc('rpc_create_classification_rule', {
        p_tenant_id: tenant?.id,
        p_rule_name: `Auto: ${account.name.slice(0, 50)}`,
        p_destination_account_id: account.id,
        p_created_by: user.data.user?.id,
        p_description_keywords: keywords,
        p_transaction_type: transactionType
      });

      if (error) {
        console.warn('Erro ao criar regra de aprendizado:', error);
        return undefined;
      }

      return data?.rule_id;
    } catch (err) {
      console.warn('Erro ao criar regra:', err);
      return undefined;
    }
  };

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  const extractKeywords = (description: string): string[] => {
    // Remover palavras comuns e caracteres especiais
    const stopWords = ['de', 'da', 'do', 'para', 'com', 'em', 'a', 'o', 'e', 'pix', 'ted', 'doc'];
    
    const words = description
      .toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõöúç0-9\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w))
      .slice(0, 5); // Máximo 5 palavras-chave
    
    return [...new Set(words)];
  };

  // ============================================================================
  // RETORNO DO HOOK
  // ============================================================================

  return {
    // Estados
    loading,
    accounts,
    matchingRules,
    suggestedAccount,
    
    // Informações da transação
    isIncome,
    transactionType,
    absAmount,
    
    // Funções
    validateClassification,
    classify,
    createReclassification,
    createLearningRule: async (account: Account) => createLearningRule(account, transaction?.description || ''),
    
    // Recarregar dados
    refreshRules: loadMatchingRules,
    refreshAccounts: loadAccounts
  };
}

export default useClassification;
