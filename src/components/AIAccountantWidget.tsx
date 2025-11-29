import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Bot, CheckCircle2, AlertTriangle, XCircle, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIActivity {
  id: string;
  action_type: string;
  status: string;
  score: number | null;
  message: string;
  created_at: string;
  entry_id: string;
}

interface DashboardStats {
  pending_count: number;
  validating_count: number;
  approved_count: number;
  warning_count: number;
  rejected_count: number;
  total_count: number;
  avg_score: number | null;
  last_validation_at: string | null;
}

export function AIAccountantWidget() {
  const [activities, setActivities] = useState<AIActivity[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // Buscar atividades recentes
      const { data: activityData } = await supabase
        .from("ai_accountant_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (activityData) {
        setActivities(activityData);
      }

      // Buscar estatísticas
      const { data: statsData } = await supabase
        .from("v_ai_accountant_dashboard")
        .select("*")
        .single();

      if (statsData) {
        setStats(statsData);
      }
    } catch (error) {
      console.error("Erro ao buscar dados do Contador IA:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchData, 30000);

    // Subscription para atividades em tempo real
    const channel = supabase
      .channel("ai-activity-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_accountant_activity",
        },
        (payload) => {
          setActivities((prev) => [payload.new as AIActivity, ...prev.slice(0, 9)]);
          fetchData(); // Atualizar stats também
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const triggerValidation = async () => {
    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-accountant-background");
      if (error) throw error;
      console.log("Validação disparada:", data);
      await fetchData();
    } catch (error) {
      console.error("Erro ao disparar validação:", error);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      warning: "secondary",
      error: "destructive",
    };
    const labels: Record<string, string> = {
      success: "Aprovado",
      warning: "Atenção",
      error: "Rejeitado",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="text-xs">
        {labels[status] || status}
      </Badge>
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Contador IA
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bot className="h-5 w-5 text-violet-600" />
              <Sparkles className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
            </div>
            <span>Contador IA</span>
            <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
              Gemini 2.5
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerValidation}
            disabled={isValidating}
            className="h-7 px-2"
          >
            {isValidating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {/* Stats resumidos */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-green-50 rounded p-1.5">
              <div className="text-lg font-bold text-green-600">{stats.approved_count}</div>
              <div className="text-[10px] text-green-700">Aprovados</div>
            </div>
            <div className="bg-yellow-50 rounded p-1.5">
              <div className="text-lg font-bold text-yellow-600">{stats.warning_count}</div>
              <div className="text-[10px] text-yellow-700">Alertas</div>
            </div>
            <div className="bg-red-50 rounded p-1.5">
              <div className="text-lg font-bold text-red-600">{stats.rejected_count}</div>
              <div className="text-[10px] text-red-700">Rejeitados</div>
            </div>
            <div className="bg-blue-50 rounded p-1.5">
              <div className="text-lg font-bold text-blue-600">{stats.pending_count}</div>
              <div className="text-[10px] text-blue-700">Pendentes</div>
            </div>
          </div>
        )}

        {/* Score médio */}
        {stats?.avg_score && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
            <span className="text-xs text-muted-foreground">Score Médio</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    stats.avg_score >= 80 ? "bg-green-500" :
                    stats.avg_score >= 60 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${stats.avg_score}%` }}
                />
              </div>
              <span className="text-sm font-medium">{stats.avg_score}%</span>
            </div>
          </div>
        )}

        {/* Lista de atividades recentes */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Atividade Recente</h4>
          <ScrollArea className="h-[180px]">
            {activities.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma atividade ainda</p>
                <p className="text-xs">O Contador IA está monitorando...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-lg text-sm",
                      "bg-muted/30 hover:bg-muted/50 transition-colors"
                    )}
                  >
                    {getStatusIcon(activity.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{activity.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(activity.status)}
                        {activity.score && (
                          <span className="text-[10px] text-muted-foreground">
                            Score: {activity.score}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatTime(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Status de monitoramento */}
        <div className="flex items-center justify-center gap-2 pt-2 border-t">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">
            Monitorando lançamentos automaticamente
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
