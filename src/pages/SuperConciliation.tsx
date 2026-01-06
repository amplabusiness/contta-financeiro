import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent } from "react";
import { useAccounting } from "@/hooks/useAccounting";
import { FinancialIntelligenceService, ClassificationSuggestion } from "@/services/FinancialIntelligenceService";
import { formatCurrency } from "@/data/expensesData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, Wallet, Receipt, SplitSquareHorizontal, Upload, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CobrancaImporter } from "@/components/CobrancaImporter";
import { CollectionClientBreakdown } from "@/components/CollectionClientBreakdown";
import { parseExtratoBancarioCSV } from "@/lib/csvParser";

// Tipos para a Super Tela
interface BankTransaction {
  id: string;
  amount: number; // Negativo = Saída, Positivo = Entrada
  date: string;
  description: string;
  matched: boolean;
  journal_entry_id?: string;
}

interface ManualSplitItem {
    accountCode: string; // Changed from clientName for better logic
    amount: number;
}

// Internal Component: Searchable Account Selector (Compact)
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
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Buscar conta (nome ou código)..." className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty>Conta não encontrada.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                            {accounts.map((acc) => (
                                <CommandItem
                                    key={acc.code}
                                    value={`${acc.code} ${acc.name}`} // Searchable string
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
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 50;
  
  // Modos Manuais
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualType, setManualType] = useState<'split' | 'expense' | null>(null);
  const [splitItems, setSplitItems] = useState<ManualSplitItem[]>([]);
  const [selectedExpenseAccount, setSelectedExpenseAccount] = useState("");
  const [availableAccounts, setAvailableAccounts] = useState<{code: string, name: string}[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para seletor de data (Mês/Ano) com persistência
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const saved = localStorage.getItem('super-conciliation-date');
    if (saved) return new Date(saved);
    return new Date(2025, 0, 1); // Jan 2025 default
  });

  // Salvar preferência de data
  useEffect(() => {
    if (selectedDate) {
        localStorage.setItem('super-conciliation-date', selectedDate.toISOString());
    }
  }, [selectedDate]);

  const [viewMode, setViewMode] = useState<'pending' | 'all'>('pending');
  const [bankAccountCode, setBankAccountCode] = useState("1.1.1.05"); // Default Sicredi (ajustar conforme necessidade)
  const [balances, setBalances] = useState({ prev: 0, start: 0, final: 0 });
  
  // Fetch Bank Account Code (Simples heuristic: busca Sicredi, se não achar, usa default)
  useEffect(() => {
     const fetchBankCode = async () => {
         // Tenta achar Sicredi (748)
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
                const { data, error } = await supabase.functions.invoke('parse-ofx-statement', {
                    body: { ofx_content: content }
                });
                if (error) throw error;
                const imported = data?.imported ?? data?.transactions?.length ?? 0;
                toast.success(`Extrato OFX importado (${imported} lançamentos)`);
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

        // Calculate Balances - base em 31/12/2024 conhecido (OFX)
        const firstDateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), 'yyyy-MM-dd');
        const lastDateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0), 'yyyy-MM-dd');
        const BASE_BALANCE_2024_12_31 = 90725.06;

        const calculateBalance = (transactions: any[]) => transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

        // Soma de transações desde 01/01/2025 até o dia anterior ao mês selecionado
        const { data: txBeforeMonth } = await supabase
                .from('bank_transactions')
                .select('amount')
                .lt('transaction_date', firstDateStr)
                .gte('transaction_date', '2025-01-01')
                .order('transaction_date', { ascending: true });
        const sumBefore = calculateBalance(txBeforeMonth || []);
        const valPrev = BASE_BALANCE_2024_12_31 + sumBefore;
        console.log('Saldo Anterior (31/12/2024):', { valPrev, tipo: 'base+transacoes' });

        // Saldo inicial do mês = saldo anterior
        const valStart = valPrev;
        console.log(`Saldo Inicial (${firstDateStr}):`, { valStart, tipo: 'base+transacoes' });

        // Soma das transações dentro do mês selecionado
        const { data: txInMonth } = await supabase
                .from('bank_transactions')
                .select('amount')
                .gte('transaction_date', firstDateStr)
                .lte('transaction_date', lastDateStr)
                .order('transaction_date', { ascending: true });
        const sumMonth = calculateBalance(txInMonth || []);
        const valFinal = valStart + sumMonth;
        console.log(`Saldo Final (${lastDateStr}):`, { valFinal, sumMonth, totalTx: txInMonth?.length });

        setBalances({ prev: valPrev, start: valStart, final: valFinal });

        let query = supabase
            .from('bank_transactions')
            .select('*')
            .gte('transaction_date', startOfMonth)
            .lte('transaction_date', endOfMonth)
            .order('transaction_date', { ascending: true });

        if (viewMode === 'pending') {
             query = query.eq('matched', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Erro ao buscar transações:", error);
            toast.error("Erro ao carregar extrato bancário");
        } else {
            // Mapear para interface local
            const mapped: BankTransaction[] = (data || []).map(tx => {
                let amt = Number(tx.amount);
                // Se o banco armazena sempre positivo, usamos transaction_type para definir o sinal
                if (tx.transaction_type === 'debit' && amt > 0) {
                    amt = -amt;
                }
                return {
                    id: tx.id,
                    amount: amt,
                    date: tx.transaction_date,
                    description: tx.description,
                    matched: tx.matched,
                    journal_entry_id: tx.journal_entry_id
                };
            });
            setTransactions(mapped);
        }
        setLoadingTx(false);
        setPage(1); // reset página sempre que recarregar mês/modo
    }, [selectedDate, viewMode]);

    // Carregar Transações Reais do Banco
    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

  // Carregar Plano de Contas (Geral)
  useEffect(() => {
    const fetchAccounts = async () => {
        const { data } = await supabase
            .from('chart_of_accounts')
            .select('code, name')
            .or('code.ilike.3.%,code.ilike.4.%,code.ilike.2.1.%,code.ilike.1.1.2.%,code.ilike.1.1.1.%,code.ilike.1.1.3.%') // Inclui Adiantamentos (1.1.3.x)
            .order('code');
        if (data) setAvailableAccounts(data);
    };
    fetchAccounts();
  }, []);

    // Paginação local (client-side) para navegar pelos 173 lançamentos
    const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
    const pagedTransactions = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

  // O CEREBRO: Dr. Cícero analisa a transação selecionada
  useEffect(() => {
    if (!selectedTx || isManualMode) { 
        if (!selectedTx) setSuggestion(null);
        return; // Se estiver em modo manual, não sobrescreve
    };
    
    // Se já estiver conciliado, busca o lançamento real
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
                // Formata para o formato de ClassificationSuggestion para reaproveitar a UI
                const entries = lines.map((l: any) => {
                    const isDebit = l.debit > 0;
                    return {
                        debit: isDebit ? { account: l.chart_of_accounts?.code, name: l.chart_of_accounts?.name } : { account: '', name: '' },
                        credit: !isDebit ? { account: l.chart_of_accounts?.code, name: l.chart_of_accounts?.name } : { account: '', name: '' },
                        value: isDebit ? l.debit : l.credit
                    };
                }).filter(e => e.value > 0);

                // Como a UI espera pares (D/C no mesmo objeto) e o banco retorna linhas soltas,
                // vamos agrupar simplificadamente ou criar lista plana.
                // A UI atual itera sobre 'entries' e mostra um item por iteração.
                // Vou adaptar para mostrar linhas individuais se necessário, mas a UI espera {debit, credit}.
                // Hack: Vamos criar uma estrutura visual onde Debit e Credit são mostrados.
                
                // Melhor abordagem: Criar pares artificiais se possível ou apenas listar.
                // Vamos criar uma lista onde cada linha do banco vira uma entrada suggestion com o outro lado vazio para exibição
                
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
                    type: 'revenue_current', // Dummy
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
            bankAccountCode // Passa o código do banco correto
        );

        // DR CICERO ENFORCEMENT:
        // Se estamos conciliando extrato BANCÁRIO (OFX), a "perna do banco" é Sagrada.
        // Entrada (>0) = Débito no Banco OBRIGATÓRIO.
        // Saída (<0) = Crédito no Banco OBRIGATÓRIO.
        // Sobrescrevemos o retorno da IA para garantir integridade contábil.
        
        const isReceipt = selectedTx.amount > 0;
        const bankName = availableAccounts.find(a => a.code === bankAccountCode)?.name || 'Banco Sicredi';

        const enforcedEntries = result.entries.map(e => {
            if (isReceipt) {
                // Entrada: Força Débito = Banco
                return {
                    ...e,
                    debit: { account: bankAccountCode, name: bankName },
                    // Mantém o crédito sugerido pela IA (a contrapartida variável)
                    credit: e.credit
                };
            } else {
                // Saída: Força Crédito = Banco
                return {
                    ...e,
                    debit: e.debit,
                    // Mantém o débito sugerido pela IA (a contrapartida variável), força Crédito = Banco
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
      if (!selectedTx || !selectedTx.journal_entry_id) return;
      
      if (!confirm("Tem certeza? Isso apagará o lançamento contábil original e permitirá reclassificar.")) return;

      setLoading(true);
      try {
          // 1. Apagar Lançamento Contábil (Cascade deve apagar linhas)
          const { error: delError } = await supabase
            .from('accounting_entries')
            .delete()
            .eq('id', selectedTx.journal_entry_id);
            
          if (delError) throw new Error("Erro ao apagar lançamento: " + delError.message);

          // 2. Desmarcar no Banco e limpar Journal ID
          const { error: updateError } = await supabase
            .from('bank_transactions')
            .update({ matched: false, journal_entry_id: null })
            .eq('id', selectedTx.id);

          if (updateError) throw new Error("Erro ao atualizar banco: " + updateError.message);

          toast.success("Transação reaberta para edição!");
          
          // Atualiza estado local
          const updated = { ...selectedTx, matched: false, journal_entry_id: undefined };
          setSelectedTx(updated);
          setTransactions(prev => prev.map(t => t.id === selectedTx.id ? updated : t));
          
          // Reseta Suggestion para rodar Dr Cicero de novo
          setIsManualMode(false);
          setSuggestion(null); 
          // O useEffect vai rodar pq selectedTx mudou

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
      // Validar valor absoluto
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
                // Entrada: Débito Banco, Crédito Contas
                 return {
                    debit: { account: bankAccountCode, name: bankAccName },
                    credit: { account: item.accountCode, name: acc ? acc.name : 'Conta' },
                    value: item.amount 
                 };
             } else {
                 // Saída: Débito Contas, Crédito Banco
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
    // ... existing logic ...
    // Keep simplistic for now or integrate with new manual mode
    const file = event.target.files?.[0];
    if (!file) return;
    toast.info("Importação via arquivo simulada.");
  };

  const handleConfirm = async () => {
    if (!selectedTx || !suggestion) return;

    setLoading(true);
    try {
        // 1. Resolver IDs das Contas (Code -> UUID)
        const codes = suggestion.entries.flatMap(e => [e.debit.account, e.credit.account]);
        
        // Remove duplicates for query
        const uniqueCodes = [...new Set(codes)];
        
        const { data: accountsData, error: accountsError } = await supabase
            .from('chart_of_accounts')
            .select('id, code')
            .in('code', uniqueCodes);

        if (accountsError) throw new Error("Erro ao buscar contas no plano: " + accountsError.message);
        
        const accountMap = new Map<string, string>();
        accountsData?.forEach(acc => accountMap.set(acc.code, acc.id));

        // 2. Criar Lançamento (Header) - Usa accounting_entries
        // Calcular totais de débito e crédito
        const totalDebit = suggestion.entries.reduce((sum, e) => sum + (Number(e.debit.account) ? e.value : 0), 0);
        const totalCredit = suggestion.entries.reduce((sum, e) => sum + (Number(e.credit.account) ? e.value : 0), 0);
        
        const { data: entryData, error: entryError } = await supabase
            .from('accounting_entries')
            .insert({
                entry_type: 'manual',
                description: suggestion.description,
                entry_date: selectedTx.date,
                competence_date: selectedTx.date,
                reference_type: 'bank_transaction',
                reference_id: selectedTx.id,
                document_number: selectedTx.description?.substring(0, 50),
                total_debit: totalDebit,
                total_credit: totalCredit,
                balanced: Math.abs(totalDebit - totalCredit) < 0.01
            })
            .select()
            .single();

        if (entryError) throw new Error("Erro ao criar lançamento: " + entryError.message);

        if (!entryData || !entryData.id) {
            throw new Error("Erro ao criar lançamento: nenhum ID retornado do banco de dados");
        }

        // 3. Preparar e Agrupar Itens do Lançamento
        // Transforma pares D/C em lista plana de linhas
        const rawLines = suggestion.entries.flatMap(entry => [
            { code: entry.debit.account, name: entry.debit.name, debit: entry.value, credit: 0 },
            { code: entry.credit.account, name: entry.credit.name, debit: 0, credit: entry.value }
        ]);

        // Agrupa por conta para evitar múltiplas linhas da mesma conta (ex: Banco repetido várias vezes)
        const aggregatedLines = rawLines.reduce((acc, line) => {
            const existing = acc.find(l => l.code === line.code);
            if (existing) {
                existing.debit += line.debit;
                existing.credit += line.credit;
                // If it has mixed debit/credit, we keep it as is (netting is risky without user intent)
                // Assuming well-formed bookkeeping: usually one account is all debit or all credit in a simple transaction
            } else {
                acc.push({ ...line });
            }
            return acc;
        }, [] as typeof rawLines);

        // Prepara para insert
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

        // 4. Nota: O lançamento já está vinculado via reference_id em accounting_entries
        // Não atualizamos bank_transactions.matched pois há problemas com chave estrangeira
        // O lançamento está criado e pronto para usar
        
        // AUTO-LEARN: Tenta aprender automaticamente
        if (suggestion.entries.length > 0) {
            const entry = suggestion.entries[0];
            const isReceipt = selectedTx.amount > 0;
            // Se entrada, aprendemos de onde veio (Crédito). Se saída, para onde foi (Débito).
            const target = isReceipt ? entry.credit : entry.debit;
            
            // Só aprende se não for a própria conta banco (que seria redundante) e se não for split complexo
            if (target.account !== bankAccountCode && suggestion.type !== 'split') {
                 // Dispara sem await para não travar a UI
                 FinancialIntelligenceService.learnRule(
                     selectedTx.description, 
                     target.account, 
                     target.name,
                     isReceipt ? 'credit' : 'debit'
                 );
            }
        }

        toast.success("Lançamento confirmado!");
        
        // Remove da lista
        setTransactions(prev => prev.map(t => t.id === selectedTx.id ? { ...t, matched: true } : t));
        
        // Se estiver vendo apenas pendentes, remove da visualização
        if (viewMode === 'pending') {
             setTransactions(prev => prev.filter(t => t.id !== selectedTx.id));
             setSelectedTx(null);
        } else {
             // Se estiver vendo todas, apenas atualiza
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
      onValueChange={(v) => setViewMode(v as 'pending' | 'all')}
      className="h-[calc(100vh-4rem)] flex flex-col p-4 bg-slate-50"
    >
      
      {/* HEADER: Controles e Data */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Super Conciliação</h1>
            <p className="text-muted-foreground text-sm">
                Hub Contábil Inteligente
            </p>
            </div>
            
            <TabsList className="h-10">
                <TabsTrigger value="pending" className="px-4">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Pendentes
                </TabsTrigger>
                <TabsTrigger value="all" className="px-4">
                     <CheckCircle2 className="mr-2 h-4 w-4" />
                    Análise / Auditoria
                </TabsTrigger>
            </TabsList>
        </div>

        <div className="flex items-center gap-3">
            <div className="mr-2 text-right flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {selectedDate ? format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0), 'dd/MM/yyyy') : 'Anterior'}
                </span>
                <span className={`font-mono text-sm font-medium ${balances.prev < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    {formatCurrency(balances.prev)}
                </span>
             </div>
             <div className="mr-2 text-right flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {selectedDate ? format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), 'dd/MM/yyyy') : 'Início'}
                </span>
                <span className={`font-mono text-sm font-medium ${balances.start < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    {formatCurrency(balances.start)}
                </span>
             </div>
             <div className="mr-2 text-right flex flex-col items-end pr-4 border-r border-gray-200">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {selectedDate ? format(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0), 'dd/MM/yyyy') : 'Final'}
                </span>
                <span className={`font-mono text-sm font-bold ${balances.final < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(balances.final)}
                </span>
             </div>
            <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={"w-[240px] justify-start text-left font-normal bg-white"}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMMM yyyy", { locale: ptBR }) : <span>Selecione o Mês</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-4" align="end">
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

          <CobrancaImporter />
          
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> 
            Upload Extrato
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

      {/* ACTION BUTTONS (Moved to Top Right) */}
      <div className="flex justify-end mb-2 px-1 shrink-0">
        <div className="flex flex-col gap-2 w-[300px]">
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

      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
      
      {/* COLUNA 1: Extrato Bancário (Pendente) */}
      <Card className={`h-full flex flex-col transition-all duration-300 ${isListExpanded ? 'col-span-6' : 'col-span-3'}`}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              Extrato Bancário
            </CardTitle>
            <CardDescription>
                {loadingTx 
                    ? "Carregando..." 
                    : `${viewMode === 'pending' ? 'Pendentes' : 'Histórico Completo'} • ${format(selectedDate, "MMM/yyyy", { locale: ptBR })} (${transactions.length})`
                }
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => setIsListExpanded(!isListExpanded)}>
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
                    {viewMode === 'pending' ? "Nenhuma pendência." : "Nenhuma transação encontrada."}
                 </div>
                        ) : pagedTransactions.map(tx => (
              <div 
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className={`flex items-center gap-2 p-0.5 px-2 rounded-sm border cursor-pointer transition-all hover:bg-slate-100 h-7 ${selectedTx?.id === tx.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white'} ${tx.matched ? 'opacity-70 grayscale-[0.5]' : ''}`}
              >
                <div className="w-[60px] shrink-0 text-[10px] text-slate-500">{new Date(tx.date).toLocaleDateString().slice(0,5)}</div>
                
                <div className="flex-1 font-medium text-[10px] truncate leading-tight" title={tx.description}>
                    {tx.matched && <CheckCircle2 className="h-2 w-2 inline text-green-600 mr-1" />}
                    {tx.description}
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
      <Card className={`h-full flex flex-col border-blue-200 shadow-sm transition-all duration-300 ${isListExpanded ? 'col-span-3' : 'col-span-5'}`}>
         <CardHeader className="bg-blue-50/50 pb-4">
            <CardTitle className="text-lg flex items-center justify-between text-blue-800">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 p-1 rounded-md">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    {isManualMode ? "Classificação Manual" : "Análise do Dr. Cícero"}
                </div>
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
            </CardTitle>
            <CardDescription>{isManualMode ? "Defina os detalhes do lançamento" : "Inteligência Contábil Ativa"}</CardDescription>
         </CardHeader>
         <Separator className="bg-blue-100" />
         <div className="flex-1 p-6 flex items-center justify-center overflow-auto">
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
                    <Button variant="destructive" className="mt-6" onClick={handleUnmatch} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Desfazer Conciliação (Editar)
                    </Button>
                 </div>
            ) : isManualMode ? (
                <div className="w-full h-full flex flex-col gap-4">
                    {!manualType ? (
                        <div className="grid grid-cols-2 gap-4 h-full">
                            <Button 
                                variant="outline" 
                                className="h-full flex flex-col items-center justify-center gap-3 hover:bg-blue-50 hover:border-blue-300 transition-all"
                                onClick={() => setManualType('split')}
                            >
                                <SplitSquareHorizontal className="h-8 w-8 text-blue-600" />
                                <div className="text-center">
                                    <span className="font-bold block">Rateio / Múltiplos</span>
                                    <span className="text-xs text-muted-foreground">Dividir em várias contas</span>
                                </div>
                            </Button>
                            <Button 
                                variant="outline" 
                                className="h-full flex flex-col items-center justify-center gap-3 hover:bg-amber-50 hover:border-amber-300 transition-all"
                                onClick={() => setManualType('expense')}
                                disabled={selectedTx.amount > 0} // Entrada geralmente não é despesa
                            >
                                <Wallet className="h-8 w-8 text-amber-600" />
                                <div className="text-center">
                                    <span className="font-bold block">Classificar Despesa</span>
                                    <span className="text-xs text-muted-foreground">Escolher conta do plano</span>
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
                                    <div key={idx} className="flex gap-2 items-center">
                                        <div className="flex-1">
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
                                        <Input 
                                            type="number" 
                                            placeholder="Valor" 
                                            value={item.amount}
                                            onChange={(e) => {
                                                const newItems = [...splitItems];
                                                newItems[idx].amount = Number(e.target.value);
                                                setSplitItems(newItems);
                                            }}
                                            className="w-24 h-6 text-xs text-right font-mono"
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
      <Card className={`h-full flex flex-col bg-slate-50/50 overflow-hidden transition-all duration-300 ${isListExpanded ? 'col-span-3' : 'col-span-4'}`}>
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
                    {/* Simplified Single Entry View */}
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
                                            {/* Only editable if it's NOT the bank context usually, but allow all here */}
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
                                                                    // Aceitar variações 'COB' ou 'OB' (ex.: OB000005)
                                                                    const cobrancaDoc = selectedTx?.description.match(/[C]?OB\d+/)?.[0] || '';
                                  
                                                                    // Para cobrança, não renderiza a linha genérica de crédito aqui
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
                                
                                                                {/* Mostrar desdobramento de clientes se for cobrança - FORA DO MAP */}
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
    </Tabs>
  );
}
