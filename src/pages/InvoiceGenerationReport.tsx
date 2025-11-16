import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, AlertTriangle, DollarSign, UserX } from "lucide-react";
import { toast } from "sonner";

interface ClientReport {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  monthly_fee: number;
  status: string;
  is_pro_bono: boolean;
  invoices_2025: number;
  reason: string;
  has_invoices: boolean;
}

export default function InvoiceGenerationReport() {
  const [clients, setClients] = useState<ClientReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'generated' | 'not_generated'>('all');
  const [stats, setStats] = useState({
    total: 0,
    generated: 0,
    notGenerated: 0,
    inactive: 0,
    noFee: 0,
    proBono: 0
  });

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);

      // Get all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, cnpj, cpf, monthly_fee, status, is_pro_bono')
        .order('name');

      if (clientsError) throw clientsError;

      // Get all invoices for 2025
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('client_id, competence')
        .like('competence', '%/2025');

      if (invoicesError) throw invoicesError;

      // Create a map of client invoices
      const invoicesByClient = new Map<string, number>();
      invoicesData?.forEach(inv => {
        const count = invoicesByClient.get(inv.client_id) || 0;
        invoicesByClient.set(inv.client_id, count + 1);
      });

      // Process clients and determine reasons
      const report: ClientReport[] = (clientsData || []).map(client => {
        const invoiceCount = invoicesByClient.get(client.id) || 0;
        const hasInvoices = invoiceCount > 0;
        
        let reason = '';
        if (hasInvoices) {
          reason = `✅ ${invoiceCount} honorários gerados`;
        } else if (client.status !== 'active') {
          reason = '❌ Cliente inativo';
        } else if (client.is_pro_bono) {
          reason = '🤝 Cliente Pro Bono';
        } else if (!client.monthly_fee || client.monthly_fee <= 0) {
          reason = '💰 Sem honorário mensal definido';
        } else {
          reason = '⚠️ Erro desconhecido - deveria ter sido gerado';
        }

        return {
          ...client,
          invoices_2025: invoiceCount,
          has_invoices: hasInvoices,
          reason
        };
      });

      // Calculate statistics
      const stats = {
        total: report.length,
        generated: report.filter(c => c.has_invoices).length,
        notGenerated: report.filter(c => !c.has_invoices).length,
        inactive: report.filter(c => c.status !== 'active').length,
        noFee: report.filter(c => (!c.monthly_fee || c.monthly_fee <= 0) && c.status === 'active').length,
        proBono: report.filter(c => c.is_pro_bono && c.status === 'active').length
      };

      setClients(report);
      setStats(stats);
      
    } catch (error: any) {
      console.error('Error loading report:', error);
      toast.error('Erro ao carregar relatório', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    if (filter === 'generated') return client.has_invoices;
    if (filter === 'not_generated') return !client.has_invoices;
    return true;
  });

  const getStatusIcon = (hasInvoices: boolean, reason: string) => {
    if (hasInvoices) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (reason.includes('inativo')) return <UserX className="h-5 w-5 text-gray-400" />;
    if (reason.includes('Pro Bono')) return <AlertTriangle className="h-5 w-5 text-blue-500" />;
    if (reason.includes('Sem honorário')) return <DollarSign className="h-5 w-5 text-orange-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">📊 Relatório de Geração de Honorários 2025</h1>
          <p className="text-muted-foreground">
            Análise detalhada de quais clientes tiveram honorários gerados e os motivos das exclusões
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Honorários Gerados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.generated}</div>
              <p className="text-xs text-muted-foreground">
                {((stats.generated / stats.total) * 100).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Não Gerados</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.notGenerated}</div>
              <p className="text-xs text-muted-foreground">
                {((stats.notGenerated / stats.total) * 100).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Motivos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Inativos:</span>
                  <span className="font-medium">{stats.inactive}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sem Fee:</span>
                  <span className="font-medium">{stats.noFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pro Bono:</span>
                  <span className="font-medium">{stats.proBono}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhamento por Cliente</CardTitle>
              <div className="flex items-center gap-4">
                <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos ({stats.total})</SelectItem>
                    <SelectItem value="generated">Gerados ({stats.generated})</SelectItem>
                    <SelectItem value="not_generated">Não Gerados ({stats.notGenerated})</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={loadReport} variant="outline" size="sm">
                  Atualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Honorário Mensal</TableHead>
                    <TableHead className="text-center">Honorários 2025</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          {getStatusIcon(client.has_invoices, client.reason)}
                        </TableCell>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {client.cnpj || client.cpf || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {client.monthly_fee > 0 
                            ? client.monthly_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={client.has_invoices ? "default" : "secondary"}>
                            {client.invoices_2025}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.status === 'active' ? "default" : "secondary"}>
                            {client.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{client.reason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💡 Entendendo os Motivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Honorários Gerados</p>
                <p className="text-sm text-muted-foreground">
                  Cliente ativo com honorário mensal definido. Foram gerados 13 honorários (12 meses + balanço).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <UserX className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium">Cliente Inativo</p>
                <p className="text-sm text-muted-foreground">
                  Cliente marcado como inativo no cadastro. Não gera honorários automaticamente.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">Sem Honorário Mensal</p>
                <p className="text-sm text-muted-foreground">
                  Cliente ativo mas sem valor de honorário mensal definido (R$ 0,00 ou vazio). 
                  Edite o cadastro do cliente para definir o valor.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">Cliente Pro Bono</p>
                <p className="text-sm text-muted-foreground">
                  Cliente marcado como Pro Bono. Não gera honorários automaticamente durante o período definido.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium">Erro Desconhecido</p>
                <p className="text-sm text-muted-foreground">
                  Cliente ativo com honorário definido mas os honorários não foram gerados. 
                  Entre em contato com o suporte ou tente gerar novamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
