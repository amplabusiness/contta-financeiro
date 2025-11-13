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
import { Plus, Pencil, Trash2, CheckCircle, CalendarDays, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";

const Invoices = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [formData, setFormData] = useState({
    client_id: "",
    amount: "",
    due_date: "",
    payment_date: "",
    status: "pending",
    description: "",
    competence: "",
  });

  const months = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const years = ["2024", "2025", "2026"];

  useEffect(() => {
    loadData();
  }, [filterYear, filterMonth]);

  const loadData = async () => {
    try {
      let query = supabase.from("invoices").select("*, clients(name)").order("due_date", { ascending: false });

      // Filtrar por competência se ano ou mês estiverem selecionados
      if (filterYear && filterMonth) {
        const competence = `${filterMonth}/${filterYear}`;
        query = query.eq("competence", competence);
      } else if (filterYear) {
        query = query.like("competence", `%/${filterYear}`);
      }

      const [invoicesRes, clientsRes] = await Promise.all([
        query,
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

  const generateMonthlyInvoices = async () => {
    if (!filterYear || !filterMonth) {
      toast.error("Selecione ano e mês para gerar os honorários");
      return;
    }

    if (!confirm(`Gerar honorários mensais para ${months.find(m => m.value === filterMonth)?.label}/${filterYear}?`)) {
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: activeClients } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
        .gt("monthly_fee", 0);

      if (!activeClients || activeClients.length === 0) {
        toast.warning("Nenhum cliente ativo com honorário mensal definido");
        setLoading(false);
        return;
      }

      const competence = `${filterMonth}/${filterYear}`;
      const dueDate = `${filterYear}-${filterMonth}-${activeClients[0].payment_day || "10"}`;

      let created = 0;
      let skipped = 0;

      for (const client of activeClients) {
        // Verificar se já existe fatura para esse cliente nessa competência
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("client_id", client.id)
          .eq("competence", competence)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        const paymentDay = client.payment_day || 10;
        const clientDueDate = `${filterYear}-${filterMonth}-${paymentDay.toString().padStart(2, "0")}`;

        const { data: newInvoice, error } = await supabase.from("invoices").insert({
          client_id: client.id,
          amount: client.monthly_fee,
          due_date: clientDueDate,
          status: "pending",
          competence: competence,
          description: `Honorário mensal - ${competence}`,
          created_by: user.id,
        }).select().single();

        if (!error && newInvoice) {
          created++;
          
          // Criar provisionamento contábil automaticamente
          try {
            await supabase.functions.invoke('create-accounting-entry', {
              body: {
                type: 'invoice',
                operation: 'provision',
                referenceId: newInvoice.id,
                amount: Number(client.monthly_fee),
                date: clientDueDate,
                description: `Honorário mensal - ${competence} - ${client.name}`,
                clientId: client.id,
              },
            });
          } catch (provisionError) {
            console.error('Erro ao provisionar:', provisionError);
          }
        }
      }

      toast.success(`${created} honorários gerados! ${skipped > 0 ? `${skipped} já existiam.` : ""}`);
      loadData();
    } catch (error: any) {
      toast.error("Erro ao gerar honorários: " + error.message);
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
        const { data: newInvoice, error } = await supabase.from("invoices").insert(invoiceData).select().single();

        if (error) throw error;
        
        // Criar provisionamento contábil automaticamente
        try {
          await supabase.functions.invoke('create-accounting-entry', {
            body: {
              type: 'invoice',
              operation: 'provision',
              referenceId: newInvoice.id,
              amount: parseFloat(formData.amount),
              date: formData.due_date,
              description: formData.description || 'Honorário',
              clientId: formData.client_id,
            },
          });
          toast.success("Honorário cadastrado e provisionamento criado!");
        } catch (provisionError) {
          console.error('Erro ao provisionar:', provisionError);
          toast.warning("Honorário cadastrado, mas erro ao criar provisionamento");
        }
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
      const paymentDate = new Date().toISOString().split("T")[0];
      
      // Atualizar status da invoice
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", payment_date: paymentDate })
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
        <div>
          <h1 className="text-3xl font-bold">Honorários</h1>
          <p className="text-muted-foreground">Controle de recebimentos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar honorários por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2 w-40">
                <Label>Ano</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os anos" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-40">
                <Label>Mês</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os meses" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                {(filterYear || filterMonth) && (
                  <Button 
                    onClick={() => {
                      setFilterYear("");
                      setFilterMonth("");
                    }} 
                    variant="outline"
                  >
                    Limpar Filtros
                  </Button>
                )}
                <Button onClick={generateMonthlyInvoices} disabled={loading || !filterYear || !filterMonth} variant="outline">
                  <Zap className="w-4 h-4 mr-2" />
                  Gerar Honorários do Mês
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
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
