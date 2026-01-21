/**
 * Componente de Relatório de Conciliação de Boletos
 *
 * Exibe um resumo da conciliação bancária para um período,
 * mostrando transações conciliadas vs pendentes e totais.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  RefreshCw,
  Loader2,
  TrendingUp,
  Users,
  UserPlus,
  Info
} from 'lucide-react';
import { formatCurrency } from '@/data/expensesData';
import { BoletoReconciliationService, ReconciliationReport as ReportType, BoletoMatch, UnregisteredClient } from '@/services/BoletoReconciliationService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface ReconciliationReportProps {
  startDate: string;
  endDate: string;
  onReconcile?: (match: BoletoMatch) => void;
}

export function ReconciliationReport({ startDate, endDate, onReconcile }: ReconciliationReportProps) {
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoReconciling, setAutoReconciling] = useState(false);
  const [unregisteredClients, setUnregisteredClients] = useState<UnregisteredClient[]>([]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await BoletoReconciliationService.generateReconciliationReport(startDate, endDate);
      setReport(data);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao carregar relatório de conciliação');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const handleAutoReconcile = async () => {
    setAutoReconciling(true);
    try {
      const result = await BoletoReconciliationService.autoReconcileAll(startDate, endDate, 80);

      if (result.success > 0) {
        toast.success(`${result.success} transações conciliadas automaticamente`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} transações não puderam ser conciliadas`);
      }

      // Salvar lista de clientes não cadastrados
      if (result.unregisteredClients && result.unregisteredClients.length > 0) {
        setUnregisteredClients(result.unregisteredClients);
        toast.info(`${result.unregisteredClients.length} cliente(s) precisam ser cadastrados`);
      } else {
        setUnregisteredClients([]);
      }

      // Recarregar relatório
      await loadReport();
    } catch (error) {
      console.error('Erro na conciliação automática:', error);
      toast.error('Erro ao executar conciliação automática');
    } finally {
      setAutoReconciling(false);
    }
  };

  // Helper para parse de datas sem problemas de timezone
  // Adiciona T12:00:00 para evitar que meia-noite UTC vire dia anterior no timezone local
  const parseDate = (dateStr: string): Date => {
    if (dateStr.includes('T')) {
      return parseISO(dateStr);
    }
    return parseISO(dateStr + 'T12:00:00');
  };

  const exportToCsv = () => {
    if (!report) return;

    const headers = ['Data', 'Código', 'Descrição', 'Valor', 'Clientes', 'Status', 'Confiança'];
    const rows = report.transactions.map(tx => [
      format(parseDate(tx.transactionDate), 'dd/MM/yyyy'),
      tx.cobCode,
      tx.description,
      tx.totalAmount.toFixed(2).replace('.', ','),
      tx.clients.length.toString(),
      tx.matched ? 'Conciliado' : 'Pendente',
      `${tx.confidence}%`
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conciliacao_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Relatório exportado com sucesso');
  };

  const exportToPdf = () => {
    if (!report) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 20;

    // Título
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Conciliação de Boletos', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Período
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Período: ${format(parseDate(startDate), 'dd/MM/yyyy', { locale: ptBR })} a ${format(parseDate(endDate), 'dd/MM/yyyy', { locale: ptBR })}`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 15;

    // Resumo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const summaryData = [
      ['Total de Transações:', report.totalTransactions.toString()],
      ['Conciliadas:', `${report.reconciledCount} (${reconciledPercent}%)`],
      ['Pendentes:', report.pendingCount.toString()],
      ['Valor Conciliado:', formatCurrency(report.totalReconciled)],
      ['Valor Pendente:', formatCurrency(report.totalPending)],
    ];

    summaryData.forEach(([label, value]) => {
      doc.text(label, margin, y);
      doc.text(value, margin + 50, y);
      y += 6;
    });

    y += 10;

    // Tabela de transações
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Transações', margin, y);
    y += 8;

    // Cabeçalho da tabela
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
    doc.text('Data', margin + 2, y);
    doc.text('Código', margin + 25, y);
    doc.text('Clientes', margin + 55, y);
    doc.text('Valor', margin + 100, y);
    doc.text('Status', margin + 135, y);
    y += 8;

    // Linhas da tabela
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    for (const tx of report.transactions) {
      // Verificar se precisa de nova página
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const status = tx.matched ? 'Conciliado' : 'Pendente';
      const statusColor = tx.matched ? [34, 197, 94] : [245, 158, 11];

      doc.text(format(parseDate(tx.transactionDate), 'dd/MM/yyyy'), margin + 2, y);
      doc.text(tx.cobCode, margin + 25, y);
      doc.text(`${tx.clients.length} cliente(s)`, margin + 55, y);
      doc.text(formatCurrency(tx.totalAmount), margin + 100, y);

      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(status, margin + 135, y);
      doc.setTextColor(0, 0, 0);

      y += 5;

      // Listar clientes (até 5)
      const clientsToShow = tx.clients.slice(0, 5);
      for (const client of clientsToShow) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        const accountInfo = client.accountCode ? `[${client.accountCode}] ` : '';
        const clientText = `  ${accountInfo}${client.clientName.substring(0, 35)} - ${formatCurrency(client.amount)}`;
        doc.text(clientText, margin + 5, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }

      if (tx.clients.length > 5) {
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`  +${tx.clients.length - 5} outros clientes`, margin + 5, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }

      y += 3;
    }

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        290,
        { align: 'center' }
      );
    }

    doc.save(`conciliacao_${startDate}_${endDate}.pdf`);
    toast.success('PDF exportado com sucesso');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-slate-500">Gerando relatório...</span>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-slate-500">
          Nenhum dado disponível para o período selecionado.
        </CardContent>
      </Card>
    );
  }

  const reconciledPercent = report.totalTransactions > 0
    ? Math.round((report.reconciledCount / report.totalTransactions) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Relatório de Conciliação
            </CardTitle>
            <CardDescription>
              {format(new Date(startDate), "dd/MM/yyyy", { locale: ptBR })} a{' '}
              {format(new Date(endDate), "dd/MM/yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReport}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPdf}
            >
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4">
        {/* Resumo em Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              Total Transações
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {report.totalTransactions}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              Conciliadas
            </div>
            <div className="text-2xl font-bold text-green-700">
              {report.reconciledCount}
              <span className="text-sm font-normal ml-1">({reconciledPercent}%)</span>
            </div>
            <div className="text-sm text-green-600 mt-1">
              {formatCurrency(report.totalReconciled)}
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-amber-600 mb-1">
              <Clock className="h-4 w-4" />
              Pendentes
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {report.pendingCount}
            </div>
            <div className="text-sm text-amber-600 mt-1">
              {formatCurrency(report.totalPending)}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
              <Users className="h-4 w-4" />
              Ação
            </div>
            <Button
              size="sm"
              onClick={handleAutoReconcile}
              disabled={autoReconciling || report.pendingCount === 0}
              className="w-full"
            >
              {autoReconciling ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Conciliar Auto
            </Button>
          </div>
        </div>

        {/* Alerta de Clientes Não Cadastrados */}
        {unregisteredClients.length > 0 && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <UserPlus className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Clientes Precisam de Cadastro</AlertTitle>
            <AlertDescription className="text-amber-700">
              <p className="mb-2">
                Os seguintes clientes foram encontrados nos boletos mas não estão cadastrados no sistema.
                Cadastre-os na seção de Clientes para que possam ser conciliados automaticamente.
              </p>
              <div className="bg-white border border-amber-200 rounded-md p-3 max-h-[200px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-amber-200">
                      <th className="pb-2 font-medium">Nome do Cliente</th>
                      <th className="pb-2 font-medium text-right">Valor</th>
                      <th className="pb-2 font-medium">COB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unregisteredClients.map((client, idx) => (
                      <tr key={idx} className="border-b border-amber-100 last:border-0">
                        <td className="py-1.5">
                          <span className="font-medium">{client.name}</span>
                        </td>
                        <td className="py-1.5 text-right font-mono">
                          {formatCurrency(client.amount)}
                        </td>
                        <td className="py-1.5">
                          <Badge variant="outline" className="text-xs">
                            {client.cobCode}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="text-xs">
                  Após cadastrar os clientes, execute a conciliação automática novamente.
                </span>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de Transações */}
        <div className="border rounded-lg">
          <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
            <span className="font-medium text-sm text-slate-700">
              Transações de Boleto ({report.transactions.length})
            </span>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {report.transactions.map((tx) => (
                <div
                  key={tx.bankTransactionId}
                  className={`p-3 hover:bg-slate-50 transition-colors ${
                    tx.matched ? 'bg-green-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={tx.matched ? 'default' : 'outline'}
                          className={tx.matched ? 'bg-green-600' : 'border-amber-500 text-amber-600'}
                        >
                          {tx.cobCode}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {format(parseDate(tx.transactionDate), 'dd/MM/yyyy')}
                        </span>
                        {tx.matched ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>

                      <div className="text-sm text-slate-700 truncate" title={tx.description}>
                        {tx.description}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>
                          <Users className="h-3 w-3 inline mr-1" />
                          {tx.clients.length} cliente(s)
                        </span>
                        <span>
                          Confiança: {tx.confidence}%
                        </span>
                      </div>

                      {/* Lista de clientes (expandível) */}
                      {tx.clients.length > 0 && (
                        <div className="mt-2 pl-4 border-l-2 border-slate-200 space-y-1">
                          {tx.clients.slice(0, 3).map((client, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">
                                {client.needsRegistration ? (
                                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 mr-1">
                                    <UserPlus className="h-2.5 w-2.5 mr-0.5" />
                                    Cadastrar
                                  </Badge>
                                ) : client.accountCode ? (
                                  <span className="font-mono text-slate-400 mr-1">{client.accountCode}</span>
                                ) : (
                                  <AlertTriangle className="h-3 w-3 inline text-amber-500 mr-1" />
                                )}
                                {client.clientName}
                              </span>
                              <span className="text-slate-700 font-medium">
                                {formatCurrency(client.amount)}
                              </span>
                            </div>
                          ))}
                          {tx.clients.length > 3 && (
                            <div className="text-xs text-slate-400 italic">
                              +{tx.clients.length - 3} outros clientes
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-emerald-600">
                        {formatCurrency(tx.totalAmount)}
                      </div>
                      {!tx.matched && onReconcile && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 text-xs"
                          onClick={() => onReconcile(tx)}
                        >
                          Conciliar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {report.transactions.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  Nenhuma transação de boleto encontrada no período.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReconciliationReport;
