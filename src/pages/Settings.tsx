import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Settings as SettingsIcon, User, Bell, Shield, Building2, Mail, Save, Loader2, Search,
  Users, UserPlus, Home, Car, AlertTriangle, Brain, Plus, Edit, Trash2, Heart, MoreHorizontal,
  CheckCircle2, Briefcase, Key, Copy, Eye, EyeOff, RefreshCw, Lock, Unlock, UserCog
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AITeamBadge } from "@/components/AITeamBadge";

interface Employee {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  department: string;
  role: string;
  hire_date: string | null;
  contract_type: string | null;
  official_salary: number | null;
  is_active: boolean;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employee_id: string | null;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login: string | null;
  created_at: string;
  temp_password?: string;
}

const DEPARTMENTS = [
  { value: "contabil", label: "Contabil" },
  { value: "fiscal", label: "Fiscal" },
  { value: "dp", label: "Departamento Pessoal" },
  { value: "legalizacao", label: "Legalizacao" },
  { value: "administrativo", label: "Administrativo" },
  { value: "financeiro", label: "Financeiro" },
  { value: "ti", label: "TI" },
];

const CONTRACT_TYPES = [
  { value: "clt", label: "CLT" },
  { value: "pj", label: "PJ / MEI" },
  { value: "autonomo", label: "Autonomo" },
  { value: "estagio", label: "Estagiario" },
  { value: "freelancer", label: "Freelancer" },
];

const USER_ROLES = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema" },
  { value: "manager", label: "Gerente", description: "Gerencia equipe e relatórios" },
  { value: "operator", label: "Operador", description: "Operações do dia a dia" },
  { value: "viewer", label: "Visualizador", description: "Apenas consulta" },
];

// Interface para dados da empresa via Brasil API
interface CompanyData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  ddd_telefone_1: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Employee states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    department: "contabil",
    role: "",
    hire_date: "",
    contract_type: "clt",
    official_salary: "",
  });

  // User states
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "viewer",
    employee_id: "",
  });

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      let query = supabase
        .from("employees")
        .select("*")
        .order("name");

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error loading employees:", error);
      toast({
        title: "Erro ao carregar funcionarios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingEmployees(false);
    }
  }, [showInactive, toast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Carregar usuários do sistema
  const loadSystemUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      let query = supabase
        .from("system_users")
        .select("*")
        .order("name");

      if (!showInactiveUsers) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSystemUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
      // Tabela pode não existir ainda, silenciar erro
      if (!error.message?.includes("does not exist")) {
        toast({
          title: "Erro ao carregar usuarios",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoadingUsers(false);
    }
  }, [showInactiveUsers, toast]);

  useEffect(() => {
    loadSystemUsers();
  }, [loadSystemUsers]);

  const resetEmployeeForm = () => {
    setEmployeeForm({
      name: "",
      cpf: "",
      phone: "",
      email: "",
      department: "contabil",
      role: "",
      hire_date: "",
      contract_type: "clt",
      official_salary: "",
    });
    setEditingEmployee(null);
  };

  const openCreateEmployee = () => {
    resetEmployeeForm();
    setShowEmployeeDialog(true);
  };

  const openEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name,
      cpf: employee.cpf || "",
      phone: employee.phone || "",
      email: employee.email || "",
      department: employee.department,
      role: employee.role,
      hire_date: employee.hire_date || "",
      contract_type: employee.contract_type || "clt",
      official_salary: employee.official_salary?.toString() || "",
    });
    setShowEmployeeDialog(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.name.trim() || !employeeForm.department || !employeeForm.role) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha nome, departamento e cargo",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const employeeData = {
        name: employeeForm.name,
        cpf: employeeForm.cpf || null,
        phone: employeeForm.phone || null,
        email: employeeForm.email || null,
        department: employeeForm.department,
        role: employeeForm.role,
        hire_date: employeeForm.hire_date || null,
        contract_type: employeeForm.contract_type,
        official_salary: employeeForm.official_salary ? parseFloat(employeeForm.official_salary) : null,
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", editingEmployee.id);

        if (error) throw error;
        toast({
          title: "Funcionario atualizado!",
        });
      } else {
        const { error } = await supabase
          .from("employees")
          .insert({ ...employeeData, is_active: true });

        if (error) throw error;
        toast({
          title: "Funcionario cadastrado!",
        });
      }

      setShowEmployeeDialog(false);
      resetEmployeeForm();
      loadEmployees();
    } catch (error: any) {
      console.error("Error saving employee:", error);
      toast({
        title: "Erro ao salvar funcionario",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setShowDeleteDialog(true);
  };

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: false })
        .eq("id", employeeToDelete.id);

      if (error) throw error;

      toast({
        title: "Funcionario desativado!",
      });
      setShowDeleteDialog(false);
      setEmployeeToDelete(null);
      loadEmployees();
    } catch (error: any) {
      console.error("Error deactivating employee:", error);
      toast({
        title: "Erro ao desativar funcionario",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEmployeeStatus = async (employee: Employee) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: !employee.is_active })
        .eq("id", employee.id);

      if (error) throw error;

      toast({
        title: employee.is_active ? "Funcionario desativado!" : "Funcionario reativado!",
      });
      loadEmployees();
    } catch (error: any) {
      console.error("Error toggling employee:", error);
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Funções para gerenciamento de usuários
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const resetUserForm = () => {
    setUserForm({
      name: "",
      email: "",
      phone: "",
      role: "viewer",
      employee_id: "",
    });
    setEditingUser(null);
    setGeneratedPassword(null);
    setShowPassword(false);
  };

  const openCreateUser = () => {
    resetUserForm();
    const newPassword = generatePassword();
    setGeneratedPassword(newPassword);
    setShowUserDialog(true);
  };

  const openEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      employee_id: user.employee_id || "",
    });
    setGeneratedPassword(null);
    setShowUserDialog(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha nome e e-mail",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        // Atualizar usuário existente
        const { error } = await supabase
          .from("system_users")
          .update({
            name: userForm.name,
            email: userForm.email,
            phone: userForm.phone || null,
            role: userForm.role,
            employee_id: userForm.employee_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingUser.id);

        if (error) throw error;
        toast({
          title: "Usuario atualizado!",
        });
      } else {
        // Criar novo usuário com senha gerada
        const { error } = await supabase
          .from("system_users")
          .insert({
            name: userForm.name,
            email: userForm.email,
            phone: userForm.phone || null,
            role: userForm.role,
            employee_id: userForm.employee_id || null,
            temp_password: generatedPassword,
            must_change_password: true,
            is_active: true,
          });

        if (error) throw error;
        toast({
          title: "Usuario criado!",
          description: "Compartilhe a senha temporaria com o usuario",
        });
      }

      setShowUserDialog(false);
      resetUserForm();
      loadSystemUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast({
        title: "Erro ao salvar usuario",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (user: SystemUser) => {
    setSubmitting(true);
    try {
      const newPassword = generatePassword();

      const { error } = await supabase
        .from("system_users")
        .update({
          temp_password: newPassword,
          must_change_password: true,
          login_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      // Mostrar a nova senha
      setEditingUser(user);
      setGeneratedPassword(newPassword);
      setShowUserDialog(true);

      toast({
        title: "Senha redefinida!",
        description: "Nova senha temporaria gerada",
      });

      loadSystemUsers();
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = (user: SystemUser) => {
    setUserToDelete(user);
    setShowDeleteUserDialog(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("system_users")
        .update({ is_active: false })
        .eq("id", userToDelete.id);

      if (error) throw error;

      toast({
        title: "Usuario desativado!",
      });
      setShowDeleteUserDialog(false);
      setUserToDelete(null);
      loadSystemUsers();
    } catch (error: any) {
      console.error("Error deactivating user:", error);
      toast({
        title: "Erro ao desativar usuario",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: SystemUser) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("system_users")
        .update({ is_active: !user.is_active })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: user.is_active ? "Usuario desativado!" : "Usuario reativado!",
      });
      loadSystemUsers();
    } catch (error: any) {
      console.error("Error toggling user:", error);
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Senha copiada para a area de transferencia",
    });
  };

  const getRoleLabel = (value: string) => {
    const role = USER_ROLES.find(r => r.value === value);
    return role?.label || value;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "manager": return "default";
      case "operator": return "secondary";
      default: return "outline";
    }
  };

  const getDepartmentLabel = (value: string) => {
    const dept = DEPARTMENTS.find(d => d.value === value);
    return dept?.label || value;
  };

  const getContractTypeLabel = (value: string | null) => {
    if (!value) return "-";
    const type = CONTRACT_TYPES.find(t => t.value === value);
    return type?.label || value;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Estados para os campos da empresa
  const [companyForm, setCompanyForm] = useState({
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    crc: "",
    crcState: "GO",
    website: "",
    email: "",
    phone: "",
    address: "",
    number: "",
    bairro: "",
    city: "",
    state: "",
    zip: "",
    // Responsável técnico
    responsavelTecnico: "",
    responsavelCrc: "",
    responsavelCpf: "",
  });
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loadingOffice, setLoadingOffice] = useState(false);

  // Carregar dados do escritório
  const loadAccountingOffice = useCallback(async () => {
    setLoadingOffice(true);
    try {
      const { data, error } = await supabase
        .from("accounting_office")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error) {
        console.log("Nenhum escritório cadastrado ainda");
        return;
      }

      if (data) {
        setOfficeId(data.id);
        setCompanyForm({
          cnpj: data.cnpj || "",
          razaoSocial: data.razao_social || "",
          nomeFantasia: data.nome_fantasia || "",
          crc: data.crc_number || "",
          crcState: data.crc_state || "GO",
          website: data.website || "",
          email: data.email || "",
          phone: data.telefone || "",
          address: data.endereco || "",
          number: data.numero || "",
          bairro: data.bairro || "",
          city: data.cidade || "",
          state: data.estado || "",
          zip: data.cep || "",
          responsavelTecnico: data.responsavel_tecnico || "",
          responsavelCrc: data.responsavel_crc || "",
          responsavelCpf: data.responsavel_cpf || "",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar escritório:", error);
    } finally {
      setLoadingOffice(false);
    }
  }, []);

  useEffect(() => {
    loadAccountingOffice();
  }, [loadAccountingOffice]);

  // Formatar CNPJ enquanto digita
  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  };

  // Buscar dados do CNPJ na Brasil API
  const fetchCnpjData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    setIsLoadingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

      if (!response.ok) {
        throw new Error("CNPJ não encontrado");
      }

      const data: CompanyData = await response.json();

      // Formatar telefone
      let phone = "";
      if (data.ddd_telefone_1) {
        const phoneClean = data.ddd_telefone_1.replace(/\D/g, "");
        if (phoneClean.length >= 10) {
          phone = `(${phoneClean.slice(0, 2)}) ${phoneClean.slice(2, 6)}-${phoneClean.slice(6, 10)}`;
        }
      }

      // Atualizar formulário com dados da API
      setCompanyForm(prev => ({
        ...prev,
        razaoSocial: data.razao_social || prev.razaoSocial,
        nomeFantasia: data.nome_fantasia || data.razao_social || prev.nomeFantasia,
        email: data.email || prev.email,
        phone: phone || prev.phone,
        address: data.logradouro || prev.address,
        number: data.numero || prev.number,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
        zip: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : prev.zip,
      }));

      toast({
        title: "Dados carregados",
        description: `Dados de ${data.razao_social} preenchidos automaticamente.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CNPJ",
        description: "Não foi possível encontrar dados para este CNPJ. Verifique e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  // Handler para mudança do CNPJ
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCnpj(e.target.value);
    setCompanyForm(prev => ({ ...prev, cnpj: formatted }));

    // Buscar automaticamente quando CNPJ estiver completo
    const cleanCnpj = formatted.replace(/\D/g, "");
    if (cleanCnpj.length === 14) {
      fetchCnpjData(formatted);
    }
  };

  // Handler genérico para outros campos
  const handleFieldChange = (field: keyof typeof companyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompanyForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const officeData = {
        razao_social: companyForm.razaoSocial,
        nome_fantasia: companyForm.nomeFantasia,
        cnpj: companyForm.cnpj,
        crc_number: companyForm.crc,
        crc_state: companyForm.crcState,
        responsavel_tecnico: companyForm.responsavelTecnico,
        responsavel_crc: companyForm.responsavelCrc,
        responsavel_cpf: companyForm.responsavelCpf,
        endereco: companyForm.address,
        numero: companyForm.number,
        bairro: companyForm.bairro,
        cidade: companyForm.city,
        estado: companyForm.state,
        cep: companyForm.zip,
        telefone: companyForm.phone,
        email: companyForm.email,
        website: companyForm.website,
      };

      if (officeId) {
        // Atualizar existente
        const { error } = await supabase
          .from("accounting_office")
          .update(officeData)
          .eq("id", officeId);

        if (error) throw error;
      } else {
        // Criar novo
        const { data, error } = await supabase
          .from("accounting_office")
          .insert({ ...officeData, is_active: true })
          .select()
          .single();

        if (error) throw error;
        if (data) setOfficeId(data.id);
      }

      toast({
        title: "Configurações salvas",
        description: "Os dados do escritório foram atualizados com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 max-w-6xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <SettingsIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
                  <p className="text-muted-foreground">
                    Configure as preferências e integrações do sistema
                  </p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="company" className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="company">
                  <Building2 className="w-4 h-4 mr-2" />
                  Empresa
                </TabsTrigger>
                <TabsTrigger value="employees">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Funcionarios
                </TabsTrigger>
                <TabsTrigger value="users">
                  <User className="w-4 h-4 mr-2" />
                  Usuarios
                </TabsTrigger>
                <TabsTrigger value="notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notificacoes
                </TabsTrigger>
                <TabsTrigger value="integrations">
                  <Mail className="w-4 h-4 mr-2" />
                  Integracoes
                </TabsTrigger>
                <TabsTrigger value="security">
                  <Shield className="w-4 h-4 mr-2" />
                  Seguranca
                </TabsTrigger>
              </TabsList>

              {/* Company Settings */}
              <TabsContent value="company" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados da Empresa</CardTitle>
                    <CardDescription>
                      Informações do escritório de contabilidade
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* CNPJ com busca automática */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ do Escritório</Label>
                        <div className="relative">
                          <Input
                            id="cnpj"
                            placeholder="00.000.000/0000-00"
                            value={companyForm.cnpj}
                            onChange={handleCnpjChange}
                            className={isLoadingCnpj ? "pr-10" : ""}
                          />
                          {isLoadingCnpj && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Digite o CNPJ para preencher automaticamente os dados
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="crc">CRC (Registro no CFC)</Label>
                        <Input
                          id="crc"
                          placeholder="CRC/XX 000000"
                          value={companyForm.crc}
                          onChange={handleFieldChange("crc")}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Razão Social</Label>
                        <Input
                          id="companyName"
                          placeholder="Razão Social da Empresa"
                          value={companyForm.razaoSocial}
                          onChange={handleFieldChange("razaoSocial")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tradeName">Nome Fantasia</Label>
                        <Input
                          id="tradeName"
                          placeholder="Nome Fantasia"
                          value={companyForm.nomeFantasia}
                          onChange={handleFieldChange("nomeFantasia")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        placeholder="www.seusite.com.br"
                        value={companyForm.website}
                        onChange={handleFieldChange("website")}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="contato@empresa.com.br"
                          value={companyForm.email}
                          onChange={handleFieldChange("email")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          placeholder="(00) 0000-0000"
                          value={companyForm.phone}
                          onChange={handleFieldChange("phone")}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Endereço</CardTitle>
                    <CardDescription>
                      Preenchido automaticamente ao digitar o CNPJ
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="address">Logradouro</Label>
                        <Input
                          id="address"
                          placeholder="Rua, Avenida..."
                          value={companyForm.address}
                          onChange={handleFieldChange("address")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="number">Número</Label>
                        <Input
                          id="number"
                          placeholder="000"
                          value={companyForm.number}
                          onChange={handleFieldChange("number")}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bairro">Bairro</Label>
                        <Input
                          id="bairro"
                          placeholder="Bairro"
                          value={companyForm.bairro}
                          onChange={handleFieldChange("bairro")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          placeholder="Cidade"
                          value={companyForm.city}
                          onChange={handleFieldChange("city")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">Estado</Label>
                        <Input
                          id="state"
                          placeholder="UF"
                          maxLength={2}
                          value={companyForm.state}
                          onChange={handleFieldChange("state")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zip">CEP</Label>
                        <Input
                          id="zip"
                          placeholder="00000-000"
                          value={companyForm.zip}
                          onChange={handleFieldChange("zip")}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Responsável Técnico</CardTitle>
                    <CardDescription>
                      Contador responsável pelos serviços (usado em contratos e documentos)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="responsavelTecnico">Nome Completo</Label>
                        <Input
                          id="responsavelTecnico"
                          placeholder="Nome do Contador"
                          value={companyForm.responsavelTecnico}
                          onChange={handleFieldChange("responsavelTecnico")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="responsavelCrc">CRC do Responsável</Label>
                        <Input
                          id="responsavelCrc"
                          placeholder="CRC/GO 000000"
                          value={companyForm.responsavelCrc}
                          onChange={handleFieldChange("responsavelCrc")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="responsavelCpf">CPF do Responsável</Label>
                        <Input
                          id="responsavelCpf"
                          placeholder="000.000.000-00"
                          value={companyForm.responsavelCpf}
                          onChange={handleFieldChange("responsavelCpf")}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Employees Settings */}
              <TabsContent value="employees" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Funcionarios</CardTitle>
                        <CardDescription>
                          Cadastre e gerencie os funcionarios da empresa
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={showInactive ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setShowInactive(!showInactive)}
                        >
                          {showInactive ? "Ver Ativos" : "Ver Inativos"}
                        </Button>
                        <Button onClick={openCreateEmployee}>
                          <Plus className="w-4 h-4 mr-2" />
                          Novo Funcionario
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingEmployees ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : employees.length === 0 ? (
                      <div className="text-center py-12">
                        <Briefcase className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Nenhum funcionario cadastrado</h3>
                        <p className="text-muted-foreground mb-4">
                          Cadastre funcionarios para usar o sistema de incentivos e PLR
                        </p>
                        <Button onClick={openCreateEmployee}>
                          <Plus className="w-4 h-4 mr-2" />
                          Cadastrar Funcionario
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Departamento</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Salario</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Acoes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((employee) => (
                            <TableRow key={employee.id} className={!employee.is_active ? "opacity-50" : ""}>
                              <TableCell>
                                <div className="font-medium">{employee.name}</div>
                                {employee.email && (
                                  <div className="text-xs text-muted-foreground">{employee.email}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{getDepartmentLabel(employee.department)}</Badge>
                              </TableCell>
                              <TableCell>{employee.role}</TableCell>
                              <TableCell>{getContractTypeLabel(employee.contract_type)}</TableCell>
                              <TableCell>{formatCurrency(employee.official_salary)}</TableCell>
                              <TableCell>
                                <Badge variant={employee.is_active ? "default" : "secondary"}>
                                  {employee.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditEmployee(employee)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleEmployeeStatus(employee)}>
                                      {employee.is_active ? (
                                        <>
                                          <AlertTriangle className="h-4 w-4 mr-2" />
                                          Desativar
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Reativar
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDeleteEmployee(employee)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users Settings */}
              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Usuarios do Sistema</CardTitle>
                        <CardDescription>
                          Gerencie usuarios e seus acessos ao sistema
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={showInactiveUsers ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setShowInactiveUsers(!showInactiveUsers)}
                        >
                          {showInactiveUsers ? "Ver Ativos" : "Ver Inativos"}
                        </Button>
                        <Button onClick={openCreateUser}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Novo Usuario
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingUsers ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : systemUsers.length === 0 ? (
                      <div className="text-center py-12">
                        <UserCog className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Nenhum usuario cadastrado</h3>
                        <p className="text-muted-foreground mb-4">
                          Cadastre usuarios para controlar o acesso ao sistema
                        </p>
                        <Button onClick={openCreateUser}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Cadastrar Usuario
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Perfil</TableHead>
                            <TableHead>Ultimo Acesso</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Acoes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systemUsers.map((user) => (
                            <TableRow key={user.id} className={!user.is_active ? "opacity-50" : ""}>
                              <TableCell>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                {user.must_change_password && (
                                  <Badge variant="outline" className="mt-1 text-xs text-orange-600 border-orange-300">
                                    <Key className="w-3 h-3 mr-1" />
                                    Deve trocar senha
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeVariant(user.role) as any}>
                                  {getRoleLabel(user.role)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {user.last_login
                                  ? new Date(user.last_login).toLocaleDateString("pt-BR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : <span className="text-muted-foreground">Nunca acessou</span>
                                }
                              </TableCell>
                              <TableCell>
                                <Badge variant={user.is_active ? "default" : "secondary"}>
                                  {user.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditUser(user)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Redefinir Senha
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleUserStatus(user)}>
                                      {user.is_active ? (
                                        <>
                                          <Lock className="h-4 w-4 mr-2" />
                                          Desativar
                                        </>
                                      ) : (
                                        <>
                                          <Unlock className="h-4 w-4 mr-2" />
                                          Reativar
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDeleteUser(user)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Informações sobre perfis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Perfis de Acesso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {USER_ROLES.map((role) => (
                        <div key={role.value} className="p-3 border rounded-lg">
                          <Badge variant={getRoleBadgeVariant(role.value) as any} className="mb-2">
                            {role.label}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Settings */}
              <TabsContent value="notifications" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Preferências de Notificação</CardTitle>
                    <CardDescription>
                      Configure como você deseja receber notificações
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Notificações por E-mail</Label>
                          <p className="text-sm text-muted-foreground">
                            Receba atualizações importantes por e-mail
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Alertas de Inadimplência</Label>
                          <p className="text-sm text-muted-foreground">
                            Notificar quando clientes estiverem atrasados
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Vencimentos Próximos</Label>
                          <p className="text-sm text-muted-foreground">
                            Alertar sobre honorários a vencer em 7 dias
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Conciliações Automáticas</Label>
                          <p className="text-sm text-muted-foreground">
                            Notificar sobre reconciliações realizadas
                          </p>
                        </div>
                        <Switch />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Relatórios Automáticos</Label>
                          <p className="text-sm text-muted-foreground">
                            Receber relatórios mensais por e-mail
                          </p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Integrations Settings */}
              <TabsContent value="integrations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Integrações de API</CardTitle>
                    <CardDescription>
                      Configure as integrações com serviços externos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Brasil API</h4>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Conectado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Enriquecimento de dados de clientes via CNPJ
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">SendGrid</h4>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            Não configurado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Envio de e-mails transacionais e cartas de cobrança
                        </p>
                        <Input placeholder="API Key do SendGrid" type="password" />
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">WhatsApp (Evolution API)</h4>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            Não configurado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Envio de notificações e cartas de cobrança via WhatsApp
                        </p>
                        <div className="space-y-2">
                          <Input placeholder="URL da API" />
                          <Input placeholder="API Key" type="password" />
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Banco Cora</h4>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            Não configurado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Integração bancária para conciliação automática
                        </p>
                        <Button variant="outline" size="sm">Conectar com OAuth</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Settings */}
              <TabsContent value="security" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Segurança e Privacidade</CardTitle>
                    <CardDescription>
                      Configure as opções de segurança do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Autenticação de Dois Fatores (2FA)</Label>
                          <p className="text-sm text-muted-foreground">
                            Aumenta a segurança exigindo código adicional no login
                          </p>
                        </div>
                        <Switch />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Logs de Auditoria</Label>
                          <p className="text-sm text-muted-foreground">
                            Registrar todas as ações dos usuários no sistema
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Timeout de Sessão</Label>
                          <p className="text-sm text-muted-foreground">
                            Encerrar sessão automaticamente após inatividade
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label>Tempo de Inatividade (minutos)</Label>
                        <Input type="number" defaultValue="30" min="5" max="120" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Save Button */}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Salvando..." : "Salvar Configuracoes"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Editar Funcionario" : "Novo Funcionario"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee ? "Atualize as informacoes do funcionario" : "Cadastre um novo funcionario"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp-name">Nome Completo *</Label>
                <Input
                  id="emp-name"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Rose Maria Silva"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-cpf">CPF</Label>
                <Input
                  id="emp-cpf"
                  value={employeeForm.cpf}
                  onChange={(e) => setEmployeeForm(prev => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp-phone">Telefone</Label>
                <Input
                  id="emp-phone"
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(62) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-email">E-mail</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@empresa.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento *</Label>
                <Select
                  value={employeeForm.department}
                  onValueChange={(value) => setEmployeeForm(prev => ({ ...prev, department: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-role">Cargo *</Label>
                <Input
                  id="emp-role"
                  value={employeeForm.role}
                  onChange={(e) => setEmployeeForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="Ex: Assistente Contabil"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={employeeForm.contract_type}
                  onValueChange={(value) => setEmployeeForm(prev => ({ ...prev, contract_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-hire-date">Data de Admissao</Label>
                <Input
                  id="emp-hire-date"
                  type="date"
                  value={employeeForm.hire_date}
                  onChange={(e) => setEmployeeForm(prev => ({ ...prev, hire_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-salary">Salario (R$)</Label>
                <Input
                  id="emp-salary"
                  type="number"
                  step="0.01"
                  value={employeeForm.official_salary}
                  onChange={(e) => setEmployeeForm(prev => ({ ...prev, official_salary: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEmployee} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {editingEmployee ? "Salvar" : "Cadastrar"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Employee AlertDialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Funcionario</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o funcionario "{employeeToDelete?.name}"?
              O funcionario nao sera excluido permanentemente e pode ser reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEmployee}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Desativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={(open) => {
        if (!open) resetUserForm();
        setShowUserDialog(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {generatedPassword && !editingUser
                ? "Novo Usuario"
                : generatedPassword
                ? "Senha Redefinida"
                : "Editar Usuario"}
            </DialogTitle>
            <DialogDescription>
              {generatedPassword && !editingUser
                ? "Preencha os dados e compartilhe a senha temporaria com o usuario"
                : generatedPassword
                ? "Compartilhe a nova senha temporaria com o usuario"
                : "Atualize as informacoes do usuario"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Senha Gerada - Destaque */}
            {generatedPassword && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <Label className="text-green-800 font-medium">Senha Temporaria</Label>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={generatedPassword}
                      readOnly
                      className="pr-20 font-mono text-lg bg-white"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyToClipboard(generatedPassword)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  O usuario devera trocar a senha no primeiro acesso
                </p>
              </div>
            )}

            {/* Formulário - só mostra se não for apenas exibição de senha */}
            {(!generatedPassword || !editingUser) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Nome Completo *</Label>
                    <Input
                      id="user-name"
                      value={userForm.name}
                      onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Maria Silva"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="user-email">E-mail *</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@empresa.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-phone">Telefone</Label>
                    <Input
                      id="user-phone"
                      value={userForm.phone}
                      onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(62) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Perfil de Acesso *</Label>
                    <Select
                      value={userForm.role}
                      onValueChange={(value) => setUserForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            <div className="flex flex-col">
                              <span>{role.label}</span>
                              <span className="text-xs text-muted-foreground">{role.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Vincular a Funcionario</Label>
                  <Select
                    value={userForm.employee_id}
                    onValueChange={(value) => setUserForm(prev => ({ ...prev, employee_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um funcionario (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {getDepartmentLabel(emp.department)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vincule a um funcionario para associar o acesso
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              {generatedPassword && editingUser ? "Fechar" : "Cancelar"}
            </Button>
            {(!generatedPassword || !editingUser) && (
              <Button onClick={handleSaveUser} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {editingUser ? "Salvar" : "Criar Usuario"}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User AlertDialog */}
      <AlertDialog open={showDeleteUserDialog} onOpenChange={setShowDeleteUserDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o usuario "{userToDelete?.name}"?
              O usuario nao podera mais acessar o sistema, mas podera ser reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Desativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default Settings;
