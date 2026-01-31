/**
 * EducationBlockingModal.tsx
 * 
 * Modal bloqueante para educação obrigatória.
 * Não pode ser fechado até que o usuário reconheça o conteúdo.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 01/02/2026
 * 
 * RECOMENDAÇÃO SÊNIOR #3: Modal bloqueante para erros críticos
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Clock, 
  CheckCircle2, 
  BookOpen,
  ExternalLink,
  Lock,
  Shield
} from 'lucide-react';
import { 
  useEducationRequired, 
  type PendingEducation,
  formatSeverity,
  formatReadingTime 
} from '@/hooks/useEducationRequired';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

// ============================================================================
// TYPES
// ============================================================================

interface EducationBlockingModalProps {
  requirement: PendingEducation;
  onAcknowledge: (requirementId: string, notes?: string) => Promise<void>;
  onQuizComplete?: (answers: number[]) => void;
}

// ============================================================================
// COMPONENT: EducationBlockingModal
// ============================================================================

export function EducationBlockingModal({
  requirement,
  onAcknowledge,
  onQuizComplete
}: EducationBlockingModalProps) {
  const { getCurrentReadingTime, isLoading } = useEducationRequired();
  
  const [timeSpent, setTimeSpent] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  
  // Configuração de severidade
  const severityConfig = formatSeverity(requirement.severity);
  
  // Verificar se tem quiz
  const hasQuiz = requirement.verification_questions && requirement.verification_questions.length > 0;
  
  // Inicializar respostas do quiz
  useEffect(() => {
    if (hasQuiz) {
      setQuizAnswers(new Array(requirement.verification_questions!.length).fill(null));
    }
  }, [hasQuiz, requirement.verification_questions]);
  
  // Timer para tempo de leitura
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(getCurrentReadingTime());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [getCurrentReadingTime]);
  
  // Calcular progresso
  const readingProgress = Math.min(100, (timeSpent / requirement.min_read_time_seconds) * 100);
  const hasMinReadingTime = timeSpent >= requirement.min_read_time_seconds;
  
  // Verificar se pode submeter
  const canSubmit = 
    hasMinReadingTime && 
    hasScrolledToBottom && 
    acceptedTerms &&
    (!hasQuiz || (quizSubmitted && quizPassed));
  
  // Handler de scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [hasScrolledToBottom]);
  
  // Handler de quiz
  const handleQuizAnswer = useCallback((questionIndex: number, answerIndex: number) => {
    setQuizAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = answerIndex;
      return newAnswers;
    });
  }, []);
  
  // Submeter quiz
  const submitQuiz = useCallback(() => {
    if (!hasQuiz || !requirement.verification_questions) return;
    
    // Verificar respostas
    const allCorrect = requirement.verification_questions.every((q, i) => 
      quizAnswers[i] === q.correct_index
    );
    
    setQuizPassed(allCorrect);
    setQuizSubmitted(true);
    
    if (onQuizComplete) {
      onQuizComplete(quizAnswers.filter((a): a is number => a !== null));
    }
  }, [hasQuiz, requirement.verification_questions, quizAnswers, onQuizComplete]);
  
  // Handler de acknowledge
  const handleAcknowledge = useCallback(async () => {
    await onAcknowledge(requirement.id, userNotes || undefined);
  }, [onAcknowledge, requirement.id, userNotes]);
  
  // Ícone de severidade
  const SeverityIcon = requirement.severity === 'critical' 
    ? AlertTriangle 
    : requirement.severity === 'warning' 
      ? AlertCircle 
      : Info;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className={cn(
          "max-w-3xl max-h-[90vh] overflow-hidden [&>button]:hidden",
          severityConfig.bgColor
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header com Lock */}
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">
              EDUCAÇÃO OBRIGATÓRIA - LEITURA NECESSÁRIA
            </span>
          </div>
          
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              requirement.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
              requirement.severity === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
              'bg-blue-100 dark:bg-blue-900/30'
            )}>
              <SeverityIcon className={cn(
                "h-6 w-6",
                severityConfig.color
              )} />
            </div>
            
            <div className="flex-1">
              <DialogTitle className="text-xl">
                {requirement.error_title}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {requirement.error_description}
              </DialogDescription>
            </div>
            
            <Badge variant={requirement.severity === 'critical' ? 'destructive' : 'secondary'}>
              {severityConfig.label}
            </Badge>
          </div>
        </DialogHeader>
        
        {/* Progress Bar */}
        <div className="px-1 py-2 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Tempo de leitura: {formatReadingTime(timeSpent)}</span>
            </div>
            <span className={cn(
              "font-medium",
              hasMinReadingTime ? "text-green-600" : "text-muted-foreground"
            )}>
              {hasMinReadingTime ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Tempo mínimo atingido
                </span>
              ) : (
                `Mínimo: ${formatReadingTime(requirement.min_read_time_seconds)}`
              )}
            </span>
          </div>
          <Progress value={readingProgress} className="h-2" />
        </div>
        
        {/* Content */}
        <ScrollArea 
          className="h-[300px] px-4 py-2 border rounded-lg"
          onScrollCapture={handleScroll}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>
              {requirement.education_content}
            </ReactMarkdown>
          </div>
          
          {/* References */}
          {requirement.references && requirement.references.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Referências
              </h4>
              <ul className="space-y-1">
                {requirement.references.map((ref, i) => (
                  <li key={i}>
                    <a 
                      href={ref.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {ref.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Scroll indicator */}
          {!hasScrolledToBottom && (
            <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent py-4 text-center">
              <span className="text-sm text-muted-foreground">
                ↓ Role até o final para continuar
              </span>
            </div>
          )}
        </ScrollArea>
        
        {/* Quiz Section */}
        {hasQuiz && !quizSubmitted && hasScrolledToBottom && (
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Verificação de Compreensão
            </h4>
            
            {requirement.verification_questions?.map((q, qIndex) => (
              <div key={qIndex} className="space-y-2">
                <p className="text-sm font-medium">{q.question}</p>
                <div className="space-y-1">
                  {q.options.map((option, oIndex) => (
                    <label 
                      key={oIndex}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                        quizAnswers[qIndex] === oIndex 
                          ? "bg-primary/10 border border-primary" 
                          : "hover:bg-muted"
                      )}
                    >
                      <input
                        type="radio"
                        name={`question-${qIndex}`}
                        checked={quizAnswers[qIndex] === oIndex}
                        onChange={() => handleQuizAnswer(qIndex, oIndex)}
                        className="sr-only"
                      />
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        quizAnswers[qIndex] === oIndex 
                          ? "border-primary bg-primary" 
                          : "border-muted-foreground"
                      )}>
                        {quizAnswers[qIndex] === oIndex && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            
            <Button 
              onClick={submitQuiz}
              disabled={quizAnswers.some(a => a === null)}
              className="w-full"
            >
              Verificar Respostas
            </Button>
          </div>
        )}
        
        {/* Quiz Result */}
        {quizSubmitted && (
          <div className={cn(
            "rounded-lg p-4",
            quizPassed 
              ? "bg-green-50 dark:bg-green-900/20 border border-green-200" 
              : "bg-red-50 dark:bg-red-900/20 border border-red-200"
          )}>
            {quizPassed ? (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Parabéns! Você demonstrou compreensão do conteúdo.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Algumas respostas estão incorretas. Revise o conteúdo e tente novamente.</span>
              </div>
            )}
          </div>
        )}
        
        {/* Notes */}
        {hasScrolledToBottom && (!hasQuiz || quizPassed) && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Anotações (opcional)
            </label>
            <Textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Registre suas dúvidas ou observações..."
              rows={2}
            />
          </div>
        )}
        
        {/* Footer */}
        <DialogFooter className="border-t pt-4">
          <div className="w-full space-y-4">
            {/* Acceptance Checkbox */}
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              acceptedTerms ? "bg-green-50 dark:bg-green-900/10 border-green-200" : "bg-muted"
            )}>
              <Checkbox
                id="accept-terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                disabled={!hasMinReadingTime || !hasScrolledToBottom || (hasQuiz && !quizPassed)}
              />
              <label 
                htmlFor="accept-terms" 
                className={cn(
                  "text-sm cursor-pointer",
                  (!hasMinReadingTime || !hasScrolledToBottom || (hasQuiz && !quizPassed)) 
                    && "opacity-50 cursor-not-allowed"
                )}
              >
                <strong>Declaro que li e compreendi</strong> o conteúdo educacional apresentado 
                e estou ciente das implicações descritas.
              </label>
            </div>
            
            {/* Status Indicators */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={hasMinReadingTime ? "default" : "outline"}>
                {hasMinReadingTime ? "✓" : "○"} Tempo mínimo
              </Badge>
              <Badge variant={hasScrolledToBottom ? "default" : "outline"}>
                {hasScrolledToBottom ? "✓" : "○"} Leitura completa
              </Badge>
              {hasQuiz && (
                <Badge variant={quizPassed ? "default" : "outline"}>
                  {quizPassed ? "✓" : "○"} Quiz aprovado
                </Badge>
              )}
              <Badge variant={acceptedTerms ? "default" : "outline"}>
                {acceptedTerms ? "✓" : "○"} Declaração aceita
              </Badge>
            </div>
            
            {/* Submit Button */}
            <Button
              onClick={handleAcknowledge}
              disabled={!canSubmit || isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                "Registrando..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar Leitura e Continuar
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// COMPONENT: EducationGuard (HOC)
// ============================================================================

interface EducationGuardProps {
  entityType?: string;
  entityId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Higher-Order Component que bloqueia conteúdo até educação ser reconhecida
 */
export function EducationGuard({ 
  entityType, 
  entityId, 
  children,
  fallback 
}: EducationGuardProps) {
  const { 
    pendingRequirements, 
    startReading, 
    acknowledgeRequirement,
    fetchPendingRequirements 
  } = useEducationRequired();
  
  const [currentReq, setCurrentReq] = useState<PendingEducation | null>(null);
  
  // Filtrar requisitos relevantes
  const relevantRequirements = pendingRequirements.filter(r => 
    r.is_blocking &&
    (!entityType || r.entity_type === entityType) &&
    (!entityId || r.entity_id === entityId)
  );
  
  // Mostrar primeiro requisito bloqueante
  useEffect(() => {
    if (relevantRequirements.length > 0 && !currentReq) {
      const req = relevantRequirements[0];
      setCurrentReq(req);
      startReading(req);
    }
  }, [relevantRequirements, currentReq, startReading]);
  
  // Handler de acknowledge
  const handleAcknowledge = useCallback(async (reqId: string, notes?: string) => {
    await acknowledgeRequirement(reqId, undefined, notes);
    setCurrentReq(null);
    await fetchPendingRequirements(entityType, entityId);
  }, [acknowledgeRequirement, fetchPendingRequirements, entityType, entityId]);
  
  // Se tem requisito pendente, mostrar modal
  if (currentReq) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Conteúdo bloqueado</p>
              <p className="text-sm">Complete a educação obrigatória para continuar</p>
            </div>
          </div>
        )}
        <EducationBlockingModal
          requirement={currentReq}
          onAcknowledge={handleAcknowledge}
        />
      </>
    );
  }
  
  return <>{children}</>;
}

export default EducationBlockingModal;
