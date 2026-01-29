import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Pencil, Trash2, Ban, CheckCircle, RefreshCw, BookOpen, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/utils";
import { usePeriod } from "@/contexts/PeriodContext";

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  nature: string;
  level: number;
  is_analytical: boolean;
  parent_id: string | null;
  is_active: boolean;
}

interface AccountBalance {
  account_id: string;
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  closing_balance: number;
}

const ChartOfAccounts = () => {
  const navigate = useNavigate();
  const { selectedYear, selectedMonth } = usePeriod();
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [balances, setBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    account_type: "DESPESA",
    nature: "DEVEDORA",
    parent_id: "",
  });
  const [showInactive, setShowInactive] = useState(false);

  const handleViewLedger = (accountId: string) => {
    navigate(`/livro-razao?account=${accountId}`);
  };

  useEffect(() => {
    loadAccounts();
  }, [showInactive]);

  useEffect(() => {
    if (accounts.length > 0) {
      loadBalances();
    }
  }, [selectedYear, selectedMonth, accounts]);

  const loadAccounts = async () => {
    try {
      let query = supabase
        .from("chart_of_accounts")
        .select("*")
        .order("code");

      // Filtrar apenas contas ativas por padrão
      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar plano de contas");
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    setLoadingBalances(true);
    try {
      const periodStart = new Date(selectedYear, selectedMonth - 1, 1);
      const periodEnd = new Date(selectedYear, selectedMonth, 0);
      const periodStartStr = periodStart.toISOString().split('T')[0];
      const periodEndStr = periodEnd.toISOString().split('T')[0];

      console.log('[ChartOfAccounts] Buscando saldos do banco para período:', periodStartStr, 'até', periodEndStr);

      // Chamar função SQL que calcula os saldos no banco de dados
      const { data, error } = await supabase.rpc('get_account_balances', {
        p_period_start: periodStartStr,
        p_period_end: periodEndStr
      });

      if (error) {
        console.error('[ChartOfAccounts] Erro ao buscar saldos via RPC:', error);
        throw error;
      }

      console.log('[ChartOfAccounts] Saldos recebidos do banco:', data?.length || 0);

      // Converter para Map
      const balanceMap = new Map<string, AccountBalance>();
      
      (data || []).forEach((row: any) => {
        balanceMap.set(row.account_id, {
          account_id: row.account_id,
          opening_balance: Number(row.opening_balance) || 0,
          total_debits: Number(row.total_debits) || 0,
          total_credits: Number(row.total_credits) || 0,
          closing_balance: Number(row.closing_balance) || 0
        });
      });

      // Garantir que todas as contas tenham entrada no map (mesmo sem movimento)
      accounts.forEach(account => {
        if (!balanceMap.has(account.id)) {
          balanceMap.set(account.id, {
            account_id: account.id,
            opening_balance: 0,
            total_debits: 0,
            total_credits: 0,
            closing_balance: 0
          });
        }
      });

      setBalances(balanceMap);
    } catch (error: any) {
      console.error("Erro ao carregar saldos:", error);
      toast.error("Erro ao carregar saldos: " + getErrorMessage(error));
    } finally {
      setLoadingBalances(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Determinar natureza baseada no tipo
      const nature = ['ATIVO', 'DESPESA'].includes(formData.account_type) ? 'DEVEDORA' : 'CREDORA';
      // Determinar nível pelo código
      const level = formData.code.split('.').length;

      const accountData = {
        code: formData.code,
        name: formData.name,
        account_type: formData.account_type,
        nature: nature,
        level: level,
        is_analytical: level >= 4, // Contas de nível 4+ são analíticas
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

      if (error) throw new Error(getErrorMessage(error));
      toast.success(`Conta ${action} com sucesso!`);
      loadAccounts();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + getErrorMessage(error));
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      account_type: "DESPESA",
      nature: "DEVEDORA",
      parent_id: "",
    });
  };

  const handleEdit = (account: ChartAccount) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type || 'DESPESA',
      nature: account.nature || 'DEVEDORA',
      parent_id: account.parent_id || "",
    });
    setOpen(true);
  };

  const getParentAccounts = () => {
    return accounts.filter(acc => !acc.parent_id || acc.code.split('.').length < 3);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getMonthName = (month: number) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return months[month - 1];
  };

  // Calcular totais
  const calculateTotals = () => {
    let totalDebits = 0;
    let totalCredits = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    accounts.forEach(account => {
      const balance = balances.get(account.id);
      if (balance) {
        totalDebits += balance.total_debits;
        totalCredits += balance.total_credits;

        if (account.nature === 'DEVEDORA') {
          if (balance.closing_balance > 0) totalClosingDebit += balance.closing_balance;
          else totalClosingCredit += Math.abs(balance.closing_balance);
        } else {
          if (balance.closing_balance > 0) totalClosingCredit += balance.closing_balance;
          else totalClosingDebit += Math.abs(balance.closing_balance);
        }
      }
    });

    return { totalDebits, totalCredits, totalClosingDebit, totalClosingCredit };
  };

  const totals = calculateTotals();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plano de Contas</h1>
            <p className="text-muted-foreground">
              Período: {getMonthName(selectedMonth)}/{selectedYear} |
              Total: {accounts.length} contas
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showInactive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Ocultar Inativas
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Mostrar Inativas
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadBalances}
              disabled={loadingBalances}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingBalances ? 'animate-spin' : ''}`} />
              Atualizar Saldos
            </Button>
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
                    <Label htmlFor="account_type">Tipo *</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="PASSIVO">Passivo</SelectItem>
                        <SelectItem value="RECEITA">Receita</SelectItem>
                        <SelectItem value="DESPESA">Despesa</SelectItem>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contas Contábeis</CardTitle>
            <CardDescription>
              Saldo Inicial + Débitos - Créditos = Saldo Final (contas devedoras) |
              Saldo Inicial + Créditos - Débitos = Saldo Final (contas credoras)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Carregando...
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma conta cadastrada ainda
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-20">Tipo</TableHead>
                      <TableHead className="text-right w-28">Saldo Inicial</TableHead>
                      <TableHead className="text-right w-28">Débitos</TableHead>
                      <TableHead className="text-right w-28">Créditos</TableHead>
                      <TableHead className="text-right w-28">Saldo Final</TableHead>
                      <TableHead className="text-right w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => {
                      const balance = balances.get(account.id);

                      return (
                        <TableRow key={account.id} className={!account.is_active ? "opacity-50" : ""}>
                          <TableCell className="font-mono font-medium text-sm">
                            {account.code}
                          </TableCell>
                          <TableCell
                            className="text-sm"
                            style={{ paddingLeft: `${(account.level - 1) * 16}px` }}
                          >
                            {account.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              account.account_type === "DESPESA" ? "destructive" :
                              account.account_type === "RECEITA" ? "default" :
                              account.account_type === "ATIVO" ? "secondary" : "outline"
                            } className="text-xs">
                              {account.account_type?.charAt(0)}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${
                            balance && balance.opening_balance < 0 ? 'text-red-600' : ''
                          }`}>
                            {balance ? formatCurrency(balance.opening_balance) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-blue-600">
                            {balance && balance.total_debits > 0 ? formatCurrency(balance.total_debits) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-green-600">
                            {balance && balance.total_credits > 0 ? formatCurrency(balance.total_credits) : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm font-medium ${
                            balance && balance.closing_balance < 0 ? 'text-red-600' : ''
                          }`}>
                            {balance ? formatCurrency(balance.closing_balance) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {account.is_analytical && balance && (balance.total_debits > 0 || balance.total_credits > 0) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleViewLedger(account.id)}
                                  title="Ver Razão"
                                >
                                  <BookOpen className="w-3 h-3 text-primary" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(account)}
                                title="Editar"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleToggleStatus(account)}
                                title={account.is_active ? "Desativar" : "Ativar"}
                              >
                                {account.is_active ? (
                                  <Ban className="w-3 h-3 text-warning" />
                                ) : (
                                  <CheckCircle className="w-3 h-3 text-success" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setSelectedAccountId(account.id);
                                  setDeleteDialogOpen(true);
                                }}
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Linha de totais */}
                    <TableRow className="bg-muted font-bold border-t-2">
                      <TableCell colSpan={3} className="text-right">
                        TOTAIS
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        -
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-blue-600">
                        {formatCurrency(totals.totalDebits)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600">
                        {formatCurrency(totals.totalCredits)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <div className="text-blue-600">{formatCurrency(totals.totalClosingDebit)} (D)</div>
                        <div className="text-green-600">{formatCurrency(totals.totalClosingCredit)} (C)</div>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {/* Verificação de equilíbrio */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="text-right text-sm">
                        Diferença (Débitos - Créditos)
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        -
                      </TableCell>
                      <TableCell colSpan={2} className={`text-center font-mono text-sm font-bold ${
                        Math.abs(totals.totalDebits - totals.totalCredits) > 0.01
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {formatCurrency(totals.totalDebits - totals.totalCredits)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${
                        Math.abs(totals.totalClosingDebit - totals.totalClosingCredit) > 0.01
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {formatCurrency(totals.totalClosingDebit - totals.totalClosingCredit)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
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
