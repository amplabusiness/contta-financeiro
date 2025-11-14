import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Brain, Tags, Calendar, Loader2, Play, TrendingUp, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AIAgentStats } from "@/components/AIAgentStats";
import { AIAgentDetails } from "@/components/AIAgentDetails";
import { AIExecutionHistory } from "@/components/AIExecutionHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      id: 'pix-reconciliation',
      name: 'Reconciliação PIX Inteligente',
      description: 'Identifica clientes por CNPJ/CPF e concilia PIX com faturas automaticamente',
      icon: Bot,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      function: 'ai-pix-reconciliation'
    },
    {
      id: 'reconciliation',
      name: 'Conciliação Automática',
      description: 'Concilia transações bancárias com boletos e despesas usando IA',
      icon: Bot,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
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

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* Estatísticas Gerais */}
            <AIAgentStats />

            {/* Grid com detalhes por agente e histórico */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Estatísticas por Agente</h3>
                <AIAgentDetails />
              </div>
              <div>
                <AIExecutionHistory />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6 mt-6">
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
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Resultado:</p>
                    <div className="space-y-1 text-sm">
                      <p>✅ Executado em: {results.automation.timestamp}</p>
                      {results.automation.tasks_executed && (
                        <p>📊 Tarefas: {results.automation.tasks_executed} executadas</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent) => {
                const Icon = agent.icon;
                const agentResult = results[agent.id];
                
                return (
                  <Card key={agent.id} className="relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${agent.bgColor}`} />
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${agent.color}`} />
                        {agent.name}
                      </CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => runAgent(agent.id, agent.function)}
                        disabled={loading !== null}
                        className="w-full"
                      >
                        {loading === agent.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Executando...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Executar Agente
                          </>
                        )}
                      </Button>
                      
                      {agentResult && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Última execução:</span>
                            <Badge variant="secondary">{agentResult.timestamp}</Badge>
                          </div>
                          
                          {agentResult.classified !== undefined && (
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Classificadas:</span>
                                <Badge>{agentResult.classified}</Badge>
                              </div>
                            </div>
                          )}
                          
                          {agentResult.reconciled !== undefined && (
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Conciliadas:</span>
                                <Badge>{agentResult.reconciled}</Badge>
                              </div>
                            </div>
                          )}
                          
                          {agentResult.health_score !== undefined && (
                            <div className="p-3 bg-muted rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Score de Saúde:</span>
                                <Badge variant={agentResult.health_score >= 70 ? "default" : "destructive"}>
                                  {agentResult.health_score}/100
                                </Badge>
                              </div>
                              <Progress value={agentResult.health_score} />
                            </div>
                          )}
                          
                          {agentResult.success !== undefined && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm">{agentResult.message || 'Executado com sucesso'}</p>
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
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AIAgents;
