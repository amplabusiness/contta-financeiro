import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, ArrowRight, Zap, Shield, Crown, BarChart3, Bot, FileText,
  Building2, Users, TrendingUp, Clock, Lock, Sparkles, ChevronRight,
  Calculator, Receipt, PiggyBank, LineChart, Brain, Wallet, BanknoteIcon,
  RefreshCw, Target, Award, Star, Menu, X
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

  const features = [
    {
      icon: <Calculator className="h-8 w-8 text-blue-600" />,
      title: "Gestão Financeira Completa",
      description: "Contas a pagar e receber, fluxo de caixa, honorários e comissões em um só lugar."
    },
    {
      icon: <Receipt className="h-8 w-8 text-green-600" />,
      title: "Contabilidade Integrada",
      description: "Plano de contas, lançamentos automáticos, DRE, Balanço e Balancete em tempo real."
    },
    {
      icon: <RefreshCw className="h-8 w-8 text-purple-600" />,
      title: "Conciliação Automática",
      description: "Importe extratos OFX e concilie automaticamente com boletos e transações."
    },
    {
      icon: <Brain className="h-8 w-8 text-amber-600" />,
      title: "Inteligência Artificial",
      description: "IA que classifica transações, identifica pagadores e prevê inadimplência."
    },
    {
      icon: <Users className="h-8 w-8 text-indigo-600" />,
      title: "Multi-Tenant",
      description: "Gerencie múltiplos escritórios e clientes com isolamento total de dados."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-rose-600" />,
      title: "Dashboards Inteligentes",
      description: "Visão executiva com KPIs, gráficos e análises de rentabilidade em tempo real."
    },
  ];

  const plans = [
    {
      name: "Starter",
      description: "Ideal para escritórios pequenos",
      price: 99,
      features: [
        "Até 50 clientes",
        "500 faturas/mês",
        "2 contas bancárias",
        "2 usuários",
        "Conciliação automática",
        "Relatórios básicos",
        "Suporte por email"
      ],
      popular: false,
      icon: <Zap className="h-6 w-6" />,
      color: "blue"
    },
    {
      name: "Professional",
      description: "Para escritórios em crescimento",
      price: 199,
      features: [
        "Até 200 clientes",
        "2.000 faturas/mês",
        "5 contas bancárias",
        "5 usuários",
        "Tudo do Starter +",
        "IA para classificação",
        "Relatórios avançados",
        "Acesso à API",
        "Suporte prioritário"
      ],
      popular: true,
      icon: <Shield className="h-6 w-6" />,
      color: "purple"
    },
    {
      name: "Enterprise",
      description: "Para grandes operações",
      price: 499,
      features: [
        "Clientes ilimitados",
        "Faturas ilimitadas",
        "Contas ilimitadas",
        "Usuários ilimitados",
        "Tudo do Professional +",
        "Agentes de IA avançados",
        "White label",
        "SLA garantido",
        "Suporte dedicado"
      ],
      popular: false,
      icon: <Crown className="h-6 w-6" />,
      color: "amber"
    }
  ];

  const testimonials = [
    {
      name: "Carlos Silva",
      role: "Contador, Silva Contabilidade",
      content: "O CONTTA revolucionou nosso escritório. A conciliação que levava horas agora é feita em minutos.",
      rating: 5
    },
    {
      name: "Maria Santos",
      role: "Gestora Financeira, Grupo ABC",
      content: "A IA de classificação é impressionante. Reduziu nosso trabalho manual em 80%.",
      rating: 5
    },
    {
      name: "Roberto Almeida",
      role: "Sócio, Almeida & Associados",
      content: "Finalmente um sistema que entende as necessidades de um escritório contábil brasileiro.",
      rating: 5
    }
  ];

  const stats = [
    { value: "98%", label: "Taxa de conciliação automática" },
    { value: "5min", label: "Tempo médio de importação" },
    { value: "440+", label: "Clientes gerenciados por tenant" },
    { value: "24/7", label: "Monitoramento com IA" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                CONTTA
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Recursos
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Preços
              </a>
              <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Depoimentos
              </a>
              <Button variant="ghost" onClick={handleLogin}>
                Entrar
              </Button>
              <Button onClick={handleStartTrial}>
                Começar Grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </nav>

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
            <nav className="md:hidden py-4 space-y-2">
              <a href="#features" className="block py-2 text-muted-foreground">Recursos</a>
              <a href="#pricing" className="block py-2 text-muted-foreground">Preços</a>
              <a href="#testimonials" className="block py-2 text-muted-foreground">Depoimentos</a>
              <div className="pt-4 space-y-2">
                <Button variant="outline" className="w-full" onClick={handleLogin}>Entrar</Button>
                <Button className="w-full" onClick={handleStartTrial}>Começar Grátis</Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Sparkles className="h-3 w-3 mr-1" />
            Potencializado por IA
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
            Gestão Financeira e Contábil
            <br />
            <span className="text-blue-600">Inteligente</span> para Escritórios
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Automatize conciliações, classifique transações com IA e tenha controle total
            das finanças dos seus clientes em uma única plataforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleStartTrial} className="text-lg px-8">
              Teste Grátis por 14 dias
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Ver Demonstração
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-400">{stat.value}</div>
                <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4">Recursos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que seu escritório precisa
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Do financeiro à contabilidade, com inteligência artificial para automatizar
              o trabalho repetitivo.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="border-2 hover:border-blue-200 transition-colors">
                <CardHeader>
                  <div className="mb-2">{feature.icon}</div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-white/20 text-white hover:bg-white/20">
                <Brain className="h-3 w-3 mr-1" />
                Inteligência Artificial
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Conheça o Dr. Cícero
              </h2>
              <p className="text-lg text-blue-100 mb-6">
                Nossa IA especializada em contabilidade que trabalha 24/7 para:
              </p>
              <ul className="space-y-4">
                {[
                  "Classificar transações automaticamente",
                  "Identificar pagadores por CNPJ/CPF",
                  "Sugerir conciliações inteligentes",
                  "Prever inadimplência",
                  "Gerar lançamentos contábeis"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold">Dr. Cícero</div>
                  <div className="text-sm text-blue-200">Assistente IA Contábil</div>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-blue-100">Identifiquei 23 transações que podem ser conciliadas automaticamente. Deseja que eu processe?</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-blue-100">Detectei um padrão de inadimplência no cliente ABC Ltda. Recomendo atenção especial.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4">Preços</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Planos que crescem com você
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comece gratuitamente e escale conforme sua necessidade.
              Todos os planos incluem suporte e atualizações.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`relative ${
                  plan.popular
                    ? "border-2 border-purple-500 shadow-lg shadow-purple-100"
                    : "border-2"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-600">Mais Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-${plan.color}-100 flex items-center justify-center text-${plan.color}-600 mb-4`}>
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">R$ {plan.price}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={handleStartTrial}
                  >
                    Começar Agora
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Todos os preços em Reais (BRL). Pagamento via cartão, Pix ou boleto.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 bg-slate-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4">Depoimentos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O que nossos clientes dizem
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">"{testimonial.content}"</p>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Pronto para transformar seu escritório?
              </h2>
              <p className="text-lg text-blue-100 mb-8">
                Comece seu teste gratuito de 14 dias. Sem compromisso.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="Seu melhor email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleStartTrial}
                  className="whitespace-nowrap"
                >
                  Começar Grátis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t bg-slate-900 text-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">CONTTA</span>
              </div>
              <p className="text-sm text-slate-400">
                Gestão financeira e contábil inteligente para escritórios modernos.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-white">Recursos</a></li>
                <li><a href="#pricing" className="hover:text-white">Preços</a></li>
                <li><a href="#" className="hover:text-white">Integrações</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white">Sobre</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Carreiras</a></li>
                <li><a href="#" className="hover:text-white">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/terms" className="hover:text-white">Termos de Serviço</Link></li>
                <li><Link to="/privacy" className="hover:text-white">Política de Privacidade</Link></li>
                <li><a href="#" className="hover:text-white">Cookies</a></li>
                <li><a href="#" className="hover:text-white">LGPD</a></li>
              </ul>
            </div>
          </div>
          <Separator className="bg-slate-800 mb-8" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} CONTTA. Todos os direitos reservados.</p>
            <p>Feito com ❤️ no Brasil</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
