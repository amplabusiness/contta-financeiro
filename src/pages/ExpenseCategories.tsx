import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number | null;
  created_at: string;
}

const ExpenseCategories = () => {
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"expense" | "revenue">("expense");
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    color: "",
    icon: "",
  });

  const loadCategories = async () => {
    try {
      setLoading(true);
      const [expenseResponse, revenueResponse] = await Promise.all([
        supabase
          .from("expense_categories")
          .select("*")
          .order("display_order", { ascending: true }),
        supabase
          .from("revenue_categories")
          .select("*")
          .order("display_order", { ascending: true })
      ]);

      if (expenseResponse.error) {
        console.error("Erro ao carregar categorias de despesas");
        throw new Error("Erro ao carregar categorias de despesas");
      }

      if (revenueResponse.error) {
        console.error("Erro ao carregar categorias de receitas");
        throw new Error("Erro ao carregar categorias de receitas");
      }

      // Deduplicate by name to prevent render key issues
      const uniqueExpenseCategories = Array.from(
        new Map((expenseResponse.data || []).map(cat => [cat.name, cat])).values()
      );

      const uniqueRevenueCategories = Array.from(
        new Map((revenueResponse.data || []).map(cat => [cat.name, cat])).values()
      );

      setExpenseCategories(uniqueExpenseCategories);
      setRevenueCategories(uniqueRevenueCategories);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar categorias";
      console.error("Erro ao carregar categorias:", errorMsg);
      toast.error("Erro ao carregar categorias: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.name.trim()) {
        toast.error("Nome da categoria é obrigatório");
        return;
      }

      const table = activeTab === "expense" ? "expense_categories" : "revenue_categories";
      const currentCategories = activeTab === "expense" ? expenseCategories : revenueCategories;

      if (editingCategory) {
        const response = await supabase
          .from(table)
          .update({
            code: formData.code || editingCategory.code,
            name: formData.name,
            description: formData.description || null,
            color: formData.color?.trim() || null,
            icon: formData.icon || null,
          })
          .eq("id", editingCategory.id);

        if (response.error) {
          console.error("Erro ao atualizar categoria");
          throw new Error("Erro ao atualizar categoria");
        }
        toast.success("Categoria atualizada com sucesso!");
      } else {
        const response = await supabase
          .from(table)
          .insert({
            code: formData.code || `CAT_${Date.now()}`,
            name: formData.name,
            description: formData.description || null,
            color: formData.color?.trim() || null,
            icon: formData.icon || null,
            is_active: true,
            display_order: currentCategories.length + 1,
          });

        if (response.error) {
          console.error("Erro ao criar categoria");
          throw new Error("Erro ao criar categoria");
        }
        toast.success("Categoria criada com sucesso!");
      }

      setOpen(false);
      setEditingCategory(null);
      resetForm();
      loadCategories();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao salvar categoria";
      console.error("Erro ao salvar categoria:", errorMsg);
      toast.error("Erro ao salvar categoria: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (category: Category) => {
    try {
      const table = activeTab === "expense" ? "expense_categories" : "revenue_categories";
      const tableName = activeTab === "expense" ? "expenses" : "invoices";
      const fieldName = activeTab === "expense" ? "category" : "category";

      // Check if there are any items linked to this category
      const checkResponse = await supabase
        .from(tableName)
        .select("id")
        .eq(fieldName, category.name)
        .limit(1);

      if (checkResponse.error) {
        console.error(`Erro ao verificar ${tableName}`);
        throw new Error(`Não é possível excluir. Verifique se há itens associados.`);
      }

      if (checkResponse.data && checkResponse.data.length > 0) {
        const itemType = activeTab === "expense" ? "despesas" : "receitas";
        toast.error(
          `Não é possível excluir a categoria "${category.name}" porque existem ${itemType} vinculadas a ela. Delete os itens primeiro.`
        );
        return;
      }

      const deleteResponse = await supabase
        .from(table)
        .delete()
        .eq("id", category.id);

      if (deleteResponse.error) {
        console.error("Erro ao excluir categoria");
        throw new Error("Erro ao excluir categoria");
      }
      toast.success("Categoria excluída com sucesso!");
      setDeleteDialogOpen(false);
      setDeletingCategory(null);
      loadCategories();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao excluir categoria";
      console.error("Erro capturado na exclusão:", errorMsg);
      toast.error("Erro ao excluir categoria: " + errorMsg);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      color: "",
      icon: "",
    });
    setEditingCategory(null);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      code: category.code,
      name: category.name,
      description: category.description || "",
      color: category.color || "",
      icon: category.icon || "",
    });
    setOpen(true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  if (loading && expenseCategories.length === 0 && revenueCategories.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando categorias...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const currentCategories = activeTab === "expense" ? expenseCategories : revenueCategories;
  const tabTitle = activeTab === "expense" ? "Categorias de Despesas" : "Categorias de Receitas";

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Categorias</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie as categorias de despesas e receitas do seu sistema
            </p>
          </div>
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button
                className="gap-2"
                onClick={() => resetForm()}
              >
                <Plus className="h-4 w-4" />
                {activeTab === "expense" ? "Nova Categoria de Despesa" : "Nova Categoria de Receita"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? "Editar Categoria" : `Nova ${activeTab === "expense" ? "Categoria de Despesa" : "Categoria de Receita"}`}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory
                    ? `Atualize os dados da categoria`
                    : `Crie uma nova categoria de ${activeTab === "expense" ? "despesas" : "receitas"}`}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingCategory && (
                  <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                    Criando nova {activeTab === "expense" ? "categoria de despesa" : "categoria de receita"}
                  </p>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    placeholder="ex: CAT_001"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    disabled={!!editingCategory}
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-gerado se deixado em branco
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Nome da Categoria <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="ex: Contas Fixas"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descrição da categoria"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="icon">Ícone</Label>
                    <Input
                      id="icon"
                      placeholder="ex: Wallet, AlertTriangle"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome do ícone Lucide
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {editingCategory ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "expense" ? "default" : "outline"}
            onClick={() => setActiveTab("expense")}
          >
            Categorias de Despesas
          </Button>
          <Button
            variant={activeTab === "revenue" ? "default" : "outline"}
            onClick={() => setActiveTab("revenue")}
          >
            Categorias de Receitas
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{tabTitle}</CardTitle>
            <CardDescription>
              Total de {currentCategories.length} categorias cadastradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma categoria cadastrada ainda
                </p>
                <Button
                  variant="link"
                  onClick={() => setOpen(true)}
                  className="mt-2"
                >
                  Criar primeira categoria
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentCategories.map((category, index) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-mono text-sm">
                          {category.code || `CAT_${index + 1}`}
                        </TableCell>
                        <TableCell className="font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingCategory(category);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a categoria "{deletingCategory?.name}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deletingCategory && handleDelete(deletingCategory)
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default ExpenseCategories;
