/**
 * 🎣 useCompetencia - Hook React para Filtro por Competência
 * Dr. Cícero - Contador Responsável
 * 
 * Hook para gerenciar a competência atual e filtrar funcionários.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSupabaseClient } from '@/integrations/supabase/hooks';
import { CompetenciaService, CompetenciaFilter, EmployeeCompetenciaResult } from '@/services/CompetenciaService';

interface UseCompetenciaOptions {
  tenantId: string;
  initialCompetencia?: CompetenciaFilter;
}

interface UseCompetenciaReturn {
  // Estado
  competencia: CompetenciaFilter;
  competenciaString: string;
  competenciaFormatada: string;
  
  // Dados
  result: EmployeeCompetenciaResult | null;
  loading: boolean;
  error: string | null;
  
  // Ações
  setCompetencia: (comp: CompetenciaFilter | string) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  refresh: () => Promise<void>;
  
  // Datas calculadas
  inicioMes: string;
  fimMes: string;
}

/**
 * Hook para gerenciar competência e filtrar funcionários
 */
export function useCompetencia(options: UseCompetenciaOptions): UseCompetenciaReturn {
  const { tenantId, initialCompetencia } = options;
  const supabase = useSupabaseClient();
  
  // Estado inicial: mês atual ou fornecido
  const hoje = new Date();
  const [competencia, setCompetenciaState] = useState<CompetenciaFilter>(
    initialCompetencia || { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
  );
  
  const [result, setResult] = useState<EmployeeCompetenciaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Serviço
  const service = useMemo(
    () => new CompetenciaService(supabase, tenantId),
    [supabase, tenantId]
  );
  
  // Strings formatadas
  const competenciaString = useMemo(
    () => `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}`,
    [competencia]
  );
  
  const competenciaFormatada = useMemo(() => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[competencia.mes - 1]}/${competencia.ano}`;
  }, [competencia]);
  
  // Datas do mês
  const { inicioMes, fimMes } = useMemo(() => {
    const ultimoDia = new Date(competencia.ano, competencia.mes, 0).getDate();
    return {
      inicioMes: `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}-01`,
      fimMes: `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    };
  }, [competencia]);
  
  // Buscar dados
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await service.getEmployeesByCompetencia(competencia);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar funcionários');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [service, competencia]);
  
  // Alterar competência
  const setCompetencia = useCallback((comp: CompetenciaFilter | string) => {
    if (typeof comp === 'string') {
      const clean = comp.replace('-', '');
      if (clean.length === 6) {
        setCompetenciaState({
          ano: parseInt(clean.substring(0, 4)),
          mes: parseInt(clean.substring(4, 6))
        });
      }
    } else {
      setCompetenciaState(comp);
    }
  }, []);
  
  // Navegação
  const nextMonth = useCallback(() => {
    setCompetenciaState(prev => {
      if (prev.mes === 12) {
        return { ano: prev.ano + 1, mes: 1 };
      }
      return { ano: prev.ano, mes: prev.mes + 1 };
    });
  }, []);
  
  const prevMonth = useCallback(() => {
    setCompetenciaState(prev => {
      if (prev.mes === 1) {
        return { ano: prev.ano - 1, mes: 12 };
      }
      return { ano: prev.ano, mes: prev.mes - 1 };
    });
  }, []);
  
  return {
    competencia,
    competenciaString,
    competenciaFormatada,
    result,
    loading,
    error,
    setCompetencia,
    nextMonth,
    prevMonth,
    refresh,
    inicioMes,
    fimMes
  };
}

export default useCompetencia;
