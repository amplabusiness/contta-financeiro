import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

const COLORS = {
  matched: "hsl(var(--success))",
  unmatched: "hsl(var(--destructive))",
  credit: "hsl(var(--primary))",
  debit: "hsl(var(--warning))",
};

const ReconciliationDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<any[]>([]);
  const [divergences, setDivergences] = useState<any[]>([]);
  const [kpiData, setKpiData] = useState<any>({
    totalTransactions: 0,
    matchedTransactions: 0,
    unmatchedTransactions: 0,
    totalCredit: 0,
    totalDebit: 0,
    averageConfidence: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Buscar transações dos últimos 12 meses
      const twelveMonthsAgo = subMonths(new Date(), 12);
      
      const { data: transactions, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .gte("transaction_date", twelveMonthsAgo.toISOString())
        .order("transaction_date", { ascending: true });

      if (error) throw error;

      // Calcular evolução temporal da taxa de conciliação
      const monthlyData: Record<string, any> = {};
      
      transactions?.forEach((tx) => {
        const month = format(new Date(tx.transaction_date), "MMM/yyyy", { locale: ptBR });
        
        if (!monthlyData[month]) {
          monthlyData[month] = {
            month,
            total: 0,
            matched: 0,
            unmatched: 0,
            matchRate: 0,
          };
        }
        
        monthlyData[month].total++;
        if (tx.matched) {
          monthlyData[month].matched++;
        } else {
          monthlyData[month].unmatched++;
        }
      });

      // Calcular taxa de match para cada mês
      const evolution = Object.values(monthlyData).map((month: any) => ({
        ...month,
        matchRate: month.total > 0 ? ((month.matched / month.total) * 100).toFixed(1) : 0,
      }));

      setEvolutionData(evolution);

      // Tipos de transações mais comuns
      const typeCount: Record<string, number> = {};
      transactions?.forEach((tx) => {
        const type = tx.transaction_type === "credit" ? "Entrada" : "Saída";
        typeCount[type] = (typeCount[type] || 0) + 1;
      });

      const transTypes = Object.entries(typeCount).map(([name, value]) => ({
        name,
        value,
      }));
      setTransactionTypes(transTypes);

      // Análise de divergências (transações não conciliadas)
      const unmatchedTx = transactions?.filter((tx) => !tx.matched) || [];
      
      const divergenceData: Record<string, any> = {
        "Entrada não conciliada": 0,
        "Saída não conciliada": 0,
        "Divergência de valor": 0,
        "Sem correspondência": 0,
      };

      unmatchedTx.forEach((tx) => {
        if (tx.transaction_type === "credit") {
          divergenceData["Entrada não conciliada"]++;
        } else {
          divergenceData["Saída não conciliada"]++;
        }
        
        if (!tx.matched_expense_id && !tx.matched_invoice_id) {
          divergenceData["Sem correspondência"]++;
        }
      });

      const divData = Object.entries(divergenceData)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
      
      setDivergences(divData);

      // Calcular KPIs
      const matched = transactions?.filter((t) => t.matched) || [];
      const totalCredit = transactions
        ?.filter((t) => t.transaction_type === "credit")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const totalDebit = transactions
        ?.filter((t) => t.transaction_type === "debit")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const avgConfidence = matched.length > 0
        ? matched.reduce((sum, t) => sum + (t.ai_confidence || 0), 0) / matched.length
        : 0;

      setKpiData({
        totalTransactions: transactions?.length || 0,
        matchedTransactions: matched.length,
        unmatchedTransactions: (transactions?.length || 0) - matched.length,
        totalCredit,
        totalDebit,
        averageConfidence: avgConfidence,
      });

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Conciliação</h1>
          <p className="text-muted-foreground">
            Análise completa de conciliações bancárias e tendências
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Transações</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">Últimos 12 meses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conciliação</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData.totalTransactions > 0
                  ? ((kpiData.matchedTransactions / kpiData.totalTransactions) * 100).toFixed(1)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {kpiData.matchedTransactions} de {kpiData.totalTransactions} conciliadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entradas Totais</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(kpiData.totalCredit)}
              </div>
              <p className="text-xs text-muted-foreground">Recebimentos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saídas Totais</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(kpiData.totalDebit)}
              </div>
              <p className="text-xs text-muted-foreground">Pagamentos</p>
            </CardContent>
          </Card>
        </div>

        {/* Evolução Temporal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução da Taxa de Conciliação</CardTitle>
            <CardDescription>Taxa de conciliação ao longo dos últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="matchRate"
                  name="Taxa de Conciliação (%)"
                  stroke={COLORS.matched}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="matched"
                  name="Conciliadas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="unmatched"
                  name="Não Conciliadas"
                  stroke={COLORS.unmatched}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Tipos de Transações */}
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Transações</CardTitle>
              <CardDescription>Distribuição de entradas e saídas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={transactionTypes}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {transactionTypes.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === "Entrada" ? COLORS.credit : COLORS.debit}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Análise de Divergências */}
          <Card>
            <CardHeader>
              <CardTitle>Análise de Divergências</CardTitle>
              <CardDescription>Transações não conciliadas por tipo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={divergences}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS.unmatched} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Resumo de Divergências */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Pendências</CardTitle>
            <CardDescription>Transações que requerem atenção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium">Transações Não Conciliadas</p>
                    <p className="text-sm text-muted-foreground">
                      Requerem revisão manual
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {kpiData.unmatchedTransactions}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-success/5 rounded-lg border border-success/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium">Confiança Média dos Matches</p>
                    <p className="text-sm text-muted-foreground">
                      Qualidade das conciliações automáticas
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-success">
                  {kpiData.averageConfidence.toFixed(0)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ReconciliationDashboard;
