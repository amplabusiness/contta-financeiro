import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, X, Check, ChevronsUpDown, CalendarDays, Building2, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useClient } from "@/contexts/ClientContext";
import { usePeriod } from "@/contexts/PeriodContext";
import { useOffice } from "@/contexts/OfficeContext";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDocument } from "@/lib/formatters";
// import { useAccountingHealth } from "@/hooks/useAccountingHealth";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { MCPFinanceiroChat } from "@/components/MCPFinanceiroChat";
import { TrialBanner } from "@/components/TrialBanner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LayoutProps {
  children: ReactNode;
}

// Gerar lista de meses para o seletor de período
const generateMonthOptions = () => {
  const months: { value: string; label: string }[] = [];
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const startDate = new Date(2024, 0, 1); // Janeiro 2024
  const endDate = new Date(); // Hoje

  let current = startDate;
  while (current <= endDate) {
    const month = current.getMonth() + 1;
    const year = current.getFullYear();
    const value = `${month}-${year}`;
    const label = `${monthNames[month - 1]} ${year}`;
    months.push({ value, label });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return months.reverse(); // Mais recente primeiro
};

const MONTH_OPTIONS = generateMonthOptions();

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { selectedClientId, selectedClientName, setSelectedClient, clearSelectedClient } = useClient();
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, getFormattedPeriod } = usePeriod();
  const { offices, selectedOfficeId, selectedOfficeName, setSelectedOffice } = useOffice();

  // Ref para prevenir múltiplas chamadas simultâneas
  const isLoadingClientsRef = useRef(false);
  const clientsLoadedRef = useRef(false);

  // Auto-manutenção contábil - roda silenciosamente no background
  // TODO: Reativar quando ai-orchestrator estiver respondendo
  // useAccountingHealth();

  const loadClients = useCallback(async () => {
    // Prevenir chamadas duplicadas
    if (isLoadingClientsRef.current || clientsLoadedRef.current) return;

    isLoadingClientsRef.current = true;
    try {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setClients(data || []);
      clientsLoadedRef.current = true;
    } finally {
      isLoadingClientsRef.current = false;
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      } else {
        loadClients();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
        clientsLoadedRef.current = false; // Reset ao fazer logout
      } else {
        loadClients();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, loadClients]);

  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setSelectedClient(client.id, client.name);
      setOpen(false);
      setSearchTerm("");
      // Não redireciona - mantém o usuário na página atual com os dados filtrados
      toast.success(`Cliente selecionado: ${client.name}`, {
        description: "Todos os dados serão filtrados para este cliente"
      });
    }
  };

  // Filtrar clientes baseado no termo de busca
  const filteredClients = clients.filter((client) => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase().replace(/[^\w\s]/g, '');
    const name = client.name.toLowerCase();
    const cnpj = (client.cnpj || '').replace(/[^\d]/g, '');
    const cpf = (client.cpf || '').replace(/[^\d]/g, '');
    
    return name.includes(term) || cnpj.includes(term) || cpf.includes(term);
  });

  const handleClearClient = () => {
    clearSelectedClient();
    // Não redireciona - mantém o usuário na página atual mostrando dados gerais
    toast.info("Filtro de cliente removido", {
      description: "Mostrando dados de todos os clientes"
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Obter iniciais do usuário
  const getUserInitials = () => {
    const email = session?.user?.email || "";
    const name = session?.user?.user_metadata?.full_name || email;
    return name
      .split(" ")
      .map((n: string) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";
  };

  return (
    <SidebarProvider>
      <TooltipProvider>
      <div className="flex flex-col min-h-screen w-full">
        <TrialBanner />
        <div className="flex flex-1">
        <AppSidebar />

        <div className="flex-1 flex flex-col w-full">
          <header className="min-h-14 sm:h-16 border-b bg-gradient-to-r from-background to-muted/30 backdrop-blur-sm flex items-center justify-between px-3 sm:px-6 sticky top-0 z-10 gap-2 sm:gap-4 py-2 sm:py-0 shadow-sm">
            {/* Lado Esquerdo: Menu Toggle + Busca de Cliente */}
            <div className="flex items-center gap-2 sm:gap-3">
              <SidebarTrigger className="hover:bg-primary/10 transition-colors" />

              {/* Separador visual */}
              <div className="hidden sm:block h-6 w-px bg-border" />

              {/* Seletor de Cliente Melhorado */}
              <div className="flex items-center">
                {selectedClientId ? (
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 transition-all hover:bg-primary/15">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium max-w-[150px] sm:max-w-[200px] truncate">{selectedClientName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearClient}
                      className="h-5 w-5 p-0 rounded-full hover:bg-destructive/20 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[180px] sm:w-[220px] justify-between rounded-full border-dashed hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground font-normal">Buscar cliente...</span>
                        </div>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] sm:w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Digite nome, CPF ou CNPJ..."
                          value={searchTerm}
                          onValueChange={setSearchTerm}
                          className="border-none focus:ring-0"
                        />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                            Nenhum cliente encontrado.
                          </CommandEmpty>
                          <CommandGroup heading={`${filteredClients.length} cliente${filteredClients.length !== 1 ? 's' : ''}`}>
                            {filteredClients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.id}
                                onSelect={() => handleClientChange(client.id)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                                    selectedClientId === client.id
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    {client.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-medium truncate">{client.name}</span>
                                    {(client.cnpj || client.cpf) && (
                                      <span className="text-xs text-muted-foreground">
                                        {formatDocument(client.cnpj || client.cpf || "")}
                                      </span>
                                    )}
                                  </div>
                                  {selectedClientId === client.id && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            {/* Centro: Filtros Globais */}
            <div className="hidden md:flex items-center gap-3">
              {/* Seletor de Escritório */}
              {offices.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Select
                        value={selectedOfficeId || undefined}
                        onValueChange={(value) => {
                          const office = offices.find(o => o.id === value);
                          if (office) {
                            const name = office.nome_fantasia || office.razao_social;
                            setSelectedOffice(office.id, name);
                            toast.info(`Escritório: ${name}`, {
                              description: "Dados filtrados para este escritório"
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-[140px] lg:w-[160px] border-dashed hover:border-primary transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-sm">{selectedOfficeName || "Escritório"}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {offices.map((office) => (
                            <SelectItem key={office.id} value={office.id}>
                              {office.nome_fantasia || office.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{selectedOfficeName || "Filtrar por escritório"}</TooltipContent>
                </Tooltip>
              )}

              {/* Separador */}
              {offices.length > 0 && <div className="h-6 w-px bg-border" />}

              {/* Seletor de Período */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <Select
                      value={`${selectedMonth}-${selectedYear}`}
                      onValueChange={(value) => {
                        const [month, year] = value.split("-").map(Number);
                        setSelectedMonth(month);
                        setSelectedYear(year);
                        toast.info(`Período: ${MONTH_OPTIONS.find(m => m.value === value)?.label}`, {
                          description: "Relatórios filtrados para este período"
                        });
                      }}
                    >
                      <SelectTrigger className="w-[140px] lg:w-[160px] border-dashed hover:border-primary transition-colors">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-muted-foreground" />
                          <SelectValue placeholder="Período" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Período de referência</TooltipContent>
              </Tooltip>
            </div>

            {/* Lado Direito: Ações do Usuário */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Botão de Configurações (Mobile: mostra filtros) */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filtros</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {offices.length > 0 && (
                      <div className="px-2 py-1.5">
                        <label className="text-xs text-muted-foreground mb-1 block">Escritório</label>
                        <Select
                          value={selectedOfficeId || undefined}
                          onValueChange={(value) => {
                            const office = offices.find(o => o.id === value);
                            if (office) {
                              const name = office.nome_fantasia || office.razao_social;
                              setSelectedOffice(office.id, name);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {offices.map((office) => (
                              <SelectItem key={office.id} value={office.id}>
                                {office.nome_fantasia || office.razao_social}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="px-2 py-1.5">
                      <label className="text-xs text-muted-foreground mb-1 block">Período</label>
                      <Select
                        value={`${selectedMonth}-${selectedYear}`}
                        onValueChange={(value) => {
                          const [month, year] = value.split("-").map(Number);
                          setSelectedMonth(month);
                          setSelectedYear(year);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Separador */}
              <div className="hidden sm:block h-6 w-px bg-border" />

              {/* Menu do Usuário */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:ring-2 hover:ring-primary/20 transition-all">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session?.user?.user_metadata?.full_name || "Usuário"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/billing")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Faturamento
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
        </div>
      </div>
      <ConnectionStatus />
      <MCPFinanceiroChat />
      </TooltipProvider>
    </SidebarProvider>
  );
}
