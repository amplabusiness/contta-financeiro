import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAccountsPayable } from "@/lib/accountMapping";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";

// Interface baseada na FONTE DA VERDADE (accounting_entries)
interface AccountPayable {
  id: string;
  date: string;
  description: string;
  supplier: string;
  amount: number;
  paidAmount: number;
  accountCode: string;
  accountName: string;
  status: "pending" | "paid" | "partial";
  entryId: string;
}

// Interface para resumo por conta contábil
interface PayableSummary {
  accountCode: string;
  accountName: string;
  totalPending: number;
  totalPaid: number;
  count: number;
}

const AccountsPayable = () => {
  const { selectedYear, selectedMonth } = usePeriod();

  // Estados de carregamento
  const [loading, setLoading] = useState(true);

  // Estados de dados principais
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [summary, setSummary] = useState<PayableSummary[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [filterTab, setFilterTab] = useState("all");

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAccountsPayable(selectedYear, selectedMonth);

      setAccounts(result.entries);
      setSummary(result.summary);
      setTotalPending(result.totalPending);
      setTotalPaid(result.totalPaid);
    } catch (error: unknown) {
      console.error("Erro ao carregar contas a pagar:", error);
      toast.error("Erro ao carregar contas a pagar");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const getStatusBadge = (status: "pending" | "paid" | "partial") => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      paid: "secondary",
      partial: "default"
    };

    const labels: Record<string, string> = {
      pending: "Pendente",
      paid: "Pago",
      partial: "Parcial"
    };

    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const filteredAccounts = accounts.filter(account => {
    if (filterTab === "all") return true;
    if (filterTab === "pending") return account.status === "pending";
    if (filterTab === "paid") return account.status === "paid";
    if (filterTab === "partial") return account.status === "partial";
    return true;
  });

  const stats = {
    total: accounts.length,
    pending: accounts.filter(a => a.status === "pending").length,
    paid: accounts.filter(a => a.status === "paid").length,
    partial: accounts.filter(a => a.status === "partial").length,
    totalAmount: accounts.reduce((sum, a) => sum + a.amount, 0),
    pendingAmount: totalPending,
    paidAmount: totalPaid,
  };

  if (loading && accounts.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Contas a Pagar</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Passivo Circulante - Contas do grupo 2.1.x • Fonte da Verdade: accounting_entries
            </p>
          </div>
        </div>

        <PeriodFilter />

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Provisionado */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Provisionado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.totalAmount)}
              </p>
              <p className="text-xs text-gray-500 mt-2">lançamento(s)</p>
            </CardContent>
          </Card>

          {/* A Pagar (Pendente) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                A Pagar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.pendingAmount)}
              </p>
              <p className="text-xs text-gray-500 mt-2">pendente(s)</p>
            </CardContent>
          </Card>

          {/* Pago */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.paidAmount)}
              </p>
              <p className="text-xs text-gray-500 mt-2">pago(s)</p>
            </CardContent>
          </Card>

          {/* Parcial */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pagamento Parcial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.partial}</div>
              <p className="text-xs text-muted-foreground mt-1">
                parcialmente pago(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por Conta Contábil */}
        {summary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo por Conta Contábil</CardTitle>
              <CardDescription>
                Saldos agrupados por conta do passivo circulante (2.1.x)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">A Pagar</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((s) => (
                    <TableRow key={s.accountCode}>
                      <TableCell className="font-mono text-sm">{s.accountCode}</TableCell>
                      <TableCell>{s.accountName}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(s.totalPending)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(s.totalPaid)}
                      </TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Tabela de Contas */}
        <Card>
          <CardHeader>
            <CardTitle>Lançamentos de Contas a Pagar</CardTitle>
            <CardDescription>
              Provisões de despesas registradas no passivo (D - Despesa / C - Passivo)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={filterTab} onValueChange={setFilterTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="all">Todas ({stats.total})</TabsTrigger>
                <TabsTrigger value="pending">Pendentes ({stats.pending})</TabsTrigger>
                <TabsTrigger value="paid">Pagas ({stats.paid})</TabsTrigger>
                <TabsTrigger value="partial">Parciais ({stats.partial})</TabsTrigger>
              </TabsList>
            </Tabs>

            {filteredAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma conta a pagar encontrada</p>
                <p className="text-sm mt-2">
                  As provisões aparecerão aqui quando houver lançamentos com crédito nas contas 2.1.x
                </p>
                <p className="text-xs mt-4 text-muted-foreground">
                  Exemplo: D - Despesa (4.x) / C - Contas a Pagar (2.1.x)
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          {format(new Date(account.date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {account.supplier}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {account.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {account.accountCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(account.amount)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(account.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(account.amount - account.paidAmount)}
                        </TableCell>
                        <TableCell>{getStatusBadge(account.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AccountsPayable;
