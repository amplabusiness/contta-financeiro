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
  Network,
  Calculator,
  Handshake,
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
} from "@/components/ui/sidebar";

const SCROLL_POSITION_KEY = "sidebar-scroll-position";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { selectedClientId, selectedClientName } = useClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Restaurar posição de scroll quando o componente monta ou a rota muda
  useEffect(() => {
    const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (savedPosition && scrollContainerRef.current) {
      // Pequeno delay para garantir que o DOM foi atualizado
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);
        }
      }, 0);
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

  // Unified menu structure - more organized and no redundancy
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
      label: "Clientes",
      items: [
        { title: "Clientes", url: "/clients", icon: Users },
        { title: "Saldo de Abertura", url: "/client-opening-balance", icon: Calendar },
        { title: "Pro-Bono", url: "/pro-bono-clients", icon: Heart },
        { title: "Grupos Financeiros", url: "/economic-groups", icon: GitMerge },
        { title: "Análise por Sócios", url: "/economic-group-analysis", icon: Network },
        { title: "Contratos", url: "/contracts", icon: FileText },
      ],
    },
    {
      label: "Financeiro",
      items: [
        { title: "Honorários", url: "/invoices", icon: CreditCard },
        { title: "Análise de Honorários", url: "/fees-analysis", icon: TrendingUp },
        { title: "Reajuste por SM", url: "/fee-adjustment", icon: Calculator },
        { title: "Inadimplência", url: "/default-analysis", icon: AlertTriangle },
        { title: "Cobrança", url: "/collection-dashboard", icon: FileText },
        { title: "Negociação", url: "/debt-negotiation", icon: Handshake },
        { title: "Despesas", url: "/expenses", icon: Wallet },
        { title: "Contas a Pagar", url: "/accounts-payable", icon: CreditCard },
      ],
    },
    {
      label: "Conciliação Bancária",
      items: [
        { title: "Super Conciliador", url: "/super-conciliador", icon: Target },
        { title: "Pasta Banco", url: "/bank-folder-import", icon: FolderTree },
        { title: "Conciliação", url: "/bank-reconciliation", icon: RefreshCw },
        { title: "PIX", url: "/pix-reconciliation", icon: Zap },
        { title: "Dashboard", url: "/reconciliation-dashboard", icon: Activity },
        { title: "PIX sem Cliente", url: "/unmatched-pix-report", icon: ShieldAlert },
      ],
    },
    {
      label: "Contabilidade",
      items: [
        { title: "Contabilidade Inteligente", url: "/smart-accounting", icon: Zap },
        { title: "Plano de Contas", url: "/chart-of-accounts", icon: FolderTree },
        { title: "Balancete", url: "/balancete", icon: FileCheck },
        { title: "DRE", url: "/dre", icon: BarChart3 },
        { title: "Balanço Patrimonial", url: "/balance-sheet", icon: Scale },
        { title: "Livro Diário", url: "/livro-diario", icon: Book },
        { title: "Livro Razão", url: "/livro-razao", icon: Receipt },
      ],
    },
    {
      label: "Importações",
      items: [
        { title: "Upload Automático", url: "/automated-upload", icon: Zap },
        { title: "Clientes", url: "/import", icon: Users },
        { title: "Honorários", url: "/import-honorarios", icon: FileInput },
        { title: "Despesas", url: "/import-expenses-spreadsheet", icon: FileSpreadsheet },
        { title: "Extratos OFX/CNAB", url: "/import-boleto-report", icon: Upload },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        { title: "IA Contador", url: "/ai-accountant", icon: Bot },
        { title: "Gerar Honorários", url: "/generate-recurring-invoices", icon: Calendar },
        { title: "Enriquecimento", url: "/client-enrichment", icon: Database },
        { title: "Configurações", url: "/settings", icon: Settings },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent ref={scrollContainerRef}>
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
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
    </Sidebar>
  );
}
