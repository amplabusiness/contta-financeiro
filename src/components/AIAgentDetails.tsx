import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Bot, Tags, TrendingUp, Zap } from "lucide-react";

interface AgentDetail {
  name: string;
  icon: any;
  color: string;
  processed: number;
  errors: number;
  lastRun: string | null;
}

export const AIAgentDetails = () => {
  const [agents, setAgents] = useState<AgentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgentDetails();
  }, []);

  const loadAgentDetails = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Buscar estatísticas de despesas classificadas
      const { data: expenses } = await supabase
        .from('expenses')
        .select('account_id, created_at')
        .not('account_id', 'is', null)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Buscar estatísticas de transações conciliadas
      const { data: transactions } = await supabase
        .from('bank_transactions')
        .select('matched, matched_invoice_id, matched_expense_id, created_at')
        .eq('matched', true)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Buscar últimas análises financeiras
      const { data: analyses } = await supabase
        .from('financial_analysis' as any)
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Buscar logs de automação para PIX
      const { data: logs } = await supabase
        .from('automation_logs' as any)
        .select('*')
        .gte('execution_date', thirtyDaysAgo.toISOString())
        .order('execution_date', { ascending: false });

      const agentData: AgentDetail[] = [
        {
          name: 'Reconciliação PIX',
          icon: Zap,
          color: 'text-blue-600',
          processed: transactions?.filter(t => t.matched_invoice_id !== null).length || 0,
          errors: 0,
          lastRun: (logs as any)?.[0]?.execution_date || null
        },
        {
          name: 'Conciliação Bancária',
          icon: Bot,
          color: 'text-indigo-600',
          processed: transactions?.length || 0,
          errors: 0,
          lastRun: (logs as any)?.[0]?.execution_date || null
        },
        {
          name: 'Classificação',
          icon: Tags,
          color: 'text-purple-600',
          processed: expenses?.length || 0,
          errors: 0,
          lastRun: (expenses as any)?.[0]?.created_at || null
        },
        {
          name: 'Análise Financeira',
          icon: TrendingUp,
          color: 'text-green-600',
          processed: analyses?.length || 0,
          errors: 0,
          lastRun: (analyses as any)?.[0]?.created_at || null
        }
      ];

      setAgents(agentData);
    } catch (error) {
      console.error('Error loading agent details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 bg-muted rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {agents.map((agent, idx) => {
        const Icon = agent.icon;
        return (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Icon className={`h-5 w-5 ${agent.color}`} />
                {agent.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Processados</span>
                  <Badge variant="secondary" className="font-mono">
                    {agent.processed}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Erros</span>
                  <Badge 
                    variant={agent.errors > 0 ? "destructive" : "outline"}
                    className="font-mono"
                  >
                    {agent.errors}
                  </Badge>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Última execução</span>
                  <span className="text-xs font-medium">
                    {agent.lastRun 
                      ? new Date(agent.lastRun).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Nunca'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
