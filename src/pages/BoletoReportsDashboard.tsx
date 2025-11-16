import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileSpreadsheet, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BoletoReport {
  id: string;
  file_name: string;
  file_type: string;
  period_start: string;
  period_end: string;
  total_boletos: number;
  total_emitidos: number;
  total_pagos: number;
  total_pendentes: number;
  entries_created: number;
  status: string;
  processing_log: any;
  processed_at: string;
  created_at: string;
}

export default function BoletoReportsDashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<BoletoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReports: 0,
    totalBoletos: 0,
    totalEmitidos: 0,
    totalPagos: 0,
    totalPendentes: 0,
    totalEntries: 0,
  });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("boleto_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReports(data || []);

      // Calculate totals
      const totals = (data || []).reduce(
        (acc, report) => ({
          totalReports: acc.totalReports + 1,
          totalBoletos: acc.totalBoletos + report.total_boletos,
          totalEmitidos: acc.totalEmitidos + Number(report.total_emitidos || 0),
          totalPagos: acc.totalPagos + Number(report.total_pagos || 0),
          totalPendentes: acc.totalPendentes + Number(report.total_pendentes || 0),
          totalEntries: acc.totalEntries + report.entries_created,
        }),
        {
          totalReports: 0,
          totalBoletos: 0,
          totalEmitidos: 0,
          totalPagos: 0,
          totalPendentes: 0,
          totalEntries: 0,
        }
      );

      setStats(totals);
    } catch (error: any) {
      console.error("Error loading reports:", error);
      toast.error("Erro ao carregar relatórios: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      PROCESSING: { label: "Processando", variant: "default" as const },
      COMPLETED: { label: "Concluído", variant: "default" as const },
      ERROR: { label: "Erro", variant: "destructive" as const },
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.COMPLETED;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculatePaymentRate = (pagos: number, emitidos: number) => {
    if (emitidos === 0) return 0;
    return ((pagos / emitidos) * 100).toFixed(1);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios de Boletos</h1>
            <p className="text-muted-foreground mt-2">
              Visualização e estatísticas dos relatórios importados
            </p>
          </div>
          <Button onClick={() => navigate("/import-boleto-report")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Novo Relatório
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Relatórios</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReports}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalBoletos} boletos processados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Emitido</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalEmitidos)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalEntries} lançamentos contábeis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Pago</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalPagos)}
              </div>
              <p className="text-xs text-muted-foreground">
                {calculatePaymentRate(stats.totalPagos, stats.totalEmitidos)}% de taxa de pagamento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Pendente</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {formatCurrency(stats.totalPendentes)}
              </div>
              <p className="text-xs text-muted-foreground">A receber</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Indicadores</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de Liquidação</p>
                  <p className="text-xl font-bold">
                    {calculatePaymentRate(stats.totalPagos, stats.totalEmitidos)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Inadimplência</p>
                  <p className="text-xl font-bold text-orange-500">
                    {calculatePaymentRate(stats.totalPendentes, stats.totalEmitidos)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Importações</CardTitle>
            <CardDescription>Lista de todos os relatórios processados</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum relatório importado ainda</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/import-boleto-report")}
                >
                  Importar Primeiro Relatório
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Boletos</TableHead>
                      <TableHead className="text-right">Emitido</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                      <TableHead className="text-right">Lançamentos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                            {report.file_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(report.period_start), "MMM/yyyy", { locale: ptBR })} -{" "}
                          {format(new Date(report.period_end), "MMM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">{report.total_boletos}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(report.total_emitidos || 0))}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(Number(report.total_pagos || 0))}
                        </TableCell>
                        <TableCell className="text-right text-orange-500">
                          {formatCurrency(Number(report.total_pendentes || 0))}
                        </TableCell>
                        <TableCell className="text-right">{report.entries_created}</TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell>
                          {format(new Date(report.created_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Errors Section */}
        {reports.some((r) => r.processing_log?.errors?.length > 0) && (
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertCircle className="h-5 w-5" />
                Avisos e Erros de Processamento
              </CardTitle>
              <CardDescription>
                Alguns boletos apresentaram problemas durante o processamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports
                  .filter((r) => r.processing_log?.errors?.length > 0)
                  .map((report) => (
                    <div key={report.id} className="space-y-2">
                      <p className="font-medium text-sm">{report.file_name}</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {report.processing_log.errors.map((error: string, idx: number) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
