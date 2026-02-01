/**
 * 🎓 CONTTA - ONBOARDING SYSTEM
 * 
 * Sistema de onboarding invisível - Primeiro uso
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Bot,
  CheckCircle2,
  Circle,
  type LucideIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/design-system/components";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  image?: string;
  highlight?: string; // CSS selector to highlight
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface OnboardingFlow {
  id: string;
  name: string;
  steps: OnboardingStep[];
  onComplete?: () => void;
}

interface OnboardingContextValue {
  startFlow: (flow: OnboardingFlow) => void;
  completeFlow: (flowId: string) => void;
  skipFlow: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  currentFlow: OnboardingFlow | null;
  currentStepIndex: number;
  completedFlows: string[];
  hasCompletedFlow: (flowId: string) => boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 ONBOARDING CONTEXT
// ═══════════════════════════════════════════════════════════════

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 ONBOARDING PROVIDER
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'contta_onboarding_completed';

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [currentFlow, setCurrentFlow] = useState<OnboardingFlow | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedFlows, setCompletedFlows] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  // Persist completed flows
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedFlows));
  }, [completedFlows]);

  const startFlow = useCallback((flow: OnboardingFlow) => {
    // Don't start if already completed
    if (completedFlows.includes(flow.id)) return;
    
    setCurrentFlow(flow);
    setCurrentStepIndex(0);
  }, [completedFlows]);

  const completeFlow = useCallback((flowId: string) => {
    if (!completedFlows.includes(flowId)) {
      setCompletedFlows(prev => [...prev, flowId]);
    }
    currentFlow?.onComplete?.();
    setCurrentFlow(null);
    setCurrentStepIndex(0);
  }, [completedFlows, currentFlow]);

  const skipFlow = useCallback(() => {
    if (currentFlow) {
      completeFlow(currentFlow.id);
    }
  }, [currentFlow, completeFlow]);

  const nextStep = useCallback(() => {
    if (!currentFlow) return;
    
    if (currentStepIndex < currentFlow.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      completeFlow(currentFlow.id);
    }
  }, [currentFlow, currentStepIndex, completeFlow]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((index: number) => {
    if (currentFlow && index >= 0 && index < currentFlow.steps.length) {
      setCurrentStepIndex(index);
    }
  }, [currentFlow]);

  const hasCompletedFlow = useCallback((flowId: string) => {
    return completedFlows.includes(flowId);
  }, [completedFlows]);

  return (
    <OnboardingContext.Provider value={{
      startFlow,
      completeFlow,
      skipFlow,
      nextStep,
      prevStep,
      goToStep,
      currentFlow,
      currentStepIndex,
      completedFlows,
      hasCompletedFlow,
    }}>
      {children}
      <OnboardingOverlay />
    </OnboardingContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🎭 ONBOARDING OVERLAY
// ═══════════════════════════════════════════════════════════════

function OnboardingOverlay() {
  const { 
    currentFlow, 
    currentStepIndex, 
    nextStep, 
    prevStep, 
    skipFlow,
    goToStep 
  } = useOnboarding();

  if (!currentFlow) return null;

  const currentStep = currentFlow.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === currentFlow.steps.length - 1;
  const Icon = currentStep.icon || Sparkles;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        >
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-primary-600 to-ai-600 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span className="text-sm font-medium opacity-90">
                  Bem-vindo ao Contta
                </span>
              </div>
              <button
                onClick={skipFlow}
                title="Pular onboarding"
                aria-label="Pular onboarding"
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {currentFlow.steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  title={`Ir para passo ${index + 1}`}
                  aria-label={`Ir para passo ${index + 1}`}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentStepIndex 
                      ? "w-6 bg-white" 
                      : index < currentStepIndex
                        ? "bg-white/80"
                        : "bg-white/30"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Icon */}
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 text-primary-600 mb-6 mx-auto">
                  <Icon className="h-8 w-8" />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-neutral-800 text-center mb-3">
                  {currentStep.title}
                </h2>

                {/* Description */}
                <p className="text-neutral-600 text-center leading-relaxed mb-6">
                  {currentStep.description}
                </p>

                {/* Action button */}
                {currentStep.action && (
                  <Button
                    variant="outline"
                    onClick={currentStep.action.onClick}
                    className="w-full mb-4"
                  >
                    {currentStep.action.label}
                  </Button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-neutral-100 p-4">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={isFirstStep}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Anterior
            </Button>

            <span className="text-sm text-neutral-400">
              {currentStepIndex + 1} de {currentFlow.steps.length}
            </span>

            <Button
              variant="primary"
              onClick={nextStep}
              rightIcon={isLastStep ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            >
              {isLastStep ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📚 PREDEFINED FLOWS
// ═══════════════════════════════════════════════════════════════

export const ONBOARDING_FLOWS = {
  WELCOME: {
    id: 'welcome',
    name: 'Bem-vindo ao Contta',
    steps: [
      {
        id: 'welcome-1',
        title: 'Bem-vindo ao Contta! 🎉',
        description: 'O Contta é sua plataforma financeira com governança por IA. Vamos fazer um tour rápido pelas principais funcionalidades.',
      },
      {
        id: 'welcome-2',
        title: 'Conheça o Dr. Cícero 🤖',
        description: 'O Dr. Cícero é seu contador digital. Ele classifica transações, gera insights e garante conformidade contábil automaticamente.',
      },
      {
        id: 'welcome-3',
        title: 'Navegação Rápida ⌘K',
        description: 'Pressione ⌘K (ou Ctrl+K) a qualquer momento para acessar o comando rápido. Navegue para qualquer lugar ou peça ajuda ao Dr. Cícero.',
      },
      {
        id: 'welcome-4',
        title: 'Pronto para começar!',
        description: 'Agora você está pronto para usar o Contta. Importe seus extratos bancários e deixe a IA fazer o trabalho pesado!',
      },
    ],
  } as OnboardingFlow,

  FIRST_IMPORT: {
    id: 'first-import',
    name: 'Primeira Importação OFX',
    steps: [
      {
        id: 'import-1',
        title: 'Importe seu Extrato 📄',
        description: 'Faça o download do arquivo OFX do seu banco e arraste-o para a área de importação.',
      },
      {
        id: 'import-2',
        title: 'IA em Ação ✨',
        description: 'O Dr. Cícero analisará cada transação e sugerirá classificações automáticas com base no histórico.',
      },
      {
        id: 'import-3',
        title: 'Revise e Aprove ✅',
        description: 'Confira as classificações sugeridas. Você pode aprovar, editar ou pedir explicações ao Dr. Cícero.',
      },
    ],
  } as OnboardingFlow,
};

export default OnboardingProvider;
