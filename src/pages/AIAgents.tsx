import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Brain, Tags, Calendar, Loader2, Play, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const AIAgents = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<any>({});

  const runAgent = async (agentName: string, functionName: string) => {
    setLoading(agentName);
    try {
      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;
      
      setResults((prev: any) => ({
        ...prev,
        [agentName]: {
          ...data,
          timestamp: new Date().toLocaleString('pt-BR')
        }
      }));
      
      toast.success(`Agente ${agentName} executado com sucesso!`);
    } catch (error: any) {
      console.error(`Error running ${agentName}:`, error);
      toast.error(`Erro ao executar ${agentName}: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const runAllAgents = async () => {
    setLoading('all');
    try {
      const { data, error } = await supabase.functions.invoke('automation-scheduler');
      
      if (error) throw error;
      
      setResults({
        automation: {
          ...data,
          timestamp: new Date().toLocaleString('pt-BR')
        }
      });
      
      toast.success('Todos os agentes executados com sucesso!');
    } catch (error: any) {
      console.error('Error running all agents:', error);
      toast.error('Erro ao executar agentes: ' + error.message);
    } finally {
      setLoading(null);
    }
  };

  const agents = [
    {
      id: 'reconciliation',
      name: 'Conciliação Automática',
      description: 'Concilia transações bancárias com boletos e despesas usando IA',
      icon: Bot,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      function: 'ai-reconciliation-agent'
    },
    {
      id: 'classification',
      name: 'Classificação de Despesas',
      description: 'Classifica despesas automaticamente no plano de contas correto',
      icon: Tags,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      function: 'ai-expense-classifier'
    },
    {
      id: 'analysis',
      name: 'Análise Financeira',
      description: 'Gera insights, previsões e recomendações financeiras',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      function: 'ai-financial-analyst'
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">🤖 Agentes de IA</h1>
          <p className="text-muted-foreground mt-2">
            Sistema de automação inteligente com IA - Zero intervenção humana
          </p>
        </div>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Automação Completa
            </CardTitle>
            <CardDescription>
              Execute todos os agentes de uma vez para processamento automático completo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={runAllAgents}
              disabled={loading !== null}
              size="lg"
              className="w-full"
            >
              {loading === 'all' ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Executando todos os agentes...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Executar Todos os Agentes
                </>
              )}
            </Button>

            {results.automation && (
              <div className="mt-4 p-4 bg-background rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Última Execução</span>
                  <Badge variant="outline">{results.automation.timestamp}</Badge>
                </div>
                <div className="space-y-2">
                  {results.automation.results?.tasks?.map((task: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{task.name}</span>
                      <Badge variant={task.status === 'success' ? 'default' : 'destructive'}>
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const result = results[agent.id];

            return (
              <Card key={agent.id}>
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${agent.bgColor} flex items-center justify-center mb-4`}>
                    <Icon className={`h-6 w-6 ${agent.color}`} />
                  </div>
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <CardDescription>{agent.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => runAgent(agent.id, agent.function)}
                    disabled={loading !== null}
                    className="w-full"
                    variant="outline"
                  >
                    {loading === agent.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Executar Agora
                      </>
                    )}
                  </Button>

                  {result && (
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Última execução:</span>
                        <span className="font-medium">{result.timestamp}</span>
                      </div>
                      
                      {result.processed !== undefined && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Processados:</span>
                            <Badge variant="secondary">{result.processed}</Badge>
                          </div>
                          {result.reconciled !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span>Conciliados:</span>
                              <Badge variant="default">{result.reconciled}</Badge>
                            </div>
                          )}
                          {result.classified !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span>Classificados:</span>
                              <Badge variant="default">{result.classified}</Badge>
                            </div>
                          )}
                        </div>
                      )}

                      {result.analysis && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Score de Saúde:</span>
                            <Badge variant={
                              result.analysis.health_score > 70 ? 'default' : 
                              result.analysis.health_score > 40 ? 'secondary' : 'destructive'
                            }>
                              {result.analysis.health_score}/100
                            </Badge>
                          </div>
                          <Progress value={result.analysis.health_score} className="h-2" />
                          <div className="flex items-center justify-between text-sm">
                            <span>Tendência:</span>
                            <Badge variant="outline">{result.analysis.trend}</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamento Automático
            </CardTitle>
            <CardDescription>
              Configure quando os agentes devem executar automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Execução Diária</p>
                  <p className="text-sm text-muted-foreground">Todos os dias às 03:00</p>
                </div>
                <Badge variant="secondary">Ativo</Badge>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Conciliação a cada 6 horas</p>
                  <p className="text-sm text-muted-foreground">Verifica novas transações</p>
                </div>
                <Badge variant="secondary">Ativo</Badge>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Análise Semanal</p>
                  <p className="text-sm text-muted-foreground">Segundas-feiras às 08:00</p>
                </div>
                <Badge variant="secondary">Ativo</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AIAgents;
