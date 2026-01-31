#!/usr/bin/env node
/**
 * Script para treinar o Dr. Cícero com lançamentos contábeis
 * Usa Serper.dev para buscar exemplos e enriquecer a base de conhecimento
 * 
 * Autor: Dr. Cícero / Ampla Contabilidade
 * Data: 31/01/2026
 */

import 'dotenv/config';

const SERPER_API_KEY = process.env.SERPER_API_KEY || 'ea27fb9fc6455d7bdd5a9743873adf008bc74f40';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SERPER_API_KEY) {
  console.error('❌ SERPER_API_KEY não configurada!');
  process.exit(1);
}

console.log('🧠 Dr. Cícero - Treinamento de Base de Conhecimento');
console.log('=' .repeat(60));

// =============================================================================
// QUERIES DE BUSCA PARA LANÇAMENTOS CONTÁBEIS
// =============================================================================

const SEARCH_QUERIES = [
  // EXTRATOS BANCÁRIOS - NOMES E SIGLAS
  'significado siglas extrato bancário TED DOC PIX TBI',
  'o que significa SISPAG extrato bancário',
  'COMPE significado extrato bancário compensação',
  'tarifa bancária tipos TAR TXB IOF extrato',
  'CET CETIP extrato bancário significado',
  'PAG PIX extrato bancário identificação',
  'REC TRF extrato significado recebimento transferência',
  'DEB AUT débito automático extrato bancário',
  'PAGTO PGTO significado extrato banco',
  'COB cobrança bancária extrato significado',
  
  // MANUAIS DE LANÇAMENTOS CONTÁBEIS
  'manual completo lançamentos contábeis PDF',
  'apostila lançamentos contábeis partidas dobradas exemplos',
  'guia prático classificação contábil despesas receitas',
  'plano de contas comentado lançamentos exemplos',
  'livro lançamentos contábeis básico avançado',
  
  // Lançamentos básicos
  'lançamento contábil pagamento fornecedor partidas dobradas',
  'lançamento contábil recebimento cliente exemplo',
  'lançamento contábil folha de pagamento FGTS INSS',
  'lançamento contábil depreciação ativo imobilizado',
  'lançamento contábil provisão férias 13º salário',
  
  // Impostos
  'lançamento contábil ISS retido na fonte',
  'lançamento contábil PIS COFINS lucro presumido',
  'lançamento contábil IRPJ CSLL trimestral',
  'lançamento contábil simples nacional DAS',
  
  // Operações específicas
  'lançamento contábil adiantamento sócios pró-labore',
  'lançamento contábil despesas bancárias tarifas',
  'lançamento contábil transferência entre contas bancárias',
  'lançamento contábil aplicação financeira rendimentos',
  
  // NBC e normas
  'NBC TG lançamentos contábeis obrigatórios',
  'plano de contas escritório contabilidade modelo',
  'regime competência caixa lançamentos contábeis',
  
  // Conciliação
  'conciliação bancária lançamentos contábeis ajustes',
  'lançamento contábil estorno correção erro',
  
  // SIGLAS ESPECÍFICAS DE EXTRATOS
  'LIQUIDACAO extrato bancário significado',
  'CRED AUTOMATICO extrato o que significa',
  'DB PGTO FATURA extrato significado',
  'CANC cancelamento extrato bancário',
  'ESTORNO EST extrato significado',
  'REND POUP rendimento poupança extrato',
  'APL aplicação extrato bancário',
  'RESG resgate extrato bancário'
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
// EXTRAÇÃO DE CONHECIMENTO
// =============================================================================

function extractKnowledge(results, query) {
  const knowledge = [];
  
  for (const result of results) {
    // Filtrar apenas fontes confiáveis
    const trustedDomains = [
      'contabeis.com.br',
      'jornalcontabil.com.br',
      'portaldecontabilidade.com.br',
      'cfc.org.br',
      'gov.br',
      'sebrae.com.br',
      'crcsp.org.br',
      'iob.com.br',
      'sage.com',
      'totvs.com'
    ];
    
    const isTrusted = trustedDomains.some(domain => result.link?.includes(domain));
    
    if (result.snippet && result.snippet.length > 50) {
      knowledge.push({
        query,
        title: result.title,
        snippet: result.snippet,
        source: result.link,
        trusted: isTrusted,
        extracted_at: new Date().toISOString()
      });
    }
  }
  
  return knowledge;
}

// =============================================================================
// PROCESSAMENTO DE LANÇAMENTOS
// =============================================================================

// DICIONÁRIO DE SIGLAS DE EXTRATOS BANCÁRIOS
const SIGLAS_EXTRATO = {
  // Transferências
  'TED': { significado: 'Transferência Eletrônica Disponível', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'DOC': { significado: 'Documento de Ordem de Crédito', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'PIX': { significado: 'Pagamento Instantâneo', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'TRF': { significado: 'Transferência', tipo: 'transferencia', classificacao: 'verificar_destino' },
  'TRANSF': { significado: 'Transferência', tipo: 'transferencia', classificacao: 'verificar_destino' },
  
  // Pagamentos
  'PAG': { significado: 'Pagamento', tipo: 'pagamento', classificacao: 'fornecedores' },
  'PGTO': { significado: 'Pagamento', tipo: 'pagamento', classificacao: 'fornecedores' },
  'PAGTO': { significado: 'Pagamento', tipo: 'pagamento', classificacao: 'fornecedores' },
  'SISPAG': { significado: 'Sistema de Pagamentos', tipo: 'pagamento', classificacao: 'fornecedores' },
  'GPAG': { significado: 'Guia de Pagamento', tipo: 'pagamento', classificacao: 'impostos' },
  
  // Recebimentos
  'REC': { significado: 'Recebimento', tipo: 'recebimento', classificacao: 'clientes' },
  'CRED': { significado: 'Crédito', tipo: 'recebimento', classificacao: 'verificar_origem' },
  'DEP': { significado: 'Depósito', tipo: 'recebimento', classificacao: 'verificar_origem' },
  'DEPOSITO': { significado: 'Depósito', tipo: 'recebimento', classificacao: 'verificar_origem' },
  
  // Tarifas e Taxas
  'TAR': { significado: 'Tarifa', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01' },
  'TXB': { significado: 'Taxa Bancária', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01' },
  'IOF': { significado: 'Imposto sobre Operações Financeiras', tipo: 'imposto', classificacao: 'despesas_bancarias', conta: '4.1.3.01' },
  'ANUIDADE': { significado: 'Anuidade de Cartão/Conta', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01' },
  'MANUT': { significado: 'Manutenção de Conta', tipo: 'tarifa', classificacao: 'despesas_bancarias', conta: '4.1.3.01' },
  
  // Cobrança
  'COB': { significado: 'Cobrança', tipo: 'cobranca', classificacao: 'verificar' },
  'BOLETO': { significado: 'Pagamento de Boleto', tipo: 'pagamento', classificacao: 'verificar_favorecido' },
  'LIQUIDACAO': { significado: 'Liquidação de Título', tipo: 'cobranca', classificacao: 'clientes' },
  'BAIXA': { significado: 'Baixa de Título', tipo: 'cobranca', classificacao: 'clientes' },
  
  // Débito Automático
  'DEB AUT': { significado: 'Débito Automático', tipo: 'debito_automatico', classificacao: 'verificar_convenio' },
  'DB AUTO': { significado: 'Débito Automático', tipo: 'debito_automatico', classificacao: 'verificar_convenio' },
  
  // Aplicações e Investimentos
  'APL': { significado: 'Aplicação Financeira', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10' },
  'APLIC': { significado: 'Aplicação', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras', conta: '1.1.1.10' },
  'RESG': { significado: 'Resgate', tipo: 'resgate', classificacao: 'aplicacoes_financeiras' },
  'RESGATE': { significado: 'Resgate de Aplicação', tipo: 'resgate', classificacao: 'aplicacoes_financeiras' },
  'REND': { significado: 'Rendimento', tipo: 'rendimento', classificacao: 'receitas_financeiras', conta: '3.2.1.01' },
  'JUROS': { significado: 'Juros Recebidos', tipo: 'rendimento', classificacao: 'receitas_financeiras', conta: '3.2.1.01' },
  'CDB': { significado: 'Certificado de Depósito Bancário', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras' },
  'POUP': { significado: 'Poupança', tipo: 'aplicacao', classificacao: 'aplicacoes_financeiras' },
  
  // Compensação
  'COMPE': { significado: 'Compensação de Cheque', tipo: 'compensacao', classificacao: 'verificar' },
  'CHQ': { significado: 'Cheque', tipo: 'cheque', classificacao: 'verificar' },
  'CHEQUE': { significado: 'Cheque', tipo: 'cheque', classificacao: 'verificar' },
  
  // Estornos e Cancelamentos
  'EST': { significado: 'Estorno', tipo: 'estorno', classificacao: 'estorno' },
  'ESTORNO': { significado: 'Estorno', tipo: 'estorno', classificacao: 'estorno' },
  'CANC': { significado: 'Cancelamento', tipo: 'cancelamento', classificacao: 'estorno' },
  'DEV': { significado: 'Devolução', tipo: 'devolucao', classificacao: 'verificar' },
  
  // Folha de Pagamento
  'SALARIO': { significado: 'Pagamento de Salário', tipo: 'folha', classificacao: 'despesas_pessoal', conta: '4.1.2.01' },
  'FOLHA': { significado: 'Folha de Pagamento', tipo: 'folha', classificacao: 'despesas_pessoal', conta: '4.1.2.01' },
  'FGTS': { significado: 'Fundo de Garantia', tipo: 'imposto', classificacao: 'encargos_sociais', conta: '4.1.2.02' },
  'GPS': { significado: 'Guia Previdência Social', tipo: 'imposto', classificacao: 'encargos_sociais', conta: '4.1.2.03' },
  'INSS': { significado: 'Previdência Social', tipo: 'imposto', classificacao: 'encargos_sociais', conta: '4.1.2.03' },
  'DARF': { significado: 'Documento Arrecadação Receitas Federais', tipo: 'imposto', classificacao: 'impostos_federais' },
  
  // Serviços Públicos
  'ENEL': { significado: 'Energia Elétrica (Enel)', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02' },
  'CELG': { significado: 'Energia Elétrica (Celg)', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02' },
  'ENERGIA': { significado: 'Energia Elétrica', tipo: 'utilidade', classificacao: 'energia', conta: '4.1.1.02' },
  'SANEAGO': { significado: 'Água e Esgoto (Saneago)', tipo: 'utilidade', classificacao: 'agua', conta: '4.1.1.03' },
  'SABESP': { significado: 'Água e Esgoto (Sabesp)', tipo: 'utilidade', classificacao: 'agua', conta: '4.1.1.03' },
  'VIVO': { significado: 'Telefonia (Vivo)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04' },
  'CLARO': { significado: 'Telefonia (Claro)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04' },
  'TIM': { significado: 'Telefonia (Tim)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04' },
  'OI': { significado: 'Telefonia (Oi)', tipo: 'utilidade', classificacao: 'telefone', conta: '4.1.1.04' },
  
  // Impostos Municipais
  'ISS': { significado: 'Imposto Sobre Serviços', tipo: 'imposto', classificacao: 'impostos_municipais', conta: '4.1.3.02' },
  'ISSQN': { significado: 'ISS Quota Nacional', tipo: 'imposto', classificacao: 'impostos_municipais', conta: '4.1.3.02' },
  'IPTU': { significado: 'Imposto Predial Territorial Urbano', tipo: 'imposto', classificacao: 'impostos_municipais', conta: '4.1.3.03' },
  
  // Outros
  'PRO LABORE': { significado: 'Retirada Pró-labore', tipo: 'pro_labore', classificacao: 'pro_labore', conta: '4.1.2.04' },
  'PROLABORE': { significado: 'Retirada Pró-labore', tipo: 'pro_labore', classificacao: 'pro_labore', conta: '4.1.2.04' },
  'DAS': { significado: 'Doc. Arrecadação Simples Nacional', tipo: 'imposto', classificacao: 'simples_nacional' },
  'SIMPLES': { significado: 'Simples Nacional', tipo: 'imposto', classificacao: 'simples_nacional' }
};

function processAccountingEntries(allKnowledge) {
  const entries = [];
  
  // Padrões conhecidos extraídos das buscas
  const patterns = [
    // FOLHA DE PAGAMENTO
    {
      pattern: /salário|folha|ordenado/i,
      entry: {
        tipo: 'FOLHA_PAGAMENTO',
        descricao: 'Apropriação de Folha de Pagamento',
        debito: { conta: '4.1.2.01', nome: 'Despesas com Pessoal - Salários' },
        credito: { conta: '2.1.1.01', nome: 'Salários a Pagar' },
        observacao: 'Regime de competência - apropriação no mês de trabalho'
      }
    },
    {
      pattern: /pagamento.*salário|liquidação.*folha/i,
      entry: {
        tipo: 'PAGAMENTO_SALARIO',
        descricao: 'Pagamento de Salários',
        debito: { conta: '2.1.1.01', nome: 'Salários a Pagar' },
        credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
        observacao: 'Baixa da obrigação no momento do pagamento'
      }
    },
    
    // FGTS
    {
      pattern: /fgts|fundo.*garantia/i,
      entry: {
        tipo: 'FGTS_PROVISAO',
        descricao: 'Provisão de FGTS (8%)',
        debito: { conta: '4.1.2.02', nome: 'Despesas com FGTS' },
        credito: { conta: '2.1.1.02', nome: 'FGTS a Recolher' },
        observacao: 'Base: 8% sobre remuneração bruta'
      }
    },
    {
      pattern: /recolhimento.*fgts|pagamento.*fgts/i,
      entry: {
        tipo: 'FGTS_PAGAMENTO',
        descricao: 'Recolhimento de FGTS',
        debito: { conta: '2.1.1.02', nome: 'FGTS a Recolher' },
        credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
        observacao: 'Vencimento: dia 7 do mês seguinte'
      }
    },
    
    // INSS
    {
      pattern: /inss|previdência|gps/i,
      entry: {
        tipo: 'INSS_PROVISAO',
        descricao: 'Provisão de INSS (Parte Empresa)',
        debito: { conta: '4.1.2.03', nome: 'Despesas com INSS' },
        credito: { conta: '2.1.1.03', nome: 'INSS a Recolher' },
        observacao: 'Base: 20% patronal + RAT + Terceiros'
      }
    },
    
    // ISS
    {
      pattern: /iss|issqn|serviço.*municipal/i,
      entry: {
        tipo: 'ISS_RETIDO',
        descricao: 'ISS Retido na Fonte',
        debito: { conta: '1.1.2.01', nome: 'Clientes a Receber' },
        credito: { conta: '2.1.2.01', nome: 'ISS a Recolher' },
        observacao: 'Retenção conforme Lei Complementar 116/2003'
      }
    },
    
    // FORNECEDORES
    {
      pattern: /compra.*prazo|fornecedor/i,
      entry: {
        tipo: 'COMPRA_PRAZO',
        descricao: 'Compra a Prazo de Fornecedor',
        debito: { conta: '1.1.4.01', nome: 'Estoque de Mercadorias' },
        credito: { conta: '2.1.3.01', nome: 'Fornecedores a Pagar' },
        observacao: 'Aquisição de mercadorias para revenda'
      }
    },
    {
      pattern: /pagamento.*fornecedor/i,
      entry: {
        tipo: 'PAGAMENTO_FORNECEDOR',
        descricao: 'Pagamento a Fornecedor',
        debito: { conta: '2.1.3.01', nome: 'Fornecedores a Pagar' },
        credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
        observacao: 'Baixa da obrigação por pagamento'
      }
    },
    
    // RECEITAS
    {
      pattern: /receita.*serviço|honorário|faturamento/i,
      entry: {
        tipo: 'RECEITA_SERVICOS',
        descricao: 'Receita de Prestação de Serviços',
        debito: { conta: '1.1.2.01', nome: 'Clientes a Receber' },
        credito: { conta: '3.1.1.01', nome: 'Receita de Serviços' },
        observacao: 'Regime de competência - no momento da prestação'
      }
    },
    {
      pattern: /recebimento.*cliente/i,
      entry: {
        tipo: 'RECEBIMENTO_CLIENTE',
        descricao: 'Recebimento de Cliente',
        debito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
        credito: { conta: '1.1.2.01', nome: 'Clientes a Receber' },
        observacao: 'Baixa do direito a receber'
      }
    },
    
    // DESPESAS BANCÁRIAS
    {
      pattern: /tarifa|despesa.*bancária|iof/i,
      entry: {
        tipo: 'DESPESA_BANCARIA',
        descricao: 'Despesas Bancárias (Tarifas)',
        debito: { conta: '4.1.3.01', nome: 'Despesas Bancárias' },
        credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
        observacao: 'Tarifas de manutenção, TED, DOC, etc.'
      }
    },
    
    // TARIFA DE COBRANÇA BANCÁRIA (BOLETOS)
    {
      pattern: /tarifa.*liquidacao|tarifa.*cobranca|tarifa.*cob\d+/i,
      entry: {
        tipo: 'TARIFA_COBRANCA_BOLETO',
        descricao: 'Tarifa de Cobrança Bancária (Boletos)',
        debito: { conta: '4.2.1.01', nome: 'Despesas Bancárias - Tarifas' },
        credito: { conta: '1.1.1.05', nome: 'Banco Sicredi' },
        observacao: 'Custo R$ 1,89 por boleto liquidado. Associar ao COB correspondente.',
        regra: {
          padrao: 'TARIFA COM R LIQUIDACAO-COB',
          custo_unitario: 1.89,
          classificacao_automatica: true,
          conta_destino: '4.2.1.01'
        }
      }
    },
    
    // MANUTENÇÃO DE TÍTULOS (BOLETOS EM CARTEIRA)
    {
      pattern: /manutencao.*titulo|manutencao.*cob/i,
      entry: {
        tipo: 'MANUTENCAO_TITULOS_COBRANCA',
        descricao: 'Manutenção de Títulos em Cobrança',
        debito: { conta: '4.2.1.01', nome: 'Despesas Bancárias - Tarifas' },
        credito: { conta: '1.1.1.05', nome: 'Banco Sicredi' },
        observacao: 'Taxa de manutenção de boletos em carteira. Custo R$ 1,89 por título.',
        regra: {
          padrao: 'MANUTENCAO DE TITULOS-COB',
          custo_unitario: 1.89,
          classificacao_automatica: true,
          conta_destino: '4.2.1.01'
        }
      }
    },
    
    // LIQUIDAÇÃO DE COBRANÇA SIMPLES (RECEBIMENTO DE BOLETOS)
    {
      pattern: /liq\.?cobranca|liquidacao.*cobranca.*simples|liq.*cob\d+/i,
      entry: {
        tipo: 'LIQUIDACAO_COBRANCA_BOLETO',
        descricao: 'Liquidação de Cobrança Simples (Recebimento de Boletos)',
        debito: { conta: '1.1.1.05', nome: 'Banco Sicredi' },
        credito: { conta: '1.1.2.01', nome: 'Clientes a Receber' },
        observacao: 'Recebimento de boletos emitidos. Deve ser desmembrado por cliente usando arquivo de baixa.',
        regra: {
          padrao: 'LIQ.COBRANCA SIMPLES-COB',
          requer_desmembramento: true,
          arquivo_baixa: 'clientes boletos jan.csv',
          classificacao_automatica: true
        }
      }
    },
    
    // CESTA DE RELACIONAMENTO BANCÁRIO
    {
      pattern: /cesta.*relacionamento|pacote.*servi[çc]o/i,
      entry: {
        tipo: 'CESTA_RELACIONAMENTO',
        descricao: 'Cesta de Relacionamento Bancário',
        debito: { conta: '4.2.1.01', nome: 'Despesas Bancárias - Tarifas' },
        credito: { conta: '1.1.1.05', nome: 'Banco Sicredi' },
        observacao: 'Pacote mensal de serviços bancários',
        regra: {
          padrao: 'CESTA DE RELACIONAMENTO',
          classificacao_automatica: true,
          conta_destino: '4.2.1.01'
        }
      }
    },
    
    // DEPRECIAÇÃO
    {
      pattern: /depreciação|depreciar/i,
      entry: {
        tipo: 'DEPRECIACAO',
        descricao: 'Depreciação de Ativo Imobilizado',
        debito: { conta: '4.1.4.01', nome: 'Despesas com Depreciação' },
        credito: { conta: '1.2.3.99', nome: '(-) Depreciação Acumulada' },
        observacao: 'Conforme NBC TG 27 - vida útil econômica'
      }
    },
    
    // PRÓ-LABORE
    {
      pattern: /pró-labore|pro labore|retirada.*sócio/i,
      entry: {
        tipo: 'PRO_LABORE',
        descricao: 'Apropriação de Pró-labore',
        debito: { conta: '4.1.2.04', nome: 'Despesas com Pró-labore' },
        credito: { conta: '2.1.1.04', nome: 'Pró-labore a Pagar' },
        observacao: 'Remuneração dos sócios administradores'
      }
    },
    
    // ADIANTAMENTOS
    {
      pattern: /adiantamento.*sócio|empréstimo.*sócio/i,
      entry: {
        tipo: 'ADIANTAMENTO_SOCIO',
        descricao: 'Adiantamento a Sócio',
        debito: { conta: '1.1.3.01', nome: 'Adiantamentos a Sócios' },
        credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
        observacao: 'ATENÇÃO: Não é despesa! Verificar regularização'
      }
    },
    
    // TRANSFERÊNCIA ENTRE CONTAS
    {
      pattern: /transferência.*conta|ted|doc.*própria/i,
      entry: {
        tipo: 'TRANSFERENCIA_CONTAS',
        descricao: 'Transferência entre Contas',
        debito: { conta: '1.1.1.03', nome: 'Banco Destino' },
        credito: { conta: '1.1.1.02', nome: 'Banco Origem' },
        observacao: 'Movimentação financeira - mesmo titular'
      }
    },
    
    // APLICAÇÃO FINANCEIRA
    {
      pattern: /aplicação.*financeira|investimento|cdb|poupança/i,
      entry: {
        tipo: 'APLICACAO_FINANCEIRA',
        descricao: 'Aplicação Financeira',
        debito: { conta: '1.1.1.10', nome: 'Aplicações Financeiras' },
        credito: { conta: '1.1.1.02', nome: 'Bancos Conta Movimento' },
        observacao: 'Disponibilidades de curto prazo'
      }
    },
    {
      pattern: /rendimento.*aplicação|juros.*recebido/i,
      entry: {
        tipo: 'RENDIMENTO_APLICACAO',
        descricao: 'Rendimento de Aplicação Financeira',
        debito: { conta: '1.1.1.10', nome: 'Aplicações Financeiras' },
        credito: { conta: '3.2.1.01', nome: 'Receitas Financeiras' },
        observacao: 'Atualização pelo rendimento bruto'
      }
    },
    
    // ESTORNO
    {
      pattern: /estorno|correção|retificação/i,
      entry: {
        tipo: 'ESTORNO',
        descricao: 'Estorno de Lançamento',
        debito: { conta: 'X.X.X.XX', nome: '[Conta Original a Crédito]' },
        credito: { conta: 'X.X.X.XX', nome: '[Conta Original a Débito]' },
        observacao: 'Inversão do lançamento original - manter histórico'
      }
    }
  ];
  
  // Processar conhecimento extraído
  for (const item of allKnowledge) {
    for (const { pattern, entry } of patterns) {
      if (pattern.test(item.snippet) || pattern.test(item.title)) {
        // Enriquecer entry com fonte
        entries.push({
          ...entry,
          fontes: [item.source],
          confianca: item.trusted ? 0.9 : 0.7,
          keywords: item.query.split(' ')
        });
      }
    }
  }
  
  // Remover duplicatas por tipo
  const uniqueEntries = [];
  const seenTypes = new Set();
  for (const entry of entries) {
    if (!seenTypes.has(entry.tipo)) {
      seenTypes.add(entry.tipo);
      uniqueEntries.push(entry);
    }
  }
  
  return uniqueEntries;
}

// =============================================================================
// GERAR BASE DE CONHECIMENTO
// =============================================================================

function generateKnowledgeBase(entries, rawKnowledge) {
  return {
    versao: '1.0.0',
    gerado_em: new Date().toISOString(),
    autor: 'Dr. Cícero - Treinamento Automatizado',
    
    // DICIONÁRIO DE SIGLAS DE EXTRATOS BANCÁRIOS
    siglas_extrato: SIGLAS_EXTRATO,
    
    // Lançamentos padronizados
    lancamentos_padrao: entries,
    
    // Regras de classificação
    regras_classificacao: [
      {
        regra: 'TARIFA_BANCARIA',
        keywords: ['tarifa', 'tar ', 'iof', 'ted', 'doc', 'manutenção', 'anuidade'],
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
        confianca: 0.90
      },
      {
        regra: 'FOLHA_PAGAMENTO',
        keywords: ['salario', 'folha', '13', 'ferias', 'rescisao', 'aviso previo'],
        conta_debito: '4.1.2.01',
        conta_debito_nome: 'Despesas com Pessoal',
        confianca: 0.85
      },
      {
        regra: 'IMPOSTOS_TRABALHISTAS',
        keywords: ['fgts', 'inss', 'gps', 'darf', 'previdencia'],
        conta_debito: '4.1.2.02',
        conta_debito_nome: 'Encargos Sociais',
        confianca: 0.95
      },
      {
        regra: 'IMPOSTOS_MUNICIPAIS',
        keywords: ['iss', 'issqn', 'iptu'],
        conta_debito: '4.1.3.02',
        conta_debito_nome: 'Impostos Municipais',
        confianca: 0.90
      },
      {
        regra: 'ENERGIA',
        keywords: ['enel', 'celg', 'energia', 'eletric', 'luz'],
        conta_debito: '4.1.1.02',
        conta_debito_nome: 'Energia Elétrica',
        confianca: 0.90
      },
      {
        regra: 'AGUA',
        keywords: ['saneago', 'agua', 'sabesp', 'esgoto'],
        conta_debito: '4.1.1.03',
        conta_debito_nome: 'Água e Esgoto',
        confianca: 0.90
      },
      {
        regra: 'TELECOMUNICACOES',
        keywords: ['vivo', 'claro', 'tim', 'oi ', 'internet', 'telefon', 'celular'],
        conta_debito: '4.1.1.04',
        conta_debito_nome: 'Telefone e Internet',
        confianca: 0.85
      },
      {
        regra: 'ALUGUEL',
        keywords: ['aluguel', 'locacao', 'arrendamento', 'condominio'],
        conta_debito: '4.1.1.01',
        conta_debito_nome: 'Aluguel e Condomínio',
        confianca: 0.90
      },
      {
        regra: 'CLIENTE_RECEBIMENTO',
        keywords: ['honorario', 'mensalidade', 'fatura', 'nf ', 'nota fiscal'],
        tipo: 'ENTRADA',
        conta_credito: '1.1.2.01',
        conta_credito_nome: 'Clientes a Receber',
        confianca: 0.80
      }
    ],
    
    // Snippets relevantes das buscas (para referência)
    referencias_web: rawKnowledge.filter(k => k.trusted).slice(0, 50),
    
    // Estatísticas
    estatisticas: {
      total_buscas: SEARCH_QUERIES.length,
      total_resultados: rawKnowledge.length,
      fontes_confiaveis: rawKnowledge.filter(k => k.trusted).length,
      lancamentos_extraidos: entries.length
    }
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const allKnowledge = [];
  
  console.log(`\n📚 Buscando conhecimento em ${SEARCH_QUERIES.length} queries...\n`);
  
  for (let i = 0; i < SEARCH_QUERIES.length; i++) {
    const query = SEARCH_QUERIES[i];
    console.log(`[${i + 1}/${SEARCH_QUERIES.length}] 🔍 "${query.substring(0, 50)}..."`);
    
    const results = await searchSerper(query);
    const knowledge = extractKnowledge(results, query);
    allKnowledge.push(...knowledge);
    
    console.log(`  ✓ ${results.length} resultados, ${knowledge.length} úteis`);
    
    // Rate limiting - esperar 500ms entre buscas
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Total de conhecimento extraído: ${allKnowledge.length} itens`);
  console.log(`   Fontes confiáveis: ${allKnowledge.filter(k => k.trusted).length}`);
  
  // Processar lançamentos
  console.log('\n🔄 Processando lançamentos contábeis...');
  const entries = processAccountingEntries(allKnowledge);
  console.log(`   ${entries.length} tipos de lançamentos identificados`);
  
  // Gerar base de conhecimento
  console.log('\n📝 Gerando base de conhecimento...');
  const knowledgeBase = generateKnowledgeBase(entries, allKnowledge);
  
  // Salvar arquivo
  const outputPath = './mcp-financeiro/src/knowledge/lancamentos-contabeis.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(knowledgeBase, null, 2), 'utf-8');
  console.log(`   ✅ Salvo em: ${outputPath}`);
  
  // Exibir resumo
  console.log('\n' + '='.repeat(60));
  console.log('🎓 TREINAMENTO CONCLUÍDO!');
  console.log('='.repeat(60));
  console.log('\nLançamentos padronizados disponíveis:');
  for (const entry of entries.slice(0, 10)) {
    console.log(`  • ${entry.tipo}: D ${entry.debito.conta} / C ${entry.credito.conta}`);
  }
  if (entries.length > 10) {
    console.log(`  ... e mais ${entries.length - 10} tipos`);
  }
  
  console.log('\nRegras de classificação:');
  for (const regra of knowledgeBase.regras_classificacao) {
    console.log(`  • ${regra.regra}: ${regra.conta_debito || regra.conta_credito} (${Math.round(regra.confianca * 100)}%)`);
  }
  
  console.log('\n✨ O Dr. Cícero agora está mais inteligente!');
}

main().catch(console.error);
