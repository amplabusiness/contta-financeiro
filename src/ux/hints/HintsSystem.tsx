/**
 * 💡 CONTTA - HINTS SYSTEM
 * 
 * Sistema de dicas contextuais - Onboarding Invisível
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { useState, useEffect, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lightbulb, 
  X, 
  ChevronRight,
  Sparkles,
  Bot,
  type LucideIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

export interface Hint {
  id: string;
  title: string;
  message: string;
  icon?: LucideIcon;
  variant?: 'default' | 'ai' | 'success' | 'warning';
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissable?: boolean;
  persistent?: boolean; // Show until dismissed
}

interface HintsContextValue {
  showHint: (hint: Hint) => void;
  dismissHint: (id: string) => void;
  dismissAll: () => void;
  activeHints: Hint[];
  seenHints: string[];
  markAsSeen: (id: string) => void;
  hasSeenHint: (id: string) => boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HINTS CONTEXT
// ═══════════════════════════════════════════════════════════════

const HintsContext = createContext<HintsContextValue | null>(null);

export function useHints() {
  const context = useContext(HintsContext);
  if (!context) {
    throw new Error('useHints must be used within HintsProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 HINTS PROVIDER
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'contta_seen_hints';

export function HintsProvider({ children }: { children: React.ReactNode }) {
  const [activeHints, setActiveHints] = useState<Hint[]>([]);
  const [seenHints, setSeenHints] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  // Persist seen hints
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seenHints));
  }, [seenHints]);

  const showHint = (hint: Hint) => {
    // Don't show if already seen (unless persistent)
    if (!hint.persistent && seenHints.includes(hint.id)) return;
    
    // Don't duplicate
    if (activeHints.find(h => h.id === hint.id)) return;
    
    setActiveHints(prev => [...prev, hint]);
  };

  const dismissHint = (id: string) => {
    setActiveHints(prev => prev.filter(h => h.id !== id));
  };

  const dismissAll = () => {
    setActiveHints([]);
  };

  const markAsSeen = (id: string) => {
    if (!seenHints.includes(id)) {
      setSeenHints(prev => [...prev, id]);
    }
    dismissHint(id);
  };

  const hasSeenHint = (id: string) => seenHints.includes(id);

  return (
    <HintsContext.Provider value={{
      showHint,
      dismissHint,
      dismissAll,
      activeHints,
      seenHints,
      markAsSeen,
      hasSeenHint,
    }}>
      {children}
      <HintsContainer />
    </HintsContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📦 HINTS CONTAINER
// ═══════════════════════════════════════════════════════════════

function HintsContainer() {
  const { activeHints } = useHints();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      <AnimatePresence mode="popLayout">
        {activeHints.map((hint) => (
          <HintCard key={hint.id} hint={hint} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🃏 HINT CARD
// ═══════════════════════════════════════════════════════════════

const variantStyles = {
  default: {
    bg: 'bg-white',
    border: 'border-neutral-200',
    icon: 'bg-primary-100 text-primary-600',
  },
  ai: {
    bg: 'bg-gradient-to-br from-ai-50 to-white',
    border: 'border-ai-200',
    icon: 'bg-ai-100 text-ai-600',
  },
  success: {
    bg: 'bg-gradient-to-br from-success-50 to-white',
    border: 'border-success-200',
    icon: 'bg-success-100 text-success-600',
  },
  warning: {
    bg: 'bg-gradient-to-br from-warning-50 to-white',
    border: 'border-warning-200',
    icon: 'bg-warning-100 text-warning-600',
  },
};

function HintCard({ hint }: { hint: Hint }) {
  const { markAsSeen, dismissHint } = useHints();
  const variant = hint.variant || 'default';
  const styles = variantStyles[variant];
  const Icon = hint.icon || (variant === 'ai' ? Bot : Lightbulb);

  const handleDismiss = () => {
    markAsSeen(hint.id);
  };

  const handleAction = () => {
    hint.action?.onClick();
    markAsSeen(hint.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative rounded-xl shadow-lg border p-4",
        styles.bg,
        styles.border
      )}
    >
      {/* Dismiss button */}
      {hint.dismissable !== false && (
        <button
          onClick={handleDismiss}
          title="Fechar dica"
          aria-label="Fechar dica"
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn(
          "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
          styles.icon
        )}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="font-semibold text-neutral-800 text-sm mb-1">
            {hint.title}
          </h4>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {hint.message}
          </p>

          {/* Action */}
          {hint.action && (
            <button
              onClick={handleAction}
              className="flex items-center gap-1 mt-3 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              {hint.action.label}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* AI indicator */}
      {variant === 'ai' && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1 text-xs text-ai-500">
          <Sparkles className="h-3 w-3" />
          <span>Dr. Cícero</span>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 💡 INLINE HINT
// ═══════════════════════════════════════════════════════════════

interface InlineHintProps {
  id: string;
  children: React.ReactNode;
  variant?: 'default' | 'ai' | 'success' | 'warning';
  className?: string;
}

export function InlineHint({ id, children, variant = 'default', className }: InlineHintProps) {
  const { hasSeenHint, markAsSeen } = useHints();
  const [visible, setVisible] = useState(true);

  if (hasSeenHint(id) || !visible) return null;

  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "rounded-lg border p-3 text-sm",
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Lightbulb className={cn("h-4 w-4 shrink-0 mt-0.5", styles.icon.split(' ')[1])} />
        <div className="flex-1">{children}</div>
        <button
          onClick={() => {
            markAsSeen(id);
            setVisible(false);
          }}
          title="Fechar dica"
          aria-label="Fechar dica"
          className="shrink-0 p-1 rounded hover:bg-neutral-100 text-neutral-400"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🎯 TOOLTIP HINT (para elementos específicos)
// ═══════════════════════════════════════════════════════════════

interface TooltipHintProps {
  id: string;
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function TooltipHint({ id, content, children, side = 'top' }: TooltipHintProps) {
  const { hasSeenHint, markAsSeen } = useHints();
  const [show, setShow] = useState(false);

  if (hasSeenHint(id)) {
    return <>{children}</>;
  }

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "absolute z-50 px-3 py-2 rounded-lg",
              "bg-neutral-800 text-white text-xs max-w-xs",
              "shadow-lg",
              positions[side]
            )}
          >
            {content}
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsSeen(id);
              }}
              className="ml-2 underline text-neutral-300 hover:text-white"
            >
              Entendi
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HintsProvider;
