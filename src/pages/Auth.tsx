import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { z } from "zod";
import {
  Building2,
  Calculator,
  Scale,
  Users,
  FileText,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle,
  Briefcase,
  Award,
  BarChart3,
  Wallet,
  PieChart,
} from "lucide-react";

// Informações genéricas do sistema SaaS
const CONTTA_INFO = {
  nome: "Contta",
  slogan: "Sistema de Gestão Financeira para Escritórios Contábeis",
  descricao: "Simplifique a gestão financeira do seu escritório com automação inteligente e relatórios em tempo real.",
  recursos: [
    { icon: Calculator, texto: "Contabilidade automatizada" },
    { icon: BarChart3, texto: "Relatórios em tempo real" },
    { icon: Wallet, texto: "Gestão de honorários" },
    { icon: PieChart, texto: "Análise de rentabilidade" },
  ],
  beneficios: [
    { icon: Clock, nome: "Economia de Tempo", desc: "Automatize tarefas repetitivas" },
    { icon: Shield, nome: "Segurança", desc: "Dados protegidos e criptografados" },
    { icon: TrendingUp, nome: "Crescimento", desc: "Insights para tomada de decisão" },
    { icon: Users, nome: "Multi-tenant", desc: "Cada escritório isolado" },
  ],
};

const passwordSchema = z.string()
  .min(12, 'Senha deve ter no minimo 12 caracteres')
  .regex(/[A-Z]/, 'Deve conter letra maiuscula')
  .regex(/[a-z]/, 'Deve conter letra minuscula')
  .regex(/[0-9]/, 'Deve conter numero')
  .regex(/[^A-Za-z0-9]/, 'Deve conter caractere especial (@, !, #, etc.)');

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Define aba inicial baseado no parâmetro mode
  const defaultTab = searchParams.get("mode") === "signup" ? "signup" : "signin";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session check error:", error);
        return;
      }
      if (session) {
        navigate("/dashboard");
      }
    }).catch(err => {
      console.error("Unexpected error checking session:", err);
    });
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      passwordSchema.parse(password);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      toast.success("Conta criada com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Erro ao criar conta");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Login realizado com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast.success("E-mail de recuperacao enviado! Verifique sua caixa de entrada.");
      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar e-mail de recuperacao");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white p-8 xl:p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-white rounded-full translate-x-1/3 translate-y-1/3" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col">
          {/* Logo + Nome */}
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-white rounded-2xl p-4 xl:p-6 shadow-lg">
              <Building2 className="h-16 xl:h-20 w-16 xl:w-20 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl xl:text-3xl font-bold">{CONTTA_INFO.nome}</h1>
              <p className="text-primary-foreground/80 text-sm xl:text-base">{CONTTA_INFO.slogan}</p>
            </div>
          </div>

          {/* Descrição */}
          <div className="mb-8 xl:mb-10">
            <p className="text-lg xl:text-xl text-primary-foreground/90 leading-relaxed">
              {CONTTA_INFO.descricao}
            </p>
          </div>

          {/* Recursos - Grid */}
          <div className="grid grid-cols-2 gap-3 mb-8 xl:mb-10">
            {CONTTA_INFO.recursos.map((recurso, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
                <recurso.icon className="w-4 h-4 xl:w-5 xl:h-5 text-primary-foreground/80 flex-shrink-0" />
                <span className="text-sm text-primary-foreground/90">{recurso.texto}</span>
              </div>
            ))}
          </div>

          {/* Benefícios - Layout melhorado */}
          <div className="flex-1">
            <h3 className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-4 font-semibold">Por que escolher o Contta?</h3>
            <div className="grid grid-cols-2 gap-4">
              {CONTTA_INFO.beneficios.map((beneficio, idx) => (
                <div key={idx} className="flex items-center gap-3 group">
                  <div className="w-10 h-10 xl:w-12 xl:h-12 bg-white/10 group-hover:bg-white/20 transition-colors rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <beneficio.icon className="w-5 h-5 xl:w-6 xl:h-6 text-primary-foreground/80" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm xl:text-base">{beneficio.nome}</p>
                    <p className="text-xs text-primary-foreground/70">{beneficio.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-6 border-t border-white/10">
          <div className="flex items-center justify-center gap-2 text-sm text-primary-foreground/60">
            <Shield className="w-4 h-4" />
            <span>Seus dados protegidos com criptografia de ponta a ponta</span>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <Building2 className="h-20 w-20 text-primary mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">{CONTTA_INFO.nome}</h1>
            <p className="text-base text-gray-500 text-center">{CONTTA_INFO.slogan}</p>
          </div>

          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-2 pt-6">
              <CardTitle className="text-2xl font-bold text-gray-900">Bem-vindo</CardTitle>
              <CardDescription className="text-gray-500">Sistema de Gestão Financeira</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar Conta</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Senha</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>

                    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="link" className="w-full text-sm text-gray-500 hover:text-blue-600">
                          Esqueceu sua senha?
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Recuperar Senha</DialogTitle>
                          <DialogDescription>
                            Digite seu e-mail para receber o link de recuperacao de senha.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="reset-email">Email</Label>
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="seu@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Enviando..." : "Enviar Link de Recuperacao"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome Completo</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Seu nome"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Minimo 12 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={12}
                        className="h-11"
                      />
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>12+ caracteres</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Maiuscula, minuscula, numero e especial</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? "Criando..." : "Criar Conta"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Trust Badges */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span>Dados Seguros</span>
                  </div>
                  <div className="w-px h-4 bg-gray-200" />
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span>Multi-tenant</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-6 space-y-2">
            <Link to="/" className="text-sm text-blue-600 hover:underline">
              ← Voltar para a página inicial
            </Link>
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} {CONTTA_INFO.nome}. Todos os direitos reservados.
            </p>
            <p className="text-xs text-gray-400">
              <Link to="/terms" className="hover:underline">Termos de Serviço</Link>
              {" · "}
              <Link to="/privacy" className="hover:underline">Política de Privacidade</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
