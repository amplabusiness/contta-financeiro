/**
 * BASE DE CONHECIMENTO EXPANDIDA - MCP Financeiro
 * 
 * Integra todos os conhecimentos:
 * - eSocial (eventos de folha de pagamento)
 * - Nota Fiscal (CFOP, CST, NCM, LC 116)
 * - Indicadores MBA (análise financeira)
 * - Lançamentos Contábeis (administrativo, fiscal, trabalhista, jurídico, financeiro)
 * 
 * Autor: Dr. Cícero / Ampla Contabilidade
 * Data: 31/01/2026
 */

import * as fs from "fs";
import * as path from "path";

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

export interface EventoESocial {
  nome: string;
  tipo: 'TABELA' | 'PERIODICO' | 'NAO_PERIODICO';
  periodicidade: string;
  descricao?: string;
}

export interface IncidenciaTributaria {
  descricao: string;
  fgts: boolean;
  inss: boolean;
  irrf: boolean;
}

export interface CategoriaTrabalhador {
  descricao: string;
  grupo?: string;
}

export interface MotivoAfastamento {
  descricao: string;
  tipo?: string;
}

export interface MotivoDesligamento {
  descricao: string;
  tipo?: string;
}

export interface CFOP {
  descricao: string;
  tipo: 'ENTRADA' | 'SAIDA';
  uf: 'INTERNA' | 'INTERESTADUAL' | 'EXTERIOR';
}

export interface CST {
  descricao: string;
  regime?: 'NORMAL' | 'SIMPLES';
  tipo?: 'ENTRADA' | 'SAIDA' | 'AMBOS';
}

export interface ServicoLC116 {
  descricao: string;
  aliquota_maxima?: number;
}

export interface IndicadorFinanceiro {
  nome: string;
  formula: string;
  interpretacao: string;
  ideal: string;
  categoria: 'liquidez' | 'rentabilidade' | 'endividamento' | 'atividade' | 'valuation';
}

export interface LancamentoContabil {
  nome: string;
  debito: string;
  credito: string;
  keywords: string[];
  categoria: 'administrativo' | 'fiscal' | 'trabalhista' | 'juridico' | 'financeiro';
  observacao?: string;
}

// =============================================================================
// CARREGAMENTO DOS JSONs
// =============================================================================

const knowledgeDir = path.dirname(__filename);

function loadJSON<T>(filename: string): T {
  const filePath = path.join(knowledgeDir, filename);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.error(`Erro ao carregar ${filename}:`, e);
    return {} as T;
  }
}

// Carregar bases de conhecimento
const esocialKnowledge = loadJSON<any>("esocial-knowledge.json");
const notaFiscalKnowledge = loadJSON<any>("nota-fiscal-knowledge.json");
const mbaKnowledge = loadJSON<any>("mba-indicadores-knowledge.json");
const lancamentosKnowledge = loadJSON<any>("lancamentos-contabeis-completo.json");

// =============================================================================
// FUNÇÕES DE CONSULTA eSocial
// =============================================================================

/**
 * Busca evento eSocial por código
 */
export function buscarEventoESocial(codigo: string): EventoESocial | null {
  const codigoUpper = codigo.toUpperCase();
  return esocialKnowledge.eventos?.[codigoUpper] || null;
}

/**
 * Lista eventos eSocial por tipo
 */
export function listarEventosESocial(tipo?: string): Record<string, EventoESocial> {
  const eventos = esocialKnowledge.eventos || {};
  if (!tipo || tipo === 'todos') {
    return eventos;
  }
  
  const filtrados: Record<string, EventoESocial> = {};
  for (const [codigo, evento] of Object.entries(eventos)) {
    if ((evento as EventoESocial).tipo === tipo) {
      filtrados[codigo] = evento as EventoESocial;
    }
  }
  return filtrados;
}

/**
 * Busca incidência tributária
 */
export function buscarIncidenciaTributaria(codigo: string): IncidenciaTributaria | null {
  return esocialKnowledge.incidencias?.[codigo] || null;
}

/**
 * Busca categoria de trabalhador
 */
export function buscarCategoriaTrabalhador(codigo: string): CategoriaTrabalhador | null {
  return esocialKnowledge.categorias_trabalhador?.[codigo] || null;
}

/**
 * Busca motivo de afastamento
 */
export function buscarMotivoAfastamento(codigo: string): MotivoAfastamento | null {
  return esocialKnowledge.motivos_afastamento?.[codigo] || null;
}

/**
 * Busca motivo de desligamento
 */
export function buscarMotivoDesligamento(codigo: string): MotivoDesligamento | null {
  return esocialKnowledge.motivos_desligamento?.[codigo] || null;
}

// =============================================================================
// FUNÇÕES DE CONSULTA NOTA FISCAL
// =============================================================================

/**
 * Busca CFOP por código
 */
export function buscarCFOP(codigo: string): CFOP | null {
  return notaFiscalKnowledge.cfop?.[codigo] || null;
}

/**
 * Lista CFOPs por tipo e UF
 */
export function listarCFOPs(tipo?: string, uf?: string): Record<string, CFOP> {
  const cfops = notaFiscalKnowledge.cfop || {};
  
  if (!tipo || tipo === 'todos') {
    if (!uf || uf === 'todas') {
      return cfops;
    }
  }
  
  const filtrados: Record<string, CFOP> = {};
  for (const [codigo, cfop] of Object.entries(cfops)) {
    const c = cfop as CFOP;
    if ((tipo === 'todos' || c.tipo === tipo) && 
        (uf === 'todas' || c.uf === uf)) {
      filtrados[codigo] = c;
    }
  }
  return filtrados;
}

/**
 * Busca CST ICMS
 */
export function buscarCSTIcms(codigo: string): CST | null {
  return notaFiscalKnowledge.cst_icms?.[codigo] || null;
}

/**
 * Busca CSOSN (Simples Nacional)
 */
export function buscarCSOSN(codigo: string): CST | null {
  return notaFiscalKnowledge.csosn?.[codigo] || null;
}

/**
 * Busca CST PIS/COFINS
 */
export function buscarCSTPisCofins(codigo: string): CST | null {
  return notaFiscalKnowledge.cst_pis_cofins?.[codigo] || null;
}

/**
 * Busca serviço LC 116
 */
export function buscarServicoLC116(codigo: string): ServicoLC116 | null {
  return notaFiscalKnowledge.servicos_lc116?.[codigo] || null;
}

// =============================================================================
// FUNÇÕES DE CONSULTA MBA / INDICADORES
// =============================================================================

/**
 * Obtém todos os indicadores como array plano
 */
function obterTodosIndicadores(): IndicadorFinanceiro[] {
  const indicadoresObj = mbaKnowledge.indicadores || {};
  const todos: IndicadorFinanceiro[] = [];
  
  for (const categoria of Object.keys(indicadoresObj)) {
    const itensCategoria = indicadoresObj[categoria] || {};
    for (const nome of Object.keys(itensCategoria)) {
      const item = itensCategoria[nome];
      todos.push({
        nome,
        formula: item.formula || '',
        interpretacao: item.interpretacao || '',
        ideal: item.ideal || '',
        categoria: categoria as IndicadorFinanceiro['categoria'],
      });
    }
  }
  
  return todos;
}

/**
 * Busca indicador financeiro por nome
 */
export function buscarIndicador(nome: string): IndicadorFinanceiro | null {
  const indicadores = obterTodosIndicadores();
  const nomeLower = nome.toLowerCase();
  
  return indicadores.find((i: IndicadorFinanceiro) => 
    i.nome.toLowerCase().includes(nomeLower)
  ) || null;
}

/**
 * Lista indicadores por categoria
 */
export function buscarIndicadoresPorCategoria(categoria: string): IndicadorFinanceiro[] {
  if (categoria === 'todos') {
    return obterTodosIndicadores();
  }
  
  const indicadoresObj = mbaKnowledge.indicadores || {};
  const itensCategoria = indicadoresObj[categoria] || {};
  
  const resultado: IndicadorFinanceiro[] = [];
  for (const nome of Object.keys(itensCategoria)) {
    const item = itensCategoria[nome];
    resultado.push({
      nome,
      formula: item.formula || '',
      interpretacao: item.interpretacao || '',
      ideal: item.ideal || '',
      categoria: categoria as IndicadorFinanceiro['categoria'],
    });
  }
  
  return resultado;
}

// =============================================================================
// FUNÇÕES DE CONSULTA LANÇAMENTOS
// =============================================================================

/**
 * Obtém todos os lançamentos como array plano
 */
function obterTodosLancamentos(): LancamentoContabil[] {
  const lancamentosObj = lancamentosKnowledge.lancamentos || {};
  const todos: LancamentoContabil[] = [];
  
  for (const categoria of Object.keys(lancamentosObj)) {
    const itens = lancamentosObj[categoria] || [];
    for (const item of itens) {
      todos.push({
        ...item,
        categoria: categoria as LancamentoContabil['categoria'],
      });
    }
  }
  
  return todos;
}

/**
 * Busca modelo de lançamento contábil por palavras-chave
 */
export function buscarLancamento(texto: string): LancamentoContabil | null {
  const lancamentos = obterTodosLancamentos();
  const palavras = texto.toLowerCase().split(/\s+/);
  
  let melhorMatch: LancamentoContabil | null = null;
  let melhorScore = 0;
  
  for (const lanc of lancamentos) {
    let score = 0;
    for (const palavra of palavras) {
      for (const keyword of (lanc.keywords || [])) {
        if (keyword.toLowerCase().includes(palavra) || palavra.includes(keyword.toLowerCase())) {
          score++;
        }
      }
    }
    
    // Também verifica no nome
    if (lanc.nome.toLowerCase().includes(texto.toLowerCase())) {
      score += 5;
    }
    
    if (score > melhorScore) {
      melhorScore = score;
      melhorMatch = lanc;
    }
  }
  
  return melhorScore >= 1 ? melhorMatch : null;
}

/**
 * Lista lançamentos por categoria
 */
export function listarLancamentosPorCategoria(categoria: string): LancamentoContabil[] {
  if (categoria === 'todos') {
    return obterTodosLancamentos();
  }
  
  const lancamentosObj = lancamentosKnowledge.lancamentos || {};
  const itens = lancamentosObj[categoria] || [];
  
  return itens.map((item: any) => ({
    ...item,
    categoria: categoria as LancamentoContabil['categoria'],
  }));
}

// =============================================================================
// FUNÇÕES DE ANÁLISE MBA
// =============================================================================

interface DadosBalanco {
  ativoCirculante: number;
  ativoNaoCirculante: number;
  passivoCirculante: number;
  passivoNaoCirculante: number;
  patrimonioLiquido: number;
}

interface DadosDRE {
  receita: number;
  lucroLiquido: number;
}

interface AnaliseIndicador {
  nome: string;
  valor: number;
  valorFormatado: string;
  status: 'OTIMO' | 'BOM' | 'REGULAR' | 'RUIM' | 'CRITICO';
  interpretacao: string;
}

/**
 * Calcula indicadores de liquidez
 */
function calcularIndicadoresLiquidez(balanco: DadosBalanco): AnaliseIndicador[] {
  const indicadores: AnaliseIndicador[] = [];
  
  // Liquidez Corrente
  const lc = balanco.ativoCirculante / balanco.passivoCirculante;
  indicadores.push({
    nome: 'Liquidez Corrente',
    valor: lc,
    valorFormatado: lc.toFixed(2),
    status: lc >= 2 ? 'OTIMO' : lc >= 1.5 ? 'BOM' : lc >= 1 ? 'REGULAR' : 'RUIM',
    interpretacao: lc >= 1 
      ? `Para cada R$ 1,00 de dívida de curto prazo, a empresa possui R$ ${lc.toFixed(2)} de ativos circulantes`
      : `ALERTA: Ativo circulante insuficiente para cobrir passivo circulante`
  });
  
  // Liquidez Geral
  const lg = (balanco.ativoCirculante + balanco.ativoNaoCirculante) / 
             (balanco.passivoCirculante + balanco.passivoNaoCirculante);
  indicadores.push({
    nome: 'Liquidez Geral',
    valor: lg,
    valorFormatado: lg.toFixed(2),
    status: lg >= 1.5 ? 'OTIMO' : lg >= 1 ? 'BOM' : lg >= 0.7 ? 'REGULAR' : 'RUIM',
    interpretacao: `Capacidade de pagamento total: ${lg.toFixed(2)}`
  });
  
  return indicadores;
}

/**
 * Calcula indicadores de rentabilidade
 */
function calcularIndicadoresRentabilidade(balanco: DadosBalanco, dre: DadosDRE): AnaliseIndicador[] {
  const indicadores: AnaliseIndicador[] = [];
  const ativoTotal = balanco.ativoCirculante + balanco.ativoNaoCirculante;
  
  // ROE - Retorno sobre Patrimônio
  const roe = (dre.lucroLiquido / balanco.patrimonioLiquido) * 100;
  indicadores.push({
    nome: 'ROE (Retorno sobre Patrimônio)',
    valor: roe,
    valorFormatado: `${roe.toFixed(2)}%`,
    status: roe >= 20 ? 'OTIMO' : roe >= 15 ? 'BOM' : roe >= 10 ? 'REGULAR' : roe >= 0 ? 'RUIM' : 'CRITICO',
    interpretacao: `A empresa gerou ${roe.toFixed(2)}% de retorno sobre o capital dos acionistas`
  });
  
  // ROA - Retorno sobre Ativos
  const roa = (dre.lucroLiquido / ativoTotal) * 100;
  indicadores.push({
    nome: 'ROA (Retorno sobre Ativos)',
    valor: roa,
    valorFormatado: `${roa.toFixed(2)}%`,
    status: roa >= 10 ? 'OTIMO' : roa >= 7 ? 'BOM' : roa >= 4 ? 'REGULAR' : roa >= 0 ? 'RUIM' : 'CRITICO',
    interpretacao: `A empresa gerou ${roa.toFixed(2)}% de retorno sobre seus ativos totais`
  });
  
  // Margem Líquida
  const ml = (dre.lucroLiquido / dre.receita) * 100;
  indicadores.push({
    nome: 'Margem Líquida',
    valor: ml,
    valorFormatado: `${ml.toFixed(2)}%`,
    status: ml >= 15 ? 'OTIMO' : ml >= 10 ? 'BOM' : ml >= 5 ? 'REGULAR' : ml >= 0 ? 'RUIM' : 'CRITICO',
    interpretacao: `A cada R$ 100 de receita, sobram R$ ${ml.toFixed(2)} de lucro líquido`
  });
  
  return indicadores;
}

/**
 * Calcula indicadores de endividamento
 */
function calcularIndicadoresEndividamento(balanco: DadosBalanco): AnaliseIndicador[] {
  const indicadores: AnaliseIndicador[] = [];
  const ativoTotal = balanco.ativoCirculante + balanco.ativoNaoCirculante;
  const passivoTotal = balanco.passivoCirculante + balanco.passivoNaoCirculante;
  
  // Endividamento Geral
  const eg = (passivoTotal / ativoTotal) * 100;
  indicadores.push({
    nome: 'Endividamento Geral',
    valor: eg,
    valorFormatado: `${eg.toFixed(2)}%`,
    status: eg <= 40 ? 'OTIMO' : eg <= 60 ? 'BOM' : eg <= 80 ? 'REGULAR' : 'RUIM',
    interpretacao: `${eg.toFixed(2)}% dos ativos são financiados por terceiros`
  });
  
  // Composição do Endividamento
  const ce = (balanco.passivoCirculante / passivoTotal) * 100;
  indicadores.push({
    nome: 'Composição do Endividamento',
    valor: ce,
    valorFormatado: `${ce.toFixed(2)}%`,
    status: ce <= 40 ? 'OTIMO' : ce <= 60 ? 'BOM' : ce <= 80 ? 'REGULAR' : 'RUIM',
    interpretacao: `${ce.toFixed(2)}% das dívidas vencem no curto prazo`
  });
  
  return indicadores;
}

/**
 * Gera análise financeira completa
 */
export function gerarAnaliseCompleta(
  empresa: string,
  periodo: string,
  balanco: DadosBalanco,
  dre: DadosDRE
): {
  empresa: string;
  periodo: string;
  dataAnalise: string;
  indicadores: {
    liquidez: AnaliseIndicador[];
    rentabilidade: AnaliseIndicador[];
    endividamento: AnaliseIndicador[];
  };
  diagnostico: string;
  recomendacoes: string[];
  score: number;
} {
  const liquidez = calcularIndicadoresLiquidez(balanco);
  const rentabilidade = calcularIndicadoresRentabilidade(balanco, dre);
  const endividamento = calcularIndicadoresEndividamento(balanco);
  
  // Calcular score geral (0-100)
  const calcularScoreIndicador = (ind: AnaliseIndicador): number => {
    switch (ind.status) {
      case 'OTIMO': return 100;
      case 'BOM': return 75;
      case 'REGULAR': return 50;
      case 'RUIM': return 25;
      case 'CRITICO': return 0;
      default: return 50;
    }
  };
  
  const todosIndicadores = [...liquidez, ...rentabilidade, ...endividamento];
  const score = Math.round(
    todosIndicadores.reduce((sum, i) => sum + calcularScoreIndicador(i), 0) / todosIndicadores.length
  );
  
  // Gerar diagnóstico
  let diagnostico = '';
  if (score >= 80) {
    diagnostico = 'EXCELENTE: A empresa apresenta ótimos indicadores financeiros em todas as dimensões analisadas.';
  } else if (score >= 60) {
    diagnostico = 'BOM: A empresa apresenta indicadores satisfatórios, com alguns pontos de melhoria.';
  } else if (score >= 40) {
    diagnostico = 'ATENÇÃO: A empresa apresenta indicadores que requerem atenção em algumas áreas.';
  } else {
    diagnostico = 'CRÍTICO: A empresa apresenta indicadores preocupantes que necessitam ação imediata.';
  }
  
  // Gerar recomendações
  const recomendacoes: string[] = [];
  
  for (const ind of todosIndicadores) {
    if (ind.status === 'RUIM' || ind.status === 'CRITICO') {
      if (ind.nome.includes('Liquidez')) {
        recomendacoes.push('Melhorar gestão do capital de giro e fluxo de caixa');
      } else if (ind.nome.includes('ROE') || ind.nome.includes('Margem')) {
        recomendacoes.push('Revisar estrutura de custos e aumentar eficiência operacional');
      } else if (ind.nome.includes('Endividamento')) {
        recomendacoes.push('Renegociar dívidas e buscar fontes de financiamento menos onerosas');
      }
    }
  }
  
  // Remover duplicatas
  const recomendacoesUnicas = [...new Set(recomendacoes)];
  
  return {
    empresa,
    periodo,
    dataAnalise: new Date().toISOString(),
    indicadores: {
      liquidez,
      rentabilidade,
      endividamento,
    },
    diagnostico,
    recomendacoes: recomendacoesUnicas.length > 0 ? recomendacoesUnicas : ['Manter práticas atuais de gestão financeira'],
    score,
  };
}

/**
 * Calcula Necessidade de Capital de Giro (NCG)
 */
export function calcularNCG(
  contasReceber: number,
  estoques: number = 0,
  fornecedores: number,
  outrasOperacionais: number = 0
): {
  ncg: number;
  interpretacao: string;
  status: 'POSITIVO' | 'NEGATIVO' | 'EQUILIBRADO';
} {
  const ativoOperacional = contasReceber + estoques;
  const passivoOperacional = fornecedores + outrasOperacionais;
  const ncg = ativoOperacional - passivoOperacional;
  
  let status: 'POSITIVO' | 'NEGATIVO' | 'EQUILIBRADO';
  let interpretacao: string;
  
  if (ncg > 0) {
    status = 'POSITIVO';
    interpretacao = `A empresa precisa de R$ ${ncg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de capital de giro para financiar suas operações`;
  } else if (ncg < 0) {
    status = 'NEGATIVO';
    interpretacao = `A empresa gera R$ ${Math.abs(ncg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de folga de caixa com suas operações`;
  } else {
    status = 'EQUILIBRADO';
    interpretacao = 'As fontes operacionais são suficientes para financiar as aplicações operacionais';
  }
  
  return { ncg, interpretacao, status };
}

/**
 * Realiza análise DuPont
 */
export function analiseDuPont(
  lucroLiquido: number,
  receita: number,
  ativoTotal: number,
  patrimonioLiquido: number
): {
  roe: number;
  margemLiquida: number;
  giroAtivo: number;
  multiplicadorAlavancagem: number;
  decomposicao: string;
} {
  const margemLiquida = lucroLiquido / receita;
  const giroAtivo = receita / ativoTotal;
  const multiplicadorAlavancagem = ativoTotal / patrimonioLiquido;
  const roe = margemLiquida * giroAtivo * multiplicadorAlavancagem * 100;
  
  return {
    roe,
    margemLiquida: margemLiquida * 100,
    giroAtivo,
    multiplicadorAlavancagem,
    decomposicao: `ROE ${roe.toFixed(2)}% = Margem ${(margemLiquida * 100).toFixed(2)}% × Giro ${giroAtivo.toFixed(2)} × Alavancagem ${multiplicadorAlavancagem.toFixed(2)}`
  };
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================

export const KnowledgeExpandido = {
  // eSocial
  buscarEventoESocial,
  listarEventosESocial,
  buscarIncidenciaTributaria,
  buscarCategoriaTrabalhador,
  buscarMotivoAfastamento,
  buscarMotivoDesligamento,
  
  // Nota Fiscal
  buscarCFOP,
  listarCFOPs,
  buscarCSTIcms,
  buscarCSOSN,
  buscarCSTPisCofins,
  buscarServicoLC116,
  
  // MBA
  buscarIndicador,
  buscarIndicadoresPorCategoria,
  gerarAnaliseCompleta,
  calcularNCG,
  analiseDuPont,
  
  // Lançamentos
  buscarLancamento,
  listarLancamentosPorCategoria,
};

export default KnowledgeExpandido;
