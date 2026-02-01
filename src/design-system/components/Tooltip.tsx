/**
 * 💬 CONTTA DESIGN SYSTEM - TOOLTIP COMPONENT
 * 
 * Tooltip premium para dicas contextuais
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 🎯 PROVIDER (deve envolver a app)
// ═══════════════════════════════════════════════════════════════
const TooltipProvider = TooltipPrimitive.Provider;

// ═══════════════════════════════════════════════════════════════
// 🧩 COMPONENTS
// ═══════════════════════════════════════════════════════════════
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipPortal = TooltipPrimitive.Portal;

// Content
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      // Base
      "z-50 overflow-hidden",
      "rounded-md px-3 py-1.5",
      // Colors
      "bg-neutral-800 text-white",
      // Typography
      "text-xs font-medium",
      // Shadow
      "shadow-lg",
      // Animation
      "animate-in fade-in-0 zoom-in-95",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      "data-[side=bottom]:slide-in-from-top-2",
      "data-[side=left]:slide-in-from-right-2",
      "data-[side=right]:slide-in-from-left-2",
      "data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// ═══════════════════════════════════════════════════════════════
// 🎯 SIMPLE TOOLTIP (uso rápido)
// ═══════════════════════════════════════════════════════════════
export interface SimpleTooltipProps {
  /** Conteúdo do tooltip */
  content: React.ReactNode;
  /** Elemento que ativa o tooltip */
  children: React.ReactNode;
  /** Lado preferencial */
  side?: "top" | "right" | "bottom" | "left";
  /** Alinhamento */
  align?: "start" | "center" | "end";
  /** Delay para abrir (ms) */
  delayDuration?: number;
  /** Classe adicional no content */
  className?: string;
  /** Desabilitado */
  disabled?: boolean;
}

const Tooltip: React.FC<SimpleTooltipProps> = ({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 200,
  className,
  disabled = false,
}) => {
  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side={side} align={align} className={className}>
          {content}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🔮 INFO TOOLTIP (com ícone de info)
// ═══════════════════════════════════════════════════════════════
import { Info } from "lucide-react";

export interface InfoTooltipProps {
  /** Conteúdo do tooltip */
  content: React.ReactNode;
  /** Tamanho do ícone */
  size?: "sm" | "md";
  /** Classe adicional */
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  size = "sm",
  className,
}) => {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Tooltip content={content}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center",
          "text-neutral-400 hover:text-neutral-600",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/20 rounded",
          className
        )}
      >
        <Info className={iconSize} />
        <span className="sr-only">Mais informações</span>
      </button>
    </Tooltip>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════
export {
  Tooltip,
  InfoTooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipPortal,
};
