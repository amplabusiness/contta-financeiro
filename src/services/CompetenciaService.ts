/**
 * 📅 COMPETÊNCIA SERVICE - Filtro de Funcionários por Competência
 * Dr. Cícero - Contador Responsável
 * 
 * Este serviço implementa a lógica de filtro por competência para funcionários.
 * 
 * REGRA DE NEGÓCIO:
 * ================
 * Um funcionário é considerado ATIVO em uma competência se:
 * 1. Foi admitido ATÉ o último dia do mês da competência
 * 2. NÃO foi demitido ANTES do primeiro dia do mês da competência
 * 
 * Exemplo para competência 02/2025:
 * - Funcionário admitido em 15/02/2025 → ATIVO (admitido no mês)
 * - Funcionário admitido em 01/03/2025 → NÃO ATIVO (admitido depois)
 * - Funcionário demitido em 15/01/2025 → NÃO ATIVO (demitido antes)
 * - Funcionário demitido em 28/02/2025 → ATIVO (demitido no mês)
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface Employee {
  id: string;
  name: string;
  cpf?: string | null;
  department?: string | null;
  role?: string | null;
  hire_date: string | null;
  termination_date?: string | null;
  is_active: boolean;
  contract_type: 'clt' | 'pj' | 'mei' | 'estagio' | 'temporario' | string;
  official_salary?: number | null;
  unofficial_salary?: number | null;
  payment_day?: number | null;
}

export interface CompetenciaFilter {
  ano: number;
  mes: number;
}

export interface EmployeeCompetenciaResult {
  ativos: Employee[];
  naoAdmitidos: Employee[];
  demitidos: Employee[];
  resumo: {
    totalAtivos: number;
    totalNaoAdmitidos: number;
    totalDemitidos: number;
    totalCLT: number;
    totalPJ: number;
    valorCLT: number;
    valorPJ: number;
    valorTotal: number;
  };
}

export interface CompetenciaDates {
  competencia: string;      // YYYY-MM
  inicioMes: string;        // YYYY-MM-01
  fimMes: string;           // YYYY-MM-DD (último dia)
  proximoMes: string;       // YYYY-MM-01 do próximo mês
}

// ============================================================================
// UTILITÁRIOS DE DATA
// ============================================================================

/**
 * Calcula as datas relevantes para uma competência
 */
export function getCompetenciaDates(ano: number, mes: number): CompetenciaDates {
  const competencia = `${ano}-${String(mes).padStart(2, '0')}`;
  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
  
  // Último dia do mês
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  
  // Primeiro dia do próximo mês
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const proximoMesNum = mes === 12 ? 1 : mes + 1;
  const proximoMes = `${proximoAno}-${String(proximoMesNum).padStart(2, '0')}-01`;
  
  return { competencia, inicioMes, fimMes, proximoMes };
}

/**
 * Converte string YYYY-MM ou YYYYMM para CompetenciaFilter
 */
export function parseCompetencia(competencia: string): CompetenciaFilter {
  // Remove hífen se existir
  const clean = competencia.replace('-', '');
  
  if (clean.length === 6) {
    return {
      ano: parseInt(clean.substring(0, 4)),
      mes: parseInt(clean.substring(4, 6))
    };
  }
  
  throw new Error(`Formato de competência inválido: ${competencia}. Use YYYY-MM ou YYYYMM`);
}

/**
 * Formata competência para exibição
 */
export function formatCompetencia(ano: number, mes: number): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${meses[mes - 1]}/${ano}`;
}

// ============================================================================
// LÓGICA DE FILTRO POR COMPETÊNCIA
// ============================================================================

/**
 * Verifica se um funcionário estava ativo em uma competência
 * 
 * @param employee - Funcionário a verificar
 * @param competencia - Competência {ano, mes}
 * @returns 'ativo' | 'nao_admitido' | 'demitido'
 */
export function getEmployeeStatusInCompetencia(
  employee: Employee,
  competencia: CompetenciaFilter
): 'ativo' | 'nao_admitido' | 'demitido' {
  const { inicioMes, fimMes } = getCompetenciaDates(competencia.ano, competencia.mes);
  
  const admissao = employee.hire_date;
  const demissao = employee.termination_date;
  
  // Se não tem data de admissão, considera não admitido
  if (!admissao) {
    return 'nao_admitido';
  }
  
  // Verifica se foi admitido ATÉ o último dia do mês
  const foiAdmitido = admissao <= fimMes;
  
  // Verifica se NÃO foi demitido ANTES do início do mês
  // (se foi demitido no mês ou depois, ainda estava ativo no mês)
  const naoFoiDemitidoAntes = !demissao || demissao >= inicioMes;
  
  if (!foiAdmitido) {
    return 'nao_admitido';
  }
  
  if (!naoFoiDemitidoAntes) {
    return 'demitido';
  }
  
  return 'ativo';
}

/**
 * Filtra lista de funcionários por competência
 */
export function filterEmployeesByCompetencia(
  employees: Employee[],
  competencia: CompetenciaFilter
): EmployeeCompetenciaResult {
  const ativos: Employee[] = [];
  const naoAdmitidos: Employee[] = [];
  const demitidos: Employee[] = [];
  
  for (const emp of employees) {
    const status = getEmployeeStatusInCompetencia(emp, competencia);
    
    switch (status) {
      case 'ativo':
        ativos.push(emp);
        break;
      case 'nao_admitido':
        naoAdmitidos.push(emp);
        break;
      case 'demitido':
        demitidos.push(emp);
        break;
    }
  }
  
  // Calcular resumo
  const cltAtivos = ativos.filter(e => e.contract_type === 'clt');
  const pjAtivos = ativos.filter(e => e.contract_type === 'pj' || e.contract_type === 'mei');
  
  const valorCLT = cltAtivos.reduce((sum, e) => sum + (e.official_salary || 0), 0);
  const valorPJ = pjAtivos.reduce((sum, e) => sum + (e.unofficial_salary || 0), 0);
  
  return {
    ativos: ativos.sort((a, b) => a.name.localeCompare(b.name)),
    naoAdmitidos: naoAdmitidos.sort((a, b) => a.name.localeCompare(b.name)),
    demitidos: demitidos.sort((a, b) => a.name.localeCompare(b.name)),
    resumo: {
      totalAtivos: ativos.length,
      totalNaoAdmitidos: naoAdmitidos.length,
      totalDemitidos: demitidos.length,
      totalCLT: cltAtivos.length,
      totalPJ: pjAtivos.length,
      valorCLT,
      valorPJ,
      valorTotal: valorCLT + valorPJ
    }
  };
}

// ============================================================================
// CLASSE DE SERVIÇO
// ============================================================================

export class CompetenciaService {
  private supabase: SupabaseClient;
  private tenantId: string;
  
  constructor(supabase: SupabaseClient, tenantId: string) {
    this.supabase = supabase;
    this.tenantId = tenantId;
  }
  
  /**
   * Busca todos os funcionários e filtra por competência
   */
  async getEmployeesByCompetencia(
    competencia: CompetenciaFilter | string
  ): Promise<EmployeeCompetenciaResult> {
    // Normaliza competência
    const comp = typeof competencia === 'string' 
      ? parseCompetencia(competencia) 
      : competencia;
    
    // Busca todos os funcionários
    const { data: employees, error } = await this.supabase
      .from('employees')
      .select(`
        id,
        name,
        cpf,
        department,
        role,
        hire_date,
        termination_date,
        is_active,
        contract_type,
        official_salary,
        unofficial_salary,
        payment_day
      `)
      .eq('tenant_id', this.tenantId)
      .order('name');
    
    if (error) {
      throw new Error(`Erro ao buscar funcionários: ${error.message}`);
    }
    
    // Filtra por competência
    return filterEmployeesByCompetencia(employees || [], comp);
  }
  
  /**
   * Busca funcionários ativos em uma competência (método simplificado)
   */
  async getActivosNaCompetencia(
    competencia: CompetenciaFilter | string
  ): Promise<Employee[]> {
    const result = await this.getEmployeesByCompetencia(competencia);
    return result.ativos;
  }
  
  /**
   * Calcula folha resumida por competência
   */
  async calcularFolhaResumo(competencia: CompetenciaFilter | string): Promise<{
    competencia: string;
    competenciaFormatada: string;
    funcionarios: Employee[];
    clt: { quantidade: number; valor: number };
    pj: { quantidade: number; valor: number };
    total: { quantidade: number; valor: number };
  }> {
    const comp = typeof competencia === 'string' 
      ? parseCompetencia(competencia) 
      : competencia;
    
    const result = await this.getEmployeesByCompetencia(comp);
    const dates = getCompetenciaDates(comp.ano, comp.mes);
    
    return {
      competencia: dates.competencia,
      competenciaFormatada: formatCompetencia(comp.ano, comp.mes),
      funcionarios: result.ativos,
      clt: {
        quantidade: result.resumo.totalCLT,
        valor: result.resumo.valorCLT
      },
      pj: {
        quantidade: result.resumo.totalPJ,
        valor: result.resumo.valorPJ
      },
      total: {
        quantidade: result.resumo.totalAtivos,
        valor: result.resumo.valorTotal
      }
    };
  }
  
  /**
   * Gera relatório completo de competência
   */
  async gerarRelatorioCompetencia(
    competencia: CompetenciaFilter | string
  ): Promise<string> {
    const comp = typeof competencia === 'string' 
      ? parseCompetencia(competencia) 
      : competencia;
    
    const result = await this.getEmployeesByCompetencia(comp);
    const dates = getCompetenciaDates(comp.ano, comp.mes);
    
    let relatorio = `
═══════════════════════════════════════════════════════════════════════════════
📅 RELATÓRIO DE FOLHA POR COMPETÊNCIA: ${formatCompetencia(comp.ano, comp.mes)}
═══════════════════════════════════════════════════════════════════════════════

📊 RESUMO:
   Total de Funcionários Ativos: ${result.resumo.totalAtivos}
   └─ CLT: ${result.resumo.totalCLT} funcionários - R$ ${result.resumo.valorCLT.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
   └─ PJ/MEI: ${result.resumo.totalPJ} funcionários - R$ ${result.resumo.valorPJ.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
   
   TOTAL DA FOLHA: R$ ${result.resumo.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

───────────────────────────────────────────────────────────────────────────────
✅ FUNCIONÁRIOS ATIVOS NA COMPETÊNCIA (${result.ativos.length}):
───────────────────────────────────────────────────────────────────────────────
`;

    for (const emp of result.ativos) {
      const tipo = emp.contract_type?.toUpperCase() || '-';
      const valor = tipo === 'CLT' 
        ? (emp.official_salary || 0) 
        : (emp.unofficial_salary || 0);
      
      relatorio += `   ${emp.name.padEnd(30)} ${tipo.padEnd(5)} R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}\n`;
    }
    
    if (result.naoAdmitidos.length > 0) {
      relatorio += `
───────────────────────────────────────────────────────────────────────────────
⚠️  NÃO ADMITIDOS ATÉ ${dates.fimMes} (${result.naoAdmitidos.length}):
───────────────────────────────────────────────────────────────────────────────
`;
      for (const emp of result.naoAdmitidos) {
        relatorio += `   ${emp.name.padEnd(30)} Admissão: ${emp.hire_date || 'N/A'}\n`;
      }
    }
    
    if (result.demitidos.length > 0) {
      relatorio += `
───────────────────────────────────────────────────────────────────────────────
❌ DEMITIDOS ANTES DE ${dates.inicioMes} (${result.demitidos.length}):
───────────────────────────────────────────────────────────────────────────────
`;
      for (const emp of result.demitidos) {
        relatorio += `   ${emp.name.padEnd(30)} Demissão: ${emp.termination_date || 'N/A'}\n`;
      }
    }
    
    relatorio += `
═══════════════════════════════════════════════════════════════════════════════
Dr. Cícero - Contador Responsável | Sistema Contta
═══════════════════════════════════════════════════════════════════════════════
`;
    
    return relatorio;
  }
}

// ============================================================================
// EXPORTS PADRÃO
// ============================================================================

export default CompetenciaService;
