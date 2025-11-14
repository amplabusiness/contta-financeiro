import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AgentStats {
  totalExecutions: number;
  successRate: number;
  lastExecution: string | null;
  tasksExecuted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  trend: 'up' | 'down' | 'stable';
}

export const AIAgentStats = () => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Buscar logs de automação dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs, error } = await supabase
        .from('automation_logs' as any)
        .select('*')
        .gte('execution_date', thirtyDaysAgo.toISOString())
        .order('execution_date', { ascending: false });

      if (error) throw error;

      const totalExecutions = logs?.length || 0;
      const totalTasks = logs?.reduce((sum: number, log: any) => sum + (log.tasks_executed || 0), 0) || 0;
      const totalSucceeded = logs?.reduce((sum: number, log: any) => sum + (log.tasks_succeeded || 0), 0) || 0;
      const totalFailed = logs?.reduce((sum: number, log: any) => sum + (log.tasks_failed || 0), 0) || 0;
      
      const successRate = totalTasks > 0 ? (totalSucceeded / totalTasks) * 100 : 0;
      const lastExecution = (logs as any)?.[0]?.execution_date || null;

      // Calcular tendência (comparar última semana com semana anterior)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const previousWeek = new Date();
      previousWeek.setDate(previousWeek.getDate() - 14);

      const lastWeekLogs = logs?.filter((log: any) => new Date(log.execution_date) > lastWeek) || [];
      const previousWeekLogs = logs?.filter((log: any) => 
        new Date(log.execution_date) > previousWeek && 
        new Date(log.execution_date) <= lastWeek
      ) || [];

      const lastWeekSuccess = lastWeekLogs.reduce((sum: number, log: any) => 
        sum + (log.tasks_succeeded || 0), 0
      );
      const previousWeekSuccess = previousWeekLogs.reduce((sum: number, log: any) => 
        sum + (log.tasks_succeeded || 0), 0
      );

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (lastWeekSuccess > previousWeekSuccess * 1.1) trend = 'up';
      else if (lastWeekSuccess < previousWeekSuccess * 0.9) trend = 'down';

      setStats({
        totalExecutions,
        successRate,
        lastExecution,
        tasksExecuted: totalTasks,
        tasksSucceeded: totalSucceeded,
        tasksFailed: totalFailed,
        trend
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Execuções Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalExecutions}</p>
            <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Taxa de Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {stats.successRate.toFixed(1)}%
            </p>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Tarefas com Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.tasksFailed}</p>
            <p className="text-xs text-muted-foreground mt-1">
              De {stats.tasksExecuted} tarefas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Última Execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">
              {stats.lastExecution 
                ? new Date(stats.lastExecution).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Nunca'
              }
            </p>
            <div className="flex items-center gap-1 mt-1">
              {stats.trend === 'up' && (
                <>
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">Melhorando</span>
                </>
              )}
              {stats.trend === 'down' && (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600">Piorando</span>
                </>
              )}
              {stats.trend === 'stable' && (
                <span className="text-xs text-muted-foreground">Estável</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
