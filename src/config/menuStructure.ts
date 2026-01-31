/**
 * menuStructure.ts
 * 
 * Nova estrutura de menus do Contta - enxuta e focada em problemas.
 * Segue a regra de ouro: "O usuário não quer menu, quer resolver um problema."
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

import {
  Wallet,
  FileInput,
  FileOutput,
  RefreshCw,
  Receipt,
  FileText,
  Users,
  Building2,
  LayoutDashboard,
  TrendingUp,
  AlertTriangle,
  Clock,
  Calculator,
  BarChart3,
  Scale,
  BookOpen,
  Search,
  CheckCircle2,
  FileCheck,
  Sparkles,
  GraduationCap,
  ListTodo,
  Settings,
  GitBranch,
  UserCog,
  Link2,
  LucideIcon,
  ShieldCheck,
  Bot
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'warning' | 'success';
  description?: string;
  shortcut?: string;
  children?: MenuItem[];
  roles?: string[];        // Roles que podem ver este item
  isNew?: boolean;         // Indicador de novidade
  isPremium?: boolean;     // Funcionalidade premium
}

export interface MenuSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: MenuItem[];
  collapsed?: boolean;
}

// ============================================================================
// MENU STRUCTURE
// ============================================================================

/**
 * Estrutura completa de menus
 * Organizada por função do usuário, não por módulo técnico
 */
export const MENU_SECTIONS: MenuSection[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. OPERAR - Ações do dia a dia
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'operar',
    title: 'Operar',
    icon: Wallet,
    items: [
      {
        id: 'caixa',
        label: 'Caixa',
        icon: Wallet,
        path: '/caixa',
        description: 'Movimentação de caixa e banco',
        shortcut: 'Alt+C'
      },
      {
        id: 'contas-receber',
        label: 'Contas a Receber',
        icon: FileInput,
        path: '/contas-receber',
        description: 'Duplicatas e recebimentos',
        shortcut: 'Alt+R'
      },
      {
        id: 'contas-pagar',
        label: 'Contas a Pagar',
        icon: FileOutput,
        path: '/contas-pagar',
        description: 'Fornecedores e pagamentos',
        shortcut: 'Alt+P'
      },
      {
        id: 'super-conciliacao',
        label: 'Super Conciliação',
        icon: RefreshCw,
        path: '/super-conciliacao',
        description: 'HUB de classificação e conciliação',
        shortcut: 'Alt+S',
        isNew: true
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CONTROLAR - Cadastros e contratos
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'controlar',
    title: 'Controlar',
    icon: Receipt,
    items: [
      {
        id: 'honorarios',
        label: 'Honorários',
        icon: Receipt,
        path: '/honorarios',
        description: 'Contratos e faturamento mensal'
      },
      {
        id: 'contratos',
        label: 'Contratos',
        icon: FileText,
        path: '/contratos',
        description: 'Gestão de contratos ativos'
      },
      {
        id: 'clientes',
        label: 'Clientes',
        icon: Users,
        path: '/clientes',
        description: 'Cadastro de clientes'
      },
      {
        id: 'fornecedores',
        label: 'Fornecedores',
        icon: Building2,
        path: '/fornecedores',
        description: 'Cadastro de fornecedores'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. ANALISAR - Dashboards e relatórios gerenciais
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'analisar',
    title: 'Analisar',
    icon: LayoutDashboard,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard Executivo',
        icon: LayoutDashboard,
        path: '/dashboard',
        description: 'Visão geral do negócio',
        shortcut: 'Alt+D'
      },
      {
        id: 'fluxo-caixa',
        label: 'Fluxo de Caixa',
        icon: TrendingUp,
        path: '/fluxo-caixa',
        description: 'Projeção e realizado'
      },
      {
        id: 'inadimplencia',
        label: 'Inadimplência',
        icon: AlertTriangle,
        path: '/inadimplencia',
        description: 'Clientes em atraso',
        badgeVariant: 'destructive'
      },
      {
        id: 'aging',
        label: 'Aging',
        icon: Clock,
        path: '/aging',
        description: 'Vencimentos por período'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. CONTABILIZAR - Demonstrativos contábeis
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'contabilizar',
    title: 'Contabilizar',
    icon: Calculator,
    items: [
      {
        id: 'balancete',
        label: 'Balancete',
        icon: Calculator,
        path: '/balancete',
        description: 'Balancete de verificação'
      },
      {
        id: 'dre',
        label: 'DRE',
        icon: BarChart3,
        path: '/dre',
        description: 'Demonstração de resultado'
      },
      {
        id: 'balanco',
        label: 'Balanço',
        icon: Scale,
        path: '/balanco',
        description: 'Balanço patrimonial'
      },
      {
        id: 'livros',
        label: 'Livro Diário/Razão',
        icon: BookOpen,
        path: '/livros',
        description: 'Livros contábeis'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. AUDITAR - Verificações e aprovações
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'auditar',
    title: 'Auditar',
    icon: Search,
    items: [
      {
        id: 'auditoria-mensal',
        label: 'Auditoria Mensal',
        icon: Search,
        path: '/auditoria',
        description: 'Checklist de fechamento'
      },
      {
        id: 'aprovacoes',
        label: 'Aprovações',
        icon: CheckCircle2,
        path: '/aprovacoes',
        description: 'Pendências do Dr. Cícero',
        badgeVariant: 'warning',
        roles: ['admin', 'contador']
      },
      {
        id: 'pareceres',
        label: 'Pareceres',
        icon: FileCheck,
        path: '/pareceres',
        description: 'Pareceres e relatórios de auditoria'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. IA & AUTOMAÇÃO - Central de inteligência
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ia',
    title: 'IA & Automação',
    icon: Sparkles,
    items: [
      {
        id: 'central-ia',
        label: 'Central IA',
        icon: Bot,
        path: '/ia',
        description: 'Converse com o Dr. Cícero',
        shortcut: 'Alt+I',
        isNew: true
      },
      {
        id: 'treinar-ia',
        label: 'Treinar IA',
        icon: GraduationCap,
        path: '/ia/treinar',
        description: 'Ensinar novas regras',
        roles: ['admin']
      },
      {
        id: 'regras-classificacao',
        label: 'Regras de Classificação',
        icon: ListTodo,
        path: '/ia/regras',
        description: 'Regras automáticas de classificação'
      },
      {
        id: 'educador',
        label: 'Agente Educador',
        icon: GraduationCap,
        path: '/ia/educador',
        description: 'Aprenda contabilidade',
        isNew: true
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CONFIGURAÇÕES - Setup do sistema
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'configuracoes',
    title: 'Configurações',
    icon: Settings,
    collapsed: true,
    items: [
      {
        id: 'plano-contas',
        label: 'Plano de Contas',
        icon: GitBranch,
        path: '/config/plano-contas',
        description: 'Estrutura do plano de contas'
      },
      {
        id: 'centros-custo',
        label: 'Centros de Custo',
        icon: Building2,
        path: '/config/centros-custo',
        description: 'Departamentos e projetos'
      },
      {
        id: 'usuarios',
        label: 'Usuários',
        icon: UserCog,
        path: '/config/usuarios',
        description: 'Gestão de usuários',
        roles: ['admin']
      },
      {
        id: 'integracoes',
        label: 'Integrações',
        icon: Link2,
        path: '/config/integracoes',
        description: 'APIs e conexões externas',
        roles: ['admin']
      },
      {
        id: 'seguranca',
        label: 'Segurança',
        icon: ShieldCheck,
        path: '/config/seguranca',
        description: 'Logs e permissões',
        roles: ['admin']
      }
    ]
  }
];

// ============================================================================
// QUICK ACTIONS - Ações rápidas mais usadas
// ============================================================================

export const QUICK_ACTIONS: MenuItem[] = [
  {
    id: 'nova-transacao',
    label: 'Nova Transação',
    icon: Wallet,
    path: '/caixa/nova',
    shortcut: 'Ctrl+N'
  },
  {
    id: 'importar-ofx',
    label: 'Importar OFX',
    icon: FileInput,
    path: '/super-conciliacao?action=import',
    shortcut: 'Ctrl+I'
  },
  {
    id: 'classificar',
    label: 'Classificar Pendentes',
    icon: RefreshCw,
    path: '/super-conciliacao?filter=pending',
    shortcut: 'Ctrl+K'
  },
  {
    id: 'perguntar-ia',
    label: 'Perguntar ao Dr. Cícero',
    icon: Bot,
    path: '/ia',
    shortcut: 'Ctrl+Space'
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Encontra um item de menu pelo ID
 */
export function findMenuItemById(id: string): MenuItem | null {
  for (const section of MENU_SECTIONS) {
    const found = section.items.find(item => item.id === id);
    if (found) return found;
    
    for (const item of section.items) {
      if (item.children) {
        const child = item.children.find(c => c.id === id);
        if (child) return child;
      }
    }
  }
  return null;
}

/**
 * Encontra um item de menu pelo path
 */
export function findMenuItemByPath(path: string): MenuItem | null {
  for (const section of MENU_SECTIONS) {
    const found = section.items.find(item => item.path === path);
    if (found) return found;
    
    for (const item of section.items) {
      if (item.children) {
        const child = item.children.find(c => c.path === path);
        if (child) return child;
      }
    }
  }
  return null;
}

/**
 * Filtra menus por role do usuário
 */
export function filterMenusByRole(sections: MenuSection[], userRoles: string[]): MenuSection[] {
  return sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (!item.roles) return true;
      return item.roles.some(role => userRoles.includes(role));
    })
  })).filter(section => section.items.length > 0);
}

/**
 * Obtém todos os paths para pré-carregar
 */
export function getAllPaths(): string[] {
  const paths: string[] = [];
  
  for (const section of MENU_SECTIONS) {
    for (const item of section.items) {
      if (item.path) paths.push(item.path);
      if (item.children) {
        for (const child of item.children) {
          if (child.path) paths.push(child.path);
        }
      }
    }
  }
  
  return paths;
}

/**
 * Gera breadcrumb para um path
 */
export function generateBreadcrumb(path: string): { label: string; path?: string }[] {
  const breadcrumb: { label: string; path?: string }[] = [
    { label: 'Início', path: '/' }
  ];
  
  for (const section of MENU_SECTIONS) {
    const item = section.items.find(i => i.path === path);
    if (item) {
      breadcrumb.push({ label: section.title });
      breadcrumb.push({ label: item.label });
      return breadcrumb;
    }
    
    for (const menuItem of section.items) {
      if (menuItem.children) {
        const child = menuItem.children.find(c => c.path === path);
        if (child) {
          breadcrumb.push({ label: section.title });
          breadcrumb.push({ label: menuItem.label, path: menuItem.path });
          breadcrumb.push({ label: child.label });
          return breadcrumb;
        }
      }
    }
  }
  
  return breadcrumb;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default MENU_SECTIONS;
