/**
 * 🎨 CONTTA DESIGN SYSTEM - COLOR TOKENS
 * 
 * Paleta oficial derivada da logo Contta - Inteligência Fiscal
 * Governado pelo Maestro UX - Nenhuma cor fora deste arquivo
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

export const colors = {
  // ═══════════════════════════════════════════════════════════════
  // 🔵 PRIMARY - Azul Contta (extraído da logo)
  // Uso: CTAs principais, links, estados ativos, destaque
  // ═══════════════════════════════════════════════════════════════
  primary: {
    50:  '#eef9fd',   // Backgrounds sutis
    100: '#d6f0fa',   // Hover backgrounds
    200: '#a7def3',   // Borders suaves
    300: '#6cc6ea',   // Icons secundários
    400: '#33addf',   // Links hover
    500: '#0a8fc5',   // 🎯 COR PRINCIPAL CONTTA
    600: '#0773a0',   // CTA pressed
    700: '#065a7c',   // Text on light
    800: '#05445d',   // Headings
    900: '#043446',   // Darkest
  },

  // ═══════════════════════════════════════════════════════════════
  // ⚪ NEUTRAL - Slate (uso diário 10h sem fadiga)
  // Uso: Textos, backgrounds, borders, estrutura
  // ═══════════════════════════════════════════════════════════════
  neutral: {
    0:   '#ffffff',   // Pure white
    50:  '#f8fafc',   // Page background
    100: '#f1f5f9',   // Card backgrounds
    200: '#e2e8f0',   // Borders
    300: '#cbd5e1',   // Disabled states
    400: '#94a3b8',   // Placeholder text
    500: '#64748b',   // Secondary text
    600: '#475569',   // Body text
    700: '#334155',   // Headings
    800: '#1e293b',   // Primary text
    900: '#0f172a',   // Darkest text
  },

  // ═══════════════════════════════════════════════════════════════
  // ✅ SEMANTIC - Estados e feedback (cores suaves, não agressivas)
  // ═══════════════════════════════════════════════════════════════
  semantic: {
    // Sucesso - Verde suave (nunca saturado)
    success: {
      50:  '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
    },
    
    // Alerta - Âmbar suave (atenção sem alarme)
    warning: {
      50:  '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    
    // Erro - Vermelho escuro (grave, raríssimo)
    error: {
      50:  '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
    
    // Informação - Azul Contta
    info: {
      50:  '#eef9fd',
      100: '#d6f0fa',
      200: '#a7def3',
      500: '#0a8fc5',
      600: '#0773a0',
      700: '#065a7c',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🤖 AI - Cores para elementos de IA (Dr. Cícero, insights)
  // Roxo suave - diferencia IA de ações humanas
  // ═══════════════════════════════════════════════════════════════
  ai: {
    50:  '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',   // 🎯 COR IA PRINCIPAL
    600: '#9333ea',
    700: '#7c3aed',
  },

  // ═══════════════════════════════════════════════════════════════
  // 📊 DATA VISUALIZATION - Gráficos e dashboards
  // ═══════════════════════════════════════════════════════════════
  chart: {
    blue:    '#0a8fc5',
    teal:    '#14b8a6',
    emerald: '#10b981',
    amber:   '#f59e0b',
    rose:    '#f43f5e',
    violet:  '#8b5cf6',
    slate:   '#64748b',
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎭 CSS CUSTOM PROPERTIES (para uso em Tailwind/CSS)
// ═══════════════════════════════════════════════════════════════
export const cssVariables = {
  // Primary
  '--contta-primary': colors.primary[500],
  '--contta-primary-light': colors.primary[100],
  '--contta-primary-dark': colors.primary[700],
  
  // Backgrounds
  '--contta-bg-page': colors.neutral[50],
  '--contta-bg-card': colors.neutral[0],
  '--contta-bg-elevated': colors.neutral[100],
  
  // Text
  '--contta-text-primary': colors.neutral[800],
  '--contta-text-secondary': colors.neutral[600],
  '--contta-text-muted': colors.neutral[400],
  
  // Borders
  '--contta-border': colors.neutral[200],
  '--contta-border-focus': colors.primary[500],
  
  // AI
  '--contta-ai': colors.ai[500],
  '--contta-ai-light': colors.ai[100],
} as const;

// Type exports para autocompletion
export type ColorScale = typeof colors.primary;
export type SemanticColor = typeof colors.semantic.success;
export type ChartColor = keyof typeof colors.chart;
