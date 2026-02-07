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

interface MonthlyRevenue {
  id: string;
  client_id: string;
  client_name?: string;
  reference_month: number;
  gross_revenue: number;
  calculated_fee?: number;
  percentage_rate?: number;
  employee_commission_rate?: number;
  employee_name?: string;
}

export default function SpecialFees() {
  // Estados de carregamento
  const [loading, setLoading] = useState(true);

  // Estados de dados principais
  const [activeTab, setActiveTab] = useState("variable");
  const [variableFees, setVariableFees] = useState<VariableFee[]>([]);
  const [companyServices, setCompanyServices] = useState<CompanyService[]>([]);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>([]);
  const [clientReferrals, setClientReferrals] = useState<ClientReferral[]>([]);
  const [irpfDeclarations, setIrpfDeclarations] = useState<IrpfDeclaration[]>([]);
  const [monthlyRevenues, setMonthlyRevenues] = useState<MonthlyRevenue[]>([]);
  const [clients, setClients] = useState<{id: string, name: string, cnpj?: string}[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Estados de diálogos
  const [showVariableFeeDialog, setShowVariableFeeDialog] = useState(false);
  const [showCompanyServiceDialog, setShowCompanyServiceDialog] = useState(false);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showIrpfDialog, setShowIrpfDialog] = useState(false);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [editingVariableFee, setEditingVariableFee] = useState<VariableFee | null>(null);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

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
    const { data: partners } = await supabase
      .from('referral_partners')
      .select('*')
      .order('name');

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

  const [variableFeeForm, setVariableFeeForm] = useState({
    client_id: '',
    fee_name: 'Honorário Variável',
    fee_type: 'percentage',
    percentage_rate: 2.87,
    due_day: 20,
    calculation_base: 'faturamento',
    employee_commission_rate: 1.25,
    employee_name: '',
    employee_pix_key: '',
    employee_pix_type: 'cpf'
  });

  const [revenueForm, setRevenueForm] = useState({
    client_id: '',
    reference_month: selectedMonth,
    gross_revenue: 0
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

  const loadMonthlyRevenues = async () => {
    const [year, month] = selectedMonth.split('-');
    const referenceYear = parseInt(year);
    const referenceMonth = parseInt(month);

    const { data: fees } = await supabase
      .from('client_variable_fees')
      .select(`
        id,
        client_id,
        percentage_rate,
        employee_commission_rate,
        employee_name,
        clients(name)
      `)
      .eq('is_active', true);

    const { data: revenues } = await supabase
      .from('client_monthly_revenue')
      .select('*')
      .eq('reference_year', referenceYear)
      .eq('reference_month', referenceMonth);

    const combined = (fees || []).map((fee: any) => {
      const revenue = revenues?.find(r => r.client_id === fee.client_id);
      const grossRevenue = revenue?.gross_revenue || 0;
      const calculatedFee = grossRevenue * (fee.percentage_rate / 100);

      return {
        id: revenue?.id || '',
        client_id: fee.client_id,
        client_name: fee.clients?.name || '',
        reference_month: referenceMonth,
        gross_revenue: grossRevenue,
        calculated_fee: calculatedFee,
        percentage_rate: fee.percentage_rate,
        employee_commission_rate: fee.employee_commission_rate,
        employee_name: fee.employee_name
      };
    });

    setMonthlyRevenues(combined);
  };

  const saveMonthlyRevenue = async () => {
    try {
      const [year, month] = revenueForm.reference_month.split('-');
      const referenceYear = parseInt(year);
      const referenceMonth = parseInt(month);

      const { error } = await supabase
        .from('client_monthly_revenue')
        .upsert({
          client_id: revenueForm.client_id,
          reference_year: referenceYear,
          reference_month: referenceMonth,
          gross_revenue: revenueForm.gross_revenue
        }, {
          onConflict: 'client_id,reference_year,reference_month'
        });

      if (error) throw error;

      toast.success('Faturamento salvo!');
      setShowRevenueDialog(false);
      loadMonthlyRevenues();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const generateInvoice = async (clientId: string, amount: number, clientName: string) => {
    try {
      const referenceMonth = selectedMonth;
      const [year, month] = referenceMonth.split('-');
      const dueDate = new Date(parseInt(year), parseInt(month), 20);
      const competenceDate = `${year}-${month}-01`;

      const feeData = monthlyRevenues.find(r => r.client_id === clientId);
      const employeeCommissionRate = (feeData as any)?.employee_commission_rate || 0;
      const employeeName = (feeData as any)?.employee_name || '';
      const commissionAmount = amount * (employeeCommissionRate / 100);

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          client_id: clientId,
          competence: `${month}/${year}`,
          amount: amount,
          description: `Honorário Variável - ${month}/${year}`,
          due_date: dueDate.toISOString(),
          status: 'pending',
          invoice_type: 'variable_fee'
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const { data: revenueAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '3.1.1.01')
        .eq('is_active', true)
        .single();

      let commissionCostAccount = null;
      const { data: existingCostAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '4.5.1.01')
        .eq('is_active', true)
        .single();

      if (existingCostAccount) {
        commissionCostAccount = existingCostAccount;
      } else {
        const { data: fallbackAccount } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .or('code.eq.4.1.1.06,code.eq.4.1.1.99')
          .eq('is_active', true)
          .limit(1)
          .single();
        commissionCostAccount = fallbackAccount;
      }

      let commissionPayableAccount = null;
      const { data: existingPayableAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '2.1.3.03')
        .eq('is_active', true)
        .single();

      if (existingPayableAccount) {
        commissionPayableAccount = existingPayableAccount;
      } else {
        const { data: fallbackPayable } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '2.1.1.06')
          .eq('is_active', true)
          .single();
        commissionPayableAccount = fallbackPayable;
      }

      let clientAccountId: string | null = null;
      const { data: existingClientAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', `1.1.2.01.${clientId.substring(0, 8)}`)
        .single();

      if (existingClientAccount) {
        clientAccountId = existingClientAccount.id;
      } else {
        const { data: newAccount } = await supabase
          .from('chart_of_accounts')
          .insert({
            code: `1.1.2.01.${clientId.substring(0, 8)}`,
            name: `Clientes a Receber - ${clientName}`,
            type: 'asset',
            parent_code: '1.1.2.01',
            is_analytical: true,
            is_active: true
          })
          .select()
          .single();

        if (newAccount) {
          clientAccountId = newAccount.id;
        }
      }

      if (revenueAccount && clientAccountId) {
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert({
            entry_date: new Date().toISOString().split('T')[0],
            competence_date: competenceDate,
            description: `Honorário Variável ${clientName} - ${month}/${year}`,
            entry_type: 'receita_honorarios',
            source_type: 'invoice',
            source_id: invoice.id,
            status: 'posted'
          })
          .select()
          .single();

        if (!entryError && entry) {
          await supabase
            .from('accounting_entry_items')
            .insert([
              {
                entry_id: entry.id,
                account_id: clientAccountId,
                debit: amount,
                credit: 0
              },
              {
                entry_id: entry.id,
                account_id: revenueAccount.id,
                debit: 0,
                credit: amount
              }
            ]);
        }
      }

      if (commissionAmount > 0 && commissionCostAccount && commissionPayableAccount) {
        const { data: commEntry, error: commError } = await supabase
          .from('accounting_entries')
          .insert({
            entry_date: new Date().toISOString().split('T')[0],
            competence_date: competenceDate,
            description: `Custo Comissão ${employeeName} - Hon. Variável ${clientName} - ${month}/${year}`,
            entry_type: 'provisao_custo',
            source_type: 'invoice',
            source_id: invoice.id,
            status: 'posted'
          })
          .select()
          .single();

        if (!commError && commEntry) {
          await supabase
            .from('accounting_entry_items')
            .insert([
              {
                entry_id: commEntry.id,
                account_id: commissionCostAccount.id,
                debit: commissionAmount,
                credit: 0
              },
              {
                entry_id: commEntry.id,
                account_id: commissionPayableAccount.id,
                debit: 0,
                credit: commissionAmount
              }
            ]);
        }

        toast.success(
          `Fatura de ${formatCurrency(amount)} gerada para ${clientName}!\n` +
          `Comissão de ${formatCurrency(commissionAmount)} provisionada para ${employeeName}`
        );
      } else {
        toast.success(`Fatura de ${formatCurrency(amount)} gerada para ${clientName} com lançamento contábil!`);
      }

      loadMonthlyRevenues();
    } catch (error: any) {
      toast.error('Erro ao gerar fatura: ' + error.message);
    }
  };

  const openEditVariableFee = (fee: VariableFee) => {
    setEditingVariableFee(fee);
    setVariableFeeForm({
      client_id: fee.client_id,
      fee_name: fee.fee_name,
      fee_type: fee.fee_type,
      percentage_rate: fee.percentage_rate,
      due_day: fee.due_day,
      calculation_base: fee.calculation_base,
      employee_commission_rate: (fee as any).employee_commission_rate || 0,
      employee_name: (fee as any).employee_name || '',
      employee_pix_key: (fee as any).employee_pix_key || '',
      employee_pix_type: (fee as any).employee_pix_type || 'cpf'
    });
    setShowVariableFeeDialog(true);
  };

  const saveVariableFee = async () => {
    try {
      if (editingVariableFee) {
        const { error } = await supabase
          .from('client_variable_fees')
          .update(variableFeeForm)
          .eq('id', editingVariableFee.id);

        if (error) throw error;
        toast.success('Honorário variável atualizado!');
      } else {
        const { error } = await supabase
          .from('client_variable_fees')
          .insert(variableFeeForm);

        if (error) throw error;
        toast.success('Honorário variável cadastrado!');
      }

      setShowVariableFeeDialog(false);
      setEditingVariableFee(null);
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

  const generateIrpfFromPartners = async () => {
    try {
      setLoading(true);
      const calendarYear = new Date().getFullYear() - 1;

      const { data: clientsWithQsa } = await supabase
        .from('clients')
        .select('id, name, qsa')
        .eq('is_active', true)
        .not('qsa', 'is', null);

      if (!clientsWithQsa) {
        toast.error('Nenhum cliente com sócios encontrado');
        return;
      }

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

      let created = 0;
      for (const [cpf, partner] of partners) {
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

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Honorários Especiais</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Gerencie honorários variáveis, abertura de empresas, comissões e IRPF
            </p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium">Hon. Variáveis</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{variableFees.filter(f => f.is_active).length}</div>
              <p className="text-xs text-muted-foreground">clientes ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium">Aberturas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">
                {companyServices.filter(s => s.service_status === 'em_andamento').length}
              </div>
              <p className="text-xs text-muted-foreground">em andamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium">Comissões</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">
                {clientReferrals.filter(r => r.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">indicações ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium">IRPF {new Date().getFullYear()}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">
                {irpfDeclarations.filter(d => d.calendar_year === new Date().getFullYear() - 1).length}
              </div>
              <p className="text-xs text-muted-foreground">declarações</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
            <TabsTrigger value="variable" className="flex items-center gap-2 py-2">
              <Percent className="h-4 w-4" />
              <span className="hidden sm:inline">Variáveis</span>
              <span className="sm:hidden">Var.</span>
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2 py-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Abertura/Alteração</span>
              <span className="sm:hidden">Abert.</span>
            </TabsTrigger>
            <TabsTrigger value="referral" className="flex items-center gap-2 py-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Indicações</span>
              <span className="sm:hidden">Indic.</span>
            </TabsTrigger>
            <TabsTrigger value="irpf" className="flex items-center gap-2 py-2">
              <FileText className="h-4 w-4" />
              <span>IRPF</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="variable" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Honorários Variáveis</CardTitle>
                  <CardDescription>
                    Clientes com honorário baseado em % do faturamento
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setEditingVariableFee(null);
                  setVariableFeeForm({
                    client_id: '',
                    fee_name: 'Honorário Variável',
                    fee_type: 'percentage',
                    percentage_rate: 2.87,
                    due_day: 20,
                    calculation_base: 'faturamento',
                    employee_commission_rate: 1.25,
                    employee_name: '',
                    employee_pix_key: '',
                    employee_pix_type: 'cpf'
                  });
                  setShowVariableFeeDialog(true);
                }} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Honorário
                </Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 overflow-x-auto">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Comissão Func.</TableHead>
                        <TableHead>Funcionário</TableHead>
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
                          <TableCell>{(fee as any).employee_commission_rate || 0}%</TableCell>
                          <TableCell>{(fee as any).employee_name || '-'}</TableCell>
                          <TableCell>Dia {fee.due_day}</TableCell>
                          <TableCell>
                            <Badge variant={fee.is_active ? "default" : "secondary"}>
                              {fee.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditVariableFee(fee)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {variableFees.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum honorário variável cadastrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Cálculo Mensal de Honorários
                  </CardTitle>
                  <CardDescription>
                    Informe o faturamento do cliente para calcular o honorário
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                    }}
                    className="w-full sm:w-40"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={loadMonthlyRevenues} className="flex-1 sm:flex-none">
                      <Search className="h-4 w-4 mr-2" />
                      Carregar
                    </Button>
                    <Button onClick={() => setShowRevenueDialog(true)} className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Informar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 overflow-x-auto">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="text-right">Honorário</TableHead>
                        <TableHead className="text-right">Comissão Func.</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyRevenues.map((rev: any) => {
                        const employeeCommission = (rev.calculated_fee || 0) * ((rev.employee_commission_rate || 0) / 100);
                        return (
                          <TableRow key={rev.client_id}>
                            <TableCell className="font-medium">{rev.client_name}</TableCell>
                            <TableCell className="text-right">
                              {rev.gross_revenue > 0 ? formatCurrency(rev.gross_revenue) : (
                                <span className="text-muted-foreground">Não informado</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{rev.percentage_rate}%</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              {formatCurrency(rev.calculated_fee || 0)}
                            </TableCell>
                            <TableCell className="text-right text-orange-600">
                              {formatCurrency(employeeCommission)}
                            </TableCell>
                            <TableCell>{rev.employee_name || '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setRevenueForm({
                                      client_id: rev.client_id,
                                      reference_month: selectedMonth,
                                      gross_revenue: rev.gross_revenue || 0
                                    });
                                    setShowRevenueDialog(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {rev.gross_revenue > 0 && rev.calculated_fee > 0 && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => generateInvoice(rev.client_id, rev.calculated_fee, rev.client_name)}
                                  >
                                    <Banknote className="h-4 w-4 mr-1" />
                                    Fatura
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {monthlyRevenues.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Clique em "Carregar" para ver os clientes com honorário variável
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {monthlyRevenues.length > 0 && (
                  <div className="mt-4 p-4 bg-muted rounded-lg mx-4 sm:mx-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Faturamento</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(monthlyRevenues.reduce((sum: number, r: any) => sum + (r.gross_revenue || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Honorários</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(monthlyRevenues.reduce((sum: number, r: any) => sum + (r.calculated_fee || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Comissões</p>
                        <p className="text-xl font-bold text-orange-600">
                          {formatCurrency(monthlyRevenues.reduce((sum: number, r: any) => {
                            const commission = (r.calculated_fee || 0) * ((r.employee_commission_rate || 0) / 100);
                            return sum + commission;
                          }, 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Abertura / Alteração de Empresas</CardTitle>
                  <CardDescription>
                    Controle de serviços de abertura, alteração e baixa de empresas
                  </CardDescription>
                </div>
                <Button onClick={() => setShowCompanyServiceDialog(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Serviço
                </Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 overflow-x-auto">
                <div className="min-w-[800px]">
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referral" className="space-y-4">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>Parceiros/Corretores</CardTitle>
                    <CardDescription>Pessoas que indicam clientes</CardDescription>
                  </div>
                  <Button onClick={() => setShowPartnerDialog(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {referralPartners.map(partner => (
                      <div key={partner.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border-b gap-2 sm:gap-0">
                        <div>
                          <p className="font-medium">{partner.name}</p>
                          <p className="text-sm text-muted-foreground break-all">
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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>Indicações Ativas</CardTitle>
                    <CardDescription>Clientes indicados com comissão</CardDescription>
                  </div>
                  <Button onClick={() => setShowReferralDialog(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {clientReferrals.map(referral => (
                      <div key={referral.id} className="p-3 border-b">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                          <p className="font-medium">{referral.client_name}</p>
                          {getStatusBadge(referral.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Indicado por: {referral.partner_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-sm">
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

          <TabsContent value="irpf" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Declarações de IRPF</CardTitle>
                  <CardDescription>
                    Declarações de imposto de renda dos sócios e particulares
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={generateIrpfFromPartners} className="w-full sm:w-auto">
                    <Users className="h-4 w-4 mr-2" />
                    Gerar dos Sócios
                  </Button>
                  <Button onClick={() => setShowIrpfDialog(true)} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Declaração
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 overflow-x-auto">
                <div className="min-w-[800px]">
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showVariableFeeDialog} onOpenChange={(open) => {
        setShowVariableFeeDialog(open);
        if (!open) setEditingVariableFee(null);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVariableFee ? 'Editar Honorário Variável' : 'Novo Honorário Variável'}</DialogTitle>
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
                <Label>Taxa do Cliente (%)</Label>
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

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-orange-600">Comissão do Funcionário</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Taxa sobre honorário (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variableFeeForm.employee_commission_rate}
                    onChange={e => setVariableFeeForm({...variableFeeForm, employee_commission_rate: parseFloat(e.target.value)})}
                    placeholder="Ex: 1.25"
                  />
                </div>
                <div>
                  <Label>Nome do Funcionário</Label>
                  <Input
                    value={variableFeeForm.employee_name}
                    onChange={e => setVariableFeeForm({...variableFeeForm, employee_name: e.target.value})}
                    placeholder="Quem recebe a comissão"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 sm:mt-2">
                <div className="sm:col-span-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={variableFeeForm.employee_pix_key}
                    onChange={e => setVariableFeeForm({...variableFeeForm, employee_pix_key: e.target.value})}
                    placeholder="PIX para pagamento"
                  />
                </div>
                <div>
                  <Label>Tipo PIX</Label>
                  <Select
                    value={variableFeeForm.employee_pix_type}
                    onValueChange={v => setVariableFeeForm({...variableFeeForm, employee_pix_type: v})}
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
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowVariableFeeDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={saveVariableFee} className="w-full sm:w-auto">
              {editingVariableFee ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevenueDialog} onOpenChange={setShowRevenueDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Informar Faturamento Mensal</DialogTitle>
            <DialogDescription>
              Informe o faturamento do cliente para calcular o honorário variável
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select
                value={revenueForm.client_id}
                onValueChange={v => setRevenueForm({...revenueForm, client_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {variableFees.map(fee => (
                    <SelectItem key={fee.client_id} value={fee.client_id}>
                      {fee.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={revenueForm.reference_month}
                onChange={e => setRevenueForm({...revenueForm, reference_month: e.target.value})}
              />
            </div>
            <div>
              <Label>Faturamento Bruto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={revenueForm.gross_revenue}
                onChange={e => setRevenueForm({...revenueForm, gross_revenue: parseFloat(e.target.value) || 0})}
                placeholder="0,00"
              />
            </div>

            {revenueForm.client_id && revenueForm.gross_revenue > 0 && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Prévia do Cálculo</h4>
                {(() => {
                  const fee = variableFees.find(f => f.client_id === revenueForm.client_id);
                  if (!fee) return null;
                  const honorario = revenueForm.gross_revenue * (fee.percentage_rate / 100);
                  const comissao = honorario * (((fee as any).employee_commission_rate || 0) / 100);
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Faturamento:</span>
                        <span>{formatCurrency(revenueForm.gross_revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxa ({fee.percentage_rate}%):</span>
                        <span className="text-green-600 font-medium">{formatCurrency(honorario)}</span>
                      </div>
                      {(fee as any).employee_commission_rate > 0 && (
                        <div className="flex justify-between">
                          <span>Comissão ({(fee as any).employee_commission_rate}%):</span>
                          <span className="text-orange-600">{formatCurrency(comissao)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowRevenueDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={saveMonthlyRevenue} className="w-full sm:w-auto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompanyServiceDialog} onOpenChange={setShowCompanyServiceDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md w-full">
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
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCompanyServiceDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={saveCompanyService} className="w-full sm:w-auto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md w-full">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
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
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPartnerDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={savePartner} className="w-full sm:w-auto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReferralDialog} onOpenChange={setShowReferralDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md w-full">
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
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowReferralDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={saveReferral} className="w-full sm:w-auto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showIrpfDialog} onOpenChange={setShowIrpfDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md w-full">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowIrpfDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={saveIrpf} className="w-full sm:w-auto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}