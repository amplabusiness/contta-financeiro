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
  CLIENTES_DIVERSOS: { codigo: '1.1.2.01.9999', nome: 'Clientes Diversos (Conciliação)' },
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
  
  // DESPESAS - Pessoal (4.2.1.xx)
  SALARIOS: { codigo: '4.2.1.01', nome: 'Salários' },
  PRO_LABORE: { codigo: '4.2.1.06', nome: 'Pró-labore' },
  FGTS: { codigo: '4.2.1.03', nome: 'FGTS' },
  INSS_PATRONAL: { codigo: '4.2.1.02', nome: 'INSS Patronal' },
  VALE_TRANSPORTE: { codigo: '4.2.1.04', nome: 'Vale Transporte' },
  VALE_ALIMENTACAO: { codigo: '4.2.1.05', nome: 'Vale Alimentação' },
  DECIMO_TERCEIRO: { codigo: '4.2.1.08', nome: '13º Salário' },
  FERIAS: { codigo: '4.2.1.07', nome: 'Férias' },
  // DESPESAS - Administrativas (4.1.2.xx) - CORRIGIDO: antes usava 4.1.1.xx errado
  ALUGUEL: { codigo: '4.1.2.01', nome: 'Aluguel' },
  ENERGIA: { codigo: '4.1.2.02', nome: 'Energia Elétrica' },
  AGUA: { codigo: '4.1.2.06', nome: 'Gás' },
  TELEFONE: { codigo: '4.1.2.03', nome: 'Telefone e Internet' },
  MATERIAL_EXPEDIENTE: { codigo: '4.1.2.14', nome: 'Material de Papelaria' },
  SOFTWARE: { codigo: '4.1.2.12.99', nome: 'Outros Software e Sistemas' },
  DESPESAS_BANCARIAS: { codigo: '4.1.10', nome: 'Despesas Bancárias' },
  IOF: { codigo: '4.3.1.03', nome: 'IOF' },
  JUROS_PAGOS: { codigo: '4.3.2.01', nome: 'Juros de Mora' },
  DEPRECIACAO_DESP: { codigo: '4.8.1.01', nome: 'Depreciação de Móveis' },
  // DESPESAS - Taxas e Licenças
  TAXAS_CRC: { codigo: '4.1.4.04', nome: 'Taxas e Licenças (CRC, etc)' },
  // ADIANTAMENTOS SÓCIOS
  ADIANT_SERGIO_CARNEIRO: { codigo: '1.1.3.04.01', nome: 'Adiantamento Sérgio Carneiro' },
};

// =============================================================================
// PADRÕES DE CLASSIFICAÇÃO OFX
// =============================================================================

export const PADROES_OFX: PadraoOFX[] = [
  // ========== TARIFAS BANCÁRIAS (Auto-classificar) ==========
  {
    regex: /TARIFA|TAR\s|TXB|ANUIDADE|MANUT\s*CONTA|TAR\s*COM|TAR\s*PAC|MANUTENCAO\s*DE\s*TITULOS|CESTA\s*DE\s*RELACIONAMENTO/i,
    keywords: ['tarifa', 'tar', 'txb', 'anuidade', 'manutencao', 'pacote', 'cobranca', 'cesta de relacionamento', 'manutencao de titulos'],
    tipo: 'SAIDA',
    categoria: 'BANCARIO',
    debito: '4.1.10',
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
    debito: '4.1.4.03',
    credito: '1.1.1.05',
    debitoNome: 'IPTU',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FISCAL'
  },
  
  // ========== FORNECEDORES ESPECÍFICOS (ANTES dos genéricos) ==========
  // Condomínio Galeria Nacional → Adiantamento Sérgio Carneiro (sócio)
  {
    regex: /CONDOMINIO.*GAL|GALERIA\s*NACIONAL/i,
    keywords: ['condominio da galeria', 'galeria nacional'],
    tipo: 'SAIDA',
    categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01',
    credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Andrea Leone Bastos → Adiantamento sócio (aluguel casa praia)
  {
    regex: /ANDREA\s*LEONE/i,
    keywords: ['andrea leone'],
    tipo: 'SAIDA',
    categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01',
    credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Conselho Regional de Contabilidade → Taxas e Licenças CRC
  {
    regex: /CONS\s*REG\s*CONTABIL|01015676000111/i,
    keywords: ['cons reg contabil', 'crc'],
    tipo: 'SAIDA',
    categoria: 'IMPOSTOS',
    debito: '4.1.4.04',
    credito: '1.1.1.05',
    debitoNome: 'Taxas e Licenças (CRC, etc)',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // CR Sistema e Análise → Sistema SAAM
  {
    regex: /CR\s*SIST/i,
    keywords: ['cr sistema', 'cr sist'],
    tipo: 'SAIDA',
    categoria: 'DESPESAS',
    debito: '4.1.2.12.03',
    credito: '1.1.1.05',
    debitoNome: 'Sistema SAAM - CR Sistema',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Danielle Rodrigues → Sueli MEI (recebe via filha)
  {
    regex: /DANIELLE\s*RODRIGUES|04947719176/i,
    keywords: ['danielle rodrigues'],
    tipo: 'SAIDA',
    categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.07',
    credito: '1.1.1.05',
    debitoNome: 'Sueli (MEI)',
    creditoNome: 'Banco Sicredi',
    confianca: 0.98,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_TRABALHISTA'
  },

  // ========== ADIANTAMENTOS SÓCIOS - CPFs ESPECÍFICOS (ANTES dos genéricos) ==========
  // Sérgio Carneiro Leão (sócio principal)
  {
    regex: /48656488104|SERGIO\s*CARNEIRO\s*LEAO/i,
    keywords: ['sergio carneiro'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Fabrício Bomfim → adiant. Sérgio Carneiro
  {
    regex: /75619318168|FABRICIO.*BOMFIM/i,
    keywords: ['fabricio bomfim'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Antonio Leandro → personal trainer Sérgio
  {
    regex: /76625974153|ANTONIO\s*LEANDRO/i,
    keywords: ['antonio leandro'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Vonoria Amélia → passadeira roupa Sérgio
  {
    regex: /97163988168|VONORIA/i,
    keywords: ['vonoria'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Miguel Carvalho → conserto casa Sérgio
  {
    regex: /48541079104|MIGUEL\s*CARVALHO/i,
    keywords: ['miguel carvalho'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Maria Aparecida Gomes → diarista lago Sérgio
  {
    regex: /99940892691|MARIA\s*APARECIDA\s*GOMES/i,
    keywords: ['maria aparecida'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Tharson Diego → pedreiro lago das brisas
  {
    regex: /05746859109|THARSON\s*DIEGO/i,
    keywords: ['tharson diego'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Fabiana Maria → babá da Nayara → adiant. Nayara
  {
    regex: /00141198117|FABIANA\s*MARIA.*MENDONCA/i,
    keywords: ['fabiana maria'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.04', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Nayara', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Raimundo Pereira → caseiro chácara Sérgio → adiant. Sérgio
  {
    regex: /35659246249|RAIMUNDO\s*PEREIRA/i,
    keywords: ['raimundo pereira'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro (caseiro chácara)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Kenio Martins → caseiro chácara Sérgio (substituto Raimundo) → adiant. Sérgio
  {
    regex: /50761730168|KENIO\s*MARTINS/i,
    keywords: ['kenio martins'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro (caseiro chácara)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Claudia Barbosa → babá (substituta Fabiana) → adiant. Nayara
  {
    regex: /43510469100|CLAUDIA\s*BARBOSA/i,
    keywords: ['claudia barbosa'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.04', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Nayara (babá)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== CLT ESPECÍFICOS ==========
  // Josimar dos Santos → CLT + MEI folha
  {
    regex: /02073111106|JOSIMAR.*SANTOS/i,
    keywords: ['josimar santos'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '2.1.2.01', credito: '1.1.1.05',
    debitoNome: 'Salários a Pagar', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Thaynara Conceição → CLT contábil
  {
    regex: /03924444102|THAYNARA.*CONCEICAO/i,
    keywords: ['thaynara conceicao'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '2.1.2.01', credito: '1.1.1.05',
    debitoNome: 'Salários a Pagar', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },

  // ========== RESCISÃO ==========
  // Deuza Resende → ex-funcionária rescisão
  {
    regex: /82817375149|DEUZA\s*RESENDE/i,
    keywords: ['deuza resende'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '2.1.2.10.01', credito: '1.1.1.05',
    debitoNome: 'Saldo Salário Rescisão', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },

  // ========== MEI ESPECÍFICOS ==========
  // Daniel Rodrigues Ribeiro → MEI contratado Ampla (R$ 10.500/mês + comissões)
  {
    regex: /41787134000181|DANIEL\s*RODRIGUES\s*RIBEIRO/i,
    keywords: ['daniel rodrigues ribeiro'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.03', credito: '1.1.1.05',
    debitoNome: 'Daniel Rodrigues Ribeiro (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Maria José da Silva Moura Moreira → MEI terceirizada
  {
    regex: /62544160268|MARIA\s*JOSE\s*DA\s*SILVA\s*MOURA/i,
    keywords: ['maria jose moura'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.20', credito: '1.1.1.05',
    debitoNome: 'Maria José da Silva Moura Moreira (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Beatriz Tibúrcio da Silva → MEI terceirizada
  {
    regex: /70803165102|BEATRIZ\s*TIBURCIO/i,
    keywords: ['beatriz tiburcio'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.21', credito: '1.1.1.05',
    debitoNome: 'Beatriz Tibúrcio da Silva (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Hosivaldo Gomes Costa → MEI terceirizado
  {
    regex: /92664679104|HOSIVALDO\s*GOMES/i,
    keywords: ['hosivaldo gomes'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.22', credito: '1.1.1.05',
    debitoNome: 'Hosivaldo Gomes Costa (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Coraci Aline → MEI terceira folha
  {
    regex: /02926538162|CORACI\s*ALINE/i,
    keywords: ['coraci aline'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.10', credito: '1.1.1.05',
    debitoNome: 'Coraci Aline dos Santos (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Andrea Fagundes → MEI terceirizada (R$ 1.500/mês)
  {
    regex: /79512801191|ANDREA\s*FAGUNDES/i,
    keywords: ['andrea fagundes'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.04', credito: '1.1.1.05',
    debitoNome: 'Andrea Fagundes (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Rosemeire Rodrigues → MEI terceirizada
  {
    regex: /81875835172|ROSEMEIRE\s*RODRIGUES/i,
    keywords: ['rosemeire rodrigues'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.06', credito: '1.1.1.05',
    debitoNome: 'Rosemeire Rodrigues (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Lilian Moreira da Costa → MEI terceirizada (CPF 71251537120)
  {
    regex: /71251537120|LILIAN\s*MOREIRA/i,
    keywords: ['lilian moreira'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.05', credito: '1.1.1.05',
    debitoNome: 'Lilian Moreira (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Taylane Belle Ferreira Saraiva → MEI terceirizada (CPF 05799682190)
  {
    regex: /05799682190|TAYLANE/i,
    keywords: ['taylane'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.09', credito: '1.1.1.05',
    debitoNome: 'Taylane (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Liliane Batista Rodrigues Gomes → MEI terceirizada (CPF 01160288151)
  {
    regex: /01160288151|LILIANE\s*BATISTA/i,
    keywords: ['liliane batista'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.12', credito: '1.1.1.05',
    debitoNome: 'Liliane Batista Rodrigues Gomes (MEI)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // OkEmpresa Compliance (CNPJ 36266121000127) = Bruno Victor de Freitas (terceiro TI)
  {
    regex: /36266121000127|OKEMPRESA|OK\s*EMPRESA/i,
    keywords: ['okempresa', 'ok empresa', 'bruno victor'], tipo: 'SAIDA', categoria: 'FOLHA_PAGAMENTO',
    debito: '4.2.11.23', credito: '1.1.1.05',
    debitoNome: 'Bruno Victor de Freitas (TI)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Maria José de Jesus (CPF 19047991168) → Adiantamento Sérgio Carneiro
  {
    regex: /19047991168|MARIA\s*JOSE\s*DE\s*JESUS/i,
    keywords: ['maria jose de jesus'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro (Maria José de Jesus)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Andreia (CPF 00834584506) → comissão aluguel Guarajuba = adiantamento Sérgio
  {
    regex: /00834584506/i,
    keywords: ['andreia'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiant. Sérgio Carneiro (Andreia comissão aluguel)', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== BENEFÍCIOS ESPECÍFICOS ==========
  // VR Benefícios → Vale Alimentação
  {
    regex: /02535864000133|VR\s*BENEF/i,
    keywords: ['vr beneficios'], tipo: 'SAIDA', categoria: 'ENCARGOS',
    debito: '4.2.1.05', credito: '1.1.1.05',
    debitoNome: 'Vale Alimentação', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Ampla Saúde Ocupacional → Exames
  {
    regex: /50464753000126|AMPLA\s*SAUDE/i,
    keywords: ['ampla saude'], tipo: 'SAIDA', categoria: 'ENCARGOS',
    debito: '4.2.7.01', credito: '1.1.1.05',
    debitoNome: 'Exames Admissionais', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },
  // Caixa Econômica Federal → FGTS
  {
    regex: /00360305000104|CAIXA\s*ECONOMICA/i,
    keywords: ['caixa economica'], tipo: 'SAIDA', categoria: 'ENCARGOS',
    debito: '2.1.2.02', credito: '1.1.1.05',
    debitoNome: 'FGTS a Recolher', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },

  // ========== DESPESAS ADMINISTRATIVAS ESPECÍFICAS ==========
  // Copa e Cozinha - Josimar reembolso pão de queijo (valor < R$ 100)
  {
    regex: /02073111106.*JOSIMAR|JOSIMAR.*SANTOS.*MOTA/i,
    keywords: ['josimar', 'pao de queijo', 'copa'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.09', credito: '1.1.1.05',
    debitoNome: 'Copa e Cozinha - Reembolso Josimar', creditoNome: 'Banco Sicredi',
    confianca: 0.90, autoClassificar: false, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Água mineral (Luiz Taveira ou Água Pura)
  {
    regex: /43572456134|05384518000190|AGUA\s*PURA|LUIZ\s*ALVES\s*TAVEIRA/i,
    keywords: ['agua mineral', 'agua pura', 'luiz taveira'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.07', credito: '1.1.1.05',
    debitoNome: 'Água Mineral', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Scala Contabilidade → Adiantamento Sócio Sérgio (empresa dele, Pronampe SICREDI)
  {
    regex: /SCALA\s*CONTAB|SCALA\s*SERVICOS/i,
    keywords: ['scala', 'scala contabilidade'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiant. Sérgio Carneiro (Scala)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Econet Publicações (CNPJ 11436073000147)
  {
    regex: /11436073000147|ECONET/i,
    keywords: ['econet'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.11', credito: '1.1.1.05',
    debitoNome: 'Econet Publicacoes', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Zappy Contábil / ComHub (CNPJ 07861028000162)
  {
    regex: /07861028000162|ZAPPY|COMHUB/i,
    keywords: ['zappy', 'comhub'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.09', credito: '1.1.1.05',
    debitoNome: 'Zappy Contabil (ComHub)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // COP Sistemas (CNPJ 08326645000120)
  {
    regex: /08326645000120|COP\s*SISTEMA/i,
    keywords: ['cop sistemas'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.16', credito: '1.1.1.05',
    debitoNome: 'COP Sistemas', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // PJBank → Digital Up Acessórias (valor >= R$ 150) - 4.1.2.12.07
  // PJBank → Tangerino ponto eletrônico (valor < R$ 150) - 4.1.2.12.15
  // Nota: ambos pagos via PJBank (CNPJ 18191228000171), separação por valor
  {
    regex: /PJBANK|PJ\s*BANK|18191228000171/i,
    keywords: ['pjbank', 'pj bank'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.07', credito: '1.1.1.05',
    debitoNome: 'Digital Up (Acessorias) via PJBank', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Nova Visão Imports → Reforma Sede
  {
    regex: /NOVA\s*VIS[AÃ]O|NOVA\s*VISAO|11869122000135/i,
    keywords: ['nova visao', 'nova visão'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.15.03', credito: '1.1.1.05',
    debitoNome: 'Nova Visao Imports (Reforma Sede)', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // PIX Marketplace → Material de Papelaria/Escritório
  {
    regex: /PIX\s*MARKETPLACE/i,
    keywords: ['pix marketplace'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.14', credito: '1.1.1.05',
    debitoNome: 'Material de Papelaria (PIX Marketplace)', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Center Luzz → Reforma Sede (elétrica/iluminação)
  {
    regex: /CENTER\s*LUZZ|16366409000166/i,
    keywords: ['center luzz'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.15.04', credito: '1.1.1.05',
    debitoNome: 'Center Luzz (Reforma Sede)', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ═══ SOFTWARE POR CNPJ (todos confirmados pelo PDF despesas jan/2025) ═══
  // Thomson Reuters (Domínio Sistemas) - ERP contábil principal
  {
    regex: /00910509001305|THOMSON\s*REUTERS/i,
    keywords: ['thomson reuters', 'dominio sistemas'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.01', credito: '1.1.1.05',
    debitoNome: 'Dominio Sistemas (Thomson Reuters)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Clicksign - Assinatura digital
  {
    regex: /12499520000170|CLICKSIGN/i,
    keywords: ['clicksign'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.13', credito: '1.1.1.05',
    debitoNome: 'Clicksign', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Sittax - Sistema fiscal
  {
    regex: /37411535000165|SITTAX/i,
    keywords: ['sittax'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.14', credito: '1.1.1.05',
    debitoNome: 'Sittax', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Contus Tecnologia
  {
    regex: /42711893000123|CONTUS\s*TECNOLOGIA/i,
    keywords: ['contus'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.05', credito: '1.1.1.05',
    debitoNome: 'Contus Tecnologia', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Dataunique Tech
  {
    regex: /42977999000173|DATAUNIQUE/i,
    keywords: ['dataunique'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.02', credito: '1.1.1.05',
    debitoNome: 'Dataunique Tech', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // CR Sistema (Sistema SAAM - CNPJ 14153062000148)
  {
    regex: /14153062000148|CR\s*SISTEMA/i,
    keywords: ['cr sistema', 'saam'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.03', credito: '1.1.1.05',
    debitoNome: 'Sistema SAAM - CR Sistema', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // NB Technology (Sistema SAAM - CNPJ 43961100000197)
  {
    regex: /43961100000197|NB\s*TECHNOLOGY/i,
    keywords: ['nb technology'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.04', credito: '1.1.1.05',
    debitoNome: 'Sistema SAAM - NB Technology', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Autmais Soluções
  {
    regex: /50812771000151|AUTMAIS/i,
    keywords: ['autmais'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.10', credito: '1.1.1.05',
    debitoNome: 'Autmais Solucoes', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Oneflow
  {
    regex: /34813747000180|ONEFLOW/i,
    keywords: ['oneflow'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.12', credito: '1.1.1.05',
    debitoNome: 'Oneflow', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Objetiva Edições
  {
    regex: /26659060000104|OBJETIVA\s*EDIC/i,
    keywords: ['objetiva'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.12.06', credito: '1.1.1.05',
    debitoNome: 'Objetiva Edicoes', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ═══ INTERNET POR CNPJ ═══
  // Algar Telecom
  {
    regex: /71208516000174|ALGAR\s*TE/i,
    keywords: ['algar', 'algarte'], tipo: 'SAIDA', categoria: 'UTILIDADES',
    debito: '4.1.2.03', credito: '1.1.1.05',
    debitoNome: 'Telefone/Internet - Algar', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Veri Soluções Tecnológicas (aplicativo de análise, NÃO telefone)
  {
    regex: /28408293000160|VERI\s*SOLUC/i,
    keywords: ['veri solucoes'], tipo: 'SAIDA', categoria: 'SOFTWARE',
    debito: '4.1.2.12.08', credito: '1.1.1.05',
    debitoNome: 'Veri Solucoes Tecnologicas', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ═══ MANUTENÇÃO POR CNPJ ═══
  // AXE Manutenção e Modernização de Elevadores (CNPJ 32738375000140)
  {
    regex: /32738375000140|AXE\s*MANUTENCAO/i,
    keywords: ['axe', 'elevador'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.15.01', credito: '1.1.1.05',
    debitoNome: 'AXE Manutencao Elevadores', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // ADV System Elevadores
  {
    regex: /07296500000161|ADV\s*SYSTEM/i,
    keywords: ['adv system', 'elevador'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.15.02', credito: '1.1.1.05',
    debitoNome: 'ADV System Elevadores', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Frio Máximo Ar Condicionado (CNPJ 07943949000174)
  {
    regex: /07943949000174|FRIO\s*MAX/i,
    keywords: ['frio maximo', 'ar condicionado'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.15.05', credito: '1.1.1.05',
    debitoNome: 'Frio Maximo Ar Condicionado', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ═══ MATERIAL DE LIMPEZA POR CNPJ ═══
  // L Argent / Elite Forte
  {
    regex: /36859577000109|L\s*ARGENT|ELITE\s*FORTE/i,
    keywords: ['l argent', 'elite forte', 'limpeza'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.2.08', credito: '1.1.1.05',
    debitoNome: 'Material de Limpeza - Elite Forte', creditoNome: 'Banco Sicredi',
    confianca: 0.95, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ═══ RECRUTAMENTO ═══
  // Catho Online
  {
    regex: /03753088000100|CATHO/i,
    keywords: ['catho'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.4.15', credito: '1.1.1.05',
    debitoNome: 'Recrutamento RH - Catho', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Analítica RH / Leo Junio Gomes Silva (CNPJ 40244053000172) - Recrutamento e RH
  {
    regex: /40244053000172|ANALITICA\s*RH|LEO\s*JUNIO/i,
    keywords: ['analitica rh', 'leo junio'], tipo: 'SAIDA', categoria: 'DESPESAS',
    debito: '4.1.4.15', credito: '1.1.1.05',
    debitoNome: 'Recrutamento RH - Analítica RH', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ═══ VALE TRANSPORTE ═══
  // Redemob (Sit Pass Goiânia)
  {
    regex: /10636142000101|REDEMOB|SIT\s*PASS/i,
    keywords: ['redemob', 'sit pass'], tipo: 'SAIDA', categoria: 'BENEFICIOS',
    debito: '4.2.1.04', credito: '1.1.1.05',
    debitoNome: 'Vale Transporte - Sit Pass', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_TRABALHISTA'
  },

  // ═══ ADIANTAMENTO SÓCIO POR CNPJ ═══
  // Fatura Cartão de Crédito (Sérgio Carneiro)
  {
    regex: /DEB\.CTA\.FATURA|FATURA\s*CARTAO|DEB\s*CTA\s*FATURA/i,
    keywords: ['fatura', 'cartao'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiant. Sérgio (Fatura Cartão)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // CASAG (Plano Saúde Família Sérgio)
  {
    regex: /01418847000153|CAIXA\s*DE\s*ASSIST|CASAG/i,
    keywords: ['casag', 'caixa assistencia'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiant. Sérgio (CASAG Plano Saúde Família)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Mundi Consciente (Condomínio Apto Sérgio)
  {
    regex: /24989276000102|MUNDI\s*CONSCIENTE/i,
    keywords: ['mundi consciente'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiant. Sérgio (Condomínio Apto)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Faculdade de Medicina (Sérgio Augusto filho)
  {
    regex: /44422513000166|FACULDADE\s*DE\s*MEDICINA/i,
    keywords: ['faculdade medicina', 'itumbiara'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.05', credito: '1.1.1.05',
    debitoNome: 'Adiant. Sérgio Augusto (Faculdade)', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ═══ IMPOSTOS E TAXAS POR CNPJ ═══
  // DETRAN / IPVA → Adiant. Sérgio Carneiro (Ampla NÃO tem veículos - todo IPVA é pessoal do sócio)
  {
    regex: /02872448000120|DEPARTAMENTO\s*ESTADUAL.*TRANSITO|IPVA|DETRAN/i,
    keywords: ['detran', 'ipva'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiant. Sérgio Carneiro (IPVA/DETRAN pessoal)', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Condomínio Galeria Nacional → Adiantamento Sérgio (imóvel pessoal, NÃO sede empresa)
  {
    regex: /36852259000108|CONDOMINIO\s*DA\s*GALERIA/i,
    keywords: ['galeria nacional'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // Franca Locações (CNPJ 10798029000114) → Adiantamento Sérgio (locação pessoal)
  {
    regex: /10798029000114|FRANCA\s*LOCAC/i,
    keywords: ['franca locações', 'franca locac'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ========== SERVIÇOS PÚBLICOS (Auto-classificar) ==========
  {
    regex: /ENEL|CELG|EQUATORIAL|CPFL|CEMIG|COPEL|ENERGIA|ELETRIC|LUZ/i,
    keywords: ['enel', 'celg', 'equatorial', 'energia', 'luz', 'eletrica'],
    tipo: 'SAIDA',
    categoria: 'UTILIDADES',
    debito: '4.1.2.02',
    credito: '1.1.1.05',
    debitoNome: 'Energia Elétrica',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  // SANEAGO (CNPJ 01616929000102) → Adiantamento Sérgio (água pessoal, NÃO empresa)
  {
    regex: /SANEAGO|01616929000102/i,
    keywords: ['saneago'], tipo: 'SAIDA', categoria: 'ADIANTAMENTO',
    debito: '1.1.3.04.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro', creditoNome: 'Banco Sicredi',
    confianca: 0.99, autoClassificar: true, agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  {
    regex: /SABESP|COPASA|CAGECE|AGUA\s*E\s*ESGOTO/i,
    keywords: ['sabesp', 'agua', 'esgoto'],
    tipo: 'SAIDA',
    categoria: 'UTILIDADES',
    debito: '4.1.2.02',
    credito: '1.1.1.05',
    debitoNome: 'Energia Elétrica',
    creditoNome: 'Banco Sicredi',
    confianca: 0.90,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  {
    regex: /VIVO|TIMCEL|TIM\b|CLARO|OI\s|TELEFONICA|INTERNET|TELECOM/i,
    keywords: ['vivo', 'timcel', 'claro', 'telefone', 'internet'],
    tipo: 'SAIDA',
    categoria: 'UTILIDADES',
    debito: '4.1.2.03',
    credito: '1.1.1.05',
    debitoNome: 'Telefone e Internet',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ========== ALUGUEL ==========
  {
    regex: /ALUGUEL|LOCACAO/i,
    keywords: ['aluguel', 'locacao', 'locatario'],
    tipo: 'SAIDA',
    categoria: 'DESPESAS',
    debito: '4.1.2.01',
    credito: '1.1.1.05',
    debitoNome: 'Aluguel',
    creditoNome: 'Banco Sicredi',
    confianca: 0.90,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },

  // ========== SOFTWARE E SISTEMAS (genérico → 4.1.2.12.99 Outros) ==========
  {
    regex: /DOMINIO|FORTES|QUESTOR|CONTMATIC|TOTVS|SANKHYA|ALTERDATA|PROSOFT/i,
    keywords: ['dominio', 'fortes', 'questor', 'contmatic', 'sistema', 'software'],
    tipo: 'SAIDA',
    categoria: 'DESPESAS',
    debito: '4.1.2.12.99',
    credito: '1.1.1.05',
    debitoNome: 'Outros Software e Sistemas',
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
    debito: '4.1.2.12.99',
    credito: '1.1.1.05',
    debitoNome: 'Outros Software e Sistemas',
    creditoNome: 'Banco Sicredi',
    confianca: 0.88,
    autoClassificar: false,
    agenteResponsavel: 'AGENTE_ADMINISTRATIVO'
  },
  
  // ========== RECEBIMENTOS SICOOB - BOLETOS (Auto-classificar) ==========
  // Padrão SICOOB: "LIQ.COBRANCA SIMPLES-COBxxxxxx" = recebimento de boleto de cliente
  // Usa 1.1.2.01.9999 (Clientes Diversos) porque 1.1.2.01 é conta sintética
  // Futuro: cruzar CPF/CNPJ do PIX/COB com cadastro para conta específica
  {
    regex: /LIQ\.?\s*COBRANCA\s*SIMPLES|LIQ\.?\s*COB\s*SIMPLES/i,
    keywords: ['liq.cobranca simples', 'liq cobranca simples'],
    tipo: 'ENTRADA',
    categoria: 'RECEITAS',
    debito: '1.1.1.05',
    credito: '1.1.2.01.9999',
    debitoNome: 'Banco Sicredi',
    creditoNome: 'Clientes Diversos (Conciliação)',
    confianca: 0.96,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Padrão SICOOB: "LIQUIDACAO BOLETO" genérico
  {
    regex: /LIQUIDACAO\s*BOLETO|BAIXA\s*BOLETO|BOLETO\s*LIQUIDADO/i,
    keywords: ['liquidacao boleto', 'baixa boleto'],
    tipo: 'ENTRADA',
    categoria: 'RECEITAS',
    debito: '1.1.1.05',
    credito: '1.1.2.01.9999',
    debitoNome: 'Banco Sicredi',
    creditoNome: 'Clientes Diversos (Conciliação)',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== PIX CLIENTES ESPECÍFICOS (ANTES do genérico) ==========
  // Pessoa física → Empresa vinculada (identificação por CPF/CNPJ)
  {
    regex: /83438718120.*PAULA\s*MILHOMEM|PAULA\s*MILHOMEM/i,
    keywords: ['paula milhomem'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0291',
    debitoNome: 'Banco Sicredi', creditoNome: 'Restaurante Iuvaci (Paula Milhomem - filha)',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /31092004149.*JULIANA\s*PERILLO|JULIANA\s*PERILLO/i,
    keywords: ['juliana perillo'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0102',
    debitoNome: 'Banco Sicredi', creditoNome: 'JPL Agropecuária (Juliana Perillo - esposa Edson Sá)',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /03892392161.*ENZO.*DONADI|ENZO.*AQUINO.*DONADI/i,
    keywords: ['enzo donadi'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0005',
    debitoNome: 'Banco Sicredi', creditoNome: 'ECD Construtora (Enzo Donadi - proprietário)',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /59153970187.*IVAIR\s*GONCALVES|IVAIR\s*GONCALVES/i,
    keywords: ['ivair goncalves'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0316',
    debitoNome: 'Banco Sicredi', creditoNome: 'Mineração Serrana (Ivair Gonçalves - proprietário)',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /31458451000109.*ACTION|ACTION\s*SOLUCOES/i,
    keywords: ['action solucoes'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0334',
    debitoNome: 'Banco Sicredi', creditoNome: 'Action Soluções Industriais',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /24799541000190.*EMILIA|EMILIA\s*GONCALVES/i,
    keywords: ['emilia goncalves'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0437',
    debitoNome: 'Banco Sicredi', creditoNome: 'Emília Gonçalves Basílio',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /51859330000178.*CANAL\s*PET|CANAL\s*PET\s*DISTRIB/i,
    keywords: ['canal pet'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0037',
    debitoNome: 'Banco Sicredi', creditoNome: 'Canal Pet Distribuidora',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /28792279000102.*A\.?I\s*EMPREEND|A\.?I\s*EMPREENDIMENTOS/i,
    keywords: ['a.i empreendimentos'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0153',
    debitoNome: 'Banco Sicredi', creditoNome: 'A.I Empreendimentos',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  {
    regex: /07119310000179.*MATA\s*PRAGAS|MATA\s*PRAGAS/i,
    keywords: ['mata pragas'], tipo: 'ENTRADA', categoria: 'RECEITAS',
    debito: '1.1.1.05', credito: '1.1.2.01.0266',
    debitoNome: 'Banco Sicredi', creditoNome: 'Mata Pragas Controle de Pragas',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== RECEBIMENTOS PIX GENÉRICO (fallback) ==========
  // Padrão SICOOB: "RECEBIMENTO PIX-PIX_CRED" = PIX recebido de cliente
  {
    regex: /RECEBIMENTO\s*PIX|PIX[_\s]*CRED|CRED[_\s]*PIX/i,
    keywords: ['recebimento pix', 'pix_cred', 'pix cred'],
    tipo: 'ENTRADA',
    categoria: 'RECEITAS',
    debito: '1.1.1.05',
    credito: '1.1.2.01.9999',
    debitoNome: 'Banco Sicredi',
    creditoNome: 'Clientes Diversos (Conciliação)',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== OUTROS RECEBIMENTOS (Requer revisão) ==========
  {
    regex: /REC\s*PIX|PIX\s*REC/i,
    keywords: ['pix', 'recebimento'],
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
  
  // ========== AMPLA CONTABILIDADE (Transferência Inter-Empresa) ==========
  // DEVE VIR ANTES dos padrões genéricos de PIX/CNPJ
  {
    regex: /AMPLA\s*CONTABILIDADE/i,
    keywords: ['ampla contabilidade'],
    tipo: 'SAIDA',
    categoria: 'TRANSFERENCIAS',
    debito: '1.1.3.01',
    credito: '1.1.1.05',
    debitoNome: 'Adiantamento a Sócios',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== FAMÍLIA LEÃO (Adiantamentos individuais) ==========
  // Victor Hugo → conta específica (NÃO é contratado Ampla)
  {
    regex: /VICTOR\s*HUGO/i,
    keywords: ['victor hugo'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.02.01', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Victor Hugo', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Nayara → conta específica
  {
    regex: /NAYARA/i,
    keywords: ['nayara'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.04', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Nayara', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Sérgio Augusto (filho) → conta específica
  {
    regex: /SERGIO\s*AUGUSTO/i,
    keywords: ['sergio augusto'], tipo: 'SAIDA', categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.05', credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Augusto', creditoNome: 'Banco Sicredi',
    confianca: 0.98, autoClassificar: true, agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // Sérgio Carneiro / Carla Leão → adiant. sócio principal
  {
    regex: /SERGIO\s*(CARNEIRO|LEAO)|CARLA.*LEAO/i,
    keywords: ['sergio carneiro', 'carla leao'],
    tipo: 'SAIDA',
    categoria: 'ADIANTAMENTOS',
    debito: '1.1.3.04.01',
    credito: '1.1.1.05',
    debitoNome: 'Adiantamento Sérgio Carneiro',
    creditoNome: 'Banco Sicredi',
    confianca: 0.96,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== PAGAMENTO PIX (SAÍDA) - Fornecedores CNPJ ==========
  // Padrão SICOOB: "PAGAMENTO PIX-PIX_DEB 00000000000000 RAZAO_SOCIALCNPJ"
  {
    regex: /PAGAMENTO\s*PIX.*CNPJ$/i,
    keywords: [],
    tipo: 'SAIDA',
    categoria: 'FORNECEDORES',
    debito: '2.1.1.01',
    credito: '1.1.1.05',
    debitoNome: 'Fornecedores',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },
  // PIX para CPF genérico (não-sócio) → Transitória para revisão
  {
    regex: /PAGAMENTO\s*PIX.*CPF$/i,
    keywords: [],
    tipo: 'SAIDA',
    categoria: 'DIVERSOS',
    debito: '1.1.9.01',
    credito: '1.1.1.05',
    debitoNome: 'Transitória Débitos Pendentes',
    creditoNome: 'Banco Sicredi',
    confianca: 0.70,
    autoClassificar: false,
    agenteResponsavel: 'DR_CICERO'
  },
  // PIX via Sicredi (rede Sicredi)
  {
    regex: /PAGAMENTO\s*PIX\s*SICREDI/i,
    keywords: ['pagamento pix sicredi'],
    tipo: 'SAIDA',
    categoria: 'FORNECEDORES',
    debito: '2.1.1.01',
    credito: '1.1.1.05',
    debitoNome: 'Fornecedores',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== LIQUIDAÇÃO BOLETO (SAÍDA) - Pagamento de Boletos ==========
  {
    regex: /LIQUIDACAO\s*BOLETO|PAGAMENTO\s*BOLETO|BOLETO\s*PAGO/i,
    keywords: ['liquidacao boleto', 'pagamento boleto'],
    tipo: 'SAIDA',
    categoria: 'FORNECEDORES',
    debito: '2.1.1.01',
    credito: '1.1.1.05',
    debitoNome: 'Fornecedores',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
  },

  // ========== DÉBITO CONVÊNIOS (Seguros, taxas governamentais) ==========
  {
    regex: /DEBITO\s*CONVENIOS|DEB\s*CONV/i,
    keywords: ['debito convenios', 'deb conv'],
    tipo: 'SAIDA',
    categoria: 'FORNECEDORES',
    debito: '2.1.1.01',
    credito: '1.1.1.05',
    debitoNome: 'Fornecedores',
    creditoNome: 'Banco Sicredi',
    confianca: 0.95,
    autoClassificar: true,
    agenteResponsavel: 'AGENTE_FINANCEIRO'
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
    confianca: 0.95,
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
