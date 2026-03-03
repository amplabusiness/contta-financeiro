/**
 * FLUXOGRAMA DE FECHAMENTO MENSAL — AMPLA CONTABILIDADE
 *
 * Visão completa do processo de fechamento mês a mês:
 * - Timeline de Jan/2025 até o mês atual
 * - 9 etapas do checklist (conforme .claude/fechamento/)
 * - Pipeline AI-First: Context Builder → Dr. Cícero → Aprovação → Trava
 * - Status em tempo real do banco de dados
 */

import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Lock, Unlock,
  ChevronRight, ChevronDown, Bot, Database, ShieldCheck,
  ArrowRight, TrendingUp, FileText, Building2, Banknote,
  BarChart3, Receipt, BookOpen, AlertCircle, Loader2,
  Calendar, ChevronsRight, Info
} from "lucide-react";
import { format, startOfMonth, addMonths, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/data/expensesData";

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────
type MonthStatus = "closed" | "in_progress" | "pending" | "future";

interface MonthData {
  date: Date;
  label: string;
  shortLabel: string;
  status: MonthStatus;
  totalTransactions: number;
  conciliadas: number;
  pendentes: number;
  entradas: number;
  saidas: number;
  entries: number;
  isClosed: boolean;
  isCurrentWorking: boolean;
}

interface ChecklistStep {
  id: number;
  etapa: string;
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  status: "done" | "blocked" | "pending" | "ai";
  detail?: string;
  route?: string;
  count?: number;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
const TENANT_ID = "bd437228-6413-45ac-974b-9833eb25b007";
const START_MONTH = new Date(2025, 1, 1); // Fevereiro/2025 (Jan já fechado)
const JAN_2025_CLOSED = true;

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function FechamentoMensal() {
  const navigate = useNavigate();
  const [months, setMonths] = useState<MonthData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // ─────────────────────────────────────────────────────────────
  // CARREGAR MESES (Jan/2025 → Mês atual)
  // ─────────────────────────────────────────────────────────────
  const loadMonths = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const currentMonth = startOfMonth(today);

      // Buscar transações por mês
      const { data: txData } = await supabase
        .from("bank_transactions")
        .select("transaction_date, amount, matched")
        .gte("transaction_date", "2025-01-01")
        .lte("transaction_date", format(today, "yyyy-MM-dd"));

      // Buscar lançamentos contábeis por mês
      const { data: entryData } = await supabase
        .from("accounting_entries")
        .select("entry_date, competence_date")
        .gte("entry_date", "2025-01-01")
        .lte("entry_date", format(today, "yyyy-MM-dd"));

      // Buscar fechamentos
      const { data: closingsData } = await supabase
        .from("monthly_closings")
        .select("reference_month, status")
        .gte("reference_month", "2025-01-01");

      const closingsMap = new Map(
        (closingsData || []).map((c) => [
          format(new Date(c.reference_month), "yyyy-MM"),
          c.status,
        ])
      );

      // Adicionar Jan/2025 como fechado fixo
      closingsMap.set("2025-01", "closed");

      // Gerar lista de meses: Jan/2025 → mês atual
      const monthList: MonthData[] = [];
      let cur = new Date(2025, 0, 1); // Jan/2025
      while (!isAfter(cur, currentMonth)) {
        const key = format(cur, "yyyy-MM");
        const monthStart = format(cur, "yyyy-MM-01");
        const monthEnd = format(new Date(cur.getFullYear(), cur.getMonth() + 1, 0), "yyyy-MM-dd");

        const txMonth = (txData || []).filter(
          (t) => t.transaction_date >= monthStart && t.transaction_date <= monthEnd
        );
        const entriesMonth = (entryData || []).filter(
          (e) => (e.competence_date || e.entry_date) >= monthStart &&
                 (e.competence_date || e.entry_date) <= monthEnd
        );

        const conciliadas = txMonth.filter((t) => t.matched).length;
        const entradas = txMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const saidas = txMonth.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

        const closingStatus = closingsMap.get(key);
        const isClosed = closingStatus === "closed" || closingStatus === "CLOSED";
        const isCurrentWorking = key === format(currentMonth, "yyyy-MM") || (!isClosed && key === format(addMonths(cur, -1), "yyyy-MM"));

        let status: MonthStatus = "pending";
        if (isClosed) status = "closed";
        else if (txMonth.length > 0) status = "in_progress";
        else if (isAfter(cur, currentMonth)) status = "future";

        monthList.push({
          date: new Date(cur),
          label: format(cur, "MMMM/yyyy", { locale: ptBR }),
          shortLabel: format(cur, "MMM/yy", { locale: ptBR }),
          status,
          totalTransactions: txMonth.length,
          conciliadas,
          pendentes: txMonth.length - conciliadas,
          entradas,
          saidas,
          entries: entriesMonth.length,
          isClosed,
          isCurrentWorking: false,
        });

        cur = addMonths(cur, 1);
      }

      // Marcar o primeiro mês aberto como "em processamento"
      const firstOpen = monthList.find((m) => !m.isClosed);
      if (firstOpen) firstOpen.isCurrentWorking = true;

      setMonths(monthList);

      // Selecionar automaticamente o primeiro mês aberto
      const toSelect = firstOpen || monthList[monthList.length - 1];
      setSelectedMonth(toSelect);
    } catch (err) {
      console.error("Erro ao carregar meses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // CARREGAR CHECKLIST PARA O MÊS SELECIONADO
  // ─────────────────────────────────────────────────────────────
  const loadChecklist = useCallback(async (month: MonthData) => {
    if (!month) return;
    setChecklistLoading(true);
    try {
      const monthStart = format(month.date, "yyyy-MM-01");
      const monthEnd = format(
        new Date(month.date.getFullYear(), month.date.getMonth() + 1, 0),
        "yyyy-MM-dd"
      );

      // E1: Integridade
      const { count: orphanCount } = await supabase
        .from("accounting_entries")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", TENANT_ID)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd);

      // E2: Conciliação
      const { data: txMonth } = await supabase
        .from("bank_transactions")
        .select("id, matched, amount, description")
        .gte("transaction_date", monthStart)
        .lte("transaction_date", monthEnd);

      const totalTx = txMonth?.length || 0;
      const conciliadasTx = txMonth?.filter((t) => t.matched).length || 0;
      const pendentesTx = totalTx - conciliadasTx;

      // E3: Honorários gerados
      const { count: invoiceCount } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .or(`competence.like.${format(month.date, "MM/yyyy")},competence.eq.${format(month.date, "yyyy-MM")}`);

      // E6: Status de fechamento
      const { data: closingData } = await supabase
        .from("accounting_closures")
        .select("*")
        .eq("tenant_id", TENANT_ID)
        .eq("year", month.date.getFullYear())
        .eq("month", month.date.getMonth() + 1)
        .single();

      const steps: ChecklistStep[] = [
        {
          id: 1,
          etapa: "Etapa 1",
          titulo: "Integridade do Sistema",
          descricao: "Verificar entries órfãos, linhas sem valor e lançamentos desbalanceados",
          icon: <Database className="h-5 w-5" />,
          status: month.isClosed ? "done" : orphanCount && orphanCount > 0 ? "blocked" : "done",
          detail: `${orphanCount || 0} lançamentos no período`,
        },
        {
          id: 2,
          etapa: "Etapa 2",
          titulo: "Conciliação Bancária",
          descricao: "Todas as transações bancárias importadas e conciliadas",
          icon: <Banknote className="h-5 w-5" />,
          status: month.isClosed ? "done" : pendentesTx === 0 && totalTx > 0 ? "done" : pendentesTx > 0 ? "blocked" : "pending",
          detail: `${conciliadasTx}/${totalTx} conciliadas`,
          count: pendentesTx,
          route: "/super-conciliation",
        },
        {
          id: 3,
          etapa: "Etapa 3",
          titulo: "Conta Transitória",
          descricao: "Saldo das contas transitórias (1.1.9.01 / 2.1.9.01) zerado",
          icon: <Receipt className="h-5 w-5" />,
          status: month.isClosed ? "done" : "pending",
          detail: "Verificar via Balancete",
          route: "/balancete",
        },
        {
          id: 4,
          etapa: "Etapa 4",
          titulo: "Honorários Gerados",
          descricao: "Faturas do mês emitidas para todos os clientes ativos",
          icon: <FileText className="h-5 w-5" />,
          status: month.isClosed ? "done" : invoiceCount && invoiceCount > 0 ? "done" : "blocked",
          detail: `${invoiceCount || 0} faturas geradas`,
          count: invoiceCount || 0,
          route: "/invoices",
        },
        {
          id: 5,
          etapa: "Etapa 5",
          titulo: "Classificação Contábil",
          descricao: "Todas receitas em 3.x, despesas em 4.x, adiantamentos em 1.1.3.xx",
          icon: <BarChart3 className="h-5 w-5" />,
          status: month.isClosed ? "done" : pendentesTx === 0 ? "done" : "pending",
          detail: "Verificar DRE e Balancete",
          route: "/dre",
        },
        {
          id: 6,
          etapa: "Etapa 6",
          titulo: "Análise de Coerência",
          descricao: "Receita contábil ≈ movimentação bancária. Sem duplicidades.",
          icon: <TrendingUp className="h-5 w-5" />,
          status: month.isClosed ? "done" : "pending",
          detail: "Análise visual do contador",
          route: "/executive-dashboard",
        },
        {
          id: 7,
          etapa: "Etapa 7",
          titulo: "Dr. Cícero — Parecer IA",
          descricao: "Context Builder coleta dados → Dr. Cícero analisa e emite APPROVE/INVALIDATE",
          icon: <Bot className="h-5 w-5" />,
          status: month.isClosed
            ? "done"
            : closingData?.dr_cicero_approved
            ? "done"
            : "ai",
          detail: closingData?.dr_cicero_approved
            ? "Aprovado pelo Dr. Cícero"
            : "Aguardando análise IA",
          route: "/ai-accountant",
        },
        {
          id: 8,
          etapa: "Etapa 8",
          titulo: "Preparação Fiscal",
          descricao: "Base pronta para DAS/Simples, IRPJ, PIS/COFINS, ISS",
          icon: <Building2 className="h-5 w-5" />,
          status: month.isClosed ? "done" : "pending",
          detail: "Receita validada para apuração",
        },
        {
          id: 9,
          etapa: "Etapa 9",
          titulo: "Fechar e Bloquear",
          descricao: "Registrar fechamento em accounting_closures + monthly_closings. Bloquear alterações.",
          icon: <Lock className="h-5 w-5" />,
          status: month.isClosed
            ? "done"
            : closingData?.status === "CLOSED"
            ? "done"
            : "pending",
          detail: month.isClosed
            ? `Fechado em ${month.date.toLocaleDateString("pt-BR")}`
            : "Pendente",
          route: "/super-conciliation",
        },
      ];

      setChecklist(steps);
    } catch (err) {
      console.error("Erro ao carregar checklist:", err);
    } finally {
      setChecklistLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonths();
  }, [loadMonths]);

  useEffect(() => {
    if (selectedMonth) loadChecklist(selectedMonth);
  }, [selectedMonth, loadChecklist]);

  // ─────────────────────────────────────────────────────────────
  // CALCULAR PROGRESSO
  // ─────────────────────────────────────────────────────────────
  const checklistProgress = checklist.length
    ? Math.round((checklist.filter((s) => s.status === "done").length / checklist.length) * 100)
    : 0;

  const closedCount = months.filter((m) => m.isClosed).length;
  const totalMonths = months.length;

  // ─────────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando fluxo de fechamento...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        {/* ── HEADER ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-7 w-7 text-primary" />
              Fechamento Mensal 2025
            </h1>
            <p className="text-muted-foreground mt-1">
              Fluxo AI-First · Dr. Cícero · 9 Etapas · Fev/2025 → Mar/2026
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-sm px-3 py-1">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {closedCount}/{totalMonths} fechados
            </Badge>
            <Button size="sm" variant="outline" onClick={loadMonths}>
              <Loader2 className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* ── PROGRESSO GERAL ── */}
        <Card className="border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Progresso geral 2025</span>
                  <span className="text-muted-foreground">{closedCount} de {totalMonths} meses fechados</span>
                </div>
                <Progress value={(closedCount / totalMonths) * 100} className="h-3" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {Math.round((closedCount / totalMonths) * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">concluído</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── TIMELINE DE MESES ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ChevronsRight className="h-5 w-5 text-primary" />
              Pipeline de Fechamento — Selecione um mês para ver o fluxo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {months.map((m) => (
                <MonthPill
                  key={format(m.date, "yyyy-MM")}
                  month={m}
                  isSelected={
                    selectedMonth
                      ? format(selectedMonth.date, "yyyy-MM") === format(m.date, "yyyy-MM")
                      : false
                  }
                  onClick={() => setSelectedMonth(m)}
                />
              ))}
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                Fechado
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                Em processo
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-slate-300" />
                Pendente
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border-2 border-primary bg-primary/10" />
                Selecionado
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── FLUXO DO MÊS SELECIONADO ── */}
        {selectedMonth && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna esquerda: Info do mês */}
            <div className="space-y-4">
              <Card className={cn(
                "border-2",
                selectedMonth.isClosed ? "border-emerald-300 bg-emerald-50/30" : "border-amber-300 bg-amber-50/30"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base capitalize">
                      {selectedMonth.label}
                    </CardTitle>
                    <StatusBadgeMonth status={selectedMonth.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MetricRow label="Transações bancárias" value={selectedMonth.totalTransactions} unit="" />
                  <MetricRow label="Conciliadas" value={selectedMonth.conciliadas} unit="" color="emerald" />
                  <MetricRow label="Pendentes" value={selectedMonth.pendentes} unit="" color={selectedMonth.pendentes > 0 ? "red" : "emerald"} />
                  <div className="pt-2 border-t space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entradas</span>
                      <span className="text-emerald-700 font-mono font-medium">
                        {formatCurrency(selectedMonth.entradas)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saídas</span>
                      <span className="text-red-600 font-mono font-medium">
                        {formatCurrency(selectedMonth.saidas)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-medium pt-1 border-t">
                      <span>Resultado caixa</span>
                      <span className={cn(
                        "font-mono",
                        selectedMonth.entradas - selectedMonth.saidas >= 0 ? "text-emerald-700" : "text-red-600"
                      )}>
                        {formatCurrency(selectedMonth.entradas - selectedMonth.saidas)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Lançamentos contábeis</span>
                    <span className="font-mono">{selectedMonth.entries}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Progresso do checklist */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Progresso do fechamento</span>
                    <span className="text-muted-foreground">{checklistProgress}%</span>
                  </div>
                  <Progress value={checklistProgress} className="h-2" />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-emerald-50 rounded p-2">
                      <div className="font-bold text-emerald-700">
                        {checklist.filter((s) => s.status === "done").length}
                      </div>
                      <div className="text-muted-foreground">Concluídas</div>
                    </div>
                    <div className="bg-amber-50 rounded p-2">
                      <div className="font-bold text-amber-700">
                        {checklist.filter((s) => s.status === "ai").length}
                      </div>
                      <div className="text-muted-foreground">Com IA</div>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <div className="font-bold text-red-700">
                        {checklist.filter((s) => s.status === "blocked").length}
                      </div>
                      <div className="text-muted-foreground">Bloqueadas</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ação rápida */}
              {!selectedMonth.isClosed && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium mb-3">Ações rápidas</p>
                    <div className="space-y-2">
                      <Button
                        className="w-full justify-start" size="sm" variant="outline"
                        onClick={() => navigate("/invoices")}
                      >
                        <FileText className="h-4 w-4 mr-2 text-primary" />
                        Gerar Honorários
                      </Button>
                      <Button
                        className="w-full justify-start" size="sm" variant="outline"
                        onClick={() => navigate("/super-conciliation")}
                      >
                        <Banknote className="h-4 w-4 mr-2 text-primary" />
                        Conciliar Extrato
                      </Button>
                      <Button
                        className="w-full justify-start" size="sm" variant="outline"
                        onClick={() => navigate("/ai-accountant")}
                      >
                        <Bot className="h-4 w-4 mr-2 text-primary" />
                        Consultar Dr. Cícero
                      </Button>
                      <Button
                        className="w-full justify-start" size="sm" variant="outline"
                        onClick={() => navigate("/dre")}
                      >
                        <BarChart3 className="h-4 w-4 mr-2 text-primary" />
                        Ver DRE
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Coluna direita: Fluxograma de 9 etapas */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Fluxo de Fechamento — {selectedMonth.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checklistLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {checklist.map((step, idx) => (
                        <ChecklistStepRow
                          key={step.id}
                          step={step}
                          isLast={idx === checklist.length - 1}
                          isExpanded={expandedStep === step.id}
                          onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                          onNavigate={step.route ? () => navigate(step.route!) : undefined}
                        />
                      ))}

                      {/* Footer: pipeline AI-First */}
                      <div className="mt-4 pt-4 border-t">
                        <AIPipelineFlow isClosed={selectedMonth.isClosed} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────

function MonthPill({ month, isSelected, onClick }: {
  month: MonthData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors: Record<MonthStatus, string> = {
    closed: "bg-emerald-100 border-emerald-400 text-emerald-800 hover:bg-emerald-200",
    in_progress: "bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200",
    pending: "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200",
    future: "bg-slate-50 border-slate-200 text-slate-400",
  };
  const icons: Record<MonthStatus, React.ReactNode> = {
    closed: <CheckCircle2 className="h-3 w-3" />,
    in_progress: <Clock className="h-3 w-3" />,
    pending: <AlertCircle className="h-3 w-3" />,
    future: <Clock className="h-3 w-3" />,
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 min-w-[72px] transition-all text-xs font-medium",
        colors[month.status],
        isSelected && "ring-2 ring-primary ring-offset-1 border-primary",
        month.isCurrentWorking && "animate-pulse",
      )}
    >
      <span className="flex items-center gap-1">
        {icons[month.status]}
        <span className="capitalize">{month.shortLabel}</span>
      </span>
      {month.status !== "future" && (
        <span className="text-[10px] opacity-70">
          {month.isClosed ? "fechado" : `${month.pendentes} pend.`}
        </span>
      )}
    </button>
  );
}

function StatusBadgeMonth({ status }: { status: MonthStatus }) {
  const config = {
    closed: { label: "Fechado", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    in_progress: { label: "Em processo", className: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" /> },
    pending: { label: "Pendente", className: "bg-slate-50 text-slate-600 border-slate-200", icon: <AlertCircle className="h-3 w-3" /> },
    future: { label: "Futuro", className: "bg-slate-50 text-slate-400 border-slate-200", icon: <Clock className="h-3 w-3" /> },
  }[status];

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function MetricRow({ label, value, unit, color }: {
  label: string; value: number; unit: string; color?: string;
}) {
  const textColor = color === "emerald" ? "text-emerald-700" : color === "red" ? "text-red-600" : "";
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-medium", textColor)}>
        {value}{unit}
      </span>
    </div>
  );
}

function ChecklistStepRow({ step, isLast, isExpanded, onToggle, onNavigate }: {
  step: ChecklistStep;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const statusConfig = {
    done: {
      bg: "bg-emerald-50 border-emerald-200",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />,
      badge: <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Concluído</Badge>,
    },
    blocked: {
      bg: "bg-red-50 border-red-200",
      icon: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />,
      badge: <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Bloqueado</Badge>,
    },
    pending: {
      bg: "bg-slate-50 border-slate-200",
      icon: <Clock className="h-5 w-5 text-slate-400 flex-shrink-0" />,
      badge: <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">Pendente</Badge>,
    },
    ai: {
      bg: "bg-blue-50 border-blue-200",
      icon: <Bot className="h-5 w-5 text-blue-600 flex-shrink-0 animate-pulse" />,
      badge: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1"><Bot className="h-3 w-3" />Dr. Cícero</Badge>,
    },
  };

  const cfg = statusConfig[step.status];

  return (
    <div className="relative">
      {/* Linha conectora */}
      {!isLast && (
        <div className="absolute left-6 top-full h-2 w-px bg-border z-10" />
      )}

      <div className={cn(
        "border rounded-lg transition-all",
        cfg.bg,
        step.status === "blocked" && "ring-1 ring-red-300"
      )}>
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 p-3 text-left"
        >
          {/* Número da etapa */}
          <div className={cn(
            "flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold flex-shrink-0",
            step.status === "done" ? "bg-emerald-600 text-white" :
            step.status === "blocked" ? "bg-red-500 text-white" :
            step.status === "ai" ? "bg-blue-600 text-white" :
            "bg-slate-200 text-slate-600"
          )}>
            {step.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : step.id}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{step.etapa}</span>
              <span className="font-medium text-sm">{step.titulo}</span>
              {cfg.badge}
              {step.count !== undefined && step.count > 0 && (
                <Badge className="bg-red-500 text-white text-xs h-4 px-1.5">{step.count}</Badge>
              )}
            </div>
            {step.detail && (
              <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
            )}
          </div>

          {/* Seta expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onNavigate && step.status !== "done" && (
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={(e) => { e.stopPropagation(); onNavigate(); }}
              >
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Detalhe expandido */}
        {isExpanded && (
          <div className="px-4 pb-3 border-t border-inherit">
            <p className="text-sm text-muted-foreground mt-2">{step.descricao}</p>
            {onNavigate && step.status !== "done" && (
              <Button
                size="sm" className="mt-2"
                onClick={onNavigate}
              >
                Ir para esta etapa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AIPipelineFlow({ isClosed }: { isClosed: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Pipeline AI-First (conforme .claude/fechamento/)
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        <PipelineNode
          icon={<Database className="h-4 w-4" />}
          label="Context Builder"
          sublabel="Coleta dados"
          done={isClosed}
          color="slate"
        />
        <ChevronsRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <PipelineNode
          icon={<Bot className="h-4 w-4" />}
          label="Dr. Cícero"
          sublabel="Analisa + Parecer"
          done={isClosed}
          color="blue"
          pulse={!isClosed}
        />
        <ChevronsRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <PipelineNode
          icon={<ShieldCheck className="h-4 w-4" />}
          label="APPROVE"
          sublabel="ou INVALIDATE"
          done={isClosed}
          color={isClosed ? "emerald" : "amber"}
        />
        <ChevronsRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <PipelineNode
          icon={<Lock className="h-4 w-4" />}
          label="Fechar Mês"
          sublabel="Bloquear edição"
          done={isClosed}
          color={isClosed ? "emerald" : "slate"}
        />
      </div>
    </div>
  );
}

function PipelineNode({ icon, label, sublabel, done, color, pulse }: {
  icon: React.ReactNode; label: string; sublabel: string;
  done: boolean; color: string; pulse?: boolean;
}) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 border-slate-300 text-slate-700",
    blue: "bg-blue-100 border-blue-300 text-blue-700",
    emerald: "bg-emerald-100 border-emerald-400 text-emerald-800",
    amber: "bg-amber-100 border-amber-300 text-amber-700",
  };

  return (
    <div className={cn(
      "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs min-w-[80px] text-center",
      done ? "bg-emerald-100 border-emerald-400 text-emerald-800" : colors[color],
      pulse && "animate-pulse"
    )}>
      <div className="flex items-center gap-1">
        {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : icon}
      </div>
      <div className="font-semibold">{label}</div>
      <div className="text-[10px] opacity-70">{sublabel}</div>
    </div>
  );
}
