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
  total_proventos_oficial: number;
  total_descontos_oficial: number;
  liquido_oficial: number;
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

interface TerminationData {
  id?: string;
  employee_id: string;
  termination_date: string;
  last_working_day: string;
  termination_type: string;
  notice_type: string;
  // Valores calculados
  saldo_salario?: number;
  aviso_previo?: number;
  ferias_vencidas?: number;
  ferias_proporcionais?: number;
  terco_constitucional?: number;
  decimo_terceiro_proporcional?: number;
  multa_fgts?: number;
  saldo_fgts?: number;
  desconto_aviso?: number;
  desconto_inss?: number;
  desconto_irrf?: number;
  total_proventos?: number;
  total_descontos?: number;
  valor_liquido?: number;
  // Dr. Advocato
  advocato_consultation?: string;
  advocato_warnings?: string[];
  status?: string;
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

  // Add Event states (para adicionar eventos manuais na folha)
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEventForm, setNewEventForm] = useState({
    rubrica_codigo: "",
    descricao: "",
    referencia: "",
    valor: 0,
    is_desconto: false,
    observacao: "",
    variable_type: "", // Tipo de variável pré-definida
  });

  // Variáveis pré-definidas comuns na folha de pagamento
  const commonVariables = [
    { value: "hora_extra_50", label: "Hora Extra 50%", is_desconto: false, rubrica: "1003" },
    { value: "hora_extra_100", label: "Hora Extra 100%", is_desconto: false, rubrica: "1004" },
    { value: "adicional_noturno", label: "Adicional Noturno", is_desconto: false, rubrica: "1005" },
    { value: "produtividade", label: "Produtividade/Comissão", is_desconto: false, rubrica: "1010" },
    { value: "bonus", label: "Bônus/Gratificação", is_desconto: false, rubrica: "1011" },
    { value: "premio", label: "Prêmio", is_desconto: false, rubrica: "1012" },
    { value: "periculosidade", label: "Adicional Periculosidade", is_desconto: false, rubrica: "1006" },
    { value: "insalubridade", label: "Adicional Insalubridade", is_desconto: false, rubrica: "1007" },
    { value: "ajuda_custo", label: "Ajuda de Custo", is_desconto: false, rubrica: "1020" },
    { value: "reembolso", label: "Reembolso de Despesas", is_desconto: false, rubrica: "1021" },
    { value: "falta", label: "Falta (desconto)", is_desconto: true, rubrica: "2010" },
    { value: "atraso", label: "Atraso (desconto)", is_desconto: true, rubrica: "2011" },
    { value: "adiantamento", label: "Adiantamento Salarial", is_desconto: true, rubrica: "2020" },
    { value: "vale_transporte", label: "Vale Transporte (6%)", is_desconto: true, rubrica: "2030" },
    { value: "vale_refeicao", label: "Vale Refeição (desconto)", is_desconto: true, rubrica: "2031" },
    { value: "plano_saude", label: "Plano de Saúde", is_desconto: true, rubrica: "2040" },
    { value: "emprestimo", label: "Empréstimo Consignado", is_desconto: true, rubrica: "2050" },
    { value: "pensao", label: "Pensão Alimentícia", is_desconto: true, rubrica: "2060" },
    { value: "dsr_desconto", label: "DSR s/ Faltas/Atrasos", is_desconto: true, rubrica: "2012" },
    { value: "outros_provento", label: "Outros (Provento)", is_desconto: false, rubrica: "" },
    { value: "outros_desconto", label: "Outros (Desconto)", is_desconto: true, rubrica: "" },
  ];

  // Variáveis para rescisão
  const [terminationVariables, setTerminationVariables] = useState<Array<{
    descricao: string;
    valor: number;
    is_desconto: boolean;
    referencia?: string;
  }>>([]);

  // Termination (Rescisão) states
  const [showTerminationDialog, setShowTerminationDialog] = useState(false);
  const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
  const [terminationData, setTerminationData] = useState<TerminationData | null>(null);
  const [calculatingTermination, setCalculatingTermination] = useState(false);
  const [terminationForm, setTerminationForm] = useState({
    termination_date: new Date().toISOString().split('T')[0],
    last_working_day: new Date().toISOString().split('T')[0],
    termination_type: 'dispensa_sem_justa_causa',
    notice_type: 'indenizado',
  });

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
          total_proventos_oficial,
          total_descontos_oficial,
          liquido_oficial,
          status,
          employees (name, role)
        `)
        .eq("competencia", `${selectedCompetencia}-01`)
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
          rubrica_codigo,
          descricao,
          referencia,
          valor,
          is_oficial,
          is_desconto,
          observacao,
          esocial_rubricas (codigo, descricao, tipo_rubrica)
        `)
        .eq("payroll_id", payrollId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const events = (data || []).map((e: any) => ({
        ...e,
        rubrica_codigo: e.rubrica_codigo || e.esocial_rubricas?.codigo,
        rubrica_descricao: e.descricao || e.esocial_rubricas?.descricao,
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
        p_competencia: `${selectedCompetencia}-01`,
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
        p_competencia: `${selectedCompetencia}-01`,
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

  // ========== ADD EVENT FUNCTIONS ==========

  const openAddEventDialog = () => {
    if (!selectedPayroll) {
      toast.error("Selecione uma folha primeiro");
      return;
    }
    setNewEventForm({
      rubrica_codigo: "",
      descricao: "",
      referencia: "",
      valor: 0,
      is_desconto: false,
      observacao: "",
      variable_type: "",
    });
    setShowAddEventDialog(true);
  };

  // Handler para quando seleciona uma variável pré-definida
  const handleVariableTypeChange = (value: string) => {
    const variable = commonVariables.find(v => v.value === value);
    if (variable) {
      setNewEventForm({
        ...newEventForm,
        variable_type: value,
        descricao: variable.label,
        is_desconto: variable.is_desconto,
        rubrica_codigo: variable.rubrica || "",
      });
    } else {
      setNewEventForm({
        ...newEventForm,
        variable_type: value,
        descricao: "",
        is_desconto: false,
        rubrica_codigo: "",
      });
    }
  };

  // Adicionar variável na rescisão
  const addTerminationVariable = () => {
    setTerminationVariables([
      ...terminationVariables,
      { descricao: "", valor: 0, is_desconto: false, referencia: "" }
    ]);
  };

  const updateTerminationVariable = (index: number, field: string, value: any) => {
    const updated = [...terminationVariables];
    updated[index] = { ...updated[index], [field]: value };
    setTerminationVariables(updated);
  };

  const removeTerminationVariable = (index: number) => {
    setTerminationVariables(terminationVariables.filter((_, i) => i !== index));
  };

  // Aplicar variável pré-definida na rescisão
  const applyTerminationVariableType = (index: number, value: string) => {
    const variable = commonVariables.find(v => v.value === value);
    if (variable) {
      const updated = [...terminationVariables];
      updated[index] = {
        ...updated[index],
        descricao: variable.label,
        is_desconto: variable.is_desconto,
      };
      setTerminationVariables(updated);
    }
  };

  const handleAddEvent = async () => {
    if (!selectedPayroll) {
      toast.error("Selecione uma folha primeiro");
      return;
    }

    if (!newEventForm.descricao || newEventForm.valor <= 0) {
      toast.error("Preencha a descrição e o valor");
      return;
    }

    setAddingEvent(true);
    try {
      // Inserir evento na folha
      const { error: insertError } = await supabase
        .from("payroll_events")
        .insert({
          payroll_id: selectedPayroll.id,
          rubrica_codigo: newEventForm.rubrica_codigo || null,
          descricao: newEventForm.descricao,
          referencia: newEventForm.referencia || null,
          valor: newEventForm.valor,
          is_oficial: false, // Eventos manuais não são oficiais
          is_desconto: newEventForm.is_desconto,
          observacao: newEventForm.observacao || null,
        });

      if (insertError) throw insertError;

      // Recalcular totais da folha
      const { data: events, error: eventsError } = await supabase
        .from("payroll_events")
        .select("*")
        .eq("payroll_id", selectedPayroll.id);

      if (eventsError) throw eventsError;

      let totalProventos = 0;
      let totalDescontos = 0;

      events?.forEach((e: any) => {
        if (e.is_desconto) {
          totalDescontos += parseFloat(e.valor);
        } else {
          totalProventos += parseFloat(e.valor);
        }
      });

      const liquido = totalProventos - totalDescontos;

      // Atualizar folha com novos totais
      const { error: updateError } = await supabase
        .from("payroll")
        .update({
          total_proventos_oficial: totalProventos,
          total_descontos_oficial: totalDescontos,
          liquido_oficial: liquido,
        })
        .eq("id", selectedPayroll.id);

      if (updateError) throw updateError;

      toast.success("Evento adicionado com sucesso!");
      setShowAddEventDialog(false);
      loadPayrollEvents(selectedPayroll.id);
      loadPayrollRecords();
    } catch (error: any) {
      console.error("Error adding event:", error);
      toast.error(error.message || "Erro ao adicionar evento");
    } finally {
      setAddingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedPayroll) return;

    try {
      const { error } = await supabase
        .from("payroll_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      // Recalcular totais
      const { data: events } = await supabase
        .from("payroll_events")
        .select("*")
        .eq("payroll_id", selectedPayroll.id);

      let totalProventos = 0;
      let totalDescontos = 0;

      events?.forEach((e: any) => {
        if (e.is_desconto) {
          totalDescontos += parseFloat(e.valor);
        } else {
          totalProventos += parseFloat(e.valor);
        }
      });

      await supabase
        .from("payroll")
        .update({
          total_proventos_oficial: totalProventos,
          total_descontos_oficial: totalDescontos,
          liquido_oficial: totalProventos - totalDescontos,
        })
        .eq("id", selectedPayroll.id);

      toast.success("Evento removido!");
      loadPayrollEvents(selectedPayroll.id);
      loadPayrollRecords();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error("Erro ao remover evento");
    }
  };

  // ========== TERMINATION (RESCISÃO) FUNCTIONS ==========

  const terminationTypes = [
    { value: 'dispensa_sem_justa_causa', label: 'Dispensa sem Justa Causa' },
    { value: 'dispensa_com_justa_causa', label: 'Dispensa com Justa Causa' },
    { value: 'pedido_demissao', label: 'Pedido de Demissão' },
    { value: 'acordo_mutuo', label: 'Acordo Mútuo (Art. 484-A CLT)' },
    { value: 'termino_contrato', label: 'Término de Contrato' },
    { value: 'aposentadoria', label: 'Aposentadoria' },
    { value: 'falecimento', label: 'Falecimento' },
    { value: 'rescisao_indireta', label: 'Rescisão Indireta' },
  ];

  const noticeTypes = [
    { value: 'trabalhado', label: 'Aviso Trabalhado' },
    { value: 'indenizado', label: 'Aviso Indenizado' },
    { value: 'dispensado', label: 'Dispensado pelo Empregador' },
    { value: 'nao_cumprido', label: 'Não Cumprido (Desconto)' },
  ];

  const openTerminationDialog = (employee: Employee) => {
    setEmployeeToTerminate(employee);
    setTerminationData(null);
    setTerminationVariables([]); // Limpa variáveis anteriores
    setTerminationForm({
      termination_date: new Date().toISOString().split('T')[0],
      last_working_day: new Date().toISOString().split('T')[0],
      termination_type: 'dispensa_sem_justa_causa',
      notice_type: 'indenizado',
    });
    setShowTerminationDialog(true);
  };

  const calculateTermination = async () => {
    if (!employeeToTerminate) return;

    setCalculatingTermination(true);
    try {
      const { data, error } = await supabase.rpc("calcular_rescisao", {
        p_employee_id: employeeToTerminate.id,
        p_termination_date: terminationForm.termination_date,
        p_last_working_day: terminationForm.last_working_day,
        p_termination_type: terminationForm.termination_type,
        p_notice_type: terminationForm.notice_type,
      });

      if (error) throw error;

      // Buscar os dados calculados
      const { data: termData, error: termError } = await supabase
        .from("employee_terminations")
        .select("*")
        .eq("id", data)
        .single();

      if (termError) throw termError;

      // Aplicar variáveis adicionais ao cálculo
      let adjustedTermData = { ...termData };

      if (terminationVariables.length > 0) {
        // Calcular totais das variáveis adicionais
        const additionalProventos = terminationVariables
          .filter(v => !v.is_desconto)
          .reduce((sum, v) => sum + v.valor, 0);

        const additionalDescontos = terminationVariables
          .filter(v => v.is_desconto)
          .reduce((sum, v) => sum + v.valor, 0);

        // Atualizar os valores da rescisão com as variáveis
        const currentProventos = parseFloat(adjustedTermData.total_proventos || 0);
        const currentDescontos = parseFloat(adjustedTermData.total_descontos || 0);

        adjustedTermData.total_proventos = currentProventos + additionalProventos;
        adjustedTermData.total_descontos = currentDescontos + additionalDescontos;
        adjustedTermData.valor_liquido = adjustedTermData.total_proventos - adjustedTermData.total_descontos;

        // Adicionar detalhes das variáveis ao objeto para exibição
        adjustedTermData.variaveis_adicionais = terminationVariables.map(v => ({
          descricao: v.descricao,
          valor: v.valor,
          tipo: v.is_desconto ? 'Desconto' : 'Provento',
          referencia: v.referencia || '',
        }));

        // Atualizar no banco de dados
        const { error: updateError } = await supabase
          .from("employee_terminations")
          .update({
            total_proventos: adjustedTermData.total_proventos,
            total_descontos: adjustedTermData.total_descontos,
            valor_liquido: adjustedTermData.valor_liquido,
            variaveis_adicionais: adjustedTermData.variaveis_adicionais,
          })
          .eq("id", termData.id);

        if (updateError) {
          console.warn("Não foi possível salvar variáveis adicionais:", updateError);
        }
      }

      setTerminationData(adjustedTermData);
      toast.success("Rescisão calculada com sucesso!" + (terminationVariables.length > 0 ? ` (${terminationVariables.length} variável(eis) incluída(s))` : ""));
    } catch (error: any) {
      console.error("Error calculating termination:", error);
      toast.error(error.message || "Erro ao calcular rescisão");
    } finally {
      setCalculatingTermination(false);
    }
  };

  const approveTermination = async () => {
    if (!terminationData?.id) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("aprovar_rescisao", {
        p_termination_id: terminationData.id,
      });

      if (error) throw error;

      toast.success("Rescisão aprovada e lançamento contábil gerado!");
      setShowTerminationDialog(false);
      setTerminationData(null);
      setEmployeeToTerminate(null);
      loadData();
    } catch (error: any) {
      console.error("Error approving termination:", error);
      toast.error(error.message || "Erro ao aprovar rescisão");
    } finally {
      setSaving(false);
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

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return "R$ 0,00";
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
                                  {employee.is_active && employee.contract_type === 'CLT' && (
                                    <DropdownMenuItem
                                      onClick={() => openTerminationDialog(employee)}
                                      className="text-orange-600"
                                    >
                                      <Scale className="h-4 w-4 mr-2" />
                                      Rescindir Contrato
                                    </DropdownMenuItem>
                                  )}
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
                            {formatCurrency(record.total_proventos_oficial)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {formatCurrency(record.total_descontos_oficial)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(record.liquido_oficial)}
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
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={openAddEventDialog}>
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar Evento
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedPayroll(null)}>
                          Voltar
                        </Button>
                      </div>
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
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollEvents
                            .filter((e) => e.rubrica_tipo === "PROVENTO" || (!e.rubrica_tipo && !(e as any).is_desconto))
                            .map((event) => (
                              <TableRow key={event.id}>
                                <TableCell className="font-mono">{event.rubrica_codigo || "-"}</TableCell>
                                <TableCell>{event.rubrica_descricao || (event as any).descricao}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">
                                  {formatCurrency(event.valor)}
                                </TableCell>
                                <TableCell>
                                  {!(event as any).is_oficial && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                      onClick={() => handleDeleteEvent(event.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          <TableRow className="bg-green-50 font-bold">
                            <TableCell colSpan={3}>Total Proventos</TableCell>
                            <TableCell className="text-right text-green-700">
                              {formatCurrency(selectedPayroll.total_proventos_oficial)}
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
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollEvents
                            .filter((e) => e.rubrica_tipo === "DESCONTO" || (!e.rubrica_tipo && (e as any).is_desconto))
                            .map((event) => (
                              <TableRow key={event.id}>
                                <TableCell className="font-mono">{event.rubrica_codigo || "-"}</TableCell>
                                <TableCell>{event.rubrica_descricao || (event as any).descricao}</TableCell>
                                <TableCell className="text-right text-red-600 font-medium">
                                  {formatCurrency(event.valor)}
                                </TableCell>
                                <TableCell>
                                  {!(event as any).is_oficial && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                      onClick={() => handleDeleteEvent(event.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          <TableRow className="bg-red-50 font-bold">
                            <TableCell colSpan={3}>Total Descontos</TableCell>
                            <TableCell className="text-right text-red-700">
                              {formatCurrency(selectedPayroll.total_descontos_oficial)}
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
                        {formatCurrency(selectedPayroll.liquido_oficial)}
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

        {/* Termination Dialog */}
        <Dialog open={showTerminationDialog} onOpenChange={setShowTerminationDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <Scale className="h-5 w-5" />
                Rescisão de Contrato - {employeeToTerminate?.name}
              </DialogTitle>
              <DialogDescription>
                Calcule os valores rescisórios com orientação do Dr. Advocato
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              {/* Dados da Rescisão */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data da Rescisão</Label>
                  <Input
                    type="date"
                    value={terminationForm.termination_date}
                    onChange={(e) => setTerminationForm({...terminationForm, termination_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Último Dia Trabalhado</Label>
                  <Input
                    type="date"
                    value={terminationForm.last_working_day}
                    onChange={(e) => setTerminationForm({...terminationForm, last_working_day: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Rescisão</Label>
                  <Select
                    value={terminationForm.termination_type}
                    onValueChange={(value) => setTerminationForm({...terminationForm, termination_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {terminationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aviso Prévio</Label>
                  <Select
                    value={terminationForm.notice_type}
                    onValueChange={(value) => setTerminationForm({...terminationForm, notice_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {noticeTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seção de Variáveis Manuais para Rescisão */}
              <Card className="border-dashed border-2 border-blue-300 bg-blue-50/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Variáveis Adicionais (Opcional)
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTerminationVariable}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <CardDescription>
                    Inclua horas extras, faltas, produtividade, adiantamentos e outras variáveis antes de calcular a rescisão.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {terminationVariables.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Nenhuma variável adicionada. Clique em "Adicionar" para incluir horas extras, faltas, produtividade, etc.
                    </p>
                  ) : (
                    terminationVariables.map((variable, index) => (
                      <div key={index} className="flex gap-2 items-end p-3 bg-white rounded-lg border">
                        <div className="flex-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value=""
                            onValueChange={(v) => applyTerminationVariableType(index, v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Selecionar tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">PROVENTOS</div>
                              {commonVariables.filter(v => !v.is_desconto).map((v) => (
                                <SelectItem key={v.value} value={v.value}>
                                  <span className="flex items-center gap-1 text-xs">
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                    {v.label}
                                  </span>
                                </SelectItem>
                              ))}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">DESCONTOS</div>
                              {commonVariables.filter(v => v.is_desconto).map((v) => (
                                <SelectItem key={v.value} value={v.value}>
                                  <span className="flex items-center gap-1 text-xs">
                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                    {v.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-[2]">
                          <Label className="text-xs">Descrição</Label>
                          <Input
                            className="h-8"
                            placeholder="Ex: Hora Extra, Falta, Produtividade..."
                            value={variable.descricao}
                            onChange={(e) => updateTerminationVariable(index, "descricao", e.target.value)}
                          />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs">Valor</Label>
                          <Input
                            className="h-8"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={variable.valor || ""}
                            onChange={(e) => updateTerminationVariable(index, "valor", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-24">
                          <Label className="text-xs">Ref.</Label>
                          <Input
                            className="h-8"
                            placeholder="Ex: 10h"
                            value={variable.referencia || ""}
                            onChange={(e) => updateTerminationVariable(index, "referencia", e.target.value)}
                          />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={variable.is_desconto ? "desconto" : "provento"}
                            onValueChange={(v) => updateTerminationVariable(index, "is_desconto", v === "desconto")}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="provento">
                                <span className="flex items-center gap-1 text-xs">
                                  <TrendingUp className="h-3 w-3 text-green-600" /> +
                                </span>
                              </SelectItem>
                              <SelectItem value="desconto">
                                <span className="flex items-center gap-1 text-xs">
                                  <TrendingDown className="h-3 w-3 text-red-600" /> -
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          onClick={() => removeTerminationVariable(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}

                  {/* Resumo das variáveis */}
                  {terminationVariables.length > 0 && (
                    <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                      <div className="flex gap-4">
                        <span className="text-green-600 font-medium">
                          Proventos: {formatCurrency(
                            terminationVariables
                              .filter(v => !v.is_desconto)
                              .reduce((sum, v) => sum + (v.valor || 0), 0)
                          )}
                        </span>
                        <span className="text-red-600 font-medium">
                          Descontos: {formatCurrency(
                            terminationVariables
                              .filter(v => v.is_desconto)
                              .reduce((sum, v) => sum + (v.valor || 0), 0)
                          )}
                        </span>
                      </div>
                      <span className="font-bold">
                        Líquido: {formatCurrency(
                          terminationVariables.reduce((sum, v) =>
                            v.is_desconto ? sum - (v.valor || 0) : sum + (v.valor || 0), 0
                          )
                        )}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                onClick={calculateTermination}
                disabled={calculatingTermination}
                className="w-full"
              >
                {calculatingTermination ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular Rescisão {terminationVariables.length > 0 && `(com ${terminationVariables.length} variável${terminationVariables.length > 1 ? 'eis' : ''})`}
                  </>
                )}
              </Button>

              {/* Resultado do Cálculo */}
              {terminationData && (
                <>
                  {/* Dr. Advocato Consultation */}
                  <Card className="bg-red-50 border-red-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-red-700 text-base">
                        <Scale className="h-5 w-5" />
                        Dr. Advocato - Orientação Jurídica
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap text-sm text-red-900 font-mono">
                        {terminationData.advocato_consultation}
                      </pre>
                      {terminationData.advocato_warnings && terminationData.advocato_warnings.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="font-semibold text-red-700">⚠️ Alertas Importantes:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {terminationData.advocato_warnings.map((warning, idx) => (
                              <li key={idx} className="text-sm text-red-800">{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Valores Calculados */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Proventos */}
                    <Card className="bg-green-50 border-green-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-green-700 text-base">Proventos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Saldo de Salário:</span>
                          <span className="font-medium">{formatCurrency(terminationData.saldo_salario)}</span>
                        </div>
                        {(terminationData.aviso_previo ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Aviso Prévio:</span>
                            <span className="font-medium">{formatCurrency(terminationData.aviso_previo)}</span>
                          </div>
                        )}
                        {(terminationData.ferias_vencidas ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Férias Vencidas:</span>
                            <span className="font-medium">{formatCurrency(terminationData.ferias_vencidas)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Férias Proporcionais:</span>
                          <span className="font-medium">{formatCurrency(terminationData.ferias_proporcionais)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1/3 Constitucional:</span>
                          <span className="font-medium">{formatCurrency(terminationData.terco_constitucional)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>13º Proporcional:</span>
                          <span className="font-medium">{formatCurrency(terminationData.decimo_terceiro_proporcional)}</span>
                        </div>
                        {(terminationData.multa_fgts ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Multa FGTS:</span>
                            <span className="font-medium">{formatCurrency(terminationData.multa_fgts)}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 flex justify-between font-bold text-green-700">
                          <span>Total Proventos:</span>
                          <span>{formatCurrency(terminationData.total_proventos)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Descontos */}
                    <Card className="bg-red-50 border-red-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-red-700 text-base">Descontos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {(terminationData.desconto_aviso ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Aviso Não Cumprido:</span>
                            <span className="font-medium">{formatCurrency(terminationData.desconto_aviso)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>INSS:</span>
                          <span className="font-medium">{formatCurrency(terminationData.desconto_inss)}</span>
                        </div>
                        {(terminationData.desconto_irrf ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>IRRF:</span>
                            <span className="font-medium">{formatCurrency(terminationData.desconto_irrf)}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 flex justify-between font-bold text-red-700">
                          <span>Total Descontos:</span>
                          <span>{formatCurrency(terminationData.total_descontos)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Variáveis Adicionais - se houver */}
                  {terminationData.variaveis_adicionais && terminationData.variaveis_adicionais.length > 0 && (
                    <Card className="bg-purple-50 border-purple-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-purple-700 text-base flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Variáveis Adicionais Incluídas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {terminationData.variaveis_adicionais.map((variavel: any, index: number) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="flex-1">
                              {variavel.descricao}
                              {variavel.referencia && (
                                <span className="text-gray-500 text-xs ml-1">({variavel.referencia})</span>
                              )}
                            </span>
                            <span className={`font-medium ${variavel.tipo === 'Desconto' ? 'text-red-600' : 'text-green-600'}`}>
                              {variavel.tipo === 'Desconto' ? '-' : '+'} {formatCurrency(variavel.valor)}
                            </span>
                          </div>
                        ))}
                        <div className="border-t pt-2 text-xs text-gray-500">
                          Total Proventos Adicionais: {formatCurrency(terminationData.variaveis_adicionais.filter((v: any) => v.tipo === 'Provento').reduce((sum: number, v: any) => sum + v.valor, 0))}
                          {' | '}
                          Total Descontos Adicionais: {formatCurrency(terminationData.variaveis_adicionais.filter((v: any) => v.tipo === 'Desconto').reduce((sum: number, v: any) => sum + v.valor, 0))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Total Líquido */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Valor Líquido a Pagar:</span>
                        <span className="text-blue-700">{formatCurrency(terminationData.valor_liquido)}</span>
                      </div>
                      {(terminationData.saldo_fgts ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-sm text-gray-600 mt-2">
                          <span>Saldo FGTS para saque (aproximado):</span>
                          <span>{formatCurrency(terminationData.saldo_fgts)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTerminationDialog(false)}>
                Cancelar
              </Button>
              {terminationData && (
                <Button
                  onClick={approveTermination}
                  disabled={saving}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aprovando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aprovar e Gerar Lançamento Contábil
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para adicionar evento na folha */}
        <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Variável na Folha</DialogTitle>
              <DialogDescription>
                Inclua variáveis como horas extras, faltas, produtividade, etc. na folha de pagamento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Seleção de variável pré-definida */}
              <div>
                <Label className="text-base font-semibold">Tipo de Variável</Label>
                <Select
                  value={newEventForm.variable_type}
                  onValueChange={handleVariableTypeChange}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o tipo de variável..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" disabled>-- Selecione --</SelectItem>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">PROVENTOS</div>
                    {commonVariables.filter(v => !v.is_desconto).map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-3 w-3 text-green-600" />
                          {v.label}
                        </span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">DESCONTOS</div>
                    {commonVariables.filter(v => v.is_desconto).map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-3 w-3 text-red-600" />
                          {v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Descrição *</Label>
                    <Input
                      placeholder="Ex: Hora Extra, Produtividade, Falta..."
                      value={newEventForm.descricao}
                      onChange={(e) => setNewEventForm({ ...newEventForm, descricao: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Valor *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newEventForm.valor || ""}
                      onChange={(e) => setNewEventForm({ ...newEventForm, valor: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <Label>Referência</Label>
                    <Input
                      placeholder="Ex: 10 horas, 2 dias, 5%..."
                      value={newEventForm.referencia}
                      onChange={(e) => setNewEventForm({ ...newEventForm, referencia: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={newEventForm.is_desconto ? "desconto" : "provento"}
                      onValueChange={(v) => setNewEventForm({ ...newEventForm, is_desconto: v === "desconto" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="provento">
                          <span className="flex items-center gap-2">
                            <TrendingUp className="h-3 w-3 text-green-600" />
                            Provento (+)
                          </span>
                        </SelectItem>
                        <SelectItem value="desconto">
                          <span className="flex items-center gap-2">
                            <TrendingDown className="h-3 w-3 text-red-600" />
                            Desconto (-)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Rubrica (opcional)</Label>
                    <Select
                      value={newEventForm.rubrica_codigo}
                      onValueChange={(v) => setNewEventForm({ ...newEventForm, rubrica_codigo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem rubrica" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem rubrica</SelectItem>
                        {rubricas
                          .filter(r => r.is_active)
                          .map((r) => (
                            <SelectItem key={r.codigo} value={r.codigo}>
                              {r.codigo} - {r.descricao}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4">
                  <Label>Observação (opcional)</Label>
                  <Input
                    placeholder="Observação adicional"
                    value={newEventForm.observacao}
                    onChange={(e) => setNewEventForm({ ...newEventForm, observacao: e.target.value })}
                  />
                </div>
              </div>

              {/* Preview do valor */}
              {newEventForm.valor > 0 && (
                <div className={cn(
                  "p-3 rounded-lg flex items-center justify-between",
                  newEventForm.is_desconto ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
                )}>
                  <span className="font-medium">
                    {newEventForm.descricao || "Evento"}
                    {newEventForm.referencia && ` (${newEventForm.referencia})`}
                  </span>
                  <span className={cn(
                    "font-bold text-lg",
                    newEventForm.is_desconto ? "text-red-600" : "text-green-600"
                  )}>
                    {newEventForm.is_desconto ? "-" : "+"}{formatCurrency(newEventForm.valor)}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddEventDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddEvent} disabled={addingEvent}>
                {addingEvent ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Variável
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

export default Payroll;
