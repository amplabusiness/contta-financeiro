import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface PendingReconciliation {
  id: string;
  invoice_id?: string;
  invoice_number?: string;
  cnab_reference: string;
  cnab_document: string;
  amount: number;
  payment_date: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  ofx_amount?: number;
  ofx_date?: string;
  chart_of_accounts_id?: string;
  cost_center_id?: string;
}

interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
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
  const [approved, setApproved] = useState<PendingReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo>({});
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [rejectionDialog, setRejectionDialog] = useState<{
    visible: boolean;
    reconciliationId?: string;
    reason: string;
  }>({ visible: false, reason: "" });
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvalDialog, setApprovalDialog] = useState<{
    visible: boolean;
    reconciliationId?: string;
    chartAccountId: string;
    costCenterId: string;
  }>({ visible: false, chartAccountId: "", costCenterId: "" });

  const loadInvoiceInfo = useCallback(async (invoiceIds: string[]) => {
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
  }, []);

  const loadPendingReconciliations = useCallback(async () => {
    try {
      // Load pending reconciliations
      const { data: pendingData, error: pendingError } = await supabase
        .from("pending_reconciliations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;

      // Load approved reconciliations (last 20 for potential undo)
      const { data: approvedData, error: approvedError } = await supabase
        .from("pending_reconciliations")
        .select("*")
        .eq("status", "approved")
        .order("approved_at", { ascending: false })
        .limit(20);

      if (approvedError) throw approvedError;

      setPending(pendingData || []);
      setApproved(approvedData || []);

      // Load invoice info for both
      const allReconciliations = [...(pendingData || []), ...(approvedData || [])];
      const invoiceIds = allReconciliations.map(r => r.invoice_id).filter(Boolean);
      if (invoiceIds.length > 0) {
        await loadInvoiceInfo(invoiceIds);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar conciliações");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [loadInvoiceInfo]);

  const loadChartOfAccounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setChartOfAccounts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar plano de contas", error);
    }
  }, []);

  const loadCostCenters = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setCostCenters(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar centros de custo", error);
    }
  }, []);

  useEffect(() => {
    loadPendingReconciliations();
    loadChartOfAccounts();
    loadCostCenters();
  }, [loadPendingReconciliations, loadChartOfAccounts, loadCostCenters]);

  const handleApproveClick = (reconciliationId: string) => {
    setApprovalDialog({
      visible: true,
      reconciliationId,
      chartAccountId: "",
      costCenterId: "",
    });
  };

  const handleApprove = async () => {
    if (!approvalDialog.reconciliationId || !approvalDialog.chartAccountId || !approvalDialog.costCenterId) {
      toast.error("Selecione o plano de contas e centro de custo");
      return;
    }

    const reconciliation = pending.find(r => r.id === approvalDialog.reconciliationId);
    if (!reconciliation) return;

    setProcessingId(approvalDialog.reconciliationId);

    try {
      // 1. Update reconciliation status
      const { error: updateError } = await supabase
        .from("pending_reconciliations")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          chart_of_accounts_id: approvalDialog.chartAccountId,
          cost_center_id: approvalDialog.costCenterId,
        })
        .eq("id", approvalDialog.reconciliationId);

      if (updateError) throw updateError;

      // 2. Update invoice as paid (if exists)
      if (reconciliation.invoice_id) {
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
      }

      // 3. Create accounting entry
      const chartAccount = chartOfAccounts.find(c => c.id === approvalDialog.chartAccountId);
      const costCenter = costCenters.find(c => c.id === approvalDialog.costCenterId);

      const invoice = reconciliation.invoice_id ? invoiceInfo[reconciliation.invoice_id] : null;

      if (chartAccount && costCenter) {
        await supabase.from("accounting_entries").insert({
          invoice_id: reconciliation.invoice_id,
          chart_of_accounts_id: approvalDialog.chartAccountId,
          cost_center_id: approvalDialog.costCenterId,
          type: reconciliation.amount > 0 ? "income" : "expense",
          amount: Math.abs(reconciliation.amount),
          entry_date: reconciliation.payment_date,
          status: "posted",
          description: `Reconciliação OFX/CNAB - ${reconciliation.cnab_document}`,
        });
      }

      toast.success(`Conciliação aprovada! Plano: ${chartAccount?.name} | CC: ${costCenter?.name}`);

      // Remove from pending list
      setPending(pending.filter(r => r.id !== approvalDialog.reconciliationId));
      setApprovalDialog({ visible: false, chartAccountId: "", costCenterId: "" });
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
      // Keep status as "pending" but add rejection reason for audit trail
      const { error } = await supabase
        .from("pending_reconciliations")
        .update({
          rejected_reason: rejectionDialog.reason,
          // Status remains "pending" so it reappears in the list
        })
        .eq("id", rejectionDialog.reconciliationId);

      if (error) throw error;

      toast.success(
        "Conciliação marcada como revisar. Você pode analisar e conciliar corretamente agora."
      );

      // Reload the list to show it's still there
      await loadPendingReconciliations();

      setRejectionDialog({ visible: false, reason: "" });
    } catch (error: any) {
      toast.error("Erro ao processar rejeição");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUndoReconciliation = async (reconciliationId: string) => {
    const reconciliation = pending.find(r => r.id === reconciliationId);
    if (!reconciliation || reconciliation.status !== "approved") return;

    if (!confirm("Desafazer esta conciliação? A fatura voltará a ficar pendente.")) return;

    setProcessingId(reconciliationId);

    try {
      // 1. Revert invoice status to pending
      if (reconciliation.invoice_id) {
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            status: "pending",
            payment_date: null,
            cnab_reference: null,
            reconciled_at: null,
          })
          .eq("id", reconciliation.invoice_id);

        if (invoiceError) throw invoiceError;
      }

      // 2. Delete related accounting entries
      const { error: deleteEntryError } = await supabase
        .from("accounting_entries")
        .delete()
        .eq("invoice_id", reconciliation.invoice_id)
        .eq("description", `Reconciliação OFX/CNAB - ${reconciliation.cnab_document}`);

      if (deleteEntryError) {
        console.error("Aviso: Erro ao deletar lançamento contábil:", deleteEntryError);
        // Não falha aqui, continua
      }

      // 3. Revert reconciliation to pending
      const { error: updateError } = await supabase
        .from("pending_reconciliations")
        .update({
          status: "pending",
          approved_at: null,
          approved_by: null,
          chart_of_accounts_id: null,
          cost_center_id: null,
        })
        .eq("id", reconciliationId);

      if (updateError) throw updateError;

      toast.success("Conciliação desfeita! Fatura e conciliação voltaram ao status pendente.");

      // Reload pending list
      await loadPendingReconciliations();
    } catch (error: any) {
      toast.error("Erro ao desfazer conciliação");
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
                        <TableHead>Motivo Anterior</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map((rec) => {
                        const invoice = invoiceInfo[rec.invoice_id];
                        const isProcessing = processingId === rec.id;

                        return (
                          <TableRow key={rec.id} className={rec.rejected_reason ? "bg-yellow-50" : ""}>
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
                            <TableCell className="text-sm max-w-[200px]">
                              {rec.rejected_reason ? (
                                <span className="text-orange-600 font-medium">
                                  ⚠️ {rec.rejected_reason}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApproveClick(rec.id)}
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

        {approved.length > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">✅ Conciliações Aprovadas</CardTitle>
              <CardDescription>
                Clique em "Desfazer" se precisar reverter alguma conciliação
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
                      <TableHead>Aprovada em</TableHead>
                      <TableHead>Plano de Contas</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approved.map((rec) => {
                      const invoice = invoiceInfo[rec.invoice_id];
                      const chartAccount = chartOfAccounts.find(c => c.id === rec.chart_of_accounts_id);
                      const costCenter = costCenters.find(c => c.id === rec.cost_center_id);
                      const isProcessing = processingId === rec.id;

                      return (
                        <TableRow key={rec.id} className="bg-blue-50/50">
                          <TableCell className="font-medium">
                            {invoice?.number || rec.invoice_id}
                          </TableCell>
                          <TableCell>{invoice?.client_name || "-"}</TableCell>
                          <TableCell>{rec.cnab_document}</TableCell>
                          <TableCell>{formatCurrency(rec.amount)}</TableCell>
                          <TableCell>
                            {rec.approved_at
                              ? new Date(rec.approved_at).toLocaleDateString("pt-BR")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {chartAccount ? `${chartAccount.code} - ${chartAccount.name}` : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {costCenter ? `${costCenter.code} - ${costCenter.name}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUndoReconciliation(rec.id)}
                              disabled={isProcessing}
                              className="text-orange-600 border-orange-200 hover:bg-orange-50"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  Desfazer
                                </>
                              )}
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
        )}

        {/* Approval Dialog - Select Chart of Accounts and Cost Center */}
        <Dialog
          open={approvalDialog.visible}
          onOpenChange={(open) =>
            setApprovalDialog({ ...approvalDialog, visible: open })
          }
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Aprovar Conciliação</DialogTitle>
              <DialogDescription>
                Selecione o plano de contas e centro de custo para esta conciliação
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chart-account">Plano de Contas *</Label>
                <Select
                  value={approvalDialog.chartAccountId}
                  onValueChange={(value) =>
                    setApprovalDialog({ ...approvalDialog, chartAccountId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta contábil" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {chartOfAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name} ({account.account_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground block">
                  Escolha a conta que receberá/enviará este valor
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost-center">Centro de Custo *</Label>
                <Select
                  value={approvalDialog.costCenterId}
                  onValueChange={(value) =>
                    setApprovalDialog({ ...approvalDialog, costCenterId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {costCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.code} - {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground block">
                  Escolha o departamento/projeto relacionado
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setApprovalDialog({ visible: false, chartAccountId: "", costCenterId: "" })
                }
              >
                Cancelar
              </Button>
              <Button
                onClick={handleApprove}
                disabled={
                  processingId === approvalDialog.reconciliationId ||
                  !approvalDialog.chartAccountId ||
                  !approvalDialog.costCenterId
                }
              >
                Confirmar Aprovação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
