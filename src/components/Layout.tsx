import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, X } from "lucide-react";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClient } from "@/contexts/ClientContext";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const { selectedClientId, selectedClientName, setSelectedClient, clearSelectedClient } = useClient();

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
      } else {
        loadClients();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("status", "active")
      .order("name");
    setClients(data || []);
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setSelectedClient(client.id, client.name);
      // Só navega para client-dashboard se não estiver na página de clientes
      if (location.pathname !== "/clients") {
        navigate("/client-dashboard");
      }
    }
  };

  const handleClearClient = () => {
    clearSelectedClient();
    // Só redireciona para o dashboard se não estiver na página de clientes
    if (location.pathname !== "/clients") {
      navigate("/dashboard");
    }
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
                  <Select value={selectedClientId || ""} onValueChange={handleClientChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
