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
  versao: "1.30.4",
  data: "31/12/2024",
  ultimasFuncionalidades: [
    "Contratos com Devedores Solidários (Art. 264-275, 827 CC)",
    "Sistema de cobrança via WhatsApp com prazo 5 dias",
    "Justificativa de data posterior em contratos",
    "Grupos Econômicos por sócios em comum (client_partners)",
    "DebtConfession usando Plano de Contas como fonte da verdade",
    "80+ migrations para classificação Jan/2025",
    "Novas páginas: AIChat, AIWorkspace, CashFlowStatement, PeriodClosing",
    "Edge functions para IA e processamento de CSV"
  ]
};

// ============================================
// CONTRATOS E COBRANÇA
// ============================================

export const contratosCobranca = {
  devedoresSolidarios: {
    descricao: "Sócios figuram como devedores solidários das obrigações contratuais",
    fundamentoLegal: [
      "Art. 264 CC - Solidariedade na obrigação",
      "Art. 265 CC - Solidariedade não se presume",
      "Art. 275 CC - Credor pode exigir dívida toda de qualquer devedor",
      "Art. 827 CC - Renúncia ao benefício de ordem"
    ],
    clausulaContrato: "Cláusula 13ª - Dos Devedores Solidários"
  },

  justificativaDataPosterior: {
    descricao: "Contratos emitidos após início da prestação de serviços",
    clausulas: ["1.5", "1.6"],
    motivo: "Ratifica relação contratual pré-existente"
  },

  notificacaoWhatsApp: {
    prazo: 5, // dias úteis
    conteudo: [
      "Identificação do débito com valores e competências",
      "Prazo para negociação",
      "Lista de devedores solidários (sócios)",
      "Ameaça de execução, protesto e negativação"
    ]
  }
};

// ============================================
// REGRA FUNDAMENTAL - DR. CÍCERO
// ============================================

export const regraFundamentalDrCicero = {
  regra: "NENHUMA questão contábil pode ser resolvida sem consultar o Dr. Cícero",

  obrigatorio: true,

  assuntosQueExigemDrCicero: [
    "Classificação de contas - onde lançar cada operação",
    "Saldo de abertura - contrapartidas corretas (PL, não Resultado)",
    "Lançamentos contábeis - débito/crédito corretos",
    "Fechamento de período - apuração de resultado",
    "Demonstrações contábeis - BP, DRE, DFC, DMPL",
    "Regime de competência - reconhecimento de receitas/despesas",
    "Partidas dobradas - verificação de equilíbrio",
    "Correções contábeis - estornos e reclassificações"
  ],

  comoConsultar: {
    viaEdgeFunction: `
      const response = await supabase.functions.invoke('dr-cicero-brain', {
        body: { question: 'Qual a contrapartida correta para saldo de abertura de ativo?' }
      });
    `,
    viaScript: "Criar arquivo temp_consulta_dr_cicero_ASSUNTO.mjs com análise fundamentada nas NBC TG"
  },

  fundamentacaoLegal: [
    "NBC TG 00 - Estrutura Conceitual",
    "NBC TG 26 - Apresentação das Demonstrações Contábeis",
    "ITG 2000 - Escrituração Contábil",
    "Código Civil - Art. 264-275 (Solidariedade), Art. 827 (Fiança)"
  ]
};

// ============================================
// CORREÇÃO PENDENTE - SALDO DE ABERTURA
// ============================================

export const auditoriaBalancoJaneiro2025 = {
  status: "CONCLUÍDA ✅",
  dataAuditoria: "01/01/2026",

  resultadoFinal: {
    ativo: 391726.63,
    passivo: 0,
    pl: 389252.35,
    resultadoExercicio: 2474.28,
    passivoMaisPL: 391726.63,
    diferenca: 0
  },

  composicaoAtivo: {
    bancoSicredi: 18553.54,
    clientesReceber: 136821.59,
    adiantamentosSocios: 236351.50
  },

  composicaoPL: {
    saldoAberturaDisponibilidades: 90725.06,
    saldoAberturaClientes: 298527.29
  },

  resultadoExercicio: {
    receitas: 136821.59,
    despesas: 134347.31,
    lucro: 2474.28
  },

  problemasCorrigidos: [
    {
      problema: "Saldo fantasma Bradesco R$ 90.725,10",
      solucao: "Deletado lançamento duplicado",
      script: "scripts/fix_bradesco_duplicate.mjs"
    },
    {
      problema: "Contas filhas duplicadas 1.1.2.01.xxx",
      solucao: "84 entradas removidas, 116 contas desativadas",
      script: "scripts/fix_clients_structure.mjs"
    },
    {
      problema: "Conta inativa 4.1.2.10 com saldo R$ 1.127,59",
      solucao: "Reclassificada para 4.1.2.99",
      script: "inline (01/01/2026)"
    }
  ],

  scriptsAuditoria: [
    "scripts/audit_bradesco.mjs",
    "scripts/fix_bradesco_duplicate.mjs",
    "scripts/audit_balance_sheet.mjs",
    "scripts/fix_account_types.mjs",
    "scripts/fix_clients_structure.mjs",
    "scripts/check_balance_equation.mjs",
    "scripts/compare_opening_balance.mjs"
  ]
};

// ============================================
// AGENTES DE IA
// ============================================

export const agentesIA = {
  especialistas: [
    {
      id: "cicero",
      nome: "Dr. Cícero",
      especialidade: "Contabilidade, NBC, CFC",
      obrigatorio: true,
      descricao: "DEVE ser consultado para QUALQUER questão contábil"
    },
    { id: "advocato", nome: "Dr. Advocato", especialidade: "Direito do Trabalho, CLT" },
    { id: "helena", nome: "Dra. Helena", especialidade: "Gestão de Processos" },
    { id: "milton", nome: "Prof. Milton", especialidade: "Finanças" },
    { id: "empresario", nome: "Sr. Empresário", especialidade: "Estruturação Societária" },
    { id: "vendedor", nome: "Sr. Vendedor", especialidade: "Vendas Consultivas" },
    { id: "marketing", nome: "Sra. Marketing", especialidade: "Marketing e Comunicação" },
    { id: "atlas", nome: "Atlas", especialidade: "Machine Learning" }
  ],

  edgeFunctions: [
    { nome: "dr-cicero-brain", descricao: "Consulta contador IA com NBC - OBRIGATÓRIO para questões contábeis" },
    { nome: "ai-agent-orchestrator", descricao: "Orquestrador de agentes" },
    { nome: "ai-web-search", descricao: "Busca na web (Serper.dev)" },
    { nome: "ai-context-provider", descricao: "Contexto para agentes" },
    { nome: "ai-dev-agent", descricao: "Agente de desenvolvimento" },
    { nome: "ai-dev-agent-secure", descricao: "Agente DevOps seguro" },
    { nome: "process-boletos-csv", descricao: "Processa CSV de boletos" },
    { nome: "process-extrato-csv", descricao: "Processa CSV de extrato" }
  ]
};

// ============================================
// GRUPOS ECONÔMICOS
// ============================================

export const gruposEconomicos = {
  conceito: "Empresas com sócios em comum (mesmo CPF)",
  tabelaSocios: "client_partners",
  campos: ["name", "cpf", "partner_type", "percentage", "is_administrator"],
  scriptAtualizacao: "scripts/update_clients_cnpja.mjs",
  apiExterna: "CNPJA (cnpja.com)"
};

// ============================================
// REGRA GERAL DO FLUXO CONTÁBIL (Dr. Cícero)
// ============================================

export const fluxoContabilGeral = {
  regra: "TODO lançamento DEVE iniciar no Plano de Contas - SEM EXCEÇÃO",

  fluxoObrigatorio: [
    {
      ordem: 1,
      etapa: "PLANO DE CONTAS",
      descricao: "Fonte da verdade. Todo lançamento inicia aqui.",
      tabela: "chart_of_accounts",
      obrigatorio: true
    },
    {
      ordem: 2,
      etapa: "LIVRO DIÁRIO",
      descricao: "Registro cronológico de todos os lançamentos",
      tabela: "accounting_entries + accounting_entry_lines",
      obrigatorio: true
    },
    {
      ordem: 3,
      etapa: "LIVRO RAZÃO",
      descricao: "Movimentação por conta contábil",
      origem: "Derivado do Livro Diário",
      obrigatorio: true
    },
    {
      ordem: 4,
      etapa: "BALANCETE",
      descricao: "Saldos de todas as contas no período",
      origem: "Derivado do Razão",
      obrigatorio: true
    },
    {
      ordem: 5,
      etapa: "DRE",
      descricao: "Demonstração do Resultado do Exercício (Receitas - Despesas)",
      contas: "Grupos 3 (Receitas) e 4 (Despesas)",
      origem: "Derivado do Balancete",
      obrigatorio: true
    },
    {
      ordem: 6,
      etapa: "BALANÇO PATRIMONIAL",
      descricao: "Posição patrimonial (Ativo = Passivo + PL)",
      contas: "Grupos 1 (Ativo), 2 (Passivo) e 5 (Patrimônio Líquido)",
      origem: "Derivado do Balancete + Resultado do DRE",
      obrigatorio: true
    }
  ],

  principioFundamental: `
    O PLANO DE CONTAS é a FONTE DA VERDADE de toda a aplicação.

    Nenhum lançamento pode existir sem estar vinculado a uma conta do plano.
    Todas as telas e relatórios DEVEM buscar dados a partir dos lançamentos
    contábeis (accounting_entries + accounting_entry_lines), que por sua vez
    estão vinculados ao plano de contas (chart_of_accounts).

    Este fluxo é INVIOLÁVEL e segue as NBC TG 26 e ITG 2000.
  `,

  validacoes: [
    "Não permitir lançamento sem account_id válido",
    "Não permitir conta sem código estruturado (ex: 1.1.1.01)",
    "Débitos SEMPRE devem igualar Créditos (partidas dobradas)",
    "Contas sintéticas NÃO recebem lançamentos diretos"
  ],

  fundamentacao: [
    "NBC TG 26 - Apresentação das Demonstrações Contábeis",
    "ITG 2000 - Escrituração Contábil",
    "NBC TG 00 - Estrutura Conceitual"
  ]
};

// ============================================
// VERSÃO ATUALIZADA
// ============================================

export const versaoAtualizada = {
  versao: "1.32.0",
  data: "01/01/2026",
  ultimasFuncionalidades: [
    "BALANÇO EQUILIBRADO: ATIVO = PASSIVO + PL + RESULTADO (diferença R$ 0,00)",
    "AUDITORIA COMPLETA: Detectados e corrigidos 3 problemas no balanço",
    "SCRIPTS DE AUDITORIA: 7 novos scripts para verificação contábil",
    "CONTA INATIVA CORRIGIDA: 4.1.2.10 reclassificada para 4.1.2.99",
    "REGRA FUNDAMENTAL: Dr. Cícero OBRIGATÓRIO para questões contábeis",
    "REGRA GERAL: Todo lançamento inicia no Plano de Contas",
    "Fluxo: Plano → Diário → Razão → Balancete → DRE → BP",
    "Contratos com Devedores Solidários (Art. 264-275, 827 CC)",
    "Sistema de cobrança via WhatsApp com prazo 5 dias",
    "Grupos Econômicos por sócios em comum (client_partners)"
  ]
};

export default {
  escritorioAmpla,
  familiaLeao,
  auditoriaBalancoJaneiro2025,
  periodoAbertura,
  saldosBancarios,
  padroesTransacoes,
  arquiteturaDados,
  sistemaRescisao,
  honorariosEspeciais,
  nfseGoiania,
  licoesAprendidas,
  versaoAtual,
  contratosCobranca,
  agentesIA,
  gruposEconomicos,
  regraFundamentalDrCicero,
  correcaoPendenteSaldoAbertura,
  fluxoContabilGeral,
  versaoAtualizada
};
