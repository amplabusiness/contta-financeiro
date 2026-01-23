import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent } from "react";
import { useAccounting } from "@/hooks/useAccounting";
import { AccountingService } from "@/services/AccountingService";
import { FinancialIntelligenceService, ClassificationSuggestion } from "@/services/FinancialIntelligenceService";
import { BoletoReconciliationService, BoletoMatch } from "@/services/BoletoReconciliationService";
import { formatCurrency } from "@/data/expensesData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, Wallet, Receipt, SplitSquareHorizontal, Upload, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Maximize2, Minimize2, ExternalLink, FileText, Zap, Sparkles, User, Building2, ShieldCheck, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { CobrancaImporter } from "@/components/CobrancaImporter";
import { CollectionClientBreakdown } from "@/components/CollectionClientBreakdown";
import { ReconciliationReport } from "@/components/ReconciliationReport";
import { AIClassificationReport } from "@/components/AIClassificationReport";
import { parseExtratoBancarioCSV } from "@/lib/csvParser";
import { parseOFX } from "@/lib/ofxParser";
import { getAccountBalance, ACCOUNT_MAPPING } from "@/lib/accountMapping";

interface BankTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  matched: boolean;
  journal_entry_id?: string;
  // Campos de automação Sprint 1
  extracted_cnpj?: string;
  extracted_cpf?: string;
  extracted_cob?: string;
  suggested_client_id?: string;
  suggested_client_name?: string;
  identification_confidence?: number;
  identification_method?: string;
  auto_matched?: boolean;
  needs_review?: boolean;
}

interface ManualSplitItem {
  accountCode: string;
  amount: number;
}

function AccountSelector({ 
  value, 
  onChange, 
  accounts 
}: { 
  value: string, 
  onChange: (code: string) => void,
  accounts: {code: string, name: string}[] 
}) {
  const [open, setOpen] = useState(false);
  const selectedAccount = accounts.find((a) => a.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-6 p-0 px-1 text-xs font-normal hover:bg-slate-100"
        >
          {selectedAccount ? (
            <span className="truncate flex items-center gap-1.5">
              <span className="font-mono text-slate-500">{selectedAccount.code}</span>
              {selectedAccount.name}
            </span>
          ) : (
            <span className="text-red-400 italic">Selecione...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[90vw] sm:w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar conta (nome ou código)..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>Conta não encontrada.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {accounts.map((acc) => (
                <CommandItem
                  key={acc.code}
                  value={`${acc.code} ${acc.name}`}
                  onSelect={() => {
                    onChange(acc.code);
                    setOpen(false);
                  }}
                  className="text-xs py-1"
                >
                  <span className="font-mono text-slate-500 w-20 shrink-0">{acc.code}</span>
                  {acc.name}
                  <CheckCircle2
                    className={`ml-auto h-3 w-3 ${value === acc.code ? "opacity-100" : "opacity-0"}`}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function SuperConciliation() {
  const navigate = useNavigate();
  const { tenant } = useTenantConfig();
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualType, setManualType] = useState<'split' | 'expense' | null>(null);
  const [splitItems, setSplitItems] = useState<ManualSplitItem[]>([]);
  const [selectedExpenseAccount, setSelectedExpenseAccount] = useState("");
  const [availableAccounts, setAvailableAccounts] = useState<{code: string, name: string}[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const saved = localStorage.getItem('super-conciliation-date');
    if (saved) return new Date(saved);
    return new Date(2025, 0, 1);
  });

  useEffect(() => {
    if (selectedDate) {
        localStorage.setItem('super-conciliation-date', selectedDate.toISOString());
    }
  }, [selectedDate]);

  const [viewMode, setViewMode] = useState<'pending' | 'review' | 'ai_report' | 'boletos'>('pending');
  const [bankAccountCode, setBankAccountCode] = useState("1.1.1.05");
  const [identifyingPayers, setIdentifyingPayers] = useState(false);
  const [balances, setBalances] = useState({ prev: 0, start: 0, final: 0 });
  const [balanceDetails, setBalanceDetails] = useState({
      base: 0,
      prevCredits: 0,
      prevDebits: 0,
      monthCredits: 0,
      monthDebits: 0,
      divergence: 0
  });
  
  useEffect(() => {
     const fetchBankCode = async () => {
         const { data } = await supabase.from('chart_of_accounts').select('code').ilike('name', '%Sicredi%').limit(1).single();
         if (data) setBankAccountCode(data.code);
     };
     fetchBankCode();
  }, []);

    const handleExtratoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const lower = file.name.toLowerCase();

        try {
            setLoadingTx(true);

            if (lower.endsWith('.ofx')) {
                const content = await file.text();

                // Tentar Edge Function primeiro, se falhar usa parser local
                let parsedData;
                let useLocalParser = false;

                try {
                    const { data, error } = await supabase.functions.invoke('parse-ofx-statement', {
                        body: { ofx_content: content }
                    });
                    if (error) {
                        console.warn('Edge Function indisponível, usando parser local:', error);
                        useLocalParser = true;
                    } else {
                        parsedData = data;
                    }
                } catch (edgeFnError) {
                    console.warn('Edge Function indisponível, usando parser local:', edgeFnError);
                    useLocalParser = true;
                }

                // Fallback para parser local
                if (useLocalParser) {
                    const parseResult = await parseOFX(content);
                    if (!parseResult.success || !parseResult.data) {
                        throw new Error(parseResult.error || 'Erro ao processar arquivo OFX');
                    }

                    // Buscar fitids já existentes para evitar duplicados (com batching para arquivos grandes)
                    const fitids = parseResult.data.transactions.map(tx => tx.fitid);
                    const BATCH_SIZE = 100;
                    const existingFitids = new Set<string>();

                    // Processar FITIDs em lotes para evitar URLs muito longas
                    for (let i = 0; i < fitids.length; i += BATCH_SIZE) {
                        const batch = fitids.slice(i, i + BATCH_SIZE);
                        const { data: existingTx } = await supabase
                            .from('bank_transactions')
                            .select('fitid')
                            .in('fitid', batch);

                        (existingTx || []).forEach(t => existingFitids.add(t.fitid));
                    }

                    // Filtrar apenas transações novas E com dados válidos (amount não pode ser null)
                    const newTransactions = parseResult.data.transactions.filter(
                        tx => !existingFitids.has(tx.fitid) &&
                              tx.amount != null &&
                              !isNaN(tx.amount) &&
                              tx.date != null
                    );

                    // Contar transações inválidas para feedback
                    const invalidCount = parseResult.data.transactions.filter(
                        tx => tx.amount == null || isNaN(tx.amount) || tx.date == null
                    ).length;

                    if (newTransactions.length === 0) {
                        if (invalidCount > 0) {
                            toast.warning(`${invalidCount} transações ignoradas (dados inválidos). Nenhuma nova transação para importar.`);
                        } else {
                            toast.info('Todas as transações já foram importadas anteriormente');
                        }
                    } else {
                        // Inserir transações diretamente no banco (com batching para arquivos grandes)
                        const { data: userData } = await supabase.auth.getUser();
                        const userId = userData.user?.id;

                        const transactionsToInsert = newTransactions.map(tx => ({
                            transaction_date: tx.date.toISOString().split('T')[0],
                            description: tx.description || 'Sem descrição',
                            amount: tx.type === 'DEBIT' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
                            transaction_type: tx.type === 'DEBIT' ? 'debit' : 'credit',
                            fitid: tx.fitid,
                            matched: false,
                            created_by: userId,
                            imported_from: 'ofx_local',
                            tenant_id: tenant?.id // CRÍTICO: necessário para automação funcionar
                        }));

                        // Inserir em lotes de 100 para evitar timeout/limites
                        const INSERT_BATCH_SIZE = 100;
                        let insertedCount = 0;
                        for (let i = 0; i < transactionsToInsert.length; i += INSERT_BATCH_SIZE) {
                            const batch = transactionsToInsert.slice(i, i + INSERT_BATCH_SIZE);
                            const { error: insertError } = await supabase
                                .from('bank_transactions')
                                .insert(batch);

                            if (insertError) {
                                throw new Error(`Erro ao inserir transações (lote ${Math.floor(i/INSERT_BATCH_SIZE) + 1}): ` + insertError.message);
                            }
                            insertedCount += batch.length;
                        }

                        if (invalidCount > 0) {
                            toast.success(`OFX importado: ${insertedCount} lançamentos (${invalidCount} ignorados por dados inválidos)`);
                        } else {
                            toast.success(`Extrato OFX importado via parser local (${insertedCount} lançamentos)`);
                        }
                    }
                } else {
                    const imported = parsedData?.imported ?? parsedData?.transactions?.length ?? 0;
                    toast.success(`Extrato OFX importado (${imported} lançamentos)`);
                }
            } else if (lower.endsWith('.csv')) {
                const text = await file.text();
                const { transacoes } = parseExtratoBancarioCSV(text);
                const { data, error } = await supabase.functions.invoke('process-extrato-csv', {
                    body: { transacoes }
                });
                if (error) throw error;
                const imported = data?.imported ?? transacoes.length;
                toast.success(`CSV do extrato importado (${imported} linhas)`);
            } else {
                toast.error('Formato não suportado. Use .ofx ou .csv');
                return;
            }

            e.target.value = '';
            await fetchTransactions();
        } catch (err: any) {
            console.error('Erro ao importar extrato:', err);
            toast.error(err?.message || 'Erro ao importar extrato');
        } finally {
            setLoadingTx(false);
        }
    };

    const fetchTransactions = useCallback(async () => {
        setLoadingTx(true);
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString();
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString();

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth() + 1; // 1-indexed para a função

        // =====================================================
        // FONTE DE VERDADE: CONTABILIDADE (conta 1.1.1.05)
        // =====================================================
        // Busca o saldo da conta bancária diretamente da contabilidade
        // Fórmula: Saldo Inicial (antes do mês) + Débitos - Créditos = Saldo Final
        // Para conta DEVEDORA (Ativo): Débito aumenta, Crédito diminui

        try {
            // Usar a mesma função que o Dashboard usa (fonte única de verdade)
            const accountingBalance = await getAccountBalance(
                ACCOUNT_MAPPING.SALDO_BANCO_SICREDI, // "1.1.1.05"
                year,
                month
            );

            // Saldo Inicial = openingBalance (saldo antes do período)
            const valStart = accountingBalance.openingBalance;

            // Entradas = Débitos (aumentam conta devedora)
            const monthCredits = accountingBalance.debit;

            // Saídas = Créditos (diminuem conta devedora) - mostrar como negativo
            const monthDebits = -accountingBalance.credit;

            // Saldo Final = balance (já calculado pela função)
            const valFinal = accountingBalance.balance;

            // Mês anterior para exibição
            const valPrev = valStart;

            setBalances({ prev: valPrev, start: valStart, final: valFinal });
            setBalanceDetails({
                base: 0,
                prevCredits: 0, // Não precisamos mais desse detalhe
                prevDebits: 0,
                monthCredits: monthCredits,
                monthDebits: monthDebits,
                divergence: 0
            });

            console.log('[SuperConciliation] Saldos da contabilidade:', {
                conta: ACCOUNT_MAPPING.SALDO_BANCO_SICREDI,
                periodo: `${month}/${year}`,
                saldoInicial: valStart,
                debitos: monthCredits,
                creditos: accountingBalance.credit,
                saldoFinal: valFinal
            });

        } catch (err) {
            console.error('[SuperConciliation] Erro ao buscar saldo contábil, usando fallback:', err);

            // Fallback para bank_transactions se a contabilidade falhar
            const firstDayOfMonth = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), 'yyyy-MM-dd');

            const { data: bankAccount } = await supabase
                .from('bank_accounts')
                .select('initial_balance, initial_balance_date')
                .eq('is_active', true)
                .single();

            let openingBalance = 0;
            if (bankAccount?.initial_balance && bankAccount?.initial_balance_date) {
                const openingDate = bankAccount.initial_balance_date;
                if (openingDate < firstDayOfMonth) {
                    openingBalance = Number(bankAccount.initial_balance) || 0;
                }
            }

            const { data: txBeforeMonth } = await supabase
                .from('bank_transactions')
                .select('amount')
                .lt('transaction_date', firstDayOfMonth);

            const txSumBefore = (txBeforeMonth || []).reduce((acc, tx) => acc + Number(tx.amount), 0);
            const valStart = openingBalance + txSumBefore;

            const firstDateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), 'yyyy-MM-dd');
            const lastDateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0), 'yyyy-MM-dd');

            const { data: txInMonth } = await supabase
                .from('bank_transactions')
                .select('amount')
                .gte('transaction_date', firstDateStr)
                .lte('transaction_date', lastDateStr)
                .order('transaction_date', { ascending: true });

            const detailsMonth = {
                credits: (txInMonth || []).reduce((acc, tx) => acc + (Number(tx.amount) > 0 ? Number(tx.amount) : 0), 0),
                debits: (txInMonth || []).reduce((acc, tx) => acc + (Number(tx.amount) < 0 ? Number(tx.amount) : 0), 0)
            };

            const sumMonth = detailsMonth.credits + detailsMonth.debits;
            const valFinal = valStart + sumMonth;

            setBalances({ prev: valStart, start: valStart, final: valFinal });
            setBalanceDetails({
                base: 0,
                prevCredits: (txBeforeMonth || []).reduce((acc, tx) => acc + (Number(tx.amount) > 0 ? Number(tx.amount) : 0), 0),
                prevDebits: (txBeforeMonth || []).reduce((acc, tx) => acc + (Number(tx.amount) < 0 ? Number(tx.amount) : 0), 0),
                monthCredits: detailsMonth.credits,
                monthDebits: detailsMonth.debits,
                divergence: 0
            });
        }

        let query = supabase
            .from('bank_transactions')
            .select(`
                *,
                suggested_client:clients!bank_transactions_suggested_client_id_fkey(id, name)
            `)
            .gte('transaction_date', startOfMonth)
            .lte('transaction_date', endOfMonth)
            .order('transaction_date', { ascending: true });

        // Filtros por aba:
        // - Pendentes: transações não conciliadas E que NÃO precisam de revisão (ainda não foram processadas)
        // - Revisão/Auditoria: transações não conciliadas E que PRECISAM de revisão (foram processadas pela IA ou manualmente mas aguardam aprovação)
        if (viewMode === 'pending') {
             query = query
                .eq('matched', false)
                .or('needs_review.is.null,needs_review.eq.false');
        } else if (viewMode === 'review') {
             query = query
                .eq('matched', false)
                .eq('needs_review', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Erro ao buscar transações:", error);
            toast.error("Erro ao carregar extrato bancário");
        } else {
            const mapped: BankTransaction[] = (data || []).map(tx => {
                let amt = Number(tx.amount);
                if (tx.transaction_type === 'debit' && amt > 0) {
                    amt = -amt;
                }
                return {
                    id: tx.id,
                    amount: amt,
                    date: tx.transaction_date,
                    description: tx.description,
                    matched: tx.matched,
                    journal_entry_id: tx.journal_entry_id,
                    // Campos de automação
                    extracted_cnpj: tx.extracted_cnpj,
                    extracted_cpf: tx.extracted_cpf,
                    extracted_cob: tx.extracted_cob,
                    suggested_client_id: tx.suggested_client_id,
                    suggested_client_name: tx.suggested_client?.name,
                    identification_confidence: tx.identification_confidence,
                    identification_method: tx.identification_method,
                    auto_matched: tx.auto_matched,
                    needs_review: tx.needs_review
                };
            });
            setTransactions(mapped);
        }
        setLoadingTx(false);
        setPage(1);
    }, [selectedDate, viewMode]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    // Função para executar identificação de pagadores via SQL
    const handleIdentifyPayers = async () => {
        setIdentifyingPayers(true);
        try {
            // Chamar a função SQL fn_identify_payers_batch diretamente
            const { data, error } = await supabase.rpc('fn_identify_payers_batch', {
                p_tenant_id: tenant?.id || null,
                p_limit: 200
            });

            if (error) {
                // Se a função SQL não existir, tentar Edge Function
                console.warn('fn_identify_payers_batch não disponível, tentando Edge Function:', error);

                const { data: efData, error: efError } = await supabase.functions.invoke('ai-payer-identifier', {
                    body: { action: 'identify_batch', tenant_id: tenant?.id }
                });

                if (efError) {
                    throw new Error('Identificação não disponível: ' + efError.message);
                }

                const stats = efData?.data || efData;
                toast.success(
                    `Identificação concluída: ${stats?.identified || 0} identificados, ${stats?.auto_matched || 0} auto-conciliados`
                );
            } else {
                const stats = data as any;
                toast.success(
                    `Identificação concluída: ${stats?.identified || 0} identificados, ${stats?.auto_matched || 0} auto-conciliados`
                );
            }

            // Recarregar transações para mostrar os resultados
            await fetchTransactions();
        } catch (err: any) {
            console.error('Erro na identificação de pagadores:', err);
            toast.error('Erro ao identificar pagadores: ' + err.message);
        } finally {
            setIdentifyingPayers(false);
        }
    };

  useEffect(() => {
    const fetchAccounts = async () => {
        // Primeiro verificar se existe alguma conta
        const { data: anyAccount, error: checkError } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .limit(1);

        // Se não existir nenhuma conta, auto-inicializar o plano de contas
        if (!anyAccount || anyAccount.length === 0) {
            console.log('[SuperConciliation] Plano de contas vazio, inicializando automaticamente...');
            toast.info('Inicializando plano de contas para novo cliente...');

            try {
                const accountingService = new AccountingService();
                const result = await accountingService.initializeChartOfAccounts();
                if (result.success) {
                    console.log('[SuperConciliation] Plano de contas inicializado com sucesso');
                    toast.success('Plano de contas criado automaticamente!');

                    // Também criar contas para clientes existentes
                    const clientResult = await accountingService.ensureAllClientAccounts();
                    if (clientResult.success && clientResult.message?.includes('criadas')) {
                        console.log('[SuperConciliation] Contas de clientes criadas:', clientResult.message);
                        toast.success(clientResult.message);
                    }
                } else {
                    console.warn('[SuperConciliation] Erro ao inicializar plano de contas:', result.error);
                }
            } catch (initError) {
                console.error('[SuperConciliation] Erro ao inicializar plano de contas:', initError);
            }
        } else {
            // Mesmo se o plano existe, verificar se há clientes sem conta
            try {
                const accountingService = new AccountingService();
                const clientResult = await accountingService.ensureAllClientAccounts();
                if (clientResult.success && clientResult.message?.includes('criadas')) {
                    console.log('[SuperConciliation] Contas de clientes criadas:', clientResult.message);
                    toast.info(clientResult.message);
                }
            } catch (err) {
                console.warn('[SuperConciliation] Erro ao verificar contas de clientes:', err);
            }
        }

        // Buscar contas analíticas para uso na interface
        const { data } = await supabase
            .from('chart_of_accounts')
            .select('code, name')
            .eq('is_analytical', true)
            .eq('is_active', true)
            .or('code.ilike.3.%,code.ilike.4.%,code.ilike.2.1.%,code.ilike.1.1.2.%,code.ilike.1.1.1.%,code.ilike.1.1.3.%')
            .order('code');
        if (data) setAvailableAccounts(data);
    };
    fetchAccounts();
  }, []);

    const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
    const pagedTransactions = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

  useEffect(() => {
    if (!selectedTx || isManualMode) { 
        if (!selectedTx) setSuggestion(null);
        return;
    };
    
    if (selectedTx.matched && selectedTx.journal_entry_id) {
        const fetchJournal = async () => {
            setLoading(true);
            const { data: lines } = await supabase
                .from('accounting_entry_lines')
                .select(`
                    debit, credit, 
                    chart_of_accounts ( code, name )
                `)
                .eq('entry_id', selectedTx.journal_entry_id);
            
            if (lines) {
                const displayEntries = lines.map((line: any) => {
                      const isDebit = Number(line.debit) > 0;
                      const val = isDebit ? line.debit : line.credit;
                      
                      return {
                          debit: isDebit ? { account: line.chart_of_accounts?.code, name: line.chart_of_accounts?.name } : { account: '---', name: '' },
                          credit: !isDebit ? { account: line.chart_of_accounts?.code, name: line.chart_of_accounts?.name } : { account: '---', name: '' },
                          value: val
                      };
                });

                setSuggestion({
                    description: "Lançamento Registrado (Banco de Dados)",
                    type: 'revenue_current',
                    reasoning: "Dados extraídos diretamente do lançamento contábil vinculado.",
                    entries: displayEntries
                });
            }
            setLoading(false);
        };
        fetchJournal();
        return;
    }
    
    const analyzeTransaction = async () => {
      setLoading(true);
      try {
        const result = await FinancialIntelligenceService.analyzeBankTransaction(
            selectedTx.amount,
            selectedTx.date,
            selectedTx.description,
            bankAccountCode
        );

        const isReceipt = selectedTx.amount > 0;
        const bankName = availableAccounts.find(a => a.code === bankAccountCode)?.name || 'Banco Sicredi';

        const enforcedEntries = result.entries.map(e => {
            if (isReceipt) {
                return {
                    ...e,
                    debit: { account: bankAccountCode, name: bankName },
                    credit: e.credit
                };
            } else {
                return {
                    ...e,
                    debit: e.debit,
                    credit: { account: bankAccountCode, name: bankName }
                };
            }
        });

        setSuggestion({ ...result, entries: enforcedEntries });

      } catch (error) {
        toast.error("Erro ao analisar transação");
      } finally {
        setLoading(false);
      }
    };

    analyzeTransaction();
  }, [selectedTx, isManualMode, bankAccountCode]);

  const handleUnmatch = async () => {
      if (!selectedTx) return;
      
      const hasEntry = !!selectedTx.journal_entry_id;
      const confirmMsg = hasEntry 
        ? "Tem certeza? Isso apagará o lançamento contábil original e permitirá reclassificar."
        : "Esta transação está marcada como conciliada sem lançamento vinculado. Deseja reabrir para edição?";

      if (!confirm(confirmMsg)) return;

      setLoading(true);
      try {
          if (hasEntry) {
            const { error: delError } = await supabase
                .from('accounting_entries')
                .delete()
                .eq('id', selectedTx.journal_entry_id);
                
            if (delError) throw new Error("Erro ao apagar lançamento: " + delError.message);
          }

          const { error: updateError } = await supabase
            .from('bank_transactions')
            .update({ matched: false, journal_entry_id: null })
            .eq('id', selectedTx.id);

          if (updateError) throw new Error("Erro ao atualizar banco: " + updateError.message);

          toast.success("Transação reaberta para edição!");
          
          const updated = { ...selectedTx, matched: false, journal_entry_id: undefined };
          setSelectedTx(updated);
          setTransactions(prev => prev.map(t => t.id === selectedTx.id ? updated : t));
          
          setIsManualMode(false);
          setSuggestion(null); 

      } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
          toast.error(errorMessage);
      } finally {
          setLoading(false);
      }
  };

  const applyManualSplit = () => {
      if (!selectedTx) return;
      
      const totalSplit = splitItems.reduce((acc, i) => acc + i.amount, 0);
      if (Math.abs(totalSplit - Math.abs(selectedTx.amount)) > 0.01) {
          toast.error(`A soma (${totalSplit}) difere do valor da transação (${Math.abs(selectedTx.amount)})`);
          return;
      }
      
      const isReceipt = selectedTx.amount > 0;

      const newSuggestion: ClassificationSuggestion = {
          description: isReceipt ? "Recebimento Múltiplo (Manual)" : "Pagamento Múltiplo (Manual)",
          type: 'split',
          reasoning: "Definido manualmente pelo usuário",
          entries: splitItems.map(item => {
             const acc = availableAccounts.find(a => a.code === item.accountCode);
             const bankAccName = availableAccounts.find(a => a.code === bankAccountCode)?.name || 'Banco Sicredi';
             if (isReceipt) {
                 return {
                    debit: { account: bankAccountCode, name: bankAccName },
                    credit: { account: item.accountCode, name: acc ? acc.name : 'Conta' },
                    value: item.amount 
                 };
             } else {
                 return {
                    debit: { account: item.accountCode, name: acc ? acc.name : 'Conta' },
                    credit: { account: bankAccountCode, name: bankAccName },
                    value: item.amount 
                 };
             }
          })
      };
      
      setSuggestion(newSuggestion);
      setIsManualMode(false);
      setManualType(null);
  };

  const applyManualExpense = () => {
      if (!selectedTx || !selectedExpenseAccount) return;
      
      const account = availableAccounts.find(a => a.code === selectedExpenseAccount);
      if (!account) return;

      const newSuggestion: ClassificationSuggestion = {
          description: "Despesa (Manual)",
          type: 'expense_current',
          reasoning: "Classificação manual de despesa",
          entries: [{
              debit: { account: account.code, name: account.name },
              credit: { account: bankAccountCode, name: 'Banco' },
              value: Math.abs(selectedTx.amount)
          }]
      };
      
      setSuggestion(newSuggestion);
      setIsManualMode(false);
      setManualType(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    toast.info("Importação via arquivo simulada.");
  };

  const handleConfirm = async () => {
    if (!selectedTx || !suggestion) return;

    setLoading(true);
    try {
        const codes = suggestion.entries.flatMap(e => [e.debit.account, e.credit.account]);
        const uniqueCodes = [...new Set(codes)];
        
        const { data: accountsData, error: accountsError } = await supabase
            .from('chart_of_accounts')
            .select('id, code')
            .in('code', uniqueCodes);

        if (accountsError) throw new Error("Erro ao buscar contas no plano: " + accountsError.message);
        
        const accountMap = new Map<string, string>();
        accountsData?.forEach(acc => accountMap.set(acc.code, acc.id));

        // Verificar lançamento existente por transaction_id, reference_id OU source_id
        // (lançamentos automáticos usam source_id, manuais usam reference_id)
        const { data: existingEntry } = await supabase
            .from('accounting_entries')
            .select('id')
            .or(`transaction_id.eq.${selectedTx.id},reference_id.eq.${selectedTx.id},source_id.eq.${selectedTx.id}`)
            .maybeSingle();

        // Gerar internal_code único no cliente para evitar colisões
        const dateStr = selectedTx.date.replace(/-/g, '');
        const uniquePart = crypto.randomUUID().substring(0, 8);
        const internalCode = `bank_transaction:${dateStr}:${uniquePart}`;

        const entryPayload = {
            entry_type: 'manual',
            description: suggestion.description,
            entry_date: selectedTx.date,
            competence_date: selectedTx.date,
            reference_type: 'bank_transaction',
            reference_id: selectedTx.id,
            source_type: 'bank_transaction',
            source_id: selectedTx.id,
            internal_code: internalCode,
            document_number: selectedTx.description?.substring(0, 50),
            total_debit: suggestion.entries.reduce((sum, e) => sum + e.value, 0),
            total_credit: suggestion.entries.reduce((sum, e) => sum + e.value, 0),
            balanced: true,
            created_by: (await supabase.auth.getUser()).data.user?.id
        };

        let entryData: { id: string } | null = null;
        let entryError = null;

        if (existingEntry) {
             const { data: updated, error: updError } = await supabase
                .from('accounting_entries')
                .update(entryPayload)
                .eq('id', existingEntry.id)
                .select()
                .single();
             entryData = updated;
             entryError = updError;
             
             if (!updError) {
                 await supabase.from('accounting_entry_lines').delete().eq('entry_id', existingEntry.id);
             }
        } else {
            const { data: inserted, error: insError } = await supabase
                .from('accounting_entries')
                .insert(entryPayload)
                .select()
                .single();
            entryData = inserted;
            entryError = insError;
        }

        if (entryError) throw new Error("Erro ao criar lançamento: " + entryError.message);

        if (!entryData || !entryData.id) {
            throw new Error("Erro ao criar lançamento: nenhum ID retornado do banco de dados");
        }

        const rawLines = suggestion.entries.flatMap(entry => [
            { code: entry.debit.account, name: entry.debit.name, debit: entry.value, credit: 0 },
            { code: entry.credit.account, name: entry.credit.name, debit: 0, credit: entry.value }
        ]);

        const aggregatedLines = rawLines.reduce((acc, line) => {
            const existing = acc.find(l => l.code === line.code);
            if (existing) {
                existing.debit += line.debit;
                existing.credit += line.credit;
            } else {
                acc.push({ ...line });
            }
            return acc;
        }, [] as typeof rawLines);

        const linesToInsert = aggregatedLines.map(line => {
            const accId = accountMap.get(line.code);
             if (!accId) {
                console.error("Conta faltante:", { line, codes: uniqueCodes });
                throw new Error(`Conta não encontrada no plano: ${line.code}`);
            }
            
            return {
                entry_id: entryData.id,
                account_id: accId,
                debit: line.debit,
                credit: line.credit,
                description: line.debit > 0 ? `Débito: ${line.name}` : `Crédito: ${line.name}`
            };
        });

        const { error: linesError } = await supabase
            .from('accounting_entry_lines')
            .insert(linesToInsert);

        if (linesError) throw new Error("Erro ao criar itens: " + linesError.message);
        
        if (suggestion.entries.length > 0) {
            const entry = suggestion.entries[0];
            const isReceipt = selectedTx.amount > 0;
            const target = isReceipt ? entry.credit : entry.debit;

            if (target.account !== bankAccountCode && suggestion.type !== 'split') {
                 FinancialIntelligenceService.learnRule(
                     selectedTx.description,
                     target.account,
                     target.name,
                     isReceipt ? 'credit' : 'debit'
                 );
            }
        }

        // Sistema de Aprendizado Contínuo (Sprint 2)
        // Se a transação tinha sugestão automática e foi confirmada, registrar feedback positivo
        if (selectedTx.suggested_client_id && !isManualMode) {
            try {
                const user = (await supabase.auth.getUser()).data.user;
                await supabase.rpc('fn_confirm_suggestion', {
                    p_transaction_id: selectedTx.id,
                    p_user_id: user?.id || null
                });
                console.log('[Learning] Confirmação registrada para aprendizado');
            } catch (learnErr) {
                console.warn('[Learning] Erro ao registrar confirmação:', learnErr);
                // Não bloqueia o fluxo principal
            }
        }

        toast.success("Lançamento confirmado!");
        
        setTransactions(prev => prev.map(t => t.id === selectedTx.id ? { ...t, matched: true } : t));
        
        if (viewMode === 'pending') {
             setTransactions(prev => prev.filter(t => t.id !== selectedTx.id));
             setSelectedTx(null);
        } else {
             setSelectedTx(prev => prev ? { ...prev, matched: true } : null);
        }
        
        setSuggestion(null);
        setIsManualMode(false);

    } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : "Erro ao confirmar lançamento";
        toast.error(errorMessage);
    } finally {
        setLoading(false);
    }
  };

  return (
    <Tabs 
      value={viewMode}
      onValueChange={(v) => setViewMode(v as 'pending' | 'review' | 'ai_report' | 'boletos')}
      className="h-auto lg:h-[calc(100vh-4rem)] flex flex-col p-2 md:p-4 bg-slate-50 min-h-screen w-full max-w-[100vw] overflow-x-hidden"
    >
      
      {/* HEADER: Controles e Data */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 shrink-0 gap-4 lg:gap-0 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
                <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Super Conciliação</h1>
            <p className="text-muted-foreground text-sm">
                Hub Contábil Inteligente
            </p>
            </div>
            
            <TabsList className="h-auto flex-wrap w-full sm:w-auto p-1">
                <TabsTrigger value="pending" className="flex-1 sm:flex-none px-4">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Pendentes
                </TabsTrigger>
                <TabsTrigger value="review" className="flex-1 sm:flex-none px-4">
                     <CheckCircle2 className="mr-2 h-4 w-4" />
                    Revisão / Auditoria
                </TabsTrigger>
                <TabsTrigger value="ai_report" className="flex-1 sm:flex-none px-4">
                    <Brain className="mr-2 h-4 w-4" />
                    IA Classificados
                </TabsTrigger>
                <TabsTrigger value="boletos" className="flex-1 sm:flex-none px-4">
                    <FileText className="mr-2 h-4 w-4" />
                    Boletos
                </TabsTrigger>
            </TabsList>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            {/* SALDO ANTERIOR */}
            <Popover>
                <PopoverTrigger asChild>
                    <div className="text-right flex flex-col items-end cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors group">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide group-hover:text-blue-600">
                            {selectedDate ? format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0), 'dd/MM/yyyy') : 'Anterior'}
                        </span>
                        <span className={`font-mono text-sm font-medium ${balances.prev < 0 ? 'text-red-500' : 'text-slate-700'} group-hover:underline decoration-dotted`}>
                            {formatCurrency(balances.prev)}
                        </span>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-[90vw] sm:w-80 p-4">
                    <h4 className="font-semibold mb-2 text-sm bg-slate-50 p-2 rounded">Composição (Histórico Acumulado)</h4>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-emerald-600">
                            <span>Entradas (Períodos Anteriores)</span>
                            <span className="font-mono">+{formatCurrency(balanceDetails.prevCredits)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 border-b pb-1">
                            <span>Saídas (Períodos Anteriores)</span>
                            <span className="font-mono">{formatCurrency(balanceDetails.prevDebits)}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-1 text-sm bg-slate-100 p-1 rounded">
                            <span>Saldo Calculado</span>
                            <span>{formatCurrency(balances.prev)}</span>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* SALDO INICIAL */}
             <div className="text-right flex flex-col items-end opacity-70">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {selectedDate ? format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), 'dd/MM/yyyy') : 'Início'}
                </span>
                <span className={`font-mono text-sm font-medium ${balances.start < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    {formatCurrency(balances.start)}
                </span>
             </div>

            {/* SALDO FINAL */}
            <Popover>
                <PopoverTrigger asChild>
                    <div className="text-right flex flex-col items-end pr-4 border-r border-gray-200 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors group">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide group-hover:text-blue-600">
                            {selectedDate ? format(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0), 'dd/MM/yyyy') : 'Final'}
                        </span>
                        <span className={`font-mono text-sm font-bold ${balances.final < 0 ? 'text-red-600' : 'text-green-600'} group-hover:underline decoration-dotted`}>
                            {formatCurrency(balances.final)}
                        </span>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-[90vw] sm:w-80 p-4">
                    <h4 className="font-semibold mb-2 text-sm bg-slate-50 p-2 rounded">Composição do Mês</h4>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b pb-1">
                            <span>Saldo Inicial</span>
                            <span className="font-mono">{formatCurrency(balances.start)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600">
                            <span>Entradas (Mês Atual)</span>
                            <span className="font-mono">+{formatCurrency(balanceDetails.monthCredits)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 border-b pb-1">
                            <span>Saídas (Mês Atual)</span>
                            <span className="font-mono">{formatCurrency(balanceDetails.monthDebits)}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-1 text-sm bg-slate-100 p-1 rounded">
                            <span>Saldo Final (Calculado)</span>
                            <span>{formatCurrency(balances.final)}</span>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={"w-[180px] sm:w-[240px] justify-start text-left font-normal bg-white"}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMMM yyyy", { locale: ptBR }) : <span>Selecione o Mês</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[90vw] sm:w-[300px] p-4" align="end">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => setSelectedDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold">{selectedDate.getFullYear()}</span>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => setSelectedDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Button
                            key={i}
                            variant={selectedDate.getMonth() === i ? "default" : "outline"}
                            className={`text-xs ${selectedDate.getMonth() === i ? "" : "hover:bg-slate-100"}`}
                            onClick={() => setSelectedDate(prev => new Date(prev.getFullYear(), i, 1))}
                        >
                            {format(new Date(2024, i, 1), "MMM", { locale: ptBR }).toUpperCase()}
                        </Button>
                    ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2">
            <CobrancaImporter />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="shrink-0 gap-2">
                <Upload className="w-4 h-4" />
                Importar OFX
            </Button>
            <Button
                variant="outline"
                onClick={handleIdentifyPayers}
                disabled={identifyingPayers || transactions.length === 0}
                className="shrink-0 gap-2 text-purple-700 border-purple-300 hover:bg-purple-50"
            >
                {identifyingPayers ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Brain className="w-4 h-4" />
                )}
                Identificar Pagadores
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                        accept=".ofx,.csv"
                aria-label="Upload de Extrato"
                        onChange={handleExtratoUpload}
            />
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex justify-end mb-2 px-1 shrink-0 w-full lg:w-auto">
        <div className="flex flex-col gap-2 w-full sm:w-[300px]">
            {suggestion && !selectedTx?.matched && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-center text-slate-500 italic bg-blue-50/50 py-1 rounded">
                    <CheckCircle2 className="h-3 w-3 text-blue-400" />
                    Aprendizado Automático (Dr. Cícero) Ativo
                </div>
            )}
            
            {selectedTx?.matched ? (
                 <Button 
                    className="w-full gap-2" 
                    variant="outline"
                    onClick={handleUnmatch}
                    disabled={loading}
                >
                    <AlertTriangle className="h-4 w-4" />
                    Editar Lançamento
                </Button>
            ) : (
                <Button 
                    className="w-full gap-2 bg-blue-700 hover:bg-blue-800 text-white shadow-md transition-all hover:scale-[1.02]" 
                    disabled={!suggestion || suggestion.entries.length === 0 || loading}
                    onClick={handleConfirm}
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" /> 
                    ) : (
                        <>
                            <CheckCircle2 className="h-4 w-4" />
                            CONFIRMAR (Salvar)
                        </>
                    )}
                </Button>
            )}
        </div>
      </div>

      {/* Conteúdo principal - condicionalmente renderizado */}
      {viewMode === 'boletos' ? (
        /* ABA DE BOLETOS - Relatório de Conciliação Automática */
        <div className="flex-1 overflow-y-auto p-2">
          <ReconciliationReport
            startDate={format(startOfMonth(selectedDate), 'yyyy-MM-dd')}
            endDate={format(endOfMonth(selectedDate), 'yyyy-MM-dd')}
            onReconcile={(match: BoletoMatch) => {
              // Ao clicar em conciliar, muda para aba pendentes e seleciona a transação
              setViewMode('pending');
              // Buscar a transação correspondente
              const tx = transactions.find(t => t.id === match.bankTransactionId);
              if (tx) {
                setSelectedTx(tx);
              }
            }}
          />
        </div>
      ) : viewMode === 'ai_report' ? (
        /* ABA DE IA CLASSIFICADOS - Relatório detalhado de classificações da IA */
        <div className="flex-1 overflow-y-auto">
          <AIClassificationReport
            startDate={format(startOfMonth(selectedDate), 'yyyy-MM-dd')}
            endDate={format(endOfMonth(selectedDate), 'yyyy-MM-dd')}
          />
        </div>
      ) : (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto lg:overflow-hidden w-full max-w-full">

      {/* COLUNA 1: Extrato Bancário (Pendente) */}
      <Card className={`flex flex-col transition-all duration-300 ${isListExpanded ? 'lg:col-span-6' : 'lg:col-span-3'} col-span-1 min-h-[500px] lg:min-h-0 lg:h-full w-full max-w-full`}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              Extrato Bancário
            </CardTitle>
            <CardDescription>
                {loadingTx
                    ? "Carregando..."
                    : `${viewMode === 'pending' ? 'Pendentes' : 'Revisão/Auditoria'} • ${format(selectedDate, "MMM/yyyy", { locale: ptBR })} (${transactions.length})`
                }
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hidden lg:flex" onClick={() => setIsListExpanded(!isListExpanded)}>
             {isListExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </CardHeader>
                <Separator />
                <div className="flex items-center justify-between px-3 py-1 text-[11px] text-slate-600">
                        <div>
                            Página {page} de {totalPages} • Mostrando {pagedTransactions.length} de {transactions.length}
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                                Anterior
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                                Próxima
                            </Button>
                        </div>
                </div>
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-1">
            {loadingTx ? (
                 <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                 </div>
                        ) : transactions.length === 0 ? (
                 <div className="text-center p-8 text-muted-foreground text-sm">
                    {viewMode === 'pending' ? "Nenhuma pendência." : "Nenhuma transação aguardando revisão."}
                 </div>
                        ) : pagedTransactions.map(tx => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className={`flex items-center gap-2 p-0.5 px-2 rounded-sm border cursor-pointer transition-all hover:bg-slate-100 min-h-[28px] ${selectedTx?.id === tx.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white'} ${tx.matched ? 'opacity-70 grayscale-[0.5]' : ''} ${tx.auto_matched ? 'border-l-2 border-l-emerald-500' : ''}`}
              >
                <div className="w-[60px] shrink-0 text-[10px] text-slate-500">{new Date(tx.date).toLocaleDateString().slice(0,5)}</div>

                <div className="flex-1 font-medium text-[10px] truncate leading-tight" title={tx.description}>
                    {tx.matched && <CheckCircle2 className="h-2 w-2 inline text-green-600 mr-1" />}
                    {tx.auto_matched && !tx.matched && <Sparkles className="h-2 w-2 inline text-amber-500 mr-1" title="Auto-identificado" />}
                    {tx.description}
                    {/* Badges de automação */}
                    {tx.suggested_client_name && (
                      <span className="ml-1 inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-normal" title={`Cliente: ${tx.suggested_client_name} (${tx.identification_confidence}%)`}>
                        <User className="h-2 w-2" />
                        {tx.suggested_client_name.split(' ')[0]}
                        {tx.identification_confidence && <span className="text-emerald-500">({tx.identification_confidence}%)</span>}
                      </span>
                    )}
                    {tx.extracted_cnpj && !tx.suggested_client_name && (
                      <span className="ml-1 inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 px-1 rounded text-[8px] font-normal" title={`CNPJ: ${tx.extracted_cnpj}`}>
                        <Building2 className="h-2 w-2" />
                        CNPJ
                      </span>
                    )}
                    {tx.extracted_cpf && !tx.suggested_client_name && !tx.extracted_cnpj && (
                      <span className="ml-1 inline-flex items-center gap-0.5 bg-purple-100 text-purple-700 px-1 rounded text-[8px] font-normal" title={`CPF: ${tx.extracted_cpf}`}>
                        <User className="h-2 w-2" />
                        CPF
                      </span>
                    )}
                    {tx.needs_review && (
                      <span className="ml-1 inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1 rounded text-[8px] font-normal" title="Necessita revisão">
                        <AlertTriangle className="h-2 w-2" />
                      </span>
                    )}
                </div>

                <div className={`shrink-0 font-bold text-[10px] w-[50px] text-right ${tx.amount > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* COLUNA 2: Inteligência Dr. Cícero / MODO MANUAL */}
      <Card className={`flex flex-col border-blue-200 shadow-sm transition-all duration-300 ${isListExpanded ? 'lg:col-span-3' : 'lg:col-span-5'} col-span-1 min-h-[500px] lg:min-h-0 lg:h-full w-full max-w-full`}>
          <CardHeader className="bg-blue-50/50 pb-4">
            <CardTitle className="text-lg flex flex-wrap items-center justify-between text-blue-800 gap-2">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 p-1 rounded-md">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    {isManualMode ? "Classificação Manual" : "Análise do Dr. Cícero"}
                </div>
                <div className="flex gap-2">
                    {selectedTx && !selectedTx.matched && !isManualMode && (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setIsManualMode(true)}>
                            Modo Manual
                        </Button>
                    )}
                    {isManualMode && (
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-slate-500" onClick={() => { setIsManualMode(false); setManualType(null); }}>
                            Voltar para IA
                        </Button>
                    )}
                </div>
            </CardTitle>
            <CardDescription>{isManualMode ? "Defina os detalhes do lançamento" : "Inteligência Contábil Ativa"}</CardDescription>
         </CardHeader>
         <Separator className="bg-blue-100" />
         <div className="flex-1 p-6 flex items-center justify-center overflow-auto w-full">
            {!selectedTx ? (
                <div className="text-center text-slate-400">
                    <ArrowRight className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Selecione uma transação para análise</p>
                </div>
            ) : selectedTx.matched ? (
                 <div className="text-center">
                    <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500 opacity-20" />
                    <h3 className="text-xl font-medium text-slate-700">Transação Conciliada</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-[200px] mx-auto">
                        Este lançamento já foi processado e registrado na contabilidade.
                    </p>
                    
                    {selectedTx.journal_entry_id && (
                        <div className="mt-4 flex flex-col gap-2 max-w-[200px] mx-auto">
                             <Button 
                                variant="outline" 
                                className="w-full border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100" 
                                onClick={() => navigate('/client-ledger')}
                             >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver no Extrato
                             </Button>
                        </div>
                    )}

                    <Button variant="destructive" className="mt-4" onClick={handleUnmatch} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Desfazer Conciliação (Editar)
                    </Button>
                 </div>
            ) : isManualMode ? (
                <div className="w-full h-full flex flex-col gap-4">
                    {!manualType ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                            <Button 
                                variant="outline" 
                                className="h-full flex flex-col items-center justify-center gap-3 hover:bg-blue-50 hover:border-blue-300 transition-all p-6 sm:p-4"
                                onClick={() => setManualType('split')}
                            >
                                <SplitSquareHorizontal className="h-8 w-8 text-blue-600" />
                                <div className="text-center">
                                    <span className="font-bold block text-wrap">Rateio / Múltiplos</span>
                                    <span className="text-xs text-muted-foreground block text-wrap">Dividir em várias contas</span>
                                </div>
                            </Button>
                            <Button 
                                variant="outline" 
                                className="h-full flex flex-col items-center justify-center gap-3 hover:bg-amber-50 hover:border-amber-300 transition-all p-6 sm:p-4"
                                onClick={() => setManualType('expense')}
                                disabled={selectedTx.amount > 0} 
                            >
                                <Wallet className="h-8 w-8 text-amber-600" />
                                <div className="text-center">
                                    <span className="font-bold block text-wrap">Classificar Despesa</span>
                                    <span className="text-xs text-muted-foreground block text-wrap">Escolher conta do plano</span>
                                </div>
                            </Button>
                        </div>
                    ) : manualType === 'split' ? (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-sm">Composição do Lançamento</h3>
                                <div className="text-xs bg-slate-100 px-2 py-1 rounded">
                                    <span className="font-mono">{formatCurrency(selectedTx.amount)}</span> Total
                                </div>
                            </div>
                            
                            <div className="flex-1 border rounded-md p-2 space-y-2 overflow-auto bg-white mb-2">
                                {splitItems.map((item, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center border-b sm:border-b-0 pb-2 sm:pb-0">
                                        <div className="flex-1 w-full sm:w-auto">
                                            <AccountSelector 
                                                value={item.accountCode}
                                                accounts={availableAccounts}
                                                onChange={(code) => {
                                                    const newItems = [...splitItems];
                                                    newItems[idx].accountCode = code;
                                                    setSplitItems(newItems);
                                                }}
                                            />
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Input 
                                                type="number" 
                                                placeholder="Valor" 
                                                value={item.amount}
                                                onChange={(e) => {
                                                    const newItems = [...splitItems];
                                                    newItems[idx].amount = Number(e.target.value);
                                                    setSplitItems(newItems);
                                                }}
                                                className="flex-1 sm:w-24 h-6 text-xs text-right font-mono"
                                            />
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => setSplitItems(items => items.filter((_, i) => i !== idx))}
                                            >
                                                &times;
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full text-xs border-dashed"
                                    onClick={() => setSplitItems([...splitItems, { accountCode: '', amount: 0 }])}
                                >
                                    + Adicionar Linha
                                </Button>
                            </div>
                            
                            <div className="border-t pt-2">
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Total Alocado:</span>
                                    <span className={`font-bold ${Math.abs(splitItems.reduce((a,b)=>a+b.amount,0) - selectedTx.amount) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(splitItems.reduce((a,b)=>a+b.amount,0))}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setManualType(null)}>Cancelar</Button>
                                    <Button className="flex-1" onClick={applyManualSplit}>Aplicar Rateio</Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full p-4">
                            <h3 className="font-bold text-sm mb-4">Selecione a Conta de Despesa</h3>
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Plano de Contas</label>
                                <AccountSelector 
                                    value={selectedExpenseAccount}
                                    accounts={availableAccounts}
                                    onChange={(code) => setSelectedExpenseAccount(code)}
                                />
                            </div>
                            <div className="flex gap-2 mt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setManualType(null)}>Cancelar</Button>
                                <Button className="flex-1" onClick={applyManualExpense} disabled={!selectedExpenseAccount}>Aplicar Classificação</Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : loading ? (
                <div className="flex flex-col items-center gap-2 text-blue-600">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm font-medium">Analisando regras de competência...</p>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col gap-6">
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h3 className="font-semibold text-slate-700 mb-1">Diagnóstico</h3>
                        <p className="text-lg text-slate-900">{suggestion?.description}</p>
                        {suggestion?.reasoning && (
                            <div className="mt-3 bg-amber-50 text-amber-800 text-sm p-3 rounded-md flex items-start gap-2 border border-amber-200">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                {suggestion.reasoning}
                            </div>
                        )}
                        
                        {suggestion?.type === 'split' && (
                             <div className="mt-4">
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    accept=".csv,.xlsx,.txt"
                                    aria-label="Upload de Arquivo de Retorno"
                                    onChange={handleFileUpload}
                                />
                                <Button 
                                    variant="outline" 
                                    className="w-full gap-2 border-dashed border-2 hover:bg-blue-50 hover:border-blue-300"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-4 w-4" />
                                    Importar Arquivo de Retorno (Detalhar Clientes)
                                </Button>
                             </div>
                        )}
                    </div>
                </div>
            )}
         </div>
      </Card>

      {/* COLUNA 3: Efetivação Contábil */}
      <Card className={`flex flex-col bg-slate-50/50 overflow-hidden transition-all duration-300 ${isListExpanded ? 'lg:col-span-3' : 'lg:col-span-4'} col-span-1 min-h-[500px] lg:min-h-0 lg:h-full w-full max-w-full`}>
        <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-slate-600" />
                Lançamento Contábil
            </CardTitle>
            <CardDescription>Partidas Dobradas (Preview)</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-2">
             {suggestion?.entries && suggestion.entries.length > 0 ? (
                <div className="bg-white border rounded-lg shadow-sm">
                    <div className="bg-slate-50 border-b p-2 flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-700">Lançamento Único (Dr. Cicero)</span>
                        <Badge variant="outline" className="text-[10px] h-5">{formatCurrency(suggestion.entries.reduce((a, b) => a + b.value, 0))}</Badge>
                    </div>

                    <div className="p-0">
                        {/* DEBITS SECTION */}
                        <div className="p-2 border-b border-slate-100">
                             <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider">Débitos (Destino)</div>
                             <div className="space-y-1">
                                {suggestion.entries.map((entry, idx) => (
                                    <div key={`d-${idx}`} className="flex items-center gap-1 group">
                                        <div className="w-16 font-mono text-[10px] text-right text-slate-400 mr-2">
                                            {formatCurrency(entry.value)}
                                        </div>
                                        <div className="flex-1">
                                            {entry.debit.account === bankAccountCode ? (
                                                <div className="flex items-center gap-2 h-6 px-1.5 bg-slate-100 rounded border border-slate-200 text-xs text-slate-600 font-medium">
                                                    <Wallet className="h-3 w-3 text-slate-400" />
                                                    {entry.debit.name || 'Conta Banco'}
                                                    <span className="ml-auto text-[10px] bg-slate-200 px-1 rounded text-slate-500">Fixo</span>
                                                </div>
                                            ) : (
                                                <AccountSelector 
                                                    value={entry.debit.account}
                                                    accounts={availableAccounts}
                                                    onChange={(newCode) => {
                                                        const newEntries = [...suggestion.entries];
                                                        const acc = availableAccounts.find(a => a.code === newCode);
                                                        if (acc) {
                                                            newEntries[idx].debit = { account: acc.code, name: acc.name };
                                                            setSuggestion({ ...suggestion, entries: newEntries });
                                                        }
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>

                        {/* CREDITS SECTION */}
                        <div className="p-2">
                             <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider">Créditos (Origem)</div>
                                                 <div className="space-y-1">
                                                        {suggestion.entries.map((entry, idx) => {
                                                            const isCobranca = selectedTx && (
                                                                selectedTx.description.includes('COB') || 
                                                                selectedTx.description.includes('COBRANCA') ||
                                                                selectedTx.description.includes('Cobrança')
                                                            );
                                                            
                                                            if (isCobranca) return null;
                                                            return (
                                                                <div key={`c-${idx}`} className="flex items-center gap-1 group">
                                                                        <div className="w-16 font-mono text-[10px] text-right text-slate-400 mr-2">
                                                                            {formatCurrency(entry.value)}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            {entry.credit.account === bankAccountCode ? (
                                                                                <div className="flex items-center gap-2 h-6 px-1.5 bg-slate-100 rounded border border-slate-200 text-xs text-slate-600 font-medium">
                                                                                    <Wallet className="h-3 w-3 text-slate-400" />
                                                                                    {entry.credit.name || 'Conta Banco'}
                                                                                    <span className="ml-auto text-[10px] bg-slate-200 px-1 rounded text-slate-500">Fixo</span>
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <AccountSelector 
                                                                                        value={entry.credit.account}
                                                                                        accounts={availableAccounts}
                                                                                        onChange={(newCode) => {
                                                                                            const newEntries = [...suggestion.entries];
                                                                                            const acc = availableAccounts.find(a => a.code === newCode);
                                                                                            if (acc) {
                                                                                                newEntries[idx].credit = { account: acc.code, name: acc.name };
                                                                                                setSuggestion({ ...suggestion, entries: newEntries });
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                </div>
                                                            );
                                                        })}
                                
                                                        {selectedTx && (/(^|\s)[C]?OB\d+/.test(selectedTx.description) || selectedTx.description.includes('COBRANCA') || selectedTx.description.includes('Cobrança')) && (
                                  <div className="mt-2">
                                    <CollectionClientBreakdown 
                                              cobrancaDoc={selectedTx.description.match(/[C]?OB\d+/)?.[0] || ''}
                                      amount={Math.abs(selectedTx.amount)}
                                      transactionDate={selectedTx.date}
                                    />
                                  </div>
                                )}
                             </div>
                        </div>
                    </div>
                </div>
             ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                    Aguardando análise...
                </div>
             )}
        </CardContent>
      </Card>
      
      </div>
      )}
    </Tabs>
  );
}