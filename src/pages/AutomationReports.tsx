/**
 * AutomationReports - Relatórios de Automação
 *
 * Sprint 4: Relatórios e métricas de automação
 * - Histórico de execuções do pipeline
 * - Performance da IA
 * - Status dos fechamentos mensais
 * - Estatísticas de identificação
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/expensesData';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Brain,
  Zap,
  FileText,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react';

interface PipelineRun {
  id: string;
  run_type: string;
  status: string;
  processed: number;
  reconciled: number;
  needs_review: number;
  failed: number;
  total_amount: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

interface MonthlyClosing {
  id: string;
  period: string;
  status: string;
  total_transactions: number;
  reconciled_transactions: number;
  pending_transactions: number;
  total_credits: number;
  total_debits: number;
  closed_at: string | null;
  auto_closed: boolean;
  blocked_reason: string | null;
}

interface IdentificationStats {
  total_credits: number;
  matched_credits: number;
  unmatched_credits: number;
  auto_matched: number;
  needs_review: number;
  match_rate_percent: number;
  avg_confidence: number;
}

interface PatternStats {
  pattern_type: string;
  total_patterns: number;
  avg_effectiveness: number;
  total_uses: number;
  total_successes: number;
}

export default function AutomationReports() {
  const [loading, setLoading] = useState(true);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosing[]>([]);
  const [identificationStats, setIdentificationStats] = useState<IdentificationStats | null>(null);
  const [patternStats, setPatternStats] = useState<PatternStats[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Carregar execuções do pipeline
      const { data: runs } = await supabase
        .from('automation_pipeline_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      setPipelineRuns(runs || []);

      // Carregar fechamentos mensais
      const { data: closings } = await supabase
        .from('monthly_closings')
        .select('*')
        .order('period', { ascending: false })
        .limit(12);

      setMonthlyClosings(closings || []);

      // Carregar estatísticas de identificação
      const { data: idStats } = await supabase
        .from('v_identification_stats')
        .select('*')
        .single();

      setIdentificationStats(idStats);

      // Carregar estatísticas de padrões
      const { data: patterns } = await supabase
        .from('v_pattern_effectiveness')
        .select('*');

      setPatternStats(patterns || []);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCloseMonth = async (period: string) => {
    try {
      const { data, error } = await supabase.rpc('fn_close_month', {
        p_period: period,
        p_force: false,
        p_user_id: null
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Mês fechado com sucesso', description: `Período ${period} foi fechado.` });
        loadData();
      } else {
        toast({
          title: 'Não foi possível fechar',
          description: data?.error || 'Existem pendências',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleReopenMonth = async (period: string) => {
    const reason = prompt('Motivo para reabrir o período:');
    if (!reason) return;

    try {
      const { data, error } = await supabase.rpc('fn_reopen_month', {
        p_period: period,
        p_reason: reason
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Mês reaberto', description: `Período ${period} foi reaberto.` });
        loadData();
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  // Calcular métricas gerais
  const totalRuns = pipelineRuns.length;
  const successfulRuns = pipelineRuns.filter(r => r.status === 'completed').length;
  const totalProcessed = pipelineRuns.reduce((sum, r) => sum + r.processed, 0);
  const totalReconciled = pipelineRuns.reduce((sum, r) => sum + r.reconciled, 0);
  const avgDuration = totalRuns > 0
    ? Math.round(pipelineRuns.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / totalRuns)
    : 0;

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              Relatórios de Automação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Métricas e histórico do sistema de automação
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Métricas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Execuções
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRuns}</div>
              <p className="text-xs text-muted-foreground">
                {successfulRuns} com sucesso ({totalRuns > 0 ? Math.round(successfulRuns / totalRuns * 100) : 0}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Transações Processadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProcessed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalReconciled.toLocaleString()} conciliadas automaticamente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Taxa de Match
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {identificationStats?.match_rate_percent || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Confiança média: {identificationStats?.avg_confidence || 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tempo Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgDuration}ms</div>
              <p className="text-xs text-muted-foreground">
                por execução do pipeline
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="closings">Fechamentos</TabsTrigger>
            <TabsTrigger value="patterns">Padrões IA</TabsTrigger>
          </TabsList>

          {/* Tab: Visão Geral */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Estatísticas de Identificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Identificação de Pagadores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {identificationStats ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Total de Créditos</span>
                        <span className="font-bold">{identificationStats.total_credits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Conciliados</span>
                        <span className="font-bold text-green-600">{identificationStats.matched_credits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Auto-conciliados</span>
                        <span className="font-bold text-blue-600">{identificationStats.auto_matched}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Aguardando Revisão</span>
                        <span className="font-bold text-yellow-600">{identificationStats.needs_review}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Não Conciliados</span>
                        <span className="font-bold text-red-600">{identificationStats.unmatched_credits}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Sem dados disponíveis</p>
                  )}
                </CardContent>
              </Card>

              {/* Últimas Execuções */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Últimas Execuções
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pipelineRuns.slice(0, 5).map(run => (
                      <div key={run.id} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <Badge variant={run.status === 'completed' ? 'default' : 'destructive'}>
                            {run.run_type}
                          </Badge>
                          <span className="ml-2 text-sm">
                            {new Date(run.started_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {run.reconciled}/{run.processed}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Pipeline */}
          <TabsContent value="pipeline">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Execuções do Pipeline</CardTitle>
                <CardDescription>
                  Todas as execuções do pipeline de conciliação automática
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Processados</TableHead>
                      <TableHead className="text-right">Conciliados</TableHead>
                      <TableHead className="text-right">Revisão</TableHead>
                      <TableHead className="text-right">Falhas</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipelineRuns.map(run => (
                      <TableRow key={run.id}>
                        <TableCell>
                          {new Date(run.started_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{run.run_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {run.status === 'completed' ? (
                            <Badge className="bg-green-500">Sucesso</Badge>
                          ) : run.status === 'partial' ? (
                            <Badge className="bg-yellow-500">Parcial</Badge>
                          ) : (
                            <Badge variant="destructive">Falha</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{run.processed}</TableCell>
                        <TableCell className="text-right text-green-600">{run.reconciled}</TableCell>
                        <TableCell className="text-right text-yellow-600">{run.needs_review}</TableCell>
                        <TableCell className="text-right text-red-600">{run.failed}</TableCell>
                        <TableCell className="text-right">{run.duration_ms}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Fechamentos */}
          <TabsContent value="closings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Fechamentos Mensais
                </CardTitle>
                <CardDescription>
                  Status e controle dos fechamentos contábeis mensais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Transações</TableHead>
                      <TableHead className="text-right">Conciliadas</TableHead>
                      <TableHead className="text-right">Créditos</TableHead>
                      <TableHead className="text-right">Débitos</TableHead>
                      <TableHead>Fechado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyClosings.map(closing => (
                      <TableRow key={closing.id}>
                        <TableCell className="font-medium">{closing.period}</TableCell>
                        <TableCell>
                          {closing.status === 'closed' ? (
                            <Badge className="bg-green-500">
                              <Lock className="w-3 h-3 mr-1" />
                              Fechado
                            </Badge>
                          ) : closing.status === 'blocked' ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Bloqueado
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Unlock className="w-3 h-3 mr-1" />
                              Aberto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{closing.total_transactions}</TableCell>
                        <TableCell className="text-right">
                          {closing.reconciled_transactions}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({closing.total_transactions > 0
                              ? Math.round(closing.reconciled_transactions / closing.total_transactions * 100)
                              : 0}%)
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(closing.total_credits)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(closing.total_debits)}
                        </TableCell>
                        <TableCell>
                          {closing.closed_at
                            ? new Date(closing.closed_at).toLocaleDateString('pt-BR')
                            : '-'}
                          {closing.auto_closed && (
                            <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {closing.status === 'closed' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReopenMonth(closing.period)}
                            >
                              Reabrir
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleCloseMonth(closing.period)}
                            >
                              Fechar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Padrões IA */}
          <TabsContent value="patterns">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Padrões de Aprendizado da IA
                </CardTitle>
                <CardDescription>
                  Efetividade dos padrões aprendidos pelo sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {patternStats.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de Padrão</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Efetividade Média</TableHead>
                        <TableHead className="text-right">Usos</TableHead>
                        <TableHead className="text-right">Sucessos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patternStats.map((stat, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{stat.pattern_type}</TableCell>
                          <TableCell className="text-right">{stat.total_patterns}</TableCell>
                          <TableCell className="text-right">
                            <span className={
                              stat.avg_effectiveness >= 0.9 ? 'text-green-600' :
                              stat.avg_effectiveness >= 0.7 ? 'text-yellow-600' :
                              'text-red-600'
                            }>
                              {(stat.avg_effectiveness * 100).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{stat.total_uses}</TableCell>
                          <TableCell className="text-right">{stat.total_successes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum padrão aprendido ainda</p>
                    <p className="text-sm">Os padrões são criados conforme o sistema aprende com correções</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
