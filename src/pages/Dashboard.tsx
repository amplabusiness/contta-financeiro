import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { MetricCard } from "@/components/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [clientsRes, invoicesRes, expensesRes] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact" }),
        supabase.from("invoices").select("*, clients(name)").order("due_date", { ascending: false }).limit(10),
        supabase.from("expenses").select("*"),
      ]);

      const totalClients = clientsRes.count || 0;
      const invoices = invoicesRes.data || [];
      const expenses = expensesRes.data || [];

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

      setRecentInvoices(invoices);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
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
