import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { Undo2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface PaymentHistorySectionProps {
  clientId: string;
  clientMonthlyFee?: number | null;
  clientPaymentDay?: number | null;
  onPaymentStatusChange?: () => void;
}

interface InvoiceData {
  id: string;
  amount: number;
  due_date: string;
  payment_date?: string | null;
  status: string;
  competence?: string | null;
  description?: string | null;
  competenceLabel?: string;
  computedStatus?: string;
}

const PaymentHistorySection = ({
  clientId,
  clientMonthlyFee,
  clientPaymentDay,
  onPaymentStatusChange,
}: PaymentHistorySectionProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [paidInvoices, setPaidInvoices] = useState<InvoiceData[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceData[]>([]);

  const formatMonthYear = (date: Date) =>
    `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

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

  const getInvoiceStatus = (invoice: InvoiceData) => {
    if (invoice.status === "paid") return "paid";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.due_date);
    return dueDate < today ? "overdue" : "pending";
  };

  const aggregateInvoicesByCompetence = (
    invoiceList: InvoiceData[],
    defaultMonthlyFee: number | null,
    paymentDay: number | null
  ) => {
    const statusPriority: Record<string, number> = { overdue: 3, pending: 2, paid: 1 };
    const groups = new Map<string, InvoiceData>();

    invoiceList.forEach((invoice) => {
      const normalizedCompetence = normalizeCompetenceLabel(invoice.competence, invoice.due_date);
      const key = normalizedCompetence ?? `invoice-${invoice.id}`;
      const label =
        normalizedCompetence ?? normalizeCompetenceLabel(null, invoice.due_date) ?? invoice.competence ?? "-";
      const currentStatus = getInvoiceStatus(invoice);
      const amount = defaultMonthlyFee ?? Number(invoice.amount);

      let correctedDueDate = invoice.due_date;
      if (paymentDay !== null) {
        const originalDate = new Date(invoice.due_date);
        const year = originalDate.getFullYear();
        const month = originalDate.getMonth();
        const newDate = new Date(year, month, paymentDay);
        correctedDueDate = newDate.toISOString().split("T")[0];
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
      if (existing && defaultMonthlyFee == null) {
        existing.amount = Number(existing.amount) + Number(invoice.amount);
      } else if (existing) {
        existing.amount = defaultMonthlyFee;
      }

      if (existing) {
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
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
    );
  };

  useEffect(() => {
    loadPaymentHistory();
  }, [clientId]);

  const loadPaymentHistory = async () => {
    try {
      setLoading(true);

      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", clientId)
        .order("due_date", { ascending: false });

      if (invoicesError) {
        console.error("Erro ao buscar faturas:", invoicesError);
        throw invoicesError;
      }

      const allInvoices = invoicesData || [];
      const aggregatedInvoices = aggregateInvoicesByCompetence(allInvoices, clientMonthlyFee, clientPaymentDay);

      const paid = aggregatedInvoices.filter((invoice) => invoice.computedStatus === "paid");
      const pending = aggregatedInvoices.filter((invoice) => invoice.computedStatus !== "paid");

      setPaidInvoices(paid);
      setPendingInvoices(pending);
    } catch (error) {
      console.error("Erro ao carregar histórico de pagamento:", {
        error,
        clientId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      toast.error("Erro ao carregar histórico de pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handleUndoPayment = async (invoice: InvoiceData) => {
    if (!confirm("Desafazer o pagamento desta fatura? Ela voltará a ficar pendente.")) return;

    try {
      setLoading(true);

      // Delete related accounting entries
      const { error: deleteEntryError } = await supabase
        .from("accounting_entries")
        .delete()
        .eq("invoice_id", invoice.id)
        .ilike("description", "%Reconciliação OFX/CNAB%");

      if (deleteEntryError && deleteEntryError.code !== "PGRST116") {
        console.error("Aviso: Erro ao deletar lançamento contábil:", deleteEntryError);
      }

      // Revert invoice status
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          status: "pending",
          payment_date: null,
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;

      // Revert pending reconciliation if exists
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

      loadPaymentHistory();
      onPaymentStatusChange?.();
    } catch (error: any) {
      toast.error("Erro ao desfazer pagamento");
      console.error(error);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Histórico de Pagamentos (Conciliados) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <CardTitle>Histórico de Pagamentos (Conciliados)</CardTitle>
          </div>
          <CardDescription>
            {paidInvoices.length > 0
              ? `${paidInvoices.length} pagamento(s) realizado(s)`
              : "Nenhum pagamento registrado"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paidInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-2 opacity-50" />
              <p>Nenhum pagamento registrado para este cliente</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Data de Pagamento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="bg-green-50">
                      <TableCell className="font-medium">{invoice.competenceLabel || invoice.competence || "-"}</TableCell>
                      <TableCell>{formatLocalDate(invoice.due_date)}</TableCell>
                      <TableCell className="text-green-600 font-semibold">
                        {formatLocalDate(invoice.payment_date)}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUndoPayment(invoice)}
                          disabled={loading}
                          className="text-orange-600 hover:bg-orange-50"
                          title="Desfazer pagamento (reverte conciliação)"
                        >
                          <Undo2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Faturas a Vencer (Em Aberto) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <CardTitle>Faturas a Vencer (Em Aberto)</CardTitle>
          </div>
          <CardDescription>
            {pendingInvoices.length > 0
              ? `${pendingInvoices.length} fatura(s) pendente(s)`
              : "Nenhuma fatura pendente"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-2 opacity-50 text-green-600" />
              <p>Nenhuma fatura pendente para este cliente</p>
            </div>
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
                  {pendingInvoices.map((invoice) => {
                    const status = invoice.computedStatus || getInvoiceStatus(invoice);
                    return (
                      <TableRow
                        key={invoice.id}
                        className={status === "overdue" ? "bg-red-50" : "bg-yellow-50"}
                      >
                        <TableCell className="font-medium">
                          {invoice.competenceLabel || invoice.competence || "-"}
                        </TableCell>
                        <TableCell>{formatLocalDate(invoice.due_date)}</TableCell>
                        <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(status)}
                            {getStatusBadge(status)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentHistorySection;
