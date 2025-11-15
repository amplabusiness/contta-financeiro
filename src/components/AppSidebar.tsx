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
  BookText,
  Bot,
  Target,
  Activity,
  FileInput,
  FileWarning,
  AlertTriangle,
  Database,
  Scale,
  Wrench,
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

  const menuGroups = selectedClientId
    ? [
        {
          label: "Gestão",
          items: [
            { title: "Dashboard Geral", url: "/dashboard", icon: LayoutDashboard },
            { title: "Dashboard Executivo", url: "/executive-dashboard", icon: PieChart },
            { title: selectedClientName || "Cliente", url: "/client-dashboard", icon: UserSquare2 },
            { title: "Clientes", url: "/clients", icon: Users },
          ],
        },
        {
          label: "Financeiro",
          items: [
            { title: "Razão do Cliente", url: "/client-ledger", icon: BookOpen },
            { title: "Honorários", url: "/invoices", icon: FileText },
            { title: "Despesas", url: "/expenses", icon: Wallet },
            { title: "Conciliação Bancária", url: "/bank-reconciliation", icon: RefreshCw },
          ],
        },
      ]
    : [
        {
          label: "Dashboards",
          items: [
            { title: "Dashboard Principal", url: "/dashboard", icon: LayoutDashboard },
            { title: "Dashboard Executivo", url: "/executive-dashboard", icon: PieChart },
            { title: "Dashboard de Cobrança", url: "/collection-dashboard", icon: DollarSign },
          ],
        },
        {
          label: "Clientes",
          items: [
            { title: "Lista de Clientes", url: "/clients", icon: Users },
            { title: "Enriquecimento", url: "/client-enrichment", icon: Database },
            { title: "Processamento em Lote", url: "/batch-enrichment", icon: Zap },
            { title: "Mesclar Clientes", url: "/merge-clients", icon: Users },
          ],
        },
        {
          label: "💰 Receitas",
          items: [
            { title: "🎯 Análise de Honorários", url: "/fees-analysis", icon: Target },
            { title: "Honorários a Receber", url: "/invoices", icon: FileText },
            { title: "Ordens de Serviço", url: "/service-orders", icon: FileInput },
            { title: "Razão do Cliente", url: "/client-ledger", icon: BookOpen },
            { title: "Análise de Ausências", url: "/boleto-gaps", icon: Calendar },
            { title: "Inadimplência", url: "/reports", icon: BarChart3 },
            { title: "Cartas de Cobrança", url: "/collection-letters", icon: FileText },
          ],
        },
        {
          label: "🔄 Conciliação",
          items: [
            { title: "Conciliação Bancária", url: "/bank-reconciliation", icon: RefreshCw },
            { title: "Reconciliação PIX", url: "/pix-reconciliation", icon: Zap },
            { title: "PIX sem Cliente", url: "/unmatched-pix-report", icon: AlertTriangle },
            { title: "Dashboard Conciliação", url: "/reconciliation-dashboard", icon: Activity },
            { title: "Relatório Divergências", url: "/reconciliation-discrepancies", icon: FileWarning },
          ],
        },
        {
          label: "📚 Contabilidade",
          items: [
            { title: "Plano de Contas", url: "/chart-of-accounts", icon: FolderTree },
            { title: "Livro Diário", url: "/journal", icon: BookText },
            { title: "Livro Razão", url: "/general-ledger", icon: BookOpen },
            { title: "Balancete", url: "/trial-balance", icon: BookText },
            { title: "Balanço Patrimonial", url: "/balance-sheet", icon: Scale },
            { title: "DRE", url: "/dre", icon: TrendingUp },
          ],
        },
        {
          label: "💳 Despesas",
          items: [
            { title: "Despesas", url: "/expenses", icon: Wallet },
            { title: "Centro de Custos", url: "/cost-center-analysis", icon: Target },
          ],
        },
        {
          label: "📊 Análises Estratégicas",
          items: [
            { title: "Rentabilidade e Lucro", url: "/profitability-analysis", icon: TrendingUp },
            { title: "Grupos Econômicos", url: "/economic-groups", icon: Users },
          ],
        },
        {
          label: "📥 Importações",
          items: [
            { title: "Importar Clientes", url: "/import", icon: Upload },
            { title: "Importar Empresas", url: "/import-companies", icon: Building2 },
            { title: "Importar Boletos", url: "/import-boletos", icon: FileSpreadsheet },
            { title: "Importar Honorários", url: "/import-invoices", icon: FileInput },
          ],
        },
        {
          label: "🔧 Ferramentas",
          items: [
            { title: "🤖 Agentes de IA", url: "/ai-agents", icon: Bot },
            { title: "Corrigir Lançamentos", url: "/fix-revenue-entries", icon: Wrench },
            { title: "Regularizar Contabilidade", url: "/regularize-accounting", icon: RefreshCw },
            { title: "Auditoria de Boletos", url: "/audit-logs", icon: ShieldAlert },
          ],
        },
        {
          label: "⚙️ Configurações",
          items: [
            { title: "Tipos de Receita", url: "/revenue-types", icon: DollarSign },
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
