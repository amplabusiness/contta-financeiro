/**
 * Script para extrair conhecimento contábil brasileiro
 * Usa Serper.dev para pesquisar e extrair informações sobre lançamentos contábeis
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_ENDPOINT = 'https://google.serper.dev/search';

// Queries para pesquisa
const QUERIES = [
  {
    query: "lançamentos contábeis débito crédito exemplos práticos site:contabeis.com.br",
    category: "GERAL"
  },
  {
    query: "plano de contas exemplo completo débito crédito site:portaldecontabilidade.com.br",
    category: "PLANO_CONTAS"
  },
  {
    query: "manual lançamentos contábeis folha pagamento site:contabeis.com.br",
    category: "FOLHA_PAGAMENTO"
  },
  {
    query: "lançamentos contábeis nota fiscal ICMS PIS COFINS débito crédito",
    category: "IMPOSTOS"
  },
  {
    query: "lançamentos contábeis extrato bancário conciliação",
    category: "BANCARIO"
  },
  {
    query: "contabilização receitas despesas exemplo prático débito crédito",
    category: "RECEITAS_DESPESAS"
  },
  {
    query: "contabilização importação extrato OFX lançamento automático",
    category: "OFX_IMPORTACAO"
  },
  {
    query: "regras partidas dobradas ativo passivo receita despesa",
    category: "REGRAS_CONTABEIS"
  }
];

// Função para fazer pesquisa no Serper
async function searchSerper(query) {
  try {
    const response = await fetch(SERPER_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        gl: 'br',
        hl: 'pt-br',
        num: 10
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro na pesquisa "${query}":`, error.message);
    return null;
  }
}

// Função para extrair conteúdo de uma URL
async function fetchContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    // Extrair texto limpo (simplificado)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, 10000); // Limitar tamanho
  } catch (error) {
    return null;
  }
}

// Base de conhecimento contábil estruturada
const KNOWLEDGE_BASE = {
  // ========== RECEITAS ==========
  RECEITAS: [
    {
      operacao: "Venda de Mercadorias à Vista",
      debito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      credito: { codigo: "3.1.1.01", nome: "Receita de Vendas de Mercadorias" },
      historico: "Venda de mercadorias conf. NF {nf} - {cliente}",
      keywords: ["venda", "mercadoria", "nf", "nota fiscal", "receita"]
    },
    {
      operacao: "Venda de Mercadorias a Prazo",
      debito: { codigo: "1.1.2.01", nome: "Clientes/Duplicatas a Receber" },
      credito: { codigo: "3.1.1.01", nome: "Receita de Vendas de Mercadorias" },
      historico: "Venda a prazo conf. NF {nf} - {cliente}",
      keywords: ["venda", "prazo", "duplicata", "cliente", "receber"]
    },
    {
      operacao: "Recebimento de Duplicata",
      debito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      credito: { codigo: "1.1.2.01", nome: "Clientes/Duplicatas a Receber" },
      historico: "Recebimento duplicata {cliente} - NF {nf}",
      keywords: ["recebimento", "duplicata", "baixa", "cliente", "pix", "ted", "transferência"]
    },
    {
      operacao: "Prestação de Serviços à Vista",
      debito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      credito: { codigo: "3.1.2.01", nome: "Receita de Prestação de Serviços" },
      historico: "Serviços prestados conf. NFS-e {nf} - {cliente}",
      keywords: ["serviço", "honorário", "consultoria", "nfse", "prestação"]
    },
    {
      operacao: "Prestação de Serviços a Prazo",
      debito: { codigo: "1.1.2.01", nome: "Clientes a Receber" },
      credito: { codigo: "3.1.2.01", nome: "Receita de Prestação de Serviços" },
      historico: "Serviços prestados a prazo conf. NFS-e {nf} - {cliente}",
      keywords: ["serviço", "prazo", "honorário", "receber"]
    },
    {
      operacao: "Receita de Juros Ativos",
      debito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      credito: { codigo: "3.2.1.01", nome: "Receitas Financeiras - Juros Ativos" },
      historico: "Juros recebidos s/ {descricao}",
      keywords: ["juros", "recebidos", "rendimento", "aplicação"]
    },
    {
      operacao: "Receita de Desconto Obtido",
      debito: { codigo: "2.1.1.xx", nome: "Fornecedores" },
      credito: { codigo: "3.2.1.02", nome: "Descontos Obtidos" },
      historico: "Desconto obtido pagamento {fornecedor}",
      keywords: ["desconto", "obtido", "abatimento"]
    },
    {
      operacao: "Rendimento de Aplicação Financeira",
      debito: { codigo: "1.1.3.xx", nome: "Aplicações Financeiras" },
      credito: { codigo: "3.2.1.01", nome: "Receitas Financeiras" },
      historico: "Rendimento aplicação {banco} - {periodo}",
      keywords: ["rendimento", "aplicação", "investimento", "poupança", "cdb"]
    }
  ],

  // ========== DESPESAS ==========
  DESPESAS: [
    {
      operacao: "Pagamento de Aluguel",
      debito: { codigo: "4.1.1.01", nome: "Despesas com Aluguel" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento aluguel ref. {mes}/{ano} - {locador}",
      keywords: ["aluguel", "locação", "imóvel", "sala", "escritório"]
    },
    {
      operacao: "Provisão de Aluguel a Pagar",
      debito: { codigo: "4.1.1.01", nome: "Despesas com Aluguel" },
      credito: { codigo: "2.1.2.01", nome: "Aluguéis a Pagar" },
      historico: "Provisão aluguel ref. {mes}/{ano}",
      keywords: ["provisão", "aluguel", "pagar"]
    },
    {
      operacao: "Pagamento de Energia Elétrica",
      debito: { codigo: "4.1.1.02", nome: "Despesas com Energia Elétrica" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento energia ref. {mes}/{ano} - {concessionaria}",
      keywords: ["energia", "elétrica", "luz", "enel", "celg", "cemig", "copel"]
    },
    {
      operacao: "Pagamento de Água",
      debito: { codigo: "4.1.1.03", nome: "Despesas com Água e Esgoto" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento água ref. {mes}/{ano} - {concessionaria}",
      keywords: ["água", "esgoto", "saneago", "sabesp", "copasa"]
    },
    {
      operacao: "Pagamento de Telefone/Internet",
      debito: { codigo: "4.1.1.04", nome: "Despesas com Comunicação" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento telefone/internet ref. {mes}/{ano}",
      keywords: ["telefone", "internet", "comunicação", "vivo", "claro", "tim", "oi"]
    },
    {
      operacao: "Despesa com Material de Escritório",
      debito: { codigo: "4.1.1.05", nome: "Material de Escritório" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Compra material escritório conf. NF {nf}",
      keywords: ["material", "escritório", "papelaria", "suprimento"]
    },
    {
      operacao: "Despesa com Combustível",
      debito: { codigo: "4.1.1.06", nome: "Despesas com Combustível" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Abastecimento veículo placa {placa}",
      keywords: ["combustível", "gasolina", "álcool", "diesel", "abastecimento", "posto"]
    },
    {
      operacao: "Despesa com Manutenção",
      debito: { codigo: "4.1.1.07", nome: "Despesas com Manutenção" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Manutenção/reparo conf. NF {nf}",
      keywords: ["manutenção", "reparo", "conserto", "serviço"]
    },
    {
      operacao: "Despesas Bancárias - Tarifas",
      debito: { codigo: "4.2.1.01", nome: "Despesas Bancárias" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Tarifa bancária - {banco}",
      keywords: ["tarifa", "taxa", "bancária", "manutenção conta", "ted", "doc", "pix"]
    },
    {
      operacao: "Despesas com Juros Passivos",
      debito: { codigo: "4.2.1.02", nome: "Juros Passivos" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Juros s/ {descricao}",
      keywords: ["juros", "mora", "atraso", "multa"]
    },
    {
      operacao: "Despesa com Desconto Concedido",
      debito: { codigo: "4.2.1.03", nome: "Descontos Concedidos" },
      credito: { codigo: "1.1.2.01", nome: "Clientes a Receber" },
      historico: "Desconto concedido cliente {cliente}",
      keywords: ["desconto", "concedido", "abatimento"]
    },
    {
      operacao: "Despesa com Publicidade",
      debito: { codigo: "4.1.2.01", nome: "Despesas com Publicidade" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Despesa publicidade/propaganda conf. NF {nf}",
      keywords: ["publicidade", "propaganda", "marketing", "anúncio", "mídia"]
    },
    {
      operacao: "Despesa com Seguros",
      debito: { codigo: "4.1.2.02", nome: "Despesas com Seguros" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento seguro {tipo} apólice {numero}",
      keywords: ["seguro", "apólice", "prêmio", "sinistro"]
    },
    {
      operacao: "Despesa com Honorários Contábeis",
      debito: { codigo: "4.1.2.03", nome: "Honorários Contábeis" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Honorários contabilidade ref. {mes}/{ano}",
      keywords: ["honorário", "contabilidade", "contador", "escritório contábil"]
    },
    {
      operacao: "Despesa com Honorários Advocatícios",
      debito: { codigo: "4.1.2.04", nome: "Honorários Advocatícios" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Honorários advocatícios - {advogado}",
      keywords: ["honorário", "advogado", "advocatício", "jurídico"]
    }
  ],

  // ========== FOLHA DE PAGAMENTO ==========
  FOLHA_PAGAMENTO: [
    {
      operacao: "Provisão de Salários",
      debito: { codigo: "4.1.3.01", nome: "Despesas com Salários" },
      credito: { codigo: "2.1.3.01", nome: "Salários a Pagar" },
      historico: "Provisão salários ref. {mes}/{ano}",
      keywords: ["salário", "folha", "pagamento", "provisão", "funcionário"]
    },
    {
      operacao: "Pagamento de Salários",
      debito: { codigo: "2.1.3.01", nome: "Salários a Pagar" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento salários ref. {mes}/{ano}",
      keywords: ["salário", "pagamento", "folha"]
    },
    {
      operacao: "Provisão de INSS Patronal",
      debito: { codigo: "4.1.3.02", nome: "INSS Patronal" },
      credito: { codigo: "2.1.4.01", nome: "INSS a Recolher" },
      historico: "Provisão INSS patronal ref. {mes}/{ano}",
      keywords: ["inss", "patronal", "previdência", "contribuição"]
    },
    {
      operacao: "Retenção de INSS Funcionário",
      debito: { codigo: "2.1.3.01", nome: "Salários a Pagar" },
      credito: { codigo: "2.1.4.01", nome: "INSS a Recolher" },
      historico: "Retenção INSS funcionário ref. {mes}/{ano}",
      keywords: ["inss", "retenção", "desconto", "funcionário"]
    },
    {
      operacao: "Pagamento de INSS",
      debito: { codigo: "2.1.4.01", nome: "INSS a Recolher" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento GPS/INSS ref. {mes}/{ano}",
      keywords: ["gps", "inss", "guia previdência"]
    },
    {
      operacao: "Provisão de FGTS",
      debito: { codigo: "4.1.3.03", nome: "FGTS" },
      credito: { codigo: "2.1.4.02", nome: "FGTS a Recolher" },
      historico: "Provisão FGTS ref. {mes}/{ano}",
      keywords: ["fgts", "fundo garantia"]
    },
    {
      operacao: "Pagamento de FGTS",
      debito: { codigo: "2.1.4.02", nome: "FGTS a Recolher" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento FGTS ref. {mes}/{ano}",
      keywords: ["fgts", "grf", "guia fgts"]
    },
    {
      operacao: "Retenção de IRRF Funcionário",
      debito: { codigo: "2.1.3.01", nome: "Salários a Pagar" },
      credito: { codigo: "2.1.4.03", nome: "IRRF a Recolher" },
      historico: "Retenção IRRF funcionário ref. {mes}/{ano}",
      keywords: ["irrf", "imposto renda", "retenção"]
    },
    {
      operacao: "Pagamento de IRRF",
      debito: { codigo: "2.1.4.03", nome: "IRRF a Recolher" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento DARF IRRF ref. {mes}/{ano}",
      keywords: ["darf", "irrf", "imposto renda"]
    },
    {
      operacao: "Provisão de Férias",
      debito: { codigo: "4.1.3.04", nome: "Despesas com Férias" },
      credito: { codigo: "2.1.3.02", nome: "Férias a Pagar" },
      historico: "Provisão férias funcionário {nome}",
      keywords: ["férias", "provisão"]
    },
    {
      operacao: "Pagamento de Férias",
      debito: { codigo: "2.1.3.02", nome: "Férias a Pagar" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento férias funcionário {nome}",
      keywords: ["férias", "pagamento"]
    },
    {
      operacao: "Provisão de 13º Salário",
      debito: { codigo: "4.1.3.05", nome: "Despesas com 13º Salário" },
      credito: { codigo: "2.1.3.03", nome: "13º Salário a Pagar" },
      historico: "Provisão 13º salário ref. {mes}/{ano}",
      keywords: ["13", "décimo terceiro", "gratificação", "natalina"]
    },
    {
      operacao: "Pagamento de 13º Salário",
      debito: { codigo: "2.1.3.03", nome: "13º Salário a Pagar" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento 13º salário ref. {ano}",
      keywords: ["13", "décimo terceiro"]
    },
    {
      operacao: "Pró-labore - Provisão",
      debito: { codigo: "4.1.3.06", nome: "Pró-labore" },
      credito: { codigo: "2.1.3.04", nome: "Pró-labore a Pagar" },
      historico: "Provisão pró-labore {sócio} ref. {mes}/{ano}",
      keywords: ["pró-labore", "prolabore", "sócio", "administrador", "retirada"]
    },
    {
      operacao: "Pró-labore - Pagamento",
      debito: { codigo: "2.1.3.04", nome: "Pró-labore a Pagar" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento pró-labore {sócio} ref. {mes}/{ano}",
      keywords: ["pró-labore", "prolabore", "pagamento"]
    },
    {
      operacao: "Vale Transporte - Compra",
      debito: { codigo: "1.1.9.01", nome: "Vale Transporte Antecipado" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Compra vale transporte ref. {mes}/{ano}",
      keywords: ["vale transporte", "vt", "passagem"]
    },
    {
      operacao: "Vale Transporte - Apropriação",
      debito: { codigo: "4.1.3.07", nome: "Despesas com Vale Transporte" },
      credito: { codigo: "1.1.9.01", nome: "Vale Transporte Antecipado" },
      historico: "Apropriação vale transporte ref. {mes}/{ano}",
      keywords: ["vale transporte", "apropriação"]
    },
    {
      operacao: "Vale Refeição/Alimentação - Compra",
      debito: { codigo: "1.1.9.02", nome: "Vale Refeição Antecipado" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Compra vale refeição/alimentação ref. {mes}/{ano}",
      keywords: ["vale refeição", "vale alimentação", "vr", "va", "ticket"]
    }
  ],

  // ========== IMPOSTOS ==========
  IMPOSTOS: [
    {
      operacao: "ICMS sobre Vendas",
      debito: { codigo: "3.1.1.01.D", nome: "(-) ICMS sobre Vendas" },
      credito: { codigo: "2.1.5.01", nome: "ICMS a Recolher" },
      historico: "ICMS s/ vendas NF {nf}",
      keywords: ["icms", "imposto", "circulação", "mercadoria"]
    },
    {
      operacao: "ICMS sobre Compras (Crédito)",
      debito: { codigo: "1.1.8.01", nome: "ICMS a Recuperar" },
      credito: { codigo: "2.1.1.xx", nome: "Fornecedores" },
      historico: "Crédito ICMS s/ compra NF {nf}",
      keywords: ["icms", "crédito", "recuperar", "compra"]
    },
    {
      operacao: "Apuração de ICMS (transferência)",
      debito: { codigo: "2.1.5.01", nome: "ICMS a Recolher" },
      credito: { codigo: "1.1.8.01", nome: "ICMS a Recuperar" },
      historico: "Apuração ICMS ref. {mes}/{ano}",
      keywords: ["apuração", "icms", "compensação"]
    },
    {
      operacao: "Pagamento de ICMS",
      debito: { codigo: "2.1.5.01", nome: "ICMS a Recolher" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento ICMS ref. {mes}/{ano}",
      keywords: ["icms", "guia", "dare", "pagamento"]
    },
    {
      operacao: "PIS sobre Faturamento",
      debito: { codigo: "3.1.1.01.D", nome: "(-) PIS sobre Faturamento" },
      credito: { codigo: "2.1.5.02", nome: "PIS a Recolher" },
      historico: "PIS s/ faturamento ref. {mes}/{ano}",
      keywords: ["pis", "contribuição", "faturamento"]
    },
    {
      operacao: "COFINS sobre Faturamento",
      debito: { codigo: "3.1.1.01.D", nome: "(-) COFINS sobre Faturamento" },
      credito: { codigo: "2.1.5.03", nome: "COFINS a Recolher" },
      historico: "COFINS s/ faturamento ref. {mes}/{ano}",
      keywords: ["cofins", "contribuição", "faturamento"]
    },
    {
      operacao: "Pagamento de PIS/COFINS",
      debito: { codigo: "2.1.5.02/03", nome: "PIS/COFINS a Recolher" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento DARF PIS/COFINS ref. {mes}/{ano}",
      keywords: ["pis", "cofins", "darf"]
    },
    {
      operacao: "ISS sobre Serviços",
      debito: { codigo: "3.1.2.01.D", nome: "(-) ISS sobre Serviços" },
      credito: { codigo: "2.1.5.04", nome: "ISS a Recolher" },
      historico: "ISS s/ serviços NFS-e {nf}",
      keywords: ["iss", "issqn", "serviço", "municipal"]
    },
    {
      operacao: "Pagamento de ISS",
      debito: { codigo: "2.1.5.04", nome: "ISS a Recolher" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento ISS ref. {mes}/{ano}",
      keywords: ["iss", "guia", "dam", "pagamento"]
    },
    {
      operacao: "IRPJ Estimativa",
      debito: { codigo: "4.3.1.01", nome: "Despesa com IRPJ" },
      credito: { codigo: "2.1.5.05", nome: "IRPJ a Recolher" },
      historico: "Provisão IRPJ ref. {trimestre}/{ano}",
      keywords: ["irpj", "imposto renda", "pessoa jurídica"]
    },
    {
      operacao: "CSLL Estimativa",
      debito: { codigo: "4.3.1.02", nome: "Despesa com CSLL" },
      credito: { codigo: "2.1.5.06", nome: "CSLL a Recolher" },
      historico: "Provisão CSLL ref. {trimestre}/{ano}",
      keywords: ["csll", "contribuição social"]
    },
    {
      operacao: "Pagamento DAS (Simples Nacional)",
      debito: { codigo: "4.3.1.03", nome: "Simples Nacional" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento DAS Simples Nacional ref. {mes}/{ano}",
      keywords: ["das", "simples", "nacional", "mei", "microempresa"]
    },
    {
      operacao: "Retenção de IR sobre Serviços (Tomador)",
      debito: { codigo: "4.1.2.xx", nome: "Despesa com Serviços" },
      credito: { codigo: "2.1.4.04", nome: "IR Retido a Recolher" },
      historico: "Retenção IR s/ serviços NF {nf}",
      keywords: ["irrf", "retenção", "serviço", "tomador"]
    },
    {
      operacao: "Retenção de IR sobre Serviços (Prestador)",
      debito: { codigo: "1.1.8.02", nome: "IR a Compensar" },
      credito: { codigo: "1.1.2.01", nome: "Clientes a Receber" },
      historico: "IR retido s/ serviços NFS-e {nf}",
      keywords: ["irrf", "retenção", "compensar", "prestador"]
    }
  ],

  // ========== BANCÁRIO ==========
  BANCARIO: [
    {
      operacao: "Depósito em Conta Corrente",
      debito: { codigo: "1.1.1.xx", nome: "Banco Conta Movimento" },
      credito: { codigo: "1.1.1.01", nome: "Caixa" },
      historico: "Depósito em conta corrente {banco}",
      keywords: ["depósito", "banco", "conta"]
    },
    {
      operacao: "Saque/Retirada em Conta Corrente",
      debito: { codigo: "1.1.1.01", nome: "Caixa" },
      credito: { codigo: "1.1.1.xx", nome: "Banco Conta Movimento" },
      historico: "Saque/retirada conta corrente {banco}",
      keywords: ["saque", "retirada", "caixa"]
    },
    {
      operacao: "Transferência Entre Contas (mesma titularidade)",
      debito: { codigo: "1.1.1.xx", nome: "Banco Destino" },
      credito: { codigo: "1.1.1.xx", nome: "Banco Origem" },
      historico: "Transferência entre contas próprias",
      keywords: ["transferência", "ted", "pix", "mesma titularidade", "entre contas"]
    },
    {
      operacao: "Aplicação Financeira",
      debito: { codigo: "1.1.3.xx", nome: "Aplicações Financeiras" },
      credito: { codigo: "1.1.1.xx", nome: "Banco Conta Movimento" },
      historico: "Aplicação financeira {tipo} - {banco}",
      keywords: ["aplicação", "investimento", "cdb", "poupança", "fundo"]
    },
    {
      operacao: "Resgate de Aplicação",
      debito: { codigo: "1.1.1.xx", nome: "Banco Conta Movimento" },
      credito: { codigo: "1.1.3.xx", nome: "Aplicações Financeiras" },
      historico: "Resgate aplicação financeira - {banco}",
      keywords: ["resgate", "aplicação", "investimento"]
    },
    {
      operacao: "IOF sobre Aplicação",
      debito: { codigo: "4.2.1.04", nome: "IOF" },
      credito: { codigo: "1.1.1.xx", nome: "Banco" },
      historico: "IOF s/ aplicação/operação financeira",
      keywords: ["iof", "imposto", "operação financeira"]
    },
    {
      operacao: "Empréstimo Bancário - Liberação",
      debito: { codigo: "1.1.1.xx", nome: "Banco Conta Movimento" },
      credito: { codigo: "2.1.6.01", nome: "Empréstimos a Pagar CP" },
      historico: "Liberação empréstimo {banco} contrato {numero}",
      keywords: ["empréstimo", "liberação", "financiamento", "crédito"]
    },
    {
      operacao: "Empréstimo Bancário - Pagamento Parcela",
      debito: { codigo: "2.1.6.01", nome: "Empréstimos a Pagar" },
      credito: { codigo: "1.1.1.xx", nome: "Banco" },
      historico: "Pagamento parcela empréstimo {banco}",
      keywords: ["empréstimo", "parcela", "amortização"]
    },
    {
      operacao: "Juros sobre Empréstimo",
      debito: { codigo: "4.2.1.02", nome: "Juros Passivos" },
      credito: { codigo: "1.1.1.xx", nome: "Banco" },
      historico: "Juros s/ empréstimo {banco}",
      keywords: ["juros", "empréstimo", "encargo"]
    },
    {
      operacao: "Cheque Devolvido",
      debito: { codigo: "1.1.2.02", nome: "Cheques a Receber" },
      credito: { codigo: "1.1.1.xx", nome: "Banco" },
      historico: "Cheque devolvido {cliente} - motivo {motivo}",
      keywords: ["cheque", "devolvido", "sustado", "sem fundo"]
    },
    {
      operacao: "Cobrança Bancária - Tarifas",
      debito: { codigo: "4.2.1.01", nome: "Despesas Bancárias" },
      credito: { codigo: "1.1.1.xx", nome: "Banco" },
      historico: "Tarifa cobrança bancária {banco}",
      keywords: ["tarifa", "cobrança", "boleto", "liquidação"]
    },
    {
      operacao: "CPMF/IOF Débito Automático",
      debito: { codigo: "4.2.1.04", nome: "IOF/Tributos Financeiros" },
      credito: { codigo: "1.1.1.xx", nome: "Banco" },
      historico: "IOF s/ movimentação bancária",
      keywords: ["iof", "débito", "automático"]
    }
  ],

  // ========== ATIVO IMOBILIZADO ==========
  ATIVO_IMOBILIZADO: [
    {
      operacao: "Aquisição de Imobilizado à Vista",
      debito: { codigo: "1.2.3.xx", nome: "Imobilizado - {tipo}" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Aquisição {bem} conf. NF {nf}",
      keywords: ["imobilizado", "aquisição", "compra", "ativo fixo", "máquina", "equipamento", "veículo", "móvel"]
    },
    {
      operacao: "Aquisição de Imobilizado a Prazo",
      debito: { codigo: "1.2.3.xx", nome: "Imobilizado - {tipo}" },
      credito: { codigo: "2.1.1.xx", nome: "Fornecedores de Imobilizado" },
      historico: "Aquisição {bem} a prazo conf. NF {nf}",
      keywords: ["imobilizado", "prazo", "financiamento"]
    },
    {
      operacao: "Depreciação Mensal",
      debito: { codigo: "4.1.4.01", nome: "Despesa com Depreciação" },
      credito: { codigo: "1.2.3.xx.D", nome: "(-) Depreciação Acumulada" },
      historico: "Depreciação ref. {mes}/{ano}",
      keywords: ["depreciação", "desgaste", "vida útil"]
    },
    {
      operacao: "Baixa de Imobilizado por Venda",
      debito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      credito: { codigo: "1.2.3.xx", nome: "Imobilizado" },
      historico: "Venda {bem} conf. NF {nf}",
      keywords: ["venda", "baixa", "alienação", "imobilizado"]
    },
    {
      operacao: "Ganho na Venda de Imobilizado",
      debito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      credito: { codigo: "3.3.1.01", nome: "Ganho na Alienação de Imobilizado" },
      historico: "Ganho venda {bem}",
      keywords: ["ganho", "lucro", "venda", "alienação"]
    },
    {
      operacao: "Perda na Venda de Imobilizado",
      debito: { codigo: "4.3.2.01", nome: "Perda na Alienação de Imobilizado" },
      credito: { codigo: "1.2.3.xx", nome: "Imobilizado" },
      historico: "Perda venda {bem}",
      keywords: ["perda", "prejuízo", "venda", "alienação"]
    },
    {
      operacao: "Baixa Depreciação Acumulada (Venda)",
      debito: { codigo: "1.2.3.xx.D", nome: "(-) Depreciação Acumulada" },
      credito: { codigo: "1.2.3.xx", nome: "Imobilizado" },
      historico: "Baixa depreciação acumulada {bem}",
      keywords: ["depreciação", "baixa", "acumulada"]
    },
    {
      operacao: "Aquisição de Software/Intangível",
      debito: { codigo: "1.2.4.01", nome: "Software/Intangível" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Aquisição software {nome}",
      keywords: ["software", "intangível", "licença", "sistema"]
    },
    {
      operacao: "Amortização de Intangível",
      debito: { codigo: "4.1.4.02", nome: "Despesa com Amortização" },
      credito: { codigo: "1.2.4.01.D", nome: "(-) Amortização Acumulada" },
      historico: "Amortização intangível ref. {mes}/{ano}",
      keywords: ["amortização", "intangível", "software"]
    }
  ],

  // ========== ESTOQUE ==========
  ESTOQUE: [
    {
      operacao: "Compra de Mercadorias à Vista",
      debito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Compra mercadorias conf. NF {nf} - {fornecedor}",
      keywords: ["compra", "mercadoria", "estoque", "fornecedor"]
    },
    {
      operacao: "Compra de Mercadorias a Prazo",
      debito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      credito: { codigo: "2.1.1.xx", nome: "Fornecedores" },
      historico: "Compra mercadorias a prazo conf. NF {nf}",
      keywords: ["compra", "prazo", "fornecedor", "duplicata"]
    },
    {
      operacao: "Pagamento a Fornecedor",
      debito: { codigo: "2.1.1.xx", nome: "Fornecedores" },
      credito: { codigo: "1.1.1.xx", nome: "Caixa/Banco" },
      historico: "Pagamento NF {nf} - {fornecedor}",
      keywords: ["pagamento", "fornecedor", "duplicata", "quitação"]
    },
    {
      operacao: "Custo das Mercadorias Vendidas (CMV)",
      debito: { codigo: "3.1.1.01.C", nome: "CMV - Custo das Mercadorias Vendidas" },
      credito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      historico: "CMV ref. venda NF {nf}",
      keywords: ["cmv", "custo", "venda", "baixa estoque"]
    },
    {
      operacao: "Devolução de Compra",
      debito: { codigo: "2.1.1.xx", nome: "Fornecedores" },
      credito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      historico: "Devolução compra conf. NF {nf}",
      keywords: ["devolução", "compra", "retorno"]
    },
    {
      operacao: "Devolução de Venda",
      debito: { codigo: "3.1.1.01.D", nome: "(-) Devoluções de Vendas" },
      credito: { codigo: "1.1.2.01", nome: "Clientes a Receber" },
      historico: "Devolução venda conf. NF {nf}",
      keywords: ["devolução", "venda", "cliente"]
    },
    {
      operacao: "Entrada de Estoque por Devolução de Venda",
      debito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      credito: { codigo: "3.1.1.01.C", nome: "CMV" },
      historico: "Entrada estoque - devolução NF {nf}",
      keywords: ["entrada", "estoque", "devolução"]
    },
    {
      operacao: "Perda de Estoque",
      debito: { codigo: "4.3.2.02", nome: "Perdas de Estoque" },
      credito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      historico: "Perda estoque - {motivo}",
      keywords: ["perda", "quebra", "avaria", "sinistro"]
    },
    {
      operacao: "Ajuste de Inventário (Sobra)",
      debito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      credito: { codigo: "3.3.1.02", nome: "Outras Receitas" },
      historico: "Ajuste inventário - sobra",
      keywords: ["ajuste", "inventário", "sobra"]
    },
    {
      operacao: "Ajuste de Inventário (Falta)",
      debito: { codigo: "4.3.2.02", nome: "Perdas de Estoque" },
      credito: { codigo: "1.1.4.01", nome: "Estoque de Mercadorias" },
      historico: "Ajuste inventário - falta",
      keywords: ["ajuste", "inventário", "falta"]
    },
    {
      operacao: "Compra de Matéria-Prima",
      debito: { codigo: "1.1.4.02", nome: "Estoque de Matéria-Prima" },
      credito: { codigo: "2.1.1.xx", nome: "Fornecedores" },
      historico: "Compra matéria-prima conf. NF {nf}",
      keywords: ["matéria-prima", "insumo", "fabricação"]
    },
    {
      operacao: "Requisição de Matéria-Prima",
      debito: { codigo: "1.1.4.03", nome: "Produtos em Elaboração" },
      credito: { codigo: "1.1.4.02", nome: "Estoque de Matéria-Prima" },
      historico: "Requisição matéria-prima OP {numero}",
      keywords: ["requisição", "produção", "ordem"]
    },
    {
      operacao: "Transferência para Produto Acabado",
      debito: { codigo: "1.1.4.04", nome: "Estoque de Produtos Acabados" },
      credito: { codigo: "1.1.4.03", nome: "Produtos em Elaboração" },
      historico: "Entrada produto acabado OP {numero}",
      keywords: ["produto acabado", "transferência", "produção"]
    }
  ],

  // ========== OPERAÇÕES TRANSITÓRIAS ==========
  TRANSITÓRIAS: [
    {
      operacao: "Importação OFX - ENTRADA de Dinheiro (Crédito no Extrato)",
      debito: { codigo: "1.1.1.xx", nome: "Banco (Sicredi/Bradesco/etc)" },
      credito: { codigo: "2.1.9.01", nome: "Transitória CRÉDITOS (Passivo)" },
      historico: "OFX: {descricao_extrato}",
      keywords: ["ofx", "importação", "entrada", "crédito", "recebimento", "pix", "ted", "transferência recebida"]
    },
    {
      operacao: "Importação OFX - SAÍDA de Dinheiro (Débito no Extrato)",
      debito: { codigo: "1.1.9.01", nome: "Transitória DÉBITOS (Ativo)" },
      credito: { codigo: "1.1.1.xx", nome: "Banco (Sicredi/Bradesco/etc)" },
      historico: "OFX: {descricao_extrato}",
      keywords: ["ofx", "importação", "saída", "débito", "pagamento", "pix", "ted", "transferência enviada"]
    },
    {
      operacao: "Classificação ENTRADA - Baixa Transitória",
      debito: { codigo: "2.1.9.01", nome: "Transitória CRÉDITOS" },
      credito: { codigo: "xxx", nome: "{Conta de Origem - Cliente/Receita/etc}" },
      historico: "Classificação: {descricao_operacao}",
      keywords: ["classificação", "entrada", "recebimento", "baixa"]
    },
    {
      operacao: "Classificação SAÍDA - Baixa Transitória",
      debito: { codigo: "xxx", nome: "{Conta de Destino - Despesa/Fornecedor/etc}" },
      credito: { codigo: "1.1.9.01", nome: "Transitória DÉBITOS" },
      historico: "Classificação: {descricao_operacao}",
      keywords: ["classificação", "saída", "pagamento", "baixa"]
    }
  ]
};

// Keywords adicionais para identificação automática por descrição OFX
const OFX_PATTERNS = {
  // ENTRADAS (Créditos no extrato)
  RECEITAS: {
    patterns: [
      { regex: /PIX\s+REC.*(?:CLIENTE|RECEB)/i, tipo: "RECEBIMENTO_CLIENTE" },
      { regex: /TED.*(?:RECEB|CRED)/i, tipo: "RECEBIMENTO_CLIENTE" },
      { regex: /DEPOSITO/i, tipo: "DEPOSITO" },
      { regex: /RESGATE.*(?:APLIC|POUP|CDB)/i, tipo: "RESGATE_APLICACAO" },
      { regex: /RENDIMENTO/i, tipo: "RENDIMENTO_APLICACAO" },
      { regex: /JUROS.*(?:CRED|RECEB)/i, tipo: "JUROS_RECEBIDOS" },
      { regex: /ESTORNO/i, tipo: "ESTORNO" }
    ]
  },
  // SAÍDAS (Débitos no extrato)
  DESPESAS: {
    patterns: [
      { regex: /PIX\s+(?:ENV|TRANS).*(?:PGTO|PAG)/i, tipo: "PAGAMENTO_PIX" },
      { regex: /TED.*(?:PGTO|PAG|ENV)/i, tipo: "PAGAMENTO_TED" },
      { regex: /TARIFA|TAR\s+(?:COM|COB|LIQ|TED|PIX)/i, tipo: "TARIFA_BANCARIA" },
      { regex: /SAQUE/i, tipo: "SAQUE" },
      { regex: /APLICACAO|APLIC/i, tipo: "APLICACAO_FINANCEIRA" },
      { regex: /IOF/i, tipo: "IOF" },
      { regex: /(?:DEB|PGTO).*ENERGIA|CELG|ENEL|CEMIG|LIGHT/i, tipo: "ENERGIA_ELETRICA" },
      { regex: /(?:DEB|PGTO).*AGUA|SANEAGO|SABESP/i, tipo: "AGUA_ESGOTO" },
      { regex: /(?:DEB|PGTO).*(?:TELEFONE|INTERNET|VIVO|CLARO|TIM|OI)/i, tipo: "TELEFONE_INTERNET" },
      { regex: /(?:DEB|PGTO).*ALUGUEL/i, tipo: "ALUGUEL" },
      { regex: /DAS\s+SIMPLES|SIMPLES\s+NACIONAL|MEI/i, tipo: "SIMPLES_NACIONAL" },
      { regex: /DARF/i, tipo: "DARF_IMPOSTO" },
      { regex: /GPS|INSS/i, tipo: "GPS_INSS" },
      { regex: /FGTS|GRF/i, tipo: "FGTS" },
      { regex: /ISS|ISSQN/i, tipo: "ISS" },
      { regex: /ICMS/i, tipo: "ICMS" },
      { regex: /SALARIO|FOLHA|PGTO.*FUNC/i, tipo: "SALARIO" },
      { regex: /PRO.?LABORE/i, tipo: "PRO_LABORE" },
      { regex: /FERIAS/i, tipo: "FERIAS" },
      { regex: /13.?SALARIO|DECIMO.*TERCEIRO/i, tipo: "DECIMO_TERCEIRO" },
      { regex: /COMBUSTIVEL|POSTO|SHELL|IPIRANGA|PETROB/i, tipo: "COMBUSTIVEL" },
      { regex: /CONTABILIDADE|HONORAR.*CONT/i, tipo: "HONORARIOS_CONTABEIS" },
      { regex: /ADVOCACIA|HONORAR.*ADV/i, tipo: "HONORARIOS_ADVOCATICIOS" },
      { regex: /SEGURO/i, tipo: "SEGURO" }
    ]
  },
  // Transferências entre contas próprias
  TRANSFERENCIAS: {
    patterns: [
      { regex: /TRANSF.*MESMA.*TITULARIDADE/i, tipo: "TRANSFERENCIA_PROPRIA" },
      { regex: /PIX.*(?:AMPLA|PROPRIO|MESMA)/i, tipo: "TRANSFERENCIA_PROPRIA" },
      { regex: /TED.*(?:AMPLA|PROPRIO|MESMA)/i, tipo: "TRANSFERENCIA_PROPRIA" }
    ]
  }
};

// Função principal
async function main() {
  console.log('='.repeat(60));
  console.log('EXTRAÇÃO DE CONHECIMENTO CONTÁBIL BRASILEIRO');
  console.log('='.repeat(60));
  console.log();

  const results = {
    metadata: {
      generated_at: new Date().toISOString(),
      source: 'Pesquisa web via Serper.dev + Base de conhecimento estruturada',
      version: '1.0.0'
    },
    knowledge_base: KNOWLEDGE_BASE,
    ofx_patterns: OFX_PATTERNS,
    search_results: []
  };

  // Executar pesquisas no Serper
  console.log('Executando pesquisas no Serper.dev...\n');
  
  for (const queryConfig of QUERIES) {
    console.log(`📡 Pesquisando: "${queryConfig.query}"`);
    
    const searchResult = await searchSerper(queryConfig.query);
    
    if (searchResult && searchResult.organic) {
      const organicResults = searchResult.organic.slice(0, 5);
      
      results.search_results.push({
        query: queryConfig.query,
        category: queryConfig.category,
        results: organicResults.map(r => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          position: r.position
        }))
      });
      
      console.log(`   ✓ ${organicResults.length} resultados encontrados`);
    } else {
      console.log(`   ✗ Nenhum resultado ou erro`);
    }
    
    // Aguardar entre requisições para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Estatísticas
  console.log('\n' + '='.repeat(60));
  console.log('ESTATÍSTICAS DA BASE DE CONHECIMENTO');
  console.log('='.repeat(60));
  
  let totalLancamentos = 0;
  for (const [categoria, lancamentos] of Object.entries(KNOWLEDGE_BASE)) {
    console.log(`${categoria}: ${lancamentos.length} lançamentos`);
    totalLancamentos += lancamentos.length;
  }
  console.log(`\nTOTAL: ${totalLancamentos} tipos de lançamentos catalogados`);

  // Salvar resultados
  const outputPath = path.join(process.cwd(), 'data', 'accounting_knowledge_base.json');
  
  // Criar diretório se não existir
  const dataDir = path.dirname(outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n✅ Base de conhecimento salva em: ${outputPath}`);

  // Criar também versão simplificada para uso rápido
  const simplifiedBase = {
    categorias: Object.keys(KNOWLEDGE_BASE),
    total_lancamentos: totalLancamentos,
    keywords_index: {}
  };

  // Construir índice invertido de keywords
  for (const [categoria, lancamentos] of Object.entries(KNOWLEDGE_BASE)) {
    for (const lanc of lancamentos) {
      for (const kw of lanc.keywords) {
        if (!simplifiedBase.keywords_index[kw]) {
          simplifiedBase.keywords_index[kw] = [];
        }
        simplifiedBase.keywords_index[kw].push({
          categoria,
          operacao: lanc.operacao,
          debito: lanc.debito,
          credito: lanc.credito
        });
      }
    }
  }

  const indexPath = path.join(process.cwd(), 'data', 'accounting_keywords_index.json');
  fs.writeFileSync(indexPath, JSON.stringify(simplifiedBase, null, 2), 'utf-8');
  console.log(`✅ Índice de keywords salvo em: ${indexPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('EXTRAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log('='.repeat(60));
}

main().catch(console.error);
