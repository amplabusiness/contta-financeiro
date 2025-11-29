import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  BookOpen,
  Zap,
  Database,
  TrendingUp,
  Loader2,
  Activity,
  Play,
  FileText,
  Receipt,
  RefreshCw
} from "lucide-react";

interface AccountingStats {
  chartOfAccounts: number;
  entries: number;
  lines: number;
  invoices: number;
  openingBalances: number;
  expenses: number;
  healthStatus: 'healthy' | 'warning' | 'error' | 'loading';
  orphanEntries: number;
}

const SmartAccounting = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<AccountingStats>({
    chartOfAccounts: 0,
    entries: 0,
    lines: 0,
    invoices: 0,
    openingBalances: 0,
    expenses: 0,
    healthStatus: 'loading',
    orphanEntries: 0
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  useEffect(() => {
    loadStats();
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Buscar estatísticas em paralelo
      const [
        { count: chartCount },
        { count: entriesCount },
        { count: linesCount },
        { count: invoicesCount },
        { count: openingBalancesCount },
        { count: expensesCount }
      ] = await Promise.all([
        supabase.from('chart_of_accounts').select('*', { count: 'exact', head: true }),
        supabase.from('accounting_entries').select('*', { count: 'exact', head: true }),
        supabase.from('accounting_entry_lines').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('*', { count: 'exact', head: true }),
        (supabase as any).from('client_opening_balance').select('*', { count: 'exact', head: true }),
        supabase.from('expenses').select('*', { count: 'exact', head: true })
      ]);

      // Verificar se há órfãos
      let orphanCount = 0;
      if ((entriesCount || 0) > 0 && (linesCount || 0) === 0) {
        orphanCount = entriesCount || 0;
      } else if ((entriesCount || 0) > 0 && (linesCount || 0) > 0) {
        // Verificação mais precisa
        const { data: entriesWithLines } = await supabase
          .from('accounting_entry_lines')
          .select('entry_id');

        const validIds = new Set((entriesWithLines || []).map(e => e.entry_id));

        const { data: allEntries } = await supabase
          .from('accounting_entries')
          .select('id');

        orphanCount = (allEntries || []).filter(e => !validIds.has(e.id)).length;
      }

      // Determinar status de saúde
      let healthStatus: AccountingStats['healthStatus'] = 'healthy';
      if (orphanCount > 0) {
        healthStatus = 'warning';
      }
      if ((chartCount || 0) === 0) {
        healthStatus = 'warning';
      }

      setStats({
        chartOfAccounts: chartCount || 0,
        entries: entriesCount || 0,
        lines: linesCount || 0,
        invoices: invoicesCount || 0,
        openingBalances: openingBalancesCount || 0,
        expenses: expensesCount || 0,
        healthStatus,
        orphanEntries: orphanCount
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats(prev => ({ ...prev, healthStatus: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  const getHealthBadge = () => {
    switch (stats.healthStatus) {
      case 'healthy':
        return <Badge className="bg-green-500">Sistema Saudável</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Atenção Necessária</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro no Sistema</Badge>;
      default:
        return <Badge variant="secondary">Verificando...</Badge>;
    }
  };

  // Inicializar Plano de Contas
  const initChartOfAccounts = async () => {
    setProcessing('chart');
    addLog('Inicializando Plano de Contas...');

    try {
      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'init_chart' }
      });

      if (error) throw error;

      addLog(`Plano de Contas: ${data.created?.length || 0} contas criadas, ${data.existing?.length || 0} já existiam`);

      toast({
        title: "Plano de Contas Inicializado",
        description: data.message
      });

      await loadStats();
    } catch (error: any) {
      addLog(`ERRO: ${error.message}`);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  // Processar Saldos de Abertura (Janeiro/2025)
  const processOpeningBalances = async () => {
    setProcessing('opening');
    addLog('Processando Saldos de Abertura de Janeiro/2025...');

    try {
      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'generate_retroactive', table: 'client_opening_balance' }
      });

      if (error) throw error;

      addLog(`Saldos de Abertura: ${data.created || 0} lançamentos criados, ${data.skipped || 0} já existiam`);

      if (data.errors?.length > 0) {
        addLog(`Erros: ${data.errors.length}`);
      }

      toast({
        title: "Saldos de Abertura Processados",
        description: `${data.created || 0} lançamentos no Livro Diário`
      });

      await loadStats();
    } catch (error: any) {
      addLog(`ERRO: ${error.message}`);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  // Processar Honorários (Faturas de Janeiro/2025)
  const processInvoices = async () => {
    setProcessing('invoices');
    addLog('Processando Honorários de Janeiro/2025...');

    try {
      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'generate_retroactive', table: 'invoices' }
      });

      if (error) throw error;

      addLog(`Honorários: ${data.created || 0} lançamentos criados, ${data.skipped || 0} já existiam`);

      if (data.errors?.length > 0) {
        addLog(`Erros: ${data.errors.length}`);
      }

      toast({
        title: "Honorários Processados",
        description: `${data.created || 0} lançamentos no Livro Diário`
      });

      await loadStats();
    } catch (error: any) {
      addLog(`ERRO: ${error.message}`);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  // Processar Tudo (Ciclo Completo)
  const processAll = async () => {
    setProcessing('all');
    setLogs([]);
    addLog('=== INICIANDO CICLO CONTÁBIL COMPLETO ===');

    try {
      // 1. Limpar órfãos PRIMEIRO (entries sem linhas que impedem recriação)
      addLog('1. Limpando lançamentos órfãos...');
      let totalDeleted = 0;
      let keepCleaning = true;
      while (keepCleaning) {
        const { data: cleanupData } = await supabase.functions.invoke('smart-accounting', {
          body: { action: 'cleanup_orphans' }
        });
        const deleted = cleanupData?.deleted || 0;
        totalDeleted += deleted;
        if (deleted === 0 || cleanupData?.after?.entries === 0) {
          keepCleaning = false;
        } else {
          addLog(`   Lote removido: ${deleted} órfãos`);
        }
      }
      addLog(`   Total órfãos removidos: ${totalDeleted}`);

      // 2. Inicializar Plano de Contas
      addLog('2. Inicializando Plano de Contas...');
      const { data: chartData, error: chartError } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'init_chart' }
      });
      if (chartError) throw chartError;
      addLog(`   Plano de Contas: ${chartData.created?.length || 0} novas, ${chartData.existing?.length || 0} existentes`);

      // 3. Processar Saldos de Abertura
      addLog('3. Processando Saldos de Abertura...');
      const { data: openingData, error: openingError } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'generate_retroactive', table: 'client_opening_balance' }
      });
      if (openingError) throw openingError;
      addLog(`   Saldos: ${openingData.created || 0} lançamentos (D: Cliente / C: Receita)`);

      // 4. Processar Honorários
      addLog('4. Processando Honorários de Janeiro/2025...');
      const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke('smart-accounting', {
        body: { action: 'generate_retroactive', table: 'invoices' }
      });
      if (invoiceError) throw invoiceError;
      addLog(`   Honorários: ${invoiceData.created || 0} lançamentos (D: Cliente / C: Receita)`);

      addLog('=== CICLO CONTÁBIL CONCLUÍDO ===');

      const totalCreated = (openingData.created || 0) + (invoiceData.created || 0);

      toast({
        title: "Ciclo Contábil Completo!",
        description: `${totalCreated} lançamentos criados no Livro Diário`
      });

      await loadStats();
    } catch (error: any) {
      addLog(`ERRO: ${error.message}`);
      toast({
        title: "Erro no Ciclo Contábil",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary" />
              Contabilidade Inteligente
            </h1>
            <p className="text-muted-foreground">
              Sistema automatizado de lançamentos contábeis
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              getHealthBadge()
            )}
          </div>
        </div>

        {/* Ações de Processamento */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-blue-600" />
              Processar Lançamentos Contábeis - Janeiro/2025
            </CardTitle>
            <CardDescription>
              Gerar lançamentos no Livro Diário para saldos de abertura e honorários
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={initChartOfAccounts}
                disabled={processing !== null}
                variant="outline"
              >
                {processing === 'chart' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BookOpen className="mr-2 h-4 w-4" />
                )}
                Plano de Contas
              </Button>

              <Button
                onClick={processOpeningBalances}
                disabled={processing !== null}
                variant="outline"
              >
                {processing === 'opening' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Saldos de Abertura
              </Button>

              <Button
                onClick={processInvoices}
                disabled={processing !== null}
                variant="outline"
              >
                {processing === 'invoices' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="mr-2 h-4 w-4" />
                )}
                Honorários Jan/2025
              </Button>

              <Button
                onClick={processAll}
                disabled={processing !== null}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processing === 'all' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Processar Tudo
              </Button>

              <Button
                onClick={loadStats}
                disabled={processing !== null || loading}
                variant="ghost"
                size="icon"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>

              <Button
                onClick={async () => {
                  setProcessing('debug');
                  addLog('=== DEBUG: Verificando dados das tabelas ===');
                  try {
                    const { data, error } = await supabase.functions.invoke('smart-accounting', {
                      body: { action: 'debug_status' }
                    });
                    if (error) throw error;
                    const debug = data.debug;
                    addLog(`Plano de Contas: ${debug.counts.chart_of_accounts}`);
                    addLog(`Saldos de Abertura: ${debug.counts.client_opening_balance}`);
                    addLog(`Faturas (invoices): ${debug.counts.invoices}`);
                    addLog(`Lançamentos: ${debug.counts.accounting_entries}`);
                    addLog(`Linhas: ${debug.counts.accounting_entry_lines}`);
                    if (debug.sampleEntries?.length > 0) {
                      addLog('--- Últimos lançamentos ---');
                      debug.sampleEntries.forEach((e: any) => {
                        addLog(`  ${e.entry_date}: ${e.description} (D:${e.total_debit} C:${e.total_credit})`);
                      });
                    }
                  } catch (error: any) {
                    addLog(`ERRO: ${error.message}`);
                  } finally {
                    setProcessing(null);
                  }
                }}
                disabled={processing !== null}
                variant="outline"
                size="sm"
              >
                {processing === 'debug' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                Debug
              </Button>

              <Button
                onClick={async () => {
                  setProcessing('test');
                  addLog('=== TESTE: Criando um único lançamento ===');
                  try {
                    const { data, error } = await supabase.functions.invoke('smart-accounting', {
                      body: { action: 'test_single_entry' }
                    });
                    if (error) throw error;

                    if (data.success) {
                      addLog(`SUCESSO: ${data.message}`);
                      addLog(`Invoice: ${data.invoice?.id}`);
                      addLog(`Cliente: ${data.invoice?.client_name || 'N/A'}`);
                      addLog(`Valor: R$ ${data.invoice?.amount}`);
                      addLog(`Entry ID: ${data.entry?.entry_id}`);
                      await loadStats();
                    } else {
                      addLog(`ERRO: ${data.error}`);
                      if (data.stack) {
                        addLog(`Stack: ${data.stack}`);
                      }
                    }
                  } catch (error: any) {
                    addLog(`ERRO: ${error.message}`);
                  } finally {
                    setProcessing(null);
                  }
                }}
                disabled={processing !== null}
                variant="outline"
                size="sm"
                className="bg-yellow-100 hover:bg-yellow-200"
              >
                {processing === 'test' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Testar 1
              </Button>
            </div>

            {/* Logs de Processamento */}
            {logs.length > 0 && (
              <div className="mt-4 p-3 bg-black/5 dark:bg-white/5 rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className={log.includes('ERRO') ? 'text-red-600' : log.includes('===') ? 'font-bold text-blue-600' : ''}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Sistema Totalmente Automatizado</AlertTitle>
          <AlertDescription>
            A contabilidade é gerenciada automaticamente. Todos os lançamentos são criados
            no momento da inserção de dados, sem necessidade de intervenção manual.
            O sistema executa verificações de saúde automaticamente a cada hora.
          </AlertDescription>
        </Alert>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plano de Contas</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.chartOfAccounts}</div>
              <p className="text-xs text-muted-foreground">contas cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.entries}</div>
              <p className="text-xs text-muted-foreground">
                {stats.lines} linhas de lançamento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Honorários</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.invoices}</div>
              <p className="text-xs text-muted-foreground">faturas no sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Ativo</div>
              <p className="text-xs text-muted-foreground">processamento automático</p>
            </CardContent>
          </Card>
        </div>

        {/* Informações sobre o funcionamento */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Como Funciona
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">1.</span>
                  <span>Ao cadastrar um <strong>honorário</strong>, o lançamento contábil é criado automaticamente (D: Cliente a Receber / C: Receita)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">2.</span>
                  <span>Ao marcar como <strong>pago</strong>, o recebimento é registrado (D: Caixa / C: Cliente a Receber)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">3.</span>
                  <span>Ao cadastrar uma <strong>despesa</strong>, é criado o lançamento correspondente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">4.</span>
                  <span><strong>Saldos de abertura</strong> geram lançamentos retroativos automaticamente</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estrutura do Plano de Contas</CardTitle>
              <CardDescription>Hierarquia padronizada</CardDescription>
            </CardHeader>
            <CardContent className="text-sm font-mono">
              <div className="space-y-1">
                <p className="font-bold text-blue-600">1 - ATIVO</p>
                <p className="ml-4">1.1 - Ativo Circulante</p>
                <p className="ml-8 text-muted-foreground">1.1.1 - Caixa e Equivalentes</p>
                <p className="ml-8 text-muted-foreground">1.1.2 - Clientes a Receber</p>

                <p className="font-bold text-red-600 mt-2">2 - PASSIVO</p>
                <p className="ml-4">2.1 - Passivo Circulante</p>
                <p className="ml-8 text-muted-foreground">2.1.1 - Fornecedores</p>

                <p className="font-bold text-green-600 mt-2">3 - RECEITAS</p>
                <p className="ml-4">3.1 - Receitas Operacionais</p>
                <p className="ml-8 text-muted-foreground">3.1.1 - Honorários Contábeis</p>

                <p className="font-bold text-orange-600 mt-2">4 - DESPESAS</p>
                <p className="ml-4">4.1 - Despesas Operacionais</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card informativo sobre automação */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Automação Inteligente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4">
                <div className="text-3xl font-bold text-blue-600 mb-2">100%</div>
                <p className="text-sm text-muted-foreground">Automatizado</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl font-bold text-green-600 mb-2">0</div>
                <p className="text-sm text-muted-foreground">Intervenções manuais</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl font-bold text-purple-600 mb-2">24/7</div>
                <p className="text-sm text-muted-foreground">Monitoramento ativo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SmartAccounting;
