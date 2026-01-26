import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, AlertTriangle, Zap, Shield, Crown, CheckCircle, ArrowRight, LogOut
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function TrialExpired() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const plans = [
    {
      name: "Starter",
      price: 99,
      icon: <Zap className="h-5 w-5" />,
      color: "blue",
      features: ["50 clientes", "500 faturas/mês", "2 usuários"],
    },
    {
      name: "Professional",
      price: 199,
      icon: <Shield className="h-5 w-5" />,
      color: "purple",
      popular: true,
      features: ["200 clientes", "2.000 faturas/mês", "IA classificação"],
    },
    {
      name: "Enterprise",
      price: 499,
      icon: <Crown className="h-5 w-5" />,
      color: "amber",
      features: ["Ilimitado", "Suporte dedicado", "SLA garantido"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Seu período de teste expirou
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Os 14 dias de teste gratuito terminaram. Para continuar usando o CONTTA,
            escolha um plano que atenda às suas necessidades.
          </p>
        </div>

        {/* Trial Info */}
        <Card className="mb-8 border-red-200 bg-red-50/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Clock className="h-10 w-10 text-red-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Seus dados estão seguros</h3>
                <p className="text-sm text-gray-600">
                  Todos os seus dados foram preservados. Ao assinar um plano, você terá
                  acesso imediato a tudo novamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.popular ? "border-2 border-purple-500 shadow-lg" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-purple-600">Recomendado</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className={`w-10 h-10 rounded-lg bg-${plan.color}-100 flex items-center justify-center text-${plan.color}-600 mb-2`}>
                  {plan.icon}
                </div>
                <CardTitle>{plan.name}</CardTitle>
                <div className="text-2xl font-bold">
                  R$ {plan.price}<span className="text-sm font-normal text-gray-500">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => navigate("/pricing")}
                >
                  Escolher Plano
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <Button size="lg" onClick={() => navigate("/pricing")} className="px-8">
            Ver todos os planos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <div>
            <Button variant="ghost" onClick={handleLogout} className="text-gray-500">
              <LogOut className="mr-2 h-4 w-4" />
              Sair da conta
            </Button>
          </div>
        </div>

        {/* Support */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            Precisa de ajuda? Entre em contato:{" "}
            <a href="mailto:suporte@contta.com.br" className="text-blue-600 hover:underline">
              suporte@contta.com.br
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
