/**
 * MOTOR DE CLASSIFICAÇÃO AUTOMÁTICA - CONTTA FINANCEIRO
 * 
 * Este módulo é responsável por:
 * 1. Identificar automaticamente a conta débito/crédito de lançamentos
 * 2. Processar extratos OFX, notas fiscais e folha de pagamento
 * 3. Aplicar regras do Dr. Cícero para classificação
 * 
 * Fluxo: Extrato/NF/Folha → Identificação → Sugestão D/C → Aprovação Dr. Cícero
 * 
 * Autor: Sistema Contta / Ampla Contabilidade
 * Data: 31/01/2026
 */

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

export interface ClassificacaoAutomatica {
  id: string;
  descricao: string;
  tipo: 'ENTRADA' | 'SAIDA';
  debito: { codigo: string; nome: string };
  credito: { codigo: string; nome: string };
  confianca: number;
  autoClassificar: boolean;
  historico: string;
  fonte: 'OFX' | 'NF_ENTRADA' | 'NF_SAIDA' | 'FOLHA' | 'MANUAL';
  agenteResponsavel: string;
}

export interface PadraoOFX {
  regex: RegExp;
  keywords: string[];
  tipo: 'ENTRADA' | 'SAIDA' | 'AMBOS';
  categoria: string;
  debito: string;
  credito: string;
  debitoNome: string;
  creditoNome: string;
  confianca: number;
  autoClassificar: boolean;
  agenteResponsavel: string;
}

export interface RegraNotaFiscal {
  cfop: string[];
  cst?: string[];
  tipo: 'ENTRADA' | 'SAIDA';
  categoria: string;
  debito: string;
  credito: string;
  debitoNome: string;
  creditoNome: string;
  confianca: number;
}

export interface RegraFolhaPagamento {
  evento: string;
  natureza: 'PROVENTO' | 'DESCONTO' | 'BASE';
  debito: string;
  credito: string;
  debitoNome: string;
  creditoNome: string;
  confianca: number;
}

// =============================================================================
// CONTAS PRINCIPAIS DA AMPLA
// =============================================================================

export const CONTAS_AMPLA = {
  // ATIVO
  CAIXA: { codigo: '1.1.1.01', nome: 'Caixa' },
  BANCO_SICREDI: { codigo: '1.1.1.05', nome: 'Banco Sicredi' },
  CLIENTES: { codigo: '1.1.2.01', nome: 'Clientes a Receber' },
  ADIANTAMENTO_SOCIOS: { codigo: '1.1.3.01', nome: 'Adiantamento a Sócios' },
  TRANSITORIA_DEBITOS: { codigo: '1.1.9.01', nome: 'Transitória Débitos Pendentes' },
  IMOBILIZADO: { codigo: '1.2.3.01', nome: 'Imobilizado' },
  DEPRECIACAO: { codigo: '1.2.3.99', nome: '(-) Depreciação Acumulada' },
  
  // PASSIVO
  FORNECEDORES: { codigo: '2.1.1.01', nome: 'Fornecedores' },
  SALARIOS_PAGAR: { codigo: '2.1.2.01', nome: 'Salários a Pagar' },
  FGTS_PAGAR: { codigo: '2.1.2.02', nome: 'FGTS a Recolher' },
  INSS_PAGAR: { codigo: '2.1.2.03', nome: 'INSS a Recolher' },
  IRRF_PAGAR: { codigo: '2.1.2.04', nome: 'IRRF a Recolher' },
  ISS_PAGAR: { codigo: '2.1.3.01', nome: 'ISS a Recolher' },
  SIMPLES_PAGAR: { codigo: '2.1.3.02', nome: 'Simples Nacional a Recolher' },
  TRANSITORIA_CREDITOS: { codigo: '2.1.9.01', nome: 'Transitória Créditos Pendentes' },
  
  // RECEITAS
  HONORARIOS: { codigo: '3.1.1.01', nome: 'Receita de Honorários Contábeis' },
  RECEITAS_DIVERSAS: { codigo: '3.1.9.01', nome: 'Outras Receitas' },
  JUROS_RECEBIDOS: { codigo: '3.2.1.01', nome: 'Juros e Rendimentos' },
  
  // DESPESAS
  SALARIOS: { codigo: '4.1.2.01', nome: 'Salários e Ordenados' },
  PRO_LABORE: { codigo: '4.1.2.02', nome: 'Pró-labore' },
  FGTS: { codigo: '4.1.2.03', nome: 'FGTS' },
  INSS_PATRONAL: { codigo: '4.1.2.04', nome: 'INSS Patronal' },
  VALE_TRANSPORTE: { codigo: '4.1.2.05', nome: 'Vale Transporte' },
  VALE_ALIMENTACAO: { codigo: '4.1.2.06', nome: 'Vale Alimentação' },
  DECIMO_TERCEIRO: { codigo: '4.1.2.07', nome: '13º Salário' },
  FERIAS: { codigo: '4.1.2.08', nome: 'Férias' },
  ALUGUEL: { codigo: '4.1.1.01', nome: 'Aluguel' },
  ENERGIA: { codigo: '4.1.1.02', nome: 'Energia Elétrica' },
  AGUA: { codigo: '4.1.1.03', nome: 'Água' },
  TELEFONE: { codigo: '4.1.1.04', nome: 'Telefone e Internet' },
  MATERIAL_EXPEDIENTE: { codigo: '4.1.1.05', nome: 'Material de Expediente' },
  SOFTWARE: { codigo: '4.1.1.06', nome: 'Software e Sistemas' },
  DESPESAS_BANCARIAS: { codigo: '4.1.3.01', nome: 'Despesas Bancárias' },
  IOF: { codigo: '4.1.3.02', nome: 'IOF' },
  JUROS_PAGOS: { codigo: '4.1.3.03', nome: 'Juros Pagos' },
  DEPRECIACAO_DESP: { codigo: '4.1.4.01', nome: 'Depreciação' },
};

// =============================================================================
// PADRÕES DE CLASSIFICAÇÃO OFX
// =============================================================================

export const PADROES_OFX: PadraoOFX[] = [
  // ========== TARIFAS BANCÁRIAS (Auto-classificar) ==========
  {
    regex: /TARIFA|TAR\s|TXB|ANUIDADE|MANUT\s*CONTA|TAR\s*COM|TAR\s*PAC/i,
    keywords: ['tarifa', 'tar', 'txb', 'anuidade', 'manutencao', 'pacote', 'cobranca'],
    tipo: 'SAIDA',
    categoria: 'BANCARIO',
    debito: '4.1.3.01',
    credito: '1.1.1.05',
    debitoNome: 'Despesas Bancárias',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FISCAL'
  },
  {
    regex: /\bIOF\b/i,
    keywords: ['iof'],
    tipo: 'SAIDA',
    categoria: 'BANCARIO',
    debito: '4.1.3.02',
    credito: '1.1.1.05',
    debitoNome: 'IOF',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FISCAL'
  },
  
  // ========== FOLHA DE PAGAMENTO ==========
  {
    regex: /SALARIO|FOLHA|PGTO\s*FUNC|REMUNERACAO/i,
    keywords: ['salario', 'folha', 'funcionario', 'remuneracao', 'pagamento'],
    tipo: 'SAIDA',
    categoria: 'FOLHA_PAGAMENTO',
    debito: '2.1.2.01',
    credito: '1.1.1.05',
    debitoNome: 'Salários a Pagar',
    creditoNome: 'Banco Sicredi',
    confianca: 0.85,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  {
    regex: /PRO[\s-]*LABORE|PROLABORE|RETIRADA\s*SOCIO/i,
    keywords: ['pro-labore', 'prolabore', 'socio', 'retirada'],
    tipo: 'SAIDA',
    categoria: 'FOLHA_PAGAMENTO',
    debito: '4.1.2.02',
    credito: '1.1.1.05',
    debitoNome: 'Pró-labore',
    creditoNome: 'Banco Sicredi',
    confianca: 0.90,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  {
    regex: /\bFGTS\b|CAIXA\s*ECON.*FGTS|GRF/i,
    keywords: ['fgts', 'grf', 'caixa'],
    tipo: 'SAIDA',
    categoria: 'ENCARGOS',
    debito: '2.1.2.02',
    credito: '1.1.1.05',
    debitoNome: 'FGTS a Recolher',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  {
    regex: /\bINSS\b|GPS|PREVIDENCIA|DARF\s*PREV/i,
    keywords: ['inss', 'gps', 'previdencia'],
    tipo: 'SAIDA',
    categoria: 'ENCARGOS',
    debito: '2.1.2.03',
    credito: '1.1.1.05',
    debitoNome: 'INSS a Recolher',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  
  // ========== IMPOSTOS (Auto-classificar) ==========
  {
    regex: /\bDAS\b|SIMPLES\s*NACIONAL|PGDAS/i,
    keywords: ['das', 'simples', 'pgdas'],
    tipo: 'SAIDA',
    categoria: 'IMPOSTOS',
    debito: '2.1.3.02',
    credito: '1.1.1.05',
    debitoNome: 'Simples Nacional a Recolher',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FISCAL'
  },
  {
    regex: /\bISS\b|ISSQN/i,
    keywords: ['iss', 'issqn'],
    tipo: 'SAIDA',
    categoria: 'IMPOSTOS',
    debito: '2.1.3.01',
    credito: '1.1.1.05',
    debitoNome: 'ISS a Recolher',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FISCAL'
  },
  {
    regex: /\bDARF\b(?!.*PREV)/i,
    keywords: ['darf', 'federal'],
    tipo: 'SAIDA',
    categoria: 'IMPOSTOS',
    debito: '2.1.3.99',
    credito: '1.1.1.05',
    debitoNome: 'Impostos Federais a Recolher',
    creditoNome: 'Banco Sicredi',
    confianca: 0.85,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_FISCAL'
  },
  {
    regex: /\bIPTU\b/i,
    keywords: ['iptu'],
    tipo: 'SAIDA',
    categoria: 'IMPOSTOS',
    debito: '4.1.3.04',
    credito: '1.1.1.05',
    debitoNome: 'IPTU',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FISCAL'
  },
  
  // ========== SERVIÇOS PÚBLICOS (Auto-classificar) ==========
  {
    regex: /ENEL|CELG|EQUATORIAL|CPFL|CEMIG|COPEL|ENERGIA|ELETRIC|LUZ/i,
    keywords: ['enel', 'celg', 'equatorial', 'energia', 'luz', 'eletrica'],
    tipo: 'SAIDA',
    categoria: 'UTILIDADES',
    debito: '4.1.1.02',
    credito: '1.1.1.05',
    debitoNome: 'Energia Elétrica',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  {
    regex: /SANEAGO|SABESP|COPASA|CAGECE|AGUA\s*E\s*ESGOTO|AGUA/i,
    keywords: ['saneago', 'sabesp', 'agua', 'esgoto'],
    tipo: 'SAIDA',
    categoria: 'UTILIDADES',
    debito: '4.1.1.03',
    credito: '1.1.1.05',
    debitoNome: 'Água',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  {
    regex: /VIVO|TIM|CLARO|OI\s|TELEFONICA|INTERNET|TELECOM/i,
    keywords: ['vivo', 'tim', 'claro', 'oi', 'telefone', 'internet'],
    tipo: 'SAIDA',
    categoria: 'UTILIDADES',
    debito: '4.1.1.04',
    credito: '1.1.1.05',
    debitoNome: 'Telefone e Internet',
    creditoNome: 'Banco Sicredi',
    confianca: 0.92,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  
  // ========== ALUGUEL ==========
  {
    regex: /ALUGUEL|LOCACAO|CONDOMINIO/i,
    keywords: ['aluguel', 'locacao', 'condominio', 'locatario'],
    tipo: 'SAIDA',
    categoria: 'DESPESAS',
    debito: '4.1.1.01',
    credito: '1.1.1.05',
    debitoNome: 'Aluguel',
    creditoNome: 'Banco Sicredi',
    confianca: 0.90,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  
  // ========== SOFTWARE E SISTEMAS ==========
  {
    regex: /DOMINIO|FORTES|QUESTOR|CONTMATIC|TOTVS|SANKHYA|ALTERDATA|PROSOFT/i,
    keywords: ['dominio', 'fortes', 'questor', 'contmatic', 'sistema', 'software'],
    tipo: 'SAIDA',
    categoria: 'DESPESAS',
    debito: '4.1.1.06',
    credito: '1.1.1.05',
    debitoNome: 'Software e Sistemas',
    creditoNome: 'Banco Sicredi',
    confianca: 0.92,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  {
    regex: /GOOGLE|MICROSOFT|AMAZON|AWS|AZURE|DROPBOX|ZOOM|ADOBE/i,
    keywords: ['google', 'microsoft', 'amazon', 'aws', 'cloud', 'assinatura'],
    tipo: 'SAIDA',
    categoria: 'DESPESAS',
    debito: '4.1.1.06',
    credito: '1.1.1.05',
    debitoNome: 'Software e Sistemas',
    creditoNome: 'Banco Sicredi',
    confianca: 0.88,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  
  // ========== RECEBIMENTOS DE CLIENTES ==========
  {
    regex: /REC\s*PIX|PIX\s*REC|CRED\s*PIX|PIX\s*CRED/i,
    keywords: ['pix', 'recebimento', 'credito'],
    tipo: 'ENTRADA',
    categoria: 'RECEITAS',
    debito: '1.1.1.05',
    credito: '2.1.9.01',
    debitoNome: 'Banco Sicredi',
    creditoNome: 'Transitória Créditos Pendentes',
    confianca: 0.70,
    autoClassificar: false,
    agenteResponsavel: 'DR_CICERO'
  },
  {
    regex: /TED\s*REC|REC\s*TED|CRED\s*TED/i,
    keywords: ['ted', 'recebimento', 'transferencia'],
    tipo: 'ENTRADA',
    categoria: 'RECEITAS',
    debito: '1.1.1.05',
    credito: '2.1.9.01',
    debitoNome: 'Banco Sicredi',
    creditoNome: 'Transitória Créditos Pendentes',
    confianca: 0.70,
    autoClassificar: false,
    agenteResponsavel: 'DR_CICERO'
  },
  {
    regex: /LIQUIDACAO|BAIXA\s*BOLETO|BOLETO\s*PAGO/i,
    keywords: ['liquidacao', 'boleto', 'baixa', 'cobranca'],
    tipo: 'ENTRADA',
    categoria: 'RECEITAS',
    debito: '1.1.1.05',
    credito: '2.1.9.01',
    debitoNome: 'Banco Sicredi',
    creditoNome: 'Transitória Créditos Pendentes',
    confianca: 0.80,
    autoClassificar: false,
    agenteResponsavel: 'DR_CICERO'
  },
  
  // ========== FAMÍLIA LEÃO (Adiantamentos) ==========
  {
    regex: /SERGIO\s*(AUGUSTO|CARNEIRO|LEAO)|CARLA.*LEAO|VICTOR\s*HUGO|NAYARA/i,
    keywords: ['sergio', 'carla', 'victor', 'nayara', 'leao'],
    tipo: 'SAIDA',
    categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.01',
    credito: '1.1.1.05',
    debitoNome: 'Adiantamento a Sócios',
    creditoNome: 'Banco Sicredi',
    confianca: 0.92,
    autoClassificar: false,
    agenteResponsavel: 'DR_CICERO'
  },
  
  // ========== TRANSFERÊNCIAS INTERNAS ==========
  {
    regex: /TRANSF\s*ENTRE\s*CONTAS|TRF\s*MESMA\s*TITUL/i,
    keywords: ['transferencia', 'entre', 'contas', 'interna'],
    tipo: 'AMBOS',
    categoria: 'BANCARIO',
    debito: '1.1.1.01',
    credito: '1.1.1.05',
    debitoNome: 'Caixa / Outro Banco',
    creditoNome: 'Banco Sicredi',
    confianca: 0.85,
    autoClassificar: false,
    agenteResponsavel: 'DR_CICERO'
  },
  
  // ========== RENDIMENTOS (Auto-classificar) ==========
  {
    regex: /RENDIMENTO|APLICACAO|RESGATE|CDB|LCI|LCA|POUPANCA/i,
    keywords: ['rendimento', 'aplicacao', 'resgate', 'investimento'],
    tipo: 'ENTRADA',
    categoria: 'FINANCEIRO',
    debito: '1.1.1.05',
    credito: '3.2.1.01',
    debitoNome: 'Banco Sicredi',
    creditoNome: 'Juros e Rendimentos',
    confianca: 0.88,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
];

// =============================================================================
// REGRAS PARA NOTAS FISCAIS
// =============================================================================

export const REGRAS_NOTA_FISCAL: RegraNotaFiscal[] = [
  // NF SAÍDA - Venda de Serviços
  {
    cfop: ['5.933'],
    tipo: 'SAIDA',
    categoria: 'RECEITAS',
    debito: '1.1.2.01',
    credito: '3.1.1.01',
    debitoNome: 'Clientes a Receber',
    creditoNome: 'Receita de Honorários Contábeis',
    confianca: 0.95
  },
  
  // NF ENTRADA - Compra de Mercadorias
  {
    cfop: ['1.102', '2.102'],
    tipo: 'ENTRADA',
    categoria: 'ESTOQUE',
    debito: '1.1.4.01',
    credito: '2.1.1.01',
    debitoNome: 'Estoque de Mercadorias',
    creditoNome: 'Fornecedores',
    confianca: 0.90
  },
  
  // NF ENTRADA - Serviços de Terceiros PJ
  {
    cfop: ['1.933', '2.933'],
    tipo: 'ENTRADA',
    categoria: 'DESPESAS',
    debito: '4.1.1.20',
    credito: '2.1.1.01',
    debitoNome: 'Serviços de Terceiros PJ',
    creditoNome: 'Fornecedores',
    confianca: 0.88
  },
  
  // NF ENTRADA - Imobilizado
  {
    cfop: ['1.551', '2.551', '1.556', '2.556'],
    tipo: 'ENTRADA',
    categoria: 'ATIVO_IMOBILIZADO',
    debito: '1.2.3.01',
    credito: '2.1.1.01',
    debitoNome: 'Imobilizado',
    creditoNome: 'Fornecedores',
    confianca: 0.92
  },
  
  // NF ENTRADA - Material de Uso e Consumo
  {
    cfop: ['1.556', '2.556'],
    tipo: 'ENTRADA',
    categoria: 'DESPESAS',
    debito: '4.1.1.05',
    credito: '2.1.1.01',
    debitoNome: 'Material de Expediente',
    creditoNome: 'Fornecedores',
    confianca: 0.85
  },
];

// =============================================================================
// REGRAS PARA FOLHA DE PAGAMENTO
// =============================================================================

export const REGRAS_FOLHA: RegraFolhaPagamento[] = [
  // Salário Base
  {
    evento: 'SALARIO_BASE',
    natureza: 'PROVENTO',
    debito: '4.1.2.01',
    credito: '2.1.2.01',
    debitoNome: 'Salários e Ordenados',
    creditoNome: 'Salários a Pagar',
    confianca: 0.98
  },
  
  // Horas Extras
  {
    evento: 'HORA_EXTRA',
    natureza: 'PROVENTO',
    debito: '4.1.2.01',
    credito: '2.1.2.01',
    debitoNome: 'Salários e Ordenados',
    creditoNome: 'Salários a Pagar',
    confianca: 0.98
  },
  
  // Adicional Noturno
  {
    evento: 'ADICIONAL_NOTURNO',
    natureza: 'PROVENTO',
    debito: '4.1.2.01',
    credito: '2.1.2.01',
    debitoNome: 'Salários e Ordenados',
    creditoNome: 'Salários a Pagar',
    confianca: 0.98
  },
  
  // 13º Salário
  {
    evento: 'DECIMO_TERCEIRO',
    natureza: 'PROVENTO',
    debito: '4.1.2.07',
    credito: '2.1.2.01',
    debitoNome: '13º Salário',
    creditoNome: 'Salários a Pagar',
    confianca: 0.98
  },
  
  // Férias
  {
    evento: 'FERIAS',
    natureza: 'PROVENTO',
    debito: '4.1.2.08',
    credito: '2.1.2.01',
    debitoNome: 'Férias',
    creditoNome: 'Salários a Pagar',
    confianca: 0.98
  },
  
  // 1/3 Férias
  {
    evento: 'FERIAS_TERCO',
    natureza: 'PROVENTO',
    debito: '4.1.2.08',
    credito: '2.1.2.01',
    debitoNome: 'Férias',
    creditoNome: 'Salários a Pagar',
    confianca: 0.98
  },
  
  // INSS Empregado (Desconto)
  {
    evento: 'INSS_EMPREGADO',
    natureza: 'DESCONTO',
    debito: '2.1.2.01',
    credito: '2.1.2.03',
    debitoNome: 'Salários a Pagar',
    creditoNome: 'INSS a Recolher',
    confianca: 0.98
  },
  
  // IRRF (Desconto)
  {
    evento: 'IRRF',
    natureza: 'DESCONTO',
    debito: '2.1.2.01',
    credito: '2.1.2.04',
    debitoNome: 'Salários a Pagar',
    creditoNome: 'IRRF a Recolher',
    confianca: 0.98
  },
  
  // Vale Transporte (Desconto)
  {
    evento: 'VT_DESCONTO',
    natureza: 'DESCONTO',
    debito: '2.1.2.01',
    credito: '4.1.2.05',
    debitoNome: 'Salários a Pagar',
    creditoNome: 'Vale Transporte',
    confianca: 0.95
  },
  
  // FGTS Patronal
  {
    evento: 'FGTS',
    natureza: 'BASE',
    debito: '4.1.2.03',
    credito: '2.1.2.02',
    debitoNome: 'FGTS',
    creditoNome: 'FGTS a Recolher',
    confianca: 0.98
  },
  
  // INSS Patronal
  {
    evento: 'INSS_PATRONAL',
    natureza: 'BASE',
    debito: '4.1.2.04',
    credito: '2.1.2.03',
    debitoNome: 'INSS Patronal',
    creditoNome: 'INSS a Recolher',
    confianca: 0.98
  },
  
  // Pró-labore
  {
    evento: 'PRO_LABORE',
    natureza: 'PROVENTO',
    debito: '4.1.2.02',
    credito: '2.1.2.01',
    debitoNome: 'Pró-labore',
    creditoNome: 'Salários a Pagar',
    confianca: 0.98
  },
];

// =============================================================================
// FUNÇÕES DE CLASSIFICAÇÃO
// =============================================================================

/**
 * Classifica uma transação de extrato OFX
 */
export function classificarTransacaoOFX(descricao: string, valor: number): ClassificacaoAutomatica | null {
  const desc = descricao.toUpperCase();
  const tipo = valor > 0 ? 'ENTRADA' : 'SAIDA';
  
  for (const padrao of PADROES_OFX) {
    // Verifica se o padrão é compatível com o tipo da transação
    if (padrao.tipo !== 'AMBOS' && padrao.tipo !== tipo) {
      continue;
    }
    
    // Tenta match com regex
    if (padrao.regex.test(desc)) {
      return {
        id: `OFX_${Date.now()}`,
        descricao: descricao,
        tipo,
        debito: { codigo: padrao.debito, nome: padrao.debitoNome },
        credito: { codigo: padrao.credito, nome: padrao.creditoNome },
        confianca: padrao.confianca,
        autoClassificar: padrao.autoClassificar,
        historico: descricao,
        fonte: 'OFX',
        agenteResponsavel: padrao.agenteResponsavel
      };
    }
    
    // Tenta match com keywords
    const keywordMatch = padrao.keywords.some(kw => desc.includes(kw.toUpperCase()));
    if (keywordMatch) {
      return {
        id: `OFX_${Date.now()}`,
        descricao: descricao,
        tipo,
        debito: { codigo: padrao.debito, nome: padrao.debitoNome },
        credito: { codigo: padrao.credito, nome: padrao.creditoNome },
        confianca: padrao.confianca * 0.9, // Reduz confiança para match por keyword
        autoClassificar: padrao.autoClassificar && padrao.confianca >= 0.95,
        historico: descricao,
        fonte: 'OFX',
        agenteResponsavel: padrao.agenteResponsavel
      };
    }
  }
  
  // Padrão: usa transitória
  return {
    id: `OFX_${Date.now()}`,
    descricao: descricao,
    tipo,
    debito: tipo === 'ENTRADA' 
      ? { codigo: '1.1.1.05', nome: 'Banco Sicredi' }
      : { codigo: '1.1.9.01', nome: 'Transitória Débitos Pendentes' },
    credito: tipo === 'ENTRADA'
      ? { codigo: '2.1.9.01', nome: 'Transitória Créditos Pendentes' }
      : { codigo: '1.1.1.05', nome: 'Banco Sicredi' },
    confianca: 0,
    autoClassificar: false,
    historico: `Pendente classificação: ${descricao}`,
    fonte: 'OFX',
    agenteResponsavel: 'DR_CICERO'
  };
}

/**
 * Classifica uma nota fiscal
 */
export function classificarNotaFiscal(cfop: string, tipo: 'ENTRADA' | 'SAIDA'): ClassificacaoAutomatica | null {
  for (const regra of REGRAS_NOTA_FISCAL) {
    if (regra.cfop.includes(cfop) && regra.tipo === tipo) {
      return {
        id: `NF_${Date.now()}`,
        descricao: `NF ${tipo} - CFOP ${cfop}`,
        tipo,
        debito: { codigo: regra.debito, nome: regra.debitoNome },
        credito: { codigo: regra.credito, nome: regra.creditoNome },
        confianca: regra.confianca,
        autoClassificar: false,
        historico: `Nota Fiscal - CFOP ${cfop}`,
        fonte: tipo === 'ENTRADA' ? 'NF_ENTRADA' : 'NF_SAIDA',
        agenteResponsavel: 'AGENTE_FISCAL'
      };
    }
  }
  
  return null;
}

/**
 * Classifica um evento de folha de pagamento
 */
export function classificarEventoFolha(evento: string): ClassificacaoAutomatica | null {
  const eventoUpper = evento.toUpperCase();
  
  for (const regra of REGRAS_FOLHA) {
    if (regra.evento === eventoUpper || eventoUpper.includes(regra.evento)) {
      return {
        id: `FOLHA_${Date.now()}`,
        descricao: `Folha: ${evento}`,
        tipo: regra.natureza === 'DESCONTO' ? 'SAIDA' : 'ENTRADA',
        debito: { codigo: regra.debito, nome: regra.debitoNome },
        credito: { codigo: regra.credito, nome: regra.creditoNome },
        confianca: regra.confianca,
        autoClassificar: true, // Folha é sempre automática
        historico: `Evento Folha: ${evento}`,
        fonte: 'FOLHA',
        agenteResponsavel: 'AGENTE_TRABALHISTA'
      };
    }
  }
  
  return null;
}

/**
 * Lista padrões por categoria
 */
export function listarPadroesPorCategoria(categoria: string): PadraoOFX[] {
  return PADROES_OFX.filter(p => p.categoria === categoria);
}

/**
 * Lista todas as categorias disponíveis
 */
export function listarCategorias(): string[] {
  return [...new Set(PADROES_OFX.map(p => p.categoria))];
}

// =============================================================================
// EXPORTAÇÃO DEFAULT
// =============================================================================

export default {
  PADROES_OFX,
  REGRAS_NOTA_FISCAL,
  REGRAS_FOLHA,
  CONTAS_AMPLA,
  classificarTransacaoOFX,
  classificarNotaFiscal,
  classificarEventoFolha,
  listarPadroesPorCategoria,
  listarCategorias,
};
