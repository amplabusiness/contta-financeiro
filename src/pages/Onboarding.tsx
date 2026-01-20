/**
 * Onboarding - Wizard de configuração inicial do tenant
 *
 * Esta página guia o usuário através da configuração inicial do seu escritório/empresa.
 * Deve ser acessada após o primeiro login de um novo tenant.
 *
 * Steps:
 * 1. Dados da Empresa (razão social, nome fantasia, CNPJ)
 * 2. Endereço
 * 3. Dados Fiscais (CRC, inscrição municipal, regime tributário)
 * 4. Responsável Técnico
 * 5. Sócios (opcional)
 * 6. Conclusão
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantConfig, clearTenantConfigCache } from "@/hooks/useTenantConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  FileText,
  User,
  Users,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  SkipForward,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Estados brasileiros
const ESTADOS_BR = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

const REGIMES_TRIBUTARIOS = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

interface FormData {
  // Step 1: Dados da Empresa
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  // Step 2: Endereço
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  // Step 3: Dados Fiscais
  crc_number: string;
  crc_state: string;
  inscricao_municipal: string;
  regime_tributario: string;
  cnae_principal: string;
  // Step 4: Responsável Técnico
  responsavel_tecnico: string;
  responsavel_crc: string;
  responsavel_cpf: string;
  telefone: string;
  email: string;
  // Step 5: Sócios
  socios: Array<{ nome: string; cpf: string; participacao: string }>;
}

const STEPS = [
  { id: 1, title: "Dados da Empresa", icon: Building2, description: "Informações básicas do seu escritório" },
  { id: 2, title: "Endereço", icon: MapPin, description: "Localização do escritório" },
  { id: 3, title: "Dados Fiscais", icon: FileText, description: "CRC, inscrição municipal e regime" },
  { id: 4, title: "Responsável Técnico", icon: User, description: "Contador responsável" },
  { id: 5, title: "Sócios", icon: Users, description: "Opcional - cadastre os sócios" },
  { id: 6, title: "Conclusão", icon: CheckCircle, description: "Revise e finalize" },
];

// Função para consultar CNPJ na API pública
async function fetchCNPJData(cnpj: string): Promise<{
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  email: string;
  cnae_principal: string;
  natureza_juridica: string;
  capital_social: number;
  data_abertura: string;
  porte: string;
  socios: Array<{ nome: string; qualificacao: string }>;
} | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  if (cnpjLimpo.length !== 14) return null;

  try {
    // Usando API pública BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    if (!response.ok) {
      throw new Error("CNPJ não encontrado");
    }
    const data = await response.json();

    return {
      razao_social: data.razao_social || "",
      nome_fantasia: data.nome_fantasia || "",
      endereco: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      cidade: data.municipio || "",
      estado: data.uf || "",
      cep: data.cep || "",
      telefone: data.ddd_telefone_1 || "",
      email: data.email || "",
      cnae_principal: data.cnae_fiscal?.toString() || "",
      natureza_juridica: data.natureza_juridica || "",
      capital_social: data.capital_social || 0,
      data_abertura: data.data_inicio_atividade || "",
      porte: data.porte || "",
      socios: (data.qsa || []).map((s: any) => ({
        nome: s.nome_socio || "",
        qualificacao: s.qualificacao_socio || "",
      })),
    };
  } catch (error) {
    console.error("Erro ao consultar CNPJ:", error);
    return null;
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading, isOnboardingComplete, refetch } = useTenantConfig();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    crc_number: "",
    crc_state: "",
    inscricao_municipal: "",
    regime_tributario: "",
    cnae_principal: "",
    responsavel_tecnico: "",
    responsavel_crc: "",
    responsavel_cpf: "",
    telefone: "",
    email: "",
    socios: [],
  });

  // Se onboarding já foi completado, redirecionar para dashboard
  useEffect(() => {
    if (!tenantLoading && isOnboardingComplete) {
      navigate("/dashboard", { replace: true });
    }
  }, [tenantLoading, isOnboardingComplete, navigate]);

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Função para buscar dados do CNPJ
  const handleCNPJSearch = async () => {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      toast.error("Digite um CNPJ válido com 14 dígitos");
      return;
    }

    setLoadingCNPJ(true);
    try {
      const dadosCNPJ = await fetchCNPJData(formData.cnpj);
      if (dadosCNPJ) {
        setFormData((prev) => ({
          ...prev,
          razao_social: dadosCNPJ.razao_social || prev.razao_social,
          nome_fantasia: dadosCNPJ.nome_fantasia || prev.nome_fantasia,
          endereco: dadosCNPJ.endereco || prev.endereco,
          numero: dadosCNPJ.numero || prev.numero,
          complemento: dadosCNPJ.complemento || prev.complemento,
          bairro: dadosCNPJ.bairro || prev.bairro,
          cidade: dadosCNPJ.cidade || prev.cidade,
          estado: dadosCNPJ.estado || prev.estado,
          cep: dadosCNPJ.cep || prev.cep,
          telefone: dadosCNPJ.telefone || prev.telefone,
          email: dadosCNPJ.email || prev.email,
          cnae_principal: dadosCNPJ.cnae_principal || prev.cnae_principal,
          // Preencher sócios se houver
          socios: dadosCNPJ.socios.length > 0
            ? dadosCNPJ.socios.map((s) => ({
                nome: s.nome,
                cpf: "",
                participacao: "",
              }))
            : prev.socios,
        }));
        toast.success("Dados do CNPJ carregados com sucesso!");
      } else {
        toast.error("CNPJ não encontrado ou inválido");
      }
    } catch (error) {
      toast.error("Erro ao consultar CNPJ");
    } finally {
      setLoadingCNPJ(false);
    }
  };

  const addSocio = () => {
    setFormData((prev) => ({
      ...prev,
      socios: [...prev.socios, { nome: "", cpf: "", participacao: "" }],
    }));
  };

  const updateSocio = (index: number, field: string, value: string) => {
    setFormData((prev) => {
      const newSocios = [...prev.socios];
      newSocios[index] = { ...newSocios[index], [field]: value };
      return { ...prev, socios: newSocios };
    });
  };

  const removeSocio = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      socios: prev.socios.filter((_, i) => i !== index),
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.razao_social.trim()) {
          toast.error("Razão Social é obrigatória");
          return false;
        }
        if (!formData.cnpj.trim()) {
          toast.error("CNPJ é obrigatório");
          return false;
        }
        return true;
      case 2:
        if (!formData.cidade.trim() || !formData.estado.trim()) {
          toast.error("Cidade e Estado são obrigatórios");
          return false;
        }
        return true;
      case 3:
        // Dados fiscais são opcionais por enquanto
        return true;
      case 4:
        if (!formData.responsavel_tecnico.trim()) {
          toast.error("Nome do responsável técnico é obrigatório");
          return false;
        }
        return true;
      case 5:
        // Sócios são opcionais
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const skipSocios = () => {
    setCurrentStep(6);
  };

  const handleFinish = async () => {
    if (!tenant?.id) {
      toast.error("Erro: Tenant não encontrado");
      return;
    }

    setSaving(true);

    try {
      // 1. Criar/atualizar accounting_office
      const officeData = {
        tenant_id: tenant.id,
        razao_social: formData.razao_social,
        nome_fantasia: formData.nome_fantasia || formData.razao_social,
        cnpj: formData.cnpj.replace(/\D/g, ""),
        endereco: formData.endereco,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        cep: formData.cep.replace(/\D/g, ""),
        crc_number: formData.crc_number,
        crc_state: formData.crc_state,
        inscricao_municipal: formData.inscricao_municipal,
        responsavel_tecnico: formData.responsavel_tecnico,
        responsavel_crc: formData.responsavel_crc,
        responsavel_cpf: formData.responsavel_cpf.replace(/\D/g, ""),
        telefone: formData.telefone,
        email: formData.email,
        regime_tributario: formData.regime_tributario,
        cnae_principal: formData.cnae_principal,
        is_active: true,
      };

      // Verificar se já existe um registro para este tenant
      const { data: existingOffice } = await supabase
        .from("accounting_office")
        .select("id")
        .eq("tenant_id", tenant.id)
        .single();

      let officeError;
      if (existingOffice) {
        // Atualizar registro existente
        const { error } = await supabase
          .from("accounting_office")
          .update(officeData)
          .eq("tenant_id", tenant.id);
        officeError = error;
      } else {
        // Inserir novo registro
        const { error } = await supabase
          .from("accounting_office")
          .insert(officeData);
        officeError = error;
      }

      if (officeError) {
        console.error("Erro ao salvar accounting_office:", officeError);
        throw new Error("Erro ao salvar dados do escritório: " + officeError.message);
      }

      // 2. Salvar sócios se houver
      if (formData.socios.length > 0) {
        const sociosData = formData.socios
          .filter((s) => s.nome.trim())
          .map((socio) => ({
            tenant_id: tenant.id,
            name: socio.nome,
            cpf: socio.cpf.replace(/\D/g, ""),
            participation_percentage: parseFloat(socio.participacao) || 0,
            is_active: true,
          }));

        if (sociosData.length > 0) {
          const { error: sociosError } = await supabase
            .from("company_partners")
            .insert(sociosData);

          if (sociosError) {
            console.warn("Erro ao salvar sócios:", sociosError);
            // Não falhar por causa dos sócios
          }
        }
      }

      // 3. Atualizar tenant para marcar onboarding como completo
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({
          onboarding_completed: true,
          name: formData.nome_fantasia || formData.razao_social,
          cnpj: formData.cnpj.replace(/\D/g, ""),
        })
        .eq("id", tenant.id);

      if (tenantError) {
        console.error("Erro ao atualizar tenant:", tenantError);
        throw new Error("Erro ao finalizar onboarding: " + tenantError.message);
      }

      // Limpar cache e forçar reload dos dados
      clearTenantConfigCache();
      await refetch();

      toast.success("Configuração concluída com sucesso!");

      // Usar window.location para garantir um refresh completo e evitar problemas de cache
      window.location.href = "/dashboard";
    } catch (error: any) {
      console.error("Erro no onboarding:", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao Contta
          </h1>
          <p className="text-muted-foreground">
            Vamos configurar seu escritório em poucos passos
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-colors",
                    isActive && "text-primary",
                    isCompleted && "text-primary/70",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isCompleted && "border-primary/70 bg-primary/20",
                      !isActive && !isCompleted && "border-muted-foreground/30"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-xs hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const Icon = STEPS[currentStep - 1].icon;
                return <Icon className="w-5 h-5" />;
              })()}
              {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Dados da Empresa */}
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => updateField("cnpj", e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCNPJSearch}
                      disabled={loadingCNPJ || formData.cnpj.replace(/\D/g, "").length !== 14}
                    >
                      {loadingCNPJ ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Buscar</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite o CNPJ e clique em Buscar para preencher automaticamente os dados da empresa
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razao_social">Razão Social *</Label>
                  <Input
                    id="razao_social"
                    value={formData.razao_social}
                    onChange={(e) => updateField("razao_social", e.target.value)}
                    placeholder="Nome empresarial completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    value={formData.nome_fantasia}
                    onChange={(e) => updateField("nome_fantasia", e.target.value)}
                    placeholder="Nome comercial"
                  />
                </div>
              </>
            )}

            {/* Step 2: Endereço */}
            {currentStep === 2 && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="endereco">Logradouro</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => updateField("endereco", e.target.value)}
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={formData.numero}
                      onChange={(e) => updateField("numero", e.target.value)}
                      placeholder="123"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      value={formData.complemento}
                      onChange={(e) => updateField("complemento", e.target.value)}
                      placeholder="Sala, Andar, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) => updateField("bairro", e.target.value)}
                      placeholder="Bairro"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade *</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => updateField("cidade", e.target.value)}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado *</Label>
                    <Select
                      value={formData.estado}
                      onValueChange={(value) => updateField("estado", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map((estado) => (
                          <SelectItem key={estado.value} value={estado.value}>
                            {estado.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => updateField("cep", e.target.value)}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Dados Fiscais */}
            {currentStep === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crc_number">Número do CRC</Label>
                    <Input
                      id="crc_number"
                      value={formData.crc_number}
                      onChange={(e) => updateField("crc_number", e.target.value)}
                      placeholder="000000/O"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crc_state">UF do CRC</Label>
                    <Select
                      value={formData.crc_state}
                      onValueChange={(value) => updateField("crc_state", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map((estado) => (
                          <SelectItem key={estado.value} value={estado.value}>
                            {estado.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inscricao_municipal">Inscrição Municipal</Label>
                  <Input
                    id="inscricao_municipal"
                    value={formData.inscricao_municipal}
                    onChange={(e) => updateField("inscricao_municipal", e.target.value)}
                    placeholder="Número da inscrição"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regime_tributario">Regime Tributário</Label>
                    <Select
                      value={formData.regime_tributario}
                      onValueChange={(value) => updateField("regime_tributario", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIMES_TRIBUTARIOS.map((regime) => (
                          <SelectItem key={regime.value} value={regime.value}>
                            {regime.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnae_principal">CNAE Principal</Label>
                    <Input
                      id="cnae_principal"
                      value={formData.cnae_principal}
                      onChange={(e) => updateField("cnae_principal", e.target.value)}
                      placeholder="0000-0/00"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Responsável Técnico */}
            {currentStep === 4 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="responsavel_tecnico">Nome Completo *</Label>
                  <Input
                    id="responsavel_tecnico"
                    value={formData.responsavel_tecnico}
                    onChange={(e) => updateField("responsavel_tecnico", e.target.value)}
                    placeholder="Nome do contador responsável"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsavel_crc">CRC do Responsável</Label>
                    <Input
                      id="responsavel_crc"
                      value={formData.responsavel_crc}
                      onChange={(e) => updateField("responsavel_crc", e.target.value)}
                      placeholder="CRC-UF 00000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="responsavel_cpf">CPF</Label>
                    <Input
                      id="responsavel_cpf"
                      value={formData.responsavel_cpf}
                      onChange={(e) => updateField("responsavel_cpf", e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => updateField("telefone", e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="contato@escritorio.com"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 5: Sócios */}
            {currentStep === 5 && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Cadastre os sócios do escritório. Este passo é opcional e pode ser feito depois.
                </p>
                {formData.socios.map((socio, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Sócio {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSocio(index)}
                        className="text-destructive"
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={socio.nome}
                          onChange={(e) => updateSocio(index, "nome", e.target.value)}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Participação %</Label>
                        <Input
                          value={socio.participacao}
                          onChange={(e) => updateSocio(index, "participacao", e.target.value)}
                          placeholder="50"
                          type="number"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input
                        value={socio.cpf}
                        onChange={(e) => updateSocio(index, "cpf", e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addSocio} className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  Adicionar Sócio
                </Button>
              </>
            )}

            {/* Step 6: Conclusão */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Resumo da Configuração</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Razão Social:</span>
                    <span>{formData.razao_social || "-"}</span>
                    <span className="text-muted-foreground">CNPJ:</span>
                    <span>{formData.cnpj || "-"}</span>
                    <span className="text-muted-foreground">Cidade/UF:</span>
                    <span>
                      {formData.cidade && formData.estado
                        ? `${formData.cidade}/${formData.estado}`
                        : "-"}
                    </span>
                    <span className="text-muted-foreground">Responsável:</span>
                    <span>{formData.responsavel_tecnico || "-"}</span>
                    <span className="text-muted-foreground">Sócios:</span>
                    <span>{formData.socios.length || "Nenhum cadastrado"}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Você poderá alterar estas informações posteriormente nas configurações do sistema.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          <div className="flex gap-2">
            {currentStep === 5 && (
              <Button variant="ghost" onClick={skipSocios}>
                <SkipForward className="w-4 h-4 mr-2" />
                Pular
              </Button>
            )}

            {currentStep < STEPS.length ? (
              <Button onClick={nextStep}>
                Próximo
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Concluir
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
