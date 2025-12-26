/**
 * Identificação de PIX e Pagamentos de Clientes
 *
 * Este módulo contém a inteligência para identificar pagamentos PIX
 * em importações de extrato bancário e associar a clientes.
 */

// Padrões de descrição PIX nos bancos
export const padroesPIX = {
  descricoes: [
    /PIX\s+RECEBIDO/i,
    /PIX\s+-\s+/i,
    /RECEBIMENTO\s+PIX/i,
    /PIX\s+TRANSF\s+RECEBIDA/i,
    /CRED\s+PIX/i,
    /PIX\s+QR\s+CODE/i,
    /PIX\s+DINAMICO/i,
    /PIX\s+ESTATICO/i
  ],

  // Extrair CPF/CNPJ do PIX
  regexCPF: /(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[-\s]?\d{2})/,
  regexCNPJ: /(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2})/,

  // Extrair nome do pagador
  regexNome: /(?:PIX\s+(?:RECEBIDO|TRANSF\s+RECEBIDA)\s*-?\s*)([A-Z\s]+?)(?:\s+\d|\s+CPF|\s+CNPJ|$)/i
};

// Função para identificar se transação é PIX
export function ehPIX(descricao: string): boolean {
  return padroesPIX.descricoes.some(regex => regex.test(descricao));
}

// Função para extrair dados do PIX
export function extrairDadosPIX(descricao: string): {
  ehPix: boolean;
  cpf?: string;
  cnpj?: string;
  nome?: string;
} {
  const resultado: any = { ehPix: ehPIX(descricao) };

  if (!resultado.ehPix) return resultado;

  // Extrair CPF
  const matchCPF = descricao.match(padroesPIX.regexCPF);
  if (matchCPF) {
    resultado.cpf = matchCPF[1].replace(/[.\-\s]/g, "");
  }

  // Extrair CNPJ
  const matchCNPJ = descricao.match(padroesPIX.regexCNPJ);
  if (matchCNPJ) {
    resultado.cnpj = matchCNPJ[1].replace(/[.\-\/\s]/g, "");
  }

  // Extrair Nome
  const matchNome = descricao.match(padroesPIX.regexNome);
  if (matchNome) {
    resultado.nome = matchNome[1].trim();
  }

  return resultado;
}

// Estratégias de match de cliente
export const estrategiasMatch = {
  // Match por CNPJ exato
  porCNPJ: {
    prioridade: 1,
    confianca: 0.98,
    descricao: "Match exato por CNPJ do cliente"
  },

  // Match por CPF de sócio
  porCPFSocio: {
    prioridade: 2,
    confianca: 0.95,
    descricao: "Match por CPF encontrado no QSA (sócios) do cliente"
  },

  // Match por nome exato
  porNomeExato: {
    prioridade: 3,
    confianca: 0.90,
    descricao: "Match exato pelo nome do cliente ou razão social"
  },

  // Match por nome fantasia
  porNomeFantasia: {
    prioridade: 4,
    confianca: 0.85,
    descricao: "Match pelo nome fantasia"
  },

  // Match por nome de sócio
  porNomeSocio: {
    prioridade: 5,
    confianca: 0.80,
    descricao: "Match pelo nome de sócio encontrado no QSA"
  },

  // Match por valor exato de honorário
  porValorHonorario: {
    prioridade: 6,
    confianca: 0.75,
    descricao: "Match por valor exato corresponde a honorário pendente"
  },

  // Match por similaridade de nome
  porSimilaridade: {
    prioridade: 7,
    confianca: 0.60,
    descricao: "Match por similaridade de nome (Levenshtein)"
  }
};

// Interface para resultado de identificação
export interface ResultadoIdentificacao {
  encontrado: boolean;
  clienteId?: string;
  clienteNome?: string;
  estrategia?: string;
  confianca: number;
  faturasSugeridas?: Array<{
    id: string;
    competencia: string;
    valor: number;
  }>;
  multiplasOpcoes?: Array<{
    clienteId: string;
    clienteNome: string;
    motivo: string;
  }>;
  pergunta?: string;
}

// Regras de inadimplência
export const regrasInadimplencia = {
  // Classificação por dias de atraso
  classificacao: {
    emDia: { diasAtraso: 0, cor: "verde", acao: "Nenhuma" },
    lembrete: { diasAtraso: 1, cor: "amarelo", acao: "Enviar lembrete por e-mail" },
    cobrancaAmigavel: { diasAtraso: 7, cor: "laranja", acao: "Contato via WhatsApp" },
    cobrancaFirme: { diasAtraso: 15, cor: "laranja-escuro", acao: "Ligação telefônica" },
    negociacao: { diasAtraso: 30, cor: "vermelho", acao: "Agendar reunião de negociação" },
    suspensao: { diasAtraso: 60, cor: "vermelho-escuro", acao: "Suspender serviços + carta formal" },
    juridico: { diasAtraso: 90, cor: "preto", acao: "Encaminhar para cobrança judicial" }
  },

  // Métricas de inadimplência
  metricas: {
    taxaAceitavel: 0.05, // 5%
    taxaCritica: 0.10, // 10%
    ticketMedioAlerta: 5000, // Valor alto merece atenção especial
    clienteReincidente: 3 // Mais de 3 atrasos no ano
  },

  // Templates de mensagem por fase
  templates: {
    lembrete: `Olá {cliente},
Esperamos que esteja bem! Este é um lembrete amigável de que o honorário referente a {competencia} no valor de R$ {valor} venceu ontem.
Para sua comodidade, segue nossa chave PIX: {pix}
Caso já tenha efetuado o pagamento, por favor desconsidere.
Atenciosamente, Ampla Contabilidade`,

    cobrancaAmigavel: `Olá {cliente},
Notamos que o honorário de {competencia} (R$ {valor}) está em aberto há {dias} dias.
Gostaríamos de verificar se houve algum problema ou se podemos ajudar de alguma forma.
PIX: {pix}
Qualquer dúvida, estamos à disposição!`,

    cobrancaFirme: `Prezado(a) {cliente},
Entramos em contato para tratar do honorário de {competencia} (R$ {valor}), vencido há {dias} dias.
Pedimos que regularize o pagamento para evitar a suspensão dos serviços.
Em caso de dificuldades, estamos abertos a negociar um parcelamento.`,

    suspensao: `Prezado(a) {cliente},
Informamos que, devido à inadimplência de {dias} dias referente ao(s) honorário(s) no valor total de R$ {valorTotal}, os serviços contábeis serão SUSPENSOS a partir de {dataSuspensao}.
Para regularização e reativação dos serviços, entre em contato conosco.
Esta comunicação também será enviada por carta registrada.`
  }
};

// Função para calcular score de match
export function calcularScoreMatch(
  descricaoTransacao: string,
  cliente: {
    nome: string;
    cnpj?: string;
    nomeFantasia?: string;
    qsa?: Array<{ nome: string; cpf?: string }>;
  }
): number {
  const dadosPix = extrairDadosPIX(descricaoTransacao);
  let melhorScore = 0;

  // Match por CNPJ
  if (dadosPix.cnpj && cliente.cnpj) {
    const cnpjLimpo = cliente.cnpj.replace(/[.\-\/]/g, "");
    if (cnpjLimpo === dadosPix.cnpj) {
      return 0.98; // Match exato por CNPJ
    }
  }

  // Match por CPF de sócio
  if (dadosPix.cpf && cliente.qsa) {
    for (const socio of cliente.qsa) {
      if (socio.cpf) {
        const cpfLimpo = socio.cpf.replace(/[.\-]/g, "");
        if (cpfLimpo === dadosPix.cpf) {
          return 0.95; // Match por CPF de sócio
        }
      }
    }
  }

  // Match por nome
  if (dadosPix.nome) {
    const nomeNormalizado = normalizarNome(dadosPix.nome);

    // Nome do cliente
    if (calcularSimilaridade(nomeNormalizado, normalizarNome(cliente.nome)) > 0.85) {
      melhorScore = Math.max(melhorScore, 0.90);
    }

    // Nome fantasia
    if (cliente.nomeFantasia && calcularSimilaridade(nomeNormalizado, normalizarNome(cliente.nomeFantasia)) > 0.85) {
      melhorScore = Math.max(melhorScore, 0.85);
    }

    // Nome de sócio
    if (cliente.qsa) {
      for (const socio of cliente.qsa) {
        if (calcularSimilaridade(nomeNormalizado, normalizarNome(socio.nome)) > 0.80) {
          melhorScore = Math.max(melhorScore, 0.80);
        }
      }
    }
  }

  return melhorScore;
}

// Função auxiliar para normalizar nome
function normalizarNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^A-Z\s]/g, "") // Remove caracteres especiais
    .replace(/\s+/g, " ") // Normaliza espaços
    .trim();
}

// Função para calcular similaridade (Levenshtein simplificado)
function calcularSimilaridade(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const maior = Math.max(str1.length, str2.length);
  if (maior === 0) return 1;

  // Verifica se um contém o outro
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.9;
  }

  // Conta palavras em comum
  const palavras1 = str1.split(" ");
  const palavras2 = str2.split(" ");
  let palavrasComuns = 0;

  for (const p1 of palavras1) {
    if (p1.length > 2 && palavras2.some((p2) => p2.includes(p1) || p1.includes(p2))) {
      palavrasComuns++;
    }
  }

  return palavrasComuns / Math.max(palavras1.length, palavras2.length);
}

export default {
  padroesPIX,
  ehPIX,
  extrairDadosPIX,
  estrategiasMatch,
  regrasInadimplencia,
  calcularScoreMatch
};
