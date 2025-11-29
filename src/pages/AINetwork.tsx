import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Brain,
  Zap,
  Shield,
  MessageSquare,
  TrendingUp,
  Calculator,
  Users,
  RefreshCw,
  Activity,
  Network,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
  color: string;
  status: "active" | "idle" | "processing" | "error";
  connections: string[];
  lastActivity?: string;
  processedToday?: number;
}

const agents: AIAgent[] = [
  // Agentes Contábeis (Centro)
  {
    id: "accountant-agent",
    name: "Contador IA",
    description: "Análises contábeis e consultas",
    category: "contabil",
    icon: Calculator,
    color: "from-violet-500 to-purple-600",
    status: "active",
    connections: ["accountant-background", "accounting-validator", "expense-classifier"],
    processedToday: 156,
  },
  {
    id: "accountant-background",
    name: "Validador Background",
    description: "Validação automática em background",
    category: "contabil",
    icon: Zap,
    color: "from-violet-400 to-purple-500",
    status: "processing",
    connections: ["accountant-agent", "accounting-validator"],
    processedToday: 342,
  },
  {
    id: "accounting-validator",
    name: "Validador Contábil",
    description: "Conformidade e regras contábeis",
    category: "contabil",
    icon: Shield,
    color: "from-violet-600 to-purple-700",
    status: "active",
    connections: ["accountant-agent", "expense-classifier", "invoice-classifier"],
    processedToday: 89,
  },
  {
    id: "expense-classifier",
    name: "Classificador Despesas",
    description: "Classificação automática de despesas",
    category: "contabil",
    icon: Calculator,
    color: "from-purple-500 to-pink-500",
    status: "active",
    connections: ["accounting-validator", "financial-analyst"],
    processedToday: 234,
  },
  {
    id: "invoice-classifier",
    name: "Classificador Faturas",
    description: "Classificação de faturas",
    category: "contabil",
    icon: Calculator,
    color: "from-purple-400 to-pink-400",
    status: "idle",
    connections: ["accounting-validator", "collection-agent"],
    processedToday: 45,
  },

  // Agentes Financeiros
  {
    id: "financial-analyst",
    name: "Analista Financeiro",
    description: "Análises financeiras avançadas",
    category: "financeiro",
    icon: TrendingUp,
    color: "from-emerald-500 to-teal-600",
    status: "active",
    connections: ["cash-flow-analyst", "revenue-predictor", "business-manager"],
    processedToday: 67,
  },
  {
    id: "cash-flow-analyst",
    name: "Analista Fluxo Caixa",
    description: "Projeções de fluxo de caixa",
    category: "financeiro",
    icon: TrendingUp,
    color: "from-emerald-400 to-teal-500",
    status: "active",
    connections: ["financial-analyst", "revenue-predictor"],
    processedToday: 23,
  },
  {
    id: "revenue-predictor",
    name: "Preditor Receitas",
    description: "Previsão de receitas",
    category: "financeiro",
    icon: TrendingUp,
    color: "from-teal-500 to-cyan-500",
    status: "idle",
    connections: ["financial-analyst", "churn-predictor"],
    processedToday: 12,
  },
  {
    id: "pricing-optimizer",
    name: "Otimizador Preços",
    description: "Otimização de precificação",
    category: "financeiro",
    icon: TrendingUp,
    color: "from-teal-400 to-cyan-400",
    status: "idle",
    connections: ["financial-analyst", "client-segmenter"],
    processedToday: 8,
  },

  // Agentes de Cobrança e Clientes
  {
    id: "collection-agent",
    name: "Agente Cobrança",
    description: "Automação de cobrança",
    category: "cobranca",
    icon: Users,
    color: "from-amber-500 to-orange-600",
    status: "active",
    connections: ["churn-predictor", "email-composer", "client-segmenter"],
    processedToday: 78,
  },
  {
    id: "churn-predictor",
    name: "Preditor Churn",
    description: "Previsão de cancelamento",
    category: "cobranca",
    icon: AlertTriangle,
    color: "from-amber-400 to-orange-500",
    status: "active",
    connections: ["collection-agent", "client-segmenter"],
    processedToday: 34,
  },
  {
    id: "client-segmenter",
    name: "Segmentador Clientes",
    description: "Segmentação inteligente",
    category: "cobranca",
    icon: Users,
    color: "from-orange-500 to-red-500",
    status: "idle",
    connections: ["collection-agent", "churn-predictor"],
    processedToday: 56,
  },
  {
    id: "partner-analyzer",
    name: "Analisador Parceiros",
    description: "Análise de parceiros",
    category: "cobranca",
    icon: Users,
    color: "from-orange-400 to-red-400",
    status: "idle",
    connections: ["client-segmenter"],
    processedToday: 5,
  },

  // Agentes de Conciliação
  {
    id: "reconciliation-agent",
    name: "Conciliador Bancário",
    description: "Conciliação automática",
    category: "conciliacao",
    icon: RefreshCw,
    color: "from-blue-500 to-indigo-600",
    status: "active",
    connections: ["pix-reconciliation", "accountant-agent"],
    processedToday: 189,
  },
  {
    id: "pix-reconciliation",
    name: "Conciliador PIX",
    description: "Conciliação de PIX",
    category: "conciliacao",
    icon: Zap,
    color: "from-blue-400 to-indigo-500",
    status: "processing",
    connections: ["reconciliation-agent"],
    processedToday: 423,
  },

  // Agentes de Segurança
  {
    id: "fraud-detector",
    name: "Detector Fraudes",
    description: "Detecção de fraudes",
    category: "seguranca",
    icon: Shield,
    color: "from-red-500 to-rose-600",
    status: "active",
    connections: ["fraud-analyzer", "accounting-validator"],
    processedToday: 12,
  },
  {
    id: "fraud-analyzer",
    name: "Analisador Fraudes",
    description: "Análise aprofundada",
    category: "seguranca",
    icon: Shield,
    color: "from-red-400 to-rose-500",
    status: "idle",
    connections: ["fraud-detector"],
    processedToday: 3,
  },

  // Agentes de Comunicação
  {
    id: "chatbot",
    name: "Chatbot IA",
    description: "Atendimento automático",
    category: "comunicacao",
    icon: MessageSquare,
    color: "from-pink-500 to-fuchsia-600",
    status: "active",
    connections: ["email-composer", "accountant-agent"],
    processedToday: 234,
  },
  {
    id: "email-composer",
    name: "Compositor E-mails",
    description: "Geração de e-mails",
    category: "comunicacao",
    icon: MessageSquare,
    color: "from-pink-400 to-fuchsia-500",
    status: "active",
    connections: ["chatbot", "collection-agent", "contract-generator"],
    processedToday: 67,
  },
  {
    id: "contract-generator",
    name: "Gerador Contratos",
    description: "Geração de contratos",
    category: "comunicacao",
    icon: MessageSquare,
    color: "from-fuchsia-500 to-purple-500",
    status: "idle",
    connections: ["email-composer"],
    processedToday: 8,
  },

  // Gestão Empresarial (Centro)
  {
    id: "business-manager",
    name: "Gestor Empresarial",
    description: "MBA - Análises estratégicas",
    category: "gestao",
    icon: Brain,
    color: "from-yellow-500 to-amber-600",
    status: "active",
    connections: ["financial-analyst", "accountant-agent", "collection-agent", "fraud-detector"],
    processedToday: 45,
  },
];

const categoryColors: Record<string, string> = {
  contabil: "border-violet-500",
  financeiro: "border-emerald-500",
  cobranca: "border-amber-500",
  conciliacao: "border-blue-500",
  seguranca: "border-red-500",
  comunicacao: "border-pink-500",
  gestao: "border-yellow-500",
};

const categoryLabels: Record<string, string> = {
  contabil: "Contábil",
  financeiro: "Financeiro",
  cobranca: "Cobrança",
  conciliacao: "Conciliação",
  seguranca: "Segurança",
  comunicacao: "Comunicação",
  gestao: "Gestão",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-gray-400",
  processing: "bg-blue-500 animate-pulse",
  error: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  idle: "Ocioso",
  processing: "Processando",
  error: "Erro",
};

// Posições dos nós na rede (layout circular por categoria)
const getNodePosition = (index: number, category: string, total: number) => {
  const categoryOrder = ["gestao", "contabil", "financeiro", "cobranca", "conciliacao", "seguranca", "comunicacao"];
  const catIndex = categoryOrder.indexOf(category);

  // Centro para gestão
  if (category === "gestao") {
    return { x: 50, y: 50 };
  }

  // Layout em círculo para outras categorias
  const angle = (catIndex / (categoryOrder.length - 1)) * 2 * Math.PI - Math.PI / 2;
  const radius = 35;
  const offsetAngle = (index * 0.3) - 0.3;

  return {
    x: 50 + radius * Math.cos(angle + offsetAngle),
    y: 50 + radius * Math.sin(angle + offsetAngle),
  };
};

export default function AINetwork() {
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Animação contínua
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase((prev) => (prev + 1) % 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Estatísticas
  const totalProcessed = agents.reduce((sum, a) => sum + (a.processedToday || 0), 0);
  const activeAgents = agents.filter((a) => a.status === "active" || a.status === "processing").length;
  const processingAgents = agents.filter((a) => a.status === "processing").length;

  // Agrupar por categoria para índices
  const agentsByCategory: Record<string, AIAgent[]> = {};
  agents.forEach((agent) => {
    if (!agentsByCategory[agent.category]) {
      agentsByCategory[agent.category] = [];
    }
    agentsByCategory[agent.category].push(agent);
  });

  // Calcular posições
  const agentPositions: Record<string, { x: number; y: number }> = {};
  Object.entries(agentsByCategory).forEach(([category, catAgents]) => {
    catAgents.forEach((agent, index) => {
      agentPositions[agent.id] = getNodePosition(index, category, catAgents.length);
    });
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Network className="h-8 w-8 text-violet-400" />
              Rede Neural de IA
            </h1>
            <p className="text-slate-400 mt-1">
              Visualização em tempo real dos 21 agentes de IA
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{totalProcessed.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Processados hoje</div>
            </div>
            <div className="h-12 w-px bg-slate-700" />
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">{activeAgents}</div>
              <div className="text-xs text-slate-400">Agentes ativos</div>
            </div>
            <div className="h-12 w-px bg-slate-700" />
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-400">{processingAgents}</div>
              <div className="text-xs text-slate-400">Processando</div>
            </div>
          </div>
        </div>

        {/* Legenda de categorias */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <Badge
              key={key}
              variant="outline"
              className={cn(
                "border-2 bg-slate-800/50 text-white",
                categoryColors[key]
              )}
            >
              {label}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Visualização da Rede */}
          <Card className="lg:col-span-3 bg-slate-800/50 border-slate-700 overflow-hidden">
            <CardContent className="p-0">
              <div className="relative w-full" style={{ paddingBottom: "75%" }}>
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Gradientes */}
                  <defs>
                    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(139, 92, 246, 0.3)" />
                      <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
                    </radialGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Glow central */}
                  <circle cx="50" cy="50" r="40" fill="url(#centerGlow)" />

                  {/* Conexões */}
                  {agents.map((agent) =>
                    agent.connections.map((connId) => {
                      const targetAgent = agents.find((a) => a.id === connId);
                      if (!targetAgent) return null;

                      const from = agentPositions[agent.id];
                      const to = agentPositions[connId];
                      if (!from || !to) return null;

                      const isHighlighted =
                        hoveredAgent === agent.id || hoveredAgent === connId;

                      return (
                        <line
                          key={`${agent.id}-${connId}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={isHighlighted ? "#8b5cf6" : "#475569"}
                          strokeWidth={isHighlighted ? 0.3 : 0.15}
                          strokeOpacity={isHighlighted ? 0.8 : 0.4}
                          className="transition-all duration-300"
                        />
                      );
                    })
                  )}

                  {/* Pulsos nas conexões ativas */}
                  {agents
                    .filter((a) => a.status === "processing")
                    .map((agent) =>
                      agent.connections.map((connId, i) => {
                        const from = agentPositions[agent.id];
                        const to = agentPositions[connId];
                        if (!from || !to) return null;

                        const progress = ((animationPhase + i * 20) % 100) / 100;
                        const x = from.x + (to.x - from.x) * progress;
                        const y = from.y + (to.y - from.y) * progress;

                        return (
                          <circle
                            key={`pulse-${agent.id}-${connId}`}
                            cx={x}
                            cy={y}
                            r={0.5}
                            fill="#8b5cf6"
                            filter="url(#glow)"
                          />
                        );
                      })
                    )}

                  {/* Nós (Agentes) */}
                  {agents.map((agent) => {
                    const pos = agentPositions[agent.id];
                    if (!pos) return null;

                    const isHovered = hoveredAgent === agent.id;
                    const isSelected = selectedAgent?.id === agent.id;
                    const size = agent.category === "gestao" ? 4 : 3;

                    return (
                      <g
                        key={agent.id}
                        className="cursor-pointer transition-transform duration-200"
                        style={{
                          transform: isHovered ? "scale(1.2)" : "scale(1)",
                          transformOrigin: `${pos.x}px ${pos.y}px`,
                        }}
                        onMouseEnter={() => setHoveredAgent(agent.id)}
                        onMouseLeave={() => setHoveredAgent(null)}
                        onClick={() => setSelectedAgent(agent)}
                      >
                        {/* Outer ring para status */}
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={size + 0.8}
                          fill="none"
                          stroke={
                            agent.status === "active"
                              ? "#22c55e"
                              : agent.status === "processing"
                              ? "#3b82f6"
                              : agent.status === "error"
                              ? "#ef4444"
                              : "#6b7280"
                          }
                          strokeWidth={0.3}
                          className={agent.status === "processing" ? "animate-pulse" : ""}
                        />

                        {/* Nó principal */}
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={size}
                          className={cn(
                            "transition-all duration-200",
                            isSelected && "stroke-white stroke-[0.5]"
                          )}
                          fill={`url(#grad-${agent.id})`}
                          filter={isHovered ? "url(#glow)" : undefined}
                        />

                        {/* Gradiente do nó */}
                        <defs>
                          <linearGradient
                            id={`grad-${agent.id}`}
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop
                              offset="0%"
                              stopColor={
                                agent.color.includes("violet")
                                  ? "#8b5cf6"
                                  : agent.color.includes("emerald")
                                  ? "#10b981"
                                  : agent.color.includes("amber")
                                  ? "#f59e0b"
                                  : agent.color.includes("blue")
                                  ? "#3b82f6"
                                  : agent.color.includes("red")
                                  ? "#ef4444"
                                  : agent.color.includes("pink")
                                  ? "#ec4899"
                                  : "#eab308"
                              }
                            />
                            <stop
                              offset="100%"
                              stopColor={
                                agent.color.includes("purple")
                                  ? "#7c3aed"
                                  : agent.color.includes("teal")
                                  ? "#14b8a6"
                                  : agent.color.includes("orange")
                                  ? "#ea580c"
                                  : agent.color.includes("indigo")
                                  ? "#6366f1"
                                  : agent.color.includes("rose")
                                  ? "#f43f5e"
                                  : agent.color.includes("fuchsia")
                                  ? "#d946ef"
                                  : "#d97706"
                              }
                            />
                          </linearGradient>
                        </defs>

                        {/* Label */}
                        {(isHovered || agent.category === "gestao") && (
                          <text
                            x={pos.x}
                            y={pos.y + size + 2.5}
                            textAnchor="middle"
                            className="fill-white text-[1.8px] font-medium"
                          >
                            {agent.name}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Painel de detalhes */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet-400" />
                {selectedAgent ? "Detalhes do Agente" : "Selecione um Agente"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedAgent ? (
                <div className="space-y-4">
                  {/* Ícone e nome */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                        selectedAgent.color
                      )}
                    >
                      <selectedAgent.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{selectedAgent.name}</h3>
                      <p className="text-sm text-slate-400">{selectedAgent.description}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400">Status</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-0",
                        selectedAgent.status === "active" && "bg-green-500/20 text-green-400",
                        selectedAgent.status === "processing" && "bg-blue-500/20 text-blue-400",
                        selectedAgent.status === "idle" && "bg-gray-500/20 text-gray-400",
                        selectedAgent.status === "error" && "bg-red-500/20 text-red-400"
                      )}
                    >
                      <span
                        className={cn("w-2 h-2 rounded-full mr-2", statusColors[selectedAgent.status])}
                      />
                      {statusLabels[selectedAgent.status]}
                    </Badge>
                  </div>

                  {/* Categoria */}
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400">Categoria</span>
                    <Badge variant="outline" className={cn("border-2", categoryColors[selectedAgent.category])}>
                      {categoryLabels[selectedAgent.category]}
                    </Badge>
                  </div>

                  {/* Processados hoje */}
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400">Processados hoje</span>
                    <span className="text-white font-semibold">
                      {selectedAgent.processedToday?.toLocaleString() || 0}
                    </span>
                  </div>

                  {/* Conexões */}
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400 text-sm">Conectado a:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedAgent.connections.map((connId) => {
                        const connAgent = agents.find((a) => a.id === connId);
                        return connAgent ? (
                          <Badge
                            key={connId}
                            variant="secondary"
                            className="bg-slate-700 text-slate-300 cursor-pointer hover:bg-slate-600"
                            onClick={() => setSelectedAgent(connAgent)}
                          >
                            {connAgent.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* Ação */}
                  <Button className="w-full" variant="default">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Executar Agente
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Network className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">
                    Clique em um nó na rede para ver os detalhes do agente
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista de todos os agentes */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-400" />
              Todos os Agentes ({agents.length})
            </CardTitle>
            <CardDescription className="text-slate-400">
              Clique em um agente para destacá-lo na rede
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                    "bg-slate-900/50 hover:bg-slate-700/50 border border-slate-700",
                    selectedAgent?.id === agent.id && "ring-2 ring-violet-500"
                  )}
                  onClick={() => setSelectedAgent(agent)}
                  onMouseEnter={() => setHoveredAgent(agent.id)}
                  onMouseLeave={() => setHoveredAgent(null)}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
                      agent.color
                    )}
                  >
                    <agent.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{agent.name}</div>
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", statusColors[agent.status])} />
                      <span className="text-xs text-slate-400">
                        {agent.processedToday?.toLocaleString() || 0} hoje
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
