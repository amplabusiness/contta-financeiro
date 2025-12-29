import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, CheckCircle, DollarSign, Loader2, AlertCircle, TrendingUp, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { useAccounting } from "@/hooks/useAccounting";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const COST_CENTER_ID = "1"; // "1. AMPLA"
const SICREDI_BANK_ACCOUNT = "sicredi"; // Será carregado dinamicamente

interface HonorarioRecord {
  id: string;
  client_id: string;
  client_name?: string;
  amount: number;
  due_date: string;
  payment_date?: string;
  status: "pending" | "paid";
  competence: string;
  description?: string;
  created_at: string;
  created_by: string;
}

interface Client {
  id: string;
  name: string;
  monthly_fee: number;
}

const HonorariosFlow = () => {
  const { registrarHonorario, registrarRecebimento } = useAccounting({ showToasts: false });
  const [honorarios, setHonorarios] = useState<HonorarioRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingHonorario, setEditingHonorario] = useState<HonorarioRecord | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string>("");

  const [formData, setFormData] = useState({
    client_id: "",
    amount: "",
    due_date: "",
    competence: "",
    description: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [honorariosRes, clientsRes, banksRes] = await Promise.all([
        supabase.from("invoices").select("*").order("due_date", { ascending: false }),
        supabase.from("clients").select("id, name, monthly_fee").eq("is_active", true).order("name"),
        supabase.from("bank_accounts").select("id, name").ilike("name", "%SICREDI%").eq("is_active", true).limit(1),
      ]);

      const mappedHonorarios = (honorariosRes.data || []).map((h: any) => ({
        ...h,
        client_name: clients.find(c => c.id === h.client_id)?.name || h.client_id,
      }));

      setHonorarios(mappedHonorarios);
      setClients(clientsRes.data || []);

      if (banksRes.data && banksRes.data.length > 0) {
        setBankAccountId(banksRes.data[0].id);
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar dados");
      console.error("[HonorariosFlow] Load error:", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [clients]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      client_id: "",
      amount: "",
      due_date: "",
      competence: "",
      description: "",
    });
    setEditingHonorario(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const honorarioData = {
        client_id: formData.client_id,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        status: "pending",
        competence: formData.competence,
        description: formData.description || `Honorários ${formData.competence}`,
        created_by: user.id,
        cost_center_id: COST_CENTER_ID,
      };

      if (editingHonorario) {
        // Update existing
        const { error } = await supabase
          .from("invoices")
          .update(honorarioData)
          .eq("id", editingHonorario.id);

        if (error) throw new Error(getErrorMessage(error));
        toast.success("Honorário atualizado com sucesso!");
      } else {
        // Create new
        const { data: newHonorario, error } = await supabase
          .from("invoices")
          .insert(honorarioData)
          .select()
          .single();

        if (error) throw new Error(getErrorMessage(error));

        // Get client name
        const client = clients.find(c => c.id === formData.client_id);

        // Create accounting entry (competência ao criar)
        const accountingResult = await registrarHonorario({
          invoiceId: newHonorario.id,
          clientId: formData.client_id,
          clientName: client?.name || "Cliente",
          amount: parseFloat(formData.amount),
          competence: formData.competence,
          dueDate: formData.due_date,
          description: formData.description || `Honorários ${formData.competence} - ${client?.name}`,
        });

        if (accountingResult.success) {
          toast.success("Honorário criado com lançamento contábil em competência!");
        } else {
          toast.warning(`Honorário criado mas erro contábil: ${accountingResult.error}`);
        }
      }

      setOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      toast.error("Erro: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (honorarioId: string) => {
    if (!bankAccountId) {
      toast.error("Nenhuma conta SICREDI configurada");
      return;
    }

    if (!confirm("Marcar este honorário como pago?")) return;

    setLoading(true);

    try {
      const honorario = honorarios.find(h => h.id === honorarioId);
      if (!honorario) throw new Error("Honorário não encontrado");

      const paymentDate = new Date().toISOString().split("T")[0];

      // Update status to paid
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", payment_date: paymentDate })
        .eq("id", honorarioId);

      if (error) throw new Error(getErrorMessage(error));

      // Create payment accounting entry (Banco SICREDI)
      const client = clients.find(c => c.id === honorario.client_id);
      const accountingResult = await registrarRecebimento({
        paymentId: `payment_${honorarioId}_${paymentDate}`,
        invoiceId: honorarioId,
        clientId: honorario.client_id,
        clientName: client?.name || "Cliente",
        amount: honorario.amount,
        paymentDate: paymentDate,
        bankAccountId: bankAccountId,
        description: `Recebimento de ${client?.name} - Honorários ${honorario.competence}`,
      });

      if (accountingResult.success) {
        toast.success("Honorário pago com lançamento contábil em SICREDI!");
      } else {
        toast.warning(`Pagamento registrado mas erro contábil: ${accountingResult.error}`);
      }

      await loadData();
    } catch (error: any) {
      toast.error("Erro ao processar pagamento: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar pagamentos com transações bancárias
  const handleSyncPayments = async () => {
    setLoading(true);
    let syncCount = 0;

    try {
      // Buscar honorários pendentes
      const pendingHonorarios = honorarios.filter(h => h.status === "pending");
      if (pendingHonorarios.length === 0) {
        toast.info("Nenhum honorário pendente para sincronizar");
        return;
      }

      // Buscar transações bancárias de crédito (entradas) do SICREDI
      const { data: bankTransactions, error: txError } = await supabase
        .from("bank_transactions")
        .select("id, amount, transaction_date, description, matched")
        .eq("transaction_type", "credit")
        .eq("matched", false)
        .order("transaction_date", { ascending: false });

      if (txError) throw txError;

      if (!bankTransactions || bankTransactions.length === 0) {
        toast.info("Nenhuma transação bancária não conciliada encontrada");
        return;
      }

      console.log(`[HonorariosFlow] Sincronizando ${pendingHonorarios.length} honorários com ${bankTransactions.length} transações`);

      // Para cada honorário pendente, tentar encontrar uma transação correspondente
      for (const honorario of pendingHonorarios) {
        const client = clients.find(c => c.id === honorario.client_id);
        const clientName = client?.name?.toUpperCase() || "";

        // Buscar transação que corresponda ao valor (tolerância de R$ 0.10)
        const matchingTx = bankTransactions.find(tx => {
          const amountMatch = Math.abs(tx.amount - honorario.amount) < 0.10;
          const descMatch = clientName && tx.description?.toUpperCase().includes(clientName.substring(0, 15));

          // Match por valor exato ou valor + parte do nome do cliente na descrição
          return amountMatch && (descMatch || !clientName);
        });

        if (matchingTx) {
          // Marcar honorário como pago
          const paymentDate = matchingTx.transaction_date;

          const { error: updateError } = await supabase
            .from("invoices")
            .update({ status: "paid", payment_date: paymentDate })
            .eq("id", honorario.id);

          if (updateError) {
            console.error(`Erro ao baixar honorário ${honorario.id}:`, updateError);
            continue;
          }

          // Marcar transação como conciliada
          await supabase
            .from("bank_transactions")
            .update({ matched: true, matched_invoice_id: honorario.id })
            .eq("id", matchingTx.id);

          // Registrar lançamento contábil
          if (bankAccountId) {
            await registrarRecebimento({
              paymentId: `sync_${honorario.id}_${paymentDate}`,
              invoiceId: honorario.id,
              clientId: honorario.client_id,
              clientName: client?.name || "Cliente",
              amount: honorario.amount,
              paymentDate: paymentDate,
              bankAccountId: bankAccountId,
              description: `Recebimento sincronizado - ${client?.name} - Honorários ${honorario.competence}`,
            });
          }

          syncCount++;
          // Remove a transação usada para não reutilizar
          const txIndex = bankTransactions.findIndex(t => t.id === matchingTx.id);
          if (txIndex > -1) bankTransactions.splice(txIndex, 1);
        }
      }

      if (syncCount > 0) {
        toast.success(`${syncCount} honorário(s) baixado(s) automaticamente!`);
        await loadData();
      } else {
        toast.info("Nenhum match encontrado entre honorários e transações bancárias");
      }
    } catch (error: any) {
      console.error("[HonorariosFlow] Sync error:", error);
      toast.error("Erro ao sincronizar pagamentos: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Marcar todos os vencidos como pagos (baixa manual em lote)
  const handleBaixarVencidos = async () => {
    const vencidos = honorarios.filter(h => {
      if (h.status !== "pending") return false;
      const dueDate = new Date(h.due_date);
      const today = new Date();
      return dueDate < today;
    });

    if (vencidos.length === 0) {
      toast.info("Nenhum honorário vencido pendente");
      return;
    }

    if (!confirm(`Baixar ${vencidos.length} honorário(s) vencido(s) como pagos?`)) return;

    setLoading(true);
    let baixados = 0;

    try {
      for (const honorario of vencidos) {
        const paymentDate = new Date().toISOString().split("T")[0];

        const { error } = await supabase
          .from("invoices")
          .update({ status: "paid", payment_date: paymentDate })
          .eq("id", honorario.id);

        if (error) continue;

        // Registrar recebimento contábil
        if (bankAccountId) {
          const client = clients.find(c => c.id === honorario.client_id);
          await registrarRecebimento({
            paymentId: `batch_${honorario.id}_${paymentDate}`,
            invoiceId: honorario.id,
            clientId: honorario.client_id,
            clientName: client?.name || "Cliente",
            amount: honorario.amount,
            paymentDate: paymentDate,
            bankAccountId: bankAccountId,
            description: `Baixa em lote - ${client?.name} - Honorários ${honorario.competence}`,
          });
        }

        baixados++;
      }

      toast.success(`${baixados} honorário(s) baixado(s)!`);
      await loadData();
    } catch (error: any) {
      toast.error("Erro ao baixar honorários: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (honorarioId: string) => {
    if (!confirm("Deletar este honorário? Isto vai remover os lançamentos contábeis também.")) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", honorarioId);

      if (error) throw new Error(getErrorMessage(error));

      // Note: Os lançamentos contábeis também deverão ser deletados
      // via trigger ou função no banco de dados

      toast.success("Honorário deletado!");
      await loadData();
    } catch (error: any) {
      toast.error("Erro ao deletar: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (honorario: HonorarioRecord) => {
    setEditingHonorario(honorario);
    setFormData({
      client_id: honorario.client_id,
      amount: honorario.amount.toString(),
      due_date: honorario.due_date,
      competence: honorario.competence,
      description: honorario.description || "",
    });
    setOpen(true);
  };

  const stats = {
    total: honorarios.length,
    pending: honorarios.filter(h => h.status === "pending").length,
    paid: honorarios.filter(h => h.status === "paid").length,
    totalAmount: honorarios.reduce((sum, h) => sum + h.amount, 0),
    pendingAmount: honorarios.filter(h => h.status === "pending").reduce((sum, h) => sum + h.amount, 0),
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              Fluxo de Honorários
            </h1>
            <p className="text-muted-foreground">
              Gerenciamento completo de honorários com lançamentos contábeis automáticos
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSyncPayments}
              disabled={loading}
              title="Sincronizar com transações bancárias e baixar pagos"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar Pagamentos
            </Button>
            <Button
              variant="outline"
              onClick={handleBaixarVencidos}
              disabled={loading}
              title="Baixar todos os vencidos como pagos"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Vencidos
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Honorário
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingHonorario ? "Editar Honorário" : "Novo Honorário"}
                </DialogTitle>
                <DialogDescription>
                  Centro de Custo: <strong>1. AMPLA</strong> | Regime: <strong>Competência</strong>
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="client">Cliente</Label>
                  <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount">Valor</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="competence">Competência (MM/YYYY)</Label>
                  <Input
                    id="competence"
                    placeholder="01/2025"
                    value={formData.competence}
                    onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="due_date">Data de Vencimento</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descrição adicional..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Lançamento contábil (Competência): D: 1.1.2 | C: 3.1.1
                  </AlertDescription>
                </Alert>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingHonorario ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.totalAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.pendingAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recebidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.totalAmount - stats.pendingAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa Recebimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Centro de Custo</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">1. AMPLA</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Honorários</CardTitle>
            <CardDescription>
              Lista completa de honorários com status e ações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : honorarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum honorário cadastrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {honorarios.map((honorario) => (
                    <TableRow key={honorario.id}>
                      <TableCell className="font-medium">{honorario.client_name}</TableCell>
                      <TableCell>{honorario.competence}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(honorario.amount)}</TableCell>
                      <TableCell>{new Date(honorario.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        {honorario.status === "paid" ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Pago
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {honorario.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePayment(honorario.id)}
                            disabled={loading}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {honorario.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(honorario)}
                            disabled={loading}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(honorario.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Accounting Rules Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">Regras Contábeis do Fluxo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Centro de Custo:</strong> 1. AMPLA (fixo para todos os honorários)
            </div>
            <div>
              <strong>Ao Criar Honorário (Competência):</strong>
              <div className="ml-4 mt-1">
                • Débito: 1.1.2 - Créditos a Receber<br />
                • Crédito: 3.1.1 - Receita de Honorários
              </div>
            </div>
            <div>
              <strong>Ao Marcar como Pago (Caixa):</strong>
              <div className="ml-4 mt-1">
                • Débito: SICREDI (conta bancária)<br />
                • Crédito: 1.1.2 - Créditos a Receber
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default HonorariosFlow;
