import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  TrendingUp,
  BarChart3,
  FolderTree,
  Upload,
  Building2,
  DollarSign,
  Zap,
  UserSquare2,
  Calendar,
  PieChart,
  Bot,
  Brain,
  Target,
  Activity,
  Network,
  AlertTriangle,
  Database,
  Scale,
  Book,
  Receipt,
  FileCheck,
  Settings,
  CreditCard,
  GitMerge,
  LineChart,
  Heart,
  Calculator,
  Handshake,
  Lightbulb,
  Package,
  Banknote,
  Gavel,
  Gift,
  Tags,
  ClipboardCheck,
  FilePlus2,
  FileOutput,
  Shield,
  Lock,
  Code2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Home,
  Landmark,
  FileSpreadsheet,
  BadgeDollarSign,
  ScrollText,
  Boxes,
  Cpu,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useClient } from "@/contexts/ClientContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { TenantLogo } from "@/components/TenantLogo";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

const SCROLL_POSITION_KEY = "sidebar-scroll-position";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
}

interface MenuGroup {
  label: string;
  icon: any;
  defaultOpen?: boolean;
  items: MenuItem[];
}

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { selectedClientId, selectedClientName } = useClient();
  const { officeData, tenant } = useTenantConfig();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const auditCompleted = localStorage.getItem("cost_center_audit_completed") === "true";

  // Estado para controlar grupos abertos
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("sidebar_open_groups");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return { "Principal": true, "Financeiro": true };
  });

  // Salvar estado dos grupos
  useEffect(() => {
    localStorage.setItem("sidebar_open_groups", JSON.stringify(openGroups));
  }, [openGroups]);

  // Restaurar posição de scroll
  useEffect(() => {
    const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (savedPosition && scrollContainerRef.current) {
      const position = parseInt(savedPosition, 10);
      if (!isNaN(position) && position >= 0) {
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = position;
          }
        }, 0);
      }
    }
  }, [location.pathname]);

  // Salvar posição de scroll
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        sessionStorage.setItem(
          SCROLL_POSITION_KEY,
          scrollContainerRef.current.scrollTop.toString()
        );
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Menu reorganizado de forma mais lógica
  const menuGroups: MenuGroup[] = [
    {
      label: "Principal",
      icon: Home,
      defaultOpen: true,
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Visão Executiva", url: "/executive-dashboard", icon: PieChart },
        ...(selectedClientId ? [{ title: selectedClientName || "Cliente", url: "/client-dashboard", icon: UserSquare2 }] : []),
      ],
    },
    {
      label: "Financeiro",
      icon: BadgeDollarSign,
      defaultOpen: true,
      items: [
        { title: "Fluxo de Caixa", url: "/cash-flow", icon: TrendingUp },
        { title: "Projeções", url: "/cash-flow-projections", icon: LineChart },
        { title: "Honorários", url: "/honorarios-flow", icon: DollarSign },
        { title: "Gerar Cobranças", url: "/generate-recurring-invoices", icon: Calendar },
        { title: "Honorários Especiais", url: "/special-fees", icon: Calculator },
        { title: "Despesas", url: "/expenses", icon: Wallet },
        { title: "Categorias", url: "/expense-categories", icon: FolderTree },
        { title: "Extrato Financeiro", url: "/client-ledger", icon: Receipt },
      ],
    },
    {
      label: "Banco",
      icon: Landmark,
      items: [
        { title: "Super Conciliação", url: "/super-conciliation", icon: Zap, badge: "IA", badgeColor: "bg-purple-500" },
        { title: "Automação", url: "/automation-dashboard", icon: Activity },
        { title: "Relatórios", url: "/automation-reports", icon: BarChart3 },
        { title: "Contas Bancárias", url: "/bank-accounts", icon: Building2 },
        { title: "Importar Extrato", url: "/bank-import", icon: Upload },
        { title: "Pendentes", url: "/pending-reconciliations", icon: AlertTriangle },
      ],
    },
    {
      label: "Cobrança",
      icon: Receipt,
      items: [
        { title: "Painel de Cobrança", url: "/collection-dashboard", icon: FileText },
        { title: "Inadimplência", url: "/default-analysis", icon: AlertTriangle },
        { title: "Análise de Fees", url: "/fees-analysis", icon: TrendingUp },
        { title: "Contas a Pagar", url: "/accounts-payable", icon: CreditCard },
      ],
    },
    {
      label: "Clientes",
      icon: Users,
      items: [
        { title: "Cadastro", url: "/clients", icon: Users },
        { title: "Pro-Bono", url: "/pro-bono-clients", icon: Heart },
        { title: "Grupos Econômicos", url: "/economic-groups", icon: GitMerge },
        { title: "Análise por Sócios", url: "/economic-group-analysis", icon: Network },
      ],
    },
    {
      label: "Contratos",
      icon: ScrollText,
      items: [
        { title: "Contratos", url: "/contracts", icon: FileText },
        { title: "Propostas", url: "/service-proposals", icon: FilePlus2 },
        { title: "Confissão de Dívida", url: "/debt-confession", icon: Handshake },
        { title: "Distratos", url: "/contract-terminations", icon: FileOutput },
        { title: "Carta de Responsab.", url: "/responsibility-letters", icon: Shield },
      ],
    },
    {
      label: "Contabilidade",
      icon: Scale,
      items: [
        { title: "Plano de Contas", url: "/chart-of-accounts", icon: FolderTree },
        { title: "Centro de Custos", url: "/cost-center-analysis", icon: Tags },
        { title: "Ativos", url: "/cost-center-assets", icon: Tags },
        ...(!auditCompleted ? [{ title: "Auditoria", url: "/cost-center-audit", icon: ClipboardCheck }] : []),
        { title: "Saldo de Abertura", url: "/client-opening-balance", icon: Database },
        { title: "Balancete", url: "/balancete-verificacao", icon: FileCheck },
        { title: "DRE", url: "/dre-analytics", icon: BarChart3 },
        { title: "Balanço Patrimonial", url: "/balanco-patrimonial", icon: Scale },
        { title: "Livro Diário", url: "/livro-diario", icon: Book },
        { title: "Livro Razão", url: "/razao-contabil", icon: Receipt },
        { title: "Fechamento", url: "/monthly-closing", icon: Lock },
      ],
    },
    {
      label: "Importações",
      icon: Upload,
      items: [
        { title: "Clientes", url: "/import", icon: Users },
        { title: "Honorários", url: "/import-honorarios", icon: FileSpreadsheet },
        { title: "Despesas", url: "/import-expenses-spreadsheet", icon: FileSpreadsheet },
        { title: "Upload Automático", url: "/automated-upload", icon: Zap },
      ],
    },
    {
      label: "Administrativo",
      icon: Boxes,
      items: [
        { title: "NFS-e", url: "/nfse", icon: FileText },
        { title: "Estoque", url: "/inventory", icon: Package },
        { title: "Folha de Pagamento", url: "/payroll", icon: Banknote },
        { title: "Comissões", url: "/agent-commissions", icon: Users },
        { title: "Incentivos / PLR", url: "/incentives", icon: Gift },
        { title: "Trabalhista", url: "/labor-advisory", icon: Gavel },
      ],
    },
    {
      label: "IA & Automação",
      icon: Sparkles,
      items: [
        { title: "Central de IA", url: "/ai-automation", icon: Cpu, badge: "100%", badgeColor: "bg-green-500" },
        { title: "Contador IA", url: "/ai-accountant", icon: Bot },
        { title: "Gestor IA", url: "/business-manager", icon: Brain },
        { title: "Treinar IA", url: "/pending-entities", icon: Target },
        { title: "Rede Neural", url: "/ai-network", icon: Network },
        { title: "Evolução Contínua", url: "/feature-requests", icon: Lightbulb },
        { title: "Enriquecimento", url: "/client-enrichment", icon: Database },
        { title: "Code Editor", url: "/code-editor", icon: Code2 },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r bg-slate-50 dark:bg-slate-900">
      {/* Header com Logo - alinhado com navbar (h-14 sm:h-16) */}
      <SidebarHeader className="border-b bg-slate-100/80 dark:bg-slate-800/50 min-h-14 sm:h-16 flex items-center">
        <div className={cn(
          "flex items-center gap-3 px-3 w-full",
          collapsed && "justify-center px-2"
        )}>
          <TenantLogo size={collapsed ? "sm" : "md"} />
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <h2 className="font-semibold text-sm truncate text-slate-800 dark:text-slate-100">
                {officeData?.nome_fantasia || officeData?.razao_social || tenant?.name || "CONTTA"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Gestão Financeira</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Menu Groups */}
      <SidebarContent ref={scrollContainerRef} className={cn("px-2", collapsed && "px-1")}>
        {menuGroups.map((group, groupIndex) => {
          const GroupIcon = group.icon;
          const hasActiveItem = group.items.some(item => isActive(item.url));

          return (
          <SidebarGroup key={group.label} className={cn("py-1", collapsed && "py-0.5")}>
            {collapsed ? (
              // Modo colapsado - mostrar ícone do grupo com dropdown
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={() => navigate(group.items[0].url)}
                    className={cn(
                      "w-full h-10 flex items-center justify-center rounded-lg transition-all",
                      hasActiveItem
                        ? "bg-primary/15 text-primary shadow-sm"
                        : "hover:bg-slate-200/80 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <GroupIcon className="h-5 w-5" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1">
                  <span className="font-semibold">{group.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} itens
                  </span>
                </TooltipContent>
              </Tooltip>
            ) : (
              // Modo expandido - mostrar grupos colapsáveis
              <Collapsible
                open={openGroups[group.label] ?? group.defaultOpen}
                onOpenChange={() => toggleGroup(group.label)}
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/50 rounded-md px-2 py-1.5 transition-colors">
                    <div className="flex items-center gap-2">
                      <group.icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {group.label}
                      </span>
                    </div>
                    {openGroups[group.label] ?? group.defaultOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-2 border-l border-slate-200 dark:border-slate-700 ml-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.url);
                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton
                              onClick={() => navigate(item.url)}
                              isActive={active}
                              className={cn(
                                "text-sm transition-all",
                                active
                                  ? "bg-primary/15 text-primary font-medium shadow-sm"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/80 dark:hover:bg-slate-700/50"
                              )}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{item.title}</span>
                              {item.badge && (
                                <span className={cn(
                                  "ml-auto text-[10px] text-white px-1.5 py-0.5 rounded-full",
                                  item.badgeColor || "bg-primary"
                                )}>
                                  {item.badge}
                                </span>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        );
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className={cn(
        "border-t bg-slate-100/80 dark:bg-slate-800/50",
        collapsed ? "p-1" : "p-2"
      )}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/50"
                  onClick={() => navigate("/billing")}
                >
                  <CreditCard className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Faturamento</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/50"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Configurações</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Quick Actions */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start text-xs h-8"
                onClick={() => navigate("/billing")}
              >
                <CreditCard className="h-3.5 w-3.5 mr-2" />
                Faturamento
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start text-xs h-8"
                onClick={() => navigate("/settings")}
              >
                <Settings className="h-3.5 w-3.5 mr-2" />
                Config.
              </Button>
            </div>

          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
