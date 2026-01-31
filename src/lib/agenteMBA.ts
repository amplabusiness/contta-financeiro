/**
 * AGENTE MBA - ESPECIALISTA EM ANÁLISE FINANCEIRA
 * 
 * Base de conhecimento para geração de relatórios e análises financeiras
 * Subordinado ao Dr. Cícero
 * 
 * Autor: Sistema Contta / Ampla Contabilidade
 * Data: 31/01/2026
 */

import { IndicadorFinanceiro, INDICADORES_FINANCEIROS, buscarIndicador, buscarIndicadoresPorCategoria } from './knowledgeBase';

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

export interface DadosBalanco {
  ativoCirculante: number;
  ativoNaoCirculante: number;
  passivoCirculante: number;
  passivoNaoCirculante: number;
  patrimonioLiquido: number;
  estoques?: number;
  disponivel?: number;
  contasReceber?: number;
  fornecedores?: number;
}

export interface DadosDRE {
  receita: number;
  custoMercadorias: number;
  despesasOperacionais: number;
  despesasFinanceiras: number;
  lucroBruto?: number;
  lucroOperacional?: number;
  lucroAntesIR?: number;
  lucroLiquido: number;
  depreciacaoAmortizacao?: number;
}

export interface AnaliseIndicador {
  nome: string;
  valor: number;
  valorFormatado: string;
  status: 'OTIMO' | 'BOM' | 'REGULAR' | 'RUIM' | 'CRITICO';
  interpretacao: string;
  ideal: string;
  cor: string;
}

export interface AnaliseCompleta {
  empresa: string;
  periodo: string;
  dataAnalise: string;
  indicadores: {
    liquidez: AnaliseIndicador[];
    rentabilidade: AnaliseIndicador[];
    endividamento: AnaliseIndicador[];
    atividade: AnaliseIndicador[];
  };
  diagnostico: string;
  recomendacoes: string[];
  pontosFortres: string[];
  pontosAtencao: string[];
  score: number; // 0-100
}

export interface AnaliseDuPont {
  roe: number;
  margemLiquida: number;
  giroAtivo: number;
  multiplicadorAlavancagem: number;
  decomposicao: string;
}

export interface ProjecaoFluxoCaixa {
  periodo: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  variacao: number;
}

// =============================================================================
// FUNÇÕES DE CÁLCULO DE INDICADORES
// =============================================================================

/**
 * Calcula indicadores de liquidez
 */
export function calcularIndicadoresLiquidez(balanco: DadosBalanco): AnaliseIndicador[] {
  const indicadores: AnaliseIndicador[] = [];
  
  // Liquidez Corrente
  const lc = balanco.ativoCirculante / balanco.passivoCirculante;
  indicadores.push({
    nome: 'Liquidez Corrente',
    valor: lc,
    valorFormatado: lc.toFixed(2),
    status: lc >= 2 ? 'OTIMO' : lc >= 1.5 ? 'BOM' : lc >= 1 ? 'REGULAR' : lc >= 0.5 ? 'RUIM' : 'CRITICO',
    interpretacao: lc >= 1 ? `Para cada R$ 1,00 de dívida de curto prazo, a empresa tem R$ ${lc.toFixed(2)} de ativos circulantes.` : 'A empresa não tem ativos suficientes para cobrir dívidas de curto prazo.',
    ideal: '> 1,5',
    cor: lc >= 1.5 ? '#22c55e' : lc >= 1 ? '#f59e0b' : '#ef4444'
  });
  
  // Liquidez Seca
  if (balanco.estoques !== undefined) {
    const ls = (balanco.ativoCirculante - balanco.estoques) / balanco.passivoCirculante;
    indicadores.push({
      nome: 'Liquidez Seca',
      valor: ls,
      valorFormatado: ls.toFixed(2),
      status: ls >= 1.5 ? 'OTIMO' : ls >= 1 ? 'BOM' : ls >= 0.7 ? 'REGULAR' : ls >= 0.4 ? 'RUIM' : 'CRITICO',
      interpretacao: `Excluindo estoques, a empresa tem R$ ${ls.toFixed(2)} de ativos líquidos para cada R$ 1,00 de dívida de curto prazo.`,
      ideal: '> 1,0',
      cor: ls >= 1 ? '#22c55e' : ls >= 0.7 ? '#f59e0b' : '#ef4444'
    });
  }
  
  // Liquidez Imediata
  if (balanco.disponivel !== undefined) {
    const li = balanco.disponivel / balanco.passivoCirculante;
    indicadores.push({
      nome: 'Liquidez Imediata',
      valor: li,
      valorFormatado: li.toFixed(2),
      status: li >= 0.5 ? 'OTIMO' : li >= 0.2 ? 'BOM' : li >= 0.1 ? 'REGULAR' : li >= 0.05 ? 'RUIM' : 'CRITICO',
      interpretacao: `A empresa pode pagar ${(li * 100).toFixed(0)}% das dívidas de curto prazo imediatamente.`,
      ideal: '> 0,2',
      cor: li >= 0.2 ? '#22c55e' : li >= 0.1 ? '#f59e0b' : '#ef4444'
    });
  }
  
  // Liquidez Geral
  const lg = (balanco.ativoCirculante + balanco.ativoNaoCirculante * 0.3) / (balanco.passivoCirculante + balanco.passivoNaoCirculante);
  indicadores.push({
    nome: 'Liquidez Geral',
    valor: lg,
    valorFormatado: lg.toFixed(2),
    status: lg >= 1.5 ? 'OTIMO' : lg >= 1 ? 'BOM' : lg >= 0.8 ? 'REGULAR' : lg >= 0.5 ? 'RUIM' : 'CRITICO',
    interpretacao: `Considerando longo prazo, a empresa tem R$ ${lg.toFixed(2)} de ativos para cada R$ 1,00 de dívida total.`,
    ideal: '> 1,0',
    cor: lg >= 1 ? '#22c55e' : lg >= 0.8 ? '#f59e0b' : '#ef4444'
  });
  
  // Capital Circulante Líquido
  const ccl = balanco.ativoCirculante - balanco.passivoCirculante;
  indicadores.push({
    nome: 'Capital Circulante Líquido',
    valor: ccl,
    valorFormatado: `R$ ${ccl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    status: ccl > 0 ? (ccl > balanco.ativoCirculante * 0.3 ? 'OTIMO' : 'BOM') : ccl === 0 ? 'REGULAR' : 'CRITICO',
    interpretacao: ccl > 0 ? `Folga financeira de R$ ${ccl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no curto prazo.` : 'Empresa com capital de giro negativo - atenção!',
    ideal: 'Positivo',
    cor: ccl > 0 ? '#22c55e' : '#ef4444'
  });
  
  return indicadores;
}

/**
 * Calcula indicadores de rentabilidade
 */
export function calcularIndicadoresRentabilidade(balanco: DadosBalanco, dre: DadosDRE): AnaliseIndicador[] {
  const indicadores: AnaliseIndicador[] = [];
  const ativoTotal = balanco.ativoCirculante + balanco.ativoNaoCirculante;
  
  // ROE
  const roe = (dre.lucroLiquido / balanco.patrimonioLiquido) * 100;
  indicadores.push({
    nome: 'ROE (Retorno s/ PL)',
    valor: roe,
    valorFormatado: `${roe.toFixed(2)}%`,
    status: roe >= 20 ? 'OTIMO' : roe >= 15 ? 'BOM' : roe >= 10 ? 'REGULAR' : roe >= 5 ? 'RUIM' : 'CRITICO',
    interpretacao: `O retorno sobre o capital dos sócios foi de ${roe.toFixed(2)}% no período.`,
    ideal: '> 15%',
    cor: roe >= 15 ? '#22c55e' : roe >= 10 ? '#f59e0b' : '#ef4444'
  });
  
  // ROA
  const roa = (dre.lucroLiquido / ativoTotal) * 100;
  indicadores.push({
    nome: 'ROA (Retorno s/ Ativo)',
    valor: roa,
    valorFormatado: `${roa.toFixed(2)}%`,
    status: roa >= 10 ? 'OTIMO' : roa >= 5 ? 'BOM' : roa >= 3 ? 'REGULAR' : roa >= 1 ? 'RUIM' : 'CRITICO',
    interpretacao: `O retorno sobre os ativos totais foi de ${roa.toFixed(2)}%.`,
    ideal: '> 5%',
    cor: roa >= 5 ? '#22c55e' : roa >= 3 ? '#f59e0b' : '#ef4444'
  });
  
  // Margem Bruta
  const margemBruta = ((dre.receita - dre.custoMercadorias) / dre.receita) * 100;
  indicadores.push({
    nome: 'Margem Bruta',
    valor: margemBruta,
    valorFormatado: `${margemBruta.toFixed(2)}%`,
    status: margemBruta >= 40 ? 'OTIMO' : margemBruta >= 30 ? 'BOM' : margemBruta >= 20 ? 'REGULAR' : margemBruta >= 10 ? 'RUIM' : 'CRITICO',
    interpretacao: `A cada R$ 100 vendidos, R$ ${margemBruta.toFixed(2)} sobram após custos diretos.`,
    ideal: 'Varia por setor',
    cor: margemBruta >= 30 ? '#22c55e' : margemBruta >= 20 ? '#f59e0b' : '#ef4444'
  });
  
  // Margem Líquida
  const margemLiquida = (dre.lucroLiquido / dre.receita) * 100;
  indicadores.push({
    nome: 'Margem Líquida',
    valor: margemLiquida,
    valorFormatado: `${margemLiquida.toFixed(2)}%`,
    status: margemLiquida >= 15 ? 'OTIMO' : margemLiquida >= 8 ? 'BOM' : margemLiquida >= 5 ? 'REGULAR' : margemLiquida >= 2 ? 'RUIM' : 'CRITICO',
    interpretacao: `O lucro líquido representa ${margemLiquida.toFixed(2)}% da receita total.`,
    ideal: '> 5%',
    cor: margemLiquida >= 5 ? '#22c55e' : margemLiquida >= 2 ? '#f59e0b' : '#ef4444'
  });
  
  // EBITDA
  if (dre.depreciacaoAmortizacao !== undefined) {
    const lucroOperacional = dre.lucroBruto || (dre.receita - dre.custoMercadorias - dre.despesasOperacionais);
    const ebitda = lucroOperacional + dre.depreciacaoAmortizacao;
    const margemEbitda = (ebitda / dre.receita) * 100;
    indicadores.push({
      nome: 'Margem EBITDA',
      valor: margemEbitda,
      valorFormatado: `${margemEbitda.toFixed(2)}%`,
      status: margemEbitda >= 25 ? 'OTIMO' : margemEbitda >= 15 ? 'BOM' : margemEbitda >= 10 ? 'REGULAR' : margemEbitda >= 5 ? 'RUIM' : 'CRITICO',
      interpretacao: `A geração de caixa operacional representa ${margemEbitda.toFixed(2)}% da receita.`,
      ideal: '> 15%',
      cor: margemEbitda >= 15 ? '#22c55e' : margemEbitda >= 10 ? '#f59e0b' : '#ef4444'
    });
  }
  
  return indicadores;
}

/**
 * Calcula indicadores de endividamento
 */
export function calcularIndicadoresEndividamento(balanco: DadosBalanco, dre: DadosDRE): AnaliseIndicador[] {
  const indicadores: AnaliseIndicador[] = [];
  const ativoTotal = balanco.ativoCirculante + balanco.ativoNaoCirculante;
  const passivoTotal = balanco.passivoCirculante + balanco.passivoNaoCirculante;
  
  // Endividamento Geral
  const eg = (passivoTotal / ativoTotal) * 100;
  indicadores.push({
    nome: 'Endividamento Geral',
    valor: eg,
    valorFormatado: `${eg.toFixed(2)}%`,
    status: eg <= 40 ? 'OTIMO' : eg <= 60 ? 'BOM' : eg <= 80 ? 'REGULAR' : eg <= 100 ? 'RUIM' : 'CRITICO',
    interpretacao: `${eg.toFixed(0)}% dos ativos são financiados por capital de terceiros.`,
    ideal: '< 60%',
    cor: eg <= 60 ? '#22c55e' : eg <= 80 ? '#f59e0b' : '#ef4444'
  });
  
  // Composição do Endividamento
  const ce = (balanco.passivoCirculante / passivoTotal) * 100;
  indicadores.push({
    nome: 'Composição Endividamento',
    valor: ce,
    valorFormatado: `${ce.toFixed(2)}%`,
    status: ce <= 30 ? 'OTIMO' : ce <= 50 ? 'BOM' : ce <= 70 ? 'REGULAR' : ce <= 90 ? 'RUIM' : 'CRITICO',
    interpretacao: `${ce.toFixed(0)}% das dívidas são de curto prazo.`,
    ideal: '< 50%',
    cor: ce <= 50 ? '#22c55e' : ce <= 70 ? '#f59e0b' : '#ef4444'
  });
  
  // Grau de Alavancagem Financeira
  const gaf = ativoTotal / balanco.patrimonioLiquido;
  indicadores.push({
    nome: 'Alavancagem Financeira',
    valor: gaf,
    valorFormatado: `${gaf.toFixed(2)}x`,
    status: gaf <= 1.5 ? 'OTIMO' : gaf <= 2 ? 'BOM' : gaf <= 3 ? 'REGULAR' : gaf <= 5 ? 'RUIM' : 'CRITICO',
    interpretacao: `Os ativos totais são ${gaf.toFixed(2)}x maiores que o patrimônio líquido.`,
    ideal: '< 2x',
    cor: gaf <= 2 ? '#22c55e' : gaf <= 3 ? '#f59e0b' : '#ef4444'
  });
  
  // Cobertura de Juros
  if (dre.despesasFinanceiras > 0 && dre.depreciacaoAmortizacao !== undefined) {
    const lucroOperacional = dre.lucroBruto || (dre.receita - dre.custoMercadorias - dre.despesasOperacionais);
    const ebitda = lucroOperacional + dre.depreciacaoAmortizacao;
    const cj = ebitda / dre.despesasFinanceiras;
    indicadores.push({
      nome: 'Cobertura de Juros',
      valor: cj,
      valorFormatado: `${cj.toFixed(2)}x`,
      status: cj >= 5 ? 'OTIMO' : cj >= 3 ? 'BOM' : cj >= 2 ? 'REGULAR' : cj >= 1 ? 'RUIM' : 'CRITICO',
      interpretacao: `O EBITDA cobre ${cj.toFixed(2)}x as despesas financeiras.`,
      ideal: '> 3x',
      cor: cj >= 3 ? '#22c55e' : cj >= 2 ? '#f59e0b' : '#ef4444'
    });
  }
  
  return indicadores;
}

/**
 * Calcula indicadores de atividade
 */
export function calcularIndicadoresAtividade(balanco: DadosBalanco, dre: DadosDRE): AnaliseIndicador[] {
  const indicadores: AnaliseIndicador[] = [];
  const ativoTotal = balanco.ativoCirculante + balanco.ativoNaoCirculante;
  
  // PMR - Prazo Médio de Recebimento
  if (balanco.contasReceber !== undefined) {
    const pmr = (balanco.contasReceber / dre.receita) * 360;
    indicadores.push({
      nome: 'PMR (Prazo Médio Receb.)',
      valor: pmr,
      valorFormatado: `${pmr.toFixed(0)} dias`,
      status: pmr <= 30 ? 'OTIMO' : pmr <= 45 ? 'BOM' : pmr <= 60 ? 'REGULAR' : pmr <= 90 ? 'RUIM' : 'CRITICO',
      interpretacao: `Em média, a empresa leva ${pmr.toFixed(0)} dias para receber suas vendas.`,
      ideal: '< 45 dias',
      cor: pmr <= 45 ? '#22c55e' : pmr <= 60 ? '#f59e0b' : '#ef4444'
    });
  }
  
  // PMP - Prazo Médio de Pagamento
  if (balanco.fornecedores !== undefined) {
    const pmp = (balanco.fornecedores / dre.custoMercadorias) * 360;
    indicadores.push({
      nome: 'PMP (Prazo Médio Pgto.)',
      valor: pmp,
      valorFormatado: `${pmp.toFixed(0)} dias`,
      status: pmp >= 60 ? 'OTIMO' : pmp >= 45 ? 'BOM' : pmp >= 30 ? 'REGULAR' : pmp >= 15 ? 'RUIM' : 'CRITICO',
      interpretacao: `Em média, a empresa leva ${pmp.toFixed(0)} dias para pagar fornecedores.`,
      ideal: '> PMR',
      cor: pmp >= 45 ? '#22c55e' : pmp >= 30 ? '#f59e0b' : '#ef4444'
    });
  }
  
  // PME - Prazo Médio de Estocagem
  if (balanco.estoques !== undefined) {
    const pme = (balanco.estoques / dre.custoMercadorias) * 360;
    indicadores.push({
      nome: 'PME (Prazo Médio Estoque)',
      valor: pme,
      valorFormatado: `${pme.toFixed(0)} dias`,
      status: pme <= 30 ? 'OTIMO' : pme <= 60 ? 'BOM' : pme <= 90 ? 'REGULAR' : pme <= 120 ? 'RUIM' : 'CRITICO',
      interpretacao: `Os estoques levam em média ${pme.toFixed(0)} dias para serem vendidos.`,
      ideal: '< 60 dias',
      cor: pme <= 60 ? '#22c55e' : pme <= 90 ? '#f59e0b' : '#ef4444'
    });
  }
  
  // Giro do Ativo
  const ga = dre.receita / ativoTotal;
  indicadores.push({
    nome: 'Giro do Ativo',
    valor: ga,
    valorFormatado: `${ga.toFixed(2)}x`,
    status: ga >= 2 ? 'OTIMO' : ga >= 1.5 ? 'BOM' : ga >= 1 ? 'REGULAR' : ga >= 0.5 ? 'RUIM' : 'CRITICO',
    interpretacao: `Os ativos "giraram" ${ga.toFixed(2)}x no período (receita/ativo).`,
    ideal: '> 1x',
    cor: ga >= 1 ? '#22c55e' : ga >= 0.5 ? '#f59e0b' : '#ef4444'
  });
  
  // Ciclo Operacional e Financeiro
  if (balanco.contasReceber !== undefined && balanco.estoques !== undefined && balanco.fornecedores !== undefined) {
    const pmr = (balanco.contasReceber / dre.receita) * 360;
    const pme = (balanco.estoques / dre.custoMercadorias) * 360;
    const pmp = (balanco.fornecedores / dre.custoMercadorias) * 360;
    
    const cicloOperacional = pme + pmr;
    const cicloFinanceiro = cicloOperacional - pmp;
    
    indicadores.push({
      nome: 'Ciclo Financeiro',
      valor: cicloFinanceiro,
      valorFormatado: `${cicloFinanceiro.toFixed(0)} dias`,
      status: cicloFinanceiro <= 15 ? 'OTIMO' : cicloFinanceiro <= 30 ? 'BOM' : cicloFinanceiro <= 60 ? 'REGULAR' : cicloFinanceiro <= 90 ? 'RUIM' : 'CRITICO',
      interpretacao: `A empresa precisa financiar ${cicloFinanceiro.toFixed(0)} dias de operação com capital próprio.`,
      ideal: '< 30 dias',
      cor: cicloFinanceiro <= 30 ? '#22c55e' : cicloFinanceiro <= 60 ? '#f59e0b' : '#ef4444'
    });
  }
  
  return indicadores;
}

/**
 * Realiza análise DuPont completa
 */
export function analiseDuPont(balanco: DadosBalanco, dre: DadosDRE): AnaliseDuPont {
  const ativoTotal = balanco.ativoCirculante + balanco.ativoNaoCirculante;
  
  const margemLiquida = (dre.lucroLiquido / dre.receita) * 100;
  const giroAtivo = dre.receita / ativoTotal;
  const multiplicadorAlavancagem = ativoTotal / balanco.patrimonioLiquido;
  const roe = margemLiquida * giroAtivo * multiplicadorAlavancagem / 100;
  
  return {
    roe: roe * 100,
    margemLiquida,
    giroAtivo,
    multiplicadorAlavancagem,
    decomposicao: `ROE = ${margemLiquida.toFixed(2)}% × ${giroAtivo.toFixed(2)} × ${multiplicadorAlavancagem.toFixed(2)} = ${(roe * 100).toFixed(2)}%`
  };
}

/**
 * Gera análise financeira completa
 */
export function gerarAnaliseCompleta(
  empresa: string,
  periodo: string,
  balanco: DadosBalanco,
  dre: DadosDRE
): AnaliseCompleta {
  const liquidez = calcularIndicadoresLiquidez(balanco);
  const rentabilidade = calcularIndicadoresRentabilidade(balanco, dre);
  const endividamento = calcularIndicadoresEndividamento(balanco, dre);
  const atividade = calcularIndicadoresAtividade(balanco, dre);
  
  const todosIndicadores = [...liquidez, ...rentabilidade, ...endividamento, ...atividade];
  
  // Calcular score geral
  const pontuacao = {
    'OTIMO': 100,
    'BOM': 75,
    'REGULAR': 50,
    'RUIM': 25,
    'CRITICO': 0
  };
  
  const score = todosIndicadores.reduce((acc, ind) => acc + pontuacao[ind.status], 0) / todosIndicadores.length;
  
  // Identificar pontos fortes e de atenção
  const pontosFortres = todosIndicadores
    .filter(i => i.status === 'OTIMO' || i.status === 'BOM')
    .map(i => `${i.nome}: ${i.valorFormatado} - ${i.interpretacao}`);
  
  const pontosAtencao = todosIndicadores
    .filter(i => i.status === 'RUIM' || i.status === 'CRITICO')
    .map(i => `${i.nome}: ${i.valorFormatado} - ${i.interpretacao}`);
  
  // Gerar diagnóstico
  let diagnostico = '';
  if (score >= 75) {
    diagnostico = 'A empresa apresenta uma situação financeira saudável, com bons indicadores em todas as áreas analisadas.';
  } else if (score >= 50) {
    diagnostico = 'A empresa apresenta uma situação financeira regular, com alguns pontos de atenção que merecem acompanhamento.';
  } else if (score >= 25) {
    diagnostico = 'A empresa apresenta uma situação financeira preocupante, necessitando de ações corretivas urgentes.';
  } else {
    diagnostico = 'A empresa está em situação crítica, necessitando de intervenção imediata para evitar problemas de continuidade.';
  }
  
  // Gerar recomendações
  const recomendacoes: string[] = [];
  
  if (liquidez.some(i => i.status === 'RUIM' || i.status === 'CRITICO')) {
    recomendacoes.push('Renegociar prazos com fornecedores para melhorar a liquidez');
    recomendacoes.push('Acelerar recebimentos através de políticas de desconto');
  }
  
  if (endividamento.some(i => i.status === 'RUIM' || i.status === 'CRITICO')) {
    recomendacoes.push('Buscar alongamento do perfil da dívida (curto para longo prazo)');
    recomendacoes.push('Avaliar possibilidade de aporte de capital dos sócios');
  }
  
  if (rentabilidade.some(i => i.status === 'RUIM' || i.status === 'CRITICO')) {
    recomendacoes.push('Revisar estrutura de custos e despesas operacionais');
    recomendacoes.push('Avaliar política de preços e margem de contribuição por produto');
  }
  
  if (atividade.some(i => i.status === 'RUIM' || i.status === 'CRITICO')) {
    recomendacoes.push('Implementar gestão mais eficiente de estoques');
    recomendacoes.push('Revisar política de crédito e cobrança');
  }
  
  return {
    empresa,
    periodo,
    dataAnalise: new Date().toISOString(),
    indicadores: {
      liquidez,
      rentabilidade,
      endividamento,
      atividade
    },
    diagnostico,
    recomendacoes,
    pontosFortres,
    pontosAtencao,
    score: Math.round(score)
  };
}

/**
 * Gera projeção de fluxo de caixa
 */
export function projetarFluxoCaixa(
  saldoInicial: number,
  entradas: number[],
  saidas: number[],
  meses: string[]
): ProjecaoFluxoCaixa[] {
  const projecoes: ProjecaoFluxoCaixa[] = [];
  let saldo = saldoInicial;
  
  for (let i = 0; i < meses.length; i++) {
    const entrada = entradas[i] || 0;
    const saida = saidas[i] || 0;
    const saldoFinal = saldo + entrada - saida;
    const variacao = entrada - saida;
    
    projecoes.push({
      periodo: meses[i],
      saldoInicial: saldo,
      entradas: entrada,
      saidas: saida,
      saldoFinal,
      variacao
    });
    
    saldo = saldoFinal;
  }
  
  return projecoes;
}

/**
 * Calcula necessidade de capital de giro
 */
export function calcularNCG(balanco: DadosBalanco, dre: DadosDRE): {
  ncg: number;
  explicacao: string;
  recomendacao: string;
} {
  const pmr = balanco.contasReceber ? (balanco.contasReceber / dre.receita) * 360 : 30;
  const pme = balanco.estoques ? (balanco.estoques / dre.custoMercadorias) * 360 : 30;
  const pmp = balanco.fornecedores ? (balanco.fornecedores / dre.custoMercadorias) * 360 : 30;
  
  const cicloFinanceiro = pmr + pme - pmp;
  const receitaDiaria = dre.receita / 360;
  const ncg = cicloFinanceiro * receitaDiaria;
  
  return {
    ncg,
    explicacao: `Com ciclo financeiro de ${cicloFinanceiro.toFixed(0)} dias e receita diária de R$ ${receitaDiaria.toFixed(2)}, a NCG é de R$ ${ncg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    recomendacao: ncg > 0 
      ? 'A empresa precisa de capital de giro para financiar suas operações. Avalie linhas de crédito ou antecipação de recebíveis.'
      : 'A empresa gera capital de giro próprio. Os fornecedores financiam parte das operações.'
  };
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================

export const AgenteMBA = {
  calcularIndicadoresLiquidez,
  calcularIndicadoresRentabilidade,
  calcularIndicadoresEndividamento,
  calcularIndicadoresAtividade,
  analiseDuPont,
  gerarAnaliseCompleta,
  projetarFluxoCaixa,
  calcularNCG,
  buscarIndicador,
  buscarIndicadoresPorCategoria,
  indicadores: INDICADORES_FINANCEIROS
};

export default AgenteMBA;
