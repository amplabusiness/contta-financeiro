import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Calendar, Info, Brain, Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isAfter, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { useClient } from "@/contexts/ClientContext";

interface BankAccount {
  id: string;
  account_name: string;
  balance: number;
  balance_date: string;
}

interface CashFlowProjection {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
  projected_balance: number;
}

const CashFlow = () => {
  const { selectedClientId, selectedClientName } = useClient();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [openingBalances, setOpeningBalances] = useState<any[]>([]);
  const [cashFlowTransactions, setCashFlowTransactions] = useState<any[]>([]);
  const [projection, setProjection] = useState<CashFlowProjection[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string; timestamp: string; data: any; } | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [formData, setFormData] = useState({
    account_name: "",
    account_number: "",
    bank_name: "",
    balance: "",
    account_type: "checking",
  });

  const [transactionFormData, setTransactionFormData] = useState({
    transaction_type: "inflow",
    description: "",
    amount: "",
    transaction_date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    status: "projected",
  });

  useEffect(() => {
    loadCashFlowData();
  }, [selectedPeriod, selectedClientId]);

  const syncCashFlow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-cash-flow');
      
      if (error) throw error;

      toast.success(`Fluxo de caixa sincronizado! ${data.summary.total_created} transações criadas.`);
      loadCashFlowData();
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      toast.error("Erro ao sincronizar fluxo de caixa");
    } finally {
      setSyncing(false);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      const payload = {
        ...transactionFormData,
        amount: parseFloat(transactionFormData.amount),
        reference_type: 'manual',
        created_by: user.user.id,
      };

      const { error } = await supabase
        .from("cash_flow_transactions")
        .insert([payload]);

      if (error) throw error;

      toast.success("Transação adicionada com sucesso!");
      setTransactionDialogOpen(false);
      resetTransactionForm();
      loadCashFlowData();
    } catch (error: any) {
      console.error("Erro ao salvar transação:", error);
      toast.error(error.message || "Erro ao salvar transação");
    } finally {
      setLoading(false);
    }
  };

  const resetTransactionForm = () => {
    setTransactionFormData({
      transaction_type: "inflow",
      description: "",
      amount: "",
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      category: "",
      status: "projected",
    });
  };

  const loadCashFlowData = async () => {
    try {
      setLoading(true);

      // Buscar contas bancárias
      const { data: accountsData, error: accountsError } = await supabase
        .from("bank_balance")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (accountsError) throw accountsError;
      setBankAccounts(accountsData || []);

      // Buscar contas a pagar pendentes
      let payablesQuery = supabase
        .from("accounts_payable")
        .select("*")
        .in("status", ["pending", "approved"])
        .order("due_date", { ascending: true });

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        payablesQuery = payablesQuery.eq("client_id", selectedClientId);
      }

      const { data: payablesData, error: payablesError } = await payablesQuery;
      if (payablesError) throw payablesError;

      // Buscar despesas pendentes (sem duplicar com accounts_payable)
      let expensesQuery = supabase
        .from("expenses")
        .select("*")
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        expensesQuery = expensesQuery.eq("client_id", selectedClientId);
      }

      const { data: expensesData, error: expensesError } = await expensesQuery;
      if (expensesError) throw expensesError;

      // Normalizar despesas para a estrutura de contas a pagar
      const normalizedExpenses = (expensesData || []).map((exp) => ({
        ...exp,
        supplier_name: exp.category || "Despesa",
      }));

      const combinedPayables = [...(payablesData || []), ...normalizedExpenses];

      setAccountsPayable(combinedPayables);

      // Buscar faturas pendentes e vencidas (a receber)
      let invoicesQuery = supabase
        .from("invoices")
        .select("*, clients(name)")
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true });

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        invoicesQuery = invoicesQuery.eq("client_id", selectedClientId);
      }

      const { data: invoicesData, error: invoicesError } = await invoicesQuery;
      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

      // Buscar saldos de abertura pendentes (a receber)
      let openingBalanceQuery = supabase
        .from("client_opening_balance")
        .select("*, clients(name)")
        .in("status", ["pending", "partial", "overdue"]);

      // Aplicar filtro de cliente se selecionado
      if (selectedClientId) {
        openingBalanceQuery = openingBalanceQuery.eq("client_id", selectedClientId);
      }

      const { data: openingBalanceData, error: openingBalanceError } = await openingBalanceQuery;
      if (openingBalanceError) throw openingBalanceError;
      setOpeningBalances(openingBalanceData || []);

      // Buscar transações de fluxo de caixa
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("cash_flow_transactions")
        .select("*")
        .order("transaction_date", { ascending: true });

      if (transactionsError) throw transactionsError;
      setCashFlowTransactions(transactionsData || []);

      // Combinar faturas com saldos de abertura para cálculos
      const normalizedOpeningBalances = (openingBalanceData || []).map((ob) => ({
        ...ob,
        amount: Number(ob.amount || 0) - Number(ob.paid_amount || 0), // Valor restante
        due_date: ob.due_date || format(new Date(), "yyyy-MM-dd"),
      }));

      const combinedReceivables = [...(invoicesData || []), ...normalizedOpeningBalances];

      // Calcular projeção
      calculateProjection(accountsData || [], combinedPayables || [], combinedReceivables, transactionsData || []);
    } catch (error: any) {
      console.error("Erro ao carregar fluxo de caixa:", error);
      toast.error("Erro ao carregar dados do fluxo de caixa");
    } finally {
      setLoading(false);
    }
  };

  const calculateProjection = (accounts: BankAccount[], payables: any[], receivables: any[], transactions: any[]) => {
    const startDate = new Date();
    const endDate = addDays(startDate, selectedPeriod);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    // Saldo inicial (soma de todas as contas)
    const initialBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    const projectionData: CashFlowProjection[] = [];
    const alertsList: any[] = [];
    let runningBalance = initialBalance;

    dateRange.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      
      // Calcular entradas do dia
      const dayInflow = receivables
        .filter((inv) => isSameDay(parseISO(inv.due_date), date))
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      // Calcular saídas do dia
      const dayOutflow = payables
        .filter((pay) => isSameDay(parseISO(pay.due_date), date))
        .reduce((sum, pay) => sum + Number(pay.amount), 0);

      // Adicionar transações manuais do fluxo de caixa
      const manualInflow = transactions
        .filter((t) => t.transaction_type === 'inflow' && isSameDay(parseISO(t.transaction_date), date))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const manualOutflow = transactions
        .filter((t) => t.transaction_type === 'outflow' && isSameDay(parseISO(t.transaction_date), date))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalDayInflow = dayInflow + manualInflow;
      const totalDayOutflow = dayOutflow + manualOutflow;

      runningBalance = runningBalance + totalDayInflow - totalDayOutflow;

      projectionData.push({
        date: dateStr,
        balance: runningBalance,
        inflow: totalDayInflow,
        outflow: totalDayOutflow,
        projected_balance: runningBalance,
      });

      // Gerar alertas para saldos negativos
      if (runningBalance < 0 && alertsList.length < 5) {
        const deficit = Math.abs(runningBalance);
        const daysUntil = Math.ceil((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        alertsList.push({
          date: dateStr,
          type: "negative_balance",
          severity: deficit > 10000 ? "critical" : deficit > 5000 ? "high" : "medium",
          message: `Saldo negativo de ${formatCurrency(deficit)} previsto`,
          days_until: daysUntil,
          deficit: deficit,
          payables_due: payables.filter((p) => isSameDay(parseISO(p.due_date), date)),
        });
      }
    });

    setProjection(projectionData);
    setAlerts(alertsList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      const payload = {
        ...formData,
        balance: parseFloat(formData.balance),
        created_by: user.user.id,
      };

      const { error } = await supabase
        .from("bank_balance")
        .insert([payload]);

      if (error) throw error;

      toast.success("Conta bancária cadastrada com sucesso!");
      setOpen(false);
      resetForm();
      loadCashFlowData();
    } catch (error: any) {
      console.error("Erro ao salvar conta:", error);
      toast.error(error.message || "Erro ao salvar conta");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      account_name: "",
      account_number: "",
      bank_name: "",
      balance: "",
      account_type: "checking",
    });
  };

  const getTotalBalance = () => {
    return bankAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  };

  const getTotalPayables = () => {
    return accountsPayable.reduce((sum, pay) => sum + Number(pay.amount), 0);
  };

  const getTotalReceivables = () => {
    // Soma faturas pendentes
    const invoicesTotal = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    // Soma saldos de abertura pendentes (valor restante)
    const openingBalanceTotal = openingBalances.reduce((sum, ob) => {
      const remaining = Number(ob.amount || 0) - Number(ob.paid_amount || 0);
      return sum + remaining;
    }, 0);
    return invoicesTotal + openingBalanceTotal;
  };

  const getTotalOpeningBalance = () => {
    return openingBalances.reduce((sum, ob) => {
      const remaining = Number(ob.amount || 0) - Number(ob.paid_amount || 0);
      return sum + remaining;
    }, 0);
  };

  const getProjectedBalance = () => {
    return getTotalBalance() + getTotalReceivables() - getTotalPayables();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-destructive";
      case "high": return "text-orange-500";
      case "medium": return "text-yellow-500";
      default: return "text-muted-foreground";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive">Crítico</Badge>;
      case "high": return <Badge className="bg-orange-500">Alto</Badge>;
      case "medium": return <Badge className="bg-yellow-500">Médio</Badge>;
      default: return <Badge variant="outline">Baixo</Badge>;
    }
  };

  const chartData = projection.filter((_, index) => index % Math.ceil(projection.length / 30) === 0);

  if (loading && bankAccounts.length === 0) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {selectedClientId ? `Fluxo de Caixa - ${selectedClientName}` : "Fluxo de Caixa"}
            </h1>
            <p className="text-muted-foreground">
              Gestão inteligente com projeções e alertas automáticos
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPeriod.toString()} onValueChange={(value) => setSelectedPeriod(parseInt(value))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={syncCashFlow}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sincronizar
            </Button>
            <Button 
              variant="outline"
              onClick={() => { resetTransactionForm(); setTransactionDialogOpen(true); }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Transação Manual
            </Button>
            <Button onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </div>
        </div>

        {/* Aviso quando não há contas bancárias */}
        {bankAccounts.length === 0 && !loading && (
          <Alert className="border-yellow-500 bg-yellow-50">
            <Info className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Nenhuma conta bancária cadastrada</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Para visualizar o fluxo de caixa, é necessário cadastrar pelo menos uma conta bancária com o saldo atual.
              Clique em "Nova Conta" para começar.
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta de Saldo Insuficiente para Pagar Contas */}
        {(() => {
          const saldoAtual = getTotalBalance();
          const contasAPagar = getTotalPayables();
          const deficit = saldoAtual - contasAPagar;
          const aReceber = getTotalReceivables();
          
          if (deficit < 0 && !loading && bankAccounts.length > 0) {
            return (
              <Alert variant="destructive" className="border-red-600 bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-red-800 font-bold text-lg">
                  ⚠️ ATENÇÃO: Saldo Insuficiente para Pagar Contas!
                </AlertTitle>
                <AlertDescription className="text-red-700 space-y-3">
                  <div className="text-base font-semibold">
                    Seu saldo atual de {formatCurrency(saldoAtual)} não é suficiente para cobrir 
                    as {formatCurrency(contasAPagar)} em contas a pagar.
                  </div>
                  <div className="bg-red-100 p-3 rounded-lg border border-red-200">
                    <p className="font-bold text-red-900">Déficit: {formatCurrency(Math.abs(deficit))}</p>
                  </div>
                  
                  {aReceber > 0 && (
                    <>
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="font-semibold text-green-800">
                          💰 Você tem {formatCurrency(aReceber)} a receber de clientes
                        </p>
                        {aReceber >= Math.abs(deficit) && (
                          <p className="text-green-700 text-sm mt-1">
                            ✓ Este valor é suficiente para cobrir o déficit!
                          </p>
                        )}
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="font-bold text-blue-900 mb-2">🎯 AÇÃO URGENTE NECESSÁRIA:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
                          <li>Entre em contato IMEDIATAMENTE com os clientes que têm faturas pendentes</li>
                          <li>Priorize a cobrança das faturas vencidas (overdue)</li>
                          <li>Negocie recebimento antecipado ou parcelamento se necessário</li>
                          <li>Considere oferecer desconto para pagamento à vista</li>
                          {aReceber < Math.abs(deficit) && (
                            <li className="font-semibold text-red-700">
                              CRÍTICO: O valor a receber não cobre todo o déficit. 
                              Considere renegociar prazos com fornecedores.
                            </li>
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                  
                  {aReceber === 0 && (
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <p className="font-bold text-orange-900 mb-2">⚠️ SITUAÇÃO CRÍTICA:</p>
                      <p className="text-orange-800 text-sm">
                        Não há valores a receber. Considere urgentemente:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-orange-800 text-sm mt-2">
                        <li>Renegociar prazos de pagamento com fornecedores</li>
                        <li>Buscar recursos adicionais (empréstimos, capital de giro)</li>
                        <li>Antecipar faturamento de novos serviços</li>
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            );
          }
          return null;
        })()}

        {/* Alertas de Saldo Negativo */}
        {alerts.length > 0 && (
          <Alert variant="destructive" className="border-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção! Saldo Negativo Previsto</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                {alerts.slice(0, 3).map((alert, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {format(parseISO(alert.date), "dd/MM/yyyy", { locale: ptBR })} 
                        ({alert.days_until} {alert.days_until === 1 ? 'dia' : 'dias'})
                      </p>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-sm mt-1">
                        <strong>Ação recomendada:</strong> Cobrar clientes em atraso ou negociar prazos com fornecedores
                      </p>
                    </div>
                  </div>
                ))}
                {alerts.length > 3 && (
                  <p className="text-sm italic">+ {alerts.length - 3} outros alertas</p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Saldo Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getTotalBalance() < 0 ? 'text-destructive' : ''}`}>
                {formatCurrency(getTotalBalance())}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {bankAccounts.length} conta{bankAccounts.length !== 1 ? 's' : ''} ativa{bankAccounts.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                A Receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {formatCurrency(getTotalReceivables())}
              </div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p>{invoices.length} fatura{invoices.length !== 1 ? 's' : ''} pendente{invoices.length !== 1 ? 's' : ''}</p>
                {openingBalances.length > 0 && (
                  <p className="text-orange-600">
                    + {openingBalances.length} saldo{openingBalances.length !== 1 ? 's' : ''} de abertura ({formatCurrency(getTotalOpeningBalance())})
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                A Pagar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(getTotalPayables())}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {accountsPayable.length} conta{accountsPayable.length !== 1 ? 's' : ''} pendente{accountsPayable.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Saldo Projetado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getProjectedBalance() < 0 ? 'text-destructive' : 'text-green-500'}`}>
                {formatCurrency(getProjectedBalance())}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Para os próximos {selectedPeriod} dias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Projeção */}
        <Card>
          <CardHeader>
            <CardTitle>Projeção de Saldo</CardTitle>
            <CardDescription>
              Evolução prevista do saldo bancário nos próximos {selectedPeriod} dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(parseISO(value), "dd/MM")}
                />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  labelFormatter={(label) => format(parseISO(label), "dd/MM/yyyy")}
                />
                <Legend />
                <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="projected_balance" 
                  stroke="#8884d8" 
                  name="Saldo Projetado"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contas Bancárias */}
        <Card>
          <CardHeader>
            <CardTitle>Contas Bancárias</CardTitle>
            <CardDescription>
              Saldos atuais das contas cadastradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bankAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma conta cadastrada</p>
                <Button variant="outline" onClick={() => setOpen(true)} className="mt-4">
                  Cadastrar Primeira Conta
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.account_name}</TableCell>
                      <TableCell>{(account as any).bank_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(account as any).account_type === 'checking' ? 'Corrente' :
                           (account as any).account_type === 'savings' ? 'Poupança' : 'Investimento'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-bold ${account.balance < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(account.balance)}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(account.balance_date), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Contas a Pagar Próximas */}
        <Card>
          <CardHeader>
            <CardTitle>Próximas Contas a Pagar</CardTitle>
            <CardDescription>
              Contas com vencimento nos próximos {selectedPeriod} dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsPayable.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma conta a pagar pendente</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountsPayable
                    .filter((payable) => {
                      try {
                        const d = parseISO(payable.due_date);
                        const today = new Date();
                        const endDate = addDays(today, selectedPeriod);
                        return d >= today && d <= endDate;
                      } catch {
                        return false;
                      }
                    })
                    .slice(0, 10)
                    .map((payable) => (
                    <TableRow key={payable.id}>
                      <TableCell className="font-medium">{payable.supplier_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{payable.description}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payable.amount)}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(payable.due_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={payable.status === 'approved' ? 'default' : 'outline'}>
                          {payable.status === 'pending' ? 'Pendente' : 'Aprovado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Transações do Fluxo de Caixa */}
        <Card>
          <CardHeader>
            <CardTitle>Transações do Fluxo de Caixa</CardTitle>
            <CardDescription>
              Transações manuais e importadas no fluxo de caixa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cashFlowTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma transação cadastrada</p>
                <Button 
                  variant="outline" 
                  onClick={() => setTransactionDialogOpen(true)} 
                  className="mt-4"
                >
                  Adicionar Primeira Transação
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlowTransactions.slice(0, 15).map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {transaction.transaction_type === 'inflow' ? (
                          <div className="flex items-center gap-2 text-green-500">
                            <ArrowUpRight className="h-4 w-4" />
                            Entrada
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-destructive">
                            <ArrowDownRight className="h-4 w-4" />
                            Saída
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.category}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${transaction.transaction_type === 'inflow' ? 'text-green-500' : 'text-destructive'}`}>
                        {transaction.transaction_type === 'inflow' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(transaction.transaction_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={transaction.status === 'confirmed' ? 'default' : 'outline'}>
                          {transaction.status === 'projected' ? 'Projetado' : 'Confirmado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Nova Conta */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conta Bancária</DialogTitle>
              <DialogDescription>
                Cadastre uma conta para controle do fluxo de caixa
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="account_name">Nome da Conta *</Label>
                <Input
                  id="account_name"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="bank_name">Banco</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="account_number">Número da Conta</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="account_type">Tipo de Conta *</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="balance">Saldo Atual *</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Transação Manual */}
        <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Transação Manual</DialogTitle>
              <DialogDescription>
                Registre entradas ou saídas manuais no fluxo de caixa
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div>
                <Label htmlFor="transaction_type">Tipo *</Label>
                <Select
                  value={transactionFormData.transaction_type}
                  onValueChange={(value) => setTransactionFormData({ ...transactionFormData, transaction_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inflow">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                        Entrada
                      </div>
                    </SelectItem>
                    <SelectItem value="outflow">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                        Saída
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={transactionFormData.description}
                  onChange={(e) => setTransactionFormData({ ...transactionFormData, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">Valor *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={transactionFormData.amount}
                  onChange={(e) => setTransactionFormData({ ...transactionFormData, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="transaction_date">Data *</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={transactionFormData.transaction_date}
                  onChange={(e) => setTransactionFormData({ ...transactionFormData, transaction_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Input
                  id="category"
                  value={transactionFormData.category}
                  onChange={(e) => setTransactionFormData({ ...transactionFormData, category: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={transactionFormData.status}
                  onValueChange={(value) => setTransactionFormData({ ...transactionFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="projected">Projetado</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTransactionDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CashFlow;
