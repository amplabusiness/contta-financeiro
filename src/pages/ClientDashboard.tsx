import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";
import { formatCurrency } from "@/data/expensesData";
import { MetricCard } from "@/components/MetricCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, DollarSign, TrendingUp, FileText, Calendar, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import PaymentHistorySection from "@/components/PaymentHistorySection";
import { useToast } from "@/components/ui/use-toast";

const ClientDashboard = () => {
  const { selectedClientId, selectedClientName } = useClient();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const handleUndoPayment = async (invoice: any) => {
    if (!confirm("Desafazer o pagamento desta fatura? Ela voltará a ficar pendente.")) return;

    try {
      setLoading(true);

      // 1. Delete related accounting entries
      const { error: deleteEntryError } = await supabase
        .from("accounting_entries")
        .delete()
        .eq("invoice_id", invoice.id)
        .ilike("description", "%Reconciliação OFX/CNAB%");

      if (deleteEntryError && deleteEntryError.code !== "PGRST116") {
        console.error("Aviso: Erro ao deletar lançamento contábil:", deleteEntryError);
      }

      // 2. Revert invoice status
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          status: "pending",
          payment_date: null,
          cnab_reference: null,
          reconciled_at: null,
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;

      // 3. Revert pending reconciliation if exists
      const { error: reconciliationError } = await supabase
        .from("pending_reconciliations")
        .update({
          status: "pending",
          approved_at: null,
          approved_by: null,
          chart_of_accounts_id: null,
          cost_center_id: null,
        })
        .eq("invoice_id", invoice.id)
        .eq("status", "approved");

      if (reconciliationError && reconciliationError.code !== "PGRST116") {
        console.error("Aviso: Erro ao reverter conciliação:", reconciliationError);
      }

      toast.success("Pagamento desfeito! Fatura voltou a ficar pendente.");
      loadClientData();
    } catch (error: any) {
      toast.error("Erro ao desfazer pagamento");
      console.error(error);
      setLoading(false);
    }
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

        <div>
          {clientMonthlyFee !== null || clientPaymentDay !== null ? (
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">📋 Configuração do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {clientMonthlyFee !== null && (
                  <p className="text-sm text-blue-800">
                    Valor cadastrado: <span className="font-semibold">{formatCurrency(clientMonthlyFee)}</span>
                  </p>
                )}
                {clientPaymentDay !== null && (
                  <p className="text-sm text-blue-800">
                    Dia de vencimento: <span className="font-semibold">{clientPaymentDay}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <PaymentHistorySection
            clientId={selectedClientId}
            clientMonthlyFee={clientMonthlyFee}
            clientPaymentDay={clientPaymentDay}
            onPaymentStatusChange={() => loadClientData()}
          />
        </div>
      </div>
    </Layout>
  );
};

export default ClientDashboard;
