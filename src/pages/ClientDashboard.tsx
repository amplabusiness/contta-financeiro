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
  const [openingBalances, setOpeningBalances] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [clientMonthlyFee, setClientMonthlyFee] = useState<number | null>(null);
  const [clientPaymentDay, setClientPaymentDay] = useState<number | null>(null);

  const formatMonthYear = (date: Date) => `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

  const normalizeCompetenceLabel = (competence?: string | null, dueDate?: string) => {
    if (competence) {
      const trimmed = competence.trim();
      if (/^\d{2}\/\d{4}$/.test(trimmed)) {
        return trimmed;
      }
      if (/^\d{4}-\d{2}$/.test(trimmed)) {
        const [year, month] = trimmed.split("-");
        return `${month}/${year}`;
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return formatMonthYear(parsed);
      }
    }

    if (dueDate) {
      const parsed = new Date(dueDate);
      if (!isNaN(parsed.getTime())) {
        return formatMonthYear(parsed);
      }
    }

    return null;
  };

  const formatLocalDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(`${dateStr}T00:00:00`);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  };

  const getInvoiceStatus = (invoice: any) => {
    if (invoice.status === "paid") return "paid";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.due_date);
    return dueDate < today ? "overdue" : "pending";
  };

  const getDisplayStatus = (invoice: any) => invoice.computedStatus || getInvoiceStatus(invoice);

  const aggregateInvoicesByCompetence = (invoiceList: any[], defaultMonthlyFee: number | null, paymentDay: number | null) => {
    const statusPriority: Record<string, number> = { overdue: 3, pending: 2, paid: 1 };
    const groups = new Map<string, any>();

    invoiceList.forEach((invoice) => {
      const normalizedCompetence = normalizeCompetenceLabel(invoice.competence, invoice.due_date);
      const key = normalizedCompetence ?? `invoice-${invoice.id}`;
      const label = normalizedCompetence ?? normalizeCompetenceLabel(null, invoice.due_date) ?? invoice.competence ?? "-";
      const currentStatus = getInvoiceStatus(invoice);
      const amount = defaultMonthlyFee ?? Number(invoice.amount);

      // Corrigir data de vencimento se houver dia de pagamento cadastrado
      let correctedDueDate = invoice.due_date;
      if (paymentDay !== null) {
        const originalDate = new Date(invoice.due_date);
        const year = originalDate.getFullYear();
        const month = originalDate.getMonth();
        const newDate = new Date(year, month, paymentDay);
        correctedDueDate = newDate.toISOString().split('T')[0];
      }

      if (!groups.has(key)) {
        groups.set(key, {
          ...invoice,
          amount,
          due_date: correctedDueDate,
          competenceLabel: label,
          computedStatus: currentStatus,
        });
        return;
      }

      const existing = groups.get(key);
      if (defaultMonthlyFee == null) {
        existing.amount = Number(existing.amount) + Number(invoice.amount);
      } else {
        existing.amount = defaultMonthlyFee;
      }

      const correctedExistingDate = new Date(existing.due_date);
      const correctedNewDate = new Date(correctedDueDate);
      if (correctedNewDate.getTime() > correctedExistingDate.getTime()) {
        existing.due_date = correctedDueDate;
      }

      const existingStatus = existing.computedStatus || "paid";
      if ((statusPriority[currentStatus] || 0) > (statusPriority[existingStatus] || 0)) {
        existing.status = invoice.status;
        existing.computedStatus = currentStatus;
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
    );
  };

  useEffect(() => {
    if (!selectedClientId) {
      navigate("/dashboard");
      return;
    }
    loadClientData();

    // Setup Realtime subscription to listen for invoice changes
    const subscription = supabase
      .channel(`invoices-${selectedClientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
          filter: `client_id=eq.${selectedClientId}`,
        },
        (payload) => {
          console.log("Invoice change detected:", payload);
          // Reload data when invoice changes
          loadClientData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedClientId, navigate]);

  const loadClientData = async () => {
    if (!selectedClientId) return;

    try {
      setLoading(true);

      const { data: clientData } = await supabase
        .from("clients")
        .select("monthly_fee, payment_day")
        .eq("id", selectedClientId)
        .single();

      const monthlyFeeFromCadastro =
        clientData && clientData.monthly_fee !== null && clientData.monthly_fee !== undefined
          ? Number(clientData.monthly_fee)
          : null;
      const paymentDayFromCadastro =
        clientData && clientData.payment_day !== null && clientData.payment_day !== undefined
          ? Number(clientData.payment_day)
          : null;
      
      setClientMonthlyFee(monthlyFeeFromCadastro);
      setClientPaymentDay(paymentDayFromCadastro);

      // Carregar honorários
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("due_date", { ascending: false });

      // Carregar saldos de abertura
      const { data: openingBalanceData } = await supabase
        .from("client_opening_balance")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("competence", { ascending: false });

      // Carregar razão do cliente
      const { data: ledgerData } = await supabase
        .from("client_ledger")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("transaction_date", { ascending: false })
        .limit(20);

      const allInvoices = invoicesData || [];
      const aggregatedInvoices = aggregateInvoicesByCompetence(allInvoices, monthlyFeeFromCadastro, paymentDayFromCadastro);

      // Calcular estatísticas de faturas
      const overdue = aggregatedInvoices.filter((invoice) => getDisplayStatus(invoice) === "overdue");
      const pending = aggregatedInvoices.filter((invoice) => getDisplayStatus(invoice) === "pending");
      const paid = aggregatedInvoices.filter((invoice) => getDisplayStatus(invoice) === "paid");

      // Calcular estatísticas de saldo de abertura
      const openingBalances = openingBalanceData || [];
      const openingPending = openingBalances.filter(ob => ob.status === "pending" || ob.status === "partial");
      const openingPaid = openingBalances.filter(ob => ob.status === "paid");
      const openingPendingTotal = openingPending.reduce((sum, ob) => sum + (Number(ob.amount) - Number(ob.paid_amount || 0)), 0);
      const openingPaidTotal = openingPaid.reduce((sum, ob) => sum + Number(ob.amount), 0);

      const lastBalance = ledgerData?.[0]?.balance || 0;

      // Combinar totais de faturas + saldo de abertura
      setStats({
        totalOverdue: overdue.reduce((sum, invoice) => sum + Number(invoice.amount), 0) + openingPendingTotal,
        overdueCount: overdue.length + openingPending.length,
        totalPending: pending.reduce((sum, invoice) => sum + Number(invoice.amount), 0),
        pendingCount: pending.length,
        totalPaid: paid.reduce((sum, invoice) => sum + Number(invoice.amount), 0) + openingPaidTotal,
        paidCount: paid.length + openingPaid.length,
        currentBalance: lastBalance,
      });

      setInvoices(aggregatedInvoices);
      setOpeningBalances(openingBalances);
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

        {/* Saldo de Abertura */}
        {openingBalances.length > 0 && (
          <Card className="border-orange-500/50 bg-orange-50/30">
            <CardHeader>
              <CardTitle className="text-orange-700">📋 Saldo de Abertura (Débitos Anteriores)</CardTitle>
              <CardDescription>
                Débitos de competências anteriores a 2025
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Valor Original</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openingBalances.map((ob) => {
                      const saldo = Number(ob.amount) - Number(ob.paid_amount || 0);
                      return (
                        <TableRow key={ob.id}>
                          <TableCell className="font-medium">{ob.competence}</TableCell>
                          <TableCell>{formatCurrency(Number(ob.amount))}</TableCell>
                          <TableCell className="text-green-600">{formatCurrency(Number(ob.paid_amount || 0))}</TableCell>
                          <TableCell className={saldo > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                            {formatCurrency(saldo)}
                          </TableCell>
                          <TableCell>
                            {ob.status === "paid" ? (
                              <Badge variant="default">Pago</Badge>
                            ) : ob.status === "partial" ? (
                              <Badge variant="secondary">Parcial</Badge>
                            ) : (
                              <Badge variant="destructive">Pendente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Honorários do Cliente</CardTitle>
              <CardDescription>
                Todos os honorários deste cliente
                <div className="mt-1 space-y-0.5">
                  {clientMonthlyFee !== null && (
                    <span className="block text-xs text-muted-foreground">
                      Valor cadastrado: {formatCurrency(clientMonthlyFee)}
                    </span>
                  )}
                  {clientPaymentDay !== null && (
                    <span className="block text-xs text-muted-foreground">
                      Dia de vencimento cadastrado: {clientPaymentDay}
                    </span>
                  )}
                </div>
              </CardDescription>
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
                          <TableCell>{invoice.competenceLabel || invoice.competence || "-"}</TableCell>
                          <TableCell>{formatLocalDate(invoice.due_date)}</TableCell>
                          <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                          <TableCell>{getStatusBadge(getDisplayStatus(invoice))}</TableCell>
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
                          <TableCell>{formatLocalDate(entry.transaction_date)}</TableCell>
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
