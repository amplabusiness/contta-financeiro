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

import { useState, useEffect, useRef } from "react";
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
  Upload,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { AccountingService } from "@/services/AccountingService";
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

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================================================

/**
 * Valida CPF usando algoritmo oficial
 */
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) return false;

  // Rejeita CPFs com todos dígitos iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let digit1 = (sum * 10) % 11;
  if (digit1 === 10) digit1 = 0;
  if (digit1 !== parseInt(cleaned[9])) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  let digit2 = (sum * 10) % 11;
  if (digit2 === 10) digit2 = 0;
  if (digit2 !== parseInt(cleaned[10])) return false;

  return true;
}

/**
 * Valida CNPJ usando algoritmo oficial
 */
function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');

  if (cleaned.length !== 14) return false;

  // Rejeita CNPJs com todos dígitos iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let digit1 = sum % 11;
  digit1 = digit1 < 2 ? 0 : 11 - digit1;
  if (digit1 !== parseInt(cleaned[12])) return false;

  // Validação do segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  let digit2 = sum % 11;
  digit2 = digit2 < 2 ? 0 : 11 - digit2;
  if (digit2 !== parseInt(cleaned[13])) return false;

  return true;
}

/**
 * Valida formato de e-mail
 */
function validateEmail(email: string): boolean {
  if (!email) return true; // Email é opcional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida formato de telefone brasileiro
 */
function validatePhone(phone: string): boolean {
  if (!phone) return true; // Telefone é opcional
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

/**
 * Valida formato de CRC - liberado pois formatos variam muito entre estados
 */
function validateCRC(_crc: string): boolean {
  return true; // CRC pode ter formatos muito variados, não validar
}

/**
 * Formata CPF para exibição
 */
function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ para exibição
 */
function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata telefone para exibição
 */
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Formata CEP para exibição
 */
function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return cep;
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
}

interface ClienteImportado {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  monthly_fee?: number; // Honorário mensal (opcional no CSV)
}

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
  // Step 6: Clientes
  clientes: ClienteImportado[];
  defaultMonthlyFee: string; // Honorário padrão para clientes sem valor especificado
}

const STEPS = [
  { id: 1, title: "Dados da Empresa", icon: Building2, description: "Informações básicas do seu escritório" },
  { id: 2, title: "Endereço", icon: MapPin, description: "Localização do escritório" },
  { id: 3, title: "Dados Fiscais", icon: FileText, description: "CRC, inscrição municipal e regime" },
  { id: 4, title: "Responsável Técnico", icon: User, description: "Contador responsável" },
  { id: 5, title: "Sócios", icon: Users, description: "Opcional - cadastre os sócios" },
  { id: 6, title: "Clientes", icon: UserPlus, description: "Importe seus clientes" },
  { id: 7, title: "Conclusão", icon: CheckCircle, description: "Revise e finalize" },
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
    clientes: [],
    defaultMonthlyFee: "",
  });

  const [importingClients, setImportingClients] = useState(false);
  const clientFileInputRef = useRef<HTMLInputElement>(null);

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

  // Funções para gerenciar clientes
  const addCliente = () => {
    setFormData((prev) => ({
      ...prev,
      clientes: [...prev.clientes, { name: "", cnpj: "", email: "", phone: "" }],
    }));
  };

  const updateCliente = (index: number, field: keyof ClienteImportado, value: string) => {
    setFormData((prev) => {
      const newClientes = [...prev.clientes];
      newClientes[index] = { ...newClientes[index], [field]: value };
      return { ...prev, clientes: newClientes };
    });
  };

  const removeCliente = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      clientes: prev.clientes.filter((_, i) => i !== index),
    }));
  };

  // Importar clientes via CSV
  const handleClientCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingClients(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Detectar separador (vírgula ou ponto-e-vírgula)
      const separator = lines[0].includes(';') ? ';' : ',';

      // Primeira linha é header
      const header = lines[0].toLowerCase().split(separator).map(h => h.trim().replace(/"/g, ''));

      // Mapear colunas
      const nameIndex = header.findIndex(h => h.includes('nome') || h.includes('razao') || h.includes('name'));
      const cnpjIndex = header.findIndex(h => h.includes('cnpj') || h.includes('cpf') || h.includes('documento'));
      const emailIndex = header.findIndex(h => h.includes('email') || h.includes('e-mail'));
      const phoneIndex = header.findIndex(h => h.includes('telefone') || h.includes('phone') || h.includes('fone') || h.includes('celular'));
      const feeIndex = header.findIndex(h => h.includes('honorario') || h.includes('honorário') || h.includes('fee') || h.includes('valor') || h.includes('mensalidade'));

      if (nameIndex === -1) {
        toast.error("CSV precisa ter uma coluna 'Nome' ou 'Razão Social'");
        return;
      }

      if (cnpjIndex === -1) {
        toast.error("CSV precisa ter uma coluna 'CNPJ' - é obrigatório para identificação automática");
        return;
      }

      const clientesImportados: ClienteImportado[] = [];
      let clientesSemCnpj = 0;
      let clientesComFee = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));

        const name = values[nameIndex] || '';
        const cnpj = values[cnpjIndex]?.replace(/\D/g, '') || '';

        if (!name) continue; // Pular linhas sem nome

        if (!cnpj || cnpj.length < 11) {
          clientesSemCnpj++;
          continue; // Pular clientes sem CNPJ válido
        }

        // Parsear honorário (suporta R$ 1.234,56 ou 1234.56 ou 1500)
        let monthly_fee: number | undefined;
        if (feeIndex >= 0 && values[feeIndex]) {
          let feeStr = values[feeIndex].trim().replace(/[R$\s]/g, '');

          // Detectar formato: brasileiro (1.234,56) vs americano (1234.56)
          const hasComma = feeStr.includes(',');
          const hasDot = feeStr.includes('.');

          if (hasComma) {
            // Formato brasileiro: ponto é milhar, vírgula é decimal
            feeStr = feeStr.replace(/\./g, '').replace(',', '.');
          } else if (hasDot) {
            // Formato americano: ponto é decimal (não remover!)
            // Verificar se é milhar ou decimal pelo padrão
            const dotMatch = feeStr.match(/\.(\d+)$/);
            if (dotMatch && dotMatch[1].length <= 2) {
              // Ponto seguido de 1-2 dígitos = decimal (750.00, 1500.5)
              // Não fazer nada, já está no formato certo
            } else {
              // Ponto seguido de 3+ dígitos = milhar (1.500 = 1500)
              feeStr = feeStr.replace(/\./g, '');
            }
          }
          // Sem ponto nem vírgula: número inteiro, ok

          const parsed = parseFloat(feeStr);
          if (!isNaN(parsed) && parsed > 0) {
            monthly_fee = parsed;
            clientesComFee++;
          }
        }

        clientesImportados.push({
          name,
          cnpj,
          email: emailIndex >= 0 ? values[emailIndex] || '' : '',
          phone: phoneIndex >= 0 ? values[phoneIndex] || '' : '',
          monthly_fee,
        });
      }

      if (clientesImportados.length === 0) {
        toast.error("Nenhum cliente com CNPJ válido encontrado no arquivo");
        return;
      }

      setFormData(prev => ({
        ...prev,
        clientes: [...prev.clientes, ...clientesImportados],
      }));

      if (clientesSemCnpj > 0) {
        toast.warning(`${clientesImportados.length} clientes importados (${clientesComFee} com honorário). ${clientesSemCnpj} ignorados (sem CNPJ válido)`);
      } else {
        const feeMsg = clientesComFee > 0 ? ` (${clientesComFee} com honorário definido)` : '';
        toast.success(`${clientesImportados.length} clientes importados!${feeMsg}`);
      }
    } catch (error) {
      console.error("Erro ao importar CSV:", error);
      toast.error("Erro ao processar arquivo CSV");
    } finally {
      setImportingClients(false);
      if (event.target) event.target.value = '';
    }
  };

  const skipClientes = () => {
    setCurrentStep(7);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: {
        // Validar Dados da Empresa
        if (!formData.razao_social.trim()) {
          toast.error("Razão Social é obrigatória");
          return false;
        }
        if (formData.razao_social.trim().length < 3) {
          toast.error("Razão Social deve ter pelo menos 3 caracteres");
          return false;
        }
        if (!formData.cnpj.trim()) {
          toast.error("CNPJ é obrigatório");
          return false;
        }
        const cnpjClean = formData.cnpj.replace(/\D/g, '');
        if (cnpjClean.length !== 14) {
          toast.error("CNPJ deve ter 14 dígitos");
          return false;
        }
        if (!validateCNPJ(cnpjClean)) {
          toast.error("CNPJ inválido. Verifique os dígitos.");
          return false;
        }
        return true;
      }
      case 2: {
        // Validar Endereço
        if (!formData.cidade.trim()) {
          toast.error("Cidade é obrigatória");
          return false;
        }
        if (!formData.estado.trim()) {
          toast.error("Estado é obrigatório");
          return false;
        }
        if (formData.cep) {
          const cepClean = formData.cep.replace(/\D/g, '');
          if (cepClean.length > 0 && cepClean.length !== 8) {
            toast.error("CEP deve ter 8 dígitos");
            return false;
          }
        }
        return true;
      }
      case 3: {
        // Validar Dados Fiscais (opcionais, mas se preenchidos devem ser válidos)
        if (formData.crc_number && !validateCRC(formData.crc_number)) {
          toast.error("Formato de CRC inválido. Use: CRC-UF 123456 ou similar");
          return false;
        }
        return true;
      }
      case 4: {
        // Validar Responsável Técnico
        if (!formData.responsavel_tecnico.trim()) {
          toast.error("Nome do responsável técnico é obrigatório");
          return false;
        }
        if (formData.responsavel_tecnico.trim().length < 5) {
          toast.error("Nome do responsável deve ter pelo menos 5 caracteres");
          return false;
        }
        // CPF é opcional, mas se preenchido deve ser válido
        if (formData.responsavel_cpf) {
          const cpfClean = formData.responsavel_cpf.replace(/\D/g, '');
          if (cpfClean.length > 0 && cpfClean.length !== 11) {
            toast.error("CPF deve ter 11 dígitos");
            return false;
          }
          if (cpfClean.length === 11 && !validateCPF(cpfClean)) {
            toast.error("CPF do responsável inválido. Verifique os dígitos.");
            return false;
          }
        }
        // Email é opcional, mas se preenchido deve ser válido
        if (formData.email && !validateEmail(formData.email)) {
          toast.error("E-mail inválido");
          return false;
        }
        // Telefone é opcional, mas se preenchido deve ser válido
        if (formData.telefone && !validatePhone(formData.telefone)) {
          toast.error("Telefone deve ter 10 ou 11 dígitos");
          return false;
        }
        // CRC do responsável é opcional, mas se preenchido deve ser válido
        if (formData.responsavel_crc && !validateCRC(formData.responsavel_crc)) {
          toast.error("Formato de CRC do responsável inválido");
          return false;
        }
        return true;
      }
      case 5: {
        // Validar Sócios (opcionais, mas se preenchidos devem ser válidos)
        for (let i = 0; i < formData.socios.length; i++) {
          const socio = formData.socios[i];
          if (socio.nome && socio.nome.trim().length < 3) {
            toast.error(`Sócio ${i + 1}: Nome deve ter pelo menos 3 caracteres`);
            return false;
          }
          if (socio.cpf) {
            const cpfClean = socio.cpf.replace(/\D/g, '');
            if (cpfClean.length > 0 && cpfClean.length !== 11) {
              toast.error(`Sócio ${i + 1}: CPF deve ter 11 dígitos`);
              return false;
            }
            if (cpfClean.length === 11 && !validateCPF(cpfClean)) {
              toast.error(`Sócio ${i + 1}: CPF inválido`);
              return false;
            }
          }
          if (socio.participacao) {
            const part = parseFloat(socio.participacao.replace(',', '.'));
            if (isNaN(part) || part < 0 || part > 100) {
              toast.error(`Sócio ${i + 1}: Participação deve ser entre 0 e 100%`);
              return false;
            }
          }
        }
        return true;
      }
      case 6: {
        // Validar Clientes - apenas verifica se tem quantidade correta de dígitos
        // Dígitos verificadores incorretos são apenas aviso, não bloqueiam
        const clientsWithInvalidLength = formData.clientes.filter(c => {
          const docClean = c.cnpj.replace(/\D/g, '');
          // Aceita CNPJ (14 dígitos) ou CPF (11 dígitos)
          return docClean.length !== 14 && docClean.length !== 11;
        });
        if (formData.clientes.length > 0 && clientsWithInvalidLength.length > 0) {
          toast.error(`${clientsWithInvalidLength.length} cliente(s) com documento incompleto (deve ter 11 ou 14 dígitos). Corrija ou remova antes de continuar.`);
          return false;
        }
        // Aviso sobre dígitos verificadores (não bloqueia)
        const clientsWithInvalidChecksum = formData.clientes.filter(c => {
          const docClean = c.cnpj.replace(/\D/g, '');
          if (docClean.length === 14) return !validateCNPJ(docClean);
          if (docClean.length === 11) return !validateCPF(docClean);
          return false;
        });
        if (clientsWithInvalidChecksum.length > 0) {
          toast.warning(`${clientsWithInvalidChecksum.length} cliente(s) com dígito verificador incorreto. A identificação automática pode não funcionar para esses clientes.`);
        }
        return true;
      }
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
    setCurrentStep(6); // Vai para Clientes
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

      // 3. Salvar clientes se houver (apenas os que têm CNPJ válido)
      if (formData.clientes.length > 0) {
        // Honorário padrão para clientes sem valor especificado
        let defaultFee: number | null = null;
        if (formData.defaultMonthlyFee) {
          let feeStr = formData.defaultMonthlyFee.trim().replace(/[R$\s]/g, '');
          const hasComma = feeStr.includes(',');
          const hasDot = feeStr.includes('.');
          if (hasComma) {
            feeStr = feeStr.replace(/\./g, '').replace(',', '.');
          } else if (hasDot) {
            const dotMatch = feeStr.match(/\.(\d+)$/);
            if (!dotMatch || dotMatch[1].length > 2) {
              feeStr = feeStr.replace(/\./g, '');
            }
          }
          const parsed = parseFloat(feeStr);
          if (!isNaN(parsed) && parsed > 0) defaultFee = parsed;
        }

        const clientesData = formData.clientes
          .filter((c) => c.name.trim() && c.cnpj && c.cnpj.replace(/\D/g, "").length >= 11)
          .map((cliente) => {
            // Usar honorário do cliente se especificado, senão usar o padrão
            const fee = cliente.monthly_fee || defaultFee;
            return {
              tenant_id: tenant.id,
              name: cliente.name,
              cnpj: cliente.cnpj.replace(/\D/g, ""),
              email: cliente.email || null,
              phone: cliente.phone || null,
              is_active: true,
              // Definir honorário apenas se tiver valor
              ...(fee && fee > 0 ? { monthly_fee: fee } : {}),
            };
          });

        if (clientesData.length > 0) {
          const { error: clientesError } = await supabase
            .from("clients")
            .insert(clientesData);

          if (clientesError) {
            console.warn("Erro ao salvar clientes:", clientesError);
            // Não falhar por causa dos clientes
          } else {
            const comFee = clientesData.filter(c => c.monthly_fee).length;
            console.log(`[Onboarding] ${clientesData.length} clientes importados (${comFee} com honorário definido)`);
          }
        }
      }

      // 4. Inicializar plano de contas automaticamente
      try {
        const accountingService = new AccountingService();
        const chartResult = await accountingService.initializeChartOfAccounts();
        if (chartResult.success) {
          console.log("[Onboarding] Plano de contas inicializado com sucesso");
        } else {
          console.warn("[Onboarding] Aviso ao inicializar plano de contas:", chartResult.error);
        }
      } catch (chartError) {
        console.warn("[Onboarding] Erro ao inicializar plano de contas:", chartError);
        // Não falhar por causa do plano de contas
      }

      // 5. Atualizar tenant para marcar onboarding como completo
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

      // Marcar que é o primeiro acesso para mostrar tutorial
      localStorage.setItem('contta_first_access', 'true');

      toast.success("Configuração concluída com sucesso! Vamos começar?");

      // Redirecionar para o SuperConciliation (onde a mágica acontece)
      window.location.href = "/super-conciliation";
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
                      value={formData.cnpj ? formatCNPJ(formData.cnpj) : ''}
                      onChange={(e) => updateField("cnpj", e.target.value.replace(/\D/g, '').slice(0, 14))}
                      placeholder="00.000.000/0000-00"
                      className={cn(
                        "flex-1",
                        formData.cnpj && formData.cnpj.replace(/\D/g, '').length === 14 && (
                          validateCNPJ(formData.cnpj) ? "border-green-500" : "border-red-500"
                        )
                      )}
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
                  {formData.cnpj && formData.cnpj.replace(/\D/g, '').length === 14 && !validateCNPJ(formData.cnpj) ? (
                    <p className="text-xs text-red-500">CNPJ inválido. Verifique os dígitos verificadores.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Digite o CNPJ e clique em Buscar para preencher automaticamente os dados da empresa
                    </p>
                  )}
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
                      value={formData.responsavel_cpf ? formatCPF(formData.responsavel_cpf) : ''}
                      onChange={(e) => updateField("responsavel_cpf", e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="000.000.000-00"
                      className={cn(
                        formData.responsavel_cpf && formData.responsavel_cpf.replace(/\D/g, '').length === 11 && (
                          validateCPF(formData.responsavel_cpf) ? "border-green-500" : "border-red-500"
                        )
                      )}
                    />
                    {formData.responsavel_cpf && formData.responsavel_cpf.replace(/\D/g, '').length === 11 && !validateCPF(formData.responsavel_cpf) && (
                      <p className="text-xs text-red-500">CPF inválido</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone ? formatPhone(formData.telefone) : ''}
                      onChange={(e) => updateField("telefone", e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="(00) 00000-0000"
                      className={cn(
                        formData.telefone && formData.telefone.replace(/\D/g, '').length >= 10 && (
                          validatePhone(formData.telefone) ? "border-green-500" : "border-red-500"
                        )
                      )}
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
                      className={cn(
                        formData.email && (
                          validateEmail(formData.email) ? "border-green-500" : "border-red-500"
                        )
                      )}
                    />
                    {formData.email && !validateEmail(formData.email) && (
                      <p className="text-xs text-red-500">E-mail inválido</p>
                    )}
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
                        value={socio.cpf ? formatCPF(socio.cpf) : ''}
                        onChange={(e) => updateSocio(index, "cpf", e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="000.000.000-00"
                        className={cn(
                          socio.cpf && socio.cpf.replace(/\D/g, '').length === 11 && (
                            validateCPF(socio.cpf) ? "border-green-500" : "border-red-500"
                          )
                        )}
                      />
                      {socio.cpf && socio.cpf.replace(/\D/g, '').length === 11 && !validateCPF(socio.cpf) && (
                        <p className="text-xs text-red-500">CPF inválido</p>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addSocio} className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  Adicionar Sócio
                </Button>
              </>
            )}

            {/* Step 6: Clientes */}
            {currentStep === 6 && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Importe seus clientes com CNPJ</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        <strong>O CNPJ é obrigatório!</strong> A IA do Contta usa o CNPJ para identificar automaticamente os pagadores nas transações bancárias (PIX, TED, DOC).
                        Sem CNPJ, a IA não consegue fazer o match automático.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Instruções detalhadas do CSV */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <h5 className="font-medium text-sm mb-2">📄 Formato do arquivo CSV:</h5>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>• <strong>Separador:</strong> vírgula (,) ou ponto-e-vírgula (;)</p>
                    <p>• <strong>Primeira linha:</strong> cabeçalho com nomes das colunas</p>
                    <p>• <strong>Colunas obrigatórias:</strong></p>
                    <ul className="ml-4 list-disc">
                      <li><code className="bg-gray-200 px-1 rounded">Nome</code> ou <code className="bg-gray-200 px-1 rounded">Razão Social</code></li>
                      <li><code className="bg-gray-200 px-1 rounded">CNPJ</code> (14 dígitos) ou <code className="bg-gray-200 px-1 rounded">CPF</code> (11 dígitos)</li>
                    </ul>
                    <p>• <strong>Colunas opcionais:</strong> <code className="bg-gray-200 px-1 rounded">Email</code>, <code className="bg-gray-200 px-1 rounded">Telefone</code>, <code className="bg-gray-200 px-1 rounded">Honorário</code></p>
                  </div>
                  <div className="mt-3 p-2 bg-white border rounded text-xs font-mono">
                    <p className="text-gray-500">Exemplo:</p>
                    <p>Nome;CNPJ;Email;Telefone;Honorário</p>
                    <p>Empresa ABC;12.345.678/0001-90;contato@abc.com;11999887766;1500,00</p>
                    <p>João Silva;123.456.789-00;joao@email.com;;800</p>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    onClick={() => clientFileInputRef.current?.click()}
                    disabled={importingClients}
                    className="flex-1"
                  >
                    {importingClients ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Importar CSV
                  </Button>
                  <Button variant="outline" onClick={addCliente} className="flex-1">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adicionar Manual
                  </Button>
                  <input
                    type="file"
                    ref={clientFileInputRef}
                    className="hidden"
                    accept=".csv,.txt"
                    onChange={handleClientCSVImport}
                  />
                </div>

                <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                  <Label htmlFor="defaultMonthlyFee" className="text-sm whitespace-nowrap">
                    Honorário Padrão:
                  </Label>
                  <Input
                    id="defaultMonthlyFee"
                    value={formData.defaultMonthlyFee || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultMonthlyFee: e.target.value }))}
                    placeholder="R$ 0,00"
                    className="max-w-[150px] text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    Aplicado aos clientes sem honorário definido no CSV
                  </span>
                </div>

                {/* Lista de clientes importados/adicionados */}
                {formData.clientes.length > 0 && (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        {formData.clientes.length} cliente{formData.clientes.length > 1 ? 's' : ''} cadastrado{formData.clientes.length > 1 ? 's' : ''}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, clientes: [] }))}
                        className="text-destructive text-xs h-7"
                      >
                        Limpar todos
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-2 bg-gray-50">
                      {formData.clientes.map((cliente, index) => {
                        const cnpjClean = cliente.cnpj.replace(/\D/g, '');
                        const isCNPJ = cnpjClean.length === 14;
                        const isCPF = cnpjClean.length === 11;
                        // Validação flexível: aceita se tem quantidade correta de dígitos
                        const hasValidLength = isCNPJ || isCPF;
                        // Validação rigorosa: verifica dígitos verificadores (apenas aviso)
                        const hasValidChecksum = isCNPJ ? validateCNPJ(cnpjClean) : (isCPF ? validateCPF(cnpjClean) : false);
                        const isValidEmail = validateEmail(cliente.email);

                        return (
                          <div
                            key={index}
                            className={cn(
                              "border rounded-lg p-3 bg-white",
                              !hasValidLength && "border-red-300 bg-red-50",
                              hasValidLength && !hasValidChecksum && "border-yellow-300 bg-yellow-50"
                            )}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{cliente.name || `Cliente ${index + 1}`}</span>
                                {!hasValidLength ? (
                                  <span className="text-xs text-red-500">Documento incompleto</span>
                                ) : hasValidChecksum ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <span className="text-xs text-yellow-600">Dígito verificador incorreto</span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCliente(index)}
                                className="text-destructive h-6 px-2"
                              >
                                Remover
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={cliente.name}
                                onChange={(e) => updateCliente(index, "name", e.target.value)}
                                placeholder="Nome/Razão Social *"
                                className={cn("text-sm", !cliente.name.trim() && "border-red-300")}
                              />
                              <Input
                                value={isCNPJ ? formatCNPJ(cnpjClean) : (isCPF ? formatCPF(cnpjClean) : cliente.cnpj)}
                                onChange={(e) => updateCliente(index, "cnpj", e.target.value)}
                                placeholder="CNPJ/CPF *"
                                className={cn(
                                  "text-sm",
                                  !hasValidLength && "border-red-300",
                                  hasValidLength && hasValidChecksum && "border-green-300",
                                  hasValidLength && !hasValidChecksum && "border-yellow-300"
                                )}
                              />
                              <Input
                                value={cliente.email}
                                onChange={(e) => updateCliente(index, "email", e.target.value)}
                                placeholder="Email"
                                className={cn("text-sm", cliente.email && !isValidEmail && "border-red-300")}
                              />
                              <Input
                                value={cliente.phone ? formatPhone(cliente.phone) : ''}
                                onChange={(e) => updateCliente(index, "phone", e.target.value)}
                                placeholder="Telefone"
                                className="text-sm"
                              />
                            </div>
                            {cliente.monthly_fee && (
                              <div className="mt-2 text-xs text-green-600">
                                Honorário: R$ {cliente.monthly_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {formData.clientes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhum cliente cadastrado ainda</p>
                    <p className="text-xs mt-1">Importe um CSV ou adicione manualmente</p>
                  </div>
                )}
              </>
            )}

            {/* Step 7: Conclusão */}
            {currentStep === 7 && (
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
                    <span className="text-muted-foreground">Clientes:</span>
                    <span>{formData.clientes.length || "Nenhum importado"}</span>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900">Tudo pronto!</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Ao concluir, o sistema irá:
                      </p>
                      <ul className="text-sm text-green-700 mt-2 space-y-1 list-disc list-inside">
                        <li>Criar o plano de contas automaticamente</li>
                        <li>Salvar seus {formData.clientes.length || 0} clientes</li>
                        <li>Levar você para importar seu primeiro OFX</li>
                      </ul>
                    </div>
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

            {currentStep === 6 && (
              <Button variant="ghost" onClick={skipClientes}>
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
