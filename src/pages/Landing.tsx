import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, ArrowRight, Zap, Shield, Crown, BarChart3,
  Building2, Users, Clock, Lock, ChevronRight,
  Calculator, Receipt, LineChart, Brain, Wallet, Database,
  RefreshCw, Award, Star, Menu, X, FileCheck, Search,
  Layers, Scale, BookOpen, Fingerprint, ShieldCheck, Cpu,
  AlertTriangle, Eye, GitBranch, CheckSquare, XCircle,
  Target, TrendingUp, FileText, Briefcase
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");

  const handleStartTrial = () => {
    navigate("/auth?mode=signup");
  };

  const handleLogin = () => {
    navigate("/auth");
  };

  const handleDemo = () => {
    navigate("/auth?mode=demo");
  };

  // Tabela comparativa
  const comparisonData = [
    { traditional: "Classificam sem explicar", contta: "Classifica e justifica" },
    { traditional: "Corrigem depois do erro", contta: "Bloqueia antes do fechamento" },
    { traditional: "Dependem do operador", contta: "IA supervisionada por regras técnicas" },
    { traditional: "Não auditáveis", contta: "Auditoria automática mensal" },
    { traditional: "Caixa ≠ competência", contta: "Competência respeitada por padrão" },
  ];

  // Dr. Cícero features
  const drCiceroFeatures = [
    "Classifica transações bancárias com regras técnicas",
    "BLOQUEIA PIX de sócio como receita",
    "Exige justificativa para contas genéricas",
    "Audita partidas dobradas em tempo real",
    "Aprende com cada decisão aprovada",
    "Mantém conformidade contínua"
  ];

  // Super Conciliação features
  const superConciliacaoFeatures = [
    "Reclassificar sem alterar saldo bancário",
    "Desmembrar (split) lançamentos complexos",
    "Visualizar impacto ANTES de aplicar",
    "Submeter para aprovação técnica",
    "Manter trilha completa de auditoria"
  ];

  // Dashboard indicators
  const dashboardIndicators = [
    "Receita por competência",
    "Transitórias pendentes",
    "Inadimplência efetiva",
    "Margem líquida confiável",
    "Alertas contábeis ativos"
  ];

  // Data Lake items
  const dataLakeItems = [
    "Extratos bancários (OFX)",
    "Planilhas de baixa",
    "Boletos e cobranças",
    "Relatórios fiscais",
    "Documentos operacionais"
  ];

  // Security features
  const securityFeatures = [
    "RLS ativo por tenant",
    "Trilhas de auditoria imutáveis",
    "Aprovações formais",
    "Logs técnicos completos",
    "Compliance LGPD"
  ];

  // Planos
  const plans = [
    {
      name: "Starter",
      subtitle: "Operacional",
      price: 99,
      features: [
        "Financeiro básico",
        "Conciliação automática",
        "Relatórios essenciais",
        "2 usuários",
        "Suporte por email"
      ],
      popular: false,
      icon: <Zap className="h-6 w-6" />
    },
    {
      name: "Professional",
      subtitle: "Governança",
      price: 199,
      features: [
        "Super Conciliação",
        "IA de classificação",
        "Auditoria mensal",
        "Impacto contábil em tempo real",
        "5 usuários",
        "Suporte prioritário"
      ],
      popular: true,
      icon: <Shield className="h-6 w-6" />
    },
    {
      name: "Enterprise",
      subtitle: "Autoridade Total",
      price: 499,
      features: [
        "Agentes avançados",
        "White label",
        "SLA dedicado",
        "Governança completa",
        "Usuários ilimitados",
        "Gerente de conta"
      ],
      popular: false,
      icon: <Crown className="h-6 w-6" />
    }
  ];

  // Target audience
  const targetAudience = [
    { icon: <Building2 className="h-5 w-5" />, text: "Escritórios contábeis" },
    { icon: <Briefcase className="h-5 w-5" />, text: "Departamentos financeiros estruturados" },
    { icon: <Users className="h-5 w-5" />, text: "Grupos empresariais" },
    { icon: <Target className="h-5 w-5" />, text: "Gestores, analistas e sócios que precisam confiar nos números" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-slate-900 to-slate-700 rounded-lg flex items-center justify-center shadow-sm">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                CONTTA
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#dr-cicero" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Dr. Cícero
              </a>
              <a href="#super-conciliacao" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Super Conciliação
              </a>
              <a href="#data-lake" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Data Lake
              </a>
              <a href="#precos" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Planos
              </a>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" onClick={handleLogin} className="text-slate-600">
                Acessar
              </Button>
              <Button onClick={handleStartTrial} className="bg-slate-900 hover:bg-slate-800">
                Iniciar Teste Grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <nav className="md:hidden py-4 space-y-2 border-t">
              <a href="#dr-cicero" className="block py-2 text-slate-600">Dr. Cícero</a>
              <a href="#super-conciliacao" className="block py-2 text-slate-600">Super Conciliação</a>
              <a href="#data-lake" className="block py-2 text-slate-600">Data Lake</a>
              <a href="#precos" className="block py-2 text-slate-600">Planos</a>
              <div className="pt-4 space-y-2">
                <Button variant="outline" className="w-full" onClick={handleLogin}>Acessar</Button>
                <Button className="w-full bg-slate-900" onClick={handleStartTrial}>Iniciar Teste Grátis</Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="pt-28 pb-20 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge variant="outline" className="mb-6 text-slate-700 border-slate-300 px-4 py-1.5 text-sm">
            <Brain className="h-4 w-4 mr-2" />
            Sistema Financeiro-Contábil AI-First
          </Badge>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-slate-900 leading-tight">
            O primeiro sistema com um
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Contador Digital Responsável
            </span>
            <br />
            por IA
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 mb-4 font-medium">
            Automatize, audite e decida com segurança.
          </p>
          <p className="text-lg text-slate-500 mb-8 max-w-3xl mx-auto">
            Cada lançamento explicado. Cada número defensável.
            <br />
            O Contta une financeiro, contabilidade e inteligência artificial em um único ecossistema, 
            com governança real, trilha de auditoria e decisões técnicas automatizadas.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button 
              size="lg" 
              onClick={handleStartTrial} 
              className="text-base px-8 bg-blue-600 hover:bg-blue-700 h-12"
            >
              <Brain className="mr-2 h-5 w-5" />
              Ver o Dr. Cícero em ação
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleDemo}
              className="text-base px-8 h-12 border-slate-300"
            >
              Solicitar demonstração guiada
            </Button>
          </div>
          
          <p className="text-sm text-slate-500">
            Sem cartão de crédito • 14 dias grátis • Cancelamento imediato
          </p>
        </div>
      </section>

      {/* ========== PARA QUEM É ========== */}
      <section className="py-16 px-4 bg-slate-900 text-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Feito para quem não pode errar
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {targetAudience.map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-4">
                <div className="text-blue-400">{item.icon}</div>
                <span className="text-slate-200 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
          
          <p className="text-center text-slate-400 text-sm max-w-2xl mx-auto">
            Se você já perdeu horas conciliando, reclassificando ou explicando números que "não fechavam", 
            o Contta foi feito para você.
          </p>
        </div>
      </section>

      {/* ========== O DIFERENCIAL REAL ========== */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-slate-300">
              <Scale className="h-3 w-3 mr-1" />
              O Diferencial Real
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Não é só automação. É governança contábil contínua.
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-4 bg-slate-100 border border-slate-200 font-semibold text-slate-500">
                    Sistemas comuns
                  </th>
                  <th className="text-left p-4 bg-blue-50 border border-blue-200 font-bold text-blue-700">
                    CONTTA
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i}>
                    <td className="p-4 border border-slate-200 text-slate-500 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-slate-400 shrink-0" />
                      {row.traditional}
                    </td>
                    <td className="p-4 border border-blue-200 bg-blue-50/30 text-slate-700 font-medium">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />
                        {row.contta}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========== DR. CÍCERO ========== */}
      <section id="dr-cicero" className="py-20 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-amber-500/20 text-amber-300 hover:bg-amber-500/20 border-amber-500/30">
                <Brain className="h-3 w-3 mr-1" />
                Contador Responsável Digital
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                Conheça o Dr. Cícero
              </h2>
              <p className="text-lg text-slate-300 mb-2">
                Seu contador responsável digital — <strong className="text-white">24/7</strong>
              </p>
              <p className="text-slate-400 mb-8">
                O Dr. Cícero não é um chatbot genérico. Ele é o <strong className="text-slate-200">núcleo contábil do sistema</strong>, 
                treinado com regras reais, princípios contábeis e histórico da sua operação.
              </p>
              
              <h3 className="text-white font-semibold mb-4">O que o Dr. Cícero faz por você:</h3>
              <div className="space-y-3 mb-8">
                {drCiceroFeatures.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white">Dr. Cícero</div>
                  <div className="text-sm text-slate-400">Contador Digital • Online</div>
                </div>
                <div className="ml-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-red-300 font-medium mb-1">Bloqueio de lançamento</p>
                    <p className="text-slate-300 text-sm">
                      "Este lançamento não pode ser Receita.
                      <br />
                      <strong className="text-red-300">Motivo:</strong> PIX de sócio — regra inviolável."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SUPER CONCILIAÇÃO ========== */}
      <section id="super-conciliacao" className="py-20 px-4 bg-slate-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-blue-300 text-blue-700">
              <RefreshCw className="h-3 w-3 mr-1" />
              Core do Sistema
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Super Conciliação
            </h2>
            <p className="text-xl text-slate-600">
              Onde erros não passam
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-slate-600 mb-6">
                A Super Conciliação é o <strong>coração operacional</strong> do Contta.
              </p>
              
              <h3 className="font-semibold text-slate-900 mb-4">Você pode:</h3>
              <div className="space-y-3 mb-8">
                {superConciliacaoFeatures.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckSquare className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <span className="text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
              
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-2">Workflow claro:</p>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">Rascunho</Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">Pendente</Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Aprovado</Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Aplicado</Badge>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-500 text-sm">
                <GitBranch className="h-4 w-4" />
                <span>Visualização de Impacto</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">Saldo Bancário</span>
                  <span className="font-mono text-emerald-600 font-medium">Inalterado</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-slate-600">DRE Impactado</span>
                  <span className="font-mono text-blue-600 font-medium">+R$ 5.913,78</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                  <span className="text-sm text-slate-600">Transitórias</span>
                  <span className="font-mono text-amber-600 font-medium">-R$ 5.913,78</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <Badge className="bg-emerald-100 text-emerald-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Partidas Dobradas OK
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== DASHBOARDS ========== */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-slate-300">
              <BarChart3 className="h-3 w-3 mr-1" />
              Dashboards
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Dashboards que mostram a verdade
            </h2>
            <p className="text-lg text-slate-600">
              Não mostramos gráficos bonitos. <strong>Mostramos a realidade da empresa.</strong>
            </p>
          </div>
          
          <div className="grid md:grid-cols-5 gap-4">
            {dashboardIndicators.map((indicator, i) => (
              <Card key={i} className="border-slate-200 text-center hover:border-blue-300 transition-colors cursor-pointer">
                <CardContent className="pt-6">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-slate-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-700 font-medium">{indicator}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <p className="text-center mt-8 text-slate-500 text-sm flex items-center justify-center gap-2">
            <Eye className="h-4 w-4" />
            Clique no número e vá direto ao lançamento.
          </p>
        </div>
      </section>

      {/* ========== DATA LAKE + RAG ========== */}
      <section id="data-lake" className="py-20 px-4 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 border-indigo-500/30">
                <Database className="h-3 w-3 mr-1" />
                Inteligência de Verdade
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                Data Lake + RAG
              </h2>
              <p className="text-lg text-slate-300 mb-6">
                Seus dados viram memória, não arquivos mortos
              </p>
              <p className="text-slate-400 mb-6">
                O Contta cria automaticamente um Data Lake local e seguro, organizado por tipo:
              </p>
              
              <div className="space-y-3 mb-8">
                {dataLakeItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-4">Tudo indexado para:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <Search className="h-5 w-5 mx-auto mb-2 text-indigo-400" />
                  <span className="text-slate-300 text-sm">Auditoria</span>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <Brain className="h-5 w-5 mx-auto mb-2 text-indigo-400" />
                  <span className="text-slate-300 text-sm">IA (RAG)</span>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <RefreshCw className="h-5 w-5 mx-auto mb-2 text-indigo-400" />
                  <span className="text-slate-300 text-sm">Classificação</span>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <FileCheck className="h-5 w-5 mx-auto mb-2 text-indigo-400" />
                  <span className="text-slate-300 text-sm">Histórico</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SEGURANÇA ========== */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-slate-300">
              <Lock className="h-3 w-3 mr-1" />
              Segurança e Confiança
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-slate-900">
              Não é só seguro. É auditável.
            </h2>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {securityFeatures.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section id="precos" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-slate-300">
              Planos
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Comece simples. Evolua com governança.
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`relative ${
                  plan.popular
                    ? "border-2 border-blue-500 shadow-xl shadow-blue-100"
                    : "border-slate-200"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 hover:bg-blue-600">Mais Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${
                    plan.popular ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                  } flex items-center justify-center mb-4`}>
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl text-slate-900">{plan.name}</CardTitle>
                  <CardDescription className="font-medium">{plan.subtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900">R$ {plan.price}</span>
                    <span className="text-slate-500">/mês</span>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckCircle className={`h-4 w-4 ${
                          plan.popular ? 'text-blue-600' : 'text-emerald-600'
                        } shrink-0 mt-0.5`} />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                    onClick={handleStartTrial}
                  >
                    Começar Agora
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA FINAL ========== */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 overflow-hidden">
            <CardContent className="p-12 text-center">
              <Badge className="mb-4 bg-white/10 text-white hover:bg-white/10 border-white/20">
                <Fingerprint className="h-3 w-3 mr-1" />
                Teste Gratuitamente
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Veja o Dr. Cícero trabalhando por você
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Sem compromisso • Sem cartão • Cancelamento imediato
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={handleStartTrial}
                  className="bg-blue-600 hover:bg-blue-700 h-12 px-8"
                >
                  Iniciar teste grátis por 14 dias
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleDemo}
                  className="border-white/30 text-white hover:bg-white/10 h-12 px-8"
                >
                  Agendar demonstração técnica
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-12 px-4 border-t bg-slate-900 text-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">CONTTA</span>
              </div>
              <p className="text-sm text-slate-400 mb-4 max-w-xs">
                Sistema Financeiro-Contábil AI-First
                <br />
                Feito no Brasil • Pensado para quem decide
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Produto</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#dr-cicero" className="hover:text-white transition-colors">Dr. Cícero</a></li>
                <li><a href="#super-conciliacao" className="hover:text-white transition-colors">Super Conciliação</a></li>
                <li><a href="#precos" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Segurança</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Empresa</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contato</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/terms" className="hover:text-white transition-colors">Termos</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">LGPD</a></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacidade</Link></li>
              </ul>
            </div>
          </div>
          
          <Separator className="bg-slate-800 mb-8" />
          
          <div className="text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} CONTTA</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
