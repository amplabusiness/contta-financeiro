import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  DollarSign,
  Users,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ClientDefault {
  clientId: string;
  clientName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestOverdue: string;
  daysOverdue: number;
  invoices: Array<{
    id: string;
    amount: number;
    dueDate: string;
    competence: string;
    daysLate: number;
  }>;
}

export default function DefaultAnalysis() {
  const [clients, setClients] = useState<ClientDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"amount" | "days" | "count">("amount");
  const [filterDays, setFilterDays] = useState<string>("all");
  const [stats, setStats] = useState({
    totalClients: 0,
    totalOverdue: 0,
    totalInvoices: 0,
    averageDaysLate: 0,
    defaultRate: 0,
  });

  useEffect(() => {
    loadDefaultData();
  }, []);

  const loadDefaultData = async () => {
    try {
      setLoading(true);

      // Get all overdue invoices
      const today = new Date().toISOString().split("T")[0];
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(
          `
          id,
          client_id,
          amount,
          due_date,
          competence,
          status,
          clients (
            id,
            name
          )
        `
        )
        .eq("status", "pending")
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Group by client
      const clientMap = new Map<string, ClientDefault>();

      for (const invoice of invoices || []) {
        const client = invoice.clients as any;
        if (!client) continue;

        const daysLate = differenceInDays(new Date(), parseISO(invoice.due_date));

        if (!clientMap.has(client.id)) {
          clientMap.set(client.id, {
            clientId: client.id,
            clientName: client.name,
            totalOverdue: 0,
            overdueCount: 0,
            oldestOverdue: invoice.due_date,
            daysOverdue: daysLate,
            invoices: [],
          });
        }

        const clientData = clientMap.get(client.id)!;
        clientData.totalOverdue += Number(invoice.amount);
        clientData.overdueCount++;
        clientData.invoices.push({
          id: invoice.id,
          amount: Number(invoice.amount),
          dueDate: invoice.due_date,
          competence: invoice.competence || "",
          daysLate,
        });

        if (daysLate > clientData.daysOverdue) {
          clientData.daysOverdue = daysLate;
          clientData.oldestOverdue = invoice.due_date;
        }
      }

      const clientsArray = Array.from(clientMap.values());

      // Calculate stats
      const totalOverdueAmount = clientsArray.reduce((sum, c) => sum + c.totalOverdue, 0);
      const totalOverdueInvoices = clientsArray.reduce((sum, c) => sum + c.overdueCount, 0);
      const avgDays =
        clientsArray.reduce((sum, c) => sum + c.daysOverdue, 0) / (clientsArray.length || 1);

      // Get total active clients for default rate
      const { count: totalActiveClients } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setStats({
        totalClients: clientsArray.length,
        totalOverdue: totalOverdueAmount,
        totalInvoices: totalOverdueInvoices,
        averageDaysLate: Math.round(avgDays),
        defaultRate: totalActiveClients
          ? (clientsArray.length / totalActiveClients) * 100
          : 0,
      });

      setClients(clientsArray);
    } catch (error: any) {
      console.error("Error loading default data:", error);
      toast.error("Erro ao carregar dados de inadimplência: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getRiskBadge = (days: number) => {
    if (days > 90)
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Alto Risco
        </Badge>
      );
    if (days > 30)
      return (
        <Badge variant="default" className="gap-1 bg-orange-500">
          <Clock className="h-3 w-3" />
          Risco Médio
        </Badge>
      );
    return (
      <Badge variant="default" className="gap-1 bg-yellow-500">
        <Calendar className="h-3 w-3" />
        Risco Baixo
      </Badge>
    );
  };

  const getSortedClients = () => {
    let filtered = [...clients];

    // Apply filter
    if (filterDays !== "all") {
      const days = parseInt(filterDays);
      filtered = filtered.filter((c) => c.daysOverdue >= days);
    }

    // Apply sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "amount":
          return b.totalOverdue - a.totalOverdue;
        case "days":
          return b.daysOverdue - a.daysOverdue;
        case "count":
          return b.overdueCount - a.overdueCount;
        default:
          return 0;
      }
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const sortedClients = getSortedClients();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Análise de Inadimplência</h1>
          <p className="text-muted-foreground mt-2">
            Visão completa dos clientes inadimplentes e indicadores de cobrança
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Inadimplentes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                {stats.defaultRate.toFixed(1)}% dos clientes ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor em Atraso</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(stats.totalOverdue)}
              </div>
              <p className="text-xs text-muted-foreground">{stats.totalInvoices} faturas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média de Atraso</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageDaysLate} dias</div>
              <p className="text-xs text-muted-foreground">Tempo médio de atraso</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alto Risco</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {clients.filter((c) => c.daysOverdue > 90).length}
              </div>
              <p className="text-xs text-muted-foreground">Mais de 90 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Inadimplência</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.defaultRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Do total de clientes</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros e Ordenação</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Ordenar por</label>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Maior Valor</SelectItem>
                  <SelectItem value="days">Mais Dias em Atraso</SelectItem>
                  <SelectItem value="count">Mais Faturas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Filtrar por atraso</label>
              <Select value={filterDays} onValueChange={setFilterDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">1+ dias</SelectItem>
                  <SelectItem value="30">30+ dias</SelectItem>
                  <SelectItem value="60">60+ dias</SelectItem>
                  <SelectItem value="90">90+ dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes Inadimplentes</CardTitle>
            <CardDescription>
              {sortedClients.length} clientes com faturas em atraso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedClients.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum cliente inadimplente encontrado</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor em Atraso</TableHead>
                      <TableHead className="text-center">Faturas</TableHead>
                      <TableHead className="text-center">Dias em Atraso</TableHead>
                      <TableHead className="text-center">Vencimento Mais Antigo</TableHead>
                      <TableHead className="text-center">Risco</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedClients.map((client) => (
                      <TableRow key={client.clientId}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">
                          {formatCurrency(client.totalOverdue)}
                        </TableCell>
                        <TableCell className="text-center">{client.overdueCount}</TableCell>
                        <TableCell className="text-center font-semibold">
                          {client.daysOverdue} dias
                        </TableCell>
                        <TableCell className="text-center">
                          {format(parseISO(client.oldestOverdue), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="text-center">
                          {getRiskBadge(client.daysOverdue)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Navigate to client details or collection
                              window.location.href = `/client-dashboard?client=${client.clientId}`;
                            }}
                          >
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Risco Baixo (1-30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {clients.filter((c) => c.daysOverdue <= 30).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(
                  clients
                    .filter((c) => c.daysOverdue <= 30)
                    .reduce((sum, c) => sum + c.totalOverdue, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Risco Médio (31-90 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {clients.filter((c) => c.daysOverdue > 30 && c.daysOverdue <= 90).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(
                  clients
                    .filter((c) => c.daysOverdue > 30 && c.daysOverdue <= 90)
                    .reduce((sum, c) => sum + c.totalOverdue, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Alto Risco (90+ dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {clients.filter((c) => c.daysOverdue > 90).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(
                  clients
                    .filter((c) => c.daysOverdue > 90)
                    .reduce((sum, c) => sum + c.totalOverdue, 0)
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
