import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  DollarSign,
  AlertTriangle,
  Calculator,
  TrendingUp,
  TrendingDown,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Scale,
  Building2,
  Briefcase,
  Calendar,
  Percent,
  ShieldAlert,
  Bot,
  Plus,
  Pencil,
  UserX,
  UserCheck,
  MoreHorizontal,
  Trash2,
  ListChecks,
  Receipt,
  Play,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  contract_type: string;
  official_salary: number;
  unofficial_salary: number;
  hire_date: string | null;
  work_area: string | null;
  is_active: boolean;
}

interface PayrollSummary {
  total_official: number;
  total_unofficial: number;
  total_encargos: number;
  risk_score: number;
}

interface LaborAlert {
  id: string;
  employee_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string | null;
  is_resolved: boolean;
}

interface EsocialRubrica {
  id: string;
  codigo: string;
  descricao: string;
  tipo_rubrica: string;
  incide_inss: boolean;
  incide_irrf: boolean;
  incide_fgts: boolean;
  account_id: string | null;
  account_debit_id: string | null;
  account_credit_id: string | null;
  is_active: boolean;
  account_name?: string;
}

interface PayrollRecord {
  id: string;
  employee_id: string;
  competencia: string;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  status: string;
  employee_name?: string;
  employee_role?: string;
}

interface PayrollEvent {
  id: string;
  payroll_id: string;
  rubrica_id: string;
  valor: number;
  rubrica_codigo?: string;
  rubrica_descricao?: string;
  rubrica_tipo?: string;
}

const Payroll = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [alerts, setAlerts] = useState<LaborAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationEmployee, setSimulationEmployee] = useState<Employee | null>(null);
  const [newOfficialSalary, setNewOfficialSalary] = useState<number>(0);

  // CRUD states
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [employeeToSuspend, setEmployeeToSuspend] = useState<Employee | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Rubricas and Payroll states
  const [rubricas, setRubricas] = useState<EsocialRubrica[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [payrollEvents, setPayrollEvents] = useState<PayrollEvent[]>([]);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    department: "Administrativo",
    contract_type: "CLT",
    official_salary: 0,
    unofficial_salary: 0,
    hire_date: "",
    work_area: "",
  });

  const departments = [
    { value: "all", label: "Todos" },
    { value: "Administrativo", label: "Administrativo" },
    { value: "Financeiro", label: "Financeiro" },
    { value: "Contabil", label: "Contabil" },
    { value: "Fiscal", label: "Fiscal" },
    { value: "DP", label: "DP" },
  ];

  const contractTypes = [
    { value: "CLT", label: "CLT" },
    { value: "PJ", label: "PJ" },
    { value: "Estagiario", label: "Estagiario" },
    { value: "Temporario", label: "Temporario" },
    { value: "Socio", label: "Socio" },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load employees (active or inactive based on filter)
      let query = supabase
        .from("employees")
        .select("*")
        .order("department", { ascending: true })
        .order("name", { ascending: true });

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data: employeesData, error: employeesError } = await query;

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Load labor alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from("labor_alerts")
        .select("*")
        .eq("is_resolved", false)
        .order("severity", { ascending: false });

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load rubricas
  const loadRubricas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("esocial_rubricas")
        .select(`
          id,
          codigo,
          descricao,
          tipo_rubrica,
          incide_inss,
          incide_irrf,
          incide_fgts,
          account_id,
          account_debit_id,
          account_credit_id,
          is_active
        `)
        .order("codigo", { ascending: true });

      if (error) throw error;
      setRubricas(data || []);
    } catch (error) {
      console.error("Error loading rubricas:", error);
    }
  }, []);

  // Load payroll records for competencia
  const loadPayrollRecords = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("payroll")
        .select(`
          id,
          employee_id,
          competencia,
          total_proventos,
          total_descontos,
          liquido,
          status,
          employees (name, role)
        `)
        .eq("competencia", selectedCompetencia)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const records = (data || []).map((p: any) => ({
        ...p,
        employee_name: p.employees?.name,
        employee_role: p.employees?.role,
      }));
      setPayrollRecords(records);
    } catch (error) {
      console.error("Error loading payroll records:", error);
    }
  }, [selectedCompetencia]);

  // Load payroll events for selected payroll
  const loadPayrollEvents = useCallback(async (payrollId: string) => {
    try {
      const { data, error } = await supabase
        .from("payroll_events")
        .select(`
          id,
          payroll_id,
          rubrica_id,
          valor,
          esocial_rubricas (codigo, descricao, tipo_rubrica)
        `)
        .eq("payroll_id", payrollId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const events = (data || []).map((e: any) => ({
        ...e,
        rubrica_codigo: e.esocial_rubricas?.codigo,
        rubrica_descricao: e.esocial_rubricas?.descricao,
        rubrica_tipo: e.esocial_rubricas?.tipo_rubrica,
      }));
      setPayrollEvents(events);
    } catch (error) {
      console.error("Error loading payroll events:", error);
    }
  }, []);

  useEffect(() => {
    loadRubricas();
  }, [loadRubricas]);

  useEffect(() => {
    loadPayrollRecords();
  }, [loadPayrollRecords]);

  useEffect(() => {
    if (selectedPayroll) {
      loadPayrollEvents(selectedPayroll.id);
    } else {
      setPayrollEvents([]);
    }
  }, [selectedPayroll, loadPayrollEvents]);

  // Generate payroll for an employee
  const handleGeneratePayroll = async (employeeId: string) => {
    setGeneratingPayroll(true);
    try {
      const { data, error } = await supabase.rpc("gerar_folha_funcionario", {
        p_employee_id: employeeId,
        p_competencia: selectedCompetencia,
      });

      if (error) throw error;
      toast.success("Folha gerada com sucesso!");
      loadPayrollRecords();
    } catch (error: any) {
      console.error("Error generating payroll:", error);
      toast.error(error.message || "Erro ao gerar folha");
    } finally {
      setGeneratingPayroll(false);
    }
  };

  // Generate payroll for all employees
  const handleGenerateAllPayroll = async () => {
    setGeneratingPayroll(true);
    try {
      const { data, error } = await supabase.rpc("gerar_folha_mensal", {
        p_competencia: selectedCompetencia,
      });

      if (error) throw error;
      toast.success(`Folha gerada para ${data} funcionarios!`);
      loadPayrollRecords();
    } catch (error: any) {
      console.error("Error generating payroll:", error);
      toast.error(error.message || "Erro ao gerar folha");
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      role: "",
      department: "Administrativo",
      contract_type: "CLT",
      official_salary: 0,
      unofficial_salary: 0,
      hire_date: "",
      work_area: "",
    });
    setEditingEmployee(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowEmployeeDialog(true);
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      role: employee.role || "",
      department: employee.department || "Administrativo",
      contract_type: employee.contract_type || "CLT",
      official_salary: employee.official_salary || 0,
      unofficial_salary: employee.unofficial_salary || 0,
      hire_date: employee.hire_date || "",
      work_area: employee.work_area || "",
    });
    setShowEmployeeDialog(true);
  };

  const handleSaveEmployee = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from("employees")
          .update({
            name: formData.name,
            role: formData.role,
            department: formData.department,
            contract_type: formData.contract_type,
            official_salary: formData.official_salary,
            unofficial_salary: formData.unofficial_salary,
            hire_date: formData.hire_date || null,
            work_area: formData.work_area || null,
          })
          .eq("id", editingEmployee.id);

        if (error) throw error;
        toast.success("Funcionario atualizado com sucesso!");
      } else {
        // Create new employee
        const { error } = await supabase
          .from("employees")
          .insert({
            name: formData.name,
            role: formData.role,
            department: formData.department,
            contract_type: formData.contract_type,
            official_salary: formData.official_salary,
            unofficial_salary: formData.unofficial_salary,
            hire_date: formData.hire_date || null,
            work_area: formData.work_area || null,
            is_active: true,
          });

        if (error) throw error;
        toast.success("Funcionario cadastrado com sucesso!");
      }

      setShowEmployeeDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving employee:", error);
      toast.error("Erro ao salvar funcionario");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspendEmployee = async () => {
    if (!employeeToSuspend) return;

    setSaving(true);
    try {
      const newStatus = !employeeToSuspend.is_active;
      const { error } = await supabase
        .from("employees")
        .update({ is_active: newStatus })
        .eq("id", employeeToSuspend.id);

      if (error) throw error;
      toast.success(newStatus ? "Funcionario reativado!" : "Funcionario suspenso!");
      setShowSuspendDialog(false);
      setEmployeeToSuspend(null);
      loadData();
    } catch (error) {
      console.error("Error suspending employee:", error);
      toast.error("Erro ao alterar status do funcionario");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", employeeToDelete.id);

      if (error) throw error;
      toast.success("Funcionario removido com sucesso!");
      setShowDeleteDialog(false);
      setEmployeeToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error("Erro ao remover funcionario");
    } finally {
      setSaving(false);
    }
  };

  const confirmSuspend = (employee: Employee) => {
    setEmployeeToSuspend(employee);
    setShowSuspendDialog(true);
  };

  const confirmDelete = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setShowDeleteDialog(true);
  };

  const calculateSummary = (): PayrollSummary => {
    const total_official = employees.reduce((sum, e) => sum + (e.official_salary || 0), 0);
    const total_unofficial = employees.reduce((sum, e) => sum + (e.unofficial_salary || 0), 0);
    // Encargos aproximados: ~68% sobre CLT
    const clt_employees = employees.filter(e => e.contract_type === "CLT");
    const total_clt = clt_employees.reduce((sum, e) => sum + (e.official_salary || 0), 0);
    const total_encargos = total_clt * 0.68;

    // Risk score: based on unofficial percentage
    const unofficial_ratio = total_unofficial / (total_official + total_unofficial) * 100;
    const risk_score = Math.min(100, Math.round(unofficial_ratio * 2));

    return { total_official, total_unofficial, total_encargos, risk_score };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getUnofficialRatio = (employee: Employee) => {
    const total = (employee.official_salary || 0) + (employee.unofficial_salary || 0);
    if (total === 0) return 0;
    return ((employee.unofficial_salary || 0) / total) * 100;
  };

  const getRiskBadge = (ratio: number) => {
    if (ratio === 0) return <Badge className="bg-green-100 text-green-800">Sem risco</Badge>;
    if (ratio < 30) return <Badge className="bg-yellow-100 text-yellow-800">Risco baixo</Badge>;
    if (ratio < 50) return <Badge className="bg-orange-100 text-orange-800">Risco medio</Badge>;
    return <Badge className="bg-red-100 text-red-800">Risco alto</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-100 text-red-800">Critico</Badge>;
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800">Atencao</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Info</Badge>;
    }
  };

  const calculateRegularization = (employee: Employee, newSalary: number) => {
    const currentTotal = (employee.official_salary || 0) + (employee.unofficial_salary || 0);
    const newEncargos = newSalary * 0.68;
    const oldEncargos = (employee.official_salary || 0) * 0.68;
    const difference = newEncargos - oldEncargos;
    const newUnofficial = currentTotal - newSalary;

    return {
      currentTotal,
      newSalary,
      newUnofficial: Math.max(0, newUnofficial),
      newEncargos,
      difference,
      newRatio: newUnofficial > 0 ? (newUnofficial / currentTotal) * 100 : 0,
    };
  };

  const openSimulation = (employee: Employee) => {
    setSimulationEmployee(employee);
    setNewOfficialSalary(employee.official_salary || 0);
    setShowSimulation(true);
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === "all" || e.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const summary = calculateSummary();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Folha de Pagamento</h1>
            <p className="text-sm text-gray-500">
              Comparativo carteira vs por fora - Analise de riscos trabalhistas
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-gray-600">
                Dr. Advocato + Sr. Empresario
              </span>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Funcionario
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Folha Oficial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.total_official)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Registrado em carteira
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Pagamento por Fora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.total_unofficial)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Risco trabalhista
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Encargos Atuais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(summary.total_encargos)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ~68% sobre CLT oficial
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Score de Risco
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShieldAlert className={cn(
                  "h-5 w-5",
                  summary.risk_score < 30 ? "text-green-600" :
                  summary.risk_score < 60 ? "text-yellow-600" : "text-red-600"
                )} />
                <span className={cn(
                  "text-2xl font-bold",
                  summary.risk_score < 30 ? "text-green-600" :
                  summary.risk_score < 60 ? "text-yellow-600" : "text-red-600"
                )}>
                  {summary.risk_score}%
                </span>
              </div>
              <Progress
                value={summary.risk_score}
                className={cn(
                  "mt-2",
                  summary.risk_score < 30 ? "bg-green-100" :
                  summary.risk_score < 60 ? "bg-yellow-100" : "bg-red-100"
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="employees" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="employees">
              <Users className="h-4 w-4 mr-2" />
              Funcionarios ({employees.length})
            </TabsTrigger>
            <TabsTrigger value="rubricas">
              <ListChecks className="h-4 w-4 mr-2" />
              Rubricas ({rubricas.length})
            </TabsTrigger>
            <TabsTrigger value="folha">
              <Receipt className="h-4 w-4 mr-2" />
              Folha Mensal
            </TabsTrigger>
            <TabsTrigger value="detalhamento">
              <Eye className="h-4 w-4 mr-2" />
              Detalhamento
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alertas ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="simulation">
              <Calculator className="h-4 w-4 mr-2" />
              Simulador
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar funcionario..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showInactive ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? <UserCheck className="h-4 w-4 mr-1" /> : <UserX className="h-4 w-4 mr-1" />}
                {showInactive ? "Todos" : "Ver Inativos"}
              </Button>
            </div>

            {/* Employees Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionario</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead className="text-right">Salario Oficial</TableHead>
                      <TableHead className="text-right">Por Fora</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead>Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => {
                      const ratio = getUnofficialRatio(employee);
                      const total = (employee.official_salary || 0) + (employee.unofficial_salary || 0);
                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.role}</div>
                            </div>
                          </TableCell>
                          <TableCell>{employee.department}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{employee.contract_type}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {formatCurrency(employee.official_salary || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {employee.unofficial_salary > 0 ? (
                              <span className="text-red-600 font-medium">
                                {formatCurrency(employee.unofficial_salary)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(total)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getRiskBadge(ratio)}
                              {!employee.is_active && (
                                <Badge className="bg-gray-100 text-gray-600">Inativo</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {employee.unofficial_salary > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSimulation(employee)}
                                >
                                  <Calculator className="h-4 w-4 mr-1" />
                                  Simular
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => confirmSuspend(employee)}>
                                    {employee.is_active ? (
                                      <>
                                        <UserX className="h-4 w-4 mr-2" />
                                        Suspender
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Reativar
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => confirmDelete(employee)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rubricas Tab */}
          <TabsContent value="rubricas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5" />
                  Rubricas eSocial
                </CardTitle>
                <CardDescription>
                  Codigos eSocial vinculados ao plano de contas para lancamentos automaticos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Codigo</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead className="w-[80px] text-center">INSS</TableHead>
                      <TableHead className="w-[80px] text-center">IRRF</TableHead>
                      <TableHead className="w-[80px] text-center">FGTS</TableHead>
                      <TableHead className="w-[80px] text-center">Contabil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rubricas.map((rubrica) => (
                      <TableRow key={rubrica.id}>
                        <TableCell className="font-mono font-bold">
                          {rubrica.codigo}
                        </TableCell>
                        <TableCell>{rubrica.descricao}</TableCell>
                        <TableCell>
                          <Badge variant={rubrica.tipo_rubrica === "PROVENTO" ? "default" : "destructive"}>
                            {rubrica.tipo_rubrica === "PROVENTO" ? "Provento" : "Desconto"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {rubrica.incide_inss ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rubrica.incide_irrf ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rubrica.incide_fgts ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rubrica.account_debit_id ? (
                            <CheckCircle2 className="h-4 w-4 text-blue-500 mx-auto" title="Vinculado ao plano de contas" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-300 mx-auto" title="Sem vinculo contabil" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Folha Mensal Tab */}
          <TabsContent value="folha" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Folha de Pagamento - {selectedCompetencia}
                    </CardTitle>
                    <CardDescription>
                      Gere e visualize a folha de pagamento por competencia
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="month"
                      value={selectedCompetencia}
                      onChange={(e) => setSelectedCompetencia(e.target.value)}
                      className="w-[180px]"
                    />
                    <Button
                      onClick={handleGenerateAllPayroll}
                      disabled={generatingPayroll}
                    >
                      {generatingPayroll ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Gerar Folha
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {payrollRecords.length === 0 ? (
                  <div className="py-12 text-center">
                    <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Nenhuma folha gerada
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Clique em "Gerar Folha" para calcular a folha de pagamento
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionario</TableHead>
                        <TableHead className="text-right">Proventos</TableHead>
                        <TableHead className="text-right">Descontos</TableHead>
                        <TableHead className="text-right">Liquido</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{record.employee_name}</div>
                              <div className="text-sm text-gray-500">{record.employee_role}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {formatCurrency(record.total_proventos)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {formatCurrency(record.total_descontos)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(record.liquido)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={record.status === "FINALIZADO" ? "default" : "secondary"}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPayroll(record)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detalhamento Tab */}
          <TabsContent value="detalhamento" className="space-y-4">
            {!selectedPayroll ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Selecione uma folha
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Va na aba "Folha Mensal" e clique em "Ver" para detalhar os eventos
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Eye className="h-5 w-5" />
                          {selectedPayroll.employee_name} - {selectedCompetencia}
                        </CardTitle>
                        <CardDescription>
                          Detalhamento de proventos e descontos
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => setSelectedPayroll(null)}>
                        Voltar
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proventos */}
                  <Card>
                    <CardHeader className="bg-green-50">
                      <CardTitle className="text-green-700 text-lg">Proventos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Codigo</TableHead>
                            <TableHead>Descricao</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollEvents
                            .filter((e) => e.rubrica_tipo === "PROVENTO")
                            .map((event) => (
                              <TableRow key={event.id}>
                                <TableCell className="font-mono">{event.rubrica_codigo}</TableCell>
                                <TableCell>{event.rubrica_descricao}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">
                                  {formatCurrency(event.valor)}
                                </TableCell>
                              </TableRow>
                            ))}
                          <TableRow className="bg-green-50 font-bold">
                            <TableCell colSpan={2}>Total Proventos</TableCell>
                            <TableCell className="text-right text-green-700">
                              {formatCurrency(selectedPayroll.total_proventos)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Descontos */}
                  <Card>
                    <CardHeader className="bg-red-50">
                      <CardTitle className="text-red-700 text-lg">Descontos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Codigo</TableHead>
                            <TableHead>Descricao</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollEvents
                            .filter((e) => e.rubrica_tipo === "DESCONTO")
                            .map((event) => (
                              <TableRow key={event.id}>
                                <TableCell className="font-mono">{event.rubrica_codigo}</TableCell>
                                <TableCell>{event.rubrica_descricao}</TableCell>
                                <TableCell className="text-right text-red-600 font-medium">
                                  {formatCurrency(event.valor)}
                                </TableCell>
                              </TableRow>
                            ))}
                          <TableRow className="bg-red-50 font-bold">
                            <TableCell colSpan={2}>Total Descontos</TableCell>
                            <TableCell className="text-right text-red-700">
                              {formatCurrency(selectedPayroll.total_descontos)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {/* Resumo */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between text-xl font-bold">
                      <span>Liquido a Receber:</span>
                      <span className="text-blue-600">
                        {formatCurrency(selectedPayroll.liquido)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Nenhum alerta ativo
                  </h3>
                  <p className="text-sm text-gray-500">
                    A IA nao identificou riscos trabalhistas no momento
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <Card key={alert.id} className={cn(
                    "border-l-4",
                    alert.severity === "critical" ? "border-l-red-500" :
                    alert.severity === "warning" ? "border-l-yellow-500" : "border-l-blue-500"
                  )}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{alert.title}</CardTitle>
                        {getSeverityBadge(alert.severity)}
                      </div>
                      <CardDescription>{alert.description}</CardDescription>
                    </CardHeader>
                    {alert.recommendation && (
                      <CardContent>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Scale className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">
                                Recomendacao do Dr. Advocato:
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {alert.recommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="simulation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Simulador de Regularizacao
                </CardTitle>
                <CardDescription>
                  Simule o impacto de regularizar pagamentos por fora na carteira
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Selecione um funcionario com pagamento por fora na aba "Funcionarios"
                  e clique em "Simular" para ver o impacto da regularizacao.
                </p>

                <div className="mt-6 bg-amber-50 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">
                        Sugestao do Sr. Empresario:
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Antes de regularizar, considere alternativas como:
                        contratacao via MEI para funcoes especificas,
                        transformacao em socio com pro-labore, ou
                        reestruturacao via empresa prestadora de servicos.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Simulation Dialog */}
        <Dialog open={showSimulation} onOpenChange={setShowSimulation}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Simulacao de Regularizacao - {simulationEmployee?.name}
              </DialogTitle>
              <DialogDescription>
                Veja o impacto de aumentar o salario registrado em carteira
              </DialogDescription>
            </DialogHeader>

            {simulationEmployee && (
              <div className="space-y-6">
                {/* Current Situation */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Situacao Atual</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Carteira</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(simulationEmployee.official_salary || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Por Fora</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(simulationEmployee.unofficial_salary || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(
                          (simulationEmployee.official_salary || 0) +
                          (simulationEmployee.unofficial_salary || 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* New Salary Input */}
                <div className="space-y-2">
                  <Label>Novo Salario em Carteira</Label>
                  <Input
                    type="number"
                    value={newOfficialSalary}
                    onChange={(e) => setNewOfficialSalary(Number(e.target.value))}
                    min={simulationEmployee.official_salary || 0}
                    max={
                      (simulationEmployee.official_salary || 0) +
                      (simulationEmployee.unofficial_salary || 0)
                    }
                  />
                  <p className="text-xs text-gray-500">
                    Maximo: {formatCurrency(
                      (simulationEmployee.official_salary || 0) +
                      (simulationEmployee.unofficial_salary || 0)
                    )} (regularizacao total)
                  </p>
                </div>

                {/* Simulation Results */}
                {newOfficialSalary > (simulationEmployee.official_salary || 0) && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3">Resultado da Simulacao</h4>
                    {(() => {
                      const sim = calculateRegularization(simulationEmployee, newOfficialSalary);
                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Novo salario carteira</p>
                              <p className="text-lg font-bold text-green-600">
                                {formatCurrency(sim.newSalary)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Novo por fora</p>
                              <p className="text-lg font-bold text-red-600">
                                {formatCurrency(sim.newUnofficial)}
                              </p>
                            </div>
                          </div>

                          <div className="pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Novo custo com encargos:</span>
                              <span className="font-medium">
                                {formatCurrency(sim.newEncargos)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm text-gray-500">Aumento no custo:</span>
                              <span className={cn(
                                "font-medium",
                                sim.difference > 0 ? "text-red-600" : "text-green-600"
                              )}>
                                +{formatCurrency(sim.difference)}/mes
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm text-gray-500">Novo risco:</span>
                              <span>{getRiskBadge(sim.newRatio)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSimulation(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Employee Create/Edit Dialog */}
        <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? "Editar Funcionario" : "Novo Funcionario"}
              </DialogTitle>
              <DialogDescription>
                {editingEmployee
                  ? "Atualize as informacoes do funcionario"
                  : "Preencha as informacoes do novo funcionario"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="Ex: Analista, Assistente"
                />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => setFormData({ ...formData, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter(d => d.value !== "all").map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(v) => setFormData({ ...formData, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Salario Oficial (Carteira)</Label>
                <Input
                  type="number"
                  value={formData.official_salary}
                  onChange={(e) => setFormData({ ...formData, official_salary: Number(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Pagamento por Fora</Label>
                <Input
                  type="number"
                  value={formData.unofficial_salary}
                  onChange={(e) => setFormData({ ...formData, unofficial_salary: Number(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Admissao</Label>
                <Input
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Area de Trabalho</Label>
                <Input
                  value={formData.work_area}
                  onChange={(e) => setFormData({ ...formData, work_area: e.target.value })}
                  placeholder="Ex: Escritorio, Remoto"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmployeeDialog(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEmployee} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    {editingEmployee ? "Atualizar" : "Cadastrar"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Confirmation Dialog */}
        <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {employeeToSuspend?.is_active ? "Suspender Funcionario" : "Reativar Funcionario"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {employeeToSuspend?.is_active
                  ? `Tem certeza que deseja suspender ${employeeToSuspend?.name}? O funcionario ficara inativo no sistema.`
                  : `Tem certeza que deseja reativar ${employeeToSuspend?.name}? O funcionario voltara a aparecer na lista de ativos.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSuspendEmployee} disabled={saving}>
                {saving ? "Processando..." : employeeToSuspend?.is_active ? "Suspender" : "Reativar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Funcionario</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir permanentemente {employeeToDelete?.name}?
                Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteEmployee}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700"
              >
                {saving ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Payroll;
