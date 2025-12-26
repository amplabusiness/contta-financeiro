/**
 * Módulo de Comparativo de Honorários
 *
 * Este módulo analisa e compara honorários dos clientes com:
 * - Tabela de referência do mercado
 * - Complexidade do serviço
 * - Regime tributário
 * - Rentabilidade por cliente
 * - Sugestões de reajuste
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface ClienteHonorario {
  id: string;
  nome: string;
  cnpj: string;
  regime: RegimeTributario;
  honorarioAtual: number;
  funcionarios: number;
  faturamentoMensal: number;
  notasFiscaisMes: number;
  complexidadeFiscal: "baixa" | "media" | "alta";
  temCertificado: boolean;
  temFolha: boolean;
  temFiscal: boolean;
  temContabilidade: boolean;
  servicosExtras: string[];
  ultimoReajuste?: string;
  dataInicio: string;
}

export type RegimeTributario = "mei" | "simples" | "presumido" | "real";

export interface TabelaReferencia {
  regime: RegimeTributario;
  faixaFuncionarios: { min: number; max: number };
  faixaFaturamento: { min: number; max: number };
  honorarioMinimo: number;
  honorarioMedio: number;
  honorarioMaximo: number;
}

export interface AnaliseHonorario {
  cliente: ClienteHonorario;
  honorarioSugerido: number;
  honorarioMercado: { minimo: number; medio: number; maximo: number };
  posicionamento: "abaixo" | "adequado" | "acima";
  percentualDesvio: number;
  rentabilidade: number;
  custoEstimado: number;
  lucroEstimado: number;
  margemLucro: number;
  reajusteSugerido: {
    valor: number;
    percentual: number;
    justificativa: string;
  };
  alertas: string[];
}

export interface ComparativoGeral {
  data: string;
  totalClientes: number;
  receitaMensal: number;
  honorarioMedio: number;
  distribuicao: {
    abaixoMercado: { quantidade: number; receitaPerdida: number };
    noMercado: { quantidade: number };
    acimaMercado: { quantidade: number; premioTotal: number };
  };
  porRegime: Record<RegimeTributario, {
    clientes: number;
    receitaTotal: number;
    honorarioMedio: number;
    rentabilidadeMedia: number;
  }>;
  oportunidadesReajuste: AnaliseHonorario[];
  receitaPotencial: number;
}

// ============================================
// TABELA DE REFERÊNCIA DE MERCADO
// ============================================

export const tabelaReferenciaGoiania: TabelaReferencia[] = [
  // MEI
  {
    regime: "mei",
    faixaFuncionarios: { min: 0, max: 1 },
    faixaFaturamento: { min: 0, max: 6750 },
    honorarioMinimo: 100,
    honorarioMedio: 150,
    honorarioMaximo: 250
  },

  // SIMPLES - Sem funcionários
  {
    regime: "simples",
    faixaFuncionarios: { min: 0, max: 0 },
    faixaFaturamento: { min: 0, max: 50000 },
    honorarioMinimo: 400,
    honorarioMedio: 600,
    honorarioMaximo: 900
  },
  {
    regime: "simples",
    faixaFuncionarios: { min: 0, max: 0 },
    faixaFaturamento: { min: 50001, max: 150000 },
    honorarioMinimo: 600,
    honorarioMedio: 900,
    honorarioMaximo: 1300
  },
  {
    regime: "simples",
    faixaFuncionarios: { min: 0, max: 0 },
    faixaFaturamento: { min: 150001, max: 400000 },
    honorarioMinimo: 900,
    honorarioMedio: 1300,
    honorarioMaximo: 1800
  },

  // SIMPLES - 1-5 funcionários
  {
    regime: "simples",
    faixaFuncionarios: { min: 1, max: 5 },
    faixaFaturamento: { min: 0, max: 50000 },
    honorarioMinimo: 600,
    honorarioMedio: 900,
    honorarioMaximo: 1300
  },
  {
    regime: "simples",
    faixaFuncionarios: { min: 1, max: 5 },
    faixaFaturamento: { min: 50001, max: 150000 },
    honorarioMinimo: 900,
    honorarioMedio: 1300,
    honorarioMaximo: 1800
  },
  {
    regime: "simples",
    faixaFuncionarios: { min: 1, max: 5 },
    faixaFaturamento: { min: 150001, max: 400000 },
    honorarioMinimo: 1200,
    honorarioMedio: 1700,
    honorarioMaximo: 2300
  },

  // SIMPLES - 6-10 funcionários
  {
    regime: "simples",
    faixaFuncionarios: { min: 6, max: 10 },
    faixaFaturamento: { min: 0, max: 150000 },
    honorarioMinimo: 1200,
    honorarioMedio: 1700,
    honorarioMaximo: 2500
  },
  {
    regime: "simples",
    faixaFuncionarios: { min: 6, max: 10 },
    faixaFaturamento: { min: 150001, max: 400000 },
    honorarioMinimo: 1700,
    honorarioMedio: 2300,
    honorarioMaximo: 3200
  },

  // SIMPLES - 11+ funcionários
  {
    regime: "simples",
    faixaFuncionarios: { min: 11, max: 999 },
    faixaFaturamento: { min: 0, max: 400000 },
    honorarioMinimo: 2000,
    honorarioMedio: 2800,
    honorarioMaximo: 4000
  },

  // LUCRO PRESUMIDO
  {
    regime: "presumido",
    faixaFuncionarios: { min: 0, max: 5 },
    faixaFaturamento: { min: 0, max: 200000 },
    honorarioMinimo: 1200,
    honorarioMedio: 1800,
    honorarioMaximo: 2500
  },
  {
    regime: "presumido",
    faixaFuncionarios: { min: 0, max: 5 },
    faixaFaturamento: { min: 200001, max: 500000 },
    honorarioMinimo: 1800,
    honorarioMedio: 2500,
    honorarioMaximo: 3500
  },
  {
    regime: "presumido",
    faixaFuncionarios: { min: 6, max: 20 },
    faixaFaturamento: { min: 0, max: 500000 },
    honorarioMinimo: 2500,
    honorarioMedio: 3500,
    honorarioMaximo: 5000
  },
  {
    regime: "presumido",
    faixaFuncionarios: { min: 21, max: 999 },
    faixaFaturamento: { min: 0, max: 999999999 },
    honorarioMinimo: 4000,
    honorarioMedio: 6000,
    honorarioMaximo: 10000
  },

  // LUCRO REAL
  {
    regime: "real",
    faixaFuncionarios: { min: 0, max: 10 },
    faixaFaturamento: { min: 0, max: 500000 },
    honorarioMinimo: 3000,
    honorarioMedio: 4500,
    honorarioMaximo: 7000
  },
  {
    regime: "real",
    faixaFuncionarios: { min: 11, max: 50 },
    faixaFaturamento: { min: 0, max: 2000000 },
    honorarioMinimo: 5000,
    honorarioMedio: 8000,
    honorarioMaximo: 12000
  },
  {
    regime: "real",
    faixaFuncionarios: { min: 51, max: 999 },
    faixaFaturamento: { min: 0, max: 999999999 },
    honorarioMinimo: 8000,
    honorarioMedio: 15000,
    honorarioMaximo: 30000
  }
];

// ============================================
// CUSTOS OPERACIONAIS
// ============================================

export const custosOperacionais = {
  // Custo hora/homem por função
  custoHora: {
    contador: 80,
    analista: 50,
    assistente: 35,
    estagiario: 20
  },

  // Horas médias por serviço/mês
  horasPorServico: {
    contabilidade: {
      mei: 1,
      simples: 3,
      presumido: 6,
      real: 12
    },
    fiscal: {
      mei: 0.5,
      simples: 2,
      presumido: 4,
      real: 8
    },
    folha: {
      porFuncionario: 0.5,
      minimo: 2
    },
    extras: {
      certidoes: 1,
      imposto_renda_pf: 3,
      abertura_empresa: 8,
      alteracao_contrato: 4,
      balanco_patrimonial: 6
    }
  },

  // Adicional por complexidade
  fatorComplexidade: {
    baixa: 1.0,
    media: 1.3,
    alta: 1.6
  }
};

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Encontra a faixa de referência do mercado para um cliente
 */
export function encontrarReferenciaCliente(cliente: ClienteHonorario): TabelaReferencia | null {
  return tabelaReferenciaGoiania.find(ref =>
    ref.regime === cliente.regime &&
    cliente.funcionarios >= ref.faixaFuncionarios.min &&
    cliente.funcionarios <= ref.faixaFuncionarios.max &&
    cliente.faturamentoMensal >= ref.faixaFaturamento.min &&
    cliente.faturamentoMensal <= ref.faixaFaturamento.max
  ) || null;
}

/**
 * Calcula o custo estimado de atender um cliente
 */
export function calcularCustoCliente(cliente: ClienteHonorario): number {
  const custos = custosOperacionais;
  let horasTotais = 0;

  // Contabilidade
  if (cliente.temContabilidade) {
    horasTotais += custos.horasPorServico.contabilidade[cliente.regime];
  }

  // Fiscal
  if (cliente.temFiscal) {
    horasTotais += custos.horasPorServico.fiscal[cliente.regime];
    // Adicional por volume de notas
    horasTotais += Math.floor(cliente.notasFiscaisMes / 50) * 0.5;
  }

  // Folha de pagamento
  if (cliente.temFolha && cliente.funcionarios > 0) {
    const horasFolha = Math.max(
      custos.horasPorServico.folha.minimo,
      cliente.funcionarios * custos.horasPorServico.folha.porFuncionario
    );
    horasTotais += horasFolha;
  }

  // Aplicar fator de complexidade
  horasTotais *= custos.fatorComplexidade[cliente.complexidadeFiscal];

  // Custo médio (mix de funções)
  const custoHoraMedio = (
    custos.custoHora.contador * 0.2 +
    custos.custoHora.analista * 0.5 +
    custos.custoHora.assistente * 0.3
  );

  return horasTotais * custoHoraMedio;
}

/**
 * Calcula o honorário sugerido baseado em múltiplos fatores
 */
export function calcularHonorarioSugerido(cliente: ClienteHonorario): number {
  const referencia = encontrarReferenciaCliente(cliente);
  if (!referencia) {
    // Fallback: baseado no custo + margem
    const custo = calcularCustoCliente(cliente);
    return custo * 2; // 100% de margem
  }

  let honorarioBase = referencia.honorarioMedio;

  // Ajustes
  const ajustes: { fator: number; motivo: string }[] = [];

  // Complexidade
  if (cliente.complexidadeFiscal === "alta") {
    ajustes.push({ fator: 1.2, motivo: "Complexidade alta" });
  } else if (cliente.complexidadeFiscal === "baixa") {
    ajustes.push({ fator: 0.9, motivo: "Complexidade baixa" });
  }

  // Volume de notas fiscais
  if (cliente.notasFiscaisMes > 100) {
    ajustes.push({ fator: 1.15, motivo: "Alto volume de NFs" });
  } else if (cliente.notasFiscaisMes > 50) {
    ajustes.push({ fator: 1.1, motivo: "Volume moderado de NFs" });
  }

  // Serviços extras
  if (cliente.servicosExtras.length > 2) {
    ajustes.push({ fator: 1.1, motivo: "Serviços extras" });
  }

  // Cliente antigo (fidelidade)
  const mesesCliente = Math.floor(
    (Date.now() - new Date(cliente.dataInicio).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  if (mesesCliente > 36) {
    ajustes.push({ fator: 0.95, motivo: "Desconto fidelidade (3+ anos)" });
  }

  // Aplicar todos os ajustes
  for (const ajuste of ajustes) {
    honorarioBase *= ajuste.fator;
  }

  // Arredondar para múltiplo de 50
  return Math.ceil(honorarioBase / 50) * 50;
}

/**
 * Analisa o honorário de um cliente
 */
export function analisarHonorario(cliente: ClienteHonorario): AnaliseHonorario {
  const referencia = encontrarReferenciaCliente(cliente);
  const honorarioSugerido = calcularHonorarioSugerido(cliente);
  const custoEstimado = calcularCustoCliente(cliente);
  const lucroEstimado = cliente.honorarioAtual - custoEstimado;
  const margemLucro = cliente.honorarioAtual > 0 ? lucroEstimado / cliente.honorarioAtual : 0;

  // Valores de mercado
  const honorarioMercado = referencia
    ? { minimo: referencia.honorarioMinimo, medio: referencia.honorarioMedio, maximo: referencia.honorarioMaximo }
    : { minimo: honorarioSugerido * 0.7, medio: honorarioSugerido, maximo: honorarioSugerido * 1.3 };

  // Posicionamento
  let posicionamento: "abaixo" | "adequado" | "acima";
  if (cliente.honorarioAtual < honorarioMercado.minimo) {
    posicionamento = "abaixo";
  } else if (cliente.honorarioAtual > honorarioMercado.maximo) {
    posicionamento = "acima";
  } else {
    posicionamento = "adequado";
  }

  // Percentual de desvio do médio
  const percentualDesvio = honorarioMercado.medio > 0
    ? ((cliente.honorarioAtual - honorarioMercado.medio) / honorarioMercado.medio) * 100
    : 0;

  // Rentabilidade (receita por hora estimada)
  const horasEstimadas = custoEstimado / custosOperacionais.custoHora.analista;
  const rentabilidade = horasEstimadas > 0 ? cliente.honorarioAtual / horasEstimadas : 0;

  // Sugestão de reajuste
  const alertas: string[] = [];
  let reajusteSugerido = { valor: 0, percentual: 0, justificativa: "" };

  if (posicionamento === "abaixo") {
    const diferenca = honorarioMercado.minimo - cliente.honorarioAtual;
    reajusteSugerido = {
      valor: diferenca,
      percentual: (diferenca / cliente.honorarioAtual) * 100,
      justificativa: "Honorário abaixo do mínimo de mercado"
    };
    alertas.push("⚠️ Honorário defasado - revisar urgentemente");
  }

  if (margemLucro < 0.3) {
    alertas.push("⚠️ Margem de lucro baixa (<30%)");
    if (reajusteSugerido.valor === 0) {
      const margemIdeal = 0.5;
      const valorIdeal = custoEstimado / (1 - margemIdeal);
      reajusteSugerido = {
        valor: valorIdeal - cliente.honorarioAtual,
        percentual: ((valorIdeal - cliente.honorarioAtual) / cliente.honorarioAtual) * 100,
        justificativa: "Necessário para margem saudável de 50%"
      };
    }
  }

  if (margemLucro < 0) {
    alertas.push("🔴 PREJUÍZO - cliente dá prejuízo operacional");
  }

  // Verificar se reajuste está atrasado
  if (cliente.ultimoReajuste) {
    const mesesSemReajuste = Math.floor(
      (Date.now() - new Date(cliente.ultimoReajuste).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    if (mesesSemReajuste > 12) {
      alertas.push(`ℹ️ ${mesesSemReajuste} meses sem reajuste`);
    }
  }

  return {
    cliente,
    honorarioSugerido,
    honorarioMercado,
    posicionamento,
    percentualDesvio,
    rentabilidade,
    custoEstimado,
    lucroEstimado,
    margemLucro,
    reajusteSugerido,
    alertas
  };
}

/**
 * Gera comparativo geral de honorários
 */
export function gerarComparativoGeral(clientes: ClienteHonorario[]): ComparativoGeral {
  const analises = clientes.map(analisarHonorario);
  const receitaMensal = clientes.reduce((sum, c) => sum + c.honorarioAtual, 0);

  // Distribuição
  const abaixo = analises.filter(a => a.posicionamento === "abaixo");
  const adequado = analises.filter(a => a.posicionamento === "adequado");
  const acima = analises.filter(a => a.posicionamento === "acima");

  const receitaPerdida = abaixo.reduce((sum, a) =>
    sum + (a.honorarioMercado.minimo - a.cliente.honorarioAtual), 0);
  const premioTotal = acima.reduce((sum, a) =>
    sum + (a.cliente.honorarioAtual - a.honorarioMercado.maximo), 0);

  // Por regime
  const porRegime: Record<RegimeTributario, any> = {
    mei: { clientes: 0, receitaTotal: 0, honorarioMedio: 0, rentabilidadeMedia: 0 },
    simples: { clientes: 0, receitaTotal: 0, honorarioMedio: 0, rentabilidadeMedia: 0 },
    presumido: { clientes: 0, receitaTotal: 0, honorarioMedio: 0, rentabilidadeMedia: 0 },
    real: { clientes: 0, receitaTotal: 0, honorarioMedio: 0, rentabilidadeMedia: 0 }
  };

  for (const analise of analises) {
    const regime = analise.cliente.regime;
    porRegime[regime].clientes++;
    porRegime[regime].receitaTotal += analise.cliente.honorarioAtual;
    porRegime[regime].rentabilidadeMedia += analise.rentabilidade;
  }

  // Calcular médias
  for (const regime of Object.keys(porRegime) as RegimeTributario[]) {
    if (porRegime[regime].clientes > 0) {
      porRegime[regime].honorarioMedio = porRegime[regime].receitaTotal / porRegime[regime].clientes;
      porRegime[regime].rentabilidadeMedia = porRegime[regime].rentabilidadeMedia / porRegime[regime].clientes;
    }
  }

  // Oportunidades de reajuste (maiores gaps)
  const oportunidades = analises
    .filter(a => a.reajusteSugerido.valor > 0)
    .sort((a, b) => b.reajusteSugerido.valor - a.reajusteSugerido.valor)
    .slice(0, 10);

  const receitaPotencial = analises
    .filter(a => a.reajusteSugerido.valor > 0)
    .reduce((sum, a) => sum + a.reajusteSugerido.valor, 0);

  return {
    data: new Date().toISOString().split("T")[0],
    totalClientes: clientes.length,
    receitaMensal,
    honorarioMedio: receitaMensal / clientes.length,
    distribuicao: {
      abaixoMercado: { quantidade: abaixo.length, receitaPerdida },
      noMercado: { quantidade: adequado.length },
      acimaMercado: { quantidade: acima.length, premioTotal }
    },
    porRegime,
    oportunidadesReajuste: oportunidades,
    receitaPotencial
  };
}

/**
 * Gera relatório formatado
 */
export function gerarRelatorioComparativo(comparativo: ComparativoGeral): string {
  let relatorio = `📊 **COMPARATIVO DE HONORÁRIOS**\n`;
  relatorio += `Data: ${new Date(comparativo.data).toLocaleDateString("pt-BR")}\n\n`;

  relatorio += `💰 **Visão Geral**\n`;
  relatorio += `• Total de Clientes: ${comparativo.totalClientes}\n`;
  relatorio += `• Receita Mensal: R$ ${comparativo.receitaMensal.toLocaleString("pt-BR")}\n`;
  relatorio += `• Honorário Médio: R$ ${comparativo.honorarioMedio.toFixed(2)}\n\n`;

  relatorio += `📈 **Posicionamento de Mercado**\n`;
  relatorio += `• 🔴 Abaixo do mercado: ${comparativo.distribuicao.abaixoMercado.quantidade} clientes`;
  relatorio += ` (receita perdida: R$ ${comparativo.distribuicao.abaixoMercado.receitaPerdida.toLocaleString("pt-BR")}/mês)\n`;
  relatorio += `• 🟢 No mercado: ${comparativo.distribuicao.noMercado.quantidade} clientes\n`;
  relatorio += `• 🔵 Acima do mercado: ${comparativo.distribuicao.acimaMercado.quantidade} clientes`;
  relatorio += ` (prêmio: R$ ${comparativo.distribuicao.acimaMercado.premioTotal.toLocaleString("pt-BR")}/mês)\n\n`;

  relatorio += `📋 **Por Regime Tributário**\n`;
  for (const [regime, dados] of Object.entries(comparativo.porRegime)) {
    if (dados.clientes > 0) {
      relatorio += `• ${regime.toUpperCase()}: ${dados.clientes} clientes | `;
      relatorio += `Média R$ ${dados.honorarioMedio.toFixed(2)} | `;
      relatorio += `Rent. R$ ${dados.rentabilidadeMedia.toFixed(2)}/h\n`;
    }
  }

  if (comparativo.oportunidadesReajuste.length > 0) {
    relatorio += `\n💡 **Top Oportunidades de Reajuste**\n`;
    for (const opp of comparativo.oportunidadesReajuste.slice(0, 5)) {
      relatorio += `• ${opp.cliente.nome}\n`;
      relatorio += `  Atual: R$ ${opp.cliente.honorarioAtual.toLocaleString("pt-BR")} → `;
      relatorio += `Sugerido: +R$ ${opp.reajusteSugerido.valor.toFixed(2)} `;
      relatorio += `(${opp.reajusteSugerido.percentual.toFixed(1)}%)\n`;
    }
  }

  relatorio += `\n📈 **Receita Potencial com Reajustes:** `;
  relatorio += `R$ ${comparativo.receitaPotencial.toLocaleString("pt-BR")}/mês\n`;

  return relatorio;
}

export default {
  tabelaReferenciaGoiania,
  custosOperacionais,
  encontrarReferenciaCliente,
  calcularCustoCliente,
  calcularHonorarioSugerido,
  analisarHonorario,
  gerarComparativoGeral,
  gerarRelatorioComparativo
};
