import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calendar, DollarSign, Loader2, FileText, Upload, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  opening_balance: number;
}

interface OpeningBalance {
  id: string;
  client_id: string;
  client_name?: string;
  competence: string;
  amount: number;
  due_date: string | null;
  status: string;
  paid_amount: number;
  paid_date: string | null;
  description: string | null;
  notes: string | null;
}

const ClientOpeningBalance = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [balances, setBalances] = useState<OpeningBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<OpeningBalance | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [formData, setFormData] = useState({
    client_id: "",
    competence: "",
    amount: "",
    due_date: "",
    description: "",
    notes: ""
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar clientes ativos
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf, opening_balance")
        .eq("status", "active")
        .order("name");

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Buscar saldos de abertura
      await loadBalances();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async (clientId?: string) => {
    try {
      let query = supabase
        .from("client_opening_balance")
        .select(`
          *,
          clients!inner(name)
        `)
        .order("competence", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const enrichedBalances = (data || []).map((balance) => ({
        ...balance,
        client_name: balance.clients?.name
      }));

      setBalances(enrichedBalances);
    } catch (error) {
      console.error("Erro ao carregar saldos:", error);
      toast.error("Erro ao carregar saldos de abertura");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validações
      if (!formData.client_id) {
        toast.error("Selecione um cliente");
        return;
      }

      if (!formData.competence) {
        toast.error("Informe a competência (MM/AAAA)");
        return;
      }

      // Validar formato da competência
      const competenceRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
      if (!competenceRegex.test(formData.competence)) {
        toast.error("Formato de competência inválido. Use MM/AAAA (ex: 01/2024)");
        return;
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error("Informe um valor válido");
        return;
      }

      const balanceData = {
        client_id: formData.client_id,
        competence: formData.competence,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date || null,
        description: formData.description || null,
        notes: formData.notes || null,
        status: "pending",
        paid_amount: 0
      };

      if (editingBalance) {
        const { error } = await supabase
          .from("client_opening_balance")
          .update(balanceData)
          .eq("id", editingBalance.id);

        if (error) throw error;
        toast.success("Saldo de abertura atualizado!");
      } else {
        const { error } = await supabase
          .from("client_opening_balance")
          .insert(balanceData);

        if (error) throw error;
        toast.success("Saldo de abertura cadastrado!");
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar saldo de abertura: " + errorMessage);
    }
  };

  const handleEdit = (balance: OpeningBalance) => {
    setEditingBalance(balance);
    setFormData({
      client_id: balance.client_id,
      competence: balance.competence,
      amount: balance.amount.toString(),
      due_date: balance.due_date || "",
      description: balance.description || "",
      notes: balance.notes || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este saldo de abertura?")) return;

    try {
      const { error } = await supabase
        .from("client_opening_balance")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Saldo de abertura excluído!");
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir saldo de abertura");
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      competence: "",
      amount: "",
      due_date: "",
      description: "",
      notes: ""
    });
    setEditingBalance(null);
  };

  const handleClientFilter = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId === "all") {
      loadBalances();
    } else {
      loadBalances(clientId);
    }
  };

  const getStatusBadge = (balance: OpeningBalance) => {
    if (balance.status === "paid") {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Pago
        </Badge>
      );
    }
    if (balance.status === "partial") {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
          <DollarSign className="h-3 w-3 mr-1" />
          Parcial
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getTotalByClient = () => {
    const totals = new Map<string, { name: string; total: number; pending: number }>();

    balances.forEach(balance => {
      const current = totals.get(balance.client_id) || { 
        name: balance.client_name || "", 
        total: 0, 
        pending: 0 
      };
      
      current.total += balance.amount;
      if (balance.status !== "paid") {
        current.pending += (balance.amount - balance.paid_amount);
      }
      
      totals.set(balance.client_id, current);
    });

    return Array.from(totals.entries()).map(([clientId, data]) => ({
      clientId,
      ...data
    })).sort((a, b) => b.pending - a.pending);
  };

  const totalPending = balances
    .filter(b => b.status !== "paid")
    .reduce((sum, b) => sum + (b.amount - b.paid_amount), 0);

  const totalPaid = balances
    .filter(b => b.status === "paid")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Saldo de Abertura</h1>
            <p className="text-muted-foreground">
              Gerencie honorários não pagos de 2024 (competências anteriores)
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Competência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingBalance ? "Editar Saldo de Abertura" : "Adicionar Saldo de Abertura"}
                </DialogTitle>
                <DialogDescription>
                  Registre as competências devidas de 2024 para cada cliente
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
                    <Label htmlFor="competence">Competência *</Label>
                    <Input
                      id="competence"
                      placeholder="MM/AAAA (ex: 01/2024)"
                      value={formData.competence}
                      onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                      maxLength={7}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: MM/AAAA (ex: 01/2024, 03/2024)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="due_date">Data de Vencimento</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      placeholder="Ex: Honorários de Janeiro/2024"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      placeholder="Observações adicionais..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingBalance ? "Atualizar" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(totalPending)}
              </div>
              <p className="text-xs text-muted-foreground">
                Competências não pagas de 2024
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground">
                Já recebido em 2025
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competências</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {balances.filter(b => b.status !== "paid").length}
              </div>
              <p className="text-xs text-muted-foreground">
                Competências em aberto
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Cliente</CardTitle>
            <CardDescription>
              Saldo devedor de cada cliente (competências de 2024)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getTotalByClient().length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum saldo de abertura cadastrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total Original</TableHead>
                    <TableHead className="text-right">Saldo Pendente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getTotalByClient().map((item) => (
                    <TableRow key={item.clientId}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.pending > 0 ? (
                          <span className="font-semibold text-orange-600">
                            {formatCurrency(item.pending)}
                          </span>
                        ) : (
                          <span className="text-green-600">
                            {formatCurrency(0)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Lista de Competências */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Competências Cadastradas</CardTitle>
                <CardDescription>
                  Histórico detalhado por competência
                </CardDescription>
              </div>
              <div className="w-64">
                <Select
                  value={selectedClientId || "all"}
                  onValueChange={handleClientFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : balances.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {selectedClientId && selectedClientId !== "all"
                  ? "Nenhuma competência cadastrada para este cliente"
                  : "Nenhuma competência cadastrada ainda"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.id}>
                      <TableCell className="font-medium">
                        {balance.client_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {balance.competence}
                        </div>
                      </TableCell>
                      <TableCell>
                        {balance.due_date
                          ? format(new Date(balance.due_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(balance.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {balance.paid_amount > 0 ? (
                          <span className="text-green-600">
                            {formatCurrency(balance.paid_amount)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(balance)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(balance.id)}
                            title="Excluir"
                            disabled={balance.status === "paid" || balance.paid_amount > 0}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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

export default ClientOpeningBalance;
