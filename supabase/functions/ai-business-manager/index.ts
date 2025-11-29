import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Perfil do Gestor Empresarial IA
const MANAGER_PROFILE = `
Você é o GESTOR EMPRESARIAL IA da Ampla Contabilidade.

FORMAÇÃO E ESPECIALIZAÇÃO:
- MBA em Gestão Empresarial e Finanças Corporativas
- Especialista em análise de indicadores financeiros (KPIs)
- Certificação em Gestão de Tesouraria e Fluxo de Caixa
- Experiência em controladoria e planejamento financeiro

RESPONSABILIDADES:
1. CONTAS A RECEBER:
   - Monitorar clientes inadimplentes
   - Calcular aging de recebíveis
   - Sugerir ações de cobrança
   - Analisar risco de crédito

2. CONTAS A PAGAR:
   - Controlar vencimentos
   - Otimizar fluxo de pagamentos
   - Identificar oportunidades de desconto
   - Priorizar pagamentos por criticidade

3. CONCILIAÇÃO BANCÁRIA:
   - Identificar divergências
   - Sugerir lançamentos de ajuste
   - Detectar fraudes ou erros

4. FECHAMENTO MENSAL:
   - Verificar completude dos lançamentos
   - Validar saldos contábeis
   - Gerar relatórios gerenciais

5. ANÁLISE DE INDICADORES:
   - Margem de lucro
   - Ponto de equilíbrio
   - ROI / ROE
   - Liquidez
   - Endividamento
   - Capital de giro

6. GESTÃO ESTRATÉGICA:
   - Análise de viabilidade
   - Projeções financeiras
   - Recomendações de melhoria
`;

interface ManagerRequest {
  action:
    | 'analyze_receivables'      // Análise de contas a receber
    | 'analyze_payables'         // Análise de contas a pagar
    | 'bank_reconciliation'      // Conciliação bancária
    | 'monthly_closing'          // Fechamento mensal
    | 'financial_indicators'     // Indicadores financeiros
    | 'cash_flow_analysis'       // Análise de fluxo de caixa
    | 'profitability_report'     // Relatório de lucratividade
    | 'strategic_advice';        // Conselho estratégico
  period?: {
    start_date: string;
    end_date: string;
  };
  context?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, period, context } = await req.json() as ManagerRequest;

    console.log(`📊 Gestor Empresarial IA - Ação: ${action}`);

    // Definir período padrão (mês atual)
    const today = new Date();
    const startDate = period?.start_date || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = period?.end_date || today.toISOString().split('T')[0];

    let analysisData: any = {};
    let userPrompt = '';

    switch (action) {
      case 'analyze_receivables': {
        // Buscar contas a receber
        const { data: invoices } = await supabase
          .from('invoices')
          .select(`
            id,
            client_id,
            amount,
            due_date,
            status,
            paid_date,
            clients (name, email)
          `)
          .order('due_date');

        const { data: clients } = await supabase
          .from('clients')
          .select('id, name, monthly_fee, payment_day, status');

        // Calcular aging
        const overdue = invoices?.filter(i =>
          i.status !== 'paid' && new Date(i.due_date) < today
        ) || [];

        const overdueByDays = {
          '1-30': overdue.filter(i => {
            const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
            return days >= 1 && days <= 30;
          }),
          '31-60': overdue.filter(i => {
            const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
            return days >= 31 && days <= 60;
          }),
          '60+': overdue.filter(i => {
            const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
            return days > 60;
          }),
        };

        analysisData = {
          total_clients: clients?.length || 0,
          active_clients: clients?.filter(c => c.status === 'active').length || 0,
          total_invoices: invoices?.length || 0,
          paid_invoices: invoices?.filter(i => i.status === 'paid').length || 0,
          pending_invoices: invoices?.filter(i => i.status === 'pending').length || 0,
          overdue_invoices: overdue.length,
          total_receivable: invoices?.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.amount), 0) || 0,
          total_overdue: overdue.reduce((sum, i) => sum + Number(i.amount), 0),
          aging: {
            '1-30_dias': { count: overdueByDays['1-30'].length, total: overdueByDays['1-30'].reduce((s, i) => s + Number(i.amount), 0) },
            '31-60_dias': { count: overdueByDays['31-60'].length, total: overdueByDays['31-60'].reduce((s, i) => s + Number(i.amount), 0) },
            '60+_dias': { count: overdueByDays['60+'].length, total: overdueByDays['60+'].reduce((s, i) => s + Number(i.amount), 0) },
          },
          top_debtors: overdue.slice(0, 5).map(i => ({
            client: (i as any).clients?.name || 'N/A',
            amount: i.amount,
            days_overdue: Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000),
          })),
        };

        userPrompt = `
ANÁLISE DE CONTAS A RECEBER

DADOS:
${JSON.stringify(analysisData, null, 2)}

Analise a situação das contas a receber e forneça:
1. Diagnóstico da saúde dos recebíveis
2. Risco de inadimplência
3. Ações recomendadas de cobrança
4. Clientes que precisam de atenção imediata
5. Projeção de recebimentos
`;
        break;
      }

      case 'analyze_payables': {
        // Buscar contas a pagar (usando expenses como referência)
        const { data: expenses } = await supabase
          .from('accounting_entries')
          .select(`
            id,
            entry_date,
            description,
            accounting_entry_lines (
              debit_amount,
              credit_amount,
              chart_of_accounts (code, name, type)
            )
          `)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);

        // Filtrar despesas (contas 4.x)
        const despesas = expenses?.filter(e =>
          e.accounting_entry_lines?.some((l: any) =>
            l.chart_of_accounts?.code?.startsWith('4.')
          )
        ) || [];

        const totalDespesas = despesas.reduce((sum, e) => {
          const valor = e.accounting_entry_lines?.find((l: any) =>
            l.chart_of_accounts?.code?.startsWith('4.')
          )?.debit_amount || 0;
          return sum + Number(valor);
        }, 0);

        analysisData = {
          period: { start: startDate, end: endDate },
          total_expenses: totalDespesas,
          expense_count: despesas.length,
          expense_breakdown: despesas.slice(0, 10).map(e => ({
            date: e.entry_date,
            description: e.description,
            amount: e.accounting_entry_lines?.[0]?.debit_amount || 0,
          })),
        };

        userPrompt = `
ANÁLISE DE CONTAS A PAGAR

PERÍODO: ${startDate} a ${endDate}

DADOS:
${JSON.stringify(analysisData, null, 2)}

Analise as contas a pagar e forneça:
1. Panorama das obrigações
2. Priorização de pagamentos
3. Oportunidades de economia
4. Recomendações de fluxo de caixa
5. Alertas de vencimentos críticos
`;
        break;
      }

      case 'financial_indicators': {
        // Buscar dados contábeis para indicadores
        const { data: entries } = await supabase
          .from('accounting_entries')
          .select(`
            id,
            entry_date,
            accounting_entry_lines (
              debit_amount,
              credit_amount,
              chart_of_accounts (code, name, type)
            )
          `)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);

        // Calcular totais por tipo de conta
        let totalReceitas = 0;
        let totalDespesas = 0;
        let totalAtivo = 0;
        let totalPassivo = 0;

        entries?.forEach(e => {
          e.accounting_entry_lines?.forEach((l: any) => {
            const code = l.chart_of_accounts?.code || '';
            if (code.startsWith('3.')) totalReceitas += Number(l.credit_amount) || 0;
            if (code.startsWith('4.')) totalDespesas += Number(l.debit_amount) || 0;
            if (code.startsWith('1.')) totalAtivo += (Number(l.debit_amount) || 0) - (Number(l.credit_amount) || 0);
            if (code.startsWith('2.')) totalPassivo += (Number(l.credit_amount) || 0) - (Number(l.debit_amount) || 0);
          });
        });

        const lucroLiquido = totalReceitas - totalDespesas;
        const margemLucro = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;

        analysisData = {
          period: { start: startDate, end: endDate },
          receitas: totalReceitas,
          despesas: totalDespesas,
          lucro_liquido: lucroLiquido,
          margem_lucro_percentual: margemLucro.toFixed(2),
          ativo_total: totalAtivo,
          passivo_total: totalPassivo,
          patrimonio_liquido: totalAtivo - totalPassivo,
          indicadores: {
            roi: totalAtivo > 0 ? ((lucroLiquido / totalAtivo) * 100).toFixed(2) + '%' : 'N/A',
            liquidez_geral: totalPassivo > 0 ? (totalAtivo / totalPassivo).toFixed(2) : 'N/A',
            endividamento: totalAtivo > 0 ? ((totalPassivo / totalAtivo) * 100).toFixed(2) + '%' : 'N/A',
          },
        };

        userPrompt = `
INDICADORES FINANCEIROS

PERÍODO: ${startDate} a ${endDate}

DADOS:
${JSON.stringify(analysisData, null, 2)}

Analise os indicadores e forneça:
1. Diagnóstico da saúde financeira
2. Pontos fortes e fracos
3. Comparativo com benchmarks do setor contábil
4. Ações para melhorar indicadores
5. Projeção de resultados
`;
        break;
      }

      case 'monthly_closing': {
        // Verificar completude do fechamento
        const { data: entries } = await supabase
          .from('accounting_entries')
          .select(`
            id,
            entry_date,
            description,
            ai_validation_status,
            ai_validation_score,
            accounting_entry_lines (
              debit_amount,
              credit_amount
            )
          `)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);

        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, status, amount')
          .gte('competence', startDate)
          .lte('competence', endDate);

        // Verificar balanceamento
        let totalDebits = 0;
        let totalCredits = 0;
        entries?.forEach(e => {
          e.accounting_entry_lines?.forEach((l: any) => {
            totalDebits += Number(l.debit_amount) || 0;
            totalCredits += Number(l.credit_amount) || 0;
          });
        });

        const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
        const pendingValidation = entries?.filter(e => e.ai_validation_status === 'pending').length || 0;
        const rejectedEntries = entries?.filter(e => e.ai_validation_status === 'rejected').length || 0;

        analysisData = {
          period: { start: startDate, end: endDate },
          entries_count: entries?.length || 0,
          total_debits: totalDebits,
          total_credits: totalCredits,
          is_balanced: isBalanced,
          difference: Math.abs(totalDebits - totalCredits),
          pending_ai_validation: pendingValidation,
          rejected_entries: rejectedEntries,
          invoices: {
            total: invoices?.length || 0,
            paid: invoices?.filter(i => i.status === 'paid').length || 0,
            pending: invoices?.filter(i => i.status === 'pending').length || 0,
          },
          checklist: {
            lancamentos_balanceados: isBalanced,
            todas_faturas_lancadas: (invoices?.length || 0) > 0,
            validacao_ia_completa: pendingValidation === 0,
            sem_lancamentos_rejeitados: rejectedEntries === 0,
          },
        };

        userPrompt = `
FECHAMENTO MENSAL

PERÍODO: ${startDate} a ${endDate}

DADOS:
${JSON.stringify(analysisData, null, 2)}

Analise o fechamento e forneça:
1. Status do fechamento (pronto ou pendências)
2. Itens que precisam de atenção
3. Verificações recomendadas
4. Próximos passos
5. Checklist de conformidade
`;
        break;
      }

      case 'strategic_advice': {
        // Conselho estratégico geral
        const contextInfo = context || {};

        userPrompt = `
CONSULTORIA ESTRATÉGICA

${contextInfo.question || 'Forneça uma análise estratégica geral para a Ampla Contabilidade.'}

CONTEXTO ADICIONAL:
${JSON.stringify(contextInfo, null, 2)}

Forneça consultoria estratégica incluindo:
1. Análise da situação atual
2. Oportunidades identificadas
3. Riscos a considerar
4. Plano de ação recomendado
5. Métricas de acompanhamento
`;
        break;
      }

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    // Chamar Gemini para análise
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: MANAGER_PROFILE },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 2000,
        }),
      }
    );

    if (!aiResponse.ok) {
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Não foi possível gerar análise.";

    console.log(`✅ Gestor Empresarial IA - Análise concluída`);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        period: { start: startDate, end: endDate },
        data: analysisData,
        analysis,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro no Gestor Empresarial IA:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
