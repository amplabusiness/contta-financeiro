import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, Pencil, Trash2, TrendingUp, TrendingDown, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

interface CashFlowProjection {
  id: string;
  description: string;
  amount: number;
  projection_date: string;
  projection_type: 'RECEITA' | 'DESPESA_FOLHA' | 'DESPESA_PJ' | 'DESPESA_IMPOSTO' | 'DESPESA_OUTROS' | 'DESPESA_RECORRENTE';
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_end_date: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CashFlowProjections = () => {
  const [loading, setLoading] = useState(true);
  const [projections, setProjections] = useState<CashFlowProjection[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProjection, setEditingProjection] = useState<CashFlowProjection | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectionToDelete, setProjectionToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    projection_date: format(new Date(), "yyyy-MM-dd"),
    projection_type: "DESPESA_RECORRENTE" as CashFlowProjection['projection_type'],
    frequency: "once" as CashFlowProjection['frequency'],
    recurrence_end_date: "",
    category: "",
    notes: "",
    is_active: true,
  });

  useEffect(() => {
    loadProjections();
  }, []);

  const loadProjections = async () => {
    try {
      setLoading(true);
      console.log('[CashFlowProjections] Loading projections...');
      const { data, error } = await supabase
        .from("cash_flow_projections")
        .select("*")
        .order("projection_date", { ascending: true });

      if (error) throw error;
      console.log('[CashFlowProjections] Loaded projections:', {
        total: data?.length || 0,
        active: data?.filter(p => p.is_active).length || 0,
        inactive: data?.filter(p => !p.is_active).length || 0,
        byType: data?.reduce((acc, p) => {
          acc[p.projection_type] = (acc[p.projection_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      setProjections(data || []);
    } catch (error: any) {
      console.error("[CashFlowProjections] Erro ao carregar projeções:", error);
      toast.error("Erro ao carregar projeções");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        recurrence_end_date: formData.recurrence_end_date || null,
        category: formData.category || null,
        notes: formData.notes || null,
        created_by: user.user.id,
      };

      if (editingProjection) {
        // Update existing projection
        const { error } = await supabase
          .from("cash_flow_projections")
          .update(payload)
          .eq("id", editingProjection.id);

        if (error) throw error;
        toast.success("Projeção atualizada com sucesso!");
      } else {
        // Create new projection
        const { error } = await supabase
          .from("cash_flow_projections")
          .insert([payload]);

        if (error) throw error;
        toast.success("Projeção criada com sucesso!");
      }

      setOpen(false);
      resetForm();
      loadProjections();
    } catch (error: any) {
      console.error("Erro ao salvar projeção:", error);
      toast.error(error.message || "Erro ao salvar projeção");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (projection: CashFlowProjection) => {
    setEditingProjection(projection);
    setFormData({
      description: projection.description,
      amount: projection.amount.toString(),
      projection_date: projection.projection_date,
      projection_type: projection.projection_type,
      frequency: projection.frequency || "once",
      recurrence_end_date: projection.recurrence_end_date || "",
      category: projection.category || "",
      notes: projection.notes || "",
      is_active: projection.is_active,
    });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!projectionToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("cash_flow_projections")
        .delete()
        .eq("id", projectionToDelete);

      if (error) throw error;

      toast.success("Projeção excluída com sucesso!");
      setDeleteDialogOpen(false);
      setProjectionToDelete(null);
      loadProjections();
    } catch (error: any) {
      console.error("Erro ao excluir projeção:", error);
      toast.error("Erro ao excluir projeção");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("cash_flow_projections")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Projeção ${!currentStatus ? 'ativada' : 'desativada'} com sucesso!`);
      loadProjections();
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      projection_date: format(new Date(), "yyyy-MM-dd"),
      projection_type: "DESPESA_RECORRENTE",
      frequency: "once",
      recurrence_end_date: "",
      category: "",
      notes: "",
      is_active: true,
    });
    setEditingProjection(null);
  };

  const getProjectionTypeInfo = (type: CashFlowProjection['projection_type']) => {
    const typeMap = {
      RECEITA: { label: "Receita", icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-50" },
      DESPESA_FOLHA: { label: "Folha", icon: TrendingDown, color: "text-red-600", bgColor: "bg-red-50" },
      DESPESA_PJ: { label: "Prestador PJ", icon: TrendingDown, color: "text-orange-600", bgColor: "bg-orange-50" },
      DESPESA_IMPOSTO: { label: "Imposto", icon: TrendingDown, color: "text-purple-600", bgColor: "bg-purple-50" },
      DESPESA_OUTROS: { label: "Outras Despesas", icon: TrendingDown, color: "text-gray-600", bgColor: "bg-gray-50" },
      DESPESA_RECORRENTE: { label: "Recorrente", icon: Clock, color: "text-blue-600", bgColor: "bg-blue-50" },
    };
    return typeMap[type];
  };

  const getFrequencyLabel = (frequency: CashFlowProjection['frequency']) => {
    const frequencyMap = {
      once: "Única vez",
      daily: "Diária",
      weekly: "Semanal",
      monthly: "Mensal",
      yearly: "Anual",
    };
    return frequency ? frequencyMap[frequency] : "Única vez";
  };

  const getTotalReceivables = () => {
    return projections
      .filter(p => p.projection_type === 'RECEITA' && p.is_active)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const getTotalPayables = () => {
    return projections
      .filter(p => p.projection_type !== 'RECEITA' && p.is_active)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  if (loading && projections.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 px-2 sm:px-4 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 sm:pt-6 px-2 sm:px-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight pb-1 sm:pb-2">
              Projeções de Fluxo de Caixa
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gerencie projeções personalizadas de receitas e despesas
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
            <Button
              variant="outline"
              onClick={loadProjections}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button onClick={() => { resetForm(); setOpen(true); }} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Projeção</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Projeções de Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(getTotalReceivables())}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {projections.filter(p => p.projection_type === 'RECEITA' && p.is_active).length} projeção(ões)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Projeções de Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(getTotalPayables())}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {projections.filter(p => p.projection_type !== 'RECEITA' && p.is_active).length} projeção(ões)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Saldo Projetado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getTotalReceivables() - getTotalPayables() >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(getTotalReceivables() - getTotalPayables())}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {projections.filter(p => p.is_active).length} total ativas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertTitle>Como funcionam as projeções?</AlertTitle>
          <AlertDescription>
            As projeções são integradas automaticamente ao fluxo de caixa. Você pode criar projeções únicas ou recorrentes (diária, semanal, mensal ou anual).
            Todas as projeções ativas aparecem no widget de Projeção do Dashboard e na página de Fluxo de Caixa.
          </AlertDescription>
        </Alert>

        {/* Projections Table */}
        <Card>
          <CardHeader>
            <CardTitle>Projeções Cadastradas</CardTitle>
            <CardDescription>
              Todas as projeções personalizadas de fluxo de caixa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projections.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma projeção cadastrada</p>
                <Button variant="outline" onClick={() => setOpen(true)} className="mt-4">
                  Criar Primeira Projeção
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projections.map((projection) => {
                      const typeInfo = getProjectionTypeInfo(projection.projection_type);
                      const Icon = typeInfo.icon;

                      return (
                        <TableRow key={projection.id} className={!projection.is_active ? 'opacity-50' : ''}>
                          <TableCell>
                            <Switch
                              checked={projection.is_active}
                              onCheckedChange={() => toggleActive(projection.id, projection.is_active)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={typeInfo.color}>
                              <Icon className="h-3 w-3 mr-1" />
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium max-w-xs truncate">
                            {projection.description}
                          </TableCell>
                          <TableCell>
                            {projection.category ? (
                              <Badge variant="secondary">{projection.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${projection.projection_type === 'RECEITA' ? 'text-green-600' : 'text-destructive'}`}>
                            {projection.projection_type === 'RECEITA' ? '+' : '-'}
                            {formatCurrency(projection.amount)}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(projection.projection_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getFrequencyLabel(projection.frequency)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(projection)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setProjectionToDelete(projection.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProjection ? "Editar Projeção" : "Nova Projeção"}
              </DialogTitle>
              <DialogDescription>
                {editingProjection
                  ? "Atualize os dados da projeção de fluxo de caixa"
                  : "Cadastre uma nova projeção de receita ou despesa"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="Ex: Aluguel do escritório"
                  />
                </div>

                <div>
                  <Label htmlFor="projection_type">Tipo *</Label>
                  <Select
                    value={formData.projection_type}
                    onValueChange={(value: any) => setFormData({ ...formData, projection_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RECEITA">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                          Receita
                        </div>
                      </SelectItem>
                      <SelectItem value="DESPESA_RECORRENTE">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          Despesa Recorrente
                        </div>
                      </SelectItem>
                      <SelectItem value="DESPESA_FOLHA">
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                          Folha de Pagamento
                        </div>
                      </SelectItem>
                      <SelectItem value="DESPESA_PJ">
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="h-4 w-4 text-orange-500" />
                          Prestador PJ
                        </div>
                      </SelectItem>
                      <SelectItem value="DESPESA_IMPOSTO">
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="h-4 w-4 text-purple-500" />
                          Imposto
                        </div>
                      </SelectItem>
                      <SelectItem value="DESPESA_OUTROS">
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="h-4 w-4 text-gray-500" />
                          Outras Despesas
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount">Valor *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <Label htmlFor="projection_date">Data da Projeção *</Label>
                  <Input
                    id="projection_date"
                    type="date"
                    value={formData.projection_date}
                    onChange={(e) => setFormData({ ...formData, projection_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="frequency">Frequência *</Label>
                  <Select
                    value={formData.frequency || "once"}
                    onValueChange={(value: any) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Única vez</SelectItem>
                      <SelectItem value="daily">Diária</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.frequency && formData.frequency !== 'once' && (
                  <div>
                    <Label htmlFor="recurrence_end_date">Data Final (Recorrência)</Label>
                    <Input
                      id="recurrence_end_date"
                      type="date"
                      value={formData.recurrence_end_date}
                      onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                      placeholder="Deixe vazio para sem limite"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: Fixos, Variáveis"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Adicione observações sobre esta projeção..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Projeção Ativa</Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingProjection ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta projeção? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setProjectionToDelete(null); }}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CashFlowProjections;
