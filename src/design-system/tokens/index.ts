/**
 * 🎨 CONTTA DESIGN SYSTEM - TOKENS INDEX
 * 
 * Central export de todos os design tokens
 * Importar sempre deste arquivo para consistência
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './motion';

// ═══════════════════════════════════════════════════════════════
// 🎯 COMBINED THEME OBJECT
// ═══════════════════════════════════════════════════════════════

import { colors, cssVariables } from './colors';
import { typography, textPresets } from './typography';
import { spacing, semanticSpacing, borderRadius, shadows } from './spacing';
import { duration, easing, transitions, motionVariants, tailwindMotion } from './motion';

export const conttaTheme = {
  colors,
  cssVariables,
  typography,
  textPresets,
  spacing,
  semanticSpacing,
  borderRadius,
  shadows,
  duration,
  easing,
  transitions,
  motionVariants,
  tailwindMotion,
} as const;

// ═══════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get color value by path
 * @example getColor('primary.500') // '#0a8fc5'
 */
export function getColor(path: string): string {
  const keys = path.split('.');
  let value: any = colors;
  for (const key of keys) {
    value = value?.[key];
  }
  return value ?? '#000000';
}

/**
 * Get spacing value
 * @example getSpacing(4) // '1rem'
 */
export function getSpacing(key: keyof typeof spacing): string {
  return spacing[key];
}

/**
 * Generate CSS variables string for :root
 */
export function generateCSSVariables(): string {
  return Object.entries(cssVariables)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ');
}

// ═══════════════════════════════════════════════════════════════
// 📋 CONTTA BRAND CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const CONTTA_BRAND = {
  name: 'Contta',
  tagline: 'Inteligência Fiscal',
  primaryColor: colors.primary[500],
  logoPath: '/banco/logo/logoContta (1).png',
  year: 2026,
} as const;

// Type for entire theme
export type ConttaTheme = typeof conttaTheme;
