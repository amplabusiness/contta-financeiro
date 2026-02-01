/**
 * ✅ CONTTA - SUCCESS ANIMATION
 * 
 * Animação de sucesso para confirmações
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

interface SuccessAnimationProps {
  /** Mostrar animação */
  show?: boolean;
  /** Variante da animação */
  variant?: 'checkmark' | 'circle' | 'pulse' | 'bounce';
  /** Tamanho */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Mensagem opcional */
  message?: string;
  /** Submensagem */
  submessage?: string;
  /** Callback quando terminar */
  onComplete?: () => void;
  /** Classe adicional */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 SIZE CONFIG
// ═══════════════════════════════════════════════════════════════

const sizeConfig = {
  sm: { icon: 24, container: 48 },
  md: { icon: 32, container: 64 },
  lg: { icon: 48, container: 96 },
  xl: { icon: 64, container: 128 },
};

// ═══════════════════════════════════════════════════════════════
// ✅ SUCCESS ANIMATION COMPONENT
// ═══════════════════════════════════════════════════════════════

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  show = true,
  variant = 'circle',
  size = 'lg',
  message,
  submessage,
  onComplete,
  className,
}) => {
  const { icon: iconSize, container: containerSize } = sizeConfig[size];

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex flex-col items-center justify-center gap-4",
            className
          )}
        >
          {/* Icon Container */}
          {variant === 'checkmark' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 20,
                delay: 0.1 
              }}
              className="rounded-full bg-success-100 flex items-center justify-center"
              style={{ width: containerSize, height: containerSize }}
            >
              <motion.div
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Check 
                  size={iconSize} 
                  className="text-success-600 stroke-[3]" 
                />
              </motion.div>
            </motion.div>
          )}

          {variant === 'circle' && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 200, 
                damping: 15,
              }}
              className="rounded-full bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center shadow-lg"
              style={{ width: containerSize, height: containerSize }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.2 }}
              >
                <CheckCircle2 
                  size={iconSize} 
                  className="text-white" 
                />
              </motion.div>
            </motion.div>
          )}

          {variant === 'pulse' && (
            <div className="relative" style={{ width: containerSize, height: containerSize }}>
              {/* Pulse rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.3,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                  className="absolute inset-0 rounded-full bg-success-500"
                />
              ))}
              
              {/* Center icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="absolute inset-0 rounded-full bg-success-500 flex items-center justify-center"
              >
                <Check size={iconSize} className="text-white stroke-[3]" />
              </motion.div>
            </div>
          )}

          {variant === 'bounce' && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 20,
              }}
              className="rounded-full bg-success-500 flex items-center justify-center shadow-xl"
              style={{ width: containerSize, height: containerSize }}
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Check size={iconSize} className="text-white stroke-[3]" />
              </motion.div>
            </motion.div>
          )}

          {/* Message */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <p className="text-lg font-semibold text-neutral-800">{message}</p>
              {submessage && (
                <p className="text-sm text-neutral-500 mt-1">{submessage}</p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessAnimation;
