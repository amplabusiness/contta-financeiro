import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Send, Bot, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, Terminal, Database, FileCode, Search, Settings,
  Zap, Github, Cloud, RefreshCw, Rocket, FolderOpen, File,
  ChevronRight, ChevronDown, X, Plus, Save, Play, Trash2,
  Copy, Download, Menu, PanelLeftClose, PanelLeft, MoreVertical,
  Folder, Table, Users, Receipt, Calculator, BookOpen, Sparkles,
  MessageSquare, Code, Wand2, GitBranch, GitCommit, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

// Tipos
interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'table';
  path: string;
  children?: FileItem[];
  icon?: React.ReactNode;
  content?: string;
}

interface OpenTab {
  id: string;
  name: string;
  path: string;
  content: string;
  isDirty: boolean;
  type: 'file' | 'table' | 'query';
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'info' | 'agent';
  content: string;
  timestamp: Date;
}

interface AgentAction {
  id: string;
  type: 'thinking' | 'executing' | 'completed' | 'error';
  description: string;
  details?: string;
}

// Estrutura de arquivos do projeto
const projectStructure: FileItem[] = [
  {
    id: 'db',
    name: 'Banco de Dados',
    type: 'folder',
    path: '/database',
    icon: <Database className="h-4 w-4 text-green-500" />,
    children: [
      { id: 'clients', name: 'clients', type: 'table', path: '/database/clients', icon: <Users className="h-4 w-4 text-blue-400" /> },
      { id: 'invoices', name: 'invoices', type: 'table', path: '/database/invoices', icon: <Receipt className="h-4 w-4 text-blue-400" /> },
      { id: 'expenses', name: 'expenses', type: 'table', path: '/database/expenses', icon: <Calculator className="h-4 w-4 text-blue-400" /> },
      { id: 'accounting_entries', name: 'accounting_entries', type: 'table', path: '/database/accounting_entries', icon: <BookOpen className="h-4 w-4 text-blue-400" /> },
      { id: 'chart_of_accounts', name: 'chart_of_accounts', type: 'table', path: '/database/chart_of_accounts', icon: <Table className="h-4 w-4 text-blue-400" /> },
    ]
  },
  {
    id: 'queries',
    name: 'Consultas SQL',
    type: 'folder',
    path: '/queries',
    icon: <FileCode className="h-4 w-4 text-yellow-500" />,
    children: [
      { id: 'saldo', name: 'saldo_banco.sql', type: 'file', path: '/queries/saldo_banco.sql', content: `-- Saldo do Banco Sicredi\nSELECT SUM(COALESCE(debit, 0)) - SUM(COALESCE(credit, 0)) as saldo\nFROM accounting_entry_lines ael\nJOIN chart_of_accounts coa ON ael.account_id = coa.id\nWHERE coa.code = '1.1.1.05';` },
      { id: 'inadimplentes', name: 'inadimplentes.sql', type: 'file', path: '/queries/inadimplentes.sql', content: `-- Clientes Inadimplentes\nSELECT c.name, c.nome_fantasia, i.amount, i.due_date\nFROM invoices i\nJOIN clients c ON i.client_id = c.id\nWHERE i.status = 'overdue'\nORDER BY i.due_date;` },
    ]
  },
  {
    id: 'docs',
    name: 'Documentação',
    type: 'folder',
    path: '/docs',
    icon: <Folder className="h-4 w-4 text-orange-500" />,
    children: [
      { id: 'memory', name: 'MEMORY.md', type: 'file', path: '/docs/MEMORY.md' },
      { id: 'regras', name: 'regras_classificacao.md', type: 'file', path: '/docs/regras_classificacao.md', content: `# Regras de Classificação\n\n## Recebimento de Honorários\nD: 1.1.1.05 (Banco)\nC: 1.1.2.01 (Clientes)\n\n## Despesa Pessoal Sócio\nD: 1.1.3.xx (Adiantamento)\nC: 1.1.1.05 (Banco)\n**NUNCA** classificar como despesa!` },
    ]
  }
];

const CodeEditor = () => {
  // Estados principais
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['db', 'queries']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminal' | 'agent'>('agent');

  // Estados do terminal/agente
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { id: '0', type: 'info', content: '🤖 Claude Code Agent - Ampla Contabilidade', timestamp: new Date() },
    { id: '1', type: 'info', content: 'Digite comandos ou peça ajuda em linguagem natural', timestamp: new Date() },
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [isAgentWorking, setIsAgentWorking] = useState(false);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);

  // Estados do Copilot
  const [copilotSuggestion, setCopilotSuggestion] = useState<string | null>(null);
  const [showCopilot, setShowCopilot] = useState(true);

  // Estados do Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-scroll
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  // Detectar URL da aplicação
  useEffect(() => {
    // Pegar URL base da aplicação (produção ou desenvolvimento)
    const baseUrl = window.location.origin;
    setPreviewUrl(baseUrl);
  }, []);

  // Função para recarregar preview
  const refreshPreview = () => {
    setPreviewKey(prev => prev + 1);
    addTerminalLine('info', '🔄 Preview atualizado');
  };

  // Funções do explorador
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openFile = async (file: FileItem) => {
    const existingTab = openTabs.find(t => t.id === file.id);
    if (existingTab) {
      setActiveTabId(file.id);
      return;
    }

    let content = file.content || '';

    if (file.type === 'table') {
      try {
        const { data, error } = await supabase.from(file.name).select('*').limit(10);
        if (error) throw error;
        content = `-- Tabela: ${file.name}\n-- Primeiros 10 registros:\n\n${JSON.stringify(data, null, 2)}`;
      } catch (err: any) {
        content = `-- Erro ao carregar tabela: ${err.message}`;
      }
    }

    const newTab: OpenTab = {
      id: file.id,
      name: file.name,
      path: file.path,
      content,
      isDirty: false,
      type: file.type === 'table' ? 'table' : 'file'
    };

    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(file.id);
    setSelectedFile(file.id);
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      const remaining = openTabs.filter(t => t.id !== tabId);
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const updateTabContent = (tabId: string, content: string) => {
    setOpenTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, content, isDirty: true } : t
    ));

    // Copilot: Gerar sugestão baseada no conteúdo
    if (showCopilot && content.length > 10) {
      generateCopilotSuggestion(content);
    }
  };

  // Copilot - Gerar sugestões
  const generateCopilotSuggestion = useCallback(async (content: string) => {
    const lines = content.split('\n');
    const lastLine = lines[lines.length - 1].trim();

    // Sugestões simples baseadas no contexto
    if (lastLine.toLowerCase().startsWith('select') && !lastLine.includes('from')) {
      setCopilotSuggestion('* FROM table_name WHERE condition;');
    } else if (lastLine.toLowerCase().startsWith('insert')) {
      setCopilotSuggestion(' INTO table_name (column1, column2) VALUES (value1, value2);');
    } else if (lastLine.toLowerCase() === '--') {
      setCopilotSuggestion(' Consulta de exemplo');
    } else if (lastLine.toLowerCase().includes('clientes')) {
      setCopilotSuggestion('\nSELECT * FROM clients WHERE status = \'active\';');
    } else if (lastLine.toLowerCase().includes('saldo')) {
      setCopilotSuggestion('\n-- Saldo do banco\nSELECT SUM(debit) - SUM(credit) FROM accounting_entry_lines;');
    } else {
      setCopilotSuggestion(null);
    }
  }, []);

  // Aceitar sugestão do Copilot
  const acceptCopilotSuggestion = () => {
    if (copilotSuggestion && activeTabId) {
      const activeTab = openTabs.find(t => t.id === activeTabId);
      if (activeTab) {
        updateTabContent(activeTabId, activeTab.content + copilotSuggestion);
        setCopilotSuggestion(null);
      }
    }
  };

  // Terminal
  const addTerminalLine = (type: TerminalLine['type'], content: string) => {
    setTerminalLines(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    }]);
  };

  // Agente Claude Code
  const processAgentCommand = async (input: string) => {
    setIsAgentWorking(true);
    addTerminalLine('input', `> ${input}`);

    // Adicionar ação de "pensando"
    const thinkingAction: AgentAction = {
      id: Date.now().toString(),
      type: 'thinking',
      description: 'Analisando sua solicitação...'
    };
    setAgentActions(prev => [...prev, thinkingAction]);

    try {
      const lower = input.toLowerCase();

      // Comandos específicos
      if (lower === 'help' || lower === 'ajuda') {
        addTerminalLine('agent', `
🤖 **Claude Code Agent - Comandos:**

📊 **Consultas:**
  saldo          - Mostra saldo do banco
  clientes       - Lista clientes ativos
  inadimplentes  - Lista inadimplentes
  receitas       - Resumo de receitas
  despesas       - Resumo de despesas

💻 **Código:**
  run / executar - Executa SQL da aba ativa
  nova query     - Cria nova consulta
  explicar       - Explica o código selecionado

🔧 **Sistema:**
  clear / limpar - Limpa o terminal
  status         - Status dos serviços
  deploy         - Informações de deploy

💡 **Linguagem Natural:**
  "busque clientes que devem mais de 1000"
  "crie uma query para saldo por mês"
  "classifique o pix de 500 reais"
`);
        updateAgentAction(thinkingAction.id, 'completed', 'Ajuda exibida');
      }

      else if (lower === 'clear' || lower === 'limpar') {
        setTerminalLines([]);
        setAgentActions([]);
      }

      else if (lower === 'saldo') {
        updateAgentAction(thinkingAction.id, 'executing', 'Consultando saldo do banco...');

        const { data: conta } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '1.1.1.05')
          .single();

        if (conta) {
          const { data: lines } = await supabase
            .from('accounting_entry_lines')
            .select('debit, credit')
            .eq('account_id', conta.id);

          let saldo = 0;
          lines?.forEach(l => saldo += (l.debit || 0) - (l.credit || 0));

          addTerminalLine('success', `💰 Saldo Banco Sicredi: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
          updateAgentAction(thinkingAction.id, 'completed', 'Saldo consultado com sucesso');
        }
      }

      else if (lower === 'clientes') {
        updateAgentAction(thinkingAction.id, 'executing', 'Buscando clientes ativos...');

        const { data, count } = await supabase
          .from('clients')
          .select('name, nome_fantasia', { count: 'exact' })
          .eq('status', 'active')
          .limit(10);

        addTerminalLine('success', `👥 ${count || 0} clientes ativos:`);
        data?.forEach(c => addTerminalLine('output', `   • ${c.nome_fantasia || c.name}`));
        updateAgentAction(thinkingAction.id, 'completed', `${count} clientes encontrados`);
      }

      else if (lower === 'inadimplentes') {
        updateAgentAction(thinkingAction.id, 'executing', 'Buscando inadimplentes...');

        const { data } = await supabase
          .from('invoices')
          .select('amount, due_date, clients(name, nome_fantasia)')
          .eq('status', 'overdue')
          .limit(10);

        if (data && data.length > 0) {
          const total = data.reduce((sum, i) => sum + (i.amount || 0), 0);
          addTerminalLine('error', `⚠️ ${data.length} inadimplentes - Total: R$ ${total.toLocaleString('pt-BR')}`);
          data.forEach((i: any) => {
            const nome = i.clients?.nome_fantasia || i.clients?.name || 'N/A';
            addTerminalLine('output', `   • ${nome}: R$ ${i.amount?.toLocaleString('pt-BR')}`);
          });
        } else {
          addTerminalLine('success', '✅ Nenhum cliente inadimplente!');
        }
        updateAgentAction(thinkingAction.id, 'completed', 'Consulta finalizada');
      }

      else if (lower === 'run' || lower === 'executar') {
        const activeTab = openTabs.find(t => t.id === activeTabId);
        if (activeTab?.content) {
          updateAgentAction(thinkingAction.id, 'executing', 'Executando SQL...');
          await executeSQL(activeTab.content);
          updateAgentAction(thinkingAction.id, 'completed', 'SQL executado');
        } else {
          addTerminalLine('error', '❌ Nenhuma aba ativa com SQL');
          updateAgentAction(thinkingAction.id, 'error', 'Nenhuma aba ativa');
        }
      }

      else if (lower === 'status') {
        updateAgentAction(thinkingAction.id, 'executing', 'Verificando serviços...');

        try {
          const { data } = await supabase.functions.invoke('ai-dev-agent-secure', {
            body: { action: 'check_services' }
          });

          addTerminalLine('info', '📊 Status dos Serviços:');
          if (data?.data) {
            const s = data.data;
            addTerminalLine(s.supabase?.status === 'ok' ? 'success' : 'error', `   Supabase: ${s.supabase?.message}`);
            addTerminalLine(s.github?.status === 'ok' ? 'success' : 'info', `   GitHub: ${s.github?.message}`);
            addTerminalLine(s.vercel?.status === 'ok' ? 'success' : 'info', `   Vercel: ${s.vercel?.message}`);
          }
          updateAgentAction(thinkingAction.id, 'completed', 'Status verificado');
        } catch {
          addTerminalLine('success', '   Supabase: Conectado');
          addTerminalLine('info', '   GitHub: Configure GITHUB_TOKEN');
          addTerminalLine('info', '   Vercel: Configure VERCEL_TOKEN');
          updateAgentAction(thinkingAction.id, 'completed', 'Status parcial');
        }
      }

      else if (lower.includes('query') || lower.includes('consulta')) {
        updateAgentAction(thinkingAction.id, 'executing', 'Criando nova query...');

        const newTab: OpenTab = {
          id: `query-${Date.now()}`,
          name: 'nova_query.sql',
          path: '/queries/nova_query.sql',
          content: '-- Nova consulta\nSELECT * FROM \n',
          isDirty: true,
          type: 'query'
        };

        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        addTerminalLine('success', '📄 Nova query criada');
        updateAgentAction(thinkingAction.id, 'completed', 'Query criada');
      }

      // Linguagem natural - usar IA
      else {
        updateAgentAction(thinkingAction.id, 'executing', 'Processando com IA...');

        try {
          const { data } = await supabase.functions.invoke('dr-cicero-brain', {
            body: { action: 'consult', question: input }
          });

          const response = data?.response || data?.knowledge ||
            'Não entendi o comando. Digite "help" para ver opções.';

          addTerminalLine('agent', `🤖 ${response}`);
          updateAgentAction(thinkingAction.id, 'completed', 'Resposta gerada');
        } catch (err: any) {
          addTerminalLine('agent', `💡 Comando não reconhecido: "${input}"\nDigite "help" para ver comandos disponíveis.`);
          updateAgentAction(thinkingAction.id, 'completed', 'Comando não reconhecido');
        }
      }

    } catch (err: any) {
      addTerminalLine('error', `❌ Erro: ${err.message}`);
      updateAgentAction(thinkingAction.id, 'error', err.message);
    } finally {
      setIsAgentWorking(false);
    }
  };

  const updateAgentAction = (id: string, type: AgentAction['type'], description: string) => {
    setAgentActions(prev => prev.map(a =>
      a.id === id ? { ...a, type, description } : a
    ));
  };

  // Executar SQL
  const executeSQL = async (sql: string) => {
    const cleanSQL = sql.replace(/--.*$/gm, '').trim();

    if (cleanSQL.toLowerCase().startsWith('select')) {
      addTerminalLine('info', '⚡ Executando consulta...');

      const tableMatch = cleanSQL.match(/from\s+(\w+)/i);
      if (tableMatch) {
        try {
          const { data, error } = await supabase
            .from(tableMatch[1])
            .select('*')
            .limit(20);

          if (error) throw error;

          addTerminalLine('success', `✅ ${data?.length || 0} registros encontrados`);
          addTerminalLine('output', JSON.stringify(data, null, 2));
        } catch (err: any) {
          addTerminalLine('error', `❌ ${err.message}`);
        }
      }
    } else {
      addTerminalLine('error', '⚠️ Apenas SELECT é permitido no modo seguro');
    }
  };

  // Renderizar item do explorador
  const renderFileItem = (item: FileItem, depth = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const isSelected = selectedFile === item.id;

    return (
      <div key={item.id}>
        <div
          className={cn(
            "flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-accent rounded text-sm",
            isSelected && "bg-accent"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (item.type === 'folder') toggleFolder(item.id);
            else openFile(item);
          }}
        >
          {item.type === 'folder' ? (
            <>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              {item.icon || <Folder className="h-4 w-4 text-yellow-500" />}
            </>
          ) : (
            <>
              <span className="w-4" />
              {item.icon || <File className="h-4 w-4 text-muted-foreground" />}
            </>
          )}
          <span className="truncate">{item.name}</span>
        </div>

        {item.type === 'folder' && isExpanded && item.children && (
          <div>{item.children.map(child => renderFileItem(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const activeTab = openTabs.find(t => t.id === activeTabId);

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#1e1e1e] text-white">
        {/* Toolbar - Estilo VS Code */}
        <div className="h-10 border-b border-[#333] flex items-center px-2 gap-2 bg-[#252526]">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-[#333]">
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>

          <div className="h-4 w-px bg-[#444]" />

          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gray-400 hover:text-white hover:bg-[#333]">
            <Plus className="h-3 w-3" />
            Nova Query
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-gray-400 hover:text-white hover:bg-[#333]"
            onClick={() => activeTab && executeSQL(activeTab.content)}
            disabled={!activeTab}
          >
            <Play className="h-3 w-3 text-green-500" />
            Executar
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 text-xs", showCopilot ? "text-purple-400" : "text-gray-400")}
            onClick={() => setShowCopilot(!showCopilot)}
          >
            <Sparkles className="h-3 w-3" />
            Copilot
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 text-xs", showPreview ? "text-green-400" : "text-gray-400")}
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-3 w-3" />
            Preview
          </Button>

          <Badge variant="outline" className="text-xs bg-transparent border-green-600 text-green-500">
            <Database className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        </div>

        {/* Main Content */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Sidebar */}
          {sidebarOpen && (
            <>
              <ResizablePanel defaultSize={18} minSize={15} maxSize={25}>
                <div className="h-full flex flex-col bg-[#252526] border-r border-[#333]">
                  <div className="p-2 text-xs text-gray-400 uppercase tracking-wider">
                    Explorador
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-1">
                      {projectStructure.map(item => renderFileItem(item))}
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>
              <ResizableHandle className="w-1 bg-[#333] hover:bg-[#007acc]" />
            </>
          )}

          {/* Editor Area */}
          <ResizablePanel defaultSize={showPreview ? 50 : 82}>
            <ResizablePanelGroup direction="vertical">
              {/* Editor */}
              <ResizablePanel defaultSize={60}>
                <div className="h-full flex flex-col bg-[#1e1e1e]">
                  {/* Tabs */}
                  <div className="h-9 border-b border-[#333] flex items-center overflow-x-auto bg-[#252526]">
                    {openTabs.map(tab => (
                      <div
                        key={tab.id}
                        className={cn(
                          "h-full flex items-center gap-2 px-3 border-r border-[#333] cursor-pointer text-sm",
                          activeTabId === tab.id
                            ? "bg-[#1e1e1e] text-white"
                            : "text-gray-400 hover:bg-[#2d2d2d]"
                        )}
                        onClick={() => setActiveTabId(tab.id)}
                      >
                        {tab.type === 'table' ? (
                          <Table className="h-3 w-3 text-blue-400" />
                        ) : (
                          <FileCode className="h-3 w-3 text-yellow-500" />
                        )}
                        <span className="truncate max-w-[120px]">{tab.name}</span>
                        {tab.isDirty && <span className="text-orange-500 text-lg leading-none">•</span>}
                        <X className="h-3 w-3 hover:bg-[#444] rounded opacity-50 hover:opacity-100" onClick={(e) => closeTab(tab.id, e)} />
                      </div>
                    ))}
                  </div>

                  {/* Editor Content */}
                  <div className="flex-1 overflow-hidden relative">
                    {activeTab ? (
                      <>
                        <textarea
                          ref={editorRef}
                          className="w-full h-full p-4 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm resize-none outline-none leading-6"
                          value={activeTab.content}
                          onChange={(e) => updateTabContent(activeTab.id, e.target.value)}
                          onKeyDown={(e) => {
                            // Aceitar sugestão com Tab
                            if (e.key === 'Tab' && copilotSuggestion) {
                              e.preventDefault();
                              acceptCopilotSuggestion();
                            }
                          }}
                          spellCheck={false}
                        />

                        {/* Copilot Suggestion */}
                        {showCopilot && copilotSuggestion && (
                          <div className="absolute bottom-4 right-4 max-w-md bg-[#252526] border border-[#454545] rounded-lg p-3 shadow-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-purple-400" />
                              <span className="text-xs text-purple-400">Copilot sugere:</span>
                            </div>
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap">{copilotSuggestion}</pre>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" className="h-6 text-xs bg-purple-600 hover:bg-purple-700" onClick={acceptCopilotSuggestion}>
                                Tab para aceitar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setCopilotSuggestion(null)}>
                                Esc para ignorar
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <Bot className="h-16 w-16 mx-auto mb-4 opacity-20" />
                          <p className="text-lg">Claude Code Agent</p>
                          <p className="text-sm mt-2">Selecione um arquivo ou use o terminal abaixo</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-[#333] hover:bg-[#007acc]" />

              {/* Bottom Panel - Agent/Terminal */}
              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="h-full flex flex-col bg-[#1e1e1e] border-t border-[#333]">
                  {/* Panel Tabs */}
                  <div className="h-8 border-b border-[#333] flex items-center px-2 bg-[#252526]">
                    <button
                      className={cn(
                        "px-3 py-1 text-xs rounded flex items-center gap-1",
                        bottomPanelTab === 'agent' ? "bg-[#1e1e1e] text-white" : "text-gray-400 hover:text-white"
                      )}
                      onClick={() => setBottomPanelTab('agent')}
                    >
                      <Bot className="h-3 w-3" />
                      Claude Code
                      {isAgentWorking && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                    </button>
                    <button
                      className={cn(
                        "px-3 py-1 text-xs rounded flex items-center gap-1",
                        bottomPanelTab === 'terminal' ? "bg-[#1e1e1e] text-white" : "text-gray-400 hover:text-white"
                      )}
                      onClick={() => setBottomPanelTab('terminal')}
                    >
                      <Terminal className="h-3 w-3" />
                      Terminal
                    </button>

                    <div className="flex-1" />

                    {/* Agent Actions */}
                    {agentActions.length > 0 && (
                      <div className="flex items-center gap-2">
                        {agentActions.slice(-1).map(action => (
                          <Badge
                            key={action.id}
                            variant="outline"
                            className={cn(
                              "text-[10px] bg-transparent",
                              action.type === 'thinking' && "border-yellow-500 text-yellow-500",
                              action.type === 'executing' && "border-blue-500 text-blue-500",
                              action.type === 'completed' && "border-green-500 text-green-500",
                              action.type === 'error' && "border-red-500 text-red-500"
                            )}
                          >
                            {action.type === 'thinking' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            {action.type === 'executing' && <Zap className="h-3 w-3 mr-1" />}
                            {action.type === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {action.type === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {action.description}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <ScrollArea className="flex-1 p-2">
                    <div className="font-mono text-xs space-y-1">
                      {terminalLines.map(line => (
                        <div
                          key={line.id}
                          className={cn(
                            "whitespace-pre-wrap",
                            line.type === 'error' && "text-red-400",
                            line.type === 'success' && "text-green-400",
                            line.type === 'info' && "text-blue-400",
                            line.type === 'input' && "text-yellow-400",
                            line.type === 'output' && "text-gray-400",
                            line.type === 'agent' && "text-purple-300"
                          )}
                        >
                          {line.content}
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-2 border-t border-[#333]">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-purple-400" />
                      <input
                        type="text"
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && terminalInput.trim() && !isAgentWorking) {
                            processAgentCommand(terminalInput);
                            setTerminalInput('');
                          }
                        }}
                        placeholder="Pergunte algo ou digite um comando... (help para ajuda)"
                        disabled={isAgentWorking}
                      />
                      <Button
                        size="sm"
                        className="h-7 bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          if (terminalInput.trim() && !isAgentWorking) {
                            processAgentCommand(terminalInput);
                            setTerminalInput('');
                          }
                        }}
                        disabled={isAgentWorking || !terminalInput.trim()}
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Preview Panel */}
          {showPreview && (
            <>
              <ResizableHandle className="w-1 bg-[#333] hover:bg-[#007acc]" />
              <ResizablePanel defaultSize={32} minSize={20} maxSize={50}>
                <div className="h-full flex flex-col bg-[#1e1e1e] border-l border-[#333]">
                  {/* Preview Header */}
                  <div className="h-9 border-b border-[#333] flex items-center px-3 bg-[#252526] gap-2">
                    <Eye className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-white">Preview</span>
                    <div className="flex-1" />

                    {/* URL Input */}
                    <div className="flex items-center gap-1 bg-[#3c3c3c] rounded px-2 py-1 text-xs">
                      <input
                        type="text"
                        value={previewUrl}
                        onChange={(e) => setPreviewUrl(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && refreshPreview()}
                        className="bg-transparent outline-none text-gray-300 w-32"
                        placeholder="URL..."
                        title="URL do preview"
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                      onClick={refreshPreview}
                      title="Recarregar preview"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                      onClick={() => window.open(previewUrl, '_blank')}
                      title="Abrir em nova aba"
                    >
                      <Rocket className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Preview Content */}
                  <div className="flex-1 bg-white relative">
                    {previewUrl ? (
                      <iframe
                        ref={iframeRef}
                        key={previewKey}
                        src={previewUrl}
                        className="w-full h-full border-0"
                        title="Preview da aplicação"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-gray-500">
                        <div className="text-center">
                          <Eye className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p>Nenhuma URL configurada</p>
                          <p className="text-xs mt-2">Configure a URL acima</p>
                        </div>
                      </div>
                    )}

                    {/* Preview Pages Quick Access */}
                    <div className="absolute bottom-0 left-0 right-0 bg-[#252526] border-t border-[#333] p-2">
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-gray-400 hover:text-white"
                          onClick={() => { setPreviewUrl(window.location.origin + '/'); refreshPreview(); }}
                        >
                          Home
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-gray-400 hover:text-white"
                          onClick={() => { setPreviewUrl(window.location.origin + '/clients'); refreshPreview(); }}
                        >
                          Clientes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-gray-400 hover:text-white"
                          onClick={() => { setPreviewUrl(window.location.origin + '/accounting'); refreshPreview(); }}
                        >
                          Contábil
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-gray-400 hover:text-white"
                          onClick={() => { setPreviewUrl(window.location.origin + '/dre'); refreshPreview(); }}
                        >
                          DRE
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-gray-400 hover:text-white"
                          onClick={() => { setPreviewUrl(window.location.origin + '/balance-sheet'); refreshPreview(); }}
                        >
                          BP
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </Layout>
  );
};

export default CodeEditor;
