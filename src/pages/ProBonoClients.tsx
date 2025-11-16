import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Loader2, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ProBonoClients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalWaived: 0
  });

  useEffect(() => {
    loadProBonoClients();
  }, []);

  const loadProBonoClients = async () => {
    try {
      setLoading(true);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Buscar clientes pro-bono (marcados como pro-bono OU com honorário zerado)
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select(`
          *,
          invoices (
            id,
            amount,
            due_date,
            status
          )
        `)
        .or("is_pro_bono.eq.true,monthly_fee.eq.0")
        .order("name");

      if (clientsError) throw clientsError;

      // Calcular estatísticas
      const enrichedClients = (clientsData || []).map((client: any) => {
        const invoices = client.invoices || [];
        const totalInvoices = invoices.length;
        const totalWaived = client.monthly_fee * totalInvoices;
        
        return {
          ...client,
          totalInvoices,
          totalWaived
        };
      });

      setClients(enrichedClients);

      // Calcular estatísticas gerais
      const total = enrichedClients.length;
      const active = enrichedClients.filter((c: any) => c.status === 'active').length;
      const totalWaived = enrichedClients.reduce((sum: number, c: any) => sum + c.totalWaived, 0);

      setStats({ total, active, totalWaived });
    } catch (error: any) {
      console.error("Erro ao carregar clientes pro-bono:", error);
      toast.error("Erro ao carregar clientes pro-bono");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      inactive: "secondary"
    };
    
    const labels: Record<string, string> = {
      active: "Ativo",
      inactive: "Inativo"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Heart className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Clientes Pro-Bono</h1>
            <p className="text-muted-foreground">
              Clientes sem honorários ou com atendimento gratuito
            </p>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pro-Bono
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Honorários Dispensados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalWaived)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Valor total estimado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de Pro-Bono
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((stats.total / Math.max(1, stats.total)) * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Do total de clientes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Clientes Pro-Bono */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes Pro-Bono</CardTitle>
            <CardDescription>
              {clients.length} cliente{clients.length !== 1 ? 's' : ''} encontrado{clients.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente pro-bono cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Honorário Mensal</TableHead>
                      <TableHead>Período Pro-Bono</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Valor Dispensado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {client.is_pro_bono && (
                              <Heart className="h-4 w-4 text-primary" />
                            )}
                            {client.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {client.cnpj || "-"}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(client.status)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(client.monthly_fee)}
                        </TableCell>
                        <TableCell>
                          {client.pro_bono_start_date ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {formatDate(client.pro_bono_start_date)}
                              {client.pro_bono_end_date && (
                                <> até {formatDate(client.pro_bono_end_date)}</>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.pro_bono_reason ? (
                            <div className="flex items-center gap-1 text-sm max-w-xs truncate">
                              <FileText className="h-3 w-3 flex-shrink-0" />
                              <span title={client.pro_bono_reason}>
                                {client.pro_bono_reason}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(client.totalWaived)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ProBonoClients;
