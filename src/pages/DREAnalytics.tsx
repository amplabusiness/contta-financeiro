import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Calendar,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Interfaces
interface DRELineItem {
  account_code: string;
  account_name: string;
  account_id: string;
  is_synthetic: boolean;
  is_analytical?: boolean;
  values: { [period: string]: number };
  percentages: { [period: string]: number };
  children?: DRELineItem[];
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

interface DREPeriodData {
  period: string;
  label: string;
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
}

interface DREStructure {
  revenues: DRELineItem[];
  expenses: DRELineItem[];
  periods: DREPeriodData[];
}

// Estrutura padrão do DRE conforme NBC TG 26
const DRE_STRUCTURE = {
  revenue: {
    label: "RECEITAS OPERACIONAIS",
    code: "3",
    nature: "credit",
  },
  expenses: {
    label: "DESPESAS OPERACIONAIS",
    code: "4",
    nature: "debit",
  },
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DREAnalytics = () => {
  // Estados de carregamento
  const [loading, setLoading] = useState(true);

  // Estados de dados principais
  const [dreStructure, setDreStructure] = useState<DREStructure>({
    revenues: [],
    expenses: [],
    periods: [],
  });
  const [selectedYear, setSelectedYear] = useState(2025);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [periodType, setPeriodType] = useState<"monthly" | "quarterly" | "accumulated">("monthly");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const years = [2024, 2025, 2026];

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const generatePeriods = useCallback(() => {
    const periods: { start: string; end: string; label: string; key: string }[] = [];
    
    if (periodType === "monthly") {
      for (let m = startMonth; m <= endMonth; m++) {
        const lastDay = new Date(selectedYear, m, 0).getDate();
        periods.push({
          start: `${selectedYear}-${m.toString().padStart(2, '0')}-01`,
          end: `${selectedYear}-${m.toString().padStart(2, '0')}-${lastDay}`,
          label: `${MONTHS[m - 1].substring(0, 3)}/${selectedYear.toString().slice(-2)}`,
          key: `${selectedYear}-${m.toString().padStart(2, '0')}`,
        });
      }
    } else if (periodType === "quarterly") {
      const quarters = [
        { start: 1, end: 3, label: "1º Tri" },
        { start: 4, end: 6, label: "2º Tri" },
        { start: 7, end: 9, label: "3º Tri" },
        { start: 10, end: 12, label: "4º Tri" },
      ];
      quarters.forEach((q, idx) => {
        if (q.start >= startMonth && q.end <= endMonth) {
          const lastDay = new Date(selectedYear, q.end, 0).getDate();
          periods.push({
            start: `${selectedYear}-${q.start.toString().padStart(2, '0')}-01`,
            end: `${selectedYear}-${q.end.toString().padStart(2, '0')}-${lastDay}`,
            label: `${q.label}/${selectedYear.toString().slice(-2)}`,
            key: `Q${idx + 1}-${selectedYear}`,
          });
        }
      });
    } else {
      // Acumulado
      const lastDay = new Date(selectedYear, endMonth, 0).getDate();
      periods.push({
        start: `${selectedYear}-${startMonth.toString().padStart(2, '0')}-01`,
        end: `${selectedYear}-${endMonth.toString().padStart(2, '0')}-${lastDay}`,
        label: `${MONTHS[startMonth - 1].substring(0, 3)}-${MONTHS[endMonth - 1].substring(0, 3)}/${selectedYear.toString().slice(-2)}`,
        key: `ACC-${selectedYear}`,
      });
    }
    
    return periods;
  }, [selectedYear, startMonth, endMonth, periodType]);

  // Carregar dados do DRE
  const loadDREData = useCallback(async () => {
    setLoading(true);
    try {
      const periods = generatePeriods();
      
      // Buscar todas as contas de receita e despesa
      const { data: accounts, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, is_synthetic, is_analytical, nature")
        .eq("is_active", true)
        .or("code.like.3%,code.like.4%")
        .order("code");

      if (accountsError) throw accountsError;

      // Buscar saldos para cada período
      const periodDataPromises = periods.map(async (period) => {
        const { data, error } = await supabase.rpc("get_account_balances", {
          p_period_start: period.start,
          p_period_end: period.end,
        });
        
        if (error) {
          console.error(`Erro ao carregar período ${period.key}:`, error);
          return { period, data: [] };
        }
        
        return { period, data: data || [] };
      });

      const periodResults = await Promise.all(periodDataPromises);

      // Processar dados por conta e período
      const accountMap = new Map<string, DRELineItem>();
      const periodSummaries: DREPeriodData[] = [];

      // Inicializar mapa de contas
      accounts?.forEach((acc) => {
        accountMap.set(acc.id, {
          account_code: acc.code,
          account_name: acc.name,
          account_id: acc.id,
          is_synthetic: acc.is_synthetic,
          values: {},
          percentages: {},
          children: [],
        });
      });

      // Processar cada período
      periodResults.forEach(({ period, data }) => {
        let totalRevenue = 0;
        let totalExpenses = 0;

        // Mapear valores por conta
        data.forEach((row: AccountBalance) => {
          const account = accountMap.get(row.account_id);
          if (!account) return;

          // Para DRE, usamos o movimento do período (débitos - créditos para despesa, créditos - débitos para receita)
          const isRevenue = account.account_code.startsWith("3");
          const value = isRevenue
            ? Number(row.total_credits) - Number(row.total_debits)
            : Number(row.total_debits) - Number(row.total_credits);

          // Só incluir valores positivos (movimento real) e apenas contas analíticas
          if (value > 0 && row.is_analytical) {
            account.values[period.key] = value;
            
            if (isRevenue) {
              totalRevenue += value;
            } else {
              totalExpenses += value;
            }
          }
        });

        // Calcular sintéticas (somando filhas)
        accounts?.filter(a => a.is_synthetic).forEach(synth => {
          const synthAccount = accountMap.get(synth.id);
          if (!synthAccount) return;

          const childSum = accounts
            .filter(a => a.code.startsWith(synth.code + ".") && !a.is_synthetic)
            .reduce((sum, child) => {
              const childAcc = accountMap.get(child.id);
              return sum + (childAcc?.values[period.key] || 0);
            }, 0);

          if (childSum > 0) {
            synthAccount.values[period.key] = childSum;
          }
        });

        periodSummaries.push({
          period: period.key,
          label: period.label,
          totalRevenue,
          totalExpenses,
          netResult: totalRevenue - totalExpenses,
        });
      });

      // Calcular percentuais (análise vertical)
      periodSummaries.forEach((summary) => {
        accountMap.forEach((account) => {
          const value = account.values[summary.period] || 0;
          if (summary.totalRevenue > 0) {
            account.percentages[summary.period] = (value / summary.totalRevenue) * 100;
          } else {
            // Sem receita no período → AV% não se aplica
            account.percentages[summary.period] = NaN;
          }
        });
      });

      // Organizar em estrutura hierárquica completa (sintéticas + analíticas)
      const hasValues = (item: DRELineItem) =>
        Object.values(item.values).some((v) => v > 0);

      const buildHierarchy = (prefix: string) => {
        const nodesByCode = new Map<string, DRELineItem>();
        const sortedAccounts = (accounts || [])
          .filter(acc => acc.code.startsWith(prefix))
          .sort((a, b) => a.code.localeCompare(b.code));

        sortedAccounts.forEach((acc) => {
          const item = accountMap.get(acc.id);
          if (!item) return;
          item.children = [];

          const include = hasValues(item) || acc.is_synthetic;
          if (!include) return;

          nodesByCode.set(acc.code, item);
        });

        const roots: DRELineItem[] = [];
        nodesByCode.forEach((node, code) => {
          const parentCode = code.split(".").slice(0, -1).join(".");
          if (parentCode && nodesByCode.has(parentCode)) {
            const parent = nodesByCode.get(parentCode)!;
            parent.children = parent.children || [];
            parent.children.push(node);
          } else {
            roots.push(node);
          }
        });

        const prune = (node: DRELineItem): DRELineItem | null => {
          const children = (node.children || [])
            .map(prune)
            .filter(Boolean) as DRELineItem[];
          node.children = children;

          const keep = hasValues(node) || children.length > 0;
          return keep ? node : null;
        };

        return roots
          .map(prune)
          .filter(Boolean) as DRELineItem[];
      };

      const revenues = buildHierarchy("3");
      const expenses = buildHierarchy("4");

      setDreStructure({
        revenues: revenues.sort((a, b) => a.account_code.localeCompare(b.account_code)),
        expenses: expenses.sort((a, b) => a.account_code.localeCompare(b.account_code)),
        periods: periodSummaries,
      });

    } catch (error) {
      console.error("Erro ao carregar DRE:", error);
      toast.error("Erro ao carregar dados do DRE");
    } finally {
      setLoading(false);
    }
  }, [generatePeriods]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadDREData();
  }, [loadDREData]);

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const toggleExpand = (code: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedAccounts(newExpanded);
  };

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const formatPercent = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return "-";
    return `${value.toFixed(1)}%`;
  };

  // Exportar para CSV
  const exportToCSV = () => {
    const headers = ["Conta", "Descrição", ...dreStructure.periods.map((p) => p.label), ...dreStructure.periods.map((p) => `AV% ${p.label}`)];
    const rows: string[][] = [];

    // Receitas
    rows.push(["", "RECEITAS OPERACIONAIS", ...dreStructure.periods.map(() => ""), ...dreStructure.periods.map(() => "")]);
    dreStructure.revenues.forEach((item) => {
      rows.push([
        item.account_code,
        item.account_name,
        ...dreStructure.periods.map((p) => (item.values[p.period] || 0).toFixed(2)),
        ...dreStructure.periods.map((p) => formatPercent(item.percentages[p.period] ?? 0)),
      ]);
      item.children?.forEach((child) => {
        rows.push([
          child.account_code,
          `  ${child.account_name}`,
          ...dreStructure.periods.map((p) => (child.values[p.period] || 0).toFixed(2)),
          ...dreStructure.periods.map((p) => formatPercent(child.percentages[p.period] ?? 0)),
        ]);
      });
    });
    rows.push([
      "",
      "TOTAL RECEITAS",
      ...dreStructure.periods.map((p) => p.totalRevenue.toFixed(2)),
      ...dreStructure.periods.map((p) => p.totalRevenue > 0 ? "100.0%" : "-"),
    ]);

    // Despesas
    rows.push(["", "", ...dreStructure.periods.map(() => ""), ...dreStructure.periods.map(() => "")]);
    rows.push(["", "DESPESAS OPERACIONAIS", ...dreStructure.periods.map(() => ""), ...dreStructure.periods.map(() => "")]);
    dreStructure.expenses.forEach((item) => {
      rows.push([
        item.account_code,
        item.account_name,
        ...dreStructure.periods.map((p) => (item.values[p.period] || 0).toFixed(2)),
        ...dreStructure.periods.map((p) => formatPercent(item.percentages[p.period] ?? 0)),
      ]);
      item.children?.forEach((child) => {
        rows.push([
          child.account_code,
          `  ${child.account_name}`,
          ...dreStructure.periods.map((p) => (child.values[p.period] || 0).toFixed(2)),
          ...dreStructure.periods.map((p) => formatPercent(child.percentages[p.period] ?? 0)),
        ]);
      });
    });
    rows.push([
      "",
      "TOTAL DESPESAS",
      ...dreStructure.periods.map((p) => p.totalExpenses.toFixed(2)),
      ...dreStructure.periods.map((p) => p.totalRevenue > 0 ? formatPercent((p.totalExpenses / p.totalRevenue) * 100) : "-"),
    ]);

    // Resultado
    rows.push(["", "", ...dreStructure.periods.map(() => ""), ...dreStructure.periods.map(() => "")]);
    rows.push([
      "",
      "RESULTADO LÍQUIDO",
      ...dreStructure.periods.map((p) => p.netResult.toFixed(2)),
      ...dreStructure.periods.map((p) => p.totalRevenue > 0 ? formatPercent((p.netResult / p.totalRevenue) * 100) : "-"),
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DRE_${selectedYear}_${startMonth}-${endMonth}.csv`;
    link.click();
  };

  // Renderizar linha de conta (hierarquia completa)
  const renderAccountRows = (
    item: DRELineItem,
    level: number,
    isExpense: boolean = false
  ): JSX.Element[] => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedAccounts.has(item.account_code);
    const nameIndent = level * 16;
    const codeIndent = level * 8;

    const row = (
      <TableRow
        key={item.account_code}
        className={`${item.is_synthetic ? "bg-muted/50 font-semibold" : "hover:bg-muted/30"}`}
      >
        <TableCell className="font-mono text-xs" style={{ paddingLeft: codeIndent }}>
          {item.account_code}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2" style={{ paddingLeft: nameIndent }}>
            {hasChildren && (
              <button
                onClick={() => toggleExpand(item.account_code)}
                className="p-0.5 hover:bg-muted rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            <span className={hasChildren ? "" : "pl-6"}>{item.account_name}</span>
          </div>
        </TableCell>
        {dreStructure.periods.map((period) => (
          <TableCell
            key={`${item.account_code}-${period.period}-value`}
            className={`text-right font-medium ${isExpense ? "text-red-600" : "text-green-600"}`}
          >
            {formatCurrency(item.values[period.period] || 0)}
          </TableCell>
        ))}
        {dreStructure.periods.map((period) => (
          <TableCell
            key={`${item.account_code}-${period.period}-pct`}
            className="text-right text-muted-foreground text-sm"
          >
            {formatPercent(item.percentages[period.period] ?? 0)}
          </TableCell>
        ))}
      </TableRow>
    );

    if (!hasChildren || !isExpanded) {
      return [row];
    }

    const childRows = item.children!.flatMap((child) =>
      renderAccountRows(child, level + 1, isExpense)
    );

    return [row, ...childRows];
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              DRE - Análise Vertical Comparativa
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Demonstração do Resultado do Exercício com análise vertical e comparativo mensal
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button onClick={() => loadDREData()} disabled={loading}>
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
              Período de Análise
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
                <label className="text-sm font-medium">Mês Inicial</label>
                <Select value={startMonth.toString()} onValueChange={(v) => setStartMonth(Number(v))}>
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
                <label className="text-sm font-medium">Mês Final</label>
                <Select value={endMonth.toString()} onValueChange={(v) => setEndMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()} disabled={i + 1 < startMonth}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Visualização</label>
                <Select value={periodType} onValueChange={(v) => setPeriodType(v as "monthly" | "quarterly" | "accumulated")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="accumulated">Acumulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Badge variant="outline" className="h-10 px-4">
                {dreStructure.periods.length} período(s)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dreStructure.periods.slice(-3).map((period) => (
                <Card key={period.period}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {period.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Receitas</span>
                      <span className="text-green-600 font-medium">{formatCurrency(period.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Despesas</span>
                      <span className="text-red-600 font-medium">({formatCurrency(period.totalExpenses)})</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-medium">Resultado</span>
                      <span className={`font-bold ${period.netResult >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {period.netResult >= 0 ? "" : "-"}{formatCurrency(Math.abs(period.netResult))}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Badge variant={period.netResult >= 0 ? "default" : "destructive"} className="text-xs">
                        {period.totalRevenue > 0 ? formatPercent((period.netResult / period.totalRevenue) * 100) : "-"} margem
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabela Principal do DRE */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Demonstração do Resultado do Exercício
                </CardTitle>
                <CardDescription>
                  Análise vertical com base na Receita Bruta = 100%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[100px]">Código</TableHead>
                        <TableHead className="min-w-[250px]">Descrição</TableHead>
                        {dreStructure.periods.map((p) => (
                          <TableHead key={`h-val-${p.period}`} className="text-right min-w-[120px]">
                            {p.label}
                          </TableHead>
                        ))}
                        {dreStructure.periods.map((p) => (
                          <TableHead key={`h-pct-${p.period}`} className="text-right min-w-[80px]">
                            <span className="flex items-center justify-end gap-1">
                              <Percent className="w-3 h-3" />
                              AV
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* RECEITAS */}
                      <TableRow className="bg-green-50 dark:bg-green-950/30">
                        <TableCell colSpan={2 + dreStructure.periods.length * 2} className="font-bold text-green-700">
                          <TrendingUp className="w-4 h-4 inline mr-2" />
                          RECEITAS OPERACIONAIS
                        </TableCell>
                      </TableRow>
                      {dreStructure.revenues.flatMap((item) => renderAccountRows(item, 0, false))}
                      <TableRow className="bg-green-100 dark:bg-green-900/30 font-bold">
                        <TableCell></TableCell>
                        <TableCell>TOTAL RECEITAS</TableCell>
                        {dreStructure.periods.map((p) => (
                          <TableCell key={`tot-rev-${p.period}`} className="text-right text-green-700">
                            {formatCurrency(p.totalRevenue)}
                          </TableCell>
                        ))}
                        {dreStructure.periods.map((p) => (
                          <TableCell key={`pct-rev-${p.period}`} className="text-right text-green-700">
                            {p.totalRevenue > 0 ? "100.0%" : "-"}
                          </TableCell>
                        ))}
                      </TableRow>

                      {/* Separador */}
                      <TableRow>
                        <TableCell colSpan={2 + dreStructure.periods.length * 2} className="h-4"></TableCell>
                      </TableRow>

                      {/* DESPESAS */}
                      <TableRow className="bg-red-50 dark:bg-red-950/30">
                        <TableCell colSpan={2 + dreStructure.periods.length * 2} className="font-bold text-red-700">
                          <TrendingDown className="w-4 h-4 inline mr-2" />
                          DESPESAS OPERACIONAIS
                        </TableCell>
                      </TableRow>
                      {dreStructure.expenses.flatMap((item) => renderAccountRows(item, 0, true))}
                      <TableRow className="bg-red-100 dark:bg-red-900/30 font-bold">
                        <TableCell></TableCell>
                        <TableCell>TOTAL DESPESAS</TableCell>
                        {dreStructure.periods.map((p) => (
                          <TableCell key={`tot-exp-${p.period}`} className="text-right text-red-700">
                            ({formatCurrency(p.totalExpenses)})
                          </TableCell>
                        ))}
                        {dreStructure.periods.map((p) => (
                          <TableCell key={`pct-exp-${p.period}`} className="text-right text-red-700">
                            {p.totalRevenue > 0 ? formatPercent((p.totalExpenses / p.totalRevenue) * 100) : "-"}
                          </TableCell>
                        ))}
                      </TableRow>

                      {/* Separador */}
                      <TableRow>
                        <TableCell colSpan={2 + dreStructure.periods.length * 2} className="h-4"></TableCell>
                      </TableRow>

                      {/* RESULTADO */}
                      <TableRow className="bg-primary/10 font-bold text-lg">
                        <TableCell></TableCell>
                        <TableCell className="text-primary">
                          {dreStructure.periods[dreStructure.periods.length - 1]?.netResult >= 0 ? (
                            <span className="flex items-center gap-2">
                              <TrendingUp className="w-5 h-5" />
                              LUCRO LÍQUIDO
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <TrendingDown className="w-5 h-5" />
                              PREJUÍZO LÍQUIDO
                            </span>
                          )}
                        </TableCell>
                        {dreStructure.periods.map((p) => (
                          <TableCell
                            key={`result-${p.period}`}
                            className={`text-right ${p.netResult >= 0 ? "text-green-700" : "text-red-700"}`}
                          >
                            {p.netResult >= 0 ? "" : "-"}{formatCurrency(Math.abs(p.netResult))}
                          </TableCell>
                        ))}
                        {dreStructure.periods.map((p) => (
                          <TableCell
                            key={`pct-result-${p.period}`}
                            className={`text-right ${p.netResult >= 0 ? "text-green-700" : "text-red-700"}`}
                          >
                            {p.totalRevenue > 0 ? formatPercent((p.netResult / p.totalRevenue) * 100) : "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Legenda */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    <span><strong>AV</strong> = Análise Vertical (% sobre Receita Bruta)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" />
                    <span>Clique nas setas para expandir contas sintéticas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">●</span>
                    <span>Receitas (Grupo 3)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">●</span>
                    <span>Despesas (Grupo 4)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default DREAnalytics;
