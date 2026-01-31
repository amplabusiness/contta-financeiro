/**
 * useImpactCalculation.ts
 * 
 * Hook para calcular o impacto contábil de uma classificação ANTES de confirmar.
 * Mostra ao usuário as consequências em tempo real.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from './useTenantConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface AccountBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  current_balance: number;
  projected_balance: number;
  difference: number;
}

export interface FinancialSummary {
  receita_bruta: number;
  deducoes: number;
  receita_liquida: number;
  despesas_operacionais: number;
  despesas_administrativas: number;
  despesas_financeiras: number;
  resultado_operacional: number;
  resultado_liquido: number;
}

export interface ImpactPreview {
  before: {
    summary: FinancialSummary;
    transitoria_debitos: number;
    transitoria_creditos: number;
    saldo_banco: number;
  };
  after: {
    summary: FinancialSummary;
    transitoria_debitos: number;
    transitoria_creditos: number;
    saldo_banco: number;
  };
  affected_accounts: AccountBalance[];
  warnings: ImpactWarning[];
  is_balanced: boolean;
  classification_type: 'simple' | 'split' | 'reclassification';
}

export interface ImpactWarning {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion?: string;
}

export interface ClassificationInput {
  transaction_id: string;
  amount: number;
  is_income: boolean;
  target_accounts: Array<{
    account_id: string;
    amount: number;
  }>;
  source_type: 'classification' | 'reclassification' | 'split';
}

/**
 * Interface simplificada para uso na UI
 * Usada quando não temos o account_id ainda, apenas código/nome
 */
export interface SimpleImpactInput {
  transactionId: string;
  amount: number;
  description: string;
  accountCode: string;
  accountName: string;
  isEntry: boolean; // true = entrada (crédito no banco), false = saída (débito no banco)
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRANSITORIA_DEBITOS_ID = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
const TRANSITORIA_CREDITOS_ID = '28085461-9e5a-4fb4-847d-c9fc047fe0a1';
const BANCO_SICREDI_ID = '10d5892d-a843-4034-8d62-9fec95b8fd56';

// Códigos de contas por grupo (para cálculo da DRE)
const REVENUE_CODES = ['3.1', '3.2', '3.3'];
const DEDUCTION_CODES = ['3.1.2', '3.1.3']; // Impostos sobre receita
const OPERATIONAL_EXPENSE_CODES = ['4.1.1', '4.1.2'];
const ADMINISTRATIVE_EXPENSE_CODES = ['4.1.3', '4.1.4'];
const FINANCIAL_EXPENSE_CODES = ['4.2'];

// ============================================================================
// HOOK
// ============================================================================

export function useImpactCalculation() {
  const { tenant } = useTenantConfig();
  const tenantId = tenant?.id;

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Busca saldos atuais das contas relevantes
   */
  const fetchCurrentBalances = useCallback(async (
    accountIds: string[],
    period: { start: string; end: string }
  ): Promise<Map<string, AccountBalance>> => {
    if (!tenantId) throw new Error('Tenant não definido');

    // Buscar contas
    const { data: accounts, error: accError } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, type')
      .in('id', accountIds)
      .eq('tenant_id', tenantId);

    if (accError) throw accError;

    // Buscar saldos (soma de débitos - créditos por conta)
    const { data: balances, error: balError } = await supabase
      .from('accounting_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        accounting_entries!inner(entry_date, tenant_id)
      `)
      .in('account_id', accountIds)
      .eq('tenant_id', tenantId)
      .gte('accounting_entries.entry_date', period.start)
      .lte('accounting_entries.entry_date', period.end);

    if (balError) throw balError;

    // Calcular saldos por conta
    const balanceMap = new Map<string, AccountBalance>();

    for (const account of accounts || []) {
      const accountBalances = (balances || []).filter(b => b.account_id === account.id);
      const totalDebit = accountBalances.reduce((sum, b) => sum + (b.debit || 0), 0);
      const totalCredit = accountBalances.reduce((sum, b) => sum + (b.credit || 0), 0);

      // Saldo depende da natureza da conta
      let balance = 0;
      if (['ASSET', 'EXPENSE'].includes(account.type)) {
        balance = totalDebit - totalCredit; // Natureza devedora
      } else {
        balance = totalCredit - totalDebit; // Natureza credora
      }

      balanceMap.set(account.id, {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_type: account.type,
        current_balance: balance,
        projected_balance: balance,
        difference: 0
      });
    }

    return balanceMap;
  }, [tenantId]);

  /**
   * Busca o resumo financeiro atual (mini-DRE)
   */
  const fetchFinancialSummary = useCallback(async (
    period: { start: string; end: string }
  ): Promise<FinancialSummary> => {
    if (!tenantId) throw new Error('Tenant não definido');

    const { data: entries, error } = await supabase
      .from('accounting_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        chart_of_accounts!inner(code, type),
        accounting_entries!inner(entry_date, tenant_id)
      `)
      .eq('tenant_id', tenantId)
      .gte('accounting_entries.entry_date', period.start)
      .lte('accounting_entries.entry_date', period.end);

    if (error) throw error;

    const summary: FinancialSummary = {
      receita_bruta: 0,
      deducoes: 0,
      receita_liquida: 0,
      despesas_operacionais: 0,
      despesas_administrativas: 0,
      despesas_financeiras: 0,
      resultado_operacional: 0,
      resultado_liquido: 0
    };

    for (const entry of entries || []) {
      const code = (entry.chart_of_accounts as any)?.code || '';
      const credit = entry.credit || 0;
      const debit = entry.debit || 0;

      // Receitas (natureza credora)
      if (REVENUE_CODES.some(c => code.startsWith(c))) {
        if (DEDUCTION_CODES.some(c => code.startsWith(c))) {
          summary.deducoes += debit - credit;
        } else {
          summary.receita_bruta += credit - debit;
        }
      }

      // Despesas (natureza devedora)
      if (OPERATIONAL_EXPENSE_CODES.some(c => code.startsWith(c))) {
        summary.despesas_operacionais += debit - credit;
      }
      if (ADMINISTRATIVE_EXPENSE_CODES.some(c => code.startsWith(c))) {
        summary.despesas_administrativas += debit - credit;
      }
      if (FINANCIAL_EXPENSE_CODES.some(c => code.startsWith(c))) {
        summary.despesas_financeiras += debit - credit;
      }
    }

    summary.receita_liquida = summary.receita_bruta - summary.deducoes;
    summary.resultado_operacional = summary.receita_liquida - 
      summary.despesas_operacionais - summary.despesas_administrativas;
    summary.resultado_liquido = summary.resultado_operacional - summary.despesas_financeiras;

    return summary;
  }, [tenantId]);

  /**
   * Busca o ID da conta pelo código
   */
  const findAccountIdByCode = useCallback(async (code: string): Promise<string | null> => {
    if (!tenantId || !code) return null;
    
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('code', code)
      .single();
    
    return data?.id || null;
  }, [tenantId]);

  /**
   * Calcula o impacto de uma classificação
   * Aceita tanto ClassificationInput (completo) quanto SimpleImpactInput (da UI)
   */
  const calculateImpact = useCallback(async (
    input: ClassificationInput | SimpleImpactInput
  ): Promise<ImpactPreview | null> => {
    if (!tenantId) throw new Error('Tenant não definido');

    setLoading(true);
    setError(null);

    try {
      // Detectar qual formato de input foi passado e normalizar
      let normalizedInput: ClassificationInput;

      if ('target_accounts' in input && input.target_accounts) {
        // É ClassificationInput completo
        normalizedInput = input as ClassificationInput;
      } else if ('accountCode' in input) {
        // É SimpleImpactInput - precisa buscar o account_id
        const simpleInput = input as SimpleImpactInput;
        const accountId = await findAccountIdByCode(simpleInput.accountCode);
        
        if (!accountId) {
          // Se não encontrou a conta, criar um preview simulado
          console.warn(`Conta não encontrada: ${simpleInput.accountCode}`);
          const mockPreview: ImpactPreview = {
            before: {
              summary: { receita_bruta: 0, deducoes: 0, receita_liquida: 0, despesas_operacionais: 0, despesas_administrativas: 0, despesas_financeiras: 0, resultado_operacional: 0, resultado_liquido: 0 },
              transitoria_debitos: 0,
              transitoria_creditos: 0,
              saldo_banco: 0
            },
            after: {
              summary: { receita_bruta: 0, deducoes: 0, receita_liquida: 0, despesas_operacionais: 0, despesas_administrativas: 0, despesas_financeiras: 0, resultado_operacional: 0, resultado_liquido: 0 },
              transitoria_debitos: 0,
              transitoria_creditos: 0,
              saldo_banco: 0
            },
            affected_accounts: [],
            warnings: [{
              type: 'warning',
              code: 'ACCOUNT_NOT_FOUND',
              message: `Conta ${simpleInput.accountCode} não encontrada no plano de contas`,
              suggestion: 'Verifique se o código da conta está correto'
            }],
            is_balanced: true,
            classification_type: 'simple'
          };
          setPreview(mockPreview);
          return mockPreview;
        }

        normalizedInput = {
          transaction_id: simpleInput.transactionId,
          amount: Math.abs(simpleInput.amount),
          is_income: simpleInput.isEntry,
          target_accounts: [{ account_id: accountId, amount: Math.abs(simpleInput.amount) }],
          source_type: 'classification'
        };
      } else {
        throw new Error('Formato de input inválido');
      }

      // Período atual (mês vigente)
      const now = new Date();
      const period = {
        start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        end: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`
      };

      // IDs das contas envolvidas
      const accountIds = [
        TRANSITORIA_DEBITOS_ID,
        TRANSITORIA_CREDITOS_ID,
        BANCO_SICREDI_ID,
        ...(normalizedInput.target_accounts || []).map(a => a.account_id)
      ];

      // Buscar dados atuais
      const [currentBalances, currentSummary] = await Promise.all([
        fetchCurrentBalances(accountIds, period),
        fetchFinancialSummary(period)
      ]);

      // Estado ANTES
      const before = {
        summary: { ...currentSummary },
        transitoria_debitos: currentBalances.get(TRANSITORIA_DEBITOS_ID)?.current_balance || 0,
        transitoria_creditos: currentBalances.get(TRANSITORIA_CREDITOS_ID)?.current_balance || 0,
        saldo_banco: currentBalances.get(BANCO_SICREDI_ID)?.current_balance || 0
      };

      // Calcular estado DEPOIS
      const afterSummary = { ...currentSummary };
      const affectedAccounts: AccountBalance[] = [];
      const warnings: ImpactWarning[] = [];

      // Processar cada conta alvo
      for (const target of normalizedInput.target_accounts) {
        const account = currentBalances.get(target.account_id);
        if (!account) continue;

        // Calcular novo saldo
        let newBalance = account.current_balance;
        
        if (normalizedInput.is_income) {
          // ENTRADA: D Banco / C Transitória (já feito)
          // Classificação: D Transitória / C Conta
          if (['ASSET', 'EXPENSE'].includes(account.account_type)) {
            // Débito em conta devedora = aumenta (mas aqui é crédito)
            newBalance -= target.amount;
          } else {
            // Crédito em conta credora = aumenta
            newBalance += target.amount;
          }

          // Atualizar DRE se for receita
          if (account.account_code.startsWith('3.1')) {
            afterSummary.receita_bruta += target.amount;
          }
        } else {
          // SAÍDA: D Transitória / C Banco (já feito)
          // Classificação: D Conta / C Transitória
          if (['ASSET', 'EXPENSE'].includes(account.account_type)) {
            // Débito em conta devedora = aumenta
            newBalance += target.amount;
          } else {
            // Crédito em conta credora = diminui (mas aqui é débito)
            newBalance -= target.amount;
          }

          // Atualizar DRE se for despesa
          if (account.account_code.startsWith('4.1.1') || account.account_code.startsWith('4.1.2')) {
            afterSummary.despesas_operacionais += target.amount;
          } else if (account.account_code.startsWith('4.1.3') || account.account_code.startsWith('4.1.4')) {
            afterSummary.despesas_administrativas += target.amount;
          } else if (account.account_code.startsWith('4.2')) {
            afterSummary.despesas_financeiras += target.amount;
          }
        }

        affectedAccounts.push({
          ...account,
          projected_balance: newBalance,
          difference: newBalance - account.current_balance
        });
      }

      // Recalcular totais da DRE
      afterSummary.receita_liquida = afterSummary.receita_bruta - afterSummary.deducoes;
      afterSummary.resultado_operacional = afterSummary.receita_liquida - 
        afterSummary.despesas_operacionais - afterSummary.despesas_administrativas;
      afterSummary.resultado_liquido = afterSummary.resultado_operacional - afterSummary.despesas_financeiras;

      // Calcular transitórias DEPOIS
      const after = {
        summary: afterSummary,
        transitoria_debitos: normalizedInput.is_income 
          ? before.transitoria_debitos 
          : before.transitoria_debitos - normalizedInput.amount,
        transitoria_creditos: normalizedInput.is_income 
          ? before.transitoria_creditos - normalizedInput.amount 
          : before.transitoria_creditos,
        saldo_banco: before.saldo_banco // Banco não muda na classificação
      };

      // Gerar warnings
      if (after.transitoria_debitos !== 0) {
        warnings.push({
          type: 'warning',
          code: 'TRANS_DEB_PENDING',
          message: `Transitória Débitos ainda terá saldo de R$ ${after.transitoria_debitos.toFixed(2)}`,
          suggestion: 'Classifique todas as saídas pendentes'
        });
      }

      if (after.transitoria_creditos !== 0) {
        warnings.push({
          type: 'warning',
          code: 'TRANS_CRED_PENDING',
          message: `Transitória Créditos ainda terá saldo de R$ ${after.transitoria_creditos.toFixed(2)}`,
          suggestion: 'Classifique todas as entradas pendentes'
        });
      }

      // Verificar se resultado mudou muito
      const resultDiff = afterSummary.resultado_liquido - currentSummary.resultado_liquido;
      if (Math.abs(resultDiff) > 10000) {
        warnings.push({
          type: 'info',
          code: 'LARGE_IMPACT',
          message: `Esta classificação altera o resultado em R$ ${resultDiff.toFixed(2)}`,
          suggestion: 'Verifique se a conta está correta'
        });
      }

      // Verificar split balanceado
      const totalSplit = normalizedInput.target_accounts.reduce((sum, a) => sum + a.amount, 0);
      const isBalanced = Math.abs(totalSplit - normalizedInput.amount) < 0.01;

      if (!isBalanced) {
        warnings.push({
          type: 'error',
          code: 'UNBALANCED_SPLIT',
          message: `Split não balanceado: soma R$ ${totalSplit.toFixed(2)}, esperado R$ ${normalizedInput.amount.toFixed(2)}`,
          suggestion: 'Ajuste os valores para que somem o total'
        });
      }

      const preview: ImpactPreview = {
        before,
        after,
        affected_accounts: affectedAccounts,
        warnings,
        is_balanced: isBalanced,
        classification_type: normalizedInput.source_type === 'split' ? 'split' : 
          normalizedInput.source_type === 'reclassification' ? 'reclassification' : 'simple'
      };

      setPreview(preview);
      return preview;

    } catch (err: any) {
      const message = err.message || 'Erro ao calcular impacto';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tenantId, fetchCurrentBalances, fetchFinancialSummary, findAccountIdByCode]);

  /**
   * Limpa o preview
   */
  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  /**
   * Verifica se as transitórias zerarão após a classificação
   */
  const willZeroTransitorias = useMemo(() => {
    if (!preview) return false;
    return preview.after.transitoria_debitos === 0 && 
           preview.after.transitoria_creditos === 0;
  }, [preview]);

  /**
   * Calcula a variação do resultado
   */
  const resultVariation = useMemo(() => {
    if (!preview) return { absolute: 0, percentage: 0 };
    const diff = preview.after.summary.resultado_liquido - preview.before.summary.resultado_liquido;
    const pct = preview.before.summary.resultado_liquido !== 0
      ? (diff / Math.abs(preview.before.summary.resultado_liquido)) * 100
      : 0;
    return { absolute: diff, percentage: pct };
  }, [preview]);

  return {
    loading,
    preview,
    error,
    calculateImpact,
    clearPreview,
    willZeroTransitorias,
    resultVariation
  };
}

export default useImpactCalculation;
