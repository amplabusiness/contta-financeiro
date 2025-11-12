import { useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";

const Invoices = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [formData, setFormData] = useState({
    client_id: "",
    amount: "",
    due_date: "",
    payment_date: "",
    status: "pending",
    description: "",
    competence: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [invoicesRes, clientsRes] = await Promise.all([
        supabase.from("invoices").select("*, clients(name)").order("due_date", { ascending: false }),
        supabase.from("clients").select("*").eq("status", "active").order("name"),
      ]);

      setInvoices(invoicesRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const invoiceData = {
        ...formData,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date || null,
        created_by: user.id,
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", editingInvoice.id);

        if (error) throw error;
        toast.success("Honorário atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("invoices").insert(invoiceData);

        if (error) throw error;
        toast.success("Honorário cadastrado com sucesso!");
      }

      setOpen(false);
      setEditingInvoice(null);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar honorário");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoice: any) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", payment_date: new Date().toISOString().split("T")[0] })
        .eq("id", invoice.id);

      if (error) throw error;
      toast.success("Honorário marcado como pago!");
      loadData();
    } catch (error: any) {
      toast.error("Erro ao atualizar honorário");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este honorário?")) return;

    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);

      if (error) throw error;
      toast.success("Honorário excluído com sucesso!");
      loadData();
    } catch (error: any) {
      toast.error("Erro ao excluir honorário");
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      amount: "",
      due_date: "",
      payment_date: "",
      status: "pending",
      description: "",
      competence: "",
    });
  };

  const handleEdit = (invoice: any) => {
    setEditingInvoice(invoice);
    setFormData({
      client_id: invoice.client_id,
      amount: invoice.amount.toString(),
      due_date: invoice.due_date,
      payment_date: invoice.payment_date || "",
      status: invoice.status,
      description: invoice.description || "",
      competence: invoice.competence || "",
    });
    setOpen(true);
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

  const totalPending = invoices
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Honorários</h1>
            <p className="text-muted-foreground">Controle de recebimentos</p>
          </div>
          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setEditingInvoice(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Honorário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingInvoice ? "Editar Honorário" : "Novo Honorário"}</DialogTitle>
                <DialogDescription>
                  Registre o honorário a receber
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="client_id">Cliente *</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="competence">Competência</Label>
                    <Input
                      id="competence"
                      placeholder="Ex: 11/2024"
                      value={formData.competence}
                      onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Vencimento *</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_date">Data Pagamento</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                        <SelectItem value="canceled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>A Receber</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {formatCurrency(totalPending)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recebido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {formatCurrency(totalPaid)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Honorários</CardTitle>
            <CardDescription>Total: {invoices.length} registros</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.clients?.name || "-"}</TableCell>
                      <TableCell>{invoice.competence || "-"}</TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        {invoice.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMarkAsPaid(invoice)}
                            title="Marcar como pago"
                          >
                            <CheckCircle className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(invoice)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(invoice.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
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

export default Invoices;
