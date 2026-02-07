import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingDown, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { useClient } from "@/contexts/ClientContext";

interface MonthlyData {
  month: string;
  faturamento: number;
  despesas: number;
  inadimplencia: number;
  margem: number;
}

const ExecutiveDashboard = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const { selectedClientId, selectedClientName } = useClient();
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalDefault, setTotalDefault] = useState(0);
  const [netMargin, setNetMargin] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

  const loadExecutiveData = useCallback(async () => {
    setLoading(true);
    try {
      // Use selectedYear and selectedMonth from context, with defaults if empty
      const year = selectedYear || new Date().getFullYear();
      const month = selectedMonth || new Date().getMonth() + 1;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      // =====================================================
      // FONTE ÚNICA DE VERDADE: CONTABILIDADE
      // Buscar lançamentos contábeis do período
      // =====================================================

      // Buscar TODAS as contas de Receita (3.x) e Despesa (4.x)
      const { data: chartAccounts, error: chartError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type')
        .eq('is_active', true)
        .eq('is_analytical', true);

      if (chartError) throw chartError;

      // Separar contas por tipo
      const revenueAccountIds = chartAccounts?.filter(a => a.code.startsWith('3')).map(a => a.id) || [];
      const expenseAccountIds = chartAccounts?.filter(a => a.code.startsWith('4')).map(a => a.id) || [];

      // Buscar TODOS os lançamentos contábeis
      const { data: allLines, error: linesError } = await supabase
        .from('accounting_entry_items')
        .select(`
          debit,
          credit,
          account_id,
          entry_id(entry_date, competence_date)
        `);

      if (linesError) throw linesError;

      // Filtrar lançamentos do período (usar competence_date ou entry_date)
      const periodLines = allLines?.filter((line: any) => {
        const lineDate = line.entry_id?.competence_date || line.entry_id?.entry_date;
        if (!lineDate) return false;
        return lineDate >= startDateStr && lineDate <= endDateStr;
      }) || [];

      // Calcular totais de RECEITA (contas 3.x - crédito aumenta receita)
      const totalRevenueFromAccounting = periodLines
        .filter((line: any) => revenueAccountIds.includes(line.account_id))
        .reduce((sum: number, line: any) => sum + (Number(line.credit) || 0) - (Number(line.debit) || 0), 0);

      // Calcular totais de DESPESA (contas 4.x - débito aumenta despesa)
      const totalExpensesFromAccounting = periodLines
        .filter((line: any) => expenseAccountIds.includes(line.account_id))
        .reduce((sum: number, line: any) => sum + (Number(line.debit) || 0) - (Number(line.credit) || 0), 0);

      // Buscar inadimplência de faturas (pendentes e atrasadas até a data final do período)
      let overdueInvoicesQuery = supabase
        .from("invoices")
        .select("amount, due_date, client_id")
        .in("status", ["pending", "overdue"])
        .lte("due_date", endDate.toISOString());

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        overdueInvoicesQuery = overdueInvoicesQuery.eq("client_id", selectedClientId);
      }

      const { data: overdueInvoices, error: overdueError } = await overdueInvoicesQuery;
      if (overdueError) throw overdueError;

      // Buscar saldo de abertura pendente (inadimplência)
      let openingBalanceQuery = supabase
        .from("client_opening_balance")
        .select("amount, paid_amount, due_date, client_id")
        .in("status", ["pending", "partial", "overdue"]);

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        openingBalanceQuery = openingBalanceQuery.eq("client_id", selectedClientId);
      }

      const { data: openingBalances, error: openingBalanceError } = await openingBalanceQuery;
      if (openingBalanceError) throw openingBalanceError;

      // Calcular total de saldo de abertura pendente
      const openingBalanceDefault = (openingBalances || []).reduce((sum, ob) => {
        const remaining = Number(ob.amount || 0) - Number(ob.paid_amount || 0);
        return sum + remaining;
      }, 0);

      // =====================================================
      // USAR VALORES DA CONTABILIDADE
      // =====================================================
      const revenue = totalRevenueFromAccounting;
      const expenses = totalExpensesFromAccounting;

      const invoiceDefault = overdueInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const defaultAmount = invoiceDefault + openingBalanceDefault;
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

      // =====================================================
      // GRÁFICO: Usar dados da CONTABILIDADE para 12 meses
      // =====================================================

      // Agrupar lançamentos contábeis por mês (receitas e despesas)
      allLines?.forEach((line: any) => {
        const lineDate = line.entry_id?.competence_date || line.entry_id?.entry_date;
        if (!lineDate) return;

        const date = new Date(lineDate);
        const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

        if (monthlyMap.has(monthKey)) {
          const data = monthlyMap.get(monthKey)!;

          // Receitas (contas 3.x) - crédito aumenta
          if (revenueAccountIds.includes(line.account_id)) {
            data.faturamento += (Number(line.credit) || 0) - (Number(line.debit) || 0);
          }

          // Despesas (contas 4.x) - débito aumenta
          if (expenseAccountIds.includes(line.account_id)) {
            data.despesas += (Number(line.debit) || 0) - (Number(line.credit) || 0);
          }
        }
      });

      // Buscar inadimplência por mês (baseado em due_date) - faturas
      let allOverdueInvoicesQuery = supabase
        .from("invoices")
        .select("amount, due_date, client_id")
        .in("status", ["pending", "overdue"]);

      if (selectedClientId) {
        allOverdueInvoicesQuery = allOverdueInvoicesQuery.eq("client_id", selectedClientId);
      }

      const { data: allOverdueInvoices } = await allOverdueInvoicesQuery;

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

      // Adicionar saldo de abertura à inadimplência mensal (usando due_date ou data atual)
      openingBalances?.forEach((ob) => {
        const dueDate = ob.due_date ? new Date(ob.due_date) : new Date();
        const monthKey = `${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`;
        if (monthlyMap.has(monthKey)) {
          const data = monthlyMap.get(monthKey)!;
          const remaining = Number(ob.amount || 0) - Number(ob.paid_amount || 0);
          data.inadimplencia += remaining;
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
  }, [selectedYear, selectedMonth, selectedClientId]);

  useEffect(() => {
    loadExecutiveData();
  }, [loadExecutiveData]);

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
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            {selectedClientId ? `Dashboard Executivo - ${selectedClientName}` : "Dashboard Executivo"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {selectedClientId
              ? "Visão estratégica do cliente selecionado"
              : "Visão estratégica dos principais indicadores financeiros"}
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
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
          <CardContent className="p-4 sm:p-6">
            <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
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
