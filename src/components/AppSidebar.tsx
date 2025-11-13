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
  DollarSign,
} from "lucide-react";
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

const menuGroups = [
  {
    label: "Gestão",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Clientes", url: "/clients", icon: Users },
      { title: "Honorários", url: "/invoices", icon: FileText },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Despesas", url: "/expenses", icon: Wallet },
      { title: "DRE", url: "/dre", icon: TrendingUp },
      { title: "Inadimplência", url: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Tipos de Receita", url: "/revenue-types", icon: DollarSign },
      { title: "Plano de Contas", url: "/chart-of-accounts", icon: FolderTree },
      { title: "Importar", url: "/import", icon: Upload },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

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
