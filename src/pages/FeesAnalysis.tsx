import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  Calendar,
  Users,
  FileText
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FeesStats {
  totalBilled: number;
  totalReceived: number;
  overdue1Month: number;
  overdue2Months: number;
  overdue3PlusMonths: number;
  activeClients: number;
  averageTicket: number;
  collectionRate: number;
}

const FeesAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeesStats>({
    totalBilled: 0,
    totalReceived: 0,
    overdue1Month: 0,
    overdue2Months: 0,
    overdue3PlusMonths: 0,
    activeClients: 0,
    averageTicket: 0,
    collectionRate: 0,
  });
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const loadStats = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const monthStart = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const monthEnd = endOfMonth(monthStart);

      // Buscar faturas do mês
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .gte("due_date", format(monthStart, "yyyy-MM-dd"))
        .lte("due_date", format(monthEnd, "yyyy-MM-dd"));

      if (invoicesError) throw invoicesError;

      // Buscar clientes ativos
      const { count: activeClientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Calcular estatísticas
      const totalBilled = invoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const totalReceived = invoices?.filter(inv => inv.status === "paid")
        .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

      const now = new Date();
      const oneMonthAgo = subMonths(now, 1);
      const twoMonthsAgo = subMonths(now, 2);
      const threeMonthsAgo = subMonths(now, 3);

      const overdue1Month = invoices?.filter(inv => {
        const dueDate = new Date(inv.due_date);
        return inv.status !== "paid" && dueDate >= oneMonthAgo && dueDate < now;
      }).reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

      const overdue2Months = invoices?.filter(inv => {
        const dueDate = new Date(inv.due_date);
        return inv.status !== "paid" && dueDate >= twoMonthsAgo && dueDate < oneMonthAgo;
      }).reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

      const overdue3PlusMonths = invoices?.filter(inv => {
        const dueDate = new Date(inv.due_date);
        return inv.status !== "paid" && dueDate < threeMonthsAgo;
      }).reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

      const collectionRate = totalBilled > 0 ? (totalReceived / totalBilled) * 100 : 0;
      const averageTicket = activeClientsCount ? totalBilled / activeClientsCount : 0;

      setStats({
        totalBilled,
        totalReceived,
        overdue1Month,
        overdue2Months,
        overdue3PlusMonths,
        activeClients: activeClientsCount || 0,
        averageTicket,
        collectionRate,
      });

      toast.success("Dados carregados com sucesso!");
    } catch (error: any) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar dados", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🎯 Análise de Honorários</h1>
            <p className="text-muted-foreground">
              Faturamento, recebimento e inadimplência detalhada
            </p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = subMonths(new Date(), i);
                const value = format(date, "yyyy-MM");
                return (
                  <SelectItem key={value} value={value}>
                    {format(date, "MMMM 'de' yyyy", { locale: ptBR })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Cards Principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalBilled)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeClients} clientes ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recebido</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalReceived)}
              </div>
              <p className="text-xs text-muted-foreground">
                Taxa de cobrança: {stats.collectionRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.averageTicket)}</div>
              <p className="text-xs text-muted-foreground">
                Por cliente ativo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inadimplência Total</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.overdue1Month + stats.overdue2Months + stats.overdue3PlusMonths)}
              </div>
              <p className="text-xs text-muted-foreground">
                Valores em atraso
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Inadimplência Segmentada */}
        <Card>
          <CardHeader>
            <CardTitle>Inadimplência Segmentada</CardTitle>
            <CardDescription>
              Valores em atraso por período de vencimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">1 mês em atraso</span>
                  <Calendar className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(stats.overdue1Month)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vencimento entre 30-60 dias
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">2 meses em atraso</span>
                  <Calendar className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(stats.overdue2Months)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vencimento entre 60-90 dias
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">3+ meses em atraso</span>
                  <Calendar className="h-4 w-4 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats.overdue3PlusMonths)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vencimento há mais de 90 dias
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Indicadores de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Taxa de Cobrança</span>
                <span className="text-lg font-bold">{stats.collectionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(stats.collectionRate, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default FeesAnalysis;
