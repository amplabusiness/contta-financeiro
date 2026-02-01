/**
 * 🎯 CONTTA - PREMIUM SIDEBAR
 * 
 * Sidebar premium para 200+ clientes
 * Design System Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard,
  Landmark,
  Receipt,
  DollarSign,
  FileText,
  BarChart3,
  PieChart,
  Users,
  FileInput,
  FileSpreadsheet,
  Package,
  Banknote,
  Gift,
  Gavel,
  Tv,
  Zap,
  BookOpen,
  Database,
  Code2,
  Bot,
  Brain,
  Target,
  Network,
  Lightbulb,
  Settings,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: string;
  isNew?: boolean;
  isAI?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 MENU CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const menuGroups: MenuGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Contas a Receber", url: "/receivables", icon: DollarSign },
      { title: "Contas a Pagar", url: "/payables", icon: Receipt },
    ],
  },
  {
    label: "Banco",
    items: [
      { title: "Extrato Bancário", url: "/bank", icon: Landmark },
      { title: "Super Conciliação", url: "/bank-conciliation", icon: Zap, isAI: true },
    ],
  },
  {
    label: "Honorários",
    items: [
      { title: "Faturamento Mensal", url: "/billing", icon: FileText },
      { title: "Gestão de Contratos", url: "/contracts", icon: FileText },
    ],
  },
  {
    label: "Contabilidade",
    items: [
      { title: "Plano de Contas", url: "/chart-of-accounts", icon: FileText },
      { title: "Lançamentos", url: "/journal-entries", icon: FileText },
      { title: "Balancete", url: "/trial-balance", icon: PieChart },
      { title: "DRE", url: "/dre", icon: BarChart3 },
    ],
  },
  {
    label: "Importações",
    collapsible: true,
    defaultOpen: false,
    items: [
      { title: "Clientes", url: "/import", icon: Users },
      { title: "Honorários", url: "/import-honorarios", icon: FileInput },
      { title: "Despesas", url: "/import-expenses-spreadsheet", icon: FileSpreadsheet },
      { title: "Upload Automático", url: "/automated-upload", icon: Zap },
    ],
  },
  {
    label: "Administrativo",
    collapsible: true,
    defaultOpen: false,
    items: [
      { title: "NFS-e", url: "/nfse", icon: FileText },
      { title: "Estoque e Compras", url: "/inventory", icon: Package },
      { title: "Folha de Pagamento", url: "/payroll", icon: Banknote },
      { title: "Comissões Agentes", url: "/agent-commissions", icon: Users },
      { title: "Incentivos e PLR", url: "/incentives", icon: Gift },
      { title: "Consultoria Trabalhista", url: "/labor-advisory", icon: Gavel },
      { title: "Vídeos e TVs", url: "/video-content", icon: Tv },
    ],
  },
  {
    label: "Ferramentas IA",
    items: [
      { title: "Central IA", url: "/ai-automation", icon: Zap, isAI: true, badge: "100%" },
      { title: "Dr. Cícero", url: "/ai-accountant", icon: Bot, isAI: true },
      { title: "Educador IA", url: "/ai-educator", icon: BookOpen, isAI: true },
      { title: "Data Lake", url: "/data-lake", icon: Database, isAI: true },
      { title: "Code Editor", url: "/code-editor", icon: Code2 },
      { title: "Gestor IA", url: "/business-manager", icon: Brain, isAI: true },
      { title: "Treinar IA", url: "/pending-entities", icon: Target, isAI: true },
      { title: "Rede Neural", url: "/ai-network", icon: Network, isAI: true },
      { title: "Evolução Contínua", url: "/feature-requests", icon: Lightbulb },
      { title: "Enriquecimento", url: "/client-enrichment", icon: Database },
      { title: "Configurações", url: "/settings", icon: Settings },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 🎨 SIDEBAR COMPONENT
// ═══════════════════════════════════════════════════════════════

export function PremiumSidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  // Initialize open groups
  React.useEffect(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach(group => {
      if (group.collapsible) {
        initial[group.label] = group.defaultOpen ?? false;
      }
    });
    setOpenGroups(initial);
  }, []);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen flex flex-col",
          "bg-white border-r border-neutral-200",
          "transition-all duration-200 ease-out",
          collapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        {/* ═══ HEADER ═══ */}
        <div className={cn(
          "flex items-center h-16 px-3 border-b border-neutral-100",
          collapsed ? "justify-center" : "justify-start"
        )}>
          <img 
            src="/logo-contta.png" 
            alt="Contta" 
            className={cn(
              "object-contain flex-shrink-0",
              collapsed ? "h-8 w-8" : "h-12 w-auto"
            )}
          />
        </div>

        {/* ═══ MENU ═══ */}
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {menuGroups.map((group, groupIndex) => (
              <div key={group.label} className={groupIndex > 0 ? "pt-4" : ""}>
                {/* Group Header */}
                {group.collapsible && !collapsed ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider hover:text-neutral-600 transition-colors"
                  >
                    <span>{group.label}</span>
                    {openGroups[group.label] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                ) : !collapsed ? (
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    {group.label}
                  </div>
                ) : null}

                {/* Group Items */}
                <AnimatePresence initial={false}>
                  {(!group.collapsible || openGroups[group.label] || collapsed) && (
                    <motion.div
                      initial={group.collapsible ? { height: 0, opacity: 0 } : false}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const active = isActive(item.url);
                          const Icon = item.icon;

                          const button = (
                            <button
                              onClick={() => navigate(item.url)}
                              className={cn(
                                "flex items-center gap-3 w-full rounded-md transition-all duration-150",
                                collapsed ? "justify-center p-2" : "px-3 py-2",
                                active
                                  ? "bg-primary-50 text-primary-700"
                                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                              )}
                            >
                              <Icon className={cn(
                                "h-4 w-4 flex-shrink-0",
                                active ? "text-primary-600" : "",
                                item.isAI && !active ? "text-ai-500" : ""
                              )} />
                              
                              {!collapsed && (
                                <>
                                  <span className="text-sm font-medium truncate flex-1 text-left">
                                    {item.title}
                                  </span>
                                  
                                  {item.badge && (
                                    <span className={cn(
                                      "px-1.5 py-0.5 text-[10px] font-semibold rounded",
                                      item.isAI 
                                        ? "bg-ai-100 text-ai-700"
                                        : "bg-neutral-100 text-neutral-600"
                                    )}>
                                      {item.badge}
                                    </span>
                                  )}
                                  
                                  {item.isNew && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-success-100 text-success-700">
                                      Novo
                                    </span>
                                  )}
                                </>
                              )}
                            </button>
                          );

                          if (collapsed) {
                            return (
                              <Tooltip key={item.url}>
                                <TooltipTrigger asChild>
                                  {button}
                                </TooltipTrigger>
                                <TooltipContent side="right" className="flex items-center gap-2">
                                  <span>{item.title}</span>
                                  {item.badge && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-neutral-100 text-neutral-600">
                                      {item.badge}
                                    </span>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          }

                          return <div key={item.url}>{button}</div>;
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Separator */}
                {!collapsed && groupIndex < menuGroups.length - 1 && (
                  <div className="mx-2 mt-3 border-t border-neutral-100" />
                )}
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* ═══ FOOTER ═══ */}
        <div className="border-t border-neutral-100 p-2">
          {/* Toggle Button */}
          <button
            onClick={() => onCollapsedChange?.(!collapsed)}
            className={cn(
              "flex items-center gap-2 w-full rounded-md p-2 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors",
              collapsed ? "justify-center" : ""
            )}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="text-xs">Recolher menu</span>
              </>
            )}
          </button>

          {/* Version */}
          <div className={cn(
            "mt-2 text-[10px] text-neutral-400",
            collapsed ? "text-center" : "px-2"
          )}>
            {collapsed ? "v2" : "CONTTA v2.0.0 • Maestro UX"}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export default PremiumSidebar;
