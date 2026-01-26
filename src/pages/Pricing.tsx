import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, Zap, Shield, Crown, ArrowLeft, Loader2, Tag, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { billingService } from "@/services/BillingService";
import { PlanLimit } from "@/lib/stripe";

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanLimit[]>([]);
  const [yearlyBilling, setYearlyBilling] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponValid, setCouponValid] = useState<boolean | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<{ type: string; value: number } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();

    if (searchParams.get('canceled') === 'true') {
      toast({
        title: "Checkout cancelado",
        description: "Você pode tentar novamente quando quiser.",
      });
    }
  }, [searchParams]);

  const loadPlans = async () => {
    try {
      const data = await billingService.getPlans();
      setPlans(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar planos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;

    setCheckingCoupon(true);
    try {
      const result = await billingService.validateCoupon(couponCode);
      if (result.valid) {
        setCouponValid(true);
        setCouponDiscount({ type: result.discount_type!, value: result.discount_value! });
        toast({
          title: "Cupom válido!",
          description: result.description || `Desconto de ${result.discount_type === 'percent' ? `${result.discount_value}%` : billingService.formatPrice(result.discount_value!)}`,
        });
      } else {
        setCouponValid(false);
        setCouponDiscount(null);
        toast({
          title: "Cupom inválido",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      setCouponValid(false);
      toast({
        title: "Erro ao validar cupom",
        variant: "destructive",
      });
    } finally {
      setCheckingCoupon(false);
    }
  };

  const handleSubscribe = async (plan: string) => {
    setSubscribing(plan);
    try {
      await billingService.redirectToCheckout(
        plan,
        yearlyBilling ? 'yearly' : 'monthly',
        couponValid ? couponCode : undefined
      );
    } catch (error) {
      toast({
        title: "Erro ao iniciar checkout",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      setSubscribing(null);
    }
  };

  const getPrice = (plan: PlanLimit): number => {
    const basePrice = yearlyBilling ? plan.price_yearly_cents : plan.price_monthly_cents;

    if (couponValid && couponDiscount) {
      if (couponDiscount.type === 'percent') {
        return basePrice - (basePrice * couponDiscount.value / 100);
      } else {
        return Math.max(0, basePrice - couponDiscount.value);
      }
    }

    return basePrice;
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'starter': return <Zap className="h-6 w-6" />;
      case 'professional': return <Shield className="h-6 w-6" />;
      case 'enterprise': return <Crown className="h-6 w-6" />;
      default: return <Zap className="h-6 w-6" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName) {
      case 'starter': return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
      case 'professional': return { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-500' };
      case 'enterprise': return { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    }
  };

  const getFeaturesList = (plan: PlanLimit): string[] => {
    const features: string[] = [];

    if (plan.max_clients === 0) {
      features.push("Clientes ilimitados");
    } else {
      features.push(`Até ${plan.max_clients} clientes`);
    }

    if (plan.max_invoices_per_month === 0) {
      features.push("Faturas ilimitadas");
    } else {
      features.push(`${plan.max_invoices_per_month.toLocaleString()} faturas/mês`);
    }

    if (plan.max_bank_accounts === 0) {
      features.push("Contas bancárias ilimitadas");
    } else {
      features.push(`${plan.max_bank_accounts} contas bancárias`);
    }

    if (plan.max_users === 0) {
      features.push("Usuários ilimitados");
    } else {
      features.push(`${plan.max_users} usuários`);
    }

    // Add features from JSONB
    const featureMap: Record<string, string> = {
      conciliacao_automatica: "Conciliação automática",
      relatorios_basicos: "Relatórios básicos",
      relatorios_avancados: "Relatórios avançados",
      ia_classificacao: "IA para classificação",
      ia_agentes: "Agentes de IA avançados",
      suporte_email: "Suporte por email",
      suporte_prioritario: "Suporte prioritário",
      suporte_dedicado: "Suporte dedicado",
      api_access: "Acesso à API",
      white_label: "White label",
      sla_garantido: "SLA garantido",
    };

    Object.entries(plan.features || {}).forEach(([key, value]) => {
      if (value && featureMap[key]) {
        features.push(featureMap[key]);
      }
    });

    return features;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div className="text-center mb-12">
          <Badge className="mb-4">Planos e Preços</Badge>
          <h1 className="text-4xl font-bold mb-4">
            Escolha o plano ideal para seu escritório
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Todos os planos incluem acesso completo às funcionalidades, suporte e atualizações.
            Escale conforme sua necessidade.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={!yearlyBilling ? "font-medium" : "text-muted-foreground"}>
              Mensal
            </span>
            <Switch
              checked={yearlyBilling}
              onCheckedChange={setYearlyBilling}
            />
            <span className={yearlyBilling ? "font-medium" : "text-muted-foreground"}>
              Anual
              <Badge className="ml-2 bg-green-100 text-green-700">
                Economize 17%
              </Badge>
            </span>
          </div>

          {/* Coupon Input */}
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Código do cupom"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponValid(null);
                }}
                className="pl-10"
              />
              {couponValid !== null && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {couponValid ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleValidateCoupon}
              disabled={!couponCode.trim() || checkingCoupon}
            >
              {checkingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
            </Button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const colors = getPlanColor(plan.plan);
            const isPopular = plan.plan === 'professional';
            const features = getFeaturesList(plan);
            const originalPrice = yearlyBilling ? plan.price_yearly_cents : plan.price_monthly_cents;
            const finalPrice = getPrice(plan);
            const hasDiscount = originalPrice !== finalPrice;

            return (
              <Card
                key={plan.plan}
                className={`relative ${isPopular ? `border-2 ${colors.border} shadow-lg` : "border-2"}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-600">Mais Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center ${colors.text} mb-4`}>
                    {getPlanIcon(plan.plan)}
                  </div>
                  <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    {hasDiscount && (
                      <div className="text-lg text-muted-foreground line-through">
                        {billingService.formatPrice(originalPrice)}
                      </div>
                    )}
                    <span className="text-4xl font-bold">
                      {billingService.formatPrice(finalPrice)}
                    </span>
                    <span className="text-muted-foreground">
                      /{yearlyBilling ? "ano" : "mês"}
                    </span>
                    {yearlyBilling && (
                      <p className="text-sm text-muted-foreground mt-1">
                        equivalente a {billingService.formatPrice(Math.round(finalPrice / 12))}/mês
                      </p>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {features.map((feature, j) => (
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
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.plan)}
                    disabled={subscribing !== null}
                  >
                    {subscribing === plan.plan ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {subscribing === plan.plan ? "Processando..." : "Assinar Agora"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ / Info */}
        <div className="max-w-3xl mx-auto">
          <Separator className="mb-8" />
          <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
            <div>
              <h4 className="font-medium text-foreground mb-2">Formas de pagamento</h4>
              <p>Aceitamos cartão de crédito, Pix e boleto bancário.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Cancelamento</h4>
              <p>Cancele a qualquer momento. Sem multas ou taxas.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Trial gratuito</h4>
              <p>Teste gratuitamente por 14 dias. Sem cartão de crédito.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Suporte</h4>
              <p>Todos os planos incluem suporte por email. Professional e Enterprise têm suporte prioritário.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
