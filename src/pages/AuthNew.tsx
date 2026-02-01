/**
 * 🔐 CONTTA - AUTH PAGE
 * 
 * Página de autenticação premium com Design System Maestro UX
 * Layout institucional e seguro
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, AuthCard, AuthLink } from "@/design-system/layouts";
import { Button, Input, FormField } from "@/design-system/components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ═══════════════════════════════════════════════════════════════
// 🔒 VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

const passwordSchema = z
  .string()
  .min(8, "Mínimo de 8 caracteres")
  .regex(/[A-Z]/, "Pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "Pelo menos uma letra minúscula")
  .regex(/[0-9]/, "Pelo menos um número");

const emailSchema = z.string().email("Email inválido");

// ═══════════════════════════════════════════════════════════════
// 🏠 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  
  // Form data
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  
  // Errors
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  
  // Default tab from URL
  const defaultTab = searchParams.get("mode") === "signup" ? "signup" : "signin";

  // Redirect if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });
  }, [navigate]);

  // ═══════════════════════════════════════════════════════════════
  // 🔐 HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const validateEmail = (value: string) => {
    const result = emailSchema.safeParse(value);
    setEmailError(result.success ? "" : result.error.errors[0].message);
    return result.success;
  };

  const validatePassword = (value: string, isSignup: boolean) => {
    if (isSignup) {
      const result = passwordSchema.safeParse(value);
      setPasswordError(result.success ? "" : result.error.errors[0].message);
      return result.success;
    }
    // For login, just check if not empty
    if (!value) {
      setPasswordError("Senha é obrigatória");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const validateName = (value: string) => {
    if (!value || value.trim().length < 2) {
      setNameError("Nome é obrigatório");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password, false);
    
    if (!isEmailValid || !isPasswordValid) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        if (error.message.includes("Invalid login")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Login realizado com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isNameValid = validateName(fullName);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password, true);
    
    if (!isNameValid || !isEmailValid || !isPasswordValid) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Conta criada! Verifique seu email para confirmar.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail || !emailSchema.safeParse(resetEmail).success) {
      toast.error("Digite um email válido");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar email de recuperação");
    } finally {
      setLoading(false);
    }
  };

  // Clear errors when switching tabs
  const handleTabChange = () => {
    setEmailError("");
    setPasswordError("");
    setNameError("");
  };

  // ═══════════════════════════════════════════════════════════════
  // 🎨 RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <AuthLayout
      title="Bem-vindo ao Contta"
      subtitle="Plataforma de Governança Financeira com IA"
    >
      <AuthCard>
        <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar Conta</TabsTrigger>
          </TabsList>

          {/* ═══ SIGN IN ═══ */}
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <FormField label="Email" error={emailError}>
                <Input
                  type="email"
                  placeholder="financeiro@seuescritorio.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => email && validateEmail(email)}
                  error={!!emailError}
                  disabled={loading}
                  autoComplete="email"
                />
              </FormField>

              <FormField label="Senha" error={passwordError}>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={!!passwordError}
                    disabled={loading}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormField>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar no Sistema"
                )}
              </Button>

              <div className="text-center">
                <AuthLink onClick={() => setResetDialogOpen(true)}>
                  Esqueceu sua senha?
                </AuthLink>
              </div>
            </form>
          </TabsContent>

          {/* ═══ SIGN UP ═══ */}
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <FormField label="Nome Completo" error={nameError}>
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => fullName && validateName(fullName)}
                  error={!!nameError}
                  disabled={loading}
                  autoComplete="name"
                />
              </FormField>

              <FormField label="Email" error={emailError}>
                <Input
                  type="email"
                  placeholder="financeiro@seuescritorio.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => email && validateEmail(email)}
                  error={!!emailError}
                  disabled={loading}
                  autoComplete="email"
                />
              </FormField>

              <FormField 
                label="Senha" 
                error={passwordError}
                hint="Mínimo 8 caracteres, incluindo maiúscula, minúscula e número"
              >
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => password && validatePassword(password, true)}
                    error={!!passwordError}
                    disabled={loading}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormField>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Criando conta...
                  </>
                ) : (
                  "Criar Conta Grátis"
                )}
              </Button>

              <p className="text-xs text-center text-neutral-500">
                Ao criar uma conta, você concorda com nossos{" "}
                <a href="#" className="text-primary-600 hover:underline">Termos de Uso</a>
                {" "}e{" "}
                <a href="#" className="text-primary-600 hover:underline">Política de Privacidade</a>
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </AuthCard>

      {/* ═══ PASSWORD RESET DIALOG ═══ */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu email para receber o link de recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <FormField label="Email">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </FormField>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetDialogOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Link"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
}
