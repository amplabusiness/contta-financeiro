import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionStatus {
  has_active_subscription: boolean;
  subscription_status: string;
  is_trial: boolean;
  trial_days_remaining: number;
  trial_expired: boolean;
  needs_payment: boolean;
  plan: string | null;
}

export function TrialBanner() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if banner was dismissed today
    const dismissedDate = localStorage.getItem("trial_banner_dismissed");
    if (dismissedDate === new Date().toDateString()) {
      setDismissed(true);
    }

    fetchStatus();
  }, []);

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

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("trial_banner_dismissed", new Date().toDateString());
  };

  // Don't show if loading, dismissed, or not in trial
  if (loading || dismissed || !status?.is_trial) {
    return null;
  }

  const daysRemaining = status.trial_days_remaining;
  const isUrgent = daysRemaining <= 3;

  return (
    <div
      className={`relative px-4 py-3 ${
        isUrgent
          ? "bg-gradient-to-r from-red-500 to-orange-500"
          : "bg-gradient-to-r from-blue-500 to-purple-500"
      } text-white`}
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5" />
          <span className="text-sm font-medium">
            {daysRemaining === 0 ? (
              "Seu trial expira hoje!"
            ) : daysRemaining === 1 ? (
              "Resta 1 dia de trial"
            ) : (
              `Restam ${daysRemaining} dias de trial`
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/pricing")}
            className="bg-white text-gray-900 hover:bg-gray-100"
          >
            <Zap className="h-4 w-4 mr-1" />
            Assinar Agora
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
