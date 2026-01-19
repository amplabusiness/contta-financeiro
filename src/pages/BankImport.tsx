import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, CheckCircle2, AlertCircle, Download, Brain, BookOpen, MessageCircle, Pencil, Save } from "lucide-react";
import { readOFXFile, OFXStatement, OFXTransaction } from "@/lib/ofxParser";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { AIClassificationDialog } from "@/components/AIClassificationDialog";
import { AIAssistantChat } from "@/components/AIAssistantChat";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
}

interface ImportResult {
  success: boolean;
  newTransactions: number;
  duplicateTransactions: number;
  totalAmount: number;
  errors: string[];
  aiClassifications?: any[];
  entriesCreated?: number;
}

interface AIClassification {
  fitid: string;
  description: string;
  amount: number;
  type: string;
  classification: {
    category: string;
    client_name?: string;
    is_prior_period?: boolean;
    debit_account: string;
    credit_account: string;
    description: string;
    confidence: number;
    reasoning: string;
  };
}

interface PendingTransaction {
  id: string;
  fitid: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  date: string;
  ai_suggestion?: {
    category: string;
    debit_account: string;
    credit_account: string;
    confidence: number;
    reasoning: string;
  };
}

interface CostCenter {
  id: string;
  name: string;
  code: string;
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  nature: string;
}

interface TransactionClassification {
  fitid: string;
  category: 'despesa' | 'investimento' | 'receita' | 'transferencia' | '';
  cost_center_id: string;
  account_id: string;
  notes: string;
}

const BankImport = () => {
  // Estados de carregamento
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // Estados de dados principais
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [parsedData, setParsedData] = useState<OFXStatement | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [recentImports, setRecentImports] = useState<any[]>([]);

  // Estados de classificação IA
  const [enableAI, setEnableAI] = useState(true);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiClassifications, setAiClassifications] = useState<AIClassification[]>([]);

  // Estados de diálogos
  const [showClassificationDialog, setShowClassificationDialog] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [currentImportId, setCurrentImportId] = useState<string>("");
  const [showInlineClassification, setShowInlineClassification] = useState(false);

  // Estados de classificação inline
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [classifications, setClassifications] = useState<Record<string, TransactionClassification>>({});

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadCostCentersAndAccounts = useCallback(async () => {
    try {
      const [centersRes, accountsRes] = await Promise.all([
        supabase.from("cost_centers").select("id, name, code").eq("is_active", true).order("code"),
        supabase.from("chart_of_accounts").select("id, code, name, account_type, nature").eq("is_active", true).order("code")
      ]);

      if (centersRes.data) setCostCenters(centersRes.data);
      if (accountsRes.data) setChartAccounts(accountsRes.data);
    } catch (error) {
      console.error("Erro ao carregar centros de custo e contas:", error);
    }
  }, []);

  const loadBankAccounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas bancárias");
    }
  }, []);

  const loadRecentImports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("bank_imports")
        .select(`
          *,
          bank_accounts (
            name,
            bank_name
          )
        `)
        .order("import_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentImports(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar importações:", error);
    }
  }, []);

  // =====================================================
  // EFFECTS - Inicialização
  // =====================================================

  useEffect(() => {
    loadBankAccounts();
    loadRecentImports();
    loadCostCentersAndAccounts();
  }, [loadBankAccounts, loadRecentImports, loadCostCentersAndAccounts]);

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedAccount) {
      toast.error("Selecione uma conta bancária primeiro");
      event.target.value = "";
      return;
    }

    try {
      setPreviewing(true);
      setParsedData(null);
      setImportResult(null);
      toast.info("Lendo arquivo OFX...");

      const result = await readOFXFile(file);

      if (!result.success || !result.data) {
        toast.error(result.error || "Erro ao processar arquivo OFX");
        return;
      }

      setParsedData(result.data);
      toast.success(`Arquivo processado: ${result.data.transactions.length} transações encontradas`);
    } catch (error: any) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo OFX");
    } finally {
      setPreviewing(false);
      event.target.value = "";
    }
  };

  const processWithAI = async (transactions: OFXTransaction[], importId: string) => {
    setAiProcessing(true);
    setAiProgress(0);
    toast.info("🧠 Invocando Contador IA e Agente Financeiro para classificação...");

    try {
      const txnsForAI = transactions.map(txn => ({
        fitid: txn.fitid,
        date: format(txn.date, 'yyyy-MM-dd'),
        type: txn.type,
        amount: txn.amount,
        description: txn.description || txn.memo || 'Sem descrição'
      }));

      setAiProgress(20);

      const { data, error } = await supabase.functions.invoke('ai-bank-transaction-processor', {
        body: {
          action: 'process_transactions',
          transactions: txnsForAI,
          bank_account_id: selectedAccount,
          import_id: importId,
          opening_date: '2024-12-31',
          usar_conta_transitoria: true,
          conta_transitoria_code: '1.1.9.01',
          regras_classificacao: {
            cobranca_pattern: 'COB\\d+|COBRANCA|LIQ\\.COBRANCA|LIQUIDACAO',
            acao_cobranca: 'TRANSITORIA',
          }
        }
      });

      setAiProgress(80);

      if (error) {
        console.error("Erro na classificação IA:", error);
        toast.error("Erro na classificação automática. Transações importadas sem classificação.");
        return null;
      }

      setAiProgress(100);

      if (data?.classifications) {
        setAiClassifications(data.classifications);
        toast.success(`🎯 ${data.entries_created || 0} lançamentos contábeis criados automaticamente!`);
      }

      return data;
    } catch (err: any) {
      console.error("Erro ao processar com IA:", err);
      toast.error("Erro ao invocar agentes de IA");
      return null;
    } finally {
      setAiProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || !selectedAccount) return;

    try {
      setLoading(true);
      toast.info("Importando transações...");

      let newTransactions = 0;
      let duplicateTransactions = 0;
      const errors: string[] = [];
      let totalAmount = 0;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: importRecord, error: importError } = await supabase
        .from("bank_imports")
        .insert({
          bank_account_id: selectedAccount,
          file_name: `Import ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          period_start: format(parsedData.startDate, 'yyyy-MM-dd'),
          period_end: format(parsedData.endDate, 'yyyy-MM-dd'),
          total_transactions: parsedData.transactions.length,
          status: 'processing',
          created_by: user.id
        })
        .select()
        .single();

      if (importError) throw importError;

      for (const txn of parsedData.transactions) {
        try {
          if (txn.fitid) {
            const { data: existing } = await supabase
              .from("bank_transactions")
              .select("id")
              .eq("bank_account_id", selectedAccount)
              .eq("fitid", txn.fitid)
              .maybeSingle();

            if (existing) {
              duplicateTransactions++;
              continue;
            }
          }

          const insertData = {
            bank_account_id: selectedAccount,
            transaction_date: format(txn.date, 'yyyy-MM-dd'),
            transaction_type: txn.type.toLowerCase() === 'credit' ? 'credit' : 'debit',
            amount: Math.abs(txn.amount),
            description: txn.memo || txn.description || 'Sem descrição',
            fitid: txn.fitid || null,
            created_by: user.id
          };

          const { error: txnError } = await supabase
            .from("bank_transactions")
            .insert(insertData);

          if (txnError) {
            console.error('Transaction insert error:', txnError);
            errors.push(`Erro na transação ${txn.fitid}: ${txnError.message} (code: ${txnError.code}, details: ${txnError.details})`);
            continue;
          }

          newTransactions++;
          totalAmount += txn.type === 'CREDIT' ? txn.amount : -txn.amount;
        } catch (error: any) {
          errors.push(`Erro ao importar transação: ${error.message}`);
        }
      }

      const totalDebits = parsedData.transactions
        .filter(t => t.type === 'DEBIT')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalCredits = parsedData.transactions
        .filter(t => t.type === 'CREDIT')
        .reduce((sum, t) => sum + t.amount, 0);

      await supabase
        .from("bank_imports")
        .update({
          status: errors.length > 0 ? 'completed' : 'completed',
          new_transactions: newTransactions,
          duplicated_transactions: duplicateTransactions,
          total_debits: totalDebits,
          total_credits: totalCredits,
          error_message: errors.length > 0 ? errors.join('; ') : null
        })
        .eq("id", importRecord.id);

      let aiResult = null;
      if (enableAI && newTransactions > 0) {
        const transactionsToProcess = parsedData.transactions.filter(txn => {
          return true;
        });
        aiResult = await processWithAI(transactionsToProcess, importRecord.id);
      }

      setImportResult({
        success: true,
        newTransactions,
        duplicateTransactions,
        totalAmount,
        errors,
        aiClassifications: aiResult?.classifications || [],
        entriesCreated: aiResult?.entries_created || 0
      });

      if (newTransactions > 0) {
        if (enableAI && aiResult?.entries_created > 0) {
          toast.success(`✅ ${newTransactions} transações importadas e ${aiResult.entries_created} lançamentos contábeis criados!`);
        } else {
          toast.success(`${newTransactions} transação(ões) importada(s) com sucesso!`);
        }
      } else {
        toast.info("Nenhuma transação nova para importar");
      }

      if (duplicateTransactions > 0) {
        toast.info(`${duplicateTransactions} transação(ões) já existia(m) no sistema`);
      }

      loadRecentImports();
      setParsedData(null);
    } catch (error: any) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar transações");
      setImportResult({
        success: false,
        newTransactions: 0,
        duplicateTransactions: 0,
        totalAmount: 0,
        errors: [error.message]
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  };

  const openClassificationDialog = (classifications: AIClassification[], importId: string) => {
    const lowConfidenceTxns = classifications
      .filter(c => !c.classification?.confidence || c.classification.confidence < 0.7)
      .map(c => ({
        id: c.fitid,
        fitid: c.fitid,
        description: c.description,
        amount: c.amount,
        type: c.type as 'CREDIT' | 'DEBIT',
        date: format(new Date(), 'yyyy-MM-dd'),
        ai_suggestion: c.classification ? {
          category: c.classification.category,
          debit_account: c.classification.debit_account,
          credit_account: c.classification.credit_account,
          confidence: c.classification.confidence,
          reasoning: c.classification.reasoning
        } : undefined
      }));

    if (lowConfidenceTxns.length > 0) {
      setPendingTransactions(lowConfidenceTxns);
      setCurrentImportId(importId);
      setShowClassificationDialog(true);
    }
  };

  const handleClassificationComplete = async (results: any[]) => {
    try {
      toast.success(`${results.length} transações classificadas manualmente!`);

      for (const result of results) {
        const { data: userData } = await supabase.auth.getUser();

        const { error } = await supabase
          .from('accounting_entries')
          .insert({
            entry_date: new Date().toISOString().split('T')[0],
            description: `Classificação manual: ${result.notes || 'Transação bancária'}`,
            entry_type: 'manual',
            status: 'posted',
            created_by: userData?.user?.id
          });

        if (error) {
          console.error('Erro ao criar lançamento:', error);
        }
      }

      loadRecentImports();
    } catch (error) {
      console.error('Erro ao processar classificações:', error);
      toast.error('Erro ao salvar classificações');
    }
  };

  const updateClassification = (fitid: string, field: keyof TransactionClassification, value: string) => {
    setClassifications(prev => ({
      ...prev,
      [fitid]: {
        ...prev[fitid],
        fitid,
        [field]: value
      }
    }));
  };

  const suggestAccountByCategory = (category: string, type: string): string => {
    if (type === 'CREDIT') {
      if (category === 'receita') return chartAccounts.find(a => a.code.startsWith('3.1'))?.id || '';
      if (category === 'transferencia') return chartAccounts.find(a => a.code.startsWith('1.1'))?.id || '';
    } else {
      if (category === 'despesa') return chartAccounts.find(a => a.code.startsWith('4.1'))?.id || '';
      if (category === 'investimento') return chartAccounts.find(a => a.code.startsWith('1.2'))?.id || '';
      if (category === 'transferencia') return chartAccounts.find(a => a.code.startsWith('1.1'))?.id || '';
    }
    return '';
  };

  const getFilteredAccounts = (category: string, type: string) => {
    if (!category) return chartAccounts;

    if (type === 'CREDIT') {
      if (category === 'receita') return chartAccounts.filter(a => a.account_type === 'Revenue' || a.code.startsWith('3'));
      if (category === 'transferencia') return chartAccounts.filter(a => a.account_type === 'Asset' || a.code.startsWith('1'));
    } else {
      if (category === 'despesa') return chartAccounts.filter(a => a.account_type === 'Expense' || a.code.startsWith('4'));
      if (category === 'investimento') return chartAccounts.filter(a => a.account_type === 'Asset' || a.code.startsWith('1.2'));
      if (category === 'transferencia') return chartAccounts.filter(a => a.account_type === 'Asset' || a.code.startsWith('1'));
    }
    return chartAccounts;
  };

  const openManualClassification = () => {
    if (!parsedData) return;

    const txns = parsedData.transactions.map(txn => ({
      id: txn.fitid,
      fitid: txn.fitid,
      description: txn.description || txn.memo || 'Sem descrição',
      amount: txn.amount,
      type: txn.type as 'CREDIT' | 'DEBIT',
      date: format(txn.date, 'yyyy-MM-dd')
    }));

    setPendingTransactions(txns);
    setCurrentImportId('manual');
    setShowClassificationDialog(true);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Importar Extrato Bancário</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Importe arquivos OFX do seu banco (Sicredi, Banco do Brasil, etc.)
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Importar Arquivo OFX</CardTitle>
            <CardDescription>
              Selecione a conta bancária e faça upload do arquivo .ofx
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_account">Conta Bancária</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {account.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ofx_file">Arquivo OFX</Label>
              <input
                type="file"
                id="ofx_file"
                accept=".ofx,.OFX"
                title="Selecione um arquivo OFX do seu banco"
                onChange={handleFileSelect}
                disabled={!selectedAccount || previewing || loading}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-sm text-muted-foreground">
                Arquivos OFX exportados do internet banking do seu banco
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3">
                <Brain className="h-6 w-6 text-purple-600 shrink-0" />
                <div>
                  <p className="font-medium">Classificação Automática com IA</p>
                  <p className="text-sm text-muted-foreground">
                    O Contador IA e o Agente Financeiro irão classificar e gerar lançamentos contábeis automaticamente
                  </p>
                </div>
              </div>
              <Switch
                checked={enableAI}
                onCheckedChange={setEnableAI}
                className="shrink-0"
              />
            </div>

            {previewing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processando arquivo...</span>
              </div>
            )}

            <AIAssistantChat
              context="bank_import"
              contextId={selectedAccount || undefined}
              compact
              className="mt-4"
            />
          </CardContent>
        </Card>

        {parsedData && !importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Preview do Arquivo
              </CardTitle>
              <CardDescription>
                Revise as transações antes de importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {formatDate(parsedData.startDate)} - {formatDate(parsedData.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transações</p>
                  <p className="font-medium">{parsedData.transactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conta</p>
                  <p className="font-medium">{parsedData.accountNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Final</p>
                  <p className="font-medium">{formatCurrency(parsedData.balanceAmount)}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted rounded-lg gap-3">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Classificação Manual Inline</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">(categorize cada transação antes de importar)</span>
                </div>
                <Switch
                  checked={showInlineClassification}
                  onCheckedChange={setShowInlineClassification}
                />
              </div>

              <div className="max-h-[500px] overflow-auto">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[90px]">Data</TableHead>
                        <TableHead className="w-[80px]">Tipo</TableHead>
                        <TableHead className="min-w-[200px]">Descrição</TableHead>
                        <TableHead className="text-right w-[100px]">Valor</TableHead>
                        {showInlineClassification && (
                          <>
                            <TableHead className="w-[130px]">Categoria</TableHead>
                            <TableHead className="w-[150px]">Centro Custo</TableHead>
                            <TableHead className="w-[200px]">Conta Contábil</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.transactions.map((txn, idx) => {
                        const classification: Partial<TransactionClassification> = classifications[txn.fitid] || {};
                        const filteredAccounts = getFilteredAccounts(classification.category || '', txn.type);

                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{formatDate(txn.date)}</TableCell>
                            <TableCell>
                              <Badge variant={txn.type === 'CREDIT' ? 'default' : 'secondary'} className="text-xs">
                                {txn.type === 'CREDIT' ? 'Crédito' : 'Débito'}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm" title={txn.description}>
                              {txn.description}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-mono text-sm ${txn.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                {txn.type === 'CREDIT' ? '+' : '-'}{formatCurrency(txn.amount)}
                              </span>
                            </TableCell>
                            {showInlineClassification && (
                              <>
                                <TableCell>
                                  <Select
                                    value={classification.category || ''}
                                    onValueChange={(value) => {
                                      updateClassification(txn.fitid, 'category', value as any);
                                      const suggestedAccount = suggestAccountByCategory(value, txn.type);
                                      if (suggestedAccount) {
                                        updateClassification(txn.fitid, 'account_id', suggestedAccount);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {txn.type === 'DEBIT' ? (
                                        <>
                                          <SelectItem value="despesa">Despesa</SelectItem>
                                          <SelectItem value="investimento">Investimento</SelectItem>
                                          <SelectItem value="transferencia">Transferência</SelectItem>
                                        </>
                                      ) : (
                                        <>
                                          <SelectItem value="receita">Receita</SelectItem>
                                          <SelectItem value="transferencia">Transferência</SelectItem>
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={classification.cost_center_id || ''}
                                    onValueChange={(value) => updateClassification(txn.fitid, 'cost_center_id', value)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Centro Custo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {costCenters.map(cc => (
                                        <SelectItem key={cc.id} value={cc.id} className="text-xs">
                                          {cc.code}. {cc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={classification.account_id || ''}
                                    onValueChange={(value) => updateClassification(txn.fitid, 'account_id', value)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Conta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {filteredAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                          {acc.code} - {acc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {showInlineClassification && Object.keys(classifications).length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Save className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {Object.keys(classifications).length} transação(ões) classificada(s) manualmente
                    </span>
                  </div>
                </div>
              )}

              {aiProcessing && (
                <div className="space-y-2 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600 animate-pulse" />
                    <span className="font-medium text-purple-700 dark:text-purple-300">
                      Processando com IA...
                    </span>
                  </div>
                  <Progress value={aiProgress} className="h-2" />
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    {aiProgress < 20 && "Preparando transações..."}
                    {aiProgress >= 20 && aiProgress < 80 && "🧠 Contador IA e Agente Financeiro analisando..."}
                    {aiProgress >= 80 && aiProgress < 100 && "📝 Gerando lançamentos contábeis..."}
                    {aiProgress >= 100 && "✅ Classificação concluída!"}
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={() => setParsedData(null)} disabled={loading || aiProcessing} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button variant="secondary" onClick={openManualClassification} disabled={loading || aiProcessing} className="w-full sm:w-auto">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Classificar Manualmente
                </Button>
                <Button onClick={handleImport} disabled={loading || aiProcessing} className="w-full sm:w-auto">
                  {loading || aiProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {aiProcessing ? "Processando IA..." : "Importando..."}
                    </>
                  ) : (
                    <>
                      {enableAI ? <Brain className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      {enableAI ? "Importar e Classificar com IA" : "Importar Transações"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                Resultado da Importação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Novas Transações</p>
                  <p className="text-2xl font-bold text-green-600">{importResult.newTransactions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duplicadas</p>
                  <p className="text-2xl font-bold text-yellow-600">{importResult.duplicateTransactions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Impacto no Saldo</p>
                  <p className={`text-2xl font-bold ${importResult.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(importResult.totalAmount)}
                  </p>
                </div>
                {importResult.entriesCreated !== undefined && importResult.entriesCreated > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <BookOpen className="h-4 w-4" /> Lançamentos Contábeis
                    </p>
                    <p className="text-2xl font-bold text-purple-600">{importResult.entriesCreated}</p>
                  </div>
                )}
              </div>

              {importResult.aiClassifications && importResult.aiClassifications.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    <p className="font-medium">Classificações do Contador IA</p>
                  </div>
                  <div className="max-h-64 overflow-auto border rounded-lg">
                    <div className="min-w-[700px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Contas</TableHead>
                            <TableHead>Confiança</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResult.aiClassifications.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="max-w-[200px] truncate">
                                {item.description}
                              </TableCell>
                              <TableCell>
                                <span className={item.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                                  {item.type === 'CREDIT' ? '+' : '-'}{formatCurrency(item.amount)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.classification?.category}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                <span className="text-blue-600">D: {item.classification?.debit_account}</span>
                                <br />
                                <span className="text-green-600">C: {item.classification?.credit_account}</span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={item.classification?.confidence >= 0.8 ? 'default' : 'secondary'}
                                >
                                  {Math.round((item.classification?.confidence || 0) * 100)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-destructive">Erros:</p>
                  <ul className="space-y-1">
                    {importResult.errors.map((error, idx) => (
                      <li key={idx} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button onClick={() => { setImportResult(null); setAiClassifications([]); }} className="w-full sm:w-auto">
                  Nova Importação
                </Button>
                {importResult.aiClassifications && importResult.aiClassifications.some((c: any) =>
                  !c.classification?.confidence || c.classification.confidence < 0.7
                ) && (
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => openClassificationDialog(importResult.aiClassifications as AIClassification[], currentImportId)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Revisar Classificações ({importResult.aiClassifications.filter((c: any) =>
                        !c.classification?.confidence || c.classification.confidence < 0.7
                      ).length} pendentes)
                    </Button>
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Importações Recentes</CardTitle>
            <CardDescription>Histórico das últimas importações realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentImports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma importação realizada ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Novas</TableHead>
                        <TableHead className="text-center">Duplicadas</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentImports.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell>{formatDate(imp.import_date)}</TableCell>
                          <TableCell>{imp.bank_accounts?.name}</TableCell>
                          <TableCell className="text-sm">
                            {imp.period_start && imp.period_end ? `${formatDate(imp.period_start)} - ${formatDate(imp.period_end)}` : '-'}
                          </TableCell>
                          <TableCell className="text-center">{imp.total_transactions}</TableCell>
                          <TableCell className="text-center text-green-600 font-medium">
                            {imp.new_transactions}
                          </TableCell>
                          <TableCell className="text-center text-yellow-600">
                            {imp.duplicated_transactions}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                imp.status === 'completed' ? 'default' :
                                  imp.status === 'failed' ? 'destructive' : 'secondary'
                              }
                            >
                              {imp.status === 'completed' ? 'Concluído' :
                                imp.status === 'failed' ? 'Erro' :
                                  imp.status === 'processing' ? 'Processando' : imp.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AIClassificationDialog
        open={showClassificationDialog}
        onOpenChange={setShowClassificationDialog}
        transactions={pendingTransactions}
        bankAccountId={selectedAccount}
        importId={currentImportId}
        onComplete={handleClassificationComplete}
      />
    </Layout>
  );
};

export default BankImport;