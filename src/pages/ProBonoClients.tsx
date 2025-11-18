import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Loader2, Calendar, FileText, Edit, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({
    is_pro_bono: false,
    is_internal: false,
    pro_bono_start_date: "",
    pro_bono_end_date: "",
    pro_bono_reason: "",
    monthly_fee: "",
    payment_day: ""
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

      // Buscar clientes sem honorário mensal (Pro-Bono)
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
        .eq('monthly_fee', 0)
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

  const handleEditClick = (client: any) => {
    setEditingClient(client);
    setFormData({
      is_pro_bono: client.is_pro_bono || false,
      is_internal: client.is_internal || false,
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
        is_internal: formData.is_internal,
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
      toast.error("Erro ao atualizar cliente");
    }
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
                      <TableHead className="text-center">Ações</TableHead>
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
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(client)}
                            title="Editar cliente"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

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
                  value={
                    formData.is_pro_bono ? "pro_bono" : 
                    formData.is_internal ? "internal" : 
                    "regular"
                  }
                  onValueChange={(value) => {
                    if (value === "regular") {
                      setFormData({ 
                        ...formData, 
                        is_pro_bono: false,
                        is_internal: false,
                        pro_bono_start_date: "",
                        pro_bono_end_date: "",
                        pro_bono_reason: ""
                      });
                    } else if (value === "pro_bono") {
                      setFormData({ 
                        ...formData, 
                        is_pro_bono: true,
                        is_internal: false,
                        monthly_fee: "0"
                      });
                    } else if (value === "internal") {
                      setFormData({ 
                        ...formData, 
                        is_pro_bono: false,
                        is_internal: true,
                        pro_bono_start_date: "",
                        pro_bono_end_date: "",
                        pro_bono_reason: ""
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="internal" id="internal" />
                    <Label htmlFor="internal" className="font-normal cursor-pointer">
                      Empresas Internas
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
      </div>
    </Layout>
  );
};

export default ProBonoClients;
