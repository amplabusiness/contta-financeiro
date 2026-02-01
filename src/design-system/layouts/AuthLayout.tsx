/**
 * 🔐 CONTTA DESIGN SYSTEM - AUTH LAYOUT
 * 
 * Layout premium para páginas de autenticação
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface AuthLayoutProps {
  children: React.ReactNode;
  /** Título da página */
  title?: string;
  /** Subtítulo */
  subtitle?: string;
  /** Mostrar painel lateral de features */
  showFeatures?: boolean;
  /** Features customizadas */
  features?: AuthFeature[];
  /** Classe adicional */
  className?: string;
}

export interface AuthFeature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 DEFAULT FEATURES
// ═══════════════════════════════════════════════════════════════
const defaultFeatures: AuthFeature[] = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Conciliação Inteligente",
    description: "IA classifica transações com justificativa técnica",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "DRE em Tempo Real",
    description: "Relatórios contábeis sempre atualizados",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "Segurança Total",
    description: "Dados isolados por tenant, trilha de auditoria",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "IA Supervisionada",
    description: "Dr. Cícero: contador digital que aprende e explica",
  },
];

// ═══════════════════════════════════════════════════════════════
// 🔐 AUTH LAYOUT
// ═══════════════════════════════════════════════════════════════
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  showFeatures = true,
  features = defaultFeatures,
  className,
}) => {
  return (
    <div className={cn(
      "min-h-screen bg-neutral-50 flex",
      className
    )}>
      {/* Left side - Features */}
      {showFeatures && (
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
            {/* Logo - Maestro UX: h-14 destaque em painel lateral */}
            <div>
              <Link to="/" className="inline-block">
                <img 
                  src="/logo-contta.png" 
                  alt="Contta" 
                  className="h-14 w-auto brightness-0 invert"
                />
              </Link>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col justify-center max-w-lg">
              <h1 className="text-3xl xl:text-4xl font-bold mb-4 leading-tight">
                Plataforma Financeira com
                <span className="block text-primary-200">Governança por IA</span>
              </h1>
              <p className="text-lg text-primary-100 mb-10 leading-relaxed">
                Automatize processos, mantenha conformidade contábil e tome decisões com números confiáveis.
              </p>

              {/* Features */}
              <div className="space-y-5">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-primary-200">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-0.5">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-primary-200">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="text-sm text-primary-300">
              © 2026 Contta - Inteligência Fiscal. Todos os direitos reservados.
            </div>
          </div>
        </div>
      )}

      {/* Right side - Form */}
      <div className={cn(
        "flex-1 flex flex-col",
        showFeatures ? "lg:w-1/2 xl:w-[45%]" : "w-full"
      )}>
        {/* Mobile logo - Maestro UX: Fundo azul para contraste + h-12 destaque */}
        <div className="lg:hidden p-6 border-b border-primary-700 bg-gradient-to-r from-primary-600 to-primary-700">
          <Link to="/" className="inline-block">
            <img 
              src="/logo-contta.png" 
              alt="Contta" 
              className="h-12 w-auto brightness-0 invert"
            />
          </Link>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">
            {/* Header */}
            {(title || subtitle) && (
              <div className="mb-8 text-center lg:text-left">
                {title && (
                  <h2 className="text-2xl font-bold text-neutral-800 mb-2">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-neutral-500">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Form content */}
            {children}
          </div>
        </div>

        {/* Footer links */}
        <div className="p-6 border-t border-neutral-100 text-center text-sm text-neutral-500">
          <span>Precisa de ajuda? </span>
          <a href="mailto:suporte@contta.com.br" className="text-primary-600 hover:underline">
            suporte@contta.com.br
          </a>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🃏 AUTH CARD (wrapper para formulários)
// ═══════════════════════════════════════════════════════════════
export interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn(
      "bg-white rounded-xl border border-neutral-200 shadow-sm p-6 sm:p-8",
      className
    )}>
      {children}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🔗 AUTH LINK (para links de navegação)
// ═══════════════════════════════════════════════════════════════
export interface AuthLinkProps {
  children: React.ReactNode;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export const AuthLink: React.FC<AuthLinkProps> = ({
  children,
  to,
  onClick,
  className,
}) => {
  const linkClass = cn(
    "text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors",
    className
  );

  if (to) {
    return (
      <Link to={to} className={linkClass}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={linkClass}>
      {children}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// ➗ AUTH DIVIDER
// ═══════════════════════════════════════════════════════════════
export interface AuthDividerProps {
  text?: string;
  className?: string;
}

export const AuthDivider: React.FC<AuthDividerProps> = ({
  text = "ou",
  className,
}) => {
  return (
    <div className={cn("relative my-6", className)}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-neutral-200" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-white px-4 text-neutral-400">
          {text}
        </span>
      </div>
    </div>
  );
};
