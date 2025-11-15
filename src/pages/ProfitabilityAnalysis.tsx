import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, DollarSign, Percent, PieChart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ClientProfitability {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  totalExpenses: number;
  realizedProfit: number;
  potentialProfit: number;
  margin: number;
  representativeness: number;
}

const ProfitabilityAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientProfitability[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [realizedProfit, setRealizedProfit] = useState(0);
  const [potentialProfit, setPotentialProfit] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      // Buscar todos os clientes ativos
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active");

      if (clientsError) throw clientsError;

      // Buscar faturas pagas (receita realizada)
      const { data: paidInvoices, error: paidError } = await supabase
        .from("invoices")
        .select("*")
        .eq("status", "paid");

      if (paidError) throw paidError;

      // Buscar todas as faturas (receita potencial)
      const { data: allInvoices, error: allError } = await supabase
        .from("invoices")
        .select("*");

      if (allError) throw allError;

      // Buscar despesas pagas
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("status", "paid");

      if (expensesError) throw expensesError;

      const totalRev = paidInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const totalPotential = allInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const totalExp = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      setTotalRevenue(totalRev);
      setTotalExpenses(totalExp);
      setRealizedProfit(totalRev - totalExp);
      setPotentialProfit(totalPotential - totalExp);

      // Calcular rentabilidade por cliente
      const clientProfitability: ClientProfitability[] = clientsData?.map(client => {
        const clientRevenue = paidInvoices?.filter(inv => inv.client_id === client.id)
          .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
        
        const clientPotential = allInvoices?.filter(inv => inv.client_id === client.id)
          .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

        // Proporção de despesas por cliente (baseado na receita)
        const expenseRatio = totalRev > 0 ? clientRevenue / totalRev : 0;
        const clientExpenses = totalExp * expenseRatio;

        const realized = clientRevenue - clientExpenses;
        const potential = clientPotential - clientExpenses;
        const margin = clientRevenue > 0 ? (realized / clientRevenue) * 100 : 0;
        const representativeness = totalRev > 0 ? (clientRevenue / totalRev) * 100 : 0;

        return {
          clientId: client.id,
          clientName: client.name,
          totalRevenue: clientRevenue,
          totalExpenses: clientExpenses,
          realizedProfit: realized,
          potentialProfit: potential,
          margin,
          representativeness,
        };
      }) || [];

      // Ordenar por receita
      clientProfitability.sort((a, b) => b.totalRevenue - a.totalRevenue);

      setClients(clientProfitability);
      toast.success("Dados carregados com sucesso!");
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const realizedMargin = totalRevenue > 0 ? (realizedProfit / totalRevenue) * 100 : 0;
  const potentialMargin = (totalRevenue + (potentialProfit - realizedProfit)) > 0 
    ? (potentialProfit / (totalRevenue + (potentialProfit - realizedProfit))) * 100 
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">💰 Rentabilidade e Lucro</h1>
          <p className="text-muted-foreground">
            Análise de lucro realizado vs potencial total
          </p>
        </div>

        {/* Cards Principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Realizada</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Faturas pagas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                Custos operacionais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Realizado</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(realizedProfit)}
              </div>
              <p className="text-xs text-muted-foreground">
                Margem: {realizedMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Potencial</CardTitle>
              <Percent className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(potentialProfit)}
              </div>
              <p className="text-xs text-muted-foreground">
                Margem: {potentialMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Rentabilidade por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Rentabilidade por Cliente</CardTitle>
            <CardDescription>
              Análise detalhada de lucro e representatividade de cada cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Lucro Real</TableHead>
                  <TableHead className="text-right">Lucro Potencial</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Represent.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.clientId}>
                    <TableCell className="font-medium">{client.clientName}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(client.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(client.totalExpenses)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={client.realizedProfit > 0 ? "default" : "destructive"}>
                        {formatCurrency(client.realizedProfit)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-purple-600">
                      {formatCurrency(client.potentialProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={client.margin > 20 ? "default" : "secondary"}>
                        {client.margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {client.representativeness.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ProfitabilityAnalysis;
