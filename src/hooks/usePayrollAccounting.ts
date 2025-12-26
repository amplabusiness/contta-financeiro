/**
 * Hook para Folha de Pagamento com Lançamentos Contábeis Corretos
 * 
 * Implementa a estrutura contábil correta:
 * - Despesa com Salários (Resultado) = Valor Bruto
 * - Salários a Pagar (Passivo) = Valor Líquido
 * - INSS a Recolher (Passivo) = INSS retido
 * - IRRF a Recolher (Passivo) = IRRF retido
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FolhaDetalhe {
  employeeId: string;
  employeeName: string;
  salarioBruto: number;
  inssRetido: number;
  irrfRetido: number;
  salarioLiquido: number;
}

export interface FolhaPagamento {
  mes: number;
  ano: number;
  dataFolha: string; // YYYY-MM-DD
  funcionarios: FolhaDetalhe[];
}

interface LancamentoFolha {
  descricao: string;
  referenceType: 'payroll';
  referenceId: string;
  linhas: {
    contaCode: string;
    contaNome: string;
    debito: number;
    credito: number;
  }[];
}

export function usePayrollAccounting() {
  /**
   * Registra provisão de folha de pagamento com lançamentos contábeis corretos
   * 
   * Estrutura:
   * D - Despesa com Salários e Encargos (conta de Resultado)
   * C - Salários a Pagar (2.1.2.01 - Passivo)
   * C - INSS a Recolher (2.1.2.02 - Passivo)
   * C - IRRF a Recolher (2.1.2.03 - Passivo)
   */
  const registrarFolhaProvisao = useCallback(
    async (folha: FolhaPagamento): Promise<{ success: boolean; error?: string; entryId?: string }> => {
      try {
        // Validar entrada
        if (!folha.funcionarios || folha.funcionarios.length === 0) {
          return { success: false, error: 'Nenhum funcionário na folha' };
        }

        // Calcular totais
        const totalBruto = folha.funcionarios.reduce((sum, f) => sum + f.salarioBruto, 0);
        const totalINSS = folha.funcionarios.reduce((sum, f) => sum + f.inssRetido, 0);
        const totalIRRF = folha.funcionarios.reduce((sum, f) => sum + f.irrfRetido, 0);
        const totalLiquido = folha.funcionarios.reduce((sum, f) => sum + f.salarioLiquido, 0);

        // Validar que bruto = líquido + inss + irrf
        const diferenca = Math.abs(totalBruto - (totalLiquido + totalINSS + totalIRRF));
        if (diferenca > 0.01) {
          return {
            success: false,
            error: `Erro de cálculo: Bruto (R$ ${totalBruto}) != Líquido (R$ ${totalLiquido}) + INSS (R$ ${totalINSS}) + IRRF (R$ ${totalIRRF})`
          };
        }

        // Buscar código da conta de despesa com salários
        const { data: contaDespesa } = await supabase
          .from('chart_of_accounts')
          .select('id, code, name')
          .ilike('name', '%salarios%|%encargos%')
          .eq('account_type', 'Expense')
          .eq('active', true)
          .limit(1)
          .single();

        if (!contaDespesa) {
          return {
            success: false,
            error: 'Conta de Despesa com Salários não encontrada. Configure no plano de contas.'
          };
        }

        // Preparar lançamento contábil
        const referenceId = `payroll_${folha.ano}${String(folha.mes).padStart(2, '0')}`;
        
        const linhas = [
          {
            account_id: contaDespesa.id,
            account_code: contaDespesa.code,
            account_name: contaDespesa.name,
            account_type: 'Expense',
            debit: totalBruto,
            credit: 0,
            description: `Folha de Pagamento - ${String(folha.mes).padStart(2, '0')}/${folha.ano}. Bruto total: R$ ${totalBruto.toFixed(2)}`
          },
          {
            account_code: '2.1.2.01',
            account_name: 'Salários e Ordenados a Pagar',
            account_type: 'Liability',
            debit: 0,
            credit: totalLiquido,
            description: `Salários a pagar - ${folha.funcionarios.length} funcionários`
          },
          {
            account_code: '2.1.2.02',
            account_name: 'INSS a Recolher',
            account_type: 'Liability',
            debit: 0,
            credit: totalINSS,
            description: `INSS descontado de funcionários`
          },
          {
            account_code: '2.1.2.03',
            account_name: 'IRRF a Recolher',
            account_type: 'Liability',
            debit: 0,
            credit: totalIRRF,
            description: `IRRF descontado de funcionários`
          }
        ];

        // Criar entrada contábil
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert([
            {
              entry_date: folha.dataFolha,
              description: `Folha de Pagamento ${String(folha.mes).padStart(2, '0')}/${folha.ano} - ${folha.funcionarios.length} funcionários`,
              reference_type: 'payroll',
              reference_id: referenceId,
              competence_month: folha.mes,
              competence_year: folha.ano,
            }
          ])
          .select()
          .single();

        if (entryError || !entry) {
          return { success: false, error: `Erro ao criar entrada: ${entryError?.message}` };
        }

        // Inserir linhas contábeis
        const linhasComEntryId = linhas.map(linha => ({
          ...linha,
          entry_id: entry.id
        }));

        const { error: linhasError } = await supabase
          .from('accounting_entry_lines')
          .insert(linhasComEntryId);

        if (linhasError) {
          // Reverter entrada se linhas falharem
          await supabase.from('accounting_entries').delete().eq('id', entry.id);
          return { success: false, error: `Erro ao criar linhas: ${linhasError.message}` };
        }

        return { 
          success: true,
          entryId: entry.id
        };

      } catch (error: any) {
        return { 
          success: false,
          error: error.message || 'Erro desconhecido ao registrar folha'
        };
      }
    },
    []
  );

  /**
   * Registra pagamento de salários (baixa do passivo)
   */
  const registrarPagamentoSalarios = useCallback(
    async (params: {
      folhaReferenceId: string;
      dataPagamento: string;
      totalPago: number;
      bankAccountId: string;
    }): Promise<{ success: boolean; error?: string; entryId?: string }> => {
      try {
        // Criar lançamento de pagamento dos salários
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert([
            {
              entry_date: params.dataPagamento,
              description: `Pagamento de Salários referente a ${params.folhaReferenceId}`,
              reference_type: 'payroll_payment',
              reference_id: params.folhaReferenceId,
            }
          ])
          .select()
          .single();

        if (entryError || !entry) {
          return { success: false, error: `Erro ao criar entrada: ${entryError?.message}` };
        }

        // Linhas do lançamento
        const linhas = [
          {
            entry_id: entry.id,
            account_code: '2.1.2.01',
            account_name: 'Salários e Ordenados a Pagar',
            account_type: 'Liability',
            debit: params.totalPago,
            credit: 0,
            description: 'Pagamento de salários'
          },
          {
            entry_id: entry.id,
            account_id: params.bankAccountId,
            account_code: '1.1.1.01', // Banco (exemplo)
            account_name: 'Banco',
            account_type: 'Asset',
            debit: 0,
            credit: params.totalPago,
            description: 'Saída de caixa - Salários'
          }
        ];

        const { error: linhasError } = await supabase
          .from('accounting_entry_lines')
          .insert(linhas);

        if (linhasError) {
          await supabase.from('accounting_entries').delete().eq('id', entry.id);
          return { success: false, error: `Erro ao criar linhas: ${linhasError.message}` };
        }

        return { 
          success: true,
          entryId: entry.id
        };

      } catch (error: any) {
        return { 
          success: false,
          error: error.message || 'Erro ao registrar pagamento de salários'
        };
      }
    },
    []
  );

  /**
   * Registra recolhimento de INSS
   */
  const registrarRecolhimentoINSS = useCallback(
    async (params: {
      folhaReferenceId: string;
      dataRecolhimento: string;
      totalINSS: number;
      bankAccountId: string;
    }): Promise<{ success: boolean; error?: string; entryId?: string }> => {
      try {
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert([
            {
              entry_date: params.dataRecolhimento,
              description: `Recolhimento de INSS referente a ${params.folhaReferenceId}`,
              reference_type: 'payroll_inss',
              reference_id: params.folhaReferenceId,
            }
          ])
          .select()
          .single();

        if (entryError || !entry) {
          return { success: false, error: `Erro ao criar entrada: ${entryError?.message}` };
        }

        const linhas = [
          {
            entry_id: entry.id,
            account_code: '2.1.2.02',
            account_name: 'INSS a Recolher',
            account_type: 'Liability',
            debit: params.totalINSS,
            credit: 0,
            description: 'Recolhimento de INSS'
          },
          {
            entry_id: entry.id,
            account_id: params.bankAccountId,
            account_code: '1.1.1.01',
            account_name: 'Banco',
            account_type: 'Asset',
            debit: 0,
            credit: params.totalINSS,
            description: 'Saída de caixa - INSS'
          }
        ];

        const { error: linhasError } = await supabase
          .from('accounting_entry_lines')
          .insert(linhas);

        if (linhasError) {
          await supabase.from('accounting_entries').delete().eq('id', entry.id);
          return { success: false, error: `Erro ao criar linhas: ${linhasError.message}` };
        }

        return { 
          success: true,
          entryId: entry.id
        };

      } catch (error: any) {
        return { 
          success: false,
          error: error.message || 'Erro ao registrar recolhimento de INSS'
        };
      }
    },
    []
  );

  /**
   * Registra recolhimento de IRRF
   */
  const registrarRecolhimentoIRRF = useCallback(
    async (params: {
      folhaReferenceId: string;
      dataRecolhimento: string;
      totalIRRF: number;
      bankAccountId: string;
    }): Promise<{ success: boolean; error?: string; entryId?: string }> => {
      try {
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert([
            {
              entry_date: params.dataRecolhimento,
              description: `Recolhimento de IRRF referente a ${params.folhaReferenceId}`,
              reference_type: 'payroll_irrf',
              reference_id: params.folhaReferenceId,
            }
          ])
          .select()
          .single();

        if (entryError || !entry) {
          return { success: false, error: `Erro ao criar entrada: ${entryError?.message}` };
        }

        const linhas = [
          {
            entry_id: entry.id,
            account_code: '2.1.2.03',
            account_name: 'IRRF a Recolher',
            account_type: 'Liability',
            debit: params.totalIRRF,
            credit: 0,
            description: 'Recolhimento de IRRF'
          },
          {
            entry_id: entry.id,
            account_id: params.bankAccountId,
            account_code: '1.1.1.01',
            account_name: 'Banco',
            account_type: 'Asset',
            debit: 0,
            credit: params.totalIRRF,
            description: 'Saída de caixa - IRRF'
          }
        ];

        const { error: linhasError } = await supabase
          .from('accounting_entry_lines')
          .insert(linhas);

        if (linhasError) {
          await supabase.from('accounting_entries').delete().eq('id', entry.id);
          return { success: false, error: `Erro ao criar linhas: ${linhasError.message}` };
        }

        return { 
          success: true,
          entryId: entry.id
        };

      } catch (error: any) {
        return { 
          success: false,
          error: error.message || 'Erro ao registrar recolhimento de IRRF'
        };
      }
    },
    []
  );

  return {
    registrarFolhaProvisao,
    registrarPagamentoSalarios,
    registrarRecolhimentoINSS,
    registrarRecolhimentoIRRF
  };
}

export default usePayrollAccounting;
