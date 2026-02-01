/**
 * 🏆 CONTTA - ACHIEVEMENT BADGE
 * 
 * Badge de conquista para gamificação sutil
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, 
  Star, 
  Zap, 
  Target, 
  Award,
  Crown,
  Sparkles,
  Flame,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

type BadgeType = 
  | 'firstTransaction' 
  | 'weekStreak' 
  | 'monthClosed'
  | 'perfectReconciliation'
  | 'speedDemon'
  | 'aiMaster'
  | 'dataWizard'
  | 'custom';

interface AchievementBadgeProps {
  /** Tipo do badge (presets) */
  type?: BadgeType;
  /** Ícone customizado */
  icon?: LucideIcon;
  /** Título do badge */
  title: string;
  /** Descrição */
  description?: string;
  /** Mostrar animação */
  show?: boolean;
  /** Variante de cor */
  variant?: 'gold' | 'silver' | 'bronze' | 'diamond' | 'ai';
  /** Callback ao fechar */
  onClose?: () => void;
  /** Classe adicional */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 BADGE PRESETS
// ═══════════════════════════════════════════════════════════════

const badgePresets: Record<BadgeType, { icon: LucideIcon; variant: AchievementBadgeProps['variant'] }> = {
  firstTransaction: { icon: Star, variant: 'gold' },
  weekStreak: { icon: Flame, variant: 'bronze' },
  monthClosed: { icon: Trophy, variant: 'gold' },
  perfectReconciliation: { icon: Target, variant: 'diamond' },
  speedDemon: { icon: Zap, variant: 'silver' },
  aiMaster: { icon: Sparkles, variant: 'ai' },
  dataWizard: { icon: Crown, variant: 'diamond' },
  custom: { icon: Award, variant: 'gold' },
};

// ═══════════════════════════════════════════════════════════════
// 🎨 VARIANT STYLES
// ═══════════════════════════════════════════════════════════════

const variantStyles = {
  gold: {
    bg: 'bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500',
    ring: 'ring-amber-300',
    text: 'text-amber-900',
    glow: 'shadow-amber-500/50',
  },
  silver: {
    bg: 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500',
    ring: 'ring-slate-200',
    text: 'text-slate-800',
    glow: 'shadow-slate-400/50',
  },
  bronze: {
    bg: 'bg-gradient-to-br from-orange-400 via-orange-600 to-amber-700',
    ring: 'ring-orange-300',
    text: 'text-orange-900',
    glow: 'shadow-orange-500/50',
  },
  diamond: {
    bg: 'bg-gradient-to-br from-cyan-300 via-blue-400 to-indigo-500',
    ring: 'ring-cyan-200',
    text: 'text-blue-900',
    glow: 'shadow-blue-400/50',
  },
  ai: {
    bg: 'bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-500',
    ring: 'ring-violet-300',
    text: 'text-violet-900',
    glow: 'shadow-violet-500/50',
  },
};

// ═══════════════════════════════════════════════════════════════
// 🏆 ACHIEVEMENT BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  type = 'custom',
  icon: CustomIcon,
  title,
  description,
  show = true,
  variant: customVariant,
  onClose,
  className,
}) => {
  const preset = badgePresets[type];
  const Icon = CustomIcon || preset.icon;
  const variant = customVariant || preset.variant || 'gold';
  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -50 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 25 
          }}
          className={cn(
            "fixed bottom-8 right-8 z-50",
            "bg-white rounded-2xl shadow-2xl",
            "p-6 max-w-sm",
            "border border-neutral-100",
            className
          )}
          onClick={onClose}
        >
          <div className="flex items-start gap-4">
            {/* Badge Icon */}
            <motion.div
              initial={{ rotate: -30, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              className={cn(
                "shrink-0 w-16 h-16 rounded-xl flex items-center justify-center",
                "ring-4 shadow-lg",
                styles.bg,
                styles.ring,
                styles.glow
              )}
            >
              <Icon className="w-8 h-8 text-white drop-shadow-lg" />
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <motion.p
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xs font-medium text-ai-500 uppercase tracking-wider mb-1"
              >
                🎉 Conquista Desbloqueada
              </motion.p>
              <motion.h3
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg font-bold text-neutral-800"
              >
                {title}
              </motion.h3>
              {description && (
                <motion.p
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-neutral-500 mt-1"
                >
                  {description}
                </motion.p>
              )}
            </div>
          </div>

          {/* Sparkles effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="absolute -top-2 -right-2"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-6 h-6 text-amber-400" />
            </motion.div>
          </motion.div>

          {/* Click hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xs text-neutral-400 text-center mt-4"
          >
            Clique para fechar
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AchievementBadge;
