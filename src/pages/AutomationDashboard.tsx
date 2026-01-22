/**
 * AutomationDashboard - Painel de Automação
 *
 * Sprint 3: Dashboard para monitoramento em tempo real da automação
 * - Transações do dia
 * - Fluxo de caixa
 * - Status de cobrança
 * - Performance da IA
 * - Alertas pendentes
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { autoReconciliationPipeline, BatchProcessingStats } from '@/services/AutoReconciliationPipeline';
import { useClient } from '@/contexts/ClientContext';
import { formatCurrency } from '@/data/expensesData';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Brain,
  Zap,
  RefreshCw,
  Play,
  BarChart3,
  Users,
  Wallet,
  Activity,
  ArrowRight
} from 'lucide-react';

interface DashboardData {
  today: {
    totalTransactions: number;
    autoReconciled: number;
    needsReview: number;
    failed: number;
    totalCredits: number;
    totalCreditAmount: number;
    avgConfidence: number;
  };
  cashFlow: {
    currentBalance: number;
    pendingReceivables: number;
    pendingPayables: number;
    projected7Days: number;
    netPosition: number;
  };
  collection: {
    onTime: number;
    overdue1to30: number;
    overdue30plus: number;
    totalPending: number;
    overdueAmount: number;
  };
  aiPerformance: {
    identificationsToday: number;
    accuracy: number;
    patternsLearned: number;
    confirmationsToday: number;
    correctionsToday: number;
    avgConfidenceToday: number;
    methodBreakdown: Record<string, number>;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    actionUrl: string;
  }>;
}

type SystemHealth = 'healthy' | 'warning' | 'critical';

export default function AutomationDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>('healthy');
  const { selectedClient } = useClient();
  const { toast } = useToast();

  const loadDashboardData = useCallback(async () => {
    try {
      const { data: result, error } = await supabase.rpc('get_automation_dashboard_summary');

      if (error) {
        console.error('Erro ao carregar dashboard:', error);
        return;
      }

      const dashboardData = result as DashboardData;
      setData(dashboardData);
      setLastUpdate(new Date());

      // Determinar saúde do sistema
      const criticalAlerts = dashboardData.alerts?.filter(a => a.severity === 'critical').length || 0;
      const warningAlerts = dashboardData.alerts?.filter(a => a.severity === 'warning').length || 0;

      if (criticalAlerts > 0 || dashboardData.today.failed > 5) {
        setSystemHealth('critical');
      } else if (warningAlerts > 3 || dashboardData.today.needsReview > 10) {
        setSystemHealth('warning');
      } else {
        setSystemHealth('healthy');
      }

    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh a cada 60 segundos
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const handleProcessPending = async () => {
    setProcessing(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast({ title: 'Erro', description: 'Sessão não encontrada', variant: 'destructive' });
        return;
      }

      // Buscar tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', session.session.user.id)
        .single();

      if (!profile?.tenant_id) {
        toast({ title: 'Erro', description: 'Tenant não encontrado', variant: 'destructive' });
        return;
      }

      const stats: BatchProcessingStats = await autoReconciliationPipeline.processAllPending(
        profile.tenant_id,
        50
      );

      // Registrar execução
      await supabase.rpc('register_pipeline_run', {
        p_run_type: 'manual',
        p_processed: stats.processed,
        p_reconciled: stats.reconciled,
        p_needs_review: stats.needsReview,
        p_failed: stats.failed,
        p_total_amount: stats.totalAmount,
        p_duration_ms: stats.durationMs || 0,
        p_metadata: {}
      });

      toast({
        title: 'Processamento concluído',
        description: `${stats.reconciled} conciliados, ${stats.needsReview} para revisão, ${stats.failed} falhas`
      });

      // Recarregar dados
      await loadDashboardData();

    } catch (err: any) {
      toast({
        title: 'Erro no processamento',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const healthConfig = {
    healthy: { color: 'bg-green-500', text: 'Saudável', icon: CheckCircle },
    warning: { color: 'bg-yellow-500', text: 'Atenção', icon: AlertTriangle },
    critical: { color: 'bg-red-500', text: 'Crítico', icon: XCircle }
  };

  const HealthIcon = healthConfig[systemHealth].icon;

  if (loading) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </Layout>
    );
  }

  const autoMatchRate = data?.today.totalCredits
    ? Math.round((data.today.autoReconciled / data.today.totalCredits) * 100)
    : 0;

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Painel de Automação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoramento em tempo real do sistema de conciliação
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={`${healthConfig[systemHealth].color} text-white px-3 py-1.5`}>
              <HealthIcon className="w-4 h-4 mr-2" />
              {healthConfig[systemHealth].text}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Métricas principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Transações Hoje */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Transações Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.today.autoReconciled || 0}/{data?.today.totalCredits || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {autoMatchRate}% auto-conciliadas
              </p>
              <Progress value={autoMatchRate} className="mt-2 h-2" />
              {(data?.today.needsReview || 0) > 0 && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {data?.today.needsReview} aguardando revisão
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Fluxo de Caixa */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Fluxo de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data?.cashFlow.currentBalance || 0)}
              </div>
              <div className={`text-xs flex items-center gap-1 ${
                (data?.cashFlow.projected7Days || 0) >= (data?.cashFlow.currentBalance || 0)
                  ? 'text-green-600'
                  : 'text-red-500'
              }`}>
                {(data?.cashFlow.projected7Days || 0) >= (data?.cashFlow.currentBalance || 0)
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />
                }
                Projeção 7d: {formatCurrency(data?.cashFlow.projected7Days || 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                A receber: {formatCurrency(data?.cashFlow.pendingReceivables || 0)}
              </div>
            </CardContent>
          </Card>

          {/* Cobrança */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Cobrança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {data?.collection.onTime || 0}
              </div>
              <p className="text-xs text-muted-foreground">clientes em dia</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {(data?.collection.overdue1to30 || 0) > 0 && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
                    {data?.collection.overdue1to30} (1-30d)
                  </Badge>
                )}
                {(data?.collection.overdue30plus || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {data?.collection.overdue30plus} (30+d)
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* IA Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Dr. Cícero (IA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.aiPerformance.accuracy || 100}%
              </div>
              <p className="text-xs text-muted-foreground">precisão hoje</p>
              <div className="text-xs text-muted-foreground mt-1">
                {data?.aiPerformance.identificationsToday || 0} identificações |
                {data?.aiPerformance.patternsLearned || 0} padrões
              </div>
              {(data?.aiPerformance.correctionsToday || 0) > 0 && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {data?.aiPerformance.correctionsToday} correções aprendidas
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas e Ações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Atenção Necessária
                {(data?.alerts?.length || 0) > 0 && (
                  <Badge variant="secondary">{data?.alerts?.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Itens que precisam de revisão manual
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!data?.alerts || data.alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>Nenhum alerta pendente</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.alerts.map(alert => (
                    <div
                      key={alert.id}
                      className="flex justify-between items-center p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {alert.severity === 'critical' ? (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        )}
                        <span className="text-sm">{alert.title}</span>
                      </div>
                      {alert.actionUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={alert.actionUrl}>
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Execute tarefas de automação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full justify-start"
                onClick={handleProcessPending}
                disabled={processing}
              >
                {processing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {processing ? 'Processando...' : 'Processar Transações Pendentes'}
              </Button>

              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/super-conciliation">
                  <Clock className="w-4 h-4 mr-2" />
                  Super Conciliação
                </a>
              </Button>

              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/bank-reconciliation">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Conciliação Bancária
                </a>
              </Button>

              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/collection-dashboard">
                  <Users className="w-4 h-4 mr-2" />
                  Dashboard de Cobrança
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Rodapé com última atualização */}
        <div className="text-xs text-muted-foreground text-center">
          Última atualização: {lastUpdate?.toLocaleTimeString('pt-BR')} |
          Auto-refresh a cada 60 segundos
        </div>
      </div>
    </Layout>
  );
}
