/**
 * 🔘 CONTTA DESIGN SYSTEM - BUTTON COMPONENT
 * 
 * Botão premium com variantes consistentes
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 🎨 BUTTON VARIANTS
// ═══════════════════════════════════════════════════════════════
const buttonVariants = cva(
  // Base styles - todos os botões
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium text-sm",
    "rounded-md",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    "select-none",
  ],
  {
    variants: {
      // ─────────────────────────────────────────────────────────
      // 🎨 VARIANT (estilo visual)
      // ─────────────────────────────────────────────────────────
      variant: {
        // Primary - Ação principal (azul Contta)
        primary: [
          "bg-primary-500 text-white",
          "hover:bg-primary-600",
          "focus-visible:ring-primary-500/30",
          "shadow-sm hover:shadow",
        ],
        
        // Secondary - Ação secundária
        secondary: [
          "bg-neutral-100 text-neutral-700",
          "hover:bg-neutral-200",
          "focus-visible:ring-neutral-400/30",
          "border border-neutral-200",
        ],
        
        // Outline - Bordas apenas
        outline: [
          "border border-neutral-300 bg-transparent text-neutral-700",
          "hover:bg-neutral-50 hover:border-neutral-400",
          "focus-visible:ring-neutral-400/30",
        ],
        
        // Ghost - Sem background
        ghost: [
          "bg-transparent text-neutral-600",
          "hover:bg-neutral-100 hover:text-neutral-800",
          "focus-visible:ring-neutral-400/30",
        ],
        
        // Destructive - Ações perigosas
        destructive: [
          "bg-red-600 text-white",
          "hover:bg-red-700",
          "focus-visible:ring-red-500/30",
        ],
        
        // Success - Confirmações
        success: [
          "bg-emerald-600 text-white",
          "hover:bg-emerald-700",
          "focus-visible:ring-emerald-500/30",
        ],
        
        // AI - Ações relacionadas à IA
        ai: [
          "bg-gradient-to-r from-violet-500 to-purple-600 text-white",
          "hover:from-violet-600 hover:to-purple-700",
          "focus-visible:ring-violet-500/30",
          "shadow-sm hover:shadow",
        ],
        
        // Link - Parece um link
        link: [
          "bg-transparent text-primary-600 underline-offset-4",
          "hover:underline hover:text-primary-700",
          "p-0 h-auto",
        ],
      },
      
      // ─────────────────────────────────────────────────────────
      // 📏 SIZE (tamanho)
      // ─────────────────────────────────────────────────────────
      size: {
        xs: "h-7 px-2 text-xs rounded",
        sm: "h-8 px-3 text-sm",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-base",
        xl: "h-12 px-6 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
        "icon-lg": "h-10 w-10 p-0",
      },
      
      // ─────────────────────────────────────────────────────────
      // 📐 WIDTH
      // ─────────────────────────────────────────────────────────
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza como filho (Slot) */
  asChild?: boolean;
  /** Estado de carregamento */
  loading?: boolean;
  /** Ícone à esquerda */
  leftIcon?: React.ReactNode;
  /** Ícone à direita */
  rightIcon?: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════
// 🧩 COMPONENT
// ═══════════════════════════════════════════════════════════════
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        
        {/* Left icon */}
        {!loading && leftIcon && (
          <span className="shrink-0">{leftIcon}</span>
        )}
        
        {/* Content */}
        {children}
        
        {/* Right icon */}
        {rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════
export { Button, buttonVariants };
