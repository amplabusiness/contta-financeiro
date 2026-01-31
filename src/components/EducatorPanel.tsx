/**
 * EducatorPanel.tsx
 * 
 * Painel do Agente Educador - explica o "porquê" das decisões contábeis.
 * Transforma erros em oportunidades de aprendizado.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  GraduationCap,
  Lightbulb,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useEducatorExplanation, 
  Explanation, 
  ExplanationContext 
} from '@/hooks/useEducatorExplanation';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface EducatorPanelProps {
  context?: ExplanationContext;
  autoLoad?: boolean;
  variant?: 'card' | 'inline' | 'modal';
  showFeedback?: boolean;
  onClose?: () => void;
  className?: string;
  // Props externas opcionais para quando usado como componente controlado
  loading?: boolean;
  explanation?: Explanation | null;
}

interface QuickTopicProps {
  topic: string;
  label: string;
  icon: React.ReactNode;
  onClick: (topic: string) => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const ImportanceBadge: React.FC<{ importance: string }> = ({ importance }) => {
  const variants = {
    critical: { label: 'Crítico', className: 'bg-red-100 text-red-800 dark:bg-red-900/30' },
    important: { label: 'Importante', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30' },
    informative: { label: 'Informativo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30' }
  };

  const variant = variants[importance as keyof typeof variants] || variants.informative;

  return (
    <Badge variant="outline" className={cn('text-xs', variant.className)}>
      {variant.label}
    </Badge>
  );
};

const QuickTopic: React.FC<QuickTopicProps> = ({ topic, label, icon, onClick }) => (
  <Button
    variant="outline"
    size="sm"
    className="h-auto py-2 px-3 flex-col items-start gap-1 text-left"
    onClick={() => onClick(topic)}
  >
    <div className="flex items-center gap-2 w-full">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
  </Button>
);

const ExplanationContent: React.FC<{ 
  explanation: Explanation;
  showFeedback?: boolean;
}> = ({ explanation, showFeedback }) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = () => {
    const text = `${explanation.title}\n\n${explanation.summary}\n\n${
      explanation.details.map(d => `${d.topic}: ${d.content}`).join('\n\n')
    }`;
    navigator.clipboard.writeText(text);
    toast.success('Explicação copiada!');
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type);
    toast.success(type === 'up' 
      ? 'Obrigado pelo feedback positivo!' 
      : 'Vamos melhorar esta explicação.');
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {explanation.title}
          </h3>
          <Badge variant="secondary" className="mt-1">
            Nível: {explanation.level === 'beginner' ? 'Básico' : 
                    explanation.level === 'intermediate' ? 'Intermediário' : 'Avançado'}
          </Badge>
        </div>
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar explicação</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="p-4 rounded-lg bg-primary/5 border-l-4 border-primary">
        <p className="text-sm leading-relaxed">{explanation.summary}</p>
      </div>

      {/* DETAILS */}
      <Accordion type="single" collapsible className="w-full">
        {explanation.details.map((detail, idx) => (
          <AccordionItem key={idx} value={`detail-${idx}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <span className="text-lg">{detail.icon || '📌'}</span>
                <div>
                  <span className="font-medium">{detail.topic}</span>
                  <ImportanceBadge importance={detail.importance} />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground leading-relaxed pl-9">
                {detail.content}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* EXAMPLES */}
      {explanation.examples && explanation.examples.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Exemplo Prático
            </h4>
            {explanation.examples.map((example, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-muted/50 space-y-3">
                <p className="text-sm font-medium">{example.scenario}</p>
                
                <div className="grid gap-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <span className="text-xs text-muted-foreground">Correto:</span>
                      <p className="text-sm font-mono bg-green-50 dark:bg-green-950/20 px-2 py-1 rounded">
                        {example.correct}
                      </p>
                    </div>
                  </div>
                  
                  {example.incorrect && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div>
                        <span className="text-xs text-muted-foreground">Incorreto:</span>
                        <p className="text-sm font-mono bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded line-through">
                          {example.incorrect}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-start gap-2 pt-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">{example.why}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* RELATED CONCEPTS */}
      {explanation.relatedConcepts && explanation.relatedConcepts.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Conceitos Relacionados
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {explanation.relatedConcepts.map((concept, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{concept.term}</span>
                    {concept.link && (
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {concept.definition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* SOURCES */}
      {explanation.sources && explanation.sources.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            <strong>Fontes:</strong> {explanation.sources.join(', ')}
          </p>
        </div>
      )}

      {/* FEEDBACK */}
      {showFeedback && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Esta explicação foi útil?
            </span>
            <div className="flex gap-2">
              <Button
                variant={feedback === 'up' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFeedback('up')}
              >
                <ThumbsUp className="h-4 w-4 mr-1" />
                Sim
              </Button>
              <Button
                variant={feedback === 'down' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFeedback('down')}
              >
                <ThumbsDown className="h-4 w-4 mr-1" />
                Não
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EducatorPanel: React.FC<EducatorPanelProps> = ({
  context,
  autoLoad = false,
  variant = 'card',
  showFeedback = true,
  onClose,
  className,
  loading: externalLoading,
  explanation: externalExplanation
}) => {
  const {
    loading: internalLoading,
    explanation: internalExplanation,
    error,
    generateExplanation,
    explainBestPractice,
    clearExplanation
  } = useEducatorExplanation();

  // Usar props externas se fornecidas, senão usar o hook interno
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const explanation = externalExplanation !== undefined ? externalExplanation : internalExplanation;

  // Auto-carregar explicação quando contexto muda
  React.useEffect(() => {
    if (autoLoad && context) {
      generateExplanation(context);
    }
  }, [autoLoad, context]);

  const handleQuickTopic = async (topic: string) => {
    await explainBestPractice(topic);
  };

  const handleRefresh = () => {
    if (context) {
      generateExplanation(context);
    }
  };

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
          <Skeleton className="h-20" />
          <Skeleton className="h-32" />
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !explanation) {
    return (
      <Card className={cn("border-amber-200", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-amber-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Não foi possível carregar a explicação
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render based on variant
  if (variant === 'inline' && explanation) {
    return (
      <div className={cn("p-4 rounded-lg border bg-card", className)}>
        <ExplanationContent explanation={explanation} showFeedback={showFeedback} />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Agente Educador
            </CardTitle>
            <CardDescription>
              Aprenda o "porquê" por trás das regras contábeis
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {explanation && (
              <Button variant="ghost" size="sm" onClick={clearExplanation}>
                Limpar
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {explanation ? (
          <ScrollArea className="h-[500px] pr-4">
            <ExplanationContent explanation={explanation} showFeedback={showFeedback} />
          </ScrollArea>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um tópico para aprender ou clique em uma transação para ver a explicação da classificação.
            </p>

            {/* QUICK TOPICS */}
            <div className="grid gap-2 sm:grid-cols-2">
              <QuickTopic
                topic="pix_socio"
                label="Por que PIX de sócio não é receita?"
                icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                onClick={handleQuickTopic}
              />
              <QuickTopic
                topic="transitoria"
                label="Por que transitórias devem zerar?"
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                onClick={handleQuickTopic}
              />
              <QuickTopic
                topic="reclassificacao"
                label="Reclassificação não altera saldo"
                icon={<RefreshCw className="h-4 w-4 text-blue-500" />}
                onClick={handleQuickTopic}
              />
              <QuickTopic
                topic="natureza"
                label="Conta define natureza, não valor"
                icon={<BookOpen className="h-4 w-4 text-purple-500" />}
                onClick={handleQuickTopic}
              />
              <QuickTopic
                topic="split"
                label="Split deve somar exatamente"
                icon={<ArrowRight className="h-4 w-4 text-primary" />}
                onClick={handleQuickTopic}
              />
            </div>

            {/* CONTEXTUAL MESSAGE */}
            {context && (
              <div className="mt-4">
                <Button 
                  className="w-full" 
                  onClick={() => generateExplanation(context)}
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Explicar esta classificação
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EducatorPanel;
