/**
 * 📝 CONTTA DESIGN SYSTEM - TYPOGRAPHY TOKENS
 * 
 * Tipografia neutra, elegante e funcional para uso intensivo
 * Inter (UI) + JetBrains Mono (valores/códigos)
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

export const typography = {
  // ═══════════════════════════════════════════════════════════════
  // 🔤 FONT FAMILIES
  // ═══════════════════════════════════════════════════════════════
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'],
    display: ['Inter', 'system-ui', 'sans-serif'], // Para títulos grandes
  },

  // ═══════════════════════════════════════════════════════════════
  // 📏 FONT SIZES (rem-based para acessibilidade)
  // ═══════════════════════════════════════════════════════════════
  fontSize: {
    '2xs':  ['0.625rem', { lineHeight: '0.875rem' }],  // 10px - Labels tiny
    'xs':   ['0.75rem',  { lineHeight: '1rem' }],      // 12px - Captions
    'sm':   ['0.875rem', { lineHeight: '1.25rem' }],   // 14px - Body small
    'base': ['1rem',     { lineHeight: '1.5rem' }],    // 16px - Body default
    'lg':   ['1.125rem', { lineHeight: '1.75rem' }],   // 18px - Body large
    'xl':   ['1.25rem',  { lineHeight: '1.75rem' }],   // 20px - Heading 5
    '2xl':  ['1.5rem',   { lineHeight: '2rem' }],      // 24px - Heading 4
    '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],   // 30px - Heading 3
    '4xl':  ['2.25rem',  { lineHeight: '2.5rem' }],    // 36px - Heading 2
    '5xl':  ['3rem',     { lineHeight: '1' }],         // 48px - Heading 1
    '6xl':  ['3.75rem',  { lineHeight: '1' }],         // 60px - Display
  },

  // ═══════════════════════════════════════════════════════════════
  // ⚖️ FONT WEIGHTS
  // ═══════════════════════════════════════════════════════════════
  fontWeight: {
    normal:   '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
  },

  // ═══════════════════════════════════════════════════════════════
  // 📐 LETTER SPACING
  // ═══════════════════════════════════════════════════════════════
  letterSpacing: {
    tighter: '-0.05em',
    tight:   '-0.025em',
    normal:  '0',
    wide:    '0.025em',
    wider:   '0.05em',
    widest:  '0.1em',     // Para labels uppercase
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎯 PRESETS SEMÂNTICOS (uso direto nos componentes)
// ═══════════════════════════════════════════════════════════════
export const textPresets = {
  // Títulos de página
  pageTitle: {
    fontFamily: 'font-display',
    fontSize: 'text-3xl',
    fontWeight: 'font-semibold',
    letterSpacing: 'tracking-tight',
    color: 'text-neutral-800',
  },
  
  // Títulos de seção
  sectionTitle: {
    fontFamily: 'font-sans',
    fontSize: 'text-xl',
    fontWeight: 'font-semibold',
    color: 'text-neutral-800',
  },
  
  // Títulos de card
  cardTitle: {
    fontFamily: 'font-sans',
    fontSize: 'text-base',
    fontWeight: 'font-medium',
    color: 'text-neutral-700',
  },
  
  // Corpo de texto
  body: {
    fontFamily: 'font-sans',
    fontSize: 'text-sm',
    fontWeight: 'font-normal',
    color: 'text-neutral-600',
  },
  
  // Texto secundário
  caption: {
    fontFamily: 'font-sans',
    fontSize: 'text-xs',
    fontWeight: 'font-normal',
    color: 'text-neutral-500',
  },
  
  // Labels de formulário
  label: {
    fontFamily: 'font-sans',
    fontSize: 'text-sm',
    fontWeight: 'font-medium',
    color: 'text-neutral-700',
  },
  
  // Valores monetários
  currency: {
    fontFamily: 'font-mono',
    fontSize: 'text-base',
    fontWeight: 'font-semibold',
    letterSpacing: 'tracking-tight',
  },
  
  // Valores grandes (KPIs)
  kpiValue: {
    fontFamily: 'font-mono',
    fontSize: 'text-2xl',
    fontWeight: 'font-bold',
    letterSpacing: 'tracking-tight',
  },
  
  // Códigos e IDs
  code: {
    fontFamily: 'font-mono',
    fontSize: 'text-sm',
    fontWeight: 'font-normal',
    color: 'text-neutral-600',
  },
} as const;

// Type exports
export type FontFamily = keyof typeof typography.fontFamily;
export type FontSize = keyof typeof typography.fontSize;
export type TextPreset = keyof typeof textPresets;
