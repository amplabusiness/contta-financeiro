/**
 * ImpactPreviewPanel.tsx
 * 
 * Painel de visualização do impacto contábil ANTES/DEPOIS de uma classificação.
 * Mostra ao usuário as consequências em tempo real, educando sobre o impacto.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

import React, { useEffect, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Banknote,
  PiggyBank,
  Receipt,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useImpactCalculation, ImpactPreview, ClassificationInput } from '@/hooks/useImpactCalculation';
import { X } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ImpactPreviewPanelProps {
  // Modo 1: Passar input e deixar o componente calcular
  classificationInput?: ClassificationInput | null;
  onImpactCalculated?: (preview: ImpactPreview) => void;
  // Modo 2: Passar diretamente os resultados (controlado externamente)
  isCalculating?: boolean;
  impact?: ImpactPreview | null;
  // Comum
  compact?: boolean;
  showEducationalTips?: boolean;
  className?: string;
  onClose?: () => void;
}

interface MetricCardProps {
  label: string;
  before: number;
  after: number;
  icon: React.ReactNode;
  format?: 'currency' | 'number' | 'percentage';
  goodDirection?: 'up' | 'down' | 'zero';
  highlight?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  before,
  after,
  icon,
  format = 'currency',
  goodDirection = 'up',
  highlight = false
}) => {
  const diff = after - before;
  const isPositive = diff > 0;
  const isNegative = diff < 0;
  const isZero = Math.abs(diff) < 0.01;

  const formatter = format === 'currency' ? formatCurrency : 
                    format === 'percentage' ? formatPercentage : formatNumber;

  const isGood = goodDirection === 'up' ? isPositive : 
                 goodDirection === 'down' ? isNegative : isZero;

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all",
      highlight && "ring-2 ring-primary/50",
      isGood && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
      !isGood && !isZero && "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
      isZero && !highlight && "bg-muted/50"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-background/80">
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      
      <div className="flex items-center gap-3">
        {/* ANTES */}
        <div className="flex-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Antes</div>
          <div className="text-lg font-semibold">{formatter(before)}</div>
        </div>

        {/* SETA */}
        <div className="flex flex-col items-center px-2">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          {!isZero && (
            <Badge 
              variant={isGood ? "default" : "secondary"}
              className={cn(
                "mt-1 text-xs",
                isGood && "bg-green-600",
                !isGood && "bg-amber-600"
              )}
            >
              {isPositive ? '+' : ''}{formatter(diff)}
            </Badge>
          )}
        </div>

        {/* DEPOIS */}
        <div className="flex-1 text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Depois</div>
          <div className={cn(
            "text-lg font-semibold flex items-center justify-end gap-1",
            isGood && "text-green-600 dark:text-green-400",
            !isGood && !isZero && "text-amber-600 dark:text-amber-400"
          )}>
            {formatter(after)}
            {isPositive && <ArrowUp className="h-4 w-4" />}
            {isNegative && <ArrowDown className="h-4 w-4" />}
            {isZero && <Minus className="h-4 w-4" />}
          </div>
        </div>
      </div>
    </div>
  );
};

const TransitoriaIndicator: React.FC<{
  label: string;
  before: number;
  after: number;
}> = ({ label, before, after }) => {
  const willZero = Math.abs(after) < 0.01;
  const progress = before !== 0 ? ((before - after) / before) * 100 : (willZero ? 100 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <Badge variant={willZero ? "default" : "secondary"} className={cn(
          willZero && "bg-green-600"
        )}>
          {willZero ? 'Zerará ✓' : formatCurrency(after)}
        </Badge>
      </div>
      <Progress value={Math.min(100, Math.max(0, progress))} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Antes: {formatCurrency(before)}</span>
        <span>Meta: R$ 0,00</span>
      </div>
    </div>
  );
};

const WarningList: React.FC<{
  warnings: ImpactPreview['warnings'];
}> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-2">
      {warnings.map((warning, idx) => (
        <Alert 
          key={idx} 
          variant={warning.type === 'error' ? 'destructive' : 'default'}
          className={cn(
            warning.type === 'warning' && "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
            warning.type === 'info' && "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          )}
        >
          {getIcon(warning.type)}
          <AlertTitle className="ml-2">{warning.message}</AlertTitle>
          {warning.suggestion && (
            <AlertDescription className="ml-6 mt-1 text-sm">
              💡 {warning.suggestion}
            </AlertDescription>
          )}
        </Alert>
      ))}
    </div>
  );
};

const EducationalTip: React.FC<{
  preview: ImpactPreview;
}> = ({ preview }) => {
  const tips = useMemo(() => {
    const result: string[] = [];

    // Tip sobre transitórias
    if (preview.after.transitoria_debitos === 0 && preview.after.transitoria_creditos === 0) {
      result.push(
        "🎯 Excelente! As contas transitórias zerarão após esta classificação. " +
        "Isso significa que todas as transações do período estarão classificadas corretamente."
      );
    } else {
      result.push(
        "⚠️ Ainda existirão saldos nas transitórias. Continue classificando para " +
        "garantir que todas as transações sejam identificadas antes do fechamento."
      );
    }

    // Tip sobre resultado
    const resultDiff = preview.after.summary.resultado_liquido - preview.before.summary.resultado_liquido;
    if (resultDiff > 0) {
      result.push(
        "📈 Esta classificação aumentará o resultado do período. Verifique se a " +
        "conta de receita está correta e se não é um recebimento de sócio ou devolução."
      );
    } else if (resultDiff < 0) {
      result.push(
        "📉 Esta classificação diminuirá o resultado (reconhecendo despesa). " +
        "Confira se a despesa está no centro de custo correto."
      );
    }

    // Tip sobre reclassificação
    if (preview.classification_type === 'reclassification') {
      result.push(
        "🔄 Reclassificação não altera o saldo do banco - apenas corrige a conta " +
        "contábil onde a transação foi classificada. O histórico será preservado."
      );
    }

    // Tip sobre split
    if (preview.classification_type === 'split') {
      result.push(
        "✂️ O split divide uma transação em múltiplas contas. A soma dos valores " +
        "deve ser exatamente igual ao valor original da transação."
      );
    }

    return result;
  }, [preview]);

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4" />
          Dica do Contador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tips.map((tip, idx) => (
          <p key={idx} className="text-sm text-muted-foreground">{tip}</p>
        ))}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ImpactPreviewPanel: React.FC<ImpactPreviewPanelProps> = ({
  classificationInput,
  onImpactCalculated,
  isCalculating: externalIsCalculating,
  impact: externalImpact,
  compact = false,
  showEducationalTips = true,
  className,
  onClose
}) => {
  const {
    loading: internalLoading,
    preview: internalPreview,
    error,
    calculateImpact,
    clearPreview,
    willZeroTransitorias,
    resultVariation
  } = useImpactCalculation();

  // Usar props externas se fornecidas, senão usar o hook interno
  const loading = externalIsCalculating !== undefined ? externalIsCalculating : internalLoading;
  const preview = externalImpact !== undefined ? externalImpact : internalPreview;

  // Calcular impacto quando input mudar (apenas no modo interno)
  useEffect(() => {
    if (externalImpact === undefined && classificationInput) {
      calculateImpact(classificationInput).then(result => {
        if (result) onImpactCalculated?.(result);
      }).catch(() => {
        // Error já está no state
      });
    } else if (!classificationInput && externalImpact === undefined) {
      clearPreview();
    }
  }, [classificationInput, externalImpact]);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("border-destructive", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Erro ao calcular impacto</CardTitle>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // No input state
  if (!preview) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Impacto da Classificação
              </CardTitle>
              <CardDescription>
                Selecione uma conta para ver o impacto contábil
              </CardDescription>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Aguardando seleção de conta...</p>
        </CardContent>
      </Card>
    );
  }

  // Main render
  return (
    <Card className={cn(
      "transition-all",
      willZeroTransitorias && "ring-2 ring-green-500/50",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Impacto da Classificação
            </CardTitle>
            <CardDescription>
              Visualize o efeito desta classificação antes de confirmar
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {willZeroTransitorias && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Transitórias zeradas
              </Badge>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* WARNINGS */}
        <WarningList warnings={preview.warnings} />

        {/* RESUMO FINANCEIRO */}
        {!compact && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <MetricCard
                label="Receita Líquida"
                before={preview.before.summary.receita_liquida}
                after={preview.after.summary.receita_liquida}
                icon={<Banknote className="h-4 w-4 text-green-600" />}
                goodDirection="up"
              />
              <MetricCard
                label="Despesas Totais"
                before={
                  preview.before.summary.despesas_operacionais +
                  preview.before.summary.despesas_administrativas +
                  preview.before.summary.despesas_financeiras
                }
                after={
                  preview.after.summary.despesas_operacionais +
                  preview.after.summary.despesas_administrativas +
                  preview.after.summary.despesas_financeiras
                }
                icon={<Receipt className="h-4 w-4 text-red-600" />}
                goodDirection="down"
              />
            </div>

            <MetricCard
              label="Resultado Líquido"
              before={preview.before.summary.resultado_liquido}
              after={preview.after.summary.resultado_liquido}
              icon={<PiggyBank className="h-4 w-4 text-primary" />}
              goodDirection="up"
              highlight
            />
          </>
        )}

        <Separator />

        {/* TRANSITÓRIAS */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Contas Transitórias
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <TransitoriaIndicator
              label="Transitória Débitos (1.1.9.01)"
              before={preview.before.transitoria_debitos}
              after={preview.after.transitoria_debitos}
            />
            <TransitoriaIndicator
              label="Transitória Créditos (2.1.9.01)"
              before={preview.before.transitoria_creditos}
              after={preview.after.transitoria_creditos}
            />
          </div>
        </div>

        {/* CONTAS AFETADAS */}
        {!compact && preview.affected_accounts.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Contas Afetadas</h4>
              <div className="space-y-2">
                {preview.affected_accounts.map(account => (
                  <div 
                    key={account.account_id}
                    className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                  >
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {account.account_code}
                      </span>
                      <span className="ml-2">{account.account_name}</span>
                    </div>
                    <div className={cn(
                      "font-medium",
                      account.difference > 0 && "text-green-600",
                      account.difference < 0 && "text-red-600"
                    )}>
                      {account.difference > 0 ? '+' : ''}{formatCurrency(account.difference)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TIPS EDUCACIONAIS */}
        {showEducationalTips && !compact && (
          <EducationalTip preview={preview} />
        )}

        {/* VARIAÇÃO RESUMIDA (COMPACT) */}
        {compact && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <span className="text-sm font-medium">Variação no Resultado:</span>
            <div className={cn(
              "flex items-center gap-1 font-semibold",
              resultVariation.absolute > 0 && "text-green-600",
              resultVariation.absolute < 0 && "text-red-600"
            )}>
              {resultVariation.absolute > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : resultVariation.absolute < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              {formatCurrency(resultVariation.absolute)}
              <span className="text-xs text-muted-foreground ml-1">
                ({formatPercentage(resultVariation.percentage)})
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImpactPreviewPanel;
