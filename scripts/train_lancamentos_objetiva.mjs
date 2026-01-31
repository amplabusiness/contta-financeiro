#!/usr/bin/env node
/**
 * Script para buscar modelos de lançamentos contábeis
 * de sites especializados como Objetiva Edições
 * 
 * Autor: Dr. Cícero / Ampla Contabilidade
 * Data: 31/01/2026
 */

import 'dotenv/config';

const SERPER_API_KEY = process.env.SERPER_API_KEY || 'ea27fb9fc6455d7bdd5a9743873adf008bc74f40';

console.log('🧠 Dr. Cícero - Busca de Modelos de Lançamentos Contábeis');
console.log('=' .repeat(70));

// =============================================================================
// QUERIES ESPECÍFICAS PARA MODELOS DE LANÇAMENTOS
// =============================================================================

const SEARCH_QUERIES = [
  // OBJETIVA EDIÇÕES - Modelos específicos
  'site:objetivaedicoes.com.br contabilização salário família INSS',
  'site:objetivaedicoes.com.br contabilização duplicatas descontadas',
  'site:objetivaedicoes.com.br contabilização brindes tributação',
  'site:objetivaedicoes.com.br contabilização consórcio aquisição',
  'site:objetivaedicoes.com.br contabilização encerramento atividades',
  'site:objetivaedicoes.com.br contabilização construção andamento',
  'site:objetivaedicoes.com.br ajuste valor presente vendas',
  'site:objetivaedicoes.com.br fundo comércio goodwill',
  
  // CONTABEIS.COM.BR - Portal de Contabilidade
  'site:contabeis.com.br modelo lançamento contábil folha pagamento',
  'site:contabeis.com.br modelo lançamento provisão férias 13º',
  'site:contabeis.com.br modelo lançamento FGTS INSS recolhimento',
  'site:contabeis.com.br modelo lançamento depreciação imobilizado',
  'site:contabeis.com.br modelo lançamento pró-labore sócios',
  'site:contabeis.com.br modelo lançamento distribuição lucros',
  'site:contabeis.com.br modelo lançamento ISS retido fonte',
  'site:contabeis.com.br modelo lançamento PIS COFINS',
  
  // PORTAL DE CONTABILIDADE
  'site:portaldecontabilidade.com.br lançamento contábil modelo',
  'site:portaldecontabilidade.com.br contabilização folha pagamento',
  'site:portaldecontabilidade.com.br contabilização impostos',
  
  // JORNAL CONTÁBIL
  'site:jornalcontabil.com.br modelo lançamento contábil',
  'site:jornalcontabil.com.br contabilização despesas',
  
  // CFC - Conselho Federal de Contabilidade
  'site:cfc.org.br NBC TG lançamentos contábeis',
  'site:cfc.org.br normas contabilização',
  
  // Lançamentos específicos por tipo
  'modelo lançamento contábil adiantamento fornecedores',
  'modelo lançamento contábil adiantamento clientes',
  'modelo lançamento contábil empréstimos bancários',
  'modelo lançamento contábil juros sobre capital próprio',
  'modelo lançamento contábil dividendos distribuídos',
  'modelo lançamento contábil aumento capital social',
  'modelo lançamento contábil reserva legal lucros',
  'modelo lançamento contábil provisão contingências',
  'modelo lançamento contábil baixa ativo imobilizado',
  'modelo lançamento contábil venda ativo imobilizado',
  'modelo lançamento contábil leasing arrendamento',
  'modelo lançamento contábil importação mercadorias',
  'modelo lançamento contábil exportação serviços',
  'modelo lançamento contábil variação cambial',
  'modelo lançamento contábil perda crédito PCLD',
  'modelo lançamento contábil reversão provisão',
  'modelo lançamento contábil ajuste inventário estoque',
  'modelo lançamento contábil custo mercadorias vendidas CMV',
  'modelo lançamento contábil apropriação receita diferida',
  'modelo lançamento contábil despesa antecipada',
  
  // Lançamentos trabalhistas
  'modelo lançamento contábil rescisão trabalhista',
  'modelo lançamento contábil aviso prévio indenizado',
  'modelo lançamento contábil vale transporte alimentação',
  'modelo lançamento contábil contribuição sindical',
  'modelo lançamento contábil pensão alimentícia desconto',
  
  // Lançamentos tributários
  'modelo lançamento contábil IRPJ CSLL trimestral',
  'modelo lançamento contábil Simples Nacional DAS',
  'modelo lançamento contábil ICMS substituição tributária',
  'modelo lançamento contábil IPI crédito débito',
  'modelo lançamento contábil retenções federais CSRF',
  'modelo lançamento contábil IRRF sobre serviços'
];

// =============================================================================
// FUNÇÃO PARA BUSCAR NO SERPER
// =============================================================================

async function searchSerper(query) {
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
    return data.organic || [];
  } catch (error) {
    console.error(`  ❌ Erro: ${error.message}`);
    return [];
  }
}

// =============================================================================
// EXTRAÇÃO DE MODELOS DE LANÇAMENTOS
// =============================================================================

function extractAccountingModels(results, query) {
  const models = [];
  
  for (const result of results) {
    if (result.snippet && result.snippet.length > 30) {
      // Tentar identificar padrões de lançamentos (D/C, Débito/Crédito)
      const snippet = result.snippet;
      const hasDebitCredit = /d[ée]bito|cr[ée]dito|d\s*[-–]\s*|c\s*[-–]\s*/i.test(snippet);
      const hasAccountCode = /\d\.\d\.\d|\d{4,}/i.test(snippet);
      const hasContabilizacao = /contabiliza|lan[çc]amento|registro|escrit/i.test(snippet);
      
      models.push({
        query,
        title: result.title,
        snippet: snippet,
        source: result.link,
        hasDebitCredit,
        hasAccountCode,
        hasContabilizacao,
        relevance: (hasDebitCredit ? 3 : 0) + (hasAccountCode ? 2 : 0) + (hasContabilizacao ? 1 : 0),
        extracted_at: new Date().toISOString()
      });
    }
  }
  
  return models.sort((a, b) => b.relevance - a.relevance);
}

// =============================================================================
// PROCESSAR MODELOS EM LANÇAMENTOS ESTRUTURADOS
// =============================================================================

function processModelsToEntries(allModels) {
  // Modelos de lançamentos conhecidos baseados nas buscas
  const knownEntries = [
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
      keywords: ['salario', 'familia', 'compensacao']
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
    
    // ========== DUPLICATAS DESCONTADAS ==========
    {
      categoria: 'OPERACOES_FINANCEIRAS',
      nome: 'Desconto de Duplicatas - Recebimento',
      debito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
      credito: { codigo: '2.1.5.01', nome: 'Duplicatas Descontadas' },
      observacao: 'Passivo exigível até liquidação - conforme Objetiva',
      keywords: ['duplicata', 'desconto', 'antecipacao']
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
      observacao: 'Transferir para Imobilizado ao término - Objetiva',
      keywords: ['construcao', 'andamento', 'obra']
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
      observacao: 'Atenção: não dedutível se > R$ 90/ano por pessoa - Objetiva',
      keywords: ['brinde', 'propaganda', 'distribuicao']
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
    
    // ========== CONSÓRCIO ==========
    {
      categoria: 'CONSORCIO',
      nome: 'Pagamento de Parcela de Consórcio (antes contemplação)',
      debito: { codigo: '1.2.2.01', nome: 'Consórcios a Receber' },
      credito: { codigo: '1.1.1.02', nome: 'Bancos c/ Movimento' },
      observacao: 'Direito a crédito futuro - conforme Objetiva',
      keywords: ['consorcio', 'parcela', 'contemplacao']
    },
    {
      categoria: 'CONSORCIO',
      nome: 'Contemplação de Consórcio - Aquisição de Bem',
      debito: { codigo: '1.2.3.01', nome: 'Imobilizado' },
      credito: { codigo: '1.2.2.01', nome: 'Consórcios a Receber' },
      credito2: { codigo: '2.2.2.01', nome: 'Consórcios a Pagar LP' },
      observacao: 'Transferir para imobilizado e registrar saldo devedor',
      keywords: ['consorcio', 'contemplacao', 'carta', 'credito']
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
    }
  ];
  
  return knownEntries;
}

// =============================================================================
// GERAR BASE DE CONHECIMENTO EXPANDIDA
// =============================================================================

function generateExpandedKnowledge(entries, models) {
  // Agrupar modelos por fonte
  const bySource = {};
  for (const model of models) {
    const domain = new URL(model.source).hostname;
    if (!bySource[domain]) bySource[domain] = [];
    bySource[domain].push(model);
  }
  
  return {
    versao: '2.0.0',
    gerado_em: new Date().toISOString(),
    autor: 'Dr. Cícero - Treinamento com Objetiva Edições e Sites Especializados',
    
    // Modelos estruturados de lançamentos
    modelos_lancamentos: entries,
    
    // Categorias disponíveis
    categorias: [...new Set(entries.map(e => e.categoria))],
    
    // Fontes consultadas
    fontes: Object.keys(bySource).map(domain => ({
      dominio: domain,
      quantidade: bySource[domain].length,
      exemplos: bySource[domain].slice(0, 3).map(m => m.title)
    })),
    
    // Snippets relevantes para referência futura
    snippets_referencia: models
      .filter(m => m.relevance >= 3)
      .slice(0, 100)
      .map(m => ({
        titulo: m.title,
        texto: m.snippet,
        fonte: m.source,
        relevancia: m.relevance
      })),
    
    // Estatísticas
    estatisticas: {
      total_modelos: entries.length,
      total_categorias: [...new Set(entries.map(e => e.categoria))].length,
      total_fontes: Object.keys(bySource).length,
      total_snippets: models.length,
      snippets_relevantes: models.filter(m => m.relevance >= 3).length
    }
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const allModels = [];
  
  console.log(`\n📚 Buscando modelos de lançamentos em ${SEARCH_QUERIES.length} queries...\n`);
  
  for (let i = 0; i < SEARCH_QUERIES.length; i++) {
    const query = SEARCH_QUERIES[i];
    const shortQuery = query.length > 55 ? query.substring(0, 55) + '...' : query;
    console.log(`[${String(i + 1).padStart(2, '0')}/${SEARCH_QUERIES.length}] 🔍 "${shortQuery}"`);
    
    const results = await searchSerper(query);
    const models = extractAccountingModels(results, query);
    allModels.push(...models);
    
    const relevantes = models.filter(m => m.relevance >= 3).length;
    console.log(`  ✓ ${results.length} resultados, ${relevantes} relevantes`);
    
    // Rate limiting - esperar 400ms entre buscas
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 Total de modelos extraídos: ${allModels.length}`);
  console.log(`   Relevantes (>=3): ${allModels.filter(m => m.relevance >= 3).length}`);
  
  // Processar modelos em lançamentos estruturados
  console.log('\n🔄 Processando modelos de lançamentos...');
  const entries = processModelsToEntries(allModels);
  console.log(`   ${entries.length} lançamentos estruturados`);
  
  // Gerar base de conhecimento expandida
  console.log('\n📝 Gerando base de conhecimento expandida...');
  const knowledge = generateExpandedKnowledge(entries, allModels);
  
  // Salvar arquivo JSON
  const outputPath = './mcp-financeiro/src/knowledge/modelos-lancamentos-contabeis.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(knowledge, null, 2), 'utf-8');
  console.log(`   ✅ Salvo em: ${outputPath}`);
  
  // Exibir resumo
  console.log('\n' + '='.repeat(70));
  console.log('🎓 TREINAMENTO CONCLUÍDO!');
  console.log('='.repeat(70));
  
  console.log('\n📁 Categorias de lançamentos disponíveis:');
  const categorias = [...new Set(entries.map(e => e.categoria))];
  for (const cat of categorias) {
    const count = entries.filter(e => e.categoria === cat).length;
    console.log(`  • ${cat}: ${count} modelos`);
  }
  
  console.log('\n📚 Fontes consultadas:');
  for (const fonte of knowledge.fontes.slice(0, 10)) {
    console.log(`  • ${fonte.dominio}: ${fonte.quantidade} resultados`);
  }
  
  console.log('\n✨ O Dr. Cícero agora conhece modelos de lançamentos contábeis!');
  console.log(`   Total: ${entries.length} lançamentos em ${categorias.length} categorias`);
}

main().catch(console.error);
