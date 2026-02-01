/**
 * 📊 CONTTA - MILESTONE CARD
 * 
 * Card para marcos importantes e progressos
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  Calendar, 
  CircleDollarSign,
  FileCheck,
  Users,
  BarChart3,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

interface MilestoneCardProps {
  /** Ícone */
  icon?: LucideIcon;
  /** Título do marco */
  title: string;
  /** Valor principal */
  value: string | number;
  /** Sufixo (ex: "clientes", "R$") */
  suffix?: string;
  /** Prefixo (ex: "R$") */
  prefix?: string;
  /** Descrição */
  description?: string;
  /** Comparação (ex: "+15% vs mês anterior") */
  comparison?: string;
  /** Positivo ou negativo */
  trend?: 'up' | 'down' | 'neutral';
  /** Mostrar animação */
  show?: boolean;
  /** Variante */
  variant?: 'primary' | 'success' | 'ai' | 'neutral';
  /** Callback ao fechar */
  onClose?: () => void;
  /** Classe adicional */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 VARIANT STYLES
// ═══════════════════════════════════════════════════════════════

const variantStyles = {
  primary: {
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    accent: 'bg-primary-500',
  },
  success: {
    iconBg: 'bg-success-100',
    iconColor: 'text-success-600',
    accent: 'bg-success-500',
  },
  ai: {
    iconBg: 'bg-ai-100',
    iconColor: 'text-ai-600',
    accent: 'bg-ai-500',
  },
  neutral: {
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
    accent: 'bg-neutral-500',
  },
};

// ═══════════════════════════════════════════════════════════════
// 📊 MILESTONE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  icon: Icon = TrendingUp,
  title,
  value,
  suffix,
  prefix,
  description,
  comparison,
  trend = 'neutral',
  show = true,
  variant = 'primary',
  onClose,
  className,
}) => {
  const styles = variantStyles[variant];

  // Animar número de 0 até o valor
  const [displayValue, setDisplayValue] = React.useState(0);
  const numericValue = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.-]+/g, ''));

  React.useEffect(() => {
    if (show && !isNaN(numericValue)) {
      const duration = 1500;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.floor(numericValue * eased));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(numericValue);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [show, numericValue]);

  const trendColors = {
    up: 'text-success-600',
    down: 'text-danger-600',
    neutral: 'text-neutral-500',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={cn(
            "relative bg-white rounded-xl shadow-lg border border-neutral-100 overflow-hidden",
            "p-6 min-w-[280px]",
            className
          )}
          onClick={onClose}
        >
          {/* Accent bar */}
          <div className={cn("absolute top-0 left-0 right-0 h-1", styles.accent)} />

          <div className="flex items-start gap-4">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
              className={cn(
                "shrink-0 w-12 h-12 rounded-lg flex items-center justify-center",
                styles.iconBg
              )}
            >
              <Icon className={cn("w-6 h-6", styles.iconColor)} />
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm font-medium text-neutral-500 mb-1"
              >
                {title}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-baseline gap-1"
              >
                {prefix && (
                  <span className="text-lg font-semibold text-neutral-600">
                    {prefix}
                  </span>
                )}
                <span className="text-3xl font-bold text-neutral-800 font-mono">
                  {typeof value === 'number' ? displayValue.toLocaleString('pt-BR') : value}
                </span>
                {suffix && (
                  <span className="text-sm font-medium text-neutral-500 ml-1">
                    {suffix}
                  </span>
                )}
              </motion.div>

              {description && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-neutral-500 mt-1"
                >
                  {description}
                </motion.p>
              )}

              {comparison && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className={cn(
                    "flex items-center gap-1 mt-2 text-sm font-medium",
                    trendColors[trend]
                  )}
                >
                  {trend === 'up' && <TrendingUp className="w-4 h-4" />}
                  {trend === 'down' && <TrendingUp className="w-4 h-4 rotate-180" />}
                  <span>{comparison}</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Click hint */}
          {onClose && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xs text-neutral-400 text-center mt-4"
            >
              Clique para fechar
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MilestoneCard;
