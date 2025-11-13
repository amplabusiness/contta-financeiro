import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { MetricCard } from "@/components/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, BarChart3, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useClient } from "@/contexts/ClientContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const { clearSelectedClient, setSelectedClient } = useClient();
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

  useEffect(() => {
    // Limpar seleção de cliente ao acessar o Dashboard Geral
    clearSelectedClient();
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [clientsRes, invoicesRes, expensesRes, allInvoicesRes] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact" }).eq("status", "active").order("name"),
        supabase.from("invoices").select("*, clients(name)").order("due_date", { ascending: false }).limit(10),
        supabase.from("expenses").select("*"),
        supabase.from("invoices").select("*"),
      ]);

      const totalClients = clientsRes.count || 0;
      const invoices = invoicesRes.data || [];
      const expenses = expensesRes.data || [];
      const clientsList = clientsRes.data || [];
      const allInvoices = allInvoicesRes.data || [];

      const pendingInvoices = invoices.filter((i) => i.status === "pending");
      const overdueInvoices = invoices.filter((i) => i.status === "overdue");
      const pendingExpenses = expenses.filter((e) => e.status === "pending");

      setStats({
        totalClients,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
        totalPending: pendingInvoices.reduce((sum, i) => sum + Number(i.amount), 0),
        totalOverdue: overdueInvoices.reduce((sum, i) => sum + Number(i.amount), 0),
        pendingExpenses: pendingExpenses.length,
        totalExpenses: pendingExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      });

      // Calcular saúde financeira de cada cliente
      const healthData: Record<string, any> = {};
      clientsList.forEach((client) => {
        const clientInvoices = allInvoices.filter((inv) => inv.client_id === client.id);
        const overdue = clientInvoices.filter((inv) => inv.status === "overdue");
        const pending = clientInvoices.filter((inv) => inv.status === "pending");
        const paid = clientInvoices.filter((inv) => inv.status === "paid");
        
        const totalOverdue = overdue.reduce((sum, inv) => sum + Number(inv.amount), 0);
        const totalPending = pending.reduce((sum, inv) => sum + Number(inv.amount), 0);
        
        // Última movimentação (última fatura paga ou criada)
        const sortedInvoices = clientInvoices.sort((a, b) => 
          new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        const lastActivity = sortedInvoices[0];

        healthData[client.id] = {
          overdueCount: overdue.length,
          overdueAmount: totalOverdue,
          pendingCount: pending.length,
          pendingAmount: totalPending,
          paidCount: paid.length,
          lastActivity: lastActivity ? new Date(lastActivity.updated_at || lastActivity.created_at) : null,
          healthStatus: overdue.length > 0 ? "critical" : pending.length > 2 ? "warning" : "healthy",
        };
      });

      setClientsHealth(healthData);
      setRecentInvoices(invoices);
      setClients(clientsList);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewClient = (clientId: string, clientName: string) => {
    setSelectedClient(clientId, clientName);
    navigate("/client-dashboard");
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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema financeiro</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Clientes Ativos"
            value={stats.totalClients.toString()}
            icon={Users}
            variant="default"
          />
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
          <div onClick={() => navigate("/reports")} className="cursor-pointer">
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
    </Layout>
  );
};

export default Dashboard;
