import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { PeriodFilter } from "@/components/PeriodFilter";
import { MetricCard } from "@/components/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, BarChart3, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useClient } from "@/contexts/ClientContext";
import { usePeriod } from "@/contexts/PeriodContext";
import { MetricDetailDialog } from "@/components/MetricDetailDialog";
import { useOfflineMode } from "@/hooks/useOfflineMode";

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedClientId, selectedClientName, setSelectedClient } = useClient();
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
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsHealth, setClientsHealth] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
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

  const loadDashboardData = async () => {
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
      let expensesQuery = supabase.from("expenses").select("*");
      let allInvoicesQuery = supabase.from("invoices").select("*");
      let openingBalanceQuery = supabase.from("client_opening_balance").select("*, clients(name)").in("status", ["pending", "partial", "overdue"]);

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        clientsQuery = clientsQuery.eq("id", selectedClientId);
        recentInvoicesQuery = recentInvoicesQuery.eq("client_id", selectedClientId);
        expensesQuery = expensesQuery.eq("client_id", selectedClientId);
        allInvoicesQuery = allInvoicesQuery.eq("client_id", selectedClientId);
        openingBalanceQuery = openingBalanceQuery.eq("client_id", selectedClientId);
      }

      // Usar Promise.allSettled para não falhar se uma query falhar
      const results = await Promise.allSettled([
        clientsQuery,
        recentInvoicesQuery,
        expensesQuery,
        allInvoicesQuery,
        openingBalanceQuery,
      ]);

      // Extrair dados com fallback para array vazio
      const clientsRes = results[0].status === 'fulfilled' ? results[0].value : { count: 0, data: [] };
      const recentInvoicesRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
      const expensesRes = results[2].status === 'fulfilled' ? results[2].value : { data: [] };
      const allInvoicesRes = results[3].status === 'fulfilled' ? results[3].value : { data: [] };
      const openingBalanceRes = results[4].status === 'fulfilled' ? results[4].value : { data: [] };

      // Logar erros se houver
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const queryNames = ['clients', 'recentInvoices', 'expenses', 'allInvoices', 'openingBalance'];
          console.warn(`Erro ao carregar ${queryNames[index]}:`, result.reason?.message || String(result.reason));
        }
      });

      const totalClients = clientsRes.count || 0;
      const recentInvoices = recentInvoicesRes.data || [];
      const expenses = expensesRes.data || [];
      const clientsList = clientsRes.data || [];
      const allInvoices = allInvoicesRes.data || [];
      const openingBalances = openingBalanceRes.data || [];

      // CORRIGIDO: Calcular KPIs com TODAS as invoices + saldos de abertura
      // Honorários Pendentes = pending + overdue (tudo que ainda não foi pago)
      const pendingInvoices = allInvoices.filter((i) => i.status === "pending" || i.status === "overdue");
      const overdueInvoices = allInvoices.filter((i) => i.status === "overdue");
      const pendingExpenses = expenses.filter((e) => e.status === "pending");

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
        pendingExpenses: pendingExpenses.length,
        totalExpenses: pendingExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
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
    } catch (error) {
      console.error("Erro crítico ao carregar dados da Dashboard:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Mostrar toast com erro amigável
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        console.warn("Problema de conectividade com o servidor. Verifique sua internet.");
      }
    } finally {
      setLoading(false);
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
        let expensesQuery = supabase
          .from("expenses")
          .select("*")
          .eq("status", "pending")
          .order("due_date", { ascending: true });

        if (selectedClientId) {
          expensesQuery = expensesQuery.eq("client_id", selectedClientId);
        }

        const { data, error } = await expensesQuery;

        if (error) {
          console.warn("Erro ao buscar despesas:", error.message);
        }

        setDetailDialog({
          open: true,
          title: selectedClientId ? `Despesas Pendentes - ${selectedClientName}` : "Despesas Pendentes",
          description: `${data?.length || 0} despesas aguardando pagamento`,
          data: data || [],
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
              title="Despesas Pendentes"
              value={formatCurrency(stats.totalExpenses)}
              icon={TrendingDown}
              variant="warning"
              trend={{
                value: `${stats.pendingExpenses} contas`,
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
