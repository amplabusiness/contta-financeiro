import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Loader2, Calendar, FileText, Edit, DollarSign, Trash2, Eye, AlertCircle, GitMerge, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClient } from "@/contexts/ClientContext";
import { EconomicGroupIndicator } from "@/components/EconomicGroupIndicator";
import { formatDocument } from "@/lib/formatters";
import { FinancialGroupBadge } from "@/components/FinancialGroupBadge";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "@/lib/utils";

const ProBonoClients = () => {
  const navigate = useNavigate();
  const { selectedClientId } = useClient();
  const [clients, setClients] = useState<any[]>([]);
  const [clientsWithoutFee, setClientsWithoutFee] = useState<any[]>([]);
  const [allClientsForGroups, setAllClientsForGroups] = useState<any[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<Map<string, { groupName: string; mainPayerName: string; isMainPayer: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [viewMode, setViewMode] = useState<"pro_bono" | "without_fee">("pro_bono");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalWaived: 0,
    withoutFee: 0,
    inGroups: 0,
    needsAction: 0
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [deletingClient, setDeletingClient] = useState<any>(null);
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [formData, setFormData] = useState({
    is_pro_bono: false,
    pro_bono_start_date: "",
    pro_bono_end_date: "",
    pro_bono_reason: "",
    monthly_fee: "",
    payment_day: ""
  });

  useEffect(() => {
    loadProBonoClients();
  }, [statusFilter]);

  const loadProBonoClients = async () => {
    try {
      setLoading(true);

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Buscar clientes Pro-Bono (marcados explicitamente)
      let proBonoQuery = supabase
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
        .eq('is_pro_bono', true);

      // Aplicar filtro de status
      if (statusFilter !== "all") {
        proBonoQuery = proBonoQuery.eq('is_active', statusFilter === 'active');
      }

      const { data: proBonoData, error: proBonoError } = await proBonoQuery.order("name");
      if (proBonoError) throw proBonoError;

      // Buscar clientes SEM honorário definido (monthly_fee = 0 ou NULL) que NÃO são Pro-Bono
      const { data: withoutFeeData, error: withoutFeeError } = await supabase
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
        .eq('is_active', true)
        .neq('is_pro_bono', true)
        .or('monthly_fee.is.null,monthly_fee.eq.0')
        .order("name");

      if (withoutFeeError) throw withoutFeeError;

      // Buscar TODOS os clientes para identificação de grupos econômicos
      const { data: allClientsData, error: allClientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf, qsa, monthly_fee")
        .order("name");

      if (allClientsError) throw allClientsError;
      setAllClientsForGroups(allClientsData || []);

      // Buscar membros de grupos financeiros para identificar quem pertence a grupos
      const { data: groupMembersData } = await supabase
        .from('economic_group_members')
        .select(`
          client_id,
          economic_groups!inner (
            id,
            name,
            main_payer_client_id,
            clients!economic_groups_main_payer_client_id_fkey (
              name
            )
          )
        `);

      // Criar mapa de membros de grupos
      const memberships = new Map<string, { groupName: string; mainPayerName: string; isMainPayer: boolean }>();
      (groupMembersData || []).forEach((member: any) => {
        const group = member.economic_groups;
        memberships.set(member.client_id, {
          groupName: group.name,
          mainPayerName: group.clients?.name || 'Desconhecido',
          isMainPayer: group.main_payer_client_id === member.client_id
        });
      });
      setGroupMemberships(memberships);

      // Enriquecer clientes Pro-Bono
      const enrichedProBono = (proBonoData || []).map((client: any) => {
        const invoices = client.invoices || [];
        const totalInvoices = invoices.length;
        const totalWaived = client.monthly_fee * totalInvoices;

        return {
          ...client,
          totalInvoices,
          totalWaived
        };
      });

      // Enriquecer clientes sem honorário
      const enrichedWithoutFee = (withoutFeeData || []).map((client: any) => {
        const invoices = client.invoices || [];
        const totalInvoices = invoices.length;

        return {
          ...client,
          totalInvoices,
          totalWaived: 0
        };
      });

      setClients(enrichedProBono);
      setClientsWithoutFee(enrichedWithoutFee);

      // Calcular estatísticas gerais
      const total = enrichedProBono.length;
      const active = enrichedProBono.filter((c: any) => c.is_active === true).length;
      const inactive = enrichedProBono.filter((c: any) => c.is_active === false).length;
      const totalWaived = enrichedProBono.reduce((sum: number, c: any) => sum + c.totalWaived, 0);
      const withoutFee = enrichedWithoutFee.length;

      // Contar quantos clientes sem honorário pertencem a grupos
      const inGroups = enrichedWithoutFee.filter((c: any) => memberships.has(c.id)).length;
      const needsAction = withoutFee - inGroups;

      setStats({ total, active, inactive, totalWaived, withoutFee, inGroups, needsAction });
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

  const handleEditClick = (client: any) => {
    setEditingClient(client);
    setFormData({
      is_pro_bono: client.is_pro_bono || false,
      pro_bono_start_date: client.pro_bono_start_date || "",
      pro_bono_end_date: client.pro_bono_end_date || "",
      pro_bono_reason: client.pro_bono_reason || "",
      monthly_fee: client.monthly_fee?.toString() || "",
      payment_day: client.payment_day?.toString() || ""
    });
    setEditDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!editingClient) return;

    try {
      // Validações
      if (!formData.is_pro_bono && (!formData.monthly_fee || parseFloat(formData.monthly_fee) <= 0)) {
        toast.error("Informe o valor do honorário mensal para clientes pagos");
        return;
      }

      if (!formData.is_pro_bono && !formData.payment_day) {
        toast.error("Informe o dia de pagamento para clientes pagos");
        return;
      }

      if (formData.is_pro_bono && !formData.pro_bono_start_date) {
        toast.error("Informe a data de início do período Pro-Bono");
        return;
      }

      if (formData.is_pro_bono && !formData.pro_bono_reason) {
        toast.error("Informe o motivo/justificativa do Pro-Bono");
        return;
      }

      const updateData: any = {
        is_pro_bono: formData.is_pro_bono,
        monthly_fee: formData.is_pro_bono ? 0 : parseFloat(formData.monthly_fee),
        payment_day: formData.is_pro_bono ? null : parseInt(formData.payment_day),
        pro_bono_start_date: formData.is_pro_bono ? formData.pro_bono_start_date : null,
        pro_bono_end_date: formData.is_pro_bono && formData.pro_bono_end_date ? formData.pro_bono_end_date : null,
        pro_bono_reason: formData.is_pro_bono ? formData.pro_bono_reason : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", editingClient.id);

      if (error) throw error;

      toast.success(
        formData.is_pro_bono
          ? "Cliente mantido como Pro-Bono"
          : "Cliente convertido para Pago com sucesso!"
      );

      setEditDialogOpen(false);
      loadProBonoClients();
    } catch (error: any) {
      console.error("Erro ao atualizar cliente:", error);
      toast.error("Erro ao atualizar cliente: " + getErrorMessage(error));
    }
  };

  const handleDeleteClick = (client: any) => {
    setDeletingClient(client);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingClient) return;

    try {
      // Verificar se há invoices (faturas) vinculadas
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', deletingClient.id)
        .limit(1);

      if (invoicesError) throw new Error(getErrorMessage(invoicesError));

      // Se houver faturas, apenas inativar o cliente
      if (invoices && invoices.length > 0) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ status: 'inactive' })
          .eq('id', deletingClient.id);

        if (updateError) throw updateError;

        toast.warning(`Cliente ${deletingClient.name} foi inativado`, {
          description: 'Cliente possui faturas vinculadas e não pode ser excluído permanentemente'
        });
      } else {
        // Se não houver faturas, excluir completamente
        // As foreign keys com ON DELETE CASCADE devem cuidar dos relacionamentos
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', deletingClient.id);

        if (error) {
          // Se houver erro de constraint, tentar inativar
          if (error.code === '23503') { // Foreign key violation
            const { error: updateError } = await supabase
              .from('clients')
              .update({ is_active: false } as any)
              .eq('id', deletingClient.id);

            if (updateError) throw updateError;

            toast.warning(`Cliente ${deletingClient.name} foi inativado`, {
              description: 'Cliente possui registros vinculados e não pode ser excluído permanentemente'
            });
          } else {
            throw error;
          }
        } else {
          toast.success(`Cliente ${deletingClient.name} excluído com sucesso`);
        }
      }

      setDeleteDialogOpen(false);
      setDeletingClient(null);
      loadProBonoClients();
    } catch (error: any) {
      console.error("Erro ao excluir/inativar cliente:", error);
      toast.error("Erro ao processar exclusão do cliente: " + getErrorMessage(error));
    }
  };

  // Filtrar clientes baseado no contexto
  const filteredClients = selectedClientId 
    ? clients.filter(client => client.id === selectedClientId)
    : clients;

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

        {/* Abas de visualização */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant={viewMode === "pro_bono" ? "default" : "outline"}
              onClick={() => setViewMode("pro_bono")}
              className="gap-2"
            >
              <Heart className="h-4 w-4" />
              Pro-Bono ({stats.total})
            </Button>
            <Button
              variant={viewMode === "without_fee" ? "default" : "outline"}
              onClick={() => setViewMode("without_fee")}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Sem Honorário ({stats.withoutFee})
            </Button>
          </div>

          {viewMode === "pro_bono" && (
            <div className="flex items-center gap-3 ml-auto">
              <Label htmlFor="status-filter" className="text-sm font-medium">
                Filtrar por status:
              </Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
                <SelectTrigger id="status-filter" className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({stats.total})</SelectItem>
                  <SelectItem value="active">Ativos ({stats.active})</SelectItem>
                  <SelectItem value="inactive">Inativos ({stats.inactive})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pro-Bono
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active} ativos • {stats.inactive} inativos
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
                Sem Honorário Definido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.withoutFee}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.inGroups > 0 ? (
                  <span>
                    <span className="text-blue-600">{stats.inGroups} em grupos</span>
                    {stats.needsAction > 0 && (
                      <> • <span className="text-orange-600">{stats.needsAction} a definir</span></>
                    )}
                  </span>
                ) : (
                  "Clientes a classificar"
                )}
              </p>
            </CardContent>
          </Card>

          {stats.inGroups > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-700">
                  Em Grupos Financeiros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.inGroups}</div>
                <p className="text-xs text-blue-600/80 mt-1">
                  Pagos pela empresa matriz
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabela de Clientes */}
        <Card>
          <CardHeader>
            <CardTitle>
              {viewMode === "pro_bono" ? "Lista de Clientes Pro-Bono" : "Clientes sem Honorário Definido"}
            </CardTitle>
            <CardDescription>
              {viewMode === "pro_bono" ? (
                <>
                  {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''} Pro-Bono encontrado{filteredClients.length !== 1 ? 's' : ''}
                  {selectedClientId && ` (filtrado)`}
                </>
              ) : (
                <>
                  {clientsWithoutFee.length} cliente{clientsWithoutFee.length !== 1 ? 's' : ''} sem honorário definido.
                  <span className="text-orange-600 font-medium ml-1">Defina um valor ou marque como Pro-Bono.</span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {viewMode === "pro_bono" && filteredClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente pro-bono cadastrado</p>
              </div>
            ) : viewMode === "without_fee" && clientsWithoutFee.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                <p className="text-green-600 font-medium">Todos os clientes têm honorário definido!</p>
              </div>
            ) : viewMode === "pro_bono" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Honorário Mensal</TableHead>
                      <TableHead>Período Pro-Bono</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Grupo Econômico</TableHead>
                      <TableHead className="text-right">Valor Dispensado</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                         <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FinancialGroupBadge clientId={client.id} />
                            {client.is_pro_bono && (
                              <Heart className="h-4 w-4 text-primary" />
                            )}
                            {client.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{(client.cnpj || client.cpf) ? formatDocument(client.cnpj || client.cpf || "") : "-"}</TableCell>
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
                        <TableCell>
                          <EconomicGroupIndicator client={client} allClients={allClientsForGroups} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(client.totalWaived)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setViewingClient(client);
                                setViewDialogOpen(true);
                              }}
                              title="Ver Dados da Empresa"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(client)}
                              title="Editar cliente"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(client)}
                              title="Excluir cliente"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              // Tabela de Clientes sem Honorário
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Honorário Atual</TableHead>
                      <TableHead>Grupo Econômico</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsWithoutFee.map((client) => (
                      <TableRow key={client.id} className={groupMemberships.has(client.id) ? "bg-blue-50/50" : "bg-orange-50/50"}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FinancialGroupBadge clientId={client.id} />
                            {groupMemberships.has(client.id) ? (
                              <GitMerge className="h-4 w-4 text-blue-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            )}
                            {client.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {(client.cnpj || client.cpf) ? formatDocument(client.cnpj || client.cpf || "") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.is_active ? "default" : "secondary"}>
                            {client.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {groupMemberships.has(client.id) ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="gap-1 border-blue-400 text-blue-700 bg-blue-50">
                                <GitMerge className="h-3 w-3" />
                                Em Grupo
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Pago por: {groupMemberships.get(client.id)?.mainPayerName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-orange-600 font-medium">
                              {client.monthly_fee === 0 ? "R$ 0,00" : "Não definido"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <EconomicGroupIndicator client={client} allClients={allClientsForGroups} />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setViewingClient(client);
                                setViewDialogOpen(true);
                              }}
                              title="Ver Dados da Empresa"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {groupMemberships.has(client.id) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/economic-groups')}
                                title="Ver Grupo Financeiro"
                                className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Ver Grupo
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(client)}
                                title="Definir honorário ou marcar como Pro-Bono"
                                className="gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                              >
                                <Edit className="h-4 w-4" />
                                Definir
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Visualização de Dados da Empresa */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dados da Empresa</DialogTitle>
              <DialogDescription>
                Informações completas do cliente
              </DialogDescription>
            </DialogHeader>
            
            {viewingClient && (
              <div className="space-y-6">
                {/* Seção Informações Básicas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Informações Básicas</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Nome</Label>
                      <p className="font-medium">{viewingClient.name || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">CNPJ/CPF</Label>
                      <p className="font-medium">{viewingClient.cnpj || viewingClient.cpf || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{viewingClient.email || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Telefone</Label>
                      <p className="font-medium">{viewingClient.phone || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge variant={viewingClient.is_active ? "default" : "destructive"}>
                        {viewingClient.is_active ? "Ativo" : "Suspenso"}
                      </Badge>
                    </div>
                  </div>
                  {viewingClient.notes && (
                    <div>
                      <Label className="text-muted-foreground">Observações</Label>
                      <p className="font-medium whitespace-pre-wrap">{viewingClient.notes}</p>
                    </div>
                  )}
                </div>

                {/* Seção Dados da Empresa */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Dados da Empresa</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Razão Social</Label>
                      <p className="font-medium">{viewingClient.razao_social || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Nome Fantasia</Label>
                      <p className="font-medium">{viewingClient.nome_fantasia || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Situação Cadastral</Label>
                      <p className="font-medium">{viewingClient.situacao_cadastral || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Porte</Label>
                      <p className="font-medium">{viewingClient.porte || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Natureza Jurídica</Label>
                      <p className="font-medium">{viewingClient.natureza_juridica || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Data de Abertura</Label>
                      <p className="font-medium">
                        {viewingClient.data_abertura 
                          ? new Date(viewingClient.data_abertura).toLocaleDateString('pt-BR')
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Capital Social</Label>
                      <p className="font-medium">
                        {viewingClient.capital_social 
                          ? formatCurrency(Number(viewingClient.capital_social))
                          : "-"}
                      </p>
                    </div>
                  </div>
                  
                  {viewingClient.atividade_principal && (
                    <div>
                      <Label className="text-muted-foreground">Atividade Principal (CNAE)</Label>
                      <p className="font-medium">
                        {viewingClient.atividade_principal.code} - {viewingClient.atividade_principal.text}
                      </p>
                    </div>
                  )}

                  {viewingClient.atividades_secundarias && viewingClient.atividades_secundarias.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Atividades Secundárias</Label>
                      <div className="space-y-1">
                        {viewingClient.atividades_secundarias.map((atividade: any, index: number) => (
                          <p key={index} className="text-sm">
                            {atividade.code} - {atividade.text}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingClient.qsa && viewingClient.qsa.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Quadro de Sócios e Administradores</Label>
                      <div className="space-y-2 mt-2">
                        {viewingClient.qsa.map((socio: any, index: number) => (
                          <div key={index} className="border rounded p-3 bg-muted/50">
                            <p className="font-medium">{socio.nome}</p>
                            <p className="text-sm text-muted-foreground">{socio.qual}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Seção Endereço */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Endereço</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">CEP</Label>
                      <p className="font-medium">{viewingClient.cep || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Logradouro</Label>
                      <p className="font-medium">{viewingClient.logradouro || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Número</Label>
                      <p className="font-medium">{viewingClient.numero || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Complemento</Label>
                      <p className="font-medium">{viewingClient.complemento || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Bairro</Label>
                      <p className="font-medium">{viewingClient.bairro || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Município</Label>
                      <p className="font-medium">{viewingClient.municipio || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">UF</Label>
                      <p className="font-medium">{viewingClient.uf || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Seção Financeiro */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Informações Financeiras</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Honorário Mensal</Label>
                      <p className="font-medium text-lg">
                        {formatCurrency(Number(viewingClient.monthly_fee))}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Dia de Vencimento</Label>
                      <p className="font-medium">{viewingClient.payment_day || "-"}</p>
                    </div>
                    
                    {viewingClient.is_pro_bono && (
                      <>
                        <div className="col-span-2">
                          <Badge variant="outline" className="gap-1 border-pink-500 text-pink-700">
                            <Heart className="h-3 w-3 fill-current" />
                            Cliente Pro-Bono
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Data Início Pro-Bono</Label>
                          <p className="font-medium">
                            {viewingClient.pro_bono_start_date 
                              ? new Date(viewingClient.pro_bono_start_date).toLocaleDateString('pt-BR')
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Data Fim Pro-Bono</Label>
                          <p className="font-medium">
                            {viewingClient.pro_bono_end_date 
                              ? new Date(viewingClient.pro_bono_end_date).toLocaleDateString('pt-BR')
                              : "Indefinido"}
                          </p>
                        </div>
                        {viewingClient.pro_bono_reason && (
                          <div className="col-span-2">
                            <Label className="text-muted-foreground">Motivo Pro-Bono</Label>
                            <p className="font-medium">{viewingClient.pro_bono_reason}</p>
                          </div>
                        )}
                      </>
                    )}

                    {viewingClient.is_barter && (
                      <>
                        <div className="col-span-2">
                          <Badge variant="outline" className="gap-1">
                            Cliente Barter
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Crédito Mensal Barter</Label>
                          <p className="font-medium">
                            {formatCurrency(Number(viewingClient.barter_monthly_credit))}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Data Início Barter</Label>
                          <p className="font-medium">
                            {viewingClient.barter_start_date 
                              ? new Date(viewingClient.barter_start_date).toLocaleDateString('pt-BR')
                              : "-"}
                          </p>
                        </div>
                        {viewingClient.barter_description && (
                          <div className="col-span-2">
                            <Label className="text-muted-foreground">Descrição do Barter</Label>
                            <p className="font-medium">{viewingClient.barter_description}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Edição */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editar Cliente Pro-Bono
              </DialogTitle>
              <DialogDescription>
                {editingClient?.name} - Altere o status do cliente ou converta para pago
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Tipo de Cliente */}
              <div className="space-y-3">
                <Label className="font-semibold text-base">Tipo de Cliente</Label>
                <RadioGroup
                  value={formData.is_pro_bono ? "pro_bono" : "regular"}
                  onValueChange={(value) => {
                    if (value === "regular") {
                      setFormData({ 
                        ...formData, 
                        is_pro_bono: false,
                        pro_bono_start_date: "",
                        pro_bono_end_date: "",
                        pro_bono_reason: ""
                      });
                    } else if (value === "pro_bono") {
                      setFormData({ 
                        ...formData, 
                        is_pro_bono: true,
                        monthly_fee: "0"
                      });
                    }
                  }}
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="regular" id="regular" />
                    <Label htmlFor="regular" className="font-normal cursor-pointer">
                      Lista de Clientes (Regular)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pro_bono" id="pro_bono" />
                    <Label htmlFor="pro_bono" className="font-normal cursor-pointer">
                      Clientes Pro-Bono (Gratuito)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Campos Pro-Bono */}
              {formData.is_pro_bono && (
                <div className="space-y-4 p-4 bg-muted rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Heart className="h-4 w-4 text-primary" />
                    <span>Informações Pro-Bono</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pro_bono_start_date">
                        Data Início <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="pro_bono_start_date"
                        type="date"
                        value={formData.pro_bono_start_date}
                        onChange={(e) =>
                          setFormData({ ...formData, pro_bono_start_date: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pro_bono_end_date">Data Fim (Opcional)</Label>
                      <Input
                        id="pro_bono_end_date"
                        type="date"
                        value={formData.pro_bono_end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, pro_bono_end_date: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pro_bono_reason">
                      Justificativa/Motivo <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="pro_bono_reason"
                      placeholder="Descreva o motivo do atendimento gratuito..."
                      value={formData.pro_bono_reason}
                      onChange={(e) =>
                        setFormData({ ...formData, pro_bono_reason: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Campos Cliente Pago */}
              {!formData.is_pro_bono && (
                <div className="space-y-4 p-4 bg-muted rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span>Informações de Pagamento</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="monthly_fee">
                        Honorário Mensal <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="monthly_fee"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={formData.monthly_fee}
                        onChange={(e) =>
                          setFormData({ ...formData, monthly_fee: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment_day">
                        Dia de Pagamento <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="payment_day"
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Ex: 10"
                        value={formData.payment_day}
                        onChange={(e) =>
                          setFormData({ ...formData, payment_day: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Ao converter para cliente pago, o histórico Pro-Bono será removido.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveChanges}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o cliente <strong>{deletingClient?.name}</strong>?
                <br/><br/>
                <span className="text-xs text-muted-foreground">
                  • Se o cliente possuir faturas ou lançamentos contábeis, será apenas <strong>inativado</strong> para preservar o histórico financeiro.
                  <br/>
                  • Caso contrário, será <strong>excluído permanentemente</strong> do sistema.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default ProBonoClients;
