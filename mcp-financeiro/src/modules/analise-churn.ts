/**
 * Módulo de Análise de Churn de Clientes
 *
 * Este módulo analisa o risco de perda de clientes baseado em:
 * - Histórico de pagamentos
 * - Engajamento com o escritório
 * - Satisfação (tickets/reclamações)
 * - Tempo de relacionamento
 * - Sinais de alerta
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface ClienteAnalise {
  id: string;
  nome: string;
  cnpj: string;
  dataInicio: string;
  honorarioMensal: number;
  ultimoPagamento?: string;
  mediaAtraso: number;
  ticketsAbertos: number;
  reclamacoesUltimos6Meses: number;
  ultimoContato?: string;
  tempoRelacionamentoMeses: number;
  regime: "simples" | "presumido" | "real" | "mei";
  faturamentoMensal?: number;
  complexidadeFiscal: "baixa" | "media" | "alta";
}

export interface ScoreChurn {
  clienteId: string;
  clienteNome: string;
  score: number; // 0-100 (maior = maior risco)
  risco: "baixo" | "medio" | "alto" | "critico";
  fatores: FatorRisco[];
  acaoRecomendada: string;
  impactoFinanceiro: number;
  probabilidadeChurn: number;
}

export interface FatorRisco {
  nome: string;
  peso: number;
  valor: number;
  contribuicao: number;
  descricao: string;
}

export interface AnaliseChurnGeral {
  data: string;
  totalClientes: number;
  clientesEmRisco: number;
  receitaEmRisco: number;
  distribuicaoRisco: {
    baixo: number;
    medio: number;
    alto: number;
    critico: number;
  };
  topRiscos: ScoreChurn[];
  indicadoresGerais: IndicadoresChurn;
  acoesRecomendadas: AcaoRecomendada[];
}

export interface IndicadoresChurn {
  taxaChurnHistorica: number;
  ltv: number; // Lifetime Value médio
  custoAquisicao: number;
  tempoMedioRelacionamento: number;
  nps?: number;
}

export interface AcaoRecomendada {
  prioridade: "alta" | "media" | "baixa";
  acao: string;
  clientesAfetados: number;
  impactoFinanceiro: number;
  prazo: string;
}

// ============================================
// CONFIGURAÇÕES E PESOS
// ============================================

export const configChurn = {
  // Pesos para cada fator (soma = 100)
  pesos: {
    atrasosPagamento: 25,
    tempoRelacionamento: 15,
    ticketsReclamacoes: 20,
    ultimoContato: 15,
    complexidade: 10,
    valorContrato: 15
  },

  // Limites de risco
  limites: {
    baixo: 25,
    medio: 50,
    alto: 75,
    critico: 100
  },

  // Parâmetros de cálculo
  parametros: {
    diasAtrasoAlerta: 15,
    diasAtrasoRisco: 30,
    mesesSemContatoAlerta: 2,
    mesesSemContatoCritico: 4,
    reclamacoesAlerta: 2,
    reclamacoesCritico: 4,
    ticketsAbertosCritico: 3,
    mesesFidelizacao: 24, // 2 anos = cliente fidelizado
    honorarioMinimoRelevante: 500
  }
};

// ============================================
// SINAIS DE ALERTA
// ============================================

export const sinaisAlerta = {
  comportamentais: [
    { sinal: "Não abre emails há mais de 30 dias", peso: 15 },
    { sinal: "Reduziu contatos com o escritório", peso: 10 },
    { sinal: "Pediu orçamento em outro escritório", peso: 25 },
    { sinal: "Questionou valores do honorário", peso: 20 },
    { sinal: "Atrasou pagamentos consecutivos", peso: 25 },
    { sinal: "Não responde mensagens", peso: 15 }
  ],

  operacionais: [
    { sinal: "Empresa sem movimento há 3+ meses", peso: 30 },
    { sinal: "Faturamento caindo significativamente", peso: 25 },
    { sinal: "Demitiu funcionários", peso: 15 },
    { sinal: "Não renovou certificado digital", peso: 20 },
    { sinal: "Pendências fiscais não resolvidas", peso: 20 }
  ],

  relacionamento: [
    { sinal: "Mudança de contador responsável", peso: 10 },
    { sinal: "Reclamação formal registrada", peso: 25 },
    { sinal: "NPS detrator (<6)", peso: 30 },
    { sinal: "Tempo de resposta alto nos tickets", peso: 15 }
  ]
};

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula score de risco por atraso de pagamento
 */
export function calcularScoreAtraso(mediaAtraso: number): number {
  if (mediaAtraso <= 0) return 0;
  if (mediaAtraso <= 7) return 15;
  if (mediaAtraso <= 15) return 35;
  if (mediaAtraso <= 30) return 60;
  if (mediaAtraso <= 60) return 80;
  return 100;
}

/**
 * Calcula score de risco por tempo de relacionamento
 * (clientes novos têm mais risco)
 */
export function calcularScoreTempoRelacionamento(meses: number): number {
  if (meses >= 36) return 0;   // 3+ anos = muito fidelizado
  if (meses >= 24) return 15;  // 2 anos = fidelizado
  if (meses >= 12) return 35;  // 1 ano = consolidando
  if (meses >= 6) return 55;   // 6 meses = risco médio
  if (meses >= 3) return 75;   // 3 meses = alto risco
  return 90;                   // < 3 meses = muito alto
}

/**
 * Calcula score por reclamações e tickets
 */
export function calcularScoreReclamacoes(
  reclamacoes: number,
  ticketsAbertos: number
): number {
  let score = 0;

  // Reclamações
  if (reclamacoes >= 4) score += 50;
  else if (reclamacoes >= 2) score += 30;
  else if (reclamacoes >= 1) score += 15;

  // Tickets abertos
  if (ticketsAbertos >= 3) score += 50;
  else if (ticketsAbertos >= 2) score += 30;
  else if (ticketsAbertos >= 1) score += 10;

  return Math.min(score, 100);
}

/**
 * Calcula score por último contato
 */
export function calcularScoreContato(ultimoContato?: string): number {
  if (!ultimoContato) return 70; // Sem registro = risco alto

  const hoje = new Date();
  const dataContato = new Date(ultimoContato);
  const diasSemContato = Math.floor((hoje.getTime() - dataContato.getTime()) / (1000 * 60 * 60 * 24));

  if (diasSemContato <= 30) return 0;
  if (diasSemContato <= 60) return 25;
  if (diasSemContato <= 90) return 50;
  if (diasSemContato <= 120) return 75;
  return 100;
}

/**
 * Calcula score por complexidade x valor
 * (clientes com alta complexidade e baixo valor = risco de insatisfação)
 */
export function calcularScoreComplexidadeValor(
  complexidade: "baixa" | "media" | "alta",
  honorario: number
): number {
  const valorPorComplexidade = {
    baixa: 500,
    media: 1500,
    alta: 3000
  };

  const valorEsperado = valorPorComplexidade[complexidade];
  const ratio = honorario / valorEsperado;

  if (ratio >= 1.2) return 0;   // Paga bem acima do esperado
  if (ratio >= 1.0) return 15;  // Paga o esperado
  if (ratio >= 0.8) return 35;  // Paga próximo do esperado
  if (ratio >= 0.6) return 55;  // Paga abaixo
  if (ratio >= 0.4) return 75;  // Paga muito abaixo
  return 100;                   // Subcobrado crítico
}

/**
 * Calcula o score geral de churn para um cliente
 */
export function calcularScoreChurn(cliente: ClienteAnalise): ScoreChurn {
  const fatores: FatorRisco[] = [];
  const pesos = configChurn.pesos;

  // 1. Atraso de pagamento
  const scoreAtraso = calcularScoreAtraso(cliente.mediaAtraso);
  fatores.push({
    nome: "Histórico de Pagamento",
    peso: pesos.atrasosPagamento,
    valor: scoreAtraso,
    contribuicao: (scoreAtraso * pesos.atrasosPagamento) / 100,
    descricao: cliente.mediaAtraso > 15
      ? `Média de ${cliente.mediaAtraso} dias de atraso`
      : "Pagamentos em dia"
  });

  // 2. Tempo de relacionamento
  const scoreRelacionamento = calcularScoreTempoRelacionamento(cliente.tempoRelacionamentoMeses);
  fatores.push({
    nome: "Tempo de Relacionamento",
    peso: pesos.tempoRelacionamento,
    valor: scoreRelacionamento,
    contribuicao: (scoreRelacionamento * pesos.tempoRelacionamento) / 100,
    descricao: cliente.tempoRelacionamentoMeses >= 24
      ? "Cliente fidelizado"
      : `${cliente.tempoRelacionamentoMeses} meses de relacionamento`
  });

  // 3. Tickets e reclamações
  const scoreTickets = calcularScoreReclamacoes(
    cliente.reclamacoesUltimos6Meses,
    cliente.ticketsAbertos
  );
  fatores.push({
    nome: "Satisfação/Tickets",
    peso: pesos.ticketsReclamacoes,
    valor: scoreTickets,
    contribuicao: (scoreTickets * pesos.ticketsReclamacoes) / 100,
    descricao: cliente.reclamacoesUltimos6Meses > 0
      ? `${cliente.reclamacoesUltimos6Meses} reclamações, ${cliente.ticketsAbertos} tickets abertos`
      : "Sem reclamações"
  });

  // 4. Último contato
  const scoreContato = calcularScoreContato(cliente.ultimoContato);
  fatores.push({
    nome: "Engajamento",
    peso: pesos.ultimoContato,
    valor: scoreContato,
    contribuicao: (scoreContato * pesos.ultimoContato) / 100,
    descricao: cliente.ultimoContato
      ? `Último contato: ${new Date(cliente.ultimoContato).toLocaleDateString("pt-BR")}`
      : "Sem registro de contato"
  });

  // 5. Complexidade x Valor
  const scoreComplexidade = calcularScoreComplexidadeValor(
    cliente.complexidadeFiscal,
    cliente.honorarioMensal
  );
  fatores.push({
    nome: "Relação Custo/Benefício",
    peso: pesos.complexidade,
    valor: scoreComplexidade,
    contribuicao: (scoreComplexidade * pesos.complexidade) / 100,
    descricao: scoreComplexidade > 50
      ? "Honorário abaixo da complexidade"
      : "Honorário adequado"
  });

  // 6. Valor do contrato (clientes menores têm mais risco)
  const valorNormalizado = Math.min(cliente.honorarioMensal / 3000, 1) * 100;
  const scoreValor = 100 - valorNormalizado;
  fatores.push({
    nome: "Relevância Financeira",
    peso: pesos.valorContrato,
    valor: scoreValor,
    contribuicao: (scoreValor * pesos.valorContrato) / 100,
    descricao: `Honorário: R$ ${cliente.honorarioMensal.toLocaleString("pt-BR")}`
  });

  // Cálculo do score final
  const scoreTotal = fatores.reduce((sum, f) => sum + f.contribuicao, 0);

  // Determina nível de risco
  let risco: "baixo" | "medio" | "alto" | "critico";
  if (scoreTotal < configChurn.limites.baixo) risco = "baixo";
  else if (scoreTotal < configChurn.limites.medio) risco = "medio";
  else if (scoreTotal < configChurn.limites.alto) risco = "alto";
  else risco = "critico";

  // Probabilidade de churn (baseada no score)
  const probabilidadeChurn = Math.min(scoreTotal * 1.2, 100) / 100;

  // Impacto financeiro (LTV projetado)
  const mesesRestantes = Math.max(24 - cliente.tempoRelacionamentoMeses, 6);
  const impactoFinanceiro = cliente.honorarioMensal * mesesRestantes * probabilidadeChurn;

  // Ação recomendada
  let acaoRecomendada = "";
  if (risco === "critico") {
    acaoRecomendada = "URGENTE: Ligar imediatamente. Agendar reunião para entender problemas.";
  } else if (risco === "alto") {
    acaoRecomendada = "Agendar visita ou call. Revisar contrato e oferecer benefícios.";
  } else if (risco === "medio") {
    acaoRecomendada = "Enviar pesquisa de satisfação. Estreitar relacionamento.";
  } else {
    acaoRecomendada = "Manter relacionamento. Enviar conteúdo de valor.";
  }

  return {
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    score: Math.round(scoreTotal),
    risco,
    fatores,
    acaoRecomendada,
    impactoFinanceiro,
    probabilidadeChurn
  };
}

/**
 * Analisa lista de clientes e gera relatório geral
 */
export function analisarChurnGeral(clientes: ClienteAnalise[]): AnaliseChurnGeral {
  const scores = clientes.map(calcularScoreChurn);

  const distribuicao = {
    baixo: scores.filter(s => s.risco === "baixo").length,
    medio: scores.filter(s => s.risco === "medio").length,
    alto: scores.filter(s => s.risco === "alto").length,
    critico: scores.filter(s => s.risco === "critico").length
  };

  const clientesEmRisco = scores.filter(s => s.risco === "alto" || s.risco === "critico");
  const receitaEmRisco = clientesEmRisco.reduce((sum, s) => {
    const cliente = clientes.find(c => c.id === s.clienteId);
    return sum + (cliente?.honorarioMensal || 0);
  }, 0);

  // Top 10 maiores riscos
  const topRiscos = [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Indicadores gerais
  const tempoMedioRelacionamento = clientes.reduce(
    (sum, c) => sum + c.tempoRelacionamentoMeses, 0
  ) / clientes.length;

  const honorarioMedio = clientes.reduce(
    (sum, c) => sum + c.honorarioMensal, 0
  ) / clientes.length;

  // Ações recomendadas agregadas
  const acoesRecomendadas: AcaoRecomendada[] = [];

  if (clientesEmRisco.length > 0) {
    acoesRecomendadas.push({
      prioridade: "alta",
      acao: "Contatar clientes em risco crítico/alto imediatamente",
      clientesAfetados: clientesEmRisco.length,
      impactoFinanceiro: receitaEmRisco * 12,
      prazo: "Esta semana"
    });
  }

  const atrasados = clientes.filter(c => c.mediaAtraso > 30);
  if (atrasados.length > 0) {
    acoesRecomendadas.push({
      prioridade: "alta",
      acao: "Negociar parcelamento com inadimplentes crônicos",
      clientesAfetados: atrasados.length,
      impactoFinanceiro: atrasados.reduce((sum, c) => sum + c.honorarioMensal, 0) * 6,
      prazo: "Próximos 15 dias"
    });
  }

  const semContato = clientes.filter(c => {
    if (!c.ultimoContato) return true;
    const dias = Math.floor((Date.now() - new Date(c.ultimoContato).getTime()) / (1000 * 60 * 60 * 24));
    return dias > 60;
  });
  if (semContato.length > 0) {
    acoesRecomendadas.push({
      prioridade: "media",
      acao: "Reativar contato com clientes distantes",
      clientesAfetados: semContato.length,
      impactoFinanceiro: semContato.reduce((sum, c) => sum + c.honorarioMensal, 0) * 3,
      prazo: "Este mês"
    });
  }

  const clientesNovos = clientes.filter(c => c.tempoRelacionamentoMeses < 6);
  if (clientesNovos.length > 0) {
    acoesRecomendadas.push({
      prioridade: "media",
      acao: "Intensificar onboarding de clientes novos",
      clientesAfetados: clientesNovos.length,
      impactoFinanceiro: clientesNovos.reduce((sum, c) => sum + c.honorarioMensal, 0) * 12,
      prazo: "Contínuo"
    });
  }

  return {
    data: new Date().toISOString().split("T")[0],
    totalClientes: clientes.length,
    clientesEmRisco: clientesEmRisco.length,
    receitaEmRisco,
    distribuicaoRisco: distribuicao,
    topRiscos,
    indicadoresGerais: {
      taxaChurnHistorica: 0.05, // 5% - valor exemplo
      ltv: honorarioMedio * 24, // LTV = honorário médio * 24 meses
      custoAquisicao: 500, // Custo médio de aquisição
      tempoMedioRelacionamento
    },
    acoesRecomendadas
  };
}

/**
 * Gera relatório de churn formatado
 */
export function gerarRelatorioChurn(analise: AnaliseChurnGeral): string {
  let relatorio = `📊 **ANÁLISE DE RISCO DE CHURN**\n`;
  relatorio += `Data: ${new Date(analise.data).toLocaleDateString("pt-BR")}\n\n`;

  relatorio += `👥 **Visão Geral**\n`;
  relatorio += `• Total de Clientes: ${analise.totalClientes}\n`;
  relatorio += `• Clientes em Risco: ${analise.clientesEmRisco}\n`;
  relatorio += `• Receita em Risco: R$ ${analise.receitaEmRisco.toLocaleString("pt-BR")}/mês\n\n`;

  relatorio += `📈 **Distribuição de Risco**\n`;
  relatorio += `• 🟢 Baixo: ${analise.distribuicaoRisco.baixo} clientes\n`;
  relatorio += `• 🟡 Médio: ${analise.distribuicaoRisco.medio} clientes\n`;
  relatorio += `• 🟠 Alto: ${analise.distribuicaoRisco.alto} clientes\n`;
  relatorio += `• 🔴 Crítico: ${analise.distribuicaoRisco.critico} clientes\n\n`;

  if (analise.topRiscos.length > 0) {
    relatorio += `🚨 **Top 5 Clientes em Risco**\n`;
    for (const risco of analise.topRiscos.slice(0, 5)) {
      const icone = risco.risco === "critico" ? "🔴" : risco.risco === "alto" ? "🟠" : "🟡";
      relatorio += `${icone} ${risco.clienteNome}\n`;
      relatorio += `   Score: ${risco.score}/100 | Prob: ${(risco.probabilidadeChurn * 100).toFixed(0)}%\n`;
      relatorio += `   → ${risco.acaoRecomendada.split(".")[0]}\n\n`;
    }
  }

  if (analise.acoesRecomendadas.length > 0) {
    relatorio += `📋 **Ações Recomendadas**\n`;
    for (const acao of analise.acoesRecomendadas) {
      const icone = acao.prioridade === "alta" ? "🔴" : acao.prioridade === "media" ? "🟡" : "🔵";
      relatorio += `${icone} ${acao.acao}\n`;
      relatorio += `   Afeta ${acao.clientesAfetados} cliente(s) | Prazo: ${acao.prazo}\n`;
    }
  }

  return relatorio;
}

export default {
  configChurn,
  sinaisAlerta,
  calcularScoreChurn,
  analisarChurnGeral,
  gerarRelatorioChurn
};
