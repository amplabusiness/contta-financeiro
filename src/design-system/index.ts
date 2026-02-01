/**
 * 🎨 CONTTA DESIGN SYSTEM - MAIN INDEX
 * 
 * Export principal do Design System
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 * 
 * @example
 * // Import tokens
 * import { colors, typography, spacing } from '@/design-system';
 * 
 * // Import components
 * import { Button, Card, KPICard } from '@/design-system';
 */

// ═══════════════════════════════════════════════════════════════
// 🎨 DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
export * from './tokens';

// ═══════════════════════════════════════════════════════════════
// 🧩 COMPONENTS
// ═══════════════════════════════════════════════════════════════
export * from './components';

// ═══════════════════════════════════════════════════════════════
// 🏠 LAYOUTS
// ═══════════════════════════════════════════════════════════════
export * from './layouts';

// ═══════════════════════════════════════════════════════════════
// 📋 CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Versão do Design System
 */
export const DESIGN_SYSTEM_VERSION = '2.0.0';

/**
 * Maestro UX - Regras de ouro
 */
export const MAESTRO_UX_RULES = {
  // Light Mode é padrão
  defaultTheme: 'light',
  
  // Fonte primária
  primaryFont: 'Inter',
  
  // Fonte para valores
  monoFont: 'JetBrains Mono',
  
  // Cor primária (azul Contta)
  primaryColor: '#0a8fc5',
  
  // Cor de IA (violeta)
  aiColor: '#a855f7',
  
  // Máximo de cores por tela
  maxColorsPerScreen: 5,
  
  // Padding mínimo de cards
  minCardPadding: '16px',
  
  // Hierarquia visual obrigatória
  visualHierarchy: true,
  
  // Feedback em toda ação
  feedbackRequired: true,
  
  // Onboarding invisível
  invisibleOnboarding: true,
} as const;
