/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                  DASHBOARD - MAESTRO UX 2.0                       ║
 * ║                                                                   ║
 * ║  Dashboard principal do Contta com design AI-First               ║
 * ║  Baseado nos tokens e componentes do Maestro UX                  ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, 
  BarChart3, CheckCircle2, Clock, Eye, Bot, Brain, 
  Sparkles, ArrowUpRight, ArrowDownRight, Activity,
  CreditCard, Receipt, FileText, PiggyBank, Wallet,
  ChevronRight, RefreshCw, Lightbulb, Zap, Bell
} from "lucide-react";

// Maestro UX Components
import { DashboardLayout } from "@/design-system/layouts/DashboardLayout";
import { Card, CardContent } from "@/design-system/components/Card";
import { KPICard } from "@/design-system/components/KPI";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { CommandTrigger } from "@/design-system/components/CommandPalette";
import { useOnboarding, ONBOARDING_FLOWS } from "@/ux/onboarding";
import { useHints, InlineHint } from "@/ux/hints";

// Existing components
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/data/expensesData";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { getDashboardBalances, getAdiantamentosSocios, getExpenses } from "@/lib/accountMapping";

// Types
interface DashboardStats {
  totalClients: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalPending: number;
  totalOverdue: number;
  totalExpenses: number;
}

interface AccountingBalance {
  bank_balance: number;
  accounts_receivable: number;
  partner_advances: number;
  total_revenue: number;
  total_expenses: number;
}

interface AIInsight {
  id: string;
  type: 'alert' | 'suggestion' | 'celebration';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  action?: {
    label: string;
    route: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// 🤖 DR. CÍCERO - AI INSIGHTS COMPONENT
// ═══════════════════════════════════════════════════════════════

function DrCiceroInsights({ 
  balances, 
  stats 
}: { 
  balances: AccountingBalance | null; 
  stats: DashboardStats;
}) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<AIInsight[]>([]);

  useEffect(() => {
    // Generate AI insights based on financial data
    const newInsights: AIInsight[] = [];

    // Alert for overdue invoices
    if (stats.overdueInvoices > 0) {
      newInsights.push({
        id: 'overdue-alert',
        type: 'alert',
        title: 'Atenção com Inadimplência',
        message: `${stats.overdueInvoices} faturas vencidas totalizando ${formatCurrency(stats.totalOverdue)}. Recomendo ações de cobrança.`,
        priority: 'high',
        action: {
          label: 'Ver Inadimplência',
          route: '/inadimplencia-dashboard'
        }
      });
    }

    // Suggestion for bank reconciliation
    if (balances && balances.bank_balance > 50000) {
      newInsights.push({
        id: 'cash-suggestion',
        type: 'suggestion',
        title: 'Oportunidade Financeira',
        message: `Saldo bancário elevado de ${formatCurrency(balances.bank_balance)}. Considere investimentos ou antecipação de pagamentos.`,
        priority: 'medium'
      });
    }

    // Celebration for good performance
    if (balances && balances.total_revenue > balances.total_expenses * 1.5) {
      newInsights.push({
        id: 'profit-celebration',
        type: 'celebration',
        title: 'Excelente Resultado!',
        message: `Receitas superam despesas em ${formatCurrency(balances.total_revenue - balances.total_expenses)}. Parabéns pela gestão!`,
        priority: 'low'
      });
    }

    // Add default insight if none
    if (newInsights.length === 0) {
      newInsights.push({
        id: 'default',
        type: 'suggestion',
        title: 'Tudo em Ordem',
        message: 'Os indicadores financeiros estão dentro dos parâmetros esperados. Continue o bom trabalho!',
        priority: 'low'
      });
    }

    setInsights(newInsights);
  }, [balances, stats]);

  return (
    <Card variant="ai">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ai-500/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-ai-500" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-800">Dr. Cícero</h3>
              <p className="text-xs text-neutral-500">Insights financeiros</p>
            </div>
          </div>
          <Badge variant="ai" size="sm">
            <Sparkles className="h-3 w-3 mr-1" />
            AI
          </Badge>
        </div>

        {/* Insights List */}
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={cn(
                "p-3 rounded-lg border transition-all",
                insight.type === 'alert' && "bg-danger-50 border-danger-200",
                insight.type === 'suggestion' && "bg-primary-50 border-primary-200",
                insight.type === 'celebration' && "bg-success-50 border-success-200"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  insight.type === 'alert' && "bg-danger-100 text-danger-600",
                  insight.type === 'suggestion' && "bg-primary-100 text-primary-600",
                  insight.type === 'celebration' && "bg-success-100 text-success-600"
                )}>
                  {insight.type === 'alert' && <AlertCircle className="h-4 w-4" />}
                  {insight.type === 'suggestion' && <Lightbulb className="h-4 w-4" />}
                  {insight.type === 'celebration' && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-neutral-800 mb-1">
                    {insight.title}
                  </h4>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {insight.message}
                  </p>
                  {insight.action && (
                    <button
                      onClick={() => navigate(insight.action!.route)}
                      className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      {insight.action.label}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📊 QUICK ACTIONS COMPONENT
// ═══════════════════════════════════════════════════════════════

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: FileText, label: 'Importar OFX', route: '/bank-import', color: 'primary' },
    { icon: Receipt, label: 'Nova Fatura', route: '/invoices', color: 'success' },
    { icon: CreditCard, label: 'Despesas', route: '/expenses', color: 'warning' },
    { icon: BarChart3, label: 'Relatórios', route: '/reports', color: 'neutral' },
  ];

  return (
    <Card variant="interactive">
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-neutral-700 mb-3">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <button
              key={action.route}
              onClick={() => navigate(action.route)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg transition-all",
                "hover:bg-neutral-50 border border-transparent hover:border-neutral-200",
                "text-left"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                action.color === 'primary' && "bg-primary-100 text-primary-600",
                action.color === 'success' && "bg-success-100 text-success-600",
                action.color === 'warning' && "bg-warning-100 text-warning-600",
                action.color === 'neutral' && "bg-neutral-100 text-neutral-600"
              )}>
                <action.icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-neutral-700">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📈 TREND INDICATOR COMPONENT
// ═══════════════════════════════════════════════════════════════

function TrendBadge({ value, isPositive }: { value: number; isPositive?: boolean }) {
  const isUp = value >= 0;
  const showPositive = isPositive !== undefined ? isPositive : isUp;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
      showPositive ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"
    )}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🏠 DASHBOARD MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DashboardNew() {
  const navigate = useNavigate();
  const { selectedYear, selectedMonth } = usePeriod();
  const { startFlow, hasCompletedFlow } = useOnboarding();
  const { showHint } = useHints();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalPending: 0,
    totalOverdue: 0,
    totalExpenses: 0,
  });
  const [balances, setBalances] = useState<AccountingBalance | null>(null);

  // Load dashboard data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch clients count
      const { count: totalClients } = await supabase
        .from("clients")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .not("is_pro_bono", "eq", true)
        .not("monthly_fee", "eq", 0);

      // Fetch invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*");

      const pendingInvoices = invoices?.filter(i => i.status === "pending" || i.status === "overdue") || [];
      const overdueInvoices = invoices?.filter(i => i.status === "overdue") || [];

      // Fetch accounting balances
      const dashboardBalances = await getDashboardBalances(selectedYear, selectedMonth);
      const adiantamentos = await getAdiantamentosSocios(selectedYear, selectedMonth);

      setStats({
        totalClients: totalClients || 0,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
        totalPending: pendingInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
        totalOverdue: overdueInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
        totalExpenses: dashboardBalances.totalDespesas,
      });

      setBalances({
        bank_balance: dashboardBalances.saldoBanco,
        accounts_receivable: dashboardBalances.contasReceber,
        partner_advances: adiantamentos.total,
        total_revenue: dashboardBalances.totalReceitas,
        total_expenses: dashboardBalances.totalDespesas,
      });

    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show onboarding for new users
  useEffect(() => {
    if (!hasCompletedFlow('welcome')) {
      setTimeout(() => {
        startFlow(ONBOARDING_FLOWS.WELCOME);
      }, 1000);
    }
  }, [hasCompletedFlow, startFlow]);

  // Show hint for Command Palette
  useEffect(() => {
    showHint({
      id: 'command-palette-intro',
      title: 'Navegação Rápida',
      message: 'Pressione ⌘K (ou Ctrl+K) para abrir a busca rápida e navegar entre páginas.',
      variant: 'ai'
    });
  }, [showHint]);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800 mb-1">
              Dashboard Financeiro
            </h1>
            <p className="text-neutral-500">
              Visão geral da saúde financeira da Ampla
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CommandTrigger />
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Welcome hint for first-time users */}
      <InlineHint id="dashboard-welcome" variant="ai" className="mb-6">
        <strong>Bem-vindo ao Contta!</strong> Este é seu painel financeiro inteligente. 
        O Dr. Cícero vai ajudá-lo com insights e recomendações.
      </InlineHint>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Saldo Bancário"
          value={formatCurrency(balances?.bank_balance || 0)}
          icon={<Wallet className="h-5 w-5" />}
          trend={{ value: 5.2, direction: "up", label: "vs mês anterior" }}
          accentColor="primary"
          loading={loading}
        />
        <KPICard
          title="Contas a Receber"
          value={formatCurrency(balances?.accounts_receivable || 0)}
          icon={<Receipt className="h-5 w-5" />}
          trend={{ value: -2.3, direction: "down", label: "vs mês anterior" }}
          accentColor="success"
          loading={loading}
        />
        <KPICard
          title="Receita do Mês"
          value={formatCurrency(balances?.total_revenue || 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={{ value: 8.1, direction: "up", label: "vs mês anterior" }}
          accentColor="success"
          loading={loading}
        />
        <KPICard
          title="Despesas do Mês"
          value={formatCurrency(balances?.total_expenses || 0)}
          icon={<TrendingDown className="h-5 w-5" />}
          trend={{ value: 3.4, direction: "up", label: "vs mês anterior" }}
          trendPositiveIsGood={false}
          accentColor="warning"
          loading={loading}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard
          title="Clientes Ativos"
          value={stats.totalClients.toString()}
          icon={<Users className="h-5 w-5" />}
          accentColor="primary"
          loading={loading}
        />
        <KPICard
          title="Faturas Pendentes"
          value={stats.pendingInvoices.toString()}
          subtitle={formatCurrency(stats.totalPending)}
          icon={<Clock className="h-5 w-5" />}
          accentColor="warning"
          loading={loading}
        />
        <KPICard
          title="Faturas Vencidas"
          value={stats.overdueInvoices.toString()}
          subtitle={formatCurrency(stats.totalOverdue)}
          icon={<AlertCircle className="h-5 w-5" />}
          accentColor="error"
          loading={loading}
        />
      </div>

      {/* AI Insights + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <DrCiceroInsights balances={balances} stats={stats} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cash Flow Summary */}
        <Card variant="interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-800">Fluxo de Caixa</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/cash-flow')}
              >
                Ver Detalhes
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-success-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ArrowUpRight className="h-5 w-5 text-success-600" />
                  <span className="text-sm text-neutral-700">Entradas</span>
                </div>
                <span className="font-semibold text-success-700">
                  {formatCurrency(balances?.total_revenue || 0)}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-danger-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ArrowDownRight className="h-5 w-5 text-danger-600" />
                  <span className="text-sm text-neutral-700">Saídas</span>
                </div>
                <span className="font-semibold text-danger-700">
                  {formatCurrency(balances?.total_expenses || 0)}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                <div className="flex items-center gap-3">
                  <PiggyBank className="h-5 w-5 text-primary-600" />
                  <span className="text-sm font-medium text-neutral-700">Resultado</span>
                </div>
                <span className="font-bold text-lg text-primary-700">
                  {formatCurrency((balances?.total_revenue || 0) - (balances?.total_expenses || 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Status */}
        <Card variant="interactive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-800">Agentes IA</h3>
              <Badge variant="success" size="sm">
                <Activity className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
            </div>

            <div className="space-y-3">
              {/* Dr. Cícero Agent */}
              <div className="flex items-center gap-4 p-3 bg-ai-50 rounded-lg border border-ai-200">
                <div className="w-10 h-10 rounded-full bg-ai-100 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-ai-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-800">Dr. Cícero</span>
                    <Badge variant="ai" size="sm">Contador IA</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Analisando dados financeiros...
                  </p>
                </div>
                <div className="flex items-center gap-1 text-success-600">
                  <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                  <span className="text-xs font-medium">Online</span>
                </div>
              </div>

              {/* Gestor IA Agent */}
              <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-800">Gestor IA</span>
                    <Badge variant="secondary" size="sm">Análises</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Monitorando indicadores de performance
                  </p>
                </div>
                <div className="flex items-center gap-1 text-success-600">
                  <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                  <span className="text-xs font-medium">Online</span>
                </div>
              </div>
            </div>

            <Button
              variant="ai"
              size="sm"
              className="w-full mt-4"
              onClick={() => navigate('/ai-chat')}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Conversar com Dr. Cícero
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
