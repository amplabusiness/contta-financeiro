import { useEffect, useState, useCallback, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingDown, 
  RefreshCw, 
  BookOpen, 
  Brain,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Layers,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Search,
  Filter,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getExpenses } from "@/lib/accountMapping";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// INTERFACES
// ============================================================================

interface ExpenseEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  costCenterName?: string;
  entryType: string;
}

interface ExpenseSummary {
  accountCode: string;
  accountName: string;
  total: number;
  count: number;
}

// ============================================================================
// COMPONENTES MAESTRO UX
// ============================================================================

/**
 * KPIDespesa - Cards de KPI seguindo Brand Book Contta
 * Variantes: default | elevated | accent
 */
interface KPIDespesaProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean; // Para despesas, negativo é bom (redução)
  };
  variant?: "default" | "elevated" | "accent" | "warning";
}

const KPIDespesa = ({ title, value, subtitle, icon, trend, variant = "default" }: KPIDespesaProps) => {
  const variantStyles = {
    default: "bg-card border",
    elevated: "bg-card border shadow-md",
    accent: "bg-[#0a8fc5]/5 border-[#0a8fc5]/20",
    warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
  };

  return (
    <Card className={`${variantStyles[variant]} transition-all duration-200 hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold font-mono tracking-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${
                trend.isPositive ? "text-emerald-600" : "text-red-600"
              }`}>
                {trend.isPositive ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : (
                  <ArrowUpRight className="h-3 w-3" />
                )}
                <span>{Math.abs(trend.value).toFixed(1)}% vs período anterior</span>
              </div>
            )}
          </div>
          <div className="p-2 bg-muted rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * DrCiceroInsights - Seção de insights do Dr. Cícero
 * Cor violeta #7c3aed conforme Brand Book
 */
interface DrCiceroInsightsProps {
  totalDespesas: number;
  categorias: number;
  maiorCategoria?: ExpenseSummary;
  entries: ExpenseEntry[];
  selectedMonth?: number | null;
}

const DrCiceroInsights = ({ 
  totalDespesas, 
  categorias, 
  maiorCategoria,
  entries,
  selectedMonth
}: DrCiceroInsightsProps) => {
  const insights = useMemo(() => {
    const alertas: { tipo: "alerta" | "oportunidade" | "info"; mensagem: string }[] = [];
    
    // Análise de concentração de despesas
    if (maiorCategoria && totalDespesas > 0) {
      const percentual = (maiorCategoria.total / totalDespesas) * 100;
      if (percentual > 50) {
        alertas.push({
          tipo: "alerta",
          mensagem: `${maiorCategoria.accountName} representa ${percentual.toFixed(1)}% das despesas - concentração elevada`
        });
      }
    }

    // Análise de volume de lançamentos
    if (entries.length > 100) {
      alertas.push({
        tipo: "info",
        mensagem: `${entries.length} lançamentos no período - considere agrupar por categoria para análise`
      });
    }

    // Análise de categorias
    if (categorias <= 3 && totalDespesas > 10000) {
      alertas.push({
        tipo: "oportunidade",
        mensagem: "Poucas categorias de despesas - verifique se a classificação está correta"
      });
    }

    // Análise de período mensal
    if (selectedMonth && totalDespesas > 0) {
      const mediaEsperada = 50000; // Média estimada mensal
      if (totalDespesas > mediaEsperada * 1.3) {
        alertas.push({
          tipo: "alerta",
          mensagem: "Despesas 30% acima da média esperada - revisar lançamentos atípicos"
        });
      }
    }

    // Se não houver alertas, dar feedback positivo
    if (alertas.length === 0 && totalDespesas > 0) {
      alertas.push({
        tipo: "oportunidade",
        mensagem: "Despesas dentro dos parâmetros normais. Continue monitorando por categoria."
      });
    }

    return alertas;
  }, [totalDespesas, categorias, maiorCategoria, entries, selectedMonth]);

  if (insights.length === 0) return null;

  return (
    <Card className="border-[#7c3aed]/20 bg-gradient-to-r from-[#7c3aed]/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#7c3aed]/10 rounded-lg">
            <Brain className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-[#7c3aed]">
              Dr. Cícero • Análise de Despesas
            </CardTitle>
            <CardDescription className="text-xs">
              Insights automáticos baseados nos dados contábeis
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                insight.tipo === "alerta"
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                  : insight.tipo === "oportunidade"
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
              }`}
            >
              {insight.tipo === "alerta" ? (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{insight.mensagem}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * BadgeTipoDespesa - Badge para tipo de despesa
 */
const BadgeTipoDespesa = ({ tipo }: { tipo: string }) => {
  const tipoLower = tipo.toLowerCase();
  
  if (tipoLower.includes("manual")) {
    return (
      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
        Manual
      </Badge>
    );
  }
  
  if (tipoLower.includes("ofx") || tipoLower.includes("import")) {
    return (
      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
        Importação
      </Badge>
    );
  }

  if (tipoLower.includes("class")) {
    return (
      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
        Classificação
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs">
      {tipo}
    </Badge>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const ExpensesNew = () => {
  const { selectedYear, selectedMonth } = usePeriod();

  // Estados de carregamento
  const [loading, setLoading] = useState(true);

  // Estados de dados principais
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Estados de filtro e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);

      const year = selectedYear || new Date().getFullYear();
      const month = selectedMonth || undefined;

      const data = await getExpenses(year, month);

      setEntries(data.entries);
      setSummary(data.summary);
      setTotalExpenses(data.totalExpenses);
    } catch (error: any) {
      console.error("Erro ao carregar despesas:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // =====================================================
  // CÁLCULOS E DERIVAÇÕES
  // =====================================================

  const maiorCategoria = useMemo(() => {
    if (summary.length === 0) return undefined;
    return summary.reduce((max, item) => item.total > max.total ? item : max, summary[0]);
  }, [summary]);

  const filteredEntries = useMemo(() => {
    let result = entries;

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(term) ||
          e.accountName.toLowerCase().includes(term) ||
          e.accountCode.includes(term)
      );
    }

    // Filtro por categoria
    if (selectedCategory) {
      result = result.filter((e) => e.accountCode === selectedCategory);
    }

    return result;
  }, [entries, searchTerm, selectedCategory]);

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const getFormattedPeriod = () => {
    if (selectedMonth && selectedYear) {
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      return `${monthNames[selectedMonth - 1]} de ${selectedYear}`;
    }
    if (selectedYear) {
      return `Ano ${selectedYear}`;
    }
    return "Período atual";
  };

  const exportToCSV = () => {
    const headers = ["Data", "Descrição", "Conta", "Centro de Custo", "Tipo", "Valor"];
    const rows = filteredEntries.map((e) => [
      new Date(e.date).toLocaleDateString("pt-BR"),
      e.description,
      `${e.accountCode} - ${e.accountName}`,
      e.costCenterName || "-",
      e.entryType,
      e.amount.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despesas_${getFormattedPeriod().replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* ============================================
            HEADER - Título e ações globais
            ============================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
                Despesas
              </h1>
              <Badge variant="outline" className="text-xs font-normal">
                Grupo 4.*
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Análise de despesas • {getFormattedPeriod()} • Fonte: accounting_entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    disabled={filteredEntries.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar despesas para CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadExpenses}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recarregar dados</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* ============================================
            FILTROS DE PERÍODO
            ============================================ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Período</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <PeriodFilter />
            {(selectedYear || selectedMonth) && (
              <div className="flex items-center gap-2 text-sm text-[#0a8fc5] mt-3 pt-3 border-t">
                <span className="font-medium">Filtros ativos:</span>
                {selectedYear && <Badge variant="secondary">Ano: {selectedYear}</Badge>}
                {selectedMonth && <Badge variant="secondary">Mês: {selectedMonth}</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================
            KPIs - Visão geral das despesas
            ============================================ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPIDespesa
            title="Total de Despesas"
            value={formatCurrency(totalExpenses)}
            subtitle={`${entries.length} lançamentos`}
            icon={<DollarSign className="h-5 w-5 text-red-600" />}
            variant="elevated"
          />
          <KPIDespesa
            title="Categorias"
            value={summary.length}
            subtitle="Contas contábeis"
            icon={<Layers className="h-5 w-5 text-[#0a8fc5]" />}
          />
          <KPIDespesa
            title="Média por Categoria"
            value={formatCurrency(summary.length > 0 ? totalExpenses / summary.length : 0)}
            subtitle="Por conta contábil"
            icon={<PieChart className="h-5 w-5 text-amber-600" />}
          />
          <KPIDespesa
            title="Maior Despesa"
            value={maiorCategoria ? formatCurrency(maiorCategoria.total) : "R$ 0,00"}
            subtitle={maiorCategoria?.accountName || "Nenhuma"}
            icon={<TrendingUp className="h-5 w-5 text-red-500" />}
            variant={maiorCategoria && (maiorCategoria.total / totalExpenses) > 0.5 ? "warning" : "default"}
          />
        </div>

        {/* ============================================
            DR. CÍCERO - Insights automáticos
            ============================================ */}
        <DrCiceroInsights
          totalDespesas={totalExpenses}
          categorias={summary.length}
          maiorCategoria={maiorCategoria}
          entries={entries}
          selectedMonth={selectedMonth}
        />

        {/* ============================================
            TABS - Lançamentos e Resumo
            ============================================ */}
        <Tabs defaultValue="lancamentos" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="lancamentos" className="data-[state=active]:bg-white">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Lançamentos ({filteredEntries.length})
            </TabsTrigger>
            <TabsTrigger value="resumo" className="data-[state=active]:bg-white">
              <PieChart className="h-4 w-4 mr-2" />
              Resumo ({summary.length})
            </TabsTrigger>
          </TabsList>

          {/* ============================================
              TAB: Lançamentos detalhados
              ============================================ */}
          <TabsContent value="lancamentos">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-[#0a8fc5]" />
                      Lançamentos de Despesas
                    </CardTitle>
                    <CardDescription>
                      Débitos em contas do grupo 4.* (despesas operacionais e não operacionais)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar descrição ou conta..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-[250px]"
                      />
                    </div>
                    {selectedCategory && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCategory(null)}
                        className="text-xs"
                      >
                        Limpar filtro
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Carregando despesas...</span>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingDown className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground font-medium mb-1">
                      Nenhuma despesa encontrada
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {searchTerm || selectedCategory
                        ? "Tente ajustar os filtros de busca"
                        : "As despesas são débitos em contas do grupo 4.*"}
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">Data</TableHead>
                          <TableHead className="font-semibold">Descrição</TableHead>
                          <TableHead className="font-semibold">Conta Contábil</TableHead>
                          <TableHead className="font-semibold">Centro de Custo</TableHead>
                          <TableHead className="font-semibold">Tipo</TableHead>
                          <TableHead className="text-right font-semibold">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map((entry) => (
                          <TableRow
                            key={entry.id}
                            className="hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedCategory(entry.accountCode)}
                          >
                            <TableCell className="font-mono text-sm">
                              {new Date(entry.date).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate block">{entry.description}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-md">
                                    {entry.description}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {entry.accountCode}
                                </span>
                                <span className="text-sm">{entry.accountName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.costCenterName || (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <BadgeTipoDespesa tipo={entry.entryType} />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono font-semibold text-red-600">
                                {formatCurrency(entry.amount)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================
              TAB: Resumo por Conta
              ============================================ */}
          <TabsContent value="resumo">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-[#0a8fc5]" />
                  Resumo por Conta Contábil
                </CardTitle>
                <CardDescription>
                  Agrupamento das despesas por classificação contábil • Clique para filtrar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary.length === 0 ? (
                  <div className="text-center py-12">
                    <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Nenhuma despesa no período</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">Código</TableHead>
                          <TableHead className="font-semibold">Conta Contábil</TableHead>
                          <TableHead className="text-center font-semibold">Qtd</TableHead>
                          <TableHead className="text-right font-semibold">Total</TableHead>
                          <TableHead className="text-right font-semibold">% Total</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary
                          .sort((a, b) => b.total - a.total)
                          .map((item, idx) => {
                            const percentual = totalExpenses > 0 
                              ? (item.total / totalExpenses) * 100 
                              : 0;
                            const isHighConcentration = percentual > 30;
                            
                            return (
                              <TableRow
                                key={idx}
                                className={`hover:bg-muted/50 transition-colors cursor-pointer ${
                                  selectedCategory === item.accountCode ? "bg-[#0a8fc5]/5" : ""
                                }`}
                                onClick={() => {
                                  setSelectedCategory(item.accountCode);
                                  // Mudar para tab de lançamentos
                                  document.querySelector('[data-state="inactive"][value="lancamentos"]')
                                    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                }}
                              >
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {item.accountCode}
                                </TableCell>
                                <TableCell className="font-medium">{item.accountName}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="font-mono">
                                    {item.count}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className="font-mono font-semibold text-red-600">
                                    {formatCurrency(item.total)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          isHighConcentration ? "bg-amber-500" : "bg-[#0a8fc5]"
                                        }`}
                                        style={{ width: `${Math.min(percentual, 100)}%` }}
                                      />
                                    </div>
                                    <span className={`text-sm font-mono ${
                                      isHighConcentration ? "text-amber-600 font-semibold" : ""
                                    }`}>
                                      {percentual.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <Search className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Ver lançamentos</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {/* Linha de Total */}
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell></TableCell>
                          <TableCell className="text-base">TOTAL</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="default" className="font-mono">
                              {summary.reduce((sum, s) => sum + s.count, 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-lg text-red-600">
                              {formatCurrency(totalExpenses)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">100%</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ExpensesNew;
