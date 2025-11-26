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
import { CNPJInput } from "@/components/CNPJInput";
import { EconomicGroupIndicator } from "@/components/EconomicGroupIndicator";

const Clients = () => {
  const navigate = useNavigate();
  const { selectedClientId, setSelectedClient, clearSelectedClient } = useClient();
  const [clients, setClients] = useState<any[]>([]);
  const [allClientsForGroups, setAllClientsForGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [enriching, setEnriching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    cpf: "",
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

  const formatDocument = (client: any) => {
    if (client.cnpj) {
      const cleaned = client.cnpj.replace(/\D/g, "");
      return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    if (client.cpf) {
      const cleaned = client.cpf.replace(/\D/g, "");
      return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    return "-";
  };

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      // Buscar clientes com honorário mensal E QUE ESTEJAM ATIVOS
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
        .eq('status', 'active')
        .order("name");

      if (clientsError) throw clientsError;

      // Buscar TODOS os clientes para identificação de grupos econômicos
      const { data: allClientsData, error: allClientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf, qsa, monthly_fee")
        .order("name");

      if (allClientsError) throw allClientsError;
      setAllClientsForGroups(allClientsData || []);
      
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

      // Identificar se é CPF ou CNPJ baseado no campo preenchido
      const documentValue = formData.cnpj || formData.cpf;
      const documentNormalized = documentValue.replace(/[^\d]/g, '');
      const isCPF = documentNormalized.length === 11;
      const isCNPJ = documentNormalized.length === 14;

      // Validação: deve ter CPF ou CNPJ
      if (!isCPF && !isCNPJ) {
        toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
        setLoading(false);
        return;
      }

      // Validar documento duplicado antes de inserir
      const { data: existingClients, error: checkError } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf")
        .not("id", "eq", editingClient?.id || "00000000-0000-0000-0000-000000000000");

      if (checkError) throw checkError;

      // Verificar duplicata
      const duplicateClient = existingClients?.find(client => {
        if (isCPF && client.cpf) {
          const existingCPF = client.cpf.replace(/[^\d]/g, '');
          return existingCPF === documentNormalized;
        }
        if (isCNPJ && client.cnpj) {
          const existingCNPJ = client.cnpj.replace(/[^\d]/g, '');
          return existingCNPJ === documentNormalized;
        }
        return false;
      });

      if (duplicateClient) {
        const docType = isCPF ? "CPF" : "CNPJ";
        toast.error(`${docType} já cadastrado para o cliente: ${duplicateClient.name}`, {
          description: `Não é possível cadastrar o mesmo ${docType} duas vezes.`,
          duration: 5000,
        });
        setLoading(false);
        return;
      }

      const clientData = {
        name: formData.name,
        cnpj: isCNPJ ? documentValue : null,
        cpf: isCPF ? documentValue : null,
        email: formData.email,
        phone: formData.phone,
        monthly_fee: parseFloat(formData.monthly_fee) || 0,
        payment_day: formData.payment_day ? parseInt(formData.payment_day) : null,
        notes: formData.notes,
        status: formData.status,
        is_pro_bono: formData.is_pro_bono,
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

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clients").insert(clientData);
        if (error) throw error;
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
      // Verificar se há invoices (faturas) vinculadas
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', deleteClientId)
        .limit(1);

      if (invoicesError) throw invoicesError;

      // Se houver faturas, apenas inativar o cliente
      if (invoices && invoices.length > 0) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ status: 'inactive' })
          .eq('id', deleteClientId);

        if (updateError) throw updateError;

        const clientName = clients.find(c => c.id === deleteClientId)?.name;
        toast.warning(`Cliente ${clientName} foi suspenso`, {
          description: 'Cliente possui faturas vinculadas e não pode ser excluído permanentemente'
        });
      } else {
        // Se não houver faturas, excluir completamente
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', deleteClientId);

        if (error) {
          // Se houver erro de constraint, tentar inativar
          if (error.code === '23503') { // Foreign key violation
            const { error: updateError } = await supabase
              .from('clients')
              .update({ status: 'inactive' })
              .eq('id', deleteClientId);

            if (updateError) throw updateError;

            const clientName = clients.find(c => c.id === deleteClientId)?.name;
            toast.warning(`Cliente ${clientName} foi suspenso`, {
              description: 'Cliente possui registros vinculados e não pode ser excluído permanentemente'
            });
          } else {
            throw error;
          }
        } else {
          toast.success("Cliente excluído com sucesso!");
        }
      }

      setDeleteDialogOpen(false);
      setDeleteClientId(null);
      loadClients();
    } catch (error: any) {
      console.error("Erro ao excluir/inativar cliente:", error);
      toast.error("Erro ao processar exclusão do cliente");
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

  const handleCNPJDataFetched = (data: any) => {
    // Callback quando CNPJInput buscar dados automaticamente
    const socios = data.qsa?.map((socio: any) => ({
      nome: socio.nome_socio || socio.nome,
      qualificacao: socio.qualificacao_socio || socio.qual,
      data_entrada: socio.data_entrada_sociedade
    })) || [];
    
    setFormData(prev => ({
      ...prev,
      name: data.razao_social || prev.name,
      email: data.email || prev.email,
      phone: data.telefone || prev.phone,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      porte: data.porte,
      natureza_juridica: data.natureza_juridica,
      situacao_cadastral: data.situacao,
      data_abertura: data.data_abertura,
      capital_social: data.capital_social,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      municipio: data.municipio,
      uf: data.uf,
      cep: data.cep,
      atividade_principal: data.atividade_principal,
      atividades_secundarias: data.atividades_secundarias || [],
      qsa: socios
    }));
  };

  const enrichByCNPJ = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      toast.error('Digite um CNPJ válido com 14 dígitos');
      return;
    }
    
    setEnriching(true);
    try {
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
      cpf: "",
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
      cpf: client.cpf || "",
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
                        <CNPJInput
                          value={formData.cnpj || formData.cpf}
                          onChange={(value) => {
                            const normalized = value.replace(/[^\d]/g, '');
                            if (normalized.length <= 11) {
                              setFormData({ ...formData, cpf: value, cnpj: "" });
                            } else {
                              setFormData({ ...formData, cnpj: value, cpf: "" });
                            }
                          }}
                          onDataFetched={handleCNPJDataFetched}
                          autoFetch={true}
                          label="CPF/CNPJ"
                          required={true}
                          allowCPF={true}
                        />
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
                                  monthly_fee: "0",
                                  payment_day: ""
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
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Honorário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Grupo Econômico</TableHead>
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
                        <TableCell>{formatDocument(client)}</TableCell>
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
                          <EconomicGroupIndicator client={client} allClients={allClientsForGroups} />
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
                              setViewingClient(client);
                              setViewDialogOpen(true);
                            }}
                            title="Ver Dados da Empresa"
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
                      <Badge variant={viewingClient.status === "active" ? "default" : "destructive"}>
                        {viewingClient.status === "active" ? "Ativo" : "Suspenso"}
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

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este cliente?
                <br/><br/>
                <span className="text-xs text-muted-foreground">
                  • Se o cliente possuir faturas ou lançamentos contábeis, será apenas <strong>suspenso</strong> para preservar o histórico financeiro.
                  <br/>
                  • Caso contrário, será <strong>excluído permanentemente</strong> do sistema.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Clients;
