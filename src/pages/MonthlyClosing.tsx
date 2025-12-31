import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { getDashboardBalances, getAccountBalance, ACCOUNT_MAPPING } from "@/lib/accountMapping";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Lock,
  Unlock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  CreditCard,
  RefreshCw,
  ClipboardList,
  AlertCircle,
  Banknote,
  Receipt,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthlyClosing {
  id: string;
  year: number;
  month: number;
  status: "open" | "closed" | "reopened";
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopened_reason: string | null;
  total_revenue: number;
  total_expenses: number;
  net_result: number;
  accounts_receivable: number;
  accounts_payable: number;
  bank_balances: any[];
  balance_transferred: boolean;
  notes: string | null;
}

interface PeriodSummary {
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  accountsReceivable: number;
  accountsPayable: number;
  pendingInvoices: number;
  overdueInvoices: number;
  pendingExpenses: number;
  overdueExpenses: number;
  bankBalances: { id: string; name: string; balance: number }[];
  unreconciled: number;
}

interface PendingTask {
  type: "invoice" | "expense" | "reconciliation" | "recurring";
  title: string;
  description: string;
  count: number;
  severity: "warning" | "error" | "info";
  action: string;
  route: string;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MonthlyClosing = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);

  // Dialog states
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<{ year: number; month: number } | null>(null);
  const [closeNotes, setCloseNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const fetchClosings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("monthly_closings")
        .select("*")
        .eq("year", selectedYear)
        .order("month", { ascending: true });

      if (error) throw error;
      setClosings(data || []);
    } catch (error) {
      console.error("Erro ao buscar fechamentos:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  const fetchPeriodSummary = useCallback(async (year: number, month: number) => {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // =====================================================
      // FONTE DA VERDADE: Buscar saldos direto das contas contábeis
      // Cada tela consulta a conta que precisa
      // =====================================================
      const [dashboardBalances, saldoBanco, contasReceber] = await Promise.all([
        getDashboardBalances(year, month),
        getAccountBalance(ACCOUNT_MAPPING.SALDO_BANCO_SICREDI, year, month),
        getAccountBalance(ACCOUNT_MAPPING.CONTAS_A_RECEBER, year, month),
      ]);

      // Buscar invoices pendentes (apenas para contagem, não para valores)
      const { data: pendingInvoices } = await supabase
        .from("invoices")
        .select("id, status")
        .lte("due_date", endStr)
        .in("status", ["pending", "overdue"]);

      // Buscar despesas pendentes (apenas para contagem)
      const { data: pendingExpenses } = await supabase
        .from("expenses")
        .select("id, status")
        .lte("due_date", endStr)
        .in("status", ["pending", "overdue"]);

      // Buscar transações não conciliadas (para alerta)
      const { data: unreconciledTx } = await supabase
        .from("bank_transactions")
        .select("id")
        .gte("transaction_date", startStr)
        .lte("transaction_date", endStr)
        .eq("is_reconciled", false);

      // FONTE DA VERDADE: Valores das contas contábeis
      const totalRevenue = dashboardBalances.totalReceitas;
      const totalExpenses = dashboardBalances.totalDespesas;
      const accountsReceivable = contasReceber.balance;

      // Contas a pagar - usar expenses apenas como fallback
      const { data: payableExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .lte("due_date", endStr)
        .in("status", ["pending", "overdue"]);
      const accountsPayable = payableExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      setPeriodSummary({
        totalRevenue,
        totalExpenses,
        netResult: totalRevenue - totalExpenses,
        accountsReceivable,
        accountsPayable,
        pendingInvoices: pendingInvoices?.filter(i => i.status === "pending").length || 0,
        overdueInvoices: pendingInvoices?.filter(i => i.status === "overdue").length || 0,
        pendingExpenses: pendingExpenses?.filter(e => e.status === "pending").length || 0,
        overdueExpenses: pendingExpenses?.filter(e => e.status === "overdue").length || 0,
        bankBalances: [{
          id: "sicredi",
          name: saldoBanco.name,
          balance: saldoBanco.balance,
        }],
        unreconciled: unreconciledTx?.length || 0,
      });

      // Gerar tarefas pendentes
      const tasks: PendingTask[] = [];

      if (unreconciledTx && unreconciledTx.length > 0) {
        tasks.push({
          type: "reconciliation",
          title: "Transações não conciliadas",
          description: `${unreconciledTx.length} transações bancárias aguardando conciliação`,
          count: unreconciledTx.length,
          severity: "warning",
          action: "Conciliar agora",
          route: "/bank-reconciliation",
        });
      }

      const overdueInvCount = pendingInvoices?.filter(i => i.status === "overdue").length || 0;
      if (overdueInvCount > 0) {
        tasks.push({
          type: "invoice",
          title: "Honorários vencidos",
          description: `${overdueInvCount} honorários vencidos aguardando pagamento`,
          count: overdueInvCount,
          severity: "error",
          action: "Ver honorários",
          route: "/invoices",
        });
      }

      const overdueExpCount = pendingExpenses?.filter(e => e.status === "overdue").length || 0;
      if (overdueExpCount > 0) {
        tasks.push({
          type: "expense",
          title: "Despesas vencidas",
          description: `${overdueExpCount} despesas vencidas aguardando pagamento`,
          count: overdueExpCount,
          severity: "error",
          action: "Ver despesas",
          route: "/expenses",
        });
      }

      setPendingTasks(tasks);

    } catch (error) {
      console.error("Erro ao buscar resumo do período:", error);
    }
  }, []);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  useEffect(() => {
    // Buscar resumo do mês atual
    fetchPeriodSummary(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchPeriodSummary]);

  const getClosingForMonth = (month: number): MonthlyClosing | undefined => {
    return closings.find(c => c.month === month);
  };

  const getStatusBadge = (closing?: MonthlyClosing) => {
    if (!closing || closing.status === "open" || closing.status === "reopened") {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aberto</Badge>;
    }
    return <Badge variant="default" className="bg-blue-600">Fechado</Badge>;
  };

  const canCloseMonth = (year: number, month: number): boolean => {
    // Só pode fechar meses passados ou o mês atual
    if (year > currentYear) return false;
    if (year === currentYear && month > currentMonth) return false;

    // Verificar se meses anteriores estão fechados
    for (let m = 1; m < month; m++) {
      const closing = closings.find(c => c.month === m);
      if (!closing || closing.status !== "closed") {
        return false; // Mês anterior não fechado
      }
    }

    const closing = getClosingForMonth(month);
    return !closing || closing.status !== "closed";
  };

  const canReopenMonth = (year: number, month: number): boolean => {
    const closing = getClosingForMonth(month);
    if (!closing || closing.status !== "closed") return false;

    // Verificar se o próximo mês não está fechado
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    if (nextYear > selectedYear) {
      // Precisa verificar no próximo ano
      return true; // Por enquanto, assumir que pode reabrir
    }

    const nextClosing = closings.find(c => c.month === nextMonth);
    return !nextClosing || nextClosing.status !== "closed";
  };

  const handleCloseMonth = (year: number, month: number) => {
    setSelectedPeriod({ year, month });
    setCloseNotes("");
    setShowCloseDialog(true);
  };

  const handleReopenMonth = (year: number, month: number) => {
    setSelectedPeriod({ year, month });
    setReopenReason("");
    setShowReopenDialog(true);
  };

  const confirmCloseMonth = async () => {
    if (!selectedPeriod) return;

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.rpc("close_month", {
        p_year: selectedPeriod.year,
        p_month: selectedPeriod.month,
        p_user_id: user?.id,
        p_notes: closeNotes || null,
      });

      if (error) throw error;

      toast({
        title: "Mês fechado com sucesso",
        description: `${monthNames[selectedPeriod.month - 1]}/${selectedPeriod.year} foi fechado. Saldos transferidos para o próximo mês.`,
      });

      setShowCloseDialog(false);
      fetchClosings();
      fetchPeriodSummary(currentYear, currentMonth);
    } catch (error: any) {
      console.error("Erro ao fechar mês:", error);
      toast({
        title: "Erro ao fechar mês",
        description: error.message || "Não foi possível fechar o período.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmReopenMonth = async () => {
    if (!selectedPeriod || !reopenReason) return;

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.rpc("reopen_month", {
        p_year: selectedPeriod.year,
        p_month: selectedPeriod.month,
        p_user_id: user?.id,
        p_reason: reopenReason,
      });

      if (error) throw error;

      toast({
        title: "Mês reaberto",
        description: `${monthNames[selectedPeriod.month - 1]}/${selectedPeriod.year} foi reaberto para edição.`,
      });

      setShowReopenDialog(false);
      fetchClosings();
    } catch (error: any) {
      console.error("Erro ao reabrir mês:", error);
      toast({
        title: "Erro ao reabrir mês",
        description: error.message || "Não foi possível reabrir o período.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateRecurringExpenses = async (targetYear: number, targetMonth: number) => {
    setIsProcessing(true);
    try {
      // Buscar despesas recorrentes ativas
      const { data: recurring, error } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;

      if (!recurring || recurring.length === 0) {
        toast({
          title: "Nenhuma despesa recorrente",
          description: "Não há despesas recorrentes configuradas.",
        });
        return;
      }

      let created = 0;
      const targetDate = new Date(targetYear, targetMonth - 1, 1);

      for (const rec of recurring) {
        // Verificar se já existe despesa para este período
        const dueDay = rec.due_day || 10;
        const dueDate = new Date(targetYear, targetMonth - 1, Math.min(dueDay, 28));

        const { data: existing } = await supabase
          .from("expenses")
          .select("id")
          .eq("recurring_expense_id", rec.id)
          .gte("due_date", format(new Date(targetYear, targetMonth - 1, 1), "yyyy-MM-dd"))
          .lte("due_date", format(new Date(targetYear, targetMonth, 0), "yyyy-MM-dd"));

        if (existing && existing.length > 0) continue; // Já existe

        // Criar despesa
        const { error: insertError } = await supabase
          .from("expenses")
          .insert({
            description: rec.description,
            amount: rec.amount,
            category: rec.category,
            due_date: format(dueDate, "yyyy-MM-dd"),
            status: "pending",
            recurring_expense_id: rec.id,
            supplier_id: rec.supplier_id,
            cost_center_id: rec.cost_center_id,
          });

        if (!insertError) created++;
      }

      toast({
        title: "Despesas recorrentes geradas",
        description: `${created} despesas foram criadas para ${monthNames[targetMonth - 1]}/${targetYear}.`,
      });
    } catch (error: any) {
      console.error("Erro ao gerar despesas recorrentes:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível gerar as despesas.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Fechamento de Mês</h1>
                <p className="text-muted-foreground">
                  Controle de períodos e transferência de saldos
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => fetchClosings()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Resumo do Período Atual */}
            {periodSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Receitas ({monthNames[currentMonth - 1]})</p>
                        <p className="text-xl font-bold text-green-600">
                          R$ {periodSummary.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Despesas ({monthNames[currentMonth - 1]})</p>
                        <p className="text-xl font-bold text-red-600">
                          R$ {periodSummary.totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Receipt className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">A Receber</p>
                        <p className="text-xl font-bold">
                          R$ {periodSummary.accountsReceivable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        {periodSummary.overdueInvoices > 0 && (
                          <p className="text-xs text-red-500">{periodSummary.overdueInvoices} vencidos</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Banknote className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">A Pagar</p>
                        <p className="text-xl font-bold">
                          R$ {periodSummary.accountsPayable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        {periodSummary.overdueExpenses > 0 && (
                          <p className="text-xs text-red-500">{periodSummary.overdueExpenses} vencidas</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tarefas Pendentes */}
            {pendingTasks.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Tarefas pendentes antes de fechar o mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingTasks.map((task, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          {task.severity === "error" ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          )}
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(task.route)}
                        >
                          {task.action}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ações Rápidas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                <CardDescription>Preparação para o próximo período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
                      generateRecurringExpenses(nextYear, nextMonth);
                    }}
                    disabled={isProcessing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                    Gerar Despesas Recorrentes ({monthNames[currentMonth === 12 ? 0 : currentMonth]})
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/invoices")}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Gerar Honorários
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/bank-reconciliation")}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Importar Extratos
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/expenses")}>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerenciar Despesas
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Calendário de Meses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Períodos de {selectedYear}</CardTitle>
                <CardDescription>
                  Clique em um mês para fechar ou reabrir o período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {monthNames.map((monthName, index) => {
                    const month = index + 1;
                    const closing = getClosingForMonth(month);
                    const isClosed = closing?.status === "closed";
                    const isPast = selectedYear < currentYear || (selectedYear === currentYear && month < currentMonth);
                    const isCurrent = selectedYear === currentYear && month === currentMonth;
                    const isFuture = selectedYear > currentYear || (selectedYear === currentYear && month > currentMonth);

                    return (
                      <Card
                        key={month}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isClosed ? "bg-blue-50 border-blue-200" :
                          isCurrent ? "bg-green-50 border-green-200 ring-2 ring-green-400" :
                          isFuture ? "bg-gray-50 border-gray-200 opacity-60" :
                          "bg-white"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{monthName}</span>
                            </div>
                            {getStatusBadge(closing)}
                          </div>

                          {closing && isClosed && (
                            <div className="text-xs text-muted-foreground mb-2">
                              <p>Resultado: R$ {Number(closing.net_result).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                              {closing.closed_at && (
                                <p>Fechado em: {format(new Date(closing.closed_at), "dd/MM/yyyy HH:mm")}</p>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2 mt-3">
                            {!isClosed && canCloseMonth(selectedYear, month) && !isFuture && (
                              <Button
                                size="sm"
                                variant="default"
                                className="flex-1"
                                onClick={() => handleCloseMonth(selectedYear, month)}
                              >
                                <Lock className="h-3 w-3 mr-1" />
                                Fechar
                              </Button>
                            )}
                            {isClosed && canReopenMonth(selectedYear, month) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleReopenMonth(selectedYear, month)}
                              >
                                <Unlock className="h-3 w-3 mr-1" />
                                Reabrir
                              </Button>
                            )}
                            {isFuture && (
                              <span className="text-xs text-muted-foreground">Período futuro</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Histórico de Fechamentos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Fechamentos</CardTitle>
              </CardHeader>
              <CardContent>
                {closings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum fechamento registrado para {selectedYear}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Receitas</TableHead>
                        <TableHead className="text-right">Despesas</TableHead>
                        <TableHead className="text-right">Resultado</TableHead>
                        <TableHead>Data Fechamento</TableHead>
                        <TableHead>Saldo Transferido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closings.map((closing) => (
                        <TableRow key={closing.id}>
                          <TableCell className="font-medium">
                            {monthNames[closing.month - 1]}/{closing.year}
                          </TableCell>
                          <TableCell>{getStatusBadge(closing)}</TableCell>
                          <TableCell className="text-right text-green-600">
                            R$ {Number(closing.total_revenue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            R$ {Number(closing.total_expenses).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${Number(closing.net_result) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            R$ {Number(closing.net_result).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {closing.closed_at ? format(new Date(closing.closed_at), "dd/MM/yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            {closing.balance_transferred ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Sim
                              </Badge>
                            ) : (
                              <Badge variant="outline">Não</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog Fechar Mês */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Fechar Período
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a fechar <strong>{selectedPeriod && monthNames[selectedPeriod.month - 1]}/{selectedPeriod?.year}</strong>.
              <br /><br />
              Após o fechamento:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Lançamentos deste período não poderão ser alterados</li>
                <li>Saldos serão transferidos para o próximo mês</li>
                <li>O período poderá ser reaberto se necessário</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4">
            <Label htmlFor="closeNotes">Observações (opcional)</Label>
            <Textarea
              id="closeNotes"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Adicione observações sobre o fechamento..."
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCloseMonth}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fechando...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Confirmar Fechamento
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Reabrir Mês */}
      <AlertDialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5" />
              Reabrir Período
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a reabrir <strong>{selectedPeriod && monthNames[selectedPeriod.month - 1]}/{selectedPeriod?.year}</strong>.
              <br /><br />
              Isso permitirá novamente a edição de lançamentos deste período.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4">
            <Label htmlFor="reopenReason">Motivo da reabertura *</Label>
            <Textarea
              id="reopenReason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Informe o motivo da reabertura..."
              className="mt-2"
              required
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReopenMonth}
              disabled={isProcessing || !reopenReason.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reabrindo...
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Confirmar Reabertura
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default MonthlyClosing;
