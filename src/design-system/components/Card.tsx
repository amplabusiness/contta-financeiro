/**
 * 🃏 CONTTA DESIGN SYSTEM - CARD COMPONENT
 * 
 * Card premium com hierarquia visual clara
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 🎨 CARD VARIANTS
// ═══════════════════════════════════════════════════════════════
const cardVariants = cva(
  // Base styles
  [
    "rounded-lg bg-white",
    "transition-all duration-150 ease-out",
  ],
  {
    variants: {
      // ─────────────────────────────────────────────────────────
      // 🎨 VARIANT
      // ─────────────────────────────────────────────────────────
      variant: {
        // Default - Card padrão
        default: [
          "border border-neutral-200",
          "shadow-sm",
        ],
        
        // Elevated - Mais destaque
        elevated: [
          "border border-neutral-100",
          "shadow-md",
        ],
        
        // Outline - Apenas borda
        outline: [
          "border border-neutral-200",
        ],
        
        // Ghost - Sem borda/sombra
        ghost: [
          "bg-neutral-50",
        ],
        
        // Interactive - Clicável
        interactive: [
          "border border-neutral-200",
          "shadow-sm",
          "cursor-pointer",
          "hover:border-primary-300 hover:shadow-md",
          "active:scale-[0.99]",
        ],
        
        // Accent - Com borda colorida à esquerda
        accent: [
          "border border-neutral-200 border-l-4 border-l-primary-500",
          "shadow-sm",
        ],
        
        // AI - Para conteúdo de IA
        ai: [
          "border border-violet-200 border-l-4 border-l-violet-500",
          "bg-gradient-to-br from-white to-violet-50/30",
          "shadow-sm",
        ],
        
        // Success - Status positivo
        success: [
          "border border-emerald-200 border-l-4 border-l-emerald-500",
          "bg-gradient-to-br from-white to-emerald-50/30",
        ],
        
        // Warning - Atenção
        warning: [
          "border border-amber-200 border-l-4 border-l-amber-500",
          "bg-gradient-to-br from-white to-amber-50/30",
        ],
        
        // Error - Problema
        error: [
          "border border-red-200 border-l-4 border-l-red-500",
          "bg-gradient-to-br from-white to-red-50/30",
        ],
      },
      
      // ─────────────────────────────────────────────────────────
      // 📏 PADDING
      // ─────────────────────────────────────────────────────────
      padding: {
        none: "p-0",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
        xl: "p-8",
      },
    },
    
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ação no header (botão, menu, etc) */
  action?: React.ReactNode;
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Tamanho do título */
  size?: "sm" | "md" | "lg";
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

// ═══════════════════════════════════════════════════════════════
// 🧩 COMPONENTS
// ═══════════════════════════════════════════════════════════════

// Card Root
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

// Card Header
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-start justify-between gap-4",
        "pb-3 border-b border-neutral-100",
        className
      )}
      {...props}
    >
      <div className="flex-1 space-y-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

// Card Title
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "text-sm font-medium",
      md: "text-base font-semibold",
      lg: "text-lg font-semibold",
    };
    
    return (
      <h3
        ref={ref}
        className={cn(
          "text-neutral-800 tracking-tight",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
CardTitle.displayName = "CardTitle";

// Card Description
const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-neutral-500", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

// Card Content
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("pt-4", className)}
      {...props}
    />
  )
);
CardContent.displayName = "CardContent";

// Card Footer
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 pt-4 mt-4",
        "border-t border-neutral-100",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
