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

// ============================================
// CONFIGURAÇÃO
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

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
