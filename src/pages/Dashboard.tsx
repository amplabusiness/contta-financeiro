import { useEffect, useState, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { PeriodFilter } from "@/components/PeriodFilter";
import { MetricCard } from "@/components/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, BarChart3, CheckCircle2, XCircle, Clock, Eye, Bot, Brain, Zap, FileText, Activity, CircleDot, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { useClient } from "@/contexts/ClientContext";
import { usePeriod } from "@/contexts/PeriodContext";
import { MetricDetailDialog } from "@/components/MetricDetailDialog";
import { useOfflineMode } from "@/hooks/useOfflineMode";
import { cn } from "@/lib/utils";
import { getDashboardBalances, getAdiantamentosSocios, getExpenses } from "@/lib/accountMapping";

// Tipos para agentes IA
interface AgentStatus {
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  status: 'active' | 'idle' | 'working';
  tasksToday: number;
  lastAction: string;
  accuracy: number;
}

interface AgentTask {
  id: string;
  name: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  message: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedClientId, selectedClientName, setSelectedClient } = useClient();
  const { selectedYear, selectedMonth } = usePeriod();
  const { isOfflineMode, offlineData, saveOfflineData } = useOfflineMode();
  const [stats, setStats] = useState({
    totalClients: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalPending: 0,
    totalOverdue: 0,
    pendingExpenses: 0,
    totalExpenses: 0,
  });
  // Saldos contabeis (fonte da verdade) - formato de razão
  const [accountingBalances, setAccountingBalances] = useState<{
    bank_balance: number;
    accounts_receivable: number;
    partner_advances: number;
    total_revenue: number;
    total_expenses: number;
    // Formato de razão: SI + D - C = SF
    banco?: {
      saldoInicial: number;
      debitos: number;
      creditos: number;
      saldoFinal: number;
    };
    receber?: {
      saldoInicial: number;
      debitos: number;
      creditos: number;
      saldoFinal: number;
    };
  } | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsHealth, setClientsHealth] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Estados dos agentes IA
  const [isAutomationActive, setIsAutomationActive] = useState(true);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [lastAgentUpdate, setLastAgentUpdate] = useState<Date>(new Date());
  const [cycleCount, setCycleCount] = useState(0);
  const automationRef = useRef<NodeJS.Timeout | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([
    {
      name: "Dr. Cícero",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      status: 'idle',
      tasksToday: 0,
      lastAction: "Aguardando...",
      accuracy: 98.5,
    },
    {
      name: "Gestor IA",
      icon: Brain,
      color: "text-violet-600",
      bgColor: "bg-violet-100",
      status: 'idle',
      tasksToday: 0,
      lastAction: "Aguardando...",
      accuracy: 97.2,
    },
  ]);

  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    data: any[];
    type: "invoices" | "expenses" | "clients";
  }>({
    open: false,
    title: "",
    description: "",
    data: [],
    type: "invoices",
  });

  useEffect(() => {
    if (isOfflineMode && offlineData) {
      // Carregar dados do cache quando offline
      setStats(offlineData.dashboardStats || stats);
      setClients(offlineData.clients || []);
      setRecentInvoices(offlineData.invoices || []);
      setLoading(false);
    } else {
      // Carregar dados do servidor quando online
      loadDashboardData();
    }
  }, [selectedClientId, isOfflineMode]); // Recarregar quando mudar o cliente selecionado ou modo offline

  const loadDashboardData = useCallback(async () => {
    try {
      // Construir queries com filtro de cliente se selecionado
      let clientsQuery = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .not("is_pro_bono", "eq", true)
        .not("monthly_fee", "eq", 0)
        .order("name");

      let recentInvoicesQuery = supabase.from("invoices").select("*, clients(name)").order("created_at", { ascending: false }).limit(10);

      // FONTE DA VERDADE: accounting_entries (despesas são contas do grupo 4.*)

      let allInvoicesQuery = supabase.from("invoices").select("*");
      let openingBalanceQuery = supabase.from("client_opening_balance").select("*, clients(name)").in("status", ["pending", "partial", "overdue"]);

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        clientsQuery = clientsQuery.eq("id", selectedClientId);
        recentInvoicesQuery = recentInvoicesQuery.eq("client_id", selectedClientId);
        allInvoicesQuery = allInvoicesQuery.eq("client_id", selectedClientId);
        openingBalanceQuery = openingBalanceQuery.eq("client_id", selectedClientId);
      }

      // Usar Promise.allSettled para não falhar se uma query falhar
      const results = await Promise.allSettled([
        clientsQuery,
        recentInvoicesQuery,
        allInvoicesQuery,
        openingBalanceQuery,
      ]);

      // FONTE DA VERDADE: Buscar saldos direto das contas contábeis
      // Cada tela consulta a conta que precisa - alteração reflete imediato
      const dashboardBalances = await getDashboardBalances(selectedYear, selectedMonth);
      const adiantamentos = await getAdiantamentosSocios(selectedYear, selectedMonth);

      setAccountingBalances({
        bank_balance: dashboardBalances.saldoBanco,
        accounts_receivable: dashboardBalances.contasReceber,
        partner_advances: adiantamentos.total,
        total_revenue: dashboardBalances.totalReceitas,
        total_expenses: dashboardBalances.totalDespesas,
        // Formato de razão: SI + D - C = SF
        banco: dashboardBalances.banco,
        receber: dashboardBalances.receber,
      });

      // Extrair dados com fallback para array vazio
      const clientsRes = results[0].status === 'fulfilled' ? results[0].value : { count: 0, data: [] };
      const recentInvoicesRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
      const allInvoicesRes = results[2].status === 'fulfilled' ? results[2].value : { data: [] };
      const openingBalanceRes = results[3].status === 'fulfilled' ? results[3].value : { data: [] };

      // Logar erros se houver
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const queryNames = ['clients', 'recentInvoices', 'allInvoices', 'openingBalance'];
          console.warn(`Erro ao carregar ${queryNames[index]}:`, result.reason?.message || String(result.reason));
        }
      });

      // FONTE DA VERDADE: Buscar despesas da contabilidade (grupo 4.*)
      const expensesData = await getExpenses(selectedYear, selectedMonth);

      const totalClients = clientsRes.count || 0;
      const recentInvoices = recentInvoicesRes.data || [];
      const clientsList = clientsRes.data || [];
      const allInvoices = allInvoicesRes.data || [];
      const openingBalances = openingBalanceRes.data || [];

      // CORRIGIDO: Calcular KPIs com TODAS as invoices + saldos de abertura
      // Honorários Pendentes = pending + overdue (tudo que ainda não foi pago)
      const pendingInvoices = allInvoices.filter((i) => i.status === "pending" || i.status === "overdue");
      const overdueInvoices = allInvoices.filter((i) => i.status === "overdue");

      // Calcular saldos de abertura pendentes
      const openingBalancePending = openingBalances.filter(ob => ob.status === "pending" || ob.status === "partial");
      const openingBalanceOverdue = openingBalances.filter(ob => {
        // Considerar vencido se data de vencimento já passou
        const dueDate = ob.due_date ? new Date(ob.due_date) : null;
        const isOverdue = dueDate && dueDate < new Date();
        return ob.status === "overdue" || (isOverdue && (ob.status === "pending" || ob.status === "partial"));
      });

      // Total de saldo de abertura pendente (valor - valor pago)
      const openingBalancePendingTotal = openingBalancePending.reduce((sum, ob) => {
        const remaining = Number(ob.amount || 0) - Number(ob.paid_amount || 0);
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);

      // Total de saldo de abertura vencido
      const openingBalanceOverdueTotal = openingBalanceOverdue.reduce((sum, ob) => {
        const remaining = Number(ob.amount || 0) - Number(ob.paid_amount || 0);
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);

      setStats({
        totalClients,
        pendingInvoices: pendingInvoices.length + openingBalancePending.length,
        overdueInvoices: overdueInvoices.length + openingBalanceOverdue.length,
        totalPending: pendingInvoices.reduce((sum, i) => sum + Number(i.amount), 0) + openingBalancePendingTotal,
        totalOverdue: overdueInvoices.reduce((sum, i) => sum + Number(i.amount), 0) + openingBalanceOverdueTotal,
        // FONTE DA VERDADE: accounting_entries (despesas são contas do grupo 4.*)
        pendingExpenses: expensesData.entries.length,
        totalExpenses: expensesData.totalExpenses,
      });

      // Calcular saúde financeira de cada cliente (incluindo saldo de abertura)
      const healthData: Record<string, any> = {};
      clientsList.forEach((client) => {
        const clientInvoices = allInvoices.filter((inv) => inv.client_id === client.id);
        const clientOpeningBalances = openingBalances.filter((ob) => ob.client_id === client.id);

        const overdue = clientInvoices.filter((inv) => inv.status === "overdue");
        const pending = clientInvoices.filter((inv) => inv.status === "pending");
        const paid = clientInvoices.filter((inv) => inv.status === "paid");

        // Saldos de abertura vencidos
        const obOverdue = clientOpeningBalances.filter(ob => {
          const dueDate = ob.due_date ? new Date(ob.due_date) : null;
          const isOverdue = dueDate && dueDate < new Date();
          return ob.status === "overdue" || (isOverdue && (ob.status === "pending" || ob.status === "partial"));
        });
        const obPending = clientOpeningBalances.filter(ob => ob.status === "pending" || ob.status === "partial");

        const totalOverdue = overdue.reduce((sum, inv) => sum + Number(inv.amount), 0) +
          obOverdue.reduce((sum, ob) => sum + (Number(ob.amount || 0) - Number(ob.paid_amount || 0)), 0);
        const totalPending = pending.reduce((sum, inv) => sum + Number(inv.amount), 0) +
          obPending.reduce((sum, ob) => sum + (Number(ob.amount || 0) - Number(ob.paid_amount || 0)), 0);

        // Última movimentação (última fatura paga ou criada)
        const sortedInvoices = clientInvoices.sort((a, b) =>
          new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        const lastActivity = sortedInvoices[0];

        const totalOverdueCount = overdue.length + obOverdue.length;
        const totalPendingCount = pending.length + obPending.length;

        healthData[client.id] = {
          overdueCount: totalOverdueCount,
          overdueAmount: totalOverdue,
          pendingCount: totalPendingCount,
          pendingAmount: totalPending,
          paidCount: paid.length,
          lastActivity: lastActivity ? new Date(lastActivity.updated_at || lastActivity.created_at) : null,
          healthStatus: totalOverdueCount > 0 ? "critical" : totalPendingCount > 2 ? "warning" : "healthy",
        };
      });

      setClientsHealth(healthData);
      setRecentInvoices(recentInvoices);
      setClients(clientsList);

      // Salvar dados no cache para modo offline
      saveOfflineData({
        dashboardStats: stats,
        clients: clientsList,
        invoices: recentInvoices,
      });
    } catch (error) {
      console.error("Erro crítico ao carregar dados da Dashboard:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Se falhar e houver dados em cache, usar dados em cache
      if (offlineData) {
        console.log("Usando dados em cache devido a erro de conexão");
        setStats(offlineData.dashboardStats || stats);
        setClients(offlineData.clients || []);
        setRecentInvoices(offlineData.invoices || []);
      }

      // Mostrar toast com erro amigável
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        console.warn("Problema de conectividade com o servidor. Verifique sua internet.");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, selectedYear, selectedMonth, saveOfflineData, offlineData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]); // Recarregar quando mudar o cliente ou período selecionado

  // =====================================================
  // AUTOMAÇÃO DOS AGENTES IA (executa a cada 60s)
  // =====================================================
  const updateAgent = useCallback((name: string, updates: Partial<AgentStatus>) => {
    setAgents(prev => prev.map(agent =>
      agent.name === name ? { ...agent, ...updates } : agent
    ));
  }, []);

  const addTask = useCallback((task: Omit<AgentTask, 'id'>) => {
    const newTask: AgentTask = { ...task, id: Math.random().toString(36).substr(2, 9) };
    setAgentTasks(prev => [...prev, newTask]);
    return newTask.id;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<AgentTask>) => {
    setAgentTasks(prev => prev.map(task =>
      task.id === id ? { ...task, ...updates } : task
    ));
  }, []);

  const runAgentCycle = useCallback(async () => {
    if (!isAutomationActive) return;

    setCycleCount(prev => prev + 1);

    // Limpar tarefas antigas
    setAgentTasks(prev => prev.filter(t => t.status !== 'completed'));

    // 1. Dr. Cícero - Classificação e Conciliação
    const drCiceroTaskId = addTask({
      name: 'Classificação e Conciliação',
      agent: 'Dr. Cícero',
      status: 'running',
      progress: 0,
      message: 'Analisando transações...',
    });

    updateAgent('Dr. Cícero', { status: 'working', lastAction: 'Processando...' });

    try {
      // FONTE DA VERDADE: Buscar lançamentos contábeis para análise
      const expensesData = await getExpenses(selectedYear, selectedMonth);

      updateTask(drCiceroTaskId, { progress: 50, message: `${expensesData.entries.length} lançamentos analisados` });

      // Calcular estatísticas das despesas
      const categorizedCount = expensesData.summary.length;

      updateTask(drCiceroTaskId, {
        status: 'completed',
        progress: 100,
        message: `${categorizedCount} categorias`
      });

      updateAgent('Dr. Cícero', {
        status: 'active',
        lastAction: `${categorizedCount} categorias`,
        tasksToday: prev => (typeof prev === 'number' ? prev : 0) + 1,
      });

    } catch (error) {
      updateTask(drCiceroTaskId, { status: 'error', message: 'Erro no processamento' });
      updateAgent('Dr. Cícero', { status: 'idle', lastAction: 'Erro' });
    }

    // 2. Gestor IA - Análise de indicadores
    const gestorTaskId = addTask({
      name: 'Análise de indicadores',
      agent: 'Gestor IA',
      status: 'running',
      progress: 0,
      message: 'Calculando métricas...',
    });

    updateAgent('Gestor IA', { status: 'working', lastAction: 'Analisando...' });

    try {
      updateTask(gestorTaskId, { progress: 50, message: 'Verificando inadimplência...' });

      // Já temos os stats carregados
      const taxaInadimplencia = stats.totalPending > 0
        ? (stats.totalOverdue / stats.totalPending) * 100
        : 0;

      updateTask(gestorTaskId, {
        status: 'completed',
        progress: 100,
        message: `Inadimplência: ${taxaInadimplencia.toFixed(1)}%`
      });

      updateAgent('Gestor IA', {
        status: 'active',
        lastAction: `Inadimp: ${taxaInadimplencia.toFixed(1)}%`,
        tasksToday: prev => (typeof prev === 'number' ? prev : 0) + 1,
      });

    } catch (error) {
      updateTask(gestorTaskId, { status: 'error', message: 'Erro na análise' });
      updateAgent('Gestor IA', { status: 'idle', lastAction: 'Erro' });
    }

    setLastAgentUpdate(new Date());

    // Remover tarefas completadas após 5 segundos
    setTimeout(() => {
      setAgentTasks(prev => prev.filter(t => t.status !== 'completed'));
    }, 5000);

  }, [isAutomationActive, addTask, updateTask, updateAgent, stats]);

  // Iniciar ciclo automático
  useEffect(() => {
    if (isAutomationActive && !loading) {
      // Executar imediatamente
      runAgentCycle();

      // Configurar intervalo (60 segundos)
      automationRef.current = setInterval(runAgentCycle, 60000);
    }

    return () => {
      if (automationRef.current) {
        clearInterval(automationRef.current);
      }
    };
  }, [isAutomationActive, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'working': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  const handleViewClient = (clientId: string, clientName: string) => {
    setSelectedClient(clientId, clientName);
    navigate("/client-dashboard");
  };

  const showDetail = async (type: "pending" | "overdue" | "expenses" | "clients") => {
    try {
      if (type === "clients") {
        setDetailDialog({
          open: true,
          title: selectedClientId ? "Cliente Selecionado" : "Clientes Ativos",
          description: selectedClientId
            ? `Dados do cliente: ${selectedClientName}`
            : `Total de ${clients.length} clientes ativos no sistema`,
          data: clients,
          type: "clients",
        });
      } else if (type === "pending") {
        // Buscar faturas pendentes
        let invoicesQuery = supabase
          .from("invoices")
          .select("*, clients(name)")
          .in("status", ["pending", "overdue"])
          .order("due_date", { ascending: true });

        let openingBalanceQuery = supabase
          .from("client_opening_balance")
          .select("*, clients(name)")
          .in("status", ["pending", "partial", "overdue"]);

        if (selectedClientId) {
          invoicesQuery = invoicesQuery.eq("client_id", selectedClientId);
          openingBalanceQuery = openingBalanceQuery.eq("client_id", selectedClientId);
        }

        const results = await Promise.allSettled([
          invoicesQuery,
          openingBalanceQuery,
        ]);

        const invoicesData = results[0].status === 'fulfilled' ? results[0].value.data : null;
        const openingBalanceData = results[1].status === 'fulfilled' ? results[1].value.data : null;

        if (results[0].status === 'rejected') {
          console.warn("Erro ao buscar faturas pendentes:", results[0].reason?.message);
        }
        if (results[1].status === 'rejected') {
          console.warn("Erro ao buscar saldos de abertura:", results[1].reason?.message);
        }

        // Transformar saldos de abertura para formato similar às faturas
        const openingBalanceItems = (openingBalanceData || []).map(ob => ({
          ...ob,
          amount: Number(ob.amount || 0) - Number(ob.paid_amount || 0),
          isOpeningBalance: true,
          description: `Saldo de Abertura - ${ob.competence}`,
        }));

        const allItems = [...(invoicesData || []), ...openingBalanceItems];

        setDetailDialog({
          open: true,
          title: selectedClientId ? `Honorários Pendentes - ${selectedClientName}` : "Honorários Pendentes",
          description: `${allItems.length} itens aguardando pagamento (faturas + saldo de abertura)`,
          data: allItems,
          type: "invoices",
        });
      } else if (type === "overdue") {
        // Buscar faturas vencidas
        let invoicesQuery = supabase
          .from("invoices")
          .select("*, clients(name)")
          .eq("status", "overdue")
          .order("due_date", { ascending: true });

        let openingBalanceQuery = supabase
          .from("client_opening_balance")
          .select("*, clients(name)")
          .in("status", ["pending", "partial", "overdue"]);

        if (selectedClientId) {
          invoicesQuery = invoicesQuery.eq("client_id", selectedClientId);
          openingBalanceQuery = openingBalanceQuery.eq("client_id", selectedClientId);
        }

        const results = await Promise.allSettled([
          invoicesQuery,
          openingBalanceQuery,
        ]);

        const invoicesData = results[0].status === 'fulfilled' ? results[0].value.data : null;
        const openingBalanceData = results[1].status === 'fulfilled' ? results[1].value.data : null;

        if (results[0].status === 'rejected') {
          console.warn("Erro ao buscar faturas vencidas:", results[0].reason?.message);
        }
        if (results[1].status === 'rejected') {
          console.warn("Erro ao buscar saldos de abertura vencidos:", results[1].reason?.message);
        }

        // Filtrar saldos de abertura vencidos
        const now = new Date();
        const overdueOpeningBalances = (openingBalanceData || []).filter(ob => {
          const dueDate = ob.due_date ? new Date(ob.due_date) : null;
          return ob.status === "overdue" || (dueDate && dueDate < now && (ob.status === "pending" || ob.status === "partial"));
        }).map(ob => ({
          ...ob,
          amount: Number(ob.amount || 0) - Number(ob.paid_amount || 0),
          status: "overdue",
          isOpeningBalance: true,
          description: `Saldo de Abertura - ${ob.competence}`,
        }));

        const allItems = [...(invoicesData || []), ...overdueOpeningBalances];

        setDetailDialog({
          open: true,
          title: selectedClientId ? `Inadimplência - ${selectedClientName}` : "Inadimplência",
          description: `${allItems.length} itens vencidos (faturas + saldo de abertura)`,
          data: allItems,
          type: "invoices",
        });
      } else if (type === "expenses") {
        // FONTE DA VERDADE: Buscar despesas da contabilidade (accounting_entries)
        const expensesData = await getExpenses(selectedYear, selectedMonth);

        // Transformar para formato compatível com o dialog
        const formattedData = expensesData.entries.map(entry => ({
          id: entry.id,
          description: entry.description,
          amount: entry.amount,
          due_date: entry.date,
          category: entry.accountName,
          status: "completed",
          accountCode: entry.accountCode,
          costCenterName: entry.costCenterName,
        }));

        const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        setDetailDialog({
          open: true,
          title: selectedClientId ? `Despesas - ${selectedClientName}` : "Despesas do Período",
          description: `${formattedData.length} lançamentos em ${monthName} - Fonte: Contabilidade (accounting_entries)`,
          data: formattedData,
          type: "expenses",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes:", {
        message: error instanceof Error ? error.message : String(error),
        error,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
      canceled: "secondary",
    };
    const labels: Record<string, string> = {
      paid: "Pago",
      pending: "Pendente",
      overdue: "Vencido",
      canceled: "Cancelado",
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            {selectedClientId ? `Dashboard - ${selectedClientName}` : "Dashboard Geral"}
          </h1>
          <p className="text-muted-foreground">
            {selectedClientId
              ? "Visão financeira do cliente selecionado"
              : "Visão geral do sistema financeiro - selecione um cliente para filtrar"
            }
          </p>
        </div>

        <PeriodFilter />

        {/* ========== DASHBOARD DOS AGENTES IA ========== */}
        <Card className="bg-gradient-to-r from-violet-50 to-blue-50 border-violet-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bot className="h-6 w-6 text-violet-600" />
                  <Zap className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                </div>
                <div>
                  <CardTitle className="text-lg">Agentes IA</CardTitle>
                  <CardDescription>
                    Automação 100% - Ciclo #{cycleCount} | Atualizado: {lastAgentUpdate.toLocaleTimeString('pt-BR')}
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant={isAutomationActive ? "default" : "secondary"}
                className={cn(
                  "px-3 py-1",
                  isAutomationActive && "bg-green-600 animate-pulse"
                )}
              >
                {isAutomationActive ? (
                  <>
                    <CircleDot className="h-3 w-3 mr-1 animate-pulse" />
                    ATIVO
                  </>
                ) : "PAUSADO"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {agents.map((agent, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-2 rounded-lg", agent.bgColor)}>
                        <agent.icon className={cn("h-4 w-4", agent.color)} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {agent.name}
                          <span className={cn("w-2 h-2 rounded-full", getAgentStatusColor(agent.status))} />
                        </div>
                        <div className="text-xs text-muted-foreground">{agent.lastAction}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{agent.tasksToday}</div>
                      <div className="text-[10px] text-muted-foreground">hoje</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tarefas em execução */}
            {agentTasks.length > 0 && (
              <div className="mt-3 space-y-2">
                {agentTasks.map((task) => (
                  <div key={task.id} className="bg-white rounded-lg p-2 border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{task.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{task.agent}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={task.progress} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-20 text-right">{task.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* ========== FIM DASHBOARD DOS AGENTES ========== */}

        {/* Saldos Contábeis - Formato Razão (SI + D - C = SF) */}
        {accountingBalances && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Saldo Banco */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Saldo Banco (Razão)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {accountingBalances.banco ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Saldo Inicial:</span>
                      <span>{formatCurrency(accountingBalances.banco.saldoInicial)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-green-600">
                      <span>+ Débitos:</span>
                      <span>{formatCurrency(accountingBalances.banco.debitos)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-600">
                      <span>- Créditos:</span>
                      <span>{formatCurrency(accountingBalances.banco.creditos)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold">
                      <span className="text-xs">= Saldo Final:</span>
                      <span className={cn("text-lg", accountingBalances.banco.saldoFinal < 0 && "text-destructive")}>
                        {formatCurrency(accountingBalances.banco.saldoFinal)}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">Fonte: Contabilidade</p>
                  </div>
                ) : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(accountingBalances.bank_balance)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contas a Receber */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  A Receber (Razão)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {accountingBalances.receber ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Saldo Inicial:</span>
                      <span>{formatCurrency(accountingBalances.receber.saldoInicial)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-green-600">
                      <span>+ Débitos:</span>
                      <span>{formatCurrency(accountingBalances.receber.debitos)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-600">
                      <span>- Créditos:</span>
                      <span>{formatCurrency(accountingBalances.receber.creditos)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold">
                      <span className="text-xs">= Saldo Final:</span>
                      <span className="text-lg text-green-500">
                        {formatCurrency(accountingBalances.receber.saldoFinal)}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">Fonte: Contabilidade</p>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-green-500">
                    {formatCurrency(accountingBalances.accounts_receivable)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Adiantamentos a Sócios */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Adiant. Sócios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">
                  {formatCurrency(accountingBalances.partner_advances)}
                </div>
                <p className="text-xs text-blue-600 mt-1">Fonte: Contabilidade</p>
              </CardContent>
            </Card>

            {/* Resultado do Período */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Resultado do Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Receitas:</span>
                    <span>{formatCurrency(accountingBalances.total_revenue)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-red-600">
                    <span>Despesas:</span>
                    <span>{formatCurrency(accountingBalances.total_expenses)}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span className="text-xs">= Resultado:</span>
                    <span className={cn(
                      "text-lg",
                      (accountingBalances.total_revenue - accountingBalances.total_expenses) >= 0
                        ? "text-green-500"
                        : "text-destructive"
                    )}>
                      {formatCurrency(accountingBalances.total_revenue - accountingBalances.total_expenses)}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Fonte: Contabilidade</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div onClick={() => showDetail("clients")} className="cursor-pointer">
            <MetricCard
              title="Clientes Ativos"
              value={stats.totalClients.toString()}
              icon={Users}
              variant="default"
            />
          </div>
          <div onClick={() => showDetail("pending")} className="cursor-pointer">
            <MetricCard
              title="Honorários Pendentes"
              value={formatCurrency(stats.totalPending)}
              icon={TrendingUp}
              variant="warning"
              trend={{
                value: `${stats.pendingInvoices} faturas`,
                isPositive: false,
              }}
            />
          </div>
          <div onClick={() => showDetail("overdue")} className="cursor-pointer">
            <MetricCard
              title="Inadimplência"
              value={formatCurrency(stats.totalOverdue)}
              icon={AlertCircle}
              variant="destructive"
              trend={{
                value: `${stats.overdueInvoices} vencidas`,
                isPositive: false,
              }}
            />
          </div>
          <div onClick={() => showDetail("expenses")} className="cursor-pointer">
            <MetricCard
              title="Despesas do Período"
              value={formatCurrency(stats.totalExpenses)}
              icon={TrendingDown}
              variant="default"
              trend={{
                value: `${stats.pendingExpenses} lançamentos`,
                isPositive: false,
              }}
            />
          </div>
        </div>

        {stats.overdueInvoices > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-destructive">⚠️ Atenção: Inadimplência Detectada</CardTitle>
                  <CardDescription>
                    Existem {stats.overdueInvoices} honorários vencidos totalizando {formatCurrency(stats.totalOverdue)}
                  </CardDescription>
                </div>
                <Button onClick={() => navigate("/reports")} variant="destructive">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Ver Relatório Completo
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Clientes Ativos</CardTitle>
            <CardDescription>Acesso rápido aos dashboards individuais dos clientes</CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum cliente ativo cadastrado
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => {
                  const health = clientsHealth[client.id] || {};
                  const healthStatus = health.healthStatus || "healthy";
                  
                  return (
                    <Card key={client.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{client.name}</CardTitle>
                            <CardDescription>
                              {client.email || "Sem email"}
                            </CardDescription>
                          </div>
                          {healthStatus === "healthy" && (
                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                          )}
                          {healthStatus === "warning" && (
                            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                          )}
                          {healthStatus === "critical" && (
                            <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">CNPJ:</span>
                              <span className="font-medium">{client.cnpj || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Mensalidade:</span>
                              <span className="font-medium">{formatCurrency(Number(client.monthly_fee))}</span>
                            </div>
                            {client.payment_day && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Vencimento:</span>
                                <span className="font-medium">Dia {client.payment_day}</span>
                              </div>
                            )}
                          </div>

                          {/* Indicadores de Saúde Financeira */}
                          <div className="space-y-2 pt-2 border-t">
                            {health.overdueCount > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1 text-destructive">
                                  <XCircle className="h-3 w-3" />
                                  Faturas Vencidas
                                </span>
                                <Badge variant="destructive" className="text-xs">
                                  {health.overdueCount} ({formatCurrency(health.overdueAmount)})
                                </Badge>
                              </div>
                            )}
                            
                            {health.pendingCount > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  Faturas Pendentes
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {health.pendingCount} ({formatCurrency(health.pendingAmount)})
                                </Badge>
                              </div>
                            )}
                            
                            {health.lastActivity && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Última movimentação:</span>
                                <span className="font-medium">
                                  {health.lastActivity.toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            )}
                            
                            {health.overdueCount === 0 && health.pendingCount === 0 && health.paidCount > 0 && (
                              <div className="flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 className="h-3 w-3" />
                                Todos os pagamentos em dia
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={() => handleViewClient(client.id, client.name)}
                            className="w-full mt-2"
                            variant="outline"
                          >
                            <Users className="w-4 h-4 mr-2" />
                            Ver Empresa
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Honorários Recentes</CardTitle>
            <CardDescription>Últimas faturas registradas no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum honorário cadastrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.clients?.name || "-"}</TableCell>
                      <TableCell>{invoice.competence || "-"}</TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <MetricDetailDialog
        open={detailDialog.open}
        onOpenChange={(open) => setDetailDialog({ ...detailDialog, open })}
        title={detailDialog.title}
        description={detailDialog.description}
        data={detailDialog.data}
        type={detailDialog.type}
      />
    </Layout>
  );
};

export default Dashboard;
