/**
 * Memória Operacional da Ampla Contabilidade
 *
 * Este arquivo contém todo o conhecimento específico da empresa,
 * aprendizado de sessões anteriores e regras de negócio específicas.
 */

// ============================================
// DADOS DO ESCRITÓRIO
// ============================================

export const escritorioAmpla = {
  razaoSocial: "AMPLA ASSESSORIA CONTABIL LTDA",
  nomeFantasia: "Ampla Business",
  cnpj: "21.565.040/0001-07",
  inscricaoMunicipal: "6241034",
  crc: {
    empresa: "CRC/GO 007640/O",
    responsavelTecnico: "Sergio Carneiro Leão",
    crcResponsavel: "CRC/GO 008074"
  },
  endereco: {
    logradouro: "Rua 1, Qd. 24, Lt. 08, S/N",
    bairro: "Setor Maracanã",
    cep: "74.680-320",
    cidade: "Goiânia",
    uf: "GO"
  },
  contato: {
    email: "contato@amplabusiness.com.br",
    telefone: "(62) 3932-1365"
  },
  tributacao: {
    regime: "simples_nacional",
    issFixo: 70.00,
    sociedadeProfissionais: true, // Art. 9º, §3º DL 406/68
    exigibilidadeISS: 4
  }
};

// ============================================
// FAMÍLIA LEÃO - REGRAS ESPECÍFICAS
// ============================================

export const familiaLeao = {
  regra: "Todo gasto da família = ADIANTAMENTO A SÓCIOS (nunca despesa operacional)",

  membros: {
    "SERGIO CARNEIRO LEAO": {
      conta: "1.1.3.04.01",
      centroCusto: "SÉRGIO CARNEIRO",
      trabalhaNaAmpla: true,
      cargo: "Fundador/Sócio",
      pagamento: "Pró-labore"
    },
    "CARLA LEAO": {
      conta: "1.1.3.04.02",
      centroCusto: "CARLA LEÃO",
      trabalhaNaAmpla: true,
      cargo: "Sócia/Contadora",
      pagamento: "Pró-labore"
    },
    "VICTOR HUGO LEAO": {
      conta: "1.1.3.04.03",
      centroCusto: "VICTOR HUGO",
      trabalhaNaAmpla: true,
      cargo: "Departamento de Legalização",
      salario: 6000,
      pagamento: "Salário"
    },
    "NAYARA": {
      conta: "1.1.3.04.04",
      centroCusto: "NAYARA",
      trabalhaNaAmpla: true,
      cargo: "Administração",
      salario: 6000,
      pagamento: "Salário"
    },
    "SERGIO AUGUSTO": {
      conta: "1.1.3.04.05",
      centroCusto: "SÉRGIO AUGUSTO",
      trabalhaNaAmpla: false, // IMPORTANTE: Não trabalha na Ampla
      cargo: "N/A",
      mesada: 6000,
      pagamento: "Adiantamento (mesada)"
    }
  },

  empresasRelacionadas: {
    "AMPLA CONTABILIDADE": {
      cnpj: "23893032000169",
      tratamento: "Adiantamento a Sérgio Carneiro Leão",
      conta: "1.1.3.04.01"
    },
    "AMPLA SAUDE": {
      conta: "1.2.1.01",
      centroCusto: "AMPLA SAÚDE",
      tipo: "Investimento",
      descricao: "Clínica Médica do Trabalho"
    }
  },

  gastosAdiantamento: [
    "Condomínios (Lago, Mundi)",
    "IPVA de veículos pessoais",
    "Energia de residências",
    "Babá da Nayara",
    "Plano de Saúde pessoal",
    "Obras em imóveis pessoais",
    "Sítio"
  ],

  gastosEmpresa: [
    "Dep. Pessoal (terceirizado) - é RH, não 'pessoal'",
    "Anuidade CRC de contadores que trabalham na Ampla",
    "IPTU da sede",
    "Reforma do prédio da Ampla",
    "Salários de quem trabalha na empresa"
  ]
};

// ============================================
// PERÍODO DE ABERTURA (JANEIRO/2025)
// ============================================

export const periodoAbertura = {
  inicio: "2025-01-01",
  fim: "2025-01-31",
  regra: "Recebimentos em janeiro são BAIXA de saldo de abertura, NÃO receita nova",
  lancamento: {
    debito: "1.1.1.02 (Banco)",
    credito: "1.1.2.01 (Clientes a Receber)"
  },
  motivo: "Evita distorcer o DRE de 2025 com receitas de períodos anteriores",

  fluxoClassificacao: `
    Recebimento identificado
        ↓
    É Janeiro/2025?
        SIM → Baixa Clientes a Receber (automático)
        NÃO ↓
    Cliente tem saldo de abertura?
        SIM → Pergunta: "Dívida antiga ou Competência atual?"
        NÃO → Classificar como honorário regular
  `
};

// ============================================
// SALDOS BANCÁRIOS DE REFERÊNCIA
// ============================================

export const saldosBancarios = {
  conta: "SICREDI 39500000000278068",
  codigoConta: "1.1.1.02",

  porMes: {
    "2025-01": 18553.54,
    "2025-02": 2578.93,
    "2025-03": 28082.64,
    "2025-04": 5533.07,
    "2025-05": 10119.92,
    "2025-06": 2696.75,
    "2025-07": 8462.05,
    "2025-08": 10251.53,
    "2025-09": 14796.07,
    "2025-11": 54849.25
  },

  regra: "Saldo bancário SEMPRE deve vir do extrato OFX, nunca calcular/adivinhar"
};

// ============================================
// PADRÕES DE TRANSAÇÕES BANCÁRIAS
// ============================================

export const padroesTransacoes = {
  entradas: {
    positivo: [
      "RECEBIMENTO PIX",
      "PIX_CRED",
      "PIX RECEBIDO",
      "LIQ.COBRANCA SIMPLES", // Recebimento de boleto emitido
      "CREDITO"
    ]
  },
  saidas: {
    negativo: [
      "PAGAMENTO PIX",
      "PIX_DEB",
      "LIQUIDACAO BOLETO", // Pagamento de boleto recebido
      "TARIFA",
      "DEBITO CONVENIOS",
      "MANUTENCAO DE TITULOS",
      "DEBITO ARRECADACAO"
    ]
  },
  alertas: [
    "LIQUIDACAO BOLETO pode ser entrada (recebimento) ou saída (pagamento) - verificar valor",
    "Transações consolidadas do banco precisam ser decompostas via lista de boletos liquidados"
  ]
};

// ============================================
// ARQUITETURA DE DADOS
// ============================================

export const arquiteturaDados = {
  regra: "Contabilidade é a FONTE ÚNICA DE VERDADE para relatórios",

  fontesEntrada: [
    "Extrato Bancário → bank_transactions → accounting_entries",
    "Folha de Pagamento → payroll → accounting_entries",
    "Honorários → invoices → accounting_entries",
    "Despesas → expenses → accounting_entries"
  ],

  tabelasCentrales: [
    "accounting_entries (lançamentos)",
    "accounting_entry_lines (partidas dobradas)"
  ],

  relatoriosLeem: [
    "ExecutiveDashboard",
    "DRE",
    "CashFlow",
    "ProfitabilityAnalysis",
    "Balancete",
    "Balanço Patrimonial"
  ],

  calculoReceita: `
    // RECEITA = crédito - débito nas contas 3.x
    periodLines
      .filter(line => line.account_id starts with '3')
      .reduce((sum, line) => sum + (line.credit || 0) - (line.debit || 0), 0)
  `,

  calculoDespesa: `
    // DESPESA = débito - crédito nas contas 4.x
    periodLines
      .filter(line => line.account_id starts with '4')
      .reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0)
  `
};

// ============================================
// SISTEMA DE RESCISÃO
// ============================================

export const sistemaRescisao = {
  tiposDesligamento: [
    { tipo: "dispensa_sem_justa_causa", avisoPrevia: true, multaFGTS: 0.40 },
    { tipo: "dispensa_com_justa_causa", avisoPrevia: false, multaFGTS: 0 },
    { tipo: "pedido_demissao", avisoPrevia: false, multaFGTS: 0 },
    { tipo: "acordo_mutuo", avisoPrevia: "50%", multaFGTS: 0.20 }, // CLT 484-A
    { tipo: "termino_contrato", avisoPrevia: false, multaFGTS: 0 },
    { tipo: "morte_empregado", avisoPrevia: false, multaFGTS: 0.40 },
    { tipo: "rescisao_indireta", avisoPrevia: true, multaFGTS: 0.40 },
    { tipo: "aposentadoria", avisoPrevia: false, multaFGTS: 0.40 }
  ],

  verbasCalculadas: [
    "Saldo de salário",
    "Aviso prévio (indenizado ou trabalhado)",
    "Férias vencidas + proporcionais + 1/3",
    "13º proporcional",
    "Multa FGTS (40% ou 20%)",
    "Descontos: INSS, IRRF"
  ],

  contasContabeis: {
    rescisaoAPagar: "2.1.2.10.xx",
    indenizacoesTrabalhistas: "4.2.10.xx"
  },

  rubricasESocial: {
    "3000": "Saldo de Salário",
    "3010": "Aviso Prévio Indenizado",
    "3020": "Férias Vencidas",
    "3021": "Férias Proporcionais",
    "3025": "1/3 Férias",
    "3030": "13º Proporcional",
    "3040": "Multa FGTS",
    "4000": "INSS Desconto",
    "4010": "IRRF Desconto",
    "4020": "FGTS Desconto",
    "4040": "Pensão Alimentícia"
  }
};

// ============================================
// SISTEMA DE HONORÁRIOS ESPECIAIS
// ============================================

export const honorariosEspeciais = {
  variavel: {
    descricao: "Honorário fixo + % sobre faturamento",
    exemplo: "Mata Pragas: fixo + 2.87% do faturamento dia 20",
    tabelas: ["client_variable_fees", "client_monthly_revenue"]
  },

  aberturaEmpresa: {
    descricao: "Valor fixo menos taxas do governo = lucro",
    exemplo: "Cobra R$ 2.500, paga R$ 800 em taxas = R$ 1.700 lucro",
    tabelas: ["company_services", "company_service_costs"]
  },

  indicacao: {
    descricao: "10% do honorário por X meses para quem indicou",
    tabelas: ["referral_partners", "client_referrals", "referral_commission_payments"]
  },

  irpf: {
    descricao: "Declaração anual dos sócios e particulares",
    valorMedio: 300,
    tabela: "irpf_declarations"
  }
};

// ============================================
// NFS-e GOIÂNIA
// ============================================

export const nfseGoiania = {
  sistema: "ABRASF 2.04 (ISSNet/SGISS)",
  portalNacional: false, // Goiânia NÃO está conveniada

  configuracao: {
    codigoServico: "17.18", // Contabilidade
    codigoServicoSemPonto: "1718", // Para XML
    cnae: "6920602",
    exigibilidadeISS: 4, // ISS Fixo
    valorISS: 0, // Pago mensalmente
    aliquota: 0,
    issRetido: 2 // Não retido
  },

  discriminacaoPadrao: `
SERVIÇOS DE CONTABILIDADE - COMPETÊNCIA {MES}/{ANO}

Serviços prestados conforme contrato de prestação de serviços contábeis:
- Escrituração contábil e fiscal
- Apuração de impostos federais e municipais
- Elaboração de balancetes e demonstrações contábeis
- Obrigações acessórias (SPED, DCTFWeb, EFD, etc.)
- Assessoria e consultoria contábil

Código do Serviço: 17.18 - Contabilidade, inclusive serviços técnicos e auxiliares
CNAE: 6920602

DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL
NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI/IBS/CBS E ISS
ISS: Regime de ISS Fixo (Sociedade de Profissionais) - Art. 9º, §3º do DL 406/68
Ref: LC 116/2003, LC 214/2025 (Reforma Tributária)
  `.trim(),

  endpoints: {
    homologacao: "issnetonline.com.br/goiania/...",
    producao: "nfse.goiania.go.gov.br/ws"
  }
};

// ============================================
// LIÇÕES APRENDIDAS
// ============================================

export const licoesAprendidas = [
  {
    sessao: 16,
    licao: "Empresa familiar precisa separar gastos pessoais",
    detalhe: "Tudo que for da família vai para Adiantamento a Sócios, nunca para despesa operacional"
  },
  {
    sessao: 17,
    licao: "Período de abertura",
    detalhe: "Recebimentos do primeiro mês não são receita, são baixa de recebíveis"
  },
  {
    sessao: 18,
    licao: "QSA é fonte valiosa",
    detalhe: "Contém todos os sócios e administradores para identificar pagadores"
  },
  {
    sessao: 24,
    licao: "Contabilidade como fonte única",
    detalhe: "Todos os relatórios devem ler de accounting_entry_lines"
  },
  {
    sessao: 25,
    licao: "Saldo bancário vem do extrato",
    detalhe: "Nunca calcular/adivinhar saldo - sempre usar o valor do extrato OFX"
  },
  {
    sessao: 26,
    licao: "Dep. Pessoal ≠ Pessoal",
    detalhe: "Departamento de RH terceirizado é despesa operacional, não adiantamento"
  },
  {
    sessao: 27,
    licao: "Separar despesas de adiantamentos",
    detalhe: "Salários de quem trabalha = Despesa. Pagamentos para quem não trabalha = Adiantamento"
  },
  {
    sessao: 28,
    licao: "Simples Nacional não sofre retenção",
    detalhe: "PIS, COFINS, CSLL, IR = 0. Tributação via DAS mensal"
  },
  {
    sessao: 32,
    licao: "Folha já conciliada manualmente",
    detalhe: "Não gerar lançamentos automáticos quando já existe lançamento manual"
  },
  {
    sessao: 33,
    licao: "Integridade contábil",
    detalhe: "Ao deletar registros operacionais, SEMPRE deletar os lançamentos contábeis"
  }
];

// ============================================
// VERSÃO ATUAL
// ============================================

export const versaoAtual = {
  versao: "1.29.4",
  data: "15/12/2025",
  ultimasFuncionalidades: [
    "Sistema completo NFS-e",
    "ISS Fixo Sociedade Profissionais",
    "Eventos manuais na folha de pagamento",
    "Correção de despesas deletadas no DRE"
  ]
};

export default {
  escritorioAmpla,
  familiaLeao,
  periodoAbertura,
  saldosBancarios,
  padroesTransacoes,
  arquiteturaDados,
  sistemaRescisao,
  honorariosEspeciais,
  nfseGoiania,
  licoesAprendidas,
  versaoAtual
};
