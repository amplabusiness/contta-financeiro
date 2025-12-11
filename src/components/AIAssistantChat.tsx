import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Send, User, Loader2, HelpCircle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AI_TEAM, type AIAgent } from "./AITeamBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Tipos de mensagem no chat
interface ChatMessage {
  id: string;
  agent?: AIAgent;
  isUser: boolean;
  content: string;
  timestamp: Date;
  questionId?: string; // ID da pergunta pendente se for uma pergunta da IA
  options?: string[]; // Opções de resposta rápida
  answered?: boolean;
}

interface AIAssistantChatProps {
  context: string; // Ex: "bank_import", "expense_form", "client_form"
  contextId?: string; // ID do registro relacionado (transação, cliente, etc)
  onAnswerProvided?: (questionId: string, answer: string) => void;
  className?: string;
  defaultOpen?: boolean;
  compact?: boolean;
}

export function AIAssistantChat({
  context,
  contextId,
  onAnswerProvided,
  className = "",
  defaultOpen = false,
  compact = false,
}: AIAssistantChatProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Buscar perguntas pendentes da IA
  useEffect(() => {
    // TODO: Reativar quando tabela ai_pending_questions estiver disponível
    // loadPendingQuestions();
  }, [context, contextId]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadPendingQuestions = useCallback(async () => {
    try {
      // Tabela ai_pending_questions não tem coluna 'context', filtrar apenas por status
      let query = supabase
        .from("ai_pending_questions")
        .select("*")
        .eq("status", "pending");

      // contextId mapeia para bank_transaction_id quando disponível
      if (contextId) {
        query = query.eq("bank_transaction_id", contextId);
      }

      const { data, error } = await query.order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setPendingQuestions(data.length);

        // Converter perguntas pendentes em mensagens
        const questionMessages: ChatMessage[] = data.map((q: any) => {
          // Determinar qual agente está perguntando baseado no contexto
          const agent = getAgentForContext(q.question_type || context);

          return {
            id: q.id,
            agent,
            isUser: false,
            content: q.question_text, // campo correto da tabela
            timestamp: new Date(q.created_at),
            questionId: q.id,
            options: q.options || [], // campo correto da tabela
            answered: false,
          };
        });

        setMessages((prev) => {
          // Evitar duplicatas
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = questionMessages.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newMessages];
        });

        // Abrir automaticamente se houver perguntas pendentes
        if (data.length > 0 && !isOpen) {
          setIsOpen(true);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar perguntas pendentes:", error);
    }
  }, [context, contextId, isOpen]);

  // Buscar perguntas pendentes da IA
  useEffect(() => {
    loadPendingQuestions();
  }, [loadPendingQuestions]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getAgentForContext = (ctx: string): AIAgent => {
    // Mapear contexto para agente apropriado
    const contextAgentMap: Record<string, string> = {
      bank_import: "atlas", // Classificação = Atlas (Rede Neural)
      accounting: "cicero", // Contabilidade = Dr. Cícero
      expense: "milton", // Finanças = Prof. Milton
      client: "helena", // Gestão = Dra. Helena
      entity: "atlas", // Entidades = Atlas
      classification: "atlas", // Classificação = Atlas
    };

    const agentId = contextAgentMap[ctx] || "atlas";
    return AI_TEAM.find((a) => a.id === agentId) || AI_TEAM[3]; // Default: Atlas
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      isUser: true,
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Simular resposta da IA (em produção, chamar Edge Function)
      const agent = getAgentForContext(context);

      // Por enquanto, resposta simulada
      setTimeout(() => {
        const aiResponse: ChatMessage = {
          id: `ai-${Date.now()}`,
          agent,
          isUser: false,
          content: getSimulatedResponse(inputValue, agent),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setIsLoading(false);
      toast({
        title: "Erro",
        description: "Não foi possível processar sua mensagem",
        variant: "destructive",
      });
    }
  };

  const handleAnswerQuestion = async (questionId: string, answer: string) => {
    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      // Atualizar pergunta como respondida
      const { error } = await supabase
        .from("ai_pending_questions")
        .update({
          status: "answered",
          answer,
          answered_at: new Date().toISOString(),
          answered_by: user?.id,
        })
        .eq("id", questionId);

      if (error) throw error;

      // Marcar mensagem como respondida
      setMessages((prev) =>
        prev.map((m) =>
          m.questionId === questionId ? { ...m, answered: true } : m
        )
      );

      // Adicionar mensagem de confirmação
      const confirmMessage: ChatMessage = {
        id: `confirm-${Date.now()}`,
        isUser: true,
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);

      // Adicionar resposta de agradecimento
      const agent = getAgentForContext(context);
      const thankYouMessage: ChatMessage = {
        id: `thanks-${Date.now()}`,
        agent,
        isUser: false,
        content: `Obrigado! Vou lembrar que "${answer}". Isso vai me ajudar nas próximas classificações.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, thankYouMessage]);

      setPendingQuestions((prev) => Math.max(0, prev - 1));

      // Callback para componente pai
      if (onAnswerProvided) {
        onAnswerProvided(questionId, answer);
      }

      toast({
        title: "Resposta salva",
        description: "A IA vai usar essa informação nas próximas classificações",
      });
    } catch (error) {
      console.error("Erro ao responder pergunta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a resposta",
        variant: "destructive",
      });
    }
  };

  const getSimulatedResponse = (question: string, agent: AIAgent): string => {
    // Respostas simuladas baseadas no agente
    const responses: Record<string, string[]> = {
      cicero: [
        "De acordo com as normas NBC/CFC, essa operação deve ser classificada corretamente no plano de contas.",
        "Vou verificar o tratamento contábil adequado para essa situação.",
        "Essa transação precisa de um lançamento de débito e crédito balanceado.",
      ],
      milton: [
        "Do ponto de vista financeiro, precisamos analisar o impacto no fluxo de caixa.",
        "Vou calcular os indicadores relevantes para essa operação.",
        "Essa despesa deve ser alocada ao centro de custo correto.",
      ],
      helena: [
        "Vou verificar se essa operação está alinhada com as metas da empresa.",
        "Precisamos avaliar o impacto dessa decisão nos processos.",
        "Sugiro documentarmos essa informação para futura referência.",
      ],
      atlas: [
        "Vou aprender esse padrão para classificações futuras.",
        "Salvei essa informação na minha base de conhecimento.",
        "Nas próximas vezes, vou usar essa classificação automaticamente.",
      ],
    };

    const agentResponses = responses[agent.id] || responses.atlas;
    return agentResponses[Math.floor(Math.random() * agentResponses.length)];
  };

  const AgentAvatar = ({ agent }: { agent: AIAgent }) => {
    const Icon = agent.icon;
    return (
      <div className={`p-1.5 rounded-full ${agent.bgColor} flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${agent.color}`} />
      </div>
    );
  };

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Assistente IA
            </span>
            {pendingQuestions > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingQuestions} pendente{pendingQuestions > 1 ? "s" : ""}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ChatContent
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            onSend={handleSendMessage}
            onAnswer={handleAnswerQuestion}
            scrollRef={scrollRef}
            compact
          />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card className={`${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-medium">Assistente IA</span>
              </div>
              <div className="flex items-center gap-2">
                {pendingQuestions > 0 && (
                  <Badge variant="destructive">
                    {pendingQuestions} pergunta{pendingQuestions > 1 ? "s" : ""}
                  </Badge>
                )}
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ChatContent
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            onSend={handleSendMessage}
            onAnswer={handleAnswerQuestion}
            scrollRef={scrollRef}
          />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Componente interno para o conteúdo do chat
interface ChatContentProps {
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  onSend: () => void;
  onAnswer: (questionId: string, answer: string) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  compact?: boolean;
}

function ChatContent({
  messages,
  inputValue,
  setInputValue,
  isLoading,
  onSend,
  onAnswer,
  scrollRef,
  compact = false,
}: ChatContentProps) {
  const [customAnswer, setCustomAnswer] = useState<Record<string, string>>({});

  return (
    <>
      <CardContent className={compact ? "p-2" : "p-4"}>
        <ScrollArea
          className={`${compact ? "h-48" : "h-64"} pr-4`}
          ref={scrollRef}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm text-center">
                A equipe de IA está pronta para ajudar.
                <br />
                Faça uma pergunta ou aguarde perguntas deles.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${
                    message.isUser ? "flex-row-reverse" : ""
                  }`}
                >
                  {message.isUser ? (
                    <div className="p-1.5 rounded-full bg-primary/10 flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    message.agent && <AgentAvatar agent={message.agent} />
                  )}
                  <div
                    className={`flex-1 ${message.isUser ? "text-right" : ""}`}
                  >
                    {!message.isUser && message.agent && (
                      <span className="text-xs font-medium text-muted-foreground">
                        {message.agent.name}
                      </span>
                    )}
                    <div
                      className={`rounded-lg p-2 text-sm ${
                        message.isUser
                          ? "bg-primary text-primary-foreground ml-8"
                          : "bg-muted mr-8"
                      } ${message.answered ? "opacity-60" : ""}`}
                    >
                      {message.content}
                      {message.answered && (
                        <CheckCircle className="h-3 w-3 inline ml-1 text-green-500" />
                      )}
                    </div>

                    {/* Opções de resposta rápida para perguntas da IA */}
                    {!message.isUser &&
                      message.questionId &&
                      !message.answered &&
                      message.options &&
                      message.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {message.options.map((option, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                onAnswer(message.questionId!, option)
                              }
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      )}

                    {/* Campo para resposta customizada */}
                    {!message.isUser &&
                      message.questionId &&
                      !message.answered && (
                        <div className="flex gap-1 mt-2">
                          <Input
                            placeholder="Ou digite sua resposta..."
                            className="text-xs h-7"
                            value={customAnswer[message.questionId] || ""}
                            onChange={(e) =>
                              setCustomAnswer((prev) => ({
                                ...prev,
                                [message.questionId!]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                customAnswer[message.questionId!]
                              ) {
                                onAnswer(
                                  message.questionId!,
                                  customAnswer[message.questionId!]
                                );
                                setCustomAnswer((prev) => ({
                                  ...prev,
                                  [message.questionId!]: "",
                                }));
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2"
                            disabled={!customAnswer[message.questionId]}
                            onClick={() => {
                              if (customAnswer[message.questionId!]) {
                                onAnswer(
                                  message.questionId!,
                                  customAnswer[message.questionId!]
                                );
                                setCustomAnswer((prev) => ({
                                  ...prev,
                                  [message.questionId!]: "",
                                }));
                              }
                            }}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="p-1.5 rounded-full bg-muted flex-shrink-0">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-2 text-sm text-muted-foreground">
                    Pensando...
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className={compact ? "p-2 pt-0" : "p-4 pt-0"}>
        <div className="flex gap-2 w-full">
          <Input
            placeholder="Digite sua pergunta..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            disabled={isLoading}
            className={compact ? "h-8 text-sm" : ""}
          />
          <Button
            size={compact ? "sm" : "default"}
            onClick={onSend}
            disabled={isLoading || !inputValue.trim()}
          >
            <Send className={`${compact ? "h-3 w-3" : "h-4 w-4"}`} />
          </Button>
        </div>
      </CardFooter>
    </>
  );
}

// Componente auxiliar para Avatar do Agente (usado internamente)
function AgentAvatar({ agent }: { agent: AIAgent }) {
  const Icon = agent.icon;
  return (
    <div className={`p-1.5 rounded-full ${agent.bgColor} flex-shrink-0`}>
      <Icon className={`h-4 w-4 ${agent.color}`} />
    </div>
  );
}

export default AIAssistantChat;
