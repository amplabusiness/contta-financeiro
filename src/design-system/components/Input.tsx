/**
 * 📝 CONTTA DESIGN SYSTEM - INPUT COMPONENT
 * 
 * Input premium para formulários
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// 🎨 INPUT VARIANTS
// ═══════════════════════════════════════════════════════════════
const inputVariants = cva(
  // Base styles
  [
    "flex w-full",
    "rounded-md border bg-white",
    "text-sm text-neutral-800 placeholder:text-neutral-400",
    "transition-all duration-150",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "focus-visible:outline-none",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50",
  ],
  {
    variants: {
      // ─────────────────────────────────────────────────────────
      // 🎨 VARIANT
      // ─────────────────────────────────────────────────────────
      variant: {
        default: [
          "border-neutral-300",
          "hover:border-neutral-400",
          "focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:border-primary-500",
        ],
        error: [
          "border-red-500",
          "focus-visible:ring-2 focus-visible:ring-red-500/20 focus-visible:border-red-500",
        ],
        success: [
          "border-emerald-500",
          "focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500",
        ],
      },
      
      // ─────────────────────────────────────────────────────────
      // 📏 SIZE
      // ─────────────────────────────────────────────────────────
      inputSize: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-9 px-3 text-sm",
        lg: "h-10 px-4 text-base",
      },
    },
    
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Ícone à esquerda */
  leftIcon?: React.ReactNode;
  /** Ícone à direita */
  rightIcon?: React.ReactNode;
  /** Mostrar indicador de erro */
  error?: boolean;
  /** Mostrar indicador de sucesso */
  success?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🧩 INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      inputSize,
      leftIcon,
      rightIcon,
      error,
      success,
      ...props
    },
    ref
  ) => {
    // Determina variant baseado em error/success
    const computedVariant = error ? "error" : success ? "success" : variant;
    
    // Determina ícone à direita
    const computedRightIcon = error ? (
      <AlertCircle className="h-4 w-4 text-red-500" />
    ) : success ? (
      <Check className="h-4 w-4 text-emerald-500" />
    ) : (
      rightIcon
    );

    const hasLeftIcon = !!leftIcon;
    const hasRightIcon = !!computedRightIcon;

    return (
      <div className="relative w-full">
        {/* Left Icon */}
        {hasLeftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            {leftIcon}
          </div>
        )}

        {/* Input */}
        <input
          type={type}
          className={cn(
            inputVariants({ variant: computedVariant, inputSize }),
            hasLeftIcon && "pl-9",
            hasRightIcon && "pr-9",
            className
          )}
          ref={ref}
          {...props}
        />

        {/* Right Icon */}
        {hasRightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {computedRightIcon}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// ═══════════════════════════════════════════════════════════════
// 🔐 PASSWORD INPUT (com toggle de visibilidade)
// ═══════════════════════════════════════════════════════════════
export interface PasswordInputProps extends Omit<InputProps, "type" | "rightIcon"> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative w-full">
        <Input
          type={showPassword ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2",
            "text-neutral-400 hover:text-neutral-600",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 rounded"
          )}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          <span className="sr-only">
            {showPassword ? "Ocultar senha" : "Mostrar senha"}
          </span>
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

// ═══════════════════════════════════════════════════════════════
// 🏷️ FORM FIELD (Label + Input + Helper)
// ═══════════════════════════════════════════════════════════════
export interface FormFieldProps {
  /** Label do campo */
  label: string;
  /** ID do input */
  id?: string;
  /** Se é obrigatório */
  required?: boolean;
  /** Mensagem de erro */
  error?: string;
  /** Texto de ajuda */
  helper?: string;
  /** Componente de input */
  children: React.ReactNode;
  /** Classe adicional */
  className?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  id,
  required,
  error,
  helper,
  children,
  className,
}) => {
  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-sm font-medium text-neutral-700"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Input */}
      {children}

      {/* Error or Helper text */}
      {error ? (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-neutral-500">{helper}</p>
      ) : null}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════
export { Input, PasswordInput, FormField, inputVariants };
