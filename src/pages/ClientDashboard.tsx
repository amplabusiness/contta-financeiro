import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";
import { formatCurrency } from "@/data/expensesData";
import { MetricCard } from "@/components/MetricCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, DollarSign, TrendingUp, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ClientDashboard = () => {
  const { selectedClientId, selectedClientName } = useClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOverdue: 0,
    overdueCount: 0,
    totalPending: 0,
    pendingCount: 0,
    totalPaid: 0,
    paidCount: 0,
    currentBalance: 0,
  });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedClientId) {
      navigate("/dashboard");
      return;
    }
    loadClientData();
  }, [selectedClientId, navigate]);

  const loadClientData = async () => {
    if (!selectedClientId) return;

    try {
      setLoading(true);

      // Carregar honorários
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("due_date", { ascending: false });

      // Carregar razão do cliente
      const { data: ledgerData } = await supabase
        .from("client_ledger")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("transaction_date", { ascending: false })
        .limit(20);

      const allInvoices = invoicesData || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdue = allInvoices.filter((i) => {
        if (i.status === "paid") return false;
        const dueDate = new Date(i.due_date);
        return dueDate < today;
      });

      const pending = allInvoices.filter((i) => {
        if (i.status !== "pending") return false;
        const dueDate = new Date(i.due_date);
        return dueDate >= today;
      });

      const paid = allInvoices.filter((i) => i.status === "paid");

      // Calcular saldo atual (último registro do razão)
      const lastBalance = ledgerData?.[0]?.balance || 0;

      setStats({
        totalOverdue: overdue.reduce((sum, i) => sum + Number(i.amount), 0),
        overdueCount: overdue.length,
        totalPending: pending.reduce((sum, i) => sum + Number(i.amount), 0),
        pendingCount: pending.length,
        totalPaid: paid.reduce((sum, i) => sum + Number(i.amount), 0),
        paidCount: paid.length,
        currentBalance: lastBalance,
      });

      setInvoices(allInvoices);
      setLedgerEntries(ledgerData || []);
    } catch (error) {
      console.error("Erro ao carregar dados do cliente:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
    };
    const labels: Record<string, string> = {
      paid: "Pago",
      pending: "Pendente",
      overdue: "Vencido",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const getInvoiceStatus = (invoice: any) => {
    if (invoice.status === "paid") return "paid";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.due_date);
    return dueDate < today ? "overdue" : "pending";
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{selectedClientName}</h1>
            <p className="text-muted-foreground">Dashboard individual do cliente</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/client-ledger")}>
            <FileText className="w-4 h-4 mr-2" />
            Ver Razão Completo
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Inadimplência"
            value={formatCurrency(stats.totalOverdue)}
            icon={AlertCircle}
            variant="destructive"
            trend={{
              value: `${stats.overdueCount} honorários`,
              isPositive: false,
            }}
          />
          <MetricCard
            title="Honorários Pendentes"
            value={formatCurrency(stats.totalPending)}
            icon={Calendar}
            variant="warning"
            trend={{
              value: `${stats.pendingCount} a vencer`,
              isPositive: false,
            }}
          />
          <MetricCard
            title="Total Pago"
            value={formatCurrency(stats.totalPaid)}
            icon={DollarSign}
            variant="default"
            trend={{
              value: `${stats.paidCount} honorários`,
              isPositive: true,
            }}
          />
          <MetricCard
            title="Saldo Atual"
            value={formatCurrency(stats.currentBalance)}
            icon={TrendingUp}
            variant={stats.currentBalance >= 0 ? "default" : "destructive"}
          />
        </div>

        {stats.overdueCount > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">⚠️ Atenção: Cliente com Inadimplência</CardTitle>
              <CardDescription>
                Existem {stats.overdueCount} honorários vencidos totalizando {formatCurrency(stats.totalOverdue)}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Honorários do Cliente</CardTitle>
              <CardDescription>Todos os honorários deste cliente</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum honorário cadastrado para este cliente
                </p>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>{invoice.competence || "-"}</TableCell>
                          <TableCell>
                            {new Date(invoice.due_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                          <TableCell>{getStatusBadge(getInvoiceStatus(invoice))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimento do Razão</CardTitle>
              <CardDescription>Últimos 20 lançamentos do razão</CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum movimento no razão ainda
                </p>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Débito</TableHead>
                        <TableHead>Crédito</TableHead>
                        <TableHead>Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {new Date(entry.transaction_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {entry.description}
                          </TableCell>
                          <TableCell className="text-destructive">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-success">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(entry.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ClientDashboard;
