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
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  FileText,
  Search,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  cnpj: string;
  is_pro_bono: boolean;
}

interface Invoice {
  id: string;
  client_id: string;
  amount: number;
  competence: string;
  due_date: string;
  payment_date: string | null;
  status: string;
  created_at: string;
  clients: Client;
}

interface MonthlyStats {
  totalBilled: number;
  totalReceived: number;
  totalPending: number;
  receivedPercentage: number;
  clientsCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
}

interface OverdueSegmentation {
  oneMonth: { count: number; amount: number; clients: string[] };
  twoMonths: { count: number; amount: number; clients: string[] };
  threeMonths: { count: number; amount: number; clients: string[] };
}

const FeesAnalysis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalBilled: 0,
    totalReceived: 0,
    totalPending: 0,
    receivedPercentage: 0,
    clientsCount: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
  });
  const [overdueSegmentation, setOverdueSegmentation] = useState<OverdueSegmentation>({
    oneMonth: { count: 0, amount: 0, clients: [] },
    twoMonths: { count: 0, amount: 0, clients: [] },
    threeMonths: { count: 0, amount: 0, clients: [] },
  });
  const [missingBillings, setMissingBillings] = useState<Client[]>([]);
  const [proBonoClients, setProBonoClients] = useState<Client[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Identify pro bono clients
      const proBono = (clientsData || []).filter((c) => c.is_pro_bono);
      setProBonoClients(proBono);

      // Fetch invoices based on filters
      let query = supabase
        .from("invoices")
        .select(`
          *,
          clients (
            id,
            name,
            cnpj,
            monthly_fee,
            is_pro_bono
          )
        `)
        .order("competence", { ascending: false });

      // Apply filters
      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }

      if (viewMode === "month") {
        // Filter by specific month (competence format: "MM/YYYY")
        const [year, month] = selectedMonth.split("-");
        const competence = `${month}/${year}`;
        query = query.eq("competence", competence);
      } else {
        // Filter by year
        query = query.like("competence", `%/${selectedYear}`);
      }

      const { data: invoicesData, error: invoicesError } = await query;

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

      // Calculate statistics
      calculateStatistics(invoicesData || [], clientsData || []);

      // Check for missing billings
      checkMissingBillings(clientsData || [], invoicesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally{
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, selectedClient, viewMode, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateStatistics = (invoicesData: Invoice[], clientsData: Client[]) => {
    const totalBilled = invoicesData.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const paidInvoices = invoicesData.filter((inv) => inv.status === "paid");
    const totalReceived = paidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const pendingInvoices = invoicesData.filter((inv) => inv.status === "pending");
    const totalPending = pendingInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const overdueInvoices = invoicesData.filter((inv) => inv.status === "overdue");

    const receivedPercentage = totalBilled > 0 ? (totalReceived / totalBilled) * 100 : 0;

    // Get unique clients
    const uniqueClients = new Set(invoicesData.map((inv) => inv.client_id));

    setMonthlyStats({
      totalBilled,
      totalReceived,
      totalPending,
      receivedPercentage,
      clientsCount: uniqueClients.size,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length,
    });

    // Calculate overdue segmentation
    calculateOverdueSegmentation(overdueInvoices);
  };

  const calculateOverdueSegmentation = (overdueInvoices: Invoice[]) => {
    const today = new Date();
    const oneMonth: { count: number; amount: number; clients: string[] } = {
      count: 0,
      amount: 0,
      clients: [],
    };
    const twoMonths: { count: number; amount: number; clients: string[] } = {
      count: 0,
      amount: 0,
      clients: [],
    };
    const threeMonths: { count: number; amount: number; clients: string[] } = {
      count: 0,
      amount: 0,
      clients: [],
    };

    overdueInvoices.forEach((invoice) => {
      const dueDate = new Date(invoice.due_date);
      const daysDiff = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const monthsDiff = Math.floor(daysDiff / 30);

      const clientName = invoice.clients?.name || "Desconhecido";

      if (monthsDiff >= 3) {
        threeMonths.count++;
        threeMonths.amount += Number(invoice.amount);
        if (!threeMonths.clients.includes(clientName)) {
          threeMonths.clients.push(clientName);
        }
      } else if (monthsDiff >= 2) {
        twoMonths.count++;
        twoMonths.amount += Number(invoice.amount);
        if (!twoMonths.clients.includes(clientName)) {
          twoMonths.clients.push(clientName);
        }
      } else if (monthsDiff >= 1) {
        oneMonth.count++;
        oneMonth.amount += Number(invoice.amount);
        if (!oneMonth.clients.includes(clientName)) {
          oneMonth.clients.push(clientName);
        }
      }
    });

    setOverdueSegmentation({ oneMonth, twoMonths, threeMonths });
  };

  const checkMissingBillings = (clientsData: Client[], invoicesData: Invoice[]) => {
    if (viewMode !== "month") return;

    // Get clients that should have invoices but don't (excluding pro bono)
    const activeClients = clientsData.filter((c) => !c.is_pro_bono);
    const [year, month] = selectedMonth.split("-");
    const competence = `${month}/${year}`;

    const clientsWithInvoices = new Set(
      invoicesData.filter((inv) => inv.competence === competence).map((inv) => inv.client_id)
    );

    const missing = activeClients.filter((client) => !clientsWithInvoices.has(client.id));
    setMissingBillings(missing);
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      paid: (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Pago
        </Badge>
      ),
      pending: (
        <Badge className="bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      ),
      overdue: (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Atrasado
        </Badge>
      ),
    };
    return badges[status] || <Badge>{status}</Badge>;
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
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Análise de Honorários</h1>
                    <p className="text-muted-foreground">
                      Visão completa de faturamento, recebimento e inadimplência
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtros de Análise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Período</label>
                    <Select
                      value={viewMode}
                      onValueChange={(value: "month" | "year") => setViewMode(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Por Mês</SelectItem>
                        <SelectItem value="year">Por Ano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {viewMode === "month" ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mês/Ano</label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ano</label>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger>
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
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cliente</label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Clientes</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button onClick={fetchData} className="w-full">
                      <Search className="w-4 h-4 mr-2" />
                      Analisar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Faturado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(monthlyStats.totalBilled)}</p>
                      <p className="text-xs text-muted-foreground">
                        {monthlyStats.clientsCount} clientes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Recebido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(monthlyStats.totalReceived)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {monthlyStats.receivedPercentage.toFixed(1)}% do faturado
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    A Receber
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="w-8 h-8 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">
                        {formatCurrency(monthlyStats.totalPending)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {monthlyStats.pendingCount} faturas pendentes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Inadimplência
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {monthlyStats.overdueCount}
                      </p>
                      <p className="text-xs text-muted-foreground">faturas atrasadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Segmentation */}
            {monthlyStats.overdueCount > 0 && (
              <Card className="mb-6 border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-5 h-5" />
                    Inadimplência por Período
                  </CardTitle>
                  <CardDescription>
                    Análise detalhada de atrasos por tempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                      <h4 className="font-semibold text-yellow-900 mb-2">1 Mês de Atraso</h4>
                      <p className="text-2xl font-bold text-yellow-800">
                        {formatCurrency(overdueSegmentation.oneMonth.amount)}
                      </p>
                      <p className="text-sm text-yellow-700">
                        {overdueSegmentation.oneMonth.count} faturas •{" "}
                        {overdueSegmentation.oneMonth.clients.length} clientes
                      </p>
                      <p className="text-xs text-yellow-600 mt-2">
                        {overdueSegmentation.oneMonth.clients.slice(0, 3).join(", ")}
                        {overdueSegmentation.oneMonth.clients.length > 3 &&
                          ` +${overdueSegmentation.oneMonth.clients.length - 3}`}
                      </p>
                    </div>

                    <div className="p-4 bg-orange-100 border border-orange-300 rounded-lg">
                      <h4 className="font-semibold text-orange-900 mb-2">2 Meses de Atraso</h4>
                      <p className="text-2xl font-bold text-orange-800">
                        {formatCurrency(overdueSegmentation.twoMonths.amount)}
                      </p>
                      <p className="text-sm text-orange-700">
                        {overdueSegmentation.twoMonths.count} faturas •{" "}
                        {overdueSegmentation.twoMonths.clients.length} clientes
                      </p>
                      <p className="text-xs text-orange-600 mt-2">
                        {overdueSegmentation.twoMonths.clients.slice(0, 3).join(", ")}
                        {overdueSegmentation.twoMonths.clients.length > 3 &&
                          ` +${overdueSegmentation.twoMonths.clients.length - 3}`}
                      </p>
                    </div>

                    <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
                      <h4 className="font-semibold text-red-900 mb-2">3+ Meses de Atraso</h4>
                      <p className="text-2xl font-bold text-red-800">
                        {formatCurrency(overdueSegmentation.threeMonths.amount)}
                      </p>
                      <p className="text-sm text-red-700">
                        {overdueSegmentation.threeMonths.count} faturas •{" "}
                        {overdueSegmentation.threeMonths.clients.length} clientes
                      </p>
                      <p className="text-xs text-red-600 mt-2">
                        {overdueSegmentation.threeMonths.clients.slice(0, 3).join(", ")}
                        {overdueSegmentation.threeMonths.clients.length > 3 &&
                          ` +${overdueSegmentation.threeMonths.clients.length - 3}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Audit Alerts */}
            {viewMode === "month" && (
              <>
                {missingBillings.length > 0 && (
                  <Alert className="mb-6 border-orange-300 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-800">
                      ⚠️ Auditoria: {missingBillings.length} Cliente(s) Sem Boleto
                    </AlertTitle>
                    <AlertDescription className="text-orange-700">
                      Os seguintes clientes não tiveram honorários emitidos para{" "}
                      {selectedMonth}:
                      <br />
                      <strong>{missingBillings.map((c) => c.name).join(", ")}</strong>
                      <br />
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => navigate("/invoices")}
                      >
                        Ir para Honorários
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {proBonoClients.length > 0 && (
                  <Alert className="mb-6 border-blue-300 bg-blue-50">
                    <Users className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">
                      Clientes Pro Bono ({proBonoClients.length})
                    </AlertTitle>
                    <AlertDescription className="text-blue-700">
                      {proBonoClients.map((c) => c.name).join(", ")}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Invoices Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Honorários</CardTitle>
                <CardDescription>
                  Todas as faturas do período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Carregando dados...</p>
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum honorário encontrado</h3>
                    <p className="text-muted-foreground">
                      Não há faturas para os filtros selecionados
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.clients?.name || "N/A"}
                            {invoice.clients?.is_pro_bono && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Pro Bono
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{invoice.competence}</TableCell>
                          <TableCell>{formatDate(invoice.due_date)}</TableCell>
                          <TableCell>
                            {invoice.payment_date ? formatDate(invoice.payment_date) : "-"}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Number(invoice.amount))}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        </TableRow>
                      ))}
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

export default FeesAnalysis;
