import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingDown, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";

interface MonthlyData {
  month: string;
  faturamento: number;
  despesas: number;
  inadimplencia: number;
  margem: number;
}

const ExecutiveDashboard = () => {
  const { toast } = useToast();
  const { selectedYear, selectedMonth } = usePeriod();
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalDefault, setTotalDefault] = useState(0);
  const [netMargin, setNetMargin] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    loadExecutiveData();
  }, [selectedYear, selectedMonth]);

  const loadExecutiveData = async () => {
    setLoading(true);
    try {
      // Use selectedYear and selectedMonth from context, with defaults if empty
      const year = selectedYear || new Date().getFullYear();
      const month = selectedMonth || new Date().getMonth() + 1;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Buscar faturamento (invoices pagas no período)
      const { data: paidInvoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("amount, payment_date")
        .eq("status", "paid")
        .gte("payment_date", startDate.toISOString())
        .lte("payment_date", endDate.toISOString());

      if (invoicesError) throw invoicesError;

      // Buscar despesas (pagas no período)
      const { data: paidExpenses, error: expensesError } = await supabase
        .from("expenses")
        .select("amount, payment_date")
        .eq("status", "paid")
        .gte("payment_date", startDate.toISOString())
        .lte("payment_date", endDate.toISOString());

      if (expensesError) throw expensesError;

      // Buscar inadimplência (pendentes e atrasadas até a data final do período)
      const { data: overdueInvoices, error: overdueError } = await supabase
        .from("invoices")
        .select("amount, due_date")
        .in("status", ["pending", "overdue"])
        .lte("due_date", endDate.toISOString());

      if (overdueError) throw overdueError;

      // Calcular totais
      const revenue = paidInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const expenses = paidExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
      const defaultAmount = overdueInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const margin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;

      setTotalRevenue(revenue);
      setTotalExpenses(expenses);
      setTotalDefault(defaultAmount);
      setNetMargin(margin);

      // Calcular dados mensais (últimos 12 meses a partir do mês/ano selecionado)
      const monthlyMap = new Map<string, MonthlyData>();
      const selectedDate = new Date(year, month - 1, 1);
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1);
        const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        monthlyMap.set(monthKey, {
          month: monthLabel,
          faturamento: 0,
          despesas: 0,
          inadimplencia: 0,
          margem: 0,
        });
      }

      // Agrupar faturamento por mês
      paidInvoices?.forEach((invoice) => {
        if (invoice.payment_date) {
          const date = new Date(invoice.payment_date);
          const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
          if (monthlyMap.has(monthKey)) {
            const data = monthlyMap.get(monthKey)!;
            data.faturamento += Number(invoice.amount);
          }
        }
      });

      // Agrupar despesas por mês
      paidExpenses?.forEach((expense) => {
        if (expense.payment_date) {
          const date = new Date(expense.payment_date);
          const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
          if (monthlyMap.has(monthKey)) {
            const data = monthlyMap.get(monthKey)!;
            data.despesas += Number(expense.amount);
          }
        }
      });

      // Buscar inadimplência por mês (baseado em due_date)
      const { data: allOverdueInvoices } = await supabase
        .from("invoices")
        .select("amount, due_date")
        .in("status", ["pending", "overdue"]);

      allOverdueInvoices?.forEach((invoice) => {
        if (invoice.due_date) {
          const date = new Date(invoice.due_date);
          const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
          if (monthlyMap.has(monthKey)) {
            const data = monthlyMap.get(monthKey)!;
            data.inadimplencia += Number(invoice.amount);
          }
        }
      });

      // Calcular margem mensal
      const monthlyArray = Array.from(monthlyMap.values()).map((data) => ({
        ...data,
        margem: data.faturamento > 0 ? ((data.faturamento - data.despesas) / data.faturamento) * 100 : 0,
      }));

      setMonthlyData(monthlyArray);
    } catch (error) {
      console.error("Erro ao carregar dados executivos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
          <p className="text-muted-foreground mt-1">
            Visão estratégica dos principais indicadores financeiros
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
          </CardContent>
        </Card>

        {/* KPIs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Faturamento Total"
            value={formatCurrency(totalRevenue)}
            icon={DollarSign}
            variant="success"
          />
          <MetricCard
            title="Despesas Totais"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            variant="warning"
          />
          <MetricCard
            title="Inadimplência"
            value={formatCurrency(totalDefault)}
            icon={AlertTriangle}
            variant="destructive"
          />
          <MetricCard
            title="Margem Líquida"
            value={`${netMargin.toFixed(1)}%`}
            icon={TrendingUp}
            variant={netMargin > 30 ? "success" : netMargin > 15 ? "default" : "destructive"}
          />
        </div>

        {/* Gráfico de Evolução */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Financeira (Últimos 12 Meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.month}</p>
                          {payload.map((entry: any) => (
                            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
                              {entry.name}: {formatCurrency(entry.value)}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  name="Faturamento"
                  stroke="hsl(var(--success))"
                  fill="hsl(var(--success))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="despesas"
                  name="Despesas"
                  stroke="hsl(var(--warning))"
                  fill="hsl(var(--warning))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="inadimplencia"
                  name="Inadimplência"
                  stroke="hsl(var(--destructive))"
                  fill="hsl(var(--destructive))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Margem */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução da Margem Líquida (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const value = typeof payload[0].value === 'number' ? payload[0].value : 0;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.month}</p>
                          <p className="text-sm">
                            Margem: {value.toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="margem"
                  name="Margem Líquida"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ExecutiveDashboard;
