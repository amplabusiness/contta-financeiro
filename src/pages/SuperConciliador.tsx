import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, CheckCircle2, XCircle, AlertCircle, Loader2, TrendingUp, TrendingDown,
  Split, Plus, Trash2, Search, Filter, Zap, Bot, RefreshCw, ChevronRight,
  ArrowRight, Check, X, DollarSign, Users, Receipt, Sparkles, Target,
  ChevronDown, ChevronUp, Calendar, Building2, CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AIAssistantChat } from "@/components/AIAssistantChat";
import { AITeamBadge } from "@/components/AITeamBadge";

interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  matched: boolean;
  has_multiple_matches: boolean;
  ai_confidence: number | null;
  ai_suggestion: string | null;
  bank_reference: string | null;
  matches?: any[];
}

interface Invoice {
  id: string;
  client_id: string;
  amount: number;
  due_date: string;
  competence: string;
  description: string | null;
  status: string;
  clients?: { id: string; name: string; cnpj: string | null };
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  due_date: string | null;
  category: string;
  status: string;
  supplier_name?: string;
}

interface AccountPayable {
  id: string;
  supplier_name: string;
  description: string;
  amount: number;
  due_date: string;
  category: string;
  status: string;
}

interface SplitEntry {
  type: 'invoice' | 'expense' | 'accounts_payable' | 'manual';
  id: string;
  client_id?: string;
  client_name?: string;
  amount: string;
  description: string;
  selected: boolean;
}

// Interface para classificação do Dr. Cícero
interface DrCiceroClassification {
  confidence: number;
  debit_account: string;
  debit_account_name: string;
  credit_account: string;
  credit_account_name: string;
  entry_type: string;
  description: string;
  needs_confirmation: boolean;
  question?: string;
  options?: string[];
  reasoning: string;
}

const SuperConciliador = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([]);

  // Filtros
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'matched'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Dr. Cícero Dialog
  const [drCiceroDialog, setDrCiceroDialog] = useState(false);
  const [drCiceroTransaction, setDrCiceroTransaction] = useState<BankTransaction | null>(null);
  const [drCiceroClassification, setDrCiceroClassification] = useState<DrCiceroClassification | null>(null);
  const [drCiceroLoading, setDrCiceroLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');

  // Dialog de conciliação
  const [conciliationOpen, setConciliationOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [splitEntries, setSplitEntries] = useState<SplitEntry[]>([]);
  const [searchSuggestion, setSearchSuggestion] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<SplitEntry[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  // Estatísticas
  const [stats, setStats] = useState({
    totalTransactions: 0,
    pendingCredit: 0,
    pendingDebit: 0,
    totalPendingCredit: 0,
    totalPendingDebit: 0,
    matchedToday: 0
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTransactions(),
        loadInvoices(),
        loadExpenses(),
        loadAccountsPayable()
      ]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from("bank_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Erro ao carregar transações:", error);
      return;
    }

    // Mapear 'type' do banco para 'transaction_type' esperado pela interface
    // E garantir que os sinais estão corretos para exibição
    const mappedData = (data || []).map(tx => ({
      ...tx,
      transaction_type: tx.type as 'credit' | 'debit',
      // Garante valor positivo para display (o sinal é mostrado baseado no tipo)
      amount: Math.abs(tx.amount)
    }));

    // Carregar matches múltiplos
    const txWithMatches = await Promise.all(
      mappedData.map(async (tx) => {
        if (tx.has_multiple_matches) {
          const { data: matches } = await supabase
            .from("bank_transaction_matches")
            .select("*, clients(name)")
            .eq("bank_transaction_id", tx.id);
          return { ...tx, matches: matches || [] };
        }
        return tx;
      })
    );

    setTransactions(txWithMatches as BankTransaction[]);
    calculateStats(txWithMatches as BankTransaction[]);
  };

  const loadInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(id, name, cnpj)")
      .eq("status", "pending")
      .order("due_date", { ascending: true });
    setInvoices(data || []);
  };

  const loadExpenses = async () => {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("status", "pending")
      .order("due_date", { ascending: true });
    setExpenses(data || []);
  };

  const loadAccountsPayable = async () => {
    const { data } = await supabase
      .from("accounts_payable")
      .select("*")
      .eq("status", "pending")
      .order("due_date", { ascending: true });
    setAccountsPayable(data || []);
  };

  const calculateStats = (txData: BankTransaction[]) => {
    const pending = txData.filter(t => !t.matched);
    const credits = pending.filter(t => t.transaction_type === 'credit');
    const debits = pending.filter(t => t.transaction_type === 'debit');

    const today = new Date().toISOString().split('T')[0];
    const matchedToday = txData.filter(t =>
      t.matched && t.transaction_date?.startsWith(today)
    ).length;

    setStats({
      totalTransactions: txData.length,
      pendingCredit: credits.length,
      pendingDebit: debits.length,
      totalPendingCredit: credits.reduce((sum, t) => sum + t.amount, 0),
      totalPendingDebit: debits.reduce((sum, t) => sum + t.amount, 0),
      matchedToday
    });
  };

  // Filtrar transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Filtro por tipo
      if (filterType !== 'all' && tx.transaction_type !== filterType) return false;

      // Filtro por status
      if (filterStatus === 'pending' && tx.matched) return false;
      if (filterStatus === 'matched' && !tx.matched) return false;

      // Filtro por busca
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!tx.description?.toLowerCase().includes(search) &&
            !tx.amount.toString().includes(search)) {
          return false;
        }
      }

      // Filtro por data
      if (dateRange.start && tx.transaction_date < dateRange.start) return false;
      if (dateRange.end && tx.transaction_date > dateRange.end) return false;

      return true;
    });
  }, [transactions, filterType, filterStatus, searchTerm, dateRange]);

  // Abrir dialog de conciliação
  const openConciliation = async (tx: BankTransaction) => {
    setSelectedTransaction(tx);
    setSplitEntries([]);
    setSearchSuggestion('');
    setAiSuggestions([]);
    setConciliationOpen(true);

    // Buscar sugestões da IA automaticamente
    await getAISuggestions(tx);
  };

  // Buscar sugestões da IA
  const getAISuggestions = async (tx: BankTransaction) => {
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-reconciliation', {
        body: {
          action: 'suggest_matches',
          transaction: {
            id: tx.id,
            description: tx.description,
            amount: tx.amount,
            date: tx.transaction_date,
            type: tx.transaction_type
          }
        }
      });

      if (!error && data?.suggestions) {
        setAiSuggestions(data.suggestions.map((s: any) => ({
          type: s.type,
          id: s.id,
          client_id: s.client_id,
          client_name: s.client_name,
          amount: s.amount.toString(),
          description: s.description,
          selected: false,
          confidence: s.confidence
        })));
      }
    } catch (err) {
      console.error("Erro ao buscar sugestões IA:", err);
    } finally {
      setLoadingAI(false);
    }
  };

  // Filtrar itens disponíveis para match
  const getFilteredMatches = useCallback(() => {
    const search = searchSuggestion.toLowerCase();
    const isCredit = selectedTransaction?.transaction_type === 'credit';

    if (isCredit) {
      // Para créditos, mostrar honorários pendentes
      return invoices
        .filter(inv => {
          if (!search) return true;
          return inv.clients?.name?.toLowerCase().includes(search) ||
                 inv.amount.toString().includes(search) ||
                 inv.competence?.includes(search);
        })
        .map(inv => ({
          type: 'invoice' as const,
          id: inv.id,
          client_id: inv.client_id,
          client_name: inv.clients?.name || 'Cliente',
          amount: inv.amount.toString(),
          description: `${inv.clients?.name} - ${inv.competence} - ${formatCurrency(inv.amount)}`,
          due_date: inv.due_date,
          selected: false
        }));
    } else {
      // Para débitos, mostrar despesas e contas a pagar
      const expenseMatches = expenses
        .filter(exp => {
          if (!search) return true;
          return exp.description?.toLowerCase().includes(search) ||
                 exp.amount.toString().includes(search) ||
                 exp.category?.toLowerCase().includes(search);
        })
        .map(exp => ({
          type: 'expense' as const,
          id: exp.id,
          amount: exp.amount.toString(),
          description: `${exp.description} - ${exp.category} - ${formatCurrency(exp.amount)}`,
          due_date: exp.due_date,
          selected: false
        }));

      const apMatches = accountsPayable
        .filter(ap => {
          if (!search) return true;
          return ap.supplier_name?.toLowerCase().includes(search) ||
                 ap.description?.toLowerCase().includes(search) ||
                 ap.amount.toString().includes(search);
        })
        .map(ap => ({
          type: 'accounts_payable' as const,
          id: ap.id,
          amount: ap.amount.toString(),
          description: `${ap.supplier_name} - ${ap.description} - ${formatCurrency(ap.amount)}`,
          due_date: ap.due_date,
          selected: false
        }));

      return [...expenseMatches, ...apMatches];
    }
  }, [selectedTransaction, invoices, expenses, accountsPayable, searchSuggestion]);

  // Adicionar item à conciliação
  const addToSplit = (item: any) => {
    // Verificar se já foi adicionado
    if (splitEntries.some(e => e.id === item.id && e.type === item.type)) {
      toast.warning("Item já adicionado");
      return;
    }

    setSplitEntries(prev => [...prev, {
      ...item,
      selected: true
    }]);
  };

  // Remover item da conciliação
  const removeFromSplit = (index: number) => {
    setSplitEntries(prev => prev.filter((_, i) => i !== index));
  };

  // Atualizar valor de um item
  const updateSplitAmount = (index: number, amount: string) => {
    setSplitEntries(prev => {
      const updated = [...prev];
      updated[index].amount = amount;
      return updated;
    });
  };

  // Calcular totais
  const splitTotals = useMemo(() => {
    const total = splitEntries.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
    const remaining = (selectedTransaction?.amount || 0) - total;
    return { total, remaining };
  }, [splitEntries, selectedTransaction]);

  // Salvar conciliação
  const saveConciliation = async () => {
    if (!selectedTransaction) return;

    // Validar
    if (splitEntries.length === 0) {
      toast.error("Adicione pelo menos um item para conciliar");
      return;
    }

    if (Math.abs(splitTotals.remaining) > 0.01) {
      toast.error(`Diferença de ${formatCurrency(splitTotals.remaining)} não conciliada`);
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Se múltiplos itens, usar tabela de matches
      if (splitEntries.length > 1) {
        // Inserir matches individuais
        const matchesData = splitEntries.map(entry => ({
          bank_transaction_id: selectedTransaction.id,
          client_id: entry.client_id || null,
          invoice_id: entry.type === 'invoice' ? entry.id : null,
          expense_id: entry.type === 'expense' ? entry.id : null,
          accounts_payable_id: entry.type === 'accounts_payable' ? entry.id : null,
          amount: parseFloat(entry.amount),
          description: entry.description,
          confidence: 1.0,
          created_by: user.id,
        }));

        const { error: matchError } = await supabase
          .from("bank_transaction_matches")
          .insert(matchesData);

        if (matchError) throw matchError;

        // Atualizar transação
        await supabase
          .from("bank_transactions")
          .update({ has_multiple_matches: true, matched: true })
          .eq("id", selectedTransaction.id);
      } else {
        // Match único
        const entry = splitEntries[0];
        const updateData: any = { matched: true };

        if (entry.type === 'invoice') {
          updateData.matched_invoice_id = entry.id;
        } else if (entry.type === 'expense') {
          updateData.matched_expense_id = entry.id;
        }

        await supabase
          .from("bank_transactions")
          .update(updateData)
          .eq("id", selectedTransaction.id);
      }

      // Processar cada item
      for (const entry of splitEntries) {
        if (entry.type === 'invoice') {
          // Atualizar honorário para pago
          await supabase
            .from("invoices")
            .update({ status: "paid", payment_date: selectedTransaction.transaction_date })
            .eq("id", entry.id);

          // Criar lançamento contábil de recebimento
          await supabase.functions.invoke('smart-accounting', {
            body: {
              action: 'create_entry',
              entry: {
                type: 'invoice',
                operation: 'payment',
                referenceId: entry.id,
                referenceType: 'invoice',
                amount: parseFloat(entry.amount),
                date: selectedTransaction.transaction_date,
                description: `Recebimento: ${entry.client_name}`,
                clientId: entry.client_id
              }
            }
          });

          // Lançar no razão do cliente
          await supabase
            .from("client_ledger")
            .insert({
              client_id: entry.client_id,
              transaction_date: selectedTransaction.transaction_date,
              description: `Recebimento via banco: ${entry.description}`,
              credit: parseFloat(entry.amount),
              debit: 0,
              balance: 0,
              invoice_id: entry.id,
              reference_type: 'bank_transaction',
              reference_id: selectedTransaction.id,
              created_by: user.id,
            });

        } else if (entry.type === 'expense') {
          // Atualizar despesa para paga
          await supabase
            .from("expenses")
            .update({ status: "paid", payment_date: selectedTransaction.transaction_date })
            .eq("id", entry.id);

          // Criar lançamento contábil de pagamento
          await supabase.functions.invoke('smart-accounting', {
            body: {
              action: 'create_entry',
              entry: {
                type: 'expense',
                operation: 'payment',
                referenceId: entry.id,
                referenceType: 'expense',
                amount: parseFloat(entry.amount),
                date: selectedTransaction.transaction_date,
                description: `Pagamento: ${entry.description}`
              }
            }
          });

        } else if (entry.type === 'accounts_payable') {
          // Atualizar conta a pagar para paga
          await supabase
            .from("accounts_payable")
            .update({ status: "paid", payment_date: selectedTransaction.transaction_date })
            .eq("id", entry.id);

          // Criar lançamento contábil de pagamento
          await supabase.functions.invoke('smart-accounting', {
            body: {
              action: 'create_entry',
              entry: {
                type: 'expense',
                operation: 'payment',
                referenceId: entry.id,
                referenceType: 'accounts_payable',
                amount: parseFloat(entry.amount),
                date: selectedTransaction.transaction_date,
                description: `Pagamento: ${entry.description}`
              }
            }
          });
        }
      }

      toast.success(`Conciliação salva! ${splitEntries.length} item(s) vinculado(s) com lançamentos contábeis`);
      setConciliationOpen(false);
      await loadAllData();

    } catch (error: any) {
      console.error("Erro ao salvar conciliação:", error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Auto-conciliar com IA
  const runAutoReconciliation = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-reconciliation-agent', {
        body: {}
      });

      if (error) throw error;

      toast.success(data.message || `${data.reconciled} transações conciliadas automaticamente`);
      await loadAllData();
    } catch (error: any) {
      console.error("Erro na auto-conciliação:", error);
      toast.error("Erro: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Extrair CPF/CNPJ de descrição de PIX
  const extractDocumentFromDescription = (description: string): string | null => {
    // Padrões para PIX: "PIX_CRED 12345678901234 NOME" ou "PIX_CRED 12345678901 NOME"
    // CNPJ: 14 dígitos, CPF: 11 dígitos
    const patterns = [
      /PIX_CRED\s+(\d{14})\s/i,     // CNPJ no PIX
      /PIX_CRED\s+(\d{11})\s/i,     // CPF no PIX
      /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,  // CNPJ formatado
      /(\d{3}\.\d{3}\.\d{3}-\d{2})/,         // CPF formatado
      /\s(\d{14})\s/,               // CNPJ sem formato
      /\s(\d{11})\s/,               // CPF sem formato
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        // Retorna apenas os dígitos
        return match[1].replace(/\D/g, '');
      }
    }
    return null;
  };

  // Auto-conciliar por CPF/CNPJ extraído do PIX
  const findDocumentMatches = async () => {
    setProcessing(true);
    try {
      let matched = 0;
      let notFound = 0;
      const pendingCredits = transactions.filter(t => !t.matched && t.transaction_type === 'credit');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Carregar todos os clientes com documentos
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf")
        .eq("is_active", true);

      for (const tx of pendingCredits) {
        const document = extractDocumentFromDescription(tx.description || '');
        if (!document) continue;

        // Buscar cliente pelo CPF/CNPJ
        const client = clients?.find(c => {
          const clientCnpj = c.cnpj?.replace(/\D/g, '') || '';
          const clientCpf = c.cpf?.replace(/\D/g, '') || '';
          return clientCnpj === document || clientCpf === document;
        });

        if (!client) {
          notFound++;
          console.log(`Cliente não encontrado para documento ${document} na transação: ${tx.description}`);
          continue;
        }

        // Buscar honorário pendente deste cliente (mais próximo do valor)
        const clientInvoices = invoices.filter(inv =>
          inv.client_id === client.id && inv.status === 'pending'
        );

        if (clientInvoices.length === 0) {
          console.log(`Sem honorários pendentes para cliente ${client.name}`);
          continue;
        }

        // Encontrar o honorário mais próximo do valor (tolerância de 10%)
        let bestMatch: Invoice | null = null;
        let bestDiff = Infinity;
        for (const inv of clientInvoices) {
          const diff = Math.abs(inv.amount - tx.amount);
          const tolerance = tx.amount * 0.1; // 10% de tolerância
          if (diff < tolerance && diff < bestDiff) {
            bestMatch = inv;
            bestDiff = diff;
          }
        }

        // Se não encontrou com tolerância, pega o primeiro pendente (para períodos anteriores)
        if (!bestMatch && clientInvoices.length > 0) {
          // Se o valor da transação é maior, pode ser soma de vários meses
          // Neste caso, apenas registra o primeiro como parcial
          bestMatch = clientInvoices[0];
        }

        if (bestMatch) {
          // Conciliar
          await supabase
            .from("bank_transactions")
            .update({
              matched: true,
              matched_invoice_id: bestMatch.id,
              ai_confidence: bestDiff < 0.01 ? 1.0 : 0.9,
              ai_suggestion: `Match por CPF/CNPJ: ${client.name}`
            })
            .eq("id", tx.id);

          await supabase
            .from("invoices")
            .update({ status: "paid", payment_date: tx.transaction_date })
            .eq("id", bestMatch.id);

          // Lançamento contábil
          await supabase.functions.invoke('smart-accounting', {
            body: {
              action: 'create_entry',
              entry: {
                type: 'invoice',
                operation: 'payment',
                referenceId: bestMatch.id,
                referenceType: 'invoice',
                amount: tx.amount,
                date: tx.transaction_date,
                description: `Recebimento PIX: ${client.name}`,
                clientId: client.id
              }
            }
          });

          // Razão do cliente
          await supabase
            .from("client_ledger")
            .insert({
              client_id: client.id,
              transaction_date: tx.transaction_date,
              description: `Recebimento PIX: ${tx.description}`,
              credit: tx.amount,
              debit: 0,
              balance: 0,
              invoice_id: bestMatch.id,
              reference_type: 'bank_transaction',
              reference_id: tx.id,
              created_by: user.id,
            });

          matched++;
        }
      }

      if (matched > 0 || notFound > 0) {
        toast.success(`${matched} transações conciliadas por CPF/CNPJ${notFound > 0 ? ` (${notFound} clientes não encontrados)` : ''}`);
      } else {
        toast.info("Nenhuma transação PIX com documento identificável encontrada");
      }
      await loadAllData();
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Buscar matches por valor exato
  const findExactMatches = async () => {
    setProcessing(true);
    try {
      let matched = 0;
      const pendingCredits = transactions.filter(t => !t.matched && t.transaction_type === 'credit');

      for (const tx of pendingCredits) {
        // Buscar honorário com valor exato
        const matchingInvoice = invoices.find(inv =>
          Math.abs(inv.amount - tx.amount) < 0.01 && inv.status === 'pending'
        );

        if (matchingInvoice) {
          // Auto-conciliar
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) continue;

          await supabase
            .from("bank_transactions")
            .update({ matched: true, matched_invoice_id: matchingInvoice.id, ai_confidence: 1.0 })
            .eq("id", tx.id);

          await supabase
            .from("invoices")
            .update({ status: "paid", payment_date: tx.transaction_date })
            .eq("id", matchingInvoice.id);

          // Lançamento contábil
          await supabase.functions.invoke('smart-accounting', {
            body: {
              action: 'create_entry',
              entry: {
                type: 'invoice',
                operation: 'payment',
                referenceId: matchingInvoice.id,
                referenceType: 'invoice',
                amount: matchingInvoice.amount,
                date: tx.transaction_date,
                description: `Recebimento: ${matchingInvoice.clients?.name}`,
                clientId: matchingInvoice.client_id
              }
            }
          });

          matched++;
        }
      }

      toast.success(`${matched} transações conciliadas por valor exato`);
      await loadAllData();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // ===== SALDO DE ABERTURA (JANEIRO/2025) =====
  // Janeiro/2025 é período de abertura - receitas devem ser verificadas pelo Dr. Cícero
  // para determinar se são de clientes com saldo de abertura pendente

  // Verificar se transação é de janeiro/2025 (período de abertura)
  const isJaneiro2025 = (date: string) => {
    return date.startsWith('2025-01');
  };

  // Contar receitas de janeiro pendentes (para mostrar badge informativo)
  const receitasJaneiroPendentes = useMemo(() => {
    return transactions.filter(t =>
      !t.matched &&
      t.transaction_type === 'credit' &&
      isJaneiro2025(t.transaction_date)
    );
  }, [transactions]);

  // ===== DR. CÍCERO FUNCTIONS =====

  // Abrir dialog do Dr. Cícero para analisar uma transação
  const openDrCiceroDialog = async (transaction: BankTransaction) => {
    setDrCiceroTransaction(transaction);
    setDrCiceroClassification(null);
    setUserAnswer('');
    setDrCiceroDialog(true);
    setDrCiceroLoading(true);

    try {
      // Extrair documento se for PIX
      let document = null;
      const pixMatch = transaction.description.match(/PIX_CRED\s+(\d{11,14})\s/i);
      if (pixMatch) {
        document = pixMatch[1];
      }

      // Chamar Dr. Cícero para analisar
      const { data, error } = await supabase.functions.invoke('dr-cicero-contador', {
        body: {
          action: 'analyze_transaction',
          transaction: {
            id: transaction.id,
            description: transaction.description,
            amount: transaction.amount,
            date: transaction.transaction_date,
            type: transaction.transaction_type,
            document,
          }
        }
      });

      if (error) throw error;
      setDrCiceroClassification(data);
    } catch (error: any) {
      console.error('Erro ao chamar Dr. Cícero:', error);
      // Classificação fallback local
      setDrCiceroClassification({
        confidence: 0.5,
        debit_account: transaction.transaction_type === 'credit' ? '1.1.1.02' : '4.1.2.99',
        debit_account_name: transaction.transaction_type === 'credit' ? 'Banco Sicredi' : 'Outras Despesas',
        credit_account: transaction.transaction_type === 'credit' ? '3.1.2.01' : '1.1.1.02',
        credit_account_name: transaction.transaction_type === 'credit' ? 'Outras Receitas' : 'Banco Sicredi',
        entry_type: transaction.transaction_type === 'credit' ? 'receita' : 'despesa',
        description: transaction.description,
        needs_confirmation: true,
        question: `Dr. Cícero precisa de ajuda: O que é esta ${transaction.transaction_type === 'credit' ? 'receita' : 'despesa'} de ${formatCurrency(Math.abs(transaction.amount))}?`,
        options: transaction.transaction_type === 'credit'
          ? ['Honorário de cliente', 'Receita financeira', 'Devolução', 'Outro']
          : ['Pagamento fornecedor', 'Despesa pessoal', 'Despesa administrativa', 'Outro'],
        reasoning: 'Serviço de IA indisponível. Usando classificação manual.',
      });
    } finally {
      setDrCiceroLoading(false);
    }
  };

  // Confirmar classificação do Dr. Cícero e criar lançamento
  const confirmDrCiceroClassification = async (answer?: string) => {
    if (!drCiceroTransaction || !drCiceroClassification) return;

    setDrCiceroLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Se é confirmação sem alteração ou com resposta do usuário
      const finalAnswer = answer || userAnswer;

      // Chamar Dr. Cícero para criar o lançamento
      const { data, error } = await supabase.functions.invoke('dr-cicero-contador', {
        body: {
          action: 'create_entry',
          transaction: {
            id: drCiceroTransaction.id,
            description: drCiceroTransaction.description,
            amount: drCiceroTransaction.amount,
            date: drCiceroTransaction.transaction_date,
            type: drCiceroTransaction.transaction_type,
          },
          classification: drCiceroClassification,
          user_confirmation: finalAnswer,
        }
      });

      if (error) throw error;

      toast.success(`Dr. Cícero: Lançamento criado com sucesso!`);
      setDrCiceroDialog(false);
      await loadAllData();
    } catch (error: any) {
      console.error('Erro ao criar lançamento:', error);
      toast.error('Erro ao criar lançamento: ' + error.message);
    } finally {
      setDrCiceroLoading(false);
    }
  };

  // Processar todas transações pendentes com Dr. Cícero
  const processAllWithDrCicero = async () => {
    setProcessing(true);
    try {
      const pendingTx = transactions.filter(t => !t.matched);

      if (pendingTx.length === 0) {
        toast.info('Não há transações pendentes para processar');
        return;
      }

      const txData = pendingTx.map(tx => {
        let document = null;
        const pixMatch = tx.description.match(/PIX_CRED\s+(\d{11,14})\s/i);
        if (pixMatch) document = pixMatch[1];

        return {
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          date: tx.transaction_date,
          type: tx.transaction_type,
          document,
        };
      });

      const { data, error } = await supabase.functions.invoke('dr-cicero-contador', {
        body: {
          action: 'process_batch',
          transactions: txData,
          auto_approve_threshold: 0.85, // Auto-aprova apenas com 85%+ de confiança
        }
      });

      if (error) throw error;

      toast.success(`Dr. Cícero: ${data.auto_approved} aprovadas automaticamente, ${data.pending_review} aguardando revisão`);

      // Se há itens pendentes de revisão, abrir o primeiro
      const pendingReview = data.items?.filter((i: any) => i.status === 'pending_review') || [];
      if (pendingReview.length > 0) {
        const firstPending = transactions.find(t => t.id === pendingReview[0].transaction_id);
        if (firstPending) {
          setDrCiceroTransaction(firstPending);
          setDrCiceroClassification(pendingReview[0].classification);
          setDrCiceroDialog(true);
        }
      }

      await loadAllData();
    } catch (error: any) {
      console.error('Erro no processamento:', error);
      toast.error('Erro: ' + error.message);
    } finally {
      setProcessing(false);
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Target className="h-8 w-8 text-primary" />
                Conciliador
              </h1>
              <p className="text-muted-foreground">
                Conciliação bancária inteligente com Dr. Cícero (Contador IA)
              </p>
            </div>
            <AITeamBadge variant="compact" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAllData} disabled={processing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={findDocumentMatches} disabled={processing}>
              <CreditCard className="h-4 w-4 mr-2" />
              CPF/CNPJ
            </Button>
            <Button variant="outline" onClick={findExactMatches} disabled={processing}>
              <Zap className="h-4 w-4 mr-2" />
              Valor Exato
            </Button>
            <Button onClick={processAllWithDrCicero} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              <Bot className="h-4 w-4 mr-2" />
              Dr. Cícero
            </Button>
            {receitasJaneiroPendentes.length > 0 && (
              <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700">
                <Calendar className="h-3 w-3 mr-1" />
                {receitasJaneiroPendentes.length} receitas Jan/25
              </Badge>
            )}
          </div>
        </div>

        {/* Chat do Contador IA */}
        <AIAssistantChat
          context="accounting"
          defaultOpen={false}
          compact
          className="border-l-4 border-l-blue-500"
        />

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Créditos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.pendingCredit}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalPendingCredit)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Débitos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.pendingDebit}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalPendingDebit)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Honorários Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{invoices.length}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(invoices.reduce((s, i) => s + i.amount, 0))}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Despesas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {expenses.length + accountsPayable.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(
                  expenses.reduce((s, e) => s + e.amount, 0) +
                  accountsPayable.reduce((s, a) => s + a.amount, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conciliados Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.matchedToday}</div>
              <p className="text-xs text-muted-foreground">transações</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Descrição ou valor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="w-[150px]">
                <Label>Tipo</Label>
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="credit">Créditos</SelectItem>
                    <SelectItem value="debit">Débitos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[150px]">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="matched">Conciliados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[140px]">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>

              <div className="w-[140px]">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Transações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transações Bancárias ({filteredTransactions.length})</span>
              <Badge variant="outline">
                {filteredTransactions.filter(t => !t.matched).length} pendentes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma transação encontrada</p>
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                      tx.matched ? 'bg-green-50/50 border-green-200' : 'bg-white'
                    }`}
                  >
                    {/* Ícone de tipo */}
                    <div className={`p-2 rounded-full ${
                      tx.transaction_type === 'credit'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {tx.transaction_type === 'credit' ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{tx.description}</span>
                        {tx.has_multiple_matches && (
                          <Badge variant="secondary" className="gap-1">
                            <Split className="h-3 w-3" />
                            {tx.matches?.length || 0}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                        {tx.bank_reference && (
                          <>
                            <span>•</span>
                            <span>Ref: {tx.bank_reference}</span>
                          </>
                        )}
                      </div>
                      {tx.has_multiple_matches && tx.matches && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tx.matches.map((m: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {m.clients?.name}: {formatCurrency(m.amount)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Valor */}
                    <div className={`text-lg font-bold ${
                      tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.transaction_type === 'credit' ? '+' : '-'}
                      {formatCurrency(Math.abs(tx.amount))}
                    </div>

                    {/* Status/Ação */}
                    <div className="w-[140px] flex justify-end">
                      {tx.matched ? (
                        <Badge className="bg-green-600 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Conciliado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => openConciliation(tx)}
                        >
                          <Target className="h-4 w-4 mr-1" />
                          Conciliar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Conciliação */}
      <Dialog open={conciliationOpen} onOpenChange={setConciliationOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Conciliar Transação
            </DialogTitle>
            <DialogDescription>
              {selectedTransaction?.description} - {formatCurrency(selectedTransaction?.amount || 0)}
              {' '}em {selectedTransaction?.transaction_date && format(new Date(selectedTransaction.transaction_date), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
            {/* Coluna esquerda - Itens disponíveis */}
            <div className="flex flex-col overflow-hidden border rounded-lg">
              <div className="p-3 border-b bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, valor ou descrição..."
                    value={searchSuggestion}
                    onChange={(e) => setSearchSuggestion(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedTransaction?.transaction_type === 'credit'
                    ? `${invoices.length} honorários pendentes`
                    : `${expenses.length + accountsPayable.length} despesas pendentes`
                  }
                </div>
              </div>

              {/* Sugestões IA */}
              {loadingAI ? (
                <div className="p-4 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Buscando sugestões...</span>
                </div>
              ) : aiSuggestions.length > 0 && (
                <div className="p-2 border-b bg-gradient-to-r from-purple-50 to-blue-50">
                  <div className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Sugestões da IA
                  </div>
                  {aiSuggestions.map((sug, i) => (
                    <div
                      key={`ai-${i}`}
                      className="flex items-center justify-between p-2 rounded hover:bg-white/80 cursor-pointer"
                      onClick={() => addToSplit(sug)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{sug.description}</div>
                        <div className="text-xs text-muted-foreground">
                          Confiança: {((sug as any).confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-sm font-bold">{formatCurrency(parseFloat(sug.amount))}</div>
                      <Plus className="h-4 w-4 ml-2 text-primary" />
                    </div>
                  ))}
                </div>
              )}

              {/* Lista de itens */}
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {getFilteredMatches().map((item, i) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => addToSplit(item)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.type === 'invoice' ? (
                          <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        ) : (
                          <Receipt className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {item.type === 'invoice' ? item.client_name : item.description.split(' - ')[0]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(item as any).due_date && format(new Date((item as any).due_date), "dd/MM/yyyy")}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-right">
                        {formatCurrency(parseFloat(item.amount))}
                      </div>
                      <Plus className="h-4 w-4 ml-2 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Coluna direita - Itens selecionados */}
            <div className="flex flex-col overflow-hidden border rounded-lg">
              <div className="p-3 border-b bg-muted/50">
                <div className="font-medium">Itens Selecionados ({splitEntries.length})</div>
                <div className="text-xs text-muted-foreground">
                  Clique para remover ou ajustar valores
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {splitEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ArrowRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Clique nos itens à esquerda para adicionar</p>
                    </div>
                  ) : (
                    splitEntries.map((entry, i) => (
                      <Card key={i} className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {entry.type === 'invoice' ? (
                                <Badge variant="outline" className="bg-blue-50">
                                  <Users className="h-3 w-3 mr-1" />
                                  Honorário
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-orange-50">
                                  <Receipt className="h-3 w-3 mr-1" />
                                  {entry.type === 'accounts_payable' ? 'Conta a Pagar' : 'Despesa'}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-auto"
                                onClick={() => removeFromSplit(i)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-sm font-medium mb-2">{entry.description}</div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Valor:</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={entry.amount}
                                onChange={(e) => updateSplitAmount(i, e.target.value)}
                                className="h-8 w-32"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Totais */}
              <div className="p-3 border-t bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Selecionado:</span>
                  <span className="font-bold">{formatCurrency(splitTotals.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Valor da Transação:</span>
                  <span className="font-bold">{formatCurrency(selectedTransaction?.amount || 0)}</span>
                </div>
                <div className={`flex justify-between text-sm font-bold ${
                  Math.abs(splitTotals.remaining) < 0.01 ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span>Diferença:</span>
                  <span>{formatCurrency(splitTotals.remaining)}</span>
                </div>
                {Math.abs(splitTotals.remaining) > 0.01 && (
                  <Progress
                    value={(splitTotals.total / (selectedTransaction?.amount || 1)) * 100}
                    className="h-2"
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setConciliationOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={saveConciliation}
              disabled={processing || splitEntries.length === 0 || Math.abs(splitTotals.remaining) > 0.01}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar Conciliação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Dr. Cícero */}
      <Dialog open={drCiceroDialog} onOpenChange={setDrCiceroDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              Dr. Cícero - Contador IA
            </DialogTitle>
            <DialogDescription>
              Análise contábil da transação
            </DialogDescription>
          </DialogHeader>

          {drCiceroTransaction && (
            <div className="space-y-4">
              {/* Detalhes da transação */}
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm font-medium">{drCiceroTransaction.description}</div>
                  <div className="flex justify-between text-sm">
                    <span>Valor:</span>
                    <span className={`font-bold ${drCiceroTransaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(drCiceroTransaction.amount))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Data:</span>
                    <span>{format(new Date(drCiceroTransaction.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                </CardContent>
              </Card>

              {drCiceroLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-3">Dr. Cícero analisando...</span>
                </div>
              ) : drCiceroClassification && (
                <>
                  {/* Classificação sugerida */}
                  <Card className={drCiceroClassification.confidence >= 0.8 ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Classificação Sugerida
                        <Badge variant={drCiceroClassification.confidence >= 0.8 ? 'default' : 'secondary'}>
                          {(drCiceroClassification.confidence * 100).toFixed(0)}% confiança
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Débito:</span>
                        <span className="font-medium">{drCiceroClassification.debit_account} - {drCiceroClassification.debit_account_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Crédito:</span>
                        <span className="font-medium">{drCiceroClassification.credit_account} - {drCiceroClassification.credit_account_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground italic mt-2">
                        {drCiceroClassification.reasoning}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pergunta do Dr. Cícero */}
                  {drCiceroClassification.needs_confirmation && drCiceroClassification.question && (
                    <Card className="border-blue-200 bg-blue-50/50">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <Bot className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div className="text-sm font-medium">{drCiceroClassification.question}</div>
                        </div>

                        {drCiceroClassification.options && drCiceroClassification.options.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {drCiceroClassification.options.map((option, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                onClick={() => confirmDrCiceroClassification(option)}
                                disabled={drCiceroLoading}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Input
                            placeholder="Ou digite sua resposta..."
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && userAnswer && confirmDrCiceroClassification()}
                          />
                          <Button
                            size="sm"
                            onClick={() => confirmDrCiceroClassification()}
                            disabled={!userAnswer || drCiceroLoading}
                          >
                            Enviar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDrCiceroDialog(false)}>
              Cancelar
            </Button>
            {drCiceroClassification && !drCiceroClassification.needs_confirmation && (
              <Button onClick={() => confirmDrCiceroClassification()} disabled={drCiceroLoading}>
                {drCiceroLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Aprovar Lançamento
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default SuperConciliador;
