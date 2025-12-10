import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Percent, Building2, Users, FileText, Plus, Search, DollarSign,
  Calendar, TrendingUp, UserPlus, Calculator, Edit, Trash2,
  CheckCircle, Clock, AlertCircle, Banknote
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos
interface VariableFee {
  id: string;
  client_id: string;
  client_name?: string;
  fee_name: string;
  fee_type: string;
  percentage_rate: number;
  due_day: number;
  calculation_base: string;
  is_active: boolean;
}

interface CompanyService {
  id: string;
  client_id?: string;
  service_type: string;
  service_status: string;
  company_name: string;
  company_cnpj?: string;
  total_charged: number;
  total_costs: number;
  profit: number;
  start_date: string;
  payment_status: string;
  amount_received: number;
}

interface ReferralPartner {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
  pix_key?: string;
  pix_key_type?: string;
  is_active: boolean;
  referral_count?: number;
  total_commissions?: number;
}

interface ClientReferral {
  id: string;
  client_id: string;
  client_name?: string;
  referral_partner_id: string;
  partner_name?: string;
  commission_percentage: number;
  commission_months: number;
  months_paid: number;
  total_commission_paid: number;
  status: string;
  start_date: string;
}

interface IrpfDeclaration {
  id: string;
  calendar_year: number;
  taxpayer_type: string;
  taxpayer_name: string;
  taxpayer_cpf: string;
  client_id?: string;
  client_name?: string;
  fee_amount: number;
  status: string;
  payment_status: string;
  result_type?: string;
  result_amount?: number;
}

export default function SpecialFees() {
  const [activeTab, setActiveTab] = useState("variable");
  const [loading, setLoading] = useState(true);

  // Estados para cada tipo
  const [variableFees, setVariableFees] = useState<VariableFee[]>([]);
  const [companyServices, setCompanyServices] = useState<CompanyService[]>([]);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>([]);
  const [clientReferrals, setClientReferrals] = useState<ClientReferral[]>([]);
  const [irpfDeclarations, setIrpfDeclarations] = useState<IrpfDeclaration[]>([]);

  // Estados para diálogos
  const [showVariableFeeDialog, setShowVariableFeeDialog] = useState(false);
  const [showCompanyServiceDialog, setShowCompanyServiceDialog] = useState(false);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showIrpfDialog, setShowIrpfDialog] = useState(false);

  // Clientes para seleção
  const [clients, setClients] = useState<{id: string, name: string, cnpj?: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
    loadClients();
  }, [activeTab]);

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, cnpj')
      .eq('is_active', true)
      .order('name');
    if (data) setClients(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case "variable":
          await loadVariableFees();
          break;
        case "company":
          await loadCompanyServices();
          break;
        case "referral":
          await loadReferrals();
          break;
        case "irpf":
          await loadIrpf();
          break;
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadVariableFees = async () => {
    const { data, error } = await supabase
      .from('client_variable_fees')
      .select(`
        *,
        clients(name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setVariableFees(data?.map(f => ({
      ...f,
      client_name: f.clients?.name
    })) || []);
  };

  const loadCompanyServices = async () => {
    const { data, error } = await supabase
      .from('company_services')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setCompanyServices(data || []);
  };

  const loadReferrals = async () => {
    // Parceiros
    const { data: partners } = await supabase
      .from('referral_partners')
      .select('*')
      .order('name');

    // Indicações
    const { data: referrals } = await supabase
      .from('client_referrals')
      .select(`
        *,
        clients(name),
        referral_partners(name)
      `)
      .order('created_at', { ascending: false });

    setReferralPartners(partners || []);
    setClientReferrals(referrals?.map(r => ({
      ...r,
      client_name: r.clients?.name,
      partner_name: r.referral_partners?.name
    })) || []);
  };

  const loadIrpf = async () => {
    const { data, error } = await supabase
      .from('irpf_declarations')
      .select(`
        *,
        clients(name)
      `)
      .order('calendar_year', { ascending: false });

    if (error) throw error;
    setIrpfDeclarations(data?.map(d => ({
      ...d,
      client_name: d.clients?.name
    })) || []);
  };

  // Formulários
  const [variableFeeForm, setVariableFeeForm] = useState({
    client_id: '',
    fee_name: 'Honorário Variável',
    fee_type: 'percentage',
    percentage_rate: 2.87,
    due_day: 20,
    calculation_base: 'faturamento'
  });

  const [companyServiceForm, setCompanyServiceForm] = useState({
    service_type: 'abertura',
    company_name: '',
    company_cnpj: '',
    company_type: 'LTDA',
    total_charged: 2500
  });

  const [partnerForm, setPartnerForm] = useState({
    name: '',
    cpf: '',
    email: '',
    phone: '',
    pix_key: '',
    pix_key_type: 'cpf'
  });

  const [referralForm, setReferralForm] = useState({
    client_id: '',
    referral_partner_id: '',
    commission_percentage: 10,
    commission_months: 5
  });

  const [irpfForm, setIrpfForm] = useState({
    calendar_year: new Date().getFullYear() - 1,
    taxpayer_type: 'socio',
    taxpayer_name: '',
    taxpayer_cpf: '',
    client_id: '',
    fee_amount: 300
  });

  // Handlers de salvamento
  const saveVariableFee = async () => {
    try {
      const { error } = await supabase
        .from('client_variable_fees')
        .insert(variableFeeForm);

      if (error) throw error;

      toast.success('Honorário variável cadastrado!');
      setShowVariableFeeDialog(false);
      loadVariableFees();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const saveCompanyService = async () => {
    try {
      const { error } = await supabase
        .from('company_services')
        .insert(companyServiceForm);

      if (error) throw error;

      toast.success('Serviço cadastrado!');
      setShowCompanyServiceDialog(false);
      loadCompanyServices();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const savePartner = async () => {
    try {
      const { error } = await supabase
        .from('referral_partners')
        .insert(partnerForm);

      if (error) throw error;

      toast.success('Parceiro cadastrado!');
      setShowPartnerDialog(false);
      loadReferrals();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const saveReferral = async () => {
    try {
      const { error } = await supabase
        .from('client_referrals')
        .insert(referralForm);

      if (error) throw error;

      toast.success('Indicação cadastrada!');
      setShowReferralDialog(false);
      loadReferrals();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const saveIrpf = async () => {
    try {
      const { error } = await supabase
        .from('irpf_declarations')
        .insert({
          ...irpfForm,
          fiscal_year: irpfForm.calendar_year + 1
        });

      if (error) throw error;

      toast.success('Declaração cadastrada!');
      setShowIrpfDialog(false);
      loadIrpf();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  // Função para gerar IRPF dos sócios
  const generateIrpfFromPartners = async () => {
    try {
      setLoading(true);
      const calendarYear = new Date().getFullYear() - 1;

      // Buscar todos clientes com QSA
      const { data: clientsWithQsa } = await supabase
        .from('clients')
        .select('id, name, qsa')
        .eq('is_active', true)
        .not('qsa', 'is', null);

      if (!clientsWithQsa) {
        toast.error('Nenhum cliente com sócios encontrado');
        return;
      }

      // Extrair sócios únicos
      const partners = new Map<string, { name: string; cpf: string; client_id: string; client_name: string }>();

      for (const client of clientsWithQsa) {
        const qsa = Array.isArray(client.qsa) ? client.qsa : [];
        for (const socio of qsa) {
          const cpf = socio.cpf_socio || socio.cpf || '';
          const nome = socio.nome_socio || socio.nome || '';
          if (cpf && nome) {
            partners.set(cpf, {
              name: nome,
              cpf: cpf,
              client_id: client.id,
              client_name: client.name
            });
          }
        }
      }

      // Criar declarações
      let created = 0;
      for (const [cpf, partner] of partners) {
        // Verificar se já existe
        const { data: existing } = await supabase
          .from('irpf_declarations')
          .select('id')
          .eq('taxpayer_cpf', cpf)
          .eq('calendar_year', calendarYear)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase
            .from('irpf_declarations')
            .insert({
              calendar_year: calendarYear,
              fiscal_year: calendarYear + 1,
              taxpayer_type: 'socio',
              taxpayer_name: partner.name,
              taxpayer_cpf: partner.cpf,
              client_id: partner.client_id,
              fee_amount: 300,
              status: 'pendente'
            });

          if (!error) created++;
        }
      }

      toast.success(`${created} declarações criadas de ${partners.size} sócios`);
      loadIrpf();
    } catch (error: any) {
      toast.error('Erro ao gerar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'pending': { label: 'Pendente', variant: 'secondary' },
      'pendente': { label: 'Pendente', variant: 'secondary' },
      'active': { label: 'Ativo', variant: 'default' },
      'em_andamento': { label: 'Em Andamento', variant: 'default' },
      'concluido': { label: 'Concluído', variant: 'outline' },
      'paid': { label: 'Pago', variant: 'outline' },
      'completed': { label: 'Completo', variant: 'outline' },
      'cancelled': { label: 'Cancelado', variant: 'destructive' },
      'enviada': { label: 'Enviada', variant: 'default' },
      'documentos_solicitados': { label: 'Aguard. Docs', variant: 'secondary' },
      'em_elaboracao': { label: 'Em Elaboração', variant: 'default' },
    };

    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cnpj && c.cnpj.includes(searchTerm))
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Honorários Especiais</h1>
            <p className="text-muted-foreground">
              Gerencie honorários variáveis, abertura de empresas, comissões e IRPF
            </p>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hon. Variáveis</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{variableFees.filter(f => f.is_active).length}</div>
              <p className="text-xs text-muted-foreground">clientes ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aberturas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companyServices.filter(s => s.service_status === 'em_andamento').length}
              </div>
              <p className="text-xs text-muted-foreground">em andamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clientReferrals.filter(r => r.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">indicações ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">IRPF {new Date().getFullYear()}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {irpfDeclarations.filter(d => d.calendar_year === new Date().getFullYear() - 1).length}
              </div>
              <p className="text-xs text-muted-foreground">declarações</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="variable" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Variáveis
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Abertura/Alteração
            </TabsTrigger>
            <TabsTrigger value="referral" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Indicações
            </TabsTrigger>
            <TabsTrigger value="irpf" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              IRPF
            </TabsTrigger>
          </TabsList>

          {/* Tab: Honorários Variáveis */}
          <TabsContent value="variable" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Honorários Variáveis</CardTitle>
                    <CardDescription>
                      Clientes com honorário baseado em % do faturamento
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowVariableFeeDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Honorário
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variableFees.map(fee => (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">{fee.client_name}</TableCell>
                        <TableCell>{fee.fee_name}</TableCell>
                        <TableCell>{fee.percentage_rate}%</TableCell>
                        <TableCell className="capitalize">{fee.calculation_base}</TableCell>
                        <TableCell>Dia {fee.due_day}</TableCell>
                        <TableCell>
                          <Badge variant={fee.is_active ? "default" : "secondary"}>
                            {fee.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {variableFees.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum honorário variável cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Abertura/Alteração de Empresas */}
          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Abertura / Alteração de Empresas</CardTitle>
                    <CardDescription>
                      Controle de serviços de abertura, alteração e baixa de empresas
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowCompanyServiceDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Serviço
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor Cobrado</TableHead>
                      <TableHead>Taxas Pagas</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyServices.map(service => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.company_name}</TableCell>
                        <TableCell className="capitalize">{service.service_type}</TableCell>
                        <TableCell>{formatCurrency(service.total_charged)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(service.total_costs)}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(service.profit)}
                        </TableCell>
                        <TableCell>{getStatusBadge(service.service_status)}</TableCell>
                        <TableCell>{getStatusBadge(service.payment_status)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {companyServices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum serviço cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Indicações */}
          <TabsContent value="referral" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Parceiros */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Parceiros/Corretores</CardTitle>
                      <CardDescription>Pessoas que indicam clientes</CardDescription>
                    </div>
                    <Button onClick={() => setShowPartnerDialog(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {referralPartners.map(partner => (
                      <div key={partner.id} className="flex items-center justify-between p-3 border-b">
                        <div>
                          <p className="font-medium">{partner.name}</p>
                          <p className="text-sm text-muted-foreground">
                            PIX: {partner.pix_key || 'Não informado'}
                          </p>
                        </div>
                        <Badge variant={partner.is_active ? "default" : "secondary"}>
                          {partner.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))}
                    {referralPartners.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum parceiro cadastrado
                      </p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Indicações */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Indicações Ativas</CardTitle>
                      <CardDescription>Clientes indicados com comissão</CardDescription>
                    </div>
                    <Button onClick={() => setShowReferralDialog(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {clientReferrals.map(referral => (
                      <div key={referral.id} className="p-3 border-b">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{referral.client_name}</p>
                          {getStatusBadge(referral.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Indicado por: {referral.partner_name}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm">
                          <span>{referral.commission_percentage}% por {referral.commission_months} meses</span>
                          <span className="text-muted-foreground">
                            ({referral.months_paid}/{referral.commission_months} pagos)
                          </span>
                        </div>
                      </div>
                    ))}
                    {clientReferrals.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma indicação cadastrada
                      </p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: IRPF */}
          <TabsContent value="irpf" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Declarações de IRPF</CardTitle>
                    <CardDescription>
                      Declarações de imposto de renda dos sócios e particulares
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={generateIrpfFromPartners}>
                      <Users className="h-4 w-4 mr-2" />
                      Gerar dos Sócios
                    </Button>
                    <Button onClick={() => setShowIrpfDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Declaração
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ano-Cal.</TableHead>
                      <TableHead>Contribuinte</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Honorário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {irpfDeclarations.map(decl => (
                      <TableRow key={decl.id}>
                        <TableCell>{decl.calendar_year}</TableCell>
                        <TableCell className="font-medium">{decl.taxpayer_name}</TableCell>
                        <TableCell>{decl.taxpayer_cpf}</TableCell>
                        <TableCell className="capitalize">{decl.taxpayer_type}</TableCell>
                        <TableCell>{decl.client_name || '-'}</TableCell>
                        <TableCell>{formatCurrency(decl.fee_amount)}</TableCell>
                        <TableCell>{getStatusBadge(decl.status)}</TableCell>
                        <TableCell>
                          {decl.result_type ? (
                            <span className={decl.result_type === 'restituir' ? 'text-green-600' : 'text-red-600'}>
                              {decl.result_type === 'restituir' ? '+' : '-'}
                              {formatCurrency(Math.abs(decl.result_amount || 0))}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {irpfDeclarations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhuma declaração cadastrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Novo Honorário Variável */}
      <Dialog open={showVariableFeeDialog} onOpenChange={setShowVariableFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Honorário Variável</DialogTitle>
            <DialogDescription>
              Configure um honorário baseado em % do faturamento do cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select
                value={variableFeeForm.client_id}
                onValueChange={v => setVariableFeeForm({...variableFeeForm, client_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do Honorário</Label>
              <Input
                value={variableFeeForm.fee_name}
                onChange={e => setVariableFeeForm({...variableFeeForm, fee_name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Taxa (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={variableFeeForm.percentage_rate}
                  onChange={e => setVariableFeeForm({...variableFeeForm, percentage_rate: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Dia Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={variableFeeForm.due_day}
                  onChange={e => setVariableFeeForm({...variableFeeForm, due_day: parseInt(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <Label>Base de Cálculo</Label>
              <Select
                value={variableFeeForm.calculation_base}
                onValueChange={v => setVariableFeeForm({...variableFeeForm, calculation_base: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="faturamento">Faturamento Bruto</SelectItem>
                  <SelectItem value="receita_bruta">Receita Líquida</SelectItem>
                  <SelectItem value="folha_pagamento">Folha de Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVariableFeeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveVariableFee}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo Serviço de Abertura */}
      <Dialog open={showCompanyServiceDialog} onOpenChange={setShowCompanyServiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Serviço de Abertura/Alteração</DialogTitle>
            <DialogDescription>
              Cadastre um serviço de abertura, alteração ou baixa de empresa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Serviço</Label>
              <Select
                value={companyServiceForm.service_type}
                onValueChange={v => setCompanyServiceForm({...companyServiceForm, service_type: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertura">Abertura de Empresa</SelectItem>
                  <SelectItem value="alteracao">Alteração Contratual</SelectItem>
                  <SelectItem value="transformacao">Transformação</SelectItem>
                  <SelectItem value="baixa">Baixa/Encerramento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome da Empresa</Label>
              <Input
                value={companyServiceForm.company_name}
                onChange={e => setCompanyServiceForm({...companyServiceForm, company_name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo Societário</Label>
                <Select
                  value={companyServiceForm.company_type}
                  onValueChange={v => setCompanyServiceForm({...companyServiceForm, company_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEI">MEI</SelectItem>
                    <SelectItem value="ME">ME</SelectItem>
                    <SelectItem value="EPP">EPP</SelectItem>
                    <SelectItem value="LTDA">LTDA</SelectItem>
                    <SelectItem value="EIRELI">EIRELI</SelectItem>
                    <SelectItem value="SA">S/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Cobrado</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={companyServiceForm.total_charged}
                  onChange={e => setCompanyServiceForm({...companyServiceForm, total_charged: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompanyServiceDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCompanyService}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo Parceiro */}
      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Parceiro/Corretor</DialogTitle>
            <DialogDescription>
              Cadastre uma pessoa que indica clientes para a Ampla
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Completo</Label>
              <Input
                value={partnerForm.name}
                onChange={e => setPartnerForm({...partnerForm, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CPF</Label>
                <Input
                  value={partnerForm.cpf}
                  onChange={e => setPartnerForm({...partnerForm, cpf: e.target.value})}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={partnerForm.phone}
                  onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={partnerForm.email}
                onChange={e => setPartnerForm({...partnerForm, email: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Chave PIX</Label>
                <Input
                  value={partnerForm.pix_key}
                  onChange={e => setPartnerForm({...partnerForm, pix_key: e.target.value})}
                  placeholder="Chave para pagamento das comissões"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={partnerForm.pix_key_type}
                  onValueChange={v => setPartnerForm({...partnerForm, pix_key_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartnerDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={savePartner}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Indicação */}
      <Dialog open={showReferralDialog} onOpenChange={setShowReferralDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Indicação</DialogTitle>
            <DialogDescription>
              Vincule um cliente indicado a um parceiro para pagamento de comissões
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente Indicado</Label>
              <Select
                value={referralForm.client_id}
                onValueChange={v => setReferralForm({...referralForm, client_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parceiro que Indicou</Label>
              <Select
                value={referralForm.referral_partner_id}
                onValueChange={v => setReferralForm({...referralForm, referral_partner_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o parceiro" />
                </SelectTrigger>
                <SelectContent>
                  {referralPartners.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={referralForm.commission_percentage}
                  onChange={e => setReferralForm({...referralForm, commission_percentage: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Quantidade de Meses</Label>
                <Input
                  type="number"
                  min="1"
                  value={referralForm.commission_months}
                  onChange={e => setReferralForm({...referralForm, commission_months: parseInt(e.target.value)})}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReferralDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveReferral}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Declaração IRPF */}
      <Dialog open={showIrpfDialog} onOpenChange={setShowIrpfDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Declaração de IRPF</DialogTitle>
            <DialogDescription>
              Cadastre uma declaração de imposto de renda
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ano-Calendário</Label>
                <Input
                  type="number"
                  value={irpfForm.calendar_year}
                  onChange={e => setIrpfForm({...irpfForm, calendar_year: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={irpfForm.taxpayer_type}
                  onValueChange={v => setIrpfForm({...irpfForm, taxpayer_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socio">Sócio de Cliente</SelectItem>
                    <SelectItem value="particular">Particular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome do Contribuinte</Label>
              <Input
                value={irpfForm.taxpayer_name}
                onChange={e => setIrpfForm({...irpfForm, taxpayer_name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CPF</Label>
                <Input
                  value={irpfForm.taxpayer_cpf}
                  onChange={e => setIrpfForm({...irpfForm, taxpayer_cpf: e.target.value})}
                />
              </div>
              <div>
                <Label>Honorário</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={irpfForm.fee_amount}
                  onChange={e => setIrpfForm({...irpfForm, fee_amount: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            {irpfForm.taxpayer_type === 'socio' && (
              <div>
                <Label>Empresa (onde é sócio)</Label>
                <Select
                  value={irpfForm.client_id}
                  onValueChange={v => setIrpfForm({...irpfForm, client_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIrpfDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveIrpf}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
