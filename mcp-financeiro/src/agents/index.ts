/**
 * Agentes de IA Especializados - MCP Financeiro
 *
 * Estes agentes encapsulam toda a inteligência de negócio da Ampla Contabilidade.
 * Cada agente é especialista em uma área e pode ser acionado via MCP.
 */

export interface AgentContext {
  competencia?: string;
  clienteId?: string;
  dados?: any;
}

export interface AgentResponse {
  sucesso: boolean;
  agente: string;
  analise: string;
  insights: string[];
  recomendacoes: string[];
  alertas: string[];
  dados?: any;
}

// ============================================
// AGENTE CONTADOR (Dr. Cícero)
// ============================================

export const agenteContador = {
  nome: "Dr. Cícero",
  especialidade: "Contabilidade e Conformidade",
  formacao: [
    "Contador CRC-GO",
    "Especialista em NBC/CFC",
    "Mestre em Contabilidade Tributária",
  ],

  async analisarLancamento(lancamento: any): Promise<AgentResponse> {
    const alertas: string[] = [];
    const recomendacoes: string[] = [];

    // Validar partida dobrada
    if (Math.abs(lancamento.debito - lancamento.credito) > 0.01) {
      alertas.push("CRÍTICO: Lançamento não está em equilíbrio (débito ≠ crédito)");
    }

    // Validar conta de despesa
    if (lancamento.contaCodigo?.startsWith("4") && lancamento.valor > 10000) {
      recomendacoes.push("Verificar se despesa acima de R$ 10.000 possui documentação fiscal adequada");
    }

    // Validar adiantamentos
    if (lancamento.descricao?.toLowerCase().includes("pessoal") && !lancamento.contaCodigo?.startsWith("1.1.3.04")) {
      alertas.push("Despesa pessoal deve ser classificada como Adiantamento a Sócios (1.1.3.04.xx)");
    }

    return {
      sucesso: alertas.length === 0,
      agente: this.nome,
      analise: `Análise do lançamento ${lancamento.id || "novo"}`,
      insights: [
        `Conta: ${lancamento.contaCodigo} - ${lancamento.contaNome}`,
        `Natureza: ${lancamento.debito > lancamento.credito ? "Devedora" : "Credora"}`,
      ],
      recomendacoes,
      alertas,
    };
  },

  async validarDRE(dre: any): Promise<AgentResponse> {
    const alertas: string[] = [];
    const insights: string[] = [];

    const margem = parseFloat(dre.margem_liquida?.replace("%", "") || "0");

    if (margem < 0) {
      alertas.push("ATENÇÃO: Resultado negativo no período - empresa operando com prejuízo");
    } else if (margem < 10) {
      alertas.push("Margem líquida abaixo de 10% - considerar revisão de custos");
    } else if (margem > 30) {
      insights.push("Excelente margem líquida - empresa muito rentável");
    }

    return {
      sucesso: true,
      agente: this.nome,
      analise: "Análise da DRE conforme NBC TG 26",
      insights,
      recomendacoes: [
        "Manter controle rigoroso das despesas operacionais",
        "Revisar precificação dos honorários periodicamente",
      ],
      alertas,
      dados: dre,
    };
  },
};

// ============================================
// AGENTE FINANCEIRO (Dona Tereza)
// ============================================

export const agenteFinanceiro = {
  nome: "Dona Tereza",
  especialidade: "Gestão Financeira e Fluxo de Caixa",
  formacao: [
    "MBA em Finanças Corporativas",
    "Especialista em Tesouraria",
    "20 anos de experiência em escritórios contábeis",
  ],

  async analisarFluxoCaixa(dados: any): Promise<AgentResponse> {
    const alertas: string[] = [];
    const recomendacoes: string[] = [];

    // Calcular cobertura de caixa
    const entradas = dados.receitaRecebida || 0;
    const saidas = dados.despesaTotal || 0;
    const saldoAtual = dados.saldoBancario || 0;

    if (saldoAtual < saidas * 2) {
      alertas.push(`Reserva de caixa insuficiente: saldo atual cobre apenas ${(saldoAtual / saidas).toFixed(1)} meses de despesas`);
      recomendacoes.push("Constituir reserva de emergência equivalente a 3 meses de despesas");
    }

    if (entradas < saidas) {
      alertas.push("Fluxo de caixa negativo: saídas superam entradas no período");
    }

    return {
      sucesso: alertas.filter(a => a.includes("CRÍTICO")).length === 0,
      agente: this.nome,
      analise: "Análise de Fluxo de Caixa e Liquidez",
      insights: [
        `Entradas previstas: R$ ${entradas.toLocaleString("pt-BR")}`,
        `Saídas previstas: R$ ${saidas.toLocaleString("pt-BR")}`,
        `Saldo projetado: R$ ${(saldoAtual + entradas - saidas).toLocaleString("pt-BR")}`,
      ],
      recomendacoes,
      alertas,
    };
  },

  async analisarInadimplencia(dados: any): Promise<AgentResponse> {
    const alertas: string[] = [];
    const recomendacoes: string[] = [];
    const insights: string[] = [];

    const totalInadimplente = dados.total_valor_devido || 0;
    const qtdClientes = dados.total_inadimplentes || 0;

    if (qtdClientes > 0) {
      const ticketMedio = totalInadimplente / qtdClientes;
      insights.push(`${qtdClientes} clientes inadimplentes`);
      insights.push(`Ticket médio em atraso: R$ ${ticketMedio.toLocaleString("pt-BR")}`);

      if (qtdClientes > 10) {
        alertas.push("Alto número de clientes inadimplentes - revisar política de crédito");
      }

      recomendacoes.push("Priorizar cobrança dos maiores devedores");
      recomendacoes.push("Implementar régua de cobrança automatizada");
      recomendacoes.push("Considerar protesto de títulos para dívidas > 60 dias");
    }

    return {
      sucesso: true,
      agente: this.nome,
      analise: "Análise de Inadimplência e Recuperação de Crédito",
      insights,
      recomendacoes,
      alertas,
      dados,
    };
  },
};

// ============================================
// AGENTE DE COBRANÇA (Sr. Augusto)
// ============================================

export const agenteCobranca = {
  nome: "Sr. Augusto",
  especialidade: "Cobrança e Negociação",
  formacao: [
    "Especialista em Recuperação de Crédito",
    "Técnicas de Negociação Harvard",
    "Psicologia do Devedor",
  ],

  regraCobranca: {
    "D+1": { acao: "Lembrete amigável", canal: "E-mail" },
    "D+7": { acao: "Cobrança gentil", canal: "WhatsApp" },
    "D+15": { acao: "Contato direto", canal: "Telefone" },
    "D+30": { acao: "Negociação formal", canal: "Reunião" },
    "D+60": { acao: "Medidas legais", canal: "Jurídico" },
  },

  async sugerirAcaoCobranca(cliente: any, diasAtraso: number): Promise<AgentResponse> {
    const recomendacoes: string[] = [];
    let acao = "";
    let canal = "";

    if (diasAtraso <= 1) {
      acao = "Enviar lembrete de vencimento";
      canal = "E-mail automático";
    } else if (diasAtraso <= 7) {
      acao = "Contato via WhatsApp com tom amigável";
      canal = "WhatsApp Business";
      recomendacoes.push("Usar mensagem personalizada com nome do cliente");
      recomendacoes.push("Oferecer facilidades de pagamento (PIX, parcelamento)");
    } else if (diasAtraso <= 15) {
      acao = "Ligação telefônica para entender situação";
      canal = "Telefone";
      recomendacoes.push("Preparar script de abordagem");
      recomendacoes.push("Verificar se há problema operacional (boleto não recebido, etc)");
    } else if (diasAtraso <= 30) {
      acao = "Agendar reunião de negociação";
      canal = "Presencial ou Video";
      recomendacoes.push("Preparar proposta de parcelamento");
      recomendacoes.push("Considerar desconto para pagamento à vista");
    } else if (diasAtraso <= 60) {
      acao = "Enviar carta de cobrança formal";
      canal = "Correio com AR";
      recomendacoes.push("Mencionar possibilidade de protesto");
      recomendacoes.push("Oferecer última chance de acordo");
    } else {
      acao = "Encaminhar para departamento jurídico";
      canal = "Processo judicial";
      recomendacoes.push("Preparar documentação para protesto");
      recomendacoes.push("Avaliar custo-benefício da ação judicial");
    }

    return {
      sucesso: true,
      agente: this.nome,
      analise: `Estratégia de cobrança para ${diasAtraso} dias de atraso`,
      insights: [
        `Cliente: ${cliente.nome}`,
        `Dias em atraso: ${diasAtraso}`,
        `Valor devido: ${cliente.valorDevido}`,
      ],
      recomendacoes: [
        `AÇÃO: ${acao}`,
        `CANAL: ${canal}`,
        ...recomendacoes,
      ],
      alertas: diasAtraso > 60 ? ["Cliente em risco de perda - ação urgente necessária"] : [],
    };
  },

  async gerarScriptCobranca(cliente: any, contexto: string): Promise<string> {
    return `
Olá ${cliente.nome},

Espero que esteja bem! Aqui é da Ampla Contabilidade.

Notamos que o honorário referente a ${contexto} ainda está em aberto.
Gostaríamos de verificar se houve algum problema com o boleto ou se podemos ajudar de alguma forma.

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Para sua comodidade, segue nossa chave PIX: [CNPJ DA AMPLA]

Ficamos à disposição!

Atenciosamente,
Equipe Ampla Contabilidade
    `.trim();
  },
};

// ============================================
// AGENTE GESTOR (MBA)
// ============================================

export const agenteGestor = {
  nome: "Dr. Fernando",
  especialidade: "Gestão Empresarial e Estratégia",
  formacao: [
    "MBA Harvard Business School",
    "MBA Wharton - Operations",
    "CFA Level III",
    "Six Sigma Black Belt",
  ],

  benchmarkSetor: {
    margemLiquida: { ideal: 25, minimo: 15, critico: 5 },
    inadimplencia: { ideal: 3, maximo: 5, critico: 10 },
    folhaPagamento: { ideal: 40, maximo: 50, critico: 55 },
    aluguel: { ideal: 8, maximo: 10, critico: 12 },
    marketing: { ideal: 3, maximo: 5, critico: 8 },
  },

  async diagnosticoEmpresarial(dados: any): Promise<AgentResponse> {
    const alertas: string[] = [];
    const insights: string[] = [];
    const recomendacoes: string[] = [];

    // Analisar margem
    const margem = dados.margem || 0;
    if (margem < this.benchmarkSetor.margemLiquida.critico) {
      alertas.push(`CRÍTICO: Margem de ${margem}% está abaixo do mínimo aceitável (${this.benchmarkSetor.margemLiquida.critico}%)`);
    } else if (margem < this.benchmarkSetor.margemLiquida.minimo) {
      alertas.push(`ATENÇÃO: Margem de ${margem}% está abaixo do ideal (${this.benchmarkSetor.margemLiquida.minimo}%)`);
    } else if (margem >= this.benchmarkSetor.margemLiquida.ideal) {
      insights.push(`Excelente margem de ${margem}% - acima do benchmark do setor`);
    }

    // Analisar inadimplência
    const inadimplencia = dados.taxaInadimplencia || 0;
    if (inadimplencia > this.benchmarkSetor.inadimplencia.critico) {
      alertas.push(`CRÍTICO: Taxa de inadimplência de ${inadimplencia}% muito acima do aceitável`);
      recomendacoes.push("Implementar régua de cobrança automatizada");
      recomendacoes.push("Revisar critérios de aceitação de clientes");
    }

    // Recomendações estratégicas
    recomendacoes.push("Implementar Balanced Scorecard para acompanhamento de KPIs");
    recomendacoes.push("Revisar precificação anualmente com base em custos + margem alvo");
    recomendacoes.push("Segmentar clientes por rentabilidade (análise ABC)");

    return {
      sucesso: alertas.filter(a => a.includes("CRÍTICO")).length === 0,
      agente: this.nome,
      analise: "Diagnóstico Empresarial - Metodologia MBA",
      insights,
      recomendacoes,
      alertas,
      dados: {
        kpis: {
          margem,
          inadimplencia,
        },
        benchmark: this.benchmarkSetor,
      },
    };
  },

  async analisarRentabilidadeCliente(cliente: any): Promise<AgentResponse> {
    const insights: string[] = [];
    const recomendacoes: string[] = [];

    const honorario = cliente.honorarioMensal || 0;
    const custoAtendimento = cliente.custoEstimado || honorario * 0.6; // Estimativa
    const margem = ((honorario - custoAtendimento) / honorario) * 100;

    if (margem < 20) {
      insights.push(`Cliente com margem baixa (${margem.toFixed(1)}%)`);
      recomendacoes.push("Avaliar reajuste de honorário");
      recomendacoes.push("Verificar escopo de serviços vs. contrato");
    } else if (margem > 40) {
      insights.push(`Cliente altamente rentável (${margem.toFixed(1)}%)`);
      recomendacoes.push("Priorizar atendimento e fidelização");
    }

    return {
      sucesso: true,
      agente: this.nome,
      analise: `Análise de Rentabilidade - ${cliente.nome}`,
      insights,
      recomendacoes,
      alertas: [],
    };
  },
};

// ============================================
// AGENTE DE CONTRATOS (Dra. Mariana)
// ============================================

export const agenteContratos = {
  nome: "Dra. Mariana",
  especialidade: "Contratos e Compliance",
  formacao: [
    "Advogada OAB",
    "Especialista em Direito Empresarial",
    "Certificação em Compliance",
  ],

  async analisarContrato(contrato: any): Promise<AgentResponse> {
    const alertas: string[] = [];
    const recomendacoes: string[] = [];

    // Verificar vencimento
    const hoje = new Date();
    const vencimento = new Date(contrato.dataVencimento);
    const diasParaVencer = Math.floor((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diasParaVencer < 0) {
      alertas.push(`CRÍTICO: Contrato vencido há ${Math.abs(diasParaVencer)} dias`);
      recomendacoes.push("Providenciar renovação imediata");
    } else if (diasParaVencer < 30) {
      alertas.push(`ATENÇÃO: Contrato vence em ${diasParaVencer} dias`);
      recomendacoes.push("Iniciar processo de renovação");
    } else if (diasParaVencer < 90) {
      recomendacoes.push("Agendar reunião de renovação com cliente");
    }

    // Verificar reajuste
    if (contrato.mesesSemReajuste > 12) {
      recomendacoes.push(`Honorário sem reajuste há ${contrato.mesesSemReajuste} meses - aplicar correção`);
    }

    return {
      sucesso: alertas.filter(a => a.includes("CRÍTICO")).length === 0,
      agente: this.nome,
      analise: `Análise de Contrato - ${contrato.cliente}`,
      insights: [
        `Vigência: ${contrato.dataInicio} a ${contrato.dataVencimento}`,
        `Honorário: R$ ${contrato.valor?.toLocaleString("pt-BR")}`,
      ],
      recomendacoes,
      alertas,
    };
  },
};

// ============================================
// EXPORTAR TODOS OS AGENTES
// ============================================

export const agentes = {
  contador: agenteContador,
  financeiro: agenteFinanceiro,
  cobranca: agenteCobranca,
  gestor: agenteGestor,
  contratos: agenteContratos,
};

export default agentes;
