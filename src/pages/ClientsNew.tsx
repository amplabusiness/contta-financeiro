/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              CLIENTES — MAESTRO UX 2.0 EDITION                   ║
 * ║                                                                   ║
 * ║  Centro do negócio. Entender em 30 segundos.                     ║
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
import { useNavigate } from "react-router-dom";
import { 
  Users, Building2, Plus, Search, Filter, 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Eye, Pencil, Ban, Trash2, Heart, Upload,
  Loader2, Radio, ChevronRight, Bot, RefreshCw,
  ArrowUpRight, FileText, DollarSign, UserCheck, UserX
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Layout Maestro UX
import { Layout } from "@/components/Layout";

// Componentes UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, 
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, 
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";

// Data & Integrations
import { supabase } from "@/integrations/supabase/client";
import { useTableRealtime } from "@/hooks/useRealtimeSubscription";
import { useClient } from "@/contexts/ClientContext";
import { formatCurrency } from "@/data/expensesData";
import { formatDocument } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/utils";

// Componentes específicos
import { AIClientAnalyzer } from "@/components/ai/AIClientAnalyzer";
import { CNPJInput } from "@/components/CNPJInput";
import { EconomicGroupIndicator } from "@/components/EconomicGroupIndicator";
import { FinancialGroupBadge } from "@/components/FinancialGroupBadge";
import { FinancialGroupsDialog } from "@/components/FinancialGroupsDialog";

// ═══════════════════════════════════════════════════════════════
// 🎨 DESIGN TOKENS (Brand Book Compliance)
// ═══════════════════════════════════════════════════════════════
const colors = {
  primary: {
    50: '#eef9fd',
    100: '#d6f0fa',
    500: '#0a8fc5',
    600: '#0773a0',
  },
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  ai: '#7c3aed',
};

// ═══════════════════════════════════════════════════════════════
// 📊 KPI CARD COMPONENT
// ═══════════════════════════════════════════════════════════════
interface KPIClienteProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  variacao?: number;
  icone: React.ReactNode;
  corIcone?: string;
  onClick?: () => void;
}

function KPICliente({ 
  titulo, 
  valor, 
  subtitulo,
  variacao, 
  icone,
  corIcone = "bg-primary-50 text-primary-600",
  onClick
}: KPIClienteProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white rounded-lg border border-neutral-200 p-4 transition-all",
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
        <span className="text-2xl font-bold text-neutral-800 font-mono tracking-tight">
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
// 📋 STATUS BADGE
// ═══════════════════════════════════════════════════════════════
function ClienteStatusBadge({ ativo, proBono }: { ativo: boolean; proBono?: boolean }) {
  if (proBono) {
    return (
      <Badge variant="outline" className="gap-1 border-pink-400 text-pink-700 bg-pink-50">
        <Heart className="h-3 w-3 fill-current" />
        Pro-Bono
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant={ativo ? "default" : "destructive"} 
      className={ativo ? "bg-emerald-600" : ""}
    >
      {ativo ? "Ativo" : "Suspenso"}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📄 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ClientsNew() {
  const navigate = useNavigate();
  const { selectedClientId, setSelectedClient, clearSelectedClient } = useClient();

  // ─────────────────────────────────────────────────────────────
  // 📊 STATES
  // ─────────────────────────────────────────────────────────────
  // Loading
  const [loading, setLoading] = useState(true);
  const [loadingClientDetails, setLoadingClientDetails] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [importingGroups, setImportingGroups] = useState(false);

  // Data
  const [clients, setClients] = useState<any[]>([]);
  const [allClientsForGroups, setAllClientsForGroups] = useState<any[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialogs
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [financialGroupsDialogOpen, setFinancialGroupsDialogOpen] = useState(false);
  
  // Form
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [viewingClientInvoices, setViewingClientInvoices] = useState<any[]>([]);
  const [viewingClientOpeningBalances, setViewingClientOpeningBalances] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    cpf: "",
    email: "",
    phone: "",
    monthly_fee: "",
    payment_day: "",
    notes: "",
    is_active: true,
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

  // ─────────────────────────────────────────────────────────────
  // 📊 COMPUTED VALUES (KPIs)
  // ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = clients.length;
    const ativos = clients.filter(c => c.is_active).length;
    const suspensos = clients.filter(c => !c.is_active).length;
    const proBono = clients.filter(c => c.is_pro_bono).length;
    
    const faturamentoMensal = clients
      .filter(c => c.is_active && !c.is_pro_bono)
      .reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0);
    
    const comPendencia = clients.filter(c => 
      c.invoiceStats?.pending > 0
    ).length;

    return {
      total,
      ativos,
      suspensos,
      proBono,
      faturamentoMensal,
      comPendencia
    };
  }, [clients]);

  // ─────────────────────────────────────────────────────────────
  // 🤖 DR. CÍCERO INSIGHTS
  // ─────────────────────────────────────────────────────────────
  const drCiceroInsights = useMemo(() => {
    const insights: Array<{tipo: 'alerta' | 'insight' | 'oportunidade'; mensagem: string; acao?: string}> = [];
    
    // Alertas de inadimplência
    if (kpis.comPendencia > 0) {
      insights.push({
        tipo: 'alerta',
        mensagem: `${kpis.comPendencia} cliente${kpis.comPendencia > 1 ? 's' : ''} com honorários pendentes.`,
        acao: 'Ver pendências'
      });
    }
    
    // Análise de pro-bono
    if (kpis.proBono > kpis.ativos * 0.15) {
      insights.push({
        tipo: 'insight',
        mensagem: `${((kpis.proBono / kpis.ativos) * 100).toFixed(0)}% da base é pro-bono. Considere revisar política.`
      });
    }
    
    // Oportunidade de faturamento
    const potencialRecuperacao = kpis.suspensos * (kpis.faturamentoMensal / Math.max(kpis.ativos, 1));
    if (kpis.suspensos > 0 && potencialRecuperacao > 5000) {
      insights.push({
        tipo: 'oportunidade',
        mensagem: `Potencial de ${formatCurrency(potencialRecuperacao)}/mês reativando clientes suspensos.`,
        acao: 'Ver suspensos'
      });
    }

    return insights;
  }, [kpis]);

  // ─────────────────────────────────────────────────────────────
  // 🔄 DATA LOADING
  // ─────────────────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    try {
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
        .eq('is_active', true)
        .order("name");

      if (clientsError) throw clientsError;

      const { data: allClientsData, error: allClientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf, qsa, monthly_fee, is_active")
        .order("name");

      if (allClientsError) throw allClientsError;
      setAllClientsForGroups(allClientsData || []);
      
      // Enriquecer com estatísticas
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
    } catch (error) {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime
  useTableRealtime("clients", () => {
    loadClients();
    toast.info("📡 Dados atualizados", { duration: 2000 });
    setIsRealtimeConnected(true);
  });

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // ─────────────────────────────────────────────────────────────
  // 🔍 FILTERED CLIENTS
  // ─────────────────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !client.is_active) return false;
        if (statusFilter === "inactive" && client.is_active) return false;
        if (statusFilter === "pro_bono" && !client.is_pro_bono) return false;
        if (statusFilter === "pending" && client.invoiceStats?.pending === 0) return false;
      }
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchName = client.name?.toLowerCase().includes(search);
        const matchCnpj = client.cnpj?.includes(search.replace(/\D/g, ''));
        const matchCpf = client.cpf?.includes(search.replace(/\D/g, ''));
        const matchEmail = client.email?.toLowerCase().includes(search);
        
        return matchName || matchCnpj || matchCpf || matchEmail;
      }
      
      return true;
    });
  }, [clients, statusFilter, searchTerm]);

  // ─────────────────────────────────────────────────────────────
  // 📝 HANDLERS
  // ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      name: "", cnpj: "", cpf: "", email: "", phone: "",
      monthly_fee: "", payment_day: "", notes: "", is_active: true,
      is_pro_bono: false, pro_bono_start_date: "", pro_bono_end_date: "",
      pro_bono_reason: "", razao_social: "", nome_fantasia: "",
      porte: "", natureza_juridica: "", situacao_cadastral: "",
      data_abertura: "", capital_social: "", logradouro: "",
      numero: "", complemento: "", bairro: "", municipio: "",
      uf: "", cep: "", atividade_principal: null, 
      atividades_secundarias: [], qsa: []
    });
  };

  const handleCNPJDataFetched = (data: any) => {
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
      is_active: client.is_active !== undefined ? client.is_active : true,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const documentValue = formData.cnpj || formData.cpf;
      const documentNormalized = documentValue.replace(/[^\d]/g, '');
      const isCPF = documentNormalized.length === 11;
      const isCNPJ = documentNormalized.length === 14;

      if (!isCPF && !isCNPJ) {
        toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
        setLoading(false);
        return;
      }

      // Verificar duplicata
      const { data: existingClients, error: checkError } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf")
        .not("id", "eq", editingClient?.id || "00000000-0000-0000-0000-000000000000");

      if (checkError) throw checkError;

      const duplicateClient = existingClients?.find(client => {
        if (isCPF && client.cpf) {
          return client.cpf.replace(/[^\d]/g, '') === documentNormalized;
        }
        if (isCNPJ && client.cnpj) {
          return client.cnpj.replace(/[^\d]/g, '') === documentNormalized;
        }
        return false;
      });

      if (duplicateClient) {
        const docType = isCPF ? "CPF" : "CNPJ";
        toast.error(`${docType} já cadastrado para: ${duplicateClient.name}`);
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
        is_active: formData.is_active,
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
        toast.success("Cliente atualizado!");
      } else {
        const { error } = await supabase.from("clients").insert(clientData);
        if (error) throw error;
        toast.success("Cliente cadastrado!");
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
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', deleteClientId)
        .limit(1);

      if (invoices && invoices.length > 0) {
        await supabase
          .from('clients')
          .update({ is_active: false })
          .eq('id', deleteClientId);
        
        const clientName = clients.find(c => c.id === deleteClientId)?.name;
        toast.warning(`${clientName} foi suspenso (possui histórico)`);
      } else {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', deleteClientId);

        if (error) {
          if (error.code === '23503') {
            await supabase
              .from('clients')
              .update({ is_active: false })
              .eq('id', deleteClientId);
            toast.warning(`Cliente suspenso (possui vínculos)`);
          } else {
            throw error;
          }
        } else {
          toast.success("Cliente excluído!");
        }
      }

      setDeleteDialogOpen(false);
      setDeleteClientId(null);
      loadClients();
    } catch (error: any) {
      toast.error("Erro ao processar exclusão");
    }
  };

  const handleToggleStatus = async (client: any) => {
    const newStatus = !client.is_active;
    
    try {
      const updateData: any = {
        is_active: newStatus,
        status: newStatus ? 'active' : 'inactive'
      };

      if (!newStatus) {
        updateData.contract_end_date = new Date().toISOString().split('T')[0];
      } else {
        updateData.contract_end_date = null;
      }

      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", client.id);

      if (error) throw error;

      toast.success(
        newStatus ? "Cliente reativado!" : "Cliente suspenso!",
        { description: newStatus ? "Honorários serão gerados novamente" : "Contrato encerrado" }
      );
      loadClients();
    } catch (error: any) {
      toast.error("Erro: " + getErrorMessage(error));
    }
  };

  const handleViewClient = async (client: any) => {
    setViewingClient(client);
    setViewDialogOpen(true);
    setLoadingClientDetails(true);

    try {
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", client.id)
        .order("competence", { ascending: false });

      setViewingClientInvoices(invoicesData || []);

      const { data: openingBalanceData } = await supabase
        .from("client_opening_balance")
        .select("*")
        .eq("client_id", client.id)
        .order("competence", { ascending: false });

      setViewingClientOpeningBalances(openingBalanceData || []);
    } catch (error) {
      toast.error("Erro ao carregar detalhes");
    } finally {
      setLoadingClientDetails(false);
    }
  };

  const handleImportGroups = async () => {
    setImportingGroups(true);
    toast.loading("Importando grupos econômicos...");
    
    try {
      const { data, error } = await supabase.functions.invoke('import-economic-groups');
      if (error) throw error;
      
      toast.dismiss();
      toast.success(`Grupos importados!`, {
        description: `${data.groupsCreated} grupos e ${data.membersCreated} membros`
      });
      loadClients();
    } catch (error: any) {
      toast.dismiss();
      toast.error("Erro ao importar grupos", { description: error.message });
    } finally {
      setImportingGroups(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🎨 RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* ═══════════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-md">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">
                  Clientes
                </h1>
                <Badge 
                  variant={isRealtimeConnected ? "default" : "outline"} 
                  className={cn(
                    "gap-1",
                    isRealtimeConnected ? "bg-emerald-600" : ""
                  )}
                >
                  <Radio className={cn(
                    "h-3 w-3",
                    isRealtimeConnected && "animate-pulse"
                  )} />
                  {isRealtimeConnected ? "Ao vivo" : "Conectando..."}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500">
                Centro do negócio — {kpis.ativos} clientes ativos
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFinancialGroupsDialogOpen(true)}
            >
              <Users className="w-4 h-4 mr-1.5" />
              Grupos
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleImportGroups}
              disabled={importingGroups}
            >
              {importingGroups ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Sincronizar
            </Button>
            <Dialog open={open} onOpenChange={(value) => {
              setOpen(value);
              if (!value) {
                setEditingClient(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-primary-600 hover:bg-primary-700">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                  <DialogDescription>
                    Use o CNPJ para buscar automaticamente os dados da Receita Federal.
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
                    <TabsContent value="basico" className="space-y-4 mt-4">
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
                    <TabsContent value="empresa" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Razão Social</Label>
                          <Input value={formData.razao_social} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome Fantasia</Label>
                          <Input value={formData.nome_fantasia} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Situação Cadastral</Label>
                          <Input value={formData.situacao_cadastral} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Porte</Label>
                          <Input value={formData.porte} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Natureza Jurídica</Label>
                          <Input value={formData.natureza_juridica} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Data de Abertura</Label>
                          <Input 
                            value={formData.data_abertura ? new Date(formData.data_abertura).toLocaleDateString('pt-BR') : ''} 
                            disabled 
                            className="bg-neutral-50" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Capital Social</Label>
                          <Input 
                            value={formData.capital_social ? formatCurrency(Number(formData.capital_social)) : ''} 
                            disabled 
                            className="bg-neutral-50" 
                          />
                        </div>

                        {formData.atividade_principal && (
                          <div className="space-y-2 col-span-2">
                            <Label>Atividade Principal (CNAE)</Label>
                            <Input 
                              value={`${formData.atividade_principal.codigo} - ${formData.atividade_principal.descricao}`} 
                              disabled 
                              className="bg-neutral-50" 
                            />
                          </div>
                        )}

                        {formData.qsa && formData.qsa.length > 0 && (
                          <div className="space-y-2 col-span-2">
                            <Label>Sócios ({formData.qsa.length})</Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {formData.qsa.map((socio: any, idx: number) => (
                                <div key={idx} className="p-3 bg-neutral-50 rounded-lg border">
                                  <p className="font-medium text-sm">{socio.nome}</p>
                                  <p className="text-xs text-neutral-500">{socio.qualificacao}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Aba Endereço */}
                    <TabsContent value="endereco" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>CEP</Label>
                          <Input value={formData.cep} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>UF</Label>
                          <Input value={formData.uf} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label>Logradouro</Label>
                          <Input value={formData.logradouro} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Número</Label>
                          <Input value={formData.numero} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Complemento</Label>
                          <Input value={formData.complemento} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bairro</Label>
                          <Input value={formData.bairro} disabled className="bg-neutral-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Município</Label>
                          <Input value={formData.municipio} disabled className="bg-neutral-50" />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Aba Financeiro */}
                    <TabsContent value="financeiro" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Histórico de Boletos (edição) */}
                        {editingClient && editingClient.invoiceStats && (
                          <div className="col-span-2 p-4 bg-neutral-50 rounded-lg border">
                            <h4 className="font-semibold mb-3 text-sm">Histórico de Honorários</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-neutral-500">Total</p>
                                <p className="text-xl font-bold">{editingClient.invoiceStats.total}</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Pagos</p>
                                <p className="text-xl font-bold text-emerald-600">{editingClient.invoiceStats.paid}</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Pendentes</p>
                                <p className="text-xl font-bold text-amber-600">{editingClient.invoiceStats.pending}</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Total Faturado</p>
                                <p className="text-lg font-bold">{formatCurrency(editingClient.invoiceStats.totalAmount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Total Recebido</p>
                                <p className="text-lg font-bold text-emerald-600">{formatCurrency(editingClient.invoiceStats.paidAmount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">A Receber</p>
                                <p className="text-lg font-bold text-amber-600">
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
                          <Label htmlFor="payment_day">Dia de Vencimento</Label>
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
                          <Label className="font-semibold">Tipo de Cliente</Label>
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
                              } else {
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
                                Cliente Regular
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="pro_bono" id="pro_bono" />
                              <Label htmlFor="pro_bono" className="font-normal cursor-pointer">
                                Cliente Pro-Bono (Gratuito)
                              </Label>
                            </div>
                          </RadioGroup>
                          
                          {formData.is_pro_bono && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-pink-50 rounded-lg border border-pink-100">
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
                                <p className="text-xs text-neutral-500">
                                  Deixe em branco para indefinido
                                </p>
                              </div>
                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="pro_bono_reason">Justificativa *</Label>
                                <Textarea
                                  id="pro_bono_reason"
                                  value={formData.pro_bono_reason}
                                  onChange={(e) => setFormData({ ...formData, pro_bono_reason: e.target.value })}
                                  placeholder="Ex: ONG, projeto social, parceria..."
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
                    <Button type="submit" disabled={loading} className="bg-primary-600 hover:bg-primary-700">
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
            KPIs
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICliente
            titulo="Total"
            valor={kpis.total}
            subtitulo="cadastrados"
            icone={<Building2 className="h-4 w-4" />}
          />
          <KPICliente
            titulo="Ativos"
            valor={kpis.ativos}
            subtitulo="gerando receita"
            icone={<UserCheck className="h-4 w-4" />}
            corIcone="bg-emerald-100 text-emerald-600"
          />
          <KPICliente
            titulo="Suspensos"
            valor={kpis.suspensos}
            subtitulo="contratos pausados"
            icone={<UserX className="h-4 w-4" />}
            corIcone="bg-amber-100 text-amber-600"
            onClick={() => setStatusFilter("inactive")}
          />
          <KPICliente
            titulo="Pro-Bono"
            valor={kpis.proBono}
            subtitulo="sem cobrança"
            icone={<Heart className="h-4 w-4" />}
            corIcone="bg-pink-100 text-pink-600"
            onClick={() => setStatusFilter("pro_bono")}
          />
          <KPICliente
            titulo="Fat. Mensal"
            valor={formatCurrency(kpis.faturamentoMensal)}
            subtitulo="receita recorrente"
            icone={<DollarSign className="h-4 w-4" />}
            corIcone="bg-emerald-100 text-emerald-600"
          />
          <KPICliente
            titulo="Pendências"
            valor={kpis.comPendencia}
            subtitulo="com atraso"
            icone={<AlertTriangle className="h-4 w-4" />}
            corIcone="bg-red-100 text-red-600"
            onClick={() => setStatusFilter("pending")}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DR. CÍCERO INSIGHTS
        ═══════════════════════════════════════════════════════════════ */}
        {drCiceroInsights.length > 0 && (
          <DrCiceroInsights insights={drCiceroInsights} />
        )}

        {/* ═══════════════════════════════════════════════════════════════
            FILTROS E BUSCA
        ═══════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Lista de Clientes</CardTitle>
                <CardDescription>
                  {filteredClients.length} de {clients.length} clientes
                  {selectedClientId && (
                    <Button 
                      variant="link" 
                      className="ml-2 text-xs"
                      onClick={clearSelectedClient}
                    >
                      Limpar seleção
                    </Button>
                  )}
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Buscar cliente..."
                    className="pl-9 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2 text-neutral-400" />
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Suspensos</SelectItem>
                    <SelectItem value="pro_bono">Pro-Bono</SelectItem>
                    <SelectItem value="pending">Com Pendência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum cliente encontrado</p>
                {searchTerm && (
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => setSearchTerm("")}
                  >
                    Limpar busca
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-neutral-50">
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="font-semibold">CPF/CNPJ</TableHead>
                      <TableHead className="font-semibold">Honorário</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Pendências</TableHead>
                      <TableHead className="font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => {
                      const isSuspended = !client.is_active;
                      const hasPending = client.invoiceStats?.pending > 0;
                      
                      return (
                        <TableRow 
                          key={client.id}
                          className={cn(
                            "hover:bg-neutral-50 transition-colors",
                            isSuspended && "bg-red-50/50",
                            hasPending && !isSuspended && "bg-amber-50/30"
                          )}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <FinancialGroupBadge clientId={client.id} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-neutral-800">
                                    {client.name}
                                  </span>
                                  {client.is_pro_bono && (
                                    <Badge variant="outline" className="text-[10px] gap-0.5 border-pink-300 text-pink-600">
                                      <Heart className="h-2.5 w-2.5 fill-current" />
                                      Pro-Bono
                                    </Badge>
                                  )}
                                </div>
                                {client.email && (
                                  <span className="text-xs text-neutral-500">{client.email}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="font-mono text-sm">
                            {formatDocument(client.cnpj || client.cpf || "")}
                          </TableCell>
                          
                          <TableCell>
                            <span className={cn(
                              "font-mono font-medium",
                              client.is_pro_bono && "text-neutral-400 line-through"
                            )}>
                              {formatCurrency(Number(client.monthly_fee))}
                            </span>
                          </TableCell>
                          
                          <TableCell>
                            <ClienteStatusBadge ativo={client.is_active} proBono={client.is_pro_bono} />
                          </TableCell>
                          
                          <TableCell>
                            {client.invoiceStats?.pending > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                                  {client.invoiceStats.pending} pendente{client.invoiceStats.pending > 1 ? 's' : ''}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-xs text-neutral-400">—</span>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleViewClient(client)}
                                    >
                                      <Eye className="h-4 w-4 text-neutral-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalhes</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEdit(client)}
                                    >
                                      <Pencil className="h-4 w-4 text-neutral-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>

                                <AIClientAnalyzer
                                  clientId={client.id}
                                  trigger={
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <Bot className="h-4 w-4 text-violet-500" />
                                    </Button>
                                  }
                                />

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleToggleStatus(client)}
                                    >
                                      {client.is_active ? (
                                        <Ban className="h-4 w-4 text-amber-500" />
                                      ) : (
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {client.is_active ? "Suspender" : "Reativar"}
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        setDeleteClientId(client.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir</TooltipContent>
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

        {/* ═══════════════════════════════════════════════════════════════
            DIALOGS
        ═══════════════════════════════════════════════════════════════ */}
        
        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dados da Empresa</DialogTitle>
              <DialogDescription>
                {viewingClient?.name}
              </DialogDescription>
            </DialogHeader>
            
            {viewingClient && (
              <div className="space-y-6">
                {/* Info básica */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 rounded-lg">
                  <div>
                    <span className="text-xs text-neutral-500">Nome</span>
                    <p className="font-medium">{viewingClient.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500">CNPJ/CPF</span>
                    <p className="font-mono">{formatDocument(viewingClient.cnpj || viewingClient.cpf || "")}</p>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500">Honorário</span>
                    <p className="font-mono font-bold text-lg">
                      {formatCurrency(Number(viewingClient.monthly_fee))}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500">Status</span>
                    <div className="mt-1">
                      <ClienteStatusBadge ativo={viewingClient.is_active} proBono={viewingClient.is_pro_bono} />
                    </div>
                  </div>
                </div>

                {/* Honorários */}
                <div>
                  <h4 className="font-semibold mb-3">Honorários</h4>
                  {loadingClientDetails ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : viewingClientInvoices.length > 0 ? (
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
                        {viewingClientInvoices.slice(0, 6).map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.competence}</TableCell>
                            <TableCell>
                              {invoice.due_date 
                                ? new Date(invoice.due_date).toLocaleDateString('pt-BR')
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(Number(invoice.amount))}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={invoice.status === 'paid' ? 'default' : 'outline'}
                                className={invoice.status === 'paid' ? 'bg-emerald-600' : 'border-amber-400 text-amber-700'}
                              >
                                {invoice.status === 'paid' ? 'Pago' : 'Pendente'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-neutral-500 py-4">
                      Nenhum honorário registrado
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteClientId && (
                  <>
                    Tem certeza que deseja excluir <strong>{clients.find(c => c.id === deleteClientId)?.name}</strong>?
                    <br /><br />
                    <span className="text-xs">
                      Se houver histórico financeiro, o cliente será apenas suspenso.
                    </span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Financial Groups Dialog */}
        <FinancialGroupsDialog 
          open={financialGroupsDialogOpen} 
          onOpenChange={setFinancialGroupsDialogOpen}
        />
      </div>
    </Layout>
  );
}
