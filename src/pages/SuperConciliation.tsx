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
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, Wallet, Receipt, SplitSquareHorizontal, Upload, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Maximize2, Minimize2, ExternalLink, FileText, Zap, Sparkles, User, Building2, ShieldCheck, Brain, RefreshCw, Trash2, MessageSquare, GraduationCap, Eye } from "lucide-react";
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
import { ClassificationDialog } from "@/components/ClassificationDialog";
import { DrCiceroChat } from "@/components/DrCiceroChat";
import { AIAgentSuggestions, AIBatchSummary } from "@/components/AIAgentSuggestions";
import { ImpactPreviewPanel } from "@/components/ImpactPreviewPanel";
import { EducatorPanel } from "@/components/EducatorPanel";
import { useImpactCalculation } from "@/hooks/useImpactCalculation";
import { useEducatorExplanation } from "@/hooks/useEducatorExplanation";
import { buscarModeloLancamento, identificarSiglas, MODELOS_LANCAMENTOS } from "@/lib/drCiceroKnowledge";
import { classificarTransacaoOFX, ClassificacaoAutomatica } from "@/lib/classificadorAutomatico";
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
  const lastFetchedEntryId = useRef<string | null>(null); // Evitar loops de fetch
  
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
  const [classificationDialogOpen, setClassificationDialogOpen] = useState(false);
  const [drCiceroChatOpen, setDrCiceroChatOpen] = useState(false);
  const [impactPanelOpen, setImpactPanelOpen] = useState(false);
  const [educatorPanelOpen, setEducatorPanelOpen] = useState(false);
  const [balances, setBalances] = useState({ prev: 0, start: 0, final: 0 });
  const [balanceDetails, setBalanceDetails] = useState({
      base: 0,
      prevCredits: 0,
      prevDebits: 0,
      monthCredits: 0,
      monthDebits: 0,
      divergence: 0
  });
  
  // Hooks para painéis premium
  const { 
    impact, 
    isCalculating, 
    calculateImpact, 
    clearImpact 
  } = useImpactCalculation();
  
  const { 
    explanation, 
    isLoading: isEducatorLoading, 
    generateExplanation, 
    clearExplanation 
  } = useEducatorExplanation();
  
  // Estado para armazenar classificações conhecidas pelo Dr. Cícero
  // Chave: descrição normalizada, Valor: sugestão de classificação
  const [knownClassifications, setKnownClassifications] = useState<Map<string, {
    accountCode: string;
    accountName: string;
    confidence: number;
  }>>(new Map());
  
  // Função para normalizar descrição para busca
  const normalizeDescription = useCallback((desc: string) => {
    return desc.toLowerCase()
      .replace(/\d{4,}/g, '') // Remove números longos (datas, códigos)
      .replace(/[^\w\s]/g, '') // Remove caracteres especiais
      .trim();
  }, []);
  
  // Função para verificar se Dr. Cícero conhece a classificação
  const getDrCiceroKnowledge = useCallback((tx: BankTransaction): { known: boolean; accountCode?: string; accountName?: string; confidence?: number; sigla?: string } => {
    // 1. Se já tem sugestão do sistema com alta confiança
    if (tx.suggested_client_name && tx.identification_confidence && tx.identification_confidence >= 0.8) {
      return { 
        known: true, 
        accountName: tx.amount > 0 ? `Clientes - ${tx.suggested_client_name}` : `Fornecedor - ${tx.suggested_client_name}`,
        confidence: tx.identification_confidence
      };
    }
    
    // 2. Padrões conhecidos (regras fixas do Dr. Cícero - Base de Conhecimento Treinada)
    const desc = tx.description.toUpperCase();
    
    // ============ TARIFAS BANCÁRIAS ============
    if (desc.includes('TARIFA') || desc.includes('TAR ') || desc.match(/\bTAR\b/) || 
        desc.includes('TXB') || desc.includes('ANUIDADE') || desc.includes('MANUT CONTA')) {
      return { known: true, accountCode: '4.1.3.01', accountName: 'Despesas Bancárias', confidence: 0.95, sigla: 'TAR' };
    }
    if (desc.includes('IOF')) {
      return { known: true, accountCode: '4.1.3.01', accountName: 'IOF', confidence: 0.95, sigla: 'IOF' };
    }
    
    // ============ FAMÍLIA LEÃO - ADIANTAMENTOS ============
    const familiaLeao = ['SERGIO', 'CARLA', 'VICTOR HUGO', 'NAYARA', 'SERGIO AUGUSTO', 'LEAO', 'LEÃO'];
    if (familiaLeao.some(nome => desc.includes(nome)) && tx.amount < 0) {
      return { known: true, accountCode: '1.1.3.01', accountName: 'Adiantamento a Sócios (Família Leão)', confidence: 0.92 };
    }
    
    // ============ FOLHA DE PAGAMENTO ============
    if (desc.includes('SALARIO') || desc.includes('FOLHA') || desc.includes('13º') || 
        desc.includes('13°') || desc.includes('DECIMO') || desc.includes('FERIAS') || 
        desc.includes('RESCISAO') || desc.includes('AVISO PREVIO')) {
      return { known: true, accountCode: '4.1.2.01', accountName: 'Despesas com Pessoal', confidence: 0.88, sigla: 'SALARIO' };
    }
    
    // ============ ENCARGOS SOCIAIS ============
    if (desc.includes('FGTS')) {
      return { known: true, accountCode: '4.1.2.02', accountName: 'FGTS', confidence: 0.95, sigla: 'FGTS' };
    }
    if (desc.includes('INSS') || desc.includes('GPS') || desc.includes('PREVIDENCIA') || desc.includes('DARF PREV')) {
      return { known: true, accountCode: '4.1.2.03', accountName: 'INSS', confidence: 0.95, sigla: 'INSS' };
    }
    
    // ============ IMPOSTOS MUNICIPAIS ============
    if (desc.match(/\bISS\b/) || desc.includes('ISSQN')) {
      return { known: true, accountCode: '4.1.3.02', accountName: 'ISS', confidence: 0.95, sigla: 'ISS' };
    }
    if (desc.includes('IPTU')) {
      return { known: true, accountCode: '4.1.3.03', accountName: 'IPTU', confidence: 0.95, sigla: 'IPTU' };
    }
    
    // ============ IMPOSTOS FEDERAIS ============
    if (desc.includes('DARF') && !desc.includes('PREV')) {
      return { known: true, accountCode: '4.1.3.04', accountName: 'Impostos Federais (DARF)', confidence: 0.85, sigla: 'DARF' };
    }
    if (desc.includes('DAS ') || desc.includes('SIMPLES NACIONAL')) {
      return { known: true, accountCode: '4.1.3.05', accountName: 'Simples Nacional (DAS)', confidence: 0.95, sigla: 'DAS' };
    }
    
    // ============ SERVIÇOS PÚBLICOS - ENERGIA ============
    if (desc.includes('ENEL') || desc.includes('CELG') || desc.includes('EQUATORIAL') ||
        desc.includes('CPFL') || desc.includes('CEMIG') || desc.includes('COPEL') ||
        desc.includes('ENERGIA') || desc.includes('ELETRIC') || desc.includes('LUZ')) {
      return { known: true, accountCode: '4.1.1.02', accountName: 'Energia Elétrica', confidence: 0.92, sigla: 'ENERGIA' };
    }
    
    // ============ SERVIÇOS PÚBLICOS - ÁGUA ============
    if (desc.includes('SANEAGO') || desc.includes('SABESP') || desc.includes('COPASA') ||
        desc.includes('CEDAE') || desc.includes('COMPESA') || desc.match(/\bAGUA\b/) || 
        desc.includes('ESGOTO')) {
      return { known: true, accountCode: '4.1.1.03', accountName: 'Água e Esgoto', confidence: 0.92, sigla: 'AGUA' };
    }
    
    // ============ TELECOMUNICAÇÕES ============
    if (desc.includes('VIVO') || desc.includes('CLARO') || desc.includes('TIM') || 
        desc.match(/\bOI\b/) || desc.includes('INTERNET') || desc.includes('TELEFON') ||
        desc.includes('CELULAR') || desc.includes('BANDA LARGA')) {
      return { known: true, accountCode: '4.1.1.04', accountName: 'Telefone/Internet', confidence: 0.88, sigla: 'TELECOM' };
    }
    
    // ============ ALUGUEL ============
    if (desc.includes('ALUGUEL') || desc.includes('LOCACAO') || desc.includes('CONDOMINIO')) {
      return { known: true, accountCode: '4.1.1.01', accountName: 'Aluguel e Condomínio', confidence: 0.90, sigla: 'ALUGUEL' };
    }
    
    // ============ PRÓ-LABORE ============
    if (desc.includes('PRO LABORE') || desc.includes('PROLABORE') || desc.includes('PRÓ-LABORE')) {
      return { known: true, accountCode: '4.1.2.04', accountName: 'Pró-labore', confidence: 0.95, sigla: 'PROLABORE' };
    }
    
    // ============ APLICAÇÕES FINANCEIRAS ============
    if ((desc.includes('APL ') || desc.includes('APLIC') || desc.includes('APLICACAO')) && tx.amount < 0) {
      return { known: true, accountCode: '1.1.1.10', accountName: 'Aplicações Financeiras', confidence: 0.90, sigla: 'APL' };
    }
    if ((desc.includes('RESG') || desc.includes('RESGATE')) && tx.amount > 0) {
      return { known: true, accountCode: '1.1.1.10', accountName: 'Resgate de Aplicação', confidence: 0.90, sigla: 'RESG' };
    }
    if ((desc.includes('REND') || desc.includes('RENDIMENTO') || desc.includes('JUROS')) && tx.amount > 0) {
      return { known: true, accountCode: '3.2.1.01', accountName: 'Receitas Financeiras', confidence: 0.88, sigla: 'REND' };
    }
    
    // ============ ESTORNOS ============
    if (desc.includes('ESTORNO') || desc.match(/\bEST\b/) || desc.includes('DEVOLUCAO') || desc.includes('CANC')) {
      return { known: true, accountName: 'Estorno (verificar lançamento original)', confidence: 0.70, sigla: 'EST' };
    }
    
    // ============ COBRANÇA (ENTRADA) ============
    if (tx.amount > 0 && (desc.includes('LIQUIDACAO') || desc.includes('COB') || desc.includes('BAIXA'))) {
      return { known: true, accountCode: '1.1.2.01', accountName: 'Recebimento de Cliente', confidence: 0.80, sigla: 'COB' };
    }
    
    // ============ USAR BASE DE CONHECIMENTO OBJETIVA ============
    // Tenta encontrar modelo de lançamento na base de conhecimento
    const modelo = buscarModeloLancamento(tx.description);
    if (modelo) {
      const isEntrada = tx.amount > 0;
      // Se encontrou modelo, retorna a conta apropriada
      if (isEntrada && modelo.credito) {
        return { 
          known: true, 
          accountCode: modelo.credito.codigo, 
          accountName: modelo.credito.nome, 
          confidence: 0.85,
          sigla: modelo.categoria
        };
      } else if (!isEntrada && modelo.debito) {
        return { 
          known: true, 
          accountCode: modelo.debito.codigo, 
          accountName: modelo.debito.nome, 
          confidence: 0.85,
          sigla: modelo.categoria
        };
      }
    }
    
    // ============ IDENTIFICAR SIGLAS DO EXTRATO ============
    // Usa a base de conhecimento para identificar siglas
    const siglasEncontradas = identificarSiglas(tx.description);
    if (siglasEncontradas.length > 0) {
      const sigla = siglasEncontradas[0];
      if (sigla.conta) {
        return { 
          known: true, 
          accountCode: sigla.conta, 
          accountName: sigla.contaNome || sigla.significado, 
          confidence: 0.85,
          sigla: sigla.significado.split(':')[0]
        };
      }
      // Se tem sigla mas não tem conta específica, retorna como identificado mas não classificado
      return { known: false, sigla: sigla.significado.split(':')[0] };
    }
    
    // ============ TRANSFERÊNCIAS ============
    if (desc.includes('TED') || desc.includes('DOC') || desc.match(/\bTRF\b/) || desc.includes('TRANSF')) {
      // Transferência precisa verificar se é para terceiros ou entre contas próprias
      return { known: false, sigla: 'TRF' }; // Não classificar automaticamente
    }
    
    // ============ PIX ============
    if (desc.includes('PIX')) {
      // PIX precisa identificar o favorecido/pagador
      if (tx.extracted_cnpj || tx.extracted_cpf || tx.suggested_client_name) {
        // Se identificou, usar a sugestão
        return { known: false }; // Deixar para identificação de pagador
      }
      return { known: false, sigla: 'PIX' };
    }
    
    // 3. Verificar no cache de classificações conhecidas
    const normalized = normalizeDescription(tx.description);
    const cached = knownClassifications.get(normalized);
    if (cached) {
      return { known: true, ...cached };
    }
    
    return { known: false };
  }, [knownClassifications, normalizeDescription]);
  
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
                        useLocalParser = true;
                    } else {
                        parsedData = data;
                    }
                } catch {
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
        // GOVERNANÇA DR. CÍCERO: journal_entry_id é a FONTE DE VERDADE
        // - Pendentes: transações SEM lançamento contábil (aguardando classificação)
        // - Revisão/Auditoria: transações COM lançamento contábil (para revisar)
        if (viewMode === 'pending') {
             // Transações que NÃO TÊM lançamento contábil vinculado
             query = query
                .is('journal_entry_id', null);
        } else if (viewMode === 'review') {
             // Transações que JÁ TÊM lançamento contábil para auditoria/reclassificação
             query = query
                .not('journal_entry_id', 'is', null);
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
    if (!tenant?.id) return;
    
    const fetchAccounts = async () => {
        // Primeiro verificar se existe alguma conta
        const { data: anyAccount, error: checkError } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('tenant_id', tenant.id)
            .limit(1);

        // Se não existir nenhuma conta, auto-inicializar o plano de contas
        if (!anyAccount || anyAccount.length === 0) {
            toast.info('Inicializando plano de contas para novo cliente...');

            try {
                const accountingService = new AccountingService();
                const result = await accountingService.initializeChartOfAccounts();
                if (result.success) {
                    toast.success('Plano de contas criado automaticamente!');

                    // Também criar contas para clientes existentes
                    const clientResult = await accountingService.ensureAllClientAccounts();
                    if (clientResult.success && clientResult.message?.includes('criadas')) {
                        toast.success(clientResult.message);
                    }
                }
            } catch {
                // Erro silencioso - plano de contas será criado na próxima tentativa
            }
        } else {
            // Mesmo se o plano existe, verificar se há clientes sem conta
            try {
                const accountingService = new AccountingService();
                const clientResult = await accountingService.ensureAllClientAccounts();
                if (clientResult.success && clientResult.message?.includes('criadas')) {
                    toast.info(clientResult.message);
                }
            } catch {
                // Erro silencioso
            }
        }

        // Buscar contas analíticas para uso na interface
        const { data } = await supabase
            .from('chart_of_accounts')
            .select('code, name')
            .eq('tenant_id', tenant.id)
            .eq('is_analytical', true)
            .eq('is_active', true)
            .or('code.ilike.3.%,code.ilike.4.%,code.ilike.2.1.%,code.ilike.1.1.2.%,code.ilike.1.1.1.%,code.ilike.1.1.3.%')
            .order('code');
        if (data) setAvailableAccounts(data);
    };
    fetchAccounts();
  }, [tenant?.id]);

    const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
    const pagedTransactions = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

  useEffect(() => {
    if (!selectedTx || isManualMode) { 
        if (!selectedTx) {
            setSuggestion(null);
            lastFetchedEntryId.current = null;
        }
        return;
    };
    
    if (selectedTx.matched && selectedTx.journal_entry_id) {
        // Evitar buscar o mesmo lançamento múltiplas vezes
        if (lastFetchedEntryId.current === selectedTx.journal_entry_id) {
            return;
        }
        
        const fetchJournal = async () => {
            setLoading(true);
            lastFetchedEntryId.current = selectedTx.journal_entry_id!;
            
            try {
                // Buscar cabeçalho do lançamento
                const { data: entryHeader, error: headerError } = await supabase
                    .from('accounting_entries')
                    .select('id, entry_date, description, internal_code, source_type, created_at')
                    .eq('id', selectedTx.journal_entry_id)
                    .single();
                
                if (headerError) {
                    console.error('Erro ao buscar cabeçalho:', headerError);
                }
                
                // Buscar linhas do lançamento
                const { data: lines, error: linesError } = await supabase
                    .from('accounting_entry_lines')
                    .select(`
                        id, debit, credit, description,
                        chart_of_accounts ( id, code, name, account_type )
                    `)
                    .eq('entry_id', selectedTx.journal_entry_id);
                
                if (linesError) {
                    console.error('Erro ao buscar linhas:', linesError);
                }
                
                console.log('Lançamento carregado:', { entryHeader, lines });
                
                if (lines && lines.length > 0) {
                    const displayEntries = lines.map((line: any) => {
                          const isDebit = Number(line.debit) > 0;
                          const val = isDebit ? line.debit : line.credit;
                          
                          return {
                              lineId: line.id,
                              accountId: line.chart_of_accounts?.id,
                              debit: isDebit ? { account: line.chart_of_accounts?.code, name: line.chart_of_accounts?.name } : { account: '---', name: '' },
                              credit: !isDebit ? { account: line.chart_of_accounts?.code, name: line.chart_of_accounts?.name } : { account: '---', name: '' },
                              value: val,
                              accountType: line.chart_of_accounts?.account_type
                          };
                    });

                    // Identificar a conta de classificação (não-bancária)
                    const classificationLine = displayEntries.find((e: any) => 
                        !e.debit?.account?.startsWith('1.1.1.') && e.debit?.account !== '---'
                    ) || displayEntries.find((e: any) => 
                        !e.credit?.account?.startsWith('1.1.1.') && e.credit?.account !== '---'
                    );

                    const sourceTypeLabel = entryHeader?.source_type === 'ofx_import' 
                        ? '📥 Importação OFX' 
                        : entryHeader?.source_type === 'classification'
                        ? '🏷️ Classificação'
                        : entryHeader?.source_type === 'manual'
                        ? '✏️ Manual'
                        : entryHeader?.source_type || 'Desconhecido';

                    setSuggestion({
                        description: entryHeader?.description || "Lançamento Registrado",
                        type: 'existing_entry',
                        reasoning: `${sourceTypeLabel} • Código: ${entryHeader?.internal_code || 'N/A'} • ${entryHeader?.created_at ? new Date(entryHeader.created_at).toLocaleString('pt-BR') : ''}`,
                        entries: displayEntries,
                        entryId: selectedTx.journal_entry_id,
                        classificationAccount: classificationLine ? {
                            code: classificationLine.debit?.account !== '---' ? classificationLine.debit?.account : classificationLine.credit?.account,
                            name: classificationLine.debit?.account !== '---' ? classificationLine.debit?.name : classificationLine.credit?.name
                        } : null
                    });
                } else {
                    // Não encontrou linhas - mostrar mensagem de erro
                    setSuggestion({
                        description: "Lançamento não encontrado",
                        type: 'error',
                        reasoning: `ID: ${selectedTx.journal_entry_id} - Verifique se o lançamento existe no banco de dados.`,
                        entries: []
                    });
                }
            } catch (err) {
                console.error('Erro ao carregar lançamento:', err);
                setSuggestion({
                    description: "Erro ao carregar lançamento",
                    type: 'error',
                    reasoning: String(err),
                    entries: []
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

  // Handler para quando a classificação obrigatória é completada
  const handleClassificationComplete = (result: { 
    action?: string;
    account?: { id: string; code: string; name: string };
    splitLines?: Array<{ account_id: string; amount: number }>;
    createRule?: boolean;
    success?: boolean; 
    entryId?: string; 
    message?: string;
  }) => {
    if (selectedTx) {
      // Para reclassificação, já foi atualizado no banco pelo ClassificationDialog
      // Apenas fechar o dialog e atualizar UI
      if (result.action === 'reclassify' && selectedTx.matched) {
        toast.success(result.account 
          ? `Reclassificado para: ${result.account.code} - ${result.account.name}`
          : 'Reclassificação realizada!'
        );
        setClassificationDialogOpen(false);
        setSuggestion(null);
        // Recarregar transações para atualizar a view
        fetchTransactions();
        return;
      }

      // Para classificação normal
      if (result.success || result.action) {
        toast.success(result.message || 'Classificação realizada com sucesso!');
        
        // Atualizar a transação como conciliada
        setTransactions(prev => prev.map(t => 
          t.id === selectedTx.id 
            ? { ...t, matched: true, journal_entry_id: result.entryId } 
            : t
        ));
        
        // Se estiver na aba de pendentes, remover da lista
        if (viewMode === 'pending') {
          setTransactions(prev => prev.filter(t => t.id !== selectedTx.id));
          setSelectedTx(null);
        } else {
          setSelectedTx(prev => prev ? { ...prev, matched: true, journal_entry_id: result.entryId } : null);
        }
        
        // Fechar dialog e limpar sugestão
        setClassificationDialogOpen(false);
        setSuggestion(null);
      } else {
        toast.error(result.message || 'Erro ao classificar transação');
      }
    }
  };

  // ============================================================================
  // AI-FIRST: Handler para aplicar sugestão do classificador automático
  // ============================================================================
  const handleApplyAISuggestion = useCallback(async (classificacao: ClassificacaoAutomatica) => {
    if (!selectedTx) return;
    
    // Converter classificação para o formato do ClassificationSuggestion
    const isEntrada = selectedTx.amount > 0;
    
    // Criar sugestão formatada e abrir dialog de classificação
    setSuggestion({
      type: isEntrada ? 'ENTRADA' : 'SAIDA',
      debitAccount: classificacao.debito.codigo,
      debitAccountName: classificacao.debito.nome,
      creditAccount: classificacao.credito.codigo,
      creditAccountName: classificacao.credito.nome,
      confidence: classificacao.confianca,
      reasoning: `Classificação automática por ${classificacao.agenteResponsavel.replace('_', ' ')}: ${classificacao.historico}`,
      description: classificacao.descricao,
      entries: [{
        value: Math.abs(selectedTx.amount),
        debit: { account: classificacao.debito.codigo, name: classificacao.debito.nome },
        credit: { account: classificacao.credito.codigo, name: classificacao.credito.nome }
      }]
    });
    
    // Se alta confiança e auto-classificar, abrir direto o dialog de classificação
    if (classificacao.autoClassificar && classificacao.confianca >= 0.95) {
      setClassificationDialogOpen(true);
    } else {
      // Mostrar preview e aguardar confirmação
      toast.info(`Sugestão: ${classificacao.debito.codigo} → ${classificacao.credito.codigo} (${Math.round(classificacao.confianca * 100)}% confiança)`);
    }
  }, [selectedTx]);

  // Handler para rejeitar sugestão da IA (feedback para treinamento)
  const handleRejectAISuggestion = useCallback((motivo: string) => {
    if (!selectedTx) return;
    
    // Log para futuro treinamento
    console.log('[AI Feedback] Sugestão rejeitada:', {
      transactionId: selectedTx.id,
      description: selectedTx.description,
      amount: selectedTx.amount,
      motivo,
      timestamp: new Date().toISOString()
    });
    
    // Abrir chat com Dr. Cícero
    setDrCiceroChatOpen(true);
    toast.info('Obrigado pelo feedback! Consulte o Dr. Cícero para classificação manual.');
  }, [selectedTx]);

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
            } catch {
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
                    Conciliadas (Auditoria)
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
            {/* GOVERNANÇA: Sugestão IA só aparece se NÃO tem lançamento contábil */}
            {suggestion && !selectedTx?.journal_entry_id && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-center text-slate-500 italic bg-blue-50/50 py-1 rounded">
                    <CheckCircle2 className="h-3 w-3 text-blue-400" />
                    Aprendizado Automático (Dr. Cícero) Ativo
                </div>
            )}
            
            {/* Botão de Classificação - SÓ aparece se NÃO tem journal_entry_id */}
            {selectedTx && !selectedTx.journal_entry_id && (
                <Button 
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all hover:scale-[1.02]" 
                    onClick={() => setClassificationDialogOpen(true)}
                >
                    <ShieldCheck className="h-4 w-4" />
                    Classificar (Dr. Cícero)
                </Button>
            )}
            
            {/* Botão de Reclassificação - SÓ aparece se JÁ tem journal_entry_id */}
            {selectedTx?.journal_entry_id && (
                <Button 
                    className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all hover:scale-[1.02]" 
                    onClick={() => setClassificationDialogOpen(true)}
                >
                    <SplitSquareHorizontal className="h-4 w-4" />
                    Reclassificar (Trocar Conta)
                </Button>
            )}
            
            {/* Botão Desfazer - SÓ aparece se tem journal_entry_id */}
            {selectedTx?.journal_entry_id ? (
                 <Button 
                    className="w-full gap-2" 
                    variant="outline"
                    onClick={handleUnmatch}
                    disabled={loading}
                >
                    <AlertTriangle className="h-4 w-4" />
                    Desfazer Conciliação
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
            
            {/* Botões Premium - Impacto e Educador */}
            {selectedTx && !selectedTx.journal_entry_id && suggestion && suggestion.entries?.length > 0 && (
              <div className="flex gap-2 w-full">
                <Button 
                    variant="outline" 
                    className="flex-1 gap-1 text-xs border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                    onClick={() => {
                      setImpactPanelOpen(true);
                      const isEntry = selectedTx.amount > 0;
                      const targetEntry = suggestion.entries[0];
                      const targetAccount = isEntry ? targetEntry.credit : targetEntry.debit;
                      
                      calculateImpact({
                        transactionId: selectedTx.id,
                        amount: selectedTx.amount,
                        description: selectedTx.description,
                        accountCode: targetAccount?.account || "",
                        accountName: targetAccount?.name || "",
                        isEntry
                      });
                    }}
                >
                    <Eye className="h-3 w-3" />
                    Impacto
                </Button>
                <Button 
                    variant="outline" 
                    className="flex-1 gap-1 text-xs border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100"
                    onClick={() => {
                      setEducatorPanelOpen(true);
                      const isEntry = selectedTx.amount > 0;
                      const targetEntry = suggestion.entries[0];
                      const targetAccount = isEntry ? targetEntry.credit : targetEntry.debit;
                      
                      generateExplanation({
                        transactionDescription: selectedTx.description,
                        amount: selectedTx.amount,
                        accountCode: targetAccount?.account,
                        accountName: targetAccount?.name,
                        isEntry
                      }, "classification" as any);
                    }}
                >
                    <GraduationCap className="h-3 w-3" />
                    Por quê?
                </Button>
              </div>
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
                    : `${viewMode === 'pending' ? 'Pendentes' : 'Conciliadas (Auditoria)'} • ${format(selectedDate, "MMM/yyyy", { locale: ptBR })} (${transactions.length})`
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
                
                {/* 🤖 AI FIRST - Resumo de Classificação em Lote */}
                {/* GOVERNANÇA: usa journal_entry_id como fonte de verdade */}
                {viewMode === 'pending' && transactions.filter(t => !t.journal_entry_id).length > 0 && (
                    <AIBatchSummary
                        transactions={transactions.filter(t => !t.journal_entry_id).map(t => ({
                            id: t.id,
                            description: t.description,
                            amount: t.amount,
                            date: t.date
                        }))}
                        onApplyAll={async (classificacoes) => {
                            toast.info(`Aplicando ${classificacoes.length} classificações automáticas...`);
                            // TODO: Implementar aplicação em lote
                        }}
                        onReviewManually={() => {
                            toast.info('Selecione cada transação para revisar manualmente');
                        }}
                    />
                )}
                
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-1">
            {loadingTx ? (
                 <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                 </div>
                        ) : transactions.length === 0 ? (
                 <div className="text-center p-8 text-muted-foreground text-sm">
                    {viewMode === 'pending' ? "Nenhuma pendência para este mês." : "Nenhuma transação conciliada neste mês."}
                 </div>
                        ) : pagedTransactions.map(tx => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className={`flex items-center gap-2 p-0.5 px-2 rounded-sm border cursor-pointer transition-all hover:bg-slate-100 min-h-[28px] ${selectedTx?.id === tx.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white'} ${tx.matched ? 'opacity-70 grayscale-[0.5]' : ''} ${tx.auto_matched ? 'border-l-2 border-l-emerald-500' : ''}`}
              >
                <div className="w-[60px] shrink-0 text-[10px] text-slate-500">{new Date(tx.date).toLocaleDateString().slice(0,5)}</div>

                <div className="flex-1 font-medium text-[10px] truncate leading-tight" title={tx.description}>
                    {/* GOVERNANÇA: journal_entry_id é fonte de verdade, matched pode estar inconsistente */}
                    {tx.journal_entry_id && <CheckCircle2 className="h-2 w-2 inline text-green-600 mr-1" title="Classificada (lançamento contábil existe)" />}
                    {tx.auto_matched && !tx.journal_entry_id && <Sparkles className="h-2 w-2 inline text-amber-500 mr-1" title="Auto-identificado (aguardando classificação)" />}
                    {tx.description}
                    {/* Badge de STATUS INCONSISTENTE - alerta visual quando há descompasso */}
                    {tx.journal_entry_id && !tx.matched && (
                      <span className="ml-1 inline-flex items-center gap-0.5 bg-orange-100 text-orange-700 px-1 rounded text-[8px] font-normal" title="Status inconsistente: lançamento existe mas status era pendente (trigger corrigiu)">
                        <AlertTriangle className="h-2 w-2" />
                        Sync
                      </span>
                    )}
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
                
                {/* Botão de consulta rápida ao Dr. Cícero */}
                {(() => {
                  const knowledge = getDrCiceroKnowledge(tx);
                  const isKnown = knowledge.known;
                  const tooltipText = isKnown 
                    ? `✓ Dr. Cícero sugere: ${knowledge.accountName}${knowledge.sigla ? ` [${knowledge.sigla}]` : ''} (${Math.round((knowledge.confidence || 0) * 100)}% confiança) - Clique para aplicar`
                    : knowledge.sigla 
                      ? `Sigla identificada: ${knowledge.sigla} - Clique para consultar Dr. Cícero`
                      : 'Consultar Dr. Cícero sobre este lançamento';
                  
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isKnown && knowledge.confidence && knowledge.confidence >= 0.85) {
                          // Se Dr. Cícero tem alta confiança, aplicar sugestão direto
                          setSelectedTx(tx);
                          setSuggestion({
                            type: tx.amount > 0 ? 'ENTRADA' : 'SAIDA',
                            debitAccount: tx.amount > 0 ? bankAccountCode : knowledge.accountCode || '',
                            debitAccountName: tx.amount > 0 ? 'Banco Sicredi' : knowledge.accountName || '',
                            creditAccount: tx.amount > 0 ? knowledge.accountCode || '' : bankAccountCode,
                            creditAccountName: tx.amount > 0 ? knowledge.accountName || '' : 'Banco Sicredi',
                            confidence: knowledge.confidence,
                            reasoning: `Classificação automática pelo Dr. Cícero: ${knowledge.accountName}${knowledge.sigla ? ` (${knowledge.sigla})` : ''}`,
                            description: tx.description
                          });
                          setClassificationDialogOpen(true);
                        } else {
                          // Se não conhece ou baixa confiança, abrir chat
                          setSelectedTx(tx);
                          setDrCiceroChatOpen(true);
                        }
                      }}
                      className={`shrink-0 p-1 rounded transition-colors group ${
                        isKnown 
                          ? 'hover:bg-green-100' 
                          : knowledge.sigla 
                            ? 'hover:bg-yellow-100'
                            : 'hover:bg-blue-100'
                      }`}
                      title={tooltipText}
                    >
                      <Brain className={`h-3.5 w-3.5 transition-colors ${
                        isKnown 
                          ? 'text-green-500 group-hover:text-green-700' 
                          : knowledge.sigla
                            ? 'text-yellow-500 group-hover:text-yellow-700'
                            : 'text-blue-400 group-hover:text-blue-600'
                      }`} />
                    </button>
                  );
                })()}
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
            ) : selectedTx.matched && suggestion ? (
                 // TRANSAÇÃO JÁ CONCILIADA - MOSTRAR LANÇAMENTO ORIGINAL
                 <div className="w-full h-full flex flex-col">
                    {/* Header com status */}
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-emerald-200">
                        <div className="bg-emerald-100 p-2 rounded-full">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-emerald-800">Transação Conciliada</h3>
                            <p className="text-xs text-emerald-600">{suggestion.reasoning}</p>
                        </div>
                    </div>

                    {/* Descrição do lançamento */}
                    <div className="bg-slate-50 rounded-lg p-3 mb-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Descrição do Lançamento</p>
                        <p className="text-sm font-medium text-slate-800">{suggestion.description}</p>
                    </div>

                    {/* Partidas do lançamento */}
                    <div className="flex-1 overflow-auto mb-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Partidas Registradas</p>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="text-left p-2 font-medium text-slate-600">Conta</th>
                                        <th className="text-right p-2 font-medium text-blue-600 w-24">Débito</th>
                                        <th className="text-right p-2 font-medium text-red-600 w-24">Crédito</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suggestion.entries?.map((entry: any, idx: number) => (
                                        <tr key={idx} className="border-t hover:bg-slate-50">
                                            <td className="p-2">
                                                <span className="font-mono text-[10px] bg-slate-200 px-1 rounded mr-1">
                                                    {entry.debit?.account !== '---' ? entry.debit.account : entry.credit?.account}
                                                </span>
                                                <span className="text-slate-700">
                                                    {entry.debit?.account !== '---' ? entry.debit.name : entry.credit?.name}
                                                </span>
                                            </td>
                                            <td className="p-2 text-right font-mono text-blue-700">
                                                {entry.debit?.account !== '---' ? formatCurrency(entry.value) : ''}
                                            </td>
                                            <td className="p-2 text-right font-mono text-red-700">
                                                {entry.credit?.account !== '---' ? formatCurrency(entry.value) : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2">
                                    <tr>
                                        <td className="p-2 font-semibold text-slate-600">TOTAL</td>
                                        <td className="p-2 text-right font-mono font-bold text-blue-700">
                                            {formatCurrency(suggestion.entries?.reduce((sum: number, e: any) => 
                                                sum + (e.debit?.account !== '---' ? Number(e.value) : 0), 0) || 0)}
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-red-700">
                                            {formatCurrency(suggestion.entries?.reduce((sum: number, e: any) => 
                                                sum + (e.credit?.account !== '---' ? Number(e.value) : 0), 0) || 0)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Desmembramento de Cobrança (COB) */}
                    {selectedTx && (/(^|\s)[C]?OB\d+/.test(selectedTx.description) || selectedTx.description.includes('COBRANCA') || selectedTx.description.includes('Cobrança')) && (
                        <div className="mt-4 border-t pt-4">
                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">📋 Composição da Cobrança (Clientes)</p>
                            <CollectionClientBreakdown 
                                cobrancaDoc={selectedTx.description.match(/[C]?OB\d+/)?.[0] || ''}
                                amount={Math.abs(selectedTx.amount)}
                                transactionDate={selectedTx.date}
                            />
                        </div>
                    )}

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t">
                        <Button 
                            variant="outline" 
                            className="flex-1 border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
                            onClick={() => setDrCiceroChatOpen(true)}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Consultar Dr. Cícero
                        </Button>
                        <Button 
                            variant="outline" 
                            className="flex-1 border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
                            onClick={() => {
                                setClassificationDialogOpen(true);
                            }}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reclassificar (Trocar Conta)
                        </Button>
                        <Button 
                            variant="outline" 
                            className="flex-1 border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100" 
                            onClick={() => navigate('/client-ledger')}
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ver no Extrato
                        </Button>
                        
                        {/* Botões Premium - Impacto e Educador */}
                        <div className="flex gap-2 w-full mt-2">
                          <Button 
                              variant="outline" 
                              className="flex-1 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              onClick={() => {
                                setImpactPanelOpen(true);
                                if (selectedTx && suggestion) {
                                  const isEntry = selectedTx.amount > 0;
                                  
                                  // Para transações conciliadas, usar classificationAccount se disponível
                                  let accountCode = "";
                                  let accountName = "";
                                  
                                  if (suggestion.classificationAccount) {
                                    accountCode = suggestion.classificationAccount.code;
                                    accountName = suggestion.classificationAccount.name;
                                  } else if (suggestion.entries?.length > 0) {
                                    const targetEntry = suggestion.entries[0];
                                    const targetAccount = isEntry ? targetEntry.credit : targetEntry.debit;
                                    accountCode = targetAccount?.account || "";
                                    accountName = targetAccount?.name || "";
                                  }
                                  
                                  console.log('calculateImpact chamado com:', { accountCode, accountName, isEntry, amount: selectedTx.amount });
                                  
                                  calculateImpact({
                                    transactionId: selectedTx.id,
                                    amount: selectedTx.amount,
                                    description: selectedTx.description,
                                    accountCode,
                                    accountName,
                                    isEntry
                                  });
                                }
                              }}
                          >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Impacto
                          </Button>
                          <Button 
                              variant="outline" 
                              className="flex-1 border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100"
                              onClick={() => {
                                setEducatorPanelOpen(true);
                                if (selectedTx && suggestion) {
                                  const isEntry = selectedTx.amount > 0;
                                  
                                  // Para transações conciliadas, usar classificationAccount se disponível
                                  let accountCode = "";
                                  let accountName = "";
                                  
                                  if (suggestion.classificationAccount) {
                                    accountCode = suggestion.classificationAccount.code;
                                    accountName = suggestion.classificationAccount.name;
                                  } else if (suggestion.entries?.length > 0) {
                                    const targetEntry = suggestion.entries[0];
                                    const targetAccount = isEntry ? targetEntry.credit : targetEntry.debit;
                                    accountCode = targetAccount?.account || "";
                                    accountName = targetAccount?.name || "";
                                  }
                                  
                                  generateExplanation({
                                    transactionDescription: selectedTx.description,
                                    amount: selectedTx.amount,
                                    accountCode,
                                    accountName,
                                    isEntry
                                  }, "classification" as any);
                                }
                              }}
                          >
                              <GraduationCap className="h-4 w-4 mr-2" />
                              Por quê?
                          </Button>
                        </div>
                        
                        <Button 
                            variant="destructive" 
                            className="w-full mt-2" 
                            onClick={handleUnmatch} 
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Desfazer Conciliação e Excluir Lançamento
                        </Button>
                    </div>
                 </div>
            ) : selectedTx.matched && loading ? (
                 // Carregando o lançamento
                 <div className="text-center">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-500">Carregando lançamento...</p>
                 </div>
            ) : selectedTx.matched && !suggestion ? (
                 // Lançamento não encontrado
                 <div className="text-center p-6">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                    <h3 className="font-semibold text-slate-700">Lançamento não encontrado</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        O lançamento vinculado (ID: {selectedTx.journal_entry_id?.slice(0,8)}...) não foi encontrado no banco de dados.
                    </p>
                    <Button 
                        variant="destructive" 
                        className="mt-4" 
                        onClick={handleUnmatch} 
                        disabled={loading}
                    >
                        Desfazer Conciliação
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
                <div className="w-full h-full flex flex-col gap-4 overflow-auto">
                    {/* 🤖 AI FIRST - Sugestão Automática do Agente */}
                    <AIAgentSuggestions
                        transaction={{
                            id: selectedTx.id,
                            description: selectedTx.description,
                            amount: selectedTx.amount,
                            date: selectedTx.date
                        }}
                        onApplySuggestion={handleApplyAISuggestion}
                        onReject={handleRejectAISuggestion}
                        onAskDrCicero={() => setDrCiceroChatOpen(true)}
                    />
                    
                    {/* Diagnóstico Original (caso AI não tenha classificado) */}
                    {suggestion?.description && (
                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-1">Diagnóstico Complementar</h3>
                            <p className="text-sm text-slate-900">{suggestion.description}</p>
                            {suggestion?.reasoning && (
                                <div className="mt-3 bg-amber-50 text-amber-800 text-xs p-3 rounded-md flex items-start gap-2 border border-amber-200">
                                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                    {suggestion.reasoning}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {suggestion?.type === 'split' && (
                         <div className="mt-2">
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
            )}
         </div>
      </Card>

      {/* COLUNA 3: Efetivação Contábil - Só mostra para transações NÃO conciliadas */}
      {!selectedTx?.matched && (
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
      )}
      </div>
      )}

      {/* Dialog de Classificação Obrigatória - Dr. Cícero */}
      <ClassificationDialog
        open={classificationDialogOpen}
        onOpenChange={setClassificationDialogOpen}
        transaction={selectedTx ? {
          id: selectedTx.id,
          amount: selectedTx.amount,
          date: selectedTx.date,
          description: selectedTx.description,
          suggested_account_id: undefined,
          suggested_account_code: undefined,
          suggested_account_name: undefined,
          journal_entry_id: selectedTx.journal_entry_id,
          is_reclassification: selectedTx.matched,
        } : null}
        onClassificationComplete={handleClassificationComplete}
      />
      
      {/* Chat de Consulta com Dr. Cícero */}
      <DrCiceroChat
        open={drCiceroChatOpen}
        onOpenChange={setDrCiceroChatOpen}
        transaction={selectedTx}
      />

      {/* Painel de Impacto Contábil - ANTES/DEPOIS */}
      {impactPanelOpen && selectedTx && (
        <div className="fixed bottom-4 right-4 z-50 w-[480px] max-h-[600px] overflow-hidden">
          <ImpactPreviewPanel
            isCalculating={isCalculating}
            impact={impact}
            onClose={() => {
              setImpactPanelOpen(false);
              clearImpact();
            }}
          />
        </div>
      )}

      {/* Painel Educador - Por quê? */}
      {educatorPanelOpen && (
        <div className="fixed bottom-4 left-4 z-50 w-[480px] max-h-[600px] overflow-hidden">
          <EducatorPanel
            loading={isEducatorLoading}
            explanation={explanation}
            onClose={() => {
              setEducatorPanelOpen(false);
              clearExplanation();
            }}
          />
        </div>
      )}
    </Tabs>
  );
}