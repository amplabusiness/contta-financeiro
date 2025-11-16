import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Send, Loader2, TrendingUp, Calculator, FileCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AIAccountant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou seu Contador AI especializado em contabilidade brasileira. Posso ajudá-lo com:\n\n• Análise de transações bancárias\n• Sugestão de contas contábeis\n• Validação de lançamentos\n\nComo posso ajudar você hoje?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyze' | 'suggest' | 'validate'>('analyze');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-accountant-agent', {
        body: {
          type: activeTab === 'analyze' ? 'analyze_transaction' : 
                activeTab === 'suggest' ? 'suggest_accounts' : 'validate_entry',
          data: {
            description: input,
            amount: extractAmount(input),
            date: new Date().toISOString().split('T')[0],
            transaction_type: detectTransactionType(input),
          }
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.analysis,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Erro ao consultar Contador AI:', error);
      toast.error('Erro ao processar solicitação', {
        description: error.message
      });

      const errorMessage: Message = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const extractAmount = (text: string): number => {
    const match = text.match(/R?\$?\s*(\d+(?:\.\d{3})*(?:,\d{2})?)/);
    if (match) {
      return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    }
    return 0;
  };

  const detectTransactionType = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('recebi') || lowerText.includes('recebimento')) return 'credit';
    if (lowerText.includes('paguei') || lowerText.includes('pagamento')) return 'debit';
    return 'unknown';
  };

  const getQuickPrompts = () => {
    switch (activeTab) {
      case 'analyze':
        return [
          'Analisar: Recebi R$ 5.000,00 de honorários do cliente XYZ',
          'Analisar: Paguei R$ 1.200,00 de salário para funcionário',
          'Analisar: Transferência de R$ 3.000,00 entre contas bancárias'
        ];
      case 'suggest':
        return [
          'Sugerir contas para: Pagamento de aluguel do escritório',
          'Sugerir contas para: Receita de consultoria tributária',
          'Sugerir contas para: Compra de equipamento de informática'
        ];
      case 'validate':
        return [
          'Validar se débito em Caixa e crédito em Receitas está correto',
          'Verificar lançamento de pagamento de fornecedor',
          'Revisar partidas dobradas do último lançamento'
        ];
      default:
        return [];
    }
  };

  const useQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8" />
              Contador AI
            </h1>
            <p className="text-muted-foreground">
              Assistente inteligente para análise e validação contábil
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            Powered by Gemini 2.5 Flash
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analyze" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analisar Transação
            </TabsTrigger>
            <TabsTrigger value="suggest" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Sugerir Contas
            </TabsTrigger>
            <TabsTrigger value="validate" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Validar Lançamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {activeTab === 'analyze' && <><TrendingUp className="h-5 w-5" />Análise de Transações</>}
                  {activeTab === 'suggest' && <><Calculator className="h-5 w-5" />Sugestão de Contas</>}
                  {activeTab === 'validate' && <><FileCheck className="h-5 w-5" />Validação de Lançamentos</>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
                  <div className="space-y-4">
                    {messages.map((message, idx) => (
                      <div
                        key={idx}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {message.role === 'assistant' && (
                              <Bot className="h-5 w-5 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="space-y-2 flex-1">
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <p className="text-xs opacity-70">
                                {message.timestamp.toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg p-4 max-w-[80%]">
                          <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5" />
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Analisando...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Quick Prompts */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sugestões rápidas:</p>
                  <div className="flex flex-wrap gap-2">
                    {getQuickPrompts().map((prompt, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => useQuickPrompt(prompt)}
                        className="text-xs"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      activeTab === 'analyze'
                        ? 'Descreva a transação (ex: Recebi R$ 5.000,00 de honorários do cliente XYZ)...'
                        : activeTab === 'suggest'
                        ? 'Descreva a operação para receber sugestões de contas...'
                        : 'Descreva o lançamento para validação...'
                    }
                    className="flex-1 min-h-[80px] resize-none"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="self-end"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground">
                  Pressione Enter para enviar, Shift+Enter para nova linha
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AIAccountant;
