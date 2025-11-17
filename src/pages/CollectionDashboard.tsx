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
}

const CollectionDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [collectionAlerts, setCollectionAlerts] = useState<CollectionAlert[]>([]);
  const [stats, setStats] = useState({
    totalOverdue: 0,
    totalClients: 0,
    criticalAlerts: 0,
    avgDaysOverdue: 0,
  });

  const fetchCollectionData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch overdue invoices with client information
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
        .order("due_date", { ascending: true });

      if (invoicesError) throw invoicesError;

      // Calculate days overdue for each invoice
      const invoicesWithDays = (invoicesData || []).map((invoice) => ({
        ...invoice,
        days_overdue: Math.floor(
          (new Date().getTime() - new Date(invoice.due_date).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      }));

      setOverdueInvoices(invoicesWithDays);

      // Group by client and calculate alerts
      const clientGroups = new Map<string, OverdueInvoice[]>();
      invoicesWithDays.forEach((invoice) => {
        const clientId = invoice.client_id;
        if (!clientGroups.has(clientId)) {
          clientGroups.set(clientId, []);
        }
        clientGroups.get(clientId)!.push(invoice);
      });

      // Create collection alerts
      const alerts: CollectionAlert[] = [];
      clientGroups.forEach((invoices, clientId) => {
        const client = invoices[0].clients;
        const overdue_count = invoices.length;
        const overdue_amount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
        const oldest_invoice = invoices.sort(
          (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        )[0];
        const months_overdue = Math.floor(oldest_invoice.days_overdue / 30);

        let severity: "critical" | "high" | "medium" = "medium";
        if (months_overdue >= 3) severity = "critical";
        else if (months_overdue >= 2) severity = "high";

        alerts.push({
          client,
          overdue_count,
          overdue_amount,
          months_overdue,
          oldest_due_date: oldest_invoice.due_date,
          severity,
        });
      });

      // Sort by severity
      alerts.sort((a, b) => {
        const severityOrder = { critical: 3, high: 2, medium: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      setCollectionAlerts(alerts);

      // Calculate stats
      const totalOverdue = invoicesWithDays.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      );
      const totalClients = clientGroups.size;
      const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
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
  }, [toast]);

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
                        {overdueInvoices.length} faturas
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

                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div>
                                <p className="text-xs opacity-70">Faturas em Atraso</p>
                                <p className="text-lg font-bold">{alert.overdue_count}</p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Valor Total</p>
                                <p className="text-lg font-bold">
                                  {formatCurrency(alert.overdue_amount)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Meses de Atraso</p>
                                <p className="text-lg font-bold">{alert.months_overdue}</p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Vencimento Mais Antigo</p>
                                <p className="text-sm font-semibold">
                                  {formatDate(alert.oldest_due_date)}
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
