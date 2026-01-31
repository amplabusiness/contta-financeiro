/**
 * ESTRUTURA DE AGENTES IA - CONTTA FINANCEIRO
 * 
 * Define a arquitetura hierárquica dos agentes de IA,
 * suas responsabilidades, telas de atuação e integração com o RAG.
 * 
 * Autor: Sistema Contta / Ampla Contabilidade
 * Data: 31/01/2026
 */

// =============================================================================
// ARQUITETURA DOS AGENTES
// =============================================================================

/**
 * HIERARQUIA DOS AGENTES:
 * 
 *                    ┌─────────────────┐
 *                    │   DR. CÍCERO    │  ← Contador Responsável (Supervisor)
 *                    │  (SUPERVISOR)   │
 *                    └────────┬────────┘
 *                             │
 *          ┌──────────────────┼──────────────────┐
 *          │                  │                  │
 *          ▼                  ▼                  ▼
 *  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
 *  │    AGENTE     │  │    AGENTE     │  │    AGENTE     │
 *  │    FISCAL     │  │  TRABALHISTA  │  │     MBA       │
 *  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
 *          │                  │                  │
 *          ▼                  ▼                  ▼
 *  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
 *  │    AGENTE     │  │    AGENTE     │  │    AGENTE     │
 *  │ ADMINISTRATIVO│  │   JURÍDICO    │  │  FINANCEIRO   │
 *  └───────────────┘  └───────────────┘  └───────────────┘
 */

export interface Agente {
  id: string;
  nome: string;
  papel: string;
  supervisor?: string;
  telas: TelaAtuacao[];
  responsabilidades: string[];
  conhecimentos: string[];
  autoClassificar: boolean;
  prioridadeAprovacao: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
}

export interface TelaAtuacao {
  rota: string;
  nome: string;
  funcoes: string[];
  componentes: string[];
}

export interface IntegracaoRAG {
  fontes: string[];
  atualizacaoAutomatica: boolean;
  vetorizacao: string;
  embeddings: string;
}

// =============================================================================
// DEFINIÇÃO DOS AGENTES
// =============================================================================

export const AGENTES: Record<string, Agente> = {
  // ========== SUPERVISOR PRINCIPAL ==========
  DR_CICERO: {
    id: 'dr-cicero',
    nome: 'Dr. Cícero',
    papel: 'Contador Responsável - Supervisor Geral',
    telas: [
      {
        rota: '/super-conciliation',
        nome: 'Super Conciliação',
        funcoes: [
          'Aprovar/Rejeitar classificações dos agentes subordinados',
          'Classificar transações não identificadas',
          'Reclassificar transações incorretas',
          'Criar lançamentos manuais complexos',
          'Consultar e ajustar plano de contas',
          'Validar integridade contábil'
        ],
        componentes: ['DrCiceroChat', 'ClassificationDialog', 'TransactionList']
      },
      {
        rota: '/accounting',
        nome: 'Contabilidade',
        funcoes: [
          'Visualizar lançamentos contábeis',
          'Gerar DRE e Balancete',
          'Fechar período contábil',
          'Ajustes de saldo'
        ],
        componentes: ['AccountingEntries', 'TrialBalance', 'DRE']
      },
      {
        rota: '/dashboard',
        nome: 'Dashboard',
        funcoes: [
          'Visão geral do escritório',
          'Alertas de pendências',
          'Indicadores financeiros'
        ],
        componentes: ['DashboardCards', 'AlertsPanel']
      }
    ],
    responsabilidades: [
      'Aprovar TODOS os lançamentos contábeis antes de executar',
      'Supervisionar classificações dos agentes subordinados',
      'Garantir conformidade com NBC e CFC',
      'Validar partidas dobradas',
      'Manter integridade do plano de contas',
      'Autorizar ajustes e estornos',
      'Fechar competências contábeis'
    ],
    conhecimentos: [
      'NBC TG - Normas Brasileiras de Contabilidade',
      'Plano de Contas da Ampla',
      'Regras de Partidas Dobradas',
      'Histórico de todos os clientes',
      'Padrões de classificação',
      'Modelos da Objetiva Edições'
    ],
    autoClassificar: false,
    prioridadeAprovacao: 'CRITICA'
  },

  // ========== AGENTE FISCAL ==========
  AGENTE_FISCAL: {
    id: 'agente-fiscal',
    nome: 'Agente Fiscal',
    papel: 'Especialista em Obrigações Fiscais e Tributárias',
    supervisor: 'DR_CICERO',
    telas: [
      {
        rota: '/super-conciliation',
        nome: 'Super Conciliação',
        funcoes: [
          'Classificar automaticamente: tarifas bancárias, IOF',
          'Identificar pagamentos de impostos (DAS, ISS, IPTU)',
          'Sugerir classificação de NF entrada/saída',
          'Calcular retenções na fonte'
        ],
        componentes: ['TransactionList', 'TaxCalculator']
      },
      {
        rota: '/invoices',
        nome: 'Notas Fiscais',
        funcoes: [
          'Processar NF-e de entrada',
          'Validar CFOP e CST',
          'Calcular créditos de ICMS/PIS/COFINS',
          'Gerar lançamentos de NF'
        ],
        componentes: ['InvoiceList', 'InvoiceImporter', 'TaxBreakdown']
      }
    ],
    responsabilidades: [
      'Classificar transações fiscais e tributárias',
      'Identificar CFOP correto para operações',
      'Validar CST de ICMS, PIS e COFINS',
      'Calcular e provisionar impostos',
      'Identificar créditos tributários',
      'Gerar guias de recolhimento'
    ],
    conhecimentos: [
      'CFOP - Códigos Fiscais de Operações',
      'CST ICMS e CSOSN (Simples Nacional)',
      'CST PIS/COFINS',
      'Regras de Substituição Tributária',
      'Retenções na Fonte (ISS, IRRF, CSRF)',
      'Simples Nacional e DAS',
      'LC 116 - Serviços de ISS'
    ],
    autoClassificar: true,
    prioridadeAprovacao: 'MEDIA'
  },

  // ========== AGENTE TRABALHISTA ==========
  AGENTE_TRABALHISTA: {
    id: 'agente-trabalhista',
    nome: 'Agente Trabalhista',
    papel: 'Especialista em Departamento Pessoal e eSocial',
    supervisor: 'DR_CICERO',
    telas: [
      {
        rota: '/super-conciliation',
        nome: 'Super Conciliação',
        funcoes: [
          'Classificar pagamentos de salários e pró-labore',
          'Identificar recolhimentos de FGTS e INSS',
          'Sugerir classificação de encargos sociais'
        ],
        componentes: ['TransactionList', 'PayrollMatcher']
      },
      {
        rota: '/payroll',
        nome: 'Folha de Pagamento',
        funcoes: [
          'Importar resumo de folha',
          'Gerar lançamentos contábeis da folha',
          'Calcular provisões (13º, férias)',
          'Validar eventos do eSocial'
        ],
        componentes: ['PayrollSummary', 'PayrollImporter', 'ESocialEvents']
      }
    ],
    responsabilidades: [
      'Processar folha de pagamento',
      'Contabilizar proventos e descontos',
      'Calcular encargos sociais (FGTS, INSS)',
      'Provisionar 13º salário e férias',
      'Validar eventos do eSocial',
      'Identificar categorias de trabalhadores'
    ],
    conhecimentos: [
      'Eventos eSocial (S-1000 a S-2400)',
      'Incidências Tributárias (FGTS, INSS, IRRF)',
      'Categorias de Trabalhadores (101-905)',
      'Motivos de Afastamento e Desligamento',
      'Cálculo de Férias e 13º',
      'Rescisão Trabalhista',
      'Tabela INSS e IRRF'
    ],
    autoClassificar: true,
    prioridadeAprovacao: 'MEDIA'
  },

  // ========== AGENTE MBA (FINANCEIRO) ==========
  AGENTE_MBA: {
    id: 'agente-mba',
    nome: 'Agente MBA',
    papel: 'Especialista em Análise Financeira e Indicadores',
    supervisor: 'DR_CICERO',
    telas: [
      {
        rota: '/reports',
        nome: 'Relatórios Gerenciais',
        funcoes: [
          'Gerar análise financeira completa',
          'Calcular indicadores de liquidez',
          'Calcular indicadores de rentabilidade',
          'Análise DuPont',
          'Projeção de fluxo de caixa',
          'Análise de NCG'
        ],
        componentes: ['FinancialAnalysis', 'IndicatorsPanel', 'DuPontChart']
      },
      {
        rota: '/dashboard',
        nome: 'Dashboard',
        funcoes: [
          'Exibir KPIs financeiros',
          'Tendências e alertas',
          'Comparativos período a período'
        ],
        componentes: ['KPICards', 'TrendCharts', 'AlertsPanel']
      },
      {
        rota: '/cash-flow',
        nome: 'Fluxo de Caixa',
        funcoes: [
          'Projetar entradas e saídas',
          'Identificar gaps de caixa',
          'Simular cenários'
        ],
        componentes: ['CashFlowProjection', 'ScenarioSimulator']
      }
    ],
    responsabilidades: [
      'Calcular indicadores financeiros',
      'Gerar análises de liquidez, rentabilidade e endividamento',
      'Realizar análise DuPont',
      'Calcular NCG (Necessidade de Capital de Giro)',
      'Projetar fluxo de caixa',
      'Identificar tendências e riscos',
      'Gerar recomendações estratégicas'
    ],
    conhecimentos: [
      'Indicadores de Liquidez (Corrente, Seca, Imediata, Geral)',
      'Indicadores de Rentabilidade (ROE, ROA, ROI, Margens)',
      'Indicadores de Endividamento',
      'Indicadores de Atividade (PMR, PMP, PME, Ciclos)',
      'Análise DuPont (3 e 5 fatores)',
      'Valuation (EV/EBITDA, P/L, WACC)',
      'Projeção Financeira'
    ],
    autoClassificar: false,
    prioridadeAprovacao: 'BAIXA'
  },

  // ========== AGENTE ADMINISTRATIVO ==========
  AGENTE_ADMINISTRATIVO: {
    id: 'agente-administrativo',
    nome: 'Agente Administrativo',
    papel: 'Especialista em Despesas Operacionais',
    supervisor: 'DR_CICERO',
    telas: [
      {
        rota: '/super-conciliation',
        nome: 'Super Conciliação',
        funcoes: [
          'Classificar despesas de utilidades (energia, água, telefone)',
          'Identificar assinaturas e software',
          'Sugerir classificação de material de expediente'
        ],
        componentes: ['TransactionList', 'ExpenseClassifier']
      },
      {
        rota: '/expenses',
        nome: 'Despesas',
        funcoes: [
          'Gerenciar categorias de despesas',
          'Aprovar despesas pendentes',
          'Gerar relatórios de gastos'
        ],
        componentes: ['ExpenseList', 'CategoryManager', 'ExpenseReports']
      }
    ],
    responsabilidades: [
      'Classificar despesas operacionais e administrativas',
      'Identificar fornecedores de serviços',
      'Categorizar despesas por centro de custo',
      'Validar notas fiscais de despesas'
    ],
    conhecimentos: [
      'Categorias de Despesas Operacionais',
      'Fornecedores de Serviços (Energia, Água, Telefone)',
      'Software e Sistemas Contábeis',
      'Material de Expediente',
      'Despesas com Manutenção'
    ],
    autoClassificar: true,
    prioridadeAprovacao: 'BAIXA'
  },

  // ========== AGENTE FINANCEIRO ==========
  AGENTE_FINANCEIRO: {
    id: 'agente-financeiro',
    nome: 'Agente Financeiro',
    papel: 'Especialista em Operações Bancárias e Tesouraria',
    supervisor: 'DR_CICERO',
    telas: [
      {
        rota: '/super-conciliation',
        nome: 'Super Conciliação',
        funcoes: [
          'Classificar rendimentos e aplicações',
          'Identificar juros pagos e recebidos',
          'Processar transferências entre contas'
        ],
        componentes: ['TransactionList', 'BankReconciliation']
      },
      {
        rota: '/banking',
        nome: 'Bancário',
        funcoes: [
          'Importar extratos OFX',
          'Conciliar saldos bancários',
          'Gerenciar contas bancárias'
        ],
        componentes: ['OFXImporter', 'BankAccounts', 'ReconciliationPanel']
      }
    ],
    responsabilidades: [
      'Processar operações bancárias',
      'Conciliar extratos com lançamentos',
      'Identificar rendimentos financeiros',
      'Classificar juros e encargos bancários',
      'Gerenciar aplicações financeiras'
    ],
    conhecimentos: [
      'Operações Bancárias (TED, DOC, PIX)',
      'Aplicações Financeiras (CDB, LCI, LCA)',
      'Tarifas Bancárias',
      'IOF e Encargos',
      'Conciliação Bancária'
    ],
    autoClassificar: true,
    prioridadeAprovacao: 'BAIXA'
  },

  // ========== AGENTE JURÍDICO ==========
  AGENTE_JURIDICO: {
    id: 'agente-juridico',
    nome: 'Agente Jurídico',
    papel: 'Especialista em Questões Legais e Contingências',
    supervisor: 'DR_CICERO',
    telas: [
      {
        rota: '/legal',
        nome: 'Jurídico',
        funcoes: [
          'Registrar contingências e provisões',
          'Acompanhar processos judiciais',
          'Calcular provisões trabalhistas e tributárias'
        ],
        componentes: ['ContingencyList', 'ProcessTracker', 'ProvisionCalculator']
      }
    ],
    responsabilidades: [
      'Provisionar contingências judiciais',
      'Acompanhar processos (trabalhistas, tributários, cíveis)',
      'Calcular risco de perda',
      'Registrar acordos e baixas'
    ],
    conhecimentos: [
      'Provisões para Contingências',
      'Processos Trabalhistas',
      'Processos Tributários',
      'Acordos Judiciais',
      'CPC 25 - Provisões'
    ],
    autoClassificar: false,
    prioridadeAprovacao: 'ALTA'
  }
};

// =============================================================================
// INTEGRAÇÃO RAG
// =============================================================================

export const INTEGRACAO_RAG: IntegracaoRAG = {
  fontes: [
    // Fontes oficiais
    'cfc.org.br - Manuais CFC',
    'objetivaedicoes.com.br - Modelos de Lançamentos',
    'contabeis.com.br - Artigos e Tutoriais',
    'portaldecontabilidade.com.br - Guias Práticos',
    
    // Documentos internos
    'ESPECIFICACAO_CONTABIL_DR_CICERO.md',
    'drCiceroKnowledge.ts - Base de Conhecimento',
    'knowledgeBase.ts - Base Expandida',
    
    // JSONs de conhecimento
    'esocial-knowledge.json',
    'nota-fiscal-knowledge.json',
    'mba-indicadores-knowledge.json',
    'lancamentos-contabeis-completo.json'
  ],
  atualizacaoAutomatica: true,
  vetorizacao: 'OpenAI text-embedding-3-small',
  embeddings: 'Supabase pgvector'
};

// =============================================================================
// FLUXO DE CLASSIFICAÇÃO AUTOMÁTICA
// =============================================================================

/**
 * FLUXO DE PROCESSAMENTO:
 * 
 * 1. IMPORTAÇÃO
 *    ├── OFX (Extrato) → classificadorAutomatico.ts → AGENTE identifica
 *    ├── NF-e (XML)    → leitor-nfe → AGENTE_FISCAL classifica
 *    └── Folha (TXT)   → parser folha → AGENTE_TRABALHISTA processa
 * 
 * 2. CLASSIFICAÇÃO
 *    ├── Auto-classificável (confiança >= 95%)?
 *    │   ├── SIM → Aplicar classificação → Notificar Dr. Cícero
 *    │   └── NÃO → Enviar para aprovação do Dr. Cícero
 *    │
 *    └── Agente sugere D/C baseado em:
 *        ├── Padrões de regex (PADROES_OFX)
 *        ├── Keywords identificadas
 *        ├── Histórico de transações similares
 *        └── Base de conhecimento (RAG)
 * 
 * 3. APROVAÇÃO DR. CÍCERO
 *    ├── Aprova → Gera lançamento contábil
 *    ├── Ajusta → Corrige classificação → Gera lançamento
 *    └── Rejeita → Retorna para agente com feedback
 * 
 * 4. LANÇAMENTO CONTÁBIL
 *    ├── Valida partidas dobradas
 *    ├── Verifica idempotência (internal_code)
 *    ├── Cria accounting_entries + accounting_entry_lines
 *    └── Vincula com bank_transaction (se OFX)
 */

export interface FluxoClassificacao {
  etapa: 'IMPORTACAO' | 'CLASSIFICACAO' | 'APROVACAO' | 'LANCAMENTO';
  fonte: 'OFX' | 'NF_ENTRADA' | 'NF_SAIDA' | 'FOLHA' | 'MANUAL';
  agenteResponsavel: string;
  requerAprovacao: boolean;
  confiancaMinima: number;
}

export const FLUXOS_CLASSIFICACAO: FluxoClassificacao[] = [
  // OFX - Extrato Bancário
  {
    etapa: 'IMPORTACAO',
    fonte: 'OFX',
    agenteResponsavel: 'SISTEMA',
    requerAprovacao: false,
    confiancaMinima: 0
  },
  {
    etapa: 'CLASSIFICACAO',
    fonte: 'OFX',
    agenteResponsavel: 'AGENTE_IDENTIFICADO',
    requerAprovacao: true,
    confiancaMinima: 0.70
  },
  {
    etapa: 'APROVACAO',
    fonte: 'OFX',
    agenteResponsavel: 'DR_CICERO',
    requerAprovacao: true,
    confiancaMinima: 0.95
  },
  
  // NF-e Entrada
  {
    etapa: 'IMPORTACAO',
    fonte: 'NF_ENTRADA',
    agenteResponsavel: 'SISTEMA',
    requerAprovacao: false,
    confiancaMinima: 0
  },
  {
    etapa: 'CLASSIFICACAO',
    fonte: 'NF_ENTRADA',
    agenteResponsavel: 'AGENTE_FISCAL',
    requerAprovacao: true,
    confiancaMinima: 0.80
  },
  
  // Folha de Pagamento
  {
    etapa: 'IMPORTACAO',
    fonte: 'FOLHA',
    agenteResponsavel: 'SISTEMA',
    requerAprovacao: false,
    confiancaMinima: 0
  },
  {
    etapa: 'CLASSIFICACAO',
    fonte: 'FOLHA',
    agenteResponsavel: 'AGENTE_TRABALHISTA',
    requerAprovacao: false, // Folha é processada automaticamente
    confiancaMinima: 0.95
  }
];

// =============================================================================
// BENEFÍCIOS PARA O USUÁRIO
// =============================================================================

export const BENEFICIOS_USUARIO = {
  velocidade: {
    descricao: 'Classificação automática de 70%+ das transações',
    metrica: 'Tempo médio de conciliação reduzido de 4h para 30min'
  },
  precisao: {
    descricao: 'Sugestões de D/C baseadas em padrões comprovados',
    metrica: 'Taxa de acerto de 95%+ nas classificações automáticas'
  },
  conformidade: {
    descricao: 'Validação automática de partidas dobradas e plano de contas',
    metrica: '100% de conformidade com NBC TG'
  },
  rastreabilidade: {
    descricao: 'Cada lançamento tem internal_code único',
    metrica: 'Auditoria completa de origem a destino'
  },
  aprendizado: {
    descricao: 'Sistema aprende com as correções do Dr. Cícero',
    metrica: 'Melhoria contínua das sugestões'
  }
};

// =============================================================================
// EXPORTAÇÕES
// =============================================================================

export default {
  AGENTES,
  INTEGRACAO_RAG,
  FLUXOS_CLASSIFICACAO,
  BENEFICIOS_USUARIO
};
