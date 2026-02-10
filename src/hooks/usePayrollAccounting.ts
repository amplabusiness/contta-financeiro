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
import { toast } from 'sonner';
import {
  gerarCodigoRastreamento,
  validarDuplicata,
  registrarRastreamento,
} from '@/services/RastreamentoService';

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

// Funcionários pessoais do proprietário - débito vai para ADIANTAMENTO, não despesa
const FAMILIA_PROPRIETARIO_FOLHA = [
  { regex: /SERGIO\s*AUGUSTO/i, contaCodigo: '1.1.3.04.05', contaId: '143a5ffc-0b6b-4ee6-b09d-8f077bccd658' },
  { regex: /RAIMUNDO\s*PEREIRA/i, contaCodigo: '1.1.3.04.01', contaId: 'b2845989-75af-4ee6-b3fb-473fb58e90a2' },
  { regex: /KENIO\s*MARTINS/i, contaCodigo: '1.1.3.04.01', contaId: 'b2845989-75af-4ee6-b3fb-473fb58e90a2' },
  { regex: /FABIANA\s*MARIA/i, contaCodigo: '1.1.3.04.04', contaId: 'e796f6f4-c491-4e38-807f-0a5a5d837b84' },
  { regex: /CLAUDIA\s*BARBOSA/i, contaCodigo: '1.1.3.04.04', contaId: 'e796f6f4-c491-4e38-807f-0a5a5d837b84' },
];

function isFamiliaProprietario(nome: string): { contaCodigo: string; contaId: string } | null {
  for (const f of FAMILIA_PROPRIETARIO_FOLHA) {
    if (f.regex.test(nome)) return { contaCodigo: f.contaCodigo, contaId: f.contaId };
  }
  return null;
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

        // Separar funcionários pessoais (família proprietário) dos CLT empresa
        const familiaItems: { nome: string; bruto: number; contaId: string }[] = [];
        const empresaFuncionarios: FolhaDetalhe[] = [];

        folha.funcionarios.forEach(f => {
          const familia = isFamiliaProprietario(f.employeeName);
          if (familia) {
            familiaItems.push({ nome: f.employeeName, bruto: f.salarioBruto, contaId: familia.contaId });
          } else {
            empresaFuncionarios.push(f);
          }
        });

        // Agrupar CLT empresa por departamento para débito
        const porDepartamento: Record<string, { bruto: number; funcionarios: string[] }> = {};
        empresaFuncionarios.forEach(f => {
          const dept = f.department || 'Geral';
          if (!porDepartamento[dept]) {
            porDepartamento[dept] = { bruto: 0, funcionarios: [] };
          }
          porDepartamento[dept].bruto += f.salarioBruto;
          porDepartamento[dept].funcionarios.push(f.employeeName);
        });

        // ✅ Gerar código único de rastreamento
        const rastreamento = await gerarCodigoRastreamento(
          supabase,
          'FOLD',
          {
            totalBruto,
            totalINSS,
            totalIRRF,
            totalLiquido,
            funcionarios: folha.funcionarios.length,
            departamentos: Object.keys(porDepartamento)
          },
          folha.ano,
          folha.mes
        );

        // ✅ Validar se já existe (evita duplicatas)
        const { isDuplicata, message: duplicataMsg } = await validarDuplicata(
          supabase,
          rastreamento.codigoRastreamento,
          rastreamento.referenceId
        );

        if (isDuplicata) {
          return {
            success: false,
            error: `Lançamento duplicado detectado! ${duplicataMsg}`
          };
        }

        // Buscar contas de despesa existentes
        const { data: contasDespesa } = await supabase
          .from('chart_of_accounts')
          .select('id, code, name')
          .eq('account_type', 'DESPESA')
          .eq('is_active', true);

        // Criar entrada contábil principal
        // NOTA: reference_id é UUID - NÃO usar para código de rastreamento (que é text)
        // O código de rastreamento já está no campo description entre colchetes
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert([
            {
              entry_date: folha.dataFolha,
              description: `Provisão Folha de Pagamento ${String(folha.mes).padStart(2, '0')}/${folha.ano} [${rastreamento.codigoRastreamento}]`,
              entry_type: 'payroll',
              reference_type: 'payroll',
              source_type: 'payroll',
            }
          ])
          .select()
          .single();

        if (entryError || !entry) {
          return { success: false, error: `Erro ao criar entrada: ${entryError?.message}` };
        }

        // Preparar linhas contábeis
        const linhas: any[] = [];

        // DÉBITOS - Uma linha por departamento (despesa)
        for (const [dept, dados] of Object.entries(porDepartamento)) {
          // Buscar conta de despesa específica do departamento ou usar conta genérica
          let contaDept = contasDespesa?.find(c =>
            c.name.toLowerCase().includes(dept.toLowerCase()) &&
            (c.name.toLowerCase().includes('salário') || c.name.toLowerCase().includes('salario') || c.name.toLowerCase().includes('pessoal'))
          );

          // Se não encontrou conta específica, buscar conta genérica de salários
          if (!contaDept) {
            contaDept = contasDespesa?.find(c =>
              c.name.toLowerCase().includes('salário') ||
              c.name.toLowerCase().includes('salario') ||
              c.name.toLowerCase().includes('pessoal') ||
              c.name.toLowerCase().includes('folha')
            );
          }

          // Resolve account_id: use found account or fallback to 4.1.1.01
          const deptAccountId = contaDept?.id || await resolveAccountId('4.1.1.01');

          linhas.push({
            entry_id: entry.id,
            account_id: deptAccountId,
            debit: dados.bruto,
            credit: 0,
          });
        }

        // DÉBITOS - Funcionários pessoais (família) → Adiantamento a Sócios (NÃO despesa)
        for (const fam of familiaItems) {
          if (fam.bruto > 0) {
            linhas.push({
              entry_id: entry.id,
              account_id: fam.contaId,
              debit: fam.bruto,
              credit: 0,
            });
          }
        }

        // CRÉDITOS - Passivo (Salários a Pagar)
        if (totalLiquido > 0) {
          const salariosPagarId = await resolveAccountId('2.1.2.01');
          linhas.push({
            entry_id: entry.id,
            account_id: salariosPagarId,
            debit: 0,
            credit: totalLiquido,
          });
        }

        // CRÉDITOS - INSS a Recolher
        if (totalINSS > 0) {
          const inssRecolherId = await resolveAccountId('2.1.2.02');
          linhas.push({
            entry_id: entry.id,
            account_id: inssRecolherId,
            debit: 0,
            credit: totalINSS,
          });
        }

        // CRÉDITOS - IRRF a Recolher
        if (totalIRRF > 0) {
          const irrfRecolherId = await resolveAccountId('2.1.2.03');
          linhas.push({
            entry_id: entry.id,
            account_id: irrfRecolherId,
            debit: 0,
            credit: totalIRRF,
          });
        }

        // Inserir linhas contábeis
        const { error: linhasError } = await supabase
          .from('accounting_entry_items')
          .insert(linhas);

        if (linhasError) {
          // Reverter entrada se linhas falharem
          await supabase.from('accounting_entries').delete().eq('id', entry.id);
          return { success: false, error: `Erro ao criar linhas: ${linhasError.message}` };
        }

        // ✅ Registrar rastreamento (auditoria)
        await registrarRastreamento(supabase, rastreamento, entry.id, {
          totalBruto,
          totalINSS,
          totalIRRF,
          totalLiquido,
          funcionarios: folha.funcionarios.length,
          departamentos: porDepartamento,
          dataFolha: folha.dataFolha
        });

        return {
          success: true,
          entryId: entry.id,
          codigoRastreamento: rastreamento.codigoRastreamento
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
