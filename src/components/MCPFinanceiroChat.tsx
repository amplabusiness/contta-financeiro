/**
 * MCP Financeiro Chat - Assistente Inteligente Global
 *
 * Este componente fornece um chat com IA disponível em toda a aplicação.
 * O assistente conhece todas as regras de negócio da Ampla Contabilidade
 * e pode ajudar com análises, consultas e orientações.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  Maximize2,
  Bot,
  User,
  Loader2,
  Sparkles,
  Calculator,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  BarChart3,
  DollarSign,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ============================================
// TIPOS
// ============================================

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  status?: "sending" | "sent" | "error";
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  category: "financeiro" | "clientes" | "contabilidade" | "cobranca";
}

// ============================================
// AÇÕES RÁPIDAS
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "resumo_mensal",
    label: "Resumo do Mês",
    icon: <BarChart3 className="w-4 h-4" />,
    prompt: "Faça um resumo financeiro completo do mês atual",
    category: "financeiro",
  },
  {
    id: "inadimplentes",
    label: "Clientes Inadimplentes",
    icon: <AlertCircle className="w-4 h-4" />,
    prompt: "Liste os clientes inadimplentes e sugira ações de cobrança",
    category: "cobranca",
  },
  {
    id: "dre",
    label: "Gerar DRE",
    icon: <FileText className="w-4 h-4" />,
    prompt: "Gere a DRE do mês atual e analise os resultados",
    category: "contabilidade",
  },
  {
    id: "fluxo_caixa",
    label: "Fluxo de Caixa",
    icon: <TrendingUp className="w-4 h-4" />,
    prompt: "Mostre a projeção de fluxo de caixa para os próximos 30 dias",
    category: "financeiro",
  },
  {
    id: "top_clientes",
    label: "Top Clientes",
    icon: <Users className="w-4 h-4" />,
    prompt: "Quais são os 10 maiores clientes por faturamento?",
    category: "clientes",
  },
  {
    id: "diagnostico",
    label: "Diagnóstico Financeiro",
    icon: <Sparkles className="w-4 h-4" />,
    prompt: "Faça um diagnóstico completo da saúde financeira da empresa",
    category: "financeiro",
  },
  {
    id: "despesas_categoria",
    label: "Despesas por Categoria",
    icon: <DollarSign className="w-4 h-4" />,
    prompt: "Mostre as despesas agrupadas por categoria neste mês",
    category: "financeiro",
  },
  {
    id: "regras_cobranca",
    label: "Regras de Cobrança",
    icon: <HelpCircle className="w-4 h-4" />,
    prompt: "Quais são as regras de cobrança da empresa?",
    category: "cobranca",
  },
];

// ============================================
// FUNÇÕES DE PROCESSAMENTO
// ============================================

async function processarMensagem(mensagem: string): Promise<{
  resposta: string;
  toolsUsed: string[];
}> {
  // Detectar intenção e executar tools apropriadas
  const mensagemLower = mensagem.toLowerCase();
  const toolsUsed: string[] = [];
  let resposta = "";

  try {
    const competenciaAtual = format(new Date(), "MM/yyyy");

    // === INADIMPLÊNCIA ===
    if (mensagemLower.includes("inadimpl") || mensagemLower.includes("atraso") || mensagemLower.includes("devendo")) {
      toolsUsed.push("clientes_inadimplentes");

      const { data: invoices } = await supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name, document, phone, email)
        `)
        .eq("status", "pending")
        .lt("due_date", format(new Date(), "yyyy-MM-dd"))
        .order("due_date", { ascending: true });

      if (!invoices || invoices.length === 0) {
        resposta = "🎉 **Ótima notícia!** Não há clientes inadimplentes no momento. Todos os honorários estão em dia!";
      } else {
        // Agrupar por cliente
        const porCliente = new Map<string, { cliente: any; faturas: any[]; total: number }>();
        invoices.forEach((inv) => {
          const clienteId = inv.client?.id;
          if (!clienteId) return;
          if (!porCliente.has(clienteId)) {
            porCliente.set(clienteId, { cliente: inv.client, faturas: [], total: 0 });
          }
          const entry = porCliente.get(clienteId)!;
          entry.faturas.push(inv);
          entry.total += inv.amount || 0;
        });

        const totalGeral = Array.from(porCliente.values()).reduce((sum, c) => sum + c.total, 0);

        resposta = `## 📊 Relatório de Inadimplência\n\n`;
        resposta += `**Total de clientes inadimplentes:** ${porCliente.size}\n`;
        resposta += `**Valor total em atraso:** R$ ${totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;
        resposta += `### Clientes em Atraso:\n\n`;

        Array.from(porCliente.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
          .forEach((item, idx) => {
            const diasAtraso = Math.floor(
              (new Date().getTime() - new Date(item.faturas[0]?.due_date).getTime()) / (1000 * 60 * 60 * 24)
            );
            resposta += `${idx + 1}. **${item.cliente.name}**\n`;
            resposta += `   - Valor: R$ ${item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
            resposta += `   - Dias em atraso: ${diasAtraso}\n`;
            resposta += `   - Ação sugerida: ${diasAtraso <= 7 ? "WhatsApp" : diasAtraso <= 15 ? "Telefone" : diasAtraso <= 30 ? "Reunião" : "Jurídico"}\n\n`;
          });

        resposta += `\n### 📞 Régua de Cobrança:\n`;
        resposta += `- **D+1 a D+7:** Lembrete por WhatsApp\n`;
        resposta += `- **D+8 a D+15:** Contato telefônico\n`;
        resposta += `- **D+16 a D+30:** Reunião de negociação\n`;
        resposta += `- **D+31 a D+60:** Carta formal\n`;
        resposta += `- **D+61+:** Encaminhamento jurídico\n`;
      }
    }
    // === DRE ===
    else if (mensagemLower.includes("dre") || mensagemLower.includes("resultado") || mensagemLower.includes("demonstra")) {
      toolsUsed.push("gerar_dre");

      const { data: contas } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .or("code.like.3%,code.like.4%");

      const { data: lancamentos } = await supabase
        .from("accounting_entry_lines")
        .select(`
          amount,
          type,
          account_id,
          entry:accounting_entries(entry_date, competence_date)
        `);

      const startDate = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const endDate = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

      const lancamentosFiltrados = lancamentos?.filter((l) => {
        const data = l.entry?.competence_date || l.entry?.entry_date;
        return data && data >= startDate && data <= endDate;
      }) || [];

      const contasReceita = contas?.filter((c) => c.code.startsWith("3")).map((c) => c.id) || [];
      const contasDespesa = contas?.filter((c) => c.code.startsWith("4")).map((c) => c.id) || [];

      const receitas = lancamentosFiltrados
        .filter((l) => contasReceita.includes(l.account_id))
        .reduce((sum, l) => sum + (l.type === "credit" ? l.amount : -l.amount), 0);

      const despesas = lancamentosFiltrados
        .filter((l) => contasDespesa.includes(l.account_id))
        .reduce((sum, l) => sum + (l.type === "debit" ? l.amount : -l.amount), 0);

      const resultado = receitas - despesas;
      const margem = receitas > 0 ? ((resultado / receitas) * 100).toFixed(1) : "0";

      resposta = `## 📈 DRE - ${competenciaAtual}\n\n`;
      resposta += `| Descrição | Valor |\n`;
      resposta += `|-----------|-------|\n`;
      resposta += `| **Receita Bruta** | R$ ${receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} |\n`;
      resposta += `| (-) Deduções | R$ 0,00 |\n`;
      resposta += `| **Receita Líquida** | R$ ${receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} |\n`;
      resposta += `| (-) Despesas Operacionais | R$ ${despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} |\n`;
      resposta += `| **Resultado Líquido** | R$ ${resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} |\n`;
      resposta += `| **Margem Líquida** | ${margem}% |\n\n`;

      if (resultado > 0) {
        resposta += `✅ **Análise:** Resultado positivo! A empresa está operando com lucro.\n`;
      } else if (resultado < 0) {
        resposta += `⚠️ **Análise:** Resultado negativo. Revisar despesas e estratégias de receita.\n`;
      } else {
        resposta += `ℹ️ **Análise:** Resultado neutro. Ponto de equilíbrio atingido.\n`;
      }
    }
    // === RESUMO MENSAL ===
    else if (mensagemLower.includes("resumo") || mensagemLower.includes("mensal") || mensagemLower.includes("geral")) {
      toolsUsed.push("resumo_honorarios", "resumo_despesas");

      const startDate = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const endDate = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

      const { data: honorarios } = await supabase
        .from("invoices")
        .select("amount, status")
        .gte("due_date", startDate)
        .lte("due_date", endDate);

      const { data: despesas } = await supabase
        .from("expenses")
        .select("amount, status, category")
        .gte("due_date", startDate)
        .lte("due_date", endDate);

      const { data: clientesAtivos } = await supabase
        .from("clients")
        .select("id")
        .eq("is_active", true);

      const totalHonorarios = honorarios?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const honorariosRecebidos = honorarios?.filter((h) => h.status === "paid").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const totalDespesas = despesas?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      resposta = `## 📊 Resumo Financeiro - ${competenciaAtual}\n\n`;
      resposta += `### Receitas (Honorários)\n`;
      resposta += `- **Faturado:** R$ ${totalHonorarios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      resposta += `- **Recebido:** R$ ${honorariosRecebidos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      resposta += `- **Taxa de Recebimento:** ${totalHonorarios > 0 ? ((honorariosRecebidos / totalHonorarios) * 100).toFixed(1) : 0}%\n\n`;
      resposta += `### Despesas\n`;
      resposta += `- **Total:** R$ ${totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;
      resposta += `### Resultado\n`;
      resposta += `- **Resultado Bruto:** R$ ${(totalHonorarios - totalDespesas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      resposta += `- **Clientes Ativos:** ${clientesAtivos?.length || 0}\n`;
      resposta += `- **Ticket Médio:** R$ ${clientesAtivos?.length ? (totalHonorarios / clientesAtivos.length).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}\n`;
    }
    // === CLIENTES ===
    else if (mensagemLower.includes("cliente") || mensagemLower.includes("top") || mensagemLower.includes("maiores")) {
      toolsUsed.push("ranking_clientes");

      const { data: clientes } = await supabase
        .from("clients")
        .select("id, name, document, monthly_fee, is_active")
        .eq("is_active", true)
        .order("monthly_fee", { ascending: false })
        .limit(10);

      resposta = `## 👥 Top 10 Clientes por Honorário\n\n`;
      resposta += `| # | Cliente | Honorário Mensal |\n`;
      resposta += `|---|---------|------------------|\n`;

      clientes?.forEach((c, idx) => {
        resposta += `| ${idx + 1} | ${c.name} | R$ ${(c.monthly_fee || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} |\n`;
      });

      const totalTop10 = clientes?.reduce((sum, c) => sum + (c.monthly_fee || 0), 0) || 0;
      resposta += `\n**Total Top 10:** R$ ${totalTop10.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    // === DESPESAS ===
    else if (mensagemLower.includes("despesa") || mensagemLower.includes("gasto") || mensagemLower.includes("categoria")) {
      toolsUsed.push("despesas_por_categoria");

      const startDate = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const endDate = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

      const { data: despesas } = await supabase
        .from("expenses")
        .select("amount, category")
        .gte("due_date", startDate)
        .lte("due_date", endDate);

      const porCategoria = new Map<string, number>();
      despesas?.forEach((d) => {
        const cat = d.category || "Sem categoria";
        porCategoria.set(cat, (porCategoria.get(cat) || 0) + (d.amount || 0));
      });

      const total = despesas?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      resposta = `## 💰 Despesas por Categoria - ${competenciaAtual}\n\n`;
      resposta += `| Categoria | Valor | % |\n`;
      resposta += `|-----------|-------|---|\n`;

      Array.from(porCategoria.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, valor]) => {
          resposta += `| ${cat} | R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | ${total > 0 ? ((valor / total) * 100).toFixed(1) : 0}% |\n`;
        });

      resposta += `\n**Total:** R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    // === REGRAS ===
    else if (mensagemLower.includes("regra") || mensagemLower.includes("como") || mensagemLower.includes("funciona")) {
      toolsUsed.push("regras_negocio");

      resposta = `## 📚 Regras de Negócio - Ampla Contabilidade\n\n`;

      if (mensagemLower.includes("cobran")) {
        resposta += `### Régua de Cobrança\n\n`;
        resposta += `| Dias em Atraso | Ação | Canal |\n`;
        resposta += `|----------------|------|-------|\n`;
        resposta += `| D+1 | Lembrete amigável | E-mail |\n`;
        resposta += `| D+7 | Cobrança gentil | WhatsApp |\n`;
        resposta += `| D+15 | Contato direto | Telefone |\n`;
        resposta += `| D+30 | Negociação formal | Reunião |\n`;
        resposta += `| D+60 | Medidas legais | Jurídico |\n`;
      } else if (mensagemLower.includes("contab")) {
        resposta += `### Regras Contábeis\n\n`;
        resposta += `- **Fonte única da verdade:** \`accounting_entry_lines\`\n`;
        resposta += `- **Partida dobrada:** débito = crédito (sempre!)\n`;
        resposta += `- **Saldo de abertura:** credita PL (5.2.1.02), não receita\n`;
        resposta += `- **Adiantamentos pessoais:** conta 1.1.3.04.xx, nunca despesa\n`;
        resposta += `- **DRE:** receitas (3.x) - despesas (4.x)\n`;
      } else {
        resposta += `### Honorários\n`;
        resposta += `- Cobrados mensalmente com vencimento configurável\n`;
        resposta += `- Pro-Bono: sem cobrança\n`;
        resposta += `- Barter: permuta de serviços\n\n`;
        resposta += `### Inadimplência\n`;
        resposta += `- Meta: < 5% do faturamento\n`;
        resposta += `- Régua de cobrança automática\n\n`;
        resposta += `*Pergunte sobre um tema específico para mais detalhes!*`;
      }
    }
    // === DIAGNÓSTICO ===
    else if (mensagemLower.includes("diagnóstico") || mensagemLower.includes("diagnostico") || mensagemLower.includes("saúde") || mensagemLower.includes("saude")) {
      toolsUsed.push("diagnostico_financeiro");

      const startDate = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const endDate = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

      const { data: honorarios } = await supabase
        .from("invoices")
        .select("amount, status")
        .gte("due_date", startDate)
        .lte("due_date", endDate);

      const { data: despesas } = await supabase
        .from("expenses")
        .select("amount, status")
        .gte("due_date", startDate)
        .lte("due_date", endDate);

      const totalHonorarios = honorarios?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const recebidos = honorarios?.filter((h) => h.status === "paid").reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const totalDespesas = despesas?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const resultado = totalHonorarios - totalDespesas;
      const margem = totalHonorarios > 0 ? (resultado / totalHonorarios) * 100 : 0;
      const taxaInadimplencia = totalHonorarios > 0 ? ((totalHonorarios - recebidos) / totalHonorarios) * 100 : 0;

      resposta = `## 🏥 Diagnóstico Financeiro - ${competenciaAtual}\n\n`;
      resposta += `### Indicadores Principais\n\n`;
      resposta += `| Indicador | Valor | Status |\n`;
      resposta += `|-----------|-------|--------|\n`;
      resposta += `| Margem Líquida | ${margem.toFixed(1)}% | ${margem >= 20 ? "✅ Saudável" : margem >= 10 ? "⚠️ Atenção" : "🔴 Crítico"} |\n`;
      resposta += `| Taxa Inadimplência | ${taxaInadimplencia.toFixed(1)}% | ${taxaInadimplencia <= 5 ? "✅ Saudável" : taxaInadimplencia <= 10 ? "⚠️ Atenção" : "🔴 Crítico"} |\n`;
      resposta += `| Resultado | R$ ${resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | ${resultado > 0 ? "✅ Positivo" : "🔴 Negativo"} |\n\n`;

      resposta += `### Recomendações\n\n`;
      if (taxaInadimplencia > 5) {
        resposta += `- 🔔 Intensificar ações de cobrança\n`;
      }
      if (margem < 20) {
        resposta += `- 📊 Revisar estrutura de custos\n`;
        resposta += `- 💰 Avaliar reajuste de honorários\n`;
      }
      resposta += `- 📈 Manter reserva de 3 meses de despesas\n`;
      resposta += `- 🎯 Focar em fidelização dos top clientes\n`;
    }
    // === FLUXO DE CAIXA ===
    else if (mensagemLower.includes("fluxo") || mensagemLower.includes("caixa") || mensagemLower.includes("projeção")) {
      toolsUsed.push("fluxo_caixa");

      const { data: honorariosPendentes } = await supabase
        .from("invoices")
        .select("amount, due_date")
        .eq("status", "pending")
        .gte("due_date", format(new Date(), "yyyy-MM-dd"))
        .lte("due_date", format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));

      const { data: despesasPendentes } = await supabase
        .from("expenses")
        .select("amount, due_date, description")
        .eq("status", "pending")
        .gte("due_date", format(new Date(), "yyyy-MM-dd"))
        .lte("due_date", format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));

      const entradasPrevistas = honorariosPendentes?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0;
      const saidasPrevistas = despesasPendentes?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      resposta = `## 💵 Projeção de Fluxo de Caixa (30 dias)\n\n`;
      resposta += `### Resumo\n`;
      resposta += `- **Entradas Previstas:** R$ ${entradasPrevistas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      resposta += `- **Saídas Previstas:** R$ ${saidasPrevistas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      resposta += `- **Saldo Projetado:** R$ ${(entradasPrevistas - saidasPrevistas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;

      if (despesasPendentes && despesasPendentes.length > 0) {
        resposta += `### Principais Saídas Previstas\n`;
        despesasPendentes
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 5)
          .forEach((d) => {
            resposta += `- ${d.description}: R$ ${(d.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${format(new Date(d.due_date), "dd/MM")})\n`;
          });
      }
    }
    // === SAUDAÇÃO / AJUDA ===
    else if (mensagemLower.includes("olá") || mensagemLower.includes("oi") || mensagemLower.includes("ajuda") || mensagemLower.includes("help")) {
      resposta = `## 👋 Olá! Sou o Assistente Financeiro da Ampla\n\n`;
      resposta += `Posso ajudar você com:\n\n`;
      resposta += `📊 **Análises Financeiras**\n`;
      resposta += `- Resumo mensal\n`;
      resposta += `- DRE e Balanço\n`;
      resposta += `- Fluxo de caixa\n\n`;
      resposta += `👥 **Clientes**\n`;
      resposta += `- Lista de inadimplentes\n`;
      resposta += `- Ranking de clientes\n`;
      resposta += `- Análise individual\n\n`;
      resposta += `💰 **Despesas**\n`;
      resposta += `- Por categoria\n`;
      resposta += `- Projeções\n\n`;
      resposta += `📚 **Regras de Negócio**\n`;
      resposta += `- Cobrança\n`;
      resposta += `- Contabilidade\n\n`;
      resposta += `*Use as ações rápidas abaixo ou pergunte diretamente!*`;
    }
    // === GENÉRICO ===
    else {
      resposta = `Entendi sua pergunta: "${mensagem}"\n\n`;
      resposta += `Posso ajudar com:\n`;
      resposta += `- 📊 Resumo financeiro mensal\n`;
      resposta += `- 📈 DRE e demonstrativos\n`;
      resposta += `- 💰 Despesas e fluxo de caixa\n`;
      resposta += `- 👥 Clientes e inadimplência\n`;
      resposta += `- 📚 Regras de negócio\n\n`;
      resposta += `*Tente ser mais específico ou use uma das ações rápidas!*`;
    }

    return { resposta, toolsUsed };
  } catch (error: any) {
    console.error("[MCPChat] Erro:", error);
    return {
      resposta: `❌ Ocorreu um erro ao processar sua solicitação: ${error.message}\n\nTente novamente ou reformule sua pergunta.`,
      toolsUsed: [],
    };
  }
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function MCPFinanceiroChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou o **Assistente Financeiro** da Ampla. Como posso ajudar você hoje?\n\nUse as ações rápidas abaixo ou digite sua pergunta!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { resposta, toolsUsed } = await processarMensagem(userMessage.content);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: resposta,
        timestamp: new Date(),
        toolsUsed,
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: "sent" as const } : m)).concat(assistantMessage)
      );
    } catch (error: any) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `❌ Erro: ${error.message}`,
        timestamp: new Date(),
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: "error" as const } : m)).concat(errorMessage)
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    setInput(action.prompt);
    setActiveTab("chat");
    setTimeout(() => {
      handleSend();
    }, 100);
  }, [handleSend]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card
          className={`fixed z-50 shadow-2xl transition-all duration-300 ${
            isMinimized
              ? "bottom-6 right-6 w-80 h-14"
              : "bottom-6 right-6 w-[420px] h-[600px] max-h-[80vh]"
          }`}
        >
          {/* Header */}
          <CardHeader className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">Assistente Financeiro</CardTitle>
                <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                  IA
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/20"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/20"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Content */}
          {!isMinimized && (
            <CardContent className="p-0 flex flex-col h-[calc(100%-56px)]">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b px-2">
                  <TabsTrigger value="chat" className="text-xs">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="acoes" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Ações Rápidas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0">
                  {/* Messages */}
                  <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {message.role === "assistant" && (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] rounded-lg p-3 text-sm ${
                              message.role === "user"
                                ? "bg-blue-600 text-white"
                                : "bg-muted"
                            }`}
                          >
                            <div
                              className="prose prose-sm dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: message.content
                                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                  .replace(/\*(.*?)\*/g, "<em>$1</em>")
                                  .replace(/## (.*?)\n/g, "<h3 class='text-base font-semibold mt-2 mb-1'>$1</h3>")
                                  .replace(/### (.*?)\n/g, "<h4 class='text-sm font-medium mt-2 mb-1'>$1</h4>")
                                  .replace(/- (.*?)\n/g, "<li class='ml-4'>$1</li>")
                                  .replace(/\n/g, "<br/>")
                                  .replace(/\|(.*?)\|/g, "<span class='font-mono text-xs'>$1</span>"),
                              }}
                            />
                            {message.toolsUsed && message.toolsUsed.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {message.toolsUsed.map((tool) => (
                                  <Badge key={tool} variant="outline" className="text-[10px]">
                                    {tool}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          {message.role === "user" && (
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-2 justify-start">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          </div>
                          <div className="bg-muted rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Analisando...
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-3 border-t">
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Digite sua pergunta..."
                        disabled={isLoading}
                        className="flex-1"
                      />
                      <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="acoes" className="flex-1 m-0 p-3 overflow-y-auto">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Financeiro
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.filter((a) => a.category === "financeiro").map((action) => (
                          <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            className="justify-start text-xs h-auto py-2"
                            onClick={() => handleQuickAction(action)}
                          >
                            {action.icon}
                            <span className="ml-1">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Clientes
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.filter((a) => a.category === "clientes").map((action) => (
                          <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            className="justify-start text-xs h-auto py-2"
                            onClick={() => handleQuickAction(action)}
                          >
                            {action.icon}
                            <span className="ml-1">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Cobrança
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.filter((a) => a.category === "cobranca").map((action) => (
                          <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            className="justify-start text-xs h-auto py-2"
                            onClick={() => handleQuickAction(action)}
                          >
                            {action.icon}
                            <span className="ml-1">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        Contabilidade
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.filter((a) => a.category === "contabilidade").map((action) => (
                          <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            className="justify-start text-xs h-auto py-2"
                            onClick={() => handleQuickAction(action)}
                          >
                            {action.icon}
                            <span className="ml-1">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          )}
        </Card>
      )}
    </>
  );
}

export default MCPFinanceiroChat;
