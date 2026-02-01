import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  Clock,
  FileText,
  RefreshCw,
  Eye,
  Zap
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface InsightData {
  caixaDisponivel: number;
  diasOperacao: number;
  recebimentosConcentrados: boolean;
  diaConcentracao?: number;
  inadimplencia: number;
  faturasVencerProximos5Dias: number;
  valorFaturasProximas: number;
  clientesConcentrados: number;
  percentualConcentracao: number;
  inconsistenciasContabeis: number;
  transitóriasPendentes: number;
}

interface DrCiceroInsightPanelProps {
  data: InsightData;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function DrCiceroInsightPanel({ 
  data, 
  isLoading = false,
  onRefresh 
}: DrCiceroInsightPanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Gerar insights baseados nos dados
  const situacaoAtual = generateSituacao(data);
  const acoesSugeridas = generateAcoes(data);
  const riscos = generateRiscos(data);

  return (
    <Card className="border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Dr. Cícero</CardTitle>
              <p className="text-xs text-slate-400">Análise Executiva</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400">Online</span>
            </div>
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-slate-400 hover:text-white hover:bg-slate-700"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Situação Atual */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">
            Situação Atual
          </h4>
          <div className="space-y-2">
            {situacaoAtual.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <item.icon className={cn("h-4 w-4 mt-0.5 shrink-0", item.color)} />
                <span className="text-sm text-slate-200">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Riscos (se houver) */}
        {riscos.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wider text-amber-400 mb-2 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Pontos de Atenção
            </h4>
            <div className="space-y-2">
              {riscos.map((risco, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-500/10 rounded-lg p-2 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-amber-200">{risco}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="bg-slate-700" />

        {/* Ações Sugeridas */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">
            Ações Sugeridas
          </h4>
          <div className="space-y-2">
            {acoesSugeridas.slice(0, expanded ? undefined : 3).map((acao, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between bg-slate-700/50 rounded-lg p-2 hover:bg-slate-700 transition-colors cursor-pointer group"
                onClick={() => acao.route && navigate(acao.route)}
              >
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs w-6 h-6 p-0 flex items-center justify-center rounded-full border-0",
                      acao.priority === 'high' ? "bg-red-500/20 text-red-400" :
                      acao.priority === 'medium' ? "bg-amber-500/20 text-amber-400" :
                      "bg-slate-600 text-slate-300"
                    )}
                  >
                    {i + 1}
                  </Badge>
                  <span className="text-sm text-slate-200">{acao.text}</span>
                </div>
                {acao.route && (
                  <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                )}
              </div>
            ))}
          </div>
          {acoesSugeridas.length > 3 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Ver menos" : `Ver mais ${acoesSugeridas.length - 3} ações`}
            </Button>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-slate-700/50 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={() => navigate("/reports")}
          >
            <Eye className="h-4 w-4 mr-1" />
            Detalhes
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-slate-700/50 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={() => navigate("/super-conciliation")}
          >
            <Zap className="h-4 w-4 mr-1" />
            Ações
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-slate-700/50 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={() => navigate("/audit")}
          >
            <FileText className="h-4 w-4 mr-1" />
            Auditoria
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Helpers para gerar insights
function generateSituacao(data: InsightData) {
  const items = [];

  // Caixa
  if (data.diasOperacao > 30) {
    items.push({
      icon: CheckCircle,
      color: "text-emerald-400",
      text: `Caixa confortável: cobre ${data.diasOperacao} dias de operação`
    });
  } else if (data.diasOperacao > 15) {
    items.push({
      icon: TrendingUp,
      color: "text-blue-400",
      text: `Caixa cobre ${data.diasOperacao} dias de operação`
    });
  } else if (data.diasOperacao > 0) {
    items.push({
      icon: AlertTriangle,
      color: "text-amber-400",
      text: `Atenção: caixa cobre apenas ${data.diasOperacao} dias`
    });
  }

  // Recebimentos
  if (data.recebimentosConcentrados && data.diaConcentracao) {
    items.push({
      icon: Clock,
      color: "text-blue-400",
      text: `Recebimentos concentrados após o dia ${data.diaConcentracao}`
    });
  }

  // Inadimplência
  if (data.inadimplencia === 0) {
    items.push({
      icon: CheckCircle,
      color: "text-emerald-400",
      text: "Nenhum risco de inadimplência detectado"
    });
  } else {
    items.push({
      icon: AlertTriangle,
      color: "text-red-400",
      text: `Inadimplência: ${formatCurrency(data.inadimplencia)}`
    });
  }

  // Inconsistências
  if (data.inconsistenciasContabeis === 0) {
    items.push({
      icon: CheckCircle,
      color: "text-emerald-400",
      text: "Nenhuma inconsistência contábil detectada"
    });
  }

  return items;
}

function generateRiscos(data: InsightData) {
  const riscos = [];

  if (data.diasOperacao < 15 && data.diasOperacao > 0) {
    riscos.push(`Caixa baixo: apenas ${data.diasOperacao} dias de operação`);
  }

  if (data.percentualConcentracao > 40) {
    riscos.push(`${data.clientesConcentrados} clientes concentram ${data.percentualConcentracao}% da receita`);
  }

  if (data.transitóriasPendentes > 0) {
    riscos.push(`${data.transitóriasPendentes} transações aguardando classificação`);
  }

  return riscos;
}

function generateAcoes(data: InsightData): Array<{ text: string; route?: string; priority: 'high' | 'medium' | 'low' }> {
  const acoes = [];

  // Faturas próximas do vencimento
  if (data.faturasVencerProximos5Dias > 0) {
    acoes.push({
      text: `Priorizar cobrança de ${data.faturasVencerProximos5Dias} faturas que vencem em 5 dias (${formatCurrency(data.valorFaturasProximas)})`,
      route: "/invoices?filter=upcoming",
      priority: 'high' as const
    });
  }

  // Transitórias pendentes
  if (data.transitóriasPendentes > 0) {
    acoes.push({
      text: `Classificar ${data.transitóriasPendentes} transações na conta transitória`,
      route: "/super-conciliation",
      priority: 'high' as const
    });
  }

  // Concentração de clientes
  if (data.percentualConcentracao > 40) {
    acoes.push({
      text: "Diversificar carteira: reduzir dependência de poucos clientes",
      route: "/clients",
      priority: 'medium' as const
    });
  }

  // Inadimplência
  if (data.inadimplencia > 0) {
    acoes.push({
      text: `Revisar ${formatCurrency(data.inadimplencia)} em valores vencidos`,
      route: "/invoices?filter=overdue",
      priority: 'high' as const
    });
  }

  // Ação padrão se tudo OK
  if (acoes.length === 0) {
    acoes.push({
      text: "Nenhuma ação contábil pendente",
      priority: 'low' as const
    });
    acoes.push({
      text: "Revisar relatórios do período",
      route: "/reports",
      priority: 'low' as const
    });
  }

  return acoes;
}
