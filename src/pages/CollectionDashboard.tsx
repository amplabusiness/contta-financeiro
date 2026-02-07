import { useState, useEffect, useCallback } from "react";
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
  Database,
} from "lucide-react";
// supabase removido - dados vem da FONTE DA VERDADE via accountMapping
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
import { getReceivablesByClient, getClientReceivablesDetail } from "@/lib/accountMapping";

interface Client {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
}

// Alerta de cobranca baseado na FONTE DA VERDADE (accounting_entries)
interface CollectionAlert {
  client: Client;
  openingBalance: number;  // Saldo inicial (antes do periodo)
  debit: number;           // Debitos no periodo (novos valores a receber)
  credit: number;          // Creditos no periodo (recebimentos)
  balance: number;         // Saldo final (valor ainda a receber)
  months_overdue: number;
  severity: "critical" | "high" | "medium";
}

// Detalhes do razao do cliente
interface ClientLedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  entryType: string;
}

const CollectionDashboard = () => {
  const { toast } = useToast();
  const { selectedMonth, selectedYear } = usePeriod();

  // Estados de carregamento
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Estados de dados principais
  const [collectionAlerts, setCollectionAlerts] = useState<CollectionAlert[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientLedger, setClientLedger] = useState<ClientLedgerEntry[]>([]);
  const [stats, setStats] = useState({
    totalOverdue: 0,
    totalClients: 0,
    criticalAlerts: 0,
    totalOpeningBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
  });

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const fetchCollectionData = useCallback(async () => {
    setIsLoading(true);
    try {
      // =====================================================
      // FONTE DA VERDADE: Buscar saldos de Clientes a Receber
      // da tabela accounting_entries + accounting_entry_items
      // =====================================================
      const receivables = await getReceivablesByClient(selectedYear, selectedMonth);

      // NOTA: A tabela clients esta vazia, os dados dos clientes sao extraidos
      // diretamente das descricoes dos lancamentos contabeis.
      // Por isso, nao fazemos query na tabela clients.

      // Criar alertas de cobranca baseados nos saldos
      const alerts: CollectionAlert[] = [];

      receivables.clients.forEach(clientReceivable => {
        // So incluir clientes com saldo positivo (valor a receber)
        if (clientReceivable.balance <= 0) return;

        // Cliente extraido da FONTE DA VERDADE (descricao do lancamento)
        const client: Client = {
          id: clientReceivable.clientId,
          name: clientReceivable.clientName,
          cnpj: "",
          email: "",
          phone: "",
        };

        // Calcular meses de atraso baseado no saldo inicial
        // Se tem saldo inicial, significa que ha valores de periodos anteriores
        let months_overdue = 0;
        if (clientReceivable.openingBalance > 0) {
          // Simplificacao: se tem saldo de abertura, assumir pelo menos 1 mes de atraso
          // Em uma implementacao mais robusta, buscar a data mais antiga dos lancamentos
          months_overdue = Math.max(1, Math.floor(clientReceivable.openingBalance / (clientReceivable.balance / 2)));
          // Limitar a um valor razoavel
          if (months_overdue > 24) months_overdue = 24;
        }

        let severity: "critical" | "high" | "medium" = "medium";
        if (months_overdue >= 3 || clientReceivable.openingBalance > 10000) {
          severity = "critical";
        } else if (months_overdue >= 2 || clientReceivable.openingBalance > 5000) {
          severity = "high";
        }

        alerts.push({
          client,
          openingBalance: clientReceivable.openingBalance,
          debit: clientReceivable.debit,
          credit: clientReceivable.credit,
          balance: clientReceivable.balance,
          months_overdue,
          severity,
        });
      });

      // Ordenar por saldo decrescente (maiores devedores primeiro)
      alerts.sort((a, b) => {
        // Primeiro por severidade
        const severityOrder = { critical: 3, high: 2, medium: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        // Depois por saldo
        return b.balance - a.balance;
      });

      setCollectionAlerts(alerts);

      // Calcular estatisticas
      const criticalAlerts = alerts.filter(a => a.severity === "critical").length;

      setStats({
        totalOverdue: receivables.totalBalance,
        totalClients: alerts.length,
        criticalAlerts,
        totalOpeningBalance: receivables.totalOpeningBalance,
        totalDebit: receivables.totalDebit,
        totalCredit: receivables.totalCredit,
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

  const fetchClientLedger = useCallback(async (clientId: string) => {
    setIsLoadingLedger(true);
    try {
      const ledger = await getClientReceivablesDetail(clientId, selectedYear, selectedMonth);
      setClientLedger(ledger);
      setSelectedClientId(clientId);
    } catch (error) {
      console.error("Error fetching client ledger:", error);
      toast({
        title: "Erro ao carregar razao",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedYear, selectedMonth, toast]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    fetchCollectionData();
  }, [fetchCollectionData]);

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

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

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleSendCollectionLetter = (clientId: string, method: "email" | "whatsapp") => {
    toast({
      title: `Carta de cobranca ${method === "email" ? "por e-mail" : "por WhatsApp"}`,
      description: "Funcionalidade em desenvolvimento",
    });
  };

  const handleReduceServices = (clientId: string) => {
    toast({
      title: "Reduzir servicos",
      description: "Funcionalidade em desenvolvimento",
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Dashboard de Cobranca</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Monitore inadimplencia e gerencie cobrancas
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  <Database className="w-3 h-3 mr-1" />
                  Fonte da Verdade
                </Badge>
                <Button onClick={() => fetchCollectionData()}>
                  Atualizar Dados
                </Button>
              </div>
            </div>

            <PeriodFilter />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total a Receber
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(stats.totalOverdue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo da conta 1.1.2.01
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Clientes com Saldo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="w-8 h-8 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.totalClients}</p>
                      <p className="text-xs text-muted-foreground">
                        clientes com valores a receber
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Alertas Criticos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {stats.criticalAlerts}
                      </p>
                      <p className="text-xs text-muted-foreground">saldos elevados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Movimentacao do Periodo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-sm">
                        <span className="text-green-600">+{formatCurrency(stats.totalDebit)}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-red-600">-{formatCurrency(stats.totalCredit)}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Critical Alerts */}
            {stats.criticalAlerts > 0 && (
              <Alert className="border-red-300 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">
                  {stats.criticalAlerts} {stats.criticalAlerts === 1 ? "Cliente" : "Clientes"} com
                  Saldo Critico
                </AlertTitle>
                <AlertDescription className="text-red-700">
                  Existem clientes com saldos elevados a receber. Considere acoes de cobranca.
                </AlertDescription>
              </Alert>
            )}

            {/* Tabs */}
            <Tabs defaultValue="alerts" className="space-y-4">
              <TabsList>
                <TabsTrigger value="alerts">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Clientes a Receber
                </TabsTrigger>
                <TabsTrigger value="ledger">
                  <FileText className="w-4 h-4 mr-2" />
                  Razao do Cliente
                </TabsTrigger>
              </TabsList>

              {/* Clients with Balance */}
              <TabsContent value="alerts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Clientes com Valores a Receber</CardTitle>
                    <CardDescription>
                      Saldos da conta 1.1.2.01 (Clientes a Receber) - FONTE DA VERDADE
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
                          Nenhum Valor a Receber!
                        </h3>
                        <p className="text-muted-foreground">
                          Todos os clientes estao em dia com os pagamentos.
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
                                  {alert.client.cnpj && (
                                    <p className="text-sm opacity-80">
                                      CNPJ: {alert.client.cnpj}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={`${getSeverityColor(alert.severity)} border`}
                              >
                                {alert.severity === "critical"
                                  ? "CRITICO"
                                  : alert.severity === "high"
                                  ? "ALTO"
                                  : "MEDIO"}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div>
                                <p className="text-xs opacity-70">Saldo Inicial</p>
                                <p className="text-lg font-bold">
                                  {formatCurrency(alert.openingBalance)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Debitos (Novas Faturas)</p>
                                <p className="text-lg font-bold text-green-700">
                                  +{formatCurrency(alert.debit)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Creditos (Recebimentos)</p>
                                <p className="text-lg font-bold text-red-700">
                                  -{formatCurrency(alert.credit)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs opacity-70">Saldo Final</p>
                                <p className="text-lg font-bold">
                                  {formatCurrency(alert.balance)}
                                </p>
                              </div>
                            </div>

                            {alert.severity === "critical" && (
                              <Alert className="mb-3 bg-white/50">
                                <TrendingDown className="h-4 w-4" />
                                <AlertTitle className="text-sm">
                                  Sugestao de Acao
                                </AlertTitle>
                                <AlertDescription className="text-xs">
                                  Cliente com saldo elevado ({formatCurrency(alert.balance)}).
                                  Considere entrar em contato para cobranca.
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
                                  Reduzir Servicos
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchClientLedger(alert.client.id)}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Ver Razao
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Client Ledger */}
              <TabsContent value="ledger">
                <Card>
                  <CardHeader>
                    <CardTitle>Razao do Cliente</CardTitle>
                    <CardDescription>
                      Extrato detalhado dos lancamentos na conta Clientes a Receber
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!selectedClientId ? (
                      <div className="text-center py-12">
                        <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                          Selecione um Cliente
                        </h3>
                        <p className="text-muted-foreground">
                          Clique em "Ver Razao" em um cliente para ver o extrato.
                        </p>
                      </div>
                    ) : isLoadingLedger ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Carregando razao...</p>
                      </div>
                    ) : clientLedger.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Nenhum lancamento encontrado para este cliente.
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descricao</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Debito</TableHead>
                            <TableHead className="text-right">Credito</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientLedger.map((entry, index) => (
                            <TableRow key={index}>
                              <TableCell>{formatDate(entry.date)}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {entry.description}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {entry.entryType}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(entry.balance)}
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
