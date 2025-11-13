import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  is_active: boolean;
}

const ChartOfAccounts = () => {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "despesa",
    parent_id: "",
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("code");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar plano de contas");
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

      const accountData = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        parent_id: formData.parent_id || null,
        created_by: user.id,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("chart_of_accounts")
          .update(accountData)
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast.success("Conta atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(accountData);

        if (error) throw error;
        toast.success("Conta cadastrada com sucesso!");
      }

      setOpen(false);
      setEditingAccount(null);
      resetForm();
      loadAccounts();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccountId) return;

    try {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", selectedAccountId);

      if (error) throw error;
      toast.success("Conta excluída com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedAccountId(null);
      loadAccounts();
    } catch (error: any) {
      toast.error("Erro ao excluir conta: " + error.message);
    }
  };

  const handleToggleStatus = async (account: ChartAccount) => {
    const newStatus = !account.is_active;
    const action = newStatus ? "ativada" : "desativada";

    try {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({ is_active: newStatus })
        .eq("id", account.id);

      if (error) throw error;
      toast.success(`Conta ${action} com sucesso!`);
      loadAccounts();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      type: "despesa",
      parent_id: "",
    });
  };

  const handleEdit = (account: ChartAccount) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parent_id: account.parent_id || "",
    });
    setOpen(true);
  };

  const getParentAccounts = () => {
    return accounts.filter(acc => !acc.parent_id || acc.code.split('.').length < 3);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plano de Contas</h1>
            <p className="text-muted-foreground">Gerencie as contas contábeis</p>
          </div>
          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setEditingAccount(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta"}</DialogTitle>
                <DialogDescription>
                  Preencha os dados da conta contábil
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    placeholder="Ex: 1.1.01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
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
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="receita">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_id">Conta Pai (opcional)</Label>
                  <Select
                    value={formData.parent_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta pai" />
                    </SelectTrigger>
                    <SelectContent>
                      {getParentAccounts().map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <CardTitle>Contas Cadastradas</CardTitle>
            <CardDescription>Total: {accounts.length} contas</CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma conta cadastrada ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge variant={account.type === "despesa" ? "destructive" : "default"}>
                          {account.type === "despesa" ? "Despesa" : "Receita"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(account)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(account)}
                            title={account.is_active ? "Desativar" : "Ativar"}
                          >
                            {account.is_active ? (
                              <Ban className="w-4 h-4 text-warning" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-success" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAccountId(account.id);
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
                Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
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

export default ChartOfAccounts;
