import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Scale,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  BookOpen,
  FileText,
  Users,
  Bot,
  Lightbulb,
  ArrowRight,
  Shield,
  Gavel,
  Briefcase,
  MessageSquare,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LaborSolution {
  id: string;
  code: string;
  name: string;
  description: string;
  risk_types: string[];
  legal_basis: string[];
  implementation_steps: string[];
  requirements: string[];
  warnings: string[];
  estimated_cost: string | null;
  effectiveness_rating: number;
  complexity: string;
  time_to_implement: string | null;
}

interface Legislation {
  id: string;
  code: string;
  article: string | null;
  title: string;
  content: string;
  interpretation: string | null;
  keywords: string[];
}

interface Jurisprudence {
  id: string;
  court: string;
  case_number: string | null;
  decision_date: string | null;
  summary: string;
  outcome: string;
  risk_type: string | null;
  key_arguments: string[];
  relevance_score: number;
}

interface Consultation {
  id: string;
  person_type: string;
  person_name: string;
  risk_identified: string;
  risk_severity: string;
  solutions_suggested: string[];
  ai_recommendation: string;
  jurisprudence_cited: string[];
  created_at: string;
}

const LaborAdvisory = () => {
  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [consulting, setConsulting] = useState(false);

  // Estados de dados principais
  const [solutions, setSolutions] = useState<LaborSolution[]>([]);
  const [legislation, setLegislation] = useState<Legislation[]>([]);
  const [jurisprudence, setJurisprudence] = useState<Jurisprudence[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRiskType, setSelectedRiskType] = useState<string>("all");
  const [consultQuestion, setConsultQuestion] = useState("");
  const [consultContext, setConsultContext] = useState("");
  const [consultResponse, setConsultResponse] = useState<string | null>(null);

  // Estados de diálogos
  const [showConsultDialog, setShowConsultDialog] = useState(false);

  const riskTypes = [
    { value: "all", label: "Todos os riscos" },
    { value: "vinculo_trabalhista", label: "Vinculo Trabalhista" },
    { value: "pagamento_nao_registrado", label: "Pagamento por Fora" },
    { value: "terceirizacao", label: "Terceirizacao" },
    { value: "diarista", label: "Diarista/Domestica" },
  ];

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadData = async () => {
    setLoading(true);
    try {
      // Load solutions
      const { data: solutionsData, error: solutionsError } = await supabase
        .from("labor_solution_strategies")
        .select("*")
        .order("effectiveness_rating", { ascending: false });

      if (!solutionsError) setSolutions(solutionsData || []);

      // Load legislation
      const { data: legislationData, error: legislationError } = await supabase
        .from("labor_legislation")
        .select("*")
        .order("code", { ascending: true });

      if (!legislationError) setLegislation(legislationData || []);

      // Load jurisprudence
      const { data: jurisprudenceData, error: jurisprudenceError } = await supabase
        .from("labor_jurisprudence")
        .select("*")
        .order("relevance_score", { ascending: false })
        .limit(50);

      if (!jurisprudenceError) setJurisprudence(jurisprudenceData || []);

      // Load recent consultations
      const { data: consultationsData, error: consultationsError } = await supabase
        .from("ai_labor_consultations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!consultationsError) setConsultations(consultationsData || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleConsultation = async () => {
    if (!consultQuestion.trim()) {
      toast.error("Digite sua pergunta");
      return;
    }

    setConsulting(true);
    setConsultResponse(null);

    try {
      // For now, simulate a response since we don't have the AI function yet
      // In production, this would call a Supabase Edge Function
      await new Promise(resolve => setTimeout(resolve, 2000));

      setConsultResponse(`
**Dr. Advocato analisa:**

Com base na sua pergunta sobre "${consultQuestion.substring(0, 50)}...", posso orientar:

1. **Fundamentacao Legal:**
   - Art. 3 da CLT define os requisitos para vinculo empregaticio
   - A Reforma Trabalhista (Lei 13.467/2017) flexibilizou algumas regras

2. **Riscos Identificados:**
   - Possivel caracterizacao de vinculo se houver subordinacao
   - Pagamentos nao registrados geram passivo trabalhista

3. **Solucoes Sugeridas:**
   - Formalizacao via MEI para prestadores autonomos
   - Contrato de prestacao de servicos bem elaborado
   - Regularizacao gradual de pagamentos por fora

**Sr. Empresario complementa:**

Alem da visao juridica, sugiro estruturar a relacao de forma que:
- O prestador tenha autonomia real (horarios, metodos)
- Possa atender outros clientes
- Emita notas fiscais regularmente

*Esta e uma orientacao geral. Para casos especificos, consulte um advogado trabalhista.*
      `);

    } catch (error) {
      console.error("Error consulting:", error);
      toast.error("Erro na consulta");
    } finally {
      setConsulting(false);
    }
  };

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const getOutcomeBadge = (outcome: string) => {
    if (outcome === "favoravel_empresa") {
      return <Badge className="bg-green-100 text-green-800">Favoravel Empresa</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Favoravel Empregado</Badge>;
  };

  const getComplexityBadge = (complexity: string) => {
    switch (complexity) {
      case "baixa":
        return <Badge className="bg-green-100 text-green-800">Baixa</Badge>;
      case "media":
        return <Badge className="bg-yellow-100 text-yellow-800">Media</Badge>;
      case "alta":
        return <Badge className="bg-red-100 text-red-800">Alta</Badge>;
      default:
        return <Badge variant="outline">{complexity}</Badge>;
    }
  };

  const filteredSolutions = solutions.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedRiskType === "all" ||
      (s.risk_types && s.risk_types.includes(selectedRiskType));
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Consultoria Trabalhista</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Base de conhecimento juridico e solucoes para riscos trabalhistas
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-red-600">
              <Scale className="h-5 w-5" />
              <span className="text-sm font-medium">Dr. Advocato</span>
            </div>
            <div className="flex items-center gap-2 text-amber-600">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-medium">Sr. Empresario</span>
            </div>
          </div>
        </div>

        {/* Quick Consult Button */}
        <Card className="bg-gradient-to-r from-red-50 to-amber-50 border-red-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <MessageSquare className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    Consultar os Agentes
                  </h3>
                  <p className="text-sm text-gray-600">
                    Tire duvidas sobre situacoes trabalhistas especificas
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowConsultDialog(true)}>
                <Bot className="h-4 w-4 mr-2" />
                Iniciar Consulta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="solutions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="solutions">
              <Lightbulb className="h-4 w-4 mr-2" />
              Solucoes ({solutions.length})
            </TabsTrigger>
            <TabsTrigger value="legislation">
              <BookOpen className="h-4 w-4 mr-2" />
              Legislacao ({legislation.length})
            </TabsTrigger>
            <TabsTrigger value="jurisprudence">
              <Gavel className="h-4 w-4 mr-2" />
              Jurisprudencia ({jurisprudence.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <FileText className="h-4 w-4 mr-2" />
              Historico ({consultations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="solutions" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar solucao..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedRiskType} onValueChange={setSelectedRiskType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de risco" />
                </SelectTrigger>
                <SelectContent>
                  {riskTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Solutions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSolutions.map((solution) => (
                <Card key={solution.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{solution.name}</CardTitle>
                        <CardDescription>{solution.description}</CardDescription>
                      </div>
                      {getComplexityBadge(solution.complexity)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Risk Types */}
                    <div className="flex flex-wrap gap-1">
                      {solution.risk_types?.map((type, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {type.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>

                    {/* Legal Basis */}
                    {solution.legal_basis && solution.legal_basis.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          Base Legal:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {solution.legal_basis.map((basis, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {basis}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {solution.warnings && solution.warnings.length > 0 && (
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-amber-800">Atencao:</p>
                            <ul className="text-xs text-amber-700 mt-1 space-y-1">
                              {solution.warnings.slice(0, 2).map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Eficacia: {solution.effectiveness_rating}%</span>
                      </div>
                      {solution.time_to_implement && (
                        <span className="text-xs text-gray-500">
                          Prazo: {solution.time_to_implement}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="legislation" className="space-y-4">
            <div className="space-y-4">
              {legislation.map((leg) => (
                <Card key={leg.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{leg.code}</Badge>
                      {leg.article && (
                        <Badge variant="secondary">{leg.article}</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{leg.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 italic">
                        "{leg.content}"
                      </p>
                    </div>
                    {leg.interpretation && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Scale className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-blue-800">
                              Interpretacao pratica:
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                              {leg.interpretation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {leg.keywords && leg.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {leg.keywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="jurisprudence" className="space-y-4">
            <div className="space-y-4">
              {jurisprudence.map((jp) => (
                <Card key={jp.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{jp.court}</Badge>
                        {jp.case_number && (
                          <span className="text-xs text-gray-500">
                            {jp.case_number}
                          </span>
                        )}
                      </div>
                      {getOutcomeBadge(jp.outcome)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700">{jp.summary}</p>

                    {jp.key_arguments && jp.key_arguments.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Argumentos-chave:
                        </p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {jp.key_arguments.map((arg, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {arg}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t text-sm text-gray-500">
                      <span>Relevancia: {jp.relevance_score}/10</span>
                      {jp.decision_date && (
                        <span>
                          {new Date(jp.decision_date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {consultations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Nenhuma consulta registrada
                  </h3>
                  <p className="text-sm text-gray-500">
                    Inicie uma consulta com os agentes para ver o historico
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {consultations.map((consult) => (
                  <Card key={consult.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {consult.person_name}
                          </CardTitle>
                          <CardDescription>
                            {consult.risk_identified}
                          </CardDescription>
                        </div>
                        <Badge
                          className={cn(
                            consult.risk_severity === "critical"
                              ? "bg-red-100 text-red-800"
                              : consult.risk_severity === "warning"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          )}
                        >
                          {consult.risk_severity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700">
                        {consult.ai_recommendation}
                      </p>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-gray-500">
                        <span>
                          {new Date(consult.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <div className="flex gap-1">
                          {consult.solutions_suggested?.map((sol, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {sol}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Consultation Dialog */}
        <Dialog open={showConsultDialog} onOpenChange={setShowConsultDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Consulta com Dr. Advocato e Sr. Empresario
              </DialogTitle>
              <DialogDescription>
                Descreva sua situacao para receber orientacao juridica e estrategica
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sua pergunta</Label>
                <Textarea
                  placeholder="Ex: Tenho uma funcionaria que trabalha 3 dias por semana fazendo limpeza. Ela e autonoma ou precisa de carteira?"
                  value={consultQuestion}
                  onChange={(e) => setConsultQuestion(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Contexto adicional (opcional)</Label>
                <Textarea
                  placeholder="Ex: Ela trabalha ha 2 anos, sempre nos mesmos dias, recebe R$ 200 por dia..."
                  value={consultContext}
                  onChange={(e) => setConsultContext(e.target.value)}
                  rows={2}
                />
              </div>

              {consultResponse && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {consultResponse}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConsultDialog(false)}>
                Fechar
              </Button>
              <Button onClick={handleConsultation} disabled={consulting}>
                {consulting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Consulta
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default LaborAdvisory;
