/**
 * 🎨 CONTTA DESIGN SYSTEM - COMPONENTS INDEX
 * 
 * Central export de todos os componentes
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

// ═══════════════════════════════════════════════════════════════
// 📦 COMPONENT EXPORTS
// ═══════════════════════════════════════════════════════════════

// Button
export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

// Card
export { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  cardVariants 
} from './Card';
export type { 
  CardProps, 
  CardHeaderProps, 
  CardTitleProps, 
  CardDescriptionProps, 
  CardContentProps, 
  CardFooterProps 
} from './Card';

// Badge
export { Badge, StatusBadge, badgeVariants } from './Badge';
export type { BadgeProps, StatusBadgeProps } from './Badge';

// Tooltip
export { 
  Tooltip, 
  InfoTooltip,
  TooltipProvider, 
  TooltipRoot, 
  TooltipTrigger, 
  TooltipContent,
  TooltipPortal 
} from './Tooltip';
export type { SimpleTooltipProps, InfoTooltipProps } from './Tooltip';

// Input
export { Input, PasswordInput, FormField, inputVariants } from './Input';
export type { InputProps, PasswordInputProps, FormFieldProps } from './Input';

// Table
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
} from './Table';
export type { 
  TableHeadProps, 
  TableCellProps, 
  TablePaginationProps, 
  TableEmptyStateProps 
} from './Table';

// KPI
export { KPICard, KPIGrid, MiniKPI, kpiVariants } from './KPI';
export type { KPICardProps, KPIGridProps, MiniKPIProps } from './KPI';

// Premium Sidebar
export { PremiumSidebar } from './PremiumSidebar';

// Command Palette (⌘K)
export { 
  CommandPalette, 
  CommandPaletteProvider, 
  useCommandPalette, 
  CommandTrigger 
} from './CommandPalette';
