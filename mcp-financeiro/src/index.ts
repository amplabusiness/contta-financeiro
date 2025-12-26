#!/usr/bin/env node
/**
 * MCP Financeiro - Servidor MCP para Ampla Contabilidade
 *
 * Este servidor expõe todas as funcionalidades da aplicação financeira
 * através do Model Context Protocol, permitindo que assistentes de IA
 * acessem e manipulem dados financeiros de forma segura.
 *
 * Áreas cobertas:
 * - Clientes e CRM
 * - Honorários e Faturamento
 * - Despesas e Contas a Pagar
 * - Contabilidade (DRE, Balanço, Balancete)
 * - Contratos
 * - Conciliação Bancária
 * - Análises e Relatórios
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// Importar módulos de conhecimento e operacionais
import { regrasContabeis, regrasFiscais, regrasDepartamentoPessoal, regrasAuditoria, regrasAmplaContabilidade } from "./knowledge/base-conhecimento.js";
import { ehPIX, extrairDadosPIX as extrairDadosPIXKnowledge, calcularScoreMatch, padroesPIX, regrasInadimplencia } from "./knowledge/pix-identificacao.js";
import { calcularRetencoes, codigosServico, passoAPassoEmissao, goianiaNFSe } from "./knowledge/nfse-emissao.js";
import { escritorioAmpla, familiaLeao, periodoAbertura, licoesAprendidas } from "./knowledge/memoria-ampla.js";
import { templatesWhatsApp, reguaCobranca, determinarFaseCobranca, montarMensagem } from "./modules/whatsapp-cobranca.js";
import { gerarPrevisaoFluxoCaixa, gerarRelatorioResumo as gerarResumoFluxo, configPrevisao, gerarDespesasFixasMes } from "./modules/previsao-fluxo-caixa.js";
import { calcularScoreChurn, analisarChurnGeral, gerarRelatorioChurn, configChurn } from "./modules/analise-churn.js";
import { analisarHonorario, gerarComparativoGeral, gerarRelatorioComparativo, tabelaReferenciaGoiania, custosOperacionais } from "./modules/comparativo-honorarios.js";
import { identificarTipoTransacao, extrairDadosPIX as extrairDadosPIXConciliacao, conciliarAutomaticamente, formatarRelatorioConciliacao } from "./modules/conciliacao-bancaria.js";
import { gerarDashboardOKR, formatarDashboardOKR, metasPadraoContabilidade, criarObjetivoPadrao } from "./modules/dashboard-metas.js";

// ============================================
// CONFIGURAÇÃO
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SERPER_API_KEY = process.env.SERPER_API_KEY || "";

let supabase: SupabaseClient;

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("[MCP Financeiro] SUPABASE_URL e SUPABASE_KEY são obrigatórios");
    process.exit(1);
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ============================================
// UTILIDADES
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function getCompetenceRange(competence: string): { start: string; end: string } {
  const [month, year] = competence.split("/").map(Number);
  const date = new Date(year, month - 1, 1);
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

async function pesquisarEconetSerper(pergunta: string, maxResultados = 5) {
  if (!SERPER_API_KEY) {
    throw new Error("SERPER_API_KEY nao configurada");
  }

  const query = `site:econeteditora.com.br ${pergunta}`;
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY,
    },
    body: JSON.stringify({
      q: query,
      gl: "br",
      hl: "pt",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro Serper: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const organic = Array.isArray(data.organic) ? data.organic.slice(0, maxResultados) : [];

  return {
    query,
    totalResultados: data?.searchInformation?.totalResults ?? null,
    resultados: organic.map((item: any) => ({
      titulo: item.title,
      link: item.link,
      resumo: item.snippet,
    })),
  };
}

// ============================================
// DEFINIÇÃO DAS TOOLS
// ============================================

const TOOLS = [
  // === CLIENTES ===
  {
    name: "listar_clientes",
    description: "Lista todos os clientes ativos com seus dados principais (CNPJ, nome, honorário mensal, status)",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["ativo", "inativo", "todos"], description: "Filtrar por status" },
        tipo: { type: "string", enum: ["normal", "pro_bono", "barter", "todos"], description: "Tipo de cliente" },
        limite: { type: "number", description: "Quantidade máxima de resultados" },
      },
    },
  },
  {
    name: "buscar_cliente",
    description: "Busca um cliente específico por CNPJ, nome ou ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        busca: { type: "string", description: "CNPJ, nome parcial ou ID do cliente" },
      },
      required: ["busca"],
    },
  },
  {
    name: "analisar_cliente",
    description: "Análise completa de um cliente: honorários, pagamentos, inadimplência, histórico",
    inputSchema: {
      type: "object" as const,
      properties: {
        cliente_id: { type: "string", description: "ID do cliente" },
        periodo_meses: { type: "number", description: "Quantidade de meses para análise (padrão: 12)" },
      },
      required: ["cliente_id"],
    },
  },
  {
    name: "clientes_inadimplentes",
    description: "Lista clientes com honorários em atraso, ordenados por valor devido",
    inputSchema: {
      type: "object" as const,
      properties: {
        dias_atraso_minimo: { type: "number", description: "Mínimo de dias em atraso (padrão: 1)" },
      },
    },
  },

  // === HONORÁRIOS ===
  {
    name: "listar_honorarios",
    description: "Lista honorários/faturas com filtros por período, status e cliente",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
        status: { type: "string", enum: ["pending", "paid", "overdue", "todos"], description: "Status da fatura" },
        cliente_id: { type: "string", description: "ID do cliente específico" },
      },
    },
  },
  {
    name: "resumo_honorarios",
    description: "Resumo financeiro dos honorários: total faturado, recebido, pendente, inadimplência",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY (padrão: mês atual)" },
      },
    },
  },
  {
    name: "evolucao_honorarios",
    description: "Evolução mensal dos honorários nos últimos N meses",
    inputSchema: {
      type: "object" as const,
      properties: {
        meses: { type: "number", description: "Quantidade de meses (padrão: 12)" },
      },
    },
  },

  // === DESPESAS ===
  {
    name: "listar_despesas",
    description: "Lista despesas com filtros por período, categoria e status",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
        categoria: { type: "string", description: "Categoria da despesa" },
        status: { type: "string", enum: ["pending", "paid", "overdue", "todos"], description: "Status" },
      },
    },
  },
  {
    name: "resumo_despesas",
    description: "Resumo das despesas por categoria no período",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
      },
    },
  },
  {
    name: "despesas_por_categoria",
    description: "Análise detalhada de despesas agrupadas por categoria",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
      },
    },
  },

  // === CONTABILIDADE ===
  {
    name: "gerar_dre",
    description: "Gera a Demonstração do Resultado do Exercício (DRE) do período",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
        comparar_anterior: { type: "boolean", description: "Comparar com mês anterior" },
      },
    },
  },
  {
    name: "gerar_balancete",
    description: "Gera o Balancete de Verificação do período",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
      },
    },
  },
  {
    name: "saldo_conta",
    description: "Consulta saldo de uma conta contábil específica",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo_conta: { type: "string", description: "Código da conta (ex: 1.1.1.01)" },
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
      },
      required: ["codigo_conta"],
    },
  },
  {
    name: "lancamentos_conta",
    description: "Lista lançamentos de uma conta contábil no período (Razão)",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo_conta: { type: "string", description: "Código da conta" },
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
      },
      required: ["codigo_conta"],
    },
  },

  // === FLUXO DE CAIXA ===
  {
    name: "fluxo_caixa",
    description: "Projeção de fluxo de caixa com entradas e saídas previstas",
    inputSchema: {
      type: "object" as const,
      properties: {
        dias: { type: "number", description: "Quantidade de dias para projeção (padrão: 30)" },
      },
    },
  },
  {
    name: "saldo_bancario",
    description: "Consulta saldo atual das contas bancárias",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // === CONTRATOS ===
  {
    name: "listar_contratos",
    description: "Lista contratos ativos com seus termos principais",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["ativo", "encerrado", "todos"], description: "Status do contrato" },
        cliente_id: { type: "string", description: "ID do cliente" },
      },
    },
  },
  {
    name: "contratos_vencendo",
    description: "Lista contratos próximos do vencimento",
    inputSchema: {
      type: "object" as const,
      properties: {
        dias: { type: "number", description: "Dias até o vencimento (padrão: 90)" },
      },
    },
  },

  // === ANÁLISES E INDICADORES ===
  {
    name: "indicadores_financeiros",
    description: "Calcula indicadores financeiros: margem, inadimplência, ticket médio, etc.",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
      },
    },
  },
  {
    name: "ranking_clientes",
    description: "Ranking de clientes por faturamento ou inadimplência",
    inputSchema: {
      type: "object" as const,
      properties: {
        criterio: { type: "string", enum: ["faturamento", "inadimplencia", "antiguidade"], description: "Critério do ranking" },
        limite: { type: "number", description: "Quantidade de resultados (padrão: 10)" },
      },
    },
  },
  {
    name: "diagnostico_financeiro",
    description: "Diagnóstico completo da saúde financeira da empresa",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
      },
    },
  },

  // === CONCILIAÇÃO ===
  {
    name: "transacoes_pendentes",
    description: "Lista transações bancárias pendentes de conciliação",
    inputSchema: {
      type: "object" as const,
      properties: {
        banco_id: { type: "string", description: "ID da conta bancária" },
      },
    },
  },

  // === GRUPOS ECONÔMICOS ===
  {
    name: "listar_grupos_economicos",
    description: "Lista grupos econômicos e seus membros",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "analisar_grupo_economico",
    description: "Análise consolidada de um grupo econômico",
    inputSchema: {
      type: "object" as const,
      properties: {
        grupo_id: { type: "string", description: "ID do grupo econômico" },
      },
      required: ["grupo_id"],
    },
  },

  // === REGRAS DE NEGÓCIO E AJUDA ===
  {
    name: "regras_negocio",
    description: "Consulta regras de negócio específicas da Ampla Contabilidade",
    inputSchema: {
      type: "object" as const,
      properties: {
        topico: {
          type: "string",
          enum: [
            "honorarios",
            "inadimplencia",
            "pro_bono",
            "barter",
            "contabilidade",
            "cobranca",
            "adiantamentos",
            "grupos_economicos"
          ],
          description: "Tópico das regras"
        },
      },
      required: ["topico"],
    },
  },

  // === WHATSAPP COBRANÇA ===
  {
    name: "enviar_cobranca_whatsapp",
    description: "Envia mensagem de cobrança via WhatsApp para cliente inadimplente",
    inputSchema: {
      type: "object" as const,
      properties: {
        cliente_id: { type: "string", description: "ID do cliente" },
        telefone: { type: "string", description: "Telefone do cliente (com DDD)" },
        template: {
          type: "string",
          enum: ["lembrete", "cobranca_amigavel", "cobranca_firme", "negociacao", "suspensao"],
          description: "Template de mensagem"
        },
        competencia: { type: "string", description: "Competência da cobrança (MM/YYYY)" },
        valor: { type: "number", description: "Valor devido" },
      },
      required: ["cliente_id", "telefone", "template"],
    },
  },
  {
    name: "listar_templates_cobranca",
    description: "Lista todos os templates de mensagens de cobrança disponíveis",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "regua_cobranca_cliente",
    description: "Determina a fase da régua de cobrança para um cliente baseado nos dias de atraso",
    inputSchema: {
      type: "object" as const,
      properties: {
        dias_atraso: { type: "number", description: "Dias de atraso do pagamento" },
      },
      required: ["dias_atraso"],
    },
  },

  // === PREVISÃO DE FLUXO DE CAIXA ===
  {
    name: "previsao_fluxo_caixa",
    description: "Gera previsão detalhada de fluxo de caixa para os próximos N dias",
    inputSchema: {
      type: "object" as const,
      properties: {
        dias: { type: "number", description: "Dias para projeção (padrão: 30)" },
        saldo_inicial: { type: "number", description: "Saldo inicial (opcional, busca do banco)" },
      },
    },
  },
  {
    name: "alertas_fluxo_caixa",
    description: "Lista alertas críticos do fluxo de caixa (saldo negativo, cobertura baixa)",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "indicadores_fluxo_caixa",
    description: "Retorna indicadores do fluxo de caixa (cobertura operacional, tendência)",
    inputSchema: {
      type: "object" as const,
      properties: {
        dias: { type: "number", description: "Período de análise em dias" },
      },
    },
  },

  // === ANÁLISE DE CHURN ===
  {
    name: "analise_churn_cliente",
    description: "Calcula score de risco de churn para um cliente específico",
    inputSchema: {
      type: "object" as const,
      properties: {
        cliente_id: { type: "string", description: "ID do cliente" },
      },
      required: ["cliente_id"],
    },
  },
  {
    name: "analise_churn_geral",
    description: "Análise geral de risco de churn da carteira de clientes",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "clientes_risco_churn",
    description: "Lista clientes com maior risco de churn (score alto)",
    inputSchema: {
      type: "object" as const,
      properties: {
        limite: { type: "number", description: "Quantidade de clientes (padrão: 10)" },
        risco_minimo: { type: "string", enum: ["baixo", "medio", "alto", "critico"], description: "Filtrar por risco mínimo" },
      },
    },
  },

  // === COMPARATIVO DE HONORÁRIOS ===
  {
    name: "analise_honorario_cliente",
    description: "Analisa honorário de um cliente comparando com mercado e custos",
    inputSchema: {
      type: "object" as const,
      properties: {
        cliente_id: { type: "string", description: "ID do cliente" },
      },
      required: ["cliente_id"],
    },
  },
  {
    name: "comparativo_honorarios_geral",
    description: "Comparativo geral de honorários com referência de mercado",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "oportunidades_reajuste",
    description: "Lista clientes com oportunidade de reajuste de honorário",
    inputSchema: {
      type: "object" as const,
      properties: {
        limite: { type: "number", description: "Quantidade de clientes (padrão: 10)" },
      },
    },
  },
  {
    name: "tabela_referencia_mercado",
    description: "Consulta tabela de referência de honorários do mercado",
    inputSchema: {
      type: "object" as const,
      properties: {
        regime: { type: "string", enum: ["mei", "simples", "presumido", "real"], description: "Regime tributário" },
      },
    },
  },

  // === CONCILIAÇÃO BANCÁRIA ===
  {
    name: "conciliar_extrato",
    description: "Realiza conciliação automática de transações bancárias com lançamentos",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
        confianca_minima: { type: "number", description: "Confiança mínima para match (0-100, padrão: 80)" },
      },
    },
  },
  {
    name: "identificar_transacao",
    description: "Identifica tipo e classifica uma transação bancária pela descrição",
    inputSchema: {
      type: "object" as const,
      properties: {
        descricao: { type: "string", description: "Descrição da transação" },
        valor: { type: "number", description: "Valor da transação" },
      },
      required: ["descricao", "valor"],
    },
  },
  {
    name: "extrair_dados_pix",
    description: "Extrai dados (nome, CPF/CNPJ) de uma descrição de PIX",
    inputSchema: {
      type: "object" as const,
      properties: {
        descricao: { type: "string", description: "Descrição do PIX" },
      },
      required: ["descricao"],
    },
  },

  // === DASHBOARD DE METAS / OKRs ===
  {
    name: "dashboard_okrs",
    description: "Gera dashboard completo de OKRs com progresso e alertas",
    inputSchema: {
      type: "object" as const,
      properties: {
        periodo: { type: "string", description: "Período (ex: 2025-T1, 2025)" },
      },
    },
  },
  {
    name: "criar_objetivo",
    description: "Cria um novo objetivo (OKR)",
    inputSchema: {
      type: "object" as const,
      properties: {
        titulo: { type: "string", description: "Título do objetivo" },
        area: { type: "string", enum: ["comercial", "operacional", "financeiro", "pessoas", "qualidade", "tecnologia"], description: "Área do negócio" },
        responsavel: { type: "string", description: "Responsável pelo objetivo" },
        data_inicio: { type: "string", description: "Data de início (YYYY-MM-DD)" },
        data_fim: { type: "string", description: "Data de fim (YYYY-MM-DD)" },
      },
      required: ["titulo", "area", "responsavel"],
    },
  },
  {
    name: "atualizar_key_result",
    description: "Atualiza o valor atual de um Key Result",
    inputSchema: {
      type: "object" as const,
      properties: {
        kr_id: { type: "string", description: "ID do Key Result" },
        valor_atual: { type: "number", description: "Novo valor atual" },
      },
      required: ["kr_id", "valor_atual"],
    },
  },
  {
    name: "metas_padrao_contabilidade",
    description: "Lista metas padrão sugeridas para escritório de contabilidade",
    inputSchema: {
      type: "object" as const,
      properties: {
        area: { type: "string", enum: ["comercial", "operacional", "financeiro", "pessoas", "qualidade", "tecnologia", "todas"], description: "Área do negócio" },
      },
    },
  },

  // === BASE DE CONHECIMENTO ===
  {
    name: "consultar_conhecimento",
    description: "Consulta a base de conhecimento contábil, fiscal, DP e auditoria",
    inputSchema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          enum: ["contabil", "fiscal", "departamento_pessoal", "auditoria", "nfse", "pix", "ampla"],
          description: "Área de conhecimento"
        },
        topico: { type: "string", description: "Tópico específico (opcional)" },
      },
      required: ["area"],
    },
  },
  {
    name: "pesquisar_econet_contabil",
    description: "Pesquisa regras contabeis na Econet Editora via Serper.dev",
    inputSchema: {
      type: "object" as const,
      properties: {
        pergunta: { type: "string", description: "Pergunta ou tema contabel" },
        max_resultados: { type: "number", description: "Maximo de resultados (padrao: 5)" },
      },
      required: ["pergunta"],
    },
  },
  {
    name: "calcular_retencoes_nfse",
    description: "Calcula retenções (ISS, IRRF, CSRF, INSS) para emissão de NFS-e",
    inputSchema: {
      type: "object" as const,
      properties: {
        valor_servico: { type: "number", description: "Valor do serviço" },
        retencao_iss: { type: "boolean", description: "Reter ISS?" },
        aliquota_iss: { type: "number", description: "Alíquota ISS (0.02 a 0.05)" },
        simples_nacional: { type: "boolean", description: "Prestador é Simples Nacional?" },
        cessao_mao_obra: { type: "boolean", description: "É cessão de mão de obra?" },
      },
      required: ["valor_servico"],
    },
  },
  {
    name: "identificar_pagador_pix",
    description: "Identifica o cliente pagador a partir de dados de um PIX",
    inputSchema: {
      type: "object" as const,
      properties: {
        descricao_pix: { type: "string", description: "Descrição completa do PIX" },
        valor: { type: "number", description: "Valor recebido" },
      },
      required: ["descricao_pix"],
    },
  },
];

// ============================================
// IMPLEMENTAÇÃO DAS TOOLS
// ============================================

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // === CLIENTES ===
    case "listar_clientes": {
      let query = supabase
        .from("clients")
        .select("id, name, document, monthly_fee, is_active, is_pro_bono, is_barter, created_at")
        .order("name");

      if (args.status === "ativo") query = query.eq("is_active", true);
      else if (args.status === "inativo") query = query.eq("is_active", false);

      if (args.tipo === "pro_bono") query = query.eq("is_pro_bono", true);
      else if (args.tipo === "barter") query = query.eq("is_barter", true);
      else if (args.tipo === "normal") query = query.eq("is_pro_bono", false).eq("is_barter", false);

      if (args.limite) query = query.limit(args.limite as number);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return {
        total: data?.length || 0,
        clientes: data?.map(c => ({
          id: c.id,
          nome: c.name,
          cnpj: c.document,
          honorario_mensal: formatCurrency(c.monthly_fee || 0),
          status: c.is_active ? "Ativo" : "Inativo",
          tipo: c.is_pro_bono ? "Pro-Bono" : c.is_barter ? "Permuta" : "Normal",
        })),
      };
    }

    case "buscar_cliente": {
      const busca = (args.busca as string).replace(/[^\w\s]/g, "");

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .or(`name.ilike.%${busca}%,document.ilike.%${busca}%,id.eq.${busca}`)
        .limit(10);

      if (error) throw new Error(error.message);

      return {
        encontrados: data?.length || 0,
        clientes: data?.map(c => ({
          id: c.id,
          nome: c.name,
          cnpj: c.document,
          email: c.email,
          telefone: c.phone,
          honorario_mensal: formatCurrency(c.monthly_fee || 0),
          status: c.is_active ? "Ativo" : "Inativo",
          tipo: c.is_pro_bono ? "Pro-Bono" : c.is_barter ? "Permuta" : "Normal",
          data_cadastro: c.created_at ? formatDate(c.created_at) : null,
        })),
      };
    }

    case "analisar_cliente": {
      const clienteId = args.cliente_id as string;
      const meses = (args.periodo_meses as number) || 12;

      // Buscar dados do cliente
      const { data: cliente } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clienteId)
        .single();

      if (!cliente) throw new Error("Cliente não encontrado");

      // Buscar honorários
      const dataInicio = format(subMonths(new Date(), meses), "yyyy-MM-dd");
      const { data: honorarios } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", clienteId)
        .gte("due_date", dataInicio);

      const totalFaturado = honorarios?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const totalRecebido = honorarios?.filter(h => h.status === "paid").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const totalPendente = honorarios?.filter(h => h.status !== "paid").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;

      return {
        cliente: {
          nome: cliente.name,
          cnpj: cliente.document,
          honorario_mensal: formatCurrency(cliente.monthly_fee || 0),
          status: cliente.is_active ? "Ativo" : "Inativo",
        },
        analise_periodo: {
          meses_analisados: meses,
          total_faturado: formatCurrency(totalFaturado),
          total_recebido: formatCurrency(totalRecebido),
          total_pendente: formatCurrency(totalPendente),
          taxa_pagamento: totalFaturado > 0 ? `${((totalRecebido / totalFaturado) * 100).toFixed(1)}%` : "N/A",
          quantidade_faturas: honorarios?.length || 0,
          faturas_pagas: honorarios?.filter(h => h.status === "paid").length || 0,
          faturas_pendentes: honorarios?.filter(h => h.status !== "paid").length || 0,
        },
      };
    }

    case "clientes_inadimplentes": {
      const diasMinimo = (args.dias_atraso_minimo as number) || 1;
      const dataLimite = format(subMonths(new Date(), 0), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name, document, phone, email)
        `)
        .eq("status", "pending")
        .lt("due_date", dataLimite)
        .order("due_date", { ascending: true });

      if (error) throw new Error(error.message);

      // Agrupar por cliente
      const porCliente = new Map<string, { cliente: any; faturas: any[]; total: number }>();

      data?.forEach(inv => {
        const clienteId = inv.client?.id;
        if (!clienteId) return;

        if (!porCliente.has(clienteId)) {
          porCliente.set(clienteId, {
            cliente: inv.client,
            faturas: [],
            total: 0,
          });
        }

        const entry = porCliente.get(clienteId)!;
        entry.faturas.push(inv);
        entry.total += inv.amount || 0;
      });

      const resultado = Array.from(porCliente.values())
        .sort((a, b) => b.total - a.total)
        .map(item => ({
          cliente: {
            nome: item.cliente.name,
            cnpj: item.cliente.document,
            telefone: item.cliente.phone,
            email: item.cliente.email,
          },
          total_devido: formatCurrency(item.total),
          quantidade_faturas: item.faturas.length,
          fatura_mais_antiga: item.faturas[0]?.due_date ? formatDate(item.faturas[0].due_date) : null,
        }));

      return {
        total_inadimplentes: resultado.length,
        total_valor_devido: formatCurrency(Array.from(porCliente.values()).reduce((sum, i) => sum + i.total, 0)),
        clientes: resultado,
      };
    }

    // === HONORÁRIOS ===
    case "listar_honorarios": {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name, document)
        `)
        .order("due_date", { ascending: false });

      if (args.competencia) {
        const { start, end } = getCompetenceRange(args.competencia as string);
        query = query.gte("due_date", start).lte("due_date", end);
      }

      if (args.status && args.status !== "todos") {
        query = query.eq("status", args.status);
      }

      if (args.cliente_id) {
        query = query.eq("client_id", args.cliente_id);
      }

      const { data, error } = await query.limit(100);
      if (error) throw new Error(error.message);

      return {
        total: data?.length || 0,
        honorarios: data?.map(h => ({
          id: h.id,
          cliente: h.client?.name,
          valor: formatCurrency(h.amount || 0),
          vencimento: h.due_date ? formatDate(h.due_date) : null,
          competencia: h.competence,
          status: h.status === "paid" ? "Pago" : h.status === "pending" ? "Pendente" : "Vencido",
        })),
      };
    }

    case "resumo_honorarios": {
      const competencia = (args.competencia as string) || format(new Date(), "MM/yyyy");
      const { start, end } = getCompetenceRange(competencia);

      const { data, error } = await supabase
        .from("invoices")
        .select("amount, status")
        .gte("due_date", start)
        .lte("due_date", end);

      if (error) throw new Error(error.message);

      const total = data?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const recebido = data?.filter(h => h.status === "paid").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const pendente = data?.filter(h => h.status === "pending").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const vencido = data?.filter(h => h.status === "overdue").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;

      return {
        competencia,
        resumo: {
          total_faturado: formatCurrency(total),
          total_recebido: formatCurrency(recebido),
          total_pendente: formatCurrency(pendente),
          total_vencido: formatCurrency(vencido),
          taxa_recebimento: total > 0 ? `${((recebido / total) * 100).toFixed(1)}%` : "0%",
          taxa_inadimplencia: total > 0 ? `${((vencido / total) * 100).toFixed(1)}%` : "0%",
        },
        quantidades: {
          total_faturas: data?.length || 0,
          pagas: data?.filter(h => h.status === "paid").length || 0,
          pendentes: data?.filter(h => h.status === "pending").length || 0,
          vencidas: data?.filter(h => h.status === "overdue").length || 0,
        },
      };
    }

    // === DESPESAS ===
    case "listar_despesas": {
      let query = supabase
        .from("expenses")
        .select("*")
        .order("due_date", { ascending: false });

      if (args.competencia) {
        const { start, end } = getCompetenceRange(args.competencia as string);
        query = query.gte("due_date", start).lte("due_date", end);
      }

      if (args.categoria) {
        query = query.eq("category", args.categoria);
      }

      if (args.status && args.status !== "todos") {
        query = query.eq("status", args.status);
      }

      const { data, error } = await query.limit(100);
      if (error) throw new Error(error.message);

      return {
        total: data?.length || 0,
        despesas: data?.map(d => ({
          id: d.id,
          descricao: d.description,
          categoria: d.category,
          valor: formatCurrency(d.amount || 0),
          vencimento: d.due_date ? formatDate(d.due_date) : null,
          status: d.status === "paid" ? "Pago" : d.status === "pending" ? "Pendente" : "Vencido",
        })),
      };
    }

    case "resumo_despesas": {
      const competencia = (args.competencia as string) || format(new Date(), "MM/yyyy");
      const { start, end } = getCompetenceRange(competencia);

      const { data, error } = await supabase
        .from("expenses")
        .select("amount, status, category")
        .gte("due_date", start)
        .lte("due_date", end);

      if (error) throw new Error(error.message);

      const total = data?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const pago = data?.filter(d => d.status === "paid").reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const pendente = data?.filter(d => d.status !== "paid").reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      // Agrupar por categoria
      const porCategoria = new Map<string, number>();
      data?.forEach(d => {
        const cat = d.category || "Sem categoria";
        porCategoria.set(cat, (porCategoria.get(cat) || 0) + (d.amount || 0));
      });

      return {
        competencia,
        resumo: {
          total_despesas: formatCurrency(total),
          total_pago: formatCurrency(pago),
          total_pendente: formatCurrency(pendente),
        },
        por_categoria: Array.from(porCategoria.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([categoria, valor]) => ({
            categoria,
            valor: formatCurrency(valor),
            percentual: total > 0 ? `${((valor / total) * 100).toFixed(1)}%` : "0%",
          })),
      };
    }

    // === CONTABILIDADE ===
    case "gerar_dre": {
      const competencia = (args.competencia as string) || format(new Date(), "MM/yyyy");
      const { start, end } = getCompetenceRange(competencia);

      // Buscar contas do plano
      const { data: contas } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .or("code.like.3%,code.like.4%");

      // Buscar lançamentos
      const { data: lancamentos } = await supabase
        .from("accounting_entry_lines")
        .select(`
          amount,
          type,
          account_id,
          entry:accounting_entries(entry_date, competence_date)
        `);

      // Filtrar por período
      const lancamentosFiltrados = lancamentos?.filter(l => {
        const data = l.entry?.competence_date || l.entry?.entry_date;
        return data && data >= start && data <= end;
      }) || [];

      // Calcular receitas (contas 3.x)
      const contasReceita = contas?.filter(c => c.code.startsWith("3")).map(c => c.id) || [];
      const receitas = lancamentosFiltrados
        .filter(l => contasReceita.includes(l.account_id))
        .reduce((sum, l) => sum + (l.type === "credit" ? l.amount : -l.amount), 0);

      // Calcular despesas (contas 4.x)
      const contasDespesa = contas?.filter(c => c.code.startsWith("4")).map(c => c.id) || [];
      const despesas = lancamentosFiltrados
        .filter(l => contasDespesa.includes(l.account_id))
        .reduce((sum, l) => sum + (l.type === "debit" ? l.amount : -l.amount), 0);

      const resultado = receitas - despesas;

      return {
        competencia,
        dre: {
          receita_bruta: formatCurrency(receitas),
          deducoes: formatCurrency(0),
          receita_liquida: formatCurrency(receitas),
          custos: formatCurrency(0),
          lucro_bruto: formatCurrency(receitas),
          despesas_operacionais: formatCurrency(despesas),
          resultado_operacional: formatCurrency(resultado),
          resultado_liquido: formatCurrency(resultado),
          margem_liquida: receitas > 0 ? `${((resultado / receitas) * 100).toFixed(1)}%` : "0%",
        },
      };
    }

    case "gerar_balancete": {
      const competencia = (args.competencia as string) || format(new Date(), "MM/yyyy");
      const { start, end } = getCompetenceRange(competencia);

      const { data: contas } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type")
        .eq("is_analytical", true)
        .order("code");

      const { data: lancamentos } = await supabase
        .from("accounting_entry_lines")
        .select(`
          amount,
          type,
          account_id,
          entry:accounting_entries(entry_date)
        `);

      const lancamentosFiltrados = lancamentos?.filter(l => {
        const data = l.entry?.entry_date;
        return data && data <= end;
      }) || [];

      const saldos = new Map<string, { debito: number; credito: number }>();

      lancamentosFiltrados.forEach(l => {
        if (!saldos.has(l.account_id)) {
          saldos.set(l.account_id, { debito: 0, credito: 0 });
        }
        const entry = saldos.get(l.account_id)!;
        if (l.type === "debit") entry.debito += l.amount;
        else entry.credito += l.amount;
      });

      const balancete = contas
        ?.filter(c => saldos.has(c.id))
        .map(c => {
          const s = saldos.get(c.id)!;
          const saldo = s.debito - s.credito;
          return {
            codigo: c.code,
            conta: c.name,
            debito: formatCurrency(s.debito),
            credito: formatCurrency(s.credito),
            saldo: formatCurrency(Math.abs(saldo)),
            natureza: saldo >= 0 ? "D" : "C",
          };
        }) || [];

      const totalDebito = Array.from(saldos.values()).reduce((sum, s) => sum + s.debito, 0);
      const totalCredito = Array.from(saldos.values()).reduce((sum, s) => sum + s.credito, 0);

      return {
        competencia,
        balancete,
        totais: {
          total_debito: formatCurrency(totalDebito),
          total_credito: formatCurrency(totalCredito),
          diferenca: formatCurrency(Math.abs(totalDebito - totalCredito)),
          equilibrado: Math.abs(totalDebito - totalCredito) < 0.01,
        },
      };
    }

    // === INDICADORES ===
    case "indicadores_financeiros": {
      const competencia = (args.competencia as string) || format(new Date(), "MM/yyyy");
      const { start, end } = getCompetenceRange(competencia);

      // Buscar honorários
      const { data: honorarios } = await supabase
        .from("invoices")
        .select("amount, status")
        .gte("due_date", start)
        .lte("due_date", end);

      // Buscar despesas
      const { data: despesas } = await supabase
        .from("expenses")
        .select("amount, status")
        .gte("due_date", start)
        .lte("due_date", end);

      // Buscar clientes ativos
      const { data: clientes } = await supabase
        .from("clients")
        .select("id, monthly_fee")
        .eq("is_active", true);

      const receitaTotal = honorarios?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const receitaRecebida = honorarios?.filter(h => h.status === "paid").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const despesaTotal = despesas?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const clientesAtivos = clientes?.length || 0;
      const ticketMedio = clientesAtivos > 0 ? receitaTotal / clientesAtivos : 0;

      return {
        competencia,
        indicadores: {
          receita_bruta: formatCurrency(receitaTotal),
          receita_recebida: formatCurrency(receitaRecebida),
          despesa_total: formatCurrency(despesaTotal),
          resultado_bruto: formatCurrency(receitaTotal - despesaTotal),
          margem_bruta: receitaTotal > 0 ? `${(((receitaTotal - despesaTotal) / receitaTotal) * 100).toFixed(1)}%` : "0%",
          taxa_inadimplencia: receitaTotal > 0 ? `${(((receitaTotal - receitaRecebida) / receitaTotal) * 100).toFixed(1)}%` : "0%",
          clientes_ativos: clientesAtivos,
          ticket_medio: formatCurrency(ticketMedio),
        },
      };
    }

    case "diagnostico_financeiro": {
      const competencia = (args.competencia as string) || format(new Date(), "MM/yyyy");

      // Chamar outros métodos para compor o diagnóstico
      const resumoHonorarios = await executeTool("resumo_honorarios", { competencia });
      const resumoDespesas = await executeTool("resumo_despesas", { competencia });
      const indicadores = await executeTool("indicadores_financeiros", { competencia });
      const inadimplentes = await executeTool("clientes_inadimplentes", { dias_atraso_minimo: 1 });

      return {
        competencia,
        diagnostico: {
          honorarios: resumoHonorarios,
          despesas: resumoDespesas,
          indicadores,
          inadimplencia: inadimplentes,
          alertas: [],
          recomendacoes: [
            "Acompanhar clientes com faturas vencidas há mais de 30 dias",
            "Revisar despesas por categoria para identificar oportunidades de redução",
            "Manter reserva de caixa equivalente a 2 meses de despesas",
          ],
        },
      };
    }

    // === REGRAS DE NEGÓCIO ===
    case "regras_negocio": {
      const topico = args.topico as string;

      const regras: Record<string, any> = {
        honorarios: {
          titulo: "Regras de Honorários",
          regras: [
            "Honorários são cobrados mensalmente, com vencimento configurável por cliente",
            "A competência segue o formato MM/YYYY",
            "Clientes Pro-Bono não geram cobrança",
            "Clientes Barter (permuta) têm tratamento especial de faturamento",
            "Saldo de abertura vai para Patrimônio Líquido (5.2.1.02), não para Receita",
          ],
        },
        inadimplencia: {
          titulo: "Gestão de Inadimplência",
          regras: [
            "D+1: Enviar lembrete por e-mail",
            "D+7: Cobrança amigável via WhatsApp",
            "D+15: Contato telefônico",
            "D+30: Negociação formal",
            "D+60: Suspensão de serviços + ação jurídica",
          ],
          indicador_saudavel: "Taxa de inadimplência < 5%",
        },
        pro_bono: {
          titulo: "Clientes Pro-Bono",
          regras: [
            "Não geram faturamento",
            "Devem ter justificativa documentada",
            "Revisão periódica (semestral) da necessidade",
            "Podem ser convertidos para Barter ou cliente regular",
          ],
        },
        barter: {
          titulo: "Clientes Barter (Permuta)",
          regras: [
            "Serviços são trocados por outros serviços/produtos",
            "Valor deve ser equivalente ao honorário normal",
            "Contrato deve especificar os termos da permuta",
            "Contabilização segue regime de competência",
          ],
        },
        contabilidade: {
          titulo: "Regras Contábeis",
          regras: [
            "Fonte única da verdade: accounting_entry_lines",
            "Partida dobrada obrigatória (débito = crédito)",
            "Regime de competência para receitas e despesas",
            "Saldo de abertura credita PL (5.2.1.02)",
            "DRE: contas 3.x (receitas) e 4.x (despesas)",
          ],
        },
        cobranca: {
          titulo: "Processo de Cobrança",
          regras: [
            "Geração automática de boletos via Cora",
            "Envio de cobrança por e-mail e WhatsApp",
            "Cartas de cobrança para atrasos > 30 dias",
            "Confissão de dívida para acordos",
            "Protesto de títulos como último recurso",
          ],
        },
        adiantamentos: {
          titulo: "Adiantamentos a Sócios",
          regras: [
            "Todo gasto pessoal da família = Adiantamento a Sócios (1.1.3.04.xx)",
            "NUNCA classificar como despesa operacional",
            "Contas separadas por sócio para controle",
            "Não afeta o DRE da empresa",
            "Compensação via distribuição de lucros",
          ],
        },
        grupos_economicos: {
          titulo: "Grupos Econômicos",
          regras: [
            "Clientes do mesmo grupo podem ter cobrança consolidada",
            "Análise de inadimplência considera o grupo todo",
            "Descontos por volume aplicáveis",
            "Responsabilidade solidária em caso de inadimplência",
          ],
        },
      };

      return regras[topico] || { erro: "Tópico não encontrado" };
    }

    // === WHATSAPP COBRANÇA ===
    case "listar_templates_cobranca": {
      return {
        templates: Object.entries(templatesWhatsApp).map(([key, template]) => ({
          id: key,
          titulo: template.titulo,
          variaveis: template.variaveis,
          preview: template.mensagem.substring(0, 100) + "...",
        })),
        regua_cobranca: reguaCobranca,
      };
    }

    case "regua_cobranca_cliente": {
      const diasAtraso = args.dias_atraso as number;
      const fase = determinarFaseCobranca(diasAtraso);

      return {
        dias_atraso: diasAtraso,
        fase: fase ? {
          dias: fase.dias,
          nome: fase.fase,
          acao: fase.acao,
          canal: fase.canal,
          template: fase.template,
        } : null,
        proxima_acao: fase?.acao || "Sem ação prevista",
        regua_completa: reguaCobranca,
      };
    }

    case "enviar_cobranca_whatsapp": {
      // Nota: Esta tool prepara a mensagem mas não envia diretamente
      // O envio real requer configuração do WhatsApp Cloud API
      const template = args.template as string;
      const templateKey = `template_${template}` as keyof typeof templatesWhatsApp;

      const mensagem = montarMensagem(templateKey, {
        cliente: "{{cliente}}",
        competencia: (args.competencia as string) || "{{competencia}}",
        valor: (args.valor as number)?.toLocaleString("pt-BR") || "{{valor}}",
        dias: "{{dias}}",
        pix: escritorioAmpla.contato.email,
      });

      return {
        status: "preparado",
        mensagem_preview: mensagem,
        template_usado: template,
        nota: "Para envio real, configure WHATSAPP_ACCESS_TOKEN",
      };
    }

    // === PREVISÃO DE FLUXO DE CAIXA ===
    case "previsao_fluxo_caixa": {
      const dias = (args.dias as number) || 30;
      const saldoInicial = (args.saldo_inicial as number) || 10000; // Default

      // Buscar receitas previstas
      const { data: faturas } = await supabase
        .from("invoices")
        .select("id, amount, due_date, status, client_id")
        .eq("status", "pending")
        .gte("due_date", format(new Date(), "yyyy-MM-dd"));

      const receitas = faturas?.map(f => ({
        clienteId: f.client_id,
        clienteNome: "Cliente",
        valor: f.amount || 0,
        dataVencimento: f.due_date,
        probabilidadeRecebimento: 0.8,
        historicoPagamento: "eventual" as const,
      })) || [];

      // Gerar despesas fixas
      const hoje = new Date();
      const despesas = gerarDespesasFixasMes(hoje.getFullYear(), hoje.getMonth() + 1);

      const previsao = gerarPrevisaoFluxoCaixa(saldoInicial, receitas, despesas, dias);

      return {
        resumo: gerarResumoFluxo(previsao),
        indicadores: previsao.indicadores,
        alertas: previsao.alertas,
        resumo_semanal: previsao.resumoSemanal,
      };
    }

    case "alertas_fluxo_caixa": {
      const saldoInicial = 10000;
      const previsao = gerarPrevisaoFluxoCaixa(saldoInicial, [], [], 30);

      return {
        total_alertas: previsao.alertas.length,
        alertas: previsao.alertas,
        indicadores: previsao.indicadores,
      };
    }

    case "indicadores_fluxo_caixa": {
      const dias = (args.dias as number) || 30;
      const previsao = gerarPrevisaoFluxoCaixa(10000, [], [], dias);

      return {
        periodo_dias: dias,
        indicadores: previsao.indicadores,
        configuracao: configPrevisao,
      };
    }

    // === ANÁLISE DE CHURN ===
    case "analise_churn_cliente": {
      const clienteId = args.cliente_id as string;

      const { data: cliente } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clienteId)
        .single();

      if (!cliente) throw new Error("Cliente não encontrado");

      // Buscar histórico de pagamentos
      const { data: faturas } = await supabase
        .from("invoices")
        .select("amount, status, due_date, paid_at")
        .eq("client_id", clienteId);

      const faturasVencidas = faturas?.filter(f => f.status !== "paid") || [];
      const mediaAtraso = faturasVencidas.length > 0 ? 15 : 0; // Simplificado

      const clienteAnalise = {
        id: cliente.id,
        nome: cliente.name,
        cnpj: cliente.document || "",
        dataInicio: cliente.created_at || new Date().toISOString(),
        honorarioMensal: cliente.monthly_fee || 0,
        mediaAtraso,
        ticketsAbertos: 0,
        reclamacoesUltimos6Meses: 0,
        tempoRelacionamentoMeses: Math.floor((Date.now() - new Date(cliente.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30)),
        regime: "simples" as const,
        complexidadeFiscal: "media" as const,
      };

      const score = calcularScoreChurn(clienteAnalise);

      return {
        cliente: cliente.name,
        score: score.score,
        risco: score.risco,
        probabilidade_churn: `${(score.probabilidadeChurn * 100).toFixed(1)}%`,
        fatores: score.fatores,
        acao_recomendada: score.acaoRecomendada,
        impacto_financeiro: formatCurrency(score.impactoFinanceiro),
      };
    }

    case "analise_churn_geral": {
      const { data: clientes } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true);

      const clientesAnalise = clientes?.map(c => ({
        id: c.id,
        nome: c.name,
        cnpj: c.document || "",
        dataInicio: c.created_at || new Date().toISOString(),
        honorarioMensal: c.monthly_fee || 0,
        mediaAtraso: 0,
        ticketsAbertos: 0,
        reclamacoesUltimos6Meses: 0,
        tempoRelacionamentoMeses: Math.floor((Date.now() - new Date(c.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30)),
        regime: "simples" as const,
        complexidadeFiscal: "media" as const,
      })) || [];

      const analise = analisarChurnGeral(clientesAnalise);

      return {
        relatorio: gerarRelatorioChurn(analise),
        dados: {
          total_clientes: analise.totalClientes,
          em_risco: analise.clientesEmRisco,
          receita_em_risco: formatCurrency(analise.receitaEmRisco),
          distribuicao: analise.distribuicaoRisco,
        },
        acoes: analise.acoesRecomendadas,
      };
    }

    case "clientes_risco_churn": {
      const limite = (args.limite as number) || 10;
      const riscoMinimo = args.risco_minimo as string;

      const { data: clientes } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true);

      const scores = clientes?.map(c => {
        const analise = {
          id: c.id,
          nome: c.name,
          cnpj: c.document || "",
          dataInicio: c.created_at || new Date().toISOString(),
          honorarioMensal: c.monthly_fee || 0,
          mediaAtraso: 0,
          ticketsAbertos: 0,
          reclamacoesUltimos6Meses: 0,
          tempoRelacionamentoMeses: Math.floor((Date.now() - new Date(c.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30)),
          regime: "simples" as const,
          complexidadeFiscal: "media" as const,
        };
        return calcularScoreChurn(analise);
      }) || [];

      let filtrados = scores;
      if (riscoMinimo) {
        const ordem = ["baixo", "medio", "alto", "critico"];
        const indiceMinimo = ordem.indexOf(riscoMinimo);
        filtrados = scores.filter(s => ordem.indexOf(s.risco) >= indiceMinimo);
      }

      return {
        clientes: filtrados
          .sort((a, b) => b.score - a.score)
          .slice(0, limite)
          .map(s => ({
            nome: s.clienteNome,
            score: s.score,
            risco: s.risco,
            acao: s.acaoRecomendada,
          })),
      };
    }

    // === COMPARATIVO DE HONORÁRIOS ===
    case "tabela_referencia_mercado": {
      const regime = args.regime as string;

      const tabela = regime
        ? tabelaReferenciaGoiania.filter(t => t.regime === regime)
        : tabelaReferenciaGoiania;

      return {
        tabela: tabela.map(t => ({
          regime: t.regime,
          funcionarios: `${t.faixaFuncionarios.min}-${t.faixaFuncionarios.max}`,
          faturamento: `${formatCurrency(t.faixaFaturamento.min)} - ${formatCurrency(t.faixaFaturamento.max)}`,
          honorario_minimo: formatCurrency(t.honorarioMinimo),
          honorario_medio: formatCurrency(t.honorarioMedio),
          honorario_maximo: formatCurrency(t.honorarioMaximo),
        })),
        custos_operacionais: custosOperacionais,
      };
    }

    case "comparativo_honorarios_geral": {
      const { data: clientes } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true);

      const clientesHonorario = clientes?.map(c => ({
        id: c.id,
        nome: c.name,
        cnpj: c.document || "",
        regime: "simples" as const,
        honorarioAtual: c.monthly_fee || 0,
        funcionarios: 0,
        faturamentoMensal: 50000,
        notasFiscaisMes: 20,
        complexidadeFiscal: "media" as const,
        temCertificado: true,
        temFolha: false,
        temFiscal: true,
        temContabilidade: true,
        servicosExtras: [],
        dataInicio: c.created_at || new Date().toISOString(),
      })) || [];

      const comparativo = gerarComparativoGeral(clientesHonorario);

      return {
        relatorio: gerarRelatorioComparativo(comparativo),
        dados: {
          total_clientes: comparativo.totalClientes,
          receita_mensal: formatCurrency(comparativo.receitaMensal),
          honorario_medio: formatCurrency(comparativo.honorarioMedio),
          distribuicao: comparativo.distribuicao,
          receita_potencial: formatCurrency(comparativo.receitaPotencial),
        },
      };
    }

    case "oportunidades_reajuste": {
      const limite = (args.limite as number) || 10;

      const { data: clientes } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true);

      const analises = clientes?.map(c => {
        const clienteHonorario = {
          id: c.id,
          nome: c.name,
          cnpj: c.document || "",
          regime: "simples" as const,
          honorarioAtual: c.monthly_fee || 0,
          funcionarios: 0,
          faturamentoMensal: 50000,
          notasFiscaisMes: 20,
          complexidadeFiscal: "media" as const,
          temCertificado: true,
          temFolha: false,
          temFiscal: true,
          temContabilidade: true,
          servicosExtras: [],
          dataInicio: c.created_at || new Date().toISOString(),
        };
        return analisarHonorario(clienteHonorario);
      }) || [];

      const oportunidades = analises
        .filter(a => a.reajusteSugerido.valor > 0)
        .sort((a, b) => b.reajusteSugerido.valor - a.reajusteSugerido.valor)
        .slice(0, limite);

      return {
        oportunidades: oportunidades.map(o => ({
          cliente: o.cliente.nome,
          honorario_atual: formatCurrency(o.cliente.honorarioAtual),
          honorario_sugerido: formatCurrency(o.cliente.honorarioAtual + o.reajusteSugerido.valor),
          reajuste_valor: formatCurrency(o.reajusteSugerido.valor),
          reajuste_percentual: `${o.reajusteSugerido.percentual.toFixed(1)}%`,
          justificativa: o.reajusteSugerido.justificativa,
          margem_atual: `${(o.margemLucro * 100).toFixed(1)}%`,
        })),
        receita_potencial_total: formatCurrency(oportunidades.reduce((sum, o) => sum + o.reajusteSugerido.valor, 0)),
      };
    }

    // === CONCILIAÇÃO BANCÁRIA ===
    case "identificar_transacao": {
      const descricao = args.descricao as string;
      const valor = args.valor as number;

      const identificacao = identificarTipoTransacao(descricao, valor);

      return {
        descricao_original: descricao,
        valor,
        identificacao: {
          tipo: identificacao.tipo,
          categoria: identificacao.categoria,
          confianca: `${identificacao.confianca}%`,
        },
        eh_pix: ehPIX(descricao),
      };
    }

    case "extrair_dados_pix": {
      const descricao = args.descricao as string;
      const dados = extrairDadosPIXConciliacao(descricao);

      return {
        descricao_original: descricao,
        dados_extraidos: dados,
        eh_pix: ehPIX(descricao),
      };
    }

    case "conciliar_extrato": {
      // Simplificado - em produção buscaria do banco
      return {
        status: "simulado",
        mensagem: "Conciliação bancária disponível via importação de OFX",
        instrucoes: [
          "1. Importe o arquivo OFX do extrato bancário",
          "2. O sistema identificará automaticamente as transações",
          "3. Matches serão sugeridos com base em valor e data",
          "4. Revise e confirme as conciliações sugeridas",
        ],
      };
    }

    // === DASHBOARD DE METAS / OKRs ===
    case "metas_padrao_contabilidade": {
      const area = args.area as string;

      if (area === "todas" || !area) {
        return { metas: metasPadraoContabilidade };
      }

      return {
        area,
        metas: metasPadraoContabilidade[area as keyof typeof metasPadraoContabilidade] || [],
      };
    }

    case "dashboard_okrs": {
      const periodo = (args.periodo as string) || format(new Date(), "yyyy");

      // Em produção, buscaria objetivos do banco
      // Por enquanto, retorna estrutura de exemplo
      return {
        periodo,
        status: "modelo",
        estrutura_okr: {
          objetivo: {
            titulo: "Exemplo de Objetivo",
            key_results: [
              { metrica: "Receita mensal", meta: 100000, atual: 85000 },
              { metrica: "Taxa de inadimplência", meta: 5, atual: 8 },
            ],
          },
        },
        metas_sugeridas: metasPadraoContabilidade,
        instrucoes: "Use 'criar_objetivo' para criar novos OKRs",
      };
    }

    // === BASE DE CONHECIMENTO ===
    case "consultar_conhecimento": {
      const area = args.area as string;

      const conhecimento: Record<string, any> = {
        contabil: regrasContabeis,
        fiscal: regrasFiscais,
        departamento_pessoal: regrasDepartamentoPessoal,
        auditoria: regrasAuditoria,
        nfse: {
          codigos_servico: codigosServico,
          passo_a_passo: passoAPassoEmissao,
          goiania: goianiaNFSe,
        },
        pix: {
          padroes: padroesPIX,
          regras_inadimplencia: regrasInadimplencia,
        },
        ampla: {
          escritorio: escritorioAmpla,
          familia_leao: familiaLeao,
          periodo_abertura: periodoAbertura,
          licoes_aprendidas: licoesAprendidas,
          regras: regrasAmplaContabilidade,
        },
      };

      return conhecimento[area] || { erro: "Área não encontrada" };
    }
    case "pesquisar_econet_contabil": {
      const pergunta = args.pergunta as string;
      const maxResultados = (args.max_resultados as number) || 5;
      return pesquisarEconetSerper(pergunta, maxResultados);
    }

    case "calcular_retencoes_nfse": {
      const valorServico = args.valor_servico as number;

      const retencoes = calcularRetencoes(valorServico, {
        retencaoISS: args.retencao_iss as boolean,
        aliquotaISS: args.aliquota_iss as number,
        simplesNacional: args.simples_nacional as boolean,
        cessaoMaoObra: args.cessao_mao_obra as boolean,
      });

      return {
        valor_bruto: formatCurrency(retencoes.valorBruto),
        retencoes: {
          ISS: formatCurrency(retencoes.ISS),
          IRRF: formatCurrency(retencoes.IRRF),
          PIS: formatCurrency(retencoes.PIS),
          COFINS: formatCurrency(retencoes.COFINS),
          CSLL: formatCurrency(retencoes.CSLL),
          INSS: formatCurrency(retencoes.INSS),
        },
        total_retencoes: formatCurrency(retencoes.totalRetencoes),
        valor_liquido: formatCurrency(retencoes.valorLiquido),
      };
    }

    case "identificar_pagador_pix": {
      const descricao = args.descricao_pix as string;
      const valor = args.valor as number;

      const dados = extrairDadosPIXKnowledge(descricao);

      // Buscar cliente pelo CPF/CNPJ ou nome
      let cliente = null;
      if (dados.cpfCnpj) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, document, monthly_fee")
          .eq("document", dados.cpfCnpj)
          .single();
        cliente = data;
      }

      if (!cliente && dados.nomeCompleto) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, document, monthly_fee")
          .ilike("name", `%${dados.nomeCompleto}%`)
          .limit(1)
          .single();
        cliente = data;
      }

      return {
        dados_extraidos: dados,
        cliente_identificado: cliente ? {
          id: cliente.id,
          nome: cliente.name,
          documento: cliente.document,
          honorario: formatCurrency(cliente.monthly_fee || 0),
        } : null,
        valor_recebido: valor ? formatCurrency(valor) : null,
        sugestao: cliente
          ? "Cliente identificado - vincular ao recebimento"
          : "Cliente não encontrado - verificar manualmente",
      };
    }

    default:
      throw new Error(`Tool não implementada: ${name}`);
  }
}

// ============================================
// DEFINIÇÃO DOS RESOURCES
// ============================================

const RESOURCES = [
  {
    uri: "ampla://clientes/ativos",
    name: "Clientes Ativos",
    description: "Lista de todos os clientes ativos da Ampla Contabilidade",
    mimeType: "application/json",
  },
  {
    uri: "ampla://financeiro/resumo-mensal",
    name: "Resumo Financeiro Mensal",
    description: "Resumo financeiro do mês atual",
    mimeType: "application/json",
  },
  {
    uri: "ampla://contabilidade/plano-contas",
    name: "Plano de Contas",
    description: "Estrutura completa do plano de contas",
    mimeType: "application/json",
  },
];

async function readResource(uri: string): Promise<string> {
  switch (uri) {
    case "ampla://clientes/ativos": {
      const { data } = await supabase
        .from("clients")
        .select("id, name, document, monthly_fee")
        .eq("is_active", true)
        .order("name");
      return JSON.stringify(data, null, 2);
    }
    case "ampla://financeiro/resumo-mensal": {
      const resultado = await executeTool("resumo_honorarios", {});
      return JSON.stringify(resultado, null, 2);
    }
    case "ampla://contabilidade/plano-contas": {
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("code, name, account_type, is_analytical")
        .order("code");
      return JSON.stringify(data, null, 2);
    }
    default:
      throw new Error(`Resource não encontrado: ${uri}`);
  }
}

// ============================================
// DEFINIÇÃO DOS PROMPTS
// ============================================

const PROMPTS = [
  {
    name: "analise_financeira_mensal",
    description: "Análise financeira completa do mês",
    arguments: [
      { name: "competencia", description: "Mês/Ano no formato MM/YYYY", required: false },
    ],
  },
  {
    name: "relatorio_inadimplencia",
    description: "Relatório detalhado de inadimplência com ações sugeridas",
    arguments: [],
  },
  {
    name: "diagnostico_empresa",
    description: "Diagnóstico completo da saúde financeira da empresa",
    arguments: [
      { name: "competencia", description: "Mês/Ano no formato MM/YYYY", required: false },
    ],
  },
  {
    name: "sugestao_cobranca",
    description: "Sugestões de ações de cobrança para cliente inadimplente",
    arguments: [
      { name: "cliente_id", description: "ID do cliente", required: true },
    ],
  },
];

async function getPrompt(name: string, args: Record<string, string>): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  switch (name) {
    case "analise_financeira_mensal": {
      const competencia = args.competencia || format(new Date(), "MM/yyyy");
      const dados = await executeTool("diagnostico_financeiro", { competencia });

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analise os seguintes dados financeiros da Ampla Contabilidade para ${competencia} e forneça um relatório executivo com insights e recomendações:\n\n${JSON.stringify(dados, null, 2)}`,
            },
          },
        ],
      };
    }
    case "relatorio_inadimplencia": {
      const dados = await executeTool("clientes_inadimplentes", { dias_atraso_minimo: 1 });

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analise a situação de inadimplência da Ampla Contabilidade e sugira ações específicas para cada cliente:\n\n${JSON.stringify(dados, null, 2)}\n\nConsidere as regras de cobrança: D+1 lembrete, D+7 WhatsApp, D+15 telefone, D+30 negociação, D+60 jurídico.`,
            },
          },
        ],
      };
    }
    case "diagnostico_empresa": {
      const competencia = args.competencia || format(new Date(), "MM/yyyy");
      const dados = await executeTool("diagnostico_financeiro", { competencia });

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Como consultor financeiro MBA, analise a saúde financeira da Ampla Contabilidade:\n\n${JSON.stringify(dados, null, 2)}\n\nForneça:\n1. Pontos fortes\n2. Pontos de atenção\n3. Riscos identificados\n4. Recomendações estratégicas\n5. KPIs a monitorar`,
            },
          },
        ],
      };
    }
    case "sugestao_cobranca": {
      const clienteId = args.cliente_id;
      const analise = await executeTool("analisar_cliente", { cliente_id: clienteId, periodo_meses: 12 });
      const regras = await executeTool("regras_negocio", { topico: "cobranca" });

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Sugira ações de cobrança para este cliente com base em seu histórico:\n\nCliente: ${JSON.stringify(analise, null, 2)}\n\nRegras de cobrança: ${JSON.stringify(regras, null, 2)}\n\nCrie um plano de ação personalizado.`,
            },
          },
        ],
      };
    }
    default:
      throw new Error(`Prompt não encontrado: ${name}`);
  }
}

// ============================================
// SERVIDOR MCP
// ============================================

async function main() {
  initSupabase();

  const server = new Server(
    {
      name: "mcp-financeiro",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Handler para listar tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handler para executar tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await executeTool(request.params.name, request.params.arguments || {});
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Erro: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Handler para listar resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
  }));

  // Handler para ler resources
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const content = await readResource(request.params.uri);
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: content,
        },
      ],
    };
  });

  // Handler para listar prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  // Handler para obter prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return getPrompt(request.params.name, request.params.arguments || {});
  });

  // Iniciar servidor
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP Financeiro] Servidor iniciado com sucesso");
}

main().catch((error) => {
  console.error("[MCP Financeiro] Erro fatal:", error);
  process.exit(1);
});
