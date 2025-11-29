import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  BookOpen,
  Users,
  Receipt,
  CreditCard,
  TrendingUp,
  Settings,
  Zap,
  Database
} from "lucide-react";

interface TaskResult {
  success: boolean;
  created?: number;
  skipped?: number;
  errors?: string[];
  message?: string;
}

interface StatusMessage {
  text: string;
  type: 'info' | 'success' | 'error';
  timestamp: Date;
}

const SmartAccounting = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [progress, setProgress] = useState(0);
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [currentOperation, setCurrentOperation] = useState<string>('');

  const addStatusMessage = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMessages(prev => [...prev.slice(-9), { text, type, timestamp: new Date() }]);
  };

  const invokeSmartAccounting = async (action: string, params: any = {}, skipLoadingReset = false) => {
    try {
      if (!skipLoadingReset) {
        setLoading(action);
        setProgress(10);
        setStatusMessages([]);
      }

      const actionNames: Record<string, string> = {
        'init_chart': 'Inicializando plano de contas...',
        'generate_retroactive': `Processando ${params.table || 'dados'}...`,
      };

      const operationName = actionNames[action] || `Executando ${action}...`;
      setCurrentOperation(operationName);
      addStatusMessage(operationName, 'info');

      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: { action, ...params }
      });

      if (!skipLoadingReset) {
        setProgress(100);
      }

      if (error) {
        throw new Error(error.message);
      }

      setResults(prev => ({ ...prev, [action]: data }));

      if (data.success) {
        const successMsg = data.message || 'Operação concluída com sucesso!';
        addStatusMessage(`✓ ${successMsg}`, 'success');
        toast.success(successMsg);
      } else {
        addStatusMessage(`✗ ${data.error || 'Erro na operação'}`, 'error');
        toast.error(data.error || 'Erro na operação');
      }

      return data;
    } catch (error: any) {
      console.error('Erro:', error);
      addStatusMessage(`✗ Erro: ${error.message}`, 'error');
      toast.error(`Erro: ${error.message}`);
      setResults(prev => ({ ...prev, [action]: { success: false, message: error.message } }));
    } finally {
      if (!skipLoadingReset) {
        setLoading(null);
        setProgress(0);
        setCurrentOperation('');
      }
    }
  };

  const handleInitChart = () => invokeSmartAccounting('init_chart');

  const handleRetroactiveOpeningBalance = () => invokeSmartAccounting('generate_retroactive', {
    table: 'client_opening_balance'
  });

  const handleRetroactiveInvoices = () => invokeSmartAccounting('generate_retroactive', {
    table: 'invoices'
  });

  const handleRetroactiveExpenses = () => invokeSmartAccounting('generate_retroactive', {
    table: 'expenses'
  });

  const handleRetroactiveAccountsPayable = () => invokeSmartAccounting('generate_retroactive', {
    table: 'accounts_payable'
  });

  const handleRunAll = async () => {
    setLoading('all');
    setProgress(0);
    setStatusMessages([]);

    const steps = [
      { progress: 10, name: 'Inicializando plano de contas', action: 'init_chart', params: {} },
      { progress: 30, name: 'Processando saldos de abertura', action: 'generate_retroactive', params: { table: 'client_opening_balance' } },
      { progress: 50, name: 'Processando faturas', action: 'generate_retroactive', params: { table: 'invoices' } },
      { progress: 70, name: 'Processando despesas', action: 'generate_retroactive', params: { table: 'expenses' } },
      { progress: 90, name: 'Processando contas a pagar', action: 'generate_retroactive', params: { table: 'accounts_payable' } },
    ];

    try {
      for (const step of steps) {
        setProgress(step.progress);
        setCurrentOperation(step.name + '...');
        addStatusMessage(`➤ ${step.name}...`, 'info');

        await invokeSmartAccounting(step.action, step.params, true);
      }

      setProgress(100);
      setCurrentOperation('Concluído!');
      addStatusMessage('✓ Todas as operações concluídas com sucesso!', 'success');
      toast.success('Todas as operações concluídas!');
    } catch (error: any) {
      addStatusMessage(`✗ Erro: ${error.message}`, 'error');
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(null);
      setTimeout(() => {
        setProgress(0);
        setCurrentOperation('');
      }, 2000);
    }
  };

  const TaskCard = ({
    title,
    description,
    icon: Icon,
    action,
    onRun,
    result
  }: {
    title: string;
    description: string;
    icon: any;
    action: string;
    onRun: () => void;
    result?: TaskResult;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        {result && (
          <Badge variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Concluído
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Erro
              </>
            )}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-4">{description}</CardDescription>

        {result && result.success && (
          <div className="bg-muted p-3 rounded-lg mb-4 text-sm">
            <p>Criados: <strong>{result.created || 0}</strong></p>
            <p>Já existiam: <strong>{result.skipped || 0}</strong></p>
            {result.errors && result.errors.length > 0 && (
              <p className="text-destructive">Erros: {result.errors.length}</p>
            )}
          </div>
        )}

        <Button
          onClick={onRun}
          disabled={loading !== null}
          className="w-full"
        >
          {loading === action ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4 mr-2" />
              Executar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

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
              Sistema automatizado de lançamentos contábeis integrados
            </p>
          </div>
          <Button
            onClick={handleRunAll}
            disabled={loading !== null}
            size="lg"
            className="bg-gradient-to-r from-primary to-blue-600"
          >
            {loading === 'all' ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processando Tudo...
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5 mr-2" />
                Executar Todas as Tarefas
              </>
            )}
          </Button>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">{currentOperation || 'Processando...'}</span>
              <span className="text-sm text-muted-foreground ml-auto">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />

            {statusMessages.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="space-y-1 text-sm font-mono">
                  {statusMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 ${
                        msg.type === 'success' ? 'text-green-600' :
                        msg.type === 'error' ? 'text-red-600' :
                        'text-muted-foreground'
                      }`}
                    >
                      <span className="text-xs opacity-50">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span>{msg.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>Sistema de Contabilidade Inteligente</AlertTitle>
          <AlertDescription>
            Este sistema cria automaticamente lançamentos contábeis para todos os valores
            registrados na aplicação. Contas contábeis são criadas dinamicamente quando necessário,
            incluindo contas individuais para cada cliente.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="setup" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">
              <Settings className="h-4 w-4 mr-2" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="retroactive">
              <RefreshCw className="h-4 w-4 mr-2" />
              Lançamentos Retroativos
            </TabsTrigger>
            <TabsTrigger value="info">
              <BookOpen className="h-4 w-4 mr-2" />
              Informações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TaskCard
                title="Inicializar Plano de Contas"
                description="Cria a estrutura básica do plano de contas: Ativo, Passivo, Receitas e Despesas com todas as contas sintéticas e analíticas padrão."
                icon={BookOpen}
                action="init_chart"
                onRun={handleInitChart}
                result={results['init_chart']}
              />

              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Funcionalidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Criação automática de contas contábeis
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Conta individual por cliente (Clientes a Receber)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Lançamentos por regime de competência
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Razão do cliente automático
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Sugestão de conta via IA
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="retroactive" className="space-y-4">
            <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Lançamentos Retroativos</AlertTitle>
              <AlertDescription>
                Execute estas tarefas para criar lançamentos contábeis para registros que já existem
                no sistema mas ainda não possuem lançamentos contábeis associados.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <TaskCard
                title="Saldos de Abertura"
                description="Cria lançamentos contábeis para todos os saldos de abertura cadastrados (client_opening_balance)."
                icon={CreditCard}
                action="generate_retroactive_opening_balance"
                onRun={handleRetroactiveOpeningBalance}
                result={results['generate_retroactive'] && results['generate_retroactive']}
              />

              <TaskCard
                title="Faturas (Invoices)"
                description="Cria lançamentos de provisionamento e recebimento para todas as faturas existentes."
                icon={Receipt}
                action="generate_retroactive_invoices"
                onRun={handleRetroactiveInvoices}
                result={results['generate_retroactive_invoices']}
              />

              <TaskCard
                title="Despesas (Expenses)"
                description="Cria lançamentos de despesas e pagamentos para registros da tabela expenses."
                icon={CreditCard}
                action="generate_retroactive_expenses"
                onRun={handleRetroactiveExpenses}
                result={results['generate_retroactive_expenses']}
              />

              <TaskCard
                title="Contas a Pagar"
                description="Cria lançamentos contábeis para todos os registros de accounts_payable."
                icon={Users}
                action="generate_retroactive_accounts_payable"
                onRun={handleRetroactiveAccountsPayable}
                result={results['generate_retroactive_accounts_payable']}
              />
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Estrutura do Plano de Contas</CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-mono">
                  <div className="space-y-1">
                    <p className="font-bold text-blue-600">1 - ATIVO</p>
                    <p className="ml-4">1.1 - Ativo Circulante</p>
                    <p className="ml-8">1.1.1 - Caixa e Equivalentes</p>
                    <p className="ml-8">1.1.2 - Créditos a Receber</p>
                    <p className="ml-12">1.1.2.01 - Clientes a Receber (sintética)</p>
                    <p className="ml-16 text-green-600">1.1.2.01.XXX - Cliente: [Nome]</p>

                    <p className="font-bold text-red-600 mt-4">2 - PASSIVO</p>
                    <p className="ml-4">2.1 - Passivo Circulante</p>
                    <p className="ml-8">2.1.1 - Fornecedores</p>

                    <p className="font-bold text-green-600 mt-4">3 - RECEITAS</p>
                    <p className="ml-4">3.1 - Receitas Operacionais</p>
                    <p className="ml-8">3.1.1 - Receita de Honorários</p>

                    <p className="font-bold text-orange-600 mt-4">4 - DESPESAS</p>
                    <p className="ml-4">4.1 - Despesas Operacionais</p>
                    <p className="ml-8">4.1.1 - Despesas com Pessoal</p>
                    <p className="ml-8">4.1.2 - Despesas Administrativas</p>
                    <p className="ml-8">4.1.3 - Despesas Financeiras</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tipos de Lançamentos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="font-medium text-green-700 dark:text-green-300">Receita de Honorários</p>
                    <p className="text-sm text-muted-foreground">
                      D: Cliente a Receber (1.1.2.01.XXX)<br />
                      C: Receita de Honorários (3.1.1.01)
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="font-medium text-blue-700 dark:text-blue-300">Recebimento</p>
                    <p className="text-sm text-muted-foreground">
                      D: Caixa (1.1.1.01)<br />
                      C: Cliente a Receber (1.1.2.01.XXX)
                    </p>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <p className="font-medium text-orange-700 dark:text-orange-300">Despesa</p>
                    <p className="text-sm text-muted-foreground">
                      D: Conta de Despesa (4.x.x.xx)<br />
                      C: Fornecedores a Pagar (2.1.1.01)
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="font-medium text-red-700 dark:text-red-300">Pagamento</p>
                    <p className="text-sm text-muted-foreground">
                      D: Fornecedores a Pagar (2.1.1.01)<br />
                      C: Caixa (1.1.1.01)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SmartAccounting;
