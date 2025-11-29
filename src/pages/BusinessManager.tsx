import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  FileCheck,
  BarChart3,
  Lightbulb,
  Loader2,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  action: string;
  data: any;
  analysis: string;
  timestamp: string;
}

const BusinessManager = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");

  const actions = [
    {
      id: "analyze_receivables",
      title: "Contas a Receber",
      description: "Análise de inadimplência, aging e cobrança",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: "analyze_payables",
      title: "Contas a Pagar",
      description: "Controle de vencimentos e priorização",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      id: "financial_indicators",
      title: "Indicadores Financeiros",
      description: "ROI, margem, liquidez e endividamento",
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: "monthly_closing",
      title: "Fechamento Mensal",
      description: "Verificação de completude e checklist",
      icon: FileCheck,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      id: "cash_flow_analysis",
      title: "Fluxo de Caixa",
      description: "Projeções e análise de liquidez",
      icon: DollarSign,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      id: "strategic_advice",
      title: "Consultoria Estratégica",
      description: "Conselho personalizado para decisões",
      icon: Lightbulb,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  const runAnalysis = async (actionId: string, context?: any) => {
    setLoading(actionId);
    try {
      const { data, error } = await supabase.functions.invoke("ai-business-manager", {
        body: {
          action: actionId,
          context,
        },
      });

      if (error) throw error;

      setResult(data);
      toast.success("Análise concluída!");
    } catch (error: any) {
      console.error("Erro na análise:", error);
      toast.error("Erro ao executar análise", {
        description: error.message,
      });
    } finally {
      setLoading(null);
    }
  };

  const handleStrategicAdvice = () => {
    if (!customQuestion.trim()) {
      toast.error("Digite uma pergunta");
      return;
    }
    runAnalysis("strategic_advice", { question: customQuestion });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const renderDataCards = (data: any) => {
    if (!data) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {data.receitas !== undefined && (
          <Card className="bg-green-50">
            <CardContent className="p-3">
              <div className="text-xs text-green-700">Receitas</div>
              <div className="text-lg font-bold text-green-800">
                {formatCurrency(data.receitas)}
              </div>
            </CardContent>
          </Card>
        )}
        {data.despesas !== undefined && (
          <Card className="bg-red-50">
            <CardContent className="p-3">
              <div className="text-xs text-red-700">Despesas</div>
              <div className="text-lg font-bold text-red-800">
                {formatCurrency(data.despesas)}
              </div>
            </CardContent>
          </Card>
        )}
        {data.lucro_liquido !== undefined && (
          <Card className={data.lucro_liquido >= 0 ? "bg-blue-50" : "bg-orange-50"}>
            <CardContent className="p-3">
              <div className="text-xs text-blue-700">Lucro Líquido</div>
              <div className={cn(
                "text-lg font-bold",
                data.lucro_liquido >= 0 ? "text-blue-800" : "text-orange-800"
              )}>
                {formatCurrency(data.lucro_liquido)}
              </div>
            </CardContent>
          </Card>
        )}
        {data.margem_lucro_percentual !== undefined && (
          <Card className="bg-purple-50">
            <CardContent className="p-3">
              <div className="text-xs text-purple-700">Margem de Lucro</div>
              <div className="text-lg font-bold text-purple-800">
                {data.margem_lucro_percentual}%
              </div>
            </CardContent>
          </Card>
        )}
        {data.total_receivable !== undefined && (
          <Card className="bg-green-50">
            <CardContent className="p-3">
              <div className="text-xs text-green-700">Total a Receber</div>
              <div className="text-lg font-bold text-green-800">
                {formatCurrency(data.total_receivable)}
              </div>
            </CardContent>
          </Card>
        )}
        {data.total_overdue !== undefined && (
          <Card className="bg-red-50">
            <CardContent className="p-3">
              <div className="text-xs text-red-700">Vencido</div>
              <div className="text-lg font-bold text-red-800">
                {formatCurrency(data.total_overdue)}
              </div>
            </CardContent>
          </Card>
        )}
        {data.overdue_invoices !== undefined && (
          <Card className="bg-yellow-50">
            <CardContent className="p-3">
              <div className="text-xs text-yellow-700">Faturas Vencidas</div>
              <div className="text-lg font-bold text-yellow-800">
                {data.overdue_invoices}
              </div>
            </CardContent>
          </Card>
        )}
        {data.active_clients !== undefined && (
          <Card className="bg-blue-50">
            <CardContent className="p-3">
              <div className="text-xs text-blue-700">Clientes Ativos</div>
              <div className="text-lg font-bold text-blue-800">
                {data.active_clients}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderChecklist = (checklist: any) => {
    if (!checklist) return null;

    return (
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <FileCheck className="h-4 w-4" />
          Checklist de Fechamento
        </h4>
        <div className="space-y-2">
          {Object.entries(checklist).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              {value ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span className="text-sm">
                {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="relative">
                <Brain className="h-8 w-8 text-violet-600" />
                <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              Gestor Empresarial IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Especialista em gestão financeira, indicadores e estratégia
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            MBA em Gestão + Gemini 2.5
          </Badge>
        </div>

        <Tabs defaultValue="actions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="actions">Análises</TabsTrigger>
            <TabsTrigger value="consultant">Consultoria</TabsTrigger>
          </TabsList>

          {/* Ações de Análise */}
          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actions.filter(a => a.id !== "strategic_advice").map((action) => (
                <Card
                  key={action.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    loading === action.id && "ring-2 ring-primary"
                  )}
                  onClick={() => !loading && runAnalysis(action.id)}
                >
                  <CardHeader className="pb-2">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", action.bgColor)}>
                      <action.icon className={cn("h-5 w-5", action.color)} />
                    </div>
                    <CardTitle className="text-lg mt-2">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={!!loading}
                    >
                      {loading === action.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        "Executar Análise"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Consultoria Estratégica */}
          <TabsContent value="consultant" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-orange-500" />
                  Consultoria Estratégica Personalizada
                </CardTitle>
                <CardDescription>
                  Faça perguntas sobre gestão, estratégia, finanças ou qualquer dúvida empresarial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ex: Como posso melhorar a margem de lucro? Quais clientes devo priorizar? Como reduzir a inadimplência?"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleStrategicAdvice}
                  disabled={!!loading || !customQuestion.trim()}
                  className="w-full"
                >
                  {loading === "strategic_advice" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Consultar Gestor IA
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Resultado da Análise */}
        {result && (
          <Card className="border-violet-200 bg-gradient-to-r from-violet-50/50 to-purple-50/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-violet-600" />
                  Resultado da Análise
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(result.timestamp).toLocaleString("pt-BR")}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Data Cards */}
              {renderDataCards(result.data)}

              {/* Checklist se for fechamento */}
              {result.data?.checklist && renderChecklist(result.data.checklist)}

              {/* Aging se for recebíveis */}
              {result.data?.aging && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {Object.entries(result.data.aging).map(([period, data]: [string, any]) => (
                    <Card key={period} className="bg-muted/30">
                      <CardContent className="p-3 text-center">
                        <div className="text-xs text-muted-foreground">{period}</div>
                        <div className="text-lg font-bold">{data.count} faturas</div>
                        <div className="text-sm text-red-600">{formatCurrency(data.total)}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Análise do IA */}
              <ScrollArea className="h-[400px] rounded-lg border bg-background p-4">
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {result.analysis}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default BusinessManager;
