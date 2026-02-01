/**
 * ============================================================================
 * MONTHLY CLOSING PAGE
 * ============================================================================
 * Interface de Fechamento Mensal com Geração de Auditoria
 * Data: 01/02/2026
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  MonthlyAuditReportService, 
  canCloseMonth,
  getLearnedRules 
} from '@/services/MonthlyAuditReportService';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Download,
  Lock,
  Loader2,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// TIPOS
// ============================================================================

interface MonthStatus {
  canClose: boolean;
  reason?: string;
  metrics?: {
    total: number;
    reconciled: number;
    pending: number;
    transitDebits: number;
    transitCredits: number;
  };
}

interface ClosingRecord {
  id: string;
  reference_month: string;
  status: string;
  audit_document_id: string | null;
  closed_at: string | null;
  closed_by: string | null;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MonthlyClosingPage() {
  const { user, tenantId } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [monthStatus, setMonthStatus] = useState<MonthStatus | null>(null);
  const [closingRecord, setClosingRecord] = useState<ClosingRecord | null>(null);
  const [learnedRules, setLearnedRules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carregar status do mês
  useEffect(() => {
    if (tenantId) {
      loadMonthStatus();
      loadClosingRecord();
      loadLearnedRules();
    }
  }, [tenantId, selectedYear, selectedMonth]);

  const loadMonthStatus = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Verificar se pode fechar
      const canClose = await canCloseMonth(tenantId, selectedYear, selectedMonth);
      
      // Buscar métricas detalhadas
      const service = new MonthlyAuditReportService(tenantId);
      const auditData = await service.getAuditData(selectedYear, selectedMonth);

      setMonthStatus({
        canClose: canClose.canClose,
        reason: canClose.reason,
        metrics: {
          total: auditData.transacoes.total,
          reconciled: auditData.transacoes.reconciliadas,
          pending: auditData.transacoes.pendentes,
          transitDebits: auditData.transitorias.debitos.saldo,
          transitCredits: auditData.transitorias.creditos.saldo
        }
      });
    } catch (err) {
      setError(`Erro ao carregar status: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClosingRecord = async () => {
    if (!tenantId) return;

    const referenceMonth = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
    
    const { data } = await supabase
      .from('monthly_closings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('reference_month', referenceMonth)
      .single();

    setClosingRecord(data);
  };

  const loadLearnedRules = async () => {
    if (!tenantId) return;
    const rules = await getLearnedRules(tenantId);
    setLearnedRules(rules);
  };

  const handleGenerateReport = async () => {
    if (!tenantId) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const service = new MonthlyAuditReportService(tenantId);
      const result = await service.generatePDF(
        selectedYear, 
        selectedMonth, 
        user?.email || 'system'
      );

      // Download do PDF
      const url = URL.createObjectURL(result.pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_mensal_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Relatório gerado com sucesso! ID: ${result.documentId}`);
      loadClosingRecord();
    } catch (err) {
      setError(`Erro ao gerar relatório: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCloseMonth = async () => {
    if (!tenantId || !closingRecord?.audit_document_id) {
      setError('É necessário gerar o relatório de auditoria antes de fechar o mês.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = new MonthlyAuditReportService(tenantId);
      const result = await service.closeMonth(
        selectedYear,
        selectedMonth,
        closingRecord.audit_document_id,
        user?.email || 'dr-cicero'
      );

      if (result.success) {
        setSuccess('Mês fechado com sucesso!');
        loadClosingRecord();
      } else {
        setError(result.error || 'Erro ao fechar mês');
      }
    } catch (err) {
      setError(`Erro: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fechamento Mensal</h1>
          <p className="text-muted-foreground">
            Geração de relatório de auditoria e fechamento contábil
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          Dr. Cícero
        </Badge>
      </div>

      {/* Seletor de Período */}
      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select 
            value={selectedMonth.toString()} 
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={(index + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadMonthStatus} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
          </Button>
        </CardContent>
      </Card>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sucesso</AlertTitle>
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* Status do Mês */}
      {monthStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {monthStatus.canClose ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                Status do Mês
              </CardTitle>
              <CardDescription>
                {months[selectedMonth - 1]} / {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{monthStatus.metrics?.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Transações</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {monthStatus.metrics?.reconciled || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Reconciliadas</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">
                    {monthStatus.metrics?.pending || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {monthStatus.metrics && monthStatus.metrics.total > 0
                      ? Math.round((monthStatus.metrics.reconciled / monthStatus.metrics.total) * 100)
                      : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">% Conciliado</p>
                </div>
              </div>

              {/* Transitórias */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Contas Transitórias</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>1.1.9.01 - Débitos Pendentes</span>
                    <Badge variant={Math.abs(monthStatus.metrics?.transitDebits || 0) < 0.01 ? 'default' : 'destructive'}>
                      R$ {(monthStatus.metrics?.transitDebits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>2.1.9.01 - Créditos Pendentes</span>
                    <Badge variant={Math.abs(monthStatus.metrics?.transitCredits || 0) < 0.01 ? 'default' : 'destructive'}>
                      R$ {(monthStatus.metrics?.transitCredits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </div>
              </div>

              {!monthStatus.canClose && monthStatus.reason && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{monthStatus.reason}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Ações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Ações de Fechamento
              </CardTitle>
              <CardDescription>
                {closingRecord?.status === 'closed' 
                  ? `Fechado em ${format(new Date(closingRecord.closed_at!), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
                  : 'Mês ainda não fechado'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Botão Gerar Relatório */}
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleGenerateReport}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Gerar Relatório de Auditoria
              </Button>

              {/* Botão Fechar Mês */}
              <Button 
                className="w-full"
                onClick={handleCloseMonth}
                disabled={
                  !monthStatus.canClose || 
                  closingRecord?.status === 'closed' ||
                  isLoading
                }
              >
                {closingRecord?.status === 'closed' ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Mês Fechado
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Fechar Mês
                  </>
                )}
              </Button>

              {closingRecord?.audit_document_id && (
                <p className="text-xs text-muted-foreground text-center">
                  Documento: {closingRecord.audit_document_id.slice(0, 8)}...
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Regras Aprendidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Regras de Governança (Dr. Cícero)
          </CardTitle>
          <CardDescription>
            Regras institucionais aprendidas pelo sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {learnedRules.map((rule) => (
              <div 
                key={rule.id} 
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div>
                  <p className="font-medium">{rule.rule_name}</p>
                  <p className="text-sm text-muted-foreground">{rule.condition_description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    rule.severity === 'critical' ? 'destructive' :
                    rule.severity === 'high' ? 'destructive' :
                    rule.severity === 'medium' ? 'secondary' : 'outline'
                  }>
                    {rule.severity}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {rule.occurrence_count}x
                  </span>
                </div>
              </div>
            ))}

            {learnedRules.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma regra carregada. Execute a migração do banco de dados.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
