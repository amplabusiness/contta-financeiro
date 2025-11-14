import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExecutionLog {
  id: string;
  execution_date: string;
  tasks_executed: number;
  tasks_succeeded: number;
  tasks_failed: number;
  details: any;
}

export const AIExecutionHistory = () => {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_logs' as any)
        .select('*')
        .order('execution_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs((data as any) || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de Execuções
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma execução registrada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const successRate = log.tasks_executed > 0 
                  ? (log.tasks_succeeded / log.tasks_executed) * 100 
                  : 0;

                return (
                  <div
                    key={log.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {successRate === 100 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : successRate > 50 ? (
                          <CheckCircle2 className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm font-medium">
                          {new Date(log.execution_date).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <Badge 
                        variant={successRate === 100 ? "default" : successRate > 50 ? "secondary" : "destructive"}
                      >
                        {successRate.toFixed(0)}% sucesso
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-medium">{log.tasks_executed}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sucesso: </span>
                        <span className="font-medium text-green-600">{log.tasks_succeeded}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Erros: </span>
                        <span className="font-medium text-red-600">{log.tasks_failed}</span>
                      </div>
                    </div>

                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                        {Object.entries(log.details).map(([key, value]: [string, any]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {JSON.stringify(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
