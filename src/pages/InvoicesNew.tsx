/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║           HONORÁRIOS — MAESTRO UX 2.0 EDITION                    ║
 * ║                                                                   ║
 * ║  Centro de receita. Entender em 30 segundos.                     ║
 * ║                                                                   ║
 * ║  Princípios:                                                      ║
 * ║  • KPIs executivos no topo (max 6)                               ║
 * ║  • Ações rápidas visíveis                                        ║
 * ║  • Tabela com hover rich e status visual                         ║
 * ║  • Dr. Cícero como consultor contextual                          ║
 * ║  • Zero poluição visual                                          ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
  FileText, Plus, Search, Filter, Zap,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Pencil, Trash2, Bot, Loader2, Radio,
  Calendar, DollarSign, Clock, CalendarClock, Ban
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Layout
import { Layout } from "@/components/Layout";

// Componentes UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";

// Data & Integrations
import { supabase } from "@/integrations/supabase/client";
import { useTableRealtime } from "@/hooks/useRealtimeSubscription";
import { usePeriod } from "@/contexts/PeriodContext";
import { useClient } from "@/contexts/ClientContext";
import { useAccounting } from "@/hooks/useAccounting";
import { formatCurrency } from "@/data/expensesData";
import { getErrorMessage } from "@/lib/utils";

// Componentes específicos
import { AIInvoiceClassifier } from "@/components/ai/AIInvoiceClassifier";
import { AICollectionAgent } from "@/components/ai/AICollectionAgent";
import { PeriodFilter } from "@/components/PeriodFilter";

// ═══════════════════════════════════════════════════════════════
// 📊 KPI CARD COMPONENT
// ═══════════════════════════════════════════════════════════════
interface KPIHonorarioProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  variacao?: number;
  icone: React.ReactNode;
  corIcone?: string;
  onClick?: () => void;
  destaque?: boolean;
}

function KPIHonorario({ 
  titulo, 
  valor, 
  subtitulo,
  variacao, 
  icone,
  corIcone = "bg-primary-50 text-primary-600",
  onClick,
  destaque = false
}: KPIHonorarioProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white rounded-lg border p-4 transition-all",
        destaque ? "border-primary-200 shadow-sm" : "border-neutral-200",
        onClick && "cursor-pointer hover:border-primary-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          {titulo}
        </span>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          corIcone
        )}>
          {icone}
        </div>
      </div>
      
      <div className="mb-1">
        <span className={cn(
          "text-2xl font-bold font-mono tracking-tight",
          destaque ? "text-primary-600" : "text-neutral-800"
        )}>
          {valor}
        </span>
      </div>
      
      {subtitulo && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          {variacao !== undefined && (
            <span className={cn(
              "flex items-center gap-0.5 font-medium",
              variacao >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(variacao).toFixed(0)}%
            </span>
          )}
          <span>{subtitulo}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 💡 DR. CÍCERO INSIGHT COMPONENT
// ═══════════════════════════════════════════════════════════════
interface DrCiceroInsightProps {
  insights: Array<{
    tipo: 'alerta' | 'insight' | 'oportunidade';
    mensagem: string;
    acao?: string;
  }>;
}

function DrCiceroInsights({ insights }: DrCiceroInsightProps) {
  if (insights.length === 0) return null;
  
  const getInsightStyle = (tipo: string) => {
    switch (tipo) {
      case 'alerta':
        return 'border-l-amber-500 bg-amber-50/50';
      case 'oportunidade':
        return 'border-l-emerald-500 bg-emerald-50/50';
      default:
        return 'border-l-violet-500 bg-violet-50/50';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
          <Bot className="h-4 w-4 text-violet-600" />
        </div>
        <span className="text-sm font-semibold text-neutral-700">Dr. Cícero</span>
        <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600">
          IA
        </Badge>
      </div>
      
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div 
            key={i}
            className={cn(
              "border-l-2 pl-3 py-1.5 text-sm text-neutral-600 rounded-r",
              getInsightStyle(insight.tipo)
            )}
          >
            {insight.mensagem}
            {insight.acao && (
              <button className="ml-2 text-primary-600 hover:underline font-medium">
                {insight.acao} →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📋 MONTHS CONSTANTS
// ═══════════════════════════════════════════════════════════════
const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

// ═══════════════════════════════════════════════════════════════
// 📄 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function InvoicesNew() {
  const { selectedYear, selectedMonth } = usePeriod();
  const { selectedClientId, selectedClientName } = useClient();
  const { registrarHonorario, registrarRecebimento } = useAccounting({ 
    showToasts: false, 
    sourceModule: 'Invoices' 
  });

  // ─────────────────────────────────────────────────────────────
  // 📊 STATES
  // ─────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    client_id: "",
    amount: "",
    due_date: "",
    payment_date: "",
    status: "pending",
    description: "",
    competence: "",
  });

  // ─────────────────────────────────────────────────────────────
  // 📊 COMPUTED VALUES (KPIs)
  // ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = invoices.length;
    const pendentes = invoices.filter(i => i.status === "pending");
    const pagos = invoices.filter(i => i.status === "paid");
    const vencidos = invoices.filter(i => {
      if (i.status !== "pending") return false;
      const dueDate = new Date(i.due_date);
      return dueDate < new Date();
    });
    
    const totalPendente = pendentes.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalPago = pagos.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalVencido = vencidos.reduce((sum, i) => sum + Number(i.amount), 0);
    
    const taxaRecebimento = total > 0 ? (pagos.length / total) * 100 : 0;

    return {
      total,
      pendentes: pendentes.length,
      pagos: pagos.length,
      vencidos: vencidos.length,
      totalPendente,
      totalPago,
      totalVencido,
      taxaRecebimento
    };
  }, [invoices]);

  // ─────────────────────────────────────────────────────────────
  // 🤖 DR. CÍCERO INSIGHTS
  // ─────────────────────────────────────────────────────────────
  const drCiceroInsights = useMemo(() => {
    const insights: Array<{tipo: 'alerta' | 'insight' | 'oportunidade'; mensagem: string; acao?: string}> = [];
    
    // Alertas de vencidos
    if (kpis.vencidos > 0) {
      insights.push({
        tipo: 'alerta',
        mensagem: `${kpis.vencidos} honorário${kpis.vencidos > 1 ? 's' : ''} vencido${kpis.vencidos > 1 ? 's' : ''} totalizam ${formatCurrency(kpis.totalVencido)}`,
        acao: 'Cobrar agora'
      });
    }
    
    // Taxa de inadimplência alta
    if (kpis.total > 0 && kpis.taxaRecebimento < 70) {
      insights.push({
        tipo: 'insight',
        mensagem: `Taxa de recebimento de ${kpis.taxaRecebimento.toFixed(0)}% está abaixo do ideal (70%).`
      });
    }
    
    // Oportunidade de geração
    if (selectedYear && selectedMonth && kpis.total === 0) {
      insights.push({
        tipo: 'oportunidade',
        mensagem: `Nenhum honorário para ${MONTHS.find(m => m.value === selectedMonth?.toString().padStart(2, '0'))?.label}/${selectedYear}. Gere agora.`,
        acao: 'Gerar honorários'
      });
    }

    return insights;
  }, [kpis, selectedYear, selectedMonth]);

  // ─────────────────────────────────────────────────────────────
  // 🔄 DATA LOADING
  // ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      let query = supabase
        .from("invoices")
        .select("*, clients(name)")
        .order("due_date", { ascending: false });

      if (selectedClientId) {
        query = query.eq("client_id", selectedClientId);
      }

      if (selectedYear && selectedMonth) {
        const monthStr = selectedMonth.toString().padStart(2, '0');
        query = query.eq("competence", `${monthStr}/${selectedYear}`);
      } else if (selectedYear) {
        query = query.like("competence", `%/${selectedYear}`);
      }

      const [invoicesRes, clientsRes] = await Promise.all([
        query,
        supabase.from("clients").select("*").eq("is_active", true).order("name"),
      ]);

      setInvoices(invoicesRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedClientId]);

  // Realtime
  useTableRealtime("invoices", () => {
    loadData();
    toast.info("📡 Dados atualizados", { duration: 2000 });
    setIsRealtimeConnected(true);
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─────────────────────────────────────────────────────────────
  // 🔍 FILTERED INVOICES
  // ─────────────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "overdue") {
          if (invoice.status !== "pending") return false;
          const dueDate = new Date(invoice.due_date);
          if (dueDate >= new Date()) return false;
        } else if (invoice.status !== statusFilter) {
          return false;
        }
      }
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchClient = invoice.clients?.name?.toLowerCase().includes(search);
        const matchCompetence = invoice.competence?.includes(search);
        return matchClient || matchCompetence;
      }
      
      return true;
    });
  }, [invoices, statusFilter, searchTerm]);

  // ─────────────────────────────────────────────────────────────
  // ⚡ GENERATE MONTHLY INVOICES
  // ─────────────────────────────────────────────────────────────
  const generateMonthlyInvoices = async () => {
    if (!selectedYear || !selectedMonth) {
      toast.error("Selecione ano e mês para gerar os honorários");
      return;
    }

    const monthStr = selectedMonth.toString().padStart(2, '0');
    const monthLabel = MONTHS.find(m => m.value === monthStr)?.label;
    
    if (!confirm(`Gerar honorários para ${monthLabel}/${selectedYear}?`)) {
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus("Buscando clientes...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: activeClients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .gt("monthly_fee", 0)
        .or("is_pro_bono.is.null,is_pro_bono.eq.false");

      if (clientsError) {
        toast.error("Erro ao buscar clientes: " + clientsError.message);
        setIsGenerating(false);
        return;
      }

      if (!activeClients || activeClients.length === 0) {
        toast.warning("Nenhum cliente ativo com honorário definido");
        setIsGenerating(false);
        return;
      }

      const totalClients = activeClients.length;
      setGenerationStatus(`${totalClients} clientes encontrados`);
      setGenerationProgress(5);

      const competence = `${monthStr}/${selectedYear}`;
      let created = 0;
      let skipped = 0;
      let processed = 0;

      for (const client of activeClients) {
        processed++;
        const progress = Math.round(5 + (processed / totalClients) * 90);
        setGenerationProgress(progress);
        setGenerationStatus(`${client.name}... (${processed}/${totalClients})`);

        const { data: existingList } = await supabase
          .from("invoices")
          .select("id")
          .eq("client_id", client.id)
          .eq("competence", competence);

        if (existingList && existingList.length > 0) {
          skipped++;
          continue;
        }

        const paymentDay = client.payment_day || 10;
        const competenceMonth = parseInt(monthStr);
        const competenceYear = parseInt(selectedYear);
        let dueMonth = competenceMonth + 1;
        let dueYear = competenceYear;

        if (dueMonth > 12) {
          dueMonth = 1;
          dueYear = competenceYear + 1;
        }

        const clientDueDate = `${dueYear}-${dueMonth.toString().padStart(2, "0")}-${paymentDay.toString().padStart(2, "0")}`;

        const { data: newInvoice, error } = await supabase.from("invoices").insert({
          client_id: client.id,
          amount: client.monthly_fee,
          due_date: clientDueDate,
          status: "pending",
          competence: competence,
          created_by: user.id,
        }).select().single();

        if (!error && newInvoice) {
          created++;
          registrarHonorario({
            invoiceId: newInvoice.id,
            clientId: client.id,
            clientName: client.name,
            amount: Number(client.monthly_fee),
            competence: competence,
            dueDate: clientDueDate,
            description: `Honorários ${competence} - ${client.name}`,
          }).catch(console.error);
        }
      }

      setGenerationProgress(100);
      setGenerationStatus("Concluído!");

      if (created > 0) {
        toast.success(`${created} honorário${created > 1 ? 's' : ''} gerado${created > 1 ? 's' : ''}!`, {
          description: skipped > 0 ? `${skipped} já existia${skipped > 1 ? 'm' : ''}` : undefined
        });
      } else if (skipped > 0) {
        toast.info(`Todos os ${skipped} honorários já existem`);
      }

      setTimeout(() => {
        setIsGenerating(false);
        loadData();
      }, 1000);
    } catch (error: any) {
      toast.error("Erro: " + getErrorMessage(error));
      setIsGenerating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 📝 HANDLERS
  // ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      client_id: "",
      amount: "",
      due_date: "",
      payment_date: "",
      status: "pending",
      description: "",
      competence: "",
    });
  };

  const handleEdit = (invoice: any) => {
    setEditingInvoice(invoice);
    setFormData({
      client_id: invoice.client_id,
      amount: invoice.amount.toString(),
      due_date: invoice.due_date,
      payment_date: invoice.payment_date || "",
      status: invoice.status,
      description: invoice.description || "",
      competence: invoice.competence || "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const invoiceData = {
        ...formData,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date || null,
        created_by: user.id,
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", editingInvoice.id);

        if (error) throw error;
        toast.success("Honorário atualizado!");
      } else {
        const { data: newInvoice, error } = await supabase
          .from("invoices")
          .insert(invoiceData)
          .select()
          .single();

        if (error) throw error;

        const client = clients.find(c => c.id === formData.client_id);
        await registrarHonorario({
          invoiceId: newInvoice.id,
          clientId: formData.client_id,
          clientName: client?.name || 'Cliente',
          amount: parseFloat(formData.amount),
          competence: formData.competence,
          dueDate: formData.due_date,
          description: formData.description || `Honorários ${formData.competence}`,
        });

        toast.success("Honorário cadastrado!");
      }

      setOpen(false);
      setEditingInvoice(null);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoice: any) => {
    try {
      const paymentDate = new Date().toISOString().split("T")[0];

      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", payment_date: paymentDate })
        .eq("id", invoice.id);

      if (error) throw error;

      await registrarRecebimento({
        paymentId: `${invoice.id}_payment`,
        invoiceId: invoice.id,
        clientId: invoice.client_id,
        clientName: invoice.clients?.name || 'Cliente',
        amount: Number(invoice.amount),
        paymentDate: paymentDate,
        description: `Recebimento ${invoice.competence || ''} - ${invoice.clients?.name}`,
      });

      toast.success("Honorário pago!");
      loadData();
    } catch (error: any) {
      toast.error("Erro: " + getErrorMessage(error));
    }
  };

  const handleDelete = async (id: string, invoice: any) => {
    if (invoice.status === "paid" && invoice.cnab_reference) {
      toast.error("Fatura conciliada! Desfaça a conciliação primeiro.");
      return;
    }

    if (!confirm("Excluir este honorário?")) return;

    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
      toast.success("Honorário excluído!");
      loadData();
    } catch (error: any) {
      toast.error("Erro: " + getErrorMessage(error));
    }
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status === "pending" && new Date(dueDate) < new Date();
    
    if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    
    const config: Record<string, { variant: "default" | "secondary" | "outline"; label: string; className?: string }> = {
      paid: { variant: "default", label: "Pago", className: "bg-emerald-600" },
      pending: { variant: "outline", label: "Pendente", className: "border-amber-400 text-amber-700" },
      canceled: { variant: "secondary", label: "Cancelado" },
    };
    
    const c = config[status] || config.pending;
    return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
  };

  // ─────────────────────────────────────────────────────────────
  // 🎨 RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Generation Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                Gerando Honorários
              </CardTitle>
              <CardDescription>Aguarde...</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={generationProgress} className="h-2" />
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{generationStatus}</span>
                <span className="font-mono font-medium">{generationProgress}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6 p-6">
        {/* ═══════════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-md">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">
                  {selectedClientId ? `Honorários — ${selectedClientName}` : "Honorários"}
                </h1>
                <Badge 
                  variant={isRealtimeConnected ? "default" : "outline"} 
                  className={cn(
                    "gap-1",
                    isRealtimeConnected ? "bg-emerald-600" : ""
                  )}
                >
                  <Radio className={cn("h-3 w-3", isRealtimeConnected && "animate-pulse")} />
                  {isRealtimeConnected ? "Ao vivo" : "Conectando..."}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500">
                Centro de receita — {kpis.total} honorários no período
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={generateMonthlyInvoices}
              disabled={isGenerating || !selectedYear || !selectedMonth}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-1.5" />
              )}
              Gerar Mês
            </Button>
            
            <Dialog open={open} onOpenChange={(value) => {
              setOpen(value);
              if (!value) {
                setEditingInvoice(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Novo Honorário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingInvoice ? "Editar Honorário" : "Novo Honorário"}</DialogTitle>
                  <DialogDescription>
                    Registre o honorário a receber
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="client_id">Cliente *</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="amount">Valor *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="competence">Competência</Label>
                      <Input
                        id="competence"
                        placeholder="Ex: 01/2025"
                        value={formData.competence}
                        onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Vencimento *</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="payment_date">Data Pagamento</Label>
                      <Input
                        id="payment_date"
                        type="date"
                        value={formData.payment_date}
                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                          <SelectItem value="canceled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            PERIOD FILTER
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <PeriodFilter />
          </div>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            KPIs
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPIHonorario
            titulo="Total"
            valor={kpis.total}
            subtitulo="no período"
            icone={<FileText className="h-4 w-4" />}
          />
          <KPIHonorario
            titulo="A Receber"
            valor={formatCurrency(kpis.totalPendente)}
            subtitulo={`${kpis.pendentes} pendente${kpis.pendentes !== 1 ? 's' : ''}`}
            icone={<Clock className="h-4 w-4" />}
            corIcone="bg-amber-100 text-amber-600"
            onClick={() => setStatusFilter("pending")}
            destaque
          />
          <KPIHonorario
            titulo="Recebido"
            valor={formatCurrency(kpis.totalPago)}
            subtitulo={`${kpis.pagos} pago${kpis.pagos !== 1 ? 's' : ''}`}
            icone={<CheckCircle className="h-4 w-4" />}
            corIcone="bg-emerald-100 text-emerald-600"
            onClick={() => setStatusFilter("paid")}
          />
          <KPIHonorario
            titulo="Vencidos"
            valor={kpis.vencidos}
            subtitulo={formatCurrency(kpis.totalVencido)}
            icone={<AlertTriangle className="h-4 w-4" />}
            corIcone="bg-red-100 text-red-600"
            onClick={() => setStatusFilter("overdue")}
          />
          <KPIHonorario
            titulo="Taxa Receb."
            valor={`${kpis.taxaRecebimento.toFixed(0)}%`}
            subtitulo="do período"
            icone={<TrendingUp className="h-4 w-4" />}
            corIcone={kpis.taxaRecebimento >= 70 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}
          />
          <KPIHonorario
            titulo="Ticket Médio"
            valor={kpis.total > 0 ? formatCurrency((kpis.totalPago + kpis.totalPendente) / kpis.total) : "R$ 0"}
            subtitulo="por honorário"
            icone={<DollarSign className="h-4 w-4" />}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DR. CÍCERO INSIGHTS
        ═══════════════════════════════════════════════════════════════ */}
        {drCiceroInsights.length > 0 && (
          <DrCiceroInsights insights={drCiceroInsights} />
        )}

        {/* ═══════════════════════════════════════════════════════════════
            LISTA DE HONORÁRIOS
        ═══════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Lista de Honorários</CardTitle>
                <CardDescription>
                  {filteredInvoices.length} de {invoices.length} honorários
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-9 w-52"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <Filter className="h-4 w-4 mr-2 text-neutral-400" />
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paid">Pagos</SelectItem>
                    <SelectItem value="overdue">Vencidos</SelectItem>
                    <SelectItem value="canceled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum honorário encontrado</p>
                {(searchTerm || statusFilter !== "all") && (
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-neutral-50">
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="font-semibold">Competência</TableHead>
                      <TableHead className="font-semibold">Vencimento</TableHead>
                      <TableHead className="font-semibold text-right">Valor</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const isOverdue = invoice.status === "pending" && new Date(invoice.due_date) < new Date();
                      
                      return (
                        <TableRow 
                          key={invoice.id}
                          className={cn(
                            "hover:bg-neutral-50 transition-colors",
                            isOverdue && "bg-red-50/50"
                          )}
                        >
                          <TableCell className="font-medium">
                            {invoice.clients?.name || "—"}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{invoice.competence || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-sm",
                              isOverdue && "text-red-600 font-medium"
                            )}>
                              {new Date(invoice.due_date).toLocaleDateString("pt-BR")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-medium">
                              {formatCurrency(Number(invoice.amount))}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invoice.status, invoice.due_date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                {invoice.status === "pending" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleMarkAsPaid(invoice)}
                                      >
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marcar como pago</TooltipContent>
                                  </Tooltip>
                                )}

                                <AIInvoiceClassifier
                                  invoiceId={invoice.id}
                                  clientId={invoice.client_id}
                                  amount={invoice.amount}
                                  dueDate={invoice.due_date}
                                />

                                {invoice.status === "pending" && (
                                  <AICollectionAgent
                                    clientId={invoice.client_id}
                                    invoiceId={invoice.id}
                                    trigger={
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Bot className="h-4 w-4 text-violet-500" />
                                      </Button>
                                    }
                                  />
                                )}

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEdit(invoice)}
                                    >
                                      <Pencil className="h-4 w-4 text-neutral-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleDelete(invoice.id, invoice)}
                                      disabled={invoice.status === "paid" && invoice.cnab_reference}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {invoice.status === "paid" && invoice.cnab_reference
                                      ? "Fatura conciliada"
                                      : "Excluir"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
