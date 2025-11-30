import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Video,
  Tv,
  Play,
  Pause,
  Loader2,
  Plus,
  Sparkles,
  Clock,
  Calendar,
  Monitor,
  Film,
  Wand2,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Image as ImageIcon,
  Bot,
  MessageSquare,
  Send,
  Globe,
  Instagram,
  Lightbulb,
  Target,
  TrendingUp,
  Pencil,
  Trash2,
  MoreHorizontal,
  Power,
  PowerOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// Conhecimento da Ampla para os agentes (dados reais do site)
const AMPLA_KNOWLEDGE = {
  empresa: {
    nome: "Ampla Contabilidade",
    historia: "Mais de 30 anos de atuacao no mercado, escritorio moderno e completo",
    missao: "Fornecer informacoes e diferenciais competitivos, visando o desenvolvimento maximo de seus clientes. Detectar oportunidades, estabelecer metas, melhorar eficiencia e aumentar lucros.",
    site: "www.amplabusiness.com.br",
    instagram: "@amplacontabilidade",
    localizacao: "Goiania - GO",
    diferenciais: [
      "Mais de 30 anos de experiencia",
      "Cobertura multidisciplinar",
      "Servicos contabeis, juridicos e consultoria",
      "Jurisprudencias contemporaneas",
      "Clientes sempre atualizados",
    ],
    servicos: {
      departamental: [
        "Fiscal",
        "Departamento Pessoal",
        "Legalizacoes (Area Societaria)",
        "Servicos Contabeis gerais",
      ],
      consultoria: [
        "Planejamento estrategico e contabil",
        "Levantamento de recursos",
        "Reestruturacao de processos",
      ],
      terceirizacao: [
        "Tesouraria e controladoria",
        "Controle patrimonial",
        "Administracao de RH e beneficios",
      ],
      juridico: [
        "Direito civil",
        "Direito trabalhista",
        "Direito tributario",
        "Direito empresarial",
        "Direito administrativo",
        "Direito previdenciario",
      ],
      especializado: [
        "Auditoria",
        "Analise de documentos",
        "Inspecoes",
      ],
    },
    publicoAlvo: [
      "Empresas de diversos segmentos",
      "Pequenas e medias empresas",
      "Startups",
      "Profissionais liberais",
    ],
  },
  tomsDeVoz: {
    principal: "Profissional, formal e corporativo",
    caracteristicas: [
      "Enfatiza expertise e especializacao",
      "Comprometimento com resultados empresariais",
      "Linguagem clara e estruturada",
      "Confiavel e solido (30+ anos)",
    ],
  },
  temasSugeridos: [
    { tema: "30 Anos de Historia", tipo: "institucional", descricao: "Celebrar a trajetoria e experiencia" },
    { tema: "Equipe Multidisciplinar", tipo: "institucional", descricao: "Mostrar a diversidade de especialistas" },
    { tema: "Consultoria Estrategica", tipo: "informativo", descricao: "Destacar o diferencial consultivo" },
    { tema: "Direito e Contabilidade", tipo: "informativo", descricao: "Mostrar a integracao juridico-contabil" },
    { tema: "Resultados que Transformam", tipo: "motivacional", descricao: "Cases de sucesso e crescimento" },
  ],
  datasImportantes: [
    { data: "Janeiro", tema: "IRPF - Preparacao para declaracao" },
    { data: "Abril", tema: "Entrega IRPF - Ultimos dias" },
    { data: "Maio", tema: "Dia do Trabalho - Valorizacao da equipe" },
    { data: "Junho", tema: "IRPJ trimestral" },
    { data: "Setembro", tema: "Dia do Contador - 30 anos de Ampla!" },
    { data: "Novembro", tema: "13o salario - 1a parcela" },
    { data: "Dezembro", tema: "Planejamento para novo ano" },
  ],
};

interface VideoContent {
  id: string;
  title: string;
  description: string | null;
  video_type: string;
  prompt: string | null;
  status: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  scheduled_for: string | null;
  target_screens: string[];
  generated_by: string | null;
  created_at: string;
}

interface TVScreen {
  id: string;
  name: string;
  location: string;
  resolution: string;
  is_active: boolean;
  current_content_id: string | null;
}

const videoTypes = [
  { value: "informativo", label: "Informativo", description: "Dicas contabeis e fiscais" },
  { value: "motivacional", label: "Motivacional", description: "Mensagens para equipe e clientes" },
  { value: "institucional", label: "Institucional", description: "Sobre a Ampla" },
  { value: "tutorial", label: "Tutorial", description: "Como usar servicos" },
  { value: "sazonal", label: "Sazonal", description: "Datas comemorativas" },
];

// Sugestões automáticas baseadas no conhecimento real da Ampla (30+ anos)
const AI_VIDEO_SUGGESTIONS = [
  {
    id: "1",
    titulo: "30 Anos Transformando Negocios",
    tipo: "institucional",
    descricao: "Celebracao da trajetoria de 30 anos da Ampla",
    prompt: "Montagem cinematografica mostrando evolucao de 30 anos: escritorio dos anos 90 com papeis e maquinas de escrever, transicao suave para escritorio moderno com tecnologia, graficos de crescimento, equipe celebrando, numero 30 aparecendo em dourado, ambiente corporativo de Goiania, tom nostalgico mas triunfante",
    duracao: "12s",
    telas: ["Recepcao", "Sala de Espera"],
    prioridade: "alta",
    motivacao: "Destacar a solidez e experiencia da empresa",
  },
  {
    id: "2",
    titulo: "Equipe Multidisciplinar",
    tipo: "institucional",
    descricao: "Mostrar os diversos especialistas: contabil, juridico, fiscal, DP",
    prompt: "Mosaico de especialistas trabalhando: advogado revisando contratos, contador analisando balanco, profissional de DP com documentos trabalhistas, fiscal verificando notas, todos em ambiente moderno de Goiania, transicao suave entre cada especialidade, cores corporativas azul, sensacao de competencia e integracao",
    duracao: "10s",
    telas: ["Sala de Reuniao", "Recepcao"],
    prioridade: "alta",
    motivacao: "A Ampla oferece servicos contabeis, juridicos e consultoria integrados",
  },
  {
    id: "3",
    titulo: "Consultoria Estrategica",
    tipo: "informativo",
    descricao: "Diferencial consultivo da Ampla",
    prompt: "Reuniao estrategica em sala moderna, consultor apresentando graficos em tela grande, empresario tendo momento de insight, graficos de planejamento e metas aparecendo, ambiente profissional de Goiania, transicao para resultados positivos, tom executivo e inspirador",
    duracao: "8s",
    telas: ["Sala de Espera"],
    prioridade: "alta",
    motivacao: "Destacar planejamento estrategico e reestruturacao de processos",
  },
  {
    id: "4",
    titulo: "Direito Empresarial + Contabilidade",
    tipo: "informativo",
    descricao: "Integracao unica juridico-contabil",
    prompt: "Divisao de tela elegante: de um lado advogado com codigo, do outro contador com numeros, linhas conectando os dois lados simbolizando integracao, fusao visual formando solucao completa, cores azul corporativo, balanca da justica e calculadora se unindo",
    duracao: "6s",
    telas: ["Todas"],
    prioridade: "media",
    motivacao: "A Ampla oferece direito civil, trabalhista, tributario, empresarial integrado",
  },
  {
    id: "5",
    titulo: "BPO Financeiro Completo",
    tipo: "informativo",
    descricao: "Terceirizacao de tesouraria, controladoria, RH",
    prompt: "Fluxo visual mostrando processos financeiros sendo executados por equipe especializada: pagamentos, controle patrimonial, folha de pagamento, tudo fluindo harmoniosamente, empresario tranquilo focando no core business, ambiente tecnologico e organizado",
    duracao: "8s",
    telas: ["Sala de Reuniao"],
    prioridade: "media",
    motivacao: "Terceirizacao de tesouraria, controladoria e RH",
  },
  {
    id: "6",
    titulo: "Resultados que Transformam",
    tipo: "motivacional",
    descricao: "Missao da Ampla em acao",
    prompt: "Empresario preocupado olhando numeros negativos, transicao para reuniao com consultores Ampla, graficos virando positivos, empresario sorrindo com resultados, celebracao sutil, frase aparecendo: desenvolvimento maximo de seus clientes, tom esperancoso e profissional",
    duracao: "10s",
    telas: ["Sala de Espera", "Recepcao"],
    prioridade: "alta",
    motivacao: "Missao: desenvolvimento maximo dos clientes",
  },
];

// Chat messages type
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const promptTemplates = [
  {
    type: "informativo",
    templates: [
      "Video corporativo mostrando um contador moderno explicando impostos de forma didatica, ambiente de escritorio profissional",
      "Animacao grafica mostrando o fluxo de dinheiro em uma empresa, com numeros e graficos flutuando",
      "Time-lapse de um escritorio de contabilidade trabalhando, documentos sendo organizados",
    ],
  },
  {
    type: "motivacional",
    templates: [
      "Cena inspiradora de profissionais celebrando resultados, graficos subindo, ambiente corporativo alegre",
      "Nascer do sol sobre uma cidade, transicao para escritorio moderno, equipe colaborando",
      "Mosaico de pequenas empresas prosperando, donos sorrindo, movimento comercial",
    ],
  },
  {
    type: "institucional",
    templates: [
      "Fachada moderna de escritorio de contabilidade, transicao para equipe trabalhando, tecnologia e pessoas",
      "Drone sobrevoando Goiania, zoom em edificio comercial, escritorio tecnologico",
      "Historia visual: do papel a era digital, evolucao da contabilidade com tecnologia",
    ],
  },
];

const VideoContent = () => {
  const [videos, setVideos] = useState<VideoContent[]>([]);
  const [screens, setScreens] = useState<TVScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  // New video form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState("informativo");
  const [newPrompt, setNewPrompt] = useState("");
  const [newTargetScreens, setNewTargetScreens] = useState<string[]>([]);

  // CRUD states
  const [editingVideo, setEditingVideo] = useState<VideoContent | null>(null);
  const [showDeleteVideoDialog, setShowDeleteVideoDialog] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoContent | null>(null);
  const [showScreenDialog, setShowScreenDialog] = useState(false);
  const [editingScreen, setEditingScreen] = useState<TVScreen | null>(null);
  const [showDeleteScreenDialog, setShowDeleteScreenDialog] = useState(false);
  const [screenToDelete, setScreenToDelete] = useState<TVScreen | null>(null);
  const [saving, setSaving] = useState(false);

  // Screen form
  const [screenForm, setScreenForm] = useState({
    name: "",
    location: "",
    resolution: "1920x1080",
    is_active: true,
  });

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Ola! Sou o agente de conteudo da Ampla. Conheco bem a empresa:

**${AMPLA_KNOWLEDGE.empresa.nome}** - ${AMPLA_KNOWLEDGE.empresa.historia}

**Missao:** ${AMPLA_KNOWLEDGE.empresa.missao}

**Diferenciais:**
${AMPLA_KNOWLEDGE.empresa.diferenciais.map(d => `- ${d}`).join('\n')}

Posso sugerir videos baseados nos servicos da Ampla (contabil, juridico, consultoria, BPO) ou em datas importantes.

Como posso ajudar?`,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load videos (tabela criada via migration)
      const { data: videosData, error: videosError } = await (supabase
        .from("video_content" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);

      if (!videosError) setVideos((videosData as VideoContent[]) || []);

      // Load screens (tabela criada via migration)
      const { data: screensData, error: screensError } = await (supabase
        .from("tv_screens" as any)
        .select("*")
        .order("location", { ascending: true }) as any);

      if (!screensError) setScreens((screensData as TVScreen[]) || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!newTitle.trim()) {
      toast.error("Titulo e obrigatorio");
      return;
    }

    if (!newPrompt.trim()) {
      toast.error("Prompt e obrigatorio para geracao");
      return;
    }

    setGenerating(true);

    try {
      // Insert video record with pending status
      const { error } = await (supabase
        .from("video_content" as any)
        .insert({
          title: newTitle,
          description: newDescription,
          video_type: newType,
          prompt: newPrompt,
          status: "generating",
          target_screens: newTargetScreens,
          generated_by: "sora-2",
        })
        .select()
        .single() as any);

      if (error) throw error;

      toast.success("Video adicionado a fila de geracao!");

      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewType("informativo");
      setNewPrompt("");
      setNewTargetScreens([]);
      setShowNewDialog(false);

      // In production, this would trigger an Edge Function to call OpenAI Sora
      // For now, we simulate the generation
      setTimeout(() => {
        loadData();
      }, 2000);

    } catch (error) {
      console.error("Error creating video:", error);
      toast.error("Erro ao criar video");
    } finally {
      setGenerating(false);
    }
  };

  const selectTemplate = (template: string) => {
    setNewPrompt(template);
    toast.success("Template aplicado!");
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    // Simulate AI response based on user input
    setTimeout(() => {
      let response = "";
      const input = chatInput.toLowerCase();

      if (input.includes("30 anos") || input.includes("historia") || input.includes("aniversario")) {
        response = `Otima ideia celebrar os 30 anos da Ampla!

**Sugestao de video:** "${AI_VIDEO_SUGGESTIONS[0].titulo}"

**Prompt:** ${AI_VIDEO_SUGGESTIONS[0].prompt}

**Duracao:** ${AI_VIDEO_SUGGESTIONS[0].duracao}
**Telas:** ${AI_VIDEO_SUGGESTIONS[0].telas.join(", ")}

Quer que eu gere este video?`;
      } else if (input.includes("juridico") || input.includes("advogado") || input.includes("direito")) {
        response = `A Ampla tem um diferencial incrivel: integracao juridico-contabil!

Oferecemos: ${AMPLA_KNOWLEDGE.empresa.servicos.juridico.join(", ")}.

**Sugestao de video:** "${AI_VIDEO_SUGGESTIONS[3].titulo}"

**Prompt:** ${AI_VIDEO_SUGGESTIONS[3].prompt}

Este video mostraria a integracao unica entre direito e contabilidade!`;
      } else if (input.includes("equipe") || input.includes("especialista") || input.includes("profissional")) {
        response = `A equipe multidisciplinar e um dos grandes diferenciais da Ampla!

Temos especialistas em:
- Contabil e Fiscal
- Departamento Pessoal
- Area Juridica
- Consultoria Estrategica
- BPO Financeiro

**Sugestao:** "${AI_VIDEO_SUGGESTIONS[1].titulo}"

Posso criar um video mostrando cada especialidade em acao!`;
      } else if (input.includes("bpo") || input.includes("terceiriz") || input.includes("outsourc")) {
        response = `O BPO da Ampla e completo!

Oferecemos: ${AMPLA_KNOWLEDGE.empresa.servicos.terceirizacao.join(", ")}.

**Sugestao de video:** "${AI_VIDEO_SUGGESTIONS[4].titulo}"

Mostraria como o empresario pode focar no negocio enquanto cuidamos das financas!`;
      } else if (input.includes("gerar") || input.includes("criar") || input.includes("fazer")) {
        response = `Claro! Para gerar um video:

1. Escolha uma das sugestoes que fiz
2. Clique em "Usar Sugestao"
3. Ajuste o prompt se desejar
4. Clique em "Gerar Video"

O Sora 2 criara um video profissional de 5-12 segundos!

Qual tema te interessa mais?`;
      } else {
        response = `Baseado nos servicos da Ampla, posso sugerir videos sobre:

1. **Institucional** - 30 anos de historia, equipe, valores
2. **Juridico** - Integracao unica direito + contabilidade
3. **BPO** - Terceirizacao financeira completa
4. **Consultoria** - Planejamento estrategico

Ou diga uma data importante (IRPF, 13o, etc) que crio um video sazonal!

Sobre qual tema quer um video?`;
      }

      setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setChatLoading(false);
    }, 1500);
  };

  const handleSuggestion = (suggestion: typeof AI_VIDEO_SUGGESTIONS[0]) => {
    setNewTitle(suggestion.titulo);
    setNewDescription(suggestion.descricao);
    setNewType(suggestion.tipo);
    setNewPrompt(suggestion.prompt);
    setShowNewDialog(true);
    toast.success("Sugestao aplicada! Ajuste e gere o video.");
  };

  // Video CRUD functions
  const openEditVideo = (video: VideoContent) => {
    setEditingVideo(video);
    setNewTitle(video.title);
    setNewDescription(video.description || "");
    setNewType(video.video_type);
    setNewPrompt(video.prompt || "");
    setNewTargetScreens(video.target_screens || []);
    setShowNewDialog(true);
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;
    setSaving(true);
    try {
      const { error } = await (supabase
        .from("video_content" as any)
        .delete()
        .eq("id", videoToDelete.id) as any);

      if (error) throw error;
      toast.success("Video excluido com sucesso!");
      setShowDeleteVideoDialog(false);
      setVideoToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Erro ao excluir video");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteVideo = (video: VideoContent) => {
    setVideoToDelete(video);
    setShowDeleteVideoDialog(true);
  };

  // Screen CRUD functions
  const resetScreenForm = () => {
    setScreenForm({
      name: "",
      location: "",
      resolution: "1920x1080",
      is_active: true,
    });
    setEditingScreen(null);
  };

  const openCreateScreen = () => {
    resetScreenForm();
    setShowScreenDialog(true);
  };

  const openEditScreen = (screen: TVScreen) => {
    setEditingScreen(screen);
    setScreenForm({
      name: screen.name,
      location: screen.location,
      resolution: screen.resolution,
      is_active: screen.is_active,
    });
    setShowScreenDialog(true);
  };

  const handleSaveScreen = async () => {
    if (!screenForm.name.trim()) {
      toast.error("Nome da TV e obrigatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingScreen) {
        const { error } = await (supabase
          .from("tv_screens" as any)
          .update({
            name: screenForm.name,
            location: screenForm.location,
            resolution: screenForm.resolution,
            is_active: screenForm.is_active,
          })
          .eq("id", editingScreen.id) as any);

        if (error) throw error;
        toast.success("TV atualizada com sucesso!");
      } else {
        const { error } = await (supabase
          .from("tv_screens" as any)
          .insert({
            name: screenForm.name,
            location: screenForm.location,
            resolution: screenForm.resolution,
            is_active: screenForm.is_active,
          }) as any);

        if (error) throw error;
        toast.success("TV cadastrada com sucesso!");
      }
      setShowScreenDialog(false);
      resetScreenForm();
      loadData();
    } catch (error) {
      console.error("Error saving screen:", error);
      toast.error("Erro ao salvar TV");
    } finally {
      setSaving(false);
    }
  };

  const toggleScreenStatus = async (screen: TVScreen) => {
    setSaving(true);
    try {
      const { error } = await (supabase
        .from("tv_screens" as any)
        .update({ is_active: !screen.is_active })
        .eq("id", screen.id) as any);

      if (error) throw error;
      toast.success(screen.is_active ? "TV desativada!" : "TV ativada!");
      loadData();
    } catch (error) {
      console.error("Error toggling screen:", error);
      toast.error("Erro ao alterar status da TV");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScreen = async () => {
    if (!screenToDelete) return;
    setSaving(true);
    try {
      const { error } = await (supabase
        .from("tv_screens" as any)
        .delete()
        .eq("id", screenToDelete.id) as any);

      if (error) throw error;
      toast.success("TV excluida com sucesso!");
      setShowDeleteScreenDialog(false);
      setScreenToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting screen:", error);
      toast.error("Erro ao excluir TV");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteScreen = (screen: TVScreen) => {
    setScreenToDelete(screen);
    setShowDeleteScreenDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-green-100 text-green-800">Pronto</Badge>;
      case "generating":
        return <Badge className="bg-blue-100 text-blue-800">Gerando...</Badge>;
      case "scheduled":
        return <Badge className="bg-purple-100 text-purple-800">Agendado</Badge>;
      case "playing":
        return <Badge className="bg-amber-100 text-amber-800">Em exibicao</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentTemplates = promptTemplates.find(p => p.type === newType)?.templates || [];

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Videos e TVs</h1>
            <p className="text-sm text-gray-500">
              Geracao de conteudo com IA e gestao das TVs do escritorio
            </p>
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar Novo Video
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Videos Gerados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">{videos.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                TVs Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Tv className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">
                  {screens.filter(s => s.is_active).length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Em Geracao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                <span className="text-2xl font-bold">
                  {videos.filter(v => v.status === "generating").length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Em Exibicao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">
                  {videos.filter(v => v.status === "playing").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="ai-suggestions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ai-suggestions">
              <Bot className="h-4 w-4 mr-2" />
              Sugestoes IA
            </TabsTrigger>
            <TabsTrigger value="videos">
              <Film className="h-4 w-4 mr-2" />
              Biblioteca ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="screens">
              <Monitor className="h-4 w-4 mr-2" />
              TVs ({screens.length})
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Calendar className="h-4 w-4 mr-2" />
              Programacao
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-suggestions" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chat Section */}
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    Converse com a IA
                  </CardTitle>
                  <CardDescription>
                    Pergunte sobre videos para a Ampla
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg max-w-[85%] whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-blue-600 text-white ml-auto"
                          : "bg-gray-100 text-gray-800"
                      )}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Pensando...
                    </div>
                  )}
                </CardContent>
                <div className="border-t p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleChatSend();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Pergunte sobre videos..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <Button type="submit" disabled={chatLoading}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </Card>

              {/* AI Suggestions Section */}
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                    Sugestoes Automaticas
                  </CardTitle>
                  <CardDescription>
                    Baseadas nos servicos da Ampla
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {AI_VIDEO_SUGGESTIONS.map((suggestion) => (
                    <Card
                      key={suggestion.id}
                      className={cn(
                        "cursor-pointer hover:border-blue-300 transition-colors",
                        suggestion.prioridade === "alta" && "border-l-4 border-l-amber-500"
                      )}
                      onClick={() => handleSuggestion(suggestion)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">{suggestion.titulo}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{suggestion.tipo}</Badge>
                            <Badge variant="secondary">{suggestion.duracao}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{suggestion.descricao}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Target className="h-3 w-3" />
                          <span>{suggestion.telas.join(", ")}</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {suggestion.motivacao}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
                <div className="border-t p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Globe className="h-4 w-4" />
                    <span>Dados: {AMPLA_KNOWLEDGE.empresa.site}</span>
                    <Instagram className="h-4 w-4 ml-2" />
                    <span>{AMPLA_KNOWLEDGE.empresa.instagram}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Knowledge Base Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Base de Conhecimento da IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Servicos Principais</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {AMPLA_KNOWLEDGE.empresa.servicos.departamental.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Area Juridica</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {AMPLA_KNOWLEDGE.empresa.servicos.juridico.slice(0, 4).map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Datas Importantes</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {AMPLA_KNOWLEDGE.datasImportantes.slice(0, 4).map((d, i) => (
                        <li key={i}>• {d.data}: {d.tema}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="videos" className="space-y-4">
            {videos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Nenhum video gerado ainda
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Use o Sora 2 para criar videos incriveis para suas TVs
                  </p>
                  <Button onClick={() => setShowNewDialog(true)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar Primeiro Video
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video) => (
                  <Card key={video.id} className="overflow-hidden">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-100">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {video.status === "generating" ? (
                            <Loader2 className="h-12 w-12 text-gray-300 animate-spin" />
                          ) : (
                            <Film className="h-12 w-12 text-gray-300" />
                          )}
                        </div>
                      )}

                      {/* Duration */}
                      {video.duration_seconds && (
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {formatDuration(video.duration_seconds)}
                        </div>
                      )}

                      {/* Play overlay */}
                      {video.status === "ready" && (
                        <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button size="lg" variant="secondary" className="rounded-full">
                            <Play className="h-6 w-6" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium line-clamp-1">{video.title}</h3>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(video.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditVideo(video)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => confirmDeleteVideo(video)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {video.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                          {video.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Wand2 className="h-3 w-3" />
                          <span>{video.generated_by || "Manual"}</span>
                        </div>
                        <span>
                          {new Date(video.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="screens" className="space-y-4">
            {/* Add TV Button */}
            <div className="flex justify-end">
              <Button onClick={openCreateScreen}>
                <Plus className="h-4 w-4 mr-2" />
                Nova TV
              </Button>
            </div>

            {screens.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Tv className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Nenhuma TV cadastrada
                  </h3>
                  <p className="text-sm text-gray-500">
                    Cadastre as TVs do escritorio para exibir videos
                  </p>
                  <Button onClick={openCreateScreen} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar TV
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {screens.map((screen) => (
                  <Card key={screen.id} className={cn(
                    "border-l-4",
                    screen.is_active ? "border-l-green-500" : "border-l-gray-300"
                  )}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Monitor className="h-5 w-5" />
                          {screen.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={screen.is_active ? "default" : "secondary"}>
                            {screen.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditScreen(screen)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleScreenStatus(screen)}>
                                {screen.is_active ? (
                                  <>
                                    <PowerOff className="h-4 w-4 mr-2" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <Power className="h-4 w-4 mr-2" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => confirmDeleteScreen(screen)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <CardDescription>{screen.location}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-gray-500">
                        <div className="flex justify-between">
                          <span>Resolucao:</span>
                          <span className="font-medium">{screen.resolution}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Conteudo atual:</span>
                          <span className="font-medium">
                            {screen.current_content_id ? "Em exibicao" : "Sem conteudo"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Programacao das TVs</CardTitle>
                <CardDescription>
                  Configure a grade de exibicao dos videos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Programacao em desenvolvimento</p>
                  <p className="text-sm">Em breve voce podera agendar videos para horarios especificos</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* New Video Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Gerar Novo Video com IA
              </DialogTitle>
              <DialogDescription>
                Use o OpenAI Sora 2 para criar videos profissionais automaticamente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Titulo *</Label>
                  <Input
                    placeholder="Ex: Dicas de IRPJ 2025"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Video</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {videoTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  placeholder="Descreva o conteudo do video..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Prompt para o Sora 2 *</Label>
                <Textarea
                  placeholder="Descreva a cena que voce quer gerar... Ex: Video corporativo mostrando um contador moderno explicando impostos de forma didatica"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Templates */}
              {currentTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Templates sugeridos:</Label>
                  <div className="space-y-2">
                    {currentTemplates.map((template, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start h-auto py-2 px-3 text-left"
                        onClick={() => selectTemplate(template)}
                      >
                        <Wand2 className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="text-xs line-clamp-2">{template}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Screens */}
              {screens.length > 0 && (
                <div className="space-y-2">
                  <Label>TVs de destino</Label>
                  <div className="flex flex-wrap gap-2">
                    {screens.filter(s => s.is_active).map((screen) => (
                      <Button
                        key={screen.id}
                        variant={newTargetScreens.includes(screen.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (newTargetScreens.includes(screen.id)) {
                            setNewTargetScreens(newTargetScreens.filter(id => id !== screen.id));
                          } else {
                            setNewTargetScreens([...newTargetScreens, screen.id]);
                          }
                        }}
                      >
                        <Monitor className="h-4 w-4 mr-1" />
                        {screen.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Notice */}
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-800">Custo de geracao</p>
                    <p className="text-xs text-amber-700">
                      Cada video de 5 segundos custa aproximadamente $0.40 USD (~R$ 2,00)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {editingVideo ? "Atualizar Video" : "Gerar Video"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* TV Screen Create/Edit Dialog */}
        <Dialog open={showScreenDialog} onOpenChange={setShowScreenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingScreen ? "Editar TV" : "Nova TV"}
              </DialogTitle>
              <DialogDescription>
                {editingScreen
                  ? "Atualize as informacoes da TV"
                  : "Cadastre uma nova TV do escritorio"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={screenForm.name}
                  onChange={(e) => setScreenForm({ ...screenForm, name: e.target.value })}
                  placeholder="Ex: TV Recepcao"
                />
              </div>
              <div className="space-y-2">
                <Label>Localizacao</Label>
                <Input
                  value={screenForm.location}
                  onChange={(e) => setScreenForm({ ...screenForm, location: e.target.value })}
                  placeholder="Ex: Sala de espera"
                />
              </div>
              <div className="space-y-2">
                <Label>Resolucao</Label>
                <Select
                  value={screenForm.resolution}
                  onValueChange={(v) => setScreenForm({ ...screenForm, resolution: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1920x1080">Full HD (1920x1080)</SelectItem>
                    <SelectItem value="3840x2160">4K (3840x2160)</SelectItem>
                    <SelectItem value="1280x720">HD (1280x720)</SelectItem>
                    <SelectItem value="1080x1920">Vertical FHD (1080x1920)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowScreenDialog(false);
                  resetScreenForm();
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveScreen} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editingScreen ? "Atualizar" : "Cadastrar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Video Confirmation Dialog */}
        <AlertDialog open={showDeleteVideoDialog} onOpenChange={setShowDeleteVideoDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Video</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir permanentemente "{videoToDelete?.title}"?
                Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteVideo}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700"
              >
                {saving ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Screen Confirmation Dialog */}
        <AlertDialog open={showDeleteScreenDialog} onOpenChange={setShowDeleteScreenDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir TV</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir permanentemente a TV "{screenToDelete?.name}"?
                Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteScreen}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700"
              >
                {saving ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default VideoContent;
