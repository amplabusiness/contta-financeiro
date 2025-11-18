import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Heart, Loader2, Calendar, FileText, Edit, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/data/expensesData";

const InternalCompanies = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalMonthlyFee: 0
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({
    is_internal: false,
    is_pro_bono: false,
    monthly_fee: "",
    payment_day: "",
    notes: "",
    pro_bono_start_date: "",
    pro_bono_end_date: "",
    pro_bono_reason: ""
  });

  useEffect(() => {
    loadInternalCompanies();
  }, []);

  const loadInternalCompanies = async () => {
    try {
      setLoading(true);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("is_internal", true)
        .order("name");

      if (clientsError) throw clientsError;

      setClients(clientsData || []);

      // Calcular estatísticas
      const total = (clientsData || []).length;
      const active = (clientsData || []).filter((c: any) => c.status === 'active').length;
      const totalMonthlyFee = (clientsData || []).reduce((sum: number, c: any) => sum + (c.monthly_fee || 0), 0);

      setStats({ total, active, totalMonthlyFee });
    } catch (error: any) {
      console.error("Erro ao carregar empresas internas:", error);
      toast.error("Erro ao carregar empresas internas");
    } finally {
      setLoading(false);
    }
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

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setFormData({
      is_internal: client.is_internal || false,
      is_pro_bono: client.is_pro_bono || false,
      monthly_fee: client.monthly_fee?.toString() || "",
      payment_day: client.payment_day?.toString() || "",
      notes: client.notes || "",
      pro_bono_start_date: client.pro_bono_start_date || "",
      pro_bono_end_date: client.pro_bono_end_date || "",
      pro_bono_reason: client.pro_bono_reason || ""
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingClient) return;

    try {
      if (formData.is_pro_bono && !formData.pro_bono_start_date) {
        toast.error("Informe a data de início do período Pro-Bono");
        return;
      }

      if (formData.is_pro_bono && !formData.pro_bono_reason) {
        toast.error("Informe o motivo/justificativa do Pro-Bono");
        return;
      }

      const { error } = await supabase
        .from("clients")
        .update({
          is_internal: formData.is_internal,
          is_pro_bono: formData.is_pro_bono,
          monthly_fee: formData.is_pro_bono ? 0 : (formData.monthly_fee ? parseFloat(formData.monthly_fee) : 0),
          payment_day: formData.is_pro_bono ? null : (formData.payment_day ? parseInt(formData.payment_day) : null),
          notes: formData.notes,
          pro_bono_start_date: formData.is_pro_bono ? formData.pro_bono_start_date : null,
          pro_bono_end_date: formData.is_pro_bono && formData.pro_bono_end_date ? formData.pro_bono_end_date : null,
          pro_bono_reason: formData.is_pro_bono ? formData.pro_bono_reason : null
        })
        .eq("id", editingClient.id);

      if (error) throw error;

      toast.success("Cliente atualizado com sucesso!");
      setEditDialogOpen(false);
      loadInternalCompanies();
    } catch (error: any) {
      console.error("Erro ao atualizar cliente:", error);
      toast.error("Erro ao atualizar cliente");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas Internas</h1>
          <p className="text-muted-foreground">
            Gerenciamento de empresas internas do escritório
          </p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active} ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Honorários Mensais</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalMonthlyFee)}</div>
              <p className="text-xs text-muted-foreground">
                Soma dos honorários mensais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Empresa</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total > 0 ? formatCurrency(stats.totalMonthlyFee / stats.total) : formatCurrency(0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Honorário médio mensal
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Empresas Internas */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas Internas Cadastradas</CardTitle>
            <CardDescription>
              Lista de todas as empresas internas do escritório
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma empresa interna cadastrada</p>
                <p className="text-sm mt-2">
                  Para adicionar uma empresa como interna, edite-a na Lista de Clientes
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ/CPF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Honorário Mensal</TableHead>
                    <TableHead>Dia de Pagamento</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.cnpj || client.cpf || "-"}</TableCell>
                      <TableCell>{getStatusBadge(client.status)}</TableCell>
                      <TableCell>{formatCurrency(client.monthly_fee || 0)}</TableCell>
                      <TableCell>{client.payment_day ? `Dia ${client.payment_day}` : "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{client.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Empresa Interna</DialogTitle>
            <DialogDescription>
              Atualize as informações da empresa interna
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tipo de Cliente */}
            <div className="space-y-3 pb-4 border-b">
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
                      monthly_fee: "0",
                      payment_day: ""
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

            {/* Campos Cliente Regular */}
            {!formData.is_pro_bono && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly_fee">Honorário Mensal</Label>
                  <Input
                    id="monthly_fee"
                    type="number"
                    step="0.01"
                    value={formData.monthly_fee}
                    onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_day">Dia de Pagamento</Label>
                  <Input
                    id="payment_day"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payment_day}
                    onChange={(e) => setFormData({ ...formData, payment_day: e.target.value })}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre a empresa interna"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default InternalCompanies;
