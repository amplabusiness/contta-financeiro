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

const Expenses = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    amount: "",
    due_date: "",
    payment_date: "",
    status: "pending",
    competence: "",
    notes: "",
    account_id: "",
  });

  const categories = [
    "Contas Fixas",
    "Impostos",
    "Folha de Pagamento",
    "Serviços Terceiros",
    "Material de Consumo",
    "Contas Variáveis",
    "Outros",
  ];

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
    loadExpenses();
    loadAccounts();
  }, [filterYear, filterMonth]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("type", "despesa")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar contas:", error);
    }
  };

  const loadExpenses = async () => {
    try {
      let query = supabase.from("expenses").select("*").order("due_date", { ascending: false });

      // Filtrar por competência se ano ou mês estiverem selecionados
      if (filterYear && filterMonth) {
        const competence = `${filterMonth}/${filterYear}`;
        query = query.eq("competence", competence);
      } else if (filterYear) {
        query = query.like("competence", `%/${filterYear}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar despesas");
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

      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date || null,
        account_id: formData.account_id || null,
        created_by: user.id,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update(expenseData)
          .eq("id", editingExpense.id);

        if (error) throw error;
        toast.success("Despesa atualizada com sucesso!");
      } else {
        // Inserir a despesa
        const { data: newExpense, error: expenseError } = await supabase
          .from("expenses")
          .insert(expenseData)
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Criar lançamento contábil automático (provisionamento)
        if (formData.account_id) {
          try {
            // Buscar a conta de despesa
            const { data: expenseAccount, error: accountError } = await supabase
              .from("chart_of_accounts")
              .select("code, name")
              .eq("id", formData.account_id)
              .single();

            if (accountError) throw accountError;

            // Mapear conta de despesa (4.x) para conta de passivo (2.x)
            const liabilityCode = expenseAccount.code.replace(/^4/, "2");
            
            // Buscar a conta de passivo correspondente
            const { data: liabilityAccount, error: liabilityError } = await supabase
              .from("chart_of_accounts")
              .select("id, name")
              .eq("code", liabilityCode)
              .eq("type", "passivo")
              .single();

            if (!liabilityError && liabilityAccount) {
              // Criar o cabeçalho do lançamento contábil
              const { data: entry, error: entryError } = await supabase
                .from("accounting_entries" as any)
                .insert({
                  entry_date: formData.due_date,
                  entry_type: "provisionamento",
                  description: `Provisionamento: ${formData.description}`,
                  reference_type: "expense",
                  reference_id: newExpense.id,
                  document_number: null,
                  notes: `Competência: ${formData.competence}`,
                  created_by: user.id,
                } as any)
                .select()
                .single();

              if (entryError) throw entryError;

              // Criar as linhas do lançamento (débito e crédito)
              const { error: linesError } = await supabase
                .from("accounting_entry_lines" as any)
                .insert([
                  {
                    entry_id: (entry as any)?.id,
                    account_id: formData.account_id,
                    description: `Despesa: ${formData.description}`,
                    debit: parseFloat(formData.amount),
                    credit: 0,
                  },
                  {
                    entry_id: (entry as any)?.id,
                    account_id: liabilityAccount.id,
                    description: `A pagar: ${formData.description}`,
                    debit: 0,
                    credit: parseFloat(formData.amount),
                  },
                ] as any);

              if (linesError) throw linesError;

              toast.success("Despesa cadastrada e provisionamento contábil criado!");
            } else {
              toast.success("Despesa cadastrada! (Conta de passivo não encontrada para provisionamento)");
            }
          } catch (provisionError: any) {
            console.error("Erro no provisionamento:", provisionError);
            toast.warning("Despesa cadastrada, mas erro ao criar provisionamento contábil");
          }
        } else {
          toast.success("Despesa cadastrada com sucesso!");
        }
      }

      setOpen(false);
      setEditingExpense(null);
      resetForm();
      loadExpenses();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar despesa");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (expense: any) => {
    try {
      const paymentDate = new Date().toISOString().split("T")[0];
      
      // Atualizar status da despesa
      const { error } = await supabase
        .from("expenses")
        .update({ status: "paid", payment_date: paymentDate })
        .eq("id", expense.id);

      if (error) throw error;

      // Criar lançamento contábil de pagamento automaticamente
      try {
        const { error: accountingError } = await supabase.functions.invoke('create-accounting-entry', {
          body: {
            type: 'expense',
            referenceId: expense.id,
            amount: parseFloat(expense.amount),
            date: paymentDate,
            description: expense.description || 'Despesa',
          },
        });

        if (accountingError) {
          console.error('Erro ao criar lançamento de pagamento:', accountingError);
          toast.warning("Despesa marcada como paga, mas erro ao criar lançamento de pagamento");
        } else {
          toast.success("Despesa marcada como paga e lançamento de pagamento criado!");
        }
      } catch (accountingError) {
        console.error('Erro ao criar lançamento de pagamento:', accountingError);
        toast.warning("Despesa marcada como paga, mas erro ao criar lançamento de pagamento");
      }

      loadExpenses();
    } catch (error: any) {
      toast.error("Erro ao atualizar despesa");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (error) throw error;
      toast.success("Despesa excluída com sucesso!");
      loadExpenses();
    } catch (error: any) {
      toast.error("Erro ao excluir despesa");
    }
  };

  const resetForm = () => {
    setFormData({
      category: "",
      description: "",
      amount: "",
      due_date: "",
      payment_date: "",
      status: "pending",
      competence: "",
      notes: "",
      account_id: "",
    });
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      due_date: expense.due_date,
      payment_date: expense.payment_date || "",
      status: expense.status,
      competence: expense.competence || "",
      notes: expense.notes || "",
      account_id: expense.account_id || "",
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

  const totalPending = expenses
    .filter((e) => e.status === "pending" || e.status === "overdue")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPaid = expenses
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Despesas</h1>
          <p className="text-muted-foreground">Controle de contas a pagar</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar despesas por período</CardDescription>
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
              {(filterYear || filterMonth) && (
                <div className="flex items-end">
                  <Button 
                    onClick={() => {
                      setFilterYear("");
                      setFilterMonth("");
                    }} 
                    variant="outline"
                  >
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div />
          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setEditingExpense(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                <DialogDescription>
                  Registre a despesa a pagar
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_id">Plano de Contas</Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
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
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              <CardTitle>A Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {formatCurrency(totalPending)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pago</CardTitle>
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
            <CardTitle>Lista de Despesas</CardTitle>
            <CardDescription>Total: {expenses.length} registros</CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma despesa cadastrada ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.category}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>{new Date(expense.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{formatCurrency(Number(expense.amount))}</TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                      <TableCell className="text-right">
                        {expense.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMarkAsPaid(expense)}
                            title="Marcar como pago"
                          >
                            <CheckCircle className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(expense)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
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

export default Expenses;
