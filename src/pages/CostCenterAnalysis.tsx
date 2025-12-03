import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const CostCenterAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [costCenterData, setCostCenterData] = useState<any[]>([]);
  const [costCenterWithoutData, setCostCenterWithoutData] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [allCostCenters, setAllCostCenters] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth_, setSelectedMonth_] = useState<string | null>(null);

  const months = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  useEffect(() => {
    loadAllCostCenters().then((centers) => {
      loadCostCenterData(centers);
    });
  }, [selectedYear, selectedMonth_]);

  // Calcular centros sem movimentação
  useEffect(() => {
    if (allCostCenters.length > 0 && costCenterData.length >= 0) {
      const centrosComDados = new Set(costCenterData.map(c => c.code));
      const centersSemDados = allCostCenters.filter(
        center => !centrosComDados.has(center.code)
      );
      setCostCenterWithoutData(centersSemDados);
    }
  }, [allCostCenters, costCenterData]);

  const loadAllCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name, description, default_chart_account_id, is_active, parent_id")
        .eq("is_active", true)
        .order("order_index, code");

      if (error) throw error;

      // Enriquecer com nomes das contas padrão
      const enriched = await Promise.all(
        (data || []).map(async (center) => {
          let accountName = "";
          if (center.default_chart_account_id) {
            const { data: account } = await supabase
              .from("chart_of_accounts")
              .select("code, name")
              .eq("id", center.default_chart_account_id)
              .limit(1)
              .single();
            accountName = account ? `${account.code} - ${account.name}` : "";
          }
          return { ...center, accountName };
        })
      );

      setAllCostCenters(enriched);
      return enriched;
    } catch (error: any) {
      console.error("Erro ao carregar centros de custo:", error);
      toast.error("Erro ao carregar centros de custo");
      return [];
    }
  };

  const loadCostCenterData = async (centersParam?: any[]) => {
    const costCentersToUse = centersParam || allCostCenters;
    try {
      setLoading(true);

      // Buscar despesas pagas com centros de custo
      let query = supabase
        .from("vw_expenses_with_accounts")
        .select("*")
        .eq("status", "paid");

      if (selectedMonth_) {
        // Se houver filtro de mês específico
        const competence = `${selectedMonth_}/${selectedYear}`;
        query = query.eq("competence", competence);
      } else {
        // Por padrão, mostrar todo o ano
        query = query.like("competence", `%/${selectedYear}`);
      }

      const { data: expenses, error } = await query;

      if (error) throw error;

      // Buscar também saldos de abertura (lançamentos contábeis de abertura) com valores
      // Buscar tanto 'saldo_abertura' quanto 'opening_balance'
      const { data: openingBalancesType1 } = await supabase
        .from("accounting_entries")
        .select(`
          id,
          description,
          entry_date,
          accounting_entry_lines(debit, credit)
        `)
        .eq("entry_type", "saldo_abertura")
        .lte("entry_date", `${selectedYear}-12-31`);

      const { data: openingBalancesType2 } = await supabase
        .from("accounting_entries")
        .select(`
          id,
          description,
          entry_date,
          accounting_entry_lines(debit, credit)
        `)
        .eq("entry_type", "opening_balance")
        .lte("entry_date", `${selectedYear}-12-31`);

      const openingBalances = [...(openingBalancesType1 || []), ...(openingBalancesType2 || [])];

      // Agrupar por centro de custo (usando code + name)
      const costCenterMap = new Map<string, { total: number; code: string; account: string }>();
      let total = 0;

      // Processar despesas
      expenses?.forEach((expense) => {
        const costCenterName = (expense as any).cost_center_name || "Não Classificado";
        const costCenterCode = (expense as any).cost_center_code || "";
        const accountCode = (expense as any).account_code || "";
        const amount = Number(expense.amount);

        const key = `${costCenterCode} - ${costCenterName}`;
        const existing = costCenterMap.get(key) || { total: 0, code: costCenterCode, account: accountCode };
        costCenterMap.set(key, {
          total: existing.total + amount,
          code: costCenterCode,
          account: accountCode
        });
        total += amount;
      });

      // Processar saldos de abertura (extrair centro de custo da descrição)
      if (openingBalances && costCentersToUse.length > 0) {
        openingBalances.forEach((entry: any) => {
          const description = entry.description || "";
          // Procurar por padrão como "Saldo de Abertura - NOME" ou "Saldo de Abertura: NOME"
          // Tenta ambos os formatos (com hífen ou com dois-pontos)
          let match = description.match(/Saldo de Abertura\s*-\s*(.+?)(?:\s*\(|$)/);
          if (!match) {
            // Tenta formato com dois-pontos
            match = description.match(/Saldo de Abertura\s*:\s*(.+?)(?:\s*\(|$)/);
          }

          if (match) {
            const centerName = match[1].trim();
            // Procurar o centro correspondente (flexível para maiúsculas/minúsculas)
            const center = costCentersToUse.find(c =>
              c.name.toLowerCase() === centerName.toLowerCase()
            );
            if (center) {
              const centerCode = center.code || "";
              const accountCode = center.accountName || "";
              const key = `${centerCode} - ${center.name}`;
              // Extrair o valor do débito
              const lines = entry.accounting_entry_lines || [];
              const debitValue = lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);

              console.log(`Saldo encontrado: ${centerCode} = R$ ${debitValue}`);

              if (debitValue > 0) {
                const existing = costCenterMap.get(key) || { total: 0, code: centerCode, account: accountCode };
                costCenterMap.set(key, {
                  total: existing.total + debitValue,
                  code: centerCode,
                  account: accountCode
                });
                total += debitValue;
              }
            } else {
              console.log(`Centro não encontrado: "${centerName}"`);
              console.log(`Centros disponíveis:`, costCentersToUse.map(c => c.name));
            }
          } else {
            console.log(`Descrição não correspondeu ao padrão esperado: "${description}"`);
          }
        });
      }

      // Converter para array e calcular percentuais
      const costCenterArray = Array.from(costCenterMap.entries())
        .map(([name, data]) => ({
          name,
          value: data.total,
          code: data.code,
          account: data.account,
          percentage: ((data.total / total) * 100).toFixed(2),
        }))
        .sort((a, b) => b.value - a.value);

      setCostCenterData(costCenterArray);
      setTotalExpenses(total);

      // Carregar comparação mensal (últimos 6 meses) - desabilitado pois a seção está oculta
      // await loadMonthlyComparison();
    } catch (error: any) {
      toast.error("Erro ao carregar dados de centro de custos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyComparison = async () => {
    try {
      const { data: expenses, error } = await supabase
        .from("vw_expenses_with_accounts")
        .select("*")
        .eq("status", "paid")
        .like("competence", `%/${selectedYear}`)

      if (error) throw error;

      // Agrupar por mês e centro de custo
      const monthlyMap = new Map<string, Map<string, number>>();

      expenses?.forEach((expense) => {
        const month = expense.competence?.split("/")[0];
        if (!month) return;

        const costCenterName = (expense as any).cost_center_name || "Não Classificado";
        const costCenterCode = (expense as any).cost_center_code || "";
        const costCenter = `${costCenterCode} - ${costCenterName}`;
        const amount = Number(expense.amount);

        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, new Map());
        }

        const centerMap = monthlyMap.get(month)!;
        centerMap.set(costCenter, (centerMap.get(costCenter) || 0) + amount);
      });

      // Converter para formato do gráfico
      const monthlyArray = Array.from(monthlyMap.entries())
        .map(([month, centerMap]) => {
          const monthData: any = { month: months.find((m) => m.value === month)?.label || month };
          centerMap.forEach((value, center) => {
            monthData[center] = value;
          });
          return monthData;
        })
        .sort((a, b) => {
          const monthA = months.findIndex((m) => m.label === a.month);
          const monthB = months.findIndex((m) => m.label === b.month);
          return monthA - monthB;
        });

      setMonthlyComparison(monthlyArray);
    } catch (error) {
      console.error("Erro ao carregar comparação mensal:", error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Análise de Centro de Custos</h1>
          <p className="text-muted-foreground">
            Visualize os gastos por departamento e identifique oportunidades de otimização
          </p>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ChevronDown className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  Filtros Opcionais
                </CardTitle>
                <CardDescription>
                  {selectedMonth_ ? `${months.find(m => m.value === selectedMonth_)?.label}/${selectedYear}` : `Exibindo: Ano inteiro (${selectedYear})`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ano</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mês (Opcional)</label>
                  <select
                    value={selectedMonth_ || ''}
                    onChange={(e) => setSelectedMonth_(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
                  >
                    <option value="">Todos os meses</option>
                    {months.map(month => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedYear(new Date().getFullYear());
                  setSelectedMonth_(null);
                }}>
                  Resetar Filtros
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Total de Despesas</CardTitle>
              <CardDescription>Valor total do período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{formatCurrency(totalExpenses)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Centro de Custo com Maior Gasto</CardTitle>
              <CardDescription>Departamento que mais gastou no período</CardDescription>
            </CardHeader>
            <CardContent>
              {costCenterData.length > 0 ? (
                <div>
                  <div className="text-2xl font-bold">{costCenterData[0].name}</div>
                  <div className="text-3xl font-bold text-destructive mt-2">
                    {formatCurrency(costCenterData[0].value)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {costCenterData[0].percentage}% do total
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Sem dados disponíveis</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Centro de Custo</CardTitle>
            <CardDescription>Gráfico de pizza mostrando a participação de cada departamento</CardDescription>
          </CardHeader>
          <CardContent>
            {costCenterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={costCenterData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, value }) => {
                      const total = costCenterData.reduce((sum, entry) => sum + entry.value, 0);
                      const percentage = ((value / total) * 100).toFixed(1);
                      return `${name}: ${percentage}%`;
                    }}
                  >
                    {costCenterData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de Gastos por Centro de Custo</CardTitle>
            <CardDescription>Departamentos ordenados por valor de despesas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costCenterData.map((center, index) => (
                <div key={center.name} className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-muted-foreground w-8">{index + 1}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{center.name}</span>
                      <span className="font-bold">{formatCurrency(center.value)}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${center.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{center.percentage}% do total</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {false && monthlyComparison.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evolução Mensal por Centro de Custo</CardTitle>
              <CardDescription>Comparação de gastos ao longo do ano</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                  <YAxis
                    stroke="hsl(var(--foreground))"
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  {costCenterData.map((center, index) => (
                    <Bar
                      key={center.name}
                      dataKey={center.name}
                      fill={COLORS[index % COLORS.length]}
                      radius={[8, 8, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {costCenterWithoutData.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900">
            <CardHeader>
              <CardTitle className="text-yellow-800 dark:text-yellow-200">Centros de Custo sem Movimentação</CardTitle>
              <CardDescription className="text-yellow-700 dark:text-yellow-300">
                {costCenterWithoutData.length} centro(s) cadastrado(s) sem despesas ou saldo registrado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                // Organizar centros por hierarquia (pai-filho)
                const centersByParent = new Map<string | null, any[]>();

                costCenterWithoutData.forEach((center) => {
                  // Encontrar o centro pai baseado no padrão do código
                  let parentCode: string | null = null;

                  // Se tem ponto, o pai é tudo antes do último ponto
                  if (center.code?.includes('.')) {
                    const parts = center.code.split('.');
                    parts.pop(); // Remove o último nível
                    const potentialParentCode = parts.join('.');

                    // Verificar se existe um centro com esse código
                    const hasParent = costCenterWithoutData.some(c =>
                      c.code?.trim() === potentialParentCode.trim()
                    );

                    if (hasParent) {
                      parentCode = potentialParentCode;
                    }
                  }

                  if (!centersByParent.has(parentCode)) {
                    centersByParent.set(parentCode, []);
                  }
                  centersByParent.get(parentCode)?.push(center);
                });

                // Renderizar acordeão com centros principais e seus filhos
                const mainCenters = centersByParent.get(null) || [];

                return (
                  <Accordion type="multiple" className="w-full">
                    {mainCenters.map((mainCenter, mainIndex) => {
                      const childCenters = centersByParent.get(mainCenter.code) || [];

                      return (
                        <AccordionItem key={mainCenter.id} value={`main-${mainIndex}`}>
                          <AccordionTrigger className="hover:bg-yellow-100/50 dark:hover:bg-yellow-900/30 px-4 py-3 rounded-lg">
                            <div className="flex items-center gap-3 flex-1 text-left">
                              <div className="font-mono font-bold text-yellow-700 dark:text-yellow-400">
                                {mainCenter.code}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {mainCenter.name}
                                </div>
                                {mainCenter.description && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {mainCenter.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="bg-white dark:bg-gray-900/50 px-4 py-3">
                            {mainCenter.accountName && (
                              <div className="mb-3">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {mainCenter.accountName}
                                </Badge>
                              </div>
                            )}

                            {childCenters.length > 0 && (
                              <div className="space-y-2 mt-2 border-t pt-3">
                                {childCenters.map((child) => (
                                  <div key={child.id} className="pl-4 py-2 border-l-2 border-yellow-200 dark:border-yellow-900">
                                    <div className="font-mono font-semibold text-sm text-yellow-700 dark:text-yellow-400">
                                      {child.code}
                                    </div>
                                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mt-1">
                                      {child.name}
                                    </div>
                                    {child.description && (
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                        {child.description}
                                      </div>
                                    )}
                                    {child.accountName && (
                                      <Badge variant="outline" className="font-mono text-xs mt-2">
                                        {child.accountName}
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                );
              })()}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Centros de Custo Cadastrados</CardTitle>
            <CardDescription>Lista completa de todos os centros de custo ativos no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {allCostCenters.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta Padrão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCostCenters.map((center) => (
                      <TableRow key={center.id}>
                        <TableCell className="font-mono font-medium">
                          {center.code}
                        </TableCell>
                        <TableCell className="font-medium">{center.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {center.description || "-"}
                        </TableCell>
                        <TableCell>
                          {center.accountName ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {center.accountName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem conta padrão</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum centro de custo cadastrado</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CostCenterAnalysis;
