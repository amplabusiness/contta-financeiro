/**
 * 🏷️ CONTTA DESIGN SYSTEM - BADGE COMPONENT
 * 
 * Badge premium para status e categorias
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 🎨 BADGE VARIANTS
// ═══════════════════════════════════════════════════════════════
const badgeVariants = cva(
  // Base styles
  [
    "inline-flex items-center gap-1",
    "font-medium",
    "rounded-md",
    "transition-colors duration-150",
    "select-none",
  ],
  {
    variants: {
      // ─────────────────────────────────────────────────────────
      // 🎨 VARIANT
      // ─────────────────────────────────────────────────────────
      variant: {
        // Default - Neutro
        default: "bg-neutral-100 text-neutral-700 border border-neutral-200",
        
        // Primary - Azul Contta
        primary: "bg-primary-100 text-primary-700 border border-primary-200",
        
        // Secondary - Alternativo
        secondary: "bg-neutral-200 text-neutral-800",
        
        // Outline - Apenas borda
        outline: "bg-transparent text-neutral-600 border border-neutral-300",
        
        // Success - Positivo
        success: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        
        // Warning - Atenção
        warning: "bg-amber-100 text-amber-700 border border-amber-200",
        
        // Error - Problema
        error: "bg-red-100 text-red-700 border border-red-200",
        
        // Info - Informativo
        info: "bg-blue-100 text-blue-700 border border-blue-200",
        
        // AI - Relacionado à IA
        ai: "bg-violet-100 text-violet-700 border border-violet-200",
        
        // Dot variants (com bolinha de status)
        "dot-success": "bg-white text-neutral-700 border border-neutral-200",
        "dot-warning": "bg-white text-neutral-700 border border-neutral-200",
        "dot-error": "bg-white text-neutral-700 border border-neutral-200",
        "dot-info": "bg-white text-neutral-700 border border-neutral-200",
      },
      
      // ─────────────────────────────────────────────────────────
      // 📏 SIZE
      // ─────────────────────────────────────────────────────────
      size: {
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2 py-0.5 text-xs",
        lg: "px-2.5 py-1 text-sm",
      },
      
      // ─────────────────────────────────────────────────────────
      // 💊 PILL (totalmente arredondado)
      // ─────────────────────────────────────────────────────────
      pill: {
        true: "rounded-full",
        false: "rounded-md",
      },
    },
    
    defaultVariants: {
      variant: "default",
      size: "md",
      pill: false,
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Ícone à esquerda */
  icon?: React.ReactNode;
  /** Mostra dot de status */
  dot?: boolean;
  /** Cor do dot (quando dot=true) */
  dotColor?: "success" | "warning" | "error" | "info" | "neutral";
}

// ═══════════════════════════════════════════════════════════════
// 🔴 DOT COLORS
// ═══════════════════════════════════════════════════════════════
const dotColors = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-neutral-400",
};

// ═══════════════════════════════════════════════════════════════
// 🧩 COMPONENT
// ═══════════════════════════════════════════════════════════════
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      pill,
      icon,
      dot,
      dotColor = "neutral",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, pill, className }))}
        {...props}
      >
        {/* Dot de status */}
        {dot && (
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              dotColors[dotColor]
            )}
          />
        )}
        
        {/* Ícone */}
        {!dot && icon && (
          <span className="shrink-0 -ml-0.5">{icon}</span>
        )}
        
        {/* Content */}
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";

// ═══════════════════════════════════════════════════════════════
// 🎯 STATUS BADGE (atalho para badges de status)
// ═══════════════════════════════════════════════════════════════
export interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "error" | "success";
  label?: string;
  className?: string;
}

const statusConfig = {
  active: { variant: "success" as const, dotColor: "success" as const, defaultLabel: "Ativo" },
  inactive: { variant: "default" as const, dotColor: "neutral" as const, defaultLabel: "Inativo" },
  pending: { variant: "warning" as const, dotColor: "warning" as const, defaultLabel: "Pendente" },
  error: { variant: "error" as const, dotColor: "error" as const, defaultLabel: "Erro" },
  success: { variant: "success" as const, dotColor: "success" as const, defaultLabel: "Sucesso" },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const config = statusConfig[status];
  return (
    <Badge
      variant={config.variant}
      dot
      dotColor={config.dotColor}
      className={className}
    >
      {label || config.defaultLabel}
    </Badge>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════
export { Badge, StatusBadge, badgeVariants };
