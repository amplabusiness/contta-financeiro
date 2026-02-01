import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { PeriodFilter } from "@/components/PeriodFilter";
import { MetricCard } from "@/components/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, BarChart3, CheckCircle2, XCircle, Clock, Eye, Bot, Brain, Zap, FileText, Activity, CircleDot, RefreshCw, BanknoteIcon } from "lucide-react";
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
// Novos componentes do Dashboard Executivo
import { 
  ExecutiveHealthCards, 
  DrCiceroInsightPanel, 
  ActionRequiredPanel, 
  PriorityClientsList,
  CashVsAccountingPanel,
  CashFlowWidget 
} from "@/components/dashboard";

// Interface para títulos problemáticos (cobrança)
interface TituloProblematico {
  cliente: string;
  clientId: string;
  totalAberto: number;
  qtdBoletos: number;
  diasAtraso: number;
  meses: number;
  custoManutencao: number;
  prioridade: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
  vencimentoAntigo: string;
}

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

  // Estado para títulos problemáticos (cobrança) - dados do banco
  const [titulosProblematicos, setTitulosProblematicos] = useState<TituloProblematico[]>([]);

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
  // COBRANÇA: Buscar títulos problemáticos do banco
  // Regra: Após 3 meses de atraso, Sicredi cobra taxa de manutenção
  // =====================================================
  const loadTitulosProblematicos = useCallback(async () => {
    try {
      // Buscar todos os honorários pendentes com data de vencimento
      const { data: honorarios, error } = await supabase
        .from('client_opening_balance')
        .select('id, client_id, competence, amount, paid_amount, due_date, status, clients(id, name)')
        .in('status', ['pending', 'partial', 'overdue'])
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar honorários para cobrança:', error);
        return;
      }

      if (!honorarios || honorarios.length === 0) {
        setTitulosProblematicos([]);
        return;
      }

      const hoje = new Date();
      const CUSTO_MANUTENCAO_POR_MES = 2.02; // R$ 2,02 por boleto por mês após 3 meses

      // Agrupar por cliente
      const porCliente: Record<string, {
        clientId: string;
        cliente: string;
        boletos: Array<{ valor: number; diasAtraso: number; vencimento: string }>;
      }> = {};

      honorarios.forEach(h => {
        const clienteNome = h.clients?.name || 'DESCONHECIDO';
        const clienteId = h.client_id;
        const vencimento = new Date(h.due_date);
        const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

        // Só considerar se está vencido (dias > 0)
        if (diasAtraso <= 0) return;

        const valorAberto = Number(h.amount || 0) - Number(h.paid_amount || 0);
        if (valorAberto <= 0) return;

        if (!porCliente[clienteId]) {
          porCliente[clienteId] = {
            clientId: clienteId,
            cliente: clienteNome,
            boletos: []
          };
        }

        porCliente[clienteId].boletos.push({
          valor: valorAberto,
          diasAtraso,
          vencimento: h.due_date
        });
      });

      // Converter para array de títulos problemáticos
      const titulos: TituloProblematico[] = Object.values(porCliente)
        .map(cliente => {
          const totalAberto = cliente.boletos.reduce((s, b) => s + b.valor, 0);
          const qtdBoletos = cliente.boletos.length;
          const diasAtrasoMax = Math.max(...cliente.boletos.map(b => b.diasAtraso));
          const meses = Math.floor(diasAtrasoMax / 30);
          const vencimentoMaisAntigo = cliente.boletos.reduce((oldest, b) =>
            b.vencimento < oldest ? b.vencimento : oldest,
            cliente.boletos[0]?.vencimento || ''
          );

          // Custo de manutenção: só após 3 meses completos (90 dias)
          // Cobra R$ 2,02 por boleto por cada mês APÓS os 3 primeiros
          const mesesComCobranca = Math.max(0, meses - 3);
          const custoManutencao = mesesComCobranca > 0 ? qtdBoletos * CUSTO_MANUTENCAO_POR_MES * mesesComCobranca : 0;

          // Prioridade baseada nos dias de atraso
          let prioridade: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
          if (diasAtrasoMax > 180) prioridade = 'CRITICO';      // > 6 meses
          else if (diasAtrasoMax > 90) prioridade = 'ALTO';     // > 3 meses (já está pagando taxa)
          else if (diasAtrasoMax > 60) prioridade = 'MEDIO';    // > 2 meses (próximo de pagar taxa)
          else prioridade = 'BAIXO';                             // < 2 meses

          return {
            cliente: cliente.cliente,
            clientId: cliente.clientId,
            totalAberto,
            qtdBoletos,
            diasAtraso: diasAtrasoMax,
            meses,
            custoManutencao,
            prioridade,
            vencimentoAntigo: vencimentoMaisAntigo
          };
        })
        // Ordenar por prioridade (crítico primeiro) e depois por valor
        .sort((a, b) => {
          const prioridadeOrder = { 'CRITICO': 0, 'ALTO': 1, 'MEDIO': 2, 'BAIXO': 3 };
          if (prioridadeOrder[a.prioridade] !== prioridadeOrder[b.prioridade]) {
            return prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
          }
          return b.totalAberto - a.totalAberto;
        });

      setTitulosProblematicos(titulos);
    } catch (error) {
      console.error('Erro ao carregar títulos problemáticos:', error);
    }
  }, []);

  useEffect(() => {
    loadTitulosProblematicos();
  }, [loadTitulosProblematicos]);

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

      setAgents(prev => prev.map(agent =>
        agent.name === 'Dr. Cícero'
          ? { ...agent, status: 'active', lastAction: `${categorizedCount} categorias`, tasksToday: agent.tasksToday + 1 }
          : agent
      ));

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

      setAgents(prev => prev.map(agent =>
        agent.name === 'Gestor IA'
          ? { ...agent, status: 'active', lastAction: `Inadimp: ${taxaInadimplencia.toFixed(1)}%`, tasksToday: agent.tasksToday + 1 }
          : agent
      ));

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

  // ========== DADOS PARA COMPONENTES EXECUTIVOS ==========
  const periodoFormatado = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', { 
    month: 'long', 
    year: 'numeric' 
  });
  
  // Calcular dias de operação (média de despesas mensal / caixa)
  const mediaDespesaDia = stats.totalExpenses / 30;
  const diasOperacao = mediaDespesaDia > 0 
    ? Math.floor((accountingBalances?.bank_balance || 0) / mediaDespesaDia) 
    : 0;

  // Calcular faturas próximas do vencimento
  const hoje = new Date();
  const em5Dias = new Date(hoje);
  em5Dias.setDate(em5Dias.getDate() + 5);

  // Preparar insights para Dr. Cícero
  const insightData = {
    caixaDisponivel: accountingBalances?.bank_balance || 0,
    diasOperacao,
    recebimentosConcentrados: true, // TODO: calcular baseado em dados reais
    diaConcentracao: 10,
    inadimplencia: stats.totalOverdue,
    faturasVencerProximos5Dias: 0, // TODO: calcular
    valorFaturasProximas: 0,
    clientesConcentrados: 3, // TODO: calcular top 3 clientes
    percentualConcentracao: 42, // TODO: calcular
    inconsistenciasContabeis: 0,
    transitóriasPendentes: 0 // TODO: buscar da contabilidade
  };

  // Preparar clientes prioritários
  const clientesPrioritarios = clients
    .map(client => {
      const health = clientsHealth[client.id] || {};
      let reason: 'valor' | 'risco' | 'atraso' | 'inativo' = 'valor';
      
      if (health.overdueCount > 0) reason = 'atraso';
      else if (health.healthStatus === 'critical') reason = 'risco';
      else if (!health.lastActivity) reason = 'inativo';
      
      return {
        id: client.id,
        name: client.name,
        reason,
        value: health.overdueAmount || health.pendingAmount || Number(client.monthly_fee) || 0,
        secondaryInfo: health.overdueCount > 0 ? `${health.overdueCount} vencida(s)` : undefined,
        healthStatus: health.healthStatus || 'healthy'
      };
    })
    .sort((a, b) => {
      // Ordenar por risco primeiro, depois por valor
      const prioridadeOrder = { atraso: 0, risco: 1, valor: 2, inativo: 3 };
      if (prioridadeOrder[a.reason] !== prioridadeOrder[b.reason]) {
        return prioridadeOrder[a.reason] - prioridadeOrder[b.reason];
      }
      return b.value - a.value;
    })
    .slice(0, 10);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {selectedClientId ? `Dashboard - ${selectedClientName}` : "Dashboard Executivo"}
            </h1>
            <p className="text-sm text-slate-500">
              {selectedClientId
                ? "Visão financeira do cliente selecionado"
                : "Visão executiva para tomada de decisão"
              }
            </p>
          </div>
          <PeriodFilter />
        </div>

        {/* ========== BLOCO 1: SAÚDE FINANCEIRA (TOPO) ========== */}
        <ExecutiveHealthCards
          caixaDisponivel={accountingBalances?.bank_balance || 0}
          aReceber={accountingBalances?.accounts_receivable || stats.totalPending}
          qtdFaturas={stats.pendingInvoices}
          inadimplencia={stats.totalOverdue}
          receitaEsperada={clients.reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0)}
          diasOperacao={diasOperacao}
          periodo={periodoFormatado}
        />

        {/* ========== BLOCO 2: DR. CÍCERO + AÇÕES ========== */}
        <div className="grid lg:grid-cols-2 gap-6">
          <DrCiceroInsightPanel 
            data={insightData}
            onRefresh={loadDashboardData}
            isLoading={loading}
          />
          
          <ActionRequiredPanel
            faturasVencer5Dias={insightData.faturasVencerProximos5Dias}
            valorFaturasVencer={insightData.valorFaturasProximas}
            clientesConcentrados={insightData.clientesConcentrados}
            percentualConcentracao={insightData.percentualConcentracao}
            inconsistenciasContabeis={insightData.inconsistenciasContabeis}
            transitóriasPendentes={insightData.transitóriasPendentes}
            valorTransitórias={0}
          />
        </div>

        {/* ========== BLOCO 3: CAIXA vs CONTÁBIL ========== */}
        <CashVsAccountingPanel
          saldoBancario={accountingBalances?.bank_balance || 0}
          projecao7dias={accountingBalances?.bank_balance || 0}
          projecao15dias={accountingBalances?.bank_balance || 0}
          projecao30dias={accountingBalances?.bank_balance || 0}
          pagamentosAgendados={0}
          receitaMes={accountingBalances?.total_revenue || 0}
          despesaMes={accountingBalances?.total_expenses || 0}
          resultadoProjetado={(accountingBalances?.total_revenue || 0) - (accountingBalances?.total_expenses || 0)}
        />

        {/* ========== BLOCO 4: CLIENTES PRIORITÁRIOS ========== */}
        <PriorityClientsList 
          clients={clientesPrioritarios}
          onViewClient={handleViewClient}
        />

        {/* ========== FLUXO DE CAIXA ========== */}
        <CashFlowWidget />
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
