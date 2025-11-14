import { useLocation, useNavigate } from "react-router-dom";
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
  FileContract,
  Settings,
  CreditCard,
  GitMerge,
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

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { selectedClientId, selectedClientName } = useClient();

  // Unified menu structure - more organized and no redundancy
  const menuGroups = [
    {
      label: "Dashboard",
      items: [
        { title: "Dashboard Principal", url: "/dashboard", icon: LayoutDashboard },
        { title: "Dashboard Executivo", url: "/executive-dashboard", icon: PieChart },
        { title: "Dashboard de Cobrança", url: "/collection-dashboard", icon: AlertTriangle },
        ...(selectedClientId ? [{ title: selectedClientName || "Cliente Selecionado", url: "/client-dashboard", icon: UserSquare2 }] : []),
      ],
    },
    {
      label: "Clientes",
      items: [
        { title: "Lista de Clientes", url: "/clients", icon: Users },
        { title: "Enriquecimento de Dados", url: "/client-enrichment", icon: Database },
        { title: "Processamento em Lote", url: "/batch-enrichment", icon: Zap },
        { title: "Mesclar Clientes", url: "/merge-clients", icon: GitMerge },
      ],
    },
    {
      label: "Contratos",
      items: [
        { title: "Contratos de Serviço", url: "/contracts", icon: FileContract },
      ],
    },
    {
      label: "Receitas",
      items: [
        { title: "Honorários a Receber", url: "/invoices", icon: CreditCard },
        { title: "Razão do Cliente", url: "/client-ledger", icon: BookOpen },
        { title: "Análise de Ausências", url: "/boleto-gaps", icon: Calendar },
        { title: "Inadimplência", url: "/reports", icon: AlertTriangle },
        { title: "Cartas de Cobrança", url: "/collection-letters", icon: FileText },
      ],
    },
    {
      label: "Conciliação",
      items: [
        { title: "Conciliação Bancária", url: "/bank-reconciliation", icon: RefreshCw },
        { title: "Reconciliação PIX", url: "/pix-reconciliation", icon: Zap },
        { title: "Dashboard de Conciliação", url: "/reconciliation-dashboard", icon: Activity },
        { title: "Relatório de Divergências", url: "/reconciliation-discrepancies", icon: FileWarning },
        { title: "PIX sem Cliente", url: "/unmatched-pix-report", icon: ShieldAlert },
      ],
    },
    {
      label: "Contabilidade",
      items: [
        { title: "Plano de Contas", url: "/chart-of-accounts", icon: FolderTree },
        { title: "Livro Diário", url: "/livro-diario", icon: Book },
        { title: "Livro Razão", url: "/livro-razao", icon: Receipt },
        { title: "Balancete", url: "/balancete", icon: FileCheck },
        { title: "Balanço Patrimonial", url: "/balance-sheet", icon: Scale },
        { title: "DRE", url: "/dre", icon: TrendingUp },
      ],
    },
    {
      label: "Despesas",
      items: [
        { title: "Despesas", url: "/expenses", icon: Wallet },
        { title: "Centro de Custos", url: "/cost-center-analysis", icon: Target },
      ],
    },
    {
      label: "Importações",
      items: [
        { title: "Importar Clientes", url: "/import", icon: Upload },
        { title: "Importar Empresas", url: "/import-companies", icon: Building2 },
        { title: "Importar Boletos", url: "/import-boletos", icon: FileSpreadsheet },
        { title: "Importar Honorários", url: "/import-invoices", icon: FileInput },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        { title: "Agentes de IA", url: "/ai-agents", icon: Bot },
        { title: "Corrigir Lançamentos", url: "/fix-revenue-entries", icon: Wrench },
        { title: "Regularizar Contabilidade", url: "/regularize-accounting", icon: FileCheck },
        { title: "Auditoria de Boletos", url: "/audit-logs", icon: ShieldAlert },
      ],
    },
    {
      label: "Configurações",
      items: [
        { title: "Tipos de Receita", url: "/revenue-types", icon: DollarSign },
        { title: "Configurações do Sistema", url: "/settings", icon: Settings },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
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
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.url);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.url)}
                        isActive={active}
                        tooltip={collapsed ? item.title : undefined}
                      >
                        <Icon className="w-4 h-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
