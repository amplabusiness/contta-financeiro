import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, Clock, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AIErrorFallbackProps {
  errorType: '402' | '429' | 'other';
  errorMessage: string;
  onRetry: () => void;
  retrying: boolean;
  retryCount: number;
  nextRetryIn?: number;
}

export const AIErrorFallback = ({ 
  errorType, 
  errorMessage, 
  onRetry, 
  retrying,
  retryCount,
  nextRetryIn 
}: AIErrorFallbackProps) => {
  const getErrorConfig = () => {
    switch (errorType) {
      case '402':
        return {
          title: '💳 Créditos Insuficientes',
          description: 'Você atingiu o limite de uso da IA. Para continuar usando os agentes inteligentes, adicione créditos à sua conta.',
          icon: CreditCard,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          action: 'Adicionar Créditos',
          showRetry: false,
        };
      case '429':
        return {
          title: '⏱️ Limite de Requisições Atingido',
          description: 'Você está fazendo requisições muito rápido. Aguarde alguns segundos e tente novamente.',
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          action: 'Tentar Novamente',
          showRetry: true,
        };
      default:
        return {
          title: '❌ Erro ao Executar Agente',
          description: errorMessage,
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          action: 'Tentar Novamente',
          showRetry: true,
        };
    }
  };

  const config = getErrorConfig();
  const Icon = config.icon;

  return (
    <Alert variant={errorType === '402' ? 'default' : 'destructive'} className={config.bgColor}>
      <Icon className={`h-4 w-4 ${config.color}`} />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{config.description}</p>
        
        {retryCount > 0 && (
          <p className="text-sm text-muted-foreground">
            Tentativa {retryCount} de 3
          </p>
        )}

        {nextRetryIn && nextRetryIn > 0 && (
          <p className="text-sm font-medium">
            Próxima tentativa em {Math.ceil(nextRetryIn / 1000)}s...
          </p>
        )}

        <div className="flex gap-2 pt-2">
          {config.showRetry && (
            <Button
              onClick={onRetry}
              disabled={retrying}
              size="sm"
              variant={errorType === '429' ? 'secondary' : 'default'}
            >
              {retrying ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                  Tentando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-2" />
                  {config.action}
                </>
              )}
            </Button>
          )}

          {errorType === '402' && (
            <Button
              onClick={() => window.open('https://docs.lovable.dev/features/ai', '_blank')}
              size="sm"
            >
              <CreditCard className="h-3 w-3 mr-2" />
              Saiba Mais
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
