import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Send, Bot, User, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, Play, Square, Terminal, Database, FileCode, Search,
  Settings, ArrowRight, Clock, Zap, Eye, EyeOff, ChevronDown, ChevronUp,
  Github, Cloud, RefreshCw, GitCommit, Rocket
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/data/expensesData";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseCSV, parseBrazilianCurrency, parseDate, autoMapFields } from "@/lib/csvParser";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Tipos
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: AgentAction[];
  thinking?: string;
  showThinking?: boolean;
}

interface AgentAction {
  id: string;
  type: 'query' | 'insert' | 'update' | 'delete' | 'analyze' | 'search' | 'confirm';
  description: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'waiting';
  result?: any;
  error?: string;
  sql?: string;
  table?: string;
}

interface PendingFile {
  name: string;
  content: string;
  type: string;
}

interface ServiceStatus {
  supabase: { status: string; message: string };
  github: { status: string; message: string };
  vercel: { status: string; message: string };
  gemini: { status: string; message: string };
}

interface GitHubRepo {
  name: string;
  full_name: string;
  url: string;
  updated_at: string;
}

interface VercelDeployment {
  id: string;
  url: string;
  state: string;
  created: number;
}

// Contexto do sistema para o agente
const SYSTEM_CONTEXT = `
Você é um agente autônomo de contabilidade da Ampla Contabilidade LTDA.
Você tem acesso DIRETO ao banco de dados Supabase e pode executar ações.

TABELAS DISPONÍVEIS:
- clients (id, name, nome_fantasia, cnpj, status, email, phone)
- invoices (id, client_id, amount, due_date, status, paid_at)
- expenses (id, description, amount, expense_date, category_id, cost_center_id)
- bank_transactions (id, bank_account_id, amount, transaction_date, description, status)
- accounting_entries (id, entry_date, description, entry_type, status)
- accounting_entry_lines (id, entry_id, account_id, debit, credit)
- chart_of_accounts (id, code, name, type, is_analytical)
- cost_centers (id, name, code)

CONTAS PRINCIPAIS:
- 1.1.1.05 = Banco Sicredi
- 1.1.2.01 = Clientes a Receber
- 1.1.3.01 = Adiantamento Sérgio
- 1.1.3.02 = Adiantamento Victor Hugo
- 1.1.3.03 = Adiantamento Sérgio Augusto
- 3.1.1.01 = Receita de Honorários
- 4.1.x.xx = Despesas

REGRAS:
- Despesas pessoais dos sócios = SEMPRE Adiantamento (1.1.3.xx)
- Recebimento de cliente = D: Banco C: Clientes a Receber
- Pagamento de despesa = D: Despesa C: Banco

Quando o usuário pedir algo:
1. Entenda o que ele quer
2. Planeje as ações necessárias
3. Execute cada ação
4. Confirme o resultado

Responda em português de forma clara e objetiva.
`;

/**
 * AIWorkspace - Agente Autônomo Estilo VSCode/Claude Code
 *
 * O funcionário conversa e o agente executa ações diretamente no sistema.
 */
const AIWorkspace = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [autoExecute, setAutoExecute] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'devops'>('chat');
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [vercelDeployments, setVercelDeployments] = useState<VercelDeployment[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  // Log no terminal
  const log = useCallback((message: string, type: 'info' | 'success' | 'error' | 'query' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const prefix = {
      info: '→',
      success: '✓',
      error: '✗',
      query: '⚡'
    }[type];
    setTerminalLogs(prev => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  }, []);

  // Chamar Edge Function segura
  const callSecureAgent = async (action: string, payload?: any): Promise<any> => {
    log(`Chamando ai-dev-agent-secure: ${action}`, 'query');

    try {
      const { data, error } = await supabase.functions.invoke('ai-dev-agent-secure', {
        body: { action, payload }
      });

      if (error) throw error;

      if (data?.success) {
        log(`${action}: ${data.message}`, 'success');
        return data;
      } else {
        throw new Error(data?.message || 'Erro desconhecido');
      }
    } catch (error: any) {
      log(`Erro em ${action}: ${error.message}`, 'error');
      throw error;
    }
  };

  // Verificar status dos serviços
  const checkServices = async () => {
    setLoadingServices(true);
    try {
      const result = await callSecureAgent('check_services');
      setServiceStatus(result.data);
    } catch (error: any) {
      toast.error(`Erro ao verificar serviços: ${error.message}`);
    } finally {
      setLoadingServices(false);
    }
  };

  // Buscar repos do GitHub
  const fetchGitHubRepos = async () => {
    try {
      const result = await callSecureAgent('github_list_repos');
      setGithubRepos(result.data || []);
    } catch (error: any) {
      toast.error(`Erro ao buscar repos: ${error.message}`);
    }
  };

  // Buscar deployments da Vercel
  const fetchVercelDeployments = async () => {
    try {
      const result = await callSecureAgent('vercel_deployments');
      setVercelDeployments(result.data || []);
    } catch (error: any) {
      toast.error(`Erro ao buscar deployments: ${error.message}`);
    }
  };

  // Carregar dados de DevOps quando mudar para aba
  useEffect(() => {
    if (activeTab === 'devops' && !serviceStatus) {
      checkServices();
      fetchGitHubRepos();
      fetchVercelDeployments();
    }
  }, [activeTab]);

  // Executar query no Supabase
  const executeQuery = async (table: string, operation: string, data?: any, filters?: any): Promise<any> => {
    log(`Executando ${operation} em ${table}...`, 'query');

    try {
      let query = supabase.from(table);
      let result;

      switch (operation) {
        case 'select':
          query = query.select(data || '*');
          if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                const op = Object.keys(value)[0];
                const val = Object.values(value)[0];
                if (op === 'like') query = query.like(key, val as string);
                else if (op === 'ilike') query = query.ilike(key, val as string);
                else if (op === 'eq') query = query.eq(key, val);
                else if (op === 'gt') query = query.gt(key, val);
                else if (op === 'lt') query = query.lt(key, val);
              } else {
                query = query.eq(key, value);
              }
            });
          }
          result = await query;
          break;

        case 'insert':
          result = await query.insert(data).select();
          break;

        case 'update': {
          let updateQuery = query.update(data);
          if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
              updateQuery = updateQuery.eq(key, value);
            });
          }
          result = await updateQuery.select();
          break;
        }

        case 'delete': {
          let deleteQuery = query.delete();
          if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
              deleteQuery = deleteQuery.eq(key, value);
            });
          }
          result = await deleteQuery;
          break;
        }

        default:
          throw new Error(`Operação desconhecida: ${operation}`);
      }

      if (result.error) throw result.error;

      log(`${operation} em ${table}: ${result.data?.length || 0} registros`, 'success');
      return result.data;

    } catch (error: any) {
      log(`Erro em ${table}: ${error.message}`, 'error');
      throw error;
    }
  };

  // Buscar cliente por nome ou CNPJ
  const findClient = async (search: string): Promise<any> => {
    log(`Buscando cliente: ${search}`);

    // Por CNPJ
    const cnpjLimpo = search.replace(/\D/g, '');
    if (cnpjLimpo.length >= 11) {
      const result = await executeQuery('clients', 'select', '*', { cnpj: cnpjLimpo });
      if (result && result.length > 0) return result[0];
    }

    // Por nome
    const result = await executeQuery('clients', 'select', '*', {
      name: { ilike: `%${search}%` }
    });

    if (result && result.length > 0) return result[0];

    // Por nome fantasia
    const result2 = await executeQuery('clients', 'select', '*', {
      nome_fantasia: { ilike: `%${search}%` }
    });

    return result2?.[0] || null;
  };

  // Criar lançamento contábil
  const createAccountingEntry = async (
    date: string,
    description: string,
    debitAccountCode: string,
    creditAccountCode: string,
    amount: number,
    entryType: string = 'manual'
  ): Promise<any> => {
    log(`Criando lançamento: ${description} - ${formatCurrency(amount)}`);

    // Buscar contas pelo código
    const [debitAccount] = await executeQuery('chart_of_accounts', 'select', 'id, code, name', { code: debitAccountCode });
    const [creditAccount] = await executeQuery('chart_of_accounts', 'select', 'id, code, name', { code: creditAccountCode });

    if (!debitAccount) throw new Error(`Conta débito não encontrada: ${debitAccountCode}`);
    if (!creditAccount) throw new Error(`Conta crédito não encontrada: ${creditAccountCode}`);

    // Criar entry
    const [entry] = await executeQuery('accounting_entries', 'insert', {
      entry_date: date,
      competence_date: date,
      description,
      entry_type: entryType,
      status: 'posted'
    });

    // Criar linhas
    await executeQuery('accounting_entry_lines', 'insert', [
      {
        entry_id: entry.id,
        account_id: debitAccount.id,
        debit: amount,
        credit: 0,
        description: `D: ${debitAccount.code} - ${debitAccount.name}`
      },
      {
        entry_id: entry.id,
        account_id: creditAccount.id,
        debit: 0,
        credit: amount,
        description: `C: ${creditAccount.code} - ${creditAccount.name}`
      }
    ]);

    log(`Lançamento criado: #${entry.id}`, 'success');
    return entry;
  };

  // Processar CSV de boletos
  const processBoletosCSV = async (content: string): Promise<any[]> => {
    log('Processando arquivo CSV de boletos...');

    const parseResult = parseCSV(content);
    if (!parseResult.success) {
      throw new Error(parseResult.error || 'Erro ao processar CSV');
    }

    log(`${parseResult.totalRows} linhas encontradas (separador: ${parseResult.separator})`);

    const mapping = autoMapFields(parseResult.headers);
    log(`Campos mapeados: valor=${mapping.valor}, data=${mapping.data}, cliente=${mapping.cliente}`);

    const resultados: any[] = [];

    for (const row of parseResult.rows) {
      const valorStr = mapping.valor ? row[mapping.valor] : '';
      const valor = parseBrazilianCurrency(valorStr);

      if (valor <= 0) continue;

      const clienteNome = mapping.cliente ? row[mapping.cliente] : '';
      const dataStr = mapping.data ? row[mapping.data] : '';
      const data = parseDate(dataStr);

      // Tentar identificar cliente
      let cliente = null;
      if (clienteNome) {
        cliente = await findClient(clienteNome);
      }

      resultados.push({
        valor,
        data: data ? data.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        clienteNome,
        cliente,
        status: cliente ? 'identificado' : 'pendente',
        raw: row
      });
    }

    log(`${resultados.length} transações processadas`);
    return resultados;
  };

  // Analisar intenção do usuário
  const analyzeIntent = (message: string): { intent: string; params: any } => {
    const lower = message.toLowerCase();

    // Baixar boletos/honorários
    if (lower.includes('baixa') || lower.includes('recebimento') || lower.includes('recebeu') || lower.includes('pagou')) {
      return { intent: 'baixa_honorarios', params: {} };
    }

    // Importar arquivo
    if (lower.includes('import') || lower.includes('arquivo') || lower.includes('csv')) {
      return { intent: 'importar_arquivo', params: {} };
    }

    // Classificar despesa
    if (lower.includes('classific') || lower.includes('despesa') || lower.includes('pag')) {
      // Extrair valor se mencionado
      const valorMatch = lower.match(/r?\$?\s*([\d.,]+)/);
      const valor = valorMatch ? parseBrazilianCurrency(valorMatch[1]) : 0;
      return { intent: 'classificar_despesa', params: { valor } };
    }

    // Consultar saldo
    if (lower.includes('saldo') || lower.includes('quanto')) {
      return { intent: 'consultar_saldo', params: {} };
    }

    // Listar inadimplentes
    if (lower.includes('inadimpl') || lower.includes('atras') || lower.includes('devendo')) {
      return { intent: 'listar_inadimplentes', params: {} };
    }

    // Buscar cliente
    if (lower.includes('cliente') || lower.includes('empresa') || lower.includes('quem')) {
      return { intent: 'buscar_cliente', params: {} };
    }

    return { intent: 'conversa', params: {} };
  };

  // Processar mensagem do usuário
  const processMessage = async (userMessage: string) => {
    setIsProcessing(true);
    log(`Processando: "${userMessage}"`);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { intent, params } = analyzeIntent(userMessage);
      log(`Intenção detectada: ${intent}`);

      let response = '';
      const actions: AgentAction[] = [];

      switch (intent) {
        case 'baixa_honorarios': {
          if (pendingFile) {
            // Processar arquivo pendente
            const transacoes = await processBoletosCSV(pendingFile.content);
            const identificados = transacoes.filter(t => t.status === 'identificado');
            const pendentes = transacoes.filter(t => t.status === 'pendente');

            response = `📊 Analisei o arquivo **${pendingFile.name}**:\n\n`;
            response += `✅ **${identificados.length} identificados** - prontos para baixa\n`;
            response += `⚠️ **${pendentes.length} pendentes** - precisam identificação\n\n`;

            if (identificados.length > 0) {
              response += `**Clientes identificados:**\n`;
              identificados.slice(0, 5).forEach(t => {
                response += `- ${t.cliente.nome_fantasia || t.cliente.name}: ${formatCurrency(t.valor)}\n`;
              });

              if (autoExecute) {
                response += `\n🚀 Executando baixas automaticamente...\n`;

                for (const t of identificados) {
                  try {
                    await createAccountingEntry(
                      t.data,
                      `Recebimento ${t.cliente.nome_fantasia || t.cliente.name}`,
                      '1.1.1.05', // Banco
                      '1.1.2.01', // Clientes a Receber
                      t.valor,
                      'recebimento'
                    );
                    actions.push({
                      id: `baixa-${t.cliente.id}`,
                      type: 'insert',
                      description: `Baixa ${t.cliente.nome_fantasia || t.cliente.name}: ${formatCurrency(t.valor)}`,
                      status: 'success',
                      table: 'accounting_entries'
                    });
                  } catch (error: any) {
                    actions.push({
                      id: `baixa-${t.cliente.id}`,
                      type: 'insert',
                      description: `Baixa ${t.cliente.nome_fantasia || t.cliente.name}`,
                      status: 'error',
                      error: error.message
                    });
                  }
                }

                const sucessos = actions.filter(a => a.status === 'success').length;
                response += `\n✅ **${sucessos} lançamentos criados com sucesso!**`;
              } else {
                response += `\nDigite **"confirmar"** para executar as baixas.`;
              }
            }

            setPendingFile(null);
          } else {
            response = `Para fazer baixa de honorários, envie o arquivo CSV com os boletos liquidados.\n\nClique no 📎 para anexar o arquivo.`;
          }
          break;
        }

        case 'consultar_saldo': {
          log('Consultando saldo do banco...');

          // Buscar conta do banco
          const [contaBanco] = await executeQuery('chart_of_accounts', 'select', 'id', { code: '1.1.1.05' });

          if (contaBanco) {
            const linhas = await executeQuery('accounting_entry_lines', 'select', 'debit, credit', { account_id: contaBanco.id });
            let saldo = 0;
            linhas?.forEach((l: any) => saldo += (l.debit || 0) - (l.credit || 0));

            response = `💰 **Saldo Banco Sicredi:** ${formatCurrency(saldo)}`;

            actions.push({
              id: 'saldo-1',
              type: 'query',
              description: 'Consulta saldo Banco Sicredi',
              status: 'success',
              result: { saldo },
              table: 'accounting_entry_lines'
            });
          }
          break;
        }

        case 'listar_inadimplentes': {
          log('Buscando clientes inadimplentes...');

          const inadimplentes = await executeQuery('invoices', 'select',
            'id, amount, due_date, clients!inner(name, nome_fantasia)',
            { status: 'overdue' }
          );

          if (inadimplentes && inadimplentes.length > 0) {
            response = `📋 **Clientes Inadimplentes:** ${inadimplentes.length}\n\n`;

            const total = inadimplentes.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);

            inadimplentes.slice(0, 10).forEach((i: any) => {
              const nome = i.clients?.nome_fantasia || i.clients?.name || 'N/A';
              response += `- **${nome}**: ${formatCurrency(i.amount)} (venc: ${i.due_date})\n`;
            });

            response += `\n**Total em atraso:** ${formatCurrency(total)}`;

            actions.push({
              id: 'inadimplentes-1',
              type: 'query',
              description: `Encontrados ${inadimplentes.length} inadimplentes`,
              status: 'success',
              table: 'invoices'
            });
          } else {
            response = `✅ Nenhum cliente inadimplente no momento!`;
          }
          break;
        }

        case 'classificar_despesa': {
          response = `Para classificar uma despesa, me diga:\n\n`;
          response += `1. **Descrição** (ex: "conta de luz da sede")\n`;
          response += `2. **Valor** (ex: "R$ 350,00")\n`;
          response += `3. **Data** (ex: "hoje" ou "15/01/2025")\n\n`;
          response += `Ou envie o extrato bancário que classifico automaticamente.`;
          break;
        }

        case 'importar_arquivo': {
          response = `📁 Para importar um arquivo:\n\n`;
          response += `1. Clique no 📎 para anexar\n`;
          response += `2. Formatos aceitos: CSV, OFX, XLSX\n`;
          response += `3. Eu identifico automaticamente os campos\n\n`;
          response += `Após anexar, me diga o que fazer com ele.`;
          break;
        }

        default: {
          // Tentar consultar o Dr. Cícero
          try {
            const { data } = await supabase.functions.invoke('dr-cicero-brain', {
              body: { action: 'consult', question: userMessage }
            });
            response = data?.response || data?.knowledge ||
              `Entendi sua mensagem. Posso ajudar com:\n\n` +
              `- 📥 Importar extratos e boletos\n` +
              `- 💰 Fazer baixas de honorários\n` +
              `- 📊 Consultar saldos e inadimplentes\n` +
              `- 🏷️ Classificar despesas\n\n` +
              `O que você precisa fazer?`;
          } catch {
            response = `Entendi sua mensagem. Posso ajudar com:\n\n` +
              `- 📥 Importar extratos e boletos\n` +
              `- 💰 Fazer baixas de honorários\n` +
              `- 📊 Consultar saldos e inadimplentes\n` +
              `- 🏷️ Classificar despesas\n\n` +
              `O que você precisa fazer?`;
          }
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (error: any) {
      log(`Erro: ${error.message}`, 'error');

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Ocorreu um erro: ${error.message}\n\nTente novamente ou reformule sua pergunta.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Enviar mensagem
  const handleSend = () => {
    if (!input.trim() && !pendingFile) return;
    processMessage(input.trim());
    setInput("");
  };

  // Upload de arquivo
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPendingFile({
        name: file.name,
        content,
        type: file.type
      });
      log(`Arquivo carregado: ${file.name}`);
      toast.success(`Arquivo "${file.name}" carregado. Diga o que fazer com ele.`);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Mensagem inicial
  useEffect(() => {
    setMessages([{
      id: '0',
      role: 'assistant',
      content: `👋 Olá! Sou o agente autônomo da Ampla Contabilidade.

Posso executar ações diretamente no sistema:
- 📥 Importar extratos e boletos (CSV, OFX)
- 💰 Fazer baixas de honorários
- 📊 Consultar saldos e clientes
- 🏷️ Classificar despesas automaticamente
- 📝 Criar lançamentos contábeis

**Como funciona:**
1. Você me diz o que precisa
2. Eu analiso e executo
3. Mostro o resultado em tempo real

O que você precisa fazer agora?`,
      timestamp: new Date()
    }]);
    log('Agente inicializado', 'success');
  }, [log]);

  return (
    <Layout>
      <div className="h-[calc(100vh-6rem)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-lg p-2">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Agente autônomo - igual ao Claude Code
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'devops')}>
              <TabsList>
                <TabsTrigger value="chat" className="gap-1">
                  <Bot className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="devops" className="gap-1">
                  <Github className="h-4 w-4" />
                  DevOps
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoExecute(!autoExecute)}
            >
              {autoExecute ? (
                <>
                  <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                  Auto
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-1" />
                  Manual
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTerminal(!showTerminal)}
            >
              <Terminal className="h-4 w-4 mr-1" />
              {showTerminal ? 'Ocultar' : 'Terminal'}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {activeTab === 'chat' ? (
          /* Chat */
          <Card className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                          <Bot className="h-4 w-4" />
                          <span className="font-medium">Agente</span>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap text-sm">
                        {message.content}
                      </div>

                      {/* Actions */}
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          {message.actions.map((action) => (
                            <div
                              key={action.id}
                              className="flex items-center gap-2 text-xs bg-background/50 rounded px-2 py-1"
                            >
                              {action.status === 'success' && (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              )}
                              {action.status === 'error' && (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              )}
                              {action.status === 'running' && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              <span>{action.description}</span>
                              {action.table && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {action.table}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] opacity-50 mt-2">
                        {message.timestamp.toLocaleTimeString('pt-BR')}
                      </div>
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Processando...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Arquivo pendente */}
            {pendingFile && (
              <div className="px-4 py-2 border-t bg-muted/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{pendingFile.name}</span>
                  <Badge variant="secondary">Pronto para processar</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingFile(null)}
                    className="ml-auto"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.xlsx,.xls,.ofx"
                  className="hidden"
                />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4" />
                </Button>

                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Digite o que você precisa fazer..."
                  disabled={isProcessing}
                  className="flex-1"
                />

                <Button onClick={handleSend} disabled={isProcessing || (!input.trim() && !pendingFile)}>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
          ) : (
          /* DevOps Panel */
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="py-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Painel DevOps
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    checkServices();
                    fetchGitHubRepos();
                    fetchVercelDeployments();
                  }}
                  disabled={loadingServices}
                >
                  {loadingServices ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                {/* Status dos Serviços */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Status dos Serviços
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {serviceStatus ? (
                      <>
                        <div className={`p-3 rounded-lg border ${serviceStatus.supabase.status === 'ok' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span className="font-medium">Supabase</span>
                            {serviceStatus.supabase.status === 'ok' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500 ml-auto" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{serviceStatus.supabase.message}</p>
                        </div>
                        <div className={`p-3 rounded-lg border ${serviceStatus.github.status === 'ok' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                          <div className="flex items-center gap-2">
                            <Github className="h-4 w-4" />
                            <span className="font-medium">GitHub</span>
                            {serviceStatus.github.status === 'ok' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 ml-auto" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{serviceStatus.github.message}</p>
                        </div>
                        <div className={`p-3 rounded-lg border ${serviceStatus.vercel.status === 'ok' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4" />
                            <span className="font-medium">Vercel</span>
                            {serviceStatus.vercel.status === 'ok' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 ml-auto" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{serviceStatus.vercel.message}</p>
                        </div>
                        <div className={`p-3 rounded-lg border ${serviceStatus.gemini.status === 'ok' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            <span className="font-medium">Gemini IA</span>
                            {serviceStatus.gemini.status === 'ok' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 ml-auto" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{serviceStatus.gemini.message}</p>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 text-center py-4 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Verificando serviços...
                      </div>
                    )}
                  </div>
                </div>

                {/* Repositórios GitHub */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    Repositórios Recentes
                  </h3>
                  <div className="space-y-2">
                    {githubRepos.length > 0 ? (
                      githubRepos.map((repo) => (
                        <div key={repo.name} className="p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileCode className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{repo.name}</span>
                            </div>
                            <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                              Abrir
                            </a>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Atualizado: {new Date(repo.updated_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        {loadingServices ? 'Carregando...' : 'Configure GITHUB_TOKEN para ver repos'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Deployments Vercel */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Rocket className="h-4 w-4" />
                    Deployments Recentes
                  </h3>
                  <div className="space-y-2">
                    {vercelDeployments.length > 0 ? (
                      vercelDeployments.map((deploy) => (
                        <div key={deploy.id} className="p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={deploy.state === 'READY' ? 'default' : deploy.state === 'ERROR' ? 'destructive' : 'secondary'}>
                                {deploy.state}
                              </Badge>
                              <span className="text-sm truncate max-w-[200px]">{deploy.url}</span>
                            </div>
                            <a href={`https://${deploy.url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                              Visitar
                            </a>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(deploy.created).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        {loadingServices ? 'Carregando...' : 'Configure VERCEL_TOKEN para ver deployments'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Configuração de Secrets */}
                <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configurar Credenciais
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Para habilitar acesso completo, configure os secrets no Supabase:
                  </p>
                  <div className="font-mono text-xs bg-background p-3 rounded border space-y-1">
                    <div>npx supabase secrets set GITHUB_TOKEN=ghp_xxx</div>
                    <div>npx supabase secrets set VERCEL_TOKEN=xxx</div>
                    <div>npx supabase secrets set GEMINI_API_KEY=xxx</div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </Card>
          )}

          {/* Terminal */}
          {showTerminal && (
            <Card className="w-96 flex flex-col min-h-0">
              <CardHeader className="py-2 px-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <span className="text-sm font-medium">Terminal</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTerminalLogs([])}
                    className="h-6 px-2 text-xs"
                  >
                    Limpar
                  </Button>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1">
                <div className="p-3 font-mono text-xs space-y-1">
                  {terminalLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`${
                        log.includes('✓') ? 'text-green-500' :
                        log.includes('✗') ? 'text-red-500' :
                        log.includes('⚡') ? 'text-yellow-500' :
                        'text-muted-foreground'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AIWorkspace;
