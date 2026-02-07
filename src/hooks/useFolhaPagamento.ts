/**
 * 🧾 USE FOLHA PAGAMENTO HOOK
 * Dr. Cícero - Contador Responsável
 * 
 * Hook React para processamento de folha de pagamento.
 * Usa o FolhaPagamentoService para garantir lançamentos balanceados.
 * 
 * ESTRUTURA CONTÁBIL CORRETA:
 * ===========================
 * 
 * APROPRIAÇÃO:
 * D - 4.2.1.01 Salários .............. BRUTO
 *   C - 2.1.2.01 Salários a Pagar .... LÍQUIDO
 *   C - 2.1.2.03 INSS a Recolher ..... INSS
 *   C - 2.1.2.04 IRRF a Recolher ..... IRRF  
 *   C - 2.1.2.09 Outros Descontos .... OUTROS
 * 
 * FGTS:
 * D - 4.2.1.03 FGTS .................. 8% do BRUTO
 *   C - 2.1.2.02 FGTS a Recolher ..... 8% do BRUTO
 * 
 * VALIDAÇÃO:
 * BRUTO = LÍQUIDO + INSS + IRRF + OUTROS
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FolhaPagamentoService,
  FuncionarioFolha,
  ResultadoFolha,
  CONTAS_FOLHA,
  createFolhaPagamentoService
} from '@/services/FolhaPagamentoService';

// Tenant ID da Ampla (poderia vir de contexto)
const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

export interface FolhaInput {
  competencia: string; // YYYYMM
  funcionarios: FuncionarioFolha[];
}

export function useFolhaPagamento() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoFolha | null>(null);

  /**
   * Processa a folha de pagamento (apenas cálculos, não salva)
   */
  const processarFolha = useCallback((input: FolhaInput): ResultadoFolha => {
    const service = createFolhaPagamentoService(supabase, TENANT_ID);
    const resultado = service.processarFolha(input.competencia, input.funcionarios);
    setResultado(resultado);
    return resultado;
  }, []);

  /**
   * Salva os lançamentos contábeis da folha processada
   */
  const salvarFolha = useCallback(async (resultado: ResultadoFolha): Promise<{
    success: boolean;
    error?: string;
    entryIds?: string[];
  }> => {
    setLoading(true);
    
    try {
      // Validar balanceamento
      if (!resultado.validacao.balanceado) {
        const msg = `❌ Folha não balanceada: ${resultado.validacao.mensagem}`;
        toast.error(msg);
        return { success: false, error: msg };
      }

      const service = createFolhaPagamentoService(supabase, TENANT_ID);
      const result = await service.salvarLancamentos(resultado);

      if (result.success) {
        toast.success(`✅ Folha ${resultado.competencia} contabilizada com sucesso!`);
      } else {
        toast.error(`❌ Erro: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      const msg = error.message || 'Erro ao salvar folha';
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Processa e salva em uma única operação
   */
  const processarESalvarFolha = useCallback(async (input: FolhaInput): Promise<{
    success: boolean;
    resultado?: ResultadoFolha;
    error?: string;
    entryIds?: string[];
  }> => {
    const resultado = processarFolha(input);
    
    if (!resultado.validacao.balanceado) {
      return {
        success: false,
        resultado,
        error: resultado.validacao.mensagem
      };
    }

    const saveResult = await salvarFolha(resultado);

    return {
      ...saveResult,
      resultado
    };
  }, [processarFolha, salvarFolha]);

  /**
   * Busca folha existente por competência
   */
  const buscarFolha = useCallback(async (competencia: string) => {
    setLoading(true);
    
    try {
      const service = createFolhaPagamentoService(supabase, TENANT_ID);
      return await service.buscarFolha(competencia);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Calcula INSS para um único funcionário
   */
  const calcularINSS = useCallback((salarioBruto: number): number => {
    const service = createFolhaPagamentoService(supabase, TENANT_ID);
    return service.calcularINSS(salarioBruto);
  }, []);

  /**
   * Calcula IRRF para um único funcionário
   */
  const calcularIRRF = useCallback((salarioBruto: number, inss: number, dependentes: number = 0): number => {
    const service = createFolhaPagamentoService(supabase, TENANT_ID);
    return service.calcularIRRF(salarioBruto, inss, dependentes);
  }, []);

  /**
   * Calcula FGTS
   */
  const calcularFGTS = useCallback((salarioBruto: number): number => {
    return Math.round(salarioBruto * 0.08 * 100) / 100;
  }, []);

  return {
    loading,
    resultado,
    
    // Operações principais
    processarFolha,
    salvarFolha,
    processarESalvarFolha,
    buscarFolha,
    
    // Cálculos individuais
    calcularINSS,
    calcularIRRF,
    calcularFGTS,
    
    // Contas para referência
    CONTAS: CONTAS_FOLHA
  };
}

export default useFolhaPagamento;
