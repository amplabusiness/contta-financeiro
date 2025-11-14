import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Upload, Ban, CheckCircle, Loader2, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [enriching, setEnriching] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    monthly_fee: "",
    payment_day: "",
    notes: "",
    status: "active",
    is_pro_bono: false,
    pro_bono_start_date: "",
    pro_bono_end_date: "",
    pro_bono_reason: "",
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validar CNPJ duplicado antes de inserir
      if (formData.cnpj && formData.cnpj.trim()) {
        const cnpjNormalized = formData.cnpj.replace(/[^\d]/g, '');
        
        const { data: existingClients, error: checkError } = await supabase
          .from("clients")
          .select("id, name, cnpj")
          .not("id", "eq", editingClient?.id || "00000000-0000-0000-0000-000000000000");

        if (checkError) throw checkError;

        // Verificar se já existe um cliente com o mesmo CNPJ (normalizado)
        const duplicateCNPJ = existingClients?.find(client => {
          if (!client.cnpj) return false;
          const existingCNPJ = client.cnpj.replace(/[^\d]/g, '');
          return existingCNPJ === cnpjNormalized;
        });

        if (duplicateCNPJ) {
          toast.error(`CNPJ já cadastrado para o cliente: ${duplicateCNPJ.name}`, {
            description: "Não é possível cadastrar o mesmo CNPJ duas vezes.",
            duration: 5000,
          });
          setLoading(false);
          return;
        }
      }

      const clientData = {
        ...formData,
        monthly_fee: parseFloat(formData.monthly_fee) || 0,
        payment_day: formData.payment_day ? parseInt(formData.payment_day) : null,
        is_pro_bono: formData.is_pro_bono,
        pro_bono_start_date: formData.pro_bono_start_date || null,
        pro_bono_end_date: formData.pro_bono_end_date || null,
        pro_bono_reason: formData.pro_bono_reason || null,
        created_by: user.id,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) {
          // Verificar se o erro é de CNPJ duplicado
          if (error.message.includes('clients_cnpj_normalized_unique')) {
            toast.error("CNPJ já cadastrado para outro cliente", {
              description: "Não é possível ter dois clientes com o mesmo CNPJ.",
              duration: 5000,
            });
            setLoading(false);
            return;
          }
          throw error;
        }
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clients").insert(clientData);

        if (error) {
          // Verificar se o erro é de CNPJ duplicado
          if (error.message.includes('clients_cnpj_normalized_unique')) {
            toast.error("CNPJ já cadastrado para outro cliente", {
              description: "Não é possível ter dois clientes com o mesmo CNPJ.",
              duration: 5000,
            });
            setLoading(false);
            return;
          }
          throw error;
        }
        toast.success("Cliente cadastrado com sucesso!");
      }

      setOpen(false);
      setEditingClient(null);
      resetForm();
      loadClients();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClientId) return;

    try {
      const { error } = await supabase.from("clients").delete().eq("id", selectedClientId);

      if (error) throw error;
      toast.success("Cliente excluído com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedClientId(null);
      loadClients();
    } catch (error: any) {
      toast.error("Erro ao excluir cliente: " + error.message);
    }
  };

  const handleToggleStatus = async (client: any) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    const action = newStatus === "active" ? "ativado" : "suspenso";

    try {
      const { error } = await supabase
        .from("clients")
        .update({ status: newStatus })
        .eq("id", client.id);

      if (error) throw error;
      toast.success(`Cliente ${action} com sucesso!`);
      loadClients();
    } catch (error: any) {
      toast.error("Erro ao atualizar status do cliente: " + error.message);
    }
  };

  const enrichByCNPJ = async (cnpj: string) => {
    if (!cnpj || cnpj.length < 14) return;
    
    setEnriching(true);
    try {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) {
        toast.error('CNPJ não encontrado na Receita Federal');
        return;
      }

      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        email: data.email || prev.email,
        phone: data.ddd_telefone_1 || prev.phone,
      }));
      
      toast.success('Dados carregados da Receita Federal!');
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      toast.error('Erro ao buscar dados do CNPJ');
    } finally {
      setEnriching(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      email: "",
      phone: "",
      monthly_fee: "",
      payment_day: "",
      notes: "",
      status: "active",
      is_pro_bono: false,
      pro_bono_start_date: "",
      pro_bono_end_date: "",
      pro_bono_reason: "",
    });
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      cnpj: client.cnpj || "",
      email: client.email || "",
      phone: client.phone || "",
      monthly_fee: client.monthly_fee?.toString() || "",
      payment_day: client.payment_day?.toString() || "",
      notes: client.notes || "",
      status: client.status,
      is_pro_bono: client.is_pro_bono || false,
      pro_bono_start_date: client.pro_bono_start_date || "",
      pro_bono_end_date: client.pro_bono_end_date || "",
      pro_bono_reason: client.pro_bono_reason || "",
    });
    setOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">Gerencie o cadastro de clientes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/import")}>
              <Upload className="w-4 h-4 mr-2" />
              Importar Planilha
            </Button>
            <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setEditingClient(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                <DialogDescription>
                  Preencha os dados do cliente
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                        placeholder="Digite o CNPJ"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => enrichByCNPJ(formData.cnpj)}
                        disabled={enriching || !formData.cnpj || formData.cnpj.length < 14}
                      >
                        {enriching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Buscar'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Digite o CNPJ e clique em Buscar para preencher automaticamente
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly_fee">Honorário Mensal *</Label>
                    <Input
                      id="monthly_fee"
                      type="number"
                      step="0.01"
                      value={formData.monthly_fee}
                      onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
                      required={!formData.is_pro_bono}
                      disabled={formData.is_pro_bono}
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
                      disabled={formData.is_pro_bono}
                    />
                  </div>
                  
                  {/* Seção Pro-Bono */}
                  <div className="space-y-4 col-span-2 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_pro_bono"
                        checked={formData.is_pro_bono}
                        onCheckedChange={(checked) => {
                          const isProBono = checked === true;
                          setFormData({ 
                            ...formData, 
                            is_pro_bono: isProBono,
                            monthly_fee: isProBono ? "0" : formData.monthly_fee,
                            payment_day: isProBono ? "" : formData.payment_day
                          });
                        }}
                      />
                      <Label htmlFor="is_pro_bono" className="font-semibold text-base cursor-pointer">
                        Cliente Pro-Bono (Gratuito)
                      </Label>
                    </div>
                    
                    {formData.is_pro_bono && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="pro_bono_start_date">Data Início *</Label>
                          <Input
                            id="pro_bono_start_date"
                            type="date"
                            value={formData.pro_bono_start_date}
                            onChange={(e) => setFormData({ ...formData, pro_bono_start_date: e.target.value })}
                            required={formData.is_pro_bono}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pro_bono_end_date">Data Fim</Label>
                          <Input
                            id="pro_bono_end_date"
                            type="date"
                            value={formData.pro_bono_end_date}
                            onChange={(e) => setFormData({ ...formData, pro_bono_end_date: e.target.value })}
                            min={formData.pro_bono_start_date}
                          />
                          <p className="text-xs text-muted-foreground">
                            Deixe em branco para período indefinido
                          </p>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="pro_bono_reason">Justificativa/Motivo *</Label>
                          <Textarea
                            id="pro_bono_reason"
                            value={formData.pro_bono_reason}
                            onChange={(e) => setFormData({ ...formData, pro_bono_reason: e.target.value })}
                            placeholder="Ex: ONG sem fins lucrativos, projeto social, parceria institucional..."
                            rows={2}
                            required={formData.is_pro_bono}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>Total: {clients.length} clientes</CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum cliente cadastrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Honorário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const today = new Date();
                    const isProBonoActive = client.is_pro_bono && 
                      (!client.pro_bono_end_date || new Date(client.pro_bono_end_date) >= today);
                    
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {client.name}
                            {client.is_pro_bono && (
                              <Badge variant="outline" className="gap-1 border-pink-500 text-pink-700">
                                <Heart className="h-3 w-3 fill-current" />
                                Pro-Bono
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{client.cnpj || "-"}</TableCell>
                        <TableCell>{client.email || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className={client.is_pro_bono ? "line-through text-muted-foreground" : ""}>
                              {formatCurrency(Number(client.monthly_fee))}
                            </span>
                            {isProBonoActive && (
                              <span className="text-xs text-pink-600 font-medium">
                                Gratuito {client.pro_bono_end_date 
                                  ? `até ${new Date(client.pro_bono_end_date).toLocaleDateString('pt-BR')}`
                                  : '(indefinido)'}
                              </span>
                            )}
                            {client.is_pro_bono && !isProBonoActive && (
                              <span className="text-xs text-muted-foreground">
                                Pro-bono expirado
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.status === "active" ? "default" : "secondary"}>
                            {client.status === "active" ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(client)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(client)}
                            title={client.status === "active" ? "Suspender" : "Ativar"}
                          >
                            {client.status === "active" ? (
                              <Ban className="w-4 h-4 text-destructive" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-success" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setDeleteDialogOpen(true);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Clients;
