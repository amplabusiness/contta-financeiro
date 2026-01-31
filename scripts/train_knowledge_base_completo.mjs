#!/usr/bin/env node
/**
 * TREINAMENTO COMPLETO DA BASE DE CONHECIMENTO
 * Dr. Cícero e Agentes Subordinados
 * 
 * Inclui:
 * - eSocial (eventos S-1xxx, S-2xxx, S-3xxx)
 * - Nota Fiscal (CFOP, CST, NCM)
 * - Lançamentos Contábeis (Administrativo, Fiscal, Trabalhista, Jurídico, Financeiro)
 * - Indicadores MBA (Análises Financeiras, Relatórios)
 * 
 * Autor: Dr. Cícero / Ampla Contabilidade
 * Data: 31/01/2026
 */

import 'dotenv/config';
import fs from 'fs';

const SERPER_API_KEY = process.env.SERPER_API_KEY || 'ea27fb9fc6455d7bdd5a9743873adf008bc74f40';

console.log('🧠 TREINAMENTO COMPLETO - Dr. Cícero e Agentes Subordinados');
console.log('='.repeat(80));

// =============================================================================
// 1. QUERIES eSocial - EVENTOS DE FOLHA DE PAGAMENTO
// =============================================================================

const QUERIES_ESOCIAL = [
  // Eventos Periódicos (S-1xxx)
  'eSocial S-1200 remuneração trabalhador evento tabela campos',
  'eSocial S-1210 pagamentos diversos rendimentos campos',
  'eSocial S-1260 comercialização produção rural',
  'eSocial S-1270 contratação trabalhadores avulsos',
  'eSocial S-1280 informações complementares eventos periódicos',
  'eSocial S-1298 reabertura eventos periódicos',
  'eSocial S-1299 fechamento eventos periódicos',
  
  // Eventos de Tabela (S-1xxx)
  'eSocial S-1000 informações empregador tabela',
  'eSocial S-1005 tabela estabelecimentos obras',
  'eSocial S-1010 tabela rubricas folha pagamento',
  'eSocial S-1020 tabela lotações tributárias',
  'eSocial S-1070 tabela processos administrativos judiciais',
  
  // Eventos Não Periódicos (S-2xxx)
  'eSocial S-2190 registro preliminar trabalhador',
  'eSocial S-2200 cadastramento inicial admissão trabalhador',
  'eSocial S-2205 alteração dados cadastrais trabalhador',
  'eSocial S-2206 alteração contrato trabalho',
  'eSocial S-2210 comunicação acidente trabalho CAT',
  'eSocial S-2220 monitoramento saúde trabalhador ASO',
  'eSocial S-2230 afastamento temporário evento',
  'eSocial S-2240 condições ambientais trabalho agentes nocivos',
  'eSocial S-2250 aviso prévio evento',
  'eSocial S-2298 reintegração trabalhador',
  'eSocial S-2299 desligamento evento',
  'eSocial S-2300 trabalhador sem vínculo início TSVE',
  'eSocial S-2306 trabalhador sem vínculo alteração',
  'eSocial S-2399 trabalhador sem vínculo término',
  'eSocial S-2400 benefício previdenciário RPPS',
  
  // Eventos de SST
  'eSocial S-2210 CAT comunicação acidente trabalho campos',
  'eSocial S-2220 ASO atestado saúde ocupacional',
  'eSocial S-2240 PPP perfil profissiográfico previdenciário',
  
  // Tabelas e Códigos
  'tabela rubricas eSocial natureza código incidência',
  'tabela categoria trabalhador eSocial códigos',
  'tabela motivo afastamento eSocial códigos',
  'tabela motivo desligamento eSocial códigos',
  'eSocial incidências tributárias FGTS INSS IRRF tabela'
];

// =============================================================================
// 2. QUERIES NOTA FISCAL - CFOP, CST, NCM
// =============================================================================

const QUERIES_NOTA_FISCAL = [
  // CFOP
  'tabela CFOP completa operações entrada saída',
  'CFOP 5.102 5.405 5.949 venda mercadoria',
  'CFOP 1.102 1.556 entrada mercadoria compra',
  'CFOP 6.102 6.108 venda interestadual',
  'CFOP prestação serviço 5.933 5.949',
  'CFOP devolução 5.202 5.411 5.412',
  'CFOP transferência 5.152 5.409',
  'CFOP remessa conserto demonstração 5.915 5.912',
  'CFOP bonificação brinde 5.910 5.911',
  'CFOP industrialização 5.124 5.125',
  
  // CST ICMS
  'tabela CST ICMS código situação tributária',
  'CST 00 01 10 20 tributação integral ICMS',
  'CST 40 41 50 isenção ICMS',
  'CST 60 70 substituição tributária ICMS',
  'CSOSN Simples Nacional tabela completa',
  
  // CST PIS/COFINS
  'tabela CST PIS COFINS código situação tributária',
  'CST 01 02 PIS COFINS operação tributável',
  'CST 04 05 06 07 08 09 PIS COFINS monofásico ST',
  
  // NCM
  'tabela NCM classificação fiscal mercadorias',
  'NCM capítulos principais produtos',
  
  // NFS-e
  'código serviço NFS-e LC 116 lista',
  'natureza operação NFS-e tributação município',
  'retenções NFS-e ISS IRRF INSS PIS COFINS CSLL'
];

// =============================================================================
// 3. QUERIES LANÇAMENTOS CONTÁBEIS POR ÁREA
// =============================================================================

const QUERIES_LANCAMENTOS_ADMINISTRATIVO = [
  'lançamento contábil material escritório expediente',
  'lançamento contábil manutenção equipamentos reparos',
  'lançamento contábil serviços terceiros PJ',
  'lançamento contábil despesas viagem hospedagem',
  'lançamento contábil combustível veículos',
  'lançamento contábil correios malotes sedex',
  'lançamento contábil software licenças assinaturas',
  'lançamento contábil treinamento capacitação',
  'lançamento contábil seguro empresa responsabilidade civil',
  'lançamento contábil despesas cartório registro',
  'lançamento contábil publicidade propaganda marketing',
  'lançamento contábil brindes promocionais',
  'lançamento contábil limpeza conservação',
  'lançamento contábil vigilância segurança patrimonial',
  'lançamento contábil honorários advocatícios contábeis'
];

const QUERIES_LANCAMENTOS_FISCAL = [
  'lançamento contábil ICMS débito crédito apuração',
  'lançamento contábil ICMS ST substituição tributária',
  'lançamento contábil IPI débito crédito',
  'lançamento contábil PIS COFINS não cumulativo crédito',
  'lançamento contábil PIS COFINS cumulativo',
  'lançamento contábil ISS devido retido',
  'lançamento contábil IRPJ lucro real presumido',
  'lançamento contábil CSLL provisão recolhimento',
  'lançamento contábil Simples Nacional DAS apuração',
  'lançamento contábil DIFAL diferencial alíquota',
  'lançamento contábil importação tributos nacionalização',
  'lançamento contábil exportação imunidade',
  'lançamento contábil incentivo fiscal subvenção',
  'lançamento contábil parcelamento tributos REFIS',
  'lançamento contábil compensação tributos PERDCOMP'
];

const QUERIES_LANCAMENTOS_TRABALHISTA = [
  'lançamento contábil folha pagamento salários encargos',
  'lançamento contábil FGTS provisão recolhimento',
  'lançamento contábil INSS patronal empregado',
  'lançamento contábil férias provisão pagamento',
  'lançamento contábil 13º salário provisão pagamento',
  'lançamento contábil rescisão trabalhista verbas',
  'lançamento contábil aviso prévio indenizado trabalhado',
  'lançamento contábil IRRF sobre salários',
  'lançamento contábil vale transporte alimentação refeição',
  'lançamento contábil plano saúde odontológico',
  'lançamento contábil pensão alimentícia desconto',
  'lançamento contábil contribuição sindical',
  'lançamento contábil participação lucros PLR',
  'lançamento contábil adiantamento salarial',
  'lançamento contábil horas extras adicional noturno'
];

const QUERIES_LANCAMENTOS_JURIDICO = [
  'lançamento contábil provisão contingências trabalhistas',
  'lançamento contábil provisão contingências tributárias',
  'lançamento contábil provisão contingências cíveis',
  'lançamento contábil depósito judicial recursal',
  'lançamento contábil honorários advocatícios sucumbência',
  'lançamento contábil multas penalidades',
  'lançamento contábil acordos judiciais pagamento',
  'lançamento contábil reversão provisão contingências',
  'lançamento contábil passivo descoberto contingência',
  'lançamento contábil atualização depósitos judiciais'
];

const QUERIES_LANCAMENTOS_FINANCEIRO = [
  'lançamento contábil empréstimo bancário contratação',
  'lançamento contábil juros empréstimo apropriação',
  'lançamento contábil amortização empréstimo parcela',
  'lançamento contábil financiamento imobilizado leasing',
  'lançamento contábil aplicação financeira CDB poupança',
  'lançamento contábil rendimento aplicação IOF',
  'lançamento contábil variação cambial ativa passiva',
  'lançamento contábil hedge proteção cambial',
  'lançamento contábil juros mora multa atraso',
  'lançamento contábil desconto obtido concedido',
  'lançamento contábil antecipação recebíveis factoring',
  'lançamento contábil duplicatas descontadas',
  'lançamento contábil cartão crédito vendas taxas',
  'lançamento contábil adiantamento clientes fornecedores',
  'lançamento contábil ajuste valor presente AVP'
];

// =============================================================================
// 4. QUERIES INDICADORES MBA - ANÁLISE FINANCEIRA
// =============================================================================

const QUERIES_INDICADORES_MBA = [
  // Indicadores de Liquidez
  'indicador liquidez corrente fórmula interpretação',
  'indicador liquidez seca fórmula análise',
  'indicador liquidez imediata cálculo',
  'indicador liquidez geral empresa',
  'capital circulante líquido CCL análise',
  
  // Indicadores de Rentabilidade
  'ROE retorno sobre patrimônio líquido fórmula',
  'ROA retorno sobre ativos cálculo análise',
  'ROI retorno sobre investimento',
  'margem bruta líquida operacional EBITDA',
  'EBITDA EBIT cálculo diferença',
  'margem de contribuição análise ponto equilíbrio',
  'payback período retorno investimento',
  'TIR taxa interna retorno cálculo',
  'VPL valor presente líquido análise',
  
  // Indicadores de Endividamento
  'índice endividamento geral fórmula',
  'composição endividamento curto longo prazo',
  'grau alavancagem financeira GAF',
  'cobertura juros EBITDA',
  'índice imobilização patrimônio líquido',
  
  // Indicadores de Atividade
  'prazo médio recebimento PMR giro',
  'prazo médio pagamento PMP fornecedores',
  'prazo médio estocagem PME giro',
  'ciclo operacional financeiro empresa',
  'giro do ativo total',
  
  // Análise DuPont
  'análise DuPont decomposição ROE',
  'fórmula DuPont três cinco fatores',
  
  // Valuation
  'múltiplos valuation EV/EBITDA P/L',
  'fluxo caixa descontado DCF valuation',
  'WACC custo médio ponderado capital',
  'beta alavancado desalavancado CAPM',
  
  // Análise Horizontal e Vertical
  'análise vertical horizontal demonstrações financeiras',
  'análise tendência balanço DRE',
  
  // Indicadores Operacionais
  'break even point análise equilibrio',
  'alavancagem operacional GAO',
  'margem segurança operacional'
];

// =============================================================================
// 5. QUERIES RELATÓRIOS E DEMONSTRAÇÕES
// =============================================================================

const QUERIES_RELATORIOS = [
  // Demonstrações Contábeis
  'modelo balanço patrimonial estrutura contas',
  'modelo DRE demonstração resultado exercício',
  'modelo DMPL demonstração mutações patrimônio',
  'modelo DFC demonstração fluxo caixa direto indireto',
  'modelo DVA demonstração valor adicionado',
  'notas explicativas demonstrações contábeis',
  
  // Relatórios Gerenciais
  'modelo relatório fluxo caixa gerencial',
  'modelo relatório contas receber aging',
  'modelo relatório contas pagar vencimentos',
  'modelo relatório estoque valorização',
  'modelo relatório rentabilidade cliente produto',
  'modelo relatório centro custo departamento',
  'modelo dashboard financeiro indicadores',
  'modelo relatório orçado realizado variações',
  
  // SPED e Obrigações
  'ECD escrituração contábil digital estrutura',
  'ECF escrituração contábil fiscal blocos',
  'SPED Fiscal estrutura registros',
  'SPED Contribuições PIS COFINS estrutura'
];

// =============================================================================
// FUNÇÃO PARA BUSCAR NO SERPER
// =============================================================================

async function searchSerper(query, delay = 400) {
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: 10,
        gl: 'br',
        hl: 'pt-br',
      }),
    });

    if (!response.ok) {
      console.error(`  ⚠️ Erro na busca: ${response.status}`);
      return [];
    }

    const data = await response.json();
    await new Promise(resolve => setTimeout(resolve, delay));
    return data.organic || [];
  } catch (error) {
    console.error(`  ❌ Erro: ${error.message}`);
    return [];
  }
}

// =============================================================================
// PROCESSAR RESULTADOS
// =============================================================================

function processResults(results, categoria, query) {
  return results.map(r => ({
    categoria,
    query,
    titulo: r.title,
    snippet: r.snippet || '',
    link: r.link,
    extraido_em: new Date().toISOString()
  })).filter(r => r.snippet && r.snippet.length > 20);
}

// =============================================================================
// CRIAR ESTRUTURA DE CONHECIMENTO
// =============================================================================

function createKnowledgeStructure(allResults) {
  // Agrupar por categoria
  const byCategory = {};
  for (const result of allResults) {
    if (!byCategory[result.categoria]) {
      byCategory[result.categoria] = [];
    }
    byCategory[result.categoria].push(result);
  }
  
  return byCategory;
}

// =============================================================================
// GERAR BASE DE CONHECIMENTO ESOCIAL
// =============================================================================

function generateEsocialKnowledge(results) {
  // Estrutura padrão dos eventos eSocial
  const eventos = {
    'S-1000': { nome: 'Informações do Empregador', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
    'S-1005': { nome: 'Tabela de Estabelecimentos', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
    'S-1010': { nome: 'Tabela de Rubricas', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
    'S-1020': { nome: 'Tabela de Lotações Tributárias', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
    'S-1070': { nome: 'Tabela de Processos', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
    'S-1200': { nome: 'Remuneração do Trabalhador', tipo: 'PERIODICO', periodicidade: 'Mensal' },
    'S-1210': { nome: 'Pagamentos de Rendimentos', tipo: 'PERIODICO', periodicidade: 'Mensal' },
    'S-1260': { nome: 'Comercialização Produção Rural', tipo: 'PERIODICO', periodicidade: 'Mensal' },
    'S-1270': { nome: 'Contratação Avulsos', tipo: 'PERIODICO', periodicidade: 'Mensal' },
    'S-1280': { nome: 'Informações Complementares', tipo: 'PERIODICO', periodicidade: 'Mensal' },
    'S-1298': { nome: 'Reabertura Eventos Periódicos', tipo: 'PERIODICO', periodicidade: 'Eventual' },
    'S-1299': { nome: 'Fechamento Eventos Periódicos', tipo: 'PERIODICO', periodicidade: 'Mensal' },
    'S-2190': { nome: 'Registro Preliminar', tipo: 'NAO_PERIODICO', periodicidade: 'Eventual' },
    'S-2200': { nome: 'Admissão/Cadastramento', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2205': { nome: 'Alteração Cadastral', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2206': { nome: 'Alteração Contratual', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2210': { nome: 'CAT - Acidente de Trabalho', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2220': { nome: 'ASO - Monitoramento Saúde', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2230': { nome: 'Afastamento Temporário', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2240': { nome: 'Condições Ambientais - PPP', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2250': { nome: 'Aviso Prévio', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2298': { nome: 'Reintegração', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2299': { nome: 'Desligamento', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2300': { nome: 'TSVE - Início', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2306': { nome: 'TSVE - Alteração', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2399': { nome: 'TSVE - Término', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
    'S-2400': { nome: 'Benefício RPPS', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' }
  };
  
  // Tabela de incidências tributárias
  const incidencias = {
    '00': { descricao: 'Não é base de cálculo', fgts: false, inss: false, irrf: false },
    '11': { descricao: 'Base FGTS', fgts: true, inss: false, irrf: false },
    '12': { descricao: 'Base FGTS 13º', fgts: true, inss: false, irrf: false },
    '21': { descricao: 'Base Previdência', fgts: false, inss: true, irrf: false },
    '22': { descricao: 'Base Previdência 13º', fgts: false, inss: true, irrf: false },
    '31': { descricao: 'Base FGTS e Previdência', fgts: true, inss: true, irrf: false },
    '32': { descricao: 'Base FGTS e Previdência 13º', fgts: true, inss: true, irrf: false },
    '91': { descricao: 'Incidência suspensa FGTS', fgts: false, inss: false, irrf: false },
    '92': { descricao: 'Incidência suspensa Previdência', fgts: false, inss: false, irrf: false },
    '93': { descricao: 'Incidência suspensa FGTS e Previdência', fgts: false, inss: false, irrf: false }
  };
  
  // Tabela de categorias de trabalhador
  const categorias_trabalhador = {
    '101': 'Empregado - Geral',
    '102': 'Empregado - Trabalhador Rural por Pequeno Prazo',
    '103': 'Empregado - Aprendiz',
    '104': 'Empregado - Doméstico',
    '105': 'Empregado - Contrato a Termo (Lei 9.601/98)',
    '106': 'Trabalhador Temporário',
    '107': 'Empregado - Contrato Verde e Amarelo',
    '108': 'Empregado - Contrato Verde e Amarelo com Acordo',
    '111': 'Empregado - Contrato Intermitente',
    '201': 'Trabalhador Avulso Portuário',
    '202': 'Trabalhador Avulso Não Portuário',
    '301': 'Servidor Público - Titular de Cargo Efetivo',
    '302': 'Servidor Público - Exercente de Cargo em Comissão',
    '303': 'Agente Político',
    '305': 'Servidor Público - Contrato Temporário',
    '306': 'Servidor Público - Comissão sem Vínculo',
    '309': 'Agente Público - Outros',
    '401': 'Dirigente Sindical - com Vínculo',
    '410': 'Trabalhador Cedido',
    '501': 'Contribuinte Individual - Autônomo Geral',
    '701': 'Contribuinte Individual - Diretor não Empregado',
    '711': 'Contribuinte Individual - MEI',
    '721': 'Contribuinte Individual - Transportador Autônomo',
    '722': 'Contribuinte Individual - Transportador Cooperado',
    '723': 'Contribuinte Individual - Transportador Fretamento',
    '731': 'Contribuinte Individual - Cooperado Produção',
    '734': 'Contribuinte Individual - Cooperado Trabalho',
    '738': 'Contribuinte Individual - Cooperado Filiado',
    '741': 'Contribuinte Individual - Microempreendedor MEI',
    '751': 'Contribuinte Individual - Magistrado Classista',
    '761': 'Contribuinte Individual - Associado Cooperativa Eleição',
    '771': 'Contribuinte Individual - Membro Conselho Tutelar',
    '781': 'Ministro de Confissão Religiosa',
    '901': 'Estagiário',
    '902': 'Médico Residente',
    '903': 'Bolsista',
    '904': 'Participante Curso Formação',
    '905': 'Atleta não Profissional'
  };
  
  // Motivos de afastamento
  const motivos_afastamento = {
    '01': 'Acidente/Doença do Trabalho',
    '03': 'Acidente/Doença não relacionada ao trabalho',
    '05': 'Afastamento/Licença prevista em regulamento',
    '06': 'Aposentadoria por invalidez',
    '07': 'Acompanhamento - cônjuge/companheiro',
    '08': 'Afastamento do empregado para participar de atividade sindical',
    '10': 'Afastamento por redução de jornada',
    '11': 'Cárcere',
    '12': 'Cargo Eletivo',
    '13': 'Cargo Eletivo - afastamento parcial',
    '14': 'Cessão/Requisição',
    '15': 'Gozo de férias ou recesso',
    '16': 'Licença remunerada',
    '17': 'Licença Maternidade',
    '18': 'Licença Maternidade - antecipação parto',
    '19': 'Licença Maternidade - prorrogação',
    '20': 'Licença Maternidade - aborto não criminoso',
    '21': 'Licença Maternidade - adoção',
    '22': 'Licença não remunerada/sem vencimentos',
    '23': 'Mandato Sindical',
    '24': 'Mandato Eleitoral - sem remuneração',
    '25': 'Mulher Vítima de Violência Doméstica',
    '26': 'Participação em Programa Primeiro Emprego',
    '27': 'Qualificação',
    '28': 'Representante Sindical',
    '29': 'Serviço Militar Obrigatório',
    '30': 'Suspensão Disciplinar',
    '31': 'Servidor Público em Disponibilidade',
    '33': 'Licença Paternidade',
    '34': 'Inatividade do Trabalhador Avulso',
    '35': 'Licença para Tratamento de Saúde',
    '36': 'Licença por Motivo de Doença em Pessoa da Família',
    '37': 'Afastamento para exercício em outro órgão',
    '38': 'Afastamento para estudo/missão no exterior'
  };
  
  // Motivos de desligamento
  const motivos_desligamento = {
    '01': 'Rescisão com justa causa por iniciativa do empregador',
    '02': 'Rescisão sem justa causa por iniciativa do empregador',
    '03': 'Rescisão antecipada do contrato a termo por iniciativa do empregador',
    '04': 'Rescisão antecipada do contrato a termo por iniciativa do empregado',
    '05': 'Rescisão por culpa recíproca',
    '06': 'Rescisão por término do contrato a termo',
    '07': 'Rescisão do contrato de trabalho por iniciativa do empregado',
    '08': 'Rescisão do contrato de trabalho por iniciativa do empregado - MP 936',
    '09': 'Rescisão por falecimento do empregador individual',
    '10': 'Rescisão por falecimento do empregado',
    '11': 'Transferência de empregado para empresa do mesmo grupo',
    '12': 'Transferência de empregado entre empresas diferentes',
    '13': 'Desligamento por encerramento da empresa',
    '14': 'Mudança de CPF do empregado',
    '15': 'Rescisão por acordo entre as partes',
    '16': 'Transferência para empregador que assumiu os encargos',
    '17': 'Rescisão indireta do contrato de trabalho',
    '18': 'Aposentadoria compulsória',
    '19': 'Aposentadoria por invalidez',
    '20': 'Aposentadoria por idade ou tempo de contribuição',
    '21': 'Exoneração/Demissão servidor público',
    '22': 'Declaração de nulidade contrato trabalho',
    '23': 'Vacância cargo público',
    '24': 'Agente Público - cessação do mandato',
    '25': 'Transferência empregado doméstico',
    '26': 'Rescisão com justa causa por iniciativa do empregador doméstico',
    '27': 'Rescisão sem justa causa por iniciativa do empregador doméstico',
    '28': 'Pedido de demissão do empregado doméstico',
    '29': 'Término do contrato de experiência do doméstico',
    '30': 'Rescisão por culpa recíproca doméstico',
    '31': 'Rescisão com justa causa durante experiência doméstico',
    '32': 'Rescisão sem justa causa durante experiência empregador doméstico',
    '33': 'Rescisão antecipada a pedido do doméstico',
    '34': 'Rescisão por acordo entre as partes doméstico',
    '35': 'Rescisão com justa causa durante experiência empregado doméstico',
    '36': 'Extinção do contrato Verde e Amarelo',
    '37': 'Rescisão antecipada a pedido do empregador Verde Amarelo',
    '38': 'Rescisão antecipada a pedido do empregado Verde Amarelo',
    '39': 'Rescisão contrato Verde Amarelo por justa causa empregador',
    '40': 'Rescisão contrato Verde Amarelo por justa causa empregado',
    '41': 'Rescisão contrato Verde Amarelo acordo',
    '42': 'Rescisão contrato Verde Amarelo culpa recíproca',
    '43': 'Término TSVE sem pagamento',
    '44': 'Término TSVE com pagamento'
  };
  
  return {
    eventos,
    incidencias,
    categorias_trabalhador,
    motivos_afastamento,
    motivos_desligamento,
    snippets: results.filter(r => r.categoria === 'ESOCIAL')
  };
}

// =============================================================================
// GERAR BASE DE CONHECIMENTO NOTA FISCAL
// =============================================================================

function generateNotaFiscalKnowledge(results) {
  // CFOP principais
  const cfop = {
    // Entradas
    '1.102': { descricao: 'Compra para comercialização', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.403': { descricao: 'Compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.556': { descricao: 'Compra de bem para o ativo imobilizado', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.551': { descricao: 'Compra de bem para o ativo imobilizado', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.201': { descricao: 'Devolução de venda de produção do estabelecimento', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.202': { descricao: 'Devolução de venda de mercadoria adquirida ou recebida de terceiros', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.411': { descricao: 'Devolução de venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.910': { descricao: 'Entrada de bonificação, doação ou brinde', tipo: 'ENTRADA', uf: 'INTERNA' },
    '1.949': { descricao: 'Outra entrada de mercadoria ou prestação de serviço não especificada', tipo: 'ENTRADA', uf: 'INTERNA' },
    '2.102': { descricao: 'Compra para comercialização', tipo: 'ENTRADA', uf: 'INTERESTADUAL' },
    '2.403': { descricao: 'Compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária', tipo: 'ENTRADA', uf: 'INTERESTADUAL' },
    '3.102': { descricao: 'Compra para comercialização', tipo: 'ENTRADA', uf: 'EXTERIOR' },
    
    // Saídas
    '5.102': { descricao: 'Venda de mercadoria adquirida ou recebida de terceiros', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.405': { descricao: 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituído', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.101': { descricao: 'Venda de produção do estabelecimento', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.401': { descricao: 'Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária, na condição de contribuinte substituto', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.202': { descricao: 'Devolução de compra para comercialização', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.411': { descricao: 'Devolução de compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.910': { descricao: 'Remessa em bonificação, doação ou brinde', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.911': { descricao: 'Remessa de amostra grátis', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.912': { descricao: 'Remessa de mercadoria ou bem para demonstração', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.915': { descricao: 'Remessa de mercadoria ou bem para conserto ou reparo', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.916': { descricao: 'Retorno de mercadoria ou bem recebido para conserto ou reparo', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.933': { descricao: 'Prestação de serviço tributado pelo ISSQN', tipo: 'SAIDA', uf: 'INTERNA' },
    '5.949': { descricao: 'Outra saída de mercadoria ou prestação de serviço não especificado', tipo: 'SAIDA', uf: 'INTERNA' },
    '6.102': { descricao: 'Venda de mercadoria adquirida ou recebida de terceiros', tipo: 'SAIDA', uf: 'INTERESTADUAL' },
    '6.108': { descricao: 'Venda de mercadoria adquirida ou recebida de terceiros, destinada a não contribuinte', tipo: 'SAIDA', uf: 'INTERESTADUAL' },
    '7.102': { descricao: 'Venda de mercadoria adquirida ou recebida de terceiros', tipo: 'SAIDA', uf: 'EXTERIOR' }
  };
  
  // CST ICMS
  const cst_icms = {
    '00': { descricao: 'Tributada integralmente', regime: 'NORMAL' },
    '10': { descricao: 'Tributada e com cobrança do ICMS por substituição tributária', regime: 'NORMAL' },
    '20': { descricao: 'Com redução de base de cálculo', regime: 'NORMAL' },
    '30': { descricao: 'Isenta ou não tributada e com cobrança do ICMS por substituição tributária', regime: 'NORMAL' },
    '40': { descricao: 'Isenta', regime: 'NORMAL' },
    '41': { descricao: 'Não tributada', regime: 'NORMAL' },
    '50': { descricao: 'Suspensão', regime: 'NORMAL' },
    '51': { descricao: 'Diferimento', regime: 'NORMAL' },
    '60': { descricao: 'ICMS cobrado anteriormente por substituição tributária', regime: 'NORMAL' },
    '70': { descricao: 'Com redução de base de cálculo e cobrança do ICMS por substituição tributária', regime: 'NORMAL' },
    '90': { descricao: 'Outros', regime: 'NORMAL' }
  };
  
  // CSOSN Simples Nacional
  const csosn = {
    '101': { descricao: 'Tributada pelo Simples Nacional com permissão de crédito', regime: 'SIMPLES' },
    '102': { descricao: 'Tributada pelo Simples Nacional sem permissão de crédito', regime: 'SIMPLES' },
    '103': { descricao: 'Isenção do ICMS no Simples Nacional para faixa de receita bruta', regime: 'SIMPLES' },
    '201': { descricao: 'Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por substituição tributária', regime: 'SIMPLES' },
    '202': { descricao: 'Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por substituição tributária', regime: 'SIMPLES' },
    '203': { descricao: 'Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por substituição tributária', regime: 'SIMPLES' },
    '300': { descricao: 'Imune', regime: 'SIMPLES' },
    '400': { descricao: 'Não tributada pelo Simples Nacional', regime: 'SIMPLES' },
    '500': { descricao: 'ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação', regime: 'SIMPLES' },
    '900': { descricao: 'Outros', regime: 'SIMPLES' }
  };
  
  // CST PIS/COFINS
  const cst_pis_cofins = {
    '01': { descricao: 'Operação Tributável com Alíquota Básica', tipo: 'SAIDA' },
    '02': { descricao: 'Operação Tributável com Alíquota Diferenciada', tipo: 'SAIDA' },
    '03': { descricao: 'Operação Tributável com Alíquota por Unidade de Medida de Produto', tipo: 'SAIDA' },
    '04': { descricao: 'Operação Tributável Monofásica - Revenda a Alíquota Zero', tipo: 'SAIDA' },
    '05': { descricao: 'Operação Tributável por Substituição Tributária', tipo: 'SAIDA' },
    '06': { descricao: 'Operação Tributável a Alíquota Zero', tipo: 'SAIDA' },
    '07': { descricao: 'Operação Isenta da Contribuição', tipo: 'SAIDA' },
    '08': { descricao: 'Operação sem Incidência da Contribuição', tipo: 'SAIDA' },
    '09': { descricao: 'Operação com Suspensão da Contribuição', tipo: 'SAIDA' },
    '49': { descricao: 'Outras Operações de Saída', tipo: 'SAIDA' },
    '50': { descricao: 'Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno', tipo: 'ENTRADA' },
    '51': { descricao: 'Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Não Tributada no Mercado Interno', tipo: 'ENTRADA' },
    '52': { descricao: 'Operação com Direito a Crédito - Vinculada Exclusivamente a Receita de Exportação', tipo: 'ENTRADA' },
    '53': { descricao: 'Operação com Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno', tipo: 'ENTRADA' },
    '54': { descricao: 'Operação com Direito a Crédito - Vinculada a Receitas Tributadas no Mercado Interno e de Exportação', tipo: 'ENTRADA' },
    '55': { descricao: 'Operação com Direito a Crédito - Vinculada a Receitas Não-Tributadas no Mercado Interno e de Exportação', tipo: 'ENTRADA' },
    '56': { descricao: 'Operação com Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno, e de Exportação', tipo: 'ENTRADA' },
    '60': { descricao: 'Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno', tipo: 'ENTRADA' },
    '70': { descricao: 'Operação de Aquisição sem Direito a Crédito', tipo: 'ENTRADA' },
    '71': { descricao: 'Operação de Aquisição com Isenção', tipo: 'ENTRADA' },
    '72': { descricao: 'Operação de Aquisição com Suspensão', tipo: 'ENTRADA' },
    '73': { descricao: 'Operação de Aquisição a Alíquota Zero', tipo: 'ENTRADA' },
    '74': { descricao: 'Operação de Aquisição sem Incidência da Contribuição', tipo: 'ENTRADA' },
    '75': { descricao: 'Operação de Aquisição por Substituição Tributária', tipo: 'ENTRADA' },
    '98': { descricao: 'Outras Operações de Entrada', tipo: 'ENTRADA' },
    '99': { descricao: 'Outras Operações', tipo: 'AMBOS' }
  };
  
  // Lista de Serviços LC 116
  const servicos_lc116 = {
    '01': 'Serviços de informática e congêneres',
    '02': 'Serviços de pesquisas e desenvolvimento de qualquer natureza',
    '03': 'Serviços prestados mediante locação, cessão de direito de uso e congêneres',
    '04': 'Serviços de saúde, assistência médica e congêneres',
    '05': 'Serviços de medicina e assistência veterinária e congêneres',
    '06': 'Serviços de cuidados pessoais, estética, atividades físicas e congêneres',
    '07': 'Serviços relativos a engenharia, arquitetura, geologia, urbanismo, construção civil, manutenção, limpeza, meio ambiente, saneamento e congêneres',
    '08': 'Serviços de educação, ensino, orientação pedagógica e educacional, instrução, treinamento e avaliação pessoal de qualquer grau ou natureza',
    '09': 'Serviços relativos a hospedagem, turismo, viagens e congêneres',
    '10': 'Serviços de intermediação e congêneres',
    '11': 'Serviços de guarda, estacionamento, armazenamento, vigilância e congêneres',
    '12': 'Serviços de diversões, lazer, entretenimento e congêneres',
    '13': 'Serviços relativos a fonografia, fotografia, cinematografia e reprografia',
    '14': 'Serviços relativos a bens de terceiros',
    '15': 'Serviços relacionados ao setor bancário ou financeiro, inclusive aqueles prestados por instituições financeiras autorizadas a funcionar pela União ou por quem de direito',
    '16': 'Serviços de transporte de natureza municipal',
    '17': 'Serviços de apoio técnico, administrativo, jurídico, contábil, comercial e congêneres',
    '18': 'Serviços de regulação de sinistros vinculados a contratos de seguros; inspeção e avaliação de riscos para cobertura de contratos de seguros; prevenção e gerência de riscos seguráveis e congêneres',
    '19': 'Serviços de distribuição e venda de bilhetes e demais produtos de loteria, bingos, cartões, pules ou cupons de apostas, sorteios, prêmios, inclusive os decorrentes de títulos de capitalização e congêneres',
    '20': 'Serviços portuários, aeroportuários, ferroportuários, de terminais rodoviários, ferroviários e metroviários',
    '21': 'Serviços de registros públicos, cartorários e notariais',
    '22': 'Serviços de exploração de rodovia',
    '23': 'Serviços de programação e comunicação visual, desenho industrial e congêneres',
    '24': 'Serviços de chaveiros, confecção de carimbos, placas, sinalização visual, banners, adesivos e congêneres',
    '25': 'Serviços funerários',
    '26': 'Serviços de coleta, remessa ou entrega de correspondências, documentos, objetos, bens ou valores, inclusive pelos correios e suas agências franqueadas; courrier e congêneres',
    '27': 'Serviços de assistência social',
    '28': 'Serviços de avaliação de bens e serviços de qualquer natureza',
    '29': 'Serviços de biblioteconomia',
    '30': 'Serviços de biologia, biotecnologia e química',
    '31': 'Serviços técnicos em edificações, eletrônica, eletrotécnica, mecânica, telecomunicações e congêneres',
    '32': 'Serviços de desenhos técnicos',
    '33': 'Serviços de desembaraço aduaneiro, comissários, despachantes e congêneres',
    '34': 'Serviços de investigações particulares, detetives e congêneres',
    '35': 'Serviços de reportagem, assessoria de imprensa, jornalismo e relações públicas',
    '36': 'Serviços de meteorologia',
    '37': 'Serviços de artistas, atletas, modelos e manequins',
    '38': 'Serviços de museologia',
    '39': 'Serviços de ourivesaria e lapidação',
    '40': 'Serviços relativos a obras de arte sob encomenda'
  };
  
  return {
    cfop,
    cst_icms,
    csosn,
    cst_pis_cofins,
    servicos_lc116,
    snippets: results.filter(r => r.categoria === 'NOTA_FISCAL')
  };
}

// =============================================================================
// GERAR BASE DE CONHECIMENTO MBA
// =============================================================================

function generateMBAKnowledge(results) {
  // Fórmulas de indicadores
  const indicadores = {
    liquidez: {
      'Liquidez Corrente': {
        formula: 'Ativo Circulante / Passivo Circulante',
        interpretacao: '> 1 indica capacidade de pagar obrigações de curto prazo',
        ideal: '> 1,5'
      },
      'Liquidez Seca': {
        formula: '(Ativo Circulante - Estoques) / Passivo Circulante',
        interpretacao: 'Exclui estoques por serem menos líquidos',
        ideal: '> 1,0'
      },
      'Liquidez Imediata': {
        formula: 'Disponível / Passivo Circulante',
        interpretacao: 'Capacidade de pagamento imediato',
        ideal: '> 0,2'
      },
      'Liquidez Geral': {
        formula: '(AC + RLP) / (PC + PNC)',
        interpretacao: 'Capacidade de pagamento total',
        ideal: '> 1,0'
      },
      'Capital Circulante Líquido': {
        formula: 'Ativo Circulante - Passivo Circulante',
        interpretacao: 'Folga financeira de curto prazo',
        ideal: 'Positivo'
      }
    },
    rentabilidade: {
      'ROE (Return on Equity)': {
        formula: 'Lucro Líquido / Patrimônio Líquido',
        interpretacao: 'Retorno sobre capital próprio',
        ideal: '> 15%'
      },
      'ROA (Return on Assets)': {
        formula: 'Lucro Líquido / Ativo Total',
        interpretacao: 'Retorno sobre ativos totais',
        ideal: '> 5%'
      },
      'ROI (Return on Investment)': {
        formula: '(Ganho - Custo) / Custo',
        interpretacao: 'Retorno sobre investimento específico',
        ideal: '> 0'
      },
      'Margem Bruta': {
        formula: '(Receita - CMV) / Receita',
        interpretacao: 'Lucro bruto por real de venda',
        ideal: 'Varia por setor'
      },
      'Margem Operacional': {
        formula: 'Lucro Operacional / Receita',
        interpretacao: 'Eficiência operacional',
        ideal: '> 10%'
      },
      'Margem Líquida': {
        formula: 'Lucro Líquido / Receita',
        interpretacao: 'Lucro final por real de venda',
        ideal: '> 5%'
      },
      'EBITDA': {
        formula: 'Lucro Operacional + Depreciação + Amortização',
        interpretacao: 'Geração de caixa operacional',
        ideal: 'Positivo crescente'
      }
    },
    endividamento: {
      'Endividamento Geral': {
        formula: '(PC + PNC) / Ativo Total',
        interpretacao: 'Proporção de capital de terceiros',
        ideal: '< 60%'
      },
      'Composição Endividamento': {
        formula: 'Passivo Circulante / (PC + PNC)',
        interpretacao: 'Concentração no curto prazo',
        ideal: '< 50%'
      },
      'Grau Alavancagem Financeira': {
        formula: 'ROE / ROA',
        interpretacao: 'Efeito da dívida na rentabilidade',
        ideal: '> 1'
      },
      'Cobertura de Juros': {
        formula: 'EBITDA / Despesas Financeiras',
        interpretacao: 'Capacidade de pagar juros',
        ideal: '> 3x'
      }
    },
    atividade: {
      'PMR (Prazo Médio Recebimento)': {
        formula: '(Contas a Receber / Receita) x 360',
        interpretacao: 'Dias para receber vendas',
        ideal: '< 45 dias'
      },
      'PMP (Prazo Médio Pagamento)': {
        formula: '(Fornecedores / Compras) x 360',
        interpretacao: 'Dias para pagar fornecedores',
        ideal: '> PMR'
      },
      'PME (Prazo Médio Estocagem)': {
        formula: '(Estoque / CMV) x 360',
        interpretacao: 'Dias de estoque',
        ideal: '< 60 dias'
      },
      'Ciclo Operacional': {
        formula: 'PME + PMR',
        interpretacao: 'Ciclo completo de operação',
        ideal: 'Menor possível'
      },
      'Ciclo Financeiro': {
        formula: 'PME + PMR - PMP',
        interpretacao: 'Necessidade de capital de giro',
        ideal: '< 30 dias'
      },
      'Giro do Ativo': {
        formula: 'Receita / Ativo Total',
        interpretacao: 'Vendas geradas por ativo',
        ideal: '> 1x'
      }
    },
    valuation: {
      'EV/EBITDA': {
        formula: 'Enterprise Value / EBITDA',
        interpretacao: 'Múltiplo de valor da empresa',
        ideal: '< 10x'
      },
      'P/L': {
        formula: 'Preço por Ação / Lucro por Ação',
        interpretacao: 'Múltiplo de lucro',
        ideal: '< 15x'
      },
      'P/VPA': {
        formula: 'Preço por Ação / Valor Patrimonial por Ação',
        interpretacao: 'Múltiplo de patrimônio',
        ideal: '< 2x'
      },
      'WACC': {
        formula: 'Ke x (E/(D+E)) + Kd x (1-t) x (D/(D+E))',
        interpretacao: 'Custo médio ponderado de capital',
        ideal: 'Menor que ROA'
      }
    }
  };
  
  // Análise DuPont
  const dupont = {
    'DuPont 3 Fatores': {
      formula: 'ROE = Margem Líquida x Giro do Ativo x Multiplicador de Alavancagem',
      componentes: ['Lucro/Receita', 'Receita/Ativo', 'Ativo/PL'],
      interpretacao: 'Decomposição do ROE em eficiência operacional, uso de ativos e alavancagem'
    },
    'DuPont 5 Fatores': {
      formula: 'ROE = (EBIT/Receita) x (Receita/Ativo) x (Ativo/PL) x (EBT/EBIT) x (LL/EBT)',
      componentes: ['Margem Operacional', 'Giro do Ativo', 'Alavancagem', 'Efeito Juros', 'Efeito IR'],
      interpretacao: 'Análise detalhada dos drivers de rentabilidade'
    }
  };
  
  // Modelos de relatórios
  const relatorios = {
    'Dashboard Financeiro': {
      indicadores: ['Liquidez Corrente', 'ROE', 'Margem EBITDA', 'Ciclo Financeiro'],
      frequencia: 'Mensal',
      visualizacao: 'Gráficos de tendência + scorecards'
    },
    'Análise de Desempenho': {
      indicadores: ['Receita', 'Margem Bruta', 'EBITDA', 'Lucro Líquido'],
      frequencia: 'Mensal/Trimestral',
      visualizacao: 'Real vs Orçado vs Ano Anterior'
    },
    'Análise de Liquidez': {
      indicadores: ['Liquidez Corrente', 'Liquidez Seca', 'CCL', 'Ciclo Financeiro'],
      frequencia: 'Mensal',
      visualizacao: 'Evolução + alerta se abaixo do ideal'
    },
    'Análise de Rentabilidade': {
      indicadores: ['ROE', 'ROA', 'ROIC', 'Margens'],
      frequencia: 'Trimestral',
      visualizacao: 'Decomposição DuPont + benchmark setor'
    },
    'Fluxo de Caixa Projetado': {
      indicadores: ['Saldo inicial', 'Entradas', 'Saídas', 'Saldo final'],
      frequencia: 'Semanal/Mensal',
      visualizacao: 'Projeção 12 meses + cenários'
    }
  };
  
  return {
    indicadores,
    dupont,
    relatorios,
    snippets: results.filter(r => r.categoria === 'MBA')
  };
}

// =============================================================================
// GERAR LANÇAMENTOS CONTÁBEIS COMPLETOS
// =============================================================================

function generateLancamentosContabeis(results) {
  const lancamentos = {
    // Administrativo
    administrativo: [
      { nome: 'Material de Expediente', debito: '4.1.1.10', credito: '1.1.1.02', keywords: ['material', 'escritorio', 'expediente', 'papelaria'] },
      { nome: 'Manutenção e Reparos', debito: '4.1.1.15', credito: '1.1.1.02', keywords: ['manutencao', 'reparo', 'conserto'] },
      { nome: 'Serviços de Terceiros PJ', debito: '4.1.1.20', credito: '1.1.1.02', keywords: ['servico', 'terceiro', 'pj', 'prestador'] },
      { nome: 'Viagens e Hospedagem', debito: '4.1.1.25', credito: '1.1.1.02', keywords: ['viagem', 'hotel', 'hospedagem', 'passagem'] },
      { nome: 'Combustíveis', debito: '4.1.1.30', credito: '1.1.1.02', keywords: ['combustivel', 'gasolina', 'diesel', 'alcool'] },
      { nome: 'Correios e Malotes', debito: '4.1.1.35', credito: '1.1.1.02', keywords: ['correio', 'sedex', 'malote', 'frete'] },
      { nome: 'Software e Licenças', debito: '4.1.1.40', credito: '1.1.1.02', keywords: ['software', 'licenca', 'sistema', 'assinatura'] },
      { nome: 'Treinamento', debito: '4.1.1.45', credito: '1.1.1.02', keywords: ['treinamento', 'curso', 'capacitacao'] },
      { nome: 'Seguros', debito: '4.1.1.50', credito: '1.1.1.02', keywords: ['seguro', 'apolice'] },
      { nome: 'Despesas Cartórios', debito: '4.1.1.55', credito: '1.1.1.02', keywords: ['cartorio', 'registro', 'autenticacao'] },
      { nome: 'Publicidade e Propaganda', debito: '4.1.1.60', credito: '1.1.1.02', keywords: ['publicidade', 'propaganda', 'marketing'] },
      { nome: 'Brindes', debito: '4.1.1.65', credito: '1.1.1.02', keywords: ['brinde', 'presente', 'promocional'] },
      { nome: 'Limpeza e Conservação', debito: '4.1.1.70', credito: '1.1.1.02', keywords: ['limpeza', 'conservacao', 'zeladoria'] },
      { nome: 'Vigilância', debito: '4.1.1.75', credito: '1.1.1.02', keywords: ['vigilancia', 'seguranca', 'monitoramento'] },
      { nome: 'Honorários Profissionais', debito: '4.1.1.80', credito: '1.1.1.02', keywords: ['honorario', 'contador', 'advogado', 'consultor'] }
    ],
    
    // Fiscal
    fiscal: [
      { nome: 'ICMS a Recolher', debito: '4.3.1.01', credito: '2.1.2.01', keywords: ['icms', 'apuracao'] },
      { nome: 'ICMS ST', debito: '1.1.5.01', credito: '2.1.2.02', keywords: ['icms', 'st', 'substituicao'] },
      { nome: 'IPI a Recolher', debito: '4.3.1.02', credito: '2.1.2.03', keywords: ['ipi', 'apuracao'] },
      { nome: 'PIS/COFINS - Crédito', debito: '1.1.5.02', credito: '2.1.2.04', keywords: ['pis', 'cofins', 'credito'] },
      { nome: 'ISS a Recolher', debito: '4.3.1.03', credito: '2.1.2.05', keywords: ['iss', 'servico'] },
      { nome: 'IRPJ', debito: '4.3.2.01', credito: '2.1.2.06', keywords: ['irpj', 'imposto', 'renda'] },
      { nome: 'CSLL', debito: '4.3.2.02', credito: '2.1.2.07', keywords: ['csll', 'contribuicao', 'social'] },
      { nome: 'Simples Nacional', debito: '4.3.2.03', credito: '2.1.2.08', keywords: ['das', 'simples', 'nacional'] },
      { nome: 'DIFAL', debito: '4.3.1.04', credito: '2.1.2.09', keywords: ['difal', 'diferencial', 'aliquota'] },
      { nome: 'Parcelamento Tributos', debito: '2.1.2.10', credito: '1.1.1.02', keywords: ['parcelamento', 'refis', 'pert'] },
      { nome: 'Compensação Tributos', debito: '2.1.2.11', credito: '1.1.5.03', keywords: ['compensacao', 'perdcomp'] }
    ],
    
    // Trabalhista
    trabalhista: [
      { nome: 'Salários', debito: '4.1.2.01', credito: '2.1.1.01', keywords: ['salario', 'folha', 'remuneracao'] },
      { nome: 'FGTS', debito: '4.1.2.02', credito: '2.1.1.02', keywords: ['fgts', 'fundo', 'garantia'] },
      { nome: 'INSS Patronal', debito: '4.1.2.03', credito: '2.1.1.03', keywords: ['inss', 'patronal'] },
      { nome: 'Férias', debito: '4.1.2.04', credito: '2.1.1.04', keywords: ['ferias', 'provisao'] },
      { nome: '13º Salário', debito: '4.1.2.05', credito: '2.1.1.05', keywords: ['13', 'decimo', 'terceiro'] },
      { nome: 'Rescisão', debito: '4.1.2.06', credito: '2.1.1.06', keywords: ['rescisao', 'desligamento'] },
      { nome: 'Aviso Prévio', debito: '4.1.2.07', credito: '2.1.1.07', keywords: ['aviso', 'previo'] },
      { nome: 'IRRF sobre Salários', debito: '2.1.1.01', credito: '2.1.2.12', keywords: ['irrf', 'retido', 'salario'] },
      { nome: 'Vale Transporte', debito: '4.1.2.08', credito: '1.1.1.02', keywords: ['vale', 'transporte', 'vt'] },
      { nome: 'Vale Alimentação', debito: '4.1.2.09', credito: '1.1.1.02', keywords: ['vale', 'alimentacao', 'refeicao', 'va', 'vr'] },
      { nome: 'Plano de Saúde', debito: '4.1.2.10', credito: '1.1.1.02', keywords: ['plano', 'saude', 'unimed'] },
      { nome: 'Pensão Alimentícia', debito: '2.1.1.01', credito: '2.1.1.08', keywords: ['pensao', 'alimenticia'] },
      { nome: 'Contribuição Sindical', debito: '2.1.1.01', credito: '2.1.1.09', keywords: ['contribuicao', 'sindical', 'sindicato'] },
      { nome: 'PLR', debito: '4.1.2.11', credito: '2.1.1.10', keywords: ['plr', 'participacao', 'lucros'] },
      { nome: 'Adiantamento Salarial', debito: '1.1.3.01', credito: '1.1.1.02', keywords: ['adiantamento', 'salarial'] },
      { nome: 'Horas Extras', debito: '4.1.2.12', credito: '2.1.1.01', keywords: ['hora', 'extra', 'adicional'] }
    ],
    
    // Jurídico
    juridico: [
      { nome: 'Provisão Contingência Trabalhista', debito: '4.1.5.01', credito: '2.2.1.01', keywords: ['contingencia', 'trabalhista', 'provisao'] },
      { nome: 'Provisão Contingência Tributária', debito: '4.1.5.02', credito: '2.2.1.02', keywords: ['contingencia', 'tributaria', 'fiscal'] },
      { nome: 'Provisão Contingência Cível', debito: '4.1.5.03', credito: '2.2.1.03', keywords: ['contingencia', 'civel', 'judicial'] },
      { nome: 'Depósito Judicial', debito: '1.2.4.01', credito: '1.1.1.02', keywords: ['deposito', 'judicial', 'recursal'] },
      { nome: 'Honorários Sucumbência', debito: '4.1.1.85', credito: '1.1.1.02', keywords: ['honorario', 'sucumbencia', 'advogado'] },
      { nome: 'Multas e Penalidades', debito: '4.1.5.04', credito: '1.1.1.02', keywords: ['multa', 'penalidade', 'infracao'] },
      { nome: 'Acordos Judiciais', debito: '2.2.1.04', credito: '1.1.1.02', keywords: ['acordo', 'judicial', 'homologacao'] },
      { nome: 'Reversão Provisão', debito: '2.2.1.01', credito: '3.2.3.01', keywords: ['reversao', 'provisao'] },
      { nome: 'Atualização Depósitos', debito: '1.2.4.01', credito: '3.2.1.01', keywords: ['atualizacao', 'deposito', 'judicial'] }
    ],
    
    // Financeiro
    financeiro: [
      { nome: 'Empréstimo Bancário', debito: '1.1.1.02', credito: '2.1.3.01', keywords: ['emprestimo', 'contratacao', 'banco'] },
      { nome: 'Juros Empréstimo', debito: '4.2.1.01', credito: '2.1.3.02', keywords: ['juros', 'emprestimo', 'financeiro'] },
      { nome: 'Amortização Empréstimo', debito: '2.1.3.01', credito: '1.1.1.02', keywords: ['amortizacao', 'parcela', 'emprestimo'] },
      { nome: 'Leasing/Financiamento', debito: '1.2.3.01', credito: '2.2.2.01', keywords: ['leasing', 'financiamento', 'arrendamento'] },
      { nome: 'Aplicação Financeira', debito: '1.1.1.10', credito: '1.1.1.02', keywords: ['aplicacao', 'cdb', 'poupanca', 'investimento'] },
      { nome: 'Rendimento Aplicação', debito: '1.1.1.10', credito: '3.2.1.01', keywords: ['rendimento', 'juros', 'aplicacao'] },
      { nome: 'IOF', debito: '4.2.1.02', credito: '1.1.1.02', keywords: ['iof', 'imposto', 'operacao'] },
      { nome: 'Variação Cambial Ativa', debito: '1.1.5.04', credito: '3.2.1.02', keywords: ['variacao', 'cambial', 'ativa'] },
      { nome: 'Variação Cambial Passiva', debito: '4.2.1.03', credito: '2.1.3.03', keywords: ['variacao', 'cambial', 'passiva'] },
      { nome: 'Juros Mora Recebidos', debito: '1.1.1.02', credito: '3.2.1.03', keywords: ['juros', 'mora', 'recebido', 'multa'] },
      { nome: 'Juros Mora Pagos', debito: '4.2.1.04', credito: '1.1.1.02', keywords: ['juros', 'mora', 'atraso', 'pago'] },
      { nome: 'Desconto Obtido', debito: '2.1.3.04', credito: '3.2.1.04', keywords: ['desconto', 'obtido', 'abatimento'] },
      { nome: 'Desconto Concedido', debito: '4.2.1.05', credito: '1.1.2.01', keywords: ['desconto', 'concedido'] },
      { nome: 'Antecipação Recebíveis', debito: '1.1.1.02', credito: '2.1.5.01', keywords: ['antecipacao', 'recebiveis', 'factoring'] },
      { nome: 'Duplicatas Descontadas', debito: '1.1.1.02', credito: '2.1.5.02', keywords: ['duplicata', 'descontada'] },
      { nome: 'Taxa Cartão Crédito', debito: '4.2.1.06', credito: '1.1.2.02', keywords: ['cartao', 'credito', 'taxa', 'maquininha'] },
      { nome: 'Adiantamento Cliente', debito: '1.1.1.02', credito: '2.1.4.01', keywords: ['adiantamento', 'cliente', 'sinal'] },
      { nome: 'Adiantamento Fornecedor', debito: '1.1.3.02', credito: '1.1.1.02', keywords: ['adiantamento', 'fornecedor'] },
      { nome: 'AVP Ativo', debito: '1.1.2.01', credito: '1.1.2.99', keywords: ['avp', 'ajuste', 'valor', 'presente'] },
      { nome: 'AVP Passivo', debito: '2.1.3.99', credito: '2.1.3.05', keywords: ['avp', 'ajuste', 'valor', 'presente', 'passivo'] }
    ]
  };
  
  return {
    lancamentos,
    snippets: results.filter(r => 
      ['ADMINISTRATIVO', 'FISCAL', 'TRABALHISTA', 'JURIDICO', 'FINANCEIRO'].includes(r.categoria)
    )
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const allResults = [];
  
  const queryGroups = [
    { name: 'eSocial', queries: QUERIES_ESOCIAL, categoria: 'ESOCIAL' },
    { name: 'Nota Fiscal', queries: QUERIES_NOTA_FISCAL, categoria: 'NOTA_FISCAL' },
    { name: 'Administrativo', queries: QUERIES_LANCAMENTOS_ADMINISTRATIVO, categoria: 'ADMINISTRATIVO' },
    { name: 'Fiscal', queries: QUERIES_LANCAMENTOS_FISCAL, categoria: 'FISCAL' },
    { name: 'Trabalhista', queries: QUERIES_LANCAMENTOS_TRABALHISTA, categoria: 'TRABALHISTA' },
    { name: 'Jurídico', queries: QUERIES_LANCAMENTOS_JURIDICO, categoria: 'JURIDICO' },
    { name: 'Financeiro', queries: QUERIES_LANCAMENTOS_FINANCEIRO, categoria: 'FINANCEIRO' },
    { name: 'MBA/Indicadores', queries: QUERIES_INDICADORES_MBA, categoria: 'MBA' },
    { name: 'Relatórios', queries: QUERIES_RELATORIOS, categoria: 'RELATORIOS' }
  ];
  
  let totalQueries = queryGroups.reduce((sum, g) => sum + g.queries.length, 0);
  let processedQueries = 0;
  
  console.log(`\n📚 Total de queries: ${totalQueries}\n`);
  
  for (const group of queryGroups) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📁 ${group.name.toUpperCase()} (${group.queries.length} queries)`);
    console.log('='.repeat(80));
    
    for (let i = 0; i < group.queries.length; i++) {
      const query = group.queries[i];
      processedQueries++;
      const shortQuery = query.length > 50 ? query.substring(0, 50) + '...' : query;
      console.log(`[${processedQueries}/${totalQueries}] 🔍 "${shortQuery}"`);
      
      const results = await searchSerper(query);
      const processed = processResults(results, group.categoria, query);
      allResults.push(...processed);
      
      console.log(`  ✓ ${results.length} resultados, ${processed.length} relevantes`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 Total de resultados: ${allResults.length}`);
  
  // Gerar bases de conhecimento específicas
  console.log('\n🔄 Gerando bases de conhecimento...\n');
  
  const esocialKnowledge = generateEsocialKnowledge(allResults);
  const notaFiscalKnowledge = generateNotaFiscalKnowledge(allResults);
  const mbaKnowledge = generateMBAKnowledge(allResults);
  const lancamentosKnowledge = generateLancamentosContabeis(allResults);
  
  // Salvar arquivos
  const outputDir = './mcp-financeiro/src/knowledge';
  
  // 1. eSocial
  fs.writeFileSync(
    `${outputDir}/esocial-knowledge.json`,
    JSON.stringify({
      versao: '1.0.0',
      gerado_em: new Date().toISOString(),
      autor: 'Dr. Cícero - Treinamento Completo',
      ...esocialKnowledge
    }, null, 2),
    'utf-8'
  );
  console.log('  ✅ esocial-knowledge.json');
  
  // 2. Nota Fiscal
  fs.writeFileSync(
    `${outputDir}/nota-fiscal-knowledge.json`,
    JSON.stringify({
      versao: '1.0.0',
      gerado_em: new Date().toISOString(),
      autor: 'Dr. Cícero - Treinamento Completo',
      ...notaFiscalKnowledge
    }, null, 2),
    'utf-8'
  );
  console.log('  ✅ nota-fiscal-knowledge.json');
  
  // 3. MBA/Indicadores
  fs.writeFileSync(
    `${outputDir}/mba-indicadores-knowledge.json`,
    JSON.stringify({
      versao: '1.0.0',
      gerado_em: new Date().toISOString(),
      autor: 'Agente MBA - Base de Conhecimento',
      ...mbaKnowledge
    }, null, 2),
    'utf-8'
  );
  console.log('  ✅ mba-indicadores-knowledge.json');
  
  // 4. Lançamentos Contábeis
  fs.writeFileSync(
    `${outputDir}/lancamentos-contabeis-completo.json`,
    JSON.stringify({
      versao: '1.0.0',
      gerado_em: new Date().toISOString(),
      autor: 'Dr. Cícero - Base de Lançamentos',
      ...lancamentosKnowledge
    }, null, 2),
    'utf-8'
  );
  console.log('  ✅ lancamentos-contabeis-completo.json');
  
  // 5. Base consolidada
  const consolidada = {
    versao: '1.0.0',
    gerado_em: new Date().toISOString(),
    autor: 'Sistema Contta - Treinamento Completo',
    estatisticas: {
      total_queries: totalQueries,
      total_resultados: allResults.length,
      categorias: queryGroups.map(g => g.categoria)
    },
    agentes: {
      'dr_cicero': {
        descricao: 'Contador responsável - classificação contábil',
        conhecimento: ['esocial', 'lancamentos', 'nota_fiscal']
      },
      'agente_mba': {
        descricao: 'Analista financeiro - indicadores e relatórios',
        conhecimento: ['mba', 'relatorios']
      },
      'agente_fiscal': {
        descricao: 'Especialista fiscal - CFOP, CST, impostos',
        conhecimento: ['nota_fiscal', 'fiscal']
      },
      'agente_trabalhista': {
        descricao: 'Especialista DP - eSocial, folha',
        conhecimento: ['esocial', 'trabalhista']
      }
    },
    todos_resultados: allResults
  };
  
  fs.writeFileSync(
    `${outputDir}/knowledge-base-completa.json`,
    JSON.stringify(consolidada, null, 2),
    'utf-8'
  );
  console.log('  ✅ knowledge-base-completa.json');
  
  // Resumo final
  console.log('\n' + '='.repeat(80));
  console.log('🎓 TREINAMENTO COMPLETO CONCLUÍDO!');
  console.log('='.repeat(80));
  
  console.log('\n📁 Bases de conhecimento geradas:');
  console.log('  • esocial-knowledge.json - Eventos eSocial, tabelas, códigos');
  console.log('  • nota-fiscal-knowledge.json - CFOP, CST, NCM, LC 116');
  console.log('  • mba-indicadores-knowledge.json - Indicadores financeiros, DuPont');
  console.log('  • lancamentos-contabeis-completo.json - Lançamentos por área');
  console.log('  • knowledge-base-completa.json - Base consolidada');
  
  console.log('\n🤖 Agentes treinados:');
  console.log('  • Dr. Cícero (Contador) - eSocial, Lançamentos, NF');
  console.log('  • Agente MBA (Analista) - Indicadores, Relatórios');
  console.log('  • Agente Fiscal - CFOP, CST, Impostos');
  console.log('  • Agente Trabalhista - eSocial, Folha, DP');
  
  console.log(`\n✨ Total: ${totalQueries} queries processadas, ${allResults.length} resultados extraídos!`);
}

main().catch(console.error);
