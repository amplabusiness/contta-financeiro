/**
 * DrCiceroChat.tsx
 * 
 * Chat de Consulta Contábil com o Dr. Cícero
 * 
 * Permite ao funcionário do financeiro consultar o Dr. Cícero sobre:
 * - Como classificar uma transação (débito/crédito)
 * - Qual conta usar (ativo/passivo/receita/despesa)
 * - Situações especiais (ressarcimento, devolução, etc.)
 * 
 * @author Sérgio Carneiro Leão
 * @date 30/01/2026
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { toast } from 'sonner';
import { formatCurrency } from '@/data/expensesData';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Send,
  Loader2,
  Brain,
  User,
  CheckCircle2,
  Copy,
  Lightbulb,
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// TIPOS
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestion?: ClassificationSuggestion;
}

interface ClassificationSuggestion {
  tipo: 'debito' | 'credito';
  conta_codigo: string;
  conta_nome: string;
  natureza: 'ativo' | 'passivo' | 'receita' | 'despesa' | 'pl';
  explicacao: string;
  lancamento_exemplo?: {
    debito: { conta: string; valor: number };
    credito: { conta: string; valor: number };
  };
}

interface BankTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  matched?: boolean;
  extracted_cnpj?: string;
  extracted_cpf?: string;
  suggested_client_name?: string;
}

interface DrCiceroChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: BankTransaction | null;
  onApplySuggestion?: (suggestion: ClassificationSuggestion) => void;
}

// ============================================================================
// SUGESTÕES RÁPIDAS POR TIPO DE TRANSAÇÃO
// ============================================================================

const QUICK_QUESTIONS_ENTRADA = [
  "Funcionário ressarciu a empresa",
  "Devolução de pagamento duplicado",
  "Cliente pagou antecipado",
  "Reembolso de despesa",
  "Sócio fez aporte",
  "É receita de serviços",
];

const QUICK_QUESTIONS_SAIDA = [
  "Pagamento de despesa operacional",
  "Adiantamento para fornecedor",
  "Retirada de sócio (pró-labore)",
  "Pagamento de salário",
  "Despesa pessoal de sócio",
  "Transferência entre contas",
];

// ============================================================================
// COMPONENTE
// ============================================================================

export function DrCiceroChat({
  open,
  onOpenChange,
  transaction,
  onApplySuggestion
}: DrCiceroChatProps) {
  const { tenant } = useTenantConfig();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Scroll automático para última mensagem
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Mensagem de boas-vindas ao abrir
  useEffect(() => {
    if (open && messages.length === 0) {
      const tipoTransacao = transaction?.amount && transaction.amount > 0 ? 'ENTRADA' : 'SAÍDA';
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: transaction 
          ? `🧠 **Dr. Cícero - Consultoria Contábil**\n\n` +
            `Analisando a transação:\n\n` +
            `📄 **${transaction.description}**\n` +
            `💰 Valor: **${formatCurrency(Math.abs(transaction.amount))}** (${tipoTransacao})\n` +
            `📅 Data: ${format(new Date(transaction.date), "dd/MM/yyyy", { locale: ptBR })}\n` +
            `${transaction.extracted_cnpj ? `🏢 CNPJ: ${transaction.extracted_cnpj}\n` : ''}` +
            `${transaction.extracted_cpf ? `👤 CPF: ${transaction.extracted_cpf}\n` : ''}` +
            `${transaction.suggested_client_name ? `✅ Cliente: ${transaction.suggested_client_name}\n` : ''}\n` +
            `**Me descreva a situação** e eu orientarei:\n` +
            `• Qual conta debitar/creditar\n` +
            `• Se é ativo, passivo, receita ou despesa\n` +
            `• Como fazer o lançamento correto\n\n` +
            `_Exemplo: "Funcionário esqueceu de pagar uma conta e ressarciu a empresa"_`
          : `🧠 **Dr. Cícero - Consultoria Contábil**\n\n` +
            `Estou aqui para ajudar com dúvidas sobre classificação contábil.\n\n` +
            `**Me descreva a situação** e eu orientarei:\n` +
            `• Se é débito ou crédito\n` +
            `• Qual conta usar (ativo, passivo, receita, despesa)\n` +
            `• Como fazer o lançamento correto`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction]);
  
  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInputValue('');
    }
  }, [open]);
  
  // Enviar mensagem
  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);
    
    try {
      // 1. Buscar contexto enriquecido do RAG (ai-context-provider)
      let ragContext = '';
      try {
        const { data: contextData } = await supabase.functions.invoke('ai-context-provider', {
          body: { 
            type: 'classification_context',
            competencia: transaction ? format(new Date(transaction.date), 'yyyy-MM') : format(new Date(), 'yyyy-MM')
          }
        });
        if (contextData) {
          ragContext = `\n\nCONTEXTO RAG (Base de Conhecimento):
- Plano de Contas: ${contextData.plano_contas_version || 'v1.0'}
- Família Leão (sócios): ${JSON.stringify(contextData.familia_leao?.membros?.map((m: { nome: string }) => m.nome) || [])}
- Regra Família: ${contextData.familia_leao?.regras?.despesas_pessoais || 'Gastos pessoais = Adiantamento a Sócios'}
- Contas Transitórias: 1.1.9.01 (Débitos) e 2.1.9.01 (Créditos)`;
        }
      } catch (e) {
        console.log('[DrCiceroChat] RAG context não disponível, continuando sem');
      }
      
      // 2. Preparar contexto da transação
      const transactionContext = transaction 
        ? `\n\nCONTEXTO DA TRANSAÇÃO:
- Descrição: ${transaction.description}
- Valor: ${formatCurrency(Math.abs(transaction.amount))}
- Data: ${format(new Date(transaction.date), "dd/MM/yyyy")}
- Tipo: ${transaction.amount > 0 ? 'ENTRADA (crédito no extrato)' : 'SAÍDA (débito no extrato)'}
${transaction.extracted_cnpj ? `- CNPJ identificado: ${transaction.extracted_cnpj}` : ''}
${transaction.extracted_cpf ? `- CPF identificado: ${transaction.extracted_cpf}` : ''}
${transaction.suggested_client_name ? `- Cliente sugerido: ${transaction.suggested_client_name}` : ''}`
        : '';
      
      // 3. Preparar histórico
      const chatHistory = messages
        .filter(m => m.id !== 'welcome')
        .map(m => `${m.role === 'user' ? 'Usuário' : 'Dr. Cícero'}: ${m.content}`)
        .join('\n\n');
      
      // 4. Chamar Edge Function do Dr. Cícero com RAG
      const { data, error } = await supabase.functions.invoke('dr-cicero-brain', {
        body: {
          action: 'consult',
          question: inputValue,
          context: transactionContext + ragContext,
          history: chatHistory,
          tenant_id: tenant?.id,
          // Flags para RAG
          use_rag: true,
          include_nbc: true,
          include_ampla_context: true
        }
      });
      
      if (error) throw error;
      
      // 5. Processar resposta (pode vir como string ou objeto)
      const responseText = typeof data === 'string' ? data : (data?.response || data?.text || data);
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText || 'Desculpe, não consegui processar sua pergunta. Pode reformular?',
        timestamp: new Date(),
        suggestion: data?.suggestion
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Erro ao consultar Dr. Cícero:', error);
      
      // Fallback com resposta local se a Edge Function falhar
      const fallbackMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: getFallbackResponse(inputValue, transaction),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
      toast.error('Não foi possível conectar ao Dr. Cícero. Usando resposta offline.');
    } finally {
      setLoading(false);
    }
  };
  
  // Usar pergunta rápida
  const handleQuickQuestion = (question: string) => {
    setInputValue(question);
    textareaRef.current?.focus();
  };
  
  // Copiar resposta
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };
  
  // Aplicar sugestão
  const handleApplySuggestion = (suggestion: ClassificationSuggestion) => {
    if (onApplySuggestion) {
      onApplySuggestion(suggestion);
      toast.success('Sugestão aplicada! Revise antes de confirmar.');
      onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <DialogTitle className="flex items-center gap-3 text-blue-800">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="block">Consulta com Dr. Cícero</span>
              <span className="text-xs font-normal text-blue-600">Orientação Contábil Especializada</span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Chat de consulta contábil com o Dr. Cícero
          </DialogDescription>
        </DialogHeader>
        
        {/* Área de mensagens */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="bg-blue-100 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                      <Brain className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`rounded-lg p-3 text-sm ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {/* Renderizar markdown básico */}
                      <div 
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    </div>
                    
                    {/* Sugestão estruturada */}
                    {message.suggestion && (
                      <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="font-semibold text-emerald-800 text-sm">Sugestão de Classificação</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">Tipo:</span>
                            <Badge variant="outline" className="ml-2">
                              {message.suggestion.tipo === 'debito' ? 'DÉBITO' : 'CRÉDITO'}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-slate-500">Natureza:</span>
                            <Badge variant="outline" className="ml-2 capitalize">
                              {message.suggestion.natureza}
                            </Badge>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500">Conta:</span>
                            <span className="ml-2 font-mono text-emerald-700">
                              {message.suggestion.conta_codigo} - {message.suggestion.conta_nome}
                            </span>
                          </div>
                        </div>
                        
                        {message.suggestion.lancamento_exemplo && (
                          <div className="mt-2 p-2 bg-white rounded border text-xs font-mono">
                            <div className="text-blue-600">
                              D - {message.suggestion.lancamento_exemplo.debito.conta} {formatCurrency(message.suggestion.lancamento_exemplo.debito.valor)}
                            </div>
                            <div className="text-red-600">
                              C - {message.suggestion.lancamento_exemplo.credito.conta} {formatCurrency(message.suggestion.lancamento_exemplo.credito.valor)}
                            </div>
                          </div>
                        )}
                        
                        {onApplySuggestion && (
                          <Button
                            size="sm"
                            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleApplySuggestion(message.suggestion!)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Aplicar esta Classificação
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Ações na mensagem */}
                    {message.role === 'assistant' && message.id !== 'welcome' && (
                      <div className="flex gap-1 mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600"
                          onClick={() => copyToClipboard(message.content)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    )}
                    
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {format(message.timestamp, "HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="bg-blue-600 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="bg-blue-100 p-2 rounded-full h-8 w-8 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="bg-slate-100 rounded-lg p-3 text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Dr. Cícero está analisando...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        <Separator />
        
        {/* Perguntas rápidas - baseadas no tipo de transação */}
        {messages.length <= 1 && (
          <div className="px-4 py-2 bg-slate-50 border-b">
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
              <Lightbulb className="h-3 w-3" />
              {transaction?.amount && transaction.amount > 0 
                ? '💰 Esta é uma ENTRADA. Situações comuns:' 
                : transaction?.amount && transaction.amount < 0 
                  ? '💸 Esta é uma SAÍDA. Situações comuns:'
                  : 'Situações comuns:'}
            </div>
            <div className="flex flex-wrap gap-1">
              {(transaction?.amount && transaction.amount > 0 
                ? QUICK_QUESTIONS_ENTRADA 
                : transaction?.amount && transaction.amount < 0 
                  ? QUICK_QUESTIONS_SAIDA 
                  : [...QUICK_QUESTIONS_ENTRADA.slice(0, 3), ...QUICK_QUESTIONS_SAIDA.slice(0, 3)]
              ).map((question, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2 hover:bg-blue-50 hover:border-blue-300"
                  onClick={() => handleQuickQuestion(question)}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* Input area */}
        <div className="p-4 pt-2 bg-white">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Descreva a situação para o Dr. Cícero..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="min-h-[60px] max-h-[120px] resize-none text-sm"
              disabled={loading}
            />
            <Button
              className="h-[60px] px-4 bg-blue-600 hover:bg-blue-700"
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-center">
            Pressione Enter para enviar • Shift+Enter para nova linha
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// FALLBACK RESPONSE (quando Edge Function falha)
// ============================================================================

function getFallbackResponse(question: string, transaction?: BankTransaction | null): string {
  const lowerQuestion = question.toLowerCase();
  const valor = transaction ? formatCurrency(Math.abs(transaction.amount)) : 'R$ X.XXX,XX';
  const isEntrada = transaction && transaction.amount > 0;
  
  // Ressarcimento / Reembolso de funcionário
  if (lowerQuestion.includes('ressarc') || lowerQuestion.includes('funcionário') || lowerQuestion.includes('funcionario')) {
    return `✅ **Ressarcimento de Funcionário**

Situação: Funcionário ressarciu a empresa por erro/esquecimento.

**LANÇAMENTO SUGERIDO:**

\`\`\`
D - 1.1.1.05 Banco Sicredi .............. ${valor}
C - 4.1.2.01 Salários e Ordenados ....... ${valor}
   (Estorno de despesa - ressarcimento)
\`\`\`

**Explicação:**
• Como a despesa já foi lançada anteriormente, creditamos a mesma conta para ESTORNAR
• O banco aumenta (débito no ativo)
• A despesa diminui (crédito)

⚠️ **Alternativas:**
- Se for desconto em folha futura: **C - 2.1.1.99 Valores a Descontar**
- Se for ressarcimento de terceiro (não funcionário): **C - 3.1.1.99 Outras Receitas**`;
  }
  
  // Devolução / Pagamento duplicado
  if (lowerQuestion.includes('devolu') || lowerQuestion.includes('duplica') || lowerQuestion.includes('estorn')) {
    return `✅ **Devolução / Pagamento Duplicado**

Situação: Recebemos de volta um valor pago indevidamente.

**LANÇAMENTO SUGERIDO:**

\`\`\`
D - 1.1.1.05 Banco Sicredi .............. ${valor}
C - [Conta da despesa original] ........ ${valor}
   (Estorno - devolução de pagamento)
\`\`\`

**Qual era a despesa original?** Me diga para eu indicar a conta correta.

⚠️ Se não souber a despesa original:
\`\`\`
D - 1.1.1.05 Banco Sicredi
C - 3.1.1.99 Outras Receitas
\`\`\``;
  }
  
  // Reembolso
  if (lowerQuestion.includes('reembolso')) {
    return `✅ **Reembolso de Despesa**

Situação: Empresa recebeu reembolso de despesa paga anteriormente.

**LANÇAMENTO SUGERIDO:**

\`\`\`
D - 1.1.1.05 Banco Sicredi .............. ${valor}
C - [Conta da despesa original] ........ ${valor}
   (Reembolso de despesa)
\`\`\`

Me diga **qual tipo de despesa** foi reembolsada para eu indicar a conta correta.`;
  }
  
  // Adiantamento
  if (lowerQuestion.includes('adiantamento') || lowerQuestion.includes('antecipa')) {
    if (isEntrada) {
      return `✅ **Adiantamento de Cliente (ENTRADA)**

Cliente pagou antecipadamente por serviço ainda não prestado.

**LANÇAMENTO SUGERIDO:**

\`\`\`
D - 1.1.1.05 Banco Sicredi .............. ${valor}
C - 2.1.2.01 Adiantamentos de Clientes .. ${valor}
   (Adiantamento recebido)
\`\`\`

⚠️ Quando prestar o serviço:
\`\`\`
D - 2.1.2.01 Adiantamentos de Clientes
C - 3.1.1.01 Receita de Serviços
\`\`\``;
    } else {
      return `✅ **Adiantamento a Fornecedor (SAÍDA)**

Empresa adiantou pagamento a fornecedor.

**LANÇAMENTO SUGERIDO:**

\`\`\`
D - 1.1.4.01 Adiantamentos a Fornecedores ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
   (Adiantamento a fornecedor)
\`\`\`

⚠️ Quando receber a mercadoria/serviço:
\`\`\`
D - [Despesa ou Estoque]
C - 1.1.4.01 Adiantamentos a Fornecedores
\`\`\``;
    }
  }
  
  // Sócio / Retirada
  if (lowerQuestion.includes('sócio') || lowerQuestion.includes('socio') || lowerQuestion.includes('retir') || lowerQuestion.includes('pró-labore') || lowerQuestion.includes('pro-labore')) {
    if (isEntrada) {
      return `✅ **Aporte de Sócio (ENTRADA)**

Sócio colocou dinheiro na empresa.

**LANÇAMENTO SUGERIDO:**

\`\`\`
D - 1.1.1.05 Banco Sicredi .............. ${valor}
C - 2.1.3.01 Empréstimos de Sócios ...... ${valor}
   (ou C - 5.1.1.01 Capital Social se for integralização)
\`\`\``;
    } else {
      return `✅ **Retirada de Sócio (SAÍDA)**

Pagamento de pró-labore ou retirada de lucros.

**LANÇAMENTO SUGERIDO (Pró-labore):**

\`\`\`
D - 4.1.2.05 Pró-labore ................. ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
\`\`\`

**Ou se for empréstimo ao sócio:**

\`\`\`
D - 1.1.3.01 Adiantamentos a Sócios ..... ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
\`\`\``;
    }
  }
  
  // Despesa pessoal
  if (lowerQuestion.includes('pessoal') || lowerQuestion.includes('particular')) {
    return `⚠️ **Despesa Pessoal de Sócio**

**REGRA DO DR. CÍCERO:** Despesas pessoais de sócios **NUNCA** são despesas da empresa!

**LANÇAMENTO CORRETO:**

\`\`\`
D - 1.1.3.xx Adiantamentos a Sócios ..... ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
   (Uso particular - a ressarcir)
\`\`\`

⚠️ Isso cria um **direito a receber** do sócio.
O sócio deve devolver este valor ou compensar com lucros.`;
  }
  
  // Salário
  if (lowerQuestion.includes('salár') || lowerQuestion.includes('salar') || lowerQuestion.includes('folha')) {
    return `✅ **Pagamento de Salário**

**LANÇAMENTO (Regime de Caixa):**

\`\`\`
D - 4.1.2.01 Salários e Ordenados ....... ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
\`\`\`

**Ou se houver provisão (Regime Competência):**

\`\`\`
D - 2.1.1.01 Salários a Pagar ........... ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
   (Baixa da provisão)
\`\`\``;
  }
  
  // Receita de serviços
  if (lowerQuestion.includes('receita') || lowerQuestion.includes('serviço') || lowerQuestion.includes('servico') || lowerQuestion.includes('honorár')) {
    return `✅ **Receita de Serviços**

Cliente pagou por serviços prestados.

**LANÇAMENTO:**

\`\`\`
D - 1.1.1.05 Banco Sicredi .............. ${valor}
C - 3.1.1.01 Receita de Honorários ...... ${valor}
   (Recebimento de cliente)
\`\`\`

⚠️ Se havia provisão (duplicata a receber):
\`\`\`
D - 1.1.1.05 Banco Sicredi
C - 1.1.2.01.xx Clientes a Receber - [Nome]
\`\`\``;
  }
  
  // Transferência
  if (lowerQuestion.includes('transfer') || lowerQuestion.includes('entre conta')) {
    return `✅ **Transferência entre Contas**

Movimentação entre contas da própria empresa.

**LANÇAMENTO:**

\`\`\`
D - 1.1.1.xx [Banco destino] ............ ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
   (Transferência interna)
\`\`\`

⚠️ **Não gera despesa nem receita!** É apenas movimentação de caixa.`;
  }
  
  // Despesa operacional genérica
  if (lowerQuestion.includes('despesa') || lowerQuestion.includes('pagamento')) {
    return `✅ **Pagamento de Despesa**

**LANÇAMENTO GENÉRICO:**

\`\`\`
D - 4.x.x.xx [Conta de Despesa] ......... ${valor}
C - 1.1.1.05 Banco Sicredi .............. ${valor}
\`\`\`

**Me diga qual tipo de despesa** para eu indicar a conta correta:
- Aluguel → 4.1.1.01
- Energia → 4.1.1.02
- Telefone/Internet → 4.1.1.03
- Material de escritório → 4.1.1.05
- Honorários contábeis → 4.1.1.08`;
  }
  
  // Resposta genérica
  return `🤔 Entendi que você perguntou sobre: **"${question}"**

Para orientá-lo com o **lançamento correto**, preciso entender melhor:

1. **O que motivou esta ${isEntrada ? 'entrada' : 'saída'}?**
2. **Quem é a outra parte?** (cliente, fornecedor, funcionário, sócio)
3. **Já existe lançamento anterior relacionado?**

**Exemplos de situações:**
${isEntrada ? `
• "Cliente pagou fatura"
• "Sócio fez aporte"
• "Reembolso de despesa"
• "Funcionário ressarciu"
` : `
• "Pagamento de fornecedor"
• "Pró-labore de sócio"
• "Despesa com energia"
• "Adiantamento a funcionário"
`}

Me descreva a situação!`;
}

export default DrCiceroChat;
