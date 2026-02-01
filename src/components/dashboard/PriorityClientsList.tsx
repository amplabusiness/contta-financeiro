import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  ArrowRight, 
  AlertTriangle,
  TrendingUp,
  Clock,
  DollarSign
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ClientPriority {
  id: string;
  name: string;
  reason: 'valor' | 'risco' | 'atraso' | 'inativo';
  value: number;
  secondaryInfo?: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

interface PriorityClientsListProps {
  clients: ClientPriority[];
  onViewClient: (clientId: string, clientName: string) => void;
}

export function PriorityClientsList({ clients, onViewClient }: PriorityClientsListProps) {
  const navigate = useNavigate();

  // Limitar a 10 clientes
  const displayClients = clients.slice(0, 10);

  const getReasonConfig = (reason: string) => {
    switch (reason) {
      case 'valor':
        return {
          icon: DollarSign,
          label: 'Maior valor',
          color: 'text-emerald-600',
          bg: 'bg-emerald-100'
        };
      case 'risco':
        return {
          icon: AlertTriangle,
          label: 'Risco',
          color: 'text-red-600',
          bg: 'bg-red-100'
        };
      case 'atraso':
        return {
          icon: Clock,
          label: 'Atraso',
          color: 'text-amber-600',
          bg: 'bg-amber-100'
        };
      case 'inativo':
        return {
          icon: Users,
          label: 'Sem mov.',
          color: 'text-slate-600',
          bg: 'bg-slate-100'
        };
      default:
        return {
          icon: TrendingUp,
          label: 'Destaque',
          color: 'text-blue-600',
          bg: 'bg-blue-100'
        };
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return <div className="w-2 h-2 rounded-full bg-red-500" />;
      case 'warning':
        return <div className="w-2 h-2 rounded-full bg-amber-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-emerald-500" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" />
            Clientes Prioritários
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-blue-600 hover:text-blue-700"
            onClick={() => navigate('/clients')}
          >
            Ver todos
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {displayClients.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Nenhum cliente prioritário no momento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayClients.map((client, index) => {
              const reasonConfig = getReasonConfig(client.reason);
              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                  onClick={() => onViewClient(client.id, client.name)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={cn(
                          "text-xs font-medium",
                          client.healthStatus === 'critical' ? 'bg-red-100 text-red-700' :
                          client.healthStatus === 'warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        )}>
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5">
                        {getHealthBadge(client.healthStatus)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
                        {client.name}
                      </p>
                      <div className="flex items-center gap-1">
                        <reasonConfig.icon className={cn("h-3 w-3", reasonConfig.color)} />
                        <span className="text-xs text-slate-500">{reasonConfig.label}</span>
                        {client.secondaryInfo && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs text-slate-500">{client.secondaryInfo}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      client.healthStatus === 'critical' ? 'text-red-600' :
                      client.healthStatus === 'warning' ? 'text-amber-600' :
                      'text-slate-700'
                    )}>
                      {formatCurrency(client.value)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-slate-100"
            onClick={() => navigate('/clients?filter=valor')}
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Maior valor
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-slate-100"
            onClick={() => navigate('/clients?filter=risco')}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Risco
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-slate-100"
            onClick={() => navigate('/clients?filter=atraso')}
          >
            <Clock className="h-3 w-3 mr-1" />
            Atraso
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
