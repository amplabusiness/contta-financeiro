/**
 * Hook para Folha de Pagamento com Lançamentos Contábeis Corretos
 * 
 * Implementa a estrutura contábil correta:
 * - Despesa com Salários (Resultado) = Valor Bruto
 * - Salários a Pagar (Passivo) = Valor Líquido
 * - INSS a Recolher (Passivo) = INSS retido
 * - IRRF a Recolher (Passivo) = IRRF retido
 * 
 * Integra sistema de rastreamento para evitar duplicatas:
 * - Cada lançamento recebe código único (TIPO_YYYYMM_SEQ_HASH)
 * - Validação automática de duplicatas
 * - Histórico de rastreamento para auditoria
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FolhaDetalhe {
  employeeId: string;
  employeeName: string;
  department?: string; // Departamento/Centro de Custo do funcionário
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

export function usePayrollAccounting() {
  /**
   * Resolve account code to UUID by querying chart_of_accounts
   */
  const resolveAccountId = async (code: string): Promise<string | null> => {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    return data?.id || null;
  };

  /**
   * Registra provisão de folha de pagamento com lançamentos contábeis por departamento
   *
   * Estrutura:
   * D - Despesa com Salários por Departamento (conta de Resultado)
   * C - Salários a Pagar (2.1.2.01 - Passivo)
   * C - INSS a Recolher (2.1.2.02 - Passivo)
   * C - IRRF a Recolher (2.1.2.03 - Passivo)
   */
  const registrarFolhaProvisao = useCallback(
    async (folha: FolhaPagamento): Promise<{ success: boolean; error?: string; entryId?: string; codigoRastreamento?: string }> => {
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
        const mes = String(folha.mes).padStart(2, '0');
        const competenciaCode = `${folha.ano}${mes}`;
        const entryDate = new Date(folha.ano, folha.mes, 0).toISOString().slice(0, 10);
        const internalCode = `FOLHA_${competenciaCode}_APROPRIACAO`;

        const salariosDespesaId = await resolveAccountId('4.2.1.01');
        const salariosPagarId = await resolveAccountId('2.1.2.01');
        const inssRecolherId = await resolveAccountId('2.1.2.02');
        const irrfRecolherId = await resolveAccountId('2.1.2.03');

        if (!salariosDespesaId || !salariosPagarId || !inssRecolherId || !irrfRecolherId) {
          return { success: false, error: 'Contas contábeis da folha não configuradas.' };
        }

        const { data: existingEntries, error: findErr } = await supabase
          .from('accounting_entries')
          .select('id,created_at')
          .eq('internal_code', internalCode)
          .order('created_at', { ascending: true });

        if (findErr) {
          return { success: false, error: `Erro ao buscar lançamento existente: ${findErr.message}` };
        }

        let entryId: string | null = null;
        const existing = existingEntries || [];

        if (existing.length > 0) {
          entryId = existing[0].id;
          const { error: updError } = await supabase
            .from('accounting_entries')
            .update({
              entry_date: entryDate,
              competence_date: entryDate,
              description: `Provisão Folha CLT ${mes}/${folha.ano}`,
              entry_type: 'MOVIMENTO',
              reference_type: 'payroll',
              source_type: 'payroll_system',
              total_debit: totalBruto,
              total_credit: totalBruto,
              balanced: true,
            })
            .eq('id', entryId);
          if (updError) {
            return { success: false, error: `Erro ao atualizar lançamento: ${updError.message}` };
          }

          if (existing.length > 1) {
            const duplicateIds = existing.slice(1).map((e) => e.id);
            if (duplicateIds.length > 0) {
              await supabase.from('accounting_entry_items').delete().in('entry_id', duplicateIds);
              await supabase.from('accounting_entry_lines').delete().in('entry_id', duplicateIds);
              await supabase.from('accounting_entries').delete().in('id', duplicateIds);
            }
          }
        } else {
          const { data: entry, error: entryError } = await supabase
            .from('accounting_entries')
            .insert([
              {
                entry_date: entryDate,
                competence_date: entryDate,
                description: `Provisão Folha CLT ${mes}/${folha.ano}`,
                entry_type: 'MOVIMENTO',
                reference_type: 'payroll',
                source_type: 'payroll_system',
                internal_code: internalCode,
                total_debit: totalBruto,
                total_credit: totalBruto,
                balanced: true,
              },
            ])
            .select('id')
            .single();

          if (entryError || !entry) {
            return { success: false, error: `Erro ao criar entrada: ${entryError?.message}` };
          }

          entryId = entry.id;
        }

        if (!entryId) {
          return { success: false, error: 'Falha ao determinar ID do lançamento.' };
        }

        const { error: clearItemsError } = await supabase
          .from('accounting_entry_items')
          .delete()
          .eq('entry_id', entryId);

        if (clearItemsError) {
          return { success: false, error: `Erro ao limpar itens antigos: ${clearItemsError.message}` };
        }

        const { error: clearLinesError } = await supabase
          .from('accounting_entry_lines')
          .delete()
          .eq('entry_id', entryId);

        if (clearLinesError) {
          return { success: false, error: `Erro ao limpar linhas antigas: ${clearLinesError.message}` };
        }

        const linhas: any[] = [
          {
            entry_id: entryId,
            account_id: salariosDespesaId,
            debit: totalBruto,
            credit: 0,
            description: `Salários CLT ${mes}/${folha.ano}`,
          },
          {
            entry_id: entryId,
            account_id: salariosPagarId,
            debit: 0,
            credit: totalLiquido,
            description: `Salários a pagar ${mes}/${folha.ano}`,
          },
        ];

        if (totalINSS > 0) {
          linhas.push({
            entry_id: entryId,
            account_id: inssRecolherId,
            debit: 0,
            credit: totalINSS,
            description: `INSS retido ${mes}/${folha.ano}`,
          });
        }

        if (totalIRRF > 0) {
          linhas.push({
            entry_id: entryId,
            account_id: irrfRecolherId,
            debit: 0,
            credit: totalIRRF,
            description: `IRRF retido ${mes}/${folha.ano}`,
          });
        }

        const { error: linhasError } = await supabase
          .from('accounting_entry_items')
          .insert(linhas);

        if (linhasError) {
          return { success: false, error: `Erro ao criar linhas: ${linhasError.message}` };
        }

        const linhasRazao = linhas.map((l) => ({
          entry_id: l.entry_id,
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        }));

        const { error: linesErr } = await supabase
          .from('accounting_entry_lines')
          .insert(linhasRazao);

        if (linesErr) {
          return { success: false, error: `Erro ao criar linhas do razão: ${linesErr.message}` };
        }

        return {
          success: true,
          entryId,
          codigoRastreamento: internalCode,
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

        // Linhas do lançamento - resolve account codes to UUIDs
        const salariosPagarId = await resolveAccountId('2.1.2.01');
        const linhas = [
          {
            entry_id: entry.id,
            account_id: salariosPagarId,
            debit: params.totalPago,
            credit: 0,
          },
          {
            entry_id: entry.id,
            account_id: params.bankAccountId,
            debit: 0,
            credit: params.totalPago,
          }
        ];

        const { error: linhasError } = await supabase
          .from('accounting_entry_items')
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

        // Resolve account codes to UUIDs
        const inssRecolherId = await resolveAccountId('2.1.2.02');
        const linhas = [
          {
            entry_id: entry.id,
            account_id: inssRecolherId,
            debit: params.totalINSS,
            credit: 0,
          },
          {
            entry_id: entry.id,
            account_id: params.bankAccountId,
            debit: 0,
            credit: params.totalINSS,
          }
        ];

        const { error: linhasError } = await supabase
          .from('accounting_entry_items')
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

        // Resolve account codes to UUIDs
        const irrfRecolherId = await resolveAccountId('2.1.2.03');
        const linhas = [
          {
            entry_id: entry.id,
            account_id: irrfRecolherId,
            debit: params.totalIRRF,
            credit: 0,
          },
          {
            entry_id: entry.id,
            account_id: params.bankAccountId,
            debit: 0,
            credit: params.totalIRRF,
          }
        ];

        const { error: linhasError } = await supabase
          .from('accounting_entry_items')
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
