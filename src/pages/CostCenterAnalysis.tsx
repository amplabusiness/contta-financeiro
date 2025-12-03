import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2 } from "lucide-react";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const CostCenterAnalysis = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const [loading, setLoading] = useState(true);
  const [costCenterData, setCostCenterData] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [allCostCenters, setAllCostCenters] = useState<any[]>([]);

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
    loadCostCenterData();
    loadAllCostCenters();
  }, [selectedYear, selectedMonth]);

  const loadAllCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name, description, default_chart_account_id, is_active, parent_id")
        .eq("is_active", true)
        .order("code");

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
    } catch (error: any) {
      console.error("Erro ao carregar centros de custo:", error);
      toast.error("Erro ao carregar centros de custo");
    }
  };

  const loadCostCenterData = async () => {
    try {
      setLoading(true);

      // Buscar despesas pagas com centros de custo
      let query = supabase
        .from("vw_expenses_with_accounts")
        .select("*")
        .eq("status", "paid");

      if (selectedYear && selectedMonth) {
        const monthStr = selectedMonth.toString().padStart(2, '0');
        const competence = `${monthStr}/${selectedYear}`;
        query = query.eq("competence", competence);
      } else if (selectedYear) {
        query = query.like("competence", `%/${selectedYear}`);
      }

      const { data: expenses, error } = await query;

      if (error) throw error;

      // Agrupar por centro de custo (usando code + name)
      const costCenterMap = new Map<string, { total: number; code: string; account: string }>();
      let total = 0;

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

      // Carregar comparação mensal (últimos 6 meses)
      await loadMonthlyComparison();
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
        .like("competence", `%/${selectedYear}`);

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

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar análise por período</CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
          </CardContent>
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

        {monthlyComparison.length > 0 && (
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
      </div>
    </Layout>
  );
};

export default CostCenterAnalysis;
