import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  TrendingUp,
  DollarSign,
  PieChart,
  AlertTriangle,
  Award,
  Filter,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClientRevenue {
  client_id: string;
  client_name: string;
  total_billed: number;
  total_received: number;
  percentage_of_total: number;
  accumulated_percentage: number;
  rank: number;
}

interface ProfitStats {
  totalRevenue: number;
  totalReceived: number;
  totalPending: number;
  totalExpenses: number;
  profitRealized: number;
  profitTotal: number;
  marginRealized: number;
  marginTotal: number;
}

const ProfitabilityAnalysis = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [profitStats, setProfitStats] = useState<ProfitStats>({
    totalRevenue: 0,
    totalReceived: 0,
    totalPending: 0,
    totalExpenses: 0,
    profitRealized: 0,
    profitTotal: 0,
    marginRealized: 0,
    marginTotal: 0,
  });
  const [clientRevenues, setClientRevenues] = useState<ClientRevenue[]>([]);
  const [top80PercentClients, setTop80PercentClients] = useState<number>(0);

  const calculateProfitability = useCallback((invoices: Array<{ amount: number; status: string }>, expenses: Array<{ amount: number }>) => {
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalReceived = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalPending = invoices
      .filter((inv) => inv.status !== "paid")
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    const profitRealized = totalReceived - totalExpenses;
    const profitTotal = totalRevenue - totalExpenses;
    const marginRealized = totalReceived > 0 ? (profitRealized / totalReceived) * 100 : 0;
    const marginTotal = totalRevenue > 0 ? (profitTotal / totalRevenue) * 100 : 0;

    setProfitStats({
      totalRevenue,
      totalReceived,
      totalPending,
      totalExpenses,
      profitRealized,
      profitTotal,
      marginRealized,
      marginTotal,
    });
  }, []);

  const calculateClientRepresentation = useCallback((invoices: Array<{ client_id: string; clients?: { name: string }; amount: number; status: string }>) => {
    // Group by client
    const clientMap = new Map<string, { name: string; billed: number; received: number }>();

    invoices.forEach((invoice) => {
      const clientId = invoice.client_id;
      const clientName = invoice.clients?.name || "Desconhecido";
      const amount = Number(invoice.amount);
      const isPaid = invoice.status === "paid";

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, { name: clientName, billed: 0, received: 0 });
      }

      const client = clientMap.get(clientId)!;
      client.billed += amount;
      if (isPaid) {
        client.received += amount;
      }
    });

    // Calculate total
    const totalBilled = Array.from(clientMap.values()).reduce(
      (sum, c) => sum + c.billed,
      0
    );

    // Create array with percentages
    const clientRevenuesArray: ClientRevenue[] = Array.from(clientMap.entries())
      .map(([clientId, data]) => ({
        client_id: clientId,
        client_name: data.name,
        total_billed: data.billed,
        total_received: data.received,
        percentage_of_total: totalBilled > 0 ? (data.billed / totalBilled) * 100 : 0,
        accumulated_percentage: 0,
        rank: 0,
      }))
      .sort((a, b) => b.total_billed - a.total_billed);

    // Add rank and accumulated percentage
    let accumulated = 0;
    let count80Percent = 0;
    clientRevenuesArray.forEach((client, index) => {
      client.rank = index + 1;
      accumulated += client.percentage_of_total;
      client.accumulated_percentage = accumulated;

      if (accumulated <= 80) {
        count80Percent = index + 1;
      }
    });

    setClientRevenues(clientRevenuesArray);
    setTop80PercentClients(count80Percent);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch invoices for the year
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select(`
          *,
          clients (
            id,
            name
          )
        `)
        .like("competence", `%/${selectedYear}`);

      if (invoicesError) throw invoicesError;

      // Fetch expenses for the year
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("amount")
        .gte("due_date", `${selectedYear}-01-01`)
        .lte("due_date", `${selectedYear}-12-31`);

      if (expensesError) throw expensesError;

      // Calculate statistics
      calculateProfitability(invoicesData || [], expensesData || []);
      calculateClientRepresentation(invoicesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, calculateProfitability, calculateClientRepresentation, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return value.toFixed(2) + "%";
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Análise de Rentabilidade</h1>
                    <p className="text-muted-foreground">
                      Lucro realizado, margens e representatividade de clientes
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Year Filter */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ano</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2025, 2024, 2023, 2022].map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={fetchData}>Analisar</Button>
                </div>
              </CardContent>
            </Card>

            {/* Profit Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Receita Total (Faturado)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(profitStats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Incluindo a receber
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Receita Realizada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(profitStats.totalReceived)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profitStats.totalRevenue > 0
                      ? formatPercent((profitStats.totalReceived / profitStats.totalRevenue) * 100)
                      : "0%"}{" "}
                    do faturado
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Despesas Totais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(profitStats.totalExpenses)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profitStats.totalRevenue > 0
                      ? formatPercent((profitStats.totalExpenses / profitStats.totalRevenue) * 100)
                      : "0%"}{" "}
                    da receita
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    A Receber
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(profitStats.totalPending)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pendente de pagamento</p>
                </CardContent>
              </Card>
            </div>

            {/* Profit Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <DollarSign className="w-5 h-5" />
                    Lucro Realizado (Somente Recebido)
                  </CardTitle>
                  <CardDescription>
                    Baseado apenas no dinheiro que entrou no caixa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-green-700 mb-1">Receita Realizada</p>
                      <p className="text-xl font-bold text-green-900">
                        {formatCurrency(profitStats.totalReceived)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700 mb-1">(-) Despesas</p>
                      <p className="text-xl font-bold text-red-700">
                        {formatCurrency(profitStats.totalExpenses)}
                      </p>
                    </div>
                    <hr className="border-green-300" />
                    <div>
                      <p className="text-sm text-green-700 mb-1">(=) Lucro Líquido</p>
                      <p className="text-3xl font-bold text-green-900">
                        {formatCurrency(profitStats.profitRealized)}
                      </p>
                      <Badge
                        className={`mt-2 ${
                          profitStats.marginRealized >= 0
                            ? "bg-green-600"
                            : "bg-red-600"
                        }`}
                      >
                        Margem: {formatPercent(profitStats.marginRealized)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <TrendingUp className="w-5 h-5" />
                    Lucro Total (Incluindo A Receber)
                  </CardTitle>
                  <CardDescription>
                    Considerando todo o faturamento do ano
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-blue-700 mb-1">Receita Total</p>
                      <p className="text-xl font-bold text-blue-900">
                        {formatCurrency(profitStats.totalRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700 mb-1">(-) Despesas</p>
                      <p className="text-xl font-bold text-red-700">
                        {formatCurrency(profitStats.totalExpenses)}
                      </p>
                    </div>
                    <hr className="border-blue-300" />
                    <div>
                      <p className="text-sm text-blue-700 mb-1">(=) Lucro Potencial</p>
                      <p className="text-3xl font-bold text-blue-900">
                        {formatCurrency(profitStats.profitTotal)}
                      </p>
                      <Badge
                        className={`mt-2 ${
                          profitStats.marginTotal >= 0 ? "bg-blue-600" : "bg-red-600"
                        }`}
                      >
                        Margem: {formatPercent(profitStats.marginTotal)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Concentration Risk Alert */}
            {top80PercentClients > 0 && top80PercentClients <= 10 && (
              <Alert className="mb-6 border-orange-300 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800">
                  ⚠️ Risco de Concentração
                </AlertTitle>
                <AlertDescription className="text-orange-700">
                  Apenas {top80PercentClients} cliente(s) representam 80% da sua receita.
                  Alta dependência de poucos clientes aumenta o risco do negócio.
                  {top80PercentClients <= 5 && (
                    <strong>
                      {" "}
                      CRÍTICO: Se perder esses clientes, o impacto será devastador!
                    </strong>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Client Representation Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Representatividade de Clientes
                </CardTitle>
                <CardDescription>
                  Participação de cada cliente no faturamento total • Análise de concentração de
                  receita
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Carregando dados...</p>
                  </div>
                ) : clientRevenues.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum dado encontrado</h3>
                    <p className="text-muted-foreground">
                      Não há honorários para o ano selecionado
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Faturado</TableHead>
                        <TableHead className="text-right">Recebido</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                        <TableHead className="text-right">% Acumulado</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientRevenues.map((client) => {
                        const isTop10 = client.rank <= 10;
                        const isTop80 = client.accumulated_percentage <= 80;

                        return (
                          <TableRow
                            key={client.client_id}
                            className={isTop80 ? "bg-yellow-50" : ""}
                          >
                            <TableCell className="font-medium">
                              {client.rank <= 3 ? (
                                <Award
                                  className={`w-5 h-5 ${
                                    client.rank === 1
                                      ? "text-yellow-500"
                                      : client.rank === 2
                                      ? "text-gray-400"
                                      : "text-orange-600"
                                  }`}
                                />
                              ) : (
                                client.rank
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {client.client_name}
                              {isTop10 && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Top 10
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(client.total_billed)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(client.total_received)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatPercent(client.percentage_of_total)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent(client.accumulated_percentage)}
                            </TableCell>
                            <TableCell className="text-right">
                              {isTop80 && (
                                <Badge className="bg-yellow-600">Top 80%</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ProfitabilityAnalysis;
