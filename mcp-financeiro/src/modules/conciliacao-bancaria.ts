/**
 * Módulo de Conciliação Bancária Automática
 *
 * Este módulo realiza a conciliação automática entre:
 * - Extrato bancário (OFX/CSV)
 * - Lançamentos contábeis
 * - Faturas de clientes
 * - Despesas registradas
 *
 * Baseado no conhecimento do MEMORY.md da Ampla Contabilidade
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface TransacaoBancaria {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  saldo?: number;
  fitId?: string; // ID único do OFX
  conciliado: boolean;
  lancamentoId?: string;
}

export interface LancamentoContabil {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "debito" | "credito";
  contaDebito: string;
  contaCredito: string;
  documento?: string;
  origem: "manual" | "automatico" | "importacao";
  conciliado: boolean;
  transacaoId?: string;
}

export interface ResultadoConciliacao {
  transacaoId: string;
  lancamentoId: string;
  tipoMatch: TipoMatch;
  confianca: number; // 0-100
  diferenca: number;
  observacao: string;
}

export type TipoMatch =
  | "exato"           // Valor e data exatos
  | "valor_exato"     // Apenas valor exato
  | "data_proxima"    // Data próxima (±3 dias)
  | "parcial"         // Match parcial (soma de transações)
  | "sugerido"        // Sugestão baseada em padrões
  | "manual";         // Requer conferência manual

export interface RelatorioConciliacao {
  data: string;
  periodo: { inicio: string; fim: string };
  saldoInicialExtrato: number;
  saldoFinalExtrato: number;
  saldoInicialContabil: number;
  saldoFinalContabil: number;
  diferenca: number;
  transacoesConciliadas: number;
  transacoesPendentes: TransacaoBancaria[];
  lancamentosPendentes: LancamentoContabil[];
  resultados: ResultadoConciliacao[];
  alertas: AlertaConciliacao[];
  estatisticas: EstatisticasConciliacao;
}

export interface AlertaConciliacao {
  tipo: "erro" | "atencao" | "info";
  mensagem: string;
  transacaoId?: string;
  lancamentoId?: string;
  acao?: string;
}

export interface EstatisticasConciliacao {
  totalTransacoes: number;
  totalLancamentos: number;
  matchExato: number;
  matchParcial: number;
  pendentes: number;
  taxaConciliacao: number;
  tempoMedio: number; // em ms
}

// ============================================
// PADRÕES DE IDENTIFICAÇÃO (do MEMORY.md)
// ============================================

export const padroesTransacoes = {
  entradas: {
    pix: [
      /PIX_CRED/i,
      /PIX RECEBIDO/i,
      /RECEBIMENTO PIX/i,
      /PIX\/CREDITO/i
    ],
    boleto: [
      /LIQ\.COBRANCA SIMPLES/i,
      /LIQUIDACAO.*BOLETO.*CRED/i,
      /COBRANCA RECEBIDA/i
    ],
    transferencia: [
      /TED RECEBIDO/i,
      /DOC RECEBIDO/i,
      /CREDITO EM CONTA/i
    ]
  },

  saidas: {
    pix: [
      /PIX_DEB/i,
      /PAGAMENTO PIX/i,
      /PIX ENVIADO/i,
      /PIX\/DEBITO/i
    ],
    boleto: [
      /LIQUIDACAO BOLETO/i,
      /PGTO.*BOLETO/i,
      /PAGAMENTO.*TITULO/i
    ],
    transferencia: [
      /TED ENVIADO/i,
      /DOC ENVIADO/i,
      /DEBITO EM CONTA/i
    ],
    tarifas: [
      /TARIFA/i,
      /MANUTENCAO.*CONTA/i,
      /PACOTE DE SERVICOS/i
    ],
    impostos: [
      /DEBITO ARRECADACAO/i,
      /GPS/i,
      /DARF/i,
      /DAS/i,
      /ISS/i
    ]
  },

  // Padrões específicos da Ampla
  amplaEspecificos: {
    honorarios: [
      /HONORARIOS/i,
      /CONTABILIDADE/i,
      /AMPLA/i
    ],
    folhaPagamento: [
      /SALARIO/i,
      /FOLHA/i,
      /PRO.?LABORE/i,
      /FGTS/i,
      /INSS/i
    ],
    adiantamentoSocios: [
      /SERGIO.*CARNEIRO/i,
      /CARLA.*LEAO/i,
      /VICTOR.*HUGO/i,
      /NAYARA/i,
      /SERGIO.*AUGUSTO/i
    ]
  }
};

// ============================================
// REGRAS DE CLASSIFICAÇÃO AUTOMÁTICA
// ============================================

export const regrasClassificacao = {
  // Contas contábeis por tipo de transação
  // DR. CÍCERO - NBC TG 26: NUNCA usar conta sintética 1.1.2.01 diretamente
  // Usar conta TRANSITÓRIA 1.1.9.01 para recebimentos pendentes de identificação
  contasPorTipo: {
    // RECEBIMENTOS: Vão para TRANSITÓRIA até identificar cliente
    "pix_recebido": { debito: "1.1.1.02", credito: "1.1.9.01", descricao: "Recebimento PIX (pendente identificação)" },
    "boleto_recebido": { debito: "1.1.1.02", credito: "1.1.9.01", descricao: "Recebimento boleto (pendente desmembramento)" },
    "cobranca_agrupada": { debito: "1.1.1.02", credito: "1.1.9.01", descricao: "Cobrança agrupada (usar Super Conciliação)" },
    // PAGAMENTOS: Usam contas analíticas específicas
    "pix_enviado": { debito: "2.1.1.01", credito: "1.1.1.02", descricao: "Pagamento fornecedor" },
    "tarifa_bancaria": { debito: "4.1.5.01", credito: "1.1.1.02", descricao: "Tarifa bancária" },
    "imposto_das": { debito: "2.1.3.01", credito: "1.1.1.02", descricao: "Pagamento DAS" },
    "salario": { debito: "2.1.2.01", credito: "1.1.1.02", descricao: "Pagamento salário" },
    "adiantamento_socio": { debito: "1.1.3.04", credito: "1.1.1.02", descricao: "Adiantamento a sócio" }
  },

  // CONTA TRANSITÓRIA: Usada para recebimentos pendentes de identificação
  contaTransitoria: {
    code: "1.1.9.01",
    name: "Recebimentos a Conciliar",
    descricao: "Recebimentos que precisam ser desmembrados por cliente na Super Conciliação"
  },

  // Tolerância para match
  tolerancia: {
    dias: 3,         // Dias de diferença aceitos
    valor: 0.01,     // Centavos de diferença aceitos
    valorPercentual: 0.001 // 0.1% de diferença aceita
  }
};

// ============================================
// FUNÇÕES DE IDENTIFICAÇÃO
// ============================================

/**
 * Identifica o tipo de transação pela descrição
 */
export function identificarTipoTransacao(
  descricao: string,
  valor: number
): { tipo: string; categoria: string; confianca: number } {
  const desc = descricao.toUpperCase();

  // Verificar entradas
  if (valor > 0) {
    for (const [pattern] of padroesTransacoes.entradas.pix.entries()) {
      if (padroesTransacoes.entradas.pix[pattern].test(desc)) {
        return { tipo: "pix_recebido", categoria: "receita", confianca: 90 };
      }
    }
    for (const pattern of padroesTransacoes.entradas.boleto) {
      if (pattern.test(desc)) {
        return { tipo: "boleto_recebido", categoria: "receita", confianca: 90 };
      }
    }
    return { tipo: "credito_outros", categoria: "receita", confianca: 50 };
  }

  // Verificar saídas
  for (const pattern of padroesTransacoes.saidas.tarifas) {
    if (pattern.test(desc)) {
      return { tipo: "tarifa_bancaria", categoria: "despesa_operacional", confianca: 95 };
    }
  }

  for (const pattern of padroesTransacoes.saidas.impostos) {
    if (pattern.test(desc)) {
      return { tipo: "imposto_das", categoria: "imposto", confianca: 85 };
    }
  }

  for (const pattern of padroesTransacoes.amplaEspecificos.folhaPagamento) {
    if (pattern.test(desc)) {
      return { tipo: "salario", categoria: "folha", confianca: 85 };
    }
  }

  for (const pattern of padroesTransacoes.amplaEspecificos.adiantamentoSocios) {
    if (pattern.test(desc)) {
      return { tipo: "adiantamento_socio", categoria: "adiantamento", confianca: 95 };
    }
  }

  for (const pattern of padroesTransacoes.saidas.pix) {
    if (pattern.test(desc)) {
      return { tipo: "pix_enviado", categoria: "pagamento", confianca: 80 };
    }
  }

  return { tipo: "debito_outros", categoria: "outros", confianca: 30 };
}

/**
 * Extrai dados de PIX da descrição
 */
export function extrairDadosPIX(descricao: string): {
  nome?: string;
  cpfCnpj?: string;
  banco?: string;
} {
  const resultado: { nome?: string; cpfCnpj?: string; banco?: string } = {};

  // Padrão: "PIX RECEBIDO - NOME DO PAGADOR - CPF/CNPJ"
  const partes = descricao.split(/[-–]/);

  if (partes.length >= 2) {
    resultado.nome = partes[1]?.trim();
  }

  // Extrair CPF (11 dígitos) ou CNPJ (14 dígitos)
  const cpfMatch = descricao.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  const cnpjMatch = descricao.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);

  if (cnpjMatch) {
    resultado.cpfCnpj = cnpjMatch[0].replace(/\D/g, "");
  } else if (cpfMatch) {
    resultado.cpfCnpj = cpfMatch[0].replace(/\D/g, "");
  }

  return resultado;
}

// ============================================
// FUNÇÕES DE CONCILIAÇÃO
// ============================================

/**
 * Calcula a similaridade entre duas strings (0-1)
 */
export function calcularSimilaridade(str1: string, str2: string): number {
  const s1 = str1.toUpperCase().replace(/\s+/g, " ").trim();
  const s2 = str2.toUpperCase().replace(/\s+/g, " ").trim();

  if (s1 === s2) return 1;

  const palavras1 = new Set(s1.split(" "));
  const palavras2 = new Set(s2.split(" "));
  const intersecao = new Set([...palavras1].filter(x => palavras2.has(x)));

  return intersecao.size / Math.max(palavras1.size, palavras2.size);
}

/**
 * Verifica se duas datas estão dentro da tolerância
 */
export function datasProximas(data1: string, data2: string, toleranciaDias: number = 3): boolean {
  const d1 = new Date(data1);
  const d2 = new Date(data2);
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  return diffDias <= toleranciaDias;
}

/**
 * Verifica se dois valores são iguais dentro da tolerância
 */
export function valoresIguais(valor1: number, valor2: number): boolean {
  const diff = Math.abs(valor1 - valor2);
  const toleranciaAbs = regrasClassificacao.tolerancia.valor;
  const toleranciaPerc = Math.abs(valor1) * regrasClassificacao.tolerancia.valorPercentual;

  return diff <= Math.max(toleranciaAbs, toleranciaPerc);
}

/**
 * Encontra matches para uma transação bancária
 */
export function encontrarMatches(
  transacao: TransacaoBancaria,
  lancamentos: LancamentoContabil[]
): ResultadoConciliacao[] {
  const resultados: ResultadoConciliacao[] = [];
  const valorTransacao = Math.abs(transacao.valor);

  for (const lanc of lancamentos) {
    if (lanc.conciliado) continue;

    const valorLanc = Math.abs(lanc.valor);
    const mesmaData = transacao.data === lanc.data;
    const dataProxima = datasProximas(transacao.data, lanc.data);
    const valorExato = valoresIguais(valorTransacao, valorLanc);
    const descSimilar = calcularSimilaridade(transacao.descricao, lanc.descricao);

    if (valorExato && mesmaData) {
      resultados.push({
        transacaoId: transacao.id,
        lancamentoId: lanc.id,
        tipoMatch: "exato",
        confianca: 95,
        diferenca: valorTransacao - valorLanc,
        observacao: "Match exato de valor e data"
      });
    } else if (valorExato && dataProxima) {
      resultados.push({
        transacaoId: transacao.id,
        lancamentoId: lanc.id,
        tipoMatch: "data_proxima",
        confianca: 85,
        diferenca: valorTransacao - valorLanc,
        observacao: `Match de valor com data próxima (${lanc.data})`
      });
    } else if (valorExato) {
      resultados.push({
        transacaoId: transacao.id,
        lancamentoId: lanc.id,
        tipoMatch: "valor_exato",
        confianca: 70,
        diferenca: valorTransacao - valorLanc,
        observacao: "Apenas valor exato, verificar data"
      });
    } else if (descSimilar > 0.5 && dataProxima) {
      resultados.push({
        transacaoId: transacao.id,
        lancamentoId: lanc.id,
        tipoMatch: "sugerido",
        confianca: 50 + descSimilar * 30,
        diferenca: valorTransacao - valorLanc,
        observacao: `Sugestão por similaridade (${(descSimilar * 100).toFixed(0)}%)`
      });
    }
  }

  return resultados.sort((a, b) => b.confianca - a.confianca);
}

/**
 * Realiza a conciliação automática
 */
export function conciliarAutomaticamente(
  transacoes: TransacaoBancaria[],
  lancamentos: LancamentoContabil[],
  confiancaMinima: number = 80
): { conciliados: ResultadoConciliacao[]; pendentes: { transacoes: TransacaoBancaria[]; lancamentos: LancamentoContabil[] } } {
  const conciliados: ResultadoConciliacao[] = [];
  const transacoesPendentes: TransacaoBancaria[] = [];
  const lancamentosConciliados = new Set<string>();

  for (const transacao of transacoes) {
    if (transacao.conciliado) continue;

    const matches = encontrarMatches(
      transacao,
      lancamentos.filter(l => !lancamentosConciliados.has(l.id))
    );

    const melhorMatch = matches.find(m => m.confianca >= confiancaMinima);

    if (melhorMatch) {
      conciliados.push(melhorMatch);
      lancamentosConciliados.add(melhorMatch.lancamentoId);
      transacao.conciliado = true;
      transacao.lancamentoId = melhorMatch.lancamentoId;
    } else {
      transacoesPendentes.push(transacao);
    }
  }

  const lancamentosPendentes = lancamentos.filter(
    l => !l.conciliado && !lancamentosConciliados.has(l.id)
  );

  return {
    conciliados,
    pendentes: {
      transacoes: transacoesPendentes,
      lancamentos: lancamentosPendentes
    }
  };
}

/**
 * Gera relatório completo de conciliação
 */
export function gerarRelatorioConciliacao(
  transacoes: TransacaoBancaria[],
  lancamentos: LancamentoContabil[],
  saldoInicialExtrato: number,
  saldoFinalExtrato: number
): RelatorioConciliacao {
  const inicio = Date.now();

  // Ordenar por data
  const transacoesOrdenadas = [...transacoes].sort((a, b) =>
    new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  // Calcular saldos contábeis (conta banco 1.1.1.02)
  const movimentosContabeis = lancamentos.filter(l =>
    l.contaDebito === "1.1.1.02" || l.contaCredito === "1.1.1.02"
  );

  // Realizar conciliação
  const resultado = conciliarAutomaticamente(transacoesOrdenadas, lancamentos);

  // Estatísticas
  const matchExato = resultado.conciliados.filter(c => c.tipoMatch === "exato").length;
  const matchParcial = resultado.conciliados.filter(c =>
    c.tipoMatch === "parcial" || c.tipoMatch === "sugerido"
  ).length;

  // Alertas
  const alertas: AlertaConciliacao[] = [];

  // Verificar diferença de saldos
  const totalCreditos = transacoesOrdenadas
    .filter(t => t.valor > 0)
    .reduce((sum, t) => sum + t.valor, 0);
  const totalDebitos = transacoesOrdenadas
    .filter(t => t.valor < 0)
    .reduce((sum, t) => sum + Math.abs(t.valor), 0);
  const saldoCalculado = saldoInicialExtrato + totalCreditos - totalDebitos;
  const diferencaSaldo = Math.abs(saldoCalculado - saldoFinalExtrato);

  if (diferencaSaldo > 0.01) {
    alertas.push({
      tipo: "erro",
      mensagem: `Diferença de saldo: R$ ${diferencaSaldo.toFixed(2)}`,
      acao: "Verificar transações faltantes no extrato"
    });
  }

  // Alertar transações de alto valor não conciliadas
  const altoValor = resultado.pendentes.transacoes.filter(t => Math.abs(t.valor) > 1000);
  for (const t of altoValor) {
    alertas.push({
      tipo: "atencao",
      mensagem: `Transação de R$ ${Math.abs(t.valor).toFixed(2)} não conciliada`,
      transacaoId: t.id,
      acao: "Verificar lançamento contábil correspondente"
    });
  }

  // Período
  const datas = transacoesOrdenadas.map(t => t.data);
  const periodo = {
    inicio: datas[0] || new Date().toISOString().split("T")[0],
    fim: datas[datas.length - 1] || new Date().toISOString().split("T")[0]
  };

  return {
    data: new Date().toISOString().split("T")[0],
    periodo,
    saldoInicialExtrato,
    saldoFinalExtrato,
    saldoInicialContabil: saldoInicialExtrato, // Assumindo início igual
    saldoFinalContabil: saldoCalculado,
    diferenca: diferencaSaldo,
    transacoesConciliadas: resultado.conciliados.length,
    transacoesPendentes: resultado.pendentes.transacoes,
    lancamentosPendentes: resultado.pendentes.lancamentos,
    resultados: resultado.conciliados,
    alertas,
    estatisticas: {
      totalTransacoes: transacoes.length,
      totalLancamentos: lancamentos.length,
      matchExato,
      matchParcial,
      pendentes: resultado.pendentes.transacoes.length,
      taxaConciliacao: (resultado.conciliados.length / transacoes.length) * 100,
      tempoMedio: Date.now() - inicio
    }
  };
}

/**
 * Formata relatório para exibição
 */
export function formatarRelatorioConciliacao(relatorio: RelatorioConciliacao): string {
  let texto = `🏦 **RELATÓRIO DE CONCILIAÇÃO BANCÁRIA**\n`;
  texto += `Período: ${relatorio.periodo.inicio} a ${relatorio.periodo.fim}\n\n`;

  texto += `💰 **Saldos**\n`;
  texto += `• Inicial (Extrato): R$ ${relatorio.saldoInicialExtrato.toLocaleString("pt-BR")}\n`;
  texto += `• Final (Extrato): R$ ${relatorio.saldoFinalExtrato.toLocaleString("pt-BR")}\n`;
  texto += `• Final (Contábil): R$ ${relatorio.saldoFinalContabil.toLocaleString("pt-BR")}\n`;
  if (relatorio.diferenca > 0) {
    texto += `• ⚠️ Diferença: R$ ${relatorio.diferenca.toLocaleString("pt-BR")}\n`;
  } else {
    texto += `• ✅ Saldos conferem\n`;
  }

  texto += `\n📊 **Estatísticas**\n`;
  texto += `• Total de Transações: ${relatorio.estatisticas.totalTransacoes}\n`;
  texto += `• Conciliadas: ${relatorio.transacoesConciliadas} (${relatorio.estatisticas.taxaConciliacao.toFixed(1)}%)\n`;
  texto += `• Match Exato: ${relatorio.estatisticas.matchExato}\n`;
  texto += `• Match Parcial: ${relatorio.estatisticas.matchParcial}\n`;
  texto += `• Pendentes: ${relatorio.estatisticas.pendentes}\n`;

  if (relatorio.alertas.length > 0) {
    texto += `\n🚨 **Alertas**\n`;
    for (const alerta of relatorio.alertas) {
      const icone = alerta.tipo === "erro" ? "🔴" : alerta.tipo === "atencao" ? "🟡" : "🔵";
      texto += `${icone} ${alerta.mensagem}\n`;
      if (alerta.acao) {
        texto += `   → ${alerta.acao}\n`;
      }
    }
  }

  if (relatorio.transacoesPendentes.length > 0) {
    texto += `\n📋 **Transações Pendentes (Top 5)**\n`;
    for (const t of relatorio.transacoesPendentes.slice(0, 5)) {
      texto += `• ${t.data}: R$ ${t.valor.toLocaleString("pt-BR")} - ${t.descricao.substring(0, 40)}...\n`;
    }
  }

  return texto;
}

export default {
  padroesTransacoes,
  regrasClassificacao,
  identificarTipoTransacao,
  extrairDadosPIX,
  encontrarMatches,
  conciliarAutomaticamente,
  gerarRelatorioConciliacao,
  formatarRelatorioConciliacao
};
