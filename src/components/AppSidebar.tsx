import { useLocation, useNavigate } from "react-router-dom";
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
  Settings,
  CreditCard,
  GitMerge,
  Clipboard,
  LineChart,
  Heart,
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
        { title: "Fluxo de Caixa", url: "/cash-flow", icon: TrendingUp },
        { title: "Dashboard de Cobrança", url: "/collection-dashboard", icon: AlertTriangle },
        ...(selectedClientId ? [{ title: selectedClientName || "Cliente Selecionado", url: "/client-dashboard", icon: UserSquare2 }] : []),
      ],
    },
    {
      label: "Clientes",
      items: [
        { title: "Lista de Clientes", url: "/clients", icon: Users },
        { title: "Clientes Pro-Bono", url: "/pro-bono-clients", icon: Heart },
        { title: "Enriquecimento de Dados", url: "/client-enrichment", icon: Database },
        { title: "Processamento em Lote", url: "/batch-enrichment", icon: Zap },
      ],
    },
    {
      label: "Contratos",
      items: [
        { title: "Contratos de Serviço", url: "/contracts", icon: FileText },
      ],
    },
    {
      label: "Receitas",
      items: [
        { title: "🎯 Análise de Honorários", url: "/fees-analysis", icon: TrendingUp },
        { title: "Honorários a Receber", url: "/invoices", icon: CreditCard },
        { title: "Ordens de Serviço", url: "/collection-work-orders", icon: Clipboard },
        { title: "Razão do Cliente", url: "/client-ledger", icon: BookOpen },
        { title: "Análise de Ausências", url: "/boleto-gaps", icon: Calendar },
        { title: "Análise de Inadimplência", url: "/default-analysis", icon: AlertTriangle },
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
        { title: "Razão Geral", url: "/razao-geral", icon: BookOpen },
        { title: "Balancete", url: "/balancete", icon: FileCheck },
        { title: "Balanço Patrimonial", url: "/balance-sheet", icon: Scale },
        { title: "DRE", url: "/dre", icon: TrendingUp },
      ],
    },
    {
      label: "Despesas",
      items: [
        { title: "Despesas", url: "/expenses", icon: Wallet },
        { title: "Contas a Pagar", url: "/accounts-payable", icon: CreditCard },
        { title: "Centro de Custos", url: "/cost-center-analysis", icon: Target },
      ],
    },
    {
      label: "Análises Estratégicas",
      items: [
        { title: "Rentabilidade e Lucro", url: "/profitability-analysis", icon: LineChart },
        { title: "Grupos Econômicos", url: "/economic-group-analysis", icon: Users },
      ],
    },
    {
      label: "Importações",
      items: [
        { title: "Importar Clientes", url: "/import", icon: Upload },
        { title: "Importar Empresas", url: "/import-companies", icon: Building2 },
        { title: "Importar Boletos", url: "/import-boletos", icon: FileSpreadsheet },
        { title: "Importar Honorários", url: "/import-invoices", icon: FileInput },
        { title: "📊 Processar Planilha Honorários", url: "/import-honorarios", icon: FileSpreadsheet },
        { title: "Relatório Completo", url: "/import-boleto-report", icon: FileSpreadsheet },
        { title: "Inadimplência", url: "/import-default-report", icon: AlertTriangle },
        { title: "Dashboard de Relatórios", url: "/boleto-reports-dashboard", icon: BarChart4 },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        { title: "Dashboard de IA", url: "/ai-insights", icon: Brain },
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
