import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  CreditCard, Receipt, TrendingUp, Users, FileText, Database,
  Building2, Settings, ExternalLink, AlertTriangle, CheckCircle,
  Clock, XCircle, Loader2, ArrowUpRight, Zap, Shield, Crown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { billingService } from "@/services/BillingService";
import { PlanLimit, Subscription, SubscriptionPayment, TenantUsage } from "@/lib/stripe";
import { AITeamBadge } from "@/components/AITeamBadge";

export default function Billing() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<PlanLimit | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [plans, setPlans] = useState<PlanLimit[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [redirectingToPortal, setRedirectingToPortal] = useState(false);

  useEffect(() => {
    loadBillingData();

    // Check for success/cancel from checkout
    if (searchParams.get('success') === 'true') {
      toast({
        title: "Pagamento confirmado!",
        description: "Sua assinatura foi ativada com sucesso.",
      });
    }
  }, [searchParams]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [subscriptionData, plansData, paymentsData] = await Promise.all([
        billingService.getSubscriptionWithPlan(),
        billingService.getPlans(),
        billingService.getPaymentHistory(5),
      ]);

      setSubscription(subscriptionData.subscription);
      setPlan(subscriptionData.plan);
      setUsage(subscriptionData.usage);
      setPlans(plansData);
      setPayments(paymentsData);
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as informações de faturamento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setRedirectingToPortal(true);
      await billingService.redirectToCustomerPortal();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o portal de pagamentos.",
        variant: "destructive",
      });
      setRedirectingToPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelingSubscription(true);
      await billingService.cancelSubscription(false); // Cancel at period end
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura será cancelada ao final do período atual.",
      });
      loadBillingData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível cancelar a assinatura.",
        variant: "destructive",
      });
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleUpgrade = async (newPlan: string) => {
    try {
      await billingService.redirectToCheckout(newPlan, subscription?.billing_cycle || 'monthly');
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o upgrade.",
        variant: "destructive",
      });
    }
  };

  const getUsagePercentage = (current: number, max: number): number => {
    if (max === 0) return 0; // Unlimited
    return Math.min(100, Math.round((current / max) * 100));
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'starter': return <Zap className="h-5 w-5" />;
      case 'professional': return <Shield className="h-5 w-5" />;
      case 'enterprise': return <Crown className="h-5 w-5" />;
      default: return <Building2 className="h-5 w-5" />;
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
      case 'processing': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Receipt className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <main className="flex-1 p-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <CreditCard className="h-8 w-8" />
                Faturamento
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie sua assinatura e visualize seu uso
              </p>
            </div>
            <AITeamBadge />
          </div>

          {/* Current Plan Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${billingService.getPlanBadgeColor(subscription?.plan || 'starter')}`}>
                    {getPlanIcon(subscription?.plan || 'starter')}
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Plano {plan?.display_name || 'Starter'}
                      <Badge className={billingService.getStatusBadgeColor(subscription?.status || 'active')}>
                        {billingService.translateStatus(subscription?.status || 'active')}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{plan?.description}</CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {billingService.formatPrice(subscription?.amount_cents || plan?.price_monthly_cents || 0)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{subscription?.billing_cycle === 'yearly' ? 'ano' : 'mês'}
                    </span>
                  </div>
                  {subscription?.current_period_end && (
                    <p className="text-sm text-muted-foreground">
                      Próxima cobrança: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button onClick={handleManageSubscription} disabled={redirectingToPortal}>
                  {redirectingToPortal ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Gerenciar Assinatura
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/pricing'}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Ver Planos
                </Button>
                {subscription?.status === 'active' && !subscription?.cancel_at_period_end && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        Cancelar Assinatura
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sua assinatura será cancelada ao final do período atual
                          ({subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR') : '-'}).
                          Você continuará tendo acesso até essa data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Manter Assinatura</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelSubscription}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={cancelingSubscription}
                        >
                          {cancelingSubscription && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Confirmar Cancelamento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              {subscription?.cancel_at_period_end && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-yellow-800">
                    Sua assinatura será cancelada em {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR') : '-'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usage?.clients_count || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan?.max_clients === 0 ? '∞' : plan?.max_clients}
                  </span>
                </div>
                {plan && plan.max_clients > 0 && (
                  <Progress
                    value={getUsagePercentage(usage?.clients_count || 0, plan.max_clients)}
                    className="mt-2 h-2"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Faturas/mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usage?.invoices_count || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan?.max_invoices_per_month === 0 ? '∞' : plan?.max_invoices_per_month}
                  </span>
                </div>
                {plan && plan.max_invoices_per_month > 0 && (
                  <Progress
                    value={getUsagePercentage(usage?.invoices_count || 0, plan.max_invoices_per_month)}
                    className="mt-2 h-2"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Contas Bancárias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usage?.bank_accounts_count || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan?.max_bank_accounts === 0 ? '∞' : plan?.max_bank_accounts}
                  </span>
                </div>
                {plan && plan.max_bank_accounts > 0 && (
                  <Progress
                    value={getUsagePercentage(usage?.bank_accounts_count || 0, plan.max_bank_accounts)}
                    className="mt-2 h-2"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Usuários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usage?.users_count || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan?.max_users === 0 ? '∞' : plan?.max_users}
                  </span>
                </div>
                {plan && plan.max_users > 0 && (
                  <Progress
                    value={getUsagePercentage(usage?.users_count || 0, plan.max_users)}
                    className="mt-2 h-2"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Histórico de Pagamentos
              </CardTitle>
              <CardDescription>Seus últimos pagamentos</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum pagamento registrado ainda.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {payment.paid_at
                            ? new Date(payment.paid_at).toLocaleDateString('pt-BR')
                            : new Date(payment.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {billingService.formatPrice(payment.amount_cents, payment.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentStatusIcon(payment.status)}
                            <span>{billingService.translatePaymentStatus(payment.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {payment.payment_method || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.receipt_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(payment.receipt_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Recibo
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Upgrade Suggestions */}
          {subscription?.plan !== 'enterprise' && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-purple-600" />
                  Faça um Upgrade
                </CardTitle>
                <CardDescription>
                  Desbloqueie mais recursos e aumente seus limites
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans
                    .filter(p => p.sort_order > (plans.find(x => x.plan === subscription?.plan)?.sort_order || 0))
                    .map((upgradePlan) => (
                      <div
                        key={upgradePlan.plan}
                        className="bg-white p-4 rounded-lg border shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {getPlanIcon(upgradePlan.plan)}
                          <h3 className="font-semibold">{upgradePlan.display_name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {upgradePlan.description}
                        </p>
                        <div className="text-lg font-bold mb-3">
                          {billingService.formatPrice(upgradePlan.price_monthly_cents)}/mês
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => handleUpgrade(upgradePlan.plan)}
                        >
                          Fazer Upgrade
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
