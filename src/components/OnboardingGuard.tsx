/**
 * OnboardingGuard - Componente que protege rotas exigindo onboarding completo
 *
 * Este componente verifica se o tenant do usuário completou o onboarding.
 * Se não completou, redireciona para /onboarding.
 *
 * EXEMPLO DE USO no App.tsx:
 *
 * ```tsx
 * <Route path="/dashboard" element={
 *   <OnboardingGuard>
 *     <Layout><Dashboard /></Layout>
 *   </OnboardingGuard>
 * } />
 * ```
 */

import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { Loader2 } from "lucide-react";

interface OnboardingGuardProps {
  children: ReactNode;
}

// Rotas que não precisam de onboarding completo
const EXEMPT_ROUTES = [
  '/auth',
  '/onboarding',
  '/logout',
];

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant, loading, error, isOnboardingComplete } = useTenantConfig();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Não fazer nada enquanto carrega
    if (loading) return;

    // Verificar se a rota atual está isenta
    const isExemptRoute = EXEMPT_ROUTES.some(route =>
      location.pathname.startsWith(route)
    );

    if (isExemptRoute) {
      setChecked(true);
      return;
    }

    // Se não tem tenant (erro ou não autenticado), deixar o Layout lidar
    if (!tenant) {
      setChecked(true);
      return;
    }

    // Se onboarding não foi completado, redirecionar
    if (!isOnboardingComplete) {
      console.log('[OnboardingGuard] Onboarding não completado, redirecionando...');
      navigate('/onboarding', { replace: true });
      return;
    }

    // Tudo ok, permitir acesso
    setChecked(true);
  }, [loading, tenant, isOnboardingComplete, location.pathname, navigate]);

  // Mostrar loading enquanto verifica
  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando configurações...</p>
        </div>
      </div>
    );
  }

  // Se houver erro, mostrar mensagem (mas não bloquear)
  if (error) {
    console.warn('[OnboardingGuard] Erro ao carregar tenant config:', error);
  }

  return <>{children}</>;
}

export default OnboardingGuard;
