import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIInvoiceClassifierProps {
  invoiceId: string;
  clientId: string;
  amount: number;
  dueDate: string;
  onAnalysisComplete?: (analysis: any) => void;
}

export function AIInvoiceClassifier({
  invoiceId,
  clientId,
  amount,
  dueDate,
  onAnalysisComplete,
}: AIInvoiceClassifierProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const analyzeInvoice = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-invoice-classifier", {
        body: { invoiceIds: [invoiceId] },
      });

      if (error) throw error;

      // Extract first result since we're passing single invoice
      const result = data?.results?.[0];
      if (!result) throw new Error("Nenhum resultado retornado");
      
      setAnalysis(result);
      onAnalysisComplete?.(result);
      
      const riskLevel = data.classification?.risk_level;
      if (riskLevel === "high") {
        toast.warning("⚠️ Alto risco de inadimplência detectado!");
      } else if (riskLevel === "medium") {
        toast.info("📊 Risco médio de inadimplência");
      } else {
        toast.success("✅ Baixo risco de inadimplência");
      }
    } catch (error: any) {
      console.error("Erro ao classificar fatura:", error);
      toast.error(error.message || "Erro ao analisar fatura");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "high":
        return "text-red-500 bg-red-500/10";
      case "medium":
        return "text-yellow-500 bg-yellow-500/10";
      case "low":
        return "text-green-500 bg-green-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <TrendingDown className="h-4 w-4" />;
      case "low":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  if (!analysis) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={analyzeInvoice}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Analisar risco de inadimplência com IA</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const { classification } = analysis;

  return (
    <Card className="mt-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Análise de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Risco de Inadimplência:</span>
          <Badge className={getRiskColor(classification.risk_level)}>
            <span className="flex items-center gap-1">
              {getRiskIcon(classification.risk_level)}
              {classification.risk_level.toUpperCase()}
            </span>
          </Badge>
        </div>

        {classification.probability && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Probabilidade:</span>
            <span className="text-sm font-semibold">
              {(classification.probability * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {classification.predicted_payment_date && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Data Prevista de Pagamento:</span>
            <span className="text-sm font-semibold">
              {new Date(classification.predicted_payment_date).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}

        {classification.factors && classification.factors.length > 0 && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Fatores de Risco:</span>
            <ul className="text-xs text-muted-foreground space-y-1">
              {classification.factors.map((factor: string, idx: number) => (
                <li key={idx}>• {factor}</li>
              ))}
            </ul>
          </div>
        )}

        {classification.recommendation && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Recomendação:</span>
            <p className="text-xs text-muted-foreground">{classification.recommendation}</p>
          </div>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={analyzeInvoice}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Reanalisando...
            </>
          ) : (
            <>
              <Brain className="h-3 w-3 mr-2" />
              Reanalisar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
