import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Clock,
  Info,
  ArrowRight,
  FileSpreadsheet,
  Database,
  Building2,
  CreditCard,
  Banknote,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isToday, isSameMonth, getDate, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  date: number;
  type: "boleto_due" | "expense_due" | "boleto_generation" | "payroll" | "tax";
  title: string;
  value?: number;
  count?: number;
  color: string;
}

interface UpcomingItem {
  date: string;
  description: string;
  value: number;
  type: "receita" | "despesa";
  status: string;
}

interface CashFlowSummary {
  saldoAtual: number;
  receitasPrevistas: number;
  despesasPrevistas: number;
  saldoProjetado: number;
  inadimplentes: number;
}

const UPLOAD_GUIDE = [
  {
    icon: <Banknote className="w-5 h-5 text-blue-500" />,
    title: "Extrato Bancário (OFX)",
    description: "Extrato mensal do Sicredi em formato OFX",
    frequency: "Mensal (início do mês seguinte)",
    route: "/bank-import",
    buttonLabel: "Importar Extrato",
    tip: "Baixe do Internet Banking Sicredi → Extratos → Exportar OFX",
    color: "blue",
  },
  {
    icon: <Receipt className="w-5 h-5 text-green-500" />,
    title: "Relatório de Títulos (XLS)",
    description: "Relatório de boletos liquidados do Sicredi",
    frequency: "Mensal (após fechamento)",
    route: "/import-boleto-report",
    buttonLabel: "Importar Títulos",
    tip: "Sicredi → Cobrança → Relatório de Títulos → Exportar XLS",
    color: "green",
  },
  {
    icon: <FileSpreadsheet className="w-5 h-5 text-purple-500" />,
    title: "Baixa de Boletos (CSV)",
    description: "Lista de boletos liquidados por dia",
    frequency: "Quando necessário (para conciliação)",
    route: "/import-boletos-liquidados",
    buttonLabel: "Importar Baixas",
    tip: "Sicredi → Cobrança → Boletos Liquidados → Exportar por período",
    color: "purple",
  },
  {
    icon: <FileText className="w-5 h-5 text-orange-500" />,
    title: "PDF de Honorários",
    description: "Relatório de honorários a receber",
    frequency: "Mensal (início do mês)",
    route: "/import-boleto-report",
    buttonLabel: "Importar PDF",
    tip: "Sistema contábil → Relatórios → Contas a Receber → Exportar PDF",
    color: "orange",
  },
  {
    icon: <FileSpreadsheet className="w-5 h-5 text-red-500" />,
    title: "Planilha de Despesas",
    description: "Despesas mensais em formato Excel",
    frequency: "Mensal",
    route: "/import-expenses-spreadsheet",
    buttonLabel: "Importar Planilha",
    tip: "Use o modelo padrão: banco/Controle Despesas-1.xlsx",
    color: "red",
  },
  {
    icon: <Database className="w-5 h-5 text-gray-500" />,
    title: "Folha de Pagamento",
    description: "Eventos da folha mensal",
    frequency: "Mensal (após processamento)",
    route: "/payroll",
    buttonLabel: "Abrir Folha",
    tip: "Adicione eventos manuais de bônus, comissões e descontos",
    color: "gray",
  },
];

// Recurring monthly events
const RECURRING_EVENTS: { day: number; title: string; type: CalendarEvent["type"]; color: string }[] = [
  { day:  1, title: "IPTU 2022 (~R$683)",              type: "expense_due",      color: "bg-purple-100 border-purple-400" },
  { day:  5, title: "Faculdade Medicina (~R$12.523)",   type: "expense_due",      color: "bg-purple-100 border-purple-400" },
  { day:  5, title: "Vencimento Boletos (lote 1)",      type: "boleto_due",       color: "bg-green-100 border-green-400" },
  { day: 10, title: "MEI/Terceiros (~R$29.665)",        type: "expense_due",      color: "bg-orange-100 border-orange-400" },
  { day: 10, title: "Vencimento Boletos (lote 2)",      type: "boleto_due",       color: "bg-green-100 border-green-400" },
  { day: 15, title: "IPTU 2018 (~R$3.480)",             type: "expense_due",      color: "bg-purple-100 border-purple-400" },
  { day: 15, title: "Folha 1ª Parcela (40%)",           type: "payroll",          color: "bg-blue-100 border-blue-400" },
  { day: 15, title: "Vencimento Boletos (lote 3)",      type: "boleto_due",       color: "bg-green-100 border-green-400" },
  { day: 20, title: "Vencimento Boletos (lote 4)",      type: "boleto_due",       color: "bg-green-100 border-green-400" },
  { day: 20, title: "GPS/INSS",                         type: "tax",              color: "bg-red-100 border-red-400" },
  { day: 25, title: "Geração Boletos mês seguinte",     type: "boleto_generation",color: "bg-yellow-100 border-yellow-400" },
  { day: 25, title: "Vencimento Boletos (lote 5)",      type: "boleto_due",       color: "bg-green-100 border-green-400" },
  { day: 30, title: "Folha 2ª Parcela (60%)",           type: "payroll",          color: "bg-blue-100 border-blue-400" },
  { day: 30, title: "Vencimento Boletos (lote 6)",      type: "boleto_due",       color: "bg-green-100 border-green-400" },
];

interface DespesaRecorrente {
  dia: number;
  descricao: string;
  beneficiario: string;
  valor: number;
  tipo: "mei_pj" | "parcelamento";
  parcelas_restantes?: number;
  categoria: string;
  // Chave PIX para pagamento automático via Cora
  pix_key?: string;
  pix_key_type?: "cpf" | "cnpj" | "email" | "phone" | "evp";
}

const DESPESAS_RECORRENTES: DespesaRecorrente[] = [
  // Dia 10 — MEI / Prestadores PJ (pagamento todo dia 10)
  // Preencha pix_key com o CPF/CNPJ/e-mail de cada prestador para habilitar o pagamento via Cora
  { dia: 10, descricao: "Daniel Rodrigues — Fiscal PJ",         beneficiario: "Daniel Rodrigues",           valor: 10500.00, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  { dia: 10, descricao: "Rose Mara — Depto Pessoal PJ",         beneficiario: "Rose Mara",                  valor:  6677.55, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  { dia: 10, descricao: "Sueli Amaral — Depto Pessoal PJ",      beneficiario: "Danielle Rodrigues (Sueli)", valor:  3668.77, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  { dia: 10, descricao: "Alexssandra Ramos — Depto Pessoal PJ", beneficiario: "Alexssandra Ramos",          valor:  2733.39, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  { dia: 10, descricao: "Tatiana — Depto Pessoal PJ",           beneficiario: "Tatiana",                    valor:  1829.79, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  { dia: 10, descricao: "Andrea Ferreira — Administrativo PJ",  beneficiario: "Andrea Ferreira",            valor:  1518.00, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  { dia: 10, descricao: "Aline — Depto Pessoal PJ",             beneficiario: "Aline",                      valor:  1438.23, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  { dia: 10, descricao: "Taylane — Financeiro PJ",              beneficiario: "Taylane",                    valor:  1300.00, tipo: "mei_pj", categoria: "Serviços Terceirizados", pix_key: "", pix_key_type: "cpf" },
  // Parcelamentos mensais (pagamento via débito automático/boleto — sem PIX key)
  { dia:  1, descricao: "IPTU 2022 — Parcela mensal",           beneficiario: "PMGO - Prefeitura de Goiânia",    valor:   683.00, tipo: "parcelamento", parcelas_restantes: 32, categoria: "IPTU" },
  { dia:  5, descricao: "Faculdade de Medicina 2026 — Parcela", beneficiario: "Faculdade de Medicina Itumbiara", valor: 12523.19, tipo: "parcelamento", parcelas_restantes: 11, categoria: "Educação" },
  { dia: 15, descricao: "IPTU 2018 — Parcela mensal",           beneficiario: "PMGO - Prefeitura de Goiânia",    valor:  3480.00, tipo: "parcelamento", parcelas_restantes: 16, categoria: "IPTU" },
];

export default function Agenda() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisionando, setProvisionando] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ criadas: number; total: number } | null>(null);
  const [coraBalance, setCoraBalance] = useState<number | null>(null);
  const [coraBalanceLoading, setCoraBalanceLoading] = useState(false);
  const [pixKeys, setPixKeys] = useState<Record<string, string>>(() =>
    Object.fromEntries(DESPESAS_RECORRENTES.filter(d => d.tipo === "mei_pj").map(d => [d.beneficiario, d.pix_key || ""]))
  );
  const [pagandoIdx, setPagandoIdx] = useState<number | null>(null);
  const [paymentResults, setPaymentResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  useEffect(() => {
    loadFinancialData();
  }, [currentMonth]);

  async function loadFinancialData() {
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      // Load bank balance
      const { data: bankAccounts } = await supabase
        .from("bank_accounts")
        .select("current_balance, name")
        .limit(1);

      const saldoAtual = bankAccounts?.reduce((s, a) => s + (Number(a.current_balance) || 0), 0) || 0;

      // Load upcoming invoices (receivables)
      const { data: invoices } = await supabase
        .from("invoices")
        .select("due_date, amount, status, description")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .order("due_date");

      const pendingInvoices = invoices?.filter(i => i.status !== "paid") || [];
      const receitasPrevistas = pendingInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);

      // Load upcoming expenses
      const { data: expenses } = await supabase
        .from("accounts_payable")
        .select("due_date, amount, description, status")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .neq("status", "paid")
        .order("due_date");

      const despesasPrevistas = expenses?.reduce((s, e) => s + (Number(e.amount) || 0), 0) || 0;

      // Upcoming items list
      const items: UpcomingItem[] = [
        ...(pendingInvoices?.slice(0, 10).map(i => ({
          date: i.due_date,
          description: i.description || "Honorário",
          value: Number(i.amount) || 0,
          type: "receita" as const,
          status: i.status,
        })) || []),
        ...(expenses?.slice(0, 10).map(e => ({
          date: e.due_date,
          description: e.description || "Despesa",
          value: Number(e.amount) || 0,
          type: "despesa" as const,
          status: e.status,
        })) || []),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);

      setUpcomingItems(items);
      setCashFlow({
        saldoAtual,
        receitasPrevistas,
        despesasPrevistas,
        saldoProjetado: saldoAtual + receitasPrevistas - despesasPrevistas,
        inadimplentes: 0,
      });
    } catch (e) {
      console.error("Error loading financial data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function provisionarMes() {
    setProvisionando(true);
    setProvisionResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      let criadas = 0;
      let total = 0;

      for (const despesa of DESPESAS_RECORRENTES) {
        const dueDate = format(new Date(year, month, despesa.dia), "yyyy-MM-dd");
        // Check if already exists this month
        const { data: existing } = await supabase
          .from("accounts_payable")
          .select("id")
          .eq("description", despesa.descricao)
          .gte("due_date", monthStart)
          .lte("due_date", monthEnd)
          .limit(1);

        if (!existing || existing.length === 0) {
          const { error } = await supabase.from("accounts_payable").insert({
            description: despesa.descricao,
            amount: despesa.valor,
            due_date: dueDate,
            status: "pending",
            created_by: user?.id,
          });
          if (!error) {
            criadas++;
            total += despesa.valor;
          }
        }
      }

      setProvisionResult({ criadas, total });
      if (criadas > 0) await loadFinancialData();
    } catch (e) {
      console.error("Erro ao provisionar:", e);
    } finally {
      setProvisionando(false);
    }
  }

  async function fetchCoraBalance() {
    setCoraBalanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cora-banking-service", {
        body: { action: "get_balance" },
      });
      if (error) throw error;
      const bal = data?.data?.available ?? data?.data?.balance ?? data?.data?.amount;
      setCoraBalance(bal != null ? Number(bal) / 100 : null);
    } catch (e) {
      console.error("Cora balance error:", e);
      setCoraBalance(null);
    } finally {
      setCoraBalanceLoading(false);
    }
  }

  async function pagarViaCora(despesa: DespesaRecorrente, idx: number) {
    const pixKey = pixKeys[despesa.beneficiario]?.trim();
    if (!pixKey) return;
    setPagandoIdx(idx);
    try {
      const dueDate = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), despesa.dia), "yyyy-MM-dd");
      const { data, error } = await supabase.functions.invoke("cora-banking-service", {
        body: {
          action: "send_payment",
          data: {
            amount: despesa.valor,
            pix_key: pixKey,
            pix_key_type: despesa.pix_key_type || "cpf",
            description: `${despesa.descricao} — ${format(currentMonth, "MM/yyyy")}`,
            beneficiary_name: despesa.beneficiario,
            scheduled_date: dueDate,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      setPaymentResults(r => ({ ...r, [despesa.beneficiario]: { ok: true, msg: `PIX agendado para ${dueDate}` } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setPaymentResults(r => ({ ...r, [despesa.beneficiario]: { ok: false, msg } }));
    } finally {
      setPagandoIdx(null);
    }
  }

  // Build calendar days
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = startOfMonth(currentMonth).getDay(); // 0=Sun
  const today = getDate(new Date());
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const eventsByDay: Record<number, { title: string; color: string; type: string }[]> = {};
  RECURRING_EVENTS.forEach(ev => {
    if (!eventsByDay[ev.day]) eventsByDay[ev.day] = [];
    eventsByDay[ev.day].push({ title: ev.title, color: ev.color, type: ev.type });
  });

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "boleto_due": return <DollarSign className="w-3 h-3" />;
      case "expense_due": return <Receipt className="w-3 h-3" />;
      case "payroll": return <Wallet className="w-3 h-3" />;
      case "boleto_generation": return <Calendar className="w-3 h-3" />;
      case "tax": return <Building2 className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const coveragePercent = cashFlow
    ? Math.min(100, (cashFlow.saldoAtual / Math.max(1, cashFlow.despesasPrevistas)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-7 h-7 text-primary" />
            Agenda Financeira
          </h1>
          <p className="text-muted-foreground text-sm">
            Calendário de vencimentos, fluxo de caixa e guia de importação
          </p>
        </div>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="calendario">
            <Calendar className="w-4 h-4 mr-1" /> Calendário
          </TabsTrigger>
          <TabsTrigger value="fluxo">
            <TrendingUp className="w-4 h-4 mr-1" /> Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="despesas-fixas">
            <Users className="w-4 h-4 mr-1" /> Despesas Fixas
          </TabsTrigger>
          <TabsTrigger value="uploads">
            <Upload className="w-4 h-4 mr-1" /> Guia de Upload
          </TabsTrigger>
        </TabsList>

        {/* === CALENDÁRIO === */}
        <TabsContent value="calendario" className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-200 border border-green-400 inline-block" /> Vencimento Honorários
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-200 border border-blue-400 inline-block" /> Folha de Pagamento
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-200 border border-orange-400 inline-block" /> MEI / Terceiros (dia 10)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-purple-200 border border-purple-400 inline-block" /> Parcelamentos (IPTU/Faculdade)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400 inline-block" /> Geração de Boletos
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-200 border border-red-400 inline-block" /> Impostos/GPS
            </span>
          </div>

          {/* Calendar grid */}
          <div className="border rounded-lg overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-muted">
              {weekdays.map(d => (
                <div key={d} className="text-center text-xs font-medium py-2 text-muted-foreground">{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 divide-x divide-y border-t">
              {/* Empty cells for first week */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] bg-muted/30 p-1" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayEvents = eventsByDay[day] || [];
                const isTodays = isCurrentMonth && day === today;

                return (
                  <div
                    key={day}
                    className={`min-h-[80px] p-1 ${isTodays ? "bg-primary/5 ring-2 ring-primary ring-inset" : ""}`}
                  >
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isTodays ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <div
                          key={idx}
                          className={`text-[10px] px-1 py-0.5 rounded border flex items-center gap-0.5 truncate ${ev.color}`}
                          title={ev.title}
                        >
                          {getTypeIcon(ev.type)}
                          <span className="truncate">{ev.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} mais</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Dias de Vencimento", icon: <DollarSign className="w-4 h-4 text-green-500" />, count: "5 lotes", note: "Dias 5, 10, 15, 20, 25, 30" },
              { label: "Geração de Boletos", icon: <Calendar className="w-4 h-4 text-yellow-500" />, count: "Dia 25", note: "Para competência do mês seguinte" },
              { label: "Folha de Pagamento", icon: <Wallet className="w-4 h-4 text-blue-500" />, count: "Dias 15 e 30", note: "40% dia 15, 60% dia 30" },
              { label: "GPS/INSS", icon: <Building2 className="w-4 h-4 text-red-500" />, count: "Dia 20", note: "Guia de Previdência Social" },
            ].map((item, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {item.icon}
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{item.note}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === FLUXO DE CAIXA === */}
        <TabsContent value="fluxo" className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando dados financeiros...</div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Wallet className="w-4 h-4" /> Saldo Bancário
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${(cashFlow?.saldoAtual || 0) < 0 ? "text-red-600" : "text-foreground"}`}>
                      {formatCurrency(cashFlow?.saldoAtual || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Conta Sicredi</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-500" /> A Receber
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(cashFlow?.receitasPrevistas || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Boletos pendentes</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="w-4 h-4 text-red-500" /> A Pagar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(cashFlow?.despesasPrevistas || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Despesas do mês</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-4 h-4" /> Saldo Projetado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${(cashFlow?.saldoProjetado || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(cashFlow?.saldoProjetado || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Fim do mês</p>
                  </CardContent>
                </Card>
              </div>

              {/* Coverage indicator */}
              {cashFlow && cashFlow.despesasPrevistas > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Cobertura do Saldo Atual para Despesas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(cashFlow.saldoAtual)} de {formatCurrency(cashFlow.despesasPrevistas)}
                      </span>
                      <Badge variant={coveragePercent >= 100 ? "default" : coveragePercent >= 60 ? "secondary" : "destructive"}>
                        {coveragePercent.toFixed(0)}%
                      </Badge>
                    </div>
                    <Progress value={Math.min(100, coveragePercent)} className="h-3" />
                    {coveragePercent < 100 && (
                      <Alert className="mt-3" variant="destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          Déficit de {formatCurrency(cashFlow.despesasPrevistas - cashFlow.saldoAtual)} — aguardar recebimento dos honorários pendentes.
                        </AlertDescription>
                      </Alert>
                    )}
                    {coveragePercent >= 100 && (
                      <Alert className="mt-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <AlertDescription className="text-green-700">
                          Saldo suficiente para cobrir todas as despesas do mês.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Upcoming items table */}
              {upcomingItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Próximos Vencimentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {upcomingItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${item.type === "receita" ? "bg-green-500" : "bg-red-500"}`} />
                            <div>
                              <p className="text-sm font-medium truncate max-w-[200px]">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(item.date + "T00:00:00"), "dd/MM/yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${item.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                              {item.type === "receita" ? "+" : "-"}{formatCurrency(item.value)}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {item.status === "pending" ? "Pendente" : item.status === "overdue" ? "Vencido" : item.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {upcomingItems.length === 0 && !loading && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Nenhum vencimento encontrado para {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}.
                    Verifique se os honorários do mês foram gerados.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/cash-flow")}>
                  <TrendingUp className="w-4 h-4 mr-1" /> Fluxo de Caixa Detalhado
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/generate-recurring-invoices")}>
                  <Calendar className="w-4 h-4 mr-1" /> Gerar Honorários
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* === DESPESAS FIXAS === */}
        <TabsContent value="despesas-fixas" className="space-y-4">
          {/* Summary header */}
          {(() => {
            const totalMei = DESPESAS_RECORRENTES.filter(d => d.tipo === "mei_pj").reduce((s, d) => s + d.valor, 0);
            const totalParc = DESPESAS_RECORRENTES.filter(d => d.tipo === "parcelamento").reduce((s, d) => s + d.valor, 0);
            const totalMes = totalMei + totalParc;
            return (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Users className="w-4 h-4 text-orange-500" /> MEI / Terceiros (dia 10)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(totalMei)}</p>
                    <p className="text-xs text-muted-foreground">8 prestadores PJ</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <CreditCard className="w-4 h-4 text-purple-500" /> Parcelamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-purple-600">{formatCurrency(totalParc)}</p>
                    <p className="text-xs text-muted-foreground">IPTU 2022 + 2018 + Faculdade</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-4 h-4" /> Total Mensal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(totalMes)}</p>
                    <p className="text-xs text-muted-foreground">Despesas fixas recorrentes</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Provisionar button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={provisionarMes}
              disabled={provisionando}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {provisionando ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Provisionando...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" /> Provisionar {format(currentMonth, "MMMM/yyyy", { locale: ptBR })}</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Cria as contas a pagar do mês na tabela de despesas (ignora se já existirem)
            </p>
          </div>

          {provisionResult && (
            <Alert className={provisionResult.criadas > 0 ? "" : "border-yellow-400"}>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <AlertDescription>
                {provisionResult.criadas > 0
                  ? <><strong>{provisionResult.criadas} despesas criadas</strong> — total {formatCurrency(provisionResult.total)} adicionado em Contas a Pagar.</>
                  : <span className="text-yellow-700">Todas as despesas do mês já estavam provisionadas.</span>
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Cora Bank balance + MEI / Terceiros table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" />
                  MEI / Prestadores PJ — Pagamento via Cora (dia 10)
                </CardTitle>
                <div className="flex items-center gap-2">
                  {coraBalance !== null && (
                    <span className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                      Saldo Cora: {formatCurrency(coraBalance)}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchCoraBalance}
                    disabled={coraBalanceLoading}
                  >
                    {coraBalanceLoading
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : <><Wallet className="w-3 h-3 mr-1" /> Ver Saldo</>
                    }
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 font-medium">Prestador</th>
                      <th className="text-left py-2 font-medium min-w-[160px]">Chave PIX</th>
                      <th className="text-right py-2 font-medium">Valor</th>
                      <th className="text-center py-2 font-medium">Pagar via Cora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DESPESAS_RECORRENTES.filter(d => d.tipo === "mei_pj").map((d, i) => {
                      const result = paymentResults[d.beneficiario];
                      const pixKey = pixKeys[d.beneficiario] ?? "";
                      return (
                        <tr key={i} className={`border-b last:border-0 hover:bg-muted/30 ${result?.ok ? "bg-green-50" : result ? "bg-red-50" : ""}`}>
                          <td className="py-2">
                            <div className="font-medium">{d.beneficiario}</div>
                            <div className="text-xs text-muted-foreground">{d.categoria}</div>
                          </td>
                          <td className="py-2">
                            <input
                              type="text"
                              placeholder="000.000.000-00"
                              value={pixKey}
                              onChange={e => setPixKeys(prev => ({ ...prev, [d.beneficiario]: e.target.value }))}
                              className="text-xs border rounded px-2 py-1 w-full bg-background"
                            />
                            {result && (
                              <p className={`text-[10px] mt-0.5 ${result.ok ? "text-green-700" : "text-red-600"}`}>
                                {result.ok ? "✓" : "✗"} {result.msg}
                              </p>
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold text-orange-700">{formatCurrency(d.valor)}</td>
                          <td className="py-2 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!pixKey || pagandoIdx === i}
                              onClick={() => pagarViaCora(d, i)}
                              className="text-xs h-7"
                            >
                              {pagandoIdx === i
                                ? <RefreshCw className="w-3 h-3 animate-spin" />
                                : <><Zap className="w-3 h-3 mr-1" />PIX</>
                              }
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-orange-50">
                      <td className="py-2 font-bold" colSpan={2}>Total dia 10</td>
                      <td className="py-2 text-right font-bold text-orange-700">
                        {formatCurrency(DESPESAS_RECORRENTES.filter(d => d.tipo === "mei_pj").reduce((s, d) => s + d.valor, 0))}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Preencha a chave PIX (CPF/CNPJ) de cada prestador e clique em "PIX" para agendar o pagamento direto pelo Cora Bank. Os pagamentos ficam registrados em Transações Bancárias.
              </p>
            </CardContent>
          </Card>

          {/* Parcelamentos table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-500" />
                Parcelamentos Mensais em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 font-medium">Descrição</th>
                      <th className="text-center py-2 font-medium">Vence</th>
                      <th className="text-center py-2 font-medium">Restam</th>
                      <th className="text-right py-2 font-medium">Parcela</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DESPESAS_RECORRENTES.filter(d => d.tipo === "parcelamento").map((d, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 font-medium">
                          <div>{d.descricao}</div>
                          <div className="text-xs text-muted-foreground">{d.beneficiario}</div>
                        </td>
                        <td className="py-2 text-center">
                          <Badge variant="outline" className="text-xs">Dia {d.dia}</Badge>
                        </td>
                        <td className="py-2 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {d.parcelas_restantes} parc.
                          </Badge>
                        </td>
                        <td className="py-2 text-right font-semibold text-purple-700">{formatCurrency(d.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                * IPTU 2022: 17/49 pagas, término previsto em ~Out/2028.
                IPTU 2018: 15/31 pagas, término previsto em ~Abr/2027.
                Faculdade 2026: 2/13 pagas (contrato anual).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === GUIA DE UPLOAD === */}
        <TabsContent value="uploads" className="space-y-4">
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <strong>Rotina Mensal:</strong> Importe os arquivos abaixo para manter o sistema atualizado.
              O Data Lake processa automaticamente e alimenta os agentes IA (Dr. Cícero, etc.).
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            {UPLOAD_GUIDE.map((item, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm">{item.title}</h3>
                        <Badge variant="outline" className="text-xs whitespace-nowrap shrink-0">
                          {item.frequency.split("(")[0].trim()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      <div className="flex items-start gap-1 mt-2 bg-muted/50 rounded p-2">
                        <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">{item.tip}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => navigate(item.route)}
                      >
                        {item.buttonLabel}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monthly checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Checklist Mensal de Fechamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { step: "1", title: "Importar extrato OFX do Sicredi", detail: "Verificar saldo e transações" },
                  { step: "2", title: "Importar relatório de títulos liquidados", detail: "Confirmar boletos pagos" },
                  { step: "3", title: "Conciliar bancário no Super Conciliador", detail: "Associar transações a clientes" },
                  { step: "4", title: "Gerar honorários do mês seguinte (dia 25)", detail: "Rota: Gerar Honorários" },
                  { step: "5", title: "Lançar folha de pagamento", detail: "40% dia 15 + 60% dia 30" },
                  { step: "6", title: "Classificar despesas não identificadas", detail: "Dr. Cícero → Pendentes" },
                  { step: "7", title: "Verificar inadimplentes", detail: "Análise de Inadimplência" },
                  { step: "8", title: "Fechar período contábil", detail: "Fechamento Mensal" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
