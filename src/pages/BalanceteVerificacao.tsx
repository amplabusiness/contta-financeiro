import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import {
  RefreshCw,
  Download,
  Search,
  ClipboardList,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Percent,
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Interfaces
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

interface BalanceteAccount extends AccountBalance {
  level: number;
  is_synthetic: boolean;
  children?: BalanceteAccount[];
}

interface Totals {
  opening_debit: number;
  opening_credit: number;
  movement_debit: number;
  movement_credit: number;
  closing_debit: number;
  closing_credit: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const BalanceteVerificacao = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BalanceteAccount[]>([]);
  const [totals, setTotals] = useState<Totals>({
    opening_debit: 0,
    opening_credit: 0,
    movement_debit: 0,
    movement_credit: 0,
    closing_debit: 0,
    closing_credit: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [showAnalyticalOnly, setShowAnalyticalOnly] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");
  
  // Configuração de período
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  // Expandir grupos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["1", "2", "3", "4", "5"]));

  const years = [2024, 2025, 2026];

  // Datas do período
  const periodStart = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const periodEnd = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDay}`;

  // Carregar balancete
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar contas do plano
      const { data: chartAccounts, error: chartError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, type, nature, is_synthetic, is_analytical")
        .eq("is_active", true)
        .order("code");

      if (chartError) throw chartError;

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

      // Processar contas
      const processedAccounts: BalanceteAccount[] = [];
      const newTotals: Totals = {
        opening_debit: 0,
        opening_credit: 0,
        movement_debit: 0,
        movement_credit: 0,
        closing_debit: 0,
        closing_credit: 0,
      };

      chartAccounts?.forEach((acc) => {
        const balance = balanceMap.get(acc.id);
        const level = acc.code.split(".").length;
        
        // Determinar se é devedor ou credor baseado na natureza e saldo
        const isDebitNature = acc.nature === "DEVEDORA";
        const openingBalance = balance?.opening_balance || 0;
        const closingBalance = balance?.closing_balance || 0;
        const totalDebits = balance?.total_debits || 0;
        const totalCredits = balance?.total_credits || 0;

        processedAccounts.push({
          account_id: acc.id,
          account_code: acc.code,
          account_name: acc.name,
          account_type: acc.type,
          nature: acc.nature,
          is_analytical: !acc.is_synthetic,
          is_synthetic: acc.is_synthetic,
          level,
          opening_balance: openingBalance,
          total_debits: totalDebits,
          total_credits: totalCredits,
          closing_balance: closingBalance,
        });

        // Somar totais apenas para contas analíticas
        if (!acc.is_synthetic) {
          // Saldo anterior
          if (openingBalance > 0 && isDebitNature) {
            newTotals.opening_debit += openingBalance;
          } else if (openingBalance > 0 && !isDebitNature) {
            newTotals.opening_credit += openingBalance;
          } else if (openingBalance < 0 && isDebitNature) {
            newTotals.opening_credit += Math.abs(openingBalance);
          } else if (openingBalance < 0 && !isDebitNature) {
            newTotals.opening_debit += Math.abs(openingBalance);
          }

          // Movimentação
          newTotals.movement_debit += totalDebits;
          newTotals.movement_credit += totalCredits;

          // Saldo final
          if (closingBalance > 0 && isDebitNature) {
            newTotals.closing_debit += closingBalance;
          } else if (closingBalance > 0 && !isDebitNature) {
            newTotals.closing_credit += closingBalance;
          } else if (closingBalance < 0 && isDebitNature) {
            newTotals.closing_credit += Math.abs(closingBalance);
          } else if (closingBalance < 0 && !isDebitNature) {
            newTotals.closing_debit += Math.abs(closingBalance);
          }
        }
      });

      setAccounts(processedAccounts);
      setTotals(newTotals);

    } catch (error) {
      console.error("Erro ao carregar balancete:", error);
      toast.error("Erro ao carregar dados do Balancete");
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar contas
  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = 
      searchTerm === "" ||
      acc.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = 
      filterType === "all" || 
      acc.account_code.startsWith(filterType);

    const hasBalance = 
      showZeroBalances ||
      acc.opening_balance !== 0 ||
      acc.total_debits !== 0 ||
      acc.total_credits !== 0 ||
      acc.closing_balance !== 0;

    const matchesAnalytical = 
      !showAnalyticalOnly || 
      acc.is_analytical;

    return matchesSearch && matchesType && hasBalance && matchesAnalytical;
  });

  // Toggle grupo
  const toggleGroup = (code: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedGroups(newExpanded);
  };

  // Verificar se está balanceado
  const isBalanced = 
    Math.abs(totals.opening_debit - totals.opening_credit) < 0.01 &&
    Math.abs(totals.movement_debit - totals.movement_credit) < 0.01 &&
    Math.abs(totals.closing_debit - totals.closing_credit) < 0.01;

  // Exportar para CSV
  const exportToCSV = () => {
    const headers = ["Código", "Conta", "Natureza", "Saldo Anterior D", "Saldo Anterior C", "Débitos", "Créditos", "Saldo Final D", "Saldo Final C"];
    const rows = filteredAccounts.map((acc) => {
      const isDebitNature = acc.nature === "DEVEDORA";
      return [
        acc.account_code,
        acc.account_name,
        acc.nature,
        acc.opening_balance > 0 && isDebitNature ? acc.opening_balance.toFixed(2) : "",
        acc.opening_balance > 0 && !isDebitNature ? acc.opening_balance.toFixed(2) : "",
        acc.total_debits.toFixed(2),
        acc.total_credits.toFixed(2),
        acc.closing_balance > 0 && isDebitNature ? acc.closing_balance.toFixed(2) : "",
        acc.closing_balance > 0 && !isDebitNature ? acc.closing_balance.toFixed(2) : "",
      ];
    });

    // Totais
    rows.push([]);
    rows.push([
      "",
      "TOTAIS",
      "",
      totals.opening_debit.toFixed(2),
      totals.opening_credit.toFixed(2),
      totals.movement_debit.toFixed(2),
      totals.movement_credit.toFixed(2),
      totals.closing_debit.toFixed(2),
      totals.closing_credit.toFixed(2),
    ]);

    const csv = [
      `Balancete de Verificação - ${MONTHS[selectedMonth - 1]}/${selectedYear}`,
      "",
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Balancete_${selectedYear}_${selectedMonth}.csv`;
    link.click();
  };

  // Renderizar linha de conta
  const renderAccountRow = (acc: BalanceteAccount) => {
    const isDebitNature = acc.nature === "DEVEDORA";
    const indent = (acc.level - 1) * 16;

    return (
      <TableRow 
        key={acc.account_id}
        className={`
          ${acc.is_synthetic ? "bg-muted/30 font-semibold" : "hover:bg-muted/20"}
          ${acc.level === 1 ? "bg-muted/50 font-bold" : ""}
        `}
      >
        <TableCell className="font-mono text-xs">{acc.account_code}</TableCell>
        <TableCell>
          <div style={{ paddingLeft: indent }}>{acc.account_name}</div>
        </TableCell>
        <TableCell className="text-center">
          <Badge variant={isDebitNature ? "outline" : "secondary"} className="text-xs">
            {isDebitNature ? "D" : "C"}
          </Badge>
        </TableCell>
        {/* Saldo Anterior */}
        <TableCell className="text-right text-green-600">
          {acc.opening_balance > 0 && isDebitNature ? formatCurrency(acc.opening_balance) : 
           acc.opening_balance < 0 && !isDebitNature ? formatCurrency(Math.abs(acc.opening_balance)) : ""}
        </TableCell>
        <TableCell className="text-right text-red-600">
          {acc.opening_balance > 0 && !isDebitNature ? formatCurrency(acc.opening_balance) :
           acc.opening_balance < 0 && isDebitNature ? formatCurrency(Math.abs(acc.opening_balance)) : ""}
        </TableCell>
        {/* Movimentação */}
        <TableCell className="text-right text-green-600">
          {acc.total_debits > 0 ? formatCurrency(acc.total_debits) : ""}
        </TableCell>
        <TableCell className="text-right text-red-600">
          {acc.total_credits > 0 ? formatCurrency(acc.total_credits) : ""}
        </TableCell>
        {/* Saldo Final */}
        <TableCell className="text-right text-green-700 font-medium">
          {acc.closing_balance > 0 && isDebitNature ? formatCurrency(acc.closing_balance) :
           acc.closing_balance < 0 && !isDebitNature ? formatCurrency(Math.abs(acc.closing_balance)) : ""}
        </TableCell>
        <TableCell className="text-right text-red-700 font-medium">
          {acc.closing_balance > 0 && !isDebitNature ? formatCurrency(acc.closing_balance) :
           acc.closing_balance < 0 && isDebitNature ? formatCurrency(Math.abs(acc.closing_balance)) : ""}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-primary" />
              Balancete de Verificação
            </h1>
            <p className="text-muted-foreground mt-1">
              Verificação do equilíbrio entre débitos e créditos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Status do Balanceamento */}
        <Card className={isBalanced ? "border-green-500" : "border-red-500"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isBalanced ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-500" />
                )}
                <div>
                  <h3 className={`font-bold text-lg ${isBalanced ? "text-green-700" : "text-red-700"}`}>
                    {isBalanced ? "Balancete Equilibrado" : "Balancete Desequilibrado"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {isBalanced 
                      ? "Os saldos devedores e credores estão iguais em todos os períodos"
                      : "Há diferenças entre débitos e créditos que precisam ser verificadas"}
                  </p>
                </div>
              </div>
              {!isBalanced && (
                <div className="text-right">
                  <div className="text-sm text-red-600">
                    Diferença no saldo anterior: {formatCurrency(Math.abs(totals.opening_debit - totals.opening_credit))}
                  </div>
                  <div className="text-sm text-red-600">
                    Diferença na movimentação: {formatCurrency(Math.abs(totals.movement_debit - totals.movement_credit))}
                  </div>
                  <div className="text-sm text-red-600">
                    Diferença no saldo final: {formatCurrency(Math.abs(totals.closing_debit - totals.closing_credit))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
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

              <div className="space-y-2 flex-1 min-w-[200px]">
                <label className="text-sm font-medium">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Código ou nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="zero-balances"
                  checked={showZeroBalances}
                  onCheckedChange={setShowZeroBalances}
                />
                <Label htmlFor="zero-balances" className="text-sm">Saldos zero</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="analytical-only"
                  checked={showAnalyticalOnly}
                  onCheckedChange={setShowAnalyticalOnly}
                />
                <Label htmlFor="analytical-only" className="text-sm">Só analíticas</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela do Balancete */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Balancete - {MONTHS[selectedMonth - 1]} / {selectedYear}</span>
              <Badge variant="outline">{filteredAccounts.length} conta(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead rowSpan={2} className="w-[100px] align-bottom">Código</TableHead>
                      <TableHead rowSpan={2} className="min-w-[200px] align-bottom">Conta</TableHead>
                      <TableHead rowSpan={2} className="w-[50px] text-center align-bottom">Nat</TableHead>
                      <TableHead colSpan={2} className="text-center border-l">Saldo Anterior</TableHead>
                      <TableHead colSpan={2} className="text-center border-l">Movimentação</TableHead>
                      <TableHead colSpan={2} className="text-center border-l">Saldo Final</TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-center text-green-600 border-l">Débito</TableHead>
                      <TableHead className="text-center text-red-600">Crédito</TableHead>
                      <TableHead className="text-center text-green-600 border-l">Débito</TableHead>
                      <TableHead className="text-center text-red-600">Crédito</TableHead>
                      <TableHead className="text-center text-green-600 border-l">Débito</TableHead>
                      <TableHead className="text-center text-red-600">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((acc) => renderAccountRow(acc))}
                    
                    {/* Linha de Totais */}
                    <TableRow className="bg-primary/10 font-bold text-lg">
                      <TableCell colSpan={3} className="text-right">TOTAIS</TableCell>
                      <TableCell className="text-right text-green-700 border-l">
                        {formatCurrency(totals.opening_debit)}
                      </TableCell>
                      <TableCell className="text-right text-red-700">
                        {formatCurrency(totals.opening_credit)}
                      </TableCell>
                      <TableCell className="text-right text-green-700 border-l">
                        {formatCurrency(totals.movement_debit)}
                      </TableCell>
                      <TableCell className="text-right text-red-700">
                        {formatCurrency(totals.movement_credit)}
                      </TableCell>
                      <TableCell className="text-right text-green-700 border-l">
                        {formatCurrency(totals.closing_debit)}
                      </TableCell>
                      <TableCell className="text-right text-red-700">
                        {formatCurrency(totals.closing_credit)}
                      </TableCell>
                    </TableRow>
                    
                    {/* Diferenças */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="text-right font-medium">Diferença</TableCell>
                      <TableCell colSpan={2} className={`text-center font-medium ${Math.abs(totals.opening_debit - totals.opening_credit) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(Math.abs(totals.opening_debit - totals.opening_credit))}
                      </TableCell>
                      <TableCell colSpan={2} className={`text-center font-medium ${Math.abs(totals.movement_debit - totals.movement_credit) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(Math.abs(totals.movement_debit - totals.movement_credit))}
                      </TableCell>
                      <TableCell colSpan={2} className={`text-center font-medium ${Math.abs(totals.closing_debit - totals.closing_credit) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(Math.abs(totals.closing_debit - totals.closing_credit))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legenda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="outline">D</Badge>
                <span>Natureza Devedora (Ativo, Despesas, Custos)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">C</Badge>
                <span>Natureza Credora (Passivo, PL, Receitas)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Débitos = Créditos (Equilibrado)</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span>Diferença indica erro nos lançamentos</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default BalanceteVerificacao;
