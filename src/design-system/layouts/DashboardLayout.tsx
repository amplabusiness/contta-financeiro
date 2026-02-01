/**
 * 🏠 CONTTA DESIGN SYSTEM - DASHBOARD LAYOUT
 * 
 * Layout premium para área logada
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/design-system/components";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface DashboardLayoutProps {
  children: React.ReactNode;
  /** Sidebar component */
  sidebar?: React.ReactNode;
  /** Header component */
  header?: React.ReactNode;
  /** Se a sidebar está colapsada */
  sidebarCollapsed?: boolean;
  /** Callback para toggle da sidebar */
  onSidebarToggle?: () => void;
  /** Classe adicional */
  className?: string;
}

export interface PageHeaderProps {
  /** Título da página */
  title: string;
  /** Descrição/subtítulo */
  description?: string;
  /** Ações (botões) */
  actions?: React.ReactNode;
  /** Breadcrumb */
  breadcrumb?: React.ReactNode;
  /** Classe adicional */
  className?: string;
}

export interface PageContentProps {
  children: React.ReactNode;
  /** Máximo de largura */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Padding interno */
  padding?: "none" | "sm" | "md" | "lg";
  /** Classe adicional */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
// 🏠 DASHBOARD LAYOUT
// ═══════════════════════════════════════════════════════════════
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  sidebar,
  header,
  sidebarCollapsed = false,
  className,
}) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn(
        "min-h-screen bg-neutral-50",
        className
      )}>
        {/* Sidebar */}
        {sidebar && (
          <aside
            className={cn(
              "fixed left-0 top-0 z-40 h-screen",
              "bg-white border-r border-neutral-200",
              "transition-all duration-200 ease-out",
              sidebarCollapsed ? "w-[60px]" : "w-[240px]"
            )}
          >
            {sidebar}
          </aside>
        )}

        {/* Main area */}
        <div
          className={cn(
            "min-h-screen",
            "transition-all duration-200 ease-out",
            sidebar && (sidebarCollapsed ? "ml-[60px]" : "ml-[240px]")
          )}
        >
          {/* Header */}
          {header && (
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-neutral-200">
              {header}
            </header>
          )}

          {/* Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📄 PAGE HEADER
// ═══════════════════════════════════════════════════════════════
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumb,
  className,
}) => {
  return (
    <div className={cn(
      "px-6 py-4 bg-white border-b border-neutral-100",
      className
    )}>
      {/* Breadcrumb */}
      {breadcrumb && (
        <div className="mb-2 text-sm text-neutral-500">
          {breadcrumb}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-neutral-800 tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-neutral-500 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📦 PAGE CONTENT
// ═══════════════════════════════════════════════════════════════
const maxWidthClasses = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

const paddingClasses = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const PageContent: React.FC<PageContentProps> = ({
  children,
  maxWidth = "full",
  padding = "md",
  className,
}) => {
  return (
    <div className={cn(
      "mx-auto",
      maxWidthClasses[maxWidth],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📊 SECTION (para organização de conteúdo)
// ═══════════════════════════════════════════════════════════════
export interface SectionProps {
  children: React.ReactNode;
  /** Título da seção */
  title?: string;
  /** Descrição */
  description?: string;
  /** Ações */
  actions?: React.ReactNode;
  /** Classe adicional */
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  children,
  title,
  description,
  actions,
  className,
}) => {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-neutral-800">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-neutral-500 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📱 RESPONSIVE GRID (helper)
// ═══════════════════════════════════════════════════════════════
export interface GridProps {
  children: React.ReactNode;
  /** Colunas */
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Gap */
  gap?: "sm" | "md" | "lg";
  /** Classe adicional */
  className?: string;
}

const gridColsClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
};

const gapClasses = {
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
};

export const Grid: React.FC<GridProps> = ({
  children,
  cols = 4,
  gap = "md",
  className,
}) => {
  return (
    <div className={cn(
      "grid",
      gridColsClasses[cols],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
};
