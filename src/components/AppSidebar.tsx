import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  TrendingUp,
  BarChart3,
  BarChart4,
  FolderTree,
  Upload,
  Building2,
  FileSpreadsheet,
  DollarSign,
  ShieldAlert,
  RefreshCw,
  BookOpen,
  Zap,
  UserSquare2,
  Calendar,
  PieChart,
  Bot,
  Brain,
  Target,
  Activity,
  Network,
  FileInput,
  FileWarning,
  AlertTriangle,
  Database,
  Scale,
  Wrench,
  Book,
  Receipt,
  FileCheck,
  FileX,
  FileSearch,
  Settings,
  CreditCard,
  GitMerge,
  Clipboard,
  LineChart,
  Heart,
  Calculator,
  Handshake,
  Lightbulb,
  Package,
  Banknote,
  Gavel,
  Tv,
  Gift,
  Tags,
  ClipboardCheck,
  FilePlus2,
  FileOutput,
  Shield,
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
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { AITeamBadge } from "@/components/AITeamBadge";

const SCROLL_POSITION_KEY = "sidebar-scroll-position";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { selectedClientId, selectedClientName } = useClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const auditCompleted = localStorage.getItem("cost_center_audit_completed") === "true";

  // Restaurar posição de scroll quando o componente monta ou a rota muda
  useEffect(() => {
    const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (savedPosition && scrollContainerRef.current) {
      const position = parseInt(savedPosition, 10);
      // Validate that parseInt returned a valid number
      if (!isNaN(position) && position >= 0) {
        // Pequeno delay para garantir que o DOM foi atualizado
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = position;
          }
        }, 0);
      }
    }
  }, [location.pathname]);

  // Salvar posição de scroll antes de desmontar
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

  // Menu organizado por fluxo de trabalho financeiro
  const menuGroups = [
    {
      label: "Principal",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Executivo", url: "/executive-dashboard", icon: PieChart },
        { title: "Fluxo de Caixa", url: "/cash-flow", icon: TrendingUp },
        ...(selectedClientId ? [{ title: selectedClientName || "Cliente", url: "/client-dashboard", icon: UserSquare2 }] : []),
      ],
    },
    {
      label: "Banco",
      items: [
        { title: "Contas Bancárias", url: "/bank-accounts", icon: Building2 },
        { title: "Importar Extrato", url: "/bank-import", icon: Upload },
        { title: "Conciliador", url: "/super-conciliador", icon: Target },
        { title: "Aprovações", url: "/pending-reconciliations", icon: AlertTriangle },
      ],
    },
    {
      label: "Honorários",
      items: [
        { title: "Fluxo de Honorários", url: "/honorarios-flow", icon: DollarSign },
        { title: "Gerar Honorários", url: "/generate-recurring-invoices", icon: Calendar },
        { title: "Especiais", url: "/special-fees", icon: Calculator },
        { title: "Análise", url: "/fees-analysis", icon: TrendingUp },
        { title: "Inadimplência", url: "/default-analysis", icon: AlertTriangle },
        { title: "Cobrança", url: "/collection-dashboard", icon: FileText },
      ],
    },
    {
      label: "Contas a Pagar",
      items: [
        { title: "Despesas", url: "/expenses", icon: Wallet },
        { title: "Categorias", url: "/expense-categories", icon: FolderTree },
        { title: "Fornecedores", url: "/accounts-payable", icon: CreditCard },
      ],
    },
    {
      label: "Clientes",
      items: [
        { title: "Clientes", url: "/clients", icon: Users },
        { title: "Pro-Bono", url: "/pro-bono-clients", icon: Heart },
        { title: "Grupos Financeiros", url: "/economic-groups", icon: GitMerge },
        { title: "Análise por Sócios", url: "/economic-group-analysis", icon: Network },
      ],
    },
    {
      label: "Contratos",
      items: [
        { title: "Contratos", url: "/contracts", icon: FileText },
        { title: "Propostas", url: "/service-proposals", icon: FilePlus2 },
        { title: "Confissão Dívida", url: "/debt-confession", icon: Handshake },
        { title: "Distratos", url: "/contract-terminations", icon: FileOutput },
        { title: "Carta Responsab.", url: "/responsibility-letters", icon: Shield },
      ],
    },
    {
      label: "Contabilidade",
      items: [
        { title: "Plano de Contas", url: "/chart-of-accounts", icon: FolderTree },
        { title: "Centro de Custo Despesas", url: "/cost-center-analysis", icon: Tags },
        { title: "Centro de Custo Ativo", url: "/cost-center-assets", icon: Tags },
        ...(auditCompleted ? [] : [{ title: "Auditoria de Centros", url: "/cost-center-audit", icon: ClipboardCheck }]),
        { title: "Saldo de Abertura", url: "/client-opening-balance", icon: Database },
        { title: "Balancete", url: "/balancete", icon: FileCheck },
        { title: "DRE", url: "/dre", icon: BarChart3 },
        { title: "Balanço Patrimonial", url: "/balance-sheet", icon: Scale },
        { title: "Livro Diário", url: "/livro-diario", icon: Book },
        { title: "Livro Razão", url: "/livro-razao", icon: Receipt },
      ],
    },
    {
      label: "Importacoes",
      items: [
        { title: "Clientes", url: "/import", icon: Users },
        { title: "Honorarios", url: "/import-honorarios", icon: FileInput },
        { title: "Despesas", url: "/import-expenses-spreadsheet", icon: FileSpreadsheet },
        { title: "Upload Automatico", url: "/automated-upload", icon: Zap },
      ],
    },
    {
      label: "Administrativo",
      items: [
        { title: "Estoque e Compras", url: "/inventory", icon: Package },
        { title: "Folha de Pagamento", url: "/payroll", icon: Banknote },
        { title: "Incentivos e PLR", url: "/incentives", icon: Gift },
        { title: "Consultoria Trabalhista", url: "/labor-advisory", icon: Gavel },
        { title: "Videos e TVs", url: "/video-content", icon: Tv },
      ],
    },
    {
      label: "Ferramentas IA",
      items: [
        { title: "Central IA (100%)", url: "/ai-automation", icon: Zap },
        { title: "Contador IA", url: "/ai-accountant", icon: Bot },
        { title: "Gestor IA", url: "/business-manager", icon: Brain },
        { title: "Treinar IA", url: "/pending-entities", icon: Target },
        { title: "Rede Neural", url: "/ai-network", icon: Network },
        { title: "Evolucao Continua", url: "/feature-requests", icon: Lightbulb },
        { title: "Enriquecimento", url: "/client-enrichment", icon: Database },
        { title: "Configuracoes", url: "/settings", icon: Settings },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent ref={scrollContainerRef}>
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b ${collapsed ? 'justify-center' : ''}`}>
          <img 
            src="/logo-ampla-color.png" 
            alt="Ampla Contabilidade" 
            className={`${collapsed ? 'w-8 h-8' : 'w-12 h-12'} object-contain flex-shrink-0 rounded-lg`}
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <h2 className="font-bold text-sm">Ampla Contabilidade</h2>
              <p className="text-xs text-muted-foreground truncate">Gestão Financeira</p>
            </div>
          )}
        </div>

        {/* Menu Groups */}
        <div className="space-y-1">
          {menuGroups.map((group, groupIndex) => (
            <SidebarGroup key={group.label} className={groupIndex > 0 ? "pt-2" : ""}>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider px-3 py-2">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.url);
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          onClick={() => navigate(item.url)}
                          isActive={active}
                          tooltip={collapsed ? item.title : undefined}
                          className={`${!collapsed ? 'pl-6' : ''} transition-colors`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {!collapsed && <span className="text-sm truncate">{item.title}</span>}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
              {!collapsed && groupIndex < menuGroups.length - 1 && (
                <div className="mx-3 my-2 border-t border-border/40" />
              )}
            </SidebarGroup>
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <AITeamBadge variant="minimal" className="justify-center" />
            <span className="text-[10px] text-muted-foreground/60" title="Versão 1.22.0">v1.22</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <AITeamBadge variant="compact" />
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] text-muted-foreground/60">Ampla Sistema v1.22.0</span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
