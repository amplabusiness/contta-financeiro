/**
 * 📈 CONTTA DESIGN SYSTEM - KPI COMPONENT
 * 
 * KPI Cards para dashboards executivos
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { Tooltip } from "./Tooltip";

// ═══════════════════════════════════════════════════════════════
// 🎨 KPI VARIANTS
// ═══════════════════════════════════════════════════════════════
const kpiVariants = cva(
  // Base styles
  [
    "relative overflow-hidden",
    "rounded-lg bg-white",
    "transition-all duration-150",
  ],
  {
    variants: {
      variant: {
        default: "border border-neutral-200 shadow-sm",
        elevated: "border border-neutral-100 shadow-md",
        accent: "border border-neutral-200 border-l-4 shadow-sm",
        minimal: "bg-neutral-50",
      },
      size: {
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface KPICardProps extends VariantProps<typeof kpiVariants> {
  /** Título do KPI */
  title: string;
  /** Valor principal */
  value: string | number;
  /** Valor anterior (para cálculo de trend) */
  previousValue?: number;
  /** Trend manual (quando não usar previousValue) */
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  /** Se trend positivo é bom (verde) ou ruim (vermelho) */
  trendPositiveIsGood?: boolean;
  /** Subtítulo ou período */
  subtitle?: string;
  /** Ícone do KPI */
  icon?: React.ReactNode;
  /** Cor do accent (quando variant=accent) */
  accentColor?: "primary" | "success" | "warning" | "error" | "info" | "ai";
  /** Tooltip de ajuda */
  tooltip?: string;
  /** Se está carregando */
  loading?: boolean;
  /** Ação de click */
  onClick?: () => void;
  /** Classe adicional */
  className?: string;
  /** Formato do valor (currency, percent, number) */
  format?: "currency" | "percent" | "number" | "custom";
}

// ═══════════════════════════════════════════════════════════════
// 🎨 ACCENT COLORS
// ═══════════════════════════════════════════════════════════════
const accentColors = {
  primary: "border-l-primary-500",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  error: "border-l-red-500",
  info: "border-l-blue-500",
  ai: "border-l-violet-500",
};

const iconBgColors = {
  primary: "bg-primary-100 text-primary-600",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-600",
  error: "bg-red-100 text-red-600",
  info: "bg-blue-100 text-blue-600",
  ai: "bg-violet-100 text-violet-600",
};

// ═══════════════════════════════════════════════════════════════
// 🧩 KPI CARD COMPONENT
// ═══════════════════════════════════════════════════════════════
export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  previousValue,
  trend: manualTrend,
  trendPositiveIsGood = true,
  subtitle,
  icon,
  accentColor = "primary",
  tooltip,
  loading = false,
  onClick,
  className,
  variant,
  size,
  format = "custom",
}) => {
  // Calcula trend automaticamente se previousValue fornecido
  const calculatedTrend = React.useMemo(() => {
    if (manualTrend) return manualTrend;
    if (previousValue === undefined || typeof value !== "number") return null;
    
    const diff = value - previousValue;
    const percentChange = previousValue !== 0 
      ? ((diff / Math.abs(previousValue)) * 100)
      : 0;
    
    return {
      value: Math.abs(percentChange),
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "neutral",
      label: `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(1)}%`,
    } as const;
  }, [value, previousValue, manualTrend]);

  // Determina cor do trend
  const getTrendColor = () => {
    if (!calculatedTrend || calculatedTrend.direction === "neutral") {
      return "text-neutral-500";
    }
    const isPositive = calculatedTrend.direction === "up";
    if (trendPositiveIsGood) {
      return isPositive ? "text-emerald-600" : "text-red-600";
    }
    return isPositive ? "text-red-600" : "text-emerald-600";
  };

  // Trend icon
  const TrendIcon = calculatedTrend?.direction === "up" 
    ? TrendingUp 
    : calculatedTrend?.direction === "down" 
    ? TrendingDown 
    : Minus;

  return (
    <div
      className={cn(
        kpiVariants({ variant, size }),
        variant === "accent" && accentColors[accentColor],
        onClick && "cursor-pointer hover:shadow-md hover:border-neutral-300",
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Icon */}
          {icon && (
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              iconBgColors[accentColor]
            )}>
              {icon}
            </div>
          )}
          
          {/* Title */}
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium text-neutral-600">
              {title}
            </h4>
            {tooltip && (
              <Tooltip content={tooltip}>
                <Info className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 cursor-help" />
              </Tooltip>
            )}
          </div>
        </div>

        {/* Trend Badge */}
        {calculatedTrend && calculatedTrend.direction !== "neutral" && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            getTrendColor()
          )}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{calculatedTrend.label || `${calculatedTrend.value.toFixed(1)}%`}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-1">
        {loading ? (
          <div className="h-8 w-32 bg-neutral-200 animate-pulse rounded" />
        ) : (
          <p className={cn(
            "text-2xl font-bold text-neutral-800",
            "font-mono tabular-nums tracking-tight"
          )}>
            {value}
          </p>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-neutral-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📊 KPI GRID (layout helper)
// ═══════════════════════════════════════════════════════════════
export interface KPIGridProps {
  /** KPI Cards */
  children: React.ReactNode;
  /** Colunas no desktop */
  columns?: 2 | 3 | 4 | 5;
  /** Classe adicional */
  className?: string;
}

const columnClasses = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
};

export const KPIGrid: React.FC<KPIGridProps> = ({
  children,
  columns = 4,
  className,
}) => (
  <div className={cn(
    "grid gap-4",
    columnClasses[columns],
    className
  )}>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 🔢 MINI KPI (versão compacta inline)
// ═══════════════════════════════════════════════════════════════
export interface MiniKPIProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendPositiveIsGood?: boolean;
  className?: string;
}

export const MiniKPI: React.FC<MiniKPIProps> = ({
  label,
  value,
  trend,
  trendPositiveIsGood = true,
  className,
}) => {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  
  const getTrendColor = () => {
    if (!trend || trend === "neutral") return "";
    const isPositive = trend === "up";
    if (trendPositiveIsGood) {
      return isPositive ? "text-emerald-600" : "text-red-600";
    }
    return isPositive ? "text-red-600" : "text-emerald-600";
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-sm text-neutral-500">{label}</span>
      <span className={cn(
        "text-sm font-semibold font-mono tabular-nums",
        getTrendColor() || "text-neutral-800"
      )}>
        {value}
      </span>
      {TrendIcon && (
        <TrendIcon className={cn("h-3.5 w-3.5", getTrendColor())} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════
export { kpiVariants };
