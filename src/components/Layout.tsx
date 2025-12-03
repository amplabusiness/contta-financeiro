import { ReactNode, useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, clearSupabaseAuthState } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, X, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useClient } from "@/contexts/ClientContext";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDocument } from "@/lib/formatters";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { selectedClientId, selectedClientName, setSelectedClient, clearSelectedClient } = useClient();

  const loadClients = useCallback(async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("status", "active")
      .order("name");
    setClients(data || []);
  }, [setClients]);

  const handleSessionError = useCallback(
    async (message?: string) => {
      clearSupabaseAuthState();
      setSession(null);
      setLoading(false);
      toast.error(message ?? "Não foi possível validar sua sessão. Faça login novamente.");
      try {
        await supabase.auth.signOut();
      } catch {
        // Sessão já pode estar inválida
      }
      navigate("/auth", { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        const errorMessage = error.message?.toLowerCase().includes("refresh token")
          ? "Sua sessão expirou. Faça login novamente."
          : "Não foi possível validar sua sessão. Faça login novamente.";
        await handleSessionError(errorMessage);
        return;
      }

      const currentSession = data.session;
      setSession(currentSession);
      setLoading(false);

      if (!currentSession) {
        navigate("/auth");
      } else {
        void loadClients();
      }
    };

    void initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const eventName = event as string;
      if (eventName === "TOKEN_REFRESH_FAILED") {
        await handleSessionError("Sua sessão expirou. Faça login novamente.");
        return;
      }

      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        void loadClients();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, loadClients, handleSessionError]);

  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setSelectedClient(client.id, client.name);
      setOpen(false);
      setSearchTerm("");
      
      // Verifica se o cliente é pro-bono ou não
      const isProBono = client.monthly_fee === 0;
      const isOnClientsPage = location.pathname === "/clients";
      const isOnProBonoPage = location.pathname === "/pro-bono-clients";
      
      // Se estiver na página de clientes mas o cliente é pro-bono, vai para pro-bono
      if (isOnClientsPage && isProBono) {
        navigate("/pro-bono-clients");
      }
      // Se estiver na página de pro-bono mas o cliente não é pro-bono, vai para clientes
      else if (isOnProBonoPage && !isProBono) {
        navigate("/clients");
      }
      // Só navega para client-dashboard se não estiver em páginas que devem manter o filtro
      else if (!isOnClientsPage && !isOnProBonoPage) {
        navigate("/client-dashboard");
      }
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
    // Só redireciona para o dashboard se não estiver em páginas que devem manter o filtro
    if (location.pathname !== "/clients" && location.pathname !== "/pro-bono-clients") {
      navigate("/dashboard");
    }
  };

  const handleSignOut = async () => {
    clearSupabaseAuthState();
    await supabase.auth.signOut();
    setSession(null);
    setLoading(false);
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
    </SidebarProvider>
  );
}
