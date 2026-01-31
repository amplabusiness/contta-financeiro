/**
 * Base de Conhecimento do Dr. Cícero
 * 
 * Contém:
 * - Dicionário de siglas de extratos bancários
 * - Regras de classificação automática
 * - Padrões de lançamentos contábeis
 * - Modelos da Objetiva Edições
 * 
 * Treinado com dados do Serper.dev em 31/01/2026
 * Expandido com modelos da Objetiva Edições em 31/01/2026
 * 
 * Fontes:
 * - objetivaedicoes.com.br
 * - contabeis.com.br
 * - portaldecontabilidade.com.br
 * - jornalcontabil.com.br
 * - cfc.org.br (NBC TG)
 */

// =============================================================================
// TIPOS
// =============================================================================

export interface SiglaExtrato {
  significado: string;
  tipo: 'transferencia' | 'pagamento' | 'recebimento' | 'tarifa' | 'imposto' | 
        'cobranca' | 'debito_automatico' | 'aplicacao' | 'resgate' | 'rendimento' |
        'compensacao' | 'cheque' | 'estorno' | 'cancelamento' | 'devolucao' |
        'folha' | 'utilidade' | 'pro_labore';
  classificacao: string;
  conta?: string;
  contaNome?: string;
}

export interface RegraClassificacao {
  regra: string;
  keywords: string[];
  conta_debito?: string;
  conta_debito_nome?: string;
  conta_credito?: string;
  conta_credito_nome?: string;
  tipo?: 'ENTRADA' | 'SAIDA';
  observacao?: string;
  confianca: number;
}

export interface LancamentoPadrao {
  tipo: string;
  descricao: string;
  debito: { conta: string; nome: string };
  credito: { conta: string; nome: string };
  observacao: string;
  fontes?: string[];
  confianca?: number;
}

// =============================================================================
// DICIONÁRIO DE SIGLAS DE EXTRATOS BANCÁRIOS
// =============================================================================

export const SIGLAS_EXTRATO: Record<string, SiglaExtrato> = {
  // ========== TRANSFERÊNCIAS ==========
  'TED': { significado: 'Transferência Eletrônica Disponível', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'DOC': { significado: 'Documento de Ordem de Crédito', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'PIX': { significado: 'Pagamento Instantâneo', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'TRF': { significado: 'Transferência', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'TRANSF': { significado: 'Transferência', tipo: 'transferencia', classificacao: 'verificar_destino' },
  
  // ========== PAGAMENTOS ==========
  'PAG': { significado: 'Pagamento', tipo: 'pagamento', classificacao: 'fornecedores' },
  'PGTO': { significado: 'Pagamento', tipo: 'pagamento', classificacao: 'fornecedores' },
  'PAGTO': { significado: 'Pagamento', tipo: 'pagamento', classificacao: 'fornecedores' },
  'SISPAG': { significado: 'Sistema de Pagamentos', tipo: 'pagamento', classificacao: 'fornecedores' },
  'GPAG': { significado: 'Guia de Pagamento', tipo: 'pagamento', classificacao: 'impostos' },
  
  // ========== RECEBIMENTOS ==========
  'REC': { significado: 'Recebimento', tipo: 'recebimento', classificacao: 'clientes' },
  'CRED': { significado: 'Crédito', tipo: 'recebimento', classificacao: 'verificar_origem' },
  'DEP': { significado: 'Depósito', tipo: 'recebimento', classificacao: 'verificar_origem' },
  'DEPOSITO': { significado: 'Depósito', tipo: 'recebimento', classificacao: 'verificar_origem' },
  
  // ========== TARIFAS E TAXAS ==========
  'TAR': { significado: 'Tarifa', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01', contaNome: 'Despesas Bancárias' },
  'TXB': { significado: 'Taxa Bancária', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01', contaNome: 'Despesas Bancárias' },
  'IOF': { significado: 'Imposto sobre Operações Financeiras', tipo: 'imposto', classificacao: 'despesas_bancarias', conta: '4.1.3.01', contaNome: 'IOF' },
  'ANUIDADE': { significado: 'Anuidade de Cartão/Conta', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01', contaNome: 'Despesas Bancárias' },
  'MANUT': { significado: 'Manutenção de Conta', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01', contaNome: 'Despesas Bancárias' },
  
  // ========== COBRANÇA ==========
  'COB': { significado: 'Cobrança', tipo: 'cobranca', classificacao: 'verificar' },
  'BOLETO': { significado: 'Pagamento de Boleto', tipo: 'pagamento', classificacao: 'verificar_favorecido' },
  'LIQUIDACAO': { significado: 'Liquidação de Título', tipo: 'cobranca', classificacao: 'clientes' },
  'BAIXA': { significado: 'Baixa de Título', tipo: 'cobranca', classificacao: 'clientes' },
  
  // ========== DÉBITO AUTOMÁTICO ==========
  'DEB AUT': { significado: 'Débito Automático', tipo: 'debito_automatico', classificacao: 'verificar_convenio' },
  'DB AUTO': { significado: 'Débito Automático', tipo: 'debito_automatico', classificacao: 'verificar_convenio' },
  
  // ========== APLICAÇÕES E INVESTIMENTOS ==========
  'APL': { significado: 'Aplicação Financeira', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10', contaNome: 'Aplicações Financeiras' },
  'APLIC': { significado: 'Aplicação', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10', contaNome: 'Aplicações Financeiras' },
  'RESG': { significado: 'Resgate', tipo: 'resgate', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10', contaNome: 'Aplicações Financeiras' },
  'RESGATE': { significado: 'Resgate de Aplicação', tipo: 'resgate', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10', contaNome: 'Aplicações Financeiras' },
  'REND': { significado: 'Rendimento', tipo: 'rendimento', classificacao: 'receitas_financeiras', conta: '3.2.1.01', contaNome: 'Receitas Financeiras' },
  'JUROS': { significado: 'Juros Recebidos', tipo: 'rendimento', classificacao: 'receitas_financeiras', conta: '3.2.1.01', contaNome: 'Receitas Financeiras' },
  'CDB': { significado: 'Certificado de Depósito Bancário', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10', contaNome: 'Aplicações Financeiras' },
  'POUP': { significado: 'Poupança', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10', contaNome: 'Aplicações Financeiras' },
  
  // ========== COMPENSAÇÃO ==========
  'COMPE': { significado: 'Compensação de Cheque', tipo: 'compensacao', classificacao: 'verificar' },
  'CHQ': { significado: 'Cheque', tipo: 'cheque', classificacao: 'verificar' },
  'CHEQUE': { significado: 'Cheque', tipo: 'cheque', classificacao: 'verificar' },
  
  // ========== ESTORNOS E CANCELAMENTOS ==========
  'EST': { significado: 'Estorno', tipo: 'estorno', classificacao: 'estorno' },
  'ESTORNO': { significado: 'Estorno', tipo: 'estorno', classificacao: 'estorno' },
  'CANC': { significado: 'Cancelamento', tipo: 'cancelamento', classificacao: 'estorno' },
  'DEV': { significado: 'Devolução', tipo: 'devolucao', classificacao: 'verificar' },
  
  // ========== FOLHA DE PAGAMENTO ==========
  'SALARIO': { significado: 'Pagamento de Salário', tipo: 'folha', classificacao: 'despesas_pessoal', conta: '4.1.2.01', contaNome: 'Salários e Ordenados' },
  'FOLHA': { significado: 'Folha de Pagamento', tipo: 'folha', classificacao: 'despesas_pessoal', conta: '4.1.2.01', contaNome: 'Salários e Ordenados' },
  'FGTS': { significado: 'Fundo de Garantia', tipo: 'imposto', classificacao: 'encargos_sociais', conta: '4.1.2.02', contaNome: 'FGTS' },
  'GPS': { significado: 'Guia Previdência Social', tipo: 'imposto', classificacao: 'encargos_sociais', conta: '4.1.2.03', contaNome: 'INSS' },
  'INSS': { significado: 'Previdência Social', tipo: 'imposto', classificacao: 'encargos_sociais', conta: '4.1.2.03', contaNome: 'INSS' },
  'DARF': { significado: 'Documento Arrecadação Receitas Federais', tipo: 'imposto', classificacao: 'impostos_federais' },
  
  // ========== SERVIÇOS PÚBLICOS ==========
  'ENEL': { significado: 'Energia Elétrica (Enel)', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02', contaNome: 'Energia Elétrica' },
  'CELG': { significado: 'Energia Elétrica (Celg)', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02', contaNome: 'Energia Elétrica' },
  'EQUATORIAL': { significado: 'Energia Elétrica (Equatorial)', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02', contaNome: 'Energia Elétrica' },
  'CPFL': { significado: 'Energia Elétrica (CPFL)', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02', contaNome: 'Energia Elétrica' },
  'CEMIG': { significado: 'Energia Elétrica (Cemig)', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02', contaNome: 'Energia Elétrica' },
  'ENERGIA': { significado: 'Energia Elétrica', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02', contaNome: 'Energia Elétrica' },
  'SANEAGO': { significado: 'Água e Esgoto (Saneago)', tipo: 'utilidade', classificacao: 'agua', conta: '4.1.1.03', contaNome: 'Água e Esgoto' },
  'SABESP': { significado: 'Água e Esgoto (Sabesp)', tipo: 'utilidade', classificacao: 'agua', conta: '4.1.1.03', contaNome: 'Água e Esgoto' },
  'COPASA': { significado: 'Água e Esgoto (Copasa)', tipo: 'utilidade', classificacao: 'agua', conta: '4.1.1.03', contaNome: 'Água e Esgoto' },
  'VIVO': { significado: 'Telefonia (Vivo)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04', contaNome: 'Telefone/Internet' },
  'CLARO': { significado: 'Telefonia (Claro)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04', contaNome: 'Telefone/Internet' },
  'TIM': { significado: 'Telefonia (Tim)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04', contaNome: 'Telefone/Internet' },
  'OI': { significado: 'Telefonia (Oi)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04', contaNome: 'Telefone/Internet' },
  
  // ========== IMPOSTOS MUNICIPAIS ==========
  'ISS': { significado: 'Imposto Sobre Serviços', tipo: 'imposto', classificacao: 'impostos_municipais', conta: '4.1.3.02', contaNome: 'ISS' },
  'ISSQN': { significado: 'ISS Quota Nacional', tipo: 'imposto', classificacao: 'impostos_municipais', conta: '4.1.3.02', contaNome: 'ISS' },
  'IPTU': { significado: 'Imposto Predial Territorial Urbano', tipo: 'imposto', classificacao: 'impostos_municipais', conta: '4.1.3.03', contaNome: 'IPTU' },
  
  // ========== OUTROS ==========
  'PRO LABORE': { significado: 'Retirada Pró-labore', tipo: 'pro_labore', classificacao: 'pro_labore', conta: '4.1.2.04', contaNome: 'Pró-labore' },
  'PROLABORE': { significado: 'Retirada Pró-labore', tipo: 'pro_labore', classificacao: 'pro_labore', conta: '4.1.2.04', contaNome: 'Pró-labore' },
  'DAS': { significado: 'Doc. Arrecadação Simples Nacional', tipo: 'imposto', classificacao: 'simples_nacional', conta: '4.1.3.05', contaNome: 'Simples Nacional' },
  'SIMPLES': { significado: 'Simples Nacional', tipo: 'imposto', classificacao: 'simples_nacional', conta: '4.1.3.05', contaNome: 'Simples Nacional' }
};

// =============================================================================
// REGRAS DE CLASSIFICAÇÃO AUTOMÁTICA
// =============================================================================

export const REGRAS_CLASSIFICACAO: RegraClassificacao[] = [
  {
    regra: 'TARIFA_BANCARIA',
    keywords: ['tarifa', 'tar ', 'txb', 'iof', 'ted', 'doc', 'manutenção', 'manut', 'anuidade'],
    conta_debito: '4.1.3.01',
    conta_debito_nome: 'Despesas Bancárias',
    confianca: 0.95
  },
  {
    regra: 'FAMILIA_LEAO',
    keywords: ['sergio', 'carla', 'victor hugo', 'nayara', 'sergio augusto', 'leão', 'leao'],
    conta_debito: '1.1.3.01',
    conta_debito_nome: 'Adiantamento a Sócios',
    observacao: 'Gastos pessoais da família Leão = Adiantamento (NUNCA despesa)',
    confianca: 0.92
  },
  {
    regra: 'FOLHA_PAGAMENTO',
    keywords: ['salario', 'folha', '13', 'ferias', 'rescisao', 'aviso previo', 'decimo'],
    conta_debito: '4.1.2.01',
    conta_debito_nome: 'Despesas com Pessoal',
    confianca: 0.88
  },
  {
    regra: 'FGTS',
    keywords: ['fgts', 'fundo garantia'],
    conta_debito: '4.1.2.02',
    conta_debito_nome: 'FGTS',
    confianca: 0.95
  },
  {
    regra: 'INSS',
    keywords: ['inss', 'gps', 'previdencia', 'darf prev'],
    conta_debito: '4.1.2.03',
    conta_debito_nome: 'INSS',
    confianca: 0.95
  },
  {
    regra: 'ISS',
    keywords: ['iss', 'issqn'],
    conta_debito: '4.1.3.02',
    conta_debito_nome: 'ISS',
    confianca: 0.95
  },
  {
    regra: 'ENERGIA',
    keywords: ['enel', 'celg', 'equatorial', 'cpfl', 'cemig', 'copel', 'energia', 'eletric', 'luz'],
    conta_debito: '4.1.1.02',
    conta_debito_nome: 'Energia Elétrica',
    confianca: 0.92
  },
  {
    regra: 'AGUA',
    keywords: ['saneago', 'sabesp', 'copasa', 'cedae', 'compesa', 'agua', 'esgoto'],
    conta_debito: '4.1.1.03',
    conta_debito_nome: 'Água e Esgoto',
    confianca: 0.92
  },
  {
    regra: 'TELECOMUNICACOES',
    keywords: ['vivo', 'claro', 'tim', 'oi', 'internet', 'telefon', 'celular', 'banda larga'],
    conta_debito: '4.1.1.04',
    conta_debito_nome: 'Telefone/Internet',
    confianca: 0.88
  },
  {
    regra: 'ALUGUEL',
    keywords: ['aluguel', 'locacao', 'condominio', 'arrendamento'],
    conta_debito: '4.1.1.01',
    conta_debito_nome: 'Aluguel e Condomínio',
    confianca: 0.90
  },
  {
    regra: 'PRO_LABORE',
    keywords: ['pro labore', 'prolabore', 'pró-labore'],
    conta_debito: '4.1.2.04',
    conta_debito_nome: 'Pró-labore',
    confianca: 0.95
  },
  {
    regra: 'APLICACAO_FINANCEIRA',
    keywords: ['apl ', 'aplic', 'aplicacao', 'cdb', 'poupanca', 'investimento'],
    conta_debito: '1.1.1.10',
    conta_debito_nome: 'Aplicações Financeiras',
    confianca: 0.90
  },
  {
    regra: 'RECEITA_FINANCEIRA',
    keywords: ['rend', 'rendimento', 'juros recebido'],
    tipo: 'ENTRADA',
    conta_credito: '3.2.1.01',
    conta_credito_nome: 'Receitas Financeiras',
    confianca: 0.88
  },
  {
    regra: 'CLIENTE_RECEBIMENTO',
    keywords: ['honorario', 'mensalidade', 'fatura', 'nf ', 'nota fiscal', 'liquidacao', 'baixa'],
    tipo: 'ENTRADA',
    conta_credito: '1.1.2.01',
    conta_credito_nome: 'Clientes a Receber',
    confianca: 0.80
  },
  {
    regra: 'SIMPLES_NACIONAL',
    keywords: ['das ', 'simples nacional'],
    conta_debito: '4.1.3.05',
    conta_debito_nome: 'Simples Nacional (DAS)',
    confianca: 0.95
  },
  {
    regra: 'IPTU',
    keywords: ['iptu'],
    conta_debito: '4.1.3.03',
    conta_debito_nome: 'IPTU',
    confianca: 0.95
  }
];

// =============================================================================
// LANÇAMENTOS PADRÃO
// =============================================================================

export const LANCAMENTOS_PADRAO: LancamentoPadrao[] = [
  {
    tipo: 'FOLHA_PAGAMENTO',
    descricao: 'Apropriação de Folha de Pagamento',
    debito: { conta: '4.1.2.01', nome: 'Despesas com Pessoal - Salários' },
    credito: { conta: '2.1.1.01', nome: 'Salários a Pagar' },
    observacao: 'Regime de competência - apropriação no mês de trabalho'
  },
  {
    tipo: 'PAGAMENTO_SALARIO',
    descricao: 'Pagamento de Salários',
    debito: { conta: '2.1.1.01', nome: 'Salários a Pagar' },
    credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
    observacao: 'Baixa da obrigação no momento do pagamento'
  },
  {
    tipo: 'FGTS_PROVISAO',
    descricao: 'Provisão de FGTS (8%)',
    debito: { conta: '4.1.2.02', nome: 'Despesas com FGTS' },
    credito: { conta: '2.1.1.02', nome: 'FGTS a Recolher' },
    observacao: 'Base: 8% sobre remuneração bruta'
  },
  {
    tipo: 'FGTS_PAGAMENTO',
    descricao: 'Recolhimento de FGTS',
    debito: { conta: '2.1.1.02', nome: 'FGTS a Recolher' },
    credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
    observacao: 'Vencimento: dia 7 do mês seguinte'
  },
  {
    tipo: 'INSS_PROVISAO',
    descricao: 'Provisão de INSS (Parte Empresa)',
    debito: { conta: '4.1.2.03', nome: 'Despesas com INSS' },
    credito: { conta: '2.1.1.03', nome: 'INSS a Recolher' },
    observacao: 'Base: 20% patronal + RAT + Terceiros'
  },
  {
    tipo: 'ISS_RETIDO',
    descricao: 'ISS Retido na Fonte',
    debito: { conta: '1.1.2.01', nome: 'Clientes a Receber' },
    credito: { conta: '2.1.2.01', nome: 'ISS a Recolher' },
    observacao: 'Retenção conforme Lei Complementar 116/2003'
  },
  {
    tipo: 'COMPRA_PRAZO',
    descricao: 'Compra a Prazo de Fornecedor',
    debito: { conta: '1.1.4.01', nome: 'Estoque de Mercadorias' },
    credito: { conta: '2.1.3.01', nome: 'Fornecedores a Pagar' },
    observacao: 'Aquisição de mercadorias para revenda'
  },
  {
    tipo: 'PAGAMENTO_FORNECEDOR',
    descricao: 'Pagamento a Fornecedor',
    debito: { conta: '2.1.3.01', nome: 'Fornecedores a Pagar' },
    credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
    observacao: 'Baixa da obrigação por pagamento'
  },
  {
    tipo: 'RECEITA_SERVICOS',
    descricao: 'Receita de Prestação de Serviços',
    debito: { conta: '1.1.2.01', nome: 'Clientes a Receber' },
    credito: { conta: '3.1.1.01', nome: 'Receita de Serviços' },
    observacao: 'Regime de competência - no momento da prestação'
  },
  {
    tipo: 'RECEBIMENTO_CLIENTE',
    descricao: 'Recebimento de Cliente',
    debito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
    credito: { conta: '1.1.2.01', nome: 'Clientes a Receber' },
    observacao: 'Baixa do direito a receber'
  },
  {
    tipo: 'DESPESA_BANCARIA',
    descricao: 'Despesas Bancárias (Tarifas)',
    debito: { conta: '4.1.3.01', nome: 'Despesas Bancárias' },
    credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
    observacao: 'Tarifas de manutenção, TED, DOC, etc.'
  },
  {
    tipo: 'DEPRECIACAO',
    descricao: 'Depreciação de Ativo Imobilizado',
    debito: { conta: '4.1.4.01', nome: 'Despesas com Depreciação' },
    credito: { conta: '1.2.3.99', nome: '(-) Depreciação Acumulada' },
    observacao: 'Conforme NBC TG 27 - vida útil econômica'
  },
  {
    tipo: 'PRO_LABORE',
    descricao: 'Apropriação de Pró-labore',
    debito: { conta: '4.1.2.04', nome: 'Despesas com Pró-labore' },
    credito: { conta: '2.1.1.04', nome: 'Pró-labore a Pagar' },
    observacao: 'Remuneração dos sócios administradores'
  },
  {
    tipo: 'ADIANTAMENTO_SOCIO',
    descricao: 'Adiantamento a Sócio',
    debito: { conta: '1.1.3.01', nome: 'Adiantamentos a Sócios' },
    credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
    observacao: 'ATENÇÃO: Não é despesa! Verificar regularização'
  },
  {
    tipo: 'TRANSFERENCIA_CONTAS',
    descricao: 'Transferência entre Contas',
    debito: { conta: '1.1.1.03', nome: 'Banco Destino' },
    credito: { conta: '1.1.1.02', nome: 'Banco Origem' },
    observacao: 'Movimentação financeira - mesmo titular'
  },
  {
    tipo: 'APLICACAO_FINANCEIRA',
    descricao: 'Aplicação Financeira',
    debito: { conta: '1.1.1.10', nome: 'Aplicações Financeiras' },
    credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
    observacao: 'Disponibilidades de curto prazo'
  },
  {
    tipo: 'RENDIMENTO_APLICACAO',
    descricao: 'Rendimento de Aplicação Financeira',
    debito: { conta: '1.1.1.10', nome: 'Aplicações Financeiras' },
    credito: { conta: '3.2.1.01', nome: 'Receitas Financeiras' },
    observacao: 'Atualização pelo rendimento bruto'
  },
  {
    tipo: 'ESTORNO',
    descricao: 'Estorno de Lançamento',
    debito: { conta: 'X.X.X.XX', nome: '[Conta Original a Crédito]' },
    credito: { conta: 'X.X.X.XX', nome: '[Conta Original a Débito]' },
    observacao: 'Inversão do lançamento original - manter histórico'
  }
];

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Identifica siglas presentes na descrição de uma transação
 */
export function identificarSiglas(descricao: string): SiglaExtrato[] {
  const desc = descricao.toUpperCase();
  const siglasEncontradas: SiglaExtrato[] = [];
  
  for (const [sigla, info] of Object.entries(SIGLAS_EXTRATO)) {
    // Busca com word boundary para evitar falsos positivos
    const regex = new RegExp(`\\b${sigla}\\b`, 'i');
    if (regex.test(desc) || desc.includes(sigla)) {
      siglasEncontradas.push({ ...info, significado: `${sigla}: ${info.significado}` });
    }
  }
  
  return siglasEncontradas;
}

/**
 * Encontra a melhor regra de classificação para uma transação
 */
export function encontrarRegraClassificacao(descricao: string, valor: number): RegraClassificacao | null {
  const desc = descricao.toLowerCase();
  let melhorRegra: RegraClassificacao | null = null;
  let maiorConfianca = 0;
  
  for (const regra of REGRAS_CLASSIFICACAO) {
    // Verificar se é do tipo correto (entrada/saída)
    if (regra.tipo === 'ENTRADA' && valor < 0) continue;
    if (regra.tipo === 'SAIDA' && valor > 0) continue;
    
    // Contar keywords encontradas
    const keywordsEncontradas = regra.keywords.filter(kw => desc.includes(kw.toLowerCase()));
    
    if (keywordsEncontradas.length > 0) {
      // Ajustar confiança baseada na quantidade de keywords
      const confiancaAjustada = regra.confianca * (0.5 + 0.5 * (keywordsEncontradas.length / regra.keywords.length));
      
      if (confiancaAjustada > maiorConfianca) {
        maiorConfianca = confiancaAjustada;
        melhorRegra = { ...regra, confianca: confiancaAjustada };
      }
    }
  }
  
  return melhorRegra;
}

/**
 * Encontra lançamento padrão por tipo
 */
export function getLancamentoPadrao(tipo: string): LancamentoPadrao | undefined {
  return LANCAMENTOS_PADRAO.find(l => l.tipo === tipo);
}

// =============================================================================
// MODELOS DE LANÇAMENTOS CONTÁBEIS - OBJETIVA EDIÇÕES
// =============================================================================

export interface ModeloLancamentoObjetiva {
  categoria: string;
  nome: string;
  debito: { codigo: string; nome: string };
  debito2?: { codigo: string; nome: string };
  credito: { codigo: string; nome: string };
  credito2?: { codigo: string; nome: string };
  observacao: string;
  keywords: string[];
  fonte?: string;
}

/**
 * 60+ Modelos de lançamentos contábeis estruturados
 * Fonte: Objetiva Edições, Contábeis.com.br, Portal de Contabilidade
 */
export const MODELOS_LANCAMENTOS: ModeloLancamentoObjetiva[] = [
  // ========== FOLHA DE PAGAMENTO ==========
  {
    categoria: 'FOLHA_PAGAMENTO',
    nome: 'Apropriação de Salários',
    debito: { codigo: '4.1.2.01', nome: 'Despesas com Salários' },
    credito: { codigo: '2.1.1.01', nome: 'Salários a Pagar' },
    observacao: 'Regime de competência - reconhecer no mês trabalhado',
    keywords: ['salario', 'folha', 'ordenado', 'remuneracao']
  },
  {
    categoria: 'FOLHA_PAGAMENTO',
    nome: 'Pagamento de Salários',
    debito: { codigo: '2.1.1.01', nome: 'Salários a Pagar' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Baixa da obrigação',
    keywords: ['pagamento', 'salario', 'liquidacao']
  },
  {
    categoria: 'FOLHA_PAGAMENTO',
    nome: 'Provisão de Férias',
    debito: { codigo: '4.1.2.05', nome: 'Despesas com Férias' },
    credito: { codigo: '2.1.1.05', nome: 'Provisão de Férias' },
    observacao: '1/12 avos por mês + 1/3 constitucional',
    keywords: ['ferias', 'provisao', 'terco']
  },
  {
    categoria: 'FOLHA_PAGAMENTO',
    nome: 'Provisão de 13º Salário',
    debito: { codigo: '4.1.2.06', nome: 'Despesas com 13º Salário' },
    credito: { codigo: '2.1.1.06', nome: 'Provisão de 13º Salário' },
    observacao: '1/12 avos por mês',
    keywords: ['13', 'decimo', 'terceiro', 'gratificacao']
  },
  {
    categoria: 'FOLHA_PAGAMENTO',
    nome: 'Rescisão Trabalhista',
    debito: { codigo: '4.1.2.07', nome: 'Despesas com Rescisões' },
    credito: { codigo: '2.1.1.07', nome: 'Rescisões a Pagar' },
    observacao: 'Verbas rescisórias devidas ao empregado',
    keywords: ['rescisao', 'demissao', 'desligamento', 'aviso']
  },

  // ========== ENCARGOS SOCIAIS ==========
  {
    categoria: 'ENCARGOS_SOCIAIS',
    nome: 'Provisão de FGTS',
    debito: { codigo: '4.1.2.02', nome: 'Despesas com FGTS' },
    credito: { codigo: '2.1.1.02', nome: 'FGTS a Recolher' },
    observacao: '8% sobre remuneração bruta',
    keywords: ['fgts', 'fundo', 'garantia']
  },
  {
    categoria: 'ENCARGOS_SOCIAIS',
    nome: 'Recolhimento de FGTS',
    debito: { codigo: '2.1.1.02', nome: 'FGTS a Recolher' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Vencimento: dia 7 do mês seguinte',
    keywords: ['fgts', 'recolhimento', 'grf']
  },
  {
    categoria: 'ENCARGOS_SOCIAIS',
    nome: 'INSS Patronal',
    debito: { codigo: '4.1.2.03', nome: 'Despesas com INSS' },
    credito: { codigo: '2.1.1.03', nome: 'INSS a Recolher' },
    observacao: '20% patronal + RAT + Terceiros',
    keywords: ['inss', 'patronal', 'previdencia']
  },
  {
    categoria: 'ENCARGOS_SOCIAIS',
    nome: 'INSS Retido do Empregado',
    debito: { codigo: '2.1.1.01', nome: 'Salários a Pagar' },
    credito: { codigo: '2.1.1.03', nome: 'INSS a Recolher' },
    observacao: 'Retenção progressiva conforme tabela',
    keywords: ['inss', 'desconto', 'retencao']
  },
  {
    categoria: 'ENCARGOS_SOCIAIS',
    nome: 'Recolhimento de INSS (GPS)',
    debito: { codigo: '2.1.1.03', nome: 'INSS a Recolher' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Vencimento: dia 20 do mês seguinte',
    keywords: ['inss', 'gps', 'recolhimento', 'darf']
  },
  {
    categoria: 'ENCARGOS_SOCIAIS',
    nome: 'Salário-Família - Compensação com INSS',
    debito: { codigo: '2.1.1.03', nome: 'INSS a Recolher' },
    credito: { codigo: '4.1.2.08', nome: 'Salário-Família (Recuperação)' },
    observacao: 'Dedução do INSS devido - conforme Objetiva Edições',
    keywords: ['salario', 'familia', 'compensacao'],
    fonte: 'objetivaedicoes.com.br'
  },

  // ========== PRÓ-LABORE E DISTRIBUIÇÃO ==========
  {
    categoria: 'PRO_LABORE',
    nome: 'Apropriação de Pró-labore',
    debito: { codigo: '4.1.2.04', nome: 'Despesas com Pró-labore' },
    credito: { codigo: '2.1.1.04', nome: 'Pró-labore a Pagar' },
    observacao: 'Remuneração dos sócios administradores',
    keywords: ['pro labore', 'prolabore', 'socio', 'administrador']
  },
  {
    categoria: 'PRO_LABORE',
    nome: 'INSS sobre Pró-labore (Parte Empresa)',
    debito: { codigo: '4.1.2.03', nome: 'Despesas com INSS' },
    credito: { codigo: '2.1.1.03', nome: 'INSS a Recolher' },
    observacao: '20% sobre pró-labore (não optante Simples)',
    keywords: ['inss', 'prolabore', 'patronal']
  },
  {
    categoria: 'DISTRIBUICAO_LUCROS',
    nome: 'Distribuição de Lucros',
    debito: { codigo: '5.3.1.01', nome: 'Lucros Acumulados' },
    credito: { codigo: '2.1.4.01', nome: 'Lucros a Distribuir' },
    observacao: 'Isento de IR até limite da presunção',
    keywords: ['lucro', 'distribuicao', 'dividendo']
  },
  {
    categoria: 'DISTRIBUICAO_LUCROS',
    nome: 'Pagamento de Lucros Distribuídos',
    debito: { codigo: '2.1.4.01', nome: 'Lucros a Distribuir' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Pagamento aos sócios',
    keywords: ['lucro', 'pagamento', 'socio']
  },
  {
    categoria: 'JCP',
    nome: 'Juros sobre Capital Próprio',
    debito: { codigo: '4.3.1.01', nome: 'JCP - Juros s/ Capital Próprio' },
    credito: { codigo: '2.1.4.02', nome: 'JCP a Pagar' },
    observacao: 'Limitado à TJLP sobre PL - dedutível IRPJ/CSLL',
    keywords: ['jcp', 'juros', 'capital', 'proprio']
  },

  // ========== IMPOSTOS FEDERAIS ==========
  {
    categoria: 'IMPOSTOS_FEDERAIS',
    nome: 'IRPJ Trimestral - Lucro Presumido',
    debito: { codigo: '4.3.2.01', nome: 'Despesas com IRPJ' },
    credito: { codigo: '2.1.2.01', nome: 'IRPJ a Recolher' },
    observacao: '15% + 10% adicional sobre lucro presumido',
    keywords: ['irpj', 'imposto', 'renda', 'presumido']
  },
  {
    categoria: 'IMPOSTOS_FEDERAIS',
    nome: 'CSLL Trimestral - Lucro Presumido',
    debito: { codigo: '4.3.2.02', nome: 'Despesas com CSLL' },
    credito: { codigo: '2.1.2.02', nome: 'CSLL a Recolher' },
    observacao: '9% sobre base presumida',
    keywords: ['csll', 'contribuicao', 'social']
  },
  {
    categoria: 'IMPOSTOS_FEDERAIS',
    nome: 'PIS sobre Faturamento',
    debito: { codigo: '4.3.2.03', nome: 'Despesas com PIS' },
    credito: { codigo: '2.1.2.03', nome: 'PIS a Recolher' },
    observacao: '0,65% cumulativo ou 1,65% não cumulativo',
    keywords: ['pis', 'faturamento']
  },
  {
    categoria: 'IMPOSTOS_FEDERAIS',
    nome: 'COFINS sobre Faturamento',
    debito: { codigo: '4.3.2.04', nome: 'Despesas com COFINS' },
    credito: { codigo: '2.1.2.04', nome: 'COFINS a Recolher' },
    observacao: '3% cumulativo ou 7,6% não cumulativo',
    keywords: ['cofins', 'faturamento']
  },
  {
    categoria: 'IMPOSTOS_FEDERAIS',
    nome: 'Retenções Federais (CSRF) Sofridas',
    debito: { codigo: '1.1.5.01', nome: 'IRRF a Recuperar' },
    credito: { codigo: '1.1.2.01', nome: 'Clientes a Receber' },
    observacao: 'PIS/COFINS/CSLL/IR retidos pelo tomador',
    keywords: ['retencao', 'csrf', 'fonte', 'recuperar']
  },
  {
    categoria: 'SIMPLES_NACIONAL',
    nome: 'Provisão DAS - Simples Nacional',
    debito: { codigo: '4.3.2.10', nome: 'Despesas com Simples Nacional' },
    credito: { codigo: '2.1.2.10', nome: 'Simples Nacional a Recolher' },
    observacao: 'Alíquota conforme Anexo e faturamento',
    keywords: ['das', 'simples', 'nacional']
  },

  // ========== IMPOSTOS MUNICIPAIS ==========
  {
    categoria: 'IMPOSTOS_MUNICIPAIS',
    nome: 'ISS sobre Serviços Prestados',
    debito: { codigo: '4.3.3.01', nome: 'Despesas com ISS' },
    credito: { codigo: '2.1.2.05', nome: 'ISS a Recolher' },
    observacao: '2% a 5% conforme município',
    keywords: ['iss', 'issqn', 'servico', 'municipal']
  },
  {
    categoria: 'IMPOSTOS_MUNICIPAIS',
    nome: 'ISS Retido na Fonte',
    debito: { codigo: '1.1.2.01', nome: 'Clientes a Receber' },
    credito: { codigo: '4.3.3.01', nome: 'Despesas com ISS (Dedução)' },
    observacao: 'ISS retido pelo tomador - responsabilidade substituída',
    keywords: ['iss', 'retido', 'fonte', 'substituicao']
  },

  // ========== DUPLICATAS DESCONTADAS - OBJETIVA EDIÇÕES ==========
  {
    categoria: 'OPERACOES_FINANCEIRAS',
    nome: 'Desconto de Duplicatas - Recebimento',
    debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    credito: { codigo: '2.1.5.01', nome: 'Duplicatas Descontadas' },
    observacao: 'Passivo exigível até liquidação - conforme Objetiva Edições',
    keywords: ['duplicata', 'desconto', 'antecipacao'],
    fonte: 'objetivaedicoes.com.br'
  },
  {
    categoria: 'OPERACOES_FINANCEIRAS',
    nome: 'Desconto de Duplicatas - Encargos',
    debito: { codigo: '4.2.1.01', nome: 'Despesas Financeiras - Juros' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Taxa de desconto cobrada pelo banco',
    keywords: ['juros', 'desconto', 'encargo', 'financeiro']
  },
  {
    categoria: 'OPERACOES_FINANCEIRAS',
    nome: 'Duplicata Descontada - Liquidação pelo Cliente',
    debito: { codigo: '2.1.5.01', nome: 'Duplicatas Descontadas' },
    credito: { codigo: '1.1.2.01', nome: 'Clientes a Receber' },
    observacao: 'Baixa simultânea do passivo e do ativo',
    keywords: ['duplicata', 'liquidacao', 'baixa']
  },

  // ========== EMPRÉSTIMOS ==========
  {
    categoria: 'EMPRESTIMOS',
    nome: 'Contratação de Empréstimo Bancário',
    debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    credito: { codigo: '2.1.3.01', nome: 'Empréstimos Bancários CP' },
    observacao: 'Valor líquido recebido',
    keywords: ['emprestimo', 'contratacao', 'banco']
  },
  {
    categoria: 'EMPRESTIMOS',
    nome: 'Apropriação de Juros de Empréstimo',
    debito: { codigo: '4.2.1.01', nome: 'Despesas Financeiras - Juros' },
    credito: { codigo: '2.1.3.02', nome: 'Juros a Pagar' },
    observacao: 'Regime de competência - pro rata temporis',
    keywords: ['juros', 'emprestimo', 'apropriacao']
  },
  {
    categoria: 'EMPRESTIMOS',
    nome: 'Pagamento de Parcela de Empréstimo',
    debito: { codigo: '2.1.3.01', nome: 'Empréstimos Bancários CP' },
    debito2: { codigo: '2.1.3.02', nome: 'Juros a Pagar' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Principal + juros',
    keywords: ['parcela', 'emprestimo', 'amortizacao']
  },

  // ========== IMOBILIZADO ==========
  {
    categoria: 'IMOBILIZADO',
    nome: 'Aquisição de Imobilizado à Vista',
    debito: { codigo: '1.2.3.01', nome: 'Imobilizado' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Inclui frete e instalação',
    keywords: ['imobilizado', 'aquisicao', 'compra', 'ativo']
  },
  {
    categoria: 'IMOBILIZADO',
    nome: 'Depreciação Mensal',
    debito: { codigo: '4.1.4.01', nome: 'Despesas com Depreciação' },
    credito: { codigo: '1.2.3.99', nome: '(-) Depreciação Acumulada' },
    observacao: 'Conforme vida útil e método linear',
    keywords: ['depreciacao', 'imobilizado', 'desgaste']
  },
  {
    categoria: 'IMOBILIZADO',
    nome: 'Baixa de Imobilizado por Venda',
    debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    debito2: { codigo: '1.2.3.99', nome: '(-) Depreciação Acumulada' },
    credito: { codigo: '1.2.3.01', nome: 'Imobilizado' },
    credito2: { codigo: '3.2.2.01', nome: 'Ganho na Venda de Imobilizado' },
    observacao: 'Diferença entre valor de venda e valor contábil',
    keywords: ['venda', 'imobilizado', 'baixa', 'alienacao']
  },
  {
    categoria: 'IMOBILIZADO',
    nome: 'Construção em Andamento',
    debito: { codigo: '1.2.3.50', nome: 'Construções em Andamento' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Transferir para Imobilizado ao término - conforme Objetiva',
    keywords: ['construcao', 'andamento', 'obra'],
    fonte: 'objetivaedicoes.com.br'
  },

  // ========== ESTOQUE ==========
  {
    categoria: 'ESTOQUE',
    nome: 'Compra de Mercadorias à Vista',
    debito: { codigo: '1.1.4.01', nome: 'Estoque de Mercadorias' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Valor líquido de impostos recuperáveis',
    keywords: ['compra', 'mercadoria', 'estoque']
  },
  {
    categoria: 'ESTOQUE',
    nome: 'CMV - Custo das Mercadorias Vendidas',
    debito: { codigo: '4.1.1.01', nome: 'CMV' },
    credito: { codigo: '1.1.4.01', nome: 'Estoque de Mercadorias' },
    observacao: 'Baixa no momento da venda',
    keywords: ['cmv', 'custo', 'mercadoria', 'vendida']
  },
  {
    categoria: 'ESTOQUE',
    nome: 'Ajuste de Inventário - Perda',
    debito: { codigo: '4.1.1.02', nome: 'Perdas de Estoque' },
    credito: { codigo: '1.1.4.01', nome: 'Estoque de Mercadorias' },
    observacao: 'Diferença apurada no inventário físico',
    keywords: ['ajuste', 'inventario', 'perda', 'quebra']
  },
  {
    categoria: 'ESTOQUE',
    nome: 'Bonificação em Mercadorias Recebida',
    debito: { codigo: '1.1.4.01', nome: 'Estoque de Mercadorias' },
    credito: { codigo: '3.1.2.01', nome: 'Outras Receitas Operacionais' },
    observacao: 'Mercadoria recebida sem ônus',
    keywords: ['bonificacao', 'mercadoria', 'brinde']
  },

  // ========== RECEITAS ==========
  {
    categoria: 'RECEITAS',
    nome: 'Receita de Serviços Prestados',
    debito: { codigo: '1.1.2.01', nome: 'Clientes a Receber' },
    credito: { codigo: '3.1.1.01', nome: 'Receita de Serviços' },
    observacao: 'Regime de competência - momento da prestação',
    keywords: ['receita', 'servico', 'honorario', 'faturamento']
  },
  {
    categoria: 'RECEITAS',
    nome: 'Recebimento de Clientes',
    debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    credito: { codigo: '1.1.2.01', nome: 'Clientes a Receber' },
    observacao: 'Baixa do direito a receber',
    keywords: ['recebimento', 'cliente', 'pagamento']
  },
  {
    categoria: 'RECEITAS',
    nome: 'Receita Financeira - Juros',
    debito: { codigo: '1.1.1.10', nome: 'Aplicações Financeiras' },
    credito: { codigo: '3.2.1.01', nome: 'Receitas Financeiras' },
    observacao: 'Rendimento de aplicações',
    keywords: ['juros', 'rendimento', 'aplicacao', 'receita']
  },

  // ========== DESPESAS GERAIS ==========
  {
    categoria: 'DESPESAS',
    nome: 'Despesas Bancárias',
    debito: { codigo: '4.1.3.01', nome: 'Despesas Bancárias' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Tarifas, manutenção, TED, DOC',
    keywords: ['tarifa', 'bancaria', 'taxa', 'manutencao']
  },
  {
    categoria: 'DESPESAS',
    nome: 'Aluguel de Imóvel',
    debito: { codigo: '4.1.1.01', nome: 'Despesas com Aluguel' },
    credito: { codigo: '2.1.3.10', nome: 'Aluguéis a Pagar' },
    observacao: 'Apropriação mensal',
    keywords: ['aluguel', 'locacao', 'imovel']
  },
  {
    categoria: 'DESPESAS',
    nome: 'Energia Elétrica',
    debito: { codigo: '4.1.1.02', nome: 'Energia Elétrica' },
    credito: { codigo: '2.1.3.11', nome: 'Contas a Pagar' },
    observacao: 'Conforme fatura da concessionária',
    keywords: ['energia', 'luz', 'eletrica', 'enel', 'celg']
  },
  {
    categoria: 'DESPESAS',
    nome: 'Brindes - Distribuição',
    debito: { codigo: '4.1.1.20', nome: 'Despesas com Brindes' },
    credito: { codigo: '1.1.4.05', nome: 'Estoque de Brindes' },
    observacao: 'Atenção: não dedutível se > R$ 90/ano por pessoa - conforme Objetiva',
    keywords: ['brinde', 'propaganda', 'distribuicao'],
    fonte: 'objetivaedicoes.com.br'
  },

  // ========== PROVISÕES ==========
  {
    categoria: 'PROVISOES',
    nome: 'Provisão para Créditos de Liquidação Duvidosa',
    debito: { codigo: '4.1.5.01', nome: 'Despesas com PCLD' },
    credito: { codigo: '1.1.2.99', nome: '(-) PCLD' },
    observacao: 'Conforme critérios fiscais ou gerenciais',
    keywords: ['pcld', 'provisao', 'credito', 'duvidosa', 'perda']
  },
  {
    categoria: 'PROVISOES',
    nome: 'Reversão de PCLD',
    debito: { codigo: '1.1.2.99', nome: '(-) PCLD' },
    credito: { codigo: '3.2.3.01', nome: 'Reversão de Provisões' },
    observacao: 'Quando crédito é recebido ou prescrito',
    keywords: ['reversao', 'pcld', 'recuperacao']
  },
  {
    categoria: 'PROVISOES',
    nome: 'Provisão para Contingências',
    debito: { codigo: '4.1.5.02', nome: 'Despesas com Contingências' },
    credito: { codigo: '2.2.1.01', nome: 'Provisão para Contingências' },
    observacao: 'Obrigação presente com saída provável',
    keywords: ['contingencia', 'provisao', 'processo', 'judicial']
  },

  // ========== ADIANTAMENTOS ==========
  {
    categoria: 'ADIANTAMENTOS',
    nome: 'Adiantamento a Fornecedores',
    debito: { codigo: '1.1.3.01', nome: 'Adiantamentos a Fornecedores' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Direito a receber mercadoria/serviço',
    keywords: ['adiantamento', 'fornecedor', 'antecipacao']
  },
  {
    categoria: 'ADIANTAMENTOS',
    nome: 'Compensação Adiantamento Fornecedor',
    debito: { codigo: '1.1.4.01', nome: 'Estoque de Mercadorias' },
    credito: { codigo: '1.1.3.01', nome: 'Adiantamentos a Fornecedores' },
    observacao: 'Recebimento da mercadoria',
    keywords: ['compensacao', 'adiantamento', 'fornecedor']
  },
  {
    categoria: 'ADIANTAMENTOS',
    nome: 'Adiantamento a Sócios',
    debito: { codigo: '1.1.3.10', nome: 'Adiantamentos a Sócios' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'NUNCA é despesa - deve ser regularizado',
    keywords: ['adiantamento', 'socio', 'retirada', 'pessoal']
  },
  {
    categoria: 'ADIANTAMENTOS',
    nome: 'Adiantamento de Clientes',
    debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    credito: { codigo: '2.1.4.10', nome: 'Adiantamentos de Clientes' },
    observacao: 'Obrigação de entregar bem/serviço',
    keywords: ['adiantamento', 'cliente', 'sinal', 'antecipado']
  },

  // ========== CONSÓRCIO - OBJETIVA EDIÇÕES ==========
  {
    categoria: 'CONSORCIO',
    nome: 'Pagamento de Parcela de Consórcio (antes contemplação)',
    debito: { codigo: '1.2.2.01', nome: 'Consórcios a Receber' },
    credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    observacao: 'Direito a crédito futuro - conforme Objetiva Edições',
    keywords: ['consorcio', 'parcela', 'contemplacao'],
    fonte: 'objetivaedicoes.com.br'
  },
  {
    categoria: 'CONSORCIO',
    nome: 'Contemplação de Consórcio - Aquisição de Bem',
    debito: { codigo: '1.2.3.01', nome: 'Imobilizado' },
    credito: { codigo: '1.2.2.01', nome: 'Consórcios a Receber' },
    credito2: { codigo: '2.2.2.01', nome: 'Consórcios a Pagar LP' },
    observacao: 'Transferir para imobilizado e registrar saldo devedor',
    keywords: ['consorcio', 'contemplacao', 'carta', 'credito'],
    fonte: 'objetivaedicoes.com.br'
  },

  // ========== CAPITAL SOCIAL ==========
  {
    categoria: 'CAPITAL_SOCIAL',
    nome: 'Integralização de Capital em Dinheiro',
    debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    credito: { codigo: '5.1.1.01', nome: 'Capital Social' },
    observacao: 'Aporte dos sócios',
    keywords: ['capital', 'integralizacao', 'aporte', 'socio']
  },
  {
    categoria: 'CAPITAL_SOCIAL',
    nome: 'Aumento de Capital com Lucros',
    debito: { codigo: '5.3.1.01', nome: 'Lucros Acumulados' },
    credito: { codigo: '5.1.1.01', nome: 'Capital Social' },
    observacao: 'Incorporação de lucros ao capital',
    keywords: ['aumento', 'capital', 'lucro', 'incorporacao']
  },
  {
    categoria: 'CAPITAL_SOCIAL',
    nome: 'Reserva Legal',
    debito: { codigo: '5.3.1.01', nome: 'Lucros Acumulados' },
    credito: { codigo: '5.2.1.01', nome: 'Reserva Legal' },
    observacao: '5% do lucro até 20% do capital',
    keywords: ['reserva', 'legal', 'lucro']
  },

  // ========== ENCERRAMENTO ==========
  {
    categoria: 'ENCERRAMENTO',
    nome: 'Encerramento de Receitas (ARE)',
    debito: { codigo: '3.X.X.XX', nome: 'Contas de Receita' },
    credito: { codigo: '5.3.2.01', nome: 'Apuração do Resultado' },
    observacao: 'Transferir saldo credor para ARE',
    keywords: ['encerramento', 'receita', 'are', 'resultado']
  },
  {
    categoria: 'ENCERRAMENTO',
    nome: 'Encerramento de Despesas (ARE)',
    debito: { codigo: '5.3.2.01', nome: 'Apuração do Resultado' },
    credito: { codigo: '4.X.X.XX', nome: 'Contas de Despesa' },
    observacao: 'Transferir saldo devedor para ARE',
    keywords: ['encerramento', 'despesa', 'are', 'resultado']
  },
  {
    categoria: 'ENCERRAMENTO',
    nome: 'Transferência de Lucro do Exercício',
    debito: { codigo: '5.3.2.01', nome: 'Apuração do Resultado' },
    credito: { codigo: '5.3.1.01', nome: 'Lucros Acumulados' },
    observacao: 'Saldo credor do ARE = Lucro',
    keywords: ['lucro', 'exercicio', 'transferencia', 'are']
  },

  // ========== ENCERRAMENTO DE ATIVIDADES - OBJETIVA EDIÇÕES ==========
  {
    categoria: 'ENCERRAMENTO_ATIVIDADES',
    nome: 'Baixa de Estoque no Encerramento',
    debito: { codigo: '4.1.1.01', nome: 'CMV' },
    credito: { codigo: '1.1.4.01', nome: 'Estoque de Mercadorias' },
    observacao: 'Baixa do estoque remanescente - conforme Objetiva Edições',
    keywords: ['encerramento', 'baixa', 'estoque', 'atividades'],
    fonte: 'objetivaedicoes.com.br'
  },
  {
    categoria: 'ENCERRAMENTO_ATIVIDADES',
    nome: 'Realização de Imobilizado no Encerramento',
    debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
    debito2: { codigo: '1.2.3.99', nome: '(-) Depreciação Acumulada' },
    credito: { codigo: '1.2.3.01', nome: 'Imobilizado' },
    observacao: 'Venda dos ativos para liquidação',
    keywords: ['encerramento', 'venda', 'imobilizado', 'liquidacao'],
    fonte: 'objetivaedicoes.com.br'
  }
];

// =============================================================================
// FUNÇÕES DE BUSCA DE MODELOS
// =============================================================================

/**
 * Busca modelo de lançamento por keywords na descrição
 */
export function buscarModeloLancamento(descricao: string): ModeloLancamentoObjetiva | null {
  const desc = descricao.toLowerCase();
  let melhorModelo: ModeloLancamentoObjetiva | null = null;
  let maiorScore = 0;
  
  for (const modelo of MODELOS_LANCAMENTOS) {
    const keywordsEncontradas = modelo.keywords.filter(kw => desc.includes(kw.toLowerCase()));
    const score = keywordsEncontradas.length;
    
    if (score > maiorScore) {
      maiorScore = score;
      melhorModelo = modelo;
    }
  }
  
  return maiorScore > 0 ? melhorModelo : null;
}

/**
 * Busca modelos por categoria
 */
export function buscarModelosPorCategoria(categoria: string): ModeloLancamentoObjetiva[] {
  return MODELOS_LANCAMENTOS.filter(m => m.categoria === categoria);
}

/**
 * Lista todas as categorias disponíveis
 */
export function listarCategorias(): string[] {
  return [...new Set(MODELOS_LANCAMENTOS.map(m => m.categoria))];
}

/**
 * Busca modelo exato por nome
 */
export function getModeloPorNome(nome: string): ModeloLancamentoObjetiva | undefined {
  return MODELOS_LANCAMENTOS.find(m => m.nome.toLowerCase() === nome.toLowerCase());
}

// =============================================================================
// RE-EXPORTAÇÕES DA BASE DE CONHECIMENTO EXPANDIDA
// =============================================================================

// Re-exportar funções da base expandida para uso unificado
export * from './knowledgeBase';
