import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { AlertCircle, Clock, CheckCircle2, Undo2, Bot, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface PaymentItem {
  id: string;
  type: "invoice" | "opening_balance";
  competence: string;
  amount: number;
  paid_amount?: number;
  due_date: string;
  payment_date?: string | null;
  status: "paid" | "pending" | "overdue" | "partial";
  description?: string;
  notes?: string;
}

interface ConsolidatedPaymentsSectionProps {
  clientId: string;
  invoices: any[];
  openingBalances: any[];
  clientMonthlyFee?: number | null;
  clientPaymentDay?: number | null;
  onPaymentStatusChange?: () => void;
}

const ConsolidatedPaymentsSection = ({
  clientId,
  invoices,
  openingBalances,
  clientMonthlyFee,
  clientPaymentDay,
  onPaymentStatusChange,
}: ConsolidatedPaymentsSectionProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [consolidatedItems, setConsolidatedItems] = useState<PaymentItem[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [showAiInsight, setShowAiInsight] = useState(true);

  useEffect(() => {
    loadAndConsolidate();
  }, [invoices, openingBalances]);

  const formatMonthYear = (date: Date) =>
    `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

  const formatLocalDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(`${dateStr}T00:00:00`);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  };

  const getInvoiceStatus = (dueDate: string, isPaid: boolean) => {
    if (isPaid) return "paid";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    return due < today ? "overdue" : "pending";
  };

  const loadAndConsolidate = async () => {
    try {
      setLoading(true);

      const items: PaymentItem[] = [];

      // Adicionar invoices
      invoices.forEach((inv) => {
        const status = inv.status === "paid" ? "paid" : 
                       getInvoiceStatus(inv.due_date, inv.status === "paid");
        items.push({
          id: `invoice-${inv.id}`,
          type: "invoice",
          competence: inv.competence || "-",
          amount: Number(inv.amount),
          due_date: inv.due_date,
          payment_date: inv.payment_date,
          status,
          description: inv.description,
        });
      });

      // Adicionar opening balances
      openingBalances.forEach((ob) => {
        const pendingAmount = Number(ob.amount) - Number(ob.paid_amount || 0);
        const status = ob.status === "paid" ? "paid" : 
                       ob.status === "partial" ? "partial" : 
                       getInvoiceStatus(ob.competence, ob.status === "paid");
        items.push({
          id: `opening-${ob.id}`,
          type: "opening_balance",
          competence: ob.competence,
          amount: Number(ob.amount),
          paid_amount: Number(ob.paid_amount || 0),
          due_date: ob.competence,
          status,
          notes: `Saldo anterior: R$ ${formatCurrency(pendingAmount)}`,
        });
      });

      // Ordenar por data
      items.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

      setConsolidatedItems(items);

      // Consultar contador IA
      await consultAccountantAI(items);
    } catch (error) {
      console.error("Erro ao consolidar pagamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const consultAccountantAI = async (items: PaymentItem[]) => {
    try {
      // Apenas tenta consultar se há itens pendentes
      const pendingItems = items.filter(i => i.status !== "paid");
      if (pendingItems.length === 0) {
        return;
      }

      const totalOverdue = items
        .filter(i => i.status === "overdue")
        .reduce((sum, i) => sum + (i.amount - (i.paid_amount || 0)), 0);

      const totalPending = items
        .filter(i => i.status === "pending")
        .reduce((sum, i) => sum + (i.amount - (i.paid_amount || 0)), 0);

      const hasOpeningBalance = items.some(i => i.type === "opening_balance");
      const hasInvoices = items.some(i => i.type === "invoice");

      const prompt = `
Análise contábil: Este cliente tem:
- Saldo de Abertura (débitos anteriores): ${hasOpeningBalance ? "Sim" : "Não"}
- Faturas a Vencer (novas): ${hasInvoices ? "Sim" : "Não"}
- Total Vencido: ${formatCurrency(totalOverdue)}
- Total Pendente: ${formatCurrency(totalPending)}

É apropriado combinar o "Saldo de Abertura" com as "Faturas a Vencer" em uma única visualização consolidada no dashboard do cliente para análise unificada de débitos?

Responda de forma breve e profissional (máximo 2 frases).
      `;

      // Timeout de 10 segundos para não bloquear a UI
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout na consulta ao Contador IA")), 10000)
      );

      try {
        const { data, error } = await Promise.race([
          supabase.functions.invoke("ai-accountant-agent", {
            body: {
              type: "validate_entry",
              data: {
                description: prompt,
                transaction_type: "consolidation_analysis",
              },
            },
          }),
          timeoutPromise,
        ]) as any;

        if (error) {
          console.warn("Erro ao consultar AI Accountant:", {
            message: error.message,
            status: error.status,
          });
          setAiRecommendation(null);
          return;
        }

        if (data?.analysis) {
          setAiRecommendation(data.analysis);
        }
      } catch (invokeError) {
        console.warn("Falha na invocação do AI Accountant:", invokeError instanceof Error ? invokeError.message : String(invokeError));
        setAiRecommendation(null);
      }
    } catch (error) {
      console.warn("Erro ao preparar consulta ao Contador IA:", error instanceof Error ? error.message : String(error));
      setAiRecommendation(null);
    }
  };

  const handleUndoPayment = async (item: PaymentItem) => {
    if (!confirm("Desafazer o pagamento desta fatura? Ela voltará a ficar pendente.")) return;

    try {
      setLoading(true);

      if (item.type === "invoice") {
        const invoiceId = item.id.replace("invoice-", "");
        
        await supabase
          .from("accounting_entries")
          .delete()
          .eq("invoice_id", invoiceId)
          .ilike("description", "%Reconciliação OFX/CNAB%");

        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            status: "pending",
            payment_date: null,
          })
          .eq("id", invoiceId);

        if (invoiceError) throw invoiceError;

        await supabase
          .from("pending_reconciliations")
          .update({
            status: "pending",
            approved_at: null,
            approved_by: null,
            chart_of_accounts_id: null,
            cost_center_id: null,
          })
          .eq("invoice_id", invoiceId)
          .eq("status", "approved");
      }

      toast.success("Pagamento desfeito! Volta a ficar pendente.");
      loadAndConsolidate();
      onPaymentStatusChange?.();
    } catch (error: any) {
      toast.error("Erro ao desfazer pagamento");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "partial":
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
      partial: "secondary",
    };
    const labels: Record<string, string> = {
      paid: "Pago",
      pending: "Pendente",
      overdue: "Vencido",
      partial: "Parcial",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status]}</Badge>;
  };

  const paidItems = consolidatedItems.filter(i => i.status === "paid");
  const pendingItems = consolidatedItems.filter(i => i.status !== "paid");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Recommendation */}
      {showAiInsight && aiRecommendation && (
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-violet-600" />
                <CardTitle className="text-sm">Insight do Contador IA</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiInsight(false)}
                className="h-6 px-2 text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 italic leading-relaxed">{aiRecommendation}</p>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Pagamentos (Conciliados) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <CardTitle>Histórico de Pagamentos (Conciliados)</CardTitle>
          </div>
          <CardDescription>
            {paidItems.length > 0
              ? `${paidItems.length} pagamento(s) realizado(s)`
              : "Nenhum pagamento registrado"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paidItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-2 opacity-50" />
              <p>Nenhum pagamento registrado para este cliente</p>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidItems.map((item) => (
                    <TableRow key={item.id} className="bg-green-50">
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.type === "invoice" ? "Fatura" : "Saldo Ant."}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.competence}</TableCell>
                      <TableCell>{formatLocalDate(item.payment_date)}</TableCell>
                      <TableCell>{formatCurrency(item.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUndoPayment(item)}
                          disabled={loading}
                          className="text-orange-600 hover:bg-orange-50"
                          title="Desfazer pagamento"
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

      {/* Débitos Consolidados (Saldo de Abertura + Faturas a Vencer) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <CardTitle>Débitos Consolidados (Pendentes)</CardTitle>
          </div>
          <CardDescription>
            {pendingItems.length > 0
              ? `${pendingItems.length} débito(s) - Saldo de Abertura + Faturas a Vencer`
              : "Nenhum débito pendente"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-2 opacity-50 text-green-600" />
              <p>Nenhum débito pendente para este cliente</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingItems.map((item) => {
                    const isPending = item.status === "pending";
                    const isOverdue = item.status === "overdue";
                    return (
                      <TableRow
                        key={item.id}
                        className={isOverdue ? "bg-red-50" : isPending ? "bg-yellow-50" : ""}
                      >
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.type === "invoice" ? "Fatura" : "Saldo Ant."}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.competence}</TableCell>
                        <TableCell>{formatLocalDate(item.due_date)}</TableCell>
                        <TableCell>
                          {item.type === "opening_balance" && item.paid_amount ? (
                            <div className="text-sm">
                              <div className="font-semibold">{formatCurrency(item.amount)}</div>
                              <div className="text-xs text-green-600">
                                Pago: {formatCurrency(item.paid_amount)}
                              </div>
                              <div className="text-xs text-red-600 font-semibold">
                                Pendente: {formatCurrency(item.amount - item.paid_amount)}
                              </div>
                            </div>
                          ) : (
                            formatCurrency(item.amount)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            {getStatusBadge(item.status)}
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

export default ConsolidatedPaymentsSection;
