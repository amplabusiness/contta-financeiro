import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import {
  RefreshCw,
  Download,
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Building2,
  Wallet,
  CreditCard,
  PiggyBank,
  Percent,
  CheckCircle2,
  XCircle,
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
import { Progress } from "@/components/ui/progress";

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

interface BalanceSheetItem {
  code: string;
  name: string;
  value: number;
  previousValue: number;
  percentage: number;
  children?: BalanceSheetItem[];
  level: number;
  is_synthetic: boolean;
}

interface BalanceSheetData {
  ativoCirculante: BalanceSheetItem[];
  ativoNaoCirculante: BalanceSheetItem[];
  passivoCirculante: BalanceSheetItem[];
  passivoNaoCirculante: BalanceSheetItem[];
  patrimonioLiquido: BalanceSheetItem[];
  totals: {
    totalAtivo: number;
    totalAtivoCirculante: number;
    totalAtivoNaoCirculante: number;
    totalPassivo: number;
    totalPassivoCirculante: number;
    totalPassivoNaoCirculante: number;
    totalPL: number;
    totalPassivoMaisPL: number;
    resultadoExercicio: number;
    previousTotalAtivo: number;
    previousTotalPassivoMaisPL: number;
  };
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const BalancoPatrimonial = () => {
  // Estados de carregamento
  const [loading, setLoading] = useState(true);

  // Estados de dados principais
  const [data, setData] = useState<BalanceSheetData>({
    ativoCirculante: [],
    ativoNaoCirculante: [],
    passivoCirculante: [],
    passivoNaoCirculante: [],
    patrimonioLiquido: [],
    totals: {
      totalAtivo: 0,
      totalAtivoCirculante: 0,
      totalAtivoNaoCirculante: 0,
      totalPassivo: 0,
      totalPassivoCirculante: 0,
      totalPassivoNaoCirculante: 0,
      totalPL: 0,
      totalPassivoMaisPL: 0,
      resultadoExercicio: 0,
      previousTotalAtivo: 0,
      previousTotalPassivoMaisPL: 0,
    },
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([
    "ativo-circulante", "ativo-nao-circulante",
    "passivo-circulante", "passivo-nao-circulante", "pl"
  ]));
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [showComparison, setShowComparison] = useState(true);

  const years = [2024, 2025, 2026];

  // Datas do período atual
  const periodEnd = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`;
  const periodStart = `${selectedYear}-01-01`; // Início do ano para acumulado

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const getPreviousPeriod = useCallback(() => {
    let prevYear = selectedYear;
    let prevMonth = selectedMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    return {
      start: `${prevYear}-01-01`,
      end: `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${lastDay}`,
    };
  }, [selectedYear, selectedMonth]);

  // Carregar balanço patrimonial
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar contas do plano
      const { data: chartAccounts, error: chartError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, type, nature, is_synthetic, is_analytical")
        .eq("is_active", true)
        .or("code.like.1%,code.like.2%,code.like.5%")
        .order("code");

      if (chartError) throw chartError;

      // Buscar saldos do período atual
      const { data: currentBalances, error: currentError } = await supabase.rpc("get_account_balances", {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

      if (currentError) throw currentError;

      // Buscar saldos do período anterior
      const prevPeriod = getPreviousPeriod();
      const { data: previousBalances, error: previousError } = await supabase.rpc("get_account_balances", {
        p_period_start: prevPeriod.start,
        p_period_end: prevPeriod.end,
      });

      if (previousError) throw previousError;

      // Buscar resultado do exercício (receitas - despesas)
      const { data: dreBalances, error: dreError } = await supabase.rpc("get_account_balances", {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

      let resultadoExercicio = 0;
      if (!dreError && dreBalances) {
        dreBalances.forEach((b: AccountBalance) => {
          if (b.account_code.startsWith("3")) {
            // Receitas: créditos - débitos
            resultadoExercicio += (Number(b.total_credits) - Number(b.total_debits));
          } else if (b.account_code.startsWith("4") || b.account_code.startsWith("5")) {
            // Despesas/Custos: débitos - créditos
            resultadoExercicio -= (Number(b.total_debits) - Number(b.total_credits));
          }
        });
      }

      // Mapear saldos
      const currentMap = new Map<string, AccountBalance>();
      currentBalances?.forEach((b: AccountBalance) => currentMap.set(b.account_id, b));

      const previousMap = new Map<string, AccountBalance>();
      previousBalances?.forEach((b: AccountBalance) => previousMap.set(b.account_id, b));

      // Processar contas
      const ativoCirculante: BalanceSheetItem[] = [];
      const ativoNaoCirculante: BalanceSheetItem[] = [];
      const passivoCirculante: BalanceSheetItem[] = [];
      const passivoNaoCirculante: BalanceSheetItem[] = [];
      const patrimonioLiquido: BalanceSheetItem[] = [];

      let totalAtivoCirculante = 0;
      let totalAtivoNaoCirculante = 0;
      let totalPassivoCirculante = 0;
      let totalPassivoNaoCirculante = 0;
      let totalPL = 0;
      let prevTotalAtivo = 0;
      let prevTotalPassivoMaisPL = 0;

      chartAccounts?.forEach((acc) => {
        const current = currentMap.get(acc.id);
        const previous = previousMap.get(acc.id);
        
        const value = current?.closing_balance || 0;
        const prevValue = previous?.closing_balance || 0;
        const level = acc.code.split(".").length;

        // Só incluir contas com saldo ou sintéticas
        if (value === 0 && prevValue === 0 && !acc.is_synthetic) return;

        const item: BalanceSheetItem = {
          code: acc.code,
          name: acc.name,
          value: Math.abs(value),
          previousValue: Math.abs(prevValue),
          percentage: 0, // Calculado depois
          level,
          is_synthetic: acc.is_synthetic,
        };

        // Classificar por grupo
        if (acc.code.startsWith("1.1")) {
          ativoCirculante.push(item);
          if (!acc.is_synthetic) totalAtivoCirculante += Math.abs(value);
        } else if (acc.code.startsWith("1.2") || acc.code.startsWith("1.3") || acc.code.startsWith("1.4")) {
          ativoNaoCirculante.push(item);
          if (!acc.is_synthetic) totalAtivoNaoCirculante += Math.abs(value);
        } else if (acc.code.startsWith("2.1")) {
          passivoCirculante.push(item);
          if (!acc.is_synthetic) totalPassivoCirculante += Math.abs(value);
        } else if (acc.code.startsWith("2.2")) {
          passivoNaoCirculante.push(item);
          if (!acc.is_synthetic) totalPassivoNaoCirculante += Math.abs(value);
        } else if (acc.code.startsWith("2.3") || acc.code.startsWith("2.4") || acc.code.startsWith("2.5") || acc.code.startsWith("5")) {
          // Grupo 5 = Patrimônio Líquido (Lucros Acumulados, Capital, etc)
          patrimonioLiquido.push(item);
          if (!acc.is_synthetic) totalPL += Math.abs(value);
        }

        // Calcular totais anteriores
        if (acc.code.startsWith("1") && !acc.is_synthetic) {
          prevTotalAtivo += Math.abs(prevValue);
        } else if ((acc.code.startsWith("2") || acc.code.startsWith("5")) && !acc.is_synthetic) {
          // Grupos 2 (Passivo) e 5 (PL) vão para Passivo + PL
          prevTotalPassivoMaisPL += Math.abs(prevValue);
        }
      });

      const totalAtivo = totalAtivoCirculante + totalAtivoNaoCirculante;
      const totalPassivo = totalPassivoCirculante + totalPassivoNaoCirculante;
      const totalPassivoMaisPL = totalPassivo + totalPL + resultadoExercicio;

      // Calcular percentuais (análise vertical)
      const calcPercentage = (items: BalanceSheetItem[], total: number) => {
        items.forEach((item) => {
          item.percentage = total > 0 ? (item.value / total) * 100 : 0;
        });
      };

      calcPercentage(ativoCirculante, totalAtivo);
      calcPercentage(ativoNaoCirculante, totalAtivo);
      calcPercentage(passivoCirculante, totalPassivoMaisPL);
      calcPercentage(passivoNaoCirculante, totalPassivoMaisPL);
      calcPercentage(patrimonioLiquido, totalPassivoMaisPL);

      setData({
        ativoCirculante,
        ativoNaoCirculante,
        passivoCirculante,
        passivoNaoCirculante,
        patrimonioLiquido,
        totals: {
          totalAtivo,
          totalAtivoCirculante,
          totalAtivoNaoCirculante,
          totalPassivo,
          totalPassivoCirculante,
          totalPassivoNaoCirculante,
          totalPL,
          totalPassivoMaisPL,
          resultadoExercicio,
          previousTotalAtivo: prevTotalAtivo,
          previousTotalPassivoMaisPL: prevTotalPassivoMaisPL,
        },
      });

    } catch (error) {
      console.error("Erro ao carregar balanço:", error);
      toast.error("Erro ao carregar dados do Balanço Patrimonial");
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd, getPreviousPeriod]);

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

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const isBalanced = Math.abs(data.totals.totalAtivo - data.totals.totalPassivoMaisPL) < 0.01;

  const formatPercent = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return "-";
    return `${value.toFixed(1)}%`;
  };

  // Exportar para CSV
  const exportToCSV = () => {
    const headers = ["Código", "Conta", "Saldo Atual", "AV%", "Saldo Anterior", "Variação%"];
    const rows: string[][] = [];

    const addSection = (title: string, items: BalanceSheetItem[]) => {
      rows.push([title, "", "", "", "", ""]);
      items.forEach((item) => {
        const variation = item.previousValue > 0 
          ? ((item.value - item.previousValue) / item.previousValue * 100).toFixed(1) + "%"
          : "-";
        rows.push([
          item.code,
          item.name,
          item.value.toFixed(2),
          formatPercent(item.percentage),
          item.previousValue.toFixed(2),
          variation,
        ]);
      });
    };

    rows.push(["BALANÇO PATRIMONIAL", "", "", "", "", ""]);
    rows.push([`${MONTHS[selectedMonth - 1]}/${selectedYear}`, "", "", "", "", ""]);
    rows.push(["", "", "", "", "", ""]);

    rows.push(["ATIVO", "", "", "", "", ""]);
    addSection("ATIVO CIRCULANTE", data.ativoCirculante);
    rows.push(["TOTAL ATIVO CIRCULANTE", "", data.totals.totalAtivoCirculante.toFixed(2), "", "", ""]);
    addSection("ATIVO NÃO CIRCULANTE", data.ativoNaoCirculante);
    rows.push(["TOTAL ATIVO NÃO CIRCULANTE", "", data.totals.totalAtivoNaoCirculante.toFixed(2), "", "", ""]);
    rows.push(["TOTAL DO ATIVO", "", data.totals.totalAtivo.toFixed(2), "100.0%", "", ""]);
    
    rows.push(["", "", "", "", "", ""]);
    rows.push(["PASSIVO E PATRIMÔNIO LÍQUIDO", "", "", "", "", ""]);
    addSection("PASSIVO CIRCULANTE", data.passivoCirculante);
    rows.push(["TOTAL PASSIVO CIRCULANTE", "", data.totals.totalPassivoCirculante.toFixed(2), "", "", ""]);
    addSection("PASSIVO NÃO CIRCULANTE", data.passivoNaoCirculante);
    rows.push(["TOTAL PASSIVO NÃO CIRCULANTE", "", data.totals.totalPassivoNaoCirculante.toFixed(2), "", "", ""]);
    addSection("PATRIMÔNIO LÍQUIDO", data.patrimonioLiquido);
    rows.push(["Resultado do Exercício", "", data.totals.resultadoExercicio.toFixed(2), "", "", ""]);
    rows.push(["TOTAL PATRIMÔNIO LÍQUIDO", "", (data.totals.totalPL + data.totals.resultadoExercicio).toFixed(2), "", "", ""]);
    rows.push(["TOTAL PASSIVO + PL", "", data.totals.totalPassivoMaisPL.toFixed(2), "100.0%", "", ""]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Balanco_Patrimonial_${selectedYear}_${selectedMonth}.csv`;
    link.click();
  };

  // Renderizar linha de conta
  const renderRow = (item: BalanceSheetItem, isPassivo: boolean = false) => {
    const indent = (item.level - 2) * 16;
    const variation = item.previousValue > 0 
      ? ((item.value - item.previousValue) / item.previousValue * 100)
      : 0;

    return (
      <TableRow 
        key={item.code}
        className={`
          ${item.is_synthetic ? "bg-muted/30 font-semibold" : "hover:bg-muted/20"}
          ${item.level === 2 ? "bg-muted/50 font-bold" : ""}
        `}
      >
        <TableCell className="font-mono text-xs">{item.code}</TableCell>
        <TableCell>
          <div style={{ paddingLeft: Math.max(0, indent) }}>{item.name}</div>
        </TableCell>
        <TableCell className={`text-right font-medium ${isPassivo ? "text-red-600" : "text-blue-600"}`}>
          {item.value > 0 ? formatCurrency(item.value) : "-"}
        </TableCell>
        <TableCell className="text-right text-muted-foreground text-sm">
          {formatPercent(item.percentage)}
        </TableCell>
        {showComparison && (
          <>
            <TableCell className="text-right text-muted-foreground">
              {item.previousValue > 0 ? formatCurrency(item.previousValue) : "-"}
            </TableCell>
            <TableCell className="text-right">
              {variation !== 0 && (
                <span className={variation > 0 ? "text-green-600" : "text-red-600"}>
                  {variation > 0 ? "+" : ""}{variation.toFixed(1)}%
                </span>
              )}
            </TableCell>
          </>
        )}
      </TableRow>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Balanço Patrimonial
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Posição patrimonial e financeira da empresa
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

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Data Base
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="comparison"
                  checked={showComparison}
                  onChange={(e) => setShowComparison(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="comparison" className="text-sm">Mostrar comparativo</label>
              </div>

              <Badge 
                variant={isBalanced ? "default" : "destructive"} 
                className="h-10 px-4 flex items-center gap-2"
              >
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Equilibrado
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Diferença: {formatCurrency(Math.abs(data.totals.totalAtivo - data.totals.totalPassivoMaisPL))}
                  </>
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ativo</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.totals.totalAtivo)}</p>
                  </div>
                </div>
                <Progress 
                  value={(data.totals.totalAtivoCirculante / data.totals.totalAtivo) * 100} 
                  className="mt-3 h-2" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPercent((data.totals.totalAtivoCirculante / data.totals.totalAtivo) * 100)} circulante
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <CreditCard className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Passivo</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totals.totalPassivo)}</p>
                  </div>
                </div>
                <Progress 
                  value={(data.totals.totalPassivoCirculante / data.totals.totalPassivo) * 100} 
                  className="mt-3 h-2" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPercent((data.totals.totalPassivoCirculante / data.totals.totalPassivo) * 100)} circulante
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <PiggyBank className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Patrimônio Líquido</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(data.totals.totalPL + data.totals.resultadoExercicio)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Resultado do exercício: 
                  <span className={data.totals.resultadoExercicio >= 0 ? "text-green-600" : "text-red-600"}>
                    {" "}{formatCurrency(data.totals.resultadoExercicio)}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Building2 className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Índice de Liquidez</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {data.totals.totalPassivoCirculante > 0 
                        ? (data.totals.totalAtivoCirculante / data.totals.totalPassivoCirculante).toFixed(2)
                        : "-"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Liquidez corrente (AC / PC)
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ATIVO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Wallet className="w-5 h-5" />
                  ATIVO
                </CardTitle>
                <CardDescription>
                  Bens e direitos - {MONTHS[selectedMonth - 1]}/{selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50 dark:bg-blue-950/30">
                      <TableHead className="w-[80px]">Código</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right w-[100px]">Saldo</TableHead>
                      <TableHead className="text-right w-[60px]">AV%</TableHead>
                      {showComparison && (
                        <>
                          <TableHead className="text-right w-[100px]">Anterior</TableHead>
                          <TableHead className="text-right w-[60px]">Var%</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Ativo Circulante */}
                    <TableRow className="bg-blue-100/50 dark:bg-blue-900/20 font-bold">
                      <TableCell colSpan={showComparison ? 6 : 4}>
                        <button 
                          onClick={() => toggleGroup("ativo-circulante")}
                          className="flex items-center gap-2"
                        >
                          {expandedGroups.has("ativo-circulante") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          ATIVO CIRCULANTE
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedGroups.has("ativo-circulante") && data.ativoCirculante.map((item) => renderRow(item))}
                    <TableRow className="bg-blue-50 dark:bg-blue-950/30 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>Subtotal Circulante</TableCell>
                      <TableCell className="text-right text-blue-700">{formatCurrency(data.totals.totalAtivoCirculante)}</TableCell>
                      <TableCell className="text-right">{formatPercent((data.totals.totalAtivoCirculante / data.totals.totalAtivo) * 100)}</TableCell>
                      {showComparison && <TableCell colSpan={2}></TableCell>}
                    </TableRow>

                    {/* Ativo Não Circulante */}
                    <TableRow className="bg-blue-100/50 dark:bg-blue-900/20 font-bold">
                      <TableCell colSpan={showComparison ? 6 : 4}>
                        <button 
                          onClick={() => toggleGroup("ativo-nao-circulante")}
                          className="flex items-center gap-2"
                        >
                          {expandedGroups.has("ativo-nao-circulante") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          ATIVO NÃO CIRCULANTE
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedGroups.has("ativo-nao-circulante") && data.ativoNaoCirculante.map((item) => renderRow(item))}
                    <TableRow className="bg-blue-50 dark:bg-blue-950/30 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>Subtotal Não Circulante</TableCell>
                      <TableCell className="text-right text-blue-700">{formatCurrency(data.totals.totalAtivoNaoCirculante)}</TableCell>
                      <TableCell className="text-right">{formatPercent((data.totals.totalAtivoNaoCirculante / data.totals.totalAtivo) * 100)}</TableCell>
                      {showComparison && <TableCell colSpan={2}></TableCell>}
                    </TableRow>

                    {/* Total Ativo */}
                    <TableRow className="bg-blue-200 dark:bg-blue-800/30 font-bold text-lg">
                      <TableCell></TableCell>
                      <TableCell>TOTAL DO ATIVO</TableCell>
                      <TableCell className="text-right text-blue-800">{formatCurrency(data.totals.totalAtivo)}</TableCell>
                      <TableCell className="text-right">100.0%</TableCell>
                      {showComparison && (
                        <>
                          <TableCell className="text-right">{formatCurrency(data.totals.previousTotalAtivo)}</TableCell>
                          <TableCell></TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* PASSIVO + PL */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <CreditCard className="w-5 h-5" />
                  PASSIVO + PATRIMÔNIO LÍQUIDO
                </CardTitle>
                <CardDescription>
                  Obrigações e capital próprio - {MONTHS[selectedMonth - 1]}/{selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50 dark:bg-red-950/30">
                      <TableHead className="w-[80px]">Código</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right w-[100px]">Saldo</TableHead>
                      <TableHead className="text-right w-[60px]">AV%</TableHead>
                      {showComparison && (
                        <>
                          <TableHead className="text-right w-[100px]">Anterior</TableHead>
                          <TableHead className="text-right w-[60px]">Var%</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Passivo Circulante */}
                    <TableRow className="bg-red-100/50 dark:bg-red-900/20 font-bold">
                      <TableCell colSpan={showComparison ? 6 : 4}>
                        <button 
                          onClick={() => toggleGroup("passivo-circulante")}
                          className="flex items-center gap-2"
                        >
                          {expandedGroups.has("passivo-circulante") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          PASSIVO CIRCULANTE
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedGroups.has("passivo-circulante") && data.passivoCirculante.map((item) => renderRow(item, true))}
                    <TableRow className="bg-red-50 dark:bg-red-950/30 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>Subtotal Circulante</TableCell>
                      <TableCell className="text-right text-red-700">{formatCurrency(data.totals.totalPassivoCirculante)}</TableCell>
                      <TableCell className="text-right">{formatPercent((data.totals.totalPassivoCirculante / data.totals.totalPassivoMaisPL) * 100)}</TableCell>
                      {showComparison && <TableCell colSpan={2}></TableCell>}
                    </TableRow>

                    {/* Passivo Não Circulante */}
                    <TableRow className="bg-red-100/50 dark:bg-red-900/20 font-bold">
                      <TableCell colSpan={showComparison ? 6 : 4}>
                        <button 
                          onClick={() => toggleGroup("passivo-nao-circulante")}
                          className="flex items-center gap-2"
                        >
                          {expandedGroups.has("passivo-nao-circulante") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          PASSIVO NÃO CIRCULANTE
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedGroups.has("passivo-nao-circulante") && data.passivoNaoCirculante.map((item) => renderRow(item, true))}
                    <TableRow className="bg-red-50 dark:bg-red-950/30 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>Subtotal Não Circulante</TableCell>
                      <TableCell className="text-right text-red-700">{formatCurrency(data.totals.totalPassivoNaoCirculante)}</TableCell>
                      <TableCell className="text-right">{formatPercent((data.totals.totalPassivoNaoCirculante / data.totals.totalPassivoMaisPL) * 100)}</TableCell>
                      {showComparison && <TableCell colSpan={2}></TableCell>}
                    </TableRow>

                    {/* Patrimônio Líquido */}
                    <TableRow className="bg-green-100/50 dark:bg-green-900/20 font-bold">
                      <TableCell colSpan={showComparison ? 6 : 4}>
                        <button 
                          onClick={() => toggleGroup("pl")}
                          className="flex items-center gap-2"
                        >
                          {expandedGroups.has("pl") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <PiggyBank className="w-4 h-4" />
                          PATRIMÔNIO LÍQUIDO
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedGroups.has("pl") && data.patrimonioLiquido.map((item) => renderRow(item))}
                    {expandedGroups.has("pl") && (
                      <TableRow className="hover:bg-muted/20">
                        <TableCell className="font-mono text-xs">-</TableCell>
                        <TableCell className="italic">Resultado do Exercício</TableCell>
                        <TableCell className={`text-right font-medium ${data.totals.resultadoExercicio >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(data.totals.resultadoExercicio)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent((data.totals.resultadoExercicio / data.totals.totalPassivoMaisPL) * 100)}
                        </TableCell>
                        {showComparison && <TableCell colSpan={2}></TableCell>}
                      </TableRow>
                    )}
                    <TableRow className="bg-green-50 dark:bg-green-950/30 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>Subtotal PL</TableCell>
                      <TableCell className="text-right text-green-700">
                        {formatCurrency(data.totals.totalPL + data.totals.resultadoExercicio)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(((data.totals.totalPL + data.totals.resultadoExercicio) / data.totals.totalPassivoMaisPL) * 100)}
                      </TableCell>
                      {showComparison && <TableCell colSpan={2}></TableCell>}
                    </TableRow>

                    {/* Total Passivo + PL */}
                    <TableRow className="bg-purple-200 dark:bg-purple-800/30 font-bold text-lg">
                      <TableCell></TableCell>
                      <TableCell>TOTAL PASSIVO + PL</TableCell>
                      <TableCell className="text-right text-purple-800">{formatCurrency(data.totals.totalPassivoMaisPL)}</TableCell>
                      <TableCell className="text-right">100.0%</TableCell>
                      {showComparison && (
                        <>
                          <TableCell className="text-right">{formatCurrency(data.totals.previousTotalPassivoMaisPL)}</TableCell>
                          <TableCell></TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Legenda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                <span><strong>AV%</strong> = Análise Vertical (% sobre total do grupo)</span>
              </div>
              <div className="flex items-center gap-2">
                <span><strong>Var%</strong> = Variação em relação ao período anterior</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Ativo = Passivo + PL (Equilibrado)</span>
              </div>
              <div className="flex items-center gap-2">
                <span><strong>Liquidez Corrente</strong> = AC / PC (ideal &gt; 1,0)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default BalancoPatrimonial;
