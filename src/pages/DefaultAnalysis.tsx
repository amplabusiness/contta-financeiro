import { useState, useEffect, useCallback } from "react";
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
  BookOpen,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useClient } from "@/contexts/ClientContext";
import { usePeriod } from "@/contexts/PeriodContext";
import { getReceivablesByClient, getAccountBalance, ACCOUNT_MAPPING } from "@/lib/accountMapping";

// Dados da Fonte da Verdade (accounting_entries)
interface ClientReceivable {
  clientId: string;
  clientName: string;
  openingBalance: number;  // Saldo inicial (antes do período)
  debit: number;           // Débitos no período (novos valores a receber)
  credit: number;          // Créditos no período (recebimentos)
  balance: number;         // Saldo final (valor ainda a receber)
}

// Interface legada para compatibilidade
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
  const { selectedClientId, selectedClientName } = useClient();
  const { selectedYear, selectedMonth, getEndDate, getFormattedPeriod } = usePeriod();

  // Estados de carregamento
  const [loading, setLoading] = useState(true);

  // Estados de dados principais
  const [receivables, setReceivables] = useState<ClientReceivable[]>([]);
  const [accountSummary, setAccountSummary] = useState({
    openingBalance: 0,
    debit: 0,
    credit: 0,
    balance: 0,
  });
  const [sortBy, setSortBy] = useState<"amount" | "opening" | "debit">("amount");
  const [stats, setStats] = useState({
    totalClients: 0,
    totalOverdue: 0,
    totalInvoices: 0,
    averageDaysLate: 0,
    defaultRate: 0,
  });

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadDefaultData = useCallback(async () => {
    try {
      setLoading(true);

      // =================================================================
      // FONTE DA VERDADE: accounting_entries + accounting_entry_items
      // =================================================================

      // 1. Buscar saldo geral da conta 1.1.2.01 (Clientes a Receber)
      const accountBalance = await getAccountBalance(
        ACCOUNT_MAPPING.CONTAS_A_RECEBER,
        selectedYear,
        selectedMonth
      );

      setAccountSummary({
        openingBalance: accountBalance.openingBalance,
        debit: accountBalance.debit,
        credit: accountBalance.credit,
        balance: accountBalance.balance,
      });

      // 2. Buscar saldos por cliente da fonte da verdade
      const receivablesData = await getReceivablesByClient(
        selectedYear,
        selectedMonth,
        selectedClientId || undefined
      );

      setReceivables(receivablesData.clients);

      // 3. Calcular estatísticas
      const { count: totalActiveClients } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setStats({
        totalClients: receivablesData.clients.length,
        totalOverdue: receivablesData.totalBalance,
        totalInvoices: receivablesData.clients.length, // Cada cliente = 1 posição
        averageDaysLate: 0, // Removido - não faz sentido na visão contábil
        defaultRate: totalActiveClients
          ? (receivablesData.clients.length / totalActiveClients) * 100
          : 0,
      });

    } catch (error: any) {
      console.error("Error loading default data:", error);
      toast.error("Erro ao carregar dados de inadimplência: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, selectedYear, selectedMonth]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadDefaultData();
  }, [loadDefaultData]);

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getBalanceBadge = (balance: number, openingBalance: number) => {
    // Se saldo aumentou muito desde a abertura = Alto Risco
    const increase = openingBalance > 0 ? ((balance - openingBalance) / openingBalance) * 100 : 0;

    if (balance > 10000 || increase > 50) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Alto Valor
        </Badge>
      );
    }
    if (balance > 5000) {
      return (
        <Badge variant="default" className="gap-1 bg-orange-500">
          <Clock className="h-3 w-3" />
          Médio
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-yellow-500">
        <Calendar className="h-3 w-3" />
        Baixo
      </Badge>
    );
  };

  const getSortedReceivables = () => {
    return [...receivables].sort((a, b) => {
      switch (sortBy) {
        case "amount":
          return b.balance - a.balance;
        case "opening":
          return b.openingBalance - a.openingBalance;
        case "debit":
          return b.debit - a.debit;
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

  const sortedReceivables = getSortedReceivables();

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              {selectedClientId ? `Clientes a Receber - ${selectedClientName}` : "Clientes a Receber"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Conta 1.1.2.01 - {getFormattedPeriod()} • Fonte da Verdade: accounting_entries
            </p>
          </div>
        </div>

        {/* RAZÃO CONTÁBIL - Resumo da Conta 1.1.2.01 */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle>Razão Contábil - Conta 1.1.2.01 (Clientes a Receber)</CardTitle>
            </div>
            <CardDescription>
              Saldo Inicial + Débitos - Créditos = Saldo Final
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">Saldo Inicial</p>
                <p className="text-2xl font-bold">{formatCurrency(accountSummary.openingBalance)}</p>
                <p className="text-xs text-muted-foreground">Até {selectedMonth > 1 ? `${selectedMonth - 1}/${selectedYear}` : '12/' + (selectedYear - 1)}</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">+ Débitos</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(accountSummary.debit)}</p>
                <p className="text-xs text-muted-foreground">Novas faturas</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">- Créditos</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(accountSummary.credit)}</p>
                <p className="text-xs text-muted-foreground">Recebimentos</p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg border-2 border-primary">
                <p className="text-sm text-muted-foreground mb-1">= Saldo Final</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(accountSummary.balance)}</p>
                <p className="text-xs text-muted-foreground">A receber</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes com Saldo</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                {stats.defaultRate.toFixed(1)}% dos clientes ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats.totalOverdue)}
              </div>
              <p className="text-xs text-muted-foreground">Saldo contábil</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alto Valor (&gt;R$ 10k)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {receivables.filter((c) => c.balance > 10000).length}
              </div>
              <p className="text-xs text-muted-foreground">Clientes prioritários</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Clientes</CardTitle>
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
            <CardTitle>Ordenação</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Ordenar por</label>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Maior Saldo Final</SelectItem>
                  <SelectItem value="opening">Maior Saldo Inicial</SelectItem>
                  <SelectItem value="debit">Mais Débitos no Período</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table - Formato de Razão por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Razão por Cliente</CardTitle>
            <CardDescription>
              {sortedReceivables.length} clientes com saldo a receber
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedReceivables.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum cliente com saldo a receber encontrado</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Saldo Inicial</TableHead>
                      <TableHead className="text-right">+ Débitos</TableHead>
                      <TableHead className="text-right">- Créditos</TableHead>
                      <TableHead className="text-right">= Saldo Final</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReceivables.map((client) => (
                      <TableRow key={client.clientId}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(client.openingBalance)}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {formatCurrency(client.debit)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(client.credit)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(client.balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getBalanceBadge(client.balance, client.openingBalance)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
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

        {/* Distribution by Value */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Baixo Valor (até R$ 2.000)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {receivables.filter((c) => c.balance <= 2000).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(
                  receivables
                    .filter((c) => c.balance <= 2000)
                    .reduce((sum, c) => sum + c.balance, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Médio Valor (R$ 2.001 - R$ 10.000)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {receivables.filter((c) => c.balance > 2000 && c.balance <= 10000).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(
                  receivables
                    .filter((c) => c.balance > 2000 && c.balance <= 10000)
                    .reduce((sum, c) => sum + c.balance, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Alto Valor (&gt; R$ 10.000)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {receivables.filter((c) => c.balance > 10000).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(
                  receivables
                    .filter((c) => c.balance > 10000)
                    .reduce((sum, c) => sum + c.balance, 0)
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
