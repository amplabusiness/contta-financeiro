/**
 * 🎊 CONTTA - CONFETTI CELEBRATION
 * 
 * Animação de confetti para celebrações especiais
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  velocity: { x: number; y: number };
  rotationVelocity: number;
}

interface ConfettiProps {
  /** Mostrar confetti */
  show?: boolean;
  /** Número de peças */
  count?: number;
  /** Duração em ms */
  duration?: number;
  /** Cores do confetti (Contta palette por padrão) */
  colors?: string[];
  /** Callback quando terminar */
  onComplete?: () => void;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 DEFAULT COLORS (Contta Palette)
// ═══════════════════════════════════════════════════════════════

const defaultColors = [
  '#0a8fc5', // primary-500 (Contta blue)
  '#0773a0', // primary-600
  '#a855f7', // ai (violet)
  '#22c55e', // success
  '#f59e0b', // warning (gold)
  '#3b82f6', // blue
];

// ═══════════════════════════════════════════════════════════════
// 🎊 CONFETTI COMPONENT
// ═══════════════════════════════════════════════════════════════

export const Confetti: React.FC<ConfettiProps> = ({
  show = false,
  count = 150,
  duration = 4000,
  colors = defaultColors,
  onComplete,
}) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  // Gerar peças de confetti
  const generatePieces = useCallback(() => {
    const newPieces: ConfettiPiece[] = [];
    const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
    
    for (let i = 0; i < count; i++) {
      newPieces.push({
        id: i,
        x: centerX + (Math.random() - 0.5) * 200,
        y: -20 - Math.random() * 100,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 8,
        velocity: {
          x: (Math.random() - 0.5) * 15,
          y: 3 + Math.random() * 5,
        },
        rotationVelocity: (Math.random() - 0.5) * 20,
      });
    }
    return newPieces;
  }, [count, colors]);

  // Animar confetti
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    
    if (elapsed < duration) {
      setPieces(prev => prev.map(piece => ({
        ...piece,
        x: piece.x + piece.velocity.x,
        y: piece.y + piece.velocity.y,
        rotation: piece.rotation + piece.rotationVelocity,
        velocity: {
          x: piece.velocity.x * 0.99,
          y: piece.velocity.y + 0.1, // gravidade
        },
      })));
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setPieces([]);
      onComplete?.();
    }
  }, [duration, onComplete]);

  // Iniciar/parar animação
  useEffect(() => {
    if (show) {
      setPieces(generatePieces());
      startTimeRef.current = undefined;
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setPieces([]);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [show, generatePieces, animate]);

  if (!show && pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <AnimatePresence>
        {pieces.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              left: piece.x,
              top: piece.y,
              width: piece.size,
              height: piece.size * 0.6,
              backgroundColor: piece.color,
              transform: `rotate(${piece.rotation}deg)`,
              borderRadius: '2px',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🪝 USE CONFETTI HOOK
// ═══════════════════════════════════════════════════════════════

interface UseConfettiReturn {
  showConfetti: boolean;
  triggerConfetti: (options?: { duration?: number }) => void;
  ConfettiComponent: React.FC;
}

export function useConfetti(): UseConfettiReturn {
  const [showConfetti, setShowConfetti] = useState(false);
  const [duration, setDuration] = useState(4000);

  const triggerConfetti = useCallback((options?: { duration?: number }) => {
    if (options?.duration) {
      setDuration(options.duration);
    }
    setShowConfetti(true);
  }, []);

  const handleComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  const ConfettiComponent = useCallback(() => (
    <Confetti 
      show={showConfetti} 
      duration={duration}
      onComplete={handleComplete} 
    />
  ), [showConfetti, duration, handleComplete]);

  return {
    showConfetti,
    triggerConfetti,
    ConfettiComponent,
  };
}

export default Confetti;
