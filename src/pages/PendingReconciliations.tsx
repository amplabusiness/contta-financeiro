import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface PendingReconciliation {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  cnab_reference: string;
  cnab_document: string;
  amount: number;
  payment_date: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
}

interface InvoiceInfo {
  [key: string]: {
    number: string;
    client_name: string;
    due_date: string;
  };
}

const PendingReconciliations = () => {
  const [pending, setPending] = useState<PendingReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo>({});
  const [rejectionDialog, setRejectionDialog] = useState<{
    visible: boolean;
    reconciliationId?: string;
    reason: string;
  }>({ visible: false, reason: "" });
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadPendingReconciliations();
  }, []);

  const loadPendingReconciliations = async () => {
    try {
      const { data, error } = await supabase
        .from("pending_reconciliations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPending(data || []);

      // Load invoice info
      if (data && data.length > 0) {
        await loadInvoiceInfo(data.map(r => r.invoice_id));
      }
    } catch (error: any) {
      toast.error("Erro ao carregar conciliações pendentes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceInfo = async (invoiceIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, client_id, due_date, clients(name)")
        .in("id", invoiceIds);

      if (error) throw error;

      const infoMap: InvoiceInfo = {};
      data?.forEach((inv: any) => {
        infoMap[inv.id] = {
          number: inv.number,
          client_name: inv.clients?.name || "Unknown",
          due_date: inv.due_date,
        };
      });

      setInvoiceInfo(infoMap);
    } catch (error: any) {
      console.error("Erro ao carregar informações de faturas", error);
    }
  };

  const handleApprove = async (reconciliationId: string) => {
    const reconciliation = pending.find(r => r.id === reconciliationId);
    if (!reconciliation) return;

    setProcessingId(reconciliationId);

    try {
      // 1. Update reconciliation status
      const { error: updateError } = await supabase
        .from("pending_reconciliations")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", reconciliationId);

      if (updateError) throw updateError;

      // 2. Update invoice as paid
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          payment_date: reconciliation.payment_date,
          reconciled_at: new Date().toISOString(),
          cnab_reference: reconciliation.cnab_reference,
        })
        .eq("id", reconciliation.invoice_id);

      if (invoiceError) throw invoiceError;

      // 3. Create accounting entry
      const invoice = invoiceInfo[reconciliation.invoice_id];
      if (invoice) {
        await supabase.from("accounting_entries").insert({
          invoice_id: reconciliation.invoice_id,
          type: "payment",
          amount: reconciliation.amount,
          entry_date: reconciliation.payment_date,
          status: "posted",
          description: `Pagamento reconciliado via CNAB - ${reconciliation.cnab_document}`,
        });
      }

      toast.success(`Conciliação aprovada para fatura ${invoice?.number}`);

      // Remove from pending list
      setPending(pending.filter(r => r.id !== reconciliationId));
    } catch (error: any) {
      toast.error("Erro ao aprovar conciliação");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionDialog.reconciliationId) return;

    setProcessingId(rejectionDialog.reconciliationId);

    try {
      const { error } = await supabase
        .from("pending_reconciliations")
        .update({
          status: "rejected",
          rejected_reason: rejectionDialog.reason,
        })
        .eq("id", rejectionDialog.reconciliationId);

      if (error) throw error;

      toast.success("Conciliação rejeitada");

      // Remove from pending list
      setPending(
        pending.filter(r => r.id !== rejectionDialog.reconciliationId)
      );

      setRejectionDialog({ visible: false, reason: "" });
    } catch (error: any) {
      toast.error("Erro ao rejeitar conciliação");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const approvedCount = pending.filter(p => p.status === "approved").length;
  const rejectedCount = pending.filter(p => p.status === "rejected").length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conciliações Pendentes</h1>
          <p className="text-muted-foreground">
            Revise e aprove os matches sugeridos entre CNAB e faturas
          </p>
        </div>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhuma conciliação pendente</p>
                <p className="text-muted-foreground">
                  Todas as conciliações foram revisadas
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pending.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Matches Sugeridos para Aprovação</CardTitle>
                <CardDescription>
                  Revise cada match e aprove ou rejeite
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fatura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Documento CNAB</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data Pagamento</TableHead>
                        <TableHead>Confiança</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map((rec) => {
                        const invoice = invoiceInfo[rec.invoice_id];
                        const isProcessing = processingId === rec.id;

                        return (
                          <TableRow key={rec.id}>
                            <TableCell className="font-medium">
                              {invoice?.number || rec.invoice_id}
                            </TableCell>
                            <TableCell>{invoice?.client_name || "-"}</TableCell>
                            <TableCell>{rec.cnab_document}</TableCell>
                            <TableCell>{formatCurrency(rec.amount)}</TableCell>
                            <TableCell>
                              {new Date(rec.payment_date).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={rec.confidence > 0.95 ? "default" : "secondary"}
                              >
                                {Math.round(rec.confidence * 100)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(rec.id)}
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Aprovar
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setRejectionDialog({
                                    visible: true,
                                    reconciliationId: rec.id,
                                    reason: "",
                                  })
                                }
                                disabled={isProcessing}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Rejeitar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rejection Dialog */}
        <Dialog
          open={rejectionDialog.visible}
          onOpenChange={(open) =>
            setRejectionDialog({ ...rejectionDialog, visible: open })
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Conciliação</DialogTitle>
              <DialogDescription>
                Explique por que está rejeitando este match
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da Rejeição</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Valor não corresponde, fatura já foi paga manualmente, etc."
                  value={rejectionDialog.reason}
                  onChange={(e) =>
                    setRejectionDialog({
                      ...rejectionDialog,
                      reason: e.target.value,
                    })
                  }
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setRejectionDialog({ visible: false, reason: "" })
                }
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={
                  processingId === rejectionDialog.reconciliationId ||
                  !rejectionDialog.reason.trim()
                }
              >
                Rejeitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PendingReconciliations;
