import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Target, Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AIClientAnalyzerProps {
  clientId: string;
  trigger?: React.ReactNode;
}

export function AIClientAnalyzer({ clientId, trigger }: AIClientAnalyzerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partnerAnalysis, setPartnerAnalysis] = useState<any>(null);
  const [segmentation, setSegmentation] = useState<any>(null);

  const analyzeAll = async () => {
    setLoading(true);
    try {
      const [partnerResult, segmentResult] = await Promise.all([
        supabase.functions.invoke("ai-partner-analyzer", { body: { clientId } }),
        supabase.functions.invoke("ai-client-segmenter", { body: { clientId } }),
      ]);

      if (partnerResult.error) throw partnerResult.error;
      if (segmentResult.error) throw segmentResult.error;

      setPartnerAnalysis(partnerResult.data?.analysis);
      setSegmentation(segmentResult.data?.segmentation);
      toast.success("Análise completa realizada!");
    } catch (error: any) {
      console.error("Erro ao analisar cliente:", error);
      toast.error(error.message || "Erro ao analisar cliente");
    } finally {
      setLoading(false);
    }
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case "vip":
        return "bg-purple-500/10 text-purple-500";
      case "high_value":
        return "bg-blue-500/10 text-blue-500";
      case "medium_value":
        return "bg-green-500/10 text-green-500";
      case "low_value":
        return "bg-yellow-500/10 text-yellow-500";
      case "at_risk":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const defaultTrigger = (
    <Button size="sm" variant="outline">
      <Users className="h-4 w-4 mr-2" />
      Análise de IA
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => !partnerAnalysis && analyzeAll()}>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Análise Inteligente de Cliente
          </DialogTitle>
          <DialogDescription>
            Análise de grupos econômicos, segmentação e risco de churn
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando cliente...</p>
          </div>
        ) : (
          <Tabs defaultValue="segmentation" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="segmentation">
                <Target className="h-4 w-4 mr-2" />
                Segmentação
              </TabsTrigger>
              <TabsTrigger value="partners">
                <Users className="h-4 w-4 mr-2" />
                Grupos Econômicos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="segmentation" className="space-y-4">
              {segmentation && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Segmento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge className={getSegmentColor(segmentation.segment)}>
                          {segmentation.segment?.toUpperCase()}
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Score de Valor</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="text-2xl font-bold">
                            {segmentation.value_score?.toFixed(1)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {segmentation.churn_risk !== undefined && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Risco de Churn
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Probabilidade:</span>
                            <span className="text-sm font-semibold">
                              {(segmentation.churn_risk * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                segmentation.churn_risk > 0.7
                                  ? "bg-red-500"
                                  : segmentation.churn_risk > 0.4
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${segmentation.churn_risk * 100}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {segmentation.characteristics && segmentation.characteristics.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Características</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {segmentation.characteristics.map((char: string, idx: number) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{char}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {segmentation.recommended_actions && segmentation.recommended_actions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Ações Recomendadas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {segmentation.recommended_actions.map((action: string, idx: number) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="partners" className="space-y-4">
              {partnerAnalysis && (
                <>
                  {partnerAnalysis.economic_group && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Grupo Econômico Identificado</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Empresas no grupo:</span>
                          <span className="font-semibold">
                            {partnerAnalysis.economic_group.companies_count}
                          </span>
                        </div>
                        {partnerAnalysis.economic_group.total_revenue && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Receita total:</span>
                            <span className="font-semibold">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(partnerAnalysis.economic_group.total_revenue)}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {partnerAnalysis.risk_level && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Nível de Risco</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge
                          variant={
                            partnerAnalysis.risk_level === "high"
                              ? "destructive"
                              : partnerAnalysis.risk_level === "medium"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {partnerAnalysis.risk_level?.toUpperCase()}
                        </Badge>
                      </CardContent>
                    </Card>
                  )}

                  {partnerAnalysis.concentration_percentage !== undefined && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Concentração de Receita</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Percentual da receita total:</span>
                            <span className="text-lg font-bold">
                              {partnerAnalysis.concentration_percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${partnerAnalysis.concentration_percentage}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {partnerAnalysis.recommendations && partnerAnalysis.recommendations.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Recomendações</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {partnerAnalysis.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        <Button
          className="w-full"
          onClick={analyzeAll}
          disabled={loading}
          variant="outline"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Reanalisando...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Reanalisar Cliente
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
