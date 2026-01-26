import { useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SubscriptionStatus {
  has_active_subscription: boolean;
  subscription_status: string;
  is_trial: boolean;
  trial_days_remaining: number;
  trial_expired: boolean;
  needs_payment: boolean;
  plan: string | null;
  current_period_end: string | null;
}

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.rpc("check_subscription_status");

      if (error) {
        console.error("Error checking subscription:", error);
        // Em caso de erro, permite acesso (fail-open para não bloquear usuários)
        setHasAccess(true);
        setLoading(false);
        return;
      }

      const status = data?.[0] as SubscriptionStatus | undefined;

      if (!status) {
        // Sem dados - provavelmente novo usuário, redireciona para pricing
        navigate("/pricing?reason=no_subscription");
        return;
      }

      if (status.needs_payment) {
        // Trial expirado ou assinatura cancelada
        if (status.trial_expired) {
          navigate("/trial-expired");
        } else {
          navigate("/pricing?reason=payment_required");
        }
        return;
      }

      // Tem acesso
      setHasAccess(true);
    } catch (err) {
      console.error("Subscription check error:", err);
      // Fail-open
      setHasAccess(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}

// Hook para usar em componentes que precisam saber o status do trial
export function useSubscriptionStatus() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase.rpc("check_subscription_status");

        if (error) {
          console.error("Error fetching subscription status:", error);
          return;
        }

        setStatus(data?.[0] as SubscriptionStatus);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  return { status, loading };
}
