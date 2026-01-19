import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Landmark, Plus, Edit, Trash2, TrendingUp, TrendingDown, DollarSign, FileText, Calculator } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAccountBalance, ACCOUNT_MAPPING } from "@/lib/accountMapping";
import { usePeriod } from "@/contexts/PeriodContext";

interface BankAccount {
  id: string;
  name: string;
  bank_code: string | null;
  bank_name: string;
  agency: string | null;
  account_number: string | null;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  entry_type: string;
  source: 'accounting' | 'transaction';
}

const BankAccounts = () => {
  const { selectedYear, selectedMonth: contextMonth } = usePeriod();

  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Estados de dados principais
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [stats, setStats] = useState({
    totalAccounts: 0,
    activeAccounts: 0,
    totalBalance: 0
  });

  // Estados de diálogos - Conta
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    bank_code: "",
    bank_name: "",
    agency: "",
    account_number: "",
    account_type: "checking",
    current_balance: "0",
    is_active: true,
    notes: ""
  });

  // Estados de diálogos - Extrato/Razão
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<BankAccount | null>(null);
  const [ledgerSummary, setLedgerSummary] = useState({
    openingBalance: 0,
    totalDebits: 0,
    totalCredits: 0,
    calculatedBalance: 0
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return `${selectedYear}-${String(contextMonth).padStart(2, '0')}`;
  });

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadBankAccounts = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar contas bancárias do cadastro
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("is_active", { ascending: false })
        .order("name");

      if (error) throw error;

      // FONTE DA VERDADE: Usar a mesma função do Dashboard (getAccountBalance)
      // Isso garante que o saldo será calculado da mesma forma em todas as telas
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const saldoBanco = await getAccountBalance(
        ACCOUNT_MAPPING.SALDO_BANCO_SICREDI,
        currentYear,
        currentMonth
      );

      // Atualizar saldo das contas com o valor contábil (fonte da verdade)
      const accountsWithAccountingBalance = (data || []).map(account => {
        // Se for Sicredi, usar saldo contábil calculado pela mesma função do Dashboard
        if (account.name?.toLowerCase().includes('sicredi')) {
          return {
            ...account,
            current_balance: saldoBanco.balance
          };
        }
        return account;
      });

      setAccounts(accountsWithAccountingBalance);

      // Calculate stats usando saldo contábil como fonte da verdade
      const totalAccounts = accountsWithAccountingBalance?.length || 0;
      const activeAccounts = accountsWithAccountingBalance?.filter((a) => a.is_active).length || 0;
      // FONTE DA VERDADE: usar saldo contábil da mesma função do Dashboard
      const totalBalance = saldoBanco.balance;

      setStats({ totalAccounts, activeAccounts, totalBalance });
    } catch (error: any) {
      console.error("Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas bancárias");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, contextMonth]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadBankAccounts();
  }, [loadBankAccounts]);

  // =====================================================
  // HANDLERS DE AÇÕES - CRUD de Contas
  // =====================================================

  const handleAdd = () => {
    setEditingAccount(null);
    setFormData({
      name: "",
      bank_code: "",
      bank_name: "",
      agency: "",
      account_number: "",
      account_type: "checking",
      current_balance: "0",
      is_active: true,
      notes: ""
    });
    setDialogOpen(true);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      bank_code: account.bank_code || "",
      bank_name: account.bank_name || "",
      agency: account.agency || "",
      account_number: account.account_number || "",
      account_type: account.account_type || "checking",
      current_balance: account.current_balance?.toString() || "0",
      is_active: account.is_active,
      notes: account.notes || ""
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        toast.error("Informe o nome da conta");
        return;
      }

      const currentBalance = parseFloat(formData.current_balance) || 0;

      if (editingAccount) {
        // Update
        const { error } = await supabase
          .from("bank_accounts")
          .update({
            name: formData.name,
            bank_code: formData.bank_code,
            bank_name: formData.bank_name,
            agency: formData.agency,
            account_number: formData.account_number,
            account_type: formData.account_type,
            current_balance: currentBalance,
            is_active: formData.is_active,
            notes: formData.notes,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingAccount.id);

        if (error) throw error;

        toast.success("Conta atualizada com sucesso!");
      } else {
        // Insert - Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { error } = await supabase.from("bank_accounts").insert({
          name: formData.name,
          bank_code: formData.bank_code,
          bank_name: formData.bank_name,
          agency: formData.agency,
          account_number: formData.account_number,
          account_type: formData.account_type,
          current_balance: currentBalance,
          is_active: formData.is_active,
          notes: formData.notes,
          created_by: user.id
        });

        if (error) throw error;

        toast.success("Conta criada com sucesso!");
      }

      setDialogOpen(false);
      loadBankAccounts();
    } catch (error: any) {
      console.error("Erro ao salvar conta:", error);
      toast.error("Erro ao salvar conta bancária");
    }
  };

  const handleDelete = async (account: BankAccount) => {
    if (!confirm(`Tem certeza que deseja excluir a conta "${account.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("bank_accounts")
        .delete()
        .eq("id", account.id);

      if (error) throw error;

      toast.success("Conta excluída com sucesso!");
      loadBankAccounts();
    } catch (error: any) {
      console.error("Erro ao excluir conta:", error);
      toast.error("Erro ao excluir conta bancária");
    }
  };

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      checking: "Conta Corrente",
      savings: "Poupança",
      investment: "Investimento"
    };
    return types[type] || type;
  };

  // =====================================================
  // HANDLERS - Extrato/Razão
  // =====================================================

  // Função para carregar o extrato/razão da conta bancária
  // Usa as TRANSAÇÕES BANCÁRIAS (bank_transactions) para bater com o extrato do banco
  const loadLedger = async (account: BankAccount, month: string = selectedMonth) => {
    setSelectedAccountForLedger(account);
    setLedgerDialogOpen(true);
    setLedgerLoading(true);

    try {
      // Calcular datas do período
      const [year, monthNum] = month.split('-').map(Number);
      const startOfMonth = `${month}-01`;
      const endOfMonth = new Date(year, monthNum, 0).toISOString().split('T')[0]; // último dia do mês

      // 1. Buscar TODAS as transações bancárias
      const { data: allTransactions, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .order('transaction_date', { ascending: true });

      if (error) throw error;

      // 2. Calcular saldo de abertura (soma das transações ANTES do mês selecionado)
      // Saldo de abertura em 01/01/2025: R$ 90.725,06 (conforme extrato bancário)
      // Saldo final em 31/01/2025: R$ 18.553,54 (conforme LEDGERBAL do OFX)
      const SALDO_ABERTURA_JAN_2025 = 90725.06;
      let openingBalance = 0;

      if (month === '2025-01') {
        // Saldo inicial de 01/01/2025 conforme extrato bancário
        openingBalance = SALDO_ABERTURA_JAN_2025;
      } else {
        // Para outros meses, calcular baseado nas transações anteriores + saldo inicial
        openingBalance = SALDO_ABERTURA_JAN_2025; // Saldo base de 01/01/2025

        // Função para inferir se é entrada baseado na descrição
        const isEntryByDesc = (desc: string): boolean => {
          const d = (desc || '').toUpperCase();
          if (d.includes('RECEBIMENTO PIX') || d.includes('PIX_CRED') || d.includes('LIQ.COBRANCA')) return true;
          return false;
        };

        for (const tx of allTransactions || []) {
          if (tx.transaction_date < startOfMonth) {
            const rawAmount = Number(tx.amount) || 0;
            const amount = Math.abs(rawAmount);

            // Determinar tipo: usa transaction_type se disponível, senão infere pela descrição
            const txType = String(tx.transaction_type || '').toLowerCase().trim();
            let isEntry = false;
            if (txType === 'credit') {
              isEntry = true;
            } else if (txType === 'debit') {
              isEntry = false;
            } else {
              isEntry = isEntryByDesc(tx.description);
            }

            if (isEntry) {
              openingBalance += amount;
            } else {
              openingBalance -= amount;
            }
          }
        }
      }

      // 3. Filtrar transações do mês selecionado
      const monthEntries: LedgerEntry[] = [];

      // Função para inferir se é entrada baseado na descrição
      // IMPORTANTE: No OFX do Sicredi:
      // - LIQ.COBRANCA SIMPLES = ENTRADA (recebimento de boleto emitido)
      // - LIQUIDACAO BOLETO = SAÍDA (pagamento de boleto de terceiros)
      // - RECEBIMENTO PIX / PIX_CRED = ENTRADA
      // - PAGAMENTO PIX / PIX_DEB = SAÍDA
      const isEntryByDescription = (desc: string): boolean => {
        const d = (desc || '').toUpperCase();
        // Padrões de ENTRADA (dinheiro entrando na conta)
        if (d.includes('RECEBIMENTO PIX')) return true;
        if (d.includes('PIX_CRED')) return true;
        if (d.includes('LIQ.COBRANCA')) return true; // Liquidação de cobrança = recebimento
        // Padrões de SAÍDA (dinheiro saindo da conta)
        if (d.includes('LIQUIDACAO BOLETO')) return false; // Pagamento de boleto de terceiros
        if (d.includes('PAGAMENTO PIX')) return false;
        if (d.includes('PIX_DEB')) return false;
        if (d.includes('TARIFA')) return false;
        if (d.includes('DEB.CTA')) return false;
        if (d.includes('DEBITO CONVENIOS')) return false;
        if (d.includes('CESTA')) return false;
        if (d.includes('MANUTENCAO')) return false;
        // Default: se não conseguir inferir, considera saída
        return false;
      };

      for (const tx of allTransactions || []) {
        if (tx.transaction_date >= startOfMonth && tx.transaction_date <= endOfMonth) {
          const rawAmount = Number(tx.amount) || 0;
          const amount = Math.abs(rawAmount);

          // Determinar se é entrada ou saída:
          // 1. Primeiro tenta pelo transaction_type
          // 2. Se não tiver, infere pela descrição
          const txType = String(tx.transaction_type || '').toLowerCase().trim();
          let isEntry = false;

          if (txType === 'credit') {
            isEntry = true;
          } else if (txType === 'debit') {
            isEntry = false;
          } else {
            // transaction_type não definido, inferir pela descrição
            isEntry = isEntryByDescription(tx.description);
          }

          monthEntries.push({
            id: tx.id,
            entry_date: tx.transaction_date,
            description: tx.description || 'Sem descrição',
            debit: isEntry ? amount : 0, // Entrada (+) - dinheiro entrando
            credit: isEntry ? 0 : amount, // Saída (-) - dinheiro saindo
            running_balance: 0, // será calculado depois
            entry_type: tx.matched ? 'CONCILIADO' : (isEntry ? 'ENTRADA' : 'SAÍDA'),
            source: 'transaction'
          });
        }
      }

      // 4. Ordenar por data
      monthEntries.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

      // 5. Calcular saldo acumulado começando do saldo de abertura
      let runningBalance = openingBalance;
      for (const entry of monthEntries) {
        runningBalance += entry.debit - entry.credit;
        entry.running_balance = runningBalance;
      }

      setLedgerEntries(monthEntries);

      // 6. Calcular totais do mês
      const totalDebits = monthEntries.reduce((sum, e) => sum + e.debit, 0); // Entradas
      const totalCredits = monthEntries.reduce((sum, e) => sum + e.credit, 0); // Saídas
      const closingBalance = openingBalance + totalDebits - totalCredits;

      setLedgerSummary({
        openingBalance,
        totalDebits,
        totalCredits,
        calculatedBalance: closingBalance
      });

    } catch (error: any) {
      console.error('Erro ao carregar extrato:', error);
      toast.error('Erro ao carregar extrato da conta');
    } finally {
      setLedgerLoading(false);
    }
  };

  // Recarregar quando mudar o mês
  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (selectedAccountForLedger) {
      loadLedger(selectedAccountForLedger, newMonth);
    }
  };

  // Função para recalcular e atualizar o saldo da conta
  const recalculateBalance = async () => {
    if (!selectedAccountForLedger) return;

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({
          current_balance: ledgerSummary.calculatedBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAccountForLedger.id);

      if (error) throw error;

      toast.success(`Saldo atualizado para ${formatCurrency(ledgerSummary.calculatedBalance)}`);
      setLedgerDialogOpen(false);
      loadBankAccounts();
    } catch (error: any) {
      console.error('Erro ao atualizar saldo:', error);
      toast.error('Erro ao atualizar saldo');
    }
  };

  // Criar lançamento de saldo de abertura (31/12/2024)
  const createOpeningBalanceEntry = async (amount: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // 1. Buscar contas contábeis
      const { data: contaBanco } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '1.1.1.02')
        .single();

      const { data: contaSaldoAbertura } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '5.2.1.02')
        .single();

      if (!contaBanco || !contaSaldoAbertura) {
        toast.error('Contas contábeis não encontradas');
        return;
      }

      // 2. Criar o lançamento contábil
      const { data: entryData, error: entryError } = await supabase
        .from('accounting_entries')
        .insert({
          entry_date: '2024-12-31',
          competence_date: '2024-12-31',
          description: 'Saldo inicial de disponibilidades - Abertura do exercício 2025',
          history: 'Reconhecimento do saldo bancário existente em 31/12/2024 como saldo de abertura para o exercício de 2025',
          entry_type: 'SALDO_ABERTURA',
          document_type: 'ABERTURA',
          created_by: user.id,
          total_debit: amount,
          total_credit: amount,
        })
        .select('id')
        .single();

      if (entryError) throw entryError;

      // 3. Criar as partidas
      // Débito no Banco (entrada de recursos)
      await supabase.from('accounting_entry_items').insert({
        entry_id: entryData.id,
        account_id: contaBanco.id,
        debit: amount,
        credit: 0,
        history: 'Saldo inicial de disponibilidades',
      });

      // Crédito em Saldos de Abertura (contrapartida PL)
      await supabase.from('accounting_entry_items').insert({
        entry_id: entryData.id,
        account_id: contaSaldoAbertura.id,
        debit: 0,
        credit: amount,
        history: 'Reconhecimento do saldo inicial de disponibilidades',
      });

      toast.success(`Saldo de abertura de ${formatCurrency(amount)} criado com sucesso!`);

      // Recarregar o extrato
      if (selectedAccountForLedger) {
        loadLedger(selectedAccountForLedger, selectedMonth);
      }

    } catch (error: any) {
      console.error('Erro ao criar saldo de abertura:', error);
      toast.error('Erro ao criar saldo de abertura: ' + error.message);
    }
  };

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
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Contas Bancárias</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Gerencie as contas bancárias da empresa
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Contas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.totalAccounts}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{stats.activeAccounts}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">
                  {formatCurrency(stats.totalBalance)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Contas Cadastradas</CardTitle>
            <CardDescription>
              Lista de todas as contas bancárias configuradas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conta bancária cadastrada
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-lg border bg-background">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Agência</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Saldo Atual</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>
                          {account.bank_name}
                          {account.bank_code && (
                            <span className="text-muted-foreground ml-1">({account.bank_code})</span>
                          )}
                        </TableCell>
                        <TableCell>{account.agency || "-"}</TableCell>
                        <TableCell>{account.account_number || "-"}</TableCell>
                        <TableCell>{getAccountTypeLabel(account.account_type)}</TableCell>
                        <TableCell>
                          <Badge variant={account.is_active ? "default" : "secondary"}>
                            {account.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(account.current_balance)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex items-center justify-end gap-1">
                            {account.current_balance >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className={account.current_balance >= 0 ? "text-green-600" : "text-red-600"}>
                              {formatCurrency(account.current_balance)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadLedger(account)}
                              title="Ver extrato/razão"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(account)}
                              title="Editar conta"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(account)}
                              title="Excluir conta"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Conta Bancária" : "Nova Conta Bancária"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações da conta bancária
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nome da Conta <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Sicredi - Conta Principal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_code">Código do Banco</Label>
                  <Input
                    id="bank_code"
                    placeholder="Ex: 748"
                    value={formData.bank_code}
                    onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">Nome do Banco</Label>
                  <Input
                    id="bank_name"
                    placeholder="Ex: Sicredi"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agency">Agência</Label>
                  <Input
                    id="agency"
                    placeholder="Ex: 0001"
                    value={formData.agency}
                    onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_number">Número da Conta</Label>
                  <Input
                    id="account_number"
                    placeholder="Ex: 12345-6"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_type">Tipo de Conta</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="current_balance">Saldo Atual</Label>
                  <Input
                    id="current_balance"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.current_balance}
                    onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre a conta..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  title="Conta Ativa"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Conta Ativa
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingAccount ? "Atualizar" : "Criar"} Conta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog do Extrato/Razão */}
        <Dialog open={ledgerDialogOpen} onOpenChange={setLedgerDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extrato/Razão - {selectedAccountForLedger?.name}
              </DialogTitle>
              <DialogDescription>
                Composição do saldo bancário com todos os lançamentos contábeis
              </DialogDescription>
            </DialogHeader>

            {/* Seletor de Mês */}
            <div className="flex items-center gap-4 pb-2">
              <Label>Período:</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="w-48"
              />
            </div>

            {ledgerLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cards de resumo - estilo extrato bancário */}
                <div className="grid grid-cols-5 gap-3">
                  <Card className="bg-slate-100">
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground">Saldo Anterior</div>
                      <div className="text-lg font-bold">
                        {formatCurrency(ledgerSummary.openingBalance)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground">+ Entradas</div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(ledgerSummary.totalDebits)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground">- Saídas</div>
                      <div className="text-lg font-bold text-red-600">
                        {formatCurrency(ledgerSummary.totalCredits)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50">
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground">= Saldo Final</div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(ledgerSummary.calculatedBalance)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={Math.abs((selectedAccountForLedger?.current_balance || 0) - ledgerSummary.calculatedBalance) > 0.01 ? 'bg-orange-50' : 'bg-green-50'}>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground">Saldo Sistema</div>
                      <div className={`text-lg font-bold ${
                        Math.abs((selectedAccountForLedger?.current_balance || 0) - ledgerSummary.calculatedBalance) > 0.01
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}>
                        {formatCurrency(selectedAccountForLedger?.current_balance || 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabela de lançamentos - estilo extrato */}
                <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-24">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-24">Tipo</TableHead>
                        <TableHead className="text-right w-32">Entrada (+)</TableHead>
                        <TableHead className="text-right w-32">Saída (-)</TableHead>
                        <TableHead className="text-right w-32">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Linha de Saldo Anterior */}
                      <TableRow className="bg-slate-50 font-medium">
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const [year, monthNum] = selectedMonth.split('-').map(Number);
                            const lastDay = new Date(year, monthNum - 1, 0);
                            return format(lastDay, 'dd/MM/yyyy', { locale: ptBR });
                          })()}
                        </TableCell>
                        <TableCell colSpan={4}>
                          <strong>SALDO ANTERIOR</strong>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatCurrency(ledgerSummary.openingBalance)}
                        </TableCell>
                      </TableRow>

                      {ledgerEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum lançamento no período selecionado
                          </TableCell>
                        </TableRow>
                      ) : (
                        ledgerEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(entry.entry_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate" title={entry.description}>
                              {entry.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {entry.entry_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-mono">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-mono">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {formatCurrency(entry.running_balance)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}

                      {/* Linha de Saldo Final */}
                      <TableRow className="bg-blue-50 font-medium">
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const [year, monthNum] = selectedMonth.split('-').map(Number);
                            const lastDay = new Date(year, monthNum, 0);
                            return format(lastDay, 'dd/MM/yyyy', { locale: ptBR });
                          })()}
                        </TableCell>
                        <TableCell colSpan={2}>
                          <strong>SALDO FINAL</strong>
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-mono font-bold">
                          {formatCurrency(ledgerSummary.totalDebits)}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-mono font-bold">
                          {formatCurrency(ledgerSummary.totalCredits)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-600">
                          {formatCurrency(ledgerSummary.calculatedBalance)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Informação sobre o cálculo */}
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  <strong>Fórmula:</strong> Saldo Anterior ({formatCurrency(ledgerSummary.openingBalance)})
                  + Entradas ({formatCurrency(ledgerSummary.totalDebits)})
                  - Saídas ({formatCurrency(ledgerSummary.totalCredits)})
                  = <strong>Saldo Final ({formatCurrency(ledgerSummary.calculatedBalance)})</strong>
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                {ledgerEntries.length} lançamentos em {format(new Date(selectedMonth + '-01'), 'MMMM/yyyy', { locale: ptBR })}
              </div>
              <div className="flex gap-2">
                {/* Botão para criar saldo de abertura quando for janeiro e não houver saldo anterior */}
                {selectedMonth === '2025-01' && ledgerSummary.openingBalance === 0 && (
                  <Button
                    onClick={() => createOpeningBalanceEntry(90725.10)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Criar Saldo Abertura R$ 90.725,10
                  </Button>
                )}
                <Button variant="outline" onClick={() => setLedgerDialogOpen(false)}>
                  Fechar
                </Button>
                {Math.abs((selectedAccountForLedger?.current_balance || 0) - ledgerSummary.calculatedBalance) > 0.01 && (
                  <Button onClick={recalculateBalance} className="bg-orange-600 hover:bg-orange-700">
                    <Calculator className="h-4 w-4 mr-2" />
                    Atualizar Saldo para {formatCurrency(ledgerSummary.calculatedBalance)}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BankAccounts;
