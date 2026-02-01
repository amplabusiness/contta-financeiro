import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Wallet, 
  Receipt, 
  AlertTriangle, 
  TrendingUp,
  Info,
  ArrowRight,
  Calendar
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ExecutiveHealthCardsProps {
  caixaDisponivel: number;
  aReceber: number;
  qtdFaturas: number;
  inadimplencia: number;
  receitaEsperada: number;
  diasOperacao?: number;
  periodo: string;
}

export function ExecutiveHealthCards({
  caixaDisponivel,
  aReceber,
  qtdFaturas,
  inadimplencia,
  receitaEsperada,
  diasOperacao = 0,
  periodo
}: ExecutiveHealthCardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      id: "caixa",
      icon: Wallet,
      label: "Caixa Disponível",
      value: caixaDisponivel,
      insight: diasOperacao > 0 ? `cobre ${diasOperacao} dias de operação` : "saldo atual",
      color: caixaDisponivel > 0 ? "text-emerald-600" : "text-red-600",
      bgColor: caixaDisponivel > 0 ? "bg-emerald-50" : "bg-red-50",
      iconBg: caixaDisponivel > 0 ? "bg-emerald-100" : "bg-red-100",
      onClick: () => navigate("/bank-reconciliation"),
      tooltip: "Saldo bancário real (fonte: extratos importados)"
    },
    {
      id: "receber",
      icon: Receipt,
      label: "Clientes a Receber",
      value: aReceber,
      insight: `conta 1.1.2.01 • ${qtdFaturas} faturas`,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      iconBg: "bg-blue-100",
      onClick: () => navigate("/invoices"),
      tooltip: "Saldo contábil da conta 1.1.2.01 - Duplicatas emitidas não recebidas"
    },
    {
      id: "inadimplencia",
      icon: AlertTriangle,
      label: "Inadimplência",
      value: inadimplencia,
      insight: inadimplencia === 0 ? "sem risco imediato" : "atenção necessária",
      color: inadimplencia === 0 ? "text-emerald-600" : "text-amber-600",
      bgColor: inadimplencia === 0 ? "bg-emerald-50" : "bg-amber-50",
      iconBg: inadimplencia === 0 ? "bg-emerald-100" : "bg-amber-100",
      onClick: () => navigate("/invoices?filter=overdue"),
      tooltip: "Valores vencidos e não recebidos"
    },
    {
      id: "receita",
      icon: TrendingUp,
      label: "Faturamento Potencial",
      value: receitaEsperada,
      insight: "soma dos honorários mensais",
      color: "text-violet-600",
      bgColor: "bg-violet-50",
      iconBg: "bg-violet-100",
      onClick: () => navigate("/fees-analysis"),
      tooltip: "Soma de todos os monthly_fee cadastrados nos clientes"
    }
  ];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Saúde Financeira do Escritório
            </h2>
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {periodo}
            </Badge>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-slate-400" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-sm">
                <strong>Banco ≠ Resultado</strong>
                <br />
                Caixa mostra dinheiro real.
                <br />
                Contabilidade mostra competência.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Tooltip key={card.id}>
              <TooltipTrigger asChild>
                <Card 
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-0",
                    card.bgColor
                  )}
                  onClick={card.onClick}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn("p-2 rounded-lg", card.iconBg)}>
                        <card.icon className={cn("h-5 w-5", card.color)} />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                    
                    <p className="text-sm font-medium text-slate-600 mb-1">
                      {card.label}
                    </p>
                    
                    <p className={cn("text-2xl font-bold mb-1", card.color)}>
                      {formatCurrency(card.value)}
                    </p>
                    
                    <p className="text-xs text-slate-500">
                      {card.insight}
                    </p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>{card.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
