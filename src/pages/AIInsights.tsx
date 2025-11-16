import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot,
  Users,
  FileText,
  Mail,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Target,
  Loader2,
  Zap,
  Brain,
  Shield,
  DollarSign,
  Activity,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  endpoint: string;
  requiresInput?: boolean;
}

interface AgentStats {
  totalExecutions: number;
  successRate: number;
  lastExecution: string | null;
  avgExecutionTime: number;
}

const AIInsights = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, AgentStats>>({});
  const [alerts, setAlerts] = useState<any[]>([]);

  const agents: AgentConfig[] = [
    {
      id: "collection",
      name: "Agente de Cobrança",
      description: "Análise inteligente de estratégias de cobrança",
      icon: DollarSign,
      color: "text-green-500",
      endpoint: "ai-collection-agent",
      requiresInput: true,
    },
    {
      id: "partner",
      name: "Analisador de Sócios",
      description: "Identifica grupos econômicos e riscos",
      icon: Users,
      color: "text-blue-500",
      endpoint: "ai-partner-analyzer",
    },
    {
      id: "contract",
      name: "Gerador de Contratos",
      description: "Cria contratos personalizados automaticamente",
      icon: FileText,
      color: "text-purple-500",
      endpoint: "ai-contract-generator",
      requiresInput: true,
    },
    {
      id: "email",
      name: "Compositor de Emails",
      description: "Gera emails de cobrança personalizados",
      icon: Mail,
      color: "text-orange-500",
      endpoint: "ai-email-composer",
      requiresInput: true,
    },
    {
      id: "invoice",
      name: "Classificador de Faturas",
      description: "Avalia risco de inadimplência",
      icon: AlertTriangle,
      color: "text-red-500",
      endpoint: "ai-invoice-classifier",
      requiresInput: true,
    },
    {
      id: "accounting",
      name: "Validador Contábil",
      description: "Valida lançamentos e sugere contas",
      icon: CheckCircle2,
      color: "text-teal-500",
      endpoint: "ai-accounting-validator",
      requiresInput: true,
    },
    {
      id: "revenue",
      name: "Preditor de Receita",
      description: "Prevê receitas e identifica tendências",
      icon: TrendingUp,
      color: "text-indigo-500",
      endpoint: "ai-revenue-predictor",
    },
    {
      id: "segmenter",
      name: "Segmentador de Clientes",
      description: "Segmenta clientes e prevê churn",
      icon: Target,
      color: "text-pink-500",
      endpoint: "ai-client-segmenter",
    },
  ];

  useEffect(() => {
    // Stats will be loaded as agents are used
    // For now, show initial state
  }, []);

  const runAgent = async (agent: AgentConfig) => {
    if (agent.requiresInput) {
      toast.info(`${agent.name} requer parâmetros específicos. Use a página de Agentes de IA para execução detalhada.`);
      return;
    }

    setLoading(agent.id);
    try {
      const { data, error } = await supabase.functions.invoke(agent.endpoint);

      if (error) throw error;

      toast.success(`${agent.name} executado com sucesso!`);
    } catch (error: any) {
      console.error(`Erro ao executar ${agent.name}:`, error);
      toast.error(error.message || `Erro ao executar ${agent.name}`);
    } finally {
      setLoading(null);
    }
  };

  const getAgentStats = (endpoint: string): AgentStats => {
    return stats[endpoint] || {
      totalExecutions: 0,
      successRate: 0,
      lastExecution: null,
      avgExecutionTime: 0,
    };
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Nunca executado";
    return new Date(date).toLocaleString("pt-BR");
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Dashboard de Inteligência Artificial
          </h1>
          <p className="text-muted-foreground mt-2">
            Visão geral de todos os agentes de IA e suas análises
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="alerts">
              Alertas Críticos
              {alerts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {alerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {agents.map((agent) => {
                const agentStats = getAgentStats(agent.endpoint);
                const Icon = agent.icon;

                return (
                  <Card key={agent.id} className="relative overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <Icon className={`h-8 w-8 ${agent.color}`} />
                        {agentStats.successRate >= 90 && (
                          <Badge variant="outline" className="text-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ótimo
                          </Badge>
                        )}
                        {agentStats.successRate < 90 && agentStats.successRate >= 70 && (
                          <Badge variant="outline" className="text-yellow-500">
                            <Activity className="h-3 w-3 mr-1" />
                            Bom
                          </Badge>
                        )}
                        {agentStats.successRate < 70 && agentStats.totalExecutions > 0 && (
                          <Badge variant="outline" className="text-red-500">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Atenção
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg mt-4">{agent.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {agent.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Execuções:</span>
                          <span className="font-semibold">{agentStats.totalExecutions}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxa de sucesso:</span>
                            <span className="font-semibold">
                              {agentStats.successRate.toFixed(1)}%
                            </span>
                          </div>
                          <Progress value={agentStats.successRate} className="h-1" />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Última execução:</span>
                          <span className="text-xs">
                            {formatDate(agentStats.lastExecution)}
                          </span>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() => runAgent(agent)}
                        disabled={loading === agent.id || agent.requiresInput}
                      >
                        {loading === agent.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Executando...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            {agent.requiresInput ? "Requer Parâmetros" : "Executar Agora"}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Nenhum alerta crítico</h3>
                  <p className="text-muted-foreground text-center">
                    Todos os agentes estão funcionando corretamente
                  </p>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          {alert.agent_name}
                        </CardTitle>
                        <CardDescription>
                          {formatDate(alert.created_at)}
                        </CardDescription>
                      </div>
                      <Badge variant={alert.status === "error" ? "destructive" : "secondary"}>
                        {alert.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {alert.error_message || "Erro desconhecido"}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total de Execuções</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Object.values(stats).reduce((acc, s) => acc + s.totalExecutions, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os agentes combinados
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Taxa de Sucesso Média</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Object.values(stats).length > 0
                      ? (
                          Object.values(stats).reduce((acc, s) => acc + s.successRate, 0) /
                          Object.values(stats).length
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Média de todos os agentes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Agentes Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{agents.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agentes de IA disponíveis
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Desempenho por Agente</CardTitle>
                <CardDescription>
                  Comparativo de execuções e taxa de sucesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agents.map((agent) => {
                    const agentStats = getAgentStats(agent.endpoint);
                    return (
                      <div key={agent.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{agent.name}</span>
                          <span className="text-muted-foreground">
                            {agentStats.totalExecutions} execuções
                          </span>
                        </div>
                        <Progress value={agentStats.successRate} className="h-2" />
                        <div className="flex justify-end text-xs text-muted-foreground">
                          {agentStats.successRate.toFixed(1)}% de sucesso
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AIInsights;
