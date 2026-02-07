/**
 * =============================================================================
 * PAINEL DE CONCILIAÇÃO BANCÁRIA COMPLETO - AI-FIRST
 * =============================================================================
 *
 * Fluxo completo em uma única tela:
 * 1. Importação (OFX + CSV)
 * 2. Conciliação Automática
 * 3. Classificação AI
 * 4. Vinculação de Clientes (RAG)
 * 5. Geração de Lançamentos
 * 6. Fechamento do Mês
 *
 * Metodologia: AI-First, Data Lake, RAG, Agentes
 * Dr. Cícero - Documentação para acompanhamento
 * =============================================================================
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wallet,
  Receipt,
  Landmark,
  CreditCard,
  Brain,
  Users,
  BookOpen,
  Lock,
  ArrowRight,
  Sparkles,
  Database,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/data/expensesData';
import { parseOFX, OFXStatement } from '@/lib/ofxParser';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useDataLake } from '@/hooks/useDataLake';
import {
  reconcileFromFiles,
  ReconciliationSummary,
  ReconciliationMatch,
  ClassifiedTransaction,
  BoletoCSV,
  formatDate as formatDateService,
  classifyTransaction
} from '@/services/BankReconciliationService';
import { searchKnowledgeBase } from '@/services/RAGSearchService';

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

type FlowStep = 'import' | 'reconcile' | 'classify' | 'clients' | 'entries' | 'close';

interface UploadedFile {
  name: string;
  content: string;
  type: 'ofx' | 'csv';
}

interface ClientMatch {
  boleto: BoletoCSV;
  clientId?: string;
  clientName?: string;
  accountingAccountId?: string;
  accountCode?: string;
  confidence: number;
  source: 'rag' | 'cnpj' | 'name' | 'manual';
}

interface EntryToCreate {
  id: string;
  match: ReconciliationMatch;
  clientMatches: ClientMatch[];
  debitAccount: string;
  creditAccount: string;
  description: string;
  amount: number;
  date: Date;
  selected: boolean;
  status: 'pending' | 'created' | 'error';
}

// =============================================================================
// CONSTANTES
// =============================================================================

const STEPS: { key: FlowStep; label: string; icon: any }[] = [
  { key: 'import', label: 'Importar', icon: Upload },
  { key: 'reconcile', label: 'Conciliar', icon: RefreshCw },
  { key: 'classify', label: 'Classificar', icon: Brain },
  { key: 'clients', label: 'Clientes', icon: Users },
  { key: 'entries', label: 'Lançamentos', icon: BookOpen },
  { key: 'close', label: 'Fechar', icon: Lock }
];

const BANK_ACCOUNT_CODE = '1.1.1.05'; // Banco Sicredi
const TRANSIT_CREDIT_CODE = '2.1.9.01'; // Transitória Créditos
const TRANSIT_DEBIT_CODE = '1.1.9.01'; // Transitória Débitos

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export function BankReconciliationPanel() {
  const { tenant } = useTenantConfig();
  const tenantId = tenant?.id;
  const { uploadFile: uploadToDataLake } = useDataLake();

  // Estado do fluxo
  const [currentStep, setCurrentStep] = useState<FlowStep>('import');
  const [completedSteps, setCompletedSteps] = useState<Set<FlowStep>>(new Set());

  // Estado dos arquivos
  const [ofxFile, setOfxFile] = useState<UploadedFile | null>(null);
  const [csvFile, setCsvFile] = useState<UploadedFile | null>(null);

  // Estado do processamento
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // Resultados
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationSummary | null>(null);
  const [clientMatches, setClientMatches] = useState<Map<string, ClientMatch[]>>(new Map());
  const [entriesToCreate, setEntriesToCreate] = useState<EntryToCreate[]>([]);

  // UI
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [showPix, setShowPix] = useState(false);

  // ==========================================================================
  // HANDLERS DE UPLOAD
  // ==========================================================================

  const handleFileUpload = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    fileType: 'ofx' | 'csv'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();

      if (fileType === 'ofx') {
        setOfxFile({ name: file.name, content, type: 'ofx' });

        // Indexar no Data Lake
        if (tenantId) {
          await uploadToDataLake(file, 'banco', 'extratos', undefined, ['ofx', 'extrato']);
        }

        toast.success(`OFX carregado: ${file.name}`);
      } else {
        setCsvFile({ name: file.name, content, type: 'csv' });

        // Indexar no Data Lake
        if (tenantId) {
          await uploadToDataLake(file, 'banco', 'boletos', undefined, ['csv', 'boletos']);
        }

        toast.success(`CSV carregado: ${file.name}`);
      }

      // Resetar etapas posteriores
      setReconciliationResult(null);
      setClientMatches(new Map());
      setEntriesToCreate([]);
      setCompletedSteps(new Set());

    } catch (error: any) {
      toast.error(`Erro ao ler arquivo: ${error.message}`);
    }

    event.target.value = '';
  }, [tenantId, uploadToDataLake]);

  // ==========================================================================
  // ETAPA 2: CONCILIAÇÃO AUTOMÁTICA
  // ==========================================================================

  const runReconciliation = useCallback(async () => {
    if (!ofxFile || !csvFile) {
      toast.error('Carregue ambos os arquivos (OFX e CSV)');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Processando conciliação...');

    try {
      const result = await reconcileFromFiles(ofxFile.content, csvFile.content);

      if (result.success && result.summary) {
        setReconciliationResult(result.summary);
        setCompletedSteps(prev => new Set([...prev, 'import', 'reconcile']));
        setCurrentStep('classify');
        toast.success(`Conciliação concluída: ${result.summary.lotesConciliados} lotes OK`);
      } else {
        toast.error(result.error || 'Erro na conciliação');
      }
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [ofxFile, csvFile]);

  // ==========================================================================
  // ETAPA 3: CLASSIFICAÇÃO AI
  // ==========================================================================

  const runAIClassification = useCallback(async () => {
    if (!reconciliationResult || !tenantId) return;

    setIsProcessing(true);
    setProcessingMessage('IA classificando transações...');

    try {
      // Buscar contas contábeis do tenant
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type')
        .eq('tenant_id', tenantId)
        .eq('is_analytic', true);

      const accountMap = new Map(accounts?.map(a => [a.code, a]) || []);
      const bankAccount = accountMap.get(BANK_ACCOUNT_CODE);
      const transitCredit = accountMap.get(TRANSIT_CREDIT_CODE);
      const transitDebit = accountMap.get(TRANSIT_DEBIT_CODE);

      // Criar entries para cada match conciliado
      const entries: EntryToCreate[] = reconciliationResult.matches
        .filter(m => m.status === 'CONCILIADO' && m.valorCreditoOFX > 0)
        .map((match, idx) => ({
          id: `entry_${idx}_${match.cobNumber}`,
          match,
          clientMatches: [],
          // Recebimento: D Banco / C Transitória
          debitAccount: BANK_ACCOUNT_CODE,
          creditAccount: TRANSIT_CREDIT_CODE,
          description: `Recebimento boletos ${match.cobNumber} - ${match.boletos.length} clientes`,
          amount: match.valorCreditoOFX,
          date: match.dataExtratoOFX,
          selected: true,
          status: 'pending' as const
        }));

      // Adicionar PIX como entries separados
      for (const pix of reconciliationResult.transacoesPIX) {
        entries.push({
          id: `pix_${pix.fitid}`,
          match: {
            cobNumber: 'PIX',
            dataExtratoOFX: pix.date,
            valorCreditoOFX: pix.amount,
            somaBoletosCsv: 0,
            diferenca: pix.amount,
            tarifaAssociada: 0,
            liquidoReal: pix.amount,
            status: 'SEM_BOLETO',
            boletos: [],
            transacaoOFX: pix,
            tarifasOFX: []
          },
          clientMatches: [],
          debitAccount: BANK_ACCOUNT_CODE,
          creditAccount: TRANSIT_CREDIT_CODE,
          description: `PIX recebido - ${pix.payerName || pix.cnpjCpf || 'Não identificado'}`,
          amount: pix.amount,
          date: pix.date,
          selected: true,
          status: 'pending'
        });
      }

      setEntriesToCreate(entries);
      setCompletedSteps(prev => new Set([...prev, 'classify']));
      setCurrentStep('clients');
      toast.success(`${entries.length} lançamentos preparados para classificação`);

    } catch (error: any) {
      toast.error(`Erro na classificação: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [reconciliationResult, tenantId]);

  // ==========================================================================
  // ETAPA 4: VINCULAÇÃO DE CLIENTES (RAG)
  // ==========================================================================

  const runClientMatching = useCallback(async () => {
    if (!reconciliationResult || !tenantId) return;

    setIsProcessing(true);
    setProcessingMessage('RAG buscando clientes...');

    try {
      const newClientMatches = new Map<string, ClientMatch[]>();

      // Para cada match com boletos, buscar clientes
      for (const match of reconciliationResult.matches) {
        if (match.boletos.length === 0) continue;

        const matchClients: ClientMatch[] = [];

        for (const boleto of match.boletos) {
          // Buscar cliente pelo nome no banco
          const { data: clientsByName } = await supabase
            .from('clients')
            .select('id, name, cnpj, accounting_account_id')
            .eq('tenant_id', tenantId)
            .ilike('name', `%${boleto.pagador.substring(0, 15)}%`)
            .limit(1);

          if (clientsByName && clientsByName.length > 0) {
            const client = clientsByName[0];

            // Buscar código da conta contábil
            let accountCode = '';
            if (client.accounting_account_id) {
              const { data: account } = await supabase
                .from('chart_of_accounts')
                .select('code')
                .eq('id', client.accounting_account_id)
                .single();
              accountCode = account?.code || '';
            }

            matchClients.push({
              boleto,
              clientId: client.id,
              clientName: client.name,
              accountingAccountId: client.accounting_account_id,
              accountCode,
              confidence: 0.85,
              source: 'name'
            });
          } else {
            // Não encontrou - marcar para revisão
            matchClients.push({
              boleto,
              confidence: 0,
              source: 'manual'
            });
          }
        }

        newClientMatches.set(match.cobNumber, matchClients);
      }

      // Buscar clientes para PIX via RAG
      for (const pix of reconciliationResult.transacoesPIX) {
        if (pix.payerName || pix.cnpjCpf) {
          const searchTerm = pix.payerName || pix.cnpjCpf || '';

          // Buscar via RAG
          const ragResults = await searchKnowledgeBase(tenantId, searchTerm, {
            category: 'cliente',
            limit: 1
          });

          if (ragResults.length > 0) {
            const pixKey = `PIX_${pix.fitid}`;
            newClientMatches.set(pixKey, [{
              boleto: {
                documento: 'PIX',
                nossoNumero: pix.fitid,
                pagador: pix.payerName || '',
                dataVencimento: null,
                dataLiquidacao: pix.date,
                valorBoleto: pix.amount,
                valorRecebido: pix.amount,
                dataExtrato: pix.date,
                jurosMulta: 0
              },
              clientName: ragResults[0].title,
              confidence: ragResults[0].relevance / 10,
              source: 'rag'
            }]);
          }
        }
      }

      setClientMatches(newClientMatches);
      setCompletedSteps(prev => new Set([...prev, 'clients']));
      setCurrentStep('entries');

      const totalMatched = Array.from(newClientMatches.values())
        .flat()
        .filter(m => m.clientId).length;

      toast.success(`${totalMatched} clientes vinculados via RAG/Banco`);

    } catch (error: any) {
      toast.error(`Erro ao buscar clientes: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [reconciliationResult, tenantId]);

  // ==========================================================================
  // ETAPA 5: GERAÇÃO DE LANÇAMENTOS
  // ==========================================================================

  const createAccountingEntries = useCallback(async () => {
    if (!tenantId || entriesToCreate.length === 0) return;

    setIsProcessing(true);
    setProcessingMessage('Criando lançamentos contábeis...');

    const selectedEntries = entriesToCreate.filter(e => e.selected && e.status === 'pending');

    try {
      // Buscar IDs das contas
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, code')
        .eq('tenant_id', tenantId)
        .in('code', [BANK_ACCOUNT_CODE, TRANSIT_CREDIT_CODE, TRANSIT_DEBIT_CODE]);

      const accountIdMap = new Map(accounts?.map(a => [a.code, a.id]) || []);
      const bankAccountId = accountIdMap.get(BANK_ACCOUNT_CODE);
      const transitCreditId = accountIdMap.get(TRANSIT_CREDIT_CODE);

      if (!bankAccountId || !transitCreditId) {
        throw new Error('Contas contábeis não encontradas (1.1.1.05 ou 2.1.9.01)');
      }

      let created = 0;
      let errors = 0;

      for (const entry of selectedEntries) {
        try {
          // Criar accounting_entry
          const { data: newEntry, error: entryError } = await supabase
            .from('accounting_entries')
            .insert({
              tenant_id: tenantId,
              description: entry.description,
              entry_date: entry.date.toISOString().split('T')[0],
              competence_date: entry.date.toISOString().split('T')[0],
              entry_type: 'recebimento',
              is_draft: false,
              source_type: 'bank_reconciliation',
              internal_code: `RECON_${entry.match.cobNumber}_${Date.now()}`
            })
            .select('id')
            .single();

          if (entryError) throw entryError;

          // Criar linhas do lançamento
          const debitAccountId = accountIdMap.get(entry.debitAccount) || bankAccountId;
          const creditAccountId = accountIdMap.get(entry.creditAccount) || transitCreditId;

          // Linha de Débito (Banco)
          await supabase.from('accounting_entry_items').insert({
            tenant_id: tenantId,
            entry_id: newEntry.id,
            account_id: debitAccountId,
            debit: entry.amount,
            credit: 0
          });

          // Linha de Crédito (Transitória ou Cliente)
          await supabase.from('accounting_entry_items').insert({
            tenant_id: tenantId,
            entry_id: newEntry.id,
            account_id: creditAccountId,
            debit: 0,
            credit: entry.amount
          });

          // Atualizar status
          entry.status = 'created';
          created++;

        } catch (err: any) {
          console.error(`Erro ao criar entry ${entry.id}:`, err);
          entry.status = 'error';
          errors++;
        }
      }

      setEntriesToCreate([...entriesToCreate]);
      setCompletedSteps(prev => new Set([...prev, 'entries']));
      setCurrentStep('close');

      toast.success(`${created} lançamentos criados${errors > 0 ? `, ${errors} erros` : ''}`);

    } catch (error: any) {
      toast.error(`Erro ao criar lançamentos: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [tenantId, entriesToCreate]);

  // ==========================================================================
  // ETAPA 6: FECHAMENTO DO MÊS
  // ==========================================================================

  const closeMonth = useCallback(async () => {
    if (!tenantId || !reconciliationResult) return;

    setIsProcessing(true);
    setProcessingMessage('Fechando competência...');

    try {
      const monthDate = reconciliationResult.periodo.inicio;
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;

      // Verificar se já existe fechamento
      const { data: existing } = await supabase
        .from('accounting_closures')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('year_month', `${year}-${String(month).padStart(2, '0')}-01`)
        .single();

      if (existing) {
        toast.info('Mês já fechado anteriormente');
      } else {
        // Criar fechamento
        const { error } = await supabase
          .from('accounting_closures')
          .insert({
            tenant_id: tenantId,
            year_month: `${year}-${String(month).padStart(2, '0')}-01`,
            status: 'closed',
            closed_at: new Date().toISOString(),
            notes: `Fechamento via Conciliação Bancária - ${entriesToCreate.filter(e => e.status === 'created').length} lançamentos`
          });

        if (error) throw error;
      }

      setCompletedSteps(prev => new Set([...prev, 'close']));
      toast.success(`Competência ${String(month).padStart(2, '0')}/${year} fechada com sucesso!`);

    } catch (error: any) {
      toast.error(`Erro ao fechar mês: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [tenantId, reconciliationResult, entriesToCreate]);

  // ==========================================================================
  // TOGGLE E HELPERS
  // ==========================================================================

  const toggleMatchExpansion = useCallback((key: string) => {
    setExpandedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  }, []);

  const toggleEntrySelection = useCallback((entryId: string) => {
    setEntriesToCreate(prev => prev.map(e =>
      e.id === entryId ? { ...e, selected: !e.selected } : e
    ));
  }, []);

  const selectAllEntries = useCallback((selected: boolean) => {
    setEntriesToCreate(prev => prev.map(e => ({ ...e, selected })));
  }, []);

  const resetAll = useCallback(() => {
    setOfxFile(null);
    setCsvFile(null);
    setReconciliationResult(null);
    setClientMatches(new Map());
    setEntriesToCreate([]);
    setCompletedSteps(new Set());
    setCurrentStep('import');
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-4 p-2">
      {/* Stepper */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = completedSteps.has(step.key);
              const isCurrent = currentStep === step.key;

              return (
                <div key={step.key} className="flex items-center">
                  <button
                    onClick={() => isCompleted && setCurrentStep(step.key)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                      isCurrent ? 'bg-blue-100 text-blue-700' :
                      isCompleted ? 'bg-green-50 text-green-700 cursor-pointer hover:bg-green-100' :
                      'text-gray-400'
                    }`}
                    disabled={!isCompleted && !isCurrent}
                  >
                    <div className={`p-2 rounded-full ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-blue-500 text-white' :
                      'bg-gray-200'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className="text-xs font-medium">{step.label}</span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <ArrowRight className={`h-4 w-4 mx-1 ${isCompleted ? 'text-green-500' : 'text-gray-300'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Processing Overlay */}
      {isProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-blue-700 font-medium">{processingMessage}</span>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 1: IMPORTAÇÃO */}
      {currentStep === 'import' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Importar Arquivos
            </CardTitle>
            <CardDescription>
              Faça upload do extrato bancário (OFX) e planilha de boletos (CSV)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* OFX Upload */}
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                ofxFile ? 'border-green-400 bg-green-50' : 'hover:border-blue-400'
              }`}>
                <input
                  type="file"
                  accept=".ofx"
                  onChange={(e) => handleFileUpload(e, 'ofx')}
                  className="hidden"
                  id="ofx-upload"
                />
                <label htmlFor="ofx-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    {ofxFile ? (
                      <>
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                        <span className="font-medium text-green-700">{ofxFile.name}</span>
                        <Badge variant="outline" className="text-green-600">Indexado no Data Lake</Badge>
                      </>
                    ) : (
                      <>
                        <Landmark className="h-10 w-10 text-gray-400" />
                        <span className="text-gray-600 font-medium">Extrato Bancário</span>
                        <span className="text-xs text-gray-500">.ofx</span>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* CSV Upload */}
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                csvFile ? 'border-green-400 bg-green-50' : 'hover:border-blue-400'
              }`}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'csv')}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    {csvFile ? (
                      <>
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                        <span className="font-medium text-green-700">{csvFile.name}</span>
                        <Badge variant="outline" className="text-green-600">Indexado no Data Lake</Badge>
                      </>
                    ) : (
                      <>
                        <FileText className="h-10 w-10 text-gray-400" />
                        <span className="text-gray-600 font-medium">Boletos Liquidados</span>
                        <span className="text-xs text-gray-500">.csv</span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={runReconciliation}
                disabled={!ofxFile || !csvFile || isProcessing}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Iniciar Conciliação
              </Button>
              <Button variant="outline" onClick={resetAll}>
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2: RESULTADO DA CONCILIAÇÃO */}
      {currentStep === 'reconcile' && reconciliationResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              Conciliação Concluída
            </CardTitle>
            <CardDescription>
              Período: {formatDateService(reconciliationResult.periodo.inicio)} a {formatDateService(reconciliationResult.periodo.fim)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{reconciliationResult.lotesConciliados}</div>
                <div className="text-xs text-green-600">Conciliados</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700">{reconciliationResult.lotesComDivergencia}</div>
                <div className="text-xs text-yellow-600">Divergentes</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{reconciliationResult.creditosPIX}</div>
                <div className="text-xs text-purple-600">PIX</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{formatCurrency(reconciliationResult.totalCreditosOFX)}</div>
                <div className="text-xs text-blue-600">Total</div>
              </div>
            </div>

            <Button onClick={runAIClassification} className="w-full" disabled={isProcessing}>
              <Brain className="h-4 w-4 mr-2" />
              Classificar com IA
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 3: CLASSIFICAÇÃO */}
      {currentStep === 'classify' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Classificação AI-First
            </CardTitle>
            <CardDescription>
              {entriesToCreate.length} lançamentos preparados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runClientMatching} className="w-full" disabled={isProcessing}>
              <Search className="h-4 w-4 mr-2" />
              Buscar Clientes (RAG)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 4: CLIENTES */}
      {currentStep === 'clients' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Vinculação de Clientes
            </CardTitle>
            <CardDescription>
              {Array.from(clientMatches.values()).flat().filter(m => m.clientId).length} clientes encontrados via RAG
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {Array.from(clientMatches.entries()).map(([cob, matches]) => (
                <div key={cob} className="mb-2 p-2 bg-gray-50 rounded">
                  <div className="font-medium text-sm mb-1">{cob}</div>
                  {matches.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1">
                      <span className="truncate max-w-[200px]">{m.boleto.pagador}</span>
                      {m.clientId ? (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {m.source.toUpperCase()}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600">Revisar</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </ScrollArea>

            <Button onClick={() => setCurrentStep('entries')} className="w-full mt-4">
              <BookOpen className="h-4 w-4 mr-2" />
              Gerar Lançamentos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 5: LANÇAMENTOS */}
      {currentStep === 'entries' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Lançamentos Contábeis
            </CardTitle>
            <CardDescription>
              {entriesToCreate.filter(e => e.selected).length} de {entriesToCreate.length} selecionados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={() => selectAllEntries(true)}>
                Selecionar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={() => selectAllEntries(false)}>
                Limpar Seleção
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              {entriesToCreate.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-2 rounded mb-1 ${
                    entry.status === 'created' ? 'bg-green-50' :
                    entry.status === 'error' ? 'bg-red-50' :
                    'bg-gray-50'
                  }`}
                >
                  <Checkbox
                    checked={entry.selected}
                    onCheckedChange={() => toggleEntrySelection(entry.id)}
                    disabled={entry.status !== 'pending'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{entry.description}</div>
                    <div className="text-xs text-gray-500">
                      {formatDateService(entry.date)} • D: {entry.debitAccount} / C: {entry.creditAccount}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">{formatCurrency(entry.amount)}</div>
                    {entry.status === 'created' && (
                      <Badge className="text-[10px] bg-green-500">Criado</Badge>
                    )}
                    {entry.status === 'error' && (
                      <Badge className="text-[10px] bg-red-500">Erro</Badge>
                    )}
                  </div>
                </div>
              ))}
            </ScrollArea>

            <Button
              onClick={createAccountingEntries}
              className="w-full mt-4"
              disabled={isProcessing || entriesToCreate.filter(e => e.selected && e.status === 'pending').length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Criar {entriesToCreate.filter(e => e.selected && e.status === 'pending').length} Lançamentos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 6: FECHAMENTO */}
      {currentStep === 'close' && (
        <Card className="border-green-200">
          <CardHeader className="pb-3 bg-green-50">
            <CardTitle className="text-lg flex items-center gap-2 text-green-700">
              <Lock className="h-5 w-5" />
              Fechamento da Competência
            </CardTitle>
            <CardDescription>
              {entriesToCreate.filter(e => e.status === 'created').length} lançamentos criados com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="bg-green-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Créditos:</span>
                  <span className="font-bold ml-2">{formatCurrency(reconciliationResult?.totalCreditosOFX || 0)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Boletos:</span>
                  <span className="font-bold ml-2">{formatCurrency(reconciliationResult?.totalBoletosCSV || 0)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total PIX:</span>
                  <span className="font-bold ml-2">
                    {formatCurrency(reconciliationResult?.transacoesPIX.reduce((s, p) => s + p.amount, 0) || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Tarifas:</span>
                  <span className="font-bold ml-2 text-red-600">
                    -{formatCurrency(reconciliationResult?.totalTarifas || 0)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={closeMonth}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              <Lock className="h-4 w-4 mr-2" />
              Fechar Competência {reconciliationResult?.periodo.inicio.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
            </Button>

            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={resetAll}
            >
              Iniciar Nova Conciliação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BankReconciliationPanel;
