/**
 * 🚀 CONTTA - LANDING PAGE
 * 
 * Landing Page premium com Design System Maestro UX
 * Cores derivadas da logo Contta (#0a8fc5)
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Brain, 
  Shield, 
  Zap, 
  BarChart3, 
  FileCheck, 
  Users,
  ArrowRight,
  CheckCircle,
  XCircle,
  RefreshCw,
  BookOpen,
  AlertTriangle,
  ChevronRight,
  Building2,
  Calculator,
  Sparkles,
  Clock,
  Lock,
  TrendingUp,
  FileText,
  Target,
} from "lucide-react";
import { Button, Card } from "@/design-system/components";
import { LandingLayout, LandingSection, SectionHeader } from "@/design-system/layouts";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 🎯 DATA
// ═══════════════════════════════════════════════════════════════

const comparisonData = [
  {
    traditional: "Classificação manual, erro humano",
    contta: "IA classifica com justificativa técnica contábil",
  },
  {
    traditional: "Conciliação demorada e imprecisa",
    contta: "Super Conciliação em tempo real, sem gaps",
  },
  {
    traditional: "Regras fragmentadas em planilhas",
    contta: "Regras centralizadas e auditáveis",
  },
  {
    traditional: "Relatórios defasados",
    contta: "DRE e balancete sempre atualizados",
  },
  {
    traditional: "Sem rastreabilidade de decisões",
    contta: "Trilha de auditoria completa (quem, quando, por quê)",
  },
];

const drCiceroFeatures = [
  "Classifica transações automaticamente com fundamentação",
  "Bloqueia lançamentos que violam regras contábeis",
  "Explica cada decisão para você e sua equipe",
  "Aprende com histórico e padrões da empresa",
  "Sugere correções com impacto simulado",
];

const features = [
  {
    icon: Brain,
    title: "Dr. Cícero - IA Contábil",
    description: "Contador digital 24/7 que classifica, explica e bloqueia erros automaticamente.",
  },
  {
    icon: RefreshCw,
    title: "Super Conciliação",
    description: "Importação OFX inteligente com classificação automática e workflow de aprovação.",
  },
  {
    icon: BarChart3,
    title: "DRE em Tempo Real",
    description: "Relatórios contábeis sempre atualizados, sem necessidade de fechamento manual.",
  },
  {
    icon: Shield,
    title: "Governança Total",
    description: "Trilha de auditoria completa, regras invioláveis e conformidade SPED ECD.",
  },
  {
    icon: Users,
    title: "Multi-Tenant Seguro",
    description: "Dados isolados por cliente, acesso granular por papel, sem vazamentos.",
  },
  {
    icon: FileCheck,
    title: "Plano de Contas Inteligente",
    description: "Estrutura hierárquica com mapeamento automático SPED e validação em tempo real.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "R$ 197",
    period: "/mês",
    description: "Para começar com governança contábil",
    features: [
      "1 empresa",
      "Até 500 transações/mês",
      "Dr. Cícero básico",
      "Super Conciliação",
      "DRE mensal",
      "Suporte por email",
    ],
    cta: "Começar Grátis",
    variant: "outline" as const,
  },
  {
    name: "Professional",
    price: "R$ 497",
    period: "/mês",
    description: "Para escritórios contábeis",
    features: [
      "Até 10 empresas",
      "Transações ilimitadas",
      "Dr. Cícero completo",
      "API de integração",
      "Relatórios customizados",
      "Suporte prioritário",
    ],
    cta: "Testar 14 dias",
    variant: "primary" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para operações complexas",
    features: [
      "Empresas ilimitadas",
      "IA dedicada",
      "Integrações customizadas",
      "SLA garantido",
      "Treinamento in-loco",
      "Gerente de conta",
    ],
    cta: "Falar com Vendas",
    variant: "outline" as const,
  },
];

const targetAudience = [
  { icon: <Building2 className="h-5 w-5" />, text: "Escritórios Contábeis" },
  { icon: <Calculator className="h-5 w-5" />, text: "Controllers e CFOs" },
  { icon: <Users className="h-5 w-5" />, text: "Equipes Financeiras" },
  { icon: <TrendingUp className="h-5 w-5" />, text: "Empresas em Crescimento" },
];

// ═══════════════════════════════════════════════════════════════
// 🎬 ANIMATIONS
// ═══════════════════════════════════════════════════════════════

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

// ═══════════════════════════════════════════════════════════════
// 🏠 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Landing() {
  const navigate = useNavigate();

  const handleStart = () => navigate("/auth?mode=signup");
  const handleDemo = () => window.open("https://cal.com/contta/demo", "_blank");

  return (
    <LandingLayout>
      {/* ═══ HERO ═══ */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-b from-primary-50 via-white to-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ai-100 text-ai-700 text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                Plataforma AI-First para Contabilidade
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 mb-6 leading-tight"
            >
              Governança contábil com
              <span className="block text-primary-600">Inteligência Artificial</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              variants={fadeInUp}
              className="text-xl text-neutral-600 mb-8 max-w-2xl mx-auto"
            >
              Automatize classificações, elimine erros e tenha relatórios em tempo real. 
              O Dr. Cícero é seu contador digital 24/7.
            </motion.p>

            {/* CTAs */}
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            >
              <Button
                variant="primary"
                size="lg"
                onClick={handleStart}
                rightIcon={<ArrowRight className="h-5 w-5" />}
                className="text-base px-8 h-12"
              >
                Começar Grátis
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleDemo}
                className="text-base px-8 h-12"
              >
                Ver Demonstração
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.p variants={fadeInUp} className="text-sm text-neutral-500">
              Sem cartão de crédito • 14 dias grátis • Cancelamento imediato
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ═══ PARA QUEM É ═══ */}
      <LandingSection bg="primary" padding="md">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-white">
            Feito para quem não pode errar
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {targetAudience.map((item, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10"
              >
                <div className="text-primary-200">{item.icon}</div>
                <span className="text-white/90 text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </LandingSection>

      {/* ═══ COMPARAÇÃO ═══ */}
      <LandingSection id="recursos" bg="white" padding="xl">
        <SectionHeader
          badge="O Diferencial Real"
          title="Não é só automação. É governança contábil contínua."
          align="center"
        />
        
        <div className="max-w-4xl mx-auto overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-4 bg-neutral-100 border border-neutral-200 font-semibold text-neutral-500 rounded-tl-lg">
                  Sistemas comuns
                </th>
                <th className="text-left p-4 bg-primary-50 border border-primary-200 font-bold text-primary-700 rounded-tr-lg">
                  CONTTA
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, i) => (
                <tr key={i}>
                  <td className="p-4 border border-neutral-200 text-neutral-500">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-neutral-400 shrink-0" />
                      {row.traditional}
                    </div>
                  </td>
                  <td className="p-4 border border-primary-200 bg-primary-50/30 text-neutral-700 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary-600 shrink-0" />
                      {row.contta}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LandingSection>

      {/* ═══ DR. CÍCERO ═══ */}
      <LandingSection id="dr-cicero" bg="dark" padding="xl">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ai-500/20 text-ai-300 text-sm font-medium mb-4 border border-ai-500/30">
              <Brain className="h-4 w-4" />
              Contador Responsável Digital
            </span>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Conheça o Dr. Cícero
            </h2>
            
            <p className="text-lg text-neutral-300 mb-2">
              Seu contador responsável digital — <strong className="text-white">24/7</strong>
            </p>
            
            <p className="text-neutral-400 mb-8">
              O Dr. Cícero não é um chatbot genérico. Ele é o <strong className="text-neutral-200">núcleo contábil do sistema</strong>, 
              treinado com regras reais, princípios contábeis e histórico da sua operação.
            </p>
            
            <h3 className="text-white font-semibold mb-4">O que o Dr. Cícero faz por você:</h3>
            <div className="space-y-3">
              {drCiceroFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success-400 mt-0.5 shrink-0" />
                  <span className="text-neutral-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Dr. Cícero Demo Card */}
          <div className="bg-neutral-800/60 backdrop-blur rounded-2xl p-6 border border-neutral-700">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-700">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ai-400 to-ai-600 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white">Dr. Cícero</div>
                <div className="text-sm text-neutral-400">Contador Digital • Online</div>
              </div>
              <div className="ml-auto w-2 h-2 bg-success-400 rounded-full animate-pulse" />
            </div>
            
            <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-danger-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-danger-300 font-medium mb-1">Bloqueio de lançamento</p>
                  <p className="text-neutral-300 text-sm">
                    "Este lançamento não pode ser Receita.
                    <br />
                    <strong className="text-danger-300">Motivo:</strong> PIX de sócio — regra inviolável."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </LandingSection>

      {/* ═══ FEATURES GRID ═══ */}
      <LandingSection bg="gray" padding="xl">
        <SectionHeader
          badge="Recursos"
          title="Tudo que você precisa para governança contábil"
          subtitle="Automatize processos, mantenha conformidade e tome decisões com números confiáveis."
          align="center"
        />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <Card key={i} variant="default" className="p-6">
              <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                {feature.title}
              </h3>
              <p className="text-neutral-600 text-sm">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </LandingSection>

      {/* ═══ PRICING ═══ */}
      <LandingSection id="planos" bg="white" padding="xl">
        <SectionHeader
          badge="Planos"
          title="Escolha o plano ideal para seu negócio"
          subtitle="Comece grátis, escale conforme cresce. Sem surpresas, sem letras miúdas."
          align="center"
        />
        
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div 
              key={i} 
              className={cn(
                "relative rounded-2xl border p-6",
                plan.popular 
                  ? "border-primary-500 bg-primary-50/50 shadow-lg ring-2 ring-primary-500/20" 
                  : "border-neutral-200 bg-white"
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary-600 text-white text-xs font-semibold">
                  Mais Popular
                </span>
              )}
              
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                {plan.name}
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                {plan.description}
              </p>
              
              <div className="mb-6">
                <span className="text-3xl font-bold text-neutral-900">{plan.price}</span>
                <span className="text-neutral-500">{plan.period}</span>
              </div>
              
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-neutral-600">
                    <CheckCircle className="h-4 w-4 text-primary-600 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <Button
                variant={plan.variant}
                fullWidth
                onClick={plan.variant === "outline" && plan.name === "Enterprise" ? handleDemo : handleStart}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </LandingSection>

      {/* ═══ CTA FINAL ═══ */}
      <LandingSection id="contato" bg="primary" padding="lg">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pronto para transformar sua contabilidade?
          </h2>
          <p className="text-lg text-primary-100 mb-8">
            Comece agora e veja o Dr. Cícero em ação. 14 dias grátis, sem cartão de crédito.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleStart}
              rightIcon={<ArrowRight className="h-5 w-5" />}
              className="bg-white text-primary-700 hover:bg-primary-50"
            >
              Começar Grátis Agora
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDemo}
              className="border-white/30 text-white hover:bg-white/10"
            >
              Agendar Demo
            </Button>
          </div>
        </div>
      </LandingSection>
    </LandingLayout>
  );
}
