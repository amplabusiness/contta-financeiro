import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Landmark, Plus, Edit, Trash2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Badge } from "@/components/ui/badge";

interface BankAccount {
  id: string;
  name: string;
  bank_code: string | null;
  bank_name: string;
  agency: string | null;
  account_number: string | null;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const BankAccounts = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [stats, setStats] = useState({
    totalAccounts: 0,
    activeAccounts: 0,
    totalBalance: 0
  });

  const [formData, setFormData] = useState({
    name: "",
    bank_code: "",
    bank_name: "",
    agency: "",
    account_number: "",
    account_type: "checking",
    current_balance: "0",
    is_active: true,
    notes: ""
  });

  useEffect(() => {
    loadBankAccounts();
  }, []);

  const loadBankAccounts = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("is_active", { ascending: false })
        .order("name");

      if (error) throw error;

      setAccounts(data || []);

      // Calculate stats
      const totalAccounts = data?.length || 0;
      const activeAccounts = data?.filter((a) => a.is_active).length || 0;
      const totalBalance = data?.reduce((sum, a) => sum + (a.current_balance || 0), 0) || 0;

      setStats({ totalAccounts, activeAccounts, totalBalance });
    } catch (error: any) {
      console.error("Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas bancárias");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingAccount(null);
    setFormData({
      name: "",
      bank_code: "",
      bank_name: "",
      agency: "",
      account_number: "",
      account_type: "checking",
      current_balance: "0",
      is_active: true,
      notes: ""
    });
    setDialogOpen(true);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      bank_code: account.bank_code || "",
      bank_name: account.bank_name || "",
      agency: account.agency || "",
      account_number: account.account_number || "",
      account_type: account.account_type || "checking",
      current_balance: account.current_balance?.toString() || "0",
      is_active: account.is_active,
      notes: account.notes || ""
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        toast.error("Informe o nome da conta");
        return;
      }

      const currentBalance = parseFloat(formData.current_balance) || 0;

      if (editingAccount) {
        // Update
        const { error } = await supabase
          .from("bank_accounts")
          .update({
            name: formData.name,
            bank_code: formData.bank_code,
            bank_name: formData.bank_name,
            agency: formData.agency,
            account_number: formData.account_number,
            account_type: formData.account_type,
            current_balance: currentBalance,
            is_active: formData.is_active,
            notes: formData.notes,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingAccount.id);

        if (error) throw error;

        toast.success("Conta atualizada com sucesso!");
      } else {
        // Insert - Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { error } = await supabase.from("bank_accounts").insert({
          name: formData.name,
          bank_code: formData.bank_code,
          bank_name: formData.bank_name,
          agency: formData.agency,
          account_number: formData.account_number,
          account_type: formData.account_type,
          current_balance: currentBalance,
          is_active: formData.is_active,
          notes: formData.notes,
          created_by: user.id
        });

        if (error) throw error;

        toast.success("Conta criada com sucesso!");
      }

      setDialogOpen(false);
      loadBankAccounts();
    } catch (error: any) {
      console.error("Erro ao salvar conta:", error);
      toast.error("Erro ao salvar conta bancária");
    }
  };

  const handleDelete = async (account: BankAccount) => {
    if (!confirm(`Tem certeza que deseja excluir a conta "${account.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("bank_accounts")
        .delete()
        .eq("id", account.id);

      if (error) throw error;

      toast.success("Conta excluída com sucesso!");
      loadBankAccounts();
    } catch (error: any) {
      console.error("Erro ao excluir conta:", error);
      toast.error("Erro ao excluir conta bancária");
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      checking: "Conta Corrente",
      savings: "Poupança",
      investment: "Investimento"
    };
    return types[type] || type;
  };

  if (loading) {
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Landmark className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Contas Bancárias</h1>
              <p className="text-muted-foreground">
                Gerencie as contas bancárias da empresa
              </p>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Contas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.totalAccounts}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{stats.activeAccounts}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">
                  {formatCurrency(stats.totalBalance)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contas Cadastradas</CardTitle>
            <CardDescription>
              Lista de todas as contas bancárias configuradas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conta bancária cadastrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Agência</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Saldo Atual</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>
                          {account.bank_name}
                          {account.bank_code && (
                            <span className="text-muted-foreground ml-1">({account.bank_code})</span>
                          )}
                        </TableCell>
                        <TableCell>{account.agency || "-"}</TableCell>
                        <TableCell>{account.account_number || "-"}</TableCell>
                        <TableCell>{getAccountTypeLabel(account.account_type)}</TableCell>
                        <TableCell>
                          <Badge variant={account.is_active ? "default" : "secondary"}>
                            {account.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(account.current_balance)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex items-center justify-end gap-1">
                            {account.current_balance >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className={account.current_balance >= 0 ? "text-green-600" : "text-red-600"}>
                              {formatCurrency(account.current_balance)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(account)}
                              title="Editar conta"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(account)}
                              title="Excluir conta"
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

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Conta Bancária" : "Nova Conta Bancária"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações da conta bancária
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nome da Conta <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Sicredi - Conta Principal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_code">Código do Banco</Label>
                  <Input
                    id="bank_code"
                    placeholder="Ex: 748"
                    value={formData.bank_code}
                    onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">Nome do Banco</Label>
                  <Input
                    id="bank_name"
                    placeholder="Ex: Sicredi"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agency">Agência</Label>
                  <Input
                    id="agency"
                    placeholder="Ex: 0001"
                    value={formData.agency}
                    onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_number">Número da Conta</Label>
                  <Input
                    id="account_number"
                    placeholder="Ex: 12345-6"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_type">Tipo de Conta</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Conta Corrente</SelectItem>
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="investment">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current_balance">Saldo Atual</Label>
                  <Input
                    id="current_balance"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.current_balance}
                    onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre a conta..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Conta Ativa
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingAccount ? "Atualizar" : "Criar"} Conta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BankAccounts;
