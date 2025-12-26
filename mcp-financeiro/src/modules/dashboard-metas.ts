/**
 * Módulo de Dashboard de Metas e OKRs
 *
 * Este módulo gerencia metas empresariais usando a metodologia OKR:
 * - Objectives (Objetivos estratégicos)
 * - Key Results (Resultados-chave mensuráveis)
 * - Initiatives (Iniciativas para atingir os resultados)
 *
 * Aplicado ao contexto de escritório de contabilidade
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface Objetivo {
  id: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  periodo: { inicio: string; fim: string };
  area: AreaNegocio;
  prioridade: "alta" | "media" | "baixa";
  status: StatusOKR;
  keyResults: KeyResult[];
  progresso: number; // 0-100
}

export interface KeyResult {
  id: string;
  objetivoId: string;
  titulo: string;
  metrica: string;
  valorInicial: number;
  valorMeta: number;
  valorAtual: number;
  unidade: string;
  frequenciaAtualizacao: "diaria" | "semanal" | "mensal";
  ultimaAtualizacao: string;
  iniciativas: Iniciativa[];
  progresso: number;
  tendencia: "subindo" | "estavel" | "caindo";
}

export interface Iniciativa {
  id: string;
  keyResultId: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  dataInicio: string;
  dataFim: string;
  status: "pendente" | "em_andamento" | "concluida" | "bloqueada";
  impactoEstimado: number; // 0-100
}

export type AreaNegocio =
  | "comercial"
  | "operacional"
  | "financeiro"
  | "pessoas"
  | "qualidade"
  | "tecnologia";

export type StatusOKR =
  | "nao_iniciado"
  | "em_andamento"
  | "em_risco"
  | "atrasado"
  | "concluido"
  | "cancelado";

export interface DashboardOKR {
  periodo: string;
  visaoGeral: {
    totalObjetivos: number;
    progressoMedio: number;
    objetivosEmRisco: number;
    objetivosConcluidos: number;
  };
  porArea: Record<AreaNegocio, {
    objetivos: number;
    progressoMedio: number;
    status: StatusOKR;
  }>;
  objetivos: Objetivo[];
  alertas: AlertaOKR[];
  ranking: { responsavel: string; progresso: number; objetivos: number }[];
}

export interface AlertaOKR {
  tipo: "critico" | "atencao" | "info" | "sucesso";
  mensagem: string;
  objetivoId?: string;
  acao?: string;
}

// ============================================
// METAS PADRÃO PARA ESCRITÓRIO CONTÁBIL
// ============================================

export const metasPadraoContabilidade = {
  comercial: [
    {
      titulo: "Aumentar carteira de clientes",
      metrica: "Novos clientes/mês",
      valorMeta: 5,
      unidade: "clientes"
    },
    {
      titulo: "Aumentar receita recorrente",
      metrica: "MRR",
      valorMeta: 100000,
      unidade: "R$"
    },
    {
      titulo: "Reduzir churn de clientes",
      metrica: "Taxa de churn",
      valorMeta: 2,
      unidade: "%"
    }
  ],

  operacional: [
    {
      titulo: "Entregar obrigações no prazo",
      metrica: "% entregas no prazo",
      valorMeta: 98,
      unidade: "%"
    },
    {
      titulo: "Reduzir retrabalho",
      metrica: "Taxa de retrabalho",
      valorMeta: 5,
      unidade: "%"
    },
    {
      titulo: "Aumentar automação",
      metrica: "Processos automatizados",
      valorMeta: 80,
      unidade: "%"
    }
  ],

  financeiro: [
    {
      titulo: "Reduzir inadimplência",
      metrica: "Taxa de inadimplência",
      valorMeta: 5,
      unidade: "%"
    },
    {
      titulo: "Aumentar margem de lucro",
      metrica: "Margem líquida",
      valorMeta: 30,
      unidade: "%"
    },
    {
      titulo: "Melhorar fluxo de caixa",
      metrica: "Dias de caixa",
      valorMeta: 60,
      unidade: "dias"
    }
  ],

  pessoas: [
    {
      titulo: "Reduzir turnover",
      metrica: "Taxa de turnover",
      valorMeta: 10,
      unidade: "%"
    },
    {
      titulo: "Capacitar equipe",
      metrica: "Horas de treinamento/colaborador",
      valorMeta: 40,
      unidade: "horas"
    },
    {
      titulo: "Melhorar satisfação",
      metrica: "eNPS",
      valorMeta: 50,
      unidade: "pontos"
    }
  ],

  qualidade: [
    {
      titulo: "Aumentar satisfação do cliente",
      metrica: "NPS",
      valorMeta: 70,
      unidade: "pontos"
    },
    {
      titulo: "Reduzir erros em entregas",
      metrica: "Taxa de erros",
      valorMeta: 1,
      unidade: "%"
    },
    {
      titulo: "Melhorar tempo de resposta",
      metrica: "SLA atendimento",
      valorMeta: 24,
      unidade: "horas"
    }
  ],

  tecnologia: [
    {
      titulo: "Digitalizar processos",
      metrica: "Processos digitais",
      valorMeta: 90,
      unidade: "%"
    },
    {
      titulo: "Implementar integrações",
      metrica: "Integrações ativas",
      valorMeta: 10,
      unidade: "sistemas"
    },
    {
      titulo: "Garantir segurança",
      metrica: "Incidentes de segurança",
      valorMeta: 0,
      unidade: "incidentes"
    }
  ]
};

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula o progresso de um Key Result (0-100)
 */
export function calcularProgressoKR(kr: KeyResult): number {
  const diferenca = kr.valorMeta - kr.valorInicial;
  if (diferenca === 0) return kr.valorAtual >= kr.valorMeta ? 100 : 0;

  const avanco = kr.valorAtual - kr.valorInicial;
  const progresso = (avanco / diferenca) * 100;

  return Math.min(Math.max(progresso, 0), 100);
}

/**
 * Calcula o progresso de um Objetivo (média dos KRs)
 */
export function calcularProgressoObjetivo(objetivo: Objetivo): number {
  if (objetivo.keyResults.length === 0) return 0;

  const somaProgresso = objetivo.keyResults.reduce(
    (sum, kr) => sum + calcularProgressoKR(kr),
    0
  );

  return somaProgresso / objetivo.keyResults.length;
}

/**
 * Determina o status de um Objetivo baseado no progresso e prazo
 */
export function determinarStatusOKR(objetivo: Objetivo): StatusOKR {
  const progresso = calcularProgressoObjetivo(objetivo);
  const hoje = new Date();
  const fim = new Date(objetivo.periodo.fim);
  const inicio = new Date(objetivo.periodo.inicio);

  // Calcular % do período decorrido
  const totalDias = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
  const diasPassados = (hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
  const percentualTempo = (diasPassados / totalDias) * 100;

  if (progresso >= 100) return "concluido";
  if (hoje > fim && progresso < 100) return "atrasado";
  if (progresso < percentualTempo - 20) return "em_risco";
  if (progresso < percentualTempo - 10) return "em_andamento";
  if (diasPassados <= 0) return "nao_iniciado";

  return "em_andamento";
}

/**
 * Calcula a tendência de um KR baseado nos últimos valores
 */
export function calcularTendencia(
  valoresHistoricos: number[]
): "subindo" | "estavel" | "caindo" {
  if (valoresHistoricos.length < 3) return "estavel";

  const ultimos = valoresHistoricos.slice(-3);
  const media = ultimos.reduce((sum, v) => sum + v, 0) / ultimos.length;
  const ultimo = ultimos[ultimos.length - 1];

  if (ultimo > media * 1.05) return "subindo";
  if (ultimo < media * 0.95) return "caindo";
  return "estavel";
}

/**
 * Gera alertas baseado nos OKRs
 */
export function gerarAlertasOKR(objetivos: Objetivo[]): AlertaOKR[] {
  const alertas: AlertaOKR[] = [];
  const hoje = new Date();

  for (const obj of objetivos) {
    const progresso = calcularProgressoObjetivo(obj);
    const status = determinarStatusOKR(obj);
    const fim = new Date(obj.periodo.fim);
    const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    // Objetivo atrasado
    if (status === "atrasado") {
      alertas.push({
        tipo: "critico",
        mensagem: `"${obj.titulo}" está atrasado (${progresso.toFixed(0)}%)`,
        objetivoId: obj.id,
        acao: "Revisar plano de ação urgentemente"
      });
    }

    // Objetivo em risco
    if (status === "em_risco") {
      alertas.push({
        tipo: "atencao",
        mensagem: `"${obj.titulo}" está em risco (${progresso.toFixed(0)}%)`,
        objetivoId: obj.id,
        acao: "Intensificar iniciativas"
      });
    }

    // Prazo próximo
    if (diasRestantes > 0 && diasRestantes <= 15 && progresso < 80) {
      alertas.push({
        tipo: "atencao",
        mensagem: `"${obj.titulo}" vence em ${diasRestantes} dias com ${progresso.toFixed(0)}%`,
        objetivoId: obj.id,
        acao: "Priorizar conclusão"
      });
    }

    // Objetivo concluído
    if (status === "concluido") {
      alertas.push({
        tipo: "sucesso",
        mensagem: `"${obj.titulo}" foi concluído!`,
        objetivoId: obj.id
      });
    }

    // KRs sem atualização
    for (const kr of obj.keyResults) {
      const ultimaAtt = new Date(kr.ultimaAtualizacao);
      const diasSemAtualizacao = Math.ceil(
        (hoje.getTime() - ultimaAtt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const limites = {
        diaria: 2,
        semanal: 10,
        mensal: 35
      };

      if (diasSemAtualizacao > limites[kr.frequenciaAtualizacao]) {
        alertas.push({
          tipo: "info",
          mensagem: `KR "${kr.titulo}" sem atualização há ${diasSemAtualizacao} dias`,
          objetivoId: obj.id,
          acao: "Atualizar métricas"
        });
      }
    }
  }

  return alertas.sort((a, b) => {
    const ordem = { critico: 0, atencao: 1, info: 2, sucesso: 3 };
    return ordem[a.tipo] - ordem[b.tipo];
  });
}

/**
 * Gera o dashboard completo de OKRs
 */
export function gerarDashboardOKR(objetivos: Objetivo[], periodo: string): DashboardOKR {
  // Atualizar progresso e status de cada objetivo
  for (const obj of objetivos) {
    for (const kr of obj.keyResults) {
      kr.progresso = calcularProgressoKR(kr);
    }
    obj.progresso = calcularProgressoObjetivo(obj);
    obj.status = determinarStatusOKR(obj);
  }

  // Visão geral
  const progressoMedio = objetivos.length > 0
    ? objetivos.reduce((sum, o) => sum + o.progresso, 0) / objetivos.length
    : 0;

  const visaoGeral = {
    totalObjetivos: objetivos.length,
    progressoMedio,
    objetivosEmRisco: objetivos.filter(o =>
      o.status === "em_risco" || o.status === "atrasado"
    ).length,
    objetivosConcluidos: objetivos.filter(o => o.status === "concluido").length
  };

  // Por área
  const areas: AreaNegocio[] = ["comercial", "operacional", "financeiro", "pessoas", "qualidade", "tecnologia"];
  const porArea: Record<AreaNegocio, any> = {} as any;

  for (const area of areas) {
    const objArea = objetivos.filter(o => o.area === area);
    porArea[area] = {
      objetivos: objArea.length,
      progressoMedio: objArea.length > 0
        ? objArea.reduce((sum, o) => sum + o.progresso, 0) / objArea.length
        : 0,
      status: objArea.some(o => o.status === "em_risco" || o.status === "atrasado")
        ? "em_risco"
        : "em_andamento"
    };
  }

  // Ranking de responsáveis
  const responsaveisMap = new Map<string, { progresso: number; count: number }>();
  for (const obj of objetivos) {
    const atual = responsaveisMap.get(obj.responsavel) || { progresso: 0, count: 0 };
    responsaveisMap.set(obj.responsavel, {
      progresso: atual.progresso + obj.progresso,
      count: atual.count + 1
    });
  }

  const ranking = Array.from(responsaveisMap.entries())
    .map(([responsavel, dados]) => ({
      responsavel,
      progresso: dados.progresso / dados.count,
      objetivos: dados.count
    }))
    .sort((a, b) => b.progresso - a.progresso);

  // Alertas
  const alertas = gerarAlertasOKR(objetivos);

  return {
    periodo,
    visaoGeral,
    porArea,
    objetivos,
    alertas,
    ranking
  };
}

/**
 * Formata o dashboard para exibição
 */
export function formatarDashboardOKR(dashboard: DashboardOKR): string {
  let texto = `🎯 **DASHBOARD DE OKRs**\n`;
  texto += `Período: ${dashboard.periodo}\n\n`;

  texto += `📊 **Visão Geral**\n`;
  texto += `• Total de Objetivos: ${dashboard.visaoGeral.totalObjetivos}\n`;
  texto += `• Progresso Médio: ${dashboard.visaoGeral.progressoMedio.toFixed(1)}%\n`;
  texto += `• Concluídos: ${dashboard.visaoGeral.objetivosConcluidos}\n`;
  texto += `• Em Risco: ${dashboard.visaoGeral.objetivosEmRisco}\n\n`;

  texto += `📈 **Por Área**\n`;
  for (const [area, dados] of Object.entries(dashboard.porArea)) {
    if (dados.objetivos > 0) {
      const icone = dados.status === "em_risco" ? "⚠️" : "✅";
      texto += `${icone} ${area.charAt(0).toUpperCase() + area.slice(1)}: `;
      texto += `${dados.objetivos} obj. | ${dados.progressoMedio.toFixed(0)}%\n`;
    }
  }

  if (dashboard.ranking.length > 0) {
    texto += `\n🏆 **Top Performers**\n`;
    for (const r of dashboard.ranking.slice(0, 3)) {
      texto += `• ${r.responsavel}: ${r.progresso.toFixed(0)}% (${r.objetivos} obj.)\n`;
    }
  }

  if (dashboard.alertas.length > 0) {
    texto += `\n🚨 **Alertas (${dashboard.alertas.length})**\n`;
    for (const alerta of dashboard.alertas.slice(0, 5)) {
      const icone = {
        critico: "🔴",
        atencao: "🟡",
        info: "🔵",
        sucesso: "🟢"
      }[alerta.tipo];
      texto += `${icone} ${alerta.mensagem}\n`;
    }
    if (dashboard.alertas.length > 5) {
      texto += `... e mais ${dashboard.alertas.length - 5} alertas\n`;
    }
  }

  texto += `\n📋 **Objetivos**\n`;
  for (const obj of dashboard.objetivos.slice(0, 5)) {
    const barra = gerarBarraProgresso(obj.progresso);
    const statusIcon = {
      nao_iniciado: "⬜",
      em_andamento: "🔵",
      em_risco: "🟡",
      atrasado: "🔴",
      concluido: "✅",
      cancelado: "⛔"
    }[obj.status];

    texto += `${statusIcon} ${obj.titulo}\n`;
    texto += `   ${barra} ${obj.progresso.toFixed(0)}%\n`;
  }

  return texto;
}

/**
 * Gera uma barra de progresso visual
 */
export function gerarBarraProgresso(progresso: number): string {
  const largura = 10;
  const preenchido = Math.round((progresso / 100) * largura);
  const vazio = largura - preenchido;

  return "█".repeat(preenchido) + "░".repeat(vazio);
}

/**
 * Cria um objetivo padrão
 */
export function criarObjetivoPadrao(
  area: AreaNegocio,
  indice: number,
  periodo: { inicio: string; fim: string },
  responsavel: string
): Objetivo {
  const metas = metasPadraoContabilidade[area];
  const meta = metas[indice % metas.length];

  return {
    id: `${area}-${Date.now()}-${indice}`,
    titulo: meta.titulo,
    descricao: `Objetivo de ${area} para o período`,
    responsavel,
    periodo,
    area,
    prioridade: "media",
    status: "nao_iniciado",
    keyResults: [{
      id: `kr-${Date.now()}-${indice}`,
      objetivoId: "",
      titulo: meta.titulo,
      metrica: meta.metrica,
      valorInicial: 0,
      valorMeta: meta.valorMeta,
      valorAtual: 0,
      unidade: meta.unidade,
      frequenciaAtualizacao: "semanal",
      ultimaAtualizacao: new Date().toISOString().split("T")[0],
      iniciativas: [],
      progresso: 0,
      tendencia: "estavel"
    }],
    progresso: 0
  };
}

export default {
  metasPadraoContabilidade,
  calcularProgressoKR,
  calcularProgressoObjetivo,
  determinarStatusOKR,
  calcularTendencia,
  gerarAlertasOKR,
  gerarDashboardOKR,
  formatarDashboardOKR,
  gerarBarraProgresso,
  criarObjetivoPadrao
};
