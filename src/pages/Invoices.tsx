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
import { Plus, Pencil, Trash2, CheckCircle, Zap, Bot, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { AIInvoiceClassifier } from "@/components/ai/AIInvoiceClassifier";
import { AICollectionAgent } from "@/components/ai/AICollectionAgent";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { useClient } from "@/contexts/ClientContext";
import { useAccounting } from "@/hooks/useAccounting";

const Invoices = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const { selectedClientId, selectedClientName } = useClient();
  const { registrarHonorario, registrarRecebimento } = useAccounting({ showToasts: false });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  // Estados para geração de honorários com progresso
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");

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
  }, [selectedYear, selectedMonth, selectedClientId]); // Recarregar quando mudar cliente

  const loadData = async () => {
    try {
      let query = supabase.from("invoices").select("*, clients(name)").order("due_date", { ascending: false });

      // Filtrar por cliente se selecionado
      if (selectedClientId) {
        query = query.eq("client_id", selectedClientId);
      }

      // Filtrar por competência se ano ou mês estiverem selecionados
      if (selectedYear && selectedMonth) {
        const monthStr = selectedMonth.toString().padStart(2, '0');
        const competence = `${monthStr}/${selectedYear}`;
        query = query.eq("competence", competence);
      } else if (selectedYear) {
        query = query.like("competence", `%/${selectedYear}`);
      }

      const [invoicesRes, clientsRes] = await Promise.all([
        query,
        supabase.from("clients").select("*").eq("is_active", true).order("name"),
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
    if (!selectedYear || !selectedMonth) {
      toast.error("Selecione ano e mês para gerar os honorários");
      return;
    }

    const monthsForLabel = [
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

    const monthStr = selectedMonth.toString().padStart(2, '0');
    if (!confirm(`Gerar honorários mensais para ${monthsForLabel.find(m => m.value === monthStr)?.label}/${selectedYear}?`)) {
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus("Buscando clientes...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar clientes ativos com honorário > 0 e que não são pro-bono
      const { data: activeClients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .gt("monthly_fee", 0)
        .or("is_pro_bono.is.null,is_pro_bono.eq.false");

      if (clientsError) {
        console.error("Erro ao buscar clientes:", clientsError);
        toast.error("Erro ao buscar clientes: " + clientsError.message);
        setIsGenerating(false);
        return;
      }

      if (!activeClients || activeClients.length === 0) {
        toast.warning("Nenhum cliente ativo com honorário mensal definido. Verifique se os clientes têm o campo 'Honorário Mensal' preenchido na página de Clientes.");
        setIsGenerating(false);
        return;
      }

      const totalClients = activeClients.length;
      setGenerationStatus(`Encontrados ${totalClients} clientes`);
      setGenerationProgress(5);

      const competence = `${monthStr}/${selectedYear}`;

      let created = 0;
      let skipped = 0;
      let processed = 0;

      let errors: string[] = [];

      for (const client of activeClients) {
        processed++;
        const progress = Math.round(5 + (processed / totalClients) * 90);
        setGenerationProgress(progress);
        setGenerationStatus(`Processando ${client.name}... (${processed}/${totalClients})`);

        // Verificar se já existe fatura para esse cliente nessa competência
        const { data: existingList, error: checkError } = await supabase
          .from("invoices")
          .select("id")
          .eq("client_id", client.id)
          .eq("competence", competence);

        if (checkError) {
          console.error(`Erro ao verificar existência para ${client.name}:`, checkError);
          errors.push(`${client.name}: erro ao verificar`);
          continue;
        }

        if (existingList && existingList.length > 0) {
          skipped++;
          continue;
        }

        const paymentDay = client.payment_day || 10;
        const clientDueDate = `${selectedYear}-${monthStr}-${paymentDay.toString().padStart(2, "0")}`;

        console.log(`Criando honorário para ${client.name}: R$ ${client.monthly_fee}, venc: ${clientDueDate}, comp: ${competence}`);

        const { data: newInvoice, error } = await supabase.from("invoices").insert({
          client_id: client.id,
          amount: client.monthly_fee,
          due_date: clientDueDate,
          status: "pending",
          competence: competence,
          created_by: user.id,
        }).select().single();

        if (error) {
          console.error(`Erro ao criar fatura para ${client.name}:`, error);
          errors.push(`${client.name}: ${error.message}`);
        } else if (newInvoice) {
          created++;
          console.log(`Honorário criado com sucesso para ${client.name}, ID: ${newInvoice.id}`);

          // ✅ CONTABILIDADE INTEGRADA: Criar lançamento contábil automaticamente
          registrarHonorario({
            invoiceId: newInvoice.id,
            clientId: client.id,
            clientName: client.name,
            amount: Number(client.monthly_fee),
            competence: competence,
            dueDate: clientDueDate,
            description: `Honorários ${competence} - ${client.name}`,
          }).catch(provisionError => {
            console.error('Erro ao criar lançamento contábil:', provisionError);
          });
        } else {
          console.warn(`Insert retornou null para ${client.name}`);
          errors.push(`${client.name}: insert retornou vazio`);
        }
      }

      // Log final de debug
      console.log(`Geração concluída: ${created} criados, ${skipped} pulados, ${errors.length} erros`);
      if (errors.length > 0) {
        console.error('Erros encontrados:', errors);
      }

      setGenerationProgress(100);
      setGenerationStatus("Concluído!");

      if (created > 0) {
        toast.success(`${created} honorário${created > 1 ? 's' : ''} gerado${created > 1 ? 's' : ''} para ${competence}! ${skipped > 0 ? `(${skipped} já existia${skipped > 1 ? 'm' : ''})` : ""}`);
      } else if (skipped > 0) {
        toast.info(`Todos os ${skipped} honorários para ${competence} já existem.`);
      } else if (errors.length > 0) {
        toast.error(`${errors.length} erros ao gerar honorários. Verifique o console (F12) para detalhes.`);
      } else {
        toast.warning("Nenhum honorário foi gerado. Verifique o console (F12) para mais detalhes.");
      }

      // Pequeno delay para mostrar 100% antes de fechar
      setTimeout(() => {
        setIsGenerating(false);
        loadData();
      }, 1000);
    } catch (error: any) {
      toast.error("Erro ao gerar honorários: " + error.message);
      setIsGenerating(false);
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

        // Buscar nome do cliente para o lançamento
        const client = clients.find(c => c.id === formData.client_id);

        // ✅ CONTABILIDADE INTEGRADA: Criar lançamento contábil automaticamente
        const accountingResult = await registrarHonorario({
          invoiceId: newInvoice.id,
          clientId: formData.client_id,
          clientName: client?.name || 'Cliente',
          amount: parseFloat(formData.amount),
          competence: formData.competence,
          dueDate: formData.due_date,
          description: formData.description || `Honorários ${formData.competence}`,
        });

        if (accountingResult.success) {
          toast.success("Honorário cadastrado com lançamento contábil!");
        } else {
          console.error('Erro ao criar lançamento contábil:', accountingResult.error);
          toast.warning("Honorário cadastrado, mas erro no lançamento contábil");
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

      // ✅ CONTABILIDADE INTEGRADA: Registrar recebimento automaticamente
      const accountingResult = await registrarRecebimento({
        paymentId: `${invoice.id}_payment`,
        invoiceId: invoice.id,
        clientId: invoice.client_id,
        clientName: invoice.clients?.name || 'Cliente',
        amount: Number(invoice.amount),
        paymentDate: paymentDate,
        description: `Recebimento ${invoice.competence || ''} - ${invoice.clients?.name || 'Cliente'}`,
      });

      if (accountingResult.success) {
        toast.success("Honorário pago e lançamento contábil criado!");
      } else {
        console.error('Erro ao criar lançamento de recebimento:', accountingResult.error);
        toast.warning("Honorário pago, mas erro no lançamento contábil");
      }

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
      {/* Overlay de progresso durante geração de honorários */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[400px] mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Gerando Honorários
              </CardTitle>
              <CardDescription>
                Por favor, aguarde enquanto os honorários são gerados...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={generationProgress} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{generationStatus}</span>
                <span className="font-medium">{generationProgress}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            {selectedClientId ? `Honorários - ${selectedClientName}` : "Honorários"}
          </h1>
          <p className="text-muted-foreground">
            {selectedClientId
              ? "Honorários do cliente selecionado"
              : "Controle de recebimentos - selecione um cliente para filtrar"
            }
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar honorários por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <PeriodFilter />
              <Button onClick={generateMonthlyInvoices} disabled={loading || isGenerating || !selectedYear || !selectedMonth} variant="outline">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? "Gerando..." : "Gerar Honorários do Mês"}
              </Button>
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
                    <TableHead>IA</TableHead>
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
                      <TableCell>
                        <div className="flex gap-1">
                          <AIInvoiceClassifier
                            invoiceId={invoice.id}
                            clientId={invoice.client_id}
                            amount={invoice.amount}
                            dueDate={invoice.due_date}
                          />
                          {invoice.status === "pending" && (
                            <AICollectionAgent
                              clientId={invoice.client_id}
                              invoiceId={invoice.id}
                              trigger={
                                <Button size="sm" variant="outline">
                                  <Bot className="h-4 w-4" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </TableCell>
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
