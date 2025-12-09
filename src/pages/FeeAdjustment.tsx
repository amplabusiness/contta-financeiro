import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  Loader2,
  Calculator,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  History,
  Settings,
  Play,
  DollarSign,
  Cloud,
  Download,
  Wallet,
  Users,
  Target,
  BarChart3,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MinimumWage {
  id: string;
  effective_date: string;
  end_date: string | null;
  value: number;
  source: string | null;
  notes: string | null;
}

interface ClientPendingAdjustment {
  id: string;
  name: string;
  cnpj: string | null;
  current_fee: number;
  fee_in_minimum_wages: number | null;
  last_fee_adjustment_date: string | null;
  last_adjustment_minimum_wage: number | null;
  current_minimum_wage: number;
  expected_fee: number;
  fee_difference: number;
  adjustment_status: string;
  auto_adjust_by_minimum_wage: boolean;
}

interface AdjustmentHistory {
  id: string;
  client_id: string;
  client_name: string;
  adjustment_date: string;
  previous_fee: number;
  new_fee: number;
  previous_minimum_wage: number;
  new_minimum_wage: number;
  fee_in_minimum_wages: number;
  adjustment_percentage: number;
  adjustment_type: string;
  notes: string | null;
}

const FeeAdjustment = () => {
  const [loading, setLoading] = useState(true);
  const [minimumWages, setMinimumWages] = useState<MinimumWage[]>([]);
  const [pendingClients, setPendingClients] = useState<ClientPendingAdjustment[]>([]);
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentHistory[]>([]);
  const [currentMinWage, setCurrentMinWage] = useState<number>(0);
  const [stats, setStats] = useState({
    totalClients: 0,
    pendingAdjustment: 0,
    neverAdjusted: 0,
    upToDate: 0,
    totalDifference: 0,
    // KPIs analíticos
    totalMonthlyRevenue: 0,
    totalMinimumWages: 0,
    averageFeeInMinWages: 0,
    clientsWithMinWageConfig: 0,
    minFeeInMinWages: 0,
    maxFeeInMinWages: 0
  });

  // Modal states
  const [addWageDialogOpen, setAddWageDialogOpen] = useState(false);
  const [batchAdjustDialogOpen, setBatchAdjustDialogOpen] = useState(false);
  const [initClientDialogOpen, setInitClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientPendingAdjustment | null>(null);

  // Form states
  const [newWageForm, setNewWageForm] = useState({
    effective_date: "",
    value: "",
    notes: ""
  });
  const [referenceDate, setReferenceDate] = useState("");
  const [applyingBatch, setApplyingBatch] = useState(false);
  const [syncingMinWage, setSyncingMinWage] = useState(false);
  const [initializingAll, setInitializingAll] = useState(false);
  const [initAllDialogOpen, setInitAllDialogOpen] = useState(false);

  const loadMinimumWages = useCallback(async () => {
    const { data, error } = await supabase
      .from("minimum_wage_history")
      .select("*")
      .order("effective_date", { ascending: false });

    if (error) throw error;
    setMinimumWages(data || []);
    if (data && data.length > 0) {
      setCurrentMinWage(data[0].value);
    }
  }, []);

  const loadPendingClients = useCallback(async () => {
    const { data, error } = await supabase
      .from("v_clients_pending_adjustment")
      .select("*")
      .order("adjustment_status", { ascending: true });

    if (error) {
      console.error("Erro ao carregar view:", error);
      // Se a view não existir, buscar manualmente
      return;
    }

    setPendingClients(data || []);

    // Calcular estatísticas
    const clients = data || [];
    const totalClients = clients.length;
    const pendingAdjustment = clients.filter(c => c.adjustment_status === 'REAJUSTE_PENDENTE').length;
    const neverAdjusted = clients.filter(c => c.adjustment_status === 'NUNCA_AJUSTADO').length;
    const upToDate = clients.filter(c => c.adjustment_status === 'ATUALIZADO').length;
    const totalDifference = clients.reduce((sum, c) => sum + (c.fee_difference || 0), 0);

    // KPIs analíticos
    const totalMonthlyRevenue = clients.reduce((sum, c) => sum + (c.current_fee || 0), 0);
    const clientsWithMinWageConfig = clients.filter(c => c.fee_in_minimum_wages && c.fee_in_minimum_wages > 0).length;
    const totalMinimumWages = clients.reduce((sum, c) => sum + (c.fee_in_minimum_wages || 0), 0);
    const averageFeeInMinWages = clientsWithMinWageConfig > 0 ? totalMinimumWages / clientsWithMinWageConfig : 0;

    // Min/Max
    const feesInMinWages = clients
      .filter(c => c.fee_in_minimum_wages && c.fee_in_minimum_wages > 0)
      .map(c => c.fee_in_minimum_wages as number);
    const minFeeInMinWages = feesInMinWages.length > 0 ? Math.min(...feesInMinWages) : 0;
    const maxFeeInMinWages = feesInMinWages.length > 0 ? Math.max(...feesInMinWages) : 0;

    setStats({
      totalClients,
      pendingAdjustment,
      neverAdjusted,
      upToDate,
      totalDifference,
      totalMonthlyRevenue,
      totalMinimumWages,
      averageFeeInMinWages,
      clientsWithMinWageConfig,
      minFeeInMinWages,
      maxFeeInMinWages
    });
  }, []);

  const loadAdjustmentHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("fee_adjustment_history")
      .select(`
        *,
        clients:client_id (name)
      `)
      .order("adjustment_date", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Erro ao carregar histórico:", error);
      return;
    }

    const enrichedData = (data || []).map(item => ({
      ...item,
      client_name: item.clients?.name || "Cliente desconhecido"
    }));

    setAdjustmentHistory(enrichedData);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMinimumWages(),
        loadPendingClients(),
        loadAdjustmentHistory()
      ]);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [loadMinimumWages, loadPendingClients, loadAdjustmentHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddMinimumWage = async () => {
    try {
      if (!newWageForm.effective_date || !newWageForm.value) {
        toast.error("Preencha data e valor do salário mínimo");
        return;
      }

      const { error } = await supabase
        .from("minimum_wage_history")
        .insert({
          effective_date: newWageForm.effective_date,
          value: parseFloat(newWageForm.value),
          notes: newWageForm.notes || null
        });

      if (error) throw error;

      toast.success("Salário mínimo adicionado com sucesso!");
      setAddWageDialogOpen(false);
      setNewWageForm({ effective_date: "", value: "", notes: "" });
      loadData();
    } catch (error: any) {
      console.error("Erro ao adicionar SM:", error);
      toast.error(error.message || "Erro ao adicionar salário mínimo");
    }
  };

  const handleInitClient = async () => {
    if (!selectedClient) return;

    try {
      const { data, error } = await supabase
        .rpc("init_client_minimum_wage_fee", {
          p_client_id: selectedClient.id,
          p_reference_date: referenceDate || null
        });

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success(result.message);
        setInitClientDialogOpen(false);
        setSelectedClient(null);
        setReferenceDate("");
        loadData();
      } else {
        toast.error(result?.message || "Erro ao inicializar cliente");
      }
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao inicializar honorário em SM");
    }
  };

  const handleApplyAdjustment = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .rpc("apply_fee_adjustment", {
          p_client_id: clientId,
          p_notes: "Reajuste manual via interface"
        });

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.warning(result?.message || "Não foi possível aplicar reajuste");
      }
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao aplicar reajuste");
    }
  };

  const handleBatchAdjustment = async (dryRun: boolean) => {
    try {
      setApplyingBatch(true);
      const { data, error } = await supabase
        .rpc("batch_apply_fee_adjustments", {
          p_only_pending: true,
          p_dry_run: dryRun
        });

      if (error) throw error;

      const results = data || [];
      const applied = results.filter((r: any) => r.status === 'APLICADO').length;
      const simulated = results.filter((r: any) => r.status === 'SIMULADO').length;
      const ignored = results.filter((r: any) => r.status?.includes('IGNORADO')).length;

      if (dryRun) {
        toast.info(`Simulação: ${simulated} clientes seriam reajustados, ${ignored} ignorados`);
      } else {
        toast.success(`Reajuste aplicado em ${applied} clientes`);
        loadData();
      }

      setBatchAdjustDialogOpen(false);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao processar reajustes em lote");
    } finally {
      setApplyingBatch(false);
    }
  };

  const handleInitializeAll = async () => {
    try {
      setInitializingAll(true);
      const clientsToInit = pendingClients.filter(c => c.adjustment_status === 'NUNCA_AJUSTADO');

      if (clientsToInit.length === 0) {
        toast.info("Não há clientes para inicializar");
        return;
      }

      toast.info(`Inicializando ${clientsToInit.length} clientes...`);

      let success = 0;
      let failed = 0;

      for (const client of clientsToInit) {
        try {
          const { data, error } = await supabase
            .rpc("init_client_minimum_wage_fee", {
              p_client_id: client.id,
              p_reference_date: null
            });

          if (error) {
            console.error(`Erro ao inicializar ${client.name}:`, error);
            failed++;
          } else {
            const result = data?.[0];
            if (result?.success) {
              success++;
            } else {
              failed++;
            }
          }
        } catch (err) {
          console.error(`Erro ao inicializar ${client.name}:`, err);
          failed++;
        }
      }

      if (success > 0) {
        toast.success(`${success} clientes inicializados com sucesso!${failed > 0 ? ` (${failed} falharam)` : ''}`);
        loadData();
      } else {
        toast.error(`Falha ao inicializar clientes. ${failed} erros.`);
      }

      setInitAllDialogOpen(false);
    } catch (error: any) {
      console.error("Erro ao inicializar todos:", error);
      toast.error(error.message || "Erro ao inicializar clientes");
    } finally {
      setInitializingAll(false);
    }
  };

  const handleSyncMinimumWage = async () => {
    try {
      setSyncingMinWage(true);
      toast.info("Sincronizando salários mínimos do Banco Central...");

      const { data, error } = await supabase.functions.invoke('sync-minimum-wage', {
        body: { action: 'sync' }
      });

      if (error) throw error;

      if (data?.success) {
        const stats = data.stats;
        toast.success(
          `Sincronização concluída! ${stats.inserted} novos registros, ${stats.updated} atualizados. SM atual: ${formatCurrency(stats.current_minimum_wage)}`
        );
        loadData();
      } else {
        toast.error(data?.error || "Erro na sincronização");
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar SM:", error);
      toast.error(error.message || "Erro ao sincronizar salário mínimo");
    } finally {
      setSyncingMinWage(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NUNCA_AJUSTADO":
        return <Badge variant="destructive">Nunca Ajustado</Badge>;
      case "REAJUSTE_PENDENTE":
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Reajuste Pendente</Badge>;
      case "ATUALIZADO":
        return <Badge variant="default" className="bg-green-500">Atualizado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Reajuste de Honorários</h1>
              <p className="text-muted-foreground">
                Gerenciamento de reajustes automáticos por salário mínimo
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {stats.neverAdjusted > 0 && (
              <Button
                variant="default"
                onClick={() => setInitAllDialogOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Zap className="h-4 w-4 mr-2" />
                Inicializar Todos ({stats.neverAdjusted})
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSyncMinimumWage}
              disabled={syncingMinWage}
            >
              {syncingMinWage ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4 mr-2" />
              )}
              Sincronizar SM (BCB)
            </Button>
            <Button variant="outline" onClick={() => setAddWageDialogOpen(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Novo SM Manual
            </Button>
            <Button onClick={() => setBatchAdjustDialogOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              Reajuste em Lote
            </Button>
          </div>
        </div>

        {/* Stats Cards - Status */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                SM Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(currentMinWage)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingAdjustment}</div>
            </CardContent>
          </Card>

          <Card className="border-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">
                Nunca Ajustados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.neverAdjusted}</div>
            </CardContent>
          </Card>

          <Card className="border-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">
                Atualizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.upToDate}</div>
            </CardContent>
          </Card>
        </div>

        {/* KPIs Analíticos - Receita em Salários Mínimos */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <BarChart3 className="h-5 w-5" />
              Análise de Receita em Salários Mínimos
            </CardTitle>
            <CardDescription>
              Visão consolidada da receita mensal expressa em salários mínimos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {/* Total Receita Mensal */}
              <div className="p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-muted-foreground">Receita Mensal Total</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(stats.totalMonthlyRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalClients} clientes ativos
                </p>
              </div>

              {/* Total em Salários Mínimos */}
              <div className="p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-indigo-600" />
                  <span className="text-sm font-medium text-muted-foreground">Total em SM</span>
                </div>
                <p className="text-2xl font-bold text-indigo-700">{stats.totalMinimumWages.toFixed(2)} SM</p>
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatCurrency(stats.totalMinimumWages * currentMinWage)}
                </p>
              </div>

              {/* Média por Cliente */}
              <div className="p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-muted-foreground">Média por Cliente</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">{stats.averageFeeInMinWages.toFixed(2)} SM</p>
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatCurrency(stats.averageFeeInMinWages * currentMinWage)}/cliente
                </p>
              </div>

              {/* Range Min/Max */}
              <div className="p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-muted-foreground">Faixa de Valores</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold text-green-700">{stats.minFeeInMinWages.toFixed(2)}</p>
                  <span className="text-muted-foreground">a</span>
                  <p className="text-lg font-bold text-green-700">{stats.maxFeeInMinWages.toFixed(2)} SM</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.clientsWithMinWageConfig} clientes configurados
                </p>
              </div>
            </div>

            {/* Projeção */}
            {stats.totalMinimumWages > 0 && currentMinWage > 0 && (
              <div className="mt-4 p-4 bg-blue-100 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Projeção Anual:</strong> Se o SM for reajustado em 5%, sua receita mensal aumentará em{" "}
                  <strong>{formatCurrency(stats.totalMinimumWages * currentMinWage * 0.05)}</strong>,
                  totalizando <strong>{formatCurrency(stats.totalMinimumWages * currentMinWage * 1.05)}</strong>/mês.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diferença Total */}
        {stats.totalDifference > 0 && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-800">
                    Diferença total de receita mensal: {formatCurrency(stats.totalDifference)}
                  </p>
                  <p className="text-sm text-yellow-700">
                    Este é o valor que você está deixando de receber por não ter reajustado os honorários
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Pendentes ({stats.pendingAdjustment + stats.neverAdjusted})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="wages">
              <Settings className="h-4 w-4 mr-2" />
              Salários Mínimos
            </TabsTrigger>
          </TabsList>

          {/* Tab: Pendentes */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Clientes com Reajuste Pendente</CardTitle>
                <CardDescription>
                  Clientes que precisam ter o honorário reajustado pelo salário mínimo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingClients.filter(c => c.adjustment_status !== 'ATUALIZADO').length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="font-semibold">Todos os clientes estão atualizados!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Honorário Atual</TableHead>
                          <TableHead className="text-right">SM (qtd)</TableHead>
                          <TableHead className="text-right">Esperado</TableHead>
                          <TableHead className="text-right">Diferença</TableHead>
                          <TableHead>Último Reajuste</TableHead>
                          <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingClients
                          .filter(c => c.adjustment_status !== 'ATUALIZADO')
                          .map((client) => (
                            <TableRow key={client.id}>
                              <TableCell className="font-medium">{client.name}</TableCell>
                              <TableCell>{getStatusBadge(client.adjustment_status)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(client.current_fee)}</TableCell>
                              <TableCell className="text-right">
                                {client.fee_in_minimum_wages?.toFixed(4) || "-"}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(client.expected_fee)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-yellow-600">
                                +{formatCurrency(client.fee_difference)}
                              </TableCell>
                              <TableCell>
                                {client.last_fee_adjustment_date
                                  ? formatDate(client.last_fee_adjustment_date)
                                  : <span className="text-red-500">Nunca</span>
                                }
                              </TableCell>
                              <TableCell className="text-center">
                                {client.fee_in_minimum_wages ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleApplyAdjustment(client.id)}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Reajustar
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedClient(client);
                                      setInitClientDialogOpen(true);
                                    }}
                                  >
                                    <Calculator className="h-4 w-4 mr-1" />
                                    Inicializar
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Reajustes</CardTitle>
                <CardDescription>
                  Últimos 50 reajustes aplicados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {adjustmentHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum reajuste registrado ainda</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">De</TableHead>
                          <TableHead className="text-right">Para</TableHead>
                          <TableHead className="text-right">Variação</TableHead>
                          <TableHead className="text-right">SM Anterior</TableHead>
                          <TableHead className="text-right">SM Novo</TableHead>
                          <TableHead>Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adjustmentHistory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{formatDate(item.adjustment_date)}</TableCell>
                            <TableCell className="font-medium">{item.client_name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.previous_fee)}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(item.new_fee)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.adjustment_percentage > 0 ? "default" : "secondary"}>
                                {item.adjustment_percentage > 0 ? "+" : ""}{item.adjustment_percentage?.toFixed(2)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.previous_minimum_wage)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.new_minimum_wage)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.adjustment_type}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Salários Mínimos */}
          <TabsContent value="wages">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Histórico do Salário Mínimo</CardTitle>
                  <CardDescription>
                    Valores históricos usados para cálculo de reajustes
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSyncMinimumWage}
                    disabled={syncingMinWage}
                  >
                    {syncingMinWage ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Sincronizar BCB
                  </Button>
                  <Button onClick={() => setAddWageDialogOpen(true)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Adicionar Manual
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vigência Início</TableHead>
                        <TableHead>Vigência Fim</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {minimumWages.map((wage, index) => (
                        <TableRow key={wage.id}>
                          <TableCell>
                            {formatDate(wage.effective_date)}
                            {index === 0 && (
                              <Badge className="ml-2 bg-green-500">Atual</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {wage.end_date ? formatDate(wage.end_date) : (
                              <span className="text-green-600 font-medium">Vigente</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(wage.value)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={wage.source === 'BCB_SGS_1619' ? 'default' : 'outline'}>
                              {wage.source === 'BCB_SGS_1619' ? 'Banco Central' : wage.source || 'Manual'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {wage.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog: Adicionar Salário Mínimo */}
        <Dialog open={addWageDialogOpen} onOpenChange={setAddWageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Salário Mínimo</DialogTitle>
              <DialogDescription>
                Registre um novo valor do salário mínimo com sua data de vigência
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="wage_date">Data de Vigência</Label>
                <Input
                  id="wage_date"
                  type="date"
                  value={newWageForm.effective_date}
                  onChange={(e) => setNewWageForm({ ...newWageForm, effective_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wage_value">Valor (R$)</Label>
                <Input
                  id="wage_value"
                  type="number"
                  step="0.01"
                  placeholder="1518.00"
                  value={newWageForm.value}
                  onChange={(e) => setNewWageForm({ ...newWageForm, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wage_notes">Observações (opcional)</Label>
                <Input
                  id="wage_notes"
                  placeholder="Ex: SM 2025"
                  value={newWageForm.notes}
                  onChange={(e) => setNewWageForm({ ...newWageForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddWageDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddMinimumWage}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Inicializar Cliente */}
        <Dialog open={initClientDialogOpen} onOpenChange={setInitClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inicializar Honorário em Salários Mínimos</DialogTitle>
              <DialogDescription>
                Configure a base de cálculo para reajustes automáticos de {selectedClient?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Honorário atual:</strong> {formatCurrency(selectedClient?.current_fee || 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Selecione a data de referência para calcular quantos salários mínimos o honorário representa.
                  Se não informar, será usada a data de cadastro do cliente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref_date">Data de Referência (opcional)</Label>
                <Input
                  id="ref_date"
                  type="date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use a data em que o honorário foi definido ou a data do contrato
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInitClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInitClient}>
                <Calculator className="h-4 w-4 mr-2" />
                Calcular e Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Reajuste em Lote */}
        <AlertDialog open={batchAdjustDialogOpen} onOpenChange={setBatchAdjustDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reajuste em Lote</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-4">
                  <p>
                    Esta ação irá reajustar todos os {stats.pendingAdjustment} clientes pendentes
                    com base no salário mínimo atual de {formatCurrency(currentMinWage)}.
                  </p>
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>Atenção:</strong> Esta operação não pode ser desfeita automaticamente.
                      Recomendamos fazer uma simulação primeiro.
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={applyingBatch}>Cancelar</AlertDialogCancel>
              <Button
                variant="outline"
                onClick={() => handleBatchAdjustment(true)}
                disabled={applyingBatch}
              >
                {applyingBatch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Simular
              </Button>
              <AlertDialogAction
                onClick={() => handleBatchAdjustment(false)}
                disabled={applyingBatch}
                className="bg-primary"
              >
                {applyingBatch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Aplicar Reajustes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Inicializar Todos */}
        <AlertDialog open={initAllDialogOpen} onOpenChange={setInitAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-600" />
                Inicializar Todos os Clientes
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-4">
                  <p>
                    Esta ação irá calcular automaticamente o valor em salários mínimos para{" "}
                    <strong>{stats.neverAdjusted} clientes</strong> que nunca foram ajustados.
                  </p>
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-sm text-indigo-800 mb-2">
                      <strong>Como funciona:</strong>
                    </p>
                    <ul className="text-sm text-indigo-700 list-disc list-inside space-y-1">
                      <li>Cada honorário será dividido pelo SM atual ({formatCurrency(currentMinWage)})</li>
                      <li>O resultado será salvo como quantidade de SM</li>
                      <li>Exemplo: R$ 1.518,00 ÷ {formatCurrency(currentMinWage)} = 1,00 SM</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Projeção:</strong> Com base na receita total de {formatCurrency(stats.totalMonthlyRevenue)},
                      serão aproximadamente <strong>{(stats.totalMonthlyRevenue / currentMinWage).toFixed(2)} SM</strong> no total.
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={initializingAll}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleInitializeAll}
                disabled={initializingAll}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {initializingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Inicializando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Inicializar Todos
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default FeeAdjustment;
