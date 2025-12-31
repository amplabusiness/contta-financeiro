import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, X, Check, ChevronsUpDown, CalendarDays, Building2 } from "lucide-react";
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
import { useAccountingHealth } from "@/hooks/useAccountingHealth";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { MCPFinanceiroChat } from "@/components/MCPFinanceiroChat";

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col w-full">
          <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10 gap-4">
            <SidebarTrigger />
            
            <div className="flex items-center gap-4 flex-1 max-w-md">
              {selectedClientId ? (
                <div className="flex items-center gap-2 flex-1 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium flex-1">{selectedClientName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearClient}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="flex-1 justify-between"
                      >
                        {selectedClientId
                          ? clients.find((client) => client.id === selectedClientId)?.name
                          : "Selecione um cliente"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Digite o nome, CPF ou CNPJ do cliente..." 
                          value={searchTerm}
                          onValueChange={setSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {filteredClients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.id}
                                onSelect={() => handleClientChange(client.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{client.name}</span>
                                  {(client.cnpj || client.cpf) && (
                                    <span className="text-xs text-muted-foreground">
                                      {formatDocument(client.cnpj || client.cpf || "")}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Seletor de Escritório Global */}
            {offices.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={selectedOfficeId || undefined}
                  onValueChange={(value) => {
                    const office = offices.find(o => o.id === value);
                    if (office) {
                      const name = office.nome_fantasia || office.razao_social;
                      setSelectedOffice(office.id, name);
                      toast.info(`Escritório: ${name}`, {
                        description: "Todos os dados serão filtrados para este escritório"
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Escritório">
                      {selectedOfficeName || "Selecione"}
                    </SelectValue>
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

            {/* Seletor de Período Global */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <Select
                value={`${selectedMonth}-${selectedYear}`}
                onValueChange={(value) => {
                  const [month, year] = value.split("-").map(Number);
                  setSelectedMonth(month);
                  setSelectedYear(year);
                  toast.info(`Período alterado para ${MONTH_OPTIONS.find(m => m.value === value)?.label}`, {
                    description: "Todos os relatórios serão filtrados para este período"
                  });
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Período" />
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

            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <ConnectionStatus />
      <MCPFinanceiroChat />
    </SidebarProvider>
  );
}
