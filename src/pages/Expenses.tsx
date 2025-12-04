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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { useClient } from "@/contexts/ClientContext";
import { useAccounting } from "@/hooks/useAccounting";
import { useExpenseUpdate } from "@/contexts/ExpenseUpdateContext";
import { getErrorMessage } from "@/lib/utils";

const Expenses = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const { selectedClientId, selectedClientName } = useClient();
  const { registrarDespesa, registrarPagamentoDespesa } = useAccounting({ showToasts: false });
  const { notifyExpenseChange } = useExpenseUpdate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: "",
    description: "",
  });
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
    cost_center_id: "",
    is_recurring: false,
    recurrence_day: 10,
  });

  useEffect(() => {
    loadExpenses();
    loadAccounts();
    loadCategories();
    loadCostCenters();
  }, [selectedYear, selectedMonth, selectedClientId]);

  const normalizeAccountType = (value?: string | null) => value?.trim().toLowerCase() ?? "";

  const loadAccounts = async () => {
    try {
      const response = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, type, is_active")
        .eq("is_active", true)
        .or("account_type.ilike.DESPESA,type.ilike.despesa")
        .order("code");

      if (response.error) {
        console.error("Erro ao carregar contas");
        throw new Error("Erro ao carregar contas");
      }

      const filteredAccounts = (response.data || []).filter((account) =>
        normalizeAccountType(account.account_type).includes("despesa") ||
        normalizeAccountType(account.type) === "despesa"
      );

      setAccounts(filteredAccounts);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar contas";
      console.error("Erro ao carregar contas:", errorMsg);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await supabase
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (response.error) {
        console.error("Erro ao carregar categorias");
        throw new Error("Erro ao carregar categorias");
      }

      // Deduplicate by name to prevent render key issues
      const uniqueCategories = Array.from(
        new Map((response.data || []).map(cat => [cat.name, cat])).values()
      );

      setCategories(uniqueCategories);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar categorias";
      console.error("Erro ao carregar categorias:", errorMsg);
    }
  };

  const loadCostCenters = async () => {
    try {
      const response = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");

      if (response.error) {
        console.error("Erro ao carregar centros de custo");
        throw new Error("Erro ao carregar centros de custo");
      }

      setCostCenters(response.data || []);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar centros de custo";
      console.error("Erro ao carregar centros de custo:", errorMsg);
      toast.error(errorMsg);
    }
  };

  const loadExpenses = async () => {
    try {
      let query = supabase.from("expenses").select("*").order("due_date", { ascending: false });

      if (selectedClientId) {
        query = query.eq("client_id", selectedClientId);
      }

      const response = await query;

      if (response.error) {
        console.error("Erro ao carregar despesas");
        throw new Error("Erro ao carregar despesas");
      }

      const data = response.data;

      let filteredData = data || [];

      if (selectedYear && selectedMonth) {
        filteredData = filteredData.filter((expense) => {
          const dueDate = new Date(expense.due_date);
          return (
            dueDate.getFullYear() === selectedYear &&
            dueDate.getMonth() + 1 === selectedMonth
          );
        });
      } else if (selectedYear) {
        filteredData = filteredData.filter((expense) => {
          const dueDate = new Date(expense.due_date);
          return dueDate.getFullYear() === selectedYear;
        });
      }

      setExpenses(filteredData);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar despesas";
      toast.error("Erro ao carregar despesas: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const generateRecurringExpense = async (expense: any) => {
    try {
      const dueDate = new Date(expense.due_date);
      const nextMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, expense.recurrence_day);
      const nextCompetence = `${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;

      // Only send fields that exist in the database schema
      const newExpenseData = {
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        due_date: nextMonth.toISOString().split('T')[0],
        payment_date: null,
        status: "pending",
        competence: nextCompetence,
        notes: expense.notes,
        account_id: expense.account_id,
        cost_center_id: expense.cost_center_id,
        created_by: expense.created_by,
      };

      const { error } = await supabase
        .from("expenses")
        .insert(newExpenseData);

      if (error) throw new Error(getErrorMessage(error));

      toast.success("Despesa recorrente do próximo mês gerada!");
      loadExpenses();
    } catch (error: any) {
      toast.error("Erro ao gerar despesa recorrente");
      console.error("Erro:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (!formData.due_date) {
        throw new Error("Data de vencimento é obrigatória");
      }

      if (!formData.cost_center_id) {
        throw new Error("Centro de custo é obrigatório");
      }

      const accountId = formData.account_id;

    if (!accountId) {
        throw new Error("Conta contábil é obrigatória ou não pôde ser mapeada automaticamente");
      }

      const [year, month, day] = formData.due_date.split('-');
      const calculatedCompetence = `${month}/${year}`;

      console.log("Salvando com due_date:", formData.due_date, "competence:", calculatedCompetence);

      // Only send fields that exist in the database schema
      const expenseData = {
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        payment_date: formData.payment_date || null,
        status: formData.status,
        competence: calculatedCompetence,
        notes: formData.notes || null,
        account_id: accountId,
        cost_center_id: formData.cost_center_id,
      };

      if (editingExpense) {
        try {
          const response = await supabase
            .from("expenses")
            .update(expenseData)
            .eq("id", editingExpense.id);

          if (response.error) {
            console.error("Erro ao atualizar despesa:", response.error);
            throw new Error("Falha ao atualizar despesa no banco de dados");
          }

          console.log("Despesa atualizada com sucesso");
          toast.success("Despesa atualizada com sucesso!");
          notifyExpenseChange();
        } catch (updateError: any) {
          // Only extract message from actual Error instances
          let errorMsg = "Erro ao atualizar despesa";

          if (updateError instanceof Error) {
            errorMsg = updateError.message;
          } else if (typeof updateError === "string") {
            errorMsg = updateError;
          }

          console.error("Erro na atualização:", errorMsg);
          throw new Error(errorMsg);
        }
      } else {
        const updateData = {
          ...expenseData,
          created_by: user.id,
        };

        let newExpense: any = null;
        try {
          const { data, error } = await supabase
            .from("expenses")
            .insert(updateData)
            .select("id")
            .single();

          if (error) {
            console.error("Erro ao criar despesa:", error);
            throw new Error("Falha ao criar despesa no banco de dados");
          }

          newExpense = data;
        } catch (insertError: any) {
          let errorMsg = "Erro ao criar despesa";

          if (insertError instanceof Error) {
            errorMsg = insertError.message;
          } else if (typeof insertError === "string") {
            errorMsg = insertError;
          }

          console.error("Erro ao inserir despesa:", errorMsg);
          throw new Error(errorMsg);
        }

        const accountingResult = await registrarDespesa({
          expenseId: newExpense.id,
          amount: parseFloat(formData.amount),
          expenseDate: formData.due_date,
          category: formData.category,
          description: formData.description || 'Despesa',
          competence: calculatedCompetence,
        });

        if (accountingResult.success) {
          toast.success("Despesa cadastrada com lançamento contábil!");
          notifyExpenseChange();
        } else {
          console.error('Erro ao criar lançamento contábil:', accountingResult.error);
          toast.warning("Despesa cadastrada, mas erro no lançamento contábil");
        }
      }

      setOpen(false);
      setEditingExpense(null);
      resetForm();
      loadExpenses();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao salvar despesa";
      console.error("Erro capturado no handleSubmit:", errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (expense: any) => {
    try {
      const paymentDate = new Date().toISOString().split("T")[0];

      const response = await supabase
        .from("expenses")
        .update({ status: "paid", payment_date: paymentDate })
        .eq("id", expense.id);

      if (response.error) {
        console.error("Erro ao marcar como pago");
        throw new Error("Erro ao marcar despesa como paga");
      }

      const accountingResult = await registrarPagamentoDespesa({
        paymentId: `${expense.id}_payment`,
        expenseId: expense.id,
        amount: Number(expense.amount),
        paymentDate: paymentDate,
        description: expense.description || 'Despesa',
      });

      if (accountingResult.success) {
        toast.success("Despesa paga com lançamento contábil!");
        notifyExpenseChange();
      } else {
        console.error('Erro ao criar lançamento de pagamento:', accountingResult.error);
        toast.warning("Despesa paga, mas erro no lançamento contábil");
      }

      loadExpenses();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao marcar despesa como paga";
      console.error("Erro capturado no mark as paid:", errorMsg);
      toast.error("Erro ao marcar despesa como paga: " + errorMsg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;

    try {
      const response = await supabase.from("expenses").delete().eq("id", id);

      if (response.error) {
        console.error("Erro ao excluir despesa");
        throw new Error("Erro ao excluir despesa");
      }
      toast.success("Despesa excluída com sucesso!");
      notifyExpenseChange();
      loadExpenses();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao excluir despesa";
      console.error("Erro capturado na exclusão:", errorMsg);
      toast.error("Erro ao excluir despesa: " + errorMsg);
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
      cost_center_id: "",
      is_recurring: false,
      recurrence_day: 10,
    });
  };

  const handleCreateNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCategoryData.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    try {
      setLoading(true);
      const response = await supabase
        .from("expense_categories")
        .insert({
          code: `CAT_${Date.now()}`,
          name: newCategoryData.name,
          description: newCategoryData.description || null,
          is_active: true,
          display_order: (categories.length) + 1,
        })
        .select()
        .single();

      if (response.error) {
        console.error("Erro ao criar categoria");
        throw new Error("Erro ao criar categoria");
      }

      toast.success("Categoria criada com sucesso!");

      setFormData({ ...formData, category: response.data.name });
      setNewCategoryData({ name: "", description: "" });
      setNewCategoryDialogOpen(false);

      await loadCategories();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao criar categoria";
      console.error("Erro ao criar categoria:", errorMsg);
      toast.error("Erro ao criar categoria: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    const formatDateForInput = (dateStr: string) => {
      if (!dateStr) return "";
      // Handle ISO strings and date-only strings correctly
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    };

    console.log("Editando despesa - due_date original:", expense.due_date);
    const formattedDate = formatDateForInput(expense.due_date);
    console.log("Editando despesa - due_date formatado:", formattedDate);

    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      due_date: formattedDate,
      payment_date: formatDateForInput(expense.payment_date),
      status: expense.status,
      competence: expense.competence || "",
      notes: expense.notes || "",
      account_id: expense.account_id || "",
      cost_center_id: expense.cost_center_id || "",
      is_recurring: expense.is_recurring || false,
      recurrence_day: expense.recurrence_day || 10,
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

  const getCategoryName = (expenseCategory: string) => {
    // If the category is empty or null, return default text
    if (!expenseCategory) return "Sem categoria";

    // Check if the stored category matches any of the loaded categories by name
    const matchedCategory = categories.find(
      cat => cat.name.toLowerCase() === expenseCategory.toLowerCase()
    );

    // Return the matched category name, or return the stored value as-is if no match
    // This ensures we display what's actually stored in the database
    return matchedCategory ? matchedCategory.name : expenseCategory;
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
          <h1 className="text-3xl font-bold">
            {selectedClientId ? `Despesas - ${selectedClientName}` : "Despesas"}
          </h1>
          <p className="text-muted-foreground">
            {selectedClientId
              ? "Despesas do cliente selecionado"
              : "Controle de contas a pagar - selecione um cliente para filtrar"
            }
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar despesas por período</CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="category">Categoria *</Label>
                      <Dialog open={newCategoryDialogOpen} onOpenChange={setNewCategoryDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-blue-600"
                          >
                            + Nova Categoria
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[400px]">
                          <DialogHeader>
                            <DialogTitle>Criar Nova Categoria</DialogTitle>
                            <DialogDescription>
                              Crie uma nova categoria de despesas
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleCreateNewCategory} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="new_category_name">Nome da Categoria *</Label>
                              <Input
                                id="new_category_name"
                                placeholder="ex: Aluguel, Serviços, etc"
                                value={newCategoryData.name}
                                onChange={(e) =>
                                  setNewCategoryData({ ...newCategoryData, name: e.target.value })
                                }
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new_category_description">Descrição</Label>
                              <Textarea
                                id="new_category_description"
                                placeholder="Descrição da categoria (opcional)"
                                value={newCategoryData.description}
                                onChange={(e) =>
                                  setNewCategoryData({ ...newCategoryData, description: e.target.value })
                                }
                                rows={2}
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setNewCategoryDialogOpen(false)}
                              >
                                Cancelar
                              </Button>
                              <Button type="submit" disabled={loading}>
                                {loading ? "Criando..." : "Criar"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
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
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_center_id">Centro de Custo *</Label>
                    <Select
                      value={formData.cost_center_id}
                      onValueChange={(value) => setFormData({ ...formData, cost_center_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um centro de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCenters.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            {center.code} - {center.name}
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
                  <div className="col-span-2 space-y-3 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_recurring"
                        checked={formData.is_recurring}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, is_recurring: checked as boolean })
                        }
                      />
                      <Label htmlFor="is_recurring" className="font-medium cursor-pointer">
                        É uma despesa recorrente?
                      </Label>
                    </div>
                    {formData.is_recurring && (
                      <div className="space-y-2 ml-6">
                        <Label htmlFor="recurrence_day">
                          Dia do mês para recorrência (1-31) *
                        </Label>
                        <Select
                          value={formData.recurrence_day.toString()}
                          onValueChange={(value) => setFormData({ ...formData, recurrence_day: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <SelectItem key={day} value={day.toString()}>
                                Dia {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          A despesa será duplicada automaticamente neste dia a cada mês
                        </p>
                      </div>
                    )}
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
                    <TableHead className="text-center">Recorrente</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const categoryName = getCategoryName(expense.category);
                    return (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{categoryName}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>{new Date(expense.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{formatCurrency(Number(expense.amount))}</TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                      <TableCell className="text-center">
                        {expense.is_recurring && (
                          <Badge variant="outline" className="bg-blue-50">
                            Mês {expense.recurrence_day}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {expense.is_recurring && expense.status !== "canceled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generateRecurringExpense(expense)}
                            title="Gerar próxima recorrência"
                          >
                            <RefreshCw className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
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
                    );
                  })}
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
