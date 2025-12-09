import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  Handshake,
  Loader2,
  Phone,
  MessageCircle,
  Mail,
  User,
  Building,
  MapPin,
  DollarSign,
  Calendar,
  Plus,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  PhoneCall,
  MessageSquare,
  Copy,
  ExternalLink,
  Percent,
  CreditCard,
  FileSignature,
  History
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientForNegotiation {
  client_id: string;
  client_name: string;
  cnpj: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  uf: string | null;
  municipio: string | null;
  total_debt: number;
  overdue_amount: number;
  overdue_days: number;
  oldest_due_date: string | null;
  pending_invoices: number;
  pending_opening_balance: number;
  contact_count: number;
  contacts: any[] | null;
  last_contact_at: string | null;
  active_negotiations: number;
}

interface Contact {
  id: string;
  contact_type: string;
  contact_value: string;
  contact_name: string | null;
  is_primary: boolean;
  is_whatsapp: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  due_date: string;
  competence: string;
  status: string;
}

interface OpeningBalance {
  id: string;
  amount: number;
  paid_amount: number | null;
  competence: string;
  status: string;
}

interface Negotiation {
  id: string;
  negotiation_number: string;
  client_id: string;
  original_debt: number;
  discount_amount: number;
  discount_percentage: number;
  final_amount: number;
  installments_count: number;
  first_due_date: string;
  status: string;
  requires_approval: boolean;
  approval_level: string | null;
  created_at: string;
  clients?: { name: string };
}

interface ContactHistory {
  id: string;
  contact_type: string;
  contact_result: string;
  summary: string;
  created_at: string;
  next_contact_date: string | null;
}

const DebtNegotiation = () => {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientForNegotiation[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientForNegotiation | null>(null);
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);
  const [clientOpeningBalances, setClientOpeningBalances] = useState<OpeningBalance[]>([]);
  const [contactHistory, setContactHistory] = useState<ContactHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [negotiationDialogOpen, setNegotiationDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);

  // Form states
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectedBalances, setSelectedBalances] = useState<string[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState("0");
  const [installmentsCount, setInstallmentsCount] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [negotiationNotes, setNegotiationNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Contact form
  const [contactForm, setContactForm] = useState({
    contact_type: "phone_call",
    contact_result: "answered",
    summary: "",
    next_contact_date: "",
    promise_date: "",
    promise_amount: ""
  });

  // New contact form
  const [newContactForm, setNewContactForm] = useState({
    contact_type: "mobile",
    contact_value: "",
    contact_name: "",
    is_whatsapp: false
  });

  const [stats, setStats] = useState({
    totalClients: 0,
    totalDebt: 0,
    overdueDebt: 0,
    activeNegotiations: 0,
    pendingApproval: 0
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadClientsForNegotiation(),
        loadNegotiations()
      ]);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadClientsForNegotiation = async () => {
    try {
      // Como a view pode não existir ainda, fazer a query manualmente
      const { data: clientsData, error } = await supabase
        .from("clients")
        .select(`
          id,
          name,
          cnpj,
          cpf,
          email,
          phone,
          uf,
          municipio
        `)
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Erro ao carregar clientes:", error);
        return;
      }

      // Para cada cliente, calcular a dívida
      const clientsWithDebt: ClientForNegotiation[] = [];

      for (const client of clientsData || []) {
        // Buscar faturas pendentes
        const { data: invoices } = await supabase
          .from("invoices")
          .select("amount, due_date")
          .eq("client_id", client.id)
          .in("status", ["pending", "overdue"]);

        // Buscar saldos de abertura pendentes
        const { data: openingBalances } = await supabase
          .from("client_opening_balance")
          .select("amount, paid_amount")
          .eq("client_id", client.id)
          .in("status", ["pending", "partial"]);

        // Buscar contatos - pode não existir, então ignora erros
        let contacts: any[] = [];
        try {
          const { data: contactsData } = await supabase
            .from("client_contacts")
            .select("id, contact_type, contact_value, contact_name, is_primary, is_whatsapp")
            .eq("client_id", client.id)
            .eq("is_valid", true);
          contacts = contactsData || [];
        } catch {
          // Tabela pode não existir
        }

        const invoiceTotal = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
        const openingTotal = openingBalances?.reduce((sum, ob) => sum + ((ob.amount || 0) - (ob.paid_amount || 0)), 0) || 0;
        const totalDebt = invoiceTotal + openingTotal;

        if (totalDebt > 0) {
          const overdueInvoices = invoices?.filter(inv => new Date(inv.due_date) < new Date()) || [];
          const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
          const oldestDue = overdueInvoices.length > 0
            ? overdueInvoices.reduce((oldest, inv) => inv.due_date < oldest ? inv.due_date : oldest, overdueInvoices[0].due_date)
            : null;
          const overdueDays = oldestDue ? Math.floor((new Date().getTime() - new Date(oldestDue).getTime()) / (1000 * 60 * 60 * 24)) : 0;

          clientsWithDebt.push({
            client_id: client.id,
            client_name: client.name,
            cnpj: client.cnpj,
            cpf: client.cpf,
            email: client.email,
            phone: client.phone,
            uf: client.uf,
            municipio: client.municipio,
            total_debt: totalDebt,
            overdue_amount: overdueAmount,
            overdue_days: overdueDays,
            oldest_due_date: oldestDue,
            pending_invoices: invoices?.length || 0,
            pending_opening_balance: openingBalances?.length || 0,
            contact_count: contacts.length,
            contacts: contacts,
            last_contact_at: null,
            active_negotiations: 0
          });
        }
      }

      // Ordenar por dias em atraso
      clientsWithDebt.sort((a, b) => b.overdue_days - a.overdue_days);

      setClients(clientsWithDebt);

      // Calcular estatísticas
      setStats({
        totalClients: clientsWithDebt.length,
        totalDebt: clientsWithDebt.reduce((sum, c) => sum + c.total_debt, 0),
        overdueDebt: clientsWithDebt.reduce((sum, c) => sum + c.overdue_amount, 0),
        activeNegotiations: 0,
        pendingApproval: 0
      });
    } catch (err) {
      console.error("Erro inesperado ao carregar clientes:", err);
    }
  };

  const loadNegotiations = async () => {
    try {
      const { data, error } = await supabase
        .from("debt_negotiations")
        .select(`
          *,
          clients:client_id (name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        // Se a tabela não existe, apenas log e continue
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn("Tabela debt_negotiations não existe ainda:", error);
        } else {
          console.error("Erro ao carregar negociações:", error);
        }
        return;
      }

      setNegotiations(data || []);

      // Atualizar estatísticas
      const active = data?.filter(n => n.status === 'active').length || 0;
      const pending = data?.filter(n => n.status === 'pending_approval').length || 0;

      setStats(prev => ({
        ...prev,
        activeNegotiations: active,
        pendingApproval: pending
      }));
    } catch (err) {
      console.error("Erro inesperado ao carregar negociações:", err);
    }
  };

  const loadClientDetails = async (client: ClientForNegotiation) => {
    setSelectedClient(client);

    // Carregar faturas pendentes
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, amount, due_date, competence, status")
      .eq("client_id", client.client_id)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true });

    setClientInvoices(invoices || []);

    // Carregar saldos de abertura pendentes
    const { data: balances } = await supabase
      .from("client_opening_balance")
      .select("id, amount, paid_amount, competence, status")
      .eq("client_id", client.client_id)
      .in("status", ["pending", "partial"])
      .order("competence", { ascending: true });

    setClientOpeningBalances(balances || []);

    // Carregar histórico de contatos
    const { data: history } = await supabase
      .from("negotiation_contact_history")
      .select("id, contact_type, contact_result, summary, created_at, next_contact_date")
      .eq("client_id", client.client_id)
      .order("created_at", { ascending: false })
      .limit(20);

    setContactHistory(history || []);

    // Resetar seleções
    setSelectedInvoices([]);
    setSelectedBalances([]);
    setDiscountPercentage("0");
    setInstallmentsCount("1");
    setFirstDueDate(format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
    setNegotiationNotes("");
  };

  const handleCreateNegotiation = async () => {
    if (!selectedClient) return;

    if (selectedInvoices.length === 0 && selectedBalances.length === 0) {
      toast.error("Selecione pelo menos uma fatura ou saldo de abertura");
      return;
    }

    try {
      setCreating(true);

      const { data, error } = await supabase.rpc("create_debt_negotiation", {
        p_client_id: selectedClient.client_id,
        p_invoice_ids: selectedInvoices.length > 0 ? selectedInvoices : null,
        p_opening_balance_ids: selectedBalances.length > 0 ? selectedBalances : null,
        p_discount_percentage: parseFloat(discountPercentage),
        p_installments_count: parseInt(installmentsCount),
        p_first_due_date: firstDueDate,
        p_notes: negotiationNotes || null
      });

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success(result.message);
        setNegotiationDialogOpen(false);
        loadData();
        loadClientDetails(selectedClient);
      } else {
        toast.error(result?.message || "Erro ao criar negociação");
      }
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao criar negociação");
    } finally {
      setCreating(false);
    }
  };

  const handleRegisterContact = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from("negotiation_contact_history")
        .insert({
          client_id: selectedClient.client_id,
          contact_type: contactForm.contact_type,
          contact_result: contactForm.contact_result,
          summary: contactForm.summary,
          next_contact_date: contactForm.next_contact_date || null,
          promise_date: contactForm.promise_date || null,
          promise_amount: contactForm.promise_amount ? parseFloat(contactForm.promise_amount) : null,
          contacted_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast.success("Contato registrado com sucesso!");
      setContactDialogOpen(false);
      setContactForm({
        contact_type: "phone_call",
        contact_result: "answered",
        summary: "",
        next_contact_date: "",
        promise_date: "",
        promise_amount: ""
      });
      loadClientDetails(selectedClient);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao registrar contato");
    }
  };

  const handleAddContact = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from("client_contacts")
        .insert({
          client_id: selectedClient.client_id,
          contact_type: newContactForm.contact_type,
          contact_value: newContactForm.contact_value,
          contact_name: newContactForm.contact_name || null,
          is_whatsapp: newContactForm.is_whatsapp,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast.success("Contato adicionado com sucesso!");
      setAddContactDialogOpen(false);
      setNewContactForm({
        contact_type: "mobile",
        contact_value: "",
        contact_name: "",
        is_whatsapp: false
      });

      // Recarregar contatos
      const { data: contacts } = await supabase
        .from("client_contacts")
        .select("id, contact_type, contact_value, contact_name, is_primary, is_whatsapp")
        .eq("client_id", selectedClient.client_id)
        .eq("is_valid", true);

      setSelectedClient({
        ...selectedClient,
        contacts: contacts || [],
        contact_count: contacts?.length || 0
      });
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao adicionar contato");
    }
  };

  const calculateNegotiationPreview = () => {
    const invoiceTotal = clientInvoices
      .filter(inv => selectedInvoices.includes(inv.id))
      .reduce((sum, inv) => sum + inv.amount, 0);

    const balanceTotal = clientOpeningBalances
      .filter(ob => selectedBalances.includes(ob.id))
      .reduce((sum, ob) => sum + (ob.amount - (ob.paid_amount || 0)), 0);

    const originalDebt = invoiceTotal + balanceTotal;
    const discount = originalDebt * (parseFloat(discountPercentage) || 0) / 100;
    const finalAmount = originalDebt - discount;
    const installmentAmount = finalAmount / (parseInt(installmentsCount) || 1);

    return { originalDebt, discount, finalAmount, installmentAmount };
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatPhone = (phone: string) => {
    // Formatar telefone para exibição
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getWhatsAppLink = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    return `https://wa.me/55${cleaned}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Rascunho", variant: "outline" },
      pending_approval: { label: "Aguardando Aprovação", variant: "secondary" },
      approved: { label: "Aprovada", variant: "default" },
      rejected: { label: "Rejeitada", variant: "destructive" },
      active: { label: "Ativa", variant: "default" },
      completed: { label: "Quitada", variant: "default" },
      defaulted: { label: "Inadimplente", variant: "destructive" },
      cancelled: { label: "Cancelada", variant: "outline" }
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case "phone":
      case "mobile":
        return <Phone className="h-4 w-4" />;
      case "whatsapp":
        return <MessageCircle className="h-4 w-4 text-green-500" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cnpj?.includes(searchTerm) ||
    client.cpf?.includes(searchTerm)
  );

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Handshake className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Negociação de Dívidas</h1>
              <p className="text-muted-foreground">
                Negocie dívidas, registre contatos e gere contratos
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clientes em Débito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
            </CardContent>
          </Card>

          <Card className="border-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">
                Dívida Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalDebt)}</div>
            </CardContent>
          </Card>

          <Card className="border-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600">
                Valor Vencido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.overdueDebt)}</div>
            </CardContent>
          </Card>

          <Card className="border-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">
                Negociações Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.activeNegotiations}</div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">
                Aguardando Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lista de Clientes */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Clientes com Dívidas
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <div
                      key={client.client_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedClient?.client_id === client.client_id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => loadClientDetails(client)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{client.client_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.cnpj || client.cpf || "Sem documento"}
                          </p>
                        </div>
                        {client.overdue_days > 0 && (
                          <Badge variant="destructive" className="ml-2 shrink-0">
                            {client.overdue_days}d
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-red-600 font-semibold">
                          {formatCurrency(client.total_debt)}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{client.contact_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredClients.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Detalhes do Cliente */}
          <Card className="lg:col-span-2">
            {selectedClient ? (
              <>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedClient.client_name}</CardTitle>
                      <CardDescription>
                        {selectedClient.cnpj && `CNPJ: ${selectedClient.cnpj}`}
                        {selectedClient.cpf && `CPF: ${selectedClient.cpf}`}
                        {selectedClient.municipio && ` • ${selectedClient.municipio}`}
                        {selectedClient.uf && `/${selectedClient.uf}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setContactDialogOpen(true)}
                      >
                        <PhoneCall className="h-4 w-4 mr-2" />
                        Registrar Contato
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setNegotiationDialogOpen(true)}
                      >
                        <Handshake className="h-4 w-4 mr-2" />
                        Nova Negociação
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="contacts" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="contacts">
                        <Phone className="h-4 w-4 mr-2" />
                        Contatos
                      </TabsTrigger>
                      <TabsTrigger value="debts">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Dívidas
                      </TabsTrigger>
                      <TabsTrigger value="history">
                        <History className="h-4 w-4 mr-2" />
                        Histórico
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab: Contatos */}
                    <TabsContent value="contacts" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Contatos do Cliente</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAddContactDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>

                      {/* Contato principal do cliente */}
                      {(selectedClient.phone || selectedClient.email) && (
                        <div className="p-4 border rounded-lg bg-muted/30">
                          <p className="text-sm font-medium mb-2 text-muted-foreground">Cadastro Principal</p>
                          <div className="space-y-2">
                            {selectedClient.phone && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  <span>{formatPhone(selectedClient.phone)}</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => window.open(`tel:${selectedClient.phone}`, "_blank")}
                                  >
                                    <PhoneCall className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-500"
                                    onClick={() => window.open(getWhatsAppLink(selectedClient.phone!), "_blank")}
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedClient.phone!);
                                      toast.success("Copiado!");
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {selectedClient.email && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  <span>{selectedClient.email}</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => window.open(`mailto:${selectedClient.email}`, "_blank")}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedClient.email!);
                                      toast.success("Copiado!");
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Contatos adicionais */}
                      {selectedClient.contacts && selectedClient.contacts.length > 0 ? (
                        <div className="space-y-2">
                          {selectedClient.contacts.map((contact: Contact) => (
                            <div
                              key={contact.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                {getContactIcon(contact.contact_type)}
                                <div>
                                  <p className="font-medium">{contact.contact_value}</p>
                                  {contact.contact_name && (
                                    <p className="text-sm text-muted-foreground">{contact.contact_name}</p>
                                  )}
                                </div>
                                {contact.is_whatsapp && (
                                  <Badge variant="outline" className="text-green-500 border-green-500">
                                    WhatsApp
                                  </Badge>
                                )}
                                {contact.is_primary && (
                                  <Badge>Principal</Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {contact.contact_type !== "email" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => window.open(`tel:${contact.contact_value}`, "_blank")}
                                    >
                                      <PhoneCall className="h-4 w-4" />
                                    </Button>
                                    {contact.is_whatsapp && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-green-500"
                                        onClick={() => window.open(getWhatsAppLink(contact.contact_value), "_blank")}
                                      >
                                        <MessageCircle className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                {contact.contact_type === "email" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => window.open(`mailto:${contact.contact_value}`, "_blank")}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    navigator.clipboard.writeText(contact.contact_value);
                                    toast.success("Copiado!");
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhum contato adicional cadastrado</p>
                          <Button
                            variant="link"
                            className="mt-2"
                            onClick={() => setAddContactDialogOpen(true)}
                          >
                            Adicionar contato
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    {/* Tab: Dívidas */}
                    <TabsContent value="debts" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-red-200 bg-red-50">
                          <CardContent className="pt-4">
                            <p className="text-sm text-red-600">Dívida Total</p>
                            <p className="text-2xl font-bold text-red-600">
                              {formatCurrency(selectedClient.total_debt)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-orange-200 bg-orange-50">
                          <CardContent className="pt-4">
                            <p className="text-sm text-orange-600">Valor Vencido</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {formatCurrency(selectedClient.overdue_amount)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-blue-200 bg-blue-50">
                          <CardContent className="pt-4">
                            <p className="text-sm text-blue-600">Dias em Atraso</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {selectedClient.overdue_days} dias
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Faturas */}
                      {clientInvoices.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Faturas Pendentes ({clientInvoices.length})</h4>
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Competência</TableHead>
                                  <TableHead>Vencimento</TableHead>
                                  <TableHead className="text-right">Valor</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {clientInvoices.map((invoice) => (
                                  <TableRow key={invoice.id}>
                                    <TableCell>{invoice.competence}</TableCell>
                                    <TableCell>{formatDate(invoice.due_date)}</TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrency(invoice.amount)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={invoice.status === "overdue" ? "destructive" : "secondary"}>
                                        {invoice.status === "overdue" ? "Vencida" : "Pendente"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Saldos de Abertura */}
                      {clientOpeningBalances.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Saldos de Abertura ({clientOpeningBalances.length})</h4>
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Competência</TableHead>
                                  <TableHead className="text-right">Valor Original</TableHead>
                                  <TableHead className="text-right">Pago</TableHead>
                                  <TableHead className="text-right">Saldo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {clientOpeningBalances.map((balance) => (
                                  <TableRow key={balance.id}>
                                    <TableCell>{balance.competence}</TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(balance.amount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(balance.paid_amount || 0)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-red-600">
                                      {formatCurrency(balance.amount - (balance.paid_amount || 0))}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* Tab: Histórico */}
                    <TabsContent value="history" className="space-y-4">
                      {contactHistory.length > 0 ? (
                        <div className="space-y-3">
                          {contactHistory.map((entry) => (
                            <div key={entry.id} className="p-4 border rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{entry.contact_type}</Badge>
                                  <Badge variant={
                                    entry.contact_result === "promise_to_pay" ? "default" :
                                    entry.contact_result === "not_answered" ? "secondary" :
                                    entry.contact_result === "refused" ? "destructive" :
                                    "outline"
                                  }>
                                    {entry.contact_result}
                                  </Badge>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm">{entry.summary}</p>
                              {entry.next_contact_date && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  <Calendar className="h-3 w-3 inline mr-1" />
                                  Próximo contato: {formatDate(entry.next_contact_date)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhum histórico de contato</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center min-h-[400px]">
                <div className="text-center text-muted-foreground">
                  <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Selecione um cliente para ver os detalhes</p>
                  <p className="text-sm">Clique em um cliente na lista ao lado</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Lista de Negociações */}
        <Card>
          <CardHeader>
            <CardTitle>Negociações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {negotiations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Dívida Original</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Valor Final</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negotiations.map((neg) => (
                    <TableRow key={neg.id}>
                      <TableCell className="font-mono">{neg.negotiation_number}</TableCell>
                      <TableCell>{neg.clients?.name || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(neg.original_debt)}</TableCell>
                      <TableCell className="text-right text-green-600">
                        -{formatCurrency(neg.discount_amount)} ({neg.discount_percentage}%)
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(neg.final_amount)}
                      </TableCell>
                      <TableCell>{neg.installments_count}x</TableCell>
                      <TableCell>{getStatusBadge(neg.status)}</TableCell>
                      <TableCell>{formatDate(neg.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma negociação registrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog: Nova Negociação */}
        <Dialog open={negotiationDialogOpen} onOpenChange={setNegotiationDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova Negociação de Dívida</DialogTitle>
              <DialogDescription>
                Cliente: {selectedClient?.client_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Seleção de Faturas */}
              {clientInvoices.length > 0 && (
                <div>
                  <Label className="font-semibold">Faturas a Incluir</Label>
                  <div className="mt-2 border rounded-lg max-h-[150px] overflow-y-auto">
                    {clientInvoices.map((inv) => (
                      <label
                        key={inv.id}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(inv.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvoices([...selectedInvoices, inv.id]);
                              } else {
                                setSelectedInvoices(selectedInvoices.filter(id => id !== inv.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span>{inv.competence}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(inv.amount)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Seleção de Saldos de Abertura */}
              {clientOpeningBalances.length > 0 && (
                <div>
                  <Label className="font-semibold">Saldos de Abertura a Incluir</Label>
                  <div className="mt-2 border rounded-lg max-h-[150px] overflow-y-auto">
                    {clientOpeningBalances.map((ob) => (
                      <label
                        key={ob.id}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedBalances.includes(ob.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBalances([...selectedBalances, ob.id]);
                              } else {
                                setSelectedBalances(selectedBalances.filter(id => id !== ob.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span>{ob.competence}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(ob.amount - (ob.paid_amount || 0))}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Condições da Negociação */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="discount">Desconto (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments">Parcelas</Label>
                  <Select value={installmentsCount} onValueChange={setInstallmentsCount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n === 1 ? "À Vista" : `${n}x`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_due">1º Vencimento</Label>
                  <Input
                    id="first_due"
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview da Negociação */}
              {(selectedInvoices.length > 0 || selectedBalances.length > 0) && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-semibold">Resumo da Negociação</h4>
                  {(() => {
                    const preview = calculateNegotiationPreview();
                    return (
                      <div className="grid gap-2 md:grid-cols-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Dívida Original</p>
                          <p className="font-semibold">{formatCurrency(preview.originalDebt)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Desconto</p>
                          <p className="font-semibold text-green-600">-{formatCurrency(preview.discount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor Final</p>
                          <p className="font-semibold text-primary">{formatCurrency(preview.finalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor da Parcela</p>
                          <p className="font-semibold">{formatCurrency(preview.installmentAmount)}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Condições especiais, acordos, etc..."
                  value={negotiationNotes}
                  onChange={(e) => setNegotiationNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNegotiationDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateNegotiation} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Negociação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Registrar Contato */}
        <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Contato</DialogTitle>
              <DialogDescription>
                Registre o resultado do contato com {selectedClient?.client_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Contato</Label>
                  <Select
                    value={contactForm.contact_type}
                    onValueChange={(v) => setContactForm({ ...contactForm, contact_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone_call">Ligação</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="visit">Visita</SelectItem>
                      <SelectItem value="meeting">Reunião</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <Select
                    value={contactForm.contact_result}
                    onValueChange={(v) => setContactForm({ ...contactForm, contact_result: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="answered">Atendeu</SelectItem>
                      <SelectItem value="not_answered">Não Atendeu</SelectItem>
                      <SelectItem value="busy">Ocupado</SelectItem>
                      <SelectItem value="voicemail">Caixa Postal</SelectItem>
                      <SelectItem value="wrong_number">Número Errado</SelectItem>
                      <SelectItem value="callback_scheduled">Agendou Retorno</SelectItem>
                      <SelectItem value="promise_to_pay">Prometeu Pagar</SelectItem>
                      <SelectItem value="negotiation_started">Iniciou Negociação</SelectItem>
                      <SelectItem value="refused">Recusou</SelectItem>
                      <SelectItem value="sent">Enviado</SelectItem>
                      <SelectItem value="delivered">Entregue</SelectItem>
                      <SelectItem value="read">Lido</SelectItem>
                      <SelectItem value="replied">Respondeu</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Resumo do Contato</Label>
                <Textarea
                  id="summary"
                  placeholder="Descreva o que foi conversado..."
                  value={contactForm.summary}
                  onChange={(e) => setContactForm({ ...contactForm, summary: e.target.value })}
                  required
                />
              </div>

              {contactForm.contact_result === "promise_to_pay" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="promise_date">Data Prometida</Label>
                    <Input
                      id="promise_date"
                      type="date"
                      value={contactForm.promise_date}
                      onChange={(e) => setContactForm({ ...contactForm, promise_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promise_amount">Valor Prometido</Label>
                    <Input
                      id="promise_amount"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={contactForm.promise_amount}
                      onChange={(e) => setContactForm({ ...contactForm, promise_amount: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="next_contact">Próximo Contato</Label>
                <Input
                  id="next_contact"
                  type="datetime-local"
                  value={contactForm.next_contact_date}
                  onChange={(e) => setContactForm({ ...contactForm, next_contact_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRegisterContact} disabled={!contactForm.summary}>
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Adicionar Contato */}
        <Dialog open={addContactDialogOpen} onOpenChange={setAddContactDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Contato</DialogTitle>
              <DialogDescription>
                Adicione um novo contato para {selectedClient?.client_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={newContactForm.contact_type}
                  onValueChange={(v) => setNewContactForm({ ...newContactForm, contact_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Telefone Fixo</SelectItem>
                    <SelectItem value="mobile">Celular</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_value">Número/E-mail</Label>
                <Input
                  id="contact_value"
                  placeholder={newContactForm.contact_type === "email" ? "email@exemplo.com" : "(00) 00000-0000"}
                  value={newContactForm.contact_value}
                  onChange={(e) => setNewContactForm({ ...newContactForm, contact_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Nome do Contato (opcional)</Label>
                <Input
                  id="contact_name"
                  placeholder="Ex: Financeiro, Sócio João"
                  value={newContactForm.contact_name}
                  onChange={(e) => setNewContactForm({ ...newContactForm, contact_name: e.target.value })}
                />
              </div>
              {newContactForm.contact_type !== "email" && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_whatsapp"
                    checked={newContactForm.is_whatsapp}
                    onChange={(e) => setNewContactForm({ ...newContactForm, is_whatsapp: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="is_whatsapp">Este número tem WhatsApp</Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddContactDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddContact} disabled={!newContactForm.contact_value}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default DebtNegotiation;
