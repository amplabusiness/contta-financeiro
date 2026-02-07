import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Send, Bot, User, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, RefreshCw, Paperclip, X, ChevronDown, MessageSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency } from "@/data/expensesData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: string;
  timestamp: Date;
  actions?: ActionItem[];
  attachments?: Attachment[];
  pending?: boolean;
}

interface ActionItem {
  type: 'lancamento' | 'baixa' | 'classificacao' | 'confirmacao';
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'error';
  details?: any;
}

interface Attachment {
  name: string;
  type: string;
  size: number;
  data?: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  color: string;
}

const AGENTS: Agent[] = [
  { id: 'cicero', name: 'Dr. Cícero', avatar: '👨‍⚖️', specialty: 'Contador e NBC', color: 'bg-blue-500' },
  { id: 'advocato', name: 'Dr. Advocato', avatar: '⚖️', specialty: 'Direito Trabalhista', color: 'bg-purple-500' },
  { id: 'milton', name: 'Prof. Milton', avatar: '📊', specialty: 'Análise Financeira', color: 'bg-green-500' },
  { id: 'kaka', name: 'Kaká', avatar: '🤖', specialty: 'Automação', color: 'bg-orange-500' },
  { id: 'conceicao', name: 'Conceição', avatar: '💰', specialty: 'Cobrança', color: 'bg-red-500' },
  { id: 'rubi', name: 'Rubi', avatar: '📂', specialty: 'Classificação', color: 'bg-pink-500' },
];

/**
 * AIChat - Chat Inteligente com Agentes de IA
 *
 * Permite ao funcionário:
 * - Conversar naturalmente sobre transações
 * - Importar arquivos CSV diretamente no chat
 * - Confirmar ou rejeitar lançamentos propostos
 * - Fazer perguntas sobre classificação
 */
const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[0]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mensagem inicial
  useEffect(() => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: `Olá! Sou o ${selectedAgent.name}, especialista em ${selectedAgent.specialty}. Como posso ajudar você hoje?\n\nVocê pode:\n- Me enviar um arquivo de extrato bancário ou boletos\n- Perguntar sobre um PIX ou transação específica\n- Pedir para classificar despesas\n- Solicitar baixa de honorários\n\nÉ só digitar ou anexar um arquivo!`,
      agent: selectedAgent.id,
      timestamp: new Date()
    }]);
  }, [selectedAgent]);

  // Processar arquivo anexado
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newAttachment: Attachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target?.result as string
        };
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsText(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remover anexo
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Processar CSV de boletos
  const processBoletoCSV = async (csvData: string, fileName: string): Promise<any[]> => {
    const lines = csvData.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Detectar separador
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());

    const transactions: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator);
      if (values.length < 2) continue;

      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx]?.trim() || '';
      });

      // Tentar identificar campos comuns
      const valor = parseFloat(
        (row.valor || row.value || row.amount || '0')
          .replace('R$', '')
          .replace('.', '')
          .replace(',', '.')
          .trim()
      );

      const data = row.data || row.date || row.vencimento || row.due_date || '';
      const nome = row.nome || row.name || row.cliente || row.client || row.pagador || '';
      const cnpj = row.cnpj || row.cpf || row.documento || '';

      if (valor > 0) {
        transactions.push({
          valor,
          data,
          nome,
          cnpj,
          raw: row
        });
      }
    }

    return transactions;
  };

  // Identificar cliente por CNPJ/nome
  const identifyClient = async (transaction: any): Promise<any> => {
    // Tentar por CNPJ
    if (transaction.cnpj) {
      const cnpjLimpo = transaction.cnpj.replace(/\D/g, '');
      const { data } = await supabase
        .from('clients')
        .select('id, name, nome_fantasia, cnpj')
        .eq('cnpj', cnpjLimpo)
        .single();

      if (data) return data;
    }

    // Tentar por nome (busca parcial)
    if (transaction.nome) {
      const { data } = await supabase
        .from('clients')
        .select('id, name, nome_fantasia, cnpj')
        .or(`name.ilike.%${transaction.nome}%,nome_fantasia.ilike.%${transaction.nome}%`)
        .limit(1)
        .single();

      if (data) return data;
    }

    return null;
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Se houver anexos, processar primeiro
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.name.endsWith('.csv') && attachment.data) {
            // Processar CSV
            const transactions = await processBoletoCSV(attachment.data, attachment.name);

            if (transactions.length > 0) {
              // Identificar clientes para cada transação
              const transacoesIdentificadas = await Promise.all(
                transactions.map(async (t) => {
                  const cliente = await identifyClient(t);
                  return {
                    ...t,
                    cliente,
                    status: cliente ? 'identificado' : 'pendente'
                  };
                })
              );

              setPendingTransactions(transacoesIdentificadas);

              // Gerar resposta com análise
              const identificados = transacoesIdentificadas.filter(t => t.status === 'identificado');
              const pendentes = transacoesIdentificadas.filter(t => t.status === 'pendente');

              let responseContent = `📊 Analisei o arquivo **${attachment.name}** e encontrei **${transactions.length} transações**:\n\n`;

              if (identificados.length > 0) {
                responseContent += `✅ **${identificados.length} identificadas automaticamente:**\n`;
                identificados.slice(0, 5).forEach(t => {
                  responseContent += `- ${t.cliente.nome_fantasia || t.cliente.name}: ${formatCurrency(t.valor)}\n`;
                });
                if (identificados.length > 5) {
                  responseContent += `  ... e mais ${identificados.length - 5}\n`;
                }
                responseContent += '\n';
              }

              if (pendentes.length > 0) {
                responseContent += `⚠️ **${pendentes.length} precisam de identificação:**\n`;
                pendentes.slice(0, 3).forEach(t => {
                  responseContent += `- ${t.nome || 'Sem nome'}: ${formatCurrency(t.valor)} - De quem é este valor?\n`;
                });
                if (pendentes.length > 3) {
                  responseContent += `  ... e mais ${pendentes.length - 3}\n`;
                }
                responseContent += '\n';
              }

              if (identificados.length > 0) {
                responseContent += `\n**Deseja que eu faça a baixa dos ${identificados.length} clientes identificados?** Responda "sim" para confirmar ou "não" para revisar manualmente.`;
              }

              const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseContent,
                agent: selectedAgent.id,
                timestamp: new Date(),
                actions: identificados.map(t => ({
                  type: 'baixa' as const,
                  description: `Baixar ${formatCurrency(t.valor)} de ${t.cliente?.nome_fantasia || t.cliente?.name}`,
                  status: 'pending' as const,
                  details: t
                }))
              };

              setMessages(prev => [...prev, assistantMessage]);
            }
          }
        }
        setAttachments([]);
      } else {
        // Processar mensagem de texto
        const lowerInput = input.toLowerCase();

        // Verificar se é confirmação
        if (lowerInput === 'sim' || lowerInput === 'confirmar' || lowerInput === 'ok') {
          const lastMessage = messages.filter(m => m.role === 'assistant').pop();
          if (lastMessage?.actions && lastMessage.actions.length > 0) {
            // Executar ações pendentes
            const pendingActions = lastMessage.actions.filter(a => a.status === 'pending');

            const executingMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `⏳ Executando ${pendingActions.length} lançamentos...`,
              agent: selectedAgent.id,
              timestamp: new Date(),
              pending: true
            };

            setMessages(prev => [...prev, executingMessage]);

            // Simular execução (aqui você conectaria com o backend real)
            let successCount = 0;
            let errorCount = 0;

            for (const action of pendingActions) {
              try {
                if (action.type === 'baixa' && action.details?.cliente) {
                  // Criar lançamento de baixa
                  const { data: contaBanco } = await supabase
                    .from('chart_of_accounts')
                    .select('id')
                    .eq('code', '1.1.1.05')
                    .single();

                  const { data: contaClientes } = await supabase
                    .from('chart_of_accounts')
                    .select('id')
                    .eq('code', '1.1.2.01')
                    .single();

                  if (contaBanco && contaClientes) {
                    // Criar entry
                    const { data: entry, error: entryError } = await supabase
                      .from('accounting_entries')
                      .insert({
                        entry_date: new Date().toISOString().split('T')[0],
                        description: `Recebimento ${action.details.cliente.nome_fantasia || action.details.cliente.name}`,
                        entry_type: 'recebimento',
                        reference_type: 'ai_chat',
                        reference_id: action.details.cliente.id
                      })
                      .select()
                      .single();

                    if (!entryError && entry) {
                      // Criar linhas (accounting_entry_items não tem coluna description)
                      await supabase
                        .from('accounting_entry_items')
                        .insert([
                          {
                            entry_id: entry.id,
                            account_id: contaBanco.id,
                            debit: action.details.valor,
                            credit: 0
                          },
                          {
                            entry_id: entry.id,
                            account_id: contaClientes.id,
                            debit: 0,
                            credit: action.details.valor
                          }
                        ]);

                      successCount++;
                    }
                  }
                }
              } catch (error) {
                errorCount++;
                console.error('Erro ao executar ação:', error);
              }
            }

            // Atualizar mensagem final
            const resultMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: 'assistant',
              content: `✅ **Concluído!**\n\n- ${successCount} lançamentos realizados com sucesso\n${errorCount > 0 ? `- ${errorCount} erros (verifique os logs)\n` : ''}\nOs valores já estão refletidos no sistema. Posso ajudar com mais alguma coisa?`,
              agent: selectedAgent.id,
              timestamp: new Date()
            };

            setMessages(prev => prev.filter(m => !m.pending).concat(resultMessage));
            setPendingTransactions([]);

            return;
          }
        }

        // Verificar se é negação
        if (lowerInput === 'não' || lowerInput === 'nao' || lowerInput === 'cancelar') {
          const cancelMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Ok, operação cancelada. As transações permanecem pendentes para revisão manual. Posso ajudar com mais alguma coisa?',
            agent: selectedAgent.id,
            timestamp: new Date()
          };

          setMessages(prev => [...prev, cancelMessage]);
          setPendingTransactions([]);
          return;
        }

        // Consultar Dr. Cícero para outras mensagens
        try {
          const { data, error } = await supabase.functions.invoke('dr-cicero-brain', {
            body: {
              action: 'consult',
              question: input
            }
          });

          if (error) throw error;

          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data?.response || data?.knowledge || 'Desculpe, não consegui processar sua pergunta. Pode reformular?',
            agent: selectedAgent.id,
            timestamp: new Date()
          };

          setMessages(prev => [...prev, assistantMessage]);
        } catch (error: any) {
          console.error('Erro ao consultar agente:', error);

          // Fallback para resposta local
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: getLocalResponse(input),
            agent: selectedAgent.id,
            timestamp: new Date()
          };

          setMessages(prev => [...prev, assistantMessage]);
        }
      }
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao processar mensagem');
    } finally {
      setLoading(false);
    }
  };

  // Resposta local quando API não disponível
  const getLocalResponse = (input: string): string => {
    const lower = input.toLowerCase();

    if (lower.includes('pix') || lower.includes('transferência')) {
      return `Para identificar um PIX, preciso das seguintes informações:\n\n1. **Valor** do PIX\n2. **Data** da transação\n3. **Nome/CNPJ** do pagador (se disponível)\n\nVocê pode me enviar o extrato bancário em CSV que farei a análise automaticamente, ou me dizer esses dados que busco no sistema.`;
    }

    if (lower.includes('boleto') || lower.includes('baixa') || lower.includes('recebimento')) {
      return `Para fazer a baixa de boletos, você pode:\n\n1. **Enviar o arquivo CSV** com os boletos liquidados\n2. **Informar manualmente**: Cliente, Valor, Data\n\nAnexe o arquivo ou me diga os detalhes que faço o lançamento.`;
    }

    if (lower.includes('despesa') || lower.includes('classificar') || lower.includes('conta')) {
      return `Para classificar uma despesa, preciso saber:\n\n1. **Descrição** da despesa\n2. **Valor**\n3. **Fornecedor/Beneficiário**\n\nMe diga esses dados e sugiro a conta correta conforme nosso plano de contas.`;
    }

    return `Entendi sua pergunta sobre "${input}". Posso ajudar com:\n\n- **Baixa de boletos/PIX**: Envie o arquivo CSV ou me diga os detalhes\n- **Classificação de despesas**: Me informe a descrição e valor\n- **Lançamentos contábeis**: Diga o que precisa lançar\n- **Dúvidas sobre NBC**: Pergunte sobre normas contábeis\n\nComo posso ajudar?`;
  };

  // Trocar agente
  const switchAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    toast.info(`Agora você está conversando com ${agent.name}`);
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <Card className="mb-4">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className={`h-10 w-10 ${selectedAgent.color}`}>
                  <AvatarFallback className="text-lg">{selectedAgent.avatar}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{selectedAgent.name}</CardTitle>
                  <CardDescription>{selectedAgent.specialty}</CardDescription>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Trocar Agente <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {AGENTS.map(agent => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => switchAgent(agent)}
                      className="flex items-center gap-2"
                    >
                      <span>{agent.avatar}</span>
                      <span>{agent.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {agent.specialty}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
        </Card>

        {/* Chat Messages */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                        <span>{AGENTS.find(a => a.id === message.agent)?.avatar}</span>
                        <span className="font-medium">
                          {AGENTS.find(a => a.id === message.agent)?.name}
                        </span>
                      </div>
                    )}

                    {/* Anexos */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {message.attachments.map((att, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm bg-background/50 rounded px-2 py-1">
                            <FileText className="h-4 w-4" />
                            <span>{att.name}</span>
                            <Badge variant="secondary">{(att.size / 1024).toFixed(1)} KB</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Conteúdo */}
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>

                    {/* Loading */}
                    {message.pending && (
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Processando...</span>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Anexos pendentes */}
          {attachments.length > 0 && (
            <div className="p-2 border-t bg-muted/50">
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-background rounded-full px-3 py-1 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{att.name}</span>
                    <button onClick={() => removeAttachment(idx)} className="hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
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
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
              />

              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Digite sua mensagem ou anexe um arquivo..."
                disabled={loading}
                className="flex-1"
              />

              <Button onClick={sendMessage} disabled={loading || (!input.trim() && attachments.length === 0)}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span>Formatos aceitos: CSV, XLSX</span>
              <span>|</span>
              <span>Separe comandos com Enter</span>
            </div>
          </div>
        </Card>

        {/* Transações pendentes (se houver) */}
        {pendingTransactions.length > 0 && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {pendingTransactions.filter(t => t.status === 'pendente').length} transações aguardando identificação manual
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  );
};

export default AIChat;
