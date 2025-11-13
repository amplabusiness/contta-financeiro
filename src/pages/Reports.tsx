import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingDown, Calendar, DollarSign, Eye } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DefaultEvolutionChart } from "@/components/DefaultEvolutionChart";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientDebt {
  client_id: string;
  client_name: string;
  total_overdue: number;
  count_overdue: number;
  oldest_invoice_date: string;
  days_overdue: number;
  invoices: any[];
}

const Reports = () => {
  const [debtReport, setDebtReport] = useState<ClientDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDebt | null>(null);

  const months = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const years = ["2024", "2025", "2026"];

  useEffect(() => {
    loadDebtReport();
  }, [filterYear, filterMonth]);

  const loadDebtReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("invoices")
        .select("*, clients(name)")
        .in("status", ["pending", "overdue"]);

      // Filtrar por competência se selecionado
      if (filterYear && filterMonth) {
        const competence = `${filterMonth}/${filterYear}`;
        query = query.eq("competence", competence);
      } else if (filterYear) {
        query = query.like("competence", `%/${filterYear}`);
      }

      const { data: invoices, error } = await query;

      if (error) throw error;

      // Agrupar por cliente e calcular totais
      const debtMap = new Map<string, ClientDebt>();

      invoices?.forEach((invoice) => {
        const clientId = invoice.client_id;
        const clientName = invoice.clients?.name || "Cliente desconhecido";

        if (!debtMap.has(clientId)) {
          debtMap.set(clientId, {
            client_id: clientId,
            client_name: clientName,
            total_overdue: 0,
            count_overdue: 0,
            oldest_invoice_date: invoice.due_date,
            days_overdue: 0,
            invoices: [],
          });
        }

        const clientDebt = debtMap.get(clientId)!;
        clientDebt.total_overdue += Number(invoice.amount);
        clientDebt.count_overdue += 1;
        clientDebt.invoices.push(invoice);

        // Calcular a data mais antiga
        if (new Date(invoice.due_date) < new Date(clientDebt.oldest_invoice_date)) {
          clientDebt.oldest_invoice_date = invoice.due_date;
        }
      });

      // Calcular dias de atraso e ordenar por valor total
      const today = new Date();
      const debtArray = Array.from(debtMap.values()).map((debt) => {
        const oldestDate = new Date(debt.oldest_invoice_date);
        debt.days_overdue = Math.floor((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
        return debt;
      });

      // Ordenar por valor total em ordem decrescente
      debtArray.sort((a, b) => b.total_overdue - a.total_overdue);

      setDebtReport(debtArray);
      setTotalOverdue(debtArray.reduce((sum, debt) => sum + debt.total_overdue, 0));
      setTotalClients(debtArray.length);
    } catch (error) {
      console.error("Erro ao carregar relatório:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (daysOverdue: number) => {
    if (daysOverdue <= 30) {
      return <Badge variant="secondary">Baixo Risco</Badge>;
    } else if (daysOverdue <= 60) {
      return <Badge className="bg-warning text-warning-foreground">Médio Risco</Badge>;
    } else {
      return <Badge variant="destructive">Alto Risco</Badge>;
    }
  };

  const handleClientClick = (debt: ClientDebt) => {
    setSelectedClient(debt);
    setDetailDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    if (status === "overdue") {
      return <Badge variant="destructive">Vencida</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatório de Inadimplência</h1>
          <p className="text-muted-foreground">Ranking dos clientes com honorários em atraso</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar inadimplência por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2 w-40">
                <Label>Ano</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os anos" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-40">
                <Label>Mês</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os meses" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                {(filterYear || filterMonth) && (
                  <Button 
                    onClick={() => {
                      setFilterYear("");
                      setFilterMonth("");
                    }} 
                    variant="outline"
                  >
                    Limpar Filtros
                  </Button>
                )}
                <Button onClick={loadDebtReport} variant="outline">
                  Atualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <DefaultEvolutionChart />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inadimplente</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Valor total em atraso</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Inadimplentes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClients}</div>
              <p className="text-xs text-muted-foreground mt-1">Total de clientes com débitos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalClients > 0 ? formatCurrency(totalOverdue / totalClients) : formatCurrency(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Média de débito por cliente</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de Inadimplência</CardTitle>
            <CardDescription>Clientes ordenados por valor total em atraso</CardDescription>
          </CardHeader>
          <CardContent>
            {debtReport.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhum cliente inadimplente!</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Parabéns! Todos os honorários estão em dia.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Faturas</TableHead>
                    <TableHead className="text-right">Total Devido</TableHead>
                    <TableHead className="text-center">Dias em Atraso</TableHead>
                    <TableHead className="text-center">Nível de Risco</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtReport.map((debt, index) => (
                    <TableRow 
                      key={debt.client_id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleClientClick(debt)}
                    >
                      <TableCell className="font-bold text-muted-foreground">{index + 1}º</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {debt.client_name}
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{debt.count_overdue}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {formatCurrency(debt.total_overdue)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {debt.days_overdue} dias
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getRiskBadge(debt.days_overdue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {debtReport.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Análise por Cliente</CardTitle>
              <CardDescription>Detalhamento das faturas em atraso por cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {debtReport.slice(0, 5).map((debt, index) => (
                <div key={debt.client_id} className="border-l-4 border-destructive pl-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">
                        {index + 1}º - {debt.client_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {debt.count_overdue} fatura(s) em atraso há {debt.days_overdue} dias
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-destructive">
                        {formatCurrency(debt.total_overdue)}
                      </div>
                      {getRiskBadge(debt.days_overdue)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {debt.invoices.slice(0, 4).map((invoice) => (
                      <div key={invoice.id} className="bg-muted/50 p-2 rounded">
                        <div className="font-medium">{invoice.competence}</div>
                        <div className="text-muted-foreground">{formatCurrency(Number(invoice.amount))}</div>
                      </div>
                    ))}
                    {debt.invoices.length > 4 && (
                      <div className="bg-muted/50 p-2 rounded flex items-center justify-center">
                        <span className="text-muted-foreground">+{debt.invoices.length - 4} mais</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              Composição da Inadimplência
            </DialogTitle>
            <DialogDescription>
              Detalhamento das faturas em atraso de {selectedClient?.client_name}
            </DialogDescription>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Devido</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(selectedClient.total_overdue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Faturas</p>
                  <p className="text-2xl font-bold">
                    {selectedClient.count_overdue}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dias em Atraso</p>
                  <p className="text-2xl font-bold">
                    {selectedClient.days_overdue}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Faturas Pendentes</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Dias Atraso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedClient.invoices
                      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                      .map((invoice) => {
                        const daysLate = Math.floor(
                          (new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                              {invoice.competence || "-"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(invoice.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(Number(invoice.amount))}
                            </TableCell>
                            <TableCell className="text-center">
                              {getStatusBadge(invoice.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={daysLate > 60 ? "text-destructive font-bold" : daysLate > 30 ? "text-warning font-semibold" : ""}>
                                {daysLate > 0 ? `${daysLate} dias` : "-"}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive mb-1">Atenção</p>
                    <p className="text-muted-foreground">
                      Este cliente possui {selectedClient.count_overdue} fatura(s) em atraso há {selectedClient.days_overdue} dias.
                      O nível de risco é classificado como: {getRiskBadge(selectedClient.days_overdue)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Reports;
