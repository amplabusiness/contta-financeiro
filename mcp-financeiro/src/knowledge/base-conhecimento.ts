/**
 * Base de Conhecimento Completa - MCP Financeiro
 *
 * Este arquivo contém toda a inteligência de negócio da Ampla Contabilidade,
 * incluindo regras contábeis (NBC/CFC), fiscais, departamento pessoal e auditoria.
 *
 * IMPORTANTE - POLÍTICA DE DADOS:
 * ================================
 * - TODOS os dados financeiros DEVEM vir do Supabase (banco de dados real)
 * - NÃO usar dados mockados ou hardcoded em produção
 * - Arquivo src/data/expensesData.ts contém APENAS funções utilitárias (formatCurrency, formatPercentage)
 * - Fontes de verdade:
 *   - Clientes: tabela "clients"
 *   - Honorários: tabela "invoices"
 *   - Despesas: tabela "expenses" + "bank_transactions" (débitos não conciliados)
 *   - Contabilidade: tabela "accounting_entry_lines" (partida dobrada)
 *   - Plano de Contas: tabela "chart_of_accounts"
 *
 * @see src/integrations/supabase/client.ts - Cliente Supabase
 * @see src/pages/Dashboard.tsx - Exemplo de consumo de dados reais
 */

// ============================================
// REGRAS CONTÁBEIS (NBC/CFC)
// ============================================

export const regrasContabeis = {
  // Princípios Fundamentais
  principios: {
    partidaDobrada: {
      descricao: "Todo lançamento contábil DEVE ter débito = crédito (partida dobrada)",
      exemplo: "D: Clientes a Receber (1.1.2.01) R$ 1.500,00 | C: Honorários (3.1.1.01) R$ 1.500,00",
      validacao: (debito: number, credito: number) => Math.abs(debito - credito) < 0.01
    },
    competencia: {
      descricao: "Receitas e despesas devem ser reconhecidas no período em que ocorrem, independente do pagamento",
      regra: "Fatura emitida em dezembro/2024, paga em janeiro/2025 → Receita é de dezembro/2024",
    },
    continuidade: {
      descricao: "Assume-se que a empresa continuará operando indefinidamente"
    },
    entidade: {
      descricao: "O patrimônio da empresa é SEPARADO do patrimônio dos sócios",
      regra: "Gastos pessoais dos sócios = Adiantamento a Sócios (ATIVO), não despesa operacional"
    }
  },

  // Estrutura do Lançamento Contábil
  estruturaLancamento: {
    cabecalho: {
      campos: ["entry_date", "competence_date", "entry_type", "description", "reference_type", "reference_id"],
      descricao: "Cabeçalho do lançamento com data, tipo e referência"
    },
    linhas: {
      campos: ["account_id", "debit", "credit", "description"],
      regra: "Cada linha representa um débito OU crédito em uma conta específica"
    }
  },

  // Plano de Contas Padrão
  planoContas: {
    estrutura: {
      "1": { nome: "ATIVO", natureza: "DEVEDORA", descricao: "Bens e direitos" },
      "1.1": { nome: "ATIVO CIRCULANTE", natureza: "DEVEDORA" },
      "1.1.1": { nome: "Disponibilidades", natureza: "DEVEDORA" },
      "1.1.1.01": { nome: "Caixa Geral", natureza: "DEVEDORA", analitica: true },
      "1.1.1.02": { nome: "Banco Sicredi C/C", natureza: "DEVEDORA", analitica: true },
      "1.1.2": { nome: "Clientes a Receber", natureza: "DEVEDORA" },
      "1.1.2.01": { nome: "Clientes - Honorários", natureza: "DEVEDORA" },
      "1.1.3": { nome: "Adiantamentos", natureza: "DEVEDORA" },
      "1.1.3.01": { nome: "Sérgio Carneiro Leão", natureza: "DEVEDORA", analitica: true },
      "1.1.3.02": { nome: "Carla Leão", natureza: "DEVEDORA", analitica: true },
      "1.1.3.03": { nome: "Sérgio Augusto", natureza: "DEVEDORA", analitica: true },
      "1.1.3.04": { nome: "Victor Hugo", natureza: "DEVEDORA", analitica: true },
      "1.1.3.05": { nome: "Nayara", natureza: "DEVEDORA", analitica: true },
      "1.1.3.99": { nome: "Família (Sítio)", natureza: "DEVEDORA", analitica: true },
      "1.2": { nome: "ATIVO NÃO CIRCULANTE", natureza: "DEVEDORA" },
      "1.2.1": { nome: "Investimentos", natureza: "DEVEDORA" },
      "1.2.1.01": { nome: "Investimentos - Ampla Saúde", natureza: "DEVEDORA", analitica: true },
      "2": { nome: "PASSIVO", natureza: "CREDORA", descricao: "Obrigações" },
      "2.1": { nome: "PASSIVO CIRCULANTE", natureza: "CREDORA" },
      "2.1.1": { nome: "Fornecedores", natureza: "CREDORA" },
      "2.1.2": { nome: "Obrigações Trabalhistas", natureza: "CREDORA" },
      "2.1.3": { nome: "Obrigações Fiscais", natureza: "CREDORA" },
      "3": { nome: "RECEITAS", natureza: "CREDORA", descricao: "Aumentam o PL" },
      "3.1": { nome: "RECEITAS OPERACIONAIS", natureza: "CREDORA" },
      "3.1.1.01": { nome: "Honorários Contábeis", natureza: "CREDORA", analitica: true },
      "3.1.1.02": { nome: "Honorários Fiscais", natureza: "CREDORA", analitica: true },
      "3.1.1.03": { nome: "Honorários DP", natureza: "CREDORA", analitica: true },
      "4": { nome: "DESPESAS", natureza: "DEVEDORA", descricao: "Diminuem o PL" },
      "4.1": { nome: "DESPESAS OPERACIONAIS", natureza: "DEVEDORA" },
      "4.1.1": { nome: "Despesas Administrativas", natureza: "DEVEDORA" },
      "4.1.2": { nome: "Despesas com Pessoal", natureza: "DEVEDORA" },
      "4.1.3": { nome: "Despesas Financeiras", natureza: "DEVEDORA" },
      "5": { nome: "PATRIMÔNIO LÍQUIDO", natureza: "CREDORA" },
      "5.1": { nome: "Capital Social", natureza: "CREDORA" },
      "5.2": { nome: "Reservas", natureza: "CREDORA" },
      "5.2.1.02": { nome: "Saldos de Abertura", natureza: "CREDORA", analitica: true }
    },
    regras: [
      "Contas de 1 dígito = Grupo (ATIVO, PASSIVO, etc)",
      "Contas analíticas terminam com .XX (ex: 1.1.1.01)",
      "Contas sintéticas são totalizadoras das analíticas",
      "NUNCA lançar diretamente em conta sintética"
    ]
  },

  // Tipos de Lançamentos
  tiposLancamento: {
    receita_honorarios: {
      descricao: "Registro de receita de honorários (provisão)",
      debito: "1.1.2.01.XXX (Cliente a Receber)",
      credito: "3.1.1.01 (Honorários Contábeis)",
      quando: "Quando a fatura é emitida (competência)"
    },
    recebimento: {
      descricao: "Baixa do recebível quando cliente paga",
      debito: "1.1.1.02 (Banco)",
      credito: "1.1.2.01.XXX (Cliente a Receber)",
      quando: "Quando o pagamento é recebido (caixa)"
    },
    saldo_abertura: {
      descricao: "Registro de saldo de abertura de cliente",
      debito: "1.1.2.01.XXX (Cliente a Receber)",
      credito: "5.2.1.02 (Saldos de Abertura no PL)",
      quando: "No início do período, para valores pré-existentes",
      importante: "NUNCA creditar em Receita - saldo de abertura NÃO é receita do período"
    },
    despesa_provisao: {
      descricao: "Registro de despesa a pagar",
      debito: "4.X.X.XX (Conta de Despesa)",
      credito: "2.1.1.XX (Fornecedor a Pagar)",
      quando: "Quando a despesa é incorrida"
    },
    despesa_pagamento: {
      descricao: "Baixa da obrigação quando paga",
      debito: "2.1.1.XX (Fornecedor)",
      credito: "1.1.1.02 (Banco)",
      quando: "Quando o pagamento é efetuado"
    },
    adiantamento_socios: {
      descricao: "Gasto pessoal dos sócios/família",
      debito: "1.1.3.XX (Adiantamento ao Sócio)",
      credito: "1.1.1.02 (Banco)",
      quando: "Quando empresa paga gasto pessoal de sócio/familiar",
      importante: "NÃO é despesa operacional - é um ativo (direito contra o sócio)"
    }
  },

  // Demonstrações Contábeis
  demonstracoes: {
    DRE: {
      nome: "Demonstração do Resultado do Exercício",
      estrutura: [
        "( + ) Receita Bruta (conta 3.x)",
        "( - ) Deduções da Receita",
        "( = ) Receita Líquida",
        "( - ) Despesas Operacionais (conta 4.x)",
        "( = ) Resultado Operacional",
        "( +/- ) Resultado Financeiro",
        "( = ) Resultado Antes do IR/CSLL",
        "( - ) IR/CSLL",
        "( = ) Lucro/Prejuízo Líquido"
      ],
      regra: "Usa apenas contas de RESULTADO (3.x e 4.x) do período"
    },
    BalancoPatrimonial: {
      nome: "Balanço Patrimonial",
      estrutura: {
        ativo: "Bens e Direitos (conta 1.x)",
        passivo: "Obrigações (conta 2.x)",
        pl: "Capital + Reservas + Resultado (conta 5.x + resultado DRE)"
      },
      regra: "ATIVO = PASSIVO + PL (equação patrimonial)"
    },
    Balancete: {
      nome: "Balancete de Verificação",
      estrutura: "Lista todas as contas com saldos devedores e credores",
      regra: "Total Débito = Total Crédito (validação da partida dobrada)"
    }
  }
};

// ============================================
// REGRAS FISCAIS
// ============================================

export const regrasFiscais = {
  // Regime Tributário
  regimes: {
    simplesNacional: {
      descricao: "Regime simplificado para ME e EPP",
      faturamentoMaximo: 4800000,
      anexos: {
        III: { nome: "Prestação de serviços", aliquotaInicial: 0.06 },
        IV: { nome: "Construção civil, vigilância", aliquotaInicial: 0.045 },
        V: { nome: "Serviços intelectuais", aliquotaInicial: 0.155 }
      },
      obrigacoes: ["PGDAS-D mensal", "DEFIS anual"]
    },
    lucroPresumido: {
      descricao: "Presunção de lucro sobre receita bruta",
      presuncaoServicos: 0.32,
      impostos: {
        IRPJ: { base: 0.32, aliquota: 0.15, adicional: { limite: 60000, aliquota: 0.10 } },
        CSLL: { base: 0.32, aliquota: 0.09 },
        PIS: { aliquota: 0.0065 },
        COFINS: { aliquota: 0.03 }
      }
    },
    lucroReal: {
      descricao: "Apuração sobre lucro efetivo",
      obrigatorio: [
        "Faturamento > R$ 78 milhões",
        "Atividades financeiras",
        "Lucros do exterior"
      ],
      impostos: {
        IRPJ: { aliquota: 0.15, adicional: { limite: 60000, aliquota: 0.10 } },
        CSLL: { aliquota: 0.09 },
        PIS: { aliquota: 0.0165, creditos: true },
        COFINS: { aliquota: 0.076, creditos: true }
      }
    }
  },

  // Retenções na Fonte
  retencoes: {
    ISS: {
      descricao: "Imposto sobre Serviços",
      aliquota: { minima: 0.02, maxima: 0.05 },
      retencao: "Tomador retém quando prestador é de outro município"
    },
    IRRF: {
      descricao: "Imposto de Renda Retido na Fonte",
      servicos: {
        pessoaFisica: "Tabela progressiva mensal",
        pessoaJuridica: 0.015 // 1,5% para serviços profissionais
      }
    },
    INSS: {
      descricao: "Contribuição Previdenciária",
      retencaoServicos: 0.11, // 11% sobre cessão de mão de obra
      limite: 7786.02 // Teto INSS 2024
    },
    CSRF: {
      descricao: "Contribuições Sociais Retidas na Fonte",
      aliquota: 0.0465, // 4,65% (PIS 0,65% + COFINS 3% + CSLL 1%)
      aplicacao: "Serviços > R$ 215,05"
    }
  },

  // Obrigações Acessórias
  obrigacoesAcessorias: {
    mensais: [
      "PGDAS-D (Simples Nacional)",
      "DCTF (Lucro Presumido/Real)",
      "EFD-Contribuições",
      "GIA (ICMS)",
      "SPED Fiscal"
    ],
    anuais: [
      "DEFIS (Simples Nacional)",
      "ECF (Escrituração Contábil Fiscal)",
      "ECD (Escrituração Contábil Digital)",
      "DIRF (Declaração do IR Retido)",
      "RAIS"
    ]
  },

  // NFSe
  nfse: {
    camposObrigatorios: [
      "CNPJ/CPF do prestador",
      "CNPJ/CPF do tomador",
      "Código do serviço (LC 116)",
      "Valor do serviço",
      "Alíquota ISS",
      "Município de prestação"
    ],
    retencoes: {
      ISS: "Quando tomador é responsável tributário",
      IRRF: "Serviços profissionais > limite",
      INSS: "Cessão de mão de obra",
      CSRF: "Serviços > R$ 215,05"
    }
  }
};

// ============================================
// DEPARTAMENTO PESSOAL (DP)
// ============================================

export const regrasDepartamentoPessoal = {
  // Admissão
  admissao: {
    documentosObrigatorios: [
      "CTPS (digital ou física)",
      "CPF",
      "RG",
      "Título de Eleitor",
      "Certificado de Reservista (homens)",
      "Comprovante de residência",
      "Certidão de nascimento/casamento",
      "Foto 3x4",
      "Exame admissional (ASO)"
    ],
    prazos: {
      registroCTPS: "48 horas",
      cadastroESocial: "Até 1 dia antes do início"
    }
  },

  // eSocial
  eSocial: {
    eventosAdmissao: ["S-2200 (Cadastramento Inicial)", "S-2190 (Admissão Preliminar)"],
    eventosRemuneracao: ["S-1200 (Remuneração)", "S-1210 (Pagamentos)"],
    eventosDesligamento: ["S-2299 (Desligamento)"],
    prazos: {
      admissao: "Até 1 dia antes do início",
      folha: "Até dia 15 do mês seguinte",
      desligamento: "Até 10 dias"
    }
  },

  // Folha de Pagamento
  folhaPagamento: {
    proventos: {
      salario: "Valor base acordado",
      horaExtra: { "50%": 1.5, "100%": 2.0 },
      adicionalNoturno: 0.20,
      adicionalInsalubridade: { minimo: 0.10, medio: 0.20, maximo: 0.40 },
      adicionalPericulosidade: 0.30,
      DSR: "Descanso Semanal Remunerado"
    },
    descontos: {
      INSS: {
        faixas2024: [
          { ate: 1412.00, aliquota: 0.075 },
          { ate: 2666.68, aliquota: 0.09 },
          { ate: 4000.03, aliquota: 0.12 },
          { ate: 7786.02, aliquota: 0.14 }
        ],
        calculo: "Progressivo por faixa"
      },
      IRRF: {
        faixas2024: [
          { ate: 2259.20, aliquota: 0, deducao: 0 },
          { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
          { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
          { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
          { acima: 4664.68, aliquota: 0.275, deducao: 896.00 }
        ],
        deducoes: ["Dependentes (R$ 189,59)", "Pensão alimentícia", "INSS"]
      },
      valeTransporte: { limite: 0.06, descricao: "6% do salário base" },
      valeRefeicao: { limite: 0.20, descricao: "Até 20% do custo" }
    }
  },

  // Férias
  ferias: {
    periodoAquisitivo: 12, // meses
    periodoConcessivo: 12, // meses após aquisitivo
    duracaoMaxima: 30, // dias corridos
    fracionamento: {
      permitido: true,
      minimoFracao: 14, // dias
      maximoFracoes: 3
    },
    adicional: 0.3333, // 1/3 constitucional
    abonoPecuniario: 10 // dias que podem ser vendidos
  },

  // 13º Salário
  decimoTerceiro: {
    primeiraParcelaAte: "30 de novembro",
    segundaParcelaAte: "20 de dezembro",
    calculo: "Salário / 12 * meses trabalhados",
    encargos: "INSS e IRRF apenas na 2ª parcela"
  },

  // Rescisão
  rescisao: {
    tiposDesligamento: {
      semJustaCausa: {
        verbas: ["Saldo salário", "Aviso prévio", "Férias + 1/3", "13º proporcional", "Multa 40% FGTS"],
        sacaFGTS: true,
        seguroDesemprego: true
      },
      porJustaCausa: {
        verbas: ["Saldo salário", "Férias vencidas + 1/3"],
        sacaFGTS: false,
        seguroDesemprego: false
      },
      pedidoDemissao: {
        verbas: ["Saldo salário", "Férias + 1/3", "13º proporcional"],
        sacaFGTS: false,
        seguroDesemprego: false
      },
      acordoMutuo: {
        verbas: ["Saldo salário", "50% aviso prévio", "Férias + 1/3", "13º proporcional", "Multa 20% FGTS"],
        sacaFGTS: "80% do saldo",
        seguroDesemprego: false
      }
    },
    prazoPagamento: {
      avisoTrabalhado: "1º dia útil após término",
      avisoIndenizado: "10 dias corridos"
    }
  },

  // FGTS
  fgts: {
    aliquota: 0.08, // 8% do salário
    deposito: "Até dia 7 do mês seguinte",
    multa: {
      semJustaCausa: 0.40,
      acordoMutuo: 0.20
    }
  }
};

// ============================================
// AUDITORIA E CONTROLES
// ============================================

export const regrasAuditoria = {
  // Controles Internos
  controlesInternos: {
    segregacaoFuncoes: {
      descricao: "Quem registra não pode aprovar, quem aprova não pode pagar",
      exemplos: [
        "Faturamento ≠ Recebimento",
        "Compras ≠ Pagamentos",
        "Contabilidade ≠ Tesouraria"
      ]
    },
    dupla_aprovacao: {
      descricao: "Transações acima de limite precisam de 2 aprovadores",
      limites: {
        baixo: 1000,
        medio: 5000,
        alto: 10000
      }
    },
    conciliacao: {
      bancaria: "Diária ou semanal",
      contabil: "Mensal",
      fiscal: "Mensal"
    }
  },

  // Testes de Auditoria
  testesAuditoria: {
    existencia: "Verificar se ativo/passivo realmente existe",
    completude: "Verificar se todas as transações foram registradas",
    avaliacao: "Verificar se valores estão corretos",
    propriedade: "Verificar se empresa é dona dos ativos",
    classificacao: "Verificar se contas estão corretas",
    cutoff: "Verificar se período está correto"
  },

  // Red Flags (Alertas)
  redFlags: {
    financeiros: [
      "Pagamentos fora do horário comercial",
      "Fornecedor sem histórico",
      "Valores redondos atípicos",
      "Sequência de pagamentos similares",
      "Pagamento maior que fatura"
    ],
    contabeis: [
      "Lançamentos manuais recorrentes",
      "Estornos frequentes",
      "Lançamentos em finais de semana",
      "Contas com saldo invertido",
      "Partida dobrada não fecha"
    ],
    folha: [
      "Funcionário fantasma",
      "Hora extra excessiva",
      "Férias não gozadas",
      "Salário muito acima/abaixo do cargo"
    ]
  },

  // Rastreabilidade
  trilhaAuditoria: {
    camposObrigatorios: [
      "created_at - Data/hora de criação",
      "created_by - Quem criou",
      "updated_at - Data/hora de alteração",
      "updated_by - Quem alterou",
      "reference_type - Tipo de documento origem",
      "reference_id - ID do documento origem"
    ],
    regra: "Todo lançamento DEVE ter rastreabilidade até documento de origem"
  }
};

// ============================================
// REGRAS ESPECÍFICAS AMPLA CONTABILIDADE
// ============================================

export const regrasAmplaContabilidade = {
  // Família Leão
  familiaLeao: {
    regra: "Todo gasto da família = ADIANTAMENTO A SÓCIOS (nunca despesa operacional)",
    membros: {
      "SERGIO CARNEIRO LEAO": { conta: "1.1.3.01", centroCusto: "SÉRGIO CARNEIRO" },
      "CARLA LEAO": { conta: "1.1.3.02", centroCusto: "CARLA LEÃO" },
      "SERGIO AUGUSTO": { conta: "1.1.3.03", centroCusto: "SÉRGIO AUGUSTO" },
      "VICTOR HUGO": { conta: "1.1.3.04", centroCusto: "VICTOR HUGO" },
      "NAYARA": { conta: "1.1.3.05", centroCusto: "NAYARA" }
    },
    investimentos: {
      "AMPLA SAUDE": { conta: "1.2.1.01", centroCusto: "AMPLA SAÚDE", tipo: "Investimento" }
    },
    imoveis: {
      sede: "Despesa da empresa (CC: EMPRESA/SEDE)",
      casaSocios: "Adiantamento a Sócios",
      sitio: "1.1.3.99 (CC: SÍTIO)"
    }
  },

  // Período de Abertura
  periodoAbertura: {
    descricao: "Janeiro/2025 é o primeiro mês do sistema",
    regra: "Recebimentos em janeiro são BAIXA de saldo de abertura, NÃO receita nova",
    lancamento: {
      debito: "1.1.1.02 (Banco)",
      credito: "1.1.2.01 (Clientes a Receber)"
    },
    motivo: "Evita distorcer o DRE de 2025 com receitas de períodos anteriores"
  },

  // Honorários
  honorarios: {
    competencia: "Mensal (MM/YYYY)",
    tipos: ["pro_bono", "barter", "normal"],
    fluxo: [
      "1. Fatura emitida → D: Cliente a Receber | C: Receita",
      "2. Pagamento recebido → D: Banco | C: Cliente a Receber"
    ]
  },

  // Identificação de Pagadores
  identificacaoPagadores: {
    descricao: "Clientes podem pagar via conta de sócios/familiares",
    fonte: "QSA (Quadro de Sócios e Administradores) dos clientes",
    regra: {
      umaSoEmpresa: "Classifica automaticamente como honorário daquela empresa",
      multiplasEmpresas: "Pergunta ao usuário qual empresa"
    }
  },

  // Benchmarks do Setor Contábil
  benchmarks: {
    folhaPagamento: { ideal: 0.45, maximo: 0.50, critico: 0.55 },
    aluguel: { ideal: 0.08, maximo: 0.10, critico: 0.12 },
    materialConsumo: { ideal: 0.02, maximo: 0.03, critico: 0.05 },
    softwareTI: { ideal: 0.04, maximo: 0.05, critico: 0.07 },
    marketing: { ideal: 0.03, maximo: 0.05, critico: 0.08 },
    energia: { ideal: 0.015, maximo: 0.02, critico: 0.025 }
  },

  // Régua de Cobrança
  reguaCobranca: [
    { dias: 1, acao: "Lembrete", canal: "E-mail" },
    { dias: 7, acao: "Cobrança amigável", canal: "WhatsApp" },
    { dias: 15, acao: "Contato direto", canal: "Telefone" },
    { dias: 30, acao: "Negociação formal", canal: "Reunião" },
    { dias: 60, acao: "Medidas legais", canal: "Jurídico" }
  ]
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

export function validarPartidaDobrada(debito: number, credito: number): boolean {
  return Math.abs(debito - credito) < 0.01;
}

export function identificarNaturezaConta(codigo: string): "DEVEDORA" | "CREDORA" {
  const prefixo = codigo.charAt(0);
  if (prefixo === "1" || prefixo === "4") return "DEVEDORA"; // Ativo ou Despesa
  return "CREDORA"; // Passivo, PL ou Receita
}

export function calcularINSS(salarioBruto: number): number {
  const faixas = regrasDepartamentoPessoal.folhaPagamento.descontos.INSS.faixas2024;
  let inss = 0;
  let salarioRestante = salarioBruto;

  for (let i = 0; i < faixas.length; i++) {
    const faixa = faixas[i];
    const faixaAnterior = i > 0 ? faixas[i - 1].ate : 0;
    const baseFaixa = Math.min(salarioRestante, faixa.ate - faixaAnterior);

    if (baseFaixa > 0) {
      inss += baseFaixa * faixa.aliquota;
      salarioRestante -= baseFaixa;
    }

    if (salarioRestante <= 0) break;
  }

  return Math.round(inss * 100) / 100;
}

export function ehGastoFamiliaLeao(descricao: string): { ehFamilia: boolean; membro?: string; conta?: string } {
  const desc = descricao.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const [nome, dados] of Object.entries(regrasAmplaContabilidade.familiaLeao.membros)) {
    const nomeNormalizado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (desc.includes(nomeNormalizado)) {
      return { ehFamilia: true, membro: nome, conta: dados.conta };
    }
  }

  // Verificar investimentos
  for (const [nome, dados] of Object.entries(regrasAmplaContabilidade.familiaLeao.investimentos)) {
    const nomeNormalizado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (desc.includes(nomeNormalizado)) {
      return { ehFamilia: true, membro: nome, conta: dados.conta };
    }
  }

  // Verificar sítio
  if (desc.includes("SITIO") || desc.includes("SÍTIO")) {
    return { ehFamilia: true, membro: "SÍTIO", conta: "1.1.3.99" };
  }

  return { ehFamilia: false };
}

// Exportar tudo como módulo
export const baseConhecimento = {
  regrasContabeis,
  regrasFiscais,
  regrasDepartamentoPessoal,
  regrasAuditoria,
  regrasAmplaContabilidade,
  funcoes: {
    validarPartidaDobrada,
    identificarNaturezaConta,
    calcularINSS,
    ehGastoFamiliaLeao
  }
};

export default baseConhecimento;
