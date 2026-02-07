import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileCheck,
  BarChart3,
  Lightbulb,
  Loader2,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Search,
  ShieldAlert,
  Target,
  Users,
  PieChart,
  RefreshCw,
  Activity,
  Clock,
  CircleDollarSign,
  FileText,
  AlertCircle,
  ArrowRight,
  Bell,
  Zap,
  TrendingDown as TrendDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardData {
  receitas: number;
  despesas: number;
  lucro: number;
  margem: number;
  clientesAtivos: number;
  faturasVencidas: number;
  totalVencido: number;
  taxaInadimplencia: number;
  transacoesPendentes: number;
  transacoesConciliadas: number;
  lancamentosContabeis: number;
  despesasPrincipais: { categoria: string; valor: number; percentual: number }[];
  clientesInadimplentes: { nome: string; valor: number; dias: number }[];
}

interface AgentAlert {
  id: string;
  agent: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  message: string;
  action?: string;
  timestamp: Date;
}

interface AgentStatus {
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  status: 'active' | 'idle' | 'working';
  lastAction: string;
  actionCount: number;
}

const BusinessManager = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [consultResponse, setConsultResponse] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("2025-01");
  const [autoAnalysisComplete, setAutoAnalysisComplete] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([
    {
      name: "Dr. Cícero",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      status: 'idle',
      lastAction: "Inicializando...",
      actionCount: 0,
    },
    {
      name: "Gestor IA",
      icon: Brain,
      color: "text-violet-600",
      bgColor: "bg-violet-100",
      status: 'idle',
      lastAction: "Inicializando...",
      actionCount: 0,
    },
  ]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Adicionar alerta
  const addAlert = useCallback((alert: Omit<AgentAlert, 'id' | 'timestamp'>) => {
    const newAlert: AgentAlert = {
      ...alert,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 10)); // Manter últimos 10 alertas
  }, []);

  // Atualizar status do agente
  const updateAgentStatus = useCallback((name: string, updates: Partial<AgentStatus>) => {
    setAgentStatuses(prev => prev.map(agent =>
      agent.name === name ? { ...agent, ...updates } : agent
    ));
  }, []);

  // Carregar dados do dashboard
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    updateAgentStatus('Gestor IA', { status: 'working', lastAction: 'Carregando dados...' });

    try {
      const [year, month] = selectedPeriod.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      // Buscar dados em paralelo
      const [
        { data: entries },
        { data: clients },
        { data: invoices },
        { data: transactions },
        { count: entryCount },
      ] = await Promise.all([
        supabase
          .from('accounting_entries')
          .select(`
            id, entry_date, description,
            accounting_entry_items (
              debit, credit,
              chart_of_accounts (code, name, type)
            )
          `)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate),
        supabase.from('clients').select('id, name, status, monthly_fee'),
        supabase.from('invoices').select('id, client_id, amount, due_date, status, clients(name)'),
        supabase.from('bank_transactions').select('id, matched, amount, transaction_type'),
        supabase.from('accounting_entries').select('*', { count: 'exact', head: true }),
      ]);

      // Calcular indicadores
      let totalReceitas = 0;
      let totalDespesas = 0;
      const despesasPorCategoria: Record<string, number> = {};

      entries?.forEach(e => {
        e.accounting_entry_items?.forEach((l: any) => {
          const code = l.chart_of_accounts?.code || '';
          const name = l.chart_of_accounts?.name || 'Outros';

          if (code.startsWith('3.')) {
            totalReceitas += Number(l.credit) || 0;
          }
          if (code.startsWith('4.')) {
            const amt = Number(l.debit) || 0;
            totalDespesas += amt;
            despesasPorCategoria[name] = (despesasPorCategoria[name] || 0) + amt;
          }
        });
      });

      const lucro = totalReceitas - totalDespesas;
      const margem = totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0;

      // Clientes
      const clientesAtivos = clients?.filter(c => c.status === 'active').length || 0;

      // Inadimplência
      const today = new Date();
      const vencidas = invoices?.filter(i =>
        i.status !== 'paid' && new Date(i.due_date) < today
      ) || [];
      const totalVencido = vencidas.reduce((s, i) => s + Number(i.amount), 0);
      const taxaInadimplencia = totalReceitas > 0 ? (totalVencido / totalReceitas) * 100 : 0;

      // Clientes inadimplentes ordenados por valor
      const clientesInadimplentes = vencidas
        .map(i => ({
          nome: (i as any).clients?.name || 'Cliente',
          valor: Number(i.amount),
          dias: Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000),
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

      // Transações
      const pendentes = transactions?.filter(t => !t.matched).length || 0;
      const conciliadas = transactions?.filter(t => t.matched).length || 0;

      // Despesas principais
      const despesasPrincipais = Object.entries(despesasPorCategoria)
        .map(([categoria, valor]) => ({
          categoria,
          valor,
          percentual: totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0,
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

      const data: DashboardData = {
        receitas: totalReceitas,
        despesas: totalDespesas,
        lucro,
        margem,
        clientesAtivos,
        faturasVencidas: vencidas.length,
        totalVencido,
        taxaInadimplencia,
        transacoesPendentes: pendentes,
        transacoesConciliadas: conciliadas,
        lancamentosContabeis: entryCount || 0,
        despesasPrincipais,
        clientesInadimplentes,
      };

      setDashboardData(data);

      // Atualizar status dos agentes
      updateAgentStatus('Dr. Cícero', {
        actionCount: conciliadas,
        status: 'active',
        lastAction: `${conciliadas} transações conciliadas`,
      });

      updateAgentStatus('Gestor IA', {
        actionCount: entryCount || 0,
        status: 'active',
        lastAction: 'Dashboard atualizado',
      });

      return data;

    } catch (error: any) {
      console.error("Erro ao carregar dashboard:", error);
      toast.error("Erro ao carregar dados");
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, updateAgentStatus]);

  // Análise automática dos dados
  const runAutoAnalysis = useCallback(async (data: DashboardData) => {
    if (autoAnalysisComplete) return;

    updateAgentStatus('Gestor IA', { status: 'working', lastAction: 'Analisando dados...' });

    // ANÁLISE 1: Inadimplência
    if (data.taxaInadimplencia > 5) {
      addAlert({
        agent: 'Gestor IA',
        type: data.taxaInadimplencia > 10 ? 'danger' : 'warning',
        title: 'Inadimplência Alta',
        message: `Taxa de ${formatPercent(data.taxaInadimplencia)} está acima da meta de 5%. ${data.faturasVencidas} faturas vencidas totalizando ${formatCurrency(data.totalVencido)}.`,
        action: 'Priorizar cobrança dos maiores devedores',
      });
    }

    // ANÁLISE 2: Margem de Lucro
    if (data.margem < 15) {
      addAlert({
        agent: 'Gestor IA',
        type: data.margem < 0 ? 'danger' : 'warning',
        title: 'Margem de Lucro Baixa',
        message: `Margem de ${formatPercent(data.margem)} está abaixo do ideal (30%). Despesas representam ${formatPercent((data.despesas / (data.receitas || 1)) * 100)} da receita.`,
        action: 'Revisar estrutura de custos',
      });
    } else if (data.margem >= 30) {
      addAlert({
        agent: 'Gestor IA',
        type: 'success',
        title: 'Excelente Margem',
        message: `Margem de ${formatPercent(data.margem)} está acima da meta! Empresa com boa saúde financeira.`,
      });
    }

    // ANÁLISE 3: Transações Pendentes
    if (data.transacoesPendentes > 20) {
      addAlert({
        agent: 'Dr. Cícero',
        type: 'warning',
        title: 'Transações Pendentes',
        message: `${data.transacoesPendentes} transações aguardando conciliação. Taxa de conciliação: ${formatPercent((data.transacoesConciliadas / (data.transacoesConciliadas + data.transacoesPendentes)) * 100)}.`,
        action: 'Acessar Conciliador para processar',
      });
    }

    // ANÁLISE 4: Clientes Inadimplentes Específicos
    if (data.clientesInadimplentes.length > 0) {
      const topDevedor = data.clientesInadimplentes[0];
      if (topDevedor.dias > 30) {
        addAlert({
          agent: 'Gestor IA',
          type: 'danger',
          title: `Cliente em Atraso Crítico`,
          message: `${topDevedor.nome} deve ${formatCurrency(topDevedor.valor)} há ${topDevedor.dias} dias. Considerar ação de cobrança.`,
          action: 'Contatar cliente urgentemente',
        });
      }
    }

    // ANÁLISE 5: Receita Zero
    if (data.receitas === 0) {
      addAlert({
        agent: 'Gestor IA',
        type: 'info',
        title: 'Sem Receitas no Período',
        message: 'Nenhuma receita registrada. Verifique se os lançamentos contábeis estão corretos.',
        action: 'Revisar lançamentos contábeis',
      });
    }

    updateAgentStatus('Gestor IA', { status: 'active', lastAction: 'Análise concluída' });
    setAutoAnalysisComplete(true);

  }, [autoAnalysisComplete, addAlert, updateAgentStatus]);

  // Carregar e analisar automaticamente
  useEffect(() => {
    const initialize = async () => {
      const data = await loadDashboard();
      if (data) {
        await runAutoAnalysis(data);
      }
    };
    initialize();
  }, [selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resetar análise quando mudar período
  useEffect(() => {
    setAutoAnalysisComplete(false);
    setAlerts([]);
  }, [selectedPeriod]);

  // Consultar Gestor IA
  const handleConsult = async () => {
    if (!customQuestion.trim()) {
      toast.error("Digite uma pergunta");
      return;
    }

    setLoading(true);
    setConsultResponse(null);
    updateAgentStatus('Gestor IA', { status: 'working', lastAction: 'Processando consulta...' });

    try {
      const [year, month] = selectedPeriod.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      const { data, error } = await supabase.functions.invoke("ai-business-manager", {
        body: {
          action: "strategic_advice",
          context: { question: customQuestion },
          period: { start_date: startDate, end_date: endDate },
        },
      });

      if (error) throw error;
      setConsultResponse(data.analysis);
      updateAgentStatus('Gestor IA', { status: 'active', lastAction: 'Consulta respondida' });
      toast.success("Consulta processada!");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
      updateAgentStatus('Gestor IA', { status: 'active', lastAction: 'Erro na consulta' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'working': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      default: return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const getAlertBg = (type: string) => {
    switch (type) {
      case 'danger': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      case 'success': return 'bg-green-50 border-green-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="relative">
                <Brain className="h-8 w-8 text-violet-600" />
                <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              Dashboard Inteligente
            </h1>
            <p className="text-muted-foreground mt-1">
              Análise automática da Ampla Contabilidade
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <label htmlFor="period-select" className="sr-only">Período</label>
              <input
                id="period-select"
                type="month"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm"
                title="Período de análise"
                aria-label="Período de análise"
              />
            </div>
            <Button variant="outline" onClick={loadDashboard} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Status dos Agentes IA */}
        <div className="grid grid-cols-2 gap-4">
          {agentStatuses.map((agent, idx) => (
            <Card key={idx} className="relative overflow-hidden">
              <div className={cn("absolute top-0 left-0 w-1 h-full", agent.bgColor)} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", agent.bgColor)}>
                      <agent.icon className={cn("h-5 w-5", agent.color)} />
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {agent.name}
                        <span className={cn("w-2 h-2 rounded-full", getStatusColor(agent.status))} />
                      </div>
                      <div className="text-sm text-muted-foreground">{agent.lastAction}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{agent.actionCount}</div>
                    <div className="text-xs text-muted-foreground">ações</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alertas Automáticos */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-amber-500" />
                Alertas e Recomendações
                <Badge variant="secondary">{alerts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn("p-4 rounded-lg border flex items-start gap-3", getAlertBg(alert.type))}
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alert.title}</span>
                      <Badge variant="outline" className="text-xs">{alert.agent}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    {alert.action && (
                      <p className="text-sm font-medium mt-2 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {alert.action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Receitas</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(dashboardData?.receitas || 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700 font-medium">Despesas</p>
                  <p className="text-2xl font-bold text-red-800">
                    {formatCurrency(dashboardData?.despesas || 0)}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "bg-gradient-to-br border-2",
            (dashboardData?.lucro || 0) >= 0
              ? "from-blue-50 to-indigo-50 border-blue-200"
              : "from-orange-50 to-amber-50 border-orange-200"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-sm font-medium", (dashboardData?.lucro || 0) >= 0 ? "text-blue-700" : "text-orange-700")}>
                    Resultado
                  </p>
                  <p className={cn("text-2xl font-bold", (dashboardData?.lucro || 0) >= 0 ? "text-blue-800" : "text-orange-800")}>
                    {formatCurrency(dashboardData?.lucro || 0)}
                  </p>
                </div>
                <div className={cn("p-3 rounded-full", (dashboardData?.lucro || 0) >= 0 ? "bg-blue-100" : "bg-orange-100")}>
                  <DollarSign className={cn("h-6 w-6", (dashboardData?.lucro || 0) >= 0 ? "text-blue-600" : "text-orange-600")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Margem</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {formatPercent(dashboardData?.margem || 0)}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <PieChart className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Indicadores Secundários */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboardData?.clientesAtivos || 0}</p>
                <p className="text-xs text-muted-foreground">Clientes Ativos</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{dashboardData?.faturasVencidas || 0}</p>
                <p className="text-xs text-muted-foreground">Faturas Vencidas</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <CircleDollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-red-600">{formatCurrency(dashboardData?.totalVencido || 0)}</p>
                <p className="text-xs text-muted-foreground">Total Vencido</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{dashboardData?.transacoesConciliadas || 0}</p>
                <p className="text-xs text-muted-foreground">Conciliadas</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboardData?.transacoesPendentes || 0}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grid de Análises */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Despesas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-600" />
                Despesas por Categoria
              </CardTitle>
              <CardDescription>
                Top 5 categorias de despesa no período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardData?.despesasPrincipais.map((desp, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{desp.categoria}</span>
                    <span className="font-medium">{formatCurrency(desp.valor)}</span>
                  </div>
                  <Progress value={desp.percentual} className="h-2" />
                  <div className="text-xs text-muted-foreground text-right">
                    {formatPercent(desp.percentual)} do total
                  </div>
                </div>
              ))}
              {(!dashboardData?.despesasPrincipais || dashboardData.despesasPrincipais.length === 0) && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma despesa registrada no período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Indicadores de Saúde */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Indicadores de Saúde
              </CardTitle>
              <CardDescription>
                Métricas de performance da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Taxa de Inadimplência */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    Taxa de Inadimplência
                  </span>
                  <span className={cn(
                    "font-bold",
                    (dashboardData?.taxaInadimplencia || 0) > 10 ? "text-red-600" :
                    (dashboardData?.taxaInadimplencia || 0) > 5 ? "text-amber-600" : "text-green-600"
                  )}>
                    {formatPercent(dashboardData?.taxaInadimplencia || 0)}
                  </span>
                </div>
                <Progress
                  value={Math.min(dashboardData?.taxaInadimplencia || 0, 100)}
                  className={cn(
                    "h-2",
                    (dashboardData?.taxaInadimplencia || 0) > 10 ? "[&>div]:bg-red-500" :
                    (dashboardData?.taxaInadimplencia || 0) > 5 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
                  )}
                />
                <div className="text-xs text-muted-foreground">
                  Meta: menos de 5%
                </div>
              </div>

              {/* Margem de Lucro */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Margem de Lucro
                  </span>
                  <span className={cn(
                    "font-bold",
                    (dashboardData?.margem || 0) >= 30 ? "text-green-600" :
                    (dashboardData?.margem || 0) >= 15 ? "text-blue-600" : "text-amber-600"
                  )}>
                    {formatPercent(dashboardData?.margem || 0)}
                  </span>
                </div>
                <Progress
                  value={Math.min(Math.max(dashboardData?.margem || 0, 0), 100)}
                  className={cn(
                    "h-2",
                    (dashboardData?.margem || 0) >= 30 ? "[&>div]:bg-green-500" :
                    (dashboardData?.margem || 0) >= 15 ? "[&>div]:bg-blue-500" : "[&>div]:bg-amber-500"
                  )}
                />
                <div className="text-xs text-muted-foreground">
                  Meta: acima de 30%
                </div>
              </div>

              {/* Taxa de Conciliação */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Taxa de Conciliação
                  </span>
                  <span className="font-bold text-green-600">
                    {formatPercent(
                      ((dashboardData?.transacoesConciliadas || 0) /
                      ((dashboardData?.transacoesConciliadas || 0) + (dashboardData?.transacoesPendentes || 1))) * 100
                    )}
                  </span>
                </div>
                <Progress
                  value={
                    ((dashboardData?.transacoesConciliadas || 0) /
                    ((dashboardData?.transacoesConciliadas || 0) + (dashboardData?.transacoesPendentes || 1))) * 100
                  }
                  className="h-2 [&>div]:bg-green-500"
                />
                <div className="text-xs text-muted-foreground">
                  {dashboardData?.transacoesConciliadas || 0} de {(dashboardData?.transacoesConciliadas || 0) + (dashboardData?.transacoesPendentes || 0)} transações
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Consultoria Estratégica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-orange-500" />
              Consultoria com Gestor IA
            </CardTitle>
            <CardDescription>
              Faça perguntas sobre gestão, estratégia ou finanças
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ex: Como posso melhorar a margem de lucro? Quais clientes devo priorizar?"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={handleConsult}
                disabled={loading || !customQuestion.trim()}
                className="self-end"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
              </Button>
            </div>

            {consultResponse && (
              <div className="bg-gradient-to-r from-orange-50/50 to-amber-50/50 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-800">Resposta do Gestor IA</span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed max-h-[300px] overflow-auto">
                  {consultResponse}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default BusinessManager;
