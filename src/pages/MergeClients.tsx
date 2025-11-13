import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GitMerge, AlertTriangle, CheckCircle2, FileText, DollarSign, Users } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface ClientWithStats {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  invoices_count: number;
  ledger_count: number;
  total_revenue: number;
  created_at: string;
}

interface DuplicateGroup {
  cnpj: string;
  clients: ClientWithStats[];
}

const MergeClients = () => {
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [primaryClientId, setPrimaryClientId] = useState<string>("");
  const [clientsToMerge, setClientsToMerge] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    findDuplicates();
  }, []);

  const findDuplicates = async () => {
    setLoading(true);
    try {
      // Buscar todos os clientes
      const { data: allClients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: true });

      if (clientsError) throw clientsError;

      // Agrupar por CNPJ normalizado
      const cnpjGroups: { [key: string]: any[] } = {};
      
      for (const client of allClients || []) {
        if (client.cnpj && client.cnpj.trim()) {
          const normalized = client.cnpj.replace(/[^\d]/g, '');
          if (normalized) {
            if (!cnpjGroups[normalized]) {
              cnpjGroups[normalized] = [];
            }
            cnpjGroups[normalized].push(client);
          }
        }
      }

      // Filtrar apenas grupos com duplicatas
      const duplicateGroups = Object.entries(cnpjGroups)
        .filter(([_, clients]) => clients.length > 1)
        .map(([cnpj, clients]) => ({ cnpj, clients: clients as any[] }));

      // Buscar estatísticas para cada cliente
      const enrichedGroups: DuplicateGroup[] = [];
      
      for (const group of duplicateGroups) {
        const enrichedClients: ClientWithStats[] = [];
        
        for (const client of group.clients) {
          // Contar faturas
          const { count: invoicesCount } = await supabase
            .from("invoices")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id);

          // Contar movimentações
          const { count: ledgerCount } = await supabase
            .from("client_ledger")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id);

          // Calcular receita total
          const { data: invoices } = await supabase
            .from("invoices")
            .select("amount")
            .eq("client_id", client.id)
            .eq("status", "paid");

          const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

          enrichedClients.push({
            ...client,
            invoices_count: invoicesCount || 0,
            ledger_count: ledgerCount || 0,
            total_revenue: totalRevenue,
          });
        }

        enrichedGroups.push({
          cnpj: group.cnpj,
          clients: enrichedClients.sort((a, b) => b.invoices_count - a.invoices_count),
        });
      }

      setDuplicates(enrichedGroups);
      
      if (enrichedGroups.length === 0) {
        toast.success("Nenhum cliente duplicado encontrado!");
      } else {
        toast.info(`${enrichedGroups.length} grupo(s) de clientes duplicados encontrado(s)`);
      }
    } catch (error: any) {
      toast.error("Erro ao buscar duplicatas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openMergeDialog = (group: DuplicateGroup) => {
    setSelectedGroup(group);
    setPrimaryClientId(group.clients[0].id); // Sugerir o primeiro (com mais faturas)
    setClientsToMerge(new Set(group.clients.slice(1).map(c => c.id))); // Selecionar os outros
    setMergeDialogOpen(true);
  };

  const toggleClientToMerge = (clientId: string) => {
    const newSet = new Set(clientsToMerge);
    if (newSet.has(clientId)) {
      newSet.delete(clientId);
    } else {
      newSet.add(clientId);
    }
    setClientsToMerge(newSet);
  };

  const handleMerge = async () => {
    if (!primaryClientId || clientsToMerge.size === 0) {
      toast.error("Selecione o cliente principal e pelo menos um cliente para mesclar");
      return;
    }

    if (clientsToMerge.has(primaryClientId)) {
      toast.error("O cliente principal não pode estar na lista de clientes a mesclar");
      return;
    }

    setMerging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const clientIdsToMerge = Array.from(clientsToMerge);

      // 1. Transferir todas as faturas
      for (const clientId of clientIdsToMerge) {
        const { error: invoicesError } = await supabase
          .from("invoices")
          .update({ client_id: primaryClientId })
          .eq("client_id", clientId);

        if (invoicesError) throw invoicesError;
      }

      // 2. Transferir todas as movimentações do ledger
      for (const clientId of clientIdsToMerge) {
        const { error: ledgerError } = await supabase
          .from("client_ledger")
          .update({ client_id: primaryClientId })
          .eq("client_id", clientId);

        if (ledgerError) throw ledgerError;
      }

      // 3. Criar log de auditoria (simplificado - guardar em notes dos clientes)
      const primaryClient = selectedGroup?.clients.find(c => c.id === primaryClientId);
      const mergedClients = selectedGroup?.clients.filter(c => clientIdsToMerge.includes(c.id));

      // 4. Marcar clientes mesclados como inativos
      for (const clientId of clientIdsToMerge) {
        const { error: statusError } = await supabase
          .from("clients")
          .update({ 
            status: "inactive",
            notes: `Mesclado com: ${primaryClient?.name} em ${new Date().toLocaleDateString()}`
          })
          .eq("id", clientId);

        if (statusError) console.error("Erro ao atualizar status:", statusError);
      }

      toast.success(`${clientIdsToMerge.length} cliente(s) mesclado(s) com sucesso!`, {
        description: "Todas as faturas e movimentações foram transferidas.",
      });

      setMergeDialogOpen(false);
      setSelectedGroup(null);
      setPrimaryClientId("");
      setClientsToMerge(new Set());
      findDuplicates();
    } catch (error: any) {
      toast.error("Erro ao mesclar clientes: " + error.message);
    } finally {
      setMerging(false);
    }
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "-";
    const cleaned = cnpj.replace(/[^\d]/g, '');
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mesclar Clientes Duplicados</h1>
            <p className="text-muted-foreground mt-1">
              Identifique e mescle clientes com o mesmo CNPJ
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5" />
                  Identificação de Duplicatas
                </CardTitle>
                <CardDescription>
                  Clientes com o mesmo CNPJ que podem ser mesclados
                </CardDescription>
              </div>
              <Button onClick={findDuplicates} disabled={loading}>
                Buscar Duplicatas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Procurando clientes duplicados...
              </div>
            ) : duplicates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>Nenhum cliente duplicado encontrado</p>
              </div>
            ) : (
              <div className="space-y-6">
                {duplicates.map((group) => (
                  <Card key={group.cnpj} className="border-orange-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            CNPJ: {formatCNPJ(group.cnpj)}
                          </CardTitle>
                          <CardDescription>
                            {group.clients.length} clientes duplicados encontrados
                          </CardDescription>
                        </div>
                        <Button
                          onClick={() => openMergeDialog(group)}
                          variant="outline"
                          size="sm"
                        >
                          <GitMerge className="h-4 w-4 mr-2" />
                          Mesclar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">
                              <FileText className="h-4 w-4 inline mr-1" />
                              Faturas
                            </TableHead>
                            <TableHead className="text-center">
                              <DollarSign className="h-4 w-4 inline mr-1" />
                              Movimentações
                            </TableHead>
                            <TableHead className="text-right">Receita Total</TableHead>
                            <TableHead>Criado em</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.clients.map((client) => (
                            <TableRow key={client.id}>
                              <TableCell className="font-medium">{client.name}</TableCell>
                              <TableCell>
                                <Badge variant={client.status === "active" ? "default" : "secondary"}>
                                  {client.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{client.invoices_count}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{client.ledger_count}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(client.total_revenue)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(client.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Mesclar Clientes Duplicados
            </DialogTitle>
            <DialogDescription>
              Selecione qual cliente será mantido (principal) e quais serão mesclados.
              Todas as faturas e movimentações serão transferidas para o cliente principal.
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cliente Principal (será mantido)</label>
                <Select value={primaryClientId} onValueChange={setPrimaryClientId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedGroup.clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} - {client.invoices_count} faturas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Este cliente receberá todas as faturas e movimentações dos outros
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Clientes a Mesclar (serão desativados)</label>
                <div className="space-y-2 border rounded-md p-4">
                  {selectedGroup.clients
                    .filter(c => c.id !== primaryClientId)
                    .map((client) => (
                      <div key={client.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={client.id}
                          checked={clientsToMerge.has(client.id)}
                          onCheckedChange={() => toggleClientToMerge(client.id)}
                        />
                        <label
                          htmlFor={client.id}
                          className="flex-1 text-sm cursor-pointer flex items-center justify-between"
                        >
                          <span>{client.name}</span>
                          <span className="text-muted-foreground">
                            {client.invoices_count} faturas, {client.ledger_count} movimentações
                          </span>
                        </label>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Estes clientes serão marcados como inativos após a mesclagem
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-900 mb-1">Atenção</p>
                    <ul className="list-disc list-inside text-orange-800 space-y-1">
                      <li>Esta ação não pode ser desfeita automaticamente</li>
                      <li>Todas as faturas serão transferidas para o cliente principal</li>
                      <li>Todas as movimentações do ledger serão transferidas</li>
                      <li>Os clientes mesclados serão marcados como inativos</li>
                      <li>Um log de auditoria será criado para rastreamento</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeDialogOpen(false)}
              disabled={merging}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || clientsToMerge.size === 0}
            >
              {merging ? "Mesclando..." : `Mesclar ${clientsToMerge.size} Cliente(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
};

export default MergeClients;
