import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, PauseCircle, PlayCircle, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface RecurringExpense {
  id: string;
  supplier_name: string;
  description: string;
  category: string;
  amount: number;
  recurrence_day: number;
  is_suspended: boolean;
  suspended_reason: string | null;
  cost_center: string | null;
  created_at: string;
}

export default function RecurringExpenses() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<RecurringExpense | null>(null);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  
  const [formData, setFormData] = useState({
    supplier_name: "",
    description: "",
    category: "",
    cost_center: "",
    amount: 0,
    recurrence_day: 10,
  });

  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .eq("is_recurring", true)
        .order("supplier_name");

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar despesas recorrentes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const expenseData = {
        ...formData,
        due_date: new Date().toISOString().split('T')[0],
        status: "pending",
        is_recurring: true,
        recurrence_frequency: "monthly",
        created_by: userData.user.id,
      };

      if (selectedExpense) {
        const { error } = await supabase
          .from("accounts_payable")
          .update(expenseData)
          .eq("id", selectedExpense.id);

        if (error) throw error;
        toast({ title: "Despesa atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("accounts_payable")
          .insert([expenseData]);

        if (error) throw error;
        toast({ title: "Despesa recorrente cadastrada!" });
      }

      setDialogOpen(false);
      resetForm();
      loadExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao salvar despesa",
        variant: "destructive",
      });
    }
  };

  const handleSuspend = async (expense: RecurringExpense) => {
    setSelectedExpense(expense);
    setSuspendReason("");
    setSuspendDialogOpen(true);
  };

  const confirmSuspend = async () => {
    if (!selectedExpense) return;

    try {
      const { error } = await supabase
        .from("accounts_payable")
        .update({
          is_suspended: !selectedExpense.is_suspended,
          suspended_reason: !selectedExpense.is_suspended ? suspendReason : null,
          suspended_at: !selectedExpense.is_suspended ? new Date().toISOString() : null,
        })
        .eq("id", selectedExpense.id);

      if (error) throw error;

      toast({
        title: selectedExpense.is_suspended ? "Despesa reativada!" : "Despesa suspensa!",
      });

      setSuspendDialogOpen(false);
      loadExpenses();
    } catch (error) {
      console.error("Error toggling suspension:", error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status da despesa",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa recorrente?")) return;

    try {
      const { error } = await supabase
        .from("accounts_payable")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Despesa excluída com sucesso!" });
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir despesa",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (expense: RecurringExpense) => {
    setSelectedExpense(expense);
    setFormData({
      supplier_name: expense.supplier_name,
      description: expense.description,
      category: expense.category,
      cost_center: expense.cost_center || "",
      amount: expense.amount,
      recurrence_day: expense.recurrence_day,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedExpense(null);
    setFormData({
      supplier_name: "",
      description: "",
      category: "",
      cost_center: "",
      amount: 0,
      recurrence_day: 10,
    });
  };

  const generateNextMonth = async () => {
    if (!confirm("Gerar despesas do próximo mês para todas as despesas recorrentes ativas?")) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_recurring_expenses");

      if (error) throw error;

      toast({
        title: "Despesas Geradas!",
        description: `${data[0]?.generated_count || 0} despesas foram criadas para o próximo mês`,
      });
    } catch (error) {
      console.error("Error generating expenses:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar despesas do próximo mês",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const categories = [
    "Contas Fixas",
    "Impostos",
    "Contas Variáveis",
    "Serviço Terceiros",
    "Folha Pagamento",
    "Material de Consumo",
    "Pessoal",
  ];

  const clearAllRecurringExpenses = async () => {
    if (expenses.length === 0) {
      toast({
        title: "Nada para remover",
        description: "Nenhuma despesa recorrente cadastrada.",
      });
      return;
    }

    if (!confirm("Tem certeza que deseja remover todas as despesas recorrentes cadastradas?")) {
      return;
    }

    setClearing(true);
    try {
      const { error } = await supabase
        .from("accounts_payable")
        .delete()
        .eq("is_recurring", true);

      if (error) throw error;

      toast({
        title: "Despesas removidas",
        description: "Todas as despesas recorrentes foram excluídas.",
      });
      loadExpenses();
    } catch (error) {
      console.error("Error clearing recurring expenses:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover as despesas recorrentes.",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Despesas Recorrentes</h1>
            <p className="text-muted-foreground">
              Gerencie suas despesas mensais recorrentes
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={clearAllRecurringExpenses}
              disabled={clearing || generating || loading}
            >
              <Trash2 className={`h-4 w-4 mr-2 ${clearing ? "animate-spin" : ""}`} />
              {clearing ? "Removendo..." : "Apagar Todas"}
            </Button>
            <Button onClick={generateNextMonth} disabled={generating} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              Gerar Próximo Mês
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Despesa Recorrente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedExpense ? "Editar Despesa Recorrente" : "Nova Despesa Recorrente"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplier_name">Fornecedor *</Label>
                      <Input
                        id="supplier_name"
                        value={formData.supplier_name}
                        onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Categoria *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
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
                  </div>

                  <div>
                    <Label htmlFor="description">Descrição *</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="amount">Valor (R$) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="recurrence_day">Dia de Vencimento *</Label>
                      <Input
                        id="recurrence_day"
                        type="number"
                        min="1"
                        max="31"
                        value={formData.recurrence_day}
                        onChange={(e) => setFormData({ ...formData, recurrence_day: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cost_center">Centro de Custo</Label>
                      <Input
                        id="cost_center"
                        value={formData.cost_center}
                        onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {selectedExpense ? "Atualizar" : "Cadastrar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="p-6">
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma despesa recorrente cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Dia Venc.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className={expense.is_suspended ? "opacity-60" : ""}>
                    <TableCell>
                      {expense.is_suspended ? (
                        <Badge variant="secondary">Suspenso</Badge>
                      ) : (
                        <Badge variant="default">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{expense.supplier_name}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{expense.cost_center || "-"}</TableCell>
                    <TableCell className="text-right">
                      R$ {expense.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">{expense.recurrence_day}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSuspend(expense)}
                          title={expense.is_suspended ? "Reativar" : "Suspender"}
                        >
                          {expense.is_suspended ? (
                            <PlayCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <PauseCircle className="h-4 w-4 text-yellow-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(expense)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(expense.id)}
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
        </Card>

        <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedExpense?.is_suspended ? "Reativar Despesa" : "Suspender Despesa"}
              </DialogTitle>
            </DialogHeader>
            {!selectedExpense?.is_suspended && (
              <div className="space-y-4">
                <Label htmlFor="suspend_reason">Motivo da Suspensão</Label>
                <Textarea
                  id="suspend_reason"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Informe o motivo da suspensão..."
                  rows={3}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmSuspend}>
                Confirmar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}