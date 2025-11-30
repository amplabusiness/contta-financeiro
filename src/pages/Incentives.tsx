import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Gift,
  Trophy,
  DollarSign,
  Users,
  TrendingUp,
  Target,
  Medal,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Banknote,
  Percent,
  Calendar,
  Award,
  Star,
  BarChart3,
  Calculator,
  UserPlus,
  Handshake,
  RefreshCw,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface IncentivePolicy {
  id: string;
  policy_name: string;
  policy_type: string;
  description: string | null;
  applies_to: string[];
  employee_reward_type: string;
  employee_reward_percent: number | null;
  employee_reward_fixed: number | null;
  employee_reward_min: number | null;
  employee_reward_max: number | null;
  client_discount_percent: number | null;
  client_discount_months: number | null;
  is_active: boolean;
}

interface EmployeeSale {
  id: string;
  employee_name: string;
  employee_area: string | null;
  sale_type: string;
  prospect_name: string;
  prospect_company: string | null;
  prospect_contact: string | null;
  prospect_source: string | null;
  referring_client_name: string | null;
  status: string;
  contact_date: string | null;
  meeting_date: string | null;
  close_date: string | null;
  monthly_fee: number | null;
  commission_value: number | null;
  commission_paid: boolean;
  how_it_happened: string | null;
  notes: string | null;
  created_at: string;
}

interface SalesRanking {
  employee_name: string;
  employee_area: string | null;
  vendas_fechadas: number;
  em_andamento: number;
  perdidas: number;
  total_comissoes: number | null;
  comissoes_pendentes: number | null;
  receita_gerada: number | null;
  ultima_venda: string | null;
}

interface PLRProgram {
  id: string;
  program_name: string;
  reference_year: number;
  description: string | null;
  start_date: string;
  end_date: string;
  revenue_target: number | null;
  profit_target: number | null;
  client_target: number | null;
  revenue_actual: number | null;
  profit_actual: number | null;
  client_actual: number | null;
  plr_pool_percent: number | null;
  plr_pool_value: number | null;
  status: string;
}

interface PLREmployeeShare {
  program_name: string;
  reference_year: number;
  employee_name: string;
  total_score: number | null;
  percentual_pool: number | null;
  base_value: number | null;
  bonus_value: number | null;
  final_value: number | null;
  paid: boolean;
}

const SALE_TYPES = [
  { value: "referral", label: "Indicacao", icon: UserPlus },
  { value: "direct_sale", label: "Venda Direta", icon: Handshake },
  { value: "upsell", label: "Upsell", icon: TrendingUp },
  { value: "retention", label: "Retencao", icon: RefreshCw },
];

const SALE_STATUSES = [
  { value: "lead", label: "Lead", color: "bg-gray-100 text-gray-800" },
  { value: "contacted", label: "Contatado", color: "bg-blue-100 text-blue-800" },
  { value: "meeting", label: "Reuniao", color: "bg-purple-100 text-purple-800" },
  { value: "proposal", label: "Proposta", color: "bg-orange-100 text-orange-800" },
  { value: "negotiation", label: "Negociacao", color: "bg-yellow-100 text-yellow-800" },
  { value: "won", label: "Fechado", color: "bg-green-100 text-green-800" },
  { value: "lost", label: "Perdido", color: "bg-red-100 text-red-800" },
];

const PROSPECT_SOURCES = [
  { value: "conversation", label: "Conversa informal" },
  { value: "bakery", label: "Padaria/Comercio" },
  { value: "gym", label: "Academia" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "client_meeting", label: "Reuniao com cliente" },
  { value: "phone_call", label: "Ligacao" },
  { value: "social_media", label: "Redes sociais" },
  { value: "other", label: "Outro" },
];

const EMPLOYEES = ["Rose", "Josimar", "Lilian", "Sr. Daniel", "Sergio", "Carla"];
const AREAS = [
  { value: "financial", label: "Financeiro" },
  { value: "accounting", label: "Contabil" },
  { value: "admin", label: "Administrativo" },
  { value: "dp", label: "DP" },
  { value: "fiscal", label: "Fiscal" },
];

const Incentives = () => {
  const [policies, setPolicies] = useState<IncentivePolicy[]>([]);
  const [sales, setSales] = useState<EmployeeSale[]>([]);
  const [ranking, setRanking] = useState<SalesRanking[]>([]);
  const [plrPrograms, setPLRPrograms] = useState<PLRProgram[]>([]);
  const [plrShares, setPLRShares] = useState<PLREmployeeShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Sale form state
  const [saleDialog, setSaleDialog] = useState(false);
  const [editingSale, setEditingSale] = useState<EmployeeSale | null>(null);
  const [saleForm, setSaleForm] = useState({
    employee_name: "",
    employee_area: "",
    sale_type: "referral",
    prospect_name: "",
    prospect_company: "",
    prospect_contact: "",
    prospect_source: "",
    referring_client_name: "",
    status: "lead",
    monthly_fee: "",
    how_it_happened: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load policies
      const { data: policiesData, error: policiesError } = await supabase
        .from("employee_incentive_policies")
        .select("*")
        .eq("is_active", true)
        .order("policy_name");

      if (policiesError) throw policiesError;
      setPolicies(policiesData || []);

      // Load sales
      const { data: salesData, error: salesError } = await supabase
        .from("employee_sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (salesError) throw salesError;
      setSales(salesData || []);

      // Load ranking from view
      const { data: rankingData, error: rankingError } = await supabase
        .from("vw_employee_sales_ranking")
        .select("*");

      if (rankingError) throw rankingError;
      setRanking(rankingData || []);

      // Load PLR programs
      const { data: plrData, error: plrError } = await supabase
        .from("plr_programs")
        .select("*")
        .order("reference_year", { ascending: false });

      if (plrError) throw plrError;
      setPLRPrograms(plrData || []);

      // Load PLR shares from view
      const { data: sharesData, error: sharesError } = await supabase
        .from("vw_plr_by_employee")
        .select("*");

      if (sharesError) throw sharesError;
      setPLRShares(sharesData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Sale CRUD
  const resetSaleForm = () => {
    setSaleForm({
      employee_name: "",
      employee_area: "",
      sale_type: "referral",
      prospect_name: "",
      prospect_company: "",
      prospect_contact: "",
      prospect_source: "",
      referring_client_name: "",
      status: "lead",
      monthly_fee: "",
      how_it_happened: "",
      notes: "",
    });
    setEditingSale(null);
  };

  const openCreateSale = () => {
    resetSaleForm();
    setSaleDialog(true);
  };

  const openEditSale = (sale: EmployeeSale) => {
    setEditingSale(sale);
    setSaleForm({
      employee_name: sale.employee_name,
      employee_area: sale.employee_area || "",
      sale_type: sale.sale_type,
      prospect_name: sale.prospect_name,
      prospect_company: sale.prospect_company || "",
      prospect_contact: sale.prospect_contact || "",
      prospect_source: sale.prospect_source || "",
      referring_client_name: sale.referring_client_name || "",
      status: sale.status,
      monthly_fee: sale.monthly_fee?.toString() || "",
      how_it_happened: sale.how_it_happened || "",
      notes: sale.notes || "",
    });
    setSaleDialog(true);
  };

  const handleSaveSale = async () => {
    if (!saleForm.employee_name || !saleForm.prospect_name) {
      toast.error("Preencha o funcionario e o nome do prospect");
      return;
    }

    setSubmitting(true);
    try {
      // Find policy for this sale type
      const policy = policies.find((p) => p.policy_type === saleForm.sale_type);

      const saleData = {
        employee_name: saleForm.employee_name,
        employee_area: saleForm.employee_area || null,
        sale_type: saleForm.sale_type,
        policy_id: policy?.id || null,
        prospect_name: saleForm.prospect_name,
        prospect_company: saleForm.prospect_company || null,
        prospect_contact: saleForm.prospect_contact || null,
        prospect_source: saleForm.prospect_source || null,
        referring_client_name: saleForm.referring_client_name || null,
        status: saleForm.status,
        monthly_fee: saleForm.monthly_fee ? parseFloat(saleForm.monthly_fee) : null,
        how_it_happened: saleForm.how_it_happened || null,
        notes: saleForm.notes || null,
        close_date: saleForm.status === "won" ? new Date().toISOString().split("T")[0] : null,
      };

      if (editingSale) {
        const { error } = await supabase.from("employee_sales").update(saleData).eq("id", editingSale.id);

        if (error) throw error;

        // Calculate commission if sale is won
        if (saleForm.status === "won" && saleForm.monthly_fee) {
          await supabase.rpc("calculate_employee_commission", { p_sale_id: editingSale.id });
        }

        toast.success("Venda atualizada!");
      } else {
        const { data: newSale, error } = await supabase.from("employee_sales").insert(saleData).select("id").single();

        if (error) throw error;

        // Calculate commission if sale is won
        if (saleForm.status === "won" && saleForm.monthly_fee && newSale) {
          await supabase.rpc("calculate_employee_commission", { p_sale_id: newSale.id });
        }

        toast.success("Venda registrada!");
      }

      setSaleDialog(false);
      resetSaleForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving sale:", error);
      toast.error("Erro ao salvar venda", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayCommission = async (sale: EmployeeSale) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("employee_sales")
        .update({
          commission_paid: true,
          commission_paid_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", sale.id);

      if (error) throw error;

      toast.success("Comissao marcada como paga!");
      loadData();
    } catch (error: any) {
      console.error("Error paying commission:", error);
      toast.error("Erro ao pagar comissao", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCalculatePLR = async (programId: string) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("distribute_plr", { p_program_id: programId });

      if (error) throw error;

      toast.success("PLR calculado!", {
        description: data?.message || "Calculo realizado com sucesso",
      });
      loadData();
    } catch (error: any) {
      console.error("Error calculating PLR:", error);
      toast.error("Erro ao calcular PLR", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getSaleTypeConfig = (type: string) => {
    return SALE_TYPES.find((t) => t.value === type) || SALE_TYPES[0];
  };

  const getStatusConfig = (status: string) => {
    return SALE_STATUSES.find((s) => s.value === status) || SALE_STATUSES[0];
  };

  const stats = {
    totalSales: sales.filter((s) => s.status === "won").length,
    inProgress: sales.filter((s) => !["won", "lost"].includes(s.status)).length,
    totalCommissions: sales.filter((s) => s.status === "won").reduce((sum, s) => sum + (s.commission_value || 0), 0),
    pendingCommissions: sales.filter((s) => s.status === "won" && !s.commission_paid).reduce((sum, s) => sum + (s.commission_value || 0), 0),
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="relative">
                <Gift className="h-8 w-8 text-amber-500" />
                <Star className="h-4 w-4 text-yellow-400 absolute -top-1 -right-1" />
              </div>
              Incentivos e PLR
            </h1>
            <p className="text-muted-foreground mt-1">Sistema de comissoes, indicacoes e participacao nos lucros</p>
          </div>

          <Button onClick={openCreateSale}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Indicacao/Venda
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalSales}</div>
                  <div className="text-xs text-muted-foreground">Vendas Fechadas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.inProgress}</div>
                  <div className="text-xs text-muted-foreground">Em Andamento</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalCommissions)}</div>
                  <div className="text-xs text-muted-foreground">Total Comissoes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.pendingCommissions > 0 ? "border-orange-300 bg-orange-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(stats.pendingCommissions)}</div>
                  <div className="text-xs text-muted-foreground">A Pagar</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales" className="gap-2">
              <Handshake className="h-4 w-4" />
              Vendas ({sales.length})
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2">
              <Trophy className="h-4 w-4" />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-2">
              <Percent className="h-4 w-4" />
              Politicas
            </TabsTrigger>
            <TabsTrigger value="plr" className="gap-2">
              <Award className="h-4 w-4" />
              PLR
            </TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendas e Indicacoes</CardTitle>
                <CardDescription>Registro de todas as vendas e indicacoes feitas pela equipe</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : sales.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma venda registrada</h3>
                    <p className="text-muted-foreground mb-4">Comece registrando uma indicacao ou venda</p>
                    <Button onClick={openCreateSale}>
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Venda
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionario</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Prospect</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Honorario</TableHead>
                        <TableHead>Comissao</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => {
                        const typeConfig = getSaleTypeConfig(sale.sale_type);
                        const statusConfig = getStatusConfig(sale.status);
                        const TypeIcon = typeConfig.icon;

                        return (
                          <TableRow key={sale.id}>
                            <TableCell>
                              <div className="font-medium">{sale.employee_name}</div>
                              <div className="text-xs text-muted-foreground">{sale.employee_area || "-"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <TypeIcon className="h-3 w-3" />
                                {typeConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{sale.prospect_name}</div>
                              {sale.prospect_company && (
                                <div className="text-xs text-muted-foreground">{sale.prospect_company}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                            </TableCell>
                            <TableCell>{sale.monthly_fee ? formatCurrency(sale.monthly_fee) : "-"}</TableCell>
                            <TableCell>
                              {sale.commission_value ? (
                                <div className="flex items-center gap-2">
                                  <span className={sale.commission_paid ? "text-green-600" : "text-orange-600"}>
                                    {formatCurrency(sale.commission_value)}
                                  </span>
                                  {sale.commission_paid ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700">
                                      Pago
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700">
                                      Pendente
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditSale(sale)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  {sale.status === "won" && sale.commission_value && !sale.commission_paid && (
                                    <DropdownMenuItem onClick={() => handlePayCommission(sale)}>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Marcar como Pago
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ranking Tab */}
          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Ranking de Vendedores
                </CardTitle>
                <CardDescription>Quem mais contribuiu para o crescimento da Ampla</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : ranking.length === 0 ? (
                  <div className="text-center py-12">
                    <Medal className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma venda ainda</h3>
                    <p className="text-muted-foreground">O ranking aparecera quando houver vendas fechadas</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ranking.map((employee, index) => (
                      <div
                        key={employee.employee_name}
                        className={cn(
                          "p-4 rounded-lg border flex items-center gap-4",
                          index === 0 && "bg-amber-50 border-amber-300",
                          index === 1 && "bg-gray-50 border-gray-300",
                          index === 2 && "bg-orange-50 border-orange-300"
                        )}
                      >
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold",
                            index === 0 && "bg-amber-200 text-amber-800",
                            index === 1 && "bg-gray-200 text-gray-800",
                            index === 2 && "bg-orange-200 text-orange-800",
                            index > 2 && "bg-blue-100 text-blue-800"
                          )}
                        >
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                        </div>

                        <div className="flex-1">
                          <div className="font-semibold text-lg">{employee.employee_name}</div>
                          <div className="text-sm text-muted-foreground">{employee.employee_area || "Geral"}</div>
                        </div>

                        <div className="grid grid-cols-4 gap-6 text-center">
                          <div>
                            <div className="text-2xl font-bold text-green-600">{employee.vendas_fechadas}</div>
                            <div className="text-xs text-muted-foreground">Fechadas</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600">{employee.em_andamento}</div>
                            <div className="text-xs text-muted-foreground">Em andamento</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-amber-600">{formatCurrency(employee.total_comissoes)}</div>
                            <div className="text-xs text-muted-foreground">Comissoes</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(employee.receita_gerada)}</div>
                            <div className="text-xs text-muted-foreground">Receita/mes</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Politicas de Incentivo</CardTitle>
                <CardDescription>Regras de comissao e beneficios para vendedores</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {policies.map((policy) => (
                      <Card key={policy.id} className="border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Badge>{policy.policy_type}</Badge>
                            {policy.policy_name}
                          </CardTitle>
                          <CardDescription>{policy.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Comissao:</span>
                              <span className="font-medium">
                                {policy.employee_reward_percent ? `${policy.employee_reward_percent}%` : formatCurrency(policy.employee_reward_fixed)}
                              </span>
                            </div>
                            {policy.employee_reward_min && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Minimo:</span>
                                <span className="font-medium">{formatCurrency(policy.employee_reward_min)}</span>
                              </div>
                            )}
                            {policy.employee_reward_max && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Maximo:</span>
                                <span className="font-medium">{formatCurrency(policy.employee_reward_max)}</span>
                              </div>
                            )}
                            {policy.client_discount_percent && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Desconto cliente:</span>
                                <span className="font-medium">
                                  {policy.client_discount_percent}% por {policy.client_discount_months} meses
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Aplica-se a:</span>
                              <span className="font-medium">{policy.applies_to?.join(", ") || "Todos"}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLR Tab */}
          <TabsContent value="plr" className="space-y-4">
            {/* PLR Programs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-600" />
                  Programas de PLR
                </CardTitle>
                <CardDescription>Participacao nos Lucros e Resultados</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : plrPrograms.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum programa de PLR</h3>
                    <p className="text-muted-foreground">Configure um programa de PLR no banco de dados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {plrPrograms.map((program) => (
                      <Card key={program.id} className="border-purple-200 bg-purple-50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{program.program_name}</CardTitle>
                            <Badge>{program.status}</Badge>
                          </div>
                          <CardDescription>{program.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="text-center p-3 bg-white rounded-lg">
                              <div className="text-xs text-muted-foreground mb-1">Meta Faturamento</div>
                              <div className="font-semibold">{formatCurrency(program.revenue_target)}</div>
                              <Progress
                                value={program.revenue_actual && program.revenue_target ? (program.revenue_actual / program.revenue_target) * 100 : 0}
                                className="h-2 mt-2"
                              />
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg">
                              <div className="text-xs text-muted-foreground mb-1">Meta Clientes</div>
                              <div className="font-semibold">{program.client_target}</div>
                              <Progress
                                value={program.client_actual && program.client_target ? (program.client_actual / program.client_target) * 100 : 0}
                                className="h-2 mt-2"
                              />
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg">
                              <div className="text-xs text-muted-foreground mb-1">% do Lucro</div>
                              <div className="font-semibold">{program.plr_pool_percent}%</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg">
                              <div className="text-xs text-muted-foreground mb-1">Pool Total</div>
                              <div className="font-semibold text-green-600">{formatCurrency(program.plr_pool_value)}</div>
                            </div>
                          </div>

                          <Button onClick={() => handleCalculatePLR(program.id)} disabled={submitting} variant="outline">
                            <Calculator className="h-4 w-4 mr-2" />
                            Calcular PLR
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PLR by Employee */}
            {plrShares.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribuicao do PLR por Funcionario</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionario</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>% do Pool</TableHead>
                        <TableHead>Valor Base</TableHead>
                        <TableHead>Bonus</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plrShares.map((share, index) => (
                        <TableRow key={`${share.employee_name}-${index}`}>
                          <TableCell className="font-medium">{share.employee_name}</TableCell>
                          <TableCell>{share.total_score?.toFixed(1)}</TableCell>
                          <TableCell>{share.percentual_pool?.toFixed(2)}%</TableCell>
                          <TableCell>{formatCurrency(share.base_value)}</TableCell>
                          <TableCell>{formatCurrency(share.bonus_value)}</TableCell>
                          <TableCell className="font-semibold text-green-600">{formatCurrency(share.final_value)}</TableCell>
                          <TableCell>
                            <Badge variant={share.paid ? "default" : "secondary"}>{share.paid ? "Pago" : "Pendente"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Sale Dialog */}
        <Dialog open={saleDialog} onOpenChange={setSaleDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSale ? "Editar Venda/Indicacao" : "Nova Venda/Indicacao"}</DialogTitle>
              <DialogDescription>Registre uma indicacao ou venda feita por funcionario</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Funcionario *</Label>
                  <Select value={saleForm.employee_name} onValueChange={(value) => setSaleForm((prev) => ({ ...prev, employee_name: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEES.map((emp) => (
                        <SelectItem key={emp} value={emp}>
                          {emp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Area</Label>
                  <Select value={saleForm.employee_area} onValueChange={(value) => setSaleForm((prev) => ({ ...prev, employee_area: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS.map((area) => (
                        <SelectItem key={area.value} value={area.value}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={saleForm.sale_type} onValueChange={(value) => setSaleForm((prev) => ({ ...prev, sale_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SALE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={saleForm.status} onValueChange={(value) => setSaleForm((prev) => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SALE_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Prospect *</Label>
                  <Input
                    value={saleForm.prospect_name}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, prospect_name: e.target.value }))}
                    placeholder="Ex: Joao Silva"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input
                    value={saleForm.prospect_company}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, prospect_company: e.target.value }))}
                    placeholder="Ex: Padaria do Joao"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contato</Label>
                  <Input
                    value={saleForm.prospect_contact}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, prospect_contact: e.target.value }))}
                    placeholder="(62) 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Como conheceu?</Label>
                  <Select value={saleForm.prospect_source} onValueChange={(value) => setSaleForm((prev) => ({ ...prev, prospect_source: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PROSPECT_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {saleForm.sale_type === "referral" && (
                <div className="space-y-2">
                  <Label>Cliente que indicou</Label>
                  <Input
                    value={saleForm.referring_client_name}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, referring_client_name: e.target.value }))}
                    placeholder="Nome do cliente da Ampla que indicou"
                  />
                </div>
              )}

              {saleForm.status === "won" && (
                <div className="space-y-2">
                  <Label>Honorario Mensal (R$)</Label>
                  <Input
                    type="number"
                    value={saleForm.monthly_fee}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, monthly_fee: e.target.value }))}
                    placeholder="500.00"
                    step="0.01"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Como aconteceu?</Label>
                <Textarea
                  value={saleForm.how_it_happened}
                  onChange={(e) => setSaleForm((prev) => ({ ...prev, how_it_happened: e.target.value }))}
                  placeholder="Descreva como aconteceu a venda/indicacao..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Observacoes</Label>
                <Textarea
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Outras informacoes relevantes..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSaleDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSale} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {editingSale ? "Salvar" : "Registrar"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Incentives;
