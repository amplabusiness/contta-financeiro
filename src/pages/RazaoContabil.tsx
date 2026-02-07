import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import {
  RefreshCw,
  Download,
  Search,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { toast } from "sonner";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Interfaces
interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  nature: string;
  is_synthetic: boolean;
  is_analytical: boolean;
}

interface AccountBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  nature: string;
  is_analytical: boolean;
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  closing_balance: number;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  document_number: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  counterpart_account: string;
  is_opening: boolean;
}

interface SelectedAccount extends Account {
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  closing_balance: number;
  entries: LedgerEntry[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const RazaoContabil = () => {
  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Estados de dados principais
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountBalances, setAccountBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [selectedAccount, setSelectedAccount] = useState<SelectedAccount | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["1", "2", "3", "4", "5"]));

  const years = [2024, 2025, 2026];

  // Datas do período
  const periodStart = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const periodEnd = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDay}`;

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar todas as contas
      const { data: accountsData, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, type, nature, is_synthetic, is_analytical")
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Buscar saldos via RPC
      const { data: balances, error: balancesError } = await supabase.rpc("get_account_balances", {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

      if (balancesError) throw balancesError;

      // Mapear saldos por account_id
      const balanceMap = new Map<string, AccountBalance>();
      balances?.forEach((b: AccountBalance) => {
        balanceMap.set(b.account_id, b);
      });
      setAccountBalances(balanceMap);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do Razão");
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd]);

  const loadAccountEntries = async (account: Account) => {
    setLoadingEntries(true);
    try {
      const balance = accountBalances.get(account.id);
      
      // Buscar lançamentos
      const { data: entries, error } = await supabase
        .from("accounting_entry_items")
        .select(`
          id,
          debit,
          credit,
          accounting_entries (
            id,
            entry_date,
            entry_number,
            description,
            document_number,
            is_opening_balance
          )
        `)
        .eq("account_id", account.id)
        .gte("accounting_entries.entry_date", periodStart)
        .lte("accounting_entries.entry_date", periodEnd)
        .order("accounting_entries(entry_date)", { ascending: true });

      if (error) throw error;

      // Processar lançamentos calculando saldo acumulado
      let runningBalance = balance?.opening_balance || 0;
      const processedEntries: LedgerEntry[] = [];

      // Adicionar linha de saldo anterior se houver
      if (balance?.opening_balance !== 0) {
        processedEntries.push({
          id: "opening",
          entry_date: periodStart,
          entry_number: "-",
          description: "SALDO ANTERIOR",
          document_number: null,
          debit: 0,
          credit: 0,
          running_balance: balance?.opening_balance || 0,
          counterpart_account: "-",
          is_opening: true,
        });
      }

      entries?.forEach((entry: {
        id: string;
        debit: number | null;
        credit: number | null;
        accounting_entries: {
          id: string;
          entry_date: string;
          entry_number: string;
          description: string;
          document_number: string | null;
          is_opening_balance: boolean;
        } | null;
      } | null) => {
        if (!entry?.accounting_entries) return;

        const debit = Number(entry.debit) || 0;
        const credit = Number(entry.credit) || 0;

        // Calcular saldo baseado na natureza da conta
        if (account.nature === "DEVEDORA") {
          runningBalance += debit - credit;
        } else {
          runningBalance += credit - debit;
        }

        processedEntries.push({
          id: entry.id,
          entry_date: entry.accounting_entries.entry_date,
          entry_number: entry.accounting_entries.entry_number,
          description: entry.accounting_entries.description,
          document_number: entry.accounting_entries.document_number,
          debit,
          credit,
          running_balance: runningBalance,
          counterpart_account: "-", // TODO: buscar contrapartida
          is_opening: entry.accounting_entries.is_opening_balance,
        });
      });

      setSelectedAccount({
        ...account,
        opening_balance: balance?.opening_balance || 0,
        total_debits: balance?.total_debits || 0,
        total_credits: balance?.total_credits || 0,
        closing_balance: balance?.closing_balance || 0,
        entries: processedEntries,
      });

    } catch (error) {
      console.error("Erro ao carregar lançamentos:", error);
      toast.error("Erro ao carregar lançamentos da conta");
    } finally {
      setLoadingEntries(false);
    }
  };

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const exportToCSV = () => {
    if (!selectedAccount) {
      toast.error("Selecione uma conta para exportar");
      return;
    }

    const headers = ["Data", "Nº Lançamento", "Histórico", "Documento", "Débito", "Crédito", "Saldo"];
    const rows = selectedAccount.entries.map((e) => [
      e.entry_date,
      e.entry_number,
      e.description,
      e.document_number || "",
      e.debit.toFixed(2),
      e.credit.toFixed(2),
      e.running_balance.toFixed(2),
    ]);

    const csv = [
      `Razão Contábil - ${selectedAccount.code} - ${selectedAccount.name}`,
      `Período: ${format(new Date(periodStart), "dd/MM/yyyy")} a ${format(new Date(periodEnd), "dd/MM/yyyy")}`,
      "",
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
      "",
      `Saldo Anterior;${selectedAccount.opening_balance.toFixed(2)}`,
      `Total Débitos;${selectedAccount.total_debits.toFixed(2)}`,
      `Total Créditos;${selectedAccount.total_credits.toFixed(2)}`,
      `Saldo Final;${selectedAccount.closing_balance.toFixed(2)}`,
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Razao_${selectedAccount.code}_${selectedYear}_${selectedMonth}.csv`;
    link.click();
  };

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = 
      searchTerm === "" ||
      acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = 
      filterType === "all" || 
      acc.code.startsWith(filterType);

    return matchesSearch && matchesType;
  });

  // Agrupar contas por primeiro dígito
  const groupedAccounts = filteredAccounts.reduce((groups, acc) => {
    const group = acc.code[0];
    if (!groups[group]) groups[group] = [];
    groups[group].push(acc);
    return groups;
  }, {} as Record<string, Account[]>);

  Object.values(groupedAccounts).forEach((group) =>
    group.sort((a, b) => a.code.localeCompare(b.code))
  );

  const getGroupName = (group: string) => {
    const names: Record<string, string> = {
      "1": "1 - ATIVO",
      "2": "2 - PASSIVO",
      "3": "3 - RECEITAS",
      "4": "4 - DESPESAS",
      "5": "5 - CUSTOS",
    };
    return names[group] || `Grupo ${group}`;
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Livro Razão
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Movimentação detalhada por conta contábil
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} disabled={!selectedAccount}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Período e Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ano</label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mês</label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Conta</label>
                <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "1" | "2" | "3" | "4" | "5")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="1">1 - Ativo</SelectItem>
                    <SelectItem value="2">2 - Passivo</SelectItem>
                    <SelectItem value="3">3 - Receitas</SelectItem>
                    <SelectItem value="4">4 - Despesas</SelectItem>
                    <SelectItem value="5">5 - Custos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex-1 min-w-[250px]">
                <label className="text-sm font-medium">Buscar Conta</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Código ou nome da conta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Badge variant="outline" className="h-10 px-4">
                {filteredAccounts.length} conta(s)
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de Contas */}
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Plano de Contas</CardTitle>
              <CardDescription>Clique em uma conta para ver o razão</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(groupedAccounts).sort().map(([group, groupAccounts]) => (
                      <div key={group} className="border rounded-lg">
                        <button
                          onClick={() => toggleGroup(group)}
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-t-lg"
                        >
                          <span className="font-semibold">{getGroupName(group)}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{groupAccounts.length}</Badge>
                            {expandedGroups.has(group) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </div>
                        </button>
                        {expandedGroups.has(group) && (
                          <div className="border-t">
                            {groupAccounts.map((acc) => {
                              const balance = accountBalances.get(acc.id);
                              const hasMovement = balance && (balance.total_debits > 0 || balance.total_credits > 0);
                              const level = acc.code.split(".").length;
                              const indent = (level - 1) * 12;
                              
                              return (
                                <button
                                  key={acc.id}
                                  onClick={() => loadAccountEntries(acc)}
                                  className={`w-full text-left p-2 px-4 hover:bg-muted/50 border-b last:border-b-0 
                                    ${selectedAccount?.id === acc.id ? "bg-primary/10" : ""}
                                    ${acc.is_synthetic ? "font-medium" : ""}
                                  `}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs text-muted-foreground w-20">
                                        {acc.code}
                                      </span>
                                      <span className={`${acc.is_synthetic ? "" : "text-sm"}`} style={{ paddingLeft: indent }}>
                                        {acc.name}
                                      </span>
                                    </div>
                                    {hasMovement && (
                                      <Badge variant="outline" className="text-xs">
                                        {formatCurrency(balance.closing_balance)}
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Razão da Conta Selecionada */}
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Razão da Conta
              </CardTitle>
              {selectedAccount && (
                <CardDescription>
                  {selectedAccount.code} - {selectedAccount.name}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {loadingEntries ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : selectedAccount ? (
                <div className="h-full flex flex-col">
                  {/* Resumo */}
                  <div className="grid grid-cols-4 gap-2 mb-4 text-sm">
                    <div className="p-2 bg-muted rounded text-center">
                      <div className="text-muted-foreground text-xs">Saldo Anterior</div>
                      <div className="font-medium">{formatCurrency(selectedAccount.opening_balance)}</div>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded text-center">
                      <div className="text-green-600 text-xs flex items-center justify-center gap-1">
                        <ArrowUpCircle className="w-3 h-3" />
                        Débitos
                      </div>
                      <div className="font-medium text-green-700">{formatCurrency(selectedAccount.total_debits)}</div>
                    </div>
                    <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded text-center">
                      <div className="text-red-600 text-xs flex items-center justify-center gap-1">
                        <ArrowDownCircle className="w-3 h-3" />
                        Créditos
                      </div>
                      <div className="font-medium text-red-700">{formatCurrency(selectedAccount.total_credits)}</div>
                    </div>
                    <div className="p-2 bg-primary/10 rounded text-center">
                      <div className="text-primary text-xs">Saldo Final</div>
                      <div className="font-bold text-primary">{formatCurrency(selectedAccount.closing_balance)}</div>
                    </div>
                  </div>

                  {/* Tabela de Lançamentos */}
                  <ScrollArea className="flex-1">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[90px]">Data</TableHead>
                          <TableHead>Histórico</TableHead>
                          <TableHead className="text-right w-[100px]">Débito</TableHead>
                          <TableHead className="text-right w-[100px]">Crédito</TableHead>
                          <TableHead className="text-right w-[100px]">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAccount.entries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Nenhum lançamento no período
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedAccount.entries.map((entry) => (
                            <TableRow 
                              key={entry.id}
                              className={entry.is_opening ? "bg-muted/30 font-medium" : ""}
                            >
                              <TableCell className="font-mono text-xs">
                                {format(new Date(entry.entry_date + "T12:00:00"), "dd/MM/yy")}
                              </TableCell>
                              <TableCell className="text-sm truncate max-w-[200px]" title={entry.description}>
                                {entry.description}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(entry.running_balance)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <BookOpen className="w-16 h-16 mb-4 opacity-50" />
                  <p>Selecione uma conta para visualizar o razão</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Legenda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-600" />
                <span>Débito = Entrada de recursos ou aumento de despesas</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-600" />
                <span>Crédito = Saída de recursos ou aumento de receitas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Saldo</span>
                <span>= Calculado conforme natureza da conta (Devedora/Credora)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RazaoContabil;
