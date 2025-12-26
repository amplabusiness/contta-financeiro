/**
 * Conhecimento para Emissão de NFS-e (Nota Fiscal de Serviços Eletrônica)
 *
 * Este módulo contém todo o treinamento necessário para emissão correta
 * de notas fiscais de serviços, incluindo regras de ISS, retenções e códigos de serviço.
 */

// Códigos de Serviço (LC 116/2003)
export const codigosServico = {
  // Serviços de contabilidade (principal da Ampla)
  contabilidade: {
    codigo: "17.19",
    descricao: "Contabilidade, inclusive serviços técnicos e auxiliares",
    aliquotaISS: { minima: 0.02, maxima: 0.05 },
    retencaoISS: "Quando tomador for de outro município",
    retencaoFederal: true
  },

  // Outros serviços comuns
  consultoria: {
    codigo: "17.01",
    descricao: "Assessoria ou consultoria de qualquer natureza",
    aliquotaISS: { minima: 0.02, maxima: 0.05 }
  },
  auditoria: {
    codigo: "17.18",
    descricao: "Auditoria",
    aliquotaISS: { minima: 0.02, maxima: 0.05 }
  },
  processamentoDados: {
    codigo: "1.03",
    descricao: "Processamento, armazenamento ou hospedagem de dados",
    aliquotaISS: { minima: 0.02, maxima: 0.05 }
  },
  treinamento: {
    codigo: "8.02",
    descricao: "Instrução, treinamento, orientação pedagógica e educacional",
    aliquotaISS: { minima: 0.02, maxima: 0.05 }
  }
};

// Campos Obrigatórios da NFS-e
export const camposObrigatorios = {
  prestador: {
    campos: [
      "CNPJ",
      "Razão Social",
      "Inscrição Municipal",
      "Endereço Completo",
      "E-mail",
      "Telefone"
    ],
    observacao: "Dados devem estar atualizados no cadastro municipal"
  },
  tomador: {
    campos: [
      "CPF ou CNPJ",
      "Nome/Razão Social",
      "Endereço Completo",
      "E-mail"
    ],
    observacao: "CNPJ deve ser validado na Receita Federal"
  },
  servico: {
    campos: [
      "Código do Serviço (LC 116)",
      "Descrição Detalhada",
      "Valor do Serviço",
      "Alíquota ISS",
      "Município de Prestação"
    ]
  },
  valores: {
    campos: [
      "Valor Total dos Serviços",
      "Deduções (se houver)",
      "Base de Cálculo",
      "ISS",
      "Valor Líquido"
    ]
  }
};

// Retenções na Fonte
export const retencoesNFSe = {
  // ISS Retido
  ISS: {
    descricao: "Imposto Sobre Serviços",
    aliquota: "Conforme legislação municipal (2% a 5%)",
    quandoReter: [
      "Tomador é de município diferente do prestador",
      "Tomador é órgão público",
      "Tomador é empresa de construção civil",
      "Legislação municipal determina"
    ],
    responsavel: "Tomador do serviço",
    campoNFSe: "ISS Retido (Sim/Não)"
  },

  // Retenções Federais
  IRRF: {
    descricao: "Imposto de Renda Retido na Fonte",
    aliquota: 0.015, // 1,5% para PJ
    aplicacao: "Serviços profissionais prestados por PJ",
    baseCalculo: "Valor bruto do serviço",
    dispensa: "Pagamento < R$ 10,00 ou tomador Simples Nacional"
  },

  PIS_COFINS_CSLL: {
    descricao: "Contribuições Sociais Retidas na Fonte (CSRF)",
    aliquotas: {
      PIS: 0.0065,
      COFINS: 0.03,
      CSLL: 0.01
    },
    total: 0.0465, // 4,65%
    aplicacao: "Serviços com valor > R$ 215,05",
    dispensa: [
      "Simples Nacional (prestador ou tomador)",
      "Valor < R$ 215,05"
    ]
  },

  INSS: {
    descricao: "Contribuição Previdenciária",
    aliquota: 0.11, // 11%
    aplicacao: "Cessão de mão de obra ou empreitada",
    servicos: [
      "Limpeza e conservação",
      "Vigilância e segurança",
      "Construção civil",
      "Manutenção"
    ],
    limite: 7786.02 // Teto INSS 2024
  }
};

// Natureza da Operação
export const naturezaOperacao = {
  "1": {
    codigo: "1",
    descricao: "Tributação no Município",
    iss: "Devido onde prestador está estabelecido"
  },
  "2": {
    codigo: "2",
    descricao: "Tributação Fora do Município",
    iss: "Devido onde serviço foi prestado"
  },
  "3": {
    codigo: "3",
    descricao: "Isenção",
    iss: "Isento conforme legislação municipal"
  },
  "4": {
    codigo: "4",
    descricao: "Imune",
    iss: "Entidade imune (templos, partidos, etc)"
  },
  "5": {
    codigo: "5",
    descricao: "Exigibilidade Suspensa por Decisão Judicial",
    iss: "Suspenso por liminar/tutela"
  },
  "6": {
    codigo: "6",
    descricao: "Exigibilidade Suspensa por Procedimento Administrativo",
    iss: "Suspenso por processo administrativo"
  }
};

// Regime Especial de Tributação
export const regimeEspecial = {
  "1": { descricao: "Microempresa Municipal" },
  "2": { descricao: "Estimativa" },
  "3": { descricao: "Sociedade de Profissionais" },
  "4": { descricao: "Cooperativa" },
  "5": { descricao: "MEI - Microempreendedor Individual" },
  "6": { descricao: "ME/EPP - Simples Nacional" }
};

// Validações Obrigatórias
export const validacoesNFSe = {
  cnpjTomador: {
    descricao: "Validar CNPJ na Receita Federal",
    acao: "Consultar situação cadastral",
    alerta: "CNPJ inapto = cliente inadimplente com Receita"
  },
  inscricaoMunicipal: {
    descricao: "Verificar se tomador tem IM",
    quando: "Tomador será responsável pela retenção do ISS"
  },
  valorMinimo: {
    descricao: "Verificar valor mínimo para retenções",
    CSRF: 215.05,
    IRRF: 10.00
  },
  codigoServico: {
    descricao: "Código deve existir na LC 116/2003",
    alerta: "Código errado = autuação fiscal"
  }
};

// Passo a Passo de Emissão
export const passoAPassoEmissao = [
  {
    etapa: 1,
    titulo: "Verificar Dados do Cliente",
    acoes: [
      "Confirmar CNPJ/CPF está correto e ativo",
      "Verificar razão social atualizada",
      "Confirmar endereço completo",
      "Verificar e-mail para envio da nota"
    ]
  },
  {
    etapa: 2,
    titulo: "Definir Serviço e Código",
    acoes: [
      "Selecionar código de serviço correto (LC 116)",
      "Escrever descrição clara e detalhada",
      "Informar período de competência do serviço",
      "Ex: 'Honorários contábeis ref. competência 12/2024'"
    ]
  },
  {
    etapa: 3,
    titulo: "Calcular Valores e Retenções",
    acoes: [
      "Definir valor bruto do serviço",
      "Verificar se há retenção de ISS (tomador de outro município)",
      "Calcular IRRF se aplicável (1,5%)",
      "Calcular CSRF se valor > R$ 215,05 (4,65%)",
      "Calcular INSS se cessão de mão de obra (11%)"
    ]
  },
  {
    etapa: 4,
    titulo: "Preencher NFS-e",
    acoes: [
      "Acessar portal de emissão do município",
      "Preencher dados do tomador",
      "Preencher dados do serviço",
      "Indicar natureza da operação",
      "Marcar retenções aplicáveis",
      "Revisar valores calculados"
    ]
  },
  {
    etapa: 5,
    titulo: "Emitir e Enviar",
    acoes: [
      "Conferir preview da nota antes de emitir",
      "Emitir nota fiscal",
      "Baixar XML e PDF",
      "Enviar por e-mail ao tomador",
      "Arquivar na pasta do cliente"
    ]
  },
  {
    etapa: 6,
    titulo: "Registrar no Sistema",
    acoes: [
      "Vincular NFS-e à fatura do sistema",
      "Registrar número e data da nota",
      "Atualizar status da fatura",
      "Gerar lançamento contábil da receita"
    ]
  }
];

// Erros Comuns e Como Evitar
export const errosComuns = [
  {
    erro: "Código de serviço incorreto",
    consequencia: "Autuação fiscal, multa",
    prevencao: "Consultar LC 116/2003, usar código específico do serviço prestado"
  },
  {
    erro: "Não reter ISS quando obrigatório",
    consequencia: "Tomador responde solidariamente pelo imposto",
    prevencao: "Verificar município do tomador e legislação local"
  },
  {
    erro: "Esquecer de calcular CSRF",
    consequencia: "Pagador pode ter problemas com a Receita",
    prevencao: "Sempre verificar se valor > R$ 215,05"
  },
  {
    erro: "Descrição genérica demais",
    consequencia: "Questionamento do fisco, glosa de despesa do tomador",
    prevencao: "Detalhar serviço prestado e período"
  },
  {
    erro: "CNPJ do tomador inválido ou inapto",
    consequencia: "Nota inválida, problemas para o cliente",
    prevencao: "Sempre consultar situação cadastral antes de emitir"
  },
  {
    erro: "Valor diferente do contrato/proposta",
    consequencia: "Questionamento do cliente, retrabalho",
    prevencao: "Conferir valor acordado antes de emitir"
  }
];

// Goiânia Específico
export const goianiaNFSe = {
  portal: "https://nfse.goiania.go.gov.br",
  aliquotasPadrao: {
    contabilidade: 0.03, // 3%
    consultoria: 0.03,
    treinamento: 0.02
  },
  simplesNacional: {
    anexoIII: "Alíquota conforme faixa do Simples",
    anexoV: "Fator R determina o anexo"
  },
  retencaoObrigatoria: [
    "Construção civil",
    "Limpeza e conservação",
    "Segurança e vigilância"
  ],
  prazos: {
    emissao: "Até o 5º dia útil do mês seguinte à prestação",
    pagamentoISS: "Até o 10º dia do mês seguinte"
  }
};

// Função para calcular retenções
export function calcularRetencoes(
  valorServico: number,
  opcoes: {
    retencaoISS?: boolean;
    aliquotaISS?: number;
    simplesNacional?: boolean;
    cessaoMaoObra?: boolean;
  }
): {
  valorBruto: number;
  ISS: number;
  IRRF: number;
  PIS: number;
  COFINS: number;
  CSLL: number;
  INSS: number;
  totalRetencoes: number;
  valorLiquido: number;
} {
  const resultado = {
    valorBruto: valorServico,
    ISS: 0,
    IRRF: 0,
    PIS: 0,
    COFINS: 0,
    CSLL: 0,
    INSS: 0,
    totalRetencoes: 0,
    valorLiquido: valorServico
  };

  // ISS
  if (opcoes.retencaoISS) {
    resultado.ISS = valorServico * (opcoes.aliquotaISS || 0.03);
  }

  // Se Simples Nacional, não retém federais
  if (!opcoes.simplesNacional) {
    // IRRF (1,5%)
    if (valorServico > 10) {
      resultado.IRRF = valorServico * 0.015;
    }

    // CSRF (4,65%) - somente se valor > R$ 215,05
    if (valorServico > 215.05) {
      resultado.PIS = valorServico * 0.0065;
      resultado.COFINS = valorServico * 0.03;
      resultado.CSLL = valorServico * 0.01;
    }
  }

  // INSS (11%) - cessão de mão de obra
  if (opcoes.cessaoMaoObra) {
    resultado.INSS = Math.min(valorServico * 0.11, retencoesNFSe.INSS.limite);
  }

  // Totais
  resultado.totalRetencoes =
    resultado.ISS +
    resultado.IRRF +
    resultado.PIS +
    resultado.COFINS +
    resultado.CSLL +
    resultado.INSS;

  resultado.valorLiquido = resultado.valorBruto - resultado.totalRetencoes;

  return resultado;
}

// Função para gerar descrição padrão
export function gerarDescricaoServico(
  tipoServico: "contabilidade" | "consultoria" | "auditoria" | "treinamento",
  competencia: string,
  detalhes?: string
): string {
  const descricoes = {
    contabilidade: `Honorários contábeis referentes aos serviços de escrituração contábil, fiscal e departamento pessoal, competência ${competencia}.`,
    consultoria: `Serviços de consultoria empresarial prestados no período de ${competencia}.`,
    auditoria: `Serviços de auditoria contábil e financeira, período ${competencia}.`,
    treinamento: `Serviços de treinamento e capacitação, realizados em ${competencia}.`
  };

  let descricao = descricoes[tipoServico];

  if (detalhes) {
    descricao += ` ${detalhes}`;
  }

  return descricao;
}

export default {
  codigosServico,
  camposObrigatorios,
  retencoesNFSe,
  naturezaOperacao,
  regimeEspecial,
  validacoesNFSe,
  passoAPassoEmissao,
  errosComuns,
  goianiaNFSe,
  calcularRetencoes,
  gerarDescricaoServico
};
