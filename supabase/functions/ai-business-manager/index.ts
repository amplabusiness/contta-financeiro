import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Perfil do Gestor Empresarial IA - Treinado com melhores práticas MBA mundiais
const MANAGER_PROFILE = `
Você é o GESTOR EMPRESARIAL IA da Ampla Contabilidade.

═══════════════════════════════════════════════════════════════
FORMAÇÃO DE ELITE - MBA MUNDIAL
═══════════════════════════════════════════════════════════════

CREDENCIAIS ACADÊMICAS:
- MBA Harvard Business School - Estratégia e Finanças Corporativas
- MBA Wharton - Análise Quantitativa e Gestão de Riscos
- MBA INSEAD - Liderança e Transformação Organizacional
- Certificação CFA (Chartered Financial Analyst) Level III
- Six Sigma Black Belt - Melhoria Contínua
- Lean Management - Toyota Production System

METODOLOGIAS DOMINADAS:
- Balanced Scorecard (Kaplan & Norton)
- OKRs (Objectives and Key Results - Google/Intel)
- Value-Based Management (McKinsey)
- Activity-Based Costing (ABC)
- Zero-Based Budgeting (ZBB)
- Design Thinking para Finanças
- Análise de Pareto (80/20)
- Teoria das Restrições (TOC - Goldratt)

═══════════════════════════════════════════════════════════════
GESTÃO DE INADIMPLÊNCIA - TÉCNICAS AVANÇADAS
═══════════════════════════════════════════════════════════════

PREVENÇÃO (antes de virar inadimplência):
1. Credit Scoring - Avaliar risco do cliente antes de fechar contrato
2. Análise de capacidade de pagamento vs honorário proposto
3. Histórico de pontualidade de pagamentos anteriores
4. Sinais de alerta: atrasos frequentes, renegociações constantes

AÇÃO IMEDIATA (1-30 dias):
1. Régua de cobrança automatizada (email dia 1, WhatsApp dia 7, ligação dia 15)
2. Oferecer parcelamento antes que vire problema maior
3. Identificar causa raiz: esquecimento, problema financeiro, insatisfação?

RECUPERAÇÃO (30-90 dias):
1. Negociação proativa com desconto para quitação
2. Proposta de reestruturação de dívida
3. Análise de viabilidade do cliente continuar

DECISÃO ESTRATÉGICA (90+ dias):
1. Custo-benefício de manter vs desligar cliente
2. Provisão para devedores duvidosos (PCLD)
3. Encaminhamento para cobrança jurídica se necessário

KPIs DE INADIMPLÊNCIA:
- Taxa de inadimplência: Meta < 5%
- Aging de recebíveis: 80% deve estar em dia
- DSO (Days Sales Outstanding): quanto menor, melhor
- Taxa de recuperação de crédito

═══════════════════════════════════════════════════════════════
DETECÇÃO DE ANOMALIAS EM DESPESAS
═══════════════════════════════════════════════════════════════

ANÁLISE DE PROPORCIONALIDADE:
Você DEVE detectar gastos que não fazem sentido com a estrutura da empresa.
Exemplos de anomalias:

MATERIAL DE CONSUMO:
- Café: ~500g por funcionário/mês é normal. Se tem 3 funcionários e 20kg/mês = ANOMALIA
- Papel A4: ~1 resma por funcionário/mês é normal. 40 resmas sem impressora = ANOMALIA
- Copos descartáveis: proporção com número de funcionários
- Material de limpeza: proporção com área do escritório

UTILIDADES:
- Energia: R$ 15-25 por m² de escritório/mês é referência
- Água: proporcional ao número de pessoas
- Internet: uma conta por escritório, não múltiplas
- Telefone: verificar se ligações condizem com operação

SERVIÇOS:
- Limpeza terceirizada: proporcional ao tamanho do espaço
- Segurança: necessidade real vs custo
- Manutenção: frequência condizente com uso

ANÁLISE TEMPORAL:
- Comparar mês a mês: variações > 20% precisam explicação
- Sazonalidade: alguns gastos variam naturalmente (ar-condicionado no verão)
- Tendência: gastos crescendo mais que receita = problema

BENCHMARK DO SETOR CONTÁBIL:
- Folha de pagamento: 40-50% da receita (ideal)
- Aluguel: 5-10% da receita
- Tecnologia: 3-5% da receita
- Marketing: 2-5% da receita
- Material de consumo: 1-2% da receita
- Despesas administrativas gerais: 5-10% da receita

═══════════════════════════════════════════════════════════════
GESTÃO DE CUSTOS - TÉCNICAS MODERNAS
═══════════════════════════════════════════════════════════════

ZERO-BASED BUDGETING (ZBB):
- Todo gasto deve ser justificado do zero a cada período
- Não é porque gastou ano passado que deve gastar este ano
- Cada despesa precisa provar seu valor

ANÁLISE DE VALOR:
- Este gasto gera retorno?
- Podemos fazer mais barato sem perder qualidade?
- É essencial ou apenas conveniente?

QUICK WINS PARA REDUÇÃO DE CUSTOS:
1. Renegociar contratos de serviços anuais
2. Consolidar fornecedores para ganhar volume
3. Eliminar assinaturas/serviços não utilizados
4. Automatizar processos manuais repetitivos
5. Revisar planos de telefonia/internet

═══════════════════════════════════════════════════════════════
ANÁLISE FINANCEIRA AVANÇADA
═══════════════════════════════════════════════════════════════

INDICADORES-CHAVE:
1. MARGEM DE CONTRIBUIÇÃO = (Receita - Custos Variáveis) / Receita
   - Meta setor contábil: > 60%

2. PONTO DE EQUILÍBRIO = Custos Fixos / Margem de Contribuição
   - Saber quantos clientes precisa para empatar

3. ROI = (Lucro - Investimento) / Investimento
   - Cada R$ investido, quanto retorna?

4. EBITDA = Lucro antes de juros, impostos, depreciação e amortização
   - Mede geração de caixa operacional

5. LIQUIDEZ CORRENTE = Ativo Circulante / Passivo Circulante
   - Meta: > 1,5 (folga para imprevistos)

6. CAPITAL DE GIRO = Ativo Circulante - Passivo Circulante
   - Quanto tem para operar no curto prazo

ANÁLISE DE TENDÊNCIAS:
- Comparar pelo menos 6 meses para identificar padrões
- Projetar próximos 3-6 meses baseado em histórico
- Identificar sazonalidade (décimo terceiro, férias, etc.)

═══════════════════════════════════════════════════════════════
MODO DE COMUNICAÇÃO
═══════════════════════════════════════════════════════════════

Ao analisar dados:
1. Seja DIRETO e OBJETIVO
2. Destaque ANOMALIAS com alertas claros
3. Sempre sugira AÇÕES CONCRETAS
4. Use linguagem simples, evite jargões desnecessários
5. Priorize por IMPACTO (o que dá mais resultado primeiro)
6. Forneça NÚMEROS e PERCENTUAIS específicos
7. Compare com BENCHMARKS do mercado
8. Dê PRAZOS para as ações sugeridas
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
    | 'strategic_advice'         // Conselho estratégico
    | 'expense_anomaly'          // Detecção de anomalias em despesas
    | 'reduce_delinquency'       // Estratégias para reduzir inadimplência
    | 'full_diagnostic';         // Diagnóstico completo da empresa
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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
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

      case 'expense_anomaly': {
        // Análise de anomalias em despesas - comparar últimos 6 meses
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1).toISOString().split('T')[0];

        const { data: allExpenses } = await supabase
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
          .gte('entry_date', sixMonthsAgo)
          .lte('entry_date', endDate);

        // Buscar estrutura da empresa
        const { data: clients } = await supabase
          .from('clients')
          .select('id, status')
          .eq('status', 'active');

        // Agrupar despesas por mês e categoria
        const expensesByMonth: Record<string, Record<string, number>> = {};
        const expenseCategories: Record<string, number> = {};

        allExpenses?.forEach(e => {
          const month = e.entry_date?.substring(0, 7) || 'unknown';
          if (!expensesByMonth[month]) expensesByMonth[month] = {};

          e.accounting_entry_lines?.forEach((l: any) => {
            const code = l.chart_of_accounts?.code || '';
            const name = l.chart_of_accounts?.name || 'Outros';

            if (code.startsWith('4.')) { // Despesas
              const amount = Number(l.debit_amount) || 0;
              expensesByMonth[month][name] = (expensesByMonth[month][name] || 0) + amount;
              expenseCategories[name] = (expenseCategories[name] || 0) + amount;
            }
          });
        });

        // Calcular médias e detectar variações
        const monthlyTotals = Object.entries(expensesByMonth).map(([month, cats]) => ({
          month,
          total: Object.values(cats).reduce((s, v) => s + v, 0),
          categories: cats
        })).sort((a, b) => a.month.localeCompare(b.month));

        const avgMonthlyExpense = monthlyTotals.length > 0
          ? monthlyTotals.reduce((s, m) => s + m.total, 0) / monthlyTotals.length
          : 0;

        // Buscar receita para calcular proporções
        const { data: revenueEntries } = await supabase
          .from('accounting_entries')
          .select(`
            accounting_entry_lines (
              credit_amount,
              chart_of_accounts (code)
            )
          `)
          .gte('entry_date', sixMonthsAgo)
          .lte('entry_date', endDate);

        let totalRevenue = 0;
        revenueEntries?.forEach(e => {
          e.accounting_entry_lines?.forEach((l: any) => {
            if (l.chart_of_accounts?.code?.startsWith('3.')) {
              totalRevenue += Number(l.credit_amount) || 0;
            }
          });
        });

        analysisData = {
          periodo_analisado: { inicio: sixMonthsAgo, fim: endDate },
          estrutura_empresa: {
            clientes_ativos: clients?.length || 0,
            // Estimativa de funcionários baseado em folha de pagamento
          },
          receita_total_periodo: totalRevenue,
          media_despesa_mensal: avgMonthlyExpense,
          despesas_por_mes: monthlyTotals,
          top_despesas: Object.entries(expenseCategories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([name, total]) => ({
              categoria: name,
              total,
              percentual_receita: totalRevenue > 0 ? ((total / totalRevenue) * 100).toFixed(2) + '%' : 'N/A',
              media_mensal: (total / (monthlyTotals.length || 1)).toFixed(2)
            })),
          variacao_mensal: monthlyTotals.map((m, i) => {
            if (i === 0) return { month: m.month, variacao: 0 };
            const prev = monthlyTotals[i - 1].total;
            const variacao = prev > 0 ? ((m.total - prev) / prev * 100) : 0;
            return { month: m.month, variacao: variacao.toFixed(1) + '%', alerta: Math.abs(variacao) > 20 };
          }),
        };

        userPrompt = `
DETECÇÃO DE ANOMALIAS EM DESPESAS

PERÍODO ANALISADO: Últimos 6 meses (${sixMonthsAgo} a ${endDate})

DADOS COMPLETOS:
${JSON.stringify(analysisData, null, 2)}

INSTRUÇÕES DE ANÁLISE:

1. PROPORCIONALIDADE
   - Verifique se cada despesa faz sentido com a estrutura da empresa
   - Compare com benchmarks do setor contábil
   - Destaque despesas desproporcionais

2. VARIAÇÕES MENSAIS
   - Identifique meses com variações > 20%
   - Investigue causas possíveis
   - Diferencie sazonalidade de anomalia

3. DETECÇÃO DE EXCESSOS
   - Material de consumo vs número de funcionários
   - Energia/água vs tamanho do escritório
   - Serviços vs necessidade real

4. RECOMENDAÇÕES
   - Liste TOP 5 despesas para investigar
   - Sugira valores de referência
   - Proponha ações imediatas de redução

5. ECONOMIA POTENCIAL
   - Estime quanto pode ser economizado
   - Priorize por impacto
   - Dê prazo para implementação

Seja ESPECÍFICO e DIRETO. Use tabelas quando possível.
`;
        break;
      }

      case 'reduce_delinquency': {
        // Estratégias para reduzir inadimplência
        const { data: invoices } = await supabase
          .from('invoices')
          .select(`
            id,
            client_id,
            amount,
            due_date,
            status,
            paid_date,
            competence,
            clients (name, email, phone, status, monthly_fee, payment_day)
          `)
          .order('due_date');

        // Análise detalhada de inadimplência
        const today = new Date();
        const overdueInvoices = invoices?.filter(i =>
          i.status !== 'paid' && new Date(i.due_date) < today
        ) || [];

        // Clientes recorrentes em atraso
        const clientDelinquency: Record<string, { name: string, count: number, total: number, avgDays: number }> = {};

        overdueInvoices.forEach(inv => {
          const clientId = inv.client_id;
          const clientName = (inv as any).clients?.name || 'Desconhecido';
          const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);

          if (!clientDelinquency[clientId]) {
            clientDelinquency[clientId] = { name: clientName, count: 0, total: 0, avgDays: 0 };
          }
          clientDelinquency[clientId].count++;
          clientDelinquency[clientId].total += Number(inv.amount);
          clientDelinquency[clientId].avgDays = (clientDelinquency[clientId].avgDays + daysOverdue) / 2;
        });

        // Padrões de pagamento
        const paidInvoices = invoices?.filter(i => i.status === 'paid' && i.paid_date) || [];
        const paymentPatterns = paidInvoices.map(inv => {
          const due = new Date(inv.due_date);
          const paid = new Date(inv.paid_date!);
          return Math.floor((paid.getTime() - due.getTime()) / 86400000); // dias de atraso
        });

        const avgPaymentDelay = paymentPatterns.length > 0
          ? paymentPatterns.reduce((s, d) => s + d, 0) / paymentPatterns.length
          : 0;

        const totalReceivable = invoices?.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.amount), 0) || 0;
        const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);

        analysisData = {
          resumo: {
            total_a_receber: totalReceivable,
            total_em_atraso: totalOverdue,
            percentual_inadimplencia: totalReceivable > 0 ? ((totalOverdue / totalReceivable) * 100).toFixed(1) + '%' : '0%',
            faturas_em_atraso: overdueInvoices.length,
            media_dias_atraso_pagamentos: avgPaymentDelay.toFixed(1),
          },
          clientes_problematicos: Object.values(clientDelinquency)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
            .map(c => ({
              cliente: c.name,
              faturas_atrasadas: c.count,
              valor_total: c.total,
              media_dias_atraso: c.avgDays.toFixed(0),
            })),
          aging_detalhado: {
            '1_15_dias': overdueInvoices.filter(i => {
              const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
              return days >= 1 && days <= 15;
            }).length,
            '16_30_dias': overdueInvoices.filter(i => {
              const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
              return days >= 16 && days <= 30;
            }).length,
            '31_60_dias': overdueInvoices.filter(i => {
              const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
              return days >= 31 && days <= 60;
            }).length,
            '61_90_dias': overdueInvoices.filter(i => {
              const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
              return days >= 61 && days <= 90;
            }).length,
            'mais_90_dias': overdueInvoices.filter(i => {
              const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
              return days > 90;
            }).length,
          },
        };

        userPrompt = `
ESTRATÉGIAS PARA REDUZIR INADIMPLÊNCIA

SITUAÇÃO ATUAL:
${JSON.stringify(analysisData, null, 2)}

ANÁLISE SOLICITADA:

1. DIAGNÓSTICO
   - Qual a gravidade da situação?
   - Compare com benchmark do setor (meta: < 5%)
   - Identifique padrões de comportamento

2. AÇÕES IMEDIATAS (próximos 7 dias)
   - Quais clientes abordar primeiro?
   - Scripts de cobrança sugeridos
   - Canais de comunicação (WhatsApp, email, telefone)

3. AÇÕES DE CURTO PRAZO (30 dias)
   - Propostas de renegociação
   - Descontos para quitação à vista
   - Parcelamentos viáveis

4. AÇÕES ESTRUTURAIS (90 dias)
   - Política de crédito a implementar
   - Régua de cobrança automatizada
   - Critérios para aceitação de novos clientes

5. CASOS CRÍTICOS
   - Clientes para considerar desligamento
   - Quando acionar cobrança jurídica
   - Provisão para perdas (PCLD)

6. PREVENÇÃO FUTURA
   - Como evitar novos casos
   - Alertas precoces
   - Melhores práticas

Seja ESPECÍFICO com nomes de clientes e valores. Priorize por impacto financeiro.
`;
        break;
      }

      case 'full_diagnostic': {
        // Diagnóstico completo da empresa
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1).toISOString().split('T')[0];

        // Buscar todos os dados relevantes
        const [
          { data: clients },
          { data: invoices },
          { data: entries }
        ] = await Promise.all([
          supabase.from('clients').select('id, name, status, monthly_fee, payment_day'),
          supabase.from('invoices').select('id, client_id, amount, due_date, status, paid_date, competence'),
          supabase.from('accounting_entries').select(`
            id, entry_date, description,
            accounting_entry_lines (
              debit_amount, credit_amount,
              chart_of_accounts (code, name, type)
            )
          `).gte('entry_date', sixMonthsAgo).lte('entry_date', endDate)
        ]);

        // Calcular todos os indicadores
        let totalReceitas = 0, totalDespesas = 0, totalAtivo = 0, totalPassivo = 0;
        const expensesByCategory: Record<string, number> = {};
        const revenueByMonth: Record<string, number> = {};
        const expensesByMonth: Record<string, number> = {};

        entries?.forEach(e => {
          const month = e.entry_date?.substring(0, 7) || 'unknown';
          e.accounting_entry_lines?.forEach((l: any) => {
            const code = l.chart_of_accounts?.code || '';
            const name = l.chart_of_accounts?.name || 'Outros';

            if (code.startsWith('3.')) {
              const amt = Number(l.credit_amount) || 0;
              totalReceitas += amt;
              revenueByMonth[month] = (revenueByMonth[month] || 0) + amt;
            }
            if (code.startsWith('4.')) {
              const amt = Number(l.debit_amount) || 0;
              totalDespesas += amt;
              expensesByMonth[month] = (expensesByMonth[month] || 0) + amt;
              expensesByCategory[name] = (expensesByCategory[name] || 0) + amt;
            }
            if (code.startsWith('1.')) totalAtivo += (Number(l.debit_amount) || 0) - (Number(l.credit_amount) || 0);
            if (code.startsWith('2.')) totalPassivo += (Number(l.credit_amount) || 0) - (Number(l.debit_amount) || 0);
          });
        });

        // Análise de clientes
        const activeClients = clients?.filter(c => c.status === 'active') || [];
        const potentialRevenue = activeClients.reduce((s, c) => s + (Number(c.monthly_fee) || 0), 0);

        // Análise de inadimplência
        const overdueInvoices = invoices?.filter(i =>
          i.status !== 'paid' && new Date(i.due_date) < today
        ) || [];
        const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);

        const lucro = totalReceitas - totalDespesas;
        const margem = totalReceitas > 0 ? (lucro / totalReceitas * 100) : 0;

        analysisData = {
          periodo: { inicio: sixMonthsAgo, fim: endDate },

          visao_geral: {
            clientes_ativos: activeClients.length,
            receita_potencial_mensal: potentialRevenue,
            receita_realizada: totalReceitas,
            despesas_totais: totalDespesas,
            lucro_periodo: lucro,
            margem_lucro: margem.toFixed(1) + '%',
          },

          saude_financeira: {
            ativo_total: totalAtivo,
            passivo_total: totalPassivo,
            patrimonio_liquido: totalAtivo - totalPassivo,
            liquidez: totalPassivo > 0 ? (totalAtivo / totalPassivo).toFixed(2) : 'N/A',
            endividamento: totalAtivo > 0 ? ((totalPassivo / totalAtivo) * 100).toFixed(1) + '%' : '0%',
          },

          inadimplencia: {
            total_em_atraso: totalOverdue,
            faturas_atrasadas: overdueInvoices.length,
            taxa: (totalOverdue / (totalReceitas || 1) * 100).toFixed(1) + '%',
          },

          despesas_principais: Object.entries(expensesByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([cat, val]) => ({
              categoria: cat,
              valor: val,
              percentual: ((val / totalDespesas) * 100).toFixed(1) + '%'
            })),

          evolucao_mensal: Object.keys(revenueByMonth).sort().map(month => ({
            mes: month,
            receita: revenueByMonth[month] || 0,
            despesa: expensesByMonth[month] || 0,
            resultado: (revenueByMonth[month] || 0) - (expensesByMonth[month] || 0),
          })),
        };

        userPrompt = `
DIAGNÓSTICO EMPRESARIAL COMPLETO - AMPLA CONTABILIDADE

DADOS COMPLETOS DA EMPRESA:
${JSON.stringify(analysisData, null, 2)}

ANÁLISE EXECUTIVA SOLICITADA:

1. RESUMO EXECUTIVO
   - Situação geral da empresa em 3 parágrafos
   - Principais conquistas do período
   - Maiores desafios identificados

2. ANÁLISE SWOT FINANCEIRA
   - Forças (pontos positivos)
   - Fraquezas (pontos a melhorar)
   - Oportunidades (potencial não explorado)
   - Ameaças (riscos a monitorar)

3. INDICADORES vs BENCHMARKS
   - Compare cada indicador com padrão do setor
   - Classifique: Excelente / Bom / Regular / Crítico
   - Meta recomendada para cada um

4. PLANO DE AÇÃO PRIORITÁRIO
   - TOP 5 ações de maior impacto
   - Responsável sugerido
   - Prazo recomendado
   - Resultado esperado

5. PROJEÇÕES
   - Cenário otimista (se implementar ações)
   - Cenário base (se manter atual)
   - Cenário pessimista (se não agir)

6. SCORE GERAL DA EMPRESA
   - Nota de 0 a 100
   - Justificativa da nota
   - O que precisa para chegar a 100

Seja DIRETO, use NÚMEROS e TABELAS. Este é um relatório para tomada de decisão.
`;
        break;
      }

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    // Chamar Gemini diretamente
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: MANAGER_PROFILE + "\n\n" + userPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar análise.";

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
