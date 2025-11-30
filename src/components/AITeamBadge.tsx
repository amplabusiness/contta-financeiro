import { Bot, Brain, Calculator, Network, Scale, Building2, TrendingUp, Megaphone } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Equipe de Agentes de IA da Ampla
const AI_TEAM = [
  {
    id: "cicero",
    name: "Dr. Cícero",
    role: "Contador IA",
    icon: Calculator,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    description: "Contador virtual especialista em NBC/CFC. Cuida dos lançamentos contábeis, plano de contas e validações fiscais.",
    expertise: ["Lançamentos Contábeis", "Plano de Contas", "NBC/CFC", "Balanço", "DRE"],
  },
  {
    id: "milton",
    name: "Prof. Milton",
    role: "MBA Finanças",
    icon: Brain,
    color: "text-green-600",
    bgColor: "bg-green-100",
    description: "Gestor financeiro com MBA. Analisa custos, fluxo de caixa, indicadores e projeções financeiras.",
    expertise: ["Fluxo de Caixa", "Análise de Custos", "KPIs", "Projeções", "Orçamentos"],
  },
  {
    id: "helena",
    name: "Dra. Helena",
    role: "Gestora IA",
    icon: Bot,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    description: "Especialista em gestão empresarial. Define metas, acompanha indicadores e sugere melhorias operacionais.",
    expertise: ["Gestão", "Metas", "Indicadores", "Processos", "Estratégia"],
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Rede Neural",
    icon: Network,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    description: "Responsável pelo aprendizado de máquina. Identifica padrões, classifica transações e melhora com o tempo.",
    expertise: ["Aprendizado", "Padrões", "Classificação", "Automação", "Previsões"],
  },
  {
    id: "advocato",
    name: "Dr. Advocato",
    role: "Advogado Trabalhista IA",
    icon: Scale,
    color: "text-red-600",
    bgColor: "bg-red-100",
    description: "Especialista em legislação trabalhista brasileira, CLT e jurisprudência do TST/TRTs. Analisa riscos e propõe soluções jurídicas.",
    expertise: ["CLT", "Jurisprudência", "Riscos Trabalhistas", "Contratos", "Súmulas TST"],
  },
  {
    id: "empresario",
    name: "Sr. Empresário",
    role: "Estrategista Empresarial",
    icon: Building2,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    description: "Especialista em estruturação societária, holdings e planejamento. Encontra soluções criativas dentro da lei.",
    expertise: ["Sociedades", "Holdings", "Terceirização", "Planejamento", "MEI/ME"],
  },
  {
    id: "vendedor",
    name: "Sr. Vendedor",
    role: "Consultor Comercial IA",
    icon: TrendingUp,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    description: "Especialista em vendas consultivas. Não só identifica problemas - propõe SOLUÇÕES para aumentar receita, reter clientes e prospectar novos.",
    expertise: ["Vendas", "Prospecção", "Retenção", "Indicações", "Scripts"],
  },
  {
    id: "marketing",
    name: "Sra. Marketing",
    role: "Gerente de Marketing IA",
    icon: Megaphone,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    description: "Cria campanhas, vídeos de treinamento para TVs, conteúdo para WhatsApp e Instagram. Coordena incentivos e PLR.",
    expertise: ["Vídeos", "Campanhas", "TVs", "WhatsApp", "Instagram"],
  },
];

interface AITeamBadgeProps {
  variant?: "full" | "compact" | "minimal";
  showOnline?: boolean;
  className?: string;
}

export function AITeamBadge({
  variant = "compact",
  showOnline = true,
  className = ""
}: AITeamBadgeProps) {
  if (variant === "minimal") {
    return (
      <TooltipProvider>
        <div className={`flex items-center gap-1 ${className}`}>
          {AI_TEAM.map((agent) => {
            const Icon = agent.icon;
            return (
              <Tooltip key={agent.id}>
                <TooltipTrigger asChild>
                  <div className={`p-1 rounded-full ${agent.bgColor} cursor-help`}>
                    <Icon className={`h-3 w-3 ${agent.color}`} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${agent.color}`} />
                      <span className="font-semibold">{agent.name}</span>
                      <span className="text-xs text-muted-foreground">({agent.role})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{agent.description}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {agent.expertise.map((skill) => (
                        <span key={skill} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <div className={`flex items-center gap-2 p-2 rounded-lg bg-muted/50 ${className}`}>
          <div className="flex items-center gap-1">
            {AI_TEAM.map((agent) => {
              const Icon = agent.icon;
              return (
                <Tooltip key={agent.id}>
                  <TooltipTrigger asChild>
                    <div className={`p-1.5 rounded-full ${agent.bgColor} cursor-help transition-transform hover:scale-110`}>
                      <Icon className={`h-4 w-4 ${agent.color}`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${agent.color}`} />
                        <span className="font-semibold">{agent.name}</span>
                        <span className="text-xs text-muted-foreground">({agent.role})</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{agent.description}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {agent.expertise.map((skill) => (
                          <span key={skill} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {showOnline && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Equipe IA</span>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // variant === "full"
  return (
    <TooltipProvider>
      <div className={`p-4 rounded-lg border bg-card ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Equipe de Inteligência Artificial</h3>
          {showOnline && (
            <span className="flex items-center gap-1 text-xs text-green-600 ml-auto">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {AI_TEAM.map((agent) => {
            const Icon = agent.icon;
            return (
              <Tooltip key={agent.id}>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${agent.bgColor} cursor-help transition-all hover:shadow-md`}>
                    <Icon className={`h-5 w-5 ${agent.color}`} />
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-sm">{agent.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.expertise.map((skill) => (
                        <span key={skill} className="text-xs px-2 py-0.5 bg-muted rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Passe o mouse sobre um agente para saber mais
        </p>
      </div>
    </TooltipProvider>
  );
}

// Exportar a lista de agentes para uso em outros componentes
export { AI_TEAM };
export type AIAgent = typeof AI_TEAM[0];
