/**
 * useAIClassificationSuggestion.ts
 * 
 * Hook para sugestões de classificação com IA e aprendizado automático.
 * 
 * REGRAS DE OURO DO DR. CÍCERO:
 * 1. PIX de sócio NUNCA vira Receita (bloqueio hard)
 * 2. Receita NUNCA nasce direto do banco
 * 3. Sugestão deve mostrar confiança
 * 4. Aprendizado com feedback do usuário
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from './useTenantConfig';
import type { BankTransaction, Account } from './useClassification';

// ============================================================================
// TIPOS
// ============================================================================

export interface ClassificationSuggestion {
  account: Account;
  confidence: number;
  reason: string;
  source: 'rule' | 'ai' | 'history' | 'pattern';
  rule_id?: string;
  warnings?: string[];
  blocked?: boolean;
  blockReason?: string;
}

export interface LearningFeedback {
  transaction_id: string;
  suggested_account_id: string;
  actual_account_id: string;
  was_correct: boolean;
  user_notes?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Palavras-chave que NUNCA podem virar receita
const FORBIDDEN_REVENUE_PATTERNS = [
  { pattern: /sócio|socio/i, reason: 'PIX de sócio' },
  { pattern: /empréstimo|emprestimo/i, reason: 'Empréstimo' },
  { pattern: /aporte/i, reason: 'Aporte de capital' },
  { pattern: /devolução|devoluçao|devolucao/i, reason: 'Devolução' },
  { pattern: /reembolso/i, reason: 'Reembolso' },
  { pattern: /transferência própria|transferencia propria/i, reason: 'Transferência entre contas' },
];

// Padrões conhecidos de classificação
const KNOWN_PATTERNS: Array<{
  pattern: RegExp;
  accountCode: string;
  accountName: string;
  confidence: number;
  transactionType: 'credit' | 'debit' | 'both';
}> = [
  // Tarifas bancárias
  { pattern: /tarifa|taxa bancária|IOF/i, accountCode: '4.2.1.01', accountName: 'Despesas Bancárias', confidence: 90, transactionType: 'debit' },
  
  // Juros
  { pattern: /juros de mora|juros|multa/i, accountCode: '4.2.1.02', accountName: 'Juros e Multas', confidence: 85, transactionType: 'debit' },
  
  // Salários e benefícios
  { pattern: /salário|folha|inss|fgts|vale (transporte|alimentação|refeição)/i, accountCode: '4.1.2.01', accountName: 'Despesas com Pessoal', confidence: 80, transactionType: 'debit' },
  
  // Pró-labore
  { pattern: /pró-labore|pro-labore|prolabore/i, accountCode: '4.1.2.02', accountName: 'Pró-labore', confidence: 95, transactionType: 'debit' },
  
  // Energia
  { pattern: /enel|cemig|copel|energia|eletric/i, accountCode: '4.1.1.01', accountName: 'Energia Elétrica', confidence: 90, transactionType: 'debit' },
  
  // Telefone/Internet
  { pattern: /vivo|tim|claro|oi|internet|telefon/i, accountCode: '4.1.1.02', accountName: 'Telefone e Internet', confidence: 85, transactionType: 'debit' },
  
  // Aluguel
  { pattern: /aluguel|locação|condomínio/i, accountCode: '4.1.1.03', accountName: 'Aluguel e Condomínio', confidence: 85, transactionType: 'debit' },
  
  // Honorários (receita de serviços)
  { pattern: /honorários|nota fiscal|nfse|recebimento (de )?serviço/i, accountCode: '3.1.1.01', accountName: 'Receita de Serviços', confidence: 75, transactionType: 'credit' },
];

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useAIClassificationSuggestion(transaction?: BankTransaction) {
  const { tenant } = useTenantConfig();
  
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Carregar contas
  useEffect(() => {
    if (tenant?.id) {
      loadAccounts();
    }
  }, [tenant?.id]);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, type, is_analytical, is_active')
      .eq('tenant_id', tenant?.id)
      .eq('is_active', true)
      .eq('is_analytical', true);
    
    if (data) setAccounts(data);
  };

  // ============================================================================
  // VERIFICAÇÃO DE BLOQUEIOS
  // ============================================================================

  const checkBlocks = useCallback((tx: BankTransaction): { blocked: boolean; reason?: string } => {
    const isIncome = tx.amount > 0;
    const desc = tx.description.toLowerCase();

    // Verificar padrões proibidos para receita
    if (isIncome) {
      for (const forbidden of FORBIDDEN_REVENUE_PATTERNS) {
        if (forbidden.pattern.test(tx.description)) {
          return {
            blocked: true,
            reason: `${forbidden.reason} NÃO pode ser classificado como Receita`
          };
        }
      }
    }

    return { blocked: false };
  }, []);

  // ============================================================================
  // BUSCAR SUGESTÃO
  // ============================================================================

  const getSuggestion = useCallback(async (tx: BankTransaction): Promise<ClassificationSuggestion | null> => {
    if (!tenant?.id) return null;
    
    setLoading(true);

    try {
      const isIncome = tx.amount > 0;
      const transactionType = isIncome ? 'credit' : 'debit';
      const absAmount = Math.abs(tx.amount);

      // 1. Verificar bloqueios
      const blockCheck = checkBlocks(tx);
      
      // 2. Buscar regras de classificação no banco
      const { data: rules } = await supabase.rpc('rpc_find_matching_rule', {
        p_tenant_id: tenant.id,
        p_amount: absAmount,
        p_description: tx.description,
        p_transaction_type: transactionType
      });

      if (rules && rules.length > 0) {
        const bestRule = rules[0];
        const account = accounts.find(a => a.id === bestRule.destination_account_id);
        
        if (account) {
          const suggestion: ClassificationSuggestion = {
            account,
            confidence: bestRule.confidence_score,
            reason: `Regra: ${bestRule.rule_name} (${bestRule.times_applied}x aplicada, ${bestRule.times_approved}x aprovada)`,
            source: 'rule',
            rule_id: bestRule.rule_id,
            warnings: []
          };

          // Verificar se a sugestão viola bloqueios
          if (blockCheck.blocked && account.type === 'REVENUE') {
            suggestion.warnings = [blockCheck.reason || 'Classificação bloqueada'];
            suggestion.blocked = true;
            suggestion.blockReason = blockCheck.reason;
          }

          setSuggestion(suggestion);
          return suggestion;
        }
      }

      // 3. Buscar padrões conhecidos
      for (const pattern of KNOWN_PATTERNS) {
        if (pattern.pattern.test(tx.description)) {
          if (pattern.transactionType !== 'both' && pattern.transactionType !== transactionType) {
            continue;
          }

          const account = accounts.find(a => a.code === pattern.accountCode);
          
          if (account) {
            const suggestion: ClassificationSuggestion = {
              account,
              confidence: pattern.confidence,
              reason: `Padrão identificado: ${pattern.accountName}`,
              source: 'pattern',
              warnings: []
            };

            if (blockCheck.blocked && account.type === 'REVENUE') {
              suggestion.warnings = [blockCheck.reason || 'Classificação bloqueada'];
              suggestion.blocked = true;
              suggestion.blockReason = blockCheck.reason;
            }

            setSuggestion(suggestion);
            return suggestion;
          }
        }
      }

      // 4. Buscar histórico de transações similares
      const { data: similarTx } = await supabase
        .from('bank_transactions')
        .select(`
          id,
          description,
          journal_entry_id,
          accounting_entries!journal_entry_id (
            accounting_entry_lines (
              account_id,
              chart_of_accounts (id, code, name, type, is_analytical, is_active)
            )
          )
        `)
        .eq('tenant_id', tenant.id)
        .eq('is_reconciled', true)
        .ilike('description', `%${tx.description.split(' ').slice(0, 3).join('%')}%`)
        .limit(5);

      if (similarTx && similarTx.length > 0) {
        // Encontrar a conta mais usada
        const accountCounts = new Map<string, { count: number; account: Account }>();
        
        for (const st of similarTx) {
          const entry = st.accounting_entries as any;
          if (entry?.accounting_entry_lines) {
            for (const line of entry.accounting_entry_lines) {
              const acc = line.chart_of_accounts;
              if (acc && acc.is_active && acc.is_analytical) {
                const current = accountCounts.get(acc.id) || { count: 0, account: acc };
                current.count++;
                accountCounts.set(acc.id, current);
              }
            }
          }
        }

        if (accountCounts.size > 0) {
          const sorted = Array.from(accountCounts.values()).sort((a, b) => b.count - a.count);
          const best = sorted[0];
          
          const suggestion: ClassificationSuggestion = {
            account: best.account,
            confidence: Math.min(95, 50 + best.count * 10),
            reason: `Baseado em ${best.count} transações similares`,
            source: 'history',
            warnings: []
          };

          if (blockCheck.blocked && best.account.type === 'REVENUE') {
            suggestion.warnings = [blockCheck.reason || 'Classificação bloqueada'];
            suggestion.blocked = true;
            suggestion.blockReason = blockCheck.reason;
          }

          setSuggestion(suggestion);
          return suggestion;
        }
      }

      // 5. Sem sugestão encontrada
      setSuggestion(null);
      return null;

    } catch (err) {
      console.error('Erro ao buscar sugestão:', err);
      setSuggestion(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, accounts, checkBlocks]);

  // ============================================================================
  // FEEDBACK E APRENDIZADO
  // ============================================================================

  const submitFeedback = useCallback(async (feedback: LearningFeedback) => {
    if (!tenant?.id) return;

    try {
      // Atualizar regra existente se houver
      if (feedback.was_correct && suggestion?.rule_id) {
        await supabase.rpc('rpc_increment_rule_applied', {
          p_rule_id: suggestion.rule_id,
          p_approved: true
        });
      } else if (!feedback.was_correct && suggestion?.rule_id) {
        await supabase.rpc('rpc_increment_rule_applied', {
          p_rule_id: suggestion.rule_id,
          p_approved: false
        });
      }

      // Criar nova regra se a classificação foi diferente
      if (!feedback.was_correct && feedback.actual_account_id) {
        const user = await supabase.auth.getUser();
        
        // Extrair keywords da descrição
        const transaction = await supabase
          .from('bank_transactions')
          .select('description, amount')
          .eq('id', feedback.transaction_id)
          .single();

        if (transaction.data) {
          const keywords = extractKeywords(transaction.data.description);
          const txType = transaction.data.amount > 0 ? 'credit' : 'debit';
          
          await supabase.rpc('rpc_create_classification_rule', {
            p_tenant_id: tenant.id,
            p_rule_name: `Auto-aprendizado: ${keywords.slice(0, 2).join(' ')}`,
            p_destination_account_id: feedback.actual_account_id,
            p_created_by: user.data.user?.id,
            p_description_keywords: keywords,
            p_transaction_type: txType
          });
        }
      }

    } catch (err) {
      console.error('Erro ao enviar feedback:', err);
    }
  }, [tenant?.id, suggestion]);

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  const extractKeywords = (description: string): string[] => {
    const stopWords = ['de', 'da', 'do', 'para', 'com', 'em', 'a', 'o', 'e', 'pix', 'ted', 'doc', 'pagamento', 'recebimento'];
    
    return description
      .toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõöúç0-9\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w))
      .slice(0, 5);
  };

  // Auto-buscar sugestão quando transação mudar
  useEffect(() => {
    if (transaction) {
      getSuggestion(transaction);
    }
  }, [transaction?.id]);

  // ============================================================================
  // RETORNO
  // ============================================================================

  return {
    suggestion,
    loading,
    getSuggestion,
    submitFeedback,
    checkBlocks,
    clearSuggestion: () => setSuggestion(null)
  };
}

export default useAIClassificationSuggestion;
