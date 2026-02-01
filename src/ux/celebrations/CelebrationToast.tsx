/**
 * 🎊 CONTTA - CELEBRATION TOAST
 * 
 * Toasts especiais para celebrações
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { motion } from "framer-motion";
import { 
  PartyPopper, 
  Sparkles, 
  Trophy, 
  Star,
  Rocket,
  Heart,
  ThumbsUp,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

type CelebrationType = 
  | 'success'
  | 'achievement'
  | 'milestone'
  | 'welcome'
  | 'firstTime'
  | 'streak'
  | 'complete';

interface CelebrationToastProps {
  /** Tipo de celebração */
  type?: CelebrationType;
  /** Título */
  title: string;
  /** Descrição */
  description?: string;
  /** Ícone customizado */
  icon?: LucideIcon;
  /** Duração em ms */
  duration?: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 CELEBRATION PRESETS
// ═══════════════════════════════════════════════════════════════

const celebrationPresets: Record<CelebrationType, {
  icon: LucideIcon;
  emoji: string;
  gradient: string;
}> = {
  success: {
    icon: ThumbsUp,
    emoji: '🎉',
    gradient: 'from-success-500 to-success-600',
  },
  achievement: {
    icon: Trophy,
    emoji: '🏆',
    gradient: 'from-amber-500 to-orange-500',
  },
  milestone: {
    icon: Star,
    emoji: '⭐',
    gradient: 'from-primary-500 to-primary-600',
  },
  welcome: {
    icon: PartyPopper,
    emoji: '👋',
    gradient: 'from-violet-500 to-purple-600',
  },
  firstTime: {
    icon: Rocket,
    emoji: '🚀',
    gradient: 'from-blue-500 to-indigo-600',
  },
  streak: {
    icon: Sparkles,
    emoji: '🔥',
    gradient: 'from-orange-500 to-red-500',
  },
  complete: {
    icon: Heart,
    emoji: '💯',
    gradient: 'from-pink-500 to-rose-500',
  },
};

// ═══════════════════════════════════════════════════════════════
// 🎊 CELEBRATION TOAST COMPONENT
// ═══════════════════════════════════════════════════════════════

export const CelebrationToast: React.FC<CelebrationToastProps> = ({
  type = 'success',
  title,
  description,
  icon: CustomIcon,
}) => {
  const preset = celebrationPresets[type];
  const Icon = CustomIcon || preset.icon;

  return (
    <div className="flex items-start gap-3 p-1">
      {/* Icon with gradient background */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className={cn(
          "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
          "bg-gradient-to-br",
          preset.gradient
        )}
      >
        <Icon className="w-5 h-5 text-white" />
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2"
        >
          <span className="text-lg">{preset.emoji}</span>
          <p className="font-semibold text-neutral-800">{title}</p>
        </motion.div>
        
        {description && (
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-neutral-500 mt-0.5"
          >
            {description}
          </motion.p>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🎯 CELEBRATION TOAST FUNCTION
// ═══════════════════════════════════════════════════════════════

export function celebrationToast(props: CelebrationToastProps) {
  const { duration = 5000, ...rest } = props;
  
  return sonnerToast.custom(
    (id) => (
      <CelebrationToast {...rest} />
    ),
    {
      duration,
      className: "bg-white rounded-xl shadow-xl border border-neutral-100",
    }
  );
}

// Métodos de conveniência
celebrationToast.success = (title: string, description?: string) =>
  celebrationToast({ type: 'success', title, description });

celebrationToast.achievement = (title: string, description?: string) =>
  celebrationToast({ type: 'achievement', title, description });

celebrationToast.milestone = (title: string, description?: string) =>
  celebrationToast({ type: 'milestone', title, description });

celebrationToast.welcome = (title: string, description?: string) =>
  celebrationToast({ type: 'welcome', title, description });

celebrationToast.firstTime = (title: string, description?: string) =>
  celebrationToast({ type: 'firstTime', title, description });

celebrationToast.streak = (title: string, description?: string) =>
  celebrationToast({ type: 'streak', title, description });

celebrationToast.complete = (title: string, description?: string) =>
  celebrationToast({ type: 'complete', title, description });

export default CelebrationToast;
