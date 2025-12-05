import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Calculator, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { getErrorMessage } from "@/lib/utils";

const MINIMUM_WAGE = 1412.00; // Salário mínimo atual

interface RevenueType {
  id: string;
  name: string;
  calculation_type: string;
  value: number | null;
  multiplier: number | null;
  percentage: number | null;
  description: string | null;
  is_active: boolean;
}

const RevenueTypes = () => {
  const [types, setTypes] = useState<RevenueType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<RevenueType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    calculation_type: "fixed",
    value: "",
    multiplier: "",
    percentage: "",
    description: "",
  });

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("revenue_types")
        .select("*")
        .order("name");

      if (error) throw error;
      setTypes(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar tipos de receita");
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

      const typeData = {
        name: formData.name,
        calculation_type: formData.calculation_type,
        value: formData.value ? parseFloat(formData.value) : null,
        multiplier: formData.multiplier ? parseFloat(formData.multiplier) : null,
        percentage: formData.percentage ? parseFloat(formData.percentage) : null,
        description: formData.description || null,
        created_by: user.id,
      };

      if (editingType) {
        const { error } = await supabase
          .from("revenue_types")
          .update(typeData)
          .eq("id", editingType.id);

        if (error) throw error;
        toast.success("Tipo de receita atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("revenue_types").insert(typeData);

        if (error) throw error;
        toast.success("Tipo de receita cadastrado com sucesso!");
      }

      setOpen(false);
      setEditingType(null);
      resetForm();
      loadTypes();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar tipo de receita");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTypeId) return;

    try {
      const { error } = await supabase.from("revenue_types").delete().eq("id", selectedTypeId);

      if (error) throw error;
      toast.success("Tipo de receita excluído com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedTypeId(null);
      loadTypes();
    } catch (error: any) {
      toast.error("Erro ao excluir tipo de receita: " + error.message);
    }
  };

  const handleToggleStatus = async (type: RevenueType) => {
    const newStatus = !type.is_active;
    const action = newStatus ? "ativado" : "desativado";

    try {
      const { error } = await supabase
        .from("revenue_types")
        .update({ is_active: newStatus })
        .eq("id", type.id);

      if (error) throw new Error(getErrorMessage(error));
      toast.success(`Tipo de receita ${action} com sucesso!`);
      loadTypes();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + getErrorMessage(error));
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      calculation_type: "fixed",
      value: "",
      multiplier: "",
      percentage: "",
      description: "",
    });
  };

  const handleEdit = (type: RevenueType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      calculation_type: type.calculation_type,
      value: type.value?.toString() || "",
      multiplier: type.multiplier?.toString() || "",
      percentage: type.percentage?.toString() || "",
      description: type.description || "",
    });
    setOpen(true);
  };

  const getCalculationLabel = (type: RevenueType) => {
    switch (type.calculation_type) {
      case "fixed":
        return `Fixo: ${formatCurrency(type.value || 0)}`;
      case "minimum_wage": {
        const amount = MINIMUM_WAGE * (type.multiplier || 1);
        return `Salário Mínimo x ${type.multiplier} = ${formatCurrency(amount)}`;
      }
      case "percentage":
        return `${type.percentage}% sobre faturamento`;
      case "custom":
        return "Valor personalizado";
      default:
        return "N/A";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tipos de Receita</h1>
            <p className="text-muted-foreground">Gerencie os tipos de honorários e receitas</p>
          </div>
          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setEditingType(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Tipo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingType ? "Editar Tipo de Receita" : "Novo Tipo de Receita"}</DialogTitle>
                <DialogDescription>
                  Configure o tipo de receita e forma de cálculo
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calculation_type">Tipo de Cálculo *</Label>
                  <Select
                    value={formData.calculation_type}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      calculation_type: value,
                      value: "",
                      multiplier: "",
                      percentage: ""
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Valor Fixo</SelectItem>
                      <SelectItem value="minimum_wage">Baseado em Salário Mínimo</SelectItem>
                      <SelectItem value="percentage">Percentual sobre Faturamento</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.calculation_type === "fixed" && (
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor Fixo (R$) *</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      required
                    />
                  </div>
                )}

                {formData.calculation_type === "minimum_wage" && (
                  <div className="space-y-2">
                    <Label htmlFor="multiplier">Multiplicador *</Label>
                    <Input
                      id="multiplier"
                      type="number"
                      step="0.1"
                      placeholder="Ex: 1.5 para 1.5x o salário mínimo"
                      value={formData.multiplier}
                      onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                      required
                    />
                    {formData.multiplier && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        Valor calculado: {formatCurrency(MINIMUM_WAGE * parseFloat(formData.multiplier))}
                      </p>
                    )}
                  </div>
                )}

                {formData.calculation_type === "percentage" && (
                  <div className="space-y-2">
                    <Label htmlFor="percentage">Percentual (%) *</Label>
                    <Input
                      id="percentage"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 2.87 para 2.87%"
                      value={formData.percentage}
                      onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
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

        <Card>
          <CardHeader>
            <CardTitle>Tipos Cadastrados</CardTitle>
            <CardDescription>Total: {types.length} tipos</CardDescription>
          </CardHeader>
          <CardContent>
            {types.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum tipo de receita cadastrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo de Cálculo</TableHead>
                    <TableHead>Valor/Cálculo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>
                        {type.calculation_type === "fixed" && "Valor Fixo"}
                        {type.calculation_type === "minimum_wage" && "Salário Mínimo"}
                        {type.calculation_type === "percentage" && "Percentual"}
                        {type.calculation_type === "custom" && "Personalizado"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{getCalculationLabel(type)}</TableCell>
                      <TableCell>
                        <Badge variant={type.is_active ? "default" : "secondary"}>
                          {type.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(type)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(type)}
                            title={type.is_active ? "Desativar" : "Ativar"}
                          >
                            {type.is_active ? (
                              <Ban className="w-4 h-4 text-warning" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-success" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTypeId(type.id);
                              setDeleteDialogOpen(true);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este tipo de receita? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default RevenueTypes;
