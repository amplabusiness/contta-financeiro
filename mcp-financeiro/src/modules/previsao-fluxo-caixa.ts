/**
 * Módulo de Previsão de Fluxo de Caixa
 *
 * Este módulo calcula e projeta o fluxo de caixa baseado em:
 * - Recebimentos programados
 * - Pagamentos previstos
 * - Histórico de inadimplência
 * - Sazonalidade
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface ReceitaPrevista {
  clienteId: string;
  clienteNome: string;
  valor: number;
  dataVencimento: string;
  probabilidadeRecebimento: number; // 0-100%
  historicoPagamento: "adimplente" | "eventual" | "recorrente";
  diasAtrasoMedio?: number;
}

export interface DespesaPrevista {
  descricao: string;
  valor: number;
  dataVencimento: string;
  categoria: CategoriaDespesa;
  recorrente: boolean;
  obrigatoria: boolean;
}

export type CategoriaDespesa =
  | "folha_pagamento"
  | "impostos"
  | "fornecedores"
  | "aluguel"
  | "servicos"
  | "manutencao"
  | "adiantamento_socios"
  | "outros";

export interface FluxoCaixaDia {
  data: string;
  saldoInicial: number;
  entradasPrevistas: number;
  entradasRealizadas: number;
  saidasPrevistas: number;
  saidasRealizadas: number;
  saldoFinal: number;
  saldoProjetado: number;
  alertas: string[];
}

export interface PrevisaoFluxoCaixa {
  periodo: { inicio: string; fim: string };
  saldoAtual: number;
  dias: FluxoCaixaDia[];
  resumoSemanal: ResumoSemanal[];
  indicadores: IndicadoresFluxo;
  alertas: AlertaFluxo[];
}

export interface ResumoSemanal {
  semana: number;
  inicio: string;
  fim: string;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoProjetado: number;
}

export interface IndicadoresFluxo {
  saldoMinimoProjetado: number;
  dataSaldoMinimo: string;
  diasCoberturaOperacional: number;
  necessidadeCapitalGiro: number;
  mediaReceitasDiarias: number;
  mediaDespesasDiarias: number;
  tendencia: "crescente" | "estavel" | "decrescente";
}

export interface AlertaFluxo {
  tipo: "critico" | "atencao" | "info";
  mensagem: string;
  data: string;
  valor?: number;
  acao?: string;
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Formata valor para exibição (uso interno)
 */
function formatarMoedaInterno(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

// ============================================
// CONFIGURAÇÕES DE PREVISÃO
// ============================================

export const configPrevisao = {
  // Dias padrão para projeção
  diasProjecao: 30,

  // Probabilidade de recebimento por perfil
  probabilidadePorPerfil: {
    adimplente: 0.95,    // 95% de chance
    eventual: 0.70,      // 70% de chance
    recorrente: 0.50     // 50% de chance (atrasa mas paga)
  },

  // Ajuste por dias de atraso histórico
  ajustePorAtraso: {
    0: 1.0,      // Sem atraso = 100%
    7: 0.95,     // 1 semana = 95%
    15: 0.85,    // 2 semanas = 85%
    30: 0.70,    // 1 mês = 70%
    60: 0.50,    // 2 meses = 50%
    90: 0.30     // 3 meses = 30%
  },

  // Sazonalidade mensal (fator multiplicador)
  sazonalidade: {
    1: 0.85,   // Janeiro - menor (férias)
    2: 0.90,   // Fevereiro - carnaval
    3: 1.0,    // Março - normal
    4: 1.0,    // Abril - normal
    5: 1.05,   // Maio - acima (declarações)
    6: 1.0,    // Junho - normal
    7: 0.95,   // Julho - férias
    8: 1.0,    // Agosto - normal
    9: 1.05,   // Setembro - acima
    10: 1.0,   // Outubro - normal
    11: 1.05,  // Novembro - acima
    12: 1.15   // Dezembro - máximo (13º)
  },

  // Limites de alerta
  alertas: {
    saldoMinimoOperacional: 10000,  // R$ 10.000
    diasCoberturaCritico: 7,
    diasCoberturaAtencao: 15
  }
};

// ============================================
// DESPESAS FIXAS MENSAIS TÍPICAS
// ============================================

export const despesasFixasTipicas = {
  ampla: [
    { descricao: "Folha de Pagamento", categoria: "folha_pagamento", diaVencimento: 5, valorBase: 35000, obrigatoria: true },
    { descricao: "Pró-labore Sócios", categoria: "folha_pagamento", diaVencimento: 5, valorBase: 12000, obrigatoria: true },
    { descricao: "Aluguel Sede", categoria: "aluguel", diaVencimento: 10, valorBase: 3500, obrigatoria: true },
    { descricao: "Energia Elétrica", categoria: "servicos", diaVencimento: 15, valorBase: 800, obrigatoria: true },
    { descricao: "Internet/Telefone", categoria: "servicos", diaVencimento: 20, valorBase: 350, obrigatoria: true },
    { descricao: "Sistema Contábil", categoria: "servicos", diaVencimento: 5, valorBase: 2500, obrigatoria: true },
    { descricao: "DAS Simples Nacional", categoria: "impostos", diaVencimento: 20, valorBase: 1500, obrigatoria: true },
    { descricao: "ISS Fixo", categoria: "impostos", diaVencimento: 10, valorBase: 70, obrigatoria: true },
    { descricao: "CRC Anuidade", categoria: "servicos", diaVencimento: 31, valorBase: 800, obrigatoria: false },
    { descricao: "Manutenção/Limpeza", categoria: "manutencao", diaVencimento: 25, valorBase: 600, obrigatoria: true }
  ]
};

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula a probabilidade de recebimento de uma fatura
 */
export function calcularProbabilidadeRecebimento(
  perfil: "adimplente" | "eventual" | "recorrente",
  diasAtrasoMedio: number = 0
): number {
  let probabilidade = configPrevisao.probabilidadePorPerfil[perfil];

  // Ajusta pela média de atraso histórico
  const faixasAtraso = Object.entries(configPrevisao.ajustePorAtraso)
    .map(([dias, fator]) => ({ dias: parseInt(dias), fator }))
    .sort((a, b) => b.dias - a.dias);

  for (const faixa of faixasAtraso) {
    if (diasAtrasoMedio >= faixa.dias) {
      probabilidade *= faixa.fator;
      break;
    }
  }

  return Math.min(Math.max(probabilidade, 0), 1);
}

/**
 * Aplica sazonalidade ao valor
 */
export function aplicarSazonalidade(valor: number, mes: number): number {
  const fator = configPrevisao.sazonalidade[mes as keyof typeof configPrevisao.sazonalidade] || 1.0;
  return valor * fator;
}

/**
 * Projeta recebimentos para um período
 */
export function projetarRecebimentos(
  receitas: ReceitaPrevista[],
  dataInicio: Date,
  dataFim: Date
): Map<string, number> {
  const projecao = new Map<string, number>();

  for (const receita of receitas) {
    const dataVenc = new Date(receita.dataVencimento);

    if (dataVenc >= dataInicio && dataVenc <= dataFim) {
      const chaveData = receita.dataVencimento;
      const valorPonderado = receita.valor * receita.probabilidadeRecebimento;

      const valorAtual = projecao.get(chaveData) || 0;
      projecao.set(chaveData, valorAtual + valorPonderado);
    }
  }

  return projecao;
}

/**
 * Projeta despesas para um período
 */
export function projetarDespesas(
  despesas: DespesaPrevista[],
  dataInicio: Date,
  dataFim: Date
): Map<string, number> {
  const projecao = new Map<string, number>();

  for (const despesa of despesas) {
    const dataVenc = new Date(despesa.dataVencimento);

    if (dataVenc >= dataInicio && dataVenc <= dataFim) {
      const chaveData = despesa.dataVencimento;
      const valorAtual = projecao.get(chaveData) || 0;
      projecao.set(chaveData, valorAtual + despesa.valor);
    }
  }

  return projecao;
}

/**
 * Gera despesas fixas para um mês
 */
export function gerarDespesasFixasMes(ano: number, mes: number): DespesaPrevista[] {
  const despesas: DespesaPrevista[] = [];
  const ultimoDia = new Date(ano, mes, 0).getDate();

  for (const despesaBase of despesasFixasTipicas.ampla) {
    const diaVenc = Math.min(despesaBase.diaVencimento, ultimoDia);
    const dataVencimento = new Date(ano, mes - 1, diaVenc);

    despesas.push({
      descricao: despesaBase.descricao,
      valor: despesaBase.valorBase,
      dataVencimento: dataVencimento.toISOString().split("T")[0],
      categoria: despesaBase.categoria as CategoriaDespesa,
      recorrente: true,
      obrigatoria: despesaBase.obrigatoria
    });
  }

  return despesas;
}

/**
 * Calcula indicadores de fluxo de caixa
 */
export function calcularIndicadores(dias: FluxoCaixaDia[]): IndicadoresFluxo {
  if (dias.length === 0) {
    return {
      saldoMinimoProjetado: 0,
      dataSaldoMinimo: "",
      diasCoberturaOperacional: 0,
      necessidadeCapitalGiro: 0,
      mediaReceitasDiarias: 0,
      mediaDespesasDiarias: 0,
      tendencia: "estavel"
    };
  }

  // Encontra saldo mínimo
  let saldoMinimo = dias[0].saldoProjetado;
  let dataSaldoMinimo = dias[0].data;

  for (const dia of dias) {
    if (dia.saldoProjetado < saldoMinimo) {
      saldoMinimo = dia.saldoProjetado;
      dataSaldoMinimo = dia.data;
    }
  }

  // Calcula médias
  const totalEntradas = dias.reduce((sum, d) => sum + d.entradasPrevistas, 0);
  const totalSaidas = dias.reduce((sum, d) => sum + d.saidasPrevistas, 0);
  const mediaReceitasDiarias = totalEntradas / dias.length;
  const mediaDespesasDiarias = totalSaidas / dias.length;

  // Dias de cobertura operacional
  const saldoFinal = dias[dias.length - 1].saldoProjetado;
  const diasCoberturaOperacional = mediaDespesasDiarias > 0
    ? Math.floor(saldoFinal / mediaDespesasDiarias)
    : 999;

  // Necessidade de capital de giro
  const necessidadeCapitalGiro = saldoMinimo < 0
    ? Math.abs(saldoMinimo) + configPrevisao.alertas.saldoMinimoOperacional
    : 0;

  // Tendência
  const primeiraSemana = dias.slice(0, 7);
  const ultimaSemana = dias.slice(-7);
  const mediaPrimeira = primeiraSemana.reduce((sum, d) => sum + d.saldoProjetado, 0) / primeiraSemana.length;
  const mediaUltima = ultimaSemana.reduce((sum, d) => sum + d.saldoProjetado, 0) / ultimaSemana.length;

  let tendencia: "crescente" | "estavel" | "decrescente" = "estavel";
  if (mediaUltima > mediaPrimeira * 1.1) tendencia = "crescente";
  else if (mediaUltima < mediaPrimeira * 0.9) tendencia = "decrescente";

  return {
    saldoMinimoProjetado: saldoMinimo,
    dataSaldoMinimo,
    diasCoberturaOperacional,
    necessidadeCapitalGiro,
    mediaReceitasDiarias,
    mediaDespesasDiarias,
    tendencia
  };
}

/**
 * Gera alertas com base no fluxo projetado
 */
export function gerarAlertas(
  dias: FluxoCaixaDia[],
  indicadores: IndicadoresFluxo
): AlertaFluxo[] {
  const alertas: AlertaFluxo[] = [];

  // Alerta de saldo negativo
  const diasNegativos = dias.filter(d => d.saldoProjetado < 0);
  if (diasNegativos.length > 0) {
    alertas.push({
      tipo: "critico",
      mensagem: `Saldo negativo previsto em ${diasNegativos.length} dia(s)`,
      data: diasNegativos[0].data,
      valor: diasNegativos[0].saldoProjetado,
      acao: "Antecipar recebimentos ou renegociar pagamentos"
    });
  }

  // Alerta de saldo mínimo
  if (indicadores.saldoMinimoProjetado < configPrevisao.alertas.saldoMinimoOperacional) {
    alertas.push({
      tipo: "atencao",
      mensagem: `Saldo abaixo do mínimo operacional (R$ ${configPrevisao.alertas.saldoMinimoOperacional.toLocaleString("pt-BR")})`,
      data: indicadores.dataSaldoMinimo,
      valor: indicadores.saldoMinimoProjetado,
      acao: "Reforçar cobrança de inadimplentes"
    });
  }

  // Alerta de cobertura operacional
  if (indicadores.diasCoberturaOperacional < configPrevisao.alertas.diasCoberturaCritico) {
    alertas.push({
      tipo: "critico",
      mensagem: `Cobertura operacional crítica: apenas ${indicadores.diasCoberturaOperacional} dias`,
      data: new Date().toISOString().split("T")[0],
      acao: "Urgente: buscar capital de giro"
    });
  } else if (indicadores.diasCoberturaOperacional < configPrevisao.alertas.diasCoberturaAtencao) {
    alertas.push({
      tipo: "atencao",
      mensagem: `Cobertura operacional baixa: ${indicadores.diasCoberturaOperacional} dias`,
      data: new Date().toISOString().split("T")[0],
      acao: "Planejar aumento de receitas ou redução de despesas"
    });
  }

  // Alerta de tendência decrescente
  if (indicadores.tendencia === "decrescente") {
    alertas.push({
      tipo: "atencao",
      mensagem: "Tendência de queda no fluxo de caixa",
      data: new Date().toISOString().split("T")[0],
      acao: "Revisar estratégia comercial e inadimplência"
    });
  }

  // Alerta de necessidade de capital
  if (indicadores.necessidadeCapitalGiro > 0) {
    alertas.push({
      tipo: "critico",
      mensagem: `Necessidade de capital de giro: R$ ${indicadores.necessidadeCapitalGiro.toLocaleString("pt-BR")}`,
      data: indicadores.dataSaldoMinimo,
      valor: indicadores.necessidadeCapitalGiro,
      acao: "Buscar linha de crédito ou antecipar recebíveis"
    });
  }

  return alertas.sort((a, b) => {
    const prioridade = { critico: 0, atencao: 1, info: 2 };
    return prioridade[a.tipo] - prioridade[b.tipo];
  });
}

/**
 * Gera previsão completa de fluxo de caixa
 */
export function gerarPrevisaoFluxoCaixa(
  saldoAtual: number,
  receitas: ReceitaPrevista[],
  despesas: DespesaPrevista[],
  diasProjecao: number = configPrevisao.diasProjecao
): PrevisaoFluxoCaixa {
  const hoje = new Date();
  const dataFim = new Date(hoje);
  dataFim.setDate(dataFim.getDate() + diasProjecao);

  const recebimentosProjetados = projetarRecebimentos(receitas, hoje, dataFim);
  const pagamentosProjetados = projetarDespesas(despesas, hoje, dataFim);

  const dias: FluxoCaixaDia[] = [];
  let saldoAcumulado = saldoAtual;

  for (let i = 0; i <= diasProjecao; i++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() + i);
    const chaveData = data.toISOString().split("T")[0];

    const entradasDia = recebimentosProjetados.get(chaveData) || 0;
    const saidasDia = pagamentosProjetados.get(chaveData) || 0;

    const saldoInicial = saldoAcumulado;
    saldoAcumulado = saldoAcumulado + entradasDia - saidasDia;

    const alertasDia: string[] = [];
    if (saldoAcumulado < 0) {
      alertasDia.push("Saldo negativo");
    }
    if (saldoAcumulado < configPrevisao.alertas.saldoMinimoOperacional) {
      alertasDia.push("Abaixo do mínimo operacional");
    }

    dias.push({
      data: chaveData,
      saldoInicial,
      entradasPrevistas: entradasDia,
      entradasRealizadas: i === 0 ? entradasDia : 0,
      saidasPrevistas: saidasDia,
      saidasRealizadas: i === 0 ? saidasDia : 0,
      saldoFinal: saldoAcumulado,
      saldoProjetado: saldoAcumulado,
      alertas: alertasDia
    });
  }

  // Resumo semanal
  const resumoSemanal: ResumoSemanal[] = [];
  for (let semana = 0; semana < Math.ceil(diasProjecao / 7); semana++) {
    const inicio = semana * 7;
    const fim = Math.min(inicio + 6, diasProjecao);
    const diasSemana = dias.slice(inicio, fim + 1);

    if (diasSemana.length > 0) {
      resumoSemanal.push({
        semana: semana + 1,
        inicio: diasSemana[0].data,
        fim: diasSemana[diasSemana.length - 1].data,
        entradasPrevistas: diasSemana.reduce((sum, d) => sum + d.entradasPrevistas, 0),
        saidasPrevistas: diasSemana.reduce((sum, d) => sum + d.saidasPrevistas, 0),
        saldoProjetado: diasSemana[diasSemana.length - 1].saldoProjetado
      });
    }
  }

  const indicadores = calcularIndicadores(dias);
  const alertas = gerarAlertas(dias, indicadores);

  return {
    periodo: {
      inicio: hoje.toISOString().split("T")[0],
      fim: dataFim.toISOString().split("T")[0]
    },
    saldoAtual,
    dias,
    resumoSemanal,
    indicadores,
    alertas
  };
}

/**
 * Gera relatório resumido de fluxo de caixa
 */
export function gerarRelatorioResumo(previsao: PrevisaoFluxoCaixa): string {
  let relatorio = `📊 **PREVISÃO DE FLUXO DE CAIXA**\n`;
  relatorio += `Período: ${previsao.periodo.inicio} a ${previsao.periodo.fim}\n\n`;

  relatorio += `💰 **Saldo Atual:** ${formatarMoedaInterno(previsao.saldoAtual)}\n`;
  relatorio += `📉 **Saldo Mínimo Projetado:** ${formatarMoedaInterno(previsao.indicadores.saldoMinimoProjetado)}`;
  relatorio += ` (${previsao.indicadores.dataSaldoMinimo})\n`;
  relatorio += `📈 **Tendência:** ${previsao.indicadores.tendencia}\n`;
  relatorio += `🔄 **Dias de Cobertura:** ${previsao.indicadores.diasCoberturaOperacional}\n\n`;

  if (previsao.indicadores.necessidadeCapitalGiro > 0) {
    relatorio += `⚠️ **Necessidade de Capital:** ${formatarMoedaInterno(previsao.indicadores.necessidadeCapitalGiro)}\n\n`;
  }

  relatorio += `📅 **Resumo Semanal:**\n`;
  for (const semana of previsao.resumoSemanal) {
    relatorio += `• Semana ${semana.semana}: `;
    relatorio += `Entradas ${formatarMoedaInterno(semana.entradasPrevistas)} | `;
    relatorio += `Saídas ${formatarMoedaInterno(semana.saidasPrevistas)} | `;
    relatorio += `Saldo ${formatarMoedaInterno(semana.saldoProjetado)}\n`;
  }

  if (previsao.alertas.length > 0) {
    relatorio += `\n🚨 **Alertas:**\n`;
    for (const alerta of previsao.alertas) {
      const icone = alerta.tipo === "critico" ? "🔴" : alerta.tipo === "atencao" ? "🟡" : "🔵";
      relatorio += `${icone} ${alerta.mensagem}\n`;
      if (alerta.acao) {
        relatorio += `   → ${alerta.acao}\n`;
      }
    }
  }

  return relatorio;
}

export default {
  configPrevisao,
  despesasFixasTipicas,
  calcularProbabilidadeRecebimento,
  aplicarSazonalidade,
  projetarRecebimentos,
  projetarDespesas,
  gerarDespesasFixasMes,
  calcularIndicadores,
  gerarAlertas,
  gerarPrevisaoFluxoCaixa,
  gerarRelatorioResumo
};
