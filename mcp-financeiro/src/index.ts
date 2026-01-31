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

// Carregar variáveis de ambiente do projeto pai
import * as fs from "fs";
import * as path from "path";

function loadEnvFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...valueParts] = trimmed.split("=");
          const value = valueParts.join("=").replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (e) {
    // Ignora erros de leitura
  }
}

// Carregar .env.local e .env do diretório pai
loadEnvFile(path.resolve(__dirname, "../../.env.local"));
loadEnvFile(path.resolve(__dirname, "../../.env"));

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
import { regrasContabeis, regrasFiscais, regrasDepartamentoPessoal, regrasAuditoria, regrasAmplaContabilidade } from "./knowledge/base-conhecimento";
import { ehPIX, extrairDadosPIX as extrairDadosPIXKnowledge, calcularScoreMatch, padroesPIX, regrasInadimplencia } from "./knowledge/pix-identificacao";
import { calcularRetencoes, codigosServico, passoAPassoEmissao, goianiaNFSe } from "./knowledge/nfse-emissao";
import { escritorioAmpla, familiaLeao, periodoAbertura, licoesAprendidas } from "./knowledge/memoria-ampla";
import { templatesWhatsApp, reguaCobranca, determinarFaseCobranca, montarMensagem } from "./modules/whatsapp-cobranca";
import { gerarPrevisaoFluxoCaixa, gerarRelatorioResumo as gerarResumoFluxo, configPrevisao, gerarDespesasFixasMes } from "./modules/previsao-fluxo-caixa";
import { calcularScoreChurn, analisarChurnGeral, gerarRelatorioChurn, configChurn } from "./modules/analise-churn";
import { analisarHonorario, gerarComparativoGeral, gerarRelatorioComparativo, tabelaReferenciaGoiania, custosOperacionais } from "./modules/comparativo-honorarios";
import { identificarTipoTransacao, extrairDadosPIX as extrairDadosPIXConciliacao, conciliarAutomaticamente, formatarRelatorioConciliacao } from "./modules/conciliacao-bancaria";
import { gerarDashboardOKR, formatarDashboardOKR, metasPadraoContabilidade, criarObjetivoPadrao } from "./modules/dashboard-metas";

// ============================================
// CONFIGURAÇÃO
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
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

  const data = await response.json() as { organic?: any[]; searchInformation?: { totalResults?: string } };
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

  // === IMPORTAÇÃO DE COBRANÇAS ===
  {
    name: "importar_cobrancas",
    description: "Importa cobranças do arquivo CSV da cobrança múltiplos clientes por transação bancária",
    inputSchema: {
      type: "object" as const,
      properties: {
        mes: { type: "string", description: "Mês no formato MM/YYYY (ex: 01/2025)" },
      },
      required: ["mes"],
    },
  },
  {
    name: "listar_cobrancas_periodo",
    description: "Lista todas as cobranças de um período com desdobramento de clientes",
    inputSchema: {
      type: "object" as const,
      properties: {
        mes: { type: "string", description: "Mês no formato MM/YYYY" },
      },
      required: ["mes"],
    },
  },
  {
    name: "detalhe_cobranca",
    description: "Mostra detalhe de uma cobrança específica (COB000005, etc) com todos os clientes e valores",
    inputSchema: {
      type: "object" as const,
      properties: {
        documento: { type: "string", description: "Número da cobrança (ex: COB000005)" },
      },
      required: ["documento"],
    },
  },
  {
    name: "validar_cobrancas",
    description: "Valida integridade das cobranças: verifica se clientes existem, valores batem, invoices foram criadas",
    inputSchema: {
      type: "object" as const,
      properties: {
        mes: { type: "string", description: "Mês no formato MM/YYYY" },
      },
      required: ["mes"],
    },
  },
  {
    name: "relatorio_cobrancas_mes",
    description: "Gera relatório executivo de cobranças: quantas, clientes, valores, taxa de sucesso",
    inputSchema: {
      type: "object" as const,
      properties: {
        mes: { type: "string", description: "Mês no formato MM/YYYY" },
      },
      required: ["mes"],
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
  {
    name: "classificar_transacao_bancaria",
    description: "Classifica uma transação bancária e cria o lançamento contábil completo (partida dobrada). Usado pelo Super Conciliador para confirmar classificações.",
    inputSchema: {
      type: "object" as const,
      properties: {
        transaction_id: { type: "string", description: "ID da transação bancária (UUID)" },
        rubrica_id: { type: "string", description: "ID da rubrica contábil para classificação (UUID)" },
        account_id: { type: "string", description: "ID da conta contábil de destino (opcional, pode vir da rubrica)" },
      },
      required: ["transaction_id", "rubrica_id"],
    },
  },
  {
    name: "listar_transacoes_pendentes",
    description: "Lista transações bancárias pendentes de classificação (sem rubrica_id ou sem lançamento contábil)",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato MM/YYYY" },
        limite: { type: "number", description: "Quantidade máxima de resultados (padrão: 50)" },
      },
    },
  },
  {
    name: "consultar_contas_transitorias",
    description: "Consulta saldos das contas transitórias (valores pendentes de classificação)",
    inputSchema: {
      type: "object" as const,
      properties: {
        data_corte: { type: "string", description: "Data de corte para saldos (YYYY-MM-DD, padrão: hoje)" },
      },
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

  // === GUARDIÃO MCP - LANÇAMENTOS CONTÁBEIS ===
  {
    name: "validar_lancamento",
    description: "GUARDIÃO: Valida um lançamento contábil ANTES de executar. Verifica: partida dobrada, contas sintéticas, idempotência.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tipo: { type: "string", description: "Tipo do lançamento (receita_honorarios, recebimento, despesa, saldo_abertura, desmembramento)" },
        linhas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              conta_code: { type: "string", description: "Código da conta (ex: 1.1.2.01.0001)" },
              debito: { type: "number", description: "Valor do débito" },
              credito: { type: "number", description: "Valor do crédito" },
            },
            required: ["conta_code"],
          },
          description: "Linhas do lançamento (débitos e créditos)"
        },
        reference_id: { type: "string", description: "ID único para idempotência" },
        reference_type: { type: "string", description: "Tipo da referência (honorarios, bank_transaction, etc)" },
      },
      required: ["tipo", "linhas"],
    },
  },
  {
    name: "criar_lancamento_contabil",
    description: "GUARDIÃO: Cria um lançamento contábil COM VALIDAÇÃO. Rejeita automaticamente: contas sintéticas, desbalanceamento, duplicações.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tipo: { type: "string", description: "Tipo do lançamento" },
        data: { type: "string", description: "Data do lançamento (YYYY-MM-DD)" },
        competencia: { type: "string", description: "Data de competência (YYYY-MM-DD)" },
        descricao: { type: "string", description: "Descrição do lançamento" },
        linhas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              conta_code: { type: "string", description: "Código da conta" },
              debito: { type: "number", description: "Valor do débito" },
              credito: { type: "number", description: "Valor do crédito" },
              historico: { type: "string", description: "Histórico da linha" },
            },
            required: ["conta_code"],
          },
        },
        reference_id: { type: "string", description: "ID único para idempotência" },
        reference_type: { type: "string", description: "Tipo da referência" },
      },
      required: ["tipo", "data", "descricao", "linhas"],
    },
  },
  {
    name: "gerar_honorarios_competencia",
    description: "GUARDIÃO: Gera honorários para todos os clientes ativos de uma competência. Valida e cria lançamentos D-Cliente C-Receita.",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência no formato YYYY-MM (ex: 2025-01)" },
      },
      required: ["competencia"],
    },
  },
  {
    name: "buscar_conta_cliente",
    description: "GUARDIÃO: Busca ou cria conta analítica para um cliente (subcontas de 1.1.2.01)",
    inputSchema: {
      type: "object" as const,
      properties: {
        cliente_id: { type: "string", description: "ID do cliente" },
        cliente_nome: { type: "string", description: "Nome do cliente (se não tiver ID)" },
      },
    },
  },
  {
    name: "verificar_integridade",
    description: "GUARDIÃO: Executa diagnóstico completo de integridade contábil",
    inputSchema: {
      type: "object" as const,
      properties: {
        competencia: { type: "string", description: "Competência específica (opcional)" },
      },
    },
  },

  // === BASE DE CONHECIMENTO EXPANDIDA - eSocial, NF, MBA ===
  {
    name: "consultar_evento_esocial",
    description: "Consulta eventos do eSocial (S-1000, S-1200, S-2200, etc.) para folha de pagamento",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código do evento (ex: S-1200, S-2200)" },
        tipo: { type: "string", enum: ["TABELA", "PERIODICO", "NAO_PERIODICO"], description: "Filtrar por tipo de evento" },
      },
    },
  },
  {
    name: "consultar_incidencia_tributaria",
    description: "Consulta incidências tributárias do eSocial (FGTS, INSS, IRRF)",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código da incidência (00 a 93)" },
      },
    },
  },
  {
    name: "consultar_categoria_trabalhador",
    description: "Consulta categorias de trabalhador do eSocial",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código da categoria (101 a 905)" },
      },
    },
  },
  {
    name: "consultar_motivo_afastamento",
    description: "Consulta motivos de afastamento do eSocial",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código do motivo (01 a 38)" },
      },
    },
  },
  {
    name: "consultar_motivo_desligamento",
    description: "Consulta motivos de desligamento do eSocial",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código do motivo (01 a 44)" },
      },
    },
  },
  {
    name: "consultar_cfop",
    description: "Consulta CFOP (Código Fiscal de Operações e Prestações) para emissão de NF",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código CFOP (ex: 5.102, 6.101)" },
        tipo: { type: "string", enum: ["ENTRADA", "SAIDA"], description: "Filtrar por tipo" },
      },
    },
  },
  {
    name: "consultar_cst_icms",
    description: "Consulta CST ICMS para regime normal",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código CST (00 a 90)" },
      },
    },
  },
  {
    name: "consultar_csosn",
    description: "Consulta CSOSN (Simples Nacional)",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código CSOSN (101 a 900)" },
      },
    },
  },
  {
    name: "consultar_cst_pis_cofins",
    description: "Consulta CST PIS/COFINS",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código CST (01 a 99)" },
      },
    },
  },
  {
    name: "consultar_servico_lc116",
    description: "Consulta serviços da LC 116 (lista de serviços sujeitos ao ISS)",
    inputSchema: {
      type: "object" as const,
      properties: {
        codigo: { type: "string", description: "Código do serviço (01 a 40)" },
      },
    },
  },
  {
    name: "consultar_indicador_mba",
    description: "Consulta indicadores financeiros para análise MBA",
    inputSchema: {
      type: "object" as const,
      properties: {
        nome: { type: "string", description: "Nome do indicador (ex: ROE, Liquidez Corrente)" },
        categoria: { type: "string", enum: ["liquidez", "rentabilidade", "endividamento", "atividade", "valuation"], description: "Categoria do indicador" },
      },
    },
  },
  {
    name: "buscar_modelo_lancamento",
    description: "Busca modelo de lançamento contábil por tipo ou palavras-chave",
    inputSchema: {
      type: "object" as const,
      properties: {
        texto: { type: "string", description: "Descrição da operação (ex: pagamento fornecedor, folha de pagamento)" },
        categoria: { type: "string", enum: ["administrativo", "fiscal", "trabalhista", "juridico", "financeiro"], description: "Categoria do lançamento" },
      },
    },
  },
  {
    name: "analise_financeira_completa",
    description: "MBA: Gera análise financeira completa com todos os indicadores",
    inputSchema: {
      type: "object" as const,
      properties: {
        empresa: { type: "string", description: "Nome da empresa" },
        periodo: { type: "string", description: "Período da análise (ex: 2025-01)" },
        ativo_circulante: { type: "number", description: "Ativo Circulante" },
        ativo_nao_circulante: { type: "number", description: "Ativo Não Circulante" },
        passivo_circulante: { type: "number", description: "Passivo Circulante" },
        passivo_nao_circulante: { type: "number", description: "Passivo Não Circulante" },
        patrimonio_liquido: { type: "number", description: "Patrimônio Líquido" },
        receita: { type: "number", description: "Receita Total" },
        lucro_liquido: { type: "number", description: "Lucro Líquido" },
      },
      required: ["empresa", "periodo", "ativo_circulante", "passivo_circulante", "patrimonio_liquido", "receita", "lucro_liquido"],
    },
  },
  {
    name: "calcular_ncg",
    description: "MBA: Calcula Necessidade de Capital de Giro",
    inputSchema: {
      type: "object" as const,
      properties: {
        contas_receber: { type: "number", description: "Contas a Receber" },
        estoques: { type: "number", description: "Estoques" },
        fornecedores: { type: "number", description: "Fornecedores" },
        outras_operacionais: { type: "number", description: "Outras contas operacionais (passivo)" },
      },
      required: ["contas_receber", "fornecedores"],
    },
  },
  {
    name: "analise_dupont",
    description: "MBA: Realiza análise DuPont (decomposição do ROE)",
    inputSchema: {
      type: "object" as const,
      properties: {
        lucro_liquido: { type: "number", description: "Lucro Líquido" },
        receita: { type: "number", description: "Receita Total" },
        ativo_total: { type: "number", description: "Ativo Total" },
        patrimonio_liquido: { type: "number", description: "Patrimônio Líquido" },
      },
      required: ["lucro_liquido", "receita", "ativo_total", "patrimonio_liquido"],
    },
  },
  {
    name: "listar_eventos_esocial",
    description: "Lista todos os eventos do eSocial por tipo",
    inputSchema: {
      type: "object" as const,
      properties: {
        tipo: { type: "string", enum: ["TABELA", "PERIODICO", "NAO_PERIODICO", "todos"], description: "Tipo de evento" },
      },
    },
  },
  {
    name: "listar_cfops",
    description: "Lista CFOPs por tipo (entrada/saída)",
    inputSchema: {
      type: "object" as const,
      properties: {
        tipo: { type: "string", enum: ["ENTRADA", "SAIDA", "todos"], description: "Tipo de operação" },
        uf: { type: "string", enum: ["INTERNA", "INTERESTADUAL", "EXTERIOR", "todas"], description: "Abrangência da operação" },
      },
    },
  },
  {
    name: "listar_modelos_lancamento",
    description: "Lista todos os modelos de lançamento contábil por categoria",
    inputSchema: {
      type: "object" as const,
      properties: {
        categoria: { type: "string", enum: ["administrativo", "fiscal", "trabalhista", "juridico", "financeiro", "todos"], description: "Categoria de lançamentos" },
      },
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
      const lancamentosFiltrados = lancamentos?.filter((l: any) => {
        const entry = l.entry as { competence_date?: string; entry_date?: string } | null;
        const data = entry?.competence_date || entry?.entry_date;
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

      const lancamentosFiltrados = lancamentos?.filter((l: any) => {
        const entry = l.entry as { entry_date?: string } | null;
        const data = entry?.entry_date;
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

    case "classificar_transacao_bancaria": {
      const transactionId = args.transaction_id as string;
      const rubricaId = args.rubrica_id as string;
      const accountId = args.account_id as string | undefined;

      // Chamar a função do banco de dados
      const { data, error } = await supabase.rpc("fn_classificar_transacao_bancaria", {
        p_transaction_id: transactionId,
        p_rubrica_id: rubricaId,
        p_account_id: accountId || null,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          detalhes: "Erro ao classificar transação bancária",
        };
      }

      return {
        success: data?.success ?? false,
        entry_id: data?.entry_id,
        debit_account: data?.debit_account,
        credit_account: data?.credit_account,
        amount: data?.amount ? formatCurrency(data.amount) : null,
        error: data?.error,
        mensagem: data?.success
          ? "Transação classificada com sucesso! Lançamento contábil criado com partida dobrada."
          : `Falha na classificação: ${data?.error}`,
      };
    }

    case "listar_transacoes_pendentes": {
      const competencia = args.competencia as string;
      const limite = (args.limite as number) || 50;

      let query = supabase
        .from("bank_transactions")
        .select(`
          id,
          transaction_date,
          description,
          amount,
          status,
          rubrica_id,
          bank_account:bank_accounts(name)
        `)
        .is("rubrica_id", null)
        .order("transaction_date", { ascending: false })
        .limit(limite);

      if (competencia) {
        const { start, end } = getCompetenceRange(competencia);
        query = query.gte("transaction_date", start).lte("transaction_date", end);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      // Separar entradas e saídas
      const entradas = (data || []).filter((t) => t.amount > 0);
      const saidas = (data || []).filter((t) => t.amount < 0);

      return {
        total: data?.length || 0,
        entradas: {
          quantidade: entradas.length,
          total: formatCurrency(entradas.reduce((s, t) => s + t.amount, 0)),
          transacoes: entradas.map((t) => ({
            id: t.id,
            data: formatDate(t.transaction_date),
            descricao: t.description?.substring(0, 60),
            valor: formatCurrency(t.amount),
            conta: (t.bank_account as any)?.name,
          })),
        },
        saidas: {
          quantidade: saidas.length,
          total: formatCurrency(saidas.reduce((s, t) => s + Math.abs(t.amount), 0)),
          transacoes: saidas.map((t) => ({
            id: t.id,
            data: formatDate(t.transaction_date),
            descricao: t.description?.substring(0, 60),
            valor: formatCurrency(t.amount),
            conta: (t.bank_account as any)?.name,
          })),
        },
        instrucoes: [
          "Use 'classificar_transacao_bancaria' para classificar cada transação",
          "Informe transaction_id e rubrica_id para criar o lançamento contábil",
          "O sistema garante partida dobrada (débito = crédito)",
        ],
      };
    }

    case "consultar_contas_transitorias": {
      const dataCorte = (args.data_corte as string) || format(new Date(), "yyyy-MM-dd");

      // Contas transitórias: 1.1.9.99 (entradas) e 2.1.9.99 (saídas)
      const { data: contas, error: contasError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .in("code", ["1.1.9.99", "2.1.9.99"]);

      if (contasError || !contas?.length) {
        return {
          success: false,
          error: "Contas transitórias não encontradas",
          instrucoes: [
            "Execute a migration 20260128170000_fix_bank_transaction_workflow.sql",
            "Isso criará as contas 1.1.9.99 e 2.1.9.99",
          ],
        };
      }

      const resultado: Record<string, any> = {};

      for (const conta of contas) {
        // Buscar saldo da conta transitória
        const { data: items } = await supabase
          .from("accounting_entry_items")
          .select(`
            debit,
            credit,
            entry:accounting_entries!inner(entry_date, is_draft)
          `)
          .eq("account_id", conta.id)
          .eq("entry.is_draft", false)
          .lte("entry.entry_date", dataCorte);

        const totalDebitos = (items || []).reduce((s, i) => s + Number(i.debit || 0), 0);
        const totalCreditos = (items || []).reduce((s, i) => s + Number(i.credit || 0), 0);

        // Para conta de ativo (1.x), saldo = débitos - créditos
        // Para conta de passivo (2.x), saldo = créditos - débitos
        const saldo = conta.code.startsWith("1")
          ? totalDebitos - totalCreditos
          : totalCreditos - totalDebitos;

        resultado[conta.code] = {
          nome: conta.name,
          debitos: formatCurrency(totalDebitos),
          creditos: formatCurrency(totalCreditos),
          saldo: formatCurrency(saldo),
          status: Math.abs(saldo) < 0.01 ? "✅ Zerado" : "⚠️ Pendente classificação",
        };
      }

      return {
        data_corte: formatDate(dataCorte),
        contas_transitorias: resultado,
        instrucoes: [
          "Saldos pendentes indicam transações aguardando classificação",
          "Use o Super Conciliador para classificar as transações",
          "Ou use 'listar_transacoes_pendentes' e 'classificar_transacao_bancaria'",
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
      const documento = dados.cnpj || dados.cpf;

      // Buscar cliente pelo CPF/CNPJ ou nome
      let cliente: { id: string; name: string; document: string; monthly_fee: number } | null = null;
      if (documento) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, document, monthly_fee")
          .eq("document", documento)
          .single();
        cliente = data;
      }

      if (!cliente && dados.nome) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, document, monthly_fee")
          .ilike("name", `%${dados.nome}%`)
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

    // === IMPORTAÇÃO DE COBRANÇAS ===
    case "importar_cobrancas": {
      const mes = args.mes as string;
      const [month, year] = mes.split("/").map(Number);

      // Buscar todas as transações de cobrança do período
      const { data: transacoes, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .ilike("description", "%COB%")
        .gte("transaction_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("transaction_date", `${year}-${String(month).padStart(2, "0")}-31`)
        .order("transaction_date");

      if (error) throw new Error(error.message);

      // Buscar invoices criadas no período
      const { data: invoicesCriadas } = await supabase
        .from("invoices")
        .select("*")
        .gte("paid_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("paid_date", `${year}-${String(month).padStart(2, "0")}-31`);

      const clientesPagos = new Set<string>();
      let totalReconciliado = 0;
      let totalClientes = 0;

      transacoes?.forEach(tx => {
        invoicesCriadas?.forEach(inv => {
          if (Math.abs(tx.amount - inv.amount) < 0.01 && 
              tx.transaction_date === inv.paid_date) {
            clientesPagos.add(inv.client_id);
            totalReconciliado += tx.amount;
            totalClientes++;
          }
        });
      });

      return {
        mes,
        periodo_cobranca: {
          cobranças_encontradas: transacoes?.length || 0,
          clientes_identificados: clientesPagos.size,
          total_reconciliado: formatCurrency(totalReconciliado),
          invoices_criadas: invoicesCriadas?.length || 0,
        },
        status: "✅ Importação concluída",
        recomendacao: "Verificar detalhes em 'listar_cobrancas_periodo' para validação completa",
      };
    }

    case "listar_cobrancas_periodo": {
      const mes = args.mes as string;
      const [month, year] = mes.split("/").map(Number);

      // Buscar transações de cobrança
      const { data: transacoes } = await supabase
        .from("bank_transactions")
        .select("*")
        .ilike("description", "%COB%")
        .gte("transaction_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("transaction_date", `${year}-${String(month).padStart(2, "0")}-31`)
        .order("transaction_date");

      // Buscar invoices do período
      const { data: invoices } = await supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name, document)
        `)
        .gte("paid_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("paid_date", `${year}-${String(month).padStart(2, "0")}-31`);

      // Agrupar por cobrança
      const cobrancasMap = new Map<string, { clientes: any[]; total: number; data: string; tx?: any }>();

      transacoes?.forEach(tx => {
        const docMatch = tx.description.match(/COB(\d+)/);
        if (docMatch) {
          const doc = `COB${docMatch[1]}`;
          if (!cobrancasMap.has(doc)) {
            cobrancasMap.set(doc, { clientes: [], total: 0, data: tx.transaction_date, tx });
          }
        }
      });

      invoices?.forEach(inv => {
        // Tentar vincular a uma cobrança pela data e valor aproximado
        let encontrou = false;
        for (const [doc, cobranca] of cobrancasMap) {
          if (cobranca.tx && 
              cobranca.data === inv.paid_date &&
              Math.abs(cobranca.tx.amount - inv.amount) < 0.01) {
            cobranca.clientes.push({
              nome: inv.client?.name,
              cnpj: inv.client?.document,
              valor: inv.amount,
              status: inv.status,
            });
            cobranca.total += inv.amount;
            encontrou = true;
            break;
          }
        }
      });

      const cobrancas = Array.from(cobrancasMap.entries()).map(([doc, data]) => ({
        documento: doc,
        data: formatDate(data.data),
        clientes_identificados: data.clientes.length,
        total: formatCurrency(data.total),
        clientes: data.clientes,
      }));

      return {
        mes,
        total_cobrancas: cobrancas.length,
        total_clientes: invoices?.length || 0,
        total_valor: formatCurrency(cobrancas.reduce((s, c) => s + parseFloat(c.total.replace(/\D/g, "")) / 100, 0)),
        cobrancas,
      };
    }

    case "detalhe_cobranca": {
      const documento = args.documento as string;

      // Buscar transação bancária
      const { data: transacao } = await supabase
        .from("bank_transactions")
        .select("*")
        .ilike("description", `%${documento}%`)
        .single();

      if (!transacao) {
        return { erro: `Cobrança ${documento} não encontrada` };
      }

      // Buscar invoices próximas pela data e valor
      const { data: invoices } = await supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name, document, phone, email)
        `)
        .eq("paid_date", transacao.transaction_date);

      const clientesBuscados = invoices?.filter(inv => 
        Math.abs(inv.amount - transacao.amount) < inv.amount * 0.01 ||
        Math.abs(invoices.reduce((s, i) => s + i.amount, 0) - transacao.amount) < 1
      ) || [];

      return {
        cobranca: {
          documento,
          data: formatDate(transacao.transaction_date),
          valor_total: formatCurrency(transacao.amount),
          descricao: transacao.description,
          saldo_apos: formatCurrency(transacao.balance_after || 0),
        },
        clientes: clientesBuscados.map(inv => ({
          nome: inv.client?.name,
          cnpj: inv.client?.document,
          email: inv.client?.email,
          telefone: inv.client?.phone,
          valor_pago: formatCurrency(inv.amount),
          data_pagamento: formatDate(inv.paid_date || inv.created_at),
          status: inv.status,
          numero_nota: inv.id.substring(0, 8),
        })),
        total_identificado: clientesBuscados.length,
      };
    }

    case "validar_cobrancas": {
      const mes = args.mes as string;
      const [month, year] = mes.split("/").map(Number);

      const { data: transacoes } = await supabase
        .from("bank_transactions")
        .select("*")
        .ilike("description", "%COB%")
        .gte("transaction_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("transaction_date", `${year}-${String(month).padStart(2, "0")}-31`);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("status", "paid")
        .gte("paid_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("paid_date", `${year}-${String(month).padStart(2, "0")}-31`);

      const validacoes = {
        cobrancas_encontradas: transacoes?.length || 0,
        invoices_pagas: invoices?.length || 0,
        valores_bancarios: formatCurrency(transacoes?.reduce((s, t) => s + t.amount, 0) || 0),
        valores_invoices: formatCurrency(invoices?.reduce((s, i) => s + i.amount, 0) || 0),
        diferenca: formatCurrency(Math.abs((transacoes?.reduce((s, t) => s + t.amount, 0) || 0) - (invoices?.reduce((s, i) => s + i.amount, 0) || 0))),
      };

      const status = parseFloat(validacoes.diferenca.replace(/\D/g, "")) < 1 ? "✅ VÁLIDO" : "⚠️ DIFERENÇAS DETECTADAS";

      return {
        mes,
        status,
        validacoes,
        recomendacao: parseFloat(validacoes.diferenca.replace(/\D/g, "")) > 1 
          ? "Verificar invoices não vinculadas ou valores digitados incorretos"
          : "Dados OK - Prosseguir com importação",
      };
    }

    case "relatorio_cobrancas_mes": {
      const mes = args.mes as string;
      const [month, year] = mes.split("/").map(Number);

      const { data: transacoes } = await supabase
        .from("bank_transactions")
        .select("*")
        .ilike("description", "%COB%")
        .gte("transaction_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("transaction_date", `${year}-${String(month).padStart(2, "0")}-31`);

      const { data: invoices } = await supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name)
        `)
        .eq("status", "paid")
        .gte("paid_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("paid_date", `${year}-${String(month).padStart(2, "0")}-31`);

      const totalBancario = transacoes?.reduce((s, t) => s + t.amount, 0) || 0;
      const totalInvoices = invoices?.reduce((s, i) => s + i.amount, 0) || 0;
      const clientesUnicos = new Set(invoices?.map(i => i.client_id) || []);

      return {
        periodo: mes,
        resumo_executivo: {
          cobranças: transacoes?.length || 0,
          clientes_pagantes: clientesUnicos.size,
          invoices_criadas: invoices?.length || 0,
          valor_total_entrada: formatCurrency(totalBancario),
          taxa_conversao: invoices?.length && transacoes?.length ? `${((invoices.length / (transacoes?.length || 1)) * 100).toFixed(1)}%` : "0%",
        },
        diferenca_valores: {
          valor_banco: formatCurrency(totalBancario),
          valor_invoices: formatCurrency(totalInvoices),
          diferenca: formatCurrency(Math.abs(totalBancario - totalInvoices)),
          status: Math.abs(totalBancario - totalInvoices) < 1 ? "✅ BALANCEADO" : "⚠️ DIVERGÊNCIAS",
        },
        top_cobrancas: transacoes
          ?.sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map((t, i) => ({
            posicao: i + 1,
            documento: t.description.match(/COB\d+/)?.[0] || "?",
            valor: formatCurrency(t.amount),
            data: formatDate(t.transaction_date),
          })),
      };
    }

    // === GUARDIÃO MCP - IMPLEMENTAÇÃO ===

    case "validar_lancamento": {
      const tipo = args.tipo as string;
      const linhas = args.linhas as Array<{ conta_code: string; debito?: number; credito?: number }>;
      const referenceId = args.reference_id as string | undefined;
      const referenceType = args.reference_type as string | undefined;

      const erros: string[] = [];
      const avisos: string[] = [];

      // Regra 1: Partida dobrada
      const totalDebitos = linhas.reduce((s, l) => s + (l.debito || 0), 0);
      const totalCreditos = linhas.reduce((s, l) => s + (l.credito || 0), 0);

      if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
        erros.push(`BLOQUEADO: Débitos (${formatCurrency(totalDebitos)}) ≠ Créditos (${formatCurrency(totalCreditos)})`);
      }

      // Regra 2: Contas sintéticas
      for (const linha of linhas) {
        const { data: conta } = await supabase
          .from("chart_of_accounts")
          .select("code, name, is_synthetic")
          .eq("code", linha.conta_code)
          .single();

        if (!conta) {
          erros.push(`BLOQUEADO: Conta ${linha.conta_code} não encontrada`);
        } else if (conta.is_synthetic) {
          erros.push(`BLOQUEADO: Conta ${linha.conta_code} (${conta.name}) é SINTÉTICA - use conta analítica`);
        }
      }

      // Regra 3: Idempotência
      if (referenceId && referenceType) {
        const { count } = await supabase
          .from("accounting_entries")
          .select("id", { count: "exact" })
          .eq("reference_id", referenceId)
          .eq("reference_type", referenceType);

        if ((count || 0) > 0) {
          erros.push(`BLOQUEADO: Já existe lançamento com reference_id=${referenceId}`);
        }
      } else {
        avisos.push("AVISO: Sem reference_id - risco de duplicação");
      }

      return {
        valido: erros.length === 0,
        pode_executar: erros.length === 0,
        erros,
        avisos,
        resumo: erros.length === 0
          ? `✅ Lançamento válido: D=${formatCurrency(totalDebitos)} C=${formatCurrency(totalCreditos)}`
          : `❌ Lançamento BLOQUEADO: ${erros.length} erro(s)`,
      };
    }

    case "criar_lancamento_contabil": {
      const tipo = args.tipo as string;
      const data = args.data as string;
      const competencia = args.competencia as string | undefined;
      const descricao = args.descricao as string;
      const linhas = args.linhas as Array<{ conta_code: string; debito?: number; credito?: number; historico?: string }>;
      const referenceId = args.reference_id as string | undefined;
      const referenceType = args.reference_type as string | undefined;

      // Primeiro, validar
      const validacao = await executeTool("validar_lancamento", {
        tipo,
        linhas,
        reference_id: referenceId,
        reference_type: referenceType,
      }) as { valido: boolean; erros: string[]; avisos: string[] };

      if (!validacao.valido) {
        return {
          sucesso: false,
          bloqueado_pelo_guardiao: true,
          erros: validacao.erros,
          mensagem: "❌ Lançamento REJEITADO pelo Guardião MCP",
        };
      }

      // Criar entry
      const totalDebitos = linhas.reduce((s, l) => s + (l.debito || 0), 0);

      const { data: entry, error: entryError } = await supabase
        .from("accounting_entries")
        .insert({
          entry_date: data,
          competence_date: competencia || data,
          entry_type: tipo,
          description: descricao,
          reference_type: referenceType,
          reference_id: referenceId,
          source_type: "mcp_guardiao",
          source_module: "mcp-financeiro",
          total_debit: totalDebitos,
          total_credit: totalDebitos,
          balanced: true,
        })
        .select("id")
        .single();

      if (entryError) {
        return {
          sucesso: false,
          erro: entryError.message,
        };
      }

      // Criar linhas
      const linhasParaInserir = [];
      for (const linha of linhas) {
        const { data: conta } = await supabase
          .from("chart_of_accounts")
          .select("id")
          .eq("code", linha.conta_code)
          .single();

        if (conta) {
          linhasParaInserir.push({
            entry_id: entry.id,
            account_id: conta.id,
            debit: linha.debito || 0,
            credit: linha.credito || 0,
            description: linha.historico || descricao,
          });
        }
      }

      const { error: linhasError } = await supabase
        .from("accounting_entry_lines")
        .insert(linhasParaInserir);

      if (linhasError) {
        // Rollback
        await supabase.from("accounting_entries").delete().eq("id", entry.id);
        return {
          sucesso: false,
          erro: linhasError.message,
        };
      }

      return {
        sucesso: true,
        entry_id: entry.id,
        tipo,
        valor: formatCurrency(totalDebitos),
        linhas: linhas.length,
        mensagem: `✅ Lançamento criado com sucesso (ID: ${entry.id})`,
        validado_por: "Guardião MCP",
      };
    }

    case "gerar_honorarios_competencia": {
      const competencia = args.competencia as string; // YYYY-MM
      const dataLancamento = `${competencia}-28`;
      const contaReceita = "3.1.1.01";

      // Buscar clientes ativos
      const { data: clientes } = await supabase
        .from("clients")
        .select("id, name, monthly_fee")
        .eq("status", "active")
        .gt("monthly_fee", 0);

      let gerados = 0;
      let jaExistentes = 0;
      let erros = 0;
      let valorTotal = 0;
      const detalhes: Array<{ cliente: string; status: string; valor?: string }> = [];

      for (const cliente of clientes || []) {
        const referenceId = `hon_${cliente.id}_${competencia}`;

        // Verificar idempotência
        const { count } = await supabase
          .from("accounting_entries")
          .select("id", { count: "exact" })
          .eq("reference_id", referenceId)
          .eq("reference_type", "honorarios");

        if ((count || 0) > 0) {
          jaExistentes++;
          detalhes.push({ cliente: cliente.name, status: "já existente" });
          continue;
        }

        // Buscar conta do cliente
        const contaCliente = await executeTool("buscar_conta_cliente", {
          cliente_id: cliente.id,
          cliente_nome: cliente.name,
        }) as { sucesso: boolean; conta_code?: string; erro?: string };

        if (!contaCliente.sucesso || !contaCliente.conta_code) {
          erros++;
          detalhes.push({ cliente: cliente.name, status: `erro: ${contaCliente.erro}` });
          continue;
        }

        // Criar lançamento via guardião
        const resultado = await executeTool("criar_lancamento_contabil", {
          tipo: "receita_honorarios",
          data: dataLancamento,
          competencia: `${competencia}-01`,
          descricao: `Honorários ${competencia} - ${cliente.name.substring(0, 40)}`,
          linhas: [
            { conta_code: contaCliente.conta_code, debito: cliente.monthly_fee, credito: 0, historico: `Honorários ${competencia}` },
            { conta_code: contaReceita, debito: 0, credito: cliente.monthly_fee, historico: `Receita honorários ${competencia}` },
          ],
          reference_id: referenceId,
          reference_type: "honorarios",
        }) as { sucesso: boolean };

        if (resultado.sucesso) {
          gerados++;
          valorTotal += Number(cliente.monthly_fee);
          detalhes.push({ cliente: cliente.name, status: "gerado", valor: formatCurrency(cliente.monthly_fee) });
        } else {
          erros++;
          detalhes.push({ cliente: cliente.name, status: "erro ao criar" });
        }
      }

      return {
        sucesso: erros === 0,
        competencia,
        resumo: {
          total_clientes: clientes?.length || 0,
          gerados,
          ja_existentes: jaExistentes,
          erros,
          valor_total: formatCurrency(valorTotal),
        },
        detalhes: detalhes.slice(0, 20), // Limitar detalhes
        mensagem: `✅ Honorários ${competencia}: ${gerados} gerados, ${jaExistentes} já existentes, ${erros} erros`,
      };
    }

    case "buscar_conta_cliente": {
      const clienteId = args.cliente_id as string | undefined;
      const clienteNome = args.cliente_nome as string | undefined;

      let nome = clienteNome;

      // Se tem ID, buscar nome
      if (clienteId) {
        const { data: cliente } = await supabase
          .from("clients")
          .select("name")
          .eq("id", clienteId)
          .single();
        nome = cliente?.name || clienteNome;
      }

      if (!nome) {
        return { sucesso: false, erro: "Nome do cliente não informado" };
      }

      // Buscar conta existente
      const { data: contaExistente } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .ilike("name", `%${nome.substring(0, 20)}%`)
        .like("code", "1.1.2.01.%")
        .not("name", "ilike", "%[CONSOLIDADO]%")
        .limit(1)
        .maybeSingle();

      if (contaExistente) {
        return {
          sucesso: true,
          conta_id: contaExistente.id,
          conta_code: contaExistente.code,
          conta_nome: contaExistente.name,
          criada: false,
        };
      }

      // Criar nova conta
      const { data: ultimaConta } = await supabase
        .from("chart_of_accounts")
        .select("code")
        .like("code", "1.1.2.01.%")
        .not("name", "ilike", "%[CONSOLIDADO]%")
        .order("code", { ascending: false })
        .limit(1)
        .single();

      const ultimoNumero = ultimaConta ? parseInt(ultimaConta.code.split(".").pop() || "0") : 0;
      const novoCodigo = `1.1.2.01.${String(ultimoNumero + 1).padStart(4, "0")}`;

      const { data: contaPai } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .eq("code", "1.1.2.01")
        .single();

      const { data: novaConta, error } = await supabase
        .from("chart_of_accounts")
        .insert({
          code: novoCodigo,
          name: nome.substring(0, 60),
          account_type: "ATIVO",
          nature: "DEVEDORA",
          level: 5,
          is_analytical: true,
          is_synthetic: false,
          accepts_entries: true,
          parent_id: contaPai?.id,
        })
        .select("id, code, name")
        .single();

      if (error) {
        return { sucesso: false, erro: error.message };
      }

      return {
        sucesso: true,
        conta_id: novaConta.id,
        conta_code: novaConta.code,
        conta_nome: novaConta.name,
        criada: true,
        mensagem: `Conta ${novoCodigo} criada para ${nome}`,
      };
    }

    case "verificar_integridade": {
      const erros: string[] = [];
      const avisos: string[] = [];
      const resultados: Record<string, unknown> = {};

      // Teste 1: Entries desbalanceados
      const { data: entries } = await supabase
        .from("accounting_entries")
        .select("id, description")
        .order("entry_date", { ascending: false })
        .limit(200);

      let desbalanceados = 0;
      for (const entry of entries || []) {
        const { data: lines } = await supabase
          .from("accounting_entry_lines")
          .select("debit, credit")
          .eq("entry_id", entry.id);

        const totalD = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalC = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);

        if (Math.abs(totalD - totalC) > 0.01) {
          erros.push(`Entry desbalanceado: ${entry.id} (D=${totalD} C=${totalC})`);
          desbalanceados++;
        }
      }
      resultados.entries_verificados = entries?.length || 0;
      resultados.desbalanceados = desbalanceados;

      // Teste 2: Duplicações
      const { data: refs } = await supabase
        .from("accounting_entries")
        .select("reference_id, reference_type")
        .not("reference_id", "is", null);

      const contagem: Record<string, number> = {};
      for (const r of refs || []) {
        const chave = `${r.reference_type}:${r.reference_id}`;
        contagem[chave] = (contagem[chave] || 0) + 1;
      }

      let duplicacoes = 0;
      for (const [chave, qtd] of Object.entries(contagem)) {
        if (qtd > 1) {
          erros.push(`Duplicação: ${chave} (${qtd}x)`);
          duplicacoes++;
        }
      }
      resultados.duplicacoes = duplicacoes;

      // Teste 3: Saldo banco Sicredi
      const { data: contaBanco } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .eq("code", "1.1.1.05")
        .single();

      if (contaBanco) {
        const { data: movsBanco } = await supabase
          .from("accounting_entry_lines")
          .select("debit, credit")
          .eq("account_id", contaBanco.id);

        const saldoBanco = (movsBanco || []).reduce((s, m) => s + Number(m.debit || 0) - Number(m.credit || 0), 0);
        resultados.saldo_banco_sicredi = formatCurrency(saldoBanco);
      }

      // Teste 4: Conta transitória
      const { data: contaTrans } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .eq("code", "1.1.9.01")
        .single();

      if (contaTrans) {
        const { data: movsTrans } = await supabase
          .from("accounting_entry_lines")
          .select("debit, credit")
          .eq("account_id", contaTrans.id);

        const saldoTrans = (movsTrans || []).reduce((s, m) => s + Number(m.debit || 0) - Number(m.credit || 0), 0);
        resultados.saldo_transitoria = formatCurrency(saldoTrans);

        if (Math.abs(saldoTrans) > 0.01) {
          avisos.push(`Conta transitória com saldo pendente: ${formatCurrency(saldoTrans)}`);
        }
      }

      return {
        integridade_ok: erros.length === 0,
        erros_encontrados: erros.length,
        avisos_encontrados: avisos.length,
        erros,
        avisos,
        resultados,
        mensagem: erros.length === 0
          ? "✅ Sistema contábil íntegro"
          : `❌ ${erros.length} erro(s) de integridade encontrado(s)`,
      };
    }

    // === BASE DE CONHECIMENTO EXPANDIDA - eSocial, NF, MBA ===
    case "consultar_evento_esocial": {
      const { buscarEventoESocial, listarEventosESocial } = await import("./knowledge/knowledge-expandido.js");
      
      if (args.codigo) {
        const evento = buscarEventoESocial(args.codigo as string);
        if (!evento) {
          return { encontrado: false, mensagem: `Evento ${args.codigo} não encontrado` };
        }
        return {
          encontrado: true,
          codigo: args.codigo,
          ...evento,
        };
      }
      
      if (args.tipo) {
        const eventos = listarEventosESocial(args.tipo as string);
        return {
          tipo_filtro: args.tipo,
          quantidade: Object.keys(eventos).length,
          eventos,
        };
      }
      
      return {
        eventos: listarEventosESocial(),
        quantidade: Object.keys(listarEventosESocial()).length,
      };
    }

    case "consultar_incidencia_tributaria": {
      const { buscarIncidenciaTributaria } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código da incidência é obrigatório" };
      }
      
      const incidencia = buscarIncidenciaTributaria(args.codigo as string);
      if (!incidencia) {
        return { encontrado: false, mensagem: `Incidência ${args.codigo} não encontrada` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        ...incidencia,
      };
    }

    case "consultar_categoria_trabalhador": {
      const { buscarCategoriaTrabalhador } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código da categoria é obrigatório" };
      }
      
      const categoria = buscarCategoriaTrabalhador(args.codigo as string);
      if (!categoria) {
        return { encontrado: false, mensagem: `Categoria ${args.codigo} não encontrada` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        ...categoria,
      };
    }

    case "consultar_motivo_afastamento": {
      const { buscarMotivoAfastamento } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código do motivo é obrigatório" };
      }
      
      const motivo = buscarMotivoAfastamento(args.codigo as string);
      if (!motivo) {
        return { encontrado: false, mensagem: `Motivo de afastamento ${args.codigo} não encontrado` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        ...motivo,
      };
    }

    case "consultar_motivo_desligamento": {
      const { buscarMotivoDesligamento } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código do motivo é obrigatório" };
      }
      
      const motivo = buscarMotivoDesligamento(args.codigo as string);
      if (!motivo) {
        return { encontrado: false, mensagem: `Motivo de desligamento ${args.codigo} não encontrado` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        ...motivo,
      };
    }

    case "consultar_cfop": {
      const { buscarCFOP, listarCFOPs } = await import("./knowledge/knowledge-expandido.js");
      
      if (args.codigo) {
        const cfop = buscarCFOP(args.codigo as string);
        if (!cfop) {
          return { encontrado: false, mensagem: `CFOP ${args.codigo} não encontrado` };
        }
        return {
          encontrado: true,
          codigo: args.codigo,
          ...cfop,
        };
      }
      
      if (args.tipo) {
        const cfops = listarCFOPs(args.tipo as string, 'todas');
        return {
          tipo_filtro: args.tipo,
          quantidade: Object.keys(cfops).length,
          cfops,
        };
      }
      
      return { erro: "Informe o código do CFOP ou tipo (ENTRADA/SAIDA)" };
    }

    case "consultar_cst_icms": {
      const { buscarCSTIcms } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código do CST é obrigatório" };
      }
      
      const cst = buscarCSTIcms(args.codigo as string);
      if (!cst) {
        return { encontrado: false, mensagem: `CST ICMS ${args.codigo} não encontrado` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        regime: "NORMAL",
        ...cst,
      };
    }

    case "consultar_csosn": {
      const { buscarCSOSN } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código do CSOSN é obrigatório" };
      }
      
      const csosn = buscarCSOSN(args.codigo as string);
      if (!csosn) {
        return { encontrado: false, mensagem: `CSOSN ${args.codigo} não encontrado` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        regime: "SIMPLES_NACIONAL",
        ...csosn,
      };
    }

    case "consultar_cst_pis_cofins": {
      const { buscarCSTPisCofins } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código do CST é obrigatório" };
      }
      
      const cst = buscarCSTPisCofins(args.codigo as string);
      if (!cst) {
        return { encontrado: false, mensagem: `CST PIS/COFINS ${args.codigo} não encontrado` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        ...cst,
      };
    }

    case "consultar_servico_lc116": {
      const { buscarServicoLC116 } = await import("./knowledge/knowledge-expandido.js");
      
      if (!args.codigo) {
        return { erro: "Código do serviço é obrigatório" };
      }
      
      const servico = buscarServicoLC116(args.codigo as string);
      if (!servico) {
        return { encontrado: false, mensagem: `Serviço LC 116 ${args.codigo} não encontrado` };
      }
      
      return {
        encontrado: true,
        codigo: args.codigo,
        ...servico,
      };
    }

    case "consultar_indicador_mba": {
      const { buscarIndicador, buscarIndicadoresPorCategoria } = await import("./knowledge/knowledge-expandido.js");
      
      if (args.nome) {
        const indicador = buscarIndicador(args.nome as string);
        if (!indicador) {
          return { encontrado: false, mensagem: `Indicador "${args.nome}" não encontrado` };
        }
        return {
          encontrado: true,
          ...indicador,
        };
      }
      
      if (args.categoria) {
        const indicadores = buscarIndicadoresPorCategoria(args.categoria as string);
        return {
          categoria: args.categoria,
          quantidade: indicadores.length,
          indicadores,
        };
      }
      
      // Listar todos
      const todos = buscarIndicadoresPorCategoria('todos');
      return {
        quantidade: todos.length,
        indicadores: todos,
      };
    }

    case "buscar_modelo_lancamento": {
      const { buscarLancamento, listarLancamentosPorCategoria } = await import("./knowledge/knowledge-expandido.js");
      
      if (args.texto) {
        const lancamento = buscarLancamento(args.texto as string);
        if (!lancamento) {
          return { encontrado: false, mensagem: `Nenhum modelo encontrado para "${args.texto}"` };
        }
        return {
          encontrado: true,
          ...lancamento,
        };
      }
      
      if (args.categoria) {
        const lancamentos = listarLancamentosPorCategoria(args.categoria as string);
        return {
          categoria: args.categoria,
          quantidade: lancamentos.length,
          lancamentos,
        };
      }
      
      return { erro: "Informe texto de busca ou categoria" };
    }

    case "analise_financeira_completa": {
      const { gerarAnaliseCompleta } = await import("./knowledge/knowledge-expandido.js");
      
      const balanco = {
        ativoCirculante: Number(args.ativo_circulante) || 0,
        ativoNaoCirculante: Number(args.ativo_nao_circulante) || 0,
        passivoCirculante: Number(args.passivo_circulante) || 0,
        passivoNaoCirculante: Number(args.passivo_nao_circulante) || 0,
        patrimonioLiquido: Number(args.patrimonio_liquido) || 0,
      };
      
      const dre = {
        receita: Number(args.receita) || 0,
        lucroLiquido: Number(args.lucro_liquido) || 0,
      };
      
      const analise = gerarAnaliseCompleta(
        args.empresa as string,
        args.periodo as string,
        balanco,
        dre
      );
      
      return analise;
    }

    case "calcular_ncg": {
      const { calcularNCG } = await import("./knowledge/knowledge-expandido.js");
      
      const resultado = calcularNCG(
        Number(args.contas_receber) || 0,
        Number(args.estoques) || 0,
        Number(args.fornecedores) || 0,
        Number(args.outras_operacionais) || 0
      );
      
      return {
        ...resultado,
        ncg_formatado: formatCurrency(resultado.ncg),
      };
    }

    case "analise_dupont": {
      const { analiseDuPont } = await import("./knowledge/knowledge-expandido.js");
      
      const resultado = analiseDuPont(
        Number(args.lucro_liquido) || 0,
        Number(args.receita) || 0,
        Number(args.ativo_total) || 0,
        Number(args.patrimonio_liquido) || 0
      );
      
      return {
        ...resultado,
        roe_formatado: `${resultado.roe.toFixed(2)}%`,
        margem_formatada: `${resultado.margemLiquida.toFixed(2)}%`,
      };
    }

    case "listar_eventos_esocial": {
      const { listarEventosESocial } = await import("./knowledge/knowledge-expandido.js");
      
      const eventos = listarEventosESocial(args.tipo as string || 'todos');
      return {
        tipo_filtro: args.tipo || 'todos',
        quantidade: Object.keys(eventos).length,
        eventos,
      };
    }

    case "listar_cfops": {
      const { listarCFOPs } = await import("./knowledge/knowledge-expandido.js");
      
      const cfops = listarCFOPs(
        (args.tipo as string) || 'todos',
        (args.uf as string) || 'todas'
      );
      
      return {
        tipo_filtro: args.tipo || 'todos',
        uf_filtro: args.uf || 'todas',
        quantidade: Object.keys(cfops).length,
        cfops,
      };
    }

    case "listar_modelos_lancamento": {
      const { listarLancamentosPorCategoria } = await import("./knowledge/knowledge-expandido.js");
      
      const lancamentos = listarLancamentosPorCategoria(args.categoria as string || 'todos');
      return {
        categoria_filtro: args.categoria || 'todos',
        quantidade: lancamentos.length,
        lancamentos,
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
