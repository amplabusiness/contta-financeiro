/**
 * 📊 CONTTA DESIGN SYSTEM - TABLE COMPONENT
 * 
 * Tabela premium para dados financeiros
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// 🧩 TABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

// Table Root
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

// Table Header
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-neutral-50 border-b border-neutral-200",
      "[&_tr]:border-b-0",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

// Table Body
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

// Table Footer
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-neutral-200 bg-neutral-50/50",
      "font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

// Table Row
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-neutral-100",
      "transition-colors duration-100",
      "hover:bg-neutral-50/50",
      "data-[state=selected]:bg-primary-50",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

// Table Head Cell
export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Se a coluna é ordenável */
  sortable?: boolean;
  /** Direção da ordenação */
  sortDirection?: "asc" | "desc" | null;
  /** Callback de ordenação */
  onSort?: () => void;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable, sortDirection, onSort, children, ...props }, ref) => {
    const SortIcon = sortDirection === "asc" 
      ? ArrowUp 
      : sortDirection === "desc" 
      ? ArrowDown 
      : ArrowUpDown;

    return (
      <th
        ref={ref}
        className={cn(
          "h-10 px-3 text-left align-middle",
          "font-semibold text-neutral-600 text-xs uppercase tracking-wider",
          "[&:has([role=checkbox])]:pr-0",
          sortable && "cursor-pointer select-none hover:bg-neutral-100 transition-colors",
          className
        )}
        onClick={sortable ? onSort : undefined}
        {...props}
      >
        <div className="flex items-center gap-1.5">
          {children}
          {sortable && (
            <SortIcon 
              className={cn(
                "h-3.5 w-3.5",
                sortDirection ? "text-primary-600" : "text-neutral-400"
              )} 
            />
          )}
        </div>
      </th>
    );
  }
);
TableHead.displayName = "TableHead";

// Table Cell
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Alinhamento do conteúdo */
  align?: "left" | "center" | "right";
  /** Se é valor monetário (usa fonte mono) */
  currency?: boolean;
  /** Se é valor numérico */
  numeric?: boolean;
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align = "left", currency, numeric, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "p-3 align-middle [&:has([role=checkbox])]:pr-0",
        align === "center" && "text-center",
        align === "right" && "text-right",
        (currency || numeric) && "font-mono tabular-nums",
        currency && "font-medium",
        className
      )}
      {...props}
    />
  )
);
TableCell.displayName = "TableCell";

// Table Caption
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-neutral-500", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

// ═══════════════════════════════════════════════════════════════
// 📄 TABLE PAGINATION
// ═══════════════════════════════════════════════════════════════
export interface TablePaginationProps {
  /** Total de registros */
  totalCount: number;
  /** Página atual (0-indexed) */
  pageIndex: number;
  /** Tamanho da página */
  pageSize: number;
  /** Opções de tamanho de página */
  pageSizeOptions?: number[];
  /** Callback de mudança de página */
  onPageChange: (page: number) => void;
  /** Callback de mudança de tamanho */
  onPageSizeChange?: (size: number) => void;
  /** Classe adicional */
  className?: string;
}

const TablePagination: React.FC<TablePaginationProps> = ({
  totalCount,
  pageIndex,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className,
}) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  const startRecord = pageIndex * pageSize + 1;
  const endRecord = Math.min((pageIndex + 1) * pageSize, totalCount);

  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < totalPages - 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-4",
        "text-sm text-neutral-600",
        className
      )}
    >
      {/* Info */}
      <div className="flex items-center gap-1">
        <span>Mostrando</span>
        <span className="font-medium text-neutral-800">
          {startRecord}-{endRecord}
        </span>
        <span>de</span>
        <span className="font-medium text-neutral-800">{totalCount}</span>
        <span>registros</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Page size selector */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={cn(
              "h-8 px-2 rounded-md border border-neutral-300",
              "text-sm bg-white",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            )}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / página
              </option>
            ))}
          </select>
        )}

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!canGoPrev}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-md",
              "border border-neutral-300 bg-white",
              "transition-colors duration-100",
              canGoPrev
                ? "hover:bg-neutral-50 text-neutral-600"
                : "opacity-50 cursor-not-allowed text-neutral-400"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-3 text-sm">
            Página <span className="font-medium">{pageIndex + 1}</span> de{" "}
            <span className="font-medium">{totalPages}</span>
          </span>

          <button
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canGoNext}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-md",
              "border border-neutral-300 bg-white",
              "transition-colors duration-100",
              canGoNext
                ? "hover:bg-neutral-50 text-neutral-600"
                : "opacity-50 cursor-not-allowed text-neutral-400"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🔲 EMPTY STATE
// ═══════════════════════════════════════════════════════════════
export interface TableEmptyStateProps {
  /** Ícone */
  icon?: React.ReactNode;
  /** Título */
  title: string;
  /** Descrição */
  description?: string;
  /** Ação */
  action?: React.ReactNode;
  /** Classe adicional */
  className?: string;
}

const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center py-12 px-4",
      "text-center",
      className
    )}
  >
    {icon && (
      <div className="mb-4 text-neutral-300">
        {icon}
      </div>
    )}
    <h3 className="text-base font-medium text-neutral-800 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-neutral-500 mb-4 max-w-sm">{description}</p>
    )}
    {action}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TablePagination,
  TableEmptyState,
};
