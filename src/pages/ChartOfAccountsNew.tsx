import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Ban, 
  CheckCircle, 
  RefreshCw, 
  BookOpen, 
  Eye, 
  EyeOff,
  Brain,
  AlertTriangle,
  Lightbulb,
  Building2,
  TrendingUp,
  TrendingDown,
  Scale,
  Search,
  Layers,
  ChevronRight,
  FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/utils";
import { usePeriod } from "@/contexts/PeriodContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// INTERFACES
// ============================================================================

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  nature: string;
  level: number;
  is_analytical: boolean;
  parent_id: string | null;
  is_active: boolean;
}

interface AccountBalance {
  account_id: string;
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  closing_balance: number;
}

// ============================================================================
// COMPONENTES MAESTRO UX
// ============================================================================

/**
 * KPIPlanoContas - Cards de KPI seguindo Brand Book Contta
 */
interface KPIPlanoContasProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: "default" | "elevated" | "success" | "warning" | "danger";
}

const KPIPlanoContas = ({ title, value, subtitle, icon, variant = "default" }: KPIPlanoContasProps) => {
  const variantStyles = {
    default: "bg-card border",
    elevated: "bg-card border shadow-md",
    success: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800",
    warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
    danger: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
  };

  return (
    <Card className={`${variantStyles[variant]} transition-all duration-200 hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold font-mono tracking-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="p-2 bg-muted rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * DrCiceroInsights - Seção de insights do Dr. Cícero
 * Cor violeta #7c3aed conforme Brand Book
 */
interface DrCiceroInsightsProps {
  accounts: ChartAccount[];
  balances: Map<string, AccountBalance>;
  totals: {
    totalDebits: number;
    totalCredits: number;
    totalClosingDebit: number;
    totalClosingCredit: number;
  };
}

const DrCiceroInsights = ({ accounts, balances, totals }: DrCiceroInsightsProps) => {
  const insights = useMemo(() => {
    const alertas: { tipo: "alerta" | "oportunidade" | "info"; mensagem: string }[] = [];
    
    // Verificar equilíbrio de débitos e créditos
    const diferencaMovimentos = Math.abs(totals.totalDebits - totals.totalCredits);
    if (diferencaMovimentos > 0.01) {
      alertas.push({
        tipo: "alerta",
        mensagem: `Débitos (${formatCurrency(totals.totalDebits)}) ≠ Créditos (${formatCurrency(totals.totalCredits)}) - Diferença: ${formatCurrency(diferencaMovimentos)}`
      });
    }

    // Verificar equilíbrio de saldos finais
    const diferencaSaldos = Math.abs(totals.totalClosingDebit - totals.totalClosingCredit);
    if (diferencaSaldos > 0.01) {
      alertas.push({
        tipo: "alerta",
        mensagem: `Saldos não equilibrados - Diferença: ${formatCurrency(diferencaSaldos)}`
      });
    }

    // Verificar contas sem movimentação
    const contasSemMovimento = accounts.filter(acc => {
      const bal = balances.get(acc.id);
      return acc.is_analytical && (!bal || (bal.total_debits === 0 && bal.total_credits === 0));
    });
    if (contasSemMovimento.length > 10) {
      alertas.push({
        tipo: "info",
        mensagem: `${contasSemMovimento.length} contas analíticas sem movimentação no período`
      });
    }

    // Verificar contas inativas
    const contasInativas = accounts.filter(acc => !acc.is_active);
    if (contasInativas.length > 0) {
      alertas.push({
        tipo: "info",
        mensagem: `${contasInativas.length} contas inativas no plano de contas`
      });
    }

    // Se tudo estiver equilibrado
    if (diferencaMovimentos <= 0.01 && diferencaSaldos <= 0.01 && alertas.length === 0) {
      alertas.push({
        tipo: "oportunidade",
        mensagem: "Plano de contas equilibrado! Débitos = Créditos em movimentos e saldos."
      });
    }

    return alertas;
  }, [accounts, balances, totals]);

  if (insights.length === 0) return null;

  return (
    <Card className="border-[#7c3aed]/20 bg-gradient-to-r from-[#7c3aed]/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#7c3aed]/10 rounded-lg">
            <Brain className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-[#7c3aed]">
              Dr. Cícero • Análise do Plano de Contas
            </CardTitle>
            <CardDescription className="text-xs">
              Verificação de integridade contábil
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                insight.tipo === "alerta"
                  ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                  : insight.tipo === "oportunidade"
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
              }`}
            >
              {insight.tipo === "alerta" ? (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{insight.mensagem}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * BadgeTipoConta - Badge para tipo de conta contábil
 */
const BadgeTipoConta = ({ tipo }: { tipo: string }) => {
  const configs: Record<string, { label: string; className: string }> = {
    ATIVO: { label: "A", className: "bg-blue-100 text-blue-700 border-blue-200" },
    PASSIVO: { label: "P", className: "bg-purple-100 text-purple-700 border-purple-200" },
    RECEITA: { label: "R", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    DESPESA: { label: "D", className: "bg-red-100 text-red-700 border-red-200" },
  };

  const config = configs[tipo] || { label: tipo?.charAt(0) || "?", className: "" };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={`text-xs font-bold ${config.className}`}>
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tipo}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================================================
// FUNÇÃO AUXILIAR
// ============================================================================

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const ChartOfAccountsNew = () => {
  const navigate = useNavigate();
  const { selectedYear, selectedMonth } = usePeriod();
  
  // Estados de dados
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [balances, setBalances] = useState<Map<string, AccountBalance>>(new Map());
  
  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  // Estados de UI
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    account_type: "DESPESA",
    nature: "DEVEDORA",
    parent_id: "",
  });

  // =====================================================
  // FUNÇÕES DE NAVEGAÇÃO
  // =====================================================

  const handleViewLedger = (accountId: string) => {
    navigate(`/livro-razao?account=${accountId}`);
  };

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    loadAccounts();
  }, [showInactive]);

  useEffect(() => {
    if (accounts.length > 0) {
      loadBalances();
    }
  }, [selectedYear, selectedMonth, accounts]);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO
  // =====================================================

  const loadAccounts = async () => {
    try {
      let query = supabase
        .from("chart_of_accounts")
        .select("*")
        .order("code");

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar plano de contas");
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    setLoadingBalances(true);
    try {
      const periodStart = new Date(selectedYear, selectedMonth - 1, 1);
      const periodEnd = new Date(selectedYear, selectedMonth, 0);
      const periodStartStr = periodStart.toISOString().split('T')[0];
      const periodEndStr = periodEnd.toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_account_balances', {
        p_period_start: periodStartStr,
        p_period_end: periodEndStr
      });

      if (error) throw error;

      const balanceMap = new Map<string, AccountBalance>();
      
      (data || []).forEach((row: any) => {
        balanceMap.set(row.account_id, {
          account_id: row.account_id,
          opening_balance: Number(row.opening_balance) || 0,
          total_debits: Number(row.total_debits) || 0,
          total_credits: Number(row.total_credits) || 0,
          closing_balance: Number(row.closing_balance) || 0
        });
      });

      accounts.forEach(account => {
        if (!balanceMap.has(account.id)) {
          balanceMap.set(account.id, {
            account_id: account.id,
            opening_balance: 0,
            total_debits: 0,
            total_credits: 0,
            closing_balance: 0
          });
        }
      });

      setBalances(balanceMap);
    } catch (error: any) {
      toast.error("Erro ao carregar saldos: " + getErrorMessage(error));
    } finally {
      setLoadingBalances(false);
    }
  };

  // =====================================================
  // FUNÇÕES DE CRUD
  // =====================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const nature = ['ATIVO', 'DESPESA'].includes(formData.account_type) ? 'DEVEDORA' : 'CREDORA';
      const level = formData.code.split('.').length;

      const accountData = {
        code: formData.code,
        name: formData.name,
        account_type: formData.account_type,
        nature: nature,
        level: level,
        is_analytical: level >= 4,
        parent_id: formData.parent_id || null,
        created_by: user.id,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("chart_of_accounts")
          .update(accountData)
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast.success("Conta atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(accountData);

        if (error) throw error;
        toast.success("Conta cadastrada com sucesso!");
      }

      setOpen(false);
      setEditingAccount(null);
      resetForm();
      loadAccounts();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccountId) return;

    try {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", selectedAccountId);

      if (error) throw error;
      toast.success("Conta excluída com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedAccountId(null);
      loadAccounts();
    } catch (error: any) {
      toast.error("Erro ao excluir conta: " + error.message);
    }
  };

  const handleToggleStatus = async (account: ChartAccount) => {
    const newStatus = !account.is_active;
    const action = newStatus ? "ativada" : "desativada";

    try {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({ is_active: newStatus })
        .eq("id", account.id);

      if (error) throw new Error(getErrorMessage(error));
      toast.success(`Conta ${action} com sucesso!`);
      loadAccounts();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + getErrorMessage(error));
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      account_type: "DESPESA",
      nature: "DEVEDORA",
      parent_id: "",
    });
  };

  const handleEdit = (account: ChartAccount) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type || 'DESPESA',
      nature: account.nature || 'DEVEDORA',
      parent_id: account.parent_id || "",
    });
    setOpen(true);
  };

  // =====================================================
  // CÁLCULOS E DERIVAÇÕES
  // =====================================================

  const getParentAccounts = () => {
    return accounts.filter(acc => !acc.parent_id || acc.code.split('.').length < 3);
  };

  const getMonthName = (month: number) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return months[month - 1];
  };

  const calculateTotals = useMemo(() => {
    let totalDebits = 0;
    let totalCredits = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    accounts.forEach(account => {
      const balance = balances.get(account.id);
      if (balance) {
        totalDebits += balance.total_debits;
        totalCredits += balance.total_credits;

        if (account.nature === 'DEVEDORA') {
          if (balance.closing_balance > 0) totalClosingDebit += balance.closing_balance;
          else totalClosingCredit += Math.abs(balance.closing_balance);
        } else {
          if (balance.closing_balance > 0) totalClosingCredit += balance.closing_balance;
          else totalClosingDebit += Math.abs(balance.closing_balance);
        }
      }
    });

    return { totalDebits, totalCredits, totalClosingDebit, totalClosingCredit };
  }, [accounts, balances]);

  const filteredAccounts = useMemo(() => {
    let result = accounts;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (acc) =>
          acc.name.toLowerCase().includes(term) ||
          acc.code.includes(term)
      );
    }

    if (filterType) {
      result = result.filter((acc) => acc.account_type === filterType);
    }

    return result;
  }, [accounts, searchTerm, filterType]);

  // Estatísticas por tipo
  const statsByType = useMemo(() => {
    const stats = {
      ATIVO: { count: 0, total: 0 },
      PASSIVO: { count: 0, total: 0 },
      RECEITA: { count: 0, total: 0 },
      DESPESA: { count: 0, total: 0 },
    };

    accounts.forEach(acc => {
      const tipo = acc.account_type as keyof typeof stats;
      if (stats[tipo]) {
        stats[tipo].count++;
        const bal = balances.get(acc.id);
        if (bal) {
          stats[tipo].total += Math.abs(bal.closing_balance);
        }
      }
    });

    return stats;
  }, [accounts, balances]);

  const isBalanced = Math.abs(calculateTotals.totalDebits - calculateTotals.totalCredits) <= 0.01;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* ============================================
            HEADER
            ============================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
                Plano de Contas
              </h1>
              {isBalanced ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <Scale className="h-3 w-3 mr-1" />
                  Equilibrado
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Desequilibrado
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {getMonthName(selectedMonth)}/{selectedYear} • {accounts.length} contas
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showInactive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowInactive(!showInactive)}
                  >
                    {showInactive ? (
                      <EyeOff className="h-4 w-4 sm:mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">
                      {showInactive ? "Ocultar Inativas" : "Mostrar Inativas"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showInactive ? "Ocultar contas inativas" : "Mostrar contas inativas"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadBalances}
                    disabled={loadingBalances}
                  >
                    <RefreshCw className={`h-4 w-4 sm:mr-2 ${loadingBalances ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Atualizar Saldos</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recarregar saldos do período</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Dialog open={open} onOpenChange={(value) => {
              setOpen(value);
              if (!value) {
                setEditingAccount(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-[#0a8fc5] hover:bg-[#0a8fc5]/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Conta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta"}</DialogTitle>
                  <DialogDescription>
                    Preencha os dados da conta contábil
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código *</Label>
                    <Input
                      id="code"
                      placeholder="Ex: 1.1.01"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Tipo *</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="PASSIVO">Passivo</SelectItem>
                        <SelectItem value="RECEITA">Receita</SelectItem>
                        <SelectItem value="DESPESA">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent_id">Conta Pai (opcional)</Label>
                    <Select
                      value={formData.parent_id}
                      onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta pai" />
                      </SelectTrigger>
                      <SelectContent>
                        {getParentAccounts().map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={loading} className="bg-[#0a8fc5] hover:bg-[#0a8fc5]/90">
                      {loading ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ============================================
            KPIs - Visão geral do plano de contas
            ============================================ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPIPlanoContas
            title="Total de Contas"
            value={accounts.length}
            subtitle={`${accounts.filter(a => a.is_analytical).length} analíticas`}
            icon={<Layers className="h-5 w-5 text-[#0a8fc5]" />}
            variant="elevated"
          />
          <KPIPlanoContas
            title="Ativos"
            value={statsByType.ATIVO.count}
            subtitle={formatCurrency(statsByType.ATIVO.total)}
            icon={<Building2 className="h-5 w-5 text-blue-600" />}
          />
          <KPIPlanoContas
            title="Receitas"
            value={statsByType.RECEITA.count}
            subtitle={formatCurrency(statsByType.RECEITA.total)}
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          />
          <KPIPlanoContas
            title="Despesas"
            value={statsByType.DESPESA.count}
            subtitle={formatCurrency(statsByType.DESPESA.total)}
            icon={<TrendingDown className="h-5 w-5 text-red-600" />}
          />
        </div>

        {/* ============================================
            DR. CÍCERO - Insights automáticos
            ============================================ */}
        <DrCiceroInsights
          accounts={accounts}
          balances={balances}
          totals={calculateTotals}
        />

        {/* ============================================
            TABELA DE CONTAS
            ============================================ */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-[#0a8fc5]" />
                  Contas Contábeis
                </CardTitle>
                <CardDescription>
                  Saldo Inicial + Débitos - Créditos = Saldo Final (devedoras) |
                  Saldo Inicial + Créditos - Débitos = Saldo Final (credoras)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar conta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
                <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? null : v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="PASSIVO">Passivo</SelectItem>
                    <SelectItem value="RECEITA">Receita</SelectItem>
                    <SelectItem value="DESPESA">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando plano de contas...</span>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">Nenhuma conta encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm || filterType ? "Tente ajustar os filtros" : "Cadastre a primeira conta"}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-28 font-semibold">Código</TableHead>
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="w-16 font-semibold text-center">Tipo</TableHead>
                      <TableHead className="text-right w-28 font-semibold">Saldo Inicial</TableHead>
                      <TableHead className="text-right w-28 font-semibold">Débitos</TableHead>
                      <TableHead className="text-right w-28 font-semibold">Créditos</TableHead>
                      <TableHead className="text-right w-28 font-semibold">Saldo Final</TableHead>
                      <TableHead className="text-right w-28 font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => {
                      const balance = balances.get(account.id);
                      const hasMovement = balance && (balance.total_debits > 0 || balance.total_credits > 0);

                      return (
                        <TableRow 
                          key={account.id} 
                          className={`
                            hover:bg-muted/50 transition-colors
                            ${!account.is_active ? "opacity-50 bg-muted/20" : ""}
                            ${account.level === 1 ? "font-semibold bg-muted/10" : ""}
                          `}
                        >
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-1">
                              {account.level > 1 && (
                                <ChevronRight 
                                  className="h-3 w-3 text-muted-foreground" 
                                  style={{ marginLeft: `${(account.level - 1) * 8}px` }}
                                />
                              )}
                              {account.code}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span style={{ paddingLeft: `${(account.level - 1) * 12}px` }}>
                              {account.name}
                            </span>
                            {!account.is_active && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Inativa
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <BadgeTipoConta tipo={account.account_type} />
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${
                            balance && balance.opening_balance < 0 ? 'text-red-600' : ''
                          }`}>
                            {balance ? formatCurrency(balance.opening_balance) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-blue-600">
                            {balance && balance.total_debits > 0 ? formatCurrency(balance.total_debits) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-emerald-600">
                            {balance && balance.total_credits > 0 ? formatCurrency(balance.total_credits) : '—'}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm font-medium ${
                            balance && balance.closing_balance < 0 ? 'text-red-600' : ''
                          }`}>
                            {balance ? formatCurrency(balance.closing_balance) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {account.is_analytical && hasMovement && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleViewLedger(account.id)}
                                      >
                                        <BookOpen className="h-3.5 w-3.5 text-[#0a8fc5]" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver Razão</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleEdit(account)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleToggleStatus(account)}
                                    >
                                      {account.is_active ? (
                                        <Ban className="h-3.5 w-3.5 text-amber-600" />
                                      ) : (
                                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {account.is_active ? "Desativar" : "Ativar"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setSelectedAccountId(account.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
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
                    {/* Linha de totais */}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell colSpan={3} className="text-right text-base">
                        TOTAIS
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        —
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-blue-600">
                        {formatCurrency(calculateTotals.totalDebits)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600">
                        {formatCurrency(calculateTotals.totalCredits)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <div className="text-blue-600">{formatCurrency(calculateTotals.totalClosingDebit)} (D)</div>
                        <div className="text-emerald-600">{formatCurrency(calculateTotals.totalClosingCredit)} (C)</div>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {/* Verificação de equilíbrio */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="text-right text-sm">
                        Diferença (Débitos - Créditos)
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        —
                      </TableCell>
                      <TableCell colSpan={2} className={`text-center font-mono text-sm font-bold ${
                        !isBalanced ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {formatCurrency(calculateTotals.totalDebits - calculateTotals.totalCredits)}
                        {isBalanced && " ✓"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${
                        Math.abs(calculateTotals.totalClosingDebit - calculateTotals.totalClosingCredit) > 0.01
                          ? 'text-red-600'
                          : 'text-emerald-600'
                      }`}>
                        {formatCurrency(calculateTotals.totalClosingDebit - calculateTotals.totalClosingCredit)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================
            DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO
            ============================================ */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
                Contas com movimentação não podem ser excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete} 
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default ChartOfAccountsNew;
