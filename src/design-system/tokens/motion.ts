/**
 * 🎬 CONTTA DESIGN SYSTEM - MOTION TOKENS
 * 
 * Animações suaves para feedback sem distração
 * Princípio: Rápido o suficiente para ser responsivo,
 * lento o suficiente para ser percebido
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

// ═══════════════════════════════════════════════════════════════
// ⏱️ DURATIONS
// ═══════════════════════════════════════════════════════════════
export const duration = {
  instant:  '0ms',       // Mudanças imediatas
  fastest:  '50ms',      // Micro-interações
  fast:     '100ms',     // Hovers, focus
  normal:   '150ms',     // Transitions padrão
  moderate: '200ms',     // Expansões pequenas
  slow:     '300ms',     // Modais, overlays
  slower:   '400ms',     // Animações elaboradas
  slowest:  '500ms',     // Celebrações
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎢 EASING CURVES
// ═══════════════════════════════════════════════════════════════
export const easing = {
  // Padrões
  linear:     'linear',
  ease:       'ease',
  easeIn:     'ease-in',
  easeOut:    'ease-out',
  easeInOut:  'ease-in-out',
  
  // Custom (recomendados para UI premium)
  smooth:     'cubic-bezier(0.4, 0, 0.2, 1)',      // Padrão Contta
  enter:      'cubic-bezier(0, 0, 0.2, 1)',        // Elementos entrando
  exit:       'cubic-bezier(0.4, 0, 1, 1)',        // Elementos saindo
  spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bounce sutil
  bounce:     'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Bounce forte
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎯 PRESETS DE TRANSIÇÃO (uso direto em Tailwind/CSS)
// ═══════════════════════════════════════════════════════════════
export const transitions = {
  // ─────────────────────────────────────────────────────────────
  // 🔘 INTERATIVOS (botões, links)
  // ─────────────────────────────────────────────────────────────
  button: {
    property: 'all',
    duration: duration.fast,
    easing: easing.smooth,
    css: `all ${duration.fast} ${easing.smooth}`,
  },
  
  // ─────────────────────────────────────────────────────────────
  // 🎨 CORES (hover states)
  // ─────────────────────────────────────────────────────────────
  colors: {
    property: 'color, background-color, border-color',
    duration: duration.fast,
    easing: easing.smooth,
    css: `color ${duration.fast} ${easing.smooth}, background-color ${duration.fast} ${easing.smooth}, border-color ${duration.fast} ${easing.smooth}`,
  },
  
  // ─────────────────────────────────────────────────────────────
  // 📏 TRANSFORM (scale, translate)
  // ─────────────────────────────────────────────────────────────
  transform: {
    property: 'transform',
    duration: duration.normal,
    easing: easing.smooth,
    css: `transform ${duration.normal} ${easing.smooth}`,
  },
  
  // ─────────────────────────────────────────────────────────────
  // 👁️ OPACITY (fade in/out)
  // ─────────────────────────────────────────────────────────────
  opacity: {
    property: 'opacity',
    duration: duration.normal,
    easing: easing.smooth,
    css: `opacity ${duration.normal} ${easing.smooth}`,
  },
  
  // ─────────────────────────────────────────────────────────────
  // 📦 EXPANSÃO (accordions, dropdowns)
  // ─────────────────────────────────────────────────────────────
  expand: {
    property: 'height, opacity',
    duration: duration.moderate,
    easing: easing.smooth,
    css: `height ${duration.moderate} ${easing.smooth}, opacity ${duration.moderate} ${easing.smooth}`,
  },
  
  // ─────────────────────────────────────────────────────────────
  // 🪟 MODAIS (entrada/saída)
  // ─────────────────────────────────────────────────────────────
  modal: {
    property: 'opacity, transform',
    duration: duration.slow,
    easing: easing.enter,
    css: `opacity ${duration.slow} ${easing.enter}, transform ${duration.slow} ${easing.enter}`,
  },
  
  // ─────────────────────────────────────────────────────────────
  // 🔔 NOTIFICAÇÕES (slide in)
  // ─────────────────────────────────────────────────────────────
  notification: {
    property: 'transform, opacity',
    duration: duration.slow,
    easing: easing.spring,
    css: `transform ${duration.slow} ${easing.spring}, opacity ${duration.slow} ${easing.spring}`,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎭 FRAMER MOTION VARIANTS (para componentes React)
// ═══════════════════════════════════════════════════════════════
export const motionVariants = {
  // Fade simples
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  },
  
  // Slide de baixo
  slideUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  
  // Slide da direita
  slideRight: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  
  // Scale (para modais)
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  
  // Stagger children (para listas)
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  },
  
  staggerItem: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  
  // Pulse (para loading states)
  pulse: {
    animate: {
      opacity: [1, 0.5, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
  
  // Spin (para loading icons)
  spin: {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎯 TAILWIND CLASSES (para uso direto)
// ═══════════════════════════════════════════════════════════════
export const tailwindMotion = {
  // Transições base
  base: 'transition-all duration-150 ease-out',
  fast: 'transition-all duration-100 ease-out',
  slow: 'transition-all duration-300 ease-out',
  
  // Hover effects
  hoverLift: 'hover:-translate-y-0.5 hover:shadow-md',
  hoverScale: 'hover:scale-[1.02]',
  hoverBrighten: 'hover:brightness-105',
  
  // Focus effects
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2',
  focusWithin: 'focus-within:ring-2 focus-within:ring-primary-500/20',
  
  // Active effects
  activePress: 'active:scale-[0.98]',
} as const;

// Type exports
export type Duration = keyof typeof duration;
export type Easing = keyof typeof easing;
export type TransitionPreset = keyof typeof transitions;
export type MotionVariant = keyof typeof motionVariants;
