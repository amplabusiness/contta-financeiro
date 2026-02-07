/**
 * 🧾 PAYROLL SERVICE - Sistema Completo de Folha de Pagamento
 * Dr. Cícero - Contador Responsável
 * 
 * Este serviço processa a folha de pagamento completa:
 * - Cálculo de INSS progressivo (tabela 2025)
 * - Cálculo de IRRF com dependentes
 * - Processamento de todos os proventos e descontos
 * - Geração automática de lançamentos contábeis
 * 
 * REGRA DE OURO: A folha SEMPRE fecha (Débitos = Créditos)
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  official_salary: number;
  hire_date: string | null;
  is_active: boolean;
  dependents?: number;
  vale_transporte_percent?: number; // 6% padrão
  vale_alimentacao?: number;
}

export interface PayrollVariable {
  type: 'PROVENTO' | 'DESCONTO';
  code: string;
  description: string;
  value: number;
  reference?: string; // Ex: "10" para 10 horas extras
}

export interface PayrollEmployeeInput {
  employeeId: string;
  salarioBase: number;
  dependentes?: number;
  variables?: PayrollVariable[];
  // Benefícios/Descontos padrão
  valeTransporte?: number;
  valeAlimentacao?: number;
  adiantamento?: number;
  emprestimoConsignado?: number;
  outrosDescontos?: number;
}

export interface PayrollEmployeeResult {
  employeeId: string;
  employeeName: string;
  department: string;
  
  // Proventos
  salarioBase: number;
  horasExtras: number;
  dsr: number;
  outrosProventos: number;
  totalProventos: number;
  
  // Descontos Legais
  inss: number;
  irrf: number;
  
  // Outros Descontos
  valeTransporte: number;
  valeAlimentacao: number;
  adiantamento: number;
  emprestimoConsignado: number;
  outrosDescontos: number;
  totalOutrosDescontos: number;
  
  // Totais
  totalDescontos: number;
  liquido: number;
  
  // Encargos Patronais
  fgts: number;
  inssPatronal: number;
  
  // Detalhamento
  variables: PayrollVariable[];
  baseCalculoINSS: number;
  baseCalculoIRRF: number;
  baseCalculoFGTS: number;
}

export interface PayrollResult {
  competencia: string; // YYYY-MM
  processadoEm: string;
  funcionarios: PayrollEmployeeResult[];
  totais: {
    totalProventos: number;
    totalINSS: number;
    totalIRRF: number;
    totalOutrosDescontos: number;
    totalDescontos: number;
    totalLiquido: number;
    totalFGTS: number;
    totalINSSPatronal: number;
  };
  lancamentosContabeis: AccountingEntry[];
}

export interface AccountingEntry {
  internalCode: string;
  description: string;
  date: string;
  lines: AccountingLine[];
}

export interface AccountingLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

// ============================================================================
// TABELAS DE CÁLCULO 2025
// ============================================================================

/**
 * Tabela INSS 2025 - Alíquotas Progressivas
 * Vigente a partir de 01/01/2025
 */
const TABELA_INSS_2025 = [
  { limite: 1518.00, aliquota: 0.075 },   // 7,5%
  { limite: 2793.88, aliquota: 0.09 },    // 9%
  { limite: 4190.83, aliquota: 0.12 },    // 12%
  { limite: 8157.41, aliquota: 0.14 },    // 14%
];

const TETO_INSS_2025 = 8157.41;

/**
 * Tabela IRRF 2025 - Mensal
 * Vigente a partir de 01/02/2024 (sem alteração em 2025)
 */
const TABELA_IRRF_2025 = [
  { limite: 2259.20, aliquota: 0, deducao: 0 },           // Isento
  { limite: 2826.65, aliquota: 0.075, deducao: 169.44 },  // 7,5%
  { limite: 3751.05, aliquota: 0.15, deducao: 381.44 },   // 15%
  { limite: 4664.68, aliquota: 0.225, deducao: 662.77 },  // 22,5%
  { limite: Infinity, aliquota: 0.275, deducao: 896.00 }, // 27,5%
];

const DEDUCAO_DEPENDENTE_IRRF = 189.59;
const DESCONTO_SIMPLIFICADO_IRRF = 564.80;

// ============================================================================
// CONTAS CONTÁBEIS (IDs fixos do tenant Ampla)
// ============================================================================

const CONTAS = {
  // Despesas (Débito)
  SALARIOS: { code: '4.2.1.01', id: '4a11ef52-7ea7-4396-9c9b-ccfd9546a01d', name: 'Salários' },
  FGTS: { code: '4.2.1.03', id: '744a236a-2a5c-4e49-8ffe-c11b404e0064', name: 'FGTS' },
  
  // Passivos (Crédito)
  SALARIOS_PAGAR: { code: '2.1.2.01', id: 'd5c04379-4919-4859-a84a-fb292a5bb047', name: 'Salários a Pagar' },
  FGTS_RECOLHER: { code: '2.1.2.02', id: '82bd81fc-c2fa-4bf3-ab2c-c0b49d03959f', name: 'FGTS a Recolher' },
  INSS_RECOLHER: { code: '2.1.2.03', id: 'ebcfcb58-1475-4c9b-97a8-ade8f4c43637', name: 'INSS a Recolher' },
  IRRF_RECOLHER: { code: '2.1.2.04', id: 'a1c6aacf-f344-4fb9-a091-851de6998672', name: 'IRRF a Recolher' },
  OUTROS_DESCONTOS: { code: '2.1.2.09', id: 'c1316b5e-1b69-4e79-960e-2ad26fb27f62', name: 'Outros Descontos a Recolher' },
};

// ============================================================================
// FUNÇÕES DE CÁLCULO
// ============================================================================

/**
 * Calcula INSS usando alíquotas progressivas
 * Método: Por faixas (não é alíquota única sobre o total)
 */
export function calcularINSS(salarioBruto: number): { valor: number; aliquotaEfetiva: number } {
  if (salarioBruto <= 0) return { valor: 0, aliquotaEfetiva: 0 };
  
  const base = Math.min(salarioBruto, TETO_INSS_2025);
  let inss = 0;
  let faixaAnterior = 0;
  
  for (const faixa of TABELA_INSS_2025) {
    if (base <= faixaAnterior) break;
    
    const valorFaixa = Math.min(base, faixa.limite) - faixaAnterior;
    if (valorFaixa > 0) {
      inss += valorFaixa * faixa.aliquota;
    }
    faixaAnterior = faixa.limite;
  }
  
  return {
    valor: Math.round(inss * 100) / 100,
    aliquotaEfetiva: salarioBruto > 0 ? (inss / salarioBruto) * 100 : 0
  };
}

/**
 * Calcula IRRF
 * Base = Salário Bruto - INSS - Dedução por Dependentes
 * Compara com desconto simplificado e usa o mais vantajoso
 */
export function calcularIRRF(
  salarioBruto: number, 
  inss: number, 
  dependentes: number = 0
): { valor: number; baseCalculo: number; aliquota: number } {
  // Base de cálculo
  const deducaoDependentes = dependentes * DEDUCAO_DEPENDENTE_IRRF;
  const baseTradicional = salarioBruto - inss - deducaoDependentes;
  
  // Desconto simplificado (R$ 564,80 ou 25% do salário, o que for menor)
  const descontoSimplificado = Math.min(DESCONTO_SIMPLIFICADO_IRRF, salarioBruto * 0.25);
  const baseSimplificada = salarioBruto - inss - descontoSimplificado;
  
  // Usar a base mais vantajosa (menor)
  const baseCalculo = Math.max(0, Math.min(baseTradicional, baseSimplificada));
  
  // Encontrar faixa
  let irrf = 0;
  let aliquota = 0;
  
  for (const faixa of TABELA_IRRF_2025) {
    if (baseCalculo <= faixa.limite) {
      irrf = baseCalculo * faixa.aliquota - faixa.deducao;
      aliquota = faixa.aliquota * 100;
      break;
    }
  }
  
  return {
    valor: Math.max(0, Math.round(irrf * 100) / 100),
    baseCalculo,
    aliquota
  };
}

/**
 * Calcula FGTS (8% sobre remuneração)
 */
export function calcularFGTS(baseCalculo: number): number {
  return Math.round(baseCalculo * 0.08 * 100) / 100;
}

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export class PayrollService {
  private supabase: SupabaseClient;
  private tenantId: string;

  constructor(supabase: SupabaseClient, tenantId: string) {
    this.supabase = supabase;
    this.tenantId = tenantId;
  }

  /**
   * Processa a folha completa de um mês
   */
  async processarFolha(
    competencia: string, // YYYY-MM
    funcionariosInput: PayrollEmployeeInput[]
  ): Promise<PayrollResult> {
    const dataFolha = `${competencia}-01`;
    
    // Buscar dados dos funcionários
    const employeeIds = funcionariosInput.map(f => f.employeeId);
    const { data: employees } = await this.supabase
      .from('employees')
      .select('id, name, department, official_salary')
      .in('id', employeeIds);
    
    const employeesMap = new Map(employees?.map(e => [e.id, e]) || []);
    
    // Processar cada funcionário
    const funcionariosProcessados: PayrollEmployeeResult[] = [];
    
    for (const input of funcionariosInput) {
      const employee = employeesMap.get(input.employeeId);
      if (!employee) continue;
      
      const resultado = this.processarFuncionario(input, employee);
      funcionariosProcessados.push(resultado);
    }
    
    // Calcular totais
    const totais = this.calcularTotais(funcionariosProcessados);
    
    // Gerar lançamentos contábeis
    const lancamentos = this.gerarLancamentosContabeis(
      competencia,
      dataFolha,
      funcionariosProcessados,
      totais
    );
    
    return {
      competencia,
      processadoEm: new Date().toISOString(),
      funcionarios: funcionariosProcessados,
      totais,
      lancamentosContabeis: lancamentos
    };
  }

  /**
   * Processa um funcionário individual
   */
  private processarFuncionario(
    input: PayrollEmployeeInput,
    employee: any
  ): PayrollEmployeeResult {
    // Calcular proventos
    const salarioBase = input.salarioBase || employee.official_salary || 0;
    let horasExtras = 0;
    let dsr = 0;
    let outrosProventos = 0;
    
    // Processar variáveis
    const variables = input.variables || [];
    for (const v of variables) {
      if (v.type === 'PROVENTO') {
        if (v.code === 'HE50' || v.code === 'HE100') {
          horasExtras += v.value;
        } else if (v.code === 'DSR') {
          dsr += v.value;
        } else {
          outrosProventos += v.value;
        }
      }
    }
    
    const totalProventos = salarioBase + horasExtras + dsr + outrosProventos;
    
    // Calcular INSS e IRRF
    const { valor: inss } = calcularINSS(totalProventos);
    const { valor: irrf, baseCalculo: baseIRRF } = calcularIRRF(
      totalProventos, 
      inss, 
      input.dependentes || 0
    );
    
    // Outros descontos
    const valeTransporte = input.valeTransporte || 0;
    const valeAlimentacao = input.valeAlimentacao || 0;
    const adiantamento = input.adiantamento || 0;
    const emprestimoConsignado = input.emprestimoConsignado || 0;
    let outrosDescontos = input.outrosDescontos || 0;
    
    // Adicionar descontos das variáveis
    for (const v of variables) {
      if (v.type === 'DESCONTO' && !['INSS', 'IRRF', 'VT', 'VA', 'ADT', 'CONSIG'].includes(v.code)) {
        outrosDescontos += v.value;
      }
    }
    
    const totalOutrosDescontos = valeTransporte + valeAlimentacao + adiantamento + 
                                  emprestimoConsignado + outrosDescontos;
    
    const totalDescontos = inss + irrf + totalOutrosDescontos;
    const liquido = totalProventos - totalDescontos;
    
    // Encargos patronais
    const fgts = calcularFGTS(totalProventos);
    const inssPatronal = Math.round(totalProventos * 0.20 * 100) / 100; // 20% (estimativa)
    
    return {
      employeeId: input.employeeId,
      employeeName: employee.name,
      department: employee.department || 'Geral',
      
      salarioBase,
      horasExtras,
      dsr,
      outrosProventos,
      totalProventos,
      
      inss,
      irrf,
      
      valeTransporte,
      valeAlimentacao,
      adiantamento,
      emprestimoConsignado,
      outrosDescontos,
      totalOutrosDescontos,
      
      totalDescontos,
      liquido,
      
      fgts,
      inssPatronal,
      
      variables,
      baseCalculoINSS: Math.min(totalProventos, TETO_INSS_2025),
      baseCalculoIRRF: baseIRRF,
      baseCalculoFGTS: totalProventos,
    };
  }

  /**
   * Calcula totais da folha
   */
  private calcularTotais(funcionarios: PayrollEmployeeResult[]) {
    return funcionarios.reduce((acc, f) => ({
      totalProventos: acc.totalProventos + f.totalProventos,
      totalINSS: acc.totalINSS + f.inss,
      totalIRRF: acc.totalIRRF + f.irrf,
      totalOutrosDescontos: acc.totalOutrosDescontos + f.totalOutrosDescontos,
      totalDescontos: acc.totalDescontos + f.totalDescontos,
      totalLiquido: acc.totalLiquido + f.liquido,
      totalFGTS: acc.totalFGTS + f.fgts,
      totalINSSPatronal: acc.totalINSSPatronal + f.inssPatronal,
    }), {
      totalProventos: 0,
      totalINSS: 0,
      totalIRRF: 0,
      totalOutrosDescontos: 0,
      totalDescontos: 0,
      totalLiquido: 0,
      totalFGTS: 0,
      totalINSSPatronal: 0,
    });
  }

  /**
   * Gera os lançamentos contábeis da folha
   * 
   * REGRA: Débitos = Créditos (SEMPRE)
   * 
   * Lançamento 1 - APROPRIAÇÃO:
   *   D - 4.2.1.01 Salários (Bruto)
   *   C - 2.1.2.01 Salários a Pagar (Líquido)
   *   C - 2.1.2.03 INSS a Recolher
   *   C - 2.1.2.04 IRRF a Recolher
   *   C - 2.1.2.09 Outros Descontos a Recolher
   * 
   * Lançamento 2 - FGTS:
   *   D - 4.2.1.03 FGTS (Despesa)
   *   C - 2.1.2.02 FGTS a Recolher
   */
  private gerarLancamentosContabeis(
    competencia: string,
    dataFolha: string,
    funcionarios: PayrollEmployeeResult[],
    totais: ReturnType<typeof this.calcularTotais>
  ): AccountingEntry[] {
    const [ano, mes] = competencia.split('-');
    const mesNome = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                     'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(mes)];
    
    const lancamentos: AccountingEntry[] = [];
    
    // ========================================
    // LANÇAMENTO 1: APROPRIAÇÃO DA FOLHA
    // ========================================
    const apropriacaoLines: AccountingLine[] = [];
    
    // DÉBITO: Despesa com Salários (Bruto)
    apropriacaoLines.push({
      accountCode: CONTAS.SALARIOS.code,
      accountId: CONTAS.SALARIOS.id,
      accountName: CONTAS.SALARIOS.name,
      debit: totais.totalProventos,
      credit: 0,
      description: `Salários brutos ${mesNome}/${ano} - ${funcionarios.length} funcionários`
    });
    
    // CRÉDITO: Salários a Pagar (Líquido)
    apropriacaoLines.push({
      accountCode: CONTAS.SALARIOS_PAGAR.code,
      accountId: CONTAS.SALARIOS_PAGAR.id,
      accountName: CONTAS.SALARIOS_PAGAR.name,
      debit: 0,
      credit: totais.totalLiquido,
      description: `Salários líquidos a pagar ${mesNome}/${ano}`
    });
    
    // CRÉDITO: INSS a Recolher
    if (totais.totalINSS > 0) {
      apropriacaoLines.push({
        accountCode: CONTAS.INSS_RECOLHER.code,
        accountId: CONTAS.INSS_RECOLHER.id,
        accountName: CONTAS.INSS_RECOLHER.name,
        debit: 0,
        credit: totais.totalINSS,
        description: `INSS descontado ${mesNome}/${ano}`
      });
    }
    
    // CRÉDITO: IRRF a Recolher
    if (totais.totalIRRF > 0) {
      apropriacaoLines.push({
        accountCode: CONTAS.IRRF_RECOLHER.code,
        accountId: CONTAS.IRRF_RECOLHER.id,
        accountName: CONTAS.IRRF_RECOLHER.name,
        debit: 0,
        credit: totais.totalIRRF,
        description: `IRRF descontado ${mesNome}/${ano}`
      });
    }
    
    // CRÉDITO: Outros Descontos a Recolher
    if (totais.totalOutrosDescontos > 0) {
      apropriacaoLines.push({
        accountCode: CONTAS.OUTROS_DESCONTOS.code,
        accountId: CONTAS.OUTROS_DESCONTOS.id,
        accountName: CONTAS.OUTROS_DESCONTOS.name,
        debit: 0,
        credit: totais.totalOutrosDescontos,
        description: `VT, VA, consignados e outros ${mesNome}/${ano}`
      });
    }
    
    // Validar balanceamento
    const totalDebito = apropriacaoLines.reduce((s, l) => s + l.debit, 0);
    const totalCredito = apropriacaoLines.reduce((s, l) => s + l.credit, 0);
    
    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      throw new Error(`ERRO CONTÁBIL: Apropriação não balanceada! D=${totalDebito} C=${totalCredito}`);
    }
    
    lancamentos.push({
      internalCode: `FOLHA_${ano}${mes}_APROPRIACAO`,
      description: `Apropriação Folha de Pagamento - Competência ${mesNome}/${ano}`,
      date: dataFolha,
      lines: apropriacaoLines
    });
    
    // ========================================
    // LANÇAMENTO 2: PROVISÃO FGTS
    // ========================================
    if (totais.totalFGTS > 0) {
      lancamentos.push({
        internalCode: `FOLHA_${ano}${mes}_FGTS`,
        description: `Provisão FGTS 8% - Competência ${mesNome}/${ano}`,
        date: dataFolha,
        lines: [
          {
            accountCode: CONTAS.FGTS.code,
            accountId: CONTAS.FGTS.id,
            accountName: CONTAS.FGTS.name,
            debit: totais.totalFGTS,
            credit: 0,
            description: `FGTS ${mesNome}/${ano}`
          },
          {
            accountCode: CONTAS.FGTS_RECOLHER.code,
            accountId: CONTAS.FGTS_RECOLHER.id,
            accountName: CONTAS.FGTS_RECOLHER.name,
            debit: 0,
            credit: totais.totalFGTS,
            description: `FGTS a recolher ${mesNome}/${ano}`
          }
        ]
      });
    }
    
    return lancamentos;
  }

  /**
   * Grava os lançamentos contábeis no banco
   */
  async gravarLancamentosContabeis(lancamentos: AccountingEntry[]): Promise<{
    success: boolean;
    entryIds: string[];
    errors: string[];
  }> {
    const entryIds: string[] = [];
    const errors: string[] = [];
    
    for (const lanc of lancamentos) {
      try {
        // Verificar se já existe
        const { data: existente } = await this.supabase
          .from('accounting_entries')
          .select('id')
          .eq('tenant_id', this.tenantId)
          .eq('internal_code', lanc.internalCode)
          .single();
        
        if (existente) {
          errors.push(`Lançamento ${lanc.internalCode} já existe`);
          continue;
        }
        
        // Criar entrada
        const { data: entry, error: entryError } = await this.supabase
          .from('accounting_entries')
          .insert({
            tenant_id: this.tenantId,
            entry_date: lanc.date,
            description: lanc.description,
            internal_code: lanc.internalCode,
            source_type: 'payroll',
            entry_type: 'MOVIMENTO'
          })
          .select()
          .single();
        
        if (entryError || !entry) {
          errors.push(`Erro ao criar ${lanc.internalCode}: ${entryError?.message}`);
          continue;
        }
        
        // Criar linhas (accounting_entry_items não tem coluna description)
        const lines = lanc.lines.map(l => ({
          tenant_id: this.tenantId,
          entry_id: entry.id,
          account_id: l.accountId,
          debit: l.debit,
          credit: l.credit
        }));

        const { error: linesError } = await this.supabase
          .from('accounting_entry_items')
          .insert(lines);
        
        if (linesError) {
          // Reverter entrada
          await this.supabase.from('accounting_entries').delete().eq('id', entry.id);
          errors.push(`Erro nas linhas de ${lanc.internalCode}: ${linesError.message}`);
          continue;
        }
        
        entryIds.push(entry.id);
        
      } catch (e: any) {
        errors.push(`Erro em ${lanc.internalCode}: ${e.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      entryIds,
      errors
    };
  }

  /**
   * Grava a folha no módulo payroll
   */
  async gravarFolhaPayroll(resultado: PayrollResult): Promise<{
    success: boolean;
    payrollIds: string[];
    errors: string[];
  }> {
    const payrollIds: string[] = [];
    const errors: string[] = [];
    const competenciaDate = `${resultado.competencia}-01`;
    
    for (const func of resultado.funcionarios) {
      try {
        // Verificar se já existe
        const { data: existente } = await this.supabase
          .from('payroll')
          .select('id')
          .eq('tenant_id', this.tenantId)
          .eq('employee_id', func.employeeId)
          .eq('competencia', competenciaDate)
          .single();
        
        if (existente) {
          // Atualizar
          const { error } = await this.supabase
            .from('payroll')
            .update({
              total_proventos_oficial: func.totalProventos,
              total_descontos_oficial: func.totalDescontos,
              liquido_oficial: func.liquido,
              fgts: func.fgts,
              status: 'processed'
            })
            .eq('id', existente.id);
          
          if (error) {
            errors.push(`Erro ao atualizar ${func.employeeName}: ${error.message}`);
          } else {
            payrollIds.push(existente.id);
          }
        } else {
          // Inserir
          const { data: novo, error } = await this.supabase
            .from('payroll')
            .insert({
              tenant_id: this.tenantId,
              employee_id: func.employeeId,
              competencia: competenciaDate,
              total_proventos_oficial: func.totalProventos,
              total_descontos_oficial: func.totalDescontos,
              liquido_oficial: func.liquido,
              fgts: func.fgts,
              status: 'processed'
            })
            .select()
            .single();
          
          if (error) {
            errors.push(`Erro ao criar ${func.employeeName}: ${error.message}`);
          } else if (novo) {
            payrollIds.push(novo.id);
          }
        }
      } catch (e: any) {
        errors.push(`Erro em ${func.employeeName}: ${e.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      payrollIds,
      errors
    };
  }

  /**
   * Fluxo completo: processa, grava e contabiliza
   */
  async processarEContabilizar(
    competencia: string,
    funcionariosInput: PayrollEmployeeInput[]
  ): Promise<{
    success: boolean;
    resultado: PayrollResult;
    payrollIds: string[];
    entryIds: string[];
    errors: string[];
  }> {
    // 1. Processar folha
    const resultado = await this.processarFolha(competencia, funcionariosInput);
    
    // 2. Gravar no módulo payroll
    const payrollResult = await this.gravarFolhaPayroll(resultado);
    
    // 3. Gravar lançamentos contábeis
    const contabilResult = await this.gravarLancamentosContabeis(resultado.lancamentosContabeis);
    
    return {
      success: payrollResult.success && contabilResult.success,
      resultado,
      payrollIds: payrollResult.payrollIds,
      entryIds: contabilResult.entryIds,
      errors: [...payrollResult.errors, ...contabilResult.errors]
    };
  }
}

export default PayrollService;
