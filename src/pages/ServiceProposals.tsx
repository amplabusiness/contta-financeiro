import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Eye,
  Send,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  Copy,
  Trash2,
  Building2,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ServiceProposal {
  id: string;
  proposal_number: string;
  client_id: string | null;
  prospect_name: string | null;
  prospect_cnpj: string | null;
  prospect_email: string | null;
  proposal_type: string;
  services: any[];
  monthly_fee: number;
  setup_fee: number;
  valid_until: string;
  status: string;
  created_at: string;
  clients?: { name: string; cnpj: string };
}

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
}

// Serviços padrão por tipo de proposta
const defaultServices = {
  accounting: [
    { service: "Escrituração Contábil Completa", description: "Lançamentos contábeis mensais conforme NBC", frequency: "mensal", value: 0, included: true },
    { service: "Balancetes Mensais", description: "Elaboração e análise de balancetes", frequency: "mensal", value: 0, included: true },
    { service: "Balanço Patrimonial", description: "Elaboração anual do Balanço Patrimonial", frequency: "anual", value: 0, included: true },
    { service: "DRE - Demonstração do Resultado", description: "Demonstração do Resultado do Exercício", frequency: "anual", value: 0, included: true },
    { service: "SPED Contábil (ECD)", description: "Escrituração Contábil Digital", frequency: "anual", value: 0, included: true },
    { service: "ECF - Escrituração Contábil Fiscal", description: "Entrega anual da ECF", frequency: "anual", value: 0, included: true },
    { service: "Assessoria Contábil", description: "Orientação e suporte contábil mensal", frequency: "mensal", value: 0, included: true },
  ],
  payroll: [
    { service: "Folha de Pagamento", description: "Processamento mensal da folha", frequency: "mensal", value: 0, included: true },
    { service: "Encargos Sociais (INSS/FGTS)", description: "Cálculo e guias de recolhimento", frequency: "mensal", value: 0, included: true },
    { service: "eSocial", description: "Envio de eventos ao eSocial", frequency: "mensal", value: 0, included: true },
    { service: "Admissões e Demissões", description: "Processamento de movimentações", frequency: "eventual", value: 0, included: true },
    { service: "Férias e 13º Salário", description: "Cálculo e processamento", frequency: "eventual", value: 0, included: true },
    { service: "RAIS/DIRF", description: "Declarações anuais obrigatórias", frequency: "anual", value: 0, included: true },
    { service: "Assessoria Trabalhista", description: "Orientação em questões trabalhistas", frequency: "mensal", value: 0, included: true },
  ],
  tax: [
    { service: "Apuração de Impostos Federais", description: "IRPJ, CSLL, PIS, COFINS", frequency: "mensal", value: 0, included: true },
    { service: "Apuração de ICMS", description: "Impostos estaduais", frequency: "mensal", value: 0, included: true },
    { service: "Apuração de ISS", description: "Impostos municipais", frequency: "mensal", value: 0, included: true },
    { service: "DCTF", description: "Declaração de Débitos e Créditos", frequency: "mensal", value: 0, included: true },
    { service: "SPED Fiscal", description: "Escrituração Fiscal Digital", frequency: "mensal", value: 0, included: true },
    { service: "Planejamento Tributário", description: "Análise e otimização fiscal", frequency: "anual", value: 0, included: true },
  ],
  consulting: [
    { service: "Consultoria Empresarial", description: "Análise e orientação gerencial", frequency: "mensal", value: 0, included: true },
    { service: "Relatórios Gerenciais", description: "Elaboração de relatórios personalizados", frequency: "mensal", value: 0, included: true },
    { service: "Análise de Viabilidade", description: "Estudos de viabilidade econômica", frequency: "eventual", value: 0, included: true },
    { service: "Planejamento Estratégico", description: "Apoio ao planejamento da empresa", frequency: "eventual", value: 0, included: true },
  ],
  opening: [
    { service: "Abertura de Empresa", description: "Processo completo de constituição", frequency: "único", value: 0, included: true },
    { service: "Registro na Junta Comercial", description: "Protocolo e acompanhamento", frequency: "único", value: 0, included: true },
    { service: "Inscrição CNPJ", description: "Cadastro na Receita Federal", frequency: "único", value: 0, included: true },
    { service: "Inscrição Estadual/Municipal", description: "Cadastros fiscais", frequency: "único", value: 0, included: true },
    { service: "Alvará de Funcionamento", description: "Licenças municipais", frequency: "único", value: 0, included: true },
  ],
  full_package: [
    { service: "Contabilidade Completa", description: "Todos os serviços contábeis", frequency: "mensal", value: 0, included: true },
    { service: "Departamento Pessoal", description: "Folha de pagamento e encargos", frequency: "mensal", value: 0, included: true },
    { service: "Fiscal/Tributário", description: "Apuração de impostos e obrigações", frequency: "mensal", value: 0, included: true },
    { service: "Assessoria Geral", description: "Suporte completo ao cliente", frequency: "mensal", value: 0, included: true },
  ],
};

const ServiceProposals = () => {
  const { toast } = useToast();

  // Estados de carregamento
  const [isLoading, setIsLoading] = useState(false);

  // Estados de dados principais
  const [proposals, setProposals] = useState<ServiceProposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<ServiceProposal | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [services, setServices] = useState<any[]>([]);
  const [isProspect, setIsProspect] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    prospect_name: "",
    prospect_cnpj: "",
    prospect_email: "",
    prospect_phone: "",
    proposal_type: "full_package",
    monthly_fee: "",
    setup_fee: "0",
    payment_day: "10",
    adjustment_index: "IGPM",
    valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
  });

  // Estados de diálogos
  const [showNewProposal, setShowNewProposal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const fetchProposals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_proposals")
        .select(`
          *,
          clients:client_id (name, cnpj)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      toast({
        title: "Erro ao carregar propostas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, cnpj, email, phone")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  }, []);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    fetchProposals();
    fetchClients();
  }, [fetchProposals, fetchClients]);

  useEffect(() => {
    // Atualizar serviços quando o tipo de proposta muda
    const defaultServiceList = defaultServices[formData.proposal_type as keyof typeof defaultServices] || [];
    setServices(defaultServiceList.map(s => ({ ...s })));
  }, [formData.proposal_type]);

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const handleServiceToggle = (index: number) => {
    const newServices = [...services];
    newServices[index].included = !newServices[index].included;
    setServices(newServices);
  };

  const handleServiceValueChange = (index: number, value: string) => {
    const newServices = [...services];
    newServices[index].value = parseFloat(value) || 0;
    setServices(newServices);
  };

  const calculateTotalMonthly = () => {
    return services
      .filter(s => s.included && s.frequency === "mensal")
      .reduce((sum, s) => sum + (s.value || 0), 0);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      draft: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Rascunho</Badge>,
      sent: <Badge className="bg-blue-100 text-blue-800"><Send className="w-3 h-3 mr-1" />Enviada</Badge>,
      viewed: <Badge className="bg-purple-100 text-purple-800"><Eye className="w-3 h-3 mr-1" />Visualizada</Badge>,
      negotiating: <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Negociando</Badge>,
      accepted: <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Aceita</Badge>,
      rejected: <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejeitada</Badge>,
      expired: <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Expirada</Badge>,
      converted: <Badge className="bg-emerald-100 text-emerald-800"><ArrowRight className="w-3 h-3 mr-1" />Convertida</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  const getProposalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      accounting: "Contabilidade",
      payroll: "Departamento Pessoal",
      tax: "Fiscal/Tributário",
      consulting: "Consultoria",
      opening: "Abertura de Empresa",
      full_package: "Pacote Completo",
    };
    return labels[type] || type;
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      prospect_name: "",
      prospect_cnpj: "",
      prospect_email: "",
      prospect_phone: "",
      proposal_type: "full_package",
      monthly_fee: "",
      setup_fee: "0",
      payment_day: "10",
      adjustment_index: "IGPM",
      valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: "",
    });
    setIsProspect(false);
    setServices([]);
  };

  const filteredProposals = proposals.filter(p => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return ["draft", "sent", "viewed", "negotiating"].includes(p.status);
    if (activeTab === "accepted") return p.status === "accepted" || p.status === "converted";
    if (activeTab === "rejected") return p.status === "rejected" || p.status === "expired";
    return true;
  });

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleSaveProposal = async () => {
    try {
      const includedServices = services.filter(s => s.included);

      if (includedServices.length === 0) {
        toast({
          title: "Selecione os serviços",
          description: "É necessário selecionar pelo menos um serviço.",
          variant: "destructive",
        });
        return;
      }

      const proposalData = {
        client_id: isProspect ? null : formData.client_id || null,
        prospect_name: isProspect ? formData.prospect_name : null,
        prospect_cnpj: isProspect ? formData.prospect_cnpj : null,
        prospect_email: isProspect ? formData.prospect_email : null,
        prospect_phone: isProspect ? formData.prospect_phone : null,
        proposal_type: formData.proposal_type,
        services: includedServices,
        monthly_fee: parseFloat(formData.monthly_fee) || calculateTotalMonthly(),
        setup_fee: parseFloat(formData.setup_fee) || 0,
        payment_day: parseInt(formData.payment_day),
        adjustment_index: formData.adjustment_index,
        valid_until: formData.valid_until,
        notes: formData.notes,
        status: "draft",
      };

      const { data, error } = await supabase
        .from("service_proposals")
        .insert(proposalData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Proposta criada",
        description: `Proposta ${data.proposal_number} criada com sucesso.`,
      });

      setShowNewProposal(false);
      resetForm();
      fetchProposals();
    } catch (error) {
      console.error("Error saving proposal:", error);
      toast({
        title: "Erro ao salvar proposta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleSendProposal = async (proposal: ServiceProposal) => {
    try {
      const { error } = await supabase
        .from("service_proposals")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);

      if (error) throw error;

      toast({
        title: "Proposta enviada",
        description: "Status atualizado para 'Enviada'.",
      });

      fetchProposals();
    } catch (error) {
      toast({
        title: "Erro ao enviar proposta",
        variant: "destructive",
      });
    }
  };

  const handleConvertToContract = async (proposal: ServiceProposal) => {
    try {
      // Criar contrato a partir da proposta
      const contractData = {
        client_id: proposal.client_id,
        proposal_id: proposal.id,
        contract_type: proposal.proposal_type === "full_package" ? "service" : proposal.proposal_type,
        start_date: new Date().toISOString().split("T")[0],
        monthly_fee: proposal.monthly_fee,
        setup_fee: proposal.setup_fee,
        services: proposal.services,
        status: "draft",
      };

      const { data: contract, error: contractError } = await supabase
        .from("accounting_contracts")
        .insert(contractData)
        .select()
        .single();

      if (contractError) throw contractError;

      // Atualizar proposta
      const { error: proposalError } = await supabase
        .from("service_proposals")
        .update({
          status: "converted",
          converted_contract_id: contract.id,
        })
        .eq("id", proposal.id);

      if (proposalError) throw proposalError;

      toast({
        title: "Contrato criado",
        description: `Contrato ${contract.contract_number} gerado a partir da proposta.`,
      });

      fetchProposals();
    } catch (error) {
      toast({
        title: "Erro ao converter proposta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };


  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Propostas de Serviços</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Conforme NBC PG 01 - Proposta escrita obrigatória antes do contrato
            </p>
          </div>
          <Button onClick={() => setShowNewProposal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Proposta
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{proposals.length}</div>
              <p className="text-xs text-muted-foreground">Total de Propostas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {proposals.filter(p => ["draft", "sent", "viewed", "negotiating"].includes(p.status)).length}
              </div>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {proposals.filter(p => p.status === "accepted" || p.status === "converted").length}
              </div>
              <p className="text-xs text-muted-foreground">Aceitas/Convertidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {proposals.filter(p => p.status === "rejected" || p.status === "expired").length}
              </div>
              <p className="text-xs text-muted-foreground">Rejeitadas/Expiradas</p>
            </CardContent>
          </Card>
        </div>

        {/* Proposals Table */}
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pending">Em Andamento</TabsTrigger>
                <TabsTrigger value="accepted">Aceitas</TabsTrigger>
                <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {filteredProposals.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma proposta encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Crie uma proposta de serviços para seus clientes
                </p>
                <Button onClick={() => setShowNewProposal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Proposta
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Proposta</TableHead>
                    <TableHead>Cliente/Prospect</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-mono text-sm">
                        {proposal.proposal_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {proposal.client_id ? (
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <User className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">
                            {proposal.clients?.name || proposal.prospect_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getProposalTypeLabel(proposal.proposal_type)}</TableCell>
                      <TableCell>
                        R$ {Number(proposal.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {new Date(proposal.valid_until).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedProposal(proposal);
                              setShowPreview(true);
                            }}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          {proposal.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendProposal(proposal)}
                            >
                              <Send className="w-3 h-3" />
                            </Button>
                          )}
                          {(proposal.status === "accepted" || proposal.status === "sent") && proposal.client_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600"
                              onClick={() => handleConvertToContract(proposal)}
                            >
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* New Proposal Dialog */}
        <Dialog open={showNewProposal} onOpenChange={setShowNewProposal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Proposta de Serviços</DialogTitle>
              <DialogDescription>
                Conforme NBC PG 01, o contrato deve ser precedido de proposta escrita
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Cliente ou Prospect */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isProspect"
                    checked={isProspect}
                    onCheckedChange={(checked) => setIsProspect(checked as boolean)}
                  />
                  <Label htmlFor="isProspect">Prospect (cliente não cadastrado)</Label>
                </div>
              </div>

              {isProspect ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome/Razão Social *</Label>
                    <Input
                      value={formData.prospect_name}
                      onChange={(e) => setFormData({ ...formData, prospect_name: e.target.value })}
                      placeholder="Nome do prospect"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ/CPF</Label>
                    <Input
                      value={formData.prospect_cnpj}
                      onChange={(e) => setFormData({ ...formData, prospect_cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={formData.prospect_email}
                      onChange={(e) => setFormData({ ...formData, prospect_email: e.target.value })}
                      placeholder="email@empresa.com.br"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.prospect_phone}
                      onChange={(e) => setFormData({ ...formData, prospect_phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} {client.cnpj && `- ${client.cnpj}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tipo de Proposta */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Proposta *</Label>
                  <Select
                    value={formData.proposal_type}
                    onValueChange={(value) => setFormData({ ...formData, proposal_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_package">Pacote Completo</SelectItem>
                      <SelectItem value="accounting">Contabilidade</SelectItem>
                      <SelectItem value="payroll">Departamento Pessoal</SelectItem>
                      <SelectItem value="tax">Fiscal/Tributário</SelectItem>
                      <SelectItem value="consulting">Consultoria</SelectItem>
                      <SelectItem value="opening">Abertura de Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Validade da Proposta *</Label>
                  <Input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>

              {/* Serviços */}
              <div className="space-y-2">
                <Label>Serviços Incluídos</Label>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {services.map((service, index) => (
                    <div key={index} className="flex items-center gap-4 p-3">
                      <Checkbox
                        checked={service.included}
                        onCheckedChange={() => handleServiceToggle(index)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{service.service}</div>
                        <div className="text-xs text-muted-foreground">{service.description}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {service.frequency}
                      </Badge>
                      <Input
                        type="number"
                        className="w-24"
                        placeholder="R$ 0,00"
                        value={service.value || ""}
                        onChange={(e) => handleServiceValueChange(index, e.target.value)}
                        disabled={!service.included}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Honorários Mensais (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.monthly_fee}
                    onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
                    placeholder={calculateTotalMonthly().toFixed(2)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taxa de Implantação (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.setup_fee}
                    onChange={(e) => setFormData({ ...formData, setup_fee: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dia do Vencimento</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payment_day}
                    onChange={(e) => setFormData({ ...formData, payment_day: e.target.value })}
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Condições especiais, observações..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowNewProposal(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProposal}>
                Criar Proposta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Proposta {selectedProposal?.proposal_number}</DialogTitle>
            </DialogHeader>
            {selectedProposal && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Cliente</Label>
                    <p className="font-medium">
                      {selectedProposal.clients?.name || selectedProposal.prospect_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tipo</Label>
                    <p className="font-medium">{getProposalTypeLabel(selectedProposal.proposal_type)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valor Mensal</Label>
                    <p className="font-medium text-lg">
                      R$ {Number(selectedProposal.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedProposal.status)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Serviços Incluídos</Label>
                  <div className="mt-2 space-y-1">
                    {selectedProposal.services?.map((service: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{service.service}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {service.frequency}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ServiceProposals;
