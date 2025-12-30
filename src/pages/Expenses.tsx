import { useEffect, useState, useCallback } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, ChevronsUpDown, Check, Banknote, TrendingDown, PiggyBank, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Interfaces
interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: string;
  category?: string;
  cost_center_id?: string;
  account_id?: string;
  bank_account_id?: string;
  bank_account?: { bank_name: string; account_number: string };
  chart_account?: { code: string; name: string };
  cost_center?: { code: string; name: string };
}

interface CashEntry {
  id: string;
  description: string;
  amount: number;
  entry_date: string;
  entry_type: 'entrada' | 'saida';
  category?: string;
  cost_center_id?: string;
  account_id?: string;
  notes?: string;
}

interface CategorySummary {
  category: string;
  account_name: string;
  total: number;
  count: number;
}

const Expenses = () => {
  const { selectedYear, selectedMonth } = usePeriod();

  // Estados para transações bancárias classificadas
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // Estados para lançamentos de caixa
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [loadingCash, setLoadingCash] = useState(true);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [savingCash, setSavingCash] = useState(false);

  // Estados gerais
  const [accounts, setAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // Form de lançamento de caixa
  const [cashFormData, setCashFormData] = useState({
    description: "",
    amount: "",
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: "saida" as 'entrada' | 'saida',
    category: "",
    cost_center_id: "",
    account_id: "",
    notes: "",
  });

  // Carregar contas contábeis
  const loadAccounts = useCallback(async () => {
    try {
      const response = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, type, is_active, is_analytical")
        .eq("is_active", true)
        .eq("is_analytical", true)
        .order("code");

      if (response.error) throw response.error;
      setAccounts(response.data || []);
    } catch (error: any) {
      console.error("Erro ao carregar contas:", error);
    }
  }, []);

  // Carregar centros de custo
  const loadCostCenters = useCallback(async () => {
    try {
      const response = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");

      if (response.error) throw response.error;
      setCostCenters(response.data || []);
    } catch (error: any) {
      console.error("Erro ao carregar centros de custo:", error);
    }
  }, []);

  // Carregar transações bancárias classificadas como despesa/investimento
  const loadBankTransactions = useCallback(async () => {
    try {
      setLoadingTransactions(true);

      // Query simples sem JOINs para evitar erro 400
      let query = supabase
        .from("bank_transactions")
        .select("*")
        .eq("type", "DEBIT")
        .in("category", ["despesa", "investimento"])
        .order("transaction_date", { ascending: false });

      // Filtrar por período
      if (selectedYear && selectedMonth) {
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
        query = query.gte("transaction_date", startDate).lte("transaction_date", endDate);
      } else if (selectedYear) {
        query = query.gte("transaction_date", `${selectedYear}-01-01`).lte("transaction_date", `${selectedYear}-12-31`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar dados relacionados (contas e centros de custo)
      const accountIds = [...new Set((data || []).filter(t => t.account_id).map(t => t.account_id))];
      const costCenterIds = [...new Set((data || []).filter(t => t.cost_center_id).map(t => t.cost_center_id))];
      const bankAccountIds = [...new Set((data || []).filter(t => t.bank_account_id).map(t => t.bank_account_id))];

      // Buscar contas contábeis
      let accountsMap: Record<string, any> = {};
      if (accountIds.length > 0) {
        const { data: accountsData } = await supabase
          .from("chart_of_accounts")
          .select("id, code, name")
          .in("id", accountIds);
        accountsMap = (accountsData || []).reduce((acc, a) => ({ ...acc, [a.id]: a }), {});
      }

      // Buscar centros de custo
      let costCentersMap: Record<string, any> = {};
      if (costCenterIds.length > 0) {
        const { data: ccData } = await supabase
          .from("cost_centers")
          .select("id, code, name")
          .in("id", costCenterIds);
        costCentersMap = (ccData || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
      }

      // Buscar contas bancárias
      let bankAccountsMap: Record<string, any> = {};
      if (bankAccountIds.length > 0) {
        const { data: baData } = await supabase
          .from("bank_accounts")
          .select("id, bank_name, account_number")
          .in("id", bankAccountIds);
        bankAccountsMap = (baData || []).reduce((acc, b) => ({ ...acc, [b.id]: b }), {});
      }

      // Mapear os dados para a interface
      const transactions: BankTransaction[] = (data || []).map((t: any) => ({
        id: t.id,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: Math.abs(Number(t.amount)),
        type: t.type,
        category: t.category,
        cost_center_id: t.cost_center_id,
        account_id: t.account_id,
        bank_account_id: t.bank_account_id,
        bank_account: bankAccountsMap[t.bank_account_id] || null,
        chart_account: accountsMap[t.account_id] || null,
        cost_center: costCentersMap[t.cost_center_id] || null,
      }));

      setBankTransactions(transactions);
    } catch (error: any) {
      console.error("Erro ao carregar transações bancárias:", error);
      toast.error("Erro ao carregar transações do extrato");
    } finally {
      setLoadingTransactions(false);
    }
  }, [selectedYear, selectedMonth]);

  // Carregar lançamentos de caixa
  const loadCashEntries = useCallback(async () => {
    try {
      setLoadingCash(true);

      let query = supabase
        .from("cash_entries")
        .select("*")
        .order("entry_date", { ascending: false });

      // Filtrar por período
      if (selectedYear && selectedMonth) {
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
        query = query.gte("entry_date", startDate).lte("entry_date", endDate);
      } else if (selectedYear) {
        query = query.gte("entry_date", `${selectedYear}-01-01`).lte("entry_date", `${selectedYear}-12-31`);
      }

      const { data, error } = await query;

      if (error) {
        // Se a tabela não existir (PGRST205, 42P01, ou 404), apenas continua silenciosamente
        const isTableNotFound =
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('Could not find') ||
          (error as any).status === 404;

        if (isTableNotFound) {
          // Silencioso - a tabela será criada quando a migração for executada
          setCashEntries([]);
          return;
        }
        throw error;
      }

      setCashEntries(data || []);
    } catch (error: any) {
      // Silenciar erros de tabela não existente
      const isTableNotFound =
        error?.code === 'PGRST205' ||
        error?.message?.includes('does not exist') ||
        error?.message?.includes('Could not find') ||
        error?.status === 404;

      if (isTableNotFound) {
        setCashEntries([]);
        return;
      }
      console.error("Erro ao carregar lançamentos de caixa:", error);
    } finally {
      setLoadingCash(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadAccounts();
    loadCostCenters();
    loadBankTransactions();
    loadCashEntries();
  }, [loadAccounts, loadCostCenters, loadBankTransactions, loadCashEntries]);

  // Salvar lançamento de caixa
  const handleSaveCashEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCash(true);

    try {
      if (!cashFormData.description?.trim()) {
        throw new Error("Descrição é obrigatória");
      }

      if (!cashFormData.amount || parseFloat(cashFormData.amount) <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }

      if (!cashFormData.entry_date) {
        throw new Error("Data é obrigatória");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const entryData = {
        description: cashFormData.description,
        amount: parseFloat(cashFormData.amount),
        entry_date: cashFormData.entry_date,
        entry_type: cashFormData.entry_type,
        category: cashFormData.category || null,
        cost_center_id: cashFormData.cost_center_id || null,
        account_id: cashFormData.account_id || null,
        notes: cashFormData.notes || null,
        created_by: user.id,
      };

      const { error } = await supabase
        .from("cash_entries")
        .insert(entryData);

      if (error) {
        if (error.code === '42P01') {
          toast.error("A tabela de lançamentos de caixa não existe. Por favor, crie a tabela primeiro.");
          return;
        }
        throw error;
      }

      toast.success("Lançamento de caixa salvo com sucesso!");
      setCashDialogOpen(false);
      resetCashForm();
      loadCashEntries();
    } catch (error: any) {
      console.error("Erro ao salvar lançamento:", error);
      toast.error(error.message || "Erro ao salvar lançamento de caixa");
    } finally {
      setSavingCash(false);
    }
  };

  // Excluir lançamento de caixa
  const handleDeleteCashEntry = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;

    try {
      const { error } = await supabase
        .from("cash_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Lançamento excluído!");
      loadCashEntries();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir lançamento");
    }
  };

  const resetCashForm = () => {
    setCashFormData({
      description: "",
      amount: "",
      entry_date: new Date().toISOString().split('T')[0],
      entry_type: "saida",
      category: "",
      cost_center_id: "",
      account_id: "",
      notes: "",
    });
    setAccountSearchQuery("");
  };

  // Calcular resumos por categoria/conta
  const categorySummary: CategorySummary[] = bankTransactions.reduce((acc, t) => {
    const key = t.chart_account?.name || t.category || "Sem classificação";
    const existing = acc.find(s => s.account_name === key);
    if (existing) {
      existing.total += t.amount;
      existing.count += 1;
    } else {
      acc.push({
        category: t.category || "",
        account_name: key,
        total: t.amount,
        count: 1,
      });
    }
    return acc;
  }, [] as CategorySummary[]).sort((a, b) => b.total - a.total);

  // Totais
  const totalDespesas = bankTransactions
    .filter(t => t.category === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalInvestimentos = bankTransactions
    .filter(t => t.category === "investimento")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCaixaSaidas = cashEntries
    .filter(e => e.entry_type === "saida")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalCaixaEntradas = cashEntries
    .filter(e => e.entry_type === "entrada")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "despesa":
        return <Badge variant="destructive">Despesa</Badge>;
      case "investimento":
        return <Badge className="bg-purple-500">Investimento</Badge>;
      default:
        return <Badge variant="secondary">{category || "N/A"}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Despesas e Caixa</h1>
          <p className="text-muted-foreground">
            Análise de despesas do extrato bancário e lançamentos de caixa
          </p>
          {(selectedYear || selectedMonth) && (
            <div className="mt-2 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <span className="font-medium">Filtros ativos:</span>
              {selectedYear && <Badge variant="secondary">Ano: {selectedYear}</Badge>}
              {selectedMonth && <Badge variant="secondary">Mês: {selectedMonth}</Badge>}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar por período</CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Despesas (Banco)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalDespesas)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {bankTransactions.filter(t => t.category === "despesa").length} transações
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-purple-500" />
                Investimentos (Banco)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(totalInvestimentos)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {bankTransactions.filter(t => t.category === "investimento").length} transações
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4 text-orange-500" />
                Saídas de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(totalCaixaSaidas)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {cashEntries.filter(e => e.entry_type === "saida").length} lançamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4 text-green-500" />
                Entradas de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalCaixaEntradas)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {cashEntries.filter(e => e.entry_type === "entrada").length} lançamentos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs para Extrato vs Caixa */}
        <Tabs defaultValue="extrato" className="space-y-4">
          <TabsList>
            <TabsTrigger value="extrato">
              Despesas do Extrato ({bankTransactions.length})
            </TabsTrigger>
            <TabsTrigger value="caixa">
              Lançamentos de Caixa ({cashEntries.length})
            </TabsTrigger>
            <TabsTrigger value="resumo">
              Resumo por Categoria
            </TabsTrigger>
          </TabsList>

          {/* Tab: Despesas do Extrato Bancário */}
          <TabsContent value="extrato">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Transações Classificadas do Extrato</CardTitle>
                  <CardDescription>
                    Despesas e investimentos identificados nas importações OFX
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadBankTransactions}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                {loadingTransactions ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : bankTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-2">
                      Nenhuma despesa classificada encontrada no período
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Importe um extrato OFX e classifique as transações como "Despesa" ou "Investimento"
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Banco</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Conta Contábil</TableHead>
                        <TableHead>Centro Custo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bankTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            {new Date(t.transaction_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={t.description}>
                            {t.description}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {t.bank_account?.bank_name || "-"}
                          </TableCell>
                          <TableCell>{getCategoryBadge(t.category || "")}</TableCell>
                          <TableCell className="text-sm">
                            {t.chart_account ? (
                              <span title={`${t.chart_account.code} - ${t.chart_account.name}`}>
                                {t.chart_account.code}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.cost_center?.name || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(t.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Lançamentos de Caixa */}
          <TabsContent value="caixa">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Lançamentos de Caixa</CardTitle>
                  <CardDescription>
                    Movimentações em dinheiro (espécie)
                  </CardDescription>
                </div>
                <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Lançamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Novo Lançamento de Caixa</DialogTitle>
                      <DialogDescription>
                        Registre uma movimentação em dinheiro (espécie)
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveCashEntry} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="entry_type">Tipo *</Label>
                          <Select
                            value={cashFormData.entry_type}
                            onValueChange={(value: 'entrada' | 'saida') =>
                              setCashFormData({ ...cashFormData, entry_type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="saida">Saída (Pagamento)</SelectItem>
                              <SelectItem value="entrada">Entrada (Recebimento)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="entry_date">Data *</Label>
                          <Input
                            id="entry_date"
                            type="date"
                            value={cashFormData.entry_date}
                            onChange={(e) =>
                              setCashFormData({ ...cashFormData, entry_date: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="description">Descrição *</Label>
                          <Input
                            id="description"
                            value={cashFormData.description}
                            onChange={(e) =>
                              setCashFormData({ ...cashFormData, description: e.target.value })
                            }
                            placeholder="Ex: Pagamento de frete em dinheiro"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="amount">Valor *</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={cashFormData.amount}
                            onChange={(e) =>
                              setCashFormData({ ...cashFormData, amount: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Categoria</Label>
                          <Input
                            id="category"
                            value={cashFormData.category}
                            onChange={(e) =>
                              setCashFormData({ ...cashFormData, category: e.target.value })
                            }
                            placeholder="Ex: Material, Frete"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cost_center_id">Centro de Custo</Label>
                          <Select
                            value={cashFormData.cost_center_id}
                            onValueChange={(value) =>
                              setCashFormData({ ...cashFormData, cost_center_id: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {costCenters.map((cc) => (
                                <SelectItem key={cc.id} value={cc.id}>
                                  {cc.code} - {cc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Conta Contábil</Label>
                          <Popover open={isAccountPickerOpen} onOpenChange={setIsAccountPickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                              >
                                {cashFormData.account_id
                                  ? accounts.find((a) => a.id === cashFormData.account_id)?.code || "Selecione"
                                  : "Selecione"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Buscar conta..."
                                  value={accountSearchQuery}
                                  onValueChange={setAccountSearchQuery}
                                />
                                <CommandList>
                                  <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                                  <CommandGroup>
                                    {accounts
                                      .filter((a) =>
                                        `${a.code} ${a.name}`
                                          .toLowerCase()
                                          .includes(accountSearchQuery.toLowerCase())
                                      )
                                      .slice(0, 20)
                                      .map((account) => (
                                        <CommandItem
                                          key={account.id}
                                          value={account.id}
                                          onSelect={() => {
                                            setCashFormData({ ...cashFormData, account_id: account.id });
                                            setIsAccountPickerOpen(false);
                                            setAccountSearchQuery("");
                                          }}
                                        >
                                          {account.code} - {account.name}
                                          {cashFormData.account_id === account.id && (
                                            <Check className="ml-auto h-4 w-4" />
                                          )}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="notes">Observações</Label>
                          <Textarea
                            id="notes"
                            value={cashFormData.notes}
                            onChange={(e) =>
                              setCashFormData({ ...cashFormData, notes: e.target.value })
                            }
                            rows={2}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCashDialogOpen(false);
                            resetCashForm();
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={savingCash}>
                          {savingCash ? "Salvando..." : "Salvar"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingCash ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : cashEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-2">
                      Nenhum lançamento de caixa encontrado no período
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Use o botão "Novo Lançamento" para registrar movimentações em dinheiro
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {new Date(entry.entry_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell>
                            {entry.entry_type === "entrada" ? (
                              <Badge className="bg-green-500">Entrada</Badge>
                            ) : (
                              <Badge variant="destructive">Saída</Badge>
                            )}
                          </TableCell>
                          <TableCell>{entry.category || "-"}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              entry.entry_type === "entrada" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {entry.entry_type === "entrada" ? "+" : "-"}
                            {formatCurrency(Number(entry.amount))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCashEntry(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Resumo por Categoria */}
          <TabsContent value="resumo">
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Conta Contábil</CardTitle>
                <CardDescription>
                  Agrupamento das despesas do extrato por classificação contábil
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categorySummary.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma despesa classificada no período
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conta / Categoria</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorySummary.map((summary, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{summary.account_name}</TableCell>
                          <TableCell className="text-center">{summary.count}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(summary.total)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {((summary.total / (totalDespesas + totalInvestimentos)) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-center">
                          {categorySummary.reduce((sum, s) => sum + s.count, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(totalDespesas + totalInvestimentos)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Expenses;
