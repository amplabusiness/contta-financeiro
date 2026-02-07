/**
 * ReconciliationSheet - Painel de Reconciliação Honorários × Contabilidade
 * 
 * Fase 2 + 3 da Governança de Dados:
 * - Lista divergências entre visão operacional e contábil
 * - Dr. Cícero atua como auditor com sugestões de ajuste
 * - Permite análise detalhada de cada discrepância
 * - Registra histórico de análises para auditoria
 * - Permite atualizar status da divergência
 */

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scale,
  Brain,
  FileText,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  FileQuestion,
  Receipt,
  RefreshCw,
  Lightbulb,
  ClipboardList,
  History,
  Save,
  Clock,
  CheckCircle2,
  Wrench,
  FileDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateDivergenceReport, downloadPDF } from "@/services/divergenceReportService";

// Tipos
interface Invoice {
  id: string;
  client_id: string;
  amount: number;
  competence: string;
  status: string;
  clients: { id: string; name: string } | null;
}

interface AccountingEntry {
  id: string;
  entry_date: string;
  description: string;
  internal_code: string;
  total_debit: number;
  total_credit: number;
}

interface ReconciliationData {
  operationalTotal: number;
  accountingTotal: number;
  divergence: number;
  invoicesWithoutEntry: Invoice[];
  entriesWithoutInvoice: AccountingEntry[];
  openingBalanceAmount: number;
  invoicesCount: number;
  entriesCount: number;
  pendingCount: number;
  overdueCount: number;
}

interface DrCiceroSuggestion {
  type: "warning" | "info" | "action";
  title: string;
  description: string;
}

interface DivergenceAuditRecord {
  id: string;
  reference_month: string;
  operational_total: number;
  accounting_total: number;
  divergence_amount: number;
  status: string;
  notes: string | null;
  resolution_notes: string | null;
  analyzed_at: string;
  resolved_at: string | null;
}

interface ReconciliationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationalTotal: number;
  accountingTotal: number;
  selectedMonth: string;
}

// Constantes
const TENANT_ID = "a53a4957-fe97-4856-b3ca-70045157b421"; // Ampla Contabilidade

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  em_analise: { label: "Em Análise", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  justificado: { label: "Justificado", icon: CheckCircle2, color: "bg-blue-100 text-blue-700" },
  em_correcao: { label: "Em Correção", icon: Wrench, color: "bg-orange-100 text-orange-700" },
  resolvido: { label: "Resolvido", icon: CheckCircle, color: "bg-green-100 text-green-700" },
};

// Formatador de moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Formatador de data
const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function ReconciliationSheet({
  open,
  onOpenChange,
  operationalTotal,
  accountingTotal,
  selectedMonth,
}: ReconciliationSheetProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [suggestions, setSuggestions] = useState<DrCiceroSuggestion[]>([]);
  
  // Estado para auditoria
  const [auditHistory, setAuditHistory] = useState<DivergenceAuditRecord[]>([]);
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("em_analise");
  const [auditNotes, setAuditNotes] = useState("");

  const divergence = Math.abs(operationalTotal - accountingTotal);

  // Gerar relatório PDF e indexar no Data Lake (com versionamento)
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const result = await generateDivergenceReport({
        tenantId: TENANT_ID,
        referenceMonth: selectedMonth,
        accountantName: "Dr. Cícero",
        accountantCRC: "Assistente Auditor IA",
        indexInDataLake: true,
        versionReason: "Análise de divergências",
      });

      if (result.success && result.pdfBlob && result.fileName) {
        downloadPDF(result.pdfBlob, result.fileName);
        
        // Montar mensagem com informações de versionamento
        const versionInfo = result.version ? `v${result.version}` : "";
        const hashInfo = result.chainHash ? ` | Hash: ${result.chainHash.substring(0, 8)}...` : "";
        const indexedMessage = result.dataLakeId 
          ? ` Indexado: ${result.dataLakeId} ${versionInfo}${hashInfo}`
          : "";
        
        toast({
          title: "Relatório gerado",
          description: `${result.fileName} baixado.${indexedMessage}`,
        });
      } else {
        throw new Error(result.error || "Erro ao gerar relatório");
      }
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Buscar histórico de auditoria
  const fetchAuditHistory = useCallback(async () => {
    try {
      const { data: historyData, error } = await supabase
        .from("divergence_audit_log")
        .select("*")
        .eq("tenant_id", TENANT_ID)
        .eq("reference_month", selectedMonth)
        .order("analyzed_at", { ascending: false })
        .limit(10);

      if (error) {
        // Tabela pode não existir ainda
        console.warn("Tabela de auditoria não encontrada:", error);
        return;
      }
      
      setAuditHistory(historyData || []);
      
      // Se há registro existente para este mês, usar seu status
      if (historyData && historyData.length > 0) {
        const latest = historyData[0];
        setCurrentAuditId(latest.id);
        setSelectedStatus(latest.status);
        setAuditNotes(latest.notes || "");
      }
    } catch (error) {
      console.error("Erro ao buscar histórico de auditoria:", error);
    }
  }, [selectedMonth]);

  // Registrar análise de divergência
  const registerDivergenceAnalysis = useCallback(async (reconciliationData: ReconciliationData) => {
    try {
      // Verificar se já existe registro para este mês
      const { data: existing } = await supabase
        .from("divergence_audit_log")
        .select("id")
        .eq("tenant_id", TENANT_ID)
        .eq("reference_month", selectedMonth)
        .order("analyzed_at", { ascending: false })
        .limit(1);

      // Se já existe um registro, não criar novo
      if (existing && existing.length > 0) {
        setCurrentAuditId(existing[0].id);
        return;
      }

      // Criar novo registro
      const { data: newRecord, error } = await supabase
        .from("divergence_audit_log")
        .insert({
          tenant_id: TENANT_ID,
          reference_month: selectedMonth,
          operational_total: reconciliationData.operationalTotal,
          accounting_total: reconciliationData.accountingTotal,
          divergence_amount: reconciliationData.divergence,
          pending_invoices_count: reconciliationData.pendingCount || 0,
          overdue_invoices_count: reconciliationData.overdueCount || 0,
          opening_balance_amount: reconciliationData.openingBalanceAmount || 0,
          status: "em_analise",
        })
        .select()
        .single();

      if (error) {
        console.warn("Não foi possível registrar auditoria:", error);
        return;
      }
      
      if (newRecord) {
        setCurrentAuditId(newRecord.id);
        toast({
          title: "Análise registrada",
          description: "A divergência foi registrada no log de auditoria.",
        });
      }
    } catch (error) {
      console.error("Erro ao registrar análise:", error);
    }
  }, [selectedMonth, toast]);

  // Atualizar status da divergência
  const updateDivergenceStatus = async () => {
    if (!currentAuditId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("divergence_audit_log")
        .update({
          status: selectedStatus,
          notes: auditNotes || null,
          resolution_notes: selectedStatus === "resolvido" ? auditNotes : null,
          resolved_at: selectedStatus === "resolvido" ? new Date().toISOString() : null,
        })
        .eq("id", currentAuditId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Divergência marcada como "${STATUS_CONFIG[selectedStatus]?.label || selectedStatus}".`,
      });

      // Recarregar histórico
      fetchAuditHistory();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status da divergência.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Buscar dados detalhados para reconciliação
  const fetchReconciliationData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");

      // 1. Buscar faturas pendentes/atrasadas
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select(`
          id,
          client_id,
          amount,
          competence,
          status,
          clients (id, name)
        `)
        .in("status", ["pending", "overdue"])
        .order("amount", { ascending: false })
        .limit(50);

      if (invoicesError) throw invoicesError;

      // Contar por status
      const pendingCount = (invoicesData || []).filter(i => i.status === "pending").length;
      const overdueCount = (invoicesData || []).filter(i => i.status === "overdue").length;

      // 2. Buscar lançamentos na conta 1.1.2.x do período
      const { data: entriesData, error: entriesError } = await supabase
        .from("accounting_entries")
        .select(`
          id,
          entry_date,
          description,
          internal_code,
          accounting_entry_items (
            debit,
            credit,
            account_id,
            chart_of_accounts (code)
          )
        `)
        .gte("entry_date", `${year}-${month}-01`)
        .lte("entry_date", `${year}-${month}-31`)
        .order("entry_date", { ascending: false })
        .limit(100);

      if (entriesError) throw entriesError;

      // 3. Filtrar lançamentos que afetam 1.1.2.x
      type EntryLine = { debit?: number; credit?: number; chart_of_accounts?: { code?: string } };
      type EntryData = { 
        id: string; 
        entry_date: string; 
        description: string; 
        internal_code: string;
        accounting_entry_items?: EntryLine[];
      };

      const receivableEntries = (entriesData || []).filter((entry: EntryData) => 
        entry.accounting_entry_items?.some((line: EntryLine) => 
          line.chart_of_accounts?.code?.startsWith("1.1.2")
        )
      ).map((entry: EntryData) => ({
        id: entry.id,
        entry_date: entry.entry_date,
        description: entry.description,
        internal_code: entry.internal_code,
        total_debit: entry.accounting_entry_items?.reduce((sum: number, l: EntryLine) => 
          l.chart_of_accounts?.code?.startsWith("1.1.2") ? sum + (l.debit || 0) : sum, 0) || 0,
        total_credit: entry.accounting_entry_items?.reduce((sum: number, l: EntryLine) => 
          l.chart_of_accounts?.code?.startsWith("1.1.2") ? sum + (l.credit || 0) : sum, 0) || 0,
      }));

      // 4. Buscar saldo de abertura pendente
      const { data: openingData } = await supabase
        .from("client_opening_balance")
        .select("amount, paid_amount")
        .in("status", ["pending", "partial"]);

      const openingBalanceAmount = (openingData || []).reduce(
        (sum, ob) => sum + (Number(ob.amount || 0) - Number(ob.paid_amount || 0)),
        0
      );

      // Montar dados de reconciliação
      const reconciliationData: ReconciliationData = {
        operationalTotal,
        accountingTotal,
        divergence,
        invoicesWithoutEntry: invoicesData || [],
        entriesWithoutInvoice: receivableEntries,
        openingBalanceAmount,
        invoicesCount: invoicesData?.length || 0,
        entriesCount: receivableEntries.length,
        pendingCount,
        overdueCount,
      };

      setData(reconciliationData);

      // Gerar sugestões do Dr. Cícero
      generateDrCiceroSuggestions(reconciliationData);

      // Registrar análise no log de auditoria
      if (divergence > 0.01) {
        await registerDivergenceAnalysis(reconciliationData);
      }

    } catch (error) {
      console.error("Erro ao buscar dados de reconciliação:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, operationalTotal, accountingTotal, divergence, registerDivergenceAnalysis]);

  // Gerar sugestões do Dr. Cícero
  const generateDrCiceroSuggestions = (data: ReconciliationData) => {
    const newSuggestions: DrCiceroSuggestion[] = [];

    if (data.divergence > 0) {
      if (data.openingBalanceAmount > 0) {
        newSuggestions.push({
          type: "info",
          title: "Saldo de Abertura Identificado",
          description: `Existe ${formatCurrency(data.openingBalanceAmount)} em saldo de abertura (competências anteriores a Jan/2025). Este valor pode explicar parte da divergência se não foi migrado para a contabilidade.`,
        });
      }

      if (data.operationalTotal > data.accountingTotal) {
        const diff = data.operationalTotal - data.accountingTotal;
        newSuggestions.push({
          type: "warning",
          title: "Visão Operacional Maior que Contábil",
          description: `A visão de faturas está ${formatCurrency(diff)} acima do saldo contábil. Possível causa: faturas registradas sem o respectivo lançamento de provisão na conta 1.1.2.01.`,
        });

        newSuggestions.push({
          type: "action",
          title: "Recomendação de Ajuste",
          description: "Verificar se as faturas pendentes/atrasadas possuem lançamento contábil de provisão correspondente. Caso não, considerar criar lançamentos de reconhecimento de receita.",
        });
      } else {
        const diff = data.accountingTotal - data.operationalTotal;
        newSuggestions.push({
          type: "warning",
          title: "Visão Contábil Maior que Operacional",
          description: `O saldo contábil está ${formatCurrency(diff)} acima das faturas. Possível causa: lançamentos manuais, ajustes ou provisões sem fatura correspondente.`,
        });
      }
    }

    if (data.invoicesCount > 20) {
      newSuggestions.push({
        type: "info",
        title: "Alto Volume de Pendências",
        description: `Existem ${data.invoicesCount} faturas pendentes/atrasadas. Recomendo priorizar a cobrança dos maiores valores.`,
      });
    }

    newSuggestions.push({
      type: "info",
      title: "Regra de Governança",
      description: "Lembre-se: a conta 1.1.2.01 (Clientes a Receber) é a fonte oficial para fins fiscais e auditoria. A visão de faturas serve para gestão operacional de cobrança.",
    });

    setSuggestions(newSuggestions);
  };

  // Carregar dados quando abrir
  useEffect(() => {
    if (open) {
      fetchReconciliationData();
      fetchAuditHistory();
    }
  }, [open, fetchReconciliationData, fetchAuditHistory]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-600" />
            Reconciliação Honorários × Contabilidade
          </SheetTitle>
          <SheetDescription>
            Análise detalhada de divergências • Ref: {selectedMonth}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            {/* Resumo da Divergência */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Operacional (Faturas)
                    </div>
                    <p className="text-xl font-bold text-blue-700">
                      {formatCurrency(operationalTotal)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BookOpen className="h-4 w-4 text-green-600" />
                      Contábil (1.1.2.01)
                      <Badge className="bg-green-100 text-green-700 text-[10px]">OFICIAL</Badge>
                    </div>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(accountingTotal)}
                    </p>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-800">
                    Divergência Total
                  </span>
                  <span className="text-lg font-bold text-amber-700">
                    {formatCurrency(divergence)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Status e Notas de Auditoria */}
            {divergence > 0.01 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-slate-600" />
                    Registro de Auditoria
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">Status</label>
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <config.icon className="h-3 w-3" />
                                {config.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        size="sm" 
                        onClick={updateDivergenceStatus}
                        disabled={isSaving || !currentAuditId}
                        className="w-full"
                      >
                        {isSaving ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">
                      Notas / Justificativa
                    </label>
                    <Textarea
                      placeholder="Descreva a causa da divergência ou ações tomadas..."
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      className="h-20 text-sm resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dr. Cícero - Auditor */}
            <Card className="border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">Dr. Cícero — Auditor</CardTitle>
                    <p className="text-xs text-slate-400">Análise de Divergência</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-slate-400">Online</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-slate-400">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analisando dados...</span>
                  </div>
                ) : (
                  suggestions.map((suggestion, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "p-3 rounded-lg",
                        suggestion.type === "warning" && "bg-amber-900/30 border border-amber-700/50",
                        suggestion.type === "info" && "bg-slate-700/50 border border-slate-600/50",
                        suggestion.type === "action" && "bg-blue-900/30 border border-blue-700/50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {suggestion.type === "warning" && (
                          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                        )}
                        {suggestion.type === "info" && (
                          <Lightbulb className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        )}
                        {suggestion.type === "action" && (
                          <ClipboardList className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                        )}
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">
                            {suggestion.title}
                          </p>
                          <p className="text-xs text-slate-300">
                            {suggestion.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Histórico de Análises */}
            {auditHistory.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="history" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-slate-600" />
                      <span>Histórico de Análises</span>
                      <Badge variant="secondary" className="ml-2">
                        {auditHistory.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {auditHistory.map((record) => {
                        const statusConfig = STATUS_CONFIG[record.status];
                        return (
                          <div 
                            key={record.id}
                            className="p-3 bg-gray-50 rounded-lg border text-sm"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500">
                                {formatDateTime(record.analyzed_at)}
                              </span>
                              <Badge className={cn("text-[10px]", statusConfig?.color)}>
                                {statusConfig?.label || record.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Operacional:</span>
                                <p className="font-medium">{formatCurrency(record.operational_total)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Contábil:</span>
                                <p className="font-medium">{formatCurrency(record.accounting_total)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Divergência:</span>
                                <p className="font-medium text-amber-700">{formatCurrency(record.divergence_amount)}</p>
                              </div>
                            </div>
                            {record.notes && (
                              <p className="text-xs text-gray-600 mt-2 italic">
                                "{record.notes}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Detalhamento */}
            {data && (
              <Accordion type="single" collapsible className="space-y-2">
                {/* Faturas Pendentes/Atrasadas */}
                <AccordionItem value="invoices" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-yellow-600" />
                      <span>Faturas Pendentes/Atrasadas</span>
                      <Badge variant="secondary" className="ml-2">
                        {data.invoicesCount}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {data.invoicesWithoutEntry.length > 0 ? (
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Cliente</TableHead>
                              <TableHead className="text-xs">Competência</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.invoicesWithoutEntry.slice(0, 10).map((invoice) => (
                              <TableRow key={invoice.id}>
                                <TableCell className="text-xs font-medium">
                                  {invoice.clients?.name || "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {invoice.competence}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[10px]",
                                      invoice.status === "overdue" && "border-red-300 text-red-700",
                                      invoice.status === "pending" && "border-yellow-300 text-yellow-700"
                                    )}
                                  >
                                    {invoice.status === "overdue" ? "Atrasada" : "Pendente"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono">
                                  {formatCurrency(invoice.amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {data.invoicesWithoutEntry.length > 10 && (
                          <div className="p-2 bg-gray-50 text-center">
                            <span className="text-xs text-gray-500">
                              +{data.invoicesWithoutEntry.length - 10} faturas adicionais
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        Nenhuma fatura pendente/atrasada encontrada.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Lançamentos Contábeis */}
                <AccordionItem value="entries" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-green-600" />
                      <span>Lançamentos Conta 1.1.2.x</span>
                      <Badge variant="secondary" className="ml-2">
                        {data.entriesCount}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {data.entriesWithoutInvoice.length > 0 ? (
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Data</TableHead>
                              <TableHead className="text-xs">Descrição</TableHead>
                              <TableHead className="text-xs text-right">Débito</TableHead>
                              <TableHead className="text-xs text-right">Crédito</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.entriesWithoutInvoice.slice(0, 10).map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell className="text-xs">
                                  {new Date(entry.entry_date).toLocaleDateString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">
                                  {entry.description}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono text-blue-600">
                                  {entry.total_debit > 0 ? formatCurrency(entry.total_debit) : "—"}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono text-red-600">
                                  {entry.total_credit > 0 ? formatCurrency(entry.total_credit) : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {data.entriesWithoutInvoice.length > 10 && (
                          <div className="p-2 bg-gray-50 text-center">
                            <span className="text-xs text-gray-500">
                              +{data.entriesWithoutInvoice.length - 10} lançamentos adicionais
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        Nenhum lançamento encontrado no período.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Saldo de Abertura */}
                {data.openingBalanceAmount > 0 && (
                  <AccordionItem value="opening" className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <FileQuestion className="h-4 w-4 text-purple-600" />
                        <span>Saldo de Abertura Pendente</span>
                        <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">
                          {formatCurrency(data.openingBalanceAmount)}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-800">
                          <strong>Atenção:</strong> Existe {formatCurrency(data.openingBalanceAmount)} em 
                          saldo de abertura (competências anteriores a Janeiro/2025) que está pendente 
                          de recebimento.
                        </p>
                        <p className="text-xs text-purple-600 mt-2">
                          Este valor foi importado como histórico e pode não estar refletido 
                          na conta contábil 1.1.2.01 se não houve migração de saldos.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            )}

            {/* Ações */}
            <div className="flex items-center justify-between pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileDown className="mr-2 h-4 w-4" />
                      Gerar PDF
                    </>
                  )}
                </Button>
                <Button 
                  onClick={fetchReconciliationData}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Atualizar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
