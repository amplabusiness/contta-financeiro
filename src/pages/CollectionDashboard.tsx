import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  DollarSign,
  Mail,
  MessageSquare,
  FileText,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
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

interface Client {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
}

interface OverdueInvoice {
  id: string;
  client_id: string;
  amount: number;
  due_date: string;
  competence: string;
  status: string;
  days_overdue: number;
  clients: Client;
}

interface CollectionAlert {
  client: Client;
  overdue_count: number;
  overdue_amount: number;
  months_overdue: number;
  oldest_due_date: string;
  severity: "critical" | "high" | "medium";
  opening_balance_count: number;
  opening_balance_amount: number;
}

interface OpeningBalance {
  id: string;
  client_id: string;
  amount: number;
  paid_amount: number;
  due_date: string | null;
  competence: string;
  status: string;
  clients: Client | null;
}

const CollectionDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedMonth, selectedYear } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([]);
  const [collectionAlerts, setCollectionAlerts] = useState<CollectionAlert[]>([]);
  const [stats, setStats] = useState({
    totalOverdue: 0,
    totalClients: 0,
    criticalAlerts: 0,
    avgDaysOverdue: 0,
    openingBalanceTotal: 0,
    openingBalanceCount: 0,
  });

  const fetchCollectionData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date range for selected period
      // We want to show overdue items as of the END of the selected period
      const periodEndDate = new Date(selectedYear, selectedMonth, 0); // Last day of selected month
      const periodEndStr = periodEndDate.toISOString().split('T')[0];

      // Fetch overdue invoices with client information
      // Filter by due_date <= end of selected period (overdue as of that date)
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select(`
          *,
          clients (
            id,
            name,
            cnpj,
            email,
            phone
          )
        `)
        .eq("status", "overdue")
        .lte("due_date", periodEndStr)
        .order("due_date", { ascending: true });

      if (invoicesError) throw invoicesError;

      // Build the competence string for comparison (MM/YYYY format)
      // Opening balances with competence up to the previous month are considered overdue
      const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const previousYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

      // Fetch opening balances (saldo de abertura) - filter by competence
      const { data: openingBalanceData, error: openingBalanceError } = await supabase
        .from("client_opening_balance")
        .select(`
          id,
          client_id,
          amount,
          paid_amount,
          due_date,
          competence,
          status,
          clients (
            id,
            name,
            cnpj,
            email,
            phone
          )
        `)
        .in("status", ["pending", "partial"])
        .order("competence", { ascending: true });

      // Filter opening balances client-side by competence (MM/YYYY format comparison)
      // Opening balance should only include competencies BEFORE the selected period
      // Example: If January/2025 is selected, show opening balances from December/2024 and earlier
      const filteredOpeningBalances = (openingBalanceData || []).filter(ob => {
        if (!ob.competence) return true; // Include if no competence
        const [month, year] = ob.competence.split('/').map(Number);
        // Include if competence is strictly before selected period (not including it)
        if (year < selectedYear) return true;
        if (year === selectedYear && month < selectedMonth) return true;
        return false;
      });

      if (openingBalanceError) {
        console.warn("Error fetching opening balance:", openingBalanceError);
      }

      const openingBalancesData = filteredOpeningBalances as OpeningBalance[];
      setOpeningBalances(openingBalancesData);

      // Calculate days overdue for each invoice (relative to end of selected period)
      const invoicesWithDays = (invoicesData || []).map((invoice) => ({
        ...invoice,
        days_overdue: Math.floor(
          (periodEndDate.getTime() - new Date(invoice.due_date).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      }));

      setOverdueInvoices(invoicesWithDays);

      // Group invoices by client
      const clientGroups = new Map<string, OverdueInvoice[]>();
      invoicesWithDays.forEach((invoice) => {
        const clientId = invoice.client_id;
        if (!clientGroups.has(clientId)) {
          clientGroups.set(clientId, []);
        }
        clientGroups.get(clientId)!.push(invoice);
      });

      // Group opening balances by client
      const openingBalanceByClient = new Map<string, OpeningBalance[]>();
      openingBalancesData.forEach((ob) => {
        const clientId = ob.client_id;
        if (!openingBalanceByClient.has(clientId)) {
          openingBalanceByClient.set(clientId, []);
        }
        openingBalanceByClient.get(clientId)!.push(ob);
      });

      // Get all unique client IDs from both invoices and opening balances
      const allClientIds = new Set([
        ...clientGroups.keys(),
        ...openingBalanceByClient.keys()
      ]);

      // Create collection alerts including opening balances
      const alerts: CollectionAlert[] = [];
      allClientIds.forEach((clientId) => {
        const invoices = clientGroups.get(clientId) || [];
        const clientOpeningBalances = openingBalanceByClient.get(clientId) || [];

        // Get client info from invoices or opening balances
        let client: Client | null = null;
        if (invoices.length > 0) {
          client = invoices[0].clients;
        } else if (clientOpeningBalances.length > 0 && clientOpeningBalances[0].clients) {
          client = clientOpeningBalances[0].clients;
        }

        if (!client) return;

        const overdue_count = invoices.length;
        const overdue_amount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

        // Calculate opening balance amounts
        const opening_balance_count = clientOpeningBalances.length;
        const opening_balance_amount = clientOpeningBalances.reduce(
          (sum, ob) => sum + (Number(ob.amount || 0) - Number(ob.paid_amount || 0)),
          0
        );

        // Calculate months overdue from oldest invoice or opening balance
        let oldest_due_date = "";
        let months_overdue = 0;

        if (invoices.length > 0) {
          const oldest_invoice = invoices.sort(
            (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          )[0];
          oldest_due_date = oldest_invoice.due_date;
          months_overdue = Math.floor(oldest_invoice.days_overdue / 30);
        }

        // Check if opening balance has older date (relative to selected period)
        if (clientOpeningBalances.length > 0) {
          clientOpeningBalances.forEach((ob) => {
            if (ob.competence) {
              const [month, year] = ob.competence.split("/").map(Number);
              const competenceDate = new Date(year, month - 1, 1);
              const obMonthsOverdue = Math.floor(
                (periodEndDate.getTime() - competenceDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
              );
              if (obMonthsOverdue > months_overdue) {
                months_overdue = obMonthsOverdue;
                oldest_due_date = ob.due_date || `${year}-${String(month).padStart(2, '0')}-01`;
              }
            }
          });
        }

        let severity: "critical" | "high" | "medium" = "medium";
        if (months_overdue >= 3) severity = "critical";
        else if (months_overdue >= 2) severity = "high";

        const totalAmount = overdue_amount + opening_balance_amount;
        if (totalAmount > 0) {
          alerts.push({
            client,
            overdue_count,
            overdue_amount,
            months_overdue,
            oldest_due_date,
            severity,
            opening_balance_count,
            opening_balance_amount,
          });
        }
      });

      // Sort by severity then by total amount
      alerts.sort((a, b) => {
        const severityOrder = { critical: 3, high: 2, medium: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return (b.overdue_amount + b.opening_balance_amount) - (a.overdue_amount + a.opening_balance_amount);
      });

      setCollectionAlerts(alerts);

      // Calculate stats including opening balances
      const totalOverdueInvoices = invoicesWithDays.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      );
      const totalOpeningBalance = openingBalancesData.reduce(
        (sum, ob) => sum + (Number(ob.amount || 0) - Number(ob.paid_amount || 0)),
        0
      );
      const totalOverdue = totalOverdueInvoices + totalOpeningBalance;
      const totalClients = allClientIds.size;
      const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;

      // Calculate average days overdue (only for invoices, as opening balances use competence)
      const avgDaysOverdue =
        invoicesWithDays.length > 0
          ? invoicesWithDays.reduce((sum, inv) => sum + inv.days_overdue, 0) /
            invoicesWithDays.length
          : 0;

      setStats({
        totalOverdue,
        totalClients,
        criticalAlerts,
        avgDaysOverdue: Math.round(avgDaysOverdue),
        openingBalanceTotal: totalOpeningBalance,
        openingBalanceCount: openingBalancesData.length,
      });
    } catch (error) {
      console.error("Error fetching collection data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchCollectionData();
  }, [fetchCollectionData]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="w-4 h-4" />;
      case "high":
        return <AlertCircle className="w-4 h-4" />;
      case "medium":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const handleSendCollectionLetter = (clientId: string, method: "email" | "whatsapp") => {
    // TODO: Implement collection letter sending
    toast({
      title: `Carta de cobrança ${method === "email" ? "por e-mail" : "por WhatsApp"}`,
      description: "Funcionalidade em desenvolvimento",
    });
  };

  const handleReduceServices = (clientId: string) => {
    // TODO: Implement service reduction workflow
    toast({
      title: "Reduzir serviços",
      description: "Funcionalidade em desenvolvimento",
    });
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
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Dashboard de Cobrança</h1>
                    <p className="text-muted-foreground">
                      Monitore inadimplência e gerencie cobranças
                    </p>
                  </div>
                </div>
                <Button onClick={() => fetchCollectionData()}>
                  Atualizar Dados
                </Button>
              </div>
            </div>

            <PeriodFilter />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total em Atraso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(stats.totalOverdue)}
                      </p>
                      {stats.openingBalanceTotal > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Inclui {formatCurrency(stats.openingBalanceTotal)} de saldo abertura
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Clientes Inadimplentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="w-8 h-8 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.totalClients}</p>
                      <p className="text-xs text-muted-foreground">
                        {overdueInvoices.length} faturas{stats.openingBalanceCount > 0 ? ` + ${stats.openingBalanceCount} SA` : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Alertas Críticos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {stats.criticalAlerts}
                      </p>
                      <p className="text-xs text-muted-foreground">3+ meses atrasados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Atraso Médio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="w-8 h-8 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.avgDaysOverdue}</p>
                      <p className="text-xs text-muted-foreground">dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Critical Alerts */}
            {stats.criticalAlerts > 0 && (
              <Alert className="mb-6 border-red-300 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">
                  {stats.criticalAlerts} {stats.criticalAlerts === 1 ? "Cliente" : "Clientes"} com
                  Atraso Crítico
                </AlertTitle>
                <AlertDescription className="text-red-700">
                  Existem clientes com 3 ou mais meses de atraso. Considere reduzir a prestação de
                  serviços ou tomar ações de cobrança imediatas.
                </AlertDescription>
              </Alert>
            )}

            {/* Tabs */}
            <Tabs defaultValue="alerts" className="space-y-4">
              <TabsList>
                <TabsTrigger value="alerts">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Alertas por Cliente
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  <FileText className="w-4 h-4 mr-2" />
                  Todas as Faturas
                </TabsTrigger>
              </TabsList>

              {/* Alerts by Client */}
              <TabsContent value="alerts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Clientes com Inadimplência</CardTitle>
                    <CardDescription>
                      Ordenado por gravidade - clientes com maior atraso primeiro
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Carregando dados...</p>
                      </div>
                    ) : collectionAlerts.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                          Nenhuma Inadimplência!
                        </h3>
                        <p className="text-muted-foreground">
                          Todos os clientes estão em dia com os pagamentos.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {collectionAlerts.map((alert) => (
                          <div
                            key={alert.client.id}
                            className={`p-4 border rounded-lg ${getSeverityColor(
                              alert.severity
                            )}`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-3">
                                {getSeverityIcon(alert.severity)}
                                <div>
                                  <h4 className="font-semibold text-lg">
                                    {alert.client.name}
                                  </h4>
                                  <p className="text-sm opacity-80">
                                    CNPJ: {alert.client.cnpj}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={`${getSeverityColor(alert.severity)} border`}
                              >
                                {alert.severity === "critical"
                                  ? "CRÍTICO"
                                  : alert.severity === "high"
                                  ? "ALTO"
                                  : "MÉDIO"}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-5 gap-4 mb-4">
                              <div>
                                <p className="text-xs opacity-70">Faturas em Atraso</p>
                                <p className="text-lg font-bold">{alert.overdue_count}</p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Saldo Abertura</p>
                                <p className="text-lg font-bold">
                                  {alert.opening_balance_count > 0
                                    ? `${alert.opening_balance_count} (${formatCurrency(alert.opening_balance_amount)})`
                                    : '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Valor Total</p>
                                <p className="text-lg font-bold">
                                  {formatCurrency(alert.overdue_amount + alert.opening_balance_amount)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Meses de Atraso</p>
                                <p className="text-lg font-bold">{alert.months_overdue}</p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Vencimento Mais Antigo</p>
                                <p className="text-sm font-semibold">
                                  {alert.oldest_due_date ? formatDate(alert.oldest_due_date) : '-'}
                                </p>
                              </div>
                            </div>

                            {alert.severity === "critical" && (
                              <Alert className="mb-3 bg-white/50">
                                <TrendingDown className="h-4 w-4" />
                                <AlertTitle className="text-sm">
                                  Sugestão de Ação
                                </AlertTitle>
                                <AlertDescription className="text-xs">
                                  Cliente com {alert.months_overdue} meses de atraso. Considere
                                  reduzir a prestação de serviços até regularização.
                                </AlertDescription>
                              </Alert>
                            )}

                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleSendCollectionLetter(alert.client.id, "email")
                                }
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                Enviar E-mail
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleSendCollectionLetter(alert.client.id, "whatsapp")
                                }
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Enviar WhatsApp
                              </Button>
                              {alert.severity === "critical" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-400 text-red-700 hover:bg-red-100"
                                  onClick={() => handleReduceServices(alert.client.id)}
                                >
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                  Reduzir Serviços
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(
                                    `/invoices?client=${alert.client.id}&status=overdue`
                                  )
                                }
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Ver Faturas
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* All Invoices */}
              <TabsContent value="invoices">
                <Card>
                  <CardHeader>
                    <CardTitle>Todas as Faturas em Atraso</CardTitle>
                    <CardDescription>
                      Lista completa de honorários vencidos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Carregando faturas...</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Competência</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Dias de Atraso</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overdueInvoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">
                                {invoice.clients.name}
                              </TableCell>
                              <TableCell>{invoice.competence}</TableCell>
                              <TableCell>{formatDate(invoice.due_date)}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    invoice.days_overdue >= 90
                                      ? "bg-red-100 text-red-800"
                                      : invoice.days_overdue >= 60
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }
                                >
                                  {invoice.days_overdue} dias
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(Number(invoice.amount))}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost">
                                  Ver Detalhes
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default CollectionDashboard;
