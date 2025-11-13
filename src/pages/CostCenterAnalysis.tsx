import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2 } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const CostCenterAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [costCenterData, setCostCenterData] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

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

  const years = ["2024", "2025", "2026"];

  useEffect(() => {
    loadCostCenterData();
  }, [filterYear, filterMonth]);

  const loadCostCenterData = async () => {
    try {
      setLoading(true);
      
      // Buscar despesas pagas
      let query = supabase
        .from("expenses")
        .select("*")
        .eq("status", "paid");

      if (filterYear && filterMonth) {
        const competence = `${filterMonth}/${filterYear}`;
        query = query.eq("competence", competence);
      } else if (filterYear) {
        query = query.like("competence", `%/${filterYear}`);
      }

      const { data: expenses, error } = await query;

      if (error) throw error;

      // Agrupar por centro de custo
      const costCenterMap = new Map<string, number>();
      let total = 0;

      expenses?.forEach((expense) => {
        const costCenter = (expense as any).cost_center || "Não Classificado";
        const amount = Number(expense.amount);
        costCenterMap.set(costCenter, (costCenterMap.get(costCenter) || 0) + amount);
        total += amount;
      });

      // Converter para array e calcular percentuais
      const costCenterArray = Array.from(costCenterMap.entries())
        .map(([name, value]) => ({
          name,
          value,
          percentage: ((value / total) * 100).toFixed(2),
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
        .from("expenses")
        .select("*")
        .eq("status", "paid")
        .like("competence", `%/${filterYear}`);

      if (error) throw error;

      // Agrupar por mês e centro de custo
      const monthlyMap = new Map<string, Map<string, number>>();

      expenses?.forEach((expense) => {
        const month = expense.competence?.split("/")[0];
        if (!month) return;

        const costCenter = (expense as any).cost_center || "Não Classificado";
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
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2 w-40">
                <Label>Ano</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-40">
                <Label>Mês</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os meses" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
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
