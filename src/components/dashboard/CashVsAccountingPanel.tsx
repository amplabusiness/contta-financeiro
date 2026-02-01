import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Wallet, 
  BookOpen, 
  Info,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowDown,
  ArrowUp
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CashVsAccountingPanelProps {
  // Caixa Bancário (Real)
  saldoBancario: number;
  projecao7dias: number;
  projecao15dias: number;
  projecao30dias: number;
  pagamentosAgendados: number;
  
  // Resultado Contábil (Competência)
  receitaMes: number;
  despesaMes: number;
  resultadoProjetado: number;
}

export function CashVsAccountingPanel({
  saldoBancario,
  projecao7dias,
  projecao15dias,
  projecao30dias,
  pagamentosAgendados,
  receitaMes,
  despesaMes,
  resultadoProjetado
}: CashVsAccountingPanelProps) {
  const navigate = useNavigate();

  return (
    <TooltipProvider>
      <div className="grid md:grid-cols-2 gap-4">
        {/* Caixa Bancário (Real) */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                </div>
                Caixa Bancário
                <Badge variant="outline" className="text-xs font-normal">Real</Badge>
              </CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Saldo real em conta bancária.
                    <br />
                    Fonte: extratos OFX importados.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Saldo Atual */}
            <div 
              className="p-3 rounded-lg bg-emerald-50 cursor-pointer hover:bg-emerald-100 transition-colors"
              onClick={() => navigate('/bank-reconciliation')}
            >
              <p className="text-xs text-emerald-600 font-medium mb-1">Saldo Atual</p>
              <p className={cn(
                "text-2xl font-bold",
                saldoBancario >= 0 ? "text-emerald-700" : "text-red-600"
              )}>
                {formatCurrency(saldoBancario)}
              </p>
            </div>

            {/* Projeções */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Projeção</p>
              <div className="grid grid-cols-3 gap-2">
                <ProjecaoItem 
                  label="7 dias" 
                  value={projecao7dias} 
                  current={saldoBancario}
                />
                <ProjecaoItem 
                  label="15 dias" 
                  value={projecao15dias} 
                  current={saldoBancario}
                />
                <ProjecaoItem 
                  label="30 dias" 
                  value={projecao30dias} 
                  current={saldoBancario}
                />
              </div>
            </div>

            {/* Pagamentos Agendados */}
            {pagamentosAgendados > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">Pagamentos agendados</span>
                </div>
                <span className="text-sm font-medium text-amber-700">
                  {formatCurrency(pagamentosAgendados)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultado Contábil (Competência) */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                </div>
                Resultado Contábil
                <Badge variant="outline" className="text-xs font-normal">Competência</Badge>
              </CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Resultado pelo regime de competência.
                    <br />
                    Receitas e despesas do período,
                    <br />
                    independente de pagamento.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Receita do Mês */}
            <div 
              className="p-3 rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => navigate('/reports/dre')}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-blue-600 font-medium">Receita do Mês</p>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-blue-700">
                {formatCurrency(receitaMes)}
              </p>
            </div>

            {/* Despesa do Mês */}
            <div 
              className="p-3 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => navigate('/reports/dre')}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-600 font-medium">Despesa do Mês</p>
                <TrendingDown className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-xl font-bold text-slate-700">
                {formatCurrency(despesaMes)}
              </p>
            </div>

            {/* Resultado Projetado */}
            <div className={cn(
              "p-3 rounded-lg border-2 border-dashed",
              resultadoProjetado >= 0 
                ? "border-emerald-200 bg-emerald-50/50" 
                : "border-red-200 bg-red-50/50"
            )}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">Resultado Projetado</p>
                {resultadoProjetado >= 0 
                  ? <ArrowUp className="h-4 w-4 text-emerald-500" />
                  : <ArrowDown className="h-4 w-4 text-red-500" />
                }
              </div>
              <p className={cn(
                "text-xl font-bold",
                resultadoProjetado >= 0 ? "text-emerald-700" : "text-red-600"
              )}>
                {formatCurrency(resultadoProjetado)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tooltip Educativo Fixo */}
      <div className="mt-3 flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-100 text-slate-600">
        <Info className="h-4 w-4 shrink-0" />
        <p className="text-xs text-center">
          <strong>Banco ≠ Resultado.</strong> Caixa mostra dinheiro real. Contabilidade mostra competência.
        </p>
      </div>
    </TooltipProvider>
  );
}

// Componente auxiliar para projeções
function ProjecaoItem({ label, value, current }: { label: string; value: number; current: number }) {
  const diff = value - current;
  const isPositive = diff >= 0;

  return (
    <div className="p-2 rounded-lg bg-slate-50 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={cn(
        "text-sm font-semibold",
        value >= 0 ? "text-slate-700" : "text-red-600"
      )}>
        {formatCurrency(value)}
      </p>
      {diff !== 0 && (
        <p className={cn(
          "text-xs",
          isPositive ? "text-emerald-600" : "text-red-500"
        )}>
          {isPositive ? '+' : ''}{formatCurrency(diff)}
        </p>
      )}
    </div>
  );
}
