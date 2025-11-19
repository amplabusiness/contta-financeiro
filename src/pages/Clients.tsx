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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Upload, Ban, CheckCircle, Loader2, Heart, Users, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClient } from "@/contexts/ClientContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { AIClientAnalyzer } from "@/components/ai/AIClientAnalyzer";

const Clients = () => {
  const navigate = useNavigate();
  const { selectedClientId, setSelectedClient, clearSelectedClient } = useClient();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [enriching, setEnriching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    is_internal: false,
    pro_bono_start_date: "",
    pro_bono_end_date: "",
    pro_bono_reason: "",
    razao_social: "",
    nome_fantasia: "",
    porte: "",
    natureza_juridica: "",
    situacao_cadastral: "",
    data_abertura: "",
    capital_social: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    municipio: "",
    uf: "",
    cep: "",
    atividade_principal: null as any,
    atividades_secundarias: [] as any[],
    qsa: [] as any[]
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      // Buscar clientes com honorário mensal
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
        .gt('monthly_fee', 0)
        .order("name");

      if (clientsError) throw clientsError;
      
      // Calcular estatísticas de boletos para cada cliente
      const enrichedClients = (clientsData || []).map((client: any) => {
        const invoices = client.invoices || [];
        const totalInvoices = invoices.length;
        const paidInvoices = invoices.filter((i: any) => i.status === 'paid').length;
        const pendingInvoices = invoices.filter((i: any) => i.status === 'pending').length;
        const totalAmount = invoices.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
        const paidAmount = invoices
          .filter((i: any) => i.status === 'paid')
          .reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
        
        return {
          ...client,
          invoiceStats: {
            total: totalInvoices,
            paid: paidInvoices,
            pending: pendingInvoices,
            totalAmount,
            paidAmount
          }
        };
      });
      
      setClients(enrichedClients);
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
        name: formData.name,
        cnpj: formData.cnpj,
        email: formData.email,
        phone: formData.phone,
        monthly_fee: parseFloat(formData.monthly_fee) || 0,
        payment_day: formData.payment_day ? parseInt(formData.payment_day) : null,
        notes: formData.notes,
        status: formData.status,
        is_pro_bono: formData.is_pro_bono,
        is_internal: formData.is_internal,
        pro_bono_start_date: formData.pro_bono_start_date || null,
        pro_bono_end_date: formData.pro_bono_end_date || null,
        pro_bono_reason: formData.pro_bono_reason || null,
        razao_social: formData.razao_social || null,
        nome_fantasia: formData.nome_fantasia || null,
        porte: formData.porte || null,
        natureza_juridica: formData.natureza_juridica || null,
        situacao_cadastral: formData.situacao_cadastral || null,
        data_abertura: formData.data_abertura || null,
        capital_social: formData.capital_social ? parseFloat(formData.capital_social) : null,
        logradouro: formData.logradouro || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        municipio: formData.municipio || null,
        uf: formData.uf || null,
        cep: formData.cep || null,
        atividade_principal: formData.atividade_principal || null,
        atividades_secundarias: formData.atividades_secundarias || null,
        qsa: formData.qsa || null,
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
    if (!deleteClientId) return;

    try {
      const { error } = await supabase.from("clients").delete().eq("id", deleteClientId);

      if (error) throw error;
      toast.success("Cliente excluído com sucesso!");
      setDeleteDialogOpen(false);
      setDeleteClientId(null);
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
      
      // Extrair sócios do QSA
      const socios = data.qsa?.map((socio: any) => ({
        nome: socio.nome_socio || socio.nome,
        qualificacao: socio.qualificacao_socio || socio.qual,
        data_entrada: socio.data_entrada_sociedade
      })) || [];
      
      setFormData(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        email: data.email || prev.email,
        phone: data.ddd_telefone_1 || prev.phone,
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        porte: data.porte,
        natureza_juridica: data.natureza_juridica,
        situacao_cadastral: data.descricao_situacao_cadastral,
        data_abertura: data.data_inicio_atividade,
        capital_social: data.capital_social,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        cep: data.cep,
        atividade_principal: data.cnae_fiscal_descricao ? {
          codigo: data.cnae_fiscal,
          descricao: data.cnae_fiscal_descricao
        } : null,
        atividades_secundarias: data.cnaes_secundarios || [],
        qsa: socios
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
      is_internal: false,
      pro_bono_start_date: "",
      pro_bono_end_date: "",
      pro_bono_reason: "",
      razao_social: "",
      nome_fantasia: "",
      porte: "",
      natureza_juridica: "",
      situacao_cadastral: "",
      data_abertura: "",
      capital_social: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      cep: "",
      atividade_principal: null,
      atividades_secundarias: [],
      qsa: []
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
      is_internal: client.is_internal || false,
      pro_bono_start_date: client.pro_bono_start_date || "",
      pro_bono_end_date: client.pro_bono_end_date || "",
      pro_bono_reason: client.pro_bono_reason || "",
      razao_social: client.razao_social || "",
      nome_fantasia: client.nome_fantasia || "",
      porte: client.porte || "",
      natureza_juridica: client.natureza_juridica || "",
      situacao_cadastral: client.situacao_cadastral || "",
      data_abertura: client.data_abertura || "",
      capital_social: client.capital_social?.toString() || "",
      logradouro: client.logradouro || "",
      numero: client.numero || "",
      complemento: client.complemento || "",
      bairro: client.bairro || "",
      municipio: client.municipio || "",
      uf: client.uf || "",
      cep: client.cep || "",
      atividade_principal: client.atividade_principal || null,
      atividades_secundarias: client.atividades_secundarias || [],
      qsa: client.qsa || []
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                <DialogDescription>
                  Preencha os dados do cliente. Use o CNPJ para buscar automaticamente os dados da Receita Federal.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Tabs defaultValue="basico" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basico">Básico</TabsTrigger>
                    <TabsTrigger value="empresa">Empresa</TabsTrigger>
                    <TabsTrigger value="endereco">Endereço</TabsTrigger>
                    <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  </TabsList>

                  {/* Aba Básico */}
                  <TabsContent value="basico" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
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
                              'Buscar na Receita'
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Digite o CNPJ e clique em Buscar para preencher automaticamente todos os dados
                        </p>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="name">Nome/Razão Social *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
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
                  </TabsContent>

                  {/* Aba Empresa */}
                  <TabsContent value="empresa" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Razão Social</Label>
                        <Input value={formData.razao_social} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Nome Fantasia</Label>
                        <Input value={formData.nome_fantasia} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Situação Cadastral</Label>
                        <Input value={formData.situacao_cadastral} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Porte</Label>
                        <Input value={formData.porte} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Natureza Jurídica</Label>
                        <Input value={formData.natureza_juridica} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Data de Abertura</Label>
                        <Input 
                          value={formData.data_abertura ? new Date(formData.data_abertura).toLocaleDateString('pt-BR') : ''} 
                          disabled 
                          className="bg-muted" 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Capital Social</Label>
                        <Input 
                          value={formData.capital_social ? formatCurrency(Number(formData.capital_social)) : ''} 
                          disabled 
                          className="bg-muted" 
                        />
                      </div>

                      {formData.atividade_principal && (
                        <div className="space-y-2 col-span-2">
                          <Label>Atividade Principal (CNAE)</Label>
                          <Input 
                            value={`${formData.atividade_principal.codigo} - ${formData.atividade_principal.descricao}`} 
                            disabled 
                            className="bg-muted" 
                          />
                        </div>
                      )}

                      {formData.qsa && formData.qsa.length > 0 && (
                        <div className="space-y-2 col-span-2">
                          <Label>Sócios ({formData.qsa.length})</Label>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {formData.qsa.map((socio: any, idx: number) => (
                              <Card key={idx} className="p-3">
                                <p className="font-medium text-sm">{socio.nome}</p>
                                <p className="text-xs text-muted-foreground">{socio.qualificacao}</p>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Aba Endereço */}
                  <TabsContent value="endereco" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CEP</Label>
                        <Input value={formData.cep} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>UF</Label>
                        <Input value={formData.uf} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>Logradouro</Label>
                        <Input value={formData.logradouro} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Número</Label>
                        <Input value={formData.numero} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Complemento</Label>
                        <Input value={formData.complemento} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Bairro</Label>
                        <Input value={formData.bairro} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label>Município</Label>
                        <Input value={formData.municipio} disabled className="bg-muted" />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Aba Financeiro */}
                  <TabsContent value="financeiro" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Informações de Boletos */}
                      {editingClient && editingClient.invoiceStats && (
                        <div className="col-span-2 space-y-3 p-4 bg-muted rounded-lg">
                          <h4 className="font-semibold">Histórico de Boletos</h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Total de Boletos</p>
                              <p className="text-2xl font-bold">{editingClient.invoiceStats.total}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Pagos</p>
                              <p className="text-2xl font-bold text-green-600">{editingClient.invoiceStats.paid}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Pendentes</p>
                              <p className="text-2xl font-bold text-orange-600">{editingClient.invoiceStats.pending}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total Faturado</p>
                              <p className="text-lg font-bold">{formatCurrency(editingClient.invoiceStats.totalAmount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total Recebido</p>
                              <p className="text-lg font-bold text-green-600">{formatCurrency(editingClient.invoiceStats.paidAmount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">A Receber</p>
                              <p className="text-lg font-bold text-orange-600">
                                {formatCurrency(editingClient.invoiceStats.totalAmount - editingClient.invoiceStats.paidAmount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

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

                      {/* Tipo de Cliente */}
                      <div className="space-y-4 col-span-2 border-t pt-4">
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
                    </div>
                  </TabsContent>
                </Tabs>

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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Clientes</CardTitle>
                <CardDescription>
                  {selectedClientId ? (
                    <>Cliente selecionado: {clients.find(c => c.id === selectedClientId)?.name}</>
                  ) : (
                    <>Total: {clients.filter(client => 
                      statusFilter === "all" || client.status === statusFilter
                    ).length} clientes</>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedClientId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearSelectedClient()}
                  >
                    Limpar seleção
                  </Button>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Suspensos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {clients.filter(client => 
              (selectedClientId ? client.id === selectedClientId : true) &&
              (statusFilter === "all" || client.status === statusFilter)
            ).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {statusFilter === "all" 
                  ? "Nenhum cliente cadastrado ainda" 
                  : `Nenhum cliente ${statusFilter === "active" ? "ativo" : "suspenso"} encontrado`}
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
                    <TableHead>IA</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.filter(client => 
                    (selectedClientId ? client.id === selectedClientId : true) &&
                    (statusFilter === "all" || client.status === statusFilter)
                  ).map((client) => {
                    const today = new Date();
                    const isProBonoActive = client.is_pro_bono && 
                      (!client.pro_bono_end_date || new Date(client.pro_bono_end_date) >= today);
                    const isSuspended = client.status === "inactive";
                    
                    return (
                      <TableRow 
                        key={client.id}
                        className={isSuspended ? "border-l-4 border-l-destructive bg-destructive/5" : ""}
                      >
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
                          <Badge variant={client.status === "active" ? "default" : "destructive"}>
                            {client.status === "active" ? "Ativo" : "Suspenso"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <AIClientAnalyzer
                            clientId={client.id}
                            trigger={
                              <Button size="sm" variant="outline">
                                <Users className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedClient(client.id, client.name);
                              navigate("/client-dashboard");
                            }}
                            title="Ver Dashboard"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
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
                              setDeleteClientId(client.id);
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
