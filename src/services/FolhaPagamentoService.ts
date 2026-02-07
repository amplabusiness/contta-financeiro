/**
 * 🧾 FOLHA DE PAGAMENTO SERVICE
 * Dr. Cícero - Contador Responsável
 * 
 * Serviço principal para processamento de folha de pagamento.
 * Gera lançamentos contábeis que SEMPRE fecham (Débitos = Créditos)
 * 
 * ESTRUTURA CONTÁBIL:
 * ==================
 * 
 * LANÇAMENTO DE APROPRIAÇÃO:
 * D - 4.2.1.01 Salários (Despesa) .......... R$ BRUTO
 *   C - 2.1.2.01 Salários a Pagar .......... R$ LÍQUIDO
 *   C - 2.1.2.03 INSS a Recolher ........... R$ INSS
 *   C - 2.1.2.04 IRRF a Recolher ........... R$ IRRF
 *   C - 2.1.2.09 Outros Descontos .......... R$ OUTROS
 * 
 * LANÇAMENTO DE FGTS:
 * D - 4.2.1.03 FGTS (Despesa) .............. R$ FGTS
 *   C - 2.1.2.02 FGTS a Recolher ........... R$ FGTS
 * 
 * REGRA DE OURO:
 * BRUTO = LÍQUIDO + INSS + IRRF + OUTROS_DESCONTOS
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// CONTAS CONTÁBEIS - IDs FIXOS
// ============================================================================

export const CONTAS_FOLHA = {
  // Despesas (Débito)
  SALARIOS_DESPESA: {
    id: '4a11ef52-7ea7-4396-9c9b-ccfd9546a01d',
    code: '4.2.1.01',
    name: 'Salários'
  },
  FGTS_DESPESA: {
    id: '744a236a-2a5c-4e49-8ffe-c11b404e0064',
    code: '4.2.1.03',
    name: 'FGTS'
  },
  
  // Passivo (Crédito)
  SALARIOS_PAGAR: {
    id: 'd5c04379-4919-4859-a84a-fb292a5bb047',
    code: '2.1.2.01',
    name: 'Salários a Pagar'
  },
  FGTS_RECOLHER: {
    id: '82bd81fc-c2fa-4bf3-ab2c-c0b49d03959f',
    code: '2.1.2.02',
    name: 'FGTS a Recolher'
  },
  INSS_RECOLHER: {
    id: 'ebcfcb58-1475-4c9b-97a8-ade8f4c43637',
    code: '2.1.2.03',
    name: 'INSS a Recolher'
  },
  IRRF_RECOLHER: {
    id: 'a1c6aacf-f344-4fb9-a091-851de6998672',
    code: '2.1.2.04',
    name: 'IRRF a Recolher'
  },
  OUTROS_DESCONTOS: {
    id: 'c1316b5e-1b69-4e79-960e-2ad26fb27f62',
    code: '2.1.2.09',
    name: 'Outros Descontos a Recolher'
  }
};

// ============================================================================
// TABELAS DE CÁLCULO 2025
// ============================================================================

const TABELA_INSS_2025 = [
  { limite: 1518.00, aliquota: 0.075 },
  { limite: 2793.88, aliquota: 0.09 },
  { limite: 4190.83, aliquota: 0.12 },
  { limite: 8157.41, aliquota: 0.14 },
];

const TABELA_IRRF_2025 = [
  { limite: 2259.20, aliquota: 0, deducao: 0 },
  { limite: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { limite: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { limite: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { limite: Infinity, aliquota: 0.275, deducao: 896.00 },
];

const DEDUCAO_DEPENDENTE_2025 = 189.59;

// ============================================================================
// INTERFACES
// ============================================================================

export interface FuncionarioFolha {
  id?: string;
  nome: string;
  cargo?: string;
  departamento?: string;
  salarioBase: number;
  dependentes?: number;
  
  // Proventos adicionais
  horasExtras?: number;
  comissoes?: number;
  gratificacoes?: number;
  
  // Descontos além de INSS/IRRF
  valeTransporte?: number;
  valeAlimentacao?: number;
  adiantamento?: number;
  emprestimo?: number;
  outrosDescontos?: number;
}

export interface ResultadoFuncionario {
  nome: string;
  cargo: string;
  departamento: string;
  
  // Proventos
  salarioBase: number;
  horasExtras: number;
  comissoes: number;
  gratificacoes: number;
  totalProventos: number;
  
  // Descontos Legais
  inss: number;
  irrf: number;
  
  // Outros Descontos
  valeTransporte: number;
  valeAlimentacao: number;
  adiantamento: number;
  emprestimo: number;
  outrosDescontos: number;
  totalOutrosDescontos: number;
  
  // Totais
  totalDescontos: number;
  liquido: number;
  
  // FGTS
  fgts: number;
}

export interface ResultadoFolha {
  competencia: string; // YYYYMM
  dataProcessamento: string;
  funcionarios: ResultadoFuncionario[];
  totais: {
    proventos: number;
    inss: number;
    irrf: number;
    outrosDescontos: number;
    liquido: number;
    fgts: number;
    totalDescontos: number;
  };
  lancamentos: {
    apropriacao: LancamentoContabil;
    fgts: LancamentoContabil;
  };
  validacao: {
    balanceado: boolean;
    diferenca: number;
    mensagem: string;
  };
}

export interface LancamentoContabil {
  internalCode: string;
  description: string;
  date: string;
  lines: LinhaContabil[];
}

export interface LinhaContabil {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

export class FolhaPagamentoService {
  private tenantId: string;
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient, tenantId: string) {
    this.supabase = supabase;
    this.tenantId = tenantId;
  }
  
  /**
   * Calcula INSS progressivo (tabela 2025)
   */
  calcularINSS(salarioBruto: number): number {
    let inss = 0;
    let salarioRestante = salarioBruto;
    let faixaAnterior = 0;
    
    for (const faixa of TABELA_INSS_2025) {
      if (salarioRestante <= 0) break;
      
      const baseFaixa = Math.min(salarioRestante, faixa.limite - faixaAnterior);
      inss += baseFaixa * faixa.aliquota;
      salarioRestante -= baseFaixa;
      faixaAnterior = faixa.limite;
    }
    
    return Math.round(inss * 100) / 100;
  }
  
  /**
   * Calcula IRRF (tabela 2025)
   */
  calcularIRRF(salarioBruto: number, inss: number, dependentes: number = 0): number {
    // Base de cálculo = Salário - INSS - (Dependentes × Dedução)
    const baseCalculo = salarioBruto - inss - (dependentes * DEDUCAO_DEPENDENTE_2025);
    
    if (baseCalculo <= 0) return 0;
    
    for (const faixa of TABELA_IRRF_2025) {
      if (baseCalculo <= faixa.limite) {
        const irrf = (baseCalculo * faixa.aliquota) - faixa.deducao;
        return Math.max(0, Math.round(irrf * 100) / 100);
      }
    }
    
    return 0;
  }
  
  /**
   * Calcula FGTS (8%)
   */
  calcularFGTS(salarioBruto: number): number {
    return Math.round(salarioBruto * 0.08 * 100) / 100;
  }
  
  /**
   * Processa um funcionário individual
   */
  processarFuncionario(func: FuncionarioFolha): ResultadoFuncionario {
    // Proventos
    const salarioBase = func.salarioBase || 0;
    const horasExtras = func.horasExtras || 0;
    const comissoes = func.comissoes || 0;
    const gratificacoes = func.gratificacoes || 0;
    const totalProventos = salarioBase + horasExtras + comissoes + gratificacoes;
    
    // Cálculos legais
    const inss = this.calcularINSS(totalProventos);
    const irrf = this.calcularIRRF(totalProventos, inss, func.dependentes || 0);
    const fgts = this.calcularFGTS(totalProventos);
    
    // Outros descontos
    const valeTransporte = func.valeTransporte || 0;
    const valeAlimentacao = func.valeAlimentacao || 0;
    const adiantamento = func.adiantamento || 0;
    const emprestimo = func.emprestimo || 0;
    const outrosDescontos = func.outrosDescontos || 0;
    const totalOutrosDescontos = valeTransporte + valeAlimentacao + adiantamento + emprestimo + outrosDescontos;
    
    // Totais
    const totalDescontos = inss + irrf + totalOutrosDescontos;
    const liquido = totalProventos - totalDescontos;
    
    return {
      nome: func.nome,
      cargo: func.cargo || '',
      departamento: func.departamento || '',
      salarioBase,
      horasExtras,
      comissoes,
      gratificacoes,
      totalProventos,
      inss,
      irrf,
      valeTransporte,
      valeAlimentacao,
      adiantamento,
      emprestimo,
      outrosDescontos,
      totalOutrosDescontos,
      totalDescontos,
      liquido,
      fgts
    };
  }
  
  /**
   * Processa a folha completa
   */
  processarFolha(competencia: string, funcionarios: FuncionarioFolha[]): ResultadoFolha {
    const ano = competencia.substring(0, 4);
    const mes = competencia.substring(4, 6);
    const dataCompetencia = `${ano}-${mes}-28`; // Último dia útil
    
    // Processar cada funcionário
    const resultados = funcionarios.map(f => this.processarFuncionario(f));
    
    // Calcular totais
    const totais = {
      proventos: resultados.reduce((s, r) => s + r.totalProventos, 0),
      inss: resultados.reduce((s, r) => s + r.inss, 0),
      irrf: resultados.reduce((s, r) => s + r.irrf, 0),
      outrosDescontos: resultados.reduce((s, r) => s + r.totalOutrosDescontos, 0),
      liquido: resultados.reduce((s, r) => s + r.liquido, 0),
      fgts: resultados.reduce((s, r) => s + r.fgts, 0),
      totalDescontos: 0
    };
    totais.totalDescontos = totais.inss + totais.irrf + totais.outrosDescontos;
    
    // Validar balanceamento
    const somaCreditos = totais.liquido + totais.inss + totais.irrf + totais.outrosDescontos;
    const diferenca = Math.abs(totais.proventos - somaCreditos);
    const balanceado = diferenca < 0.01;
    
    // Gerar lançamentos contábeis
    const lancamentoApropriacao: LancamentoContabil = {
      internalCode: `FOLHA_${competencia}_APROPRIACAO`,
      description: `Folha de Pagamento ${mes}/${ano} - Apropriação`,
      date: dataCompetencia,
      lines: [
        // Débito - Despesa com Salários
        {
          accountId: CONTAS_FOLHA.SALARIOS_DESPESA.id,
          accountCode: CONTAS_FOLHA.SALARIOS_DESPESA.code,
          accountName: CONTAS_FOLHA.SALARIOS_DESPESA.name,
          debit: totais.proventos,
          credit: 0,
          description: `Salários brutos ${mes}/${ano}`
        },
        // Crédito - Salários a Pagar (Líquido)
        {
          accountId: CONTAS_FOLHA.SALARIOS_PAGAR.id,
          accountCode: CONTAS_FOLHA.SALARIOS_PAGAR.code,
          accountName: CONTAS_FOLHA.SALARIOS_PAGAR.name,
          debit: 0,
          credit: totais.liquido,
          description: `Salários líquidos ${mes}/${ano}`
        },
        // Crédito - INSS a Recolher
        {
          accountId: CONTAS_FOLHA.INSS_RECOLHER.id,
          accountCode: CONTAS_FOLHA.INSS_RECOLHER.code,
          accountName: CONTAS_FOLHA.INSS_RECOLHER.name,
          debit: 0,
          credit: totais.inss,
          description: `INSS descontado ${mes}/${ano}`
        },
        // Crédito - IRRF a Recolher
        {
          accountId: CONTAS_FOLHA.IRRF_RECOLHER.id,
          accountCode: CONTAS_FOLHA.IRRF_RECOLHER.code,
          accountName: CONTAS_FOLHA.IRRF_RECOLHER.name,
          debit: 0,
          credit: totais.irrf,
          description: `IRRF descontado ${mes}/${ano}`
        },
        // Crédito - Outros Descontos
        {
          accountId: CONTAS_FOLHA.OUTROS_DESCONTOS.id,
          accountCode: CONTAS_FOLHA.OUTROS_DESCONTOS.code,
          accountName: CONTAS_FOLHA.OUTROS_DESCONTOS.name,
          debit: 0,
          credit: totais.outrosDescontos,
          description: `VT, VA, consignados ${mes}/${ano}`
        }
      ].filter(l => l.debit > 0 || l.credit > 0) // Remove linhas zeradas
    };
    
    const lancamentoFgts: LancamentoContabil = {
      internalCode: `FOLHA_${competencia}_FGTS`,
      description: `FGTS ${mes}/${ano}`,
      date: dataCompetencia,
      lines: [
        {
          accountId: CONTAS_FOLHA.FGTS_DESPESA.id,
          accountCode: CONTAS_FOLHA.FGTS_DESPESA.code,
          accountName: CONTAS_FOLHA.FGTS_DESPESA.name,
          debit: totais.fgts,
          credit: 0,
          description: `FGTS 8% ${mes}/${ano}`
        },
        {
          accountId: CONTAS_FOLHA.FGTS_RECOLHER.id,
          accountCode: CONTAS_FOLHA.FGTS_RECOLHER.code,
          accountName: CONTAS_FOLHA.FGTS_RECOLHER.name,
          debit: 0,
          credit: totais.fgts,
          description: `FGTS a recolher ${mes}/${ano}`
        }
      ]
    };
    
    return {
      competencia,
      dataProcessamento: new Date().toISOString(),
      funcionarios: resultados,
      totais,
      lancamentos: {
        apropriacao: lancamentoApropriacao,
        fgts: lancamentoFgts
      },
      validacao: {
        balanceado,
        diferenca,
        mensagem: balanceado 
          ? `✅ Lançamento balanceado: D ${totais.proventos.toFixed(2)} = C ${somaCreditos.toFixed(2)}`
          : `❌ ERRO: Diferença de R$ ${diferenca.toFixed(2)}`
      }
    };
  }
  
  /**
   * Salva os lançamentos no banco de dados
   */
  async salvarLancamentos(resultado: ResultadoFolha): Promise<{
    success: boolean;
    error?: string;
    entryIds?: string[];
  }> {
    // Validar primeiro
    if (!resultado.validacao.balanceado) {
      return {
        success: false,
        error: `Folha não balanceada: ${resultado.validacao.mensagem}`
      };
    }
    
    const entryIds: string[] = [];
    
    try {
      // Salvar lançamento de apropriação
      const aproResult = await this.salvarLancamento(resultado.lancamentos.apropriacao);
      if (!aproResult.success) {
        return aproResult;
      }
      entryIds.push(aproResult.entryId!);
      
      // Salvar lançamento de FGTS
      const fgtsResult = await this.salvarLancamento(resultado.lancamentos.fgts);
      if (!fgtsResult.success) {
        // Reverter apropriação se FGTS falhar
        await this.supabase.from('accounting_entry_items').delete().eq('entry_id', aproResult.entryId);
        await this.supabase.from('accounting_entries').delete().eq('id', aproResult.entryId);
        return fgtsResult;
      }
      entryIds.push(fgtsResult.entryId!);
      
      return { success: true, entryIds };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao salvar lançamentos'
      };
    }
  }
  
  /**
   * Salva um lançamento individual
   */
  private async salvarLancamento(lancamento: LancamentoContabil): Promise<{
    success: boolean;
    error?: string;
    entryId?: string;
  }> {
    // Verificar se já existe
    const { data: existing } = await this.supabase
      .from('accounting_entries')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('internal_code', lancamento.internalCode)
      .single();
    
    if (existing) {
      return {
        success: false,
        error: `Lançamento ${lancamento.internalCode} já existe`
      };
    }
    
    // Criar cabeçalho
    const { data: entry, error: entryError } = await this.supabase
      .from('accounting_entries')
      .insert({
        tenant_id: this.tenantId,
        entry_date: lancamento.date,
        description: lancamento.description,
        internal_code: lancamento.internalCode,
        source_type: 'payroll',
        entry_type: 'APROPRIACAO'
      })
      .select()
      .single();
    
    if (entryError || !entry) {
      return {
        success: false,
        error: `Erro ao criar lançamento: ${entryError?.message}`
      };
    }
    
    // Criar linhas (accounting_entry_items não tem coluna description)
    const linhas = lancamento.lines.map(l => ({
      tenant_id: this.tenantId,
      entry_id: entry.id,
      account_id: l.accountId,
      debit: l.debit,
      credit: l.credit
    }));

    const { error: linhasError } = await this.supabase
      .from('accounting_entry_items')
      .insert(linhas);
    
    if (linhasError) {
      // Reverter
      await this.supabase.from('accounting_entries').delete().eq('id', entry.id);
      return {
        success: false,
        error: `Erro ao criar linhas: ${linhasError.message}`
      };
    }
    
    return { success: true, entryId: entry.id };
  }
  
  /**
   * Busca folha existente por competência
   */
  async buscarFolha(competencia: string): Promise<LancamentoContabil | null> {
    const { data: entry } = await this.supabase
      .from('accounting_entries')
      .select(`
        id, internal_code, description, entry_date,
        accounting_entry_items (
          debit, credit,
          chart_of_accounts:account_id (id, code, name)
        )
      `)
      .eq('tenant_id', this.tenantId)
      .eq('internal_code', `FOLHA_${competencia}_APROPRIACAO`)
      .single();

    if (!entry) return null;

    return {
      internalCode: entry.internal_code,
      description: entry.description,
      date: entry.entry_date,
      lines: entry.accounting_entry_items.map((l: any) => ({
        accountId: l.chart_of_accounts.id,
        accountCode: l.chart_of_accounts.code,
        accountName: l.chart_of_accounts.name,
        debit: l.debit,
        credit: l.credit,
        description: l.description
      }))
    };
  }
}

// ============================================================================
// EXPORTAR INSTÂNCIA DEFAULT
// ============================================================================

export function createFolhaPagamentoService(supabase: SupabaseClient, tenantId: string) {
  return new FolhaPagamentoService(supabase, tenantId);
}
