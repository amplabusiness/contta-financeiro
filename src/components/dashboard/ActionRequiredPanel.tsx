import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Clock, 
  Users, 
  CheckCircle,
  ArrowRight,
  AlertTriangle,
  TrendingDown,
  FileWarning,
  LucideIcon
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  type: 'critical' | 'warning' | 'info';
  icon: LucideIcon;
  title: string;
  description: string;
  route?: string;
  count?: number;
  value?: number;
}

interface ActionRequiredPanelProps {
  faturasVencer5Dias: number;
  valorFaturasVencer: number;
  clientesConcentrados: number;
  percentualConcentracao: number;
  inconsistenciasContabeis: number;
  transitóriasPendentes: number;
  valorTransitórias: number;
}

export function ActionRequiredPanel({
  faturasVencer5Dias,
  valorFaturasVencer,
  clientesConcentrados,
  percentualConcentracao,
  inconsistenciasContabeis,
  transitóriasPendentes,
  valorTransitórias
}: ActionRequiredPanelProps) {
  const navigate = useNavigate();

  // Construir lista de ações baseada nos dados
  const actions: ActionItem[] = [];

  // Faturas próximas do vencimento
  if (faturasVencer5Dias > 0) {
    actions.push({
      id: 'faturas',
      type: 'critical',
      icon: Clock,
      title: `${faturasVencer5Dias} faturas vencem em até 5 dias`,
      description: formatCurrency(valorFaturasVencer),
      route: '/invoices?filter=upcoming',
      count: faturasVencer5Dias,
      value: valorFaturasVencer
    });
  }

  // Concentração de clientes
  if (percentualConcentracao > 30) {
    actions.push({
      id: 'concentracao',
      type: percentualConcentracao > 50 ? 'critical' : 'warning',
      icon: Users,
      title: `${clientesConcentrados} clientes concentram ${percentualConcentracao}% da receita`,
      description: 'Risco de concentração',
      route: '/clients',
      count: clientesConcentrados
    });
  }

  // Transitórias pendentes
  if (transitóriasPendentes > 0) {
    actions.push({
      id: 'transitorias',
      type: 'warning',
      icon: FileWarning,
      title: `${transitóriasPendentes} transações aguardando classificação`,
      description: formatCurrency(valorTransitórias),
      route: '/super-conciliation',
      count: transitóriasPendentes,
      value: valorTransitórias
    });
  }

  // Inconsistências contábeis
  if (inconsistenciasContabeis > 0) {
    actions.push({
      id: 'inconsistencias',
      type: 'critical',
      icon: AlertTriangle,
      title: `${inconsistenciasContabeis} inconsistências contábeis detectadas`,
      description: 'Verificação necessária',
      route: '/audit',
      count: inconsistenciasContabeis
    });
  }

  // Se não há ações, mostrar status positivo
  if (actions.length === 0) {
    actions.push({
      id: 'ok',
      type: 'info',
      icon: CheckCircle,
      title: 'Nenhuma ação urgente necessária',
      description: 'Situação sob controle'
    });
  }

  const getActionStyle = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-red-50 hover:bg-red-100',
          border: 'border-red-200',
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          badge: 'bg-red-100 text-red-700'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100',
          border: 'border-amber-200',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
          badge: 'bg-amber-100 text-amber-700'
        };
      default:
        return {
          bg: 'bg-emerald-50 hover:bg-emerald-100',
          border: 'border-emerald-200',
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
          badge: 'bg-emerald-100 text-emerald-700'
        };
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-slate-600" />
            O que precisa de ação hoje?
          </CardTitle>
          {actions.filter(a => a.type !== 'info').length > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              {actions.filter(a => a.type !== 'info').length} pendência{actions.filter(a => a.type !== 'info').length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => {
          const style = getActionStyle(action.type);
          return (
            <div
              key={action.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                style.bg,
                style.border,
                action.route && "hover:shadow-sm"
              )}
              onClick={() => action.route && navigate(action.route)}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", style.iconBg)}>
                  <action.icon className={cn("h-4 w-4", style.iconColor)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{action.title}</p>
                  <p className="text-xs text-slate-500">{action.description}</p>
                </div>
              </div>
              {action.route && (
                <ArrowRight className="h-4 w-4 text-slate-400" />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
