import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  GraduationCap, 
  BookOpen, 
  Search, 
  MessageCircle, 
  Lightbulb,
  FileText,
  History,
  Brain,
  HelpCircle,
  ArrowRight,
  Bookmark,
  Clock
} from "lucide-react";
import { EducatorPanel } from "@/components/EducatorPanel";
import { useEducatorExplanation, Explanation, ExplanationContext } from "@/hooks/useEducatorExplanation";

// Tópicos pré-definidos para aprendizado
const LEARNING_TOPICS = [
  {
    id: "partidas_dobradas",
    title: "Método das Partidas Dobradas",
    description: "Entenda o princípio fundamental da contabilidade",
    icon: BookOpen,
    context: {
      conceptName: "Partidas Dobradas",
      conceptType: "fundamentos",
      details: {
        principle: "Todo débito corresponde a um crédito de igual valor",
        formula: "ATIVO = PASSIVO + PATRIMÔNIO LÍQUIDO"
      }
    }
  },
  {
    id: "transitoria",
    title: "Contas Transitórias",
    description: "Como funciona o fluxo de importação e classificação",
    icon: ArrowRight,
    context: {
      conceptName: "Contas Transitórias",
      conceptType: "contas",
      details: {
        conta_debitos: "1.1.9.01 - Para saídas do banco",
        conta_creditos: "2.1.9.01 - Para entradas no banco",
        regra_ouro: "Ambas devem zerar ao final do período"
      }
    }
  },
  {
    id: "dre",
    title: "Demonstração do Resultado (DRE)",
    description: "Receitas, despesas e resultado do exercício",
    icon: FileText,
    context: {
      conceptName: "DRE - Demonstração do Resultado",
      conceptType: "relatorios",
      details: {
        estrutura: "Receitas - Despesas = Resultado",
        regime: "Competência (não caixa)"
      }
    }
  },
  {
    id: "conciliacao",
    title: "Conciliação Bancária",
    description: "Processo de conferir extrato vs contabilidade",
    icon: Brain,
    context: {
      conceptName: "Conciliação Bancária",
      conceptType: "processos",
      details: {
        objetivo: "Garantir que saldo contábil = saldo extrato",
        etapas: ["Importar OFX", "Classificar transações", "Verificar transitórias"]
      }
    }
  },
  {
    id: "plano_contas",
    title: "Plano de Contas",
    description: "Estrutura de classificação contábil",
    icon: Bookmark,
    context: {
      conceptName: "Plano de Contas",
      conceptType: "estrutura",
      details: {
        grupos: ["1-Ativo", "2-Passivo", "3-Receita", "4-Despesa", "5-PL"]
      }
    }
  }
];

// Perguntas frequentes
const FAQ_ITEMS = [
  {
    question: "Por que débito aumenta o ativo?",
    answer: "Na contabilidade, ativos têm natureza devedora. Quando você recebe dinheiro, está aumentando um ativo (Caixa/Banco), então debita."
  },
  {
    question: "Qual a diferença entre regime de caixa e competência?",
    answer: "Regime de caixa: registra quando o dinheiro entra/sai. Regime de competência: registra quando o fato gerador ocorre, independente do pagamento."
  },
  {
    question: "O que acontece se a transitória não zerar?",
    answer: "Significa que existem transações bancárias não classificadas. Cada transação importada do extrato precisa ser classificada para zerar a transitória."
  },
  {
    question: "Por que não posso editar lançamentos antigos?",
    answer: "Princípio contábil: lançamentos não devem ser alterados. Se errou, faça um lançamento de estorno e depois o correto."
  }
];

export default function EducatorPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<typeof LEARNING_TOPICS[0] | null>(null);
  const { explanation, loading, generateExplanation, clearExplanation } = useEducatorExplanation();

  const handleTopicSelect = (topic: typeof LEARNING_TOPICS[0]) => {
    setSelectedTopic(topic);
    generateExplanation({
      type: 'best_practice',
      transactionDescription: topic.title
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    generateExplanation({
      type: 'best_practice',
      transactionDescription: searchQuery
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <GraduationCap className="h-8 w-8 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agente Educador</h1>
            <p className="text-muted-foreground">
              Aprenda contabilidade de forma interativa com o Dr. Cícero
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-2">
          <Brain className="h-4 w-4" />
          Modo Aprendizado
        </Badge>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pergunte qualquer coisa sobre contabilidade... (ex: Por que débito aumenta ativo?)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Perguntar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Topics & FAQ */}
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="topics">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="topics">
                <BookOpen className="h-4 w-4 mr-2" />
                Tópicos
              </TabsTrigger>
              <TabsTrigger value="faq">
                <HelpCircle className="h-4 w-4 mr-2" />
                FAQ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="topics" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Tópicos de Aprendizado</CardTitle>
                  <CardDescription>
                    Selecione um tópico para começar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {LEARNING_TOPICS.map((topic) => {
                        const Icon = topic.icon;
                        const isSelected = selectedTopic?.id === topic.id;
                        
                        return (
                          <Button
                            key={topic.id}
                            variant={isSelected ? "secondary" : "ghost"}
                            className="w-full justify-start h-auto py-3"
                            onClick={() => handleTopicSelect(topic)}
                          >
                            <Icon className="h-5 w-5 mr-3 shrink-0" />
                            <div className="text-left">
                              <div className="font-medium">{topic.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {topic.description}
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faq" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Perguntas Frequentes</CardTitle>
                  <CardDescription>
                    Dúvidas comuns sobre contabilidade
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {FAQ_ITEMS.map((item, index) => (
                        <div key={index} className="border-b pb-4 last:border-0">
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-auto py-2 px-0 hover:bg-transparent"
                            onClick={() => generateExplanation({
                              type: 'best_practice',
                              transactionDescription: item.question
                            })}
                          >
                            <div className="text-left">
                              <div className="font-medium text-sm flex items-center gap-2">
                                <Lightbulb className="h-4 w-4 text-amber-500" />
                                {item.question}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 pl-6">
                                {item.answer.substring(0, 80)}...
                              </div>
                            </div>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Recent Learnings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Aprendizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground text-sm py-4">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Suas consultas recentes aparecerão aqui</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Explanation Panel */}
        <div className="lg:col-span-2">
          <EducatorPanel 
            loading={loading}
            explanation={explanation}
            onClose={clearExplanation}
          />
        </div>
      </div>
    </div>
  );
}
