import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, RefreshCw, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getExpenses } from "@/lib/accountMapping";

// Interfaces
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

const Expenses = () => {
  const { selectedYear, selectedMonth } = usePeriod();

  // Estados de carregamento
  const [loading, setLoading] = useState(true);

  // Estados de dados principais
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

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
  // FUNÇÕES AUXILIARES
  // =====================================================

  const getFormattedPeriod = () => {
    if (selectedMonth && selectedYear) {
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      return `${monthNames[selectedMonth - 1]} de ${selectedYear}`;
    }
    if (selectedYear) {
      return `Ano ${selectedYear}`;
    }
    return "Período atual";
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Despesas</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Análise de despesas • Fonte da Verdade: accounting_entries
            </p>
          </div>
        </div>

        {(selectedYear || selectedMonth) && (
          <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
            <span className="font-medium">Filtros ativos:</span>
            {selectedYear && <Badge variant="secondary">Ano: {selectedYear}</Badge>}
            {selectedMonth && <Badge variant="secondary">Mês: {selectedMonth}</Badge>}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar por período</CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
          </CardContent>
        </Card>

        {/* Razão Contábil - Resumo */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle>Despesas do Período - Contas do Grupo 4.*</CardTitle>
            </div>
            <CardDescription>
              {getFormattedPeriod()} • Débitos em contas de despesas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">Total de Despesas</p>
                <p className="text-3xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {entries.length} lançamentos
                </p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">Categorias</p>
                <p className="text-3xl font-bold">{summary.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contas contábeis diferentes
                </p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">Média por Categoria</p>
                <p className="text-3xl font-bold text-orange-600">
                  {formatCurrency(summary.length > 0 ? totalExpenses / summary.length : 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Por conta contábil
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs para Lançamentos vs Resumo */}
        <Tabs defaultValue="lancamentos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lancamentos">
              Lançamentos ({entries.length})
            </TabsTrigger>
            <TabsTrigger value="resumo">
              Resumo por Conta ({summary.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab: Lançamentos */}
          <TabsContent value="lancamentos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Lançamentos de Despesas</CardTitle>
                  <CardDescription>
                    Débitos em contas do grupo 4.* (despesas)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadExpenses}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : entries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-2">
                      Nenhuma despesa encontrada no período
                    </p>
                    <p className="text-sm text-muted-foreground">
                      As despesas são débitos em contas do grupo 4.* (accounting_entries)
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Conta Contábil</TableHead>
                        <TableHead>Centro de Custo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {new Date(entry.date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate" title={entry.description}>
                            {entry.description}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground mr-1">
                              {entry.accountCode}
                            </span>
                            <span className="text-sm">{entry.accountName}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.costCenterName || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {entry.entryType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(entry.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Resumo por Conta */}
          <TabsContent value="resumo">
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Conta Contábil</CardTitle>
                <CardDescription>
                  Agrupamento das despesas por classificação contábil
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma despesa no período
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Conta Contábil</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {item.accountCode}
                          </TableCell>
                          <TableCell className="font-medium">{item.accountName}</TableCell>
                          <TableCell className="text-center">{item.count}</TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(item.total)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell></TableCell>
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-center">
                          {summary.reduce((sum, s) => sum + s.count, 0)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(totalExpenses)}
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
