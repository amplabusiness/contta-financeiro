/**
 * 🎨 CONTTA DESIGN SYSTEM - LAYOUTS INDEX
 * 
 * Export central de todos os layouts
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

// Dashboard Layout
export {
  DashboardLayout,
  PageHeader,
  PageContent,
  Section,
  Grid,
} from './DashboardLayout';
export type {
  DashboardLayoutProps,
  PageHeaderProps,
  PageContentProps,
  SectionProps,
  GridProps,
} from './DashboardLayout';

// Auth Layout
export {
  AuthLayout,
  AuthCard,
  AuthLink,
  AuthDivider,
} from './AuthLayout';
export type {
  AuthLayoutProps,
  AuthFeature,
  AuthCardProps,
  AuthLinkProps,
  AuthDividerProps,
} from './AuthLayout';

// Landing Layout
export {
  LandingLayout,
  LandingSection,
  SectionHeader,
} from './LandingLayout';
export type {
  LandingLayoutProps,
  NavItem,
  LandingSectionProps,
  SectionHeaderProps,
} from './LandingLayout';
