/**
 * ============================================================================
 * REGRAS DE NEGÓCIO - AMPLA CONTABILIDADE
 * ============================================================================
 * 
 * Este módulo contém todas as regras específicas da Ampla Contabilidade
 * para classificação automática de transações bancárias.
 * 
 * REGRAS ESTABELECIDAS (conversa com Dr. Cícero):
 * 
 * 1. TRANSFERÊNCIAS INTERNAS (Ampla → Ampla)
 *    - PIX entre contas da Ampla (CNPJ 23893032000169) → Adiantamento Sérgio Carneiro
 *    - Contas: Sicredi ↔ C6 Bank
 * 
 * 2. FATURA DE CARTÃO DE CRÉDITO
 *    - Sempre classificar como Adiantamento Sérgio Carneiro
 * 
 * 3. PAGAMENTOS A FUNCIONÁRIOS (CLT)
 *    - Dia 15: Adiantamento (40% do salário)
 *    - Dia 30: Salário (60% do salário)
 *    - Conta: 4.2.1.01 Salários e Ordenados
 * 
 * 4. PAGAMENTOS A TERCEIROS (PJ)
 *    - Dia 10: Pagamento mensal integral
 *    - Conta: 4.2.1.05 Serviços de Terceiros
 * 
 * 5. HONORÁRIOS RECEBIDOS
 *    - LIQ.COBRANCA: Desmembrar por cliente usando arquivos baixa_clientes
 *    - Cada cliente tem conta específica em 1.1.2.01.XXXX
 * 
 * 6. DESPESAS
 *    - NUNCA usar "Despesas Administrativas" genéricas
 *    - Cada despesa deve ter conta específica
 * 
 * 7. SÉRGIO CARNEIRO (SÓCIO)
 *    - NÃO existe pró-labore
 *    - Todos os valores são Adiantamento a Sócios
 * 
 * Autor: Sistema Contta / Ampla Contabilidade
 * Data: 01/02/2026
 * Autorizado por: Dr. Cícero - Contador Responsável
 */

// =============================================================================
// CONSTANTES DA EMPRESA
// =============================================================================

export const AMPLA_CNPJ = '23893032000169';
export const AMPLA_TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// =============================================================================
// CONTAS CONTÁBEIS - UUIDs
// =============================================================================

export const CONTAS_UUID = {
  // BANCOS
  BANCO_SICREDI: '10d5892d-a843-4034-8d62-9fec95b8fd56',        // 1.1.1.05
  
  // TRANSITÓRIAS
  TRANSITORIA_DEBITOS: '3e1fd22f-fba2-4cc2-b628-9d729233bca0',  // 1.1.9.01
  TRANSITORIA_CREDITOS: '28085461-9e5a-4fb4-847d-c9fc047fe0a1', // 2.1.9.01
  
  // ADIANTAMENTOS
  ADIANT_SERGIO_CARNEIRO: 'f0d3fc7d-b7c6-4b4f-9d4a-352e30848ddb', // 1.1.3.01.01
  
  // RECEITAS
  HONORARIOS_CONTABEIS: '3273fd5b-a16f-4a10-944e-55c8cb27f363',   // 3.1.1.01
  
  // DESPESAS - PESSOAL
  SALARIOS_ORDENADOS: 'c1a6f23a-8950-4b2b-8399-2d5fd9f5afa7',     // 4.2.1.01
  SERVICOS_TERCEIROS: '88caf258-d747-492e-9161-275ab67e967c',     // 4.2.1.05
  
  // DESPESAS - TARIFAS E ENCARGOS
  TARIFAS_BANCARIAS: '88caf258-d747-492e-9161-275ab67e967c',      // 4.3.1.02
  
} as const;

// =============================================================================
// FUNCIONÁRIOS CLT - DADOS REAIS DA FOLHA DE PAGAMENTO
// =============================================================================
// 
// REGRA DE PAGAMENTO:
// - Dia 15: Adiantamento (40% do salário base)
// - Dia 30: Salário Líquido (Salário - INSS - IRRF - Adiantamento - VT)
//
// Fonte: folha_pgto/FOLHA AMPLA JAN.pdf
// =============================================================================

export interface FuncionarioCLT {
  codigo: string;           // Código no sistema de folha
  nome: string;             // Nome completo
  cargo: string;            // Cargo/função
  cbo: string;              // Código Brasileiro de Ocupações
  centroCusto: string;      // Centro de custo (CC)
  dataAdmissao: string;     // Data de admissão
  salarioBase: number;      // Salário base mensal
  adiantamento: number;     // Valor do adiantamento (40%) - pago dia 15
  inss: number;             // Desconto INSS
  irrf: number;             // Desconto IRRF
  valeTransporte: number;   // Desconto Vale Transporte
  totalDescontos: number;   // Total de descontos
  valorLiquido: number;     // Valor líquido - pago dia 30
  ativo: boolean;
}

export const FUNCIONARIOS_CLT: FuncionarioCLT[] = [
  {
    codigo: '127',
    nome: 'DEUZA RESENDE DE JESUS',
    cargo: 'ANALISTA DE DEPARTAMENTO PESSOAL',
    cbo: '413105',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '03/12/2024',
    salarioBase: 3000.00,
    adiantamento: 1200.00,      // 40% = 1.200,00 (dia 15)
    inss: 0,
    irrf: 0,
    valeTransporte: 144.00,
    totalDescontos: 7590.00,    // Nota: verificar este valor
    valorLiquido: 0,            // Nota: verificar este valor
    ativo: true
  },
  {
    codigo: '126',
    nome: 'FABIANA MARIA DA SILVA MENDONCA',
    cargo: 'BABA',
    cbo: '516205',
    centroCusto: 'DESPESAS ADMINISTRATIVAS',
    dataAdmissao: '20/08/2024',
    salarioBase: 2300.00,
    adiantamento: 920.00,       // 40% = 920,00 (dia 15)
    inss: 204.42,
    irrf: 0,
    valeTransporte: 1.00,
    totalDescontos: 1125.42,
    valorLiquido: 1398.95,      // Pago dia 30
    ativo: true
  },
  {
    codigo: '114',
    nome: 'JOSIMAR DOS SANTOS MOTA',
    cargo: 'COORDENADOR CONTABIL',
    cbo: '252210',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '27/07/2023',
    salarioBase: 3762.00,
    adiantamento: 1504.80,      // 40% = 1.504,80 (dia 15)
    inss: 344.84,
    irrf: 98.14,
    valeTransporte: 0,
    totalDescontos: 1948.78,
    valorLiquido: 1813.22,      // Pago dia 30
    ativo: true
  },
  {
    codigo: '119',
    nome: 'RAIMUNDO PEREIRA MOREIRA',
    cargo: 'CASEIRO',
    cbo: '514325',
    centroCusto: 'DESPESAS ADMINISTRATIVAS',
    dataAdmissao: '22/02/2024',
    salarioBase: 2687.50,
    adiantamento: 0,            // Não tem adiantamento
    inss: 219.10,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 219.10,
    valorLiquido: 2468.40,      // Pago integral dia 30
    ativo: true
  },
  {
    codigo: '111',
    nome: 'SERGIO AUGUSTO DE OLIVEIRA LEAO',
    cargo: 'AUXILIAR ADMINISTRATIVO',
    cbo: '411010',
    centroCusto: 'DESPESAS ADMINISTRATIVAS',
    dataAdmissao: '03/10/2022',
    salarioBase: 2950.00,
    adiantamento: 1180.00,      // 40% = 1.180,00 (dia 15)
    inss: 0,
    irrf: 0,
    valeTransporte: 177.00,
    totalDescontos: 1358.00,
    valorLiquido: 1592.00,      // Pago dia 30
    ativo: true
  },
  {
    codigo: '124',
    nome: 'THAYNARA CONCEICAO DE MELO',
    cargo: 'ANALISTA CONTABIL',
    cbo: '252210',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '02/05/2024',
    salarioBase: 3727.75,
    adiantamento: 1491.10,      // 40% = 1.491,10 (dia 15)
    inss: 376.73,
    irrf: 138.00,
    valeTransporte: 0,
    totalDescontos: 2006.83,
    valorLiquido: 2020.92,      // Pago dia 30
    ativo: true
  },
  // ============ FUNCIONÁRIOS A COMPLETAR (dados da tabela employees) ============
  {
    codigo: '0',
    nome: 'AMANDA AMBROSIO',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 3800.00,
    adiantamento: 1520.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 2280.00,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'CLAUDIA',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 2500.00,
    adiantamento: 1000.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 1500.00,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'ERICK FABRICIO',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 4000.00,
    adiantamento: 1600.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 2400.00,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'JESSYCA DE FREITAS',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 3700.00,
    adiantamento: 1480.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 2220.00,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'JORDANA TEIXEIRA',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 3500.00,
    adiantamento: 1400.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 2100.00,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'LILIAN',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 2612.50,
    adiantamento: 1045.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 1567.50,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'LUCIANA',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 3500.00,
    adiantamento: 1400.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 2100.00,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'LUCIANE ROSA',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 3300.00,
    adiantamento: 1320.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 1980.00,      // Estimado 60%
    ativo: true
  },
  {
    codigo: '0',
    nome: 'THANINY',
    cargo: 'A DEFINIR',
    cbo: '',
    centroCusto: 'CUSTOS OPERACIONAIS',
    dataAdmissao: '',
    salarioBase: 4000.00,
    adiantamento: 1600.00,      // 40%
    inss: 0,
    irrf: 0,
    valeTransporte: 0,
    totalDescontos: 0,
    valorLiquido: 2400.00,      // Estimado 60%
    ativo: true
  },
];

// =============================================================================
// TERCEIROS PJ - REGRA: 100% dia 10
// =============================================================================

export interface TerceiroPJ {
  nome: string;
  valorMensal: number;
}

export const TERCEIROS_PJ: TerceiroPJ[] = [
  { nome: 'ALEXSSANDRA RAMOS',      valorMensal: 0 },  // Preencher valor
  { nome: 'ALINE',                  valorMensal: 0 },
  { nome: 'ANDREA FAGUNDES',        valorMensal: 0 },
  { nome: 'CORACI ALINE DOS SANTOS', valorMensal: 0 },
  { nome: 'DANIEL',                 valorMensal: 0 },
  { nome: 'ROSE',                   valorMensal: 0 },
  { nome: 'SUELI',                  valorMensal: 0 },
  { nome: 'TATIANA',                valorMensal: 0 },
  { nome: 'TAYLANE',                valorMensal: 0 },
];

// =============================================================================
// TIPOS DE CLASSIFICAÇÃO
// =============================================================================

export type TipoClassificacao = 
  | 'TRANSFERENCIA_INTERNA'
  | 'FATURA_CARTAO'
  | 'ADIANTAMENTO_CLT'
  | 'SALARIO_CLT'
  | 'RESCISAO_CLT'
  | 'PAGAMENTO_TERCEIRO_PJ'
  | 'HONORARIOS_CLIENTE'
  | 'TARIFA_BANCARIA'
  | 'DESPESA_ESPECIFICA'
  | 'NAO_IDENTIFICADO';

export interface ResultadoClassificacao {
  tipo: TipoClassificacao;
  contaDebito: string;
  contaCredito: string;
  descricaoLancamento: string;
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA';
  requerAprovacao: boolean;
  funcionarioOuCliente?: string;
}

// =============================================================================
// REGRAS DE CLASSIFICAÇÃO
// =============================================================================

/**
 * Verifica se é transferência interna entre contas da Ampla
 */
export function isTransferenciaInterna(descricao: string): boolean {
  const desc = descricao.toUpperCase();
  return (
    desc.includes(AMPLA_CNPJ) ||
    desc.includes('AMPLA CONTABILIDADE') ||
    (desc.includes('AMPLA') && (desc.includes('C6') || desc.includes('SICREDI')))
  );
}

/**
 * Verifica se é fatura de cartão de crédito
 */
export function isFaturaCartao(descricao: string): boolean {
  const desc = descricao.toUpperCase();
  return (
    desc.includes('DEB.CTA.FATURA') ||
    desc.includes('FATURA CARTAO') ||
    desc.includes('PAGAMENTO FATURA')
  );
}

/**
 * Identifica funcionário CLT pelo nome na descrição do PIX
 */
export function identificarFuncionarioCLT(descricao: string): FuncionarioCLT | null {
  const desc = descricao.toUpperCase();
  
  for (const func of FUNCIONARIOS_CLT) {
    // Tenta encontrar o nome ou parte significativa
    const partes = func.nome.split(' ');
    const primeiroNome = partes[0];
    const ultimoNome = partes[partes.length - 1];
    
    // Match exato ou parcial
    if (desc.includes(func.nome) || 
        (partes.length === 1 && desc.includes(primeiroNome)) ||
        (partes.length > 1 && desc.includes(primeiroNome) && desc.includes(ultimoNome))) {
      return func;
    }
    
    // Match só pelo primeiro nome (para nomes únicos como CLAUDIA, LILIAN)
    if (partes.length === 1 && desc.includes(primeiroNome)) {
      return func;
    }
  }
  
  return null;
}

/**
 * Identifica se é pagamento de adiantamento (dia ~15) ou salário (dia ~30)
 * Retorna o valor esperado baseado na data
 */
export function identificarTipoPagamentoCLT(
  func: FuncionarioCLT, 
  dataTransacao: Date,
  valorPago: number
): { tipo: 'ADIANTAMENTO' | 'SALARIO' | 'RESCISAO' | 'OUTROS'; valorEsperado: number; match: boolean } {
  const dia = dataTransacao.getDate();
  const valorAbs = Math.abs(valorPago);
  
  // Tolerância de 5% para variações
  const tolerancia = 0.05;
  
  // Verifica se é adiantamento (dia 10-20, valor = adiantamento)
  if (dia >= 10 && dia <= 20 && func.adiantamento > 0) {
    const diferenca = Math.abs(valorAbs - func.adiantamento) / func.adiantamento;
    if (diferenca <= tolerancia) {
      return { tipo: 'ADIANTAMENTO', valorEsperado: func.adiantamento, match: true };
    }
  }
  
  // Verifica se é salário líquido (dia 25-05, valor = valorLiquido)
  if ((dia >= 25 || dia <= 5) && func.valorLiquido > 0) {
    const diferenca = Math.abs(valorAbs - func.valorLiquido) / func.valorLiquido;
    if (diferenca <= tolerancia) {
      return { tipo: 'SALARIO', valorEsperado: func.valorLiquido, match: true };
    }
  }
  
  // Verifica se é pagamento integral (para quem não tem adiantamento, ex: RAIMUNDO)
  if (func.adiantamento === 0 && func.valorLiquido > 0) {
    const diferenca = Math.abs(valorAbs - func.valorLiquido) / func.valorLiquido;
    if (diferenca <= tolerancia) {
      return { tipo: 'SALARIO', valorEsperado: func.valorLiquido, match: true };
    }
  }
  
  // Valores muito diferentes podem ser rescisão ou outros
  if (valorAbs > func.salarioBase * 1.5) {
    return { tipo: 'RESCISAO', valorEsperado: 0, match: false };
  }
  
  return { tipo: 'OUTROS', valorEsperado: 0, match: false };
}

/**
 * Identifica terceiro PJ pelo nome na descrição do PIX
 */
export function identificarTerceiroPJ(descricao: string): TerceiroPJ | null {
  const desc = descricao.toUpperCase();
  
  for (const terceiro of TERCEIROS_PJ) {
    const partes = terceiro.nome.split(' ');
    const primeiroNome = partes[0];
    const ultimoNome = partes[partes.length - 1];
    
    if (desc.includes(terceiro.nome) || 
        (desc.includes(primeiroNome) && partes.length === 1) ||
        (desc.includes(primeiroNome) && desc.includes(ultimoNome))) {
      return terceiro;
    }
  }
  
  return null;
}

/**
 * Determina se é adiantamento (dia ~15) ou salário (dia ~30) baseado na data
 */
export function tipoFolhaPorData(dataTransacao: Date): 'ADIANTAMENTO' | 'SALARIO' {
  const dia = dataTransacao.getDate();
  
  // Dia 10 a 20 = Adiantamento (40%)
  // Dia 25 a 05 = Salário (60%)
  if (dia >= 10 && dia <= 20) {
    return 'ADIANTAMENTO';
  }
  return 'SALARIO';
}

/**
 * FUNÇÃO PRINCIPAL: Classifica uma transação bancária
 */
export function classificarTransacao(
  descricao: string,
  valor: number,
  dataTransacao: Date
): ResultadoClassificacao {
  const desc = descricao.toUpperCase();
  const dia = dataTransacao.getDate();
  const isEntrada = valor > 0;
  const valorAbs = Math.abs(valor);
  
  // =========================================================================
  // 1. TRANSFERÊNCIA INTERNA (Ampla → Ampla)
  // =========================================================================
  if (isTransferenciaInterna(descricao)) {
    return {
      tipo: 'TRANSFERENCIA_INTERNA',
      contaDebito: isEntrada ? CONTAS_UUID.TRANSITORIA_CREDITOS : CONTAS_UUID.ADIANT_SERGIO_CARNEIRO,
      contaCredito: isEntrada ? CONTAS_UUID.ADIANT_SERGIO_CARNEIRO : CONTAS_UUID.TRANSITORIA_DEBITOS,
      descricaoLancamento: `Transferência Interna Ampla - ${isEntrada ? 'Entrada' : 'Saída'} - Adiant. Sérgio Carneiro`,
      confianca: 'ALTA',
      requerAprovacao: false,
    };
  }
  
  // =========================================================================
  // 2. FATURA DE CARTÃO → Adiantamento Sérgio Carneiro
  // =========================================================================
  if (isFaturaCartao(descricao)) {
    return {
      tipo: 'FATURA_CARTAO',
      contaDebito: CONTAS_UUID.ADIANT_SERGIO_CARNEIRO,
      contaCredito: CONTAS_UUID.TRANSITORIA_DEBITOS,
      descricaoLancamento: 'Fatura Cartão de Crédito - Adiant. Sérgio Carneiro',
      confianca: 'ALTA',
      requerAprovacao: false,
    };
  }
  
  // =========================================================================
  // 3. TARIFAS BANCÁRIAS
  // =========================================================================
  if (desc.includes('TARIFA') || desc.includes('MANUTENCAO DE TITULOS') || desc.includes('CESTA DE RELACIONAMENTO')) {
    return {
      tipo: 'TARIFA_BANCARIA',
      contaDebito: CONTAS_UUID.TARIFAS_BANCARIAS,
      contaCredito: CONTAS_UUID.TRANSITORIA_DEBITOS,
      descricaoLancamento: `Tarifa Bancária - ${descricao.substring(0, 50)}`,
      confianca: 'ALTA',
      requerAprovacao: false,
    };
  }
  
  // =========================================================================
  // 4. HONORÁRIOS (LIQ.COBRANCA)
  // =========================================================================
  if (desc.includes('LIQ.COBRANCA')) {
    return {
      tipo: 'HONORARIOS_CLIENTE',
      contaDebito: CONTAS_UUID.TRANSITORIA_CREDITOS,
      contaCredito: CONTAS_UUID.HONORARIOS_CONTABEIS,  // Será substituído pelo cliente específico
      descricaoLancamento: `Recebimento Honorários - ${descricao}`,
      confianca: 'MEDIA',  // Precisa identificar cliente
      requerAprovacao: true,  // Precisa desmembrar por cliente
    };
  }
  
  // =========================================================================
  // 5. PAGAMENTO PIX - FUNCIONÁRIO CLT
  // =========================================================================
  if (desc.includes('PAGAMENTO PIX') && !isEntrada) {
    const funcionario = identificarFuncionarioCLT(descricao);
    
    if (funcionario) {
      const tipoPagamento = identificarTipoPagamentoCLT(funcionario, dataTransacao, valor);
      
      // Determina a descrição e confiança baseado no tipo
      let descLanc: string;
      let confianca: 'ALTA' | 'MEDIA' | 'BAIXA';
      
      if (tipoPagamento.tipo === 'ADIANTAMENTO') {
        descLanc = `Adiantamento Salarial (40%) - ${funcionario.nome}`;
        confianca = tipoPagamento.match ? 'ALTA' : 'MEDIA';
      } else if (tipoPagamento.tipo === 'SALARIO') {
        descLanc = `Salário Líquido - ${funcionario.nome}`;
        confianca = tipoPagamento.match ? 'ALTA' : 'MEDIA';
      } else if (tipoPagamento.tipo === 'RESCISAO') {
        descLanc = `Rescisão/Férias - ${funcionario.nome}`;
        confianca = 'BAIXA';
      } else {
        descLanc = `Pagamento Folha - ${funcionario.nome}`;
        confianca = 'BAIXA';
      }
      
      return {
        tipo: tipoPagamento.tipo === 'ADIANTAMENTO' ? 'ADIANTAMENTO_CLT' : 'SALARIO_CLT',
        contaDebito: CONTAS_UUID.SALARIOS_ORDENADOS,
        contaCredito: CONTAS_UUID.TRANSITORIA_DEBITOS,
        descricaoLancamento: descLanc,
        confianca,
        requerAprovacao: confianca !== 'ALTA',
        funcionarioOuCliente: funcionario.nome,
      };
    }
    
    // =========================================================================
    // 6. PAGAMENTO PIX - TERCEIRO PJ (dia ~10)
    // =========================================================================
    const terceiro = identificarTerceiroPJ(descricao);
    
    if (terceiro) {
      return {
        tipo: 'PAGAMENTO_TERCEIRO_PJ',
        contaDebito: CONTAS_UUID.SERVICOS_TERCEIROS,
        contaCredito: CONTAS_UUID.TRANSITORIA_DEBITOS,
        descricaoLancamento: `Serviços de Terceiros - ${terceiro.nome}`,
        confianca: dia >= 8 && dia <= 12 ? 'ALTA' : 'MEDIA',
        requerAprovacao: !(dia >= 8 && dia <= 12),
        funcionarioOuCliente: terceiro.nome,
      };
    }
  }
  
  // =========================================================================
  // 7. RECEBIMENTO PIX (não LIQ.COBRANCA)
  // =========================================================================
  if (desc.includes('RECEBIMENTO PIX') && isEntrada) {
    return {
      tipo: 'HONORARIOS_CLIENTE',
      contaDebito: CONTAS_UUID.TRANSITORIA_CREDITOS,
      contaCredito: CONTAS_UUID.HONORARIOS_CONTABEIS,
      descricaoLancamento: `Recebimento PIX - ${descricao.substring(0, 50)}`,
      confianca: 'MEDIA',
      requerAprovacao: true,  // Precisa identificar cliente
    };
  }
  
  // =========================================================================
  // DEFAULT: Não identificado
  // =========================================================================
  return {
    tipo: 'NAO_IDENTIFICADO',
    contaDebito: isEntrada ? CONTAS_UUID.TRANSITORIA_CREDITOS : CONTAS_UUID.TRANSITORIA_DEBITOS,
    contaCredito: isEntrada ? CONTAS_UUID.TRANSITORIA_CREDITOS : CONTAS_UUID.TRANSITORIA_DEBITOS,
    descricaoLancamento: `${isEntrada ? 'Entrada' : 'Saída'} não classificada - ${descricao.substring(0, 50)}`,
    confianca: 'BAIXA',
    requerAprovacao: true,
  };
}

// =============================================================================
// REGRAS ESPECÍFICAS PARA DESPESAS (NÃO USAR GENÉRICAS)
// =============================================================================

export const MAPEAMENTO_DESPESAS: Record<string, { codigo: string; uuid: string; nome: string }> = {
  // Utilidades
  'ENERGISA': { codigo: '4.1.2.02', uuid: '', nome: 'Energia Elétrica' },
  'ENEL': { codigo: '4.1.2.02', uuid: '', nome: 'Energia Elétrica' },
  'SANEAGO': { codigo: '4.1.2.04', uuid: '', nome: 'Água e Esgoto' },
  'PMGO': { codigo: '4.1.2.04', uuid: '', nome: 'Água e Esgoto' },
  
  // Telefonia
  'VIVO': { codigo: '4.1.2.03', uuid: '', nome: 'Telefone e Internet' },
  'CLARO': { codigo: '4.1.2.03', uuid: '', nome: 'Telefone e Internet' },
  'TIM': { codigo: '4.1.2.03', uuid: '', nome: 'Telefone e Internet' },
  'TIMCEL': { codigo: '4.1.2.03', uuid: '', nome: 'Telefone e Internet' },
  
  // Impostos
  'SIMPLES': { codigo: '4.4.1.06', uuid: '', nome: 'Simples Nacional (DAS)' },
  'DAS': { codigo: '4.4.1.06', uuid: '', nome: 'Simples Nacional (DAS)' },
  'DARF': { codigo: '4.4.1.01', uuid: '', nome: 'Impostos Federais' },
  'DARFC': { codigo: '4.4.1.01', uuid: '', nome: 'Impostos Federais' },
  'SEFAZ': { codigo: '4.4.1.03', uuid: '', nome: 'Impostos Estaduais' },
  
  // Profissionais
  'CRC': { codigo: '4.1.7.04', uuid: '', nome: 'Anuidade CRC' },
  'FENACON': { codigo: '4.1.7.04', uuid: '', nome: 'Contribuições de Classe' },
  
  // Fornecedores de Software
  'DOMINIO': { codigo: '4.1.5.01', uuid: '', nome: 'Software Contábil' },
  'THOMSON': { codigo: '4.1.5.01', uuid: '', nome: 'Software Contábil' },
  'ALTERDATA': { codigo: '4.1.5.01', uuid: '', nome: 'Software Contábil' },
  
  // Certificado Digital
  'CERTIFICADO': { codigo: '4.1.5.02', uuid: '', nome: 'Certificado Digital' },
  'CERTISIGN': { codigo: '4.1.5.02', uuid: '', nome: 'Certificado Digital' },
  'SERASA': { codigo: '4.1.5.02', uuid: '', nome: 'Certificado Digital' },
};

/**
 * Identifica despesa específica pelo padrão na descrição
 */
export function identificarDespesaEspecifica(descricao: string): { codigo: string; uuid: string; nome: string } | null {
  const desc = descricao.toUpperCase();
  
  for (const [padrao, conta] of Object.entries(MAPEAMENTO_DESPESAS)) {
    if (desc.includes(padrao)) {
      return conta;
    }
  }
  
  return null;
}

// =============================================================================
// REGRAS DE VALIDAÇÃO (DR. CÍCERO)
// =============================================================================

export const REGRAS_BLOQUEIO = {
  /**
   * NUNCA classificar PIX de sócio como receita
   */
  PIX_SOCIO_NAO_E_RECEITA: (descricao: string, valor: number) => {
    const desc = descricao.toUpperCase();
    const isEntrada = valor > 0;
    
    if (isEntrada && (desc.includes('SERGIO') || desc.includes('CARNEIRO'))) {
      return {
        bloqueado: true,
        motivo: 'PIX de sócio NUNCA é receita. Classificar como Adiantamento ou Empréstimo.',
      };
    }
    return { bloqueado: false };
  },
  
  /**
   * NUNCA usar "Despesas Administrativas" genéricas
   */
  NAO_USAR_DESPESAS_GENERICAS: (contaCodigo: string) => {
    const contasProibidas = ['4.1.1.01', '4.1.1.99', '4.1.9.01'];
    
    if (contasProibidas.includes(contaCodigo)) {
      return {
        bloqueado: true,
        motivo: 'Não usar contas genéricas. Especificar a natureza da despesa.',
      };
    }
    return { bloqueado: false };
  },
};

// =============================================================================
// EXPORTAÇÕES PARA USO NO SISTEMA
// =============================================================================

export default {
  AMPLA_CNPJ,
  AMPLA_TENANT_ID,
  CONTAS_UUID,
  FUNCIONARIOS_CLT,
  TERCEIROS_PJ,
  MAPEAMENTO_DESPESAS,
  REGRAS_BLOQUEIO,
  classificarTransacao,
  isTransferenciaInterna,
  isFaturaCartao,
  identificarFuncionarioCLT,
  identificarTerceiroPJ,
  identificarDespesaEspecifica,
  tipoFolhaPorData,
};
