import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Eye,
  Download,
  Send,
  CheckCircle,
  Clock,
  FileText,
  Scale,
  AlertTriangle,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  Loader2,
  Users,
  FileDown,
  FileType,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, ShadingType, convertInchesToTwip, Header, Footer, PageNumber, NumberFormat } from "docx";
import { saveAs } from "file-saver";

interface Contract {
  id: string;
  contract_number: string;
  client_id: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  monthly_fee: number;
  payment_day?: number;
  payment_method?: string;
  adjustment_index?: string;
  status: string;
  signature_status: string;
  coaf_clause_accepted: boolean;
  created_at: string;
  clients?: {
    name: string;
    cnpj: string;
    email: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    phone?: string;
  };
  partners?: ClientPartner[];
}

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  is_active: boolean;
  is_pro_bono: boolean;
  is_barter: boolean;
  monthly_fee: number | null;
  contract_type: string | null;
}

// Sócio do cliente
interface ClientPartner {
  id: string;
  name: string;
  cpf: string | null;
  partner_type: string | null;
  percentage: number | null;
  is_administrator: boolean | null;
}

// Cliente elegível para contrato em lote
interface EligibleClient extends Client {
  selected: boolean;
  hasContract: boolean;
  warning?: string;
}

interface AccountingOffice {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  crc_number: string | null;
  crc_state: string | null;
  responsavel_tecnico: string | null;
  responsavel_crc: string | null;
  responsavel_cpf: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  website: string | null;
}

// Dados padrão do escritório (usado como fallback)
const defaultOfficeData: AccountingOffice = {
  id: "",
  razao_social: "AMPLA CONTABILIDADE LTDA",
  nome_fantasia: "Ampla Contabilidade",
  cnpj: "23.893.032/0001-69",
  crc_number: "007640/O",
  crc_state: "GO",
  responsavel_tecnico: "Sérgio Carneiro Leão",
  responsavel_crc: "CRC-GO 8.074",
  responsavel_cpf: null,
  endereco: "Rua P25, 931",
  numero: "931",
  complemento: "Quadra P 89, Lote 44/45, Sala 09",
  bairro: "Setor dos Funcionários",
  cidade: "Goiânia",
  estado: "GO",
  cep: "74.543-395",
  telefone: "(62) 3233-8888",
  celular: null,
  email: "legalizacao@amplabusiness.com.br",
  website: "www.amplabusiness.com.br",
};

// Serviços por tipo de contrato
const contractServices = {
  full_accounting: [
    "Escrituração contábil completa conforme NBC TG 1000",
    "Elaboração de balancetes mensais",
    "Balanço Patrimonial e DRE anuais",
    "Apuração de impostos (IRPJ, CSLL, PIS, COFINS)",
    "SPED Contábil (ECD) e ECF",
    "Declarações acessórias federais (DCTF, DIRF)",
    "Assessoria contábil mensal",
  ],
  payroll: [
    "Processamento de folha de pagamento mensal",
    "Cálculo de encargos sociais (INSS, FGTS)",
    "Emissão de guias de recolhimento",
    "Admissão e demissão de funcionários",
    "Férias, 13º salário e rescisões",
    "Envio de eventos ao eSocial",
    "RAIS e DIRF",
  ],
  tax: [
    "Apuração de impostos federais",
    "Apuração de ICMS (impostos estaduais)",
    "Apuração de ISS (impostos municipais)",
    "SPED Fiscal e contribuições",
    "Declarações acessórias",
    "Planejamento tributário básico",
  ],
  consulting: [
    "Consultoria empresarial e contábil",
    "Análise de viabilidade econômica",
    "Elaboração de relatórios gerenciais",
    "Assessoria em decisões estratégicas",
  ],
  service: [
    "Serviços contábeis conforme contratação específica",
  ],
};

const Contracts = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Estados de carregamento
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDebts, setLoadingDebts] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // Estados de dados principais
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [officeData, setOfficeData] = useState<AccountingOffice>(defaultOfficeData);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [contractPreview, setContractPreview] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedDebtorContract, setSelectedDebtorContract] = useState<Contract | null>(null);
  const [debtorPartners, setDebtorPartners] = useState<ClientPartner[]>([]);
  const [collectionDays, setCollectionDays] = useState("5");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [clientDebts, setClientDebts] = useState<{competence: string; due_date: string; amount: number; description: string}[]>([]);
  const [eligibleClients, setEligibleClients] = useState<EligibleClient[]>([]);
  const [clientsWithWarnings, setClientsWithWarnings] = useState<EligibleClient[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [generatedContracts, setGeneratedContracts] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    client_id: "",
    contract_type: "full_accounting",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    monthly_fee: "",
    payment_day: "10",
    payment_method: "boleto",
    adjustment_index: "IGPM",
    special_clauses: "",
  });

  // Estados de diálogos
  const [showNewContract, setShowNewContract] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const fetchAccountingOffice = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("accounting_office")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error) {
        console.log("Usando dados padrão do escritório:", error.message);
        return;
      }

      if (data) {
        setOfficeData(data);
      }
    } catch (error) {
      console.log("Usando dados padrão do escritório");
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  }, []);

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("accounting_contracts")
        .select(`
          *,
          clients:client_id (name, cnpj, email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast({
        title: "Erro ao carregar contratos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    fetchAccountingOffice();
    fetchContracts();
    fetchClients();
  }, [fetchAccountingOffice, fetchContracts, fetchClients]);

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  // Preparar clientes elegíveis para geração em lote
  const prepareEligibleClients = useCallback(() => {
    const existingClientIds = contracts.map(c => c.client_id);

    // Filtrar clientes ativos, não pro-bono, não permuta
    const eligible: EligibleClient[] = [];
    const warnings: EligibleClient[] = [];

    clients.forEach(client => {
      // Pular clientes inativos
      if (!client.is_active) return;

      // Pular clientes pro-bono
      if (client.is_pro_bono) return;

      // Pular clientes permuta
      if (client.is_barter) return;

      const hasContract = existingClientIds.includes(client.id);
      const hasFee = client.monthly_fee && client.monthly_fee > 0;

      // Clientes sem honorários geram alerta
      if (!hasFee) {
        warnings.push({
          ...client,
          selected: false,
          hasContract,
          warning: "Cliente sem valor de honorários cadastrado",
        });
        return;
      }

      // Clientes elegíveis (com honorários)
      eligible.push({
        ...client,
        selected: !hasContract, // Pré-selecionar se não tem contrato
        hasContract,
      });
    });

    setEligibleClients(eligible);
    setClientsWithWarnings(warnings);
  }, [clients, contracts]);

  // Toggle seleção de cliente para lote
  const toggleClientSelection = (clientId: string) => {
    setEligibleClients(prev =>
      prev.map(c =>
        c.id === clientId ? { ...c, selected: !c.selected } : c
      )
    );
  };

  // Selecionar/deselecionar todos
  const toggleSelectAll = () => {
    const allSelected = eligibleClients.filter(c => !c.hasContract).every(c => c.selected);
    setEligibleClients(prev =>
      prev.map(c => c.hasContract ? c : { ...c, selected: !allSelected })
    );
  };

  // Gerar contratos em lote
  const generateBatchContracts = async () => {
    const selectedClients = eligibleClients.filter(c => c.selected && !c.hasContract);

    if (selectedClients.length === 0) {
      toast({
        title: "Nenhum cliente selecionado",
        description: "Selecione pelo menos um cliente para gerar contratos.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBatch(true);
    setBatchProgress(0);
    setBatchTotal(selectedClients.length);
    setGeneratedContracts([]);

    const generated: string[] = [];

    for (let i = 0; i < selectedClients.length; i++) {
      const client = selectedClients[i];

      try {
        // Mapear tipo de contrato do frontend para tipos válidos no banco
        // Banco aceita: 'service', 'consulting', 'partnership', 'opening', 'irpf', 'special'
        const contractTypeMapping: Record<string, string> = {
          full_accounting: "service",
          payroll: "service",
          tax: "service",
          consulting: "consulting",
          service: "service",
          partnership: "partnership",
          opening: "opening",
          irpf: "irpf",
          special: "special",
        };

        // Tipo interno para buscar serviços
        const internalType = client.contract_type || "full_accounting";

        // Tipo para o banco de dados
        const dbContractType = contractTypeMapping[internalType] || "service";

        const services = contractServices[internalType as keyof typeof contractServices] || contractServices.full_accounting;

        // Gerar conteúdo do contrato
        const content = generateContractContentForClient(client, internalType, services);

        const contractData = {
          client_id: client.id,
          contract_type: dbContractType,
          start_date: new Date().toISOString().split("T")[0],
          monthly_fee: client.monthly_fee || 0,
          payment_day: 10,
          payment_method: "boleto",
          adjustment_index: "IGPM",
          services: services.map(s => ({ service: s, included: true })),
          content: content,
          coaf_clause_accepted: true,
          requires_responsibility_letter: true,
          status: "active",
          signature_status: "signed",
        };

        const { data, error } = await supabase
          .from("accounting_contracts")
          .insert(contractData)
          .select()
          .single();

        if (error) throw error;

        generated.push(data.contract_number);
        setBatchProgress(i + 1);

      } catch (error) {
        console.error(`Erro ao gerar contrato para ${client.name}:`, error);
        toast({
          title: `Erro ao gerar contrato`,
          description: `Falha ao gerar contrato para ${client.name}`,
          variant: "destructive",
        });
      }
    }

    setGeneratedContracts(generated);
    setIsGeneratingBatch(false);

    if (generated.length > 0) {
      toast({
        title: "Contratos gerados com sucesso!",
        description: `${generated.length} contrato(s) gerado(s) com sucesso.`,
      });
      fetchContracts();
    }
  };

  // Gerar conteúdo de contrato para um cliente específico (usado em lote)
  const generateContractContentForClient = (client: Client, contractType: string, services: string[]): string => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const monthlyFeeText = (client.monthly_fee || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    // Formatar endereço do cliente
    const clientAddress = [
      client.logradouro,
      client.numero ? `nº ${client.numero}` : null,
      client.complemento,
      client.bairro,
    ].filter(Boolean).join(", ");
    const clientCityState = [client.municipio, client.uf].filter(Boolean).join("/");

    return `
═══════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS
                              MODALIDADE: ADESÃO
                     Conforme Resolução CFC nº 1.590/2020
                        (Atualizado pela Res. 1.703/2023)
═══════════════════════════════════════════════════════════════════════════════

EMBASAMENTO LEGAL:
• Resolução CFC nº 1.590/2020 (alt. Res. 1.703/2023) - Contrato de Serviços Contábeis
• Resolução CFC nº 1.721/2024 - Comunicação ao COAF
• NBC PG 01 - Código de Ética Profissional do Contador
• Lei nº 10.406/2002 - Código Civil (Arts. 107, 111, 593-609, 1.177-1.178)
• Lei nº 13.709/2018 - Lei Geral de Proteção de Dados (LGPD)
• Lei nº 9.613/1998 - Prevenção à Lavagem de Dinheiro (COAF)

───────────────────────────────────────────────────────────────────────────────
                           IDENTIFICAÇÃO DAS PARTES
───────────────────────────────────────────────────────────────────────────────

CONTRATADA (Prestadora de Serviços):
Razão Social: ${officeData.razao_social}
CNPJ: ${officeData.cnpj}
Registro CRC: CRC/${officeData.crc_state} ${officeData.crc_number}
Endereço: ${officeData.endereco || ""}, ${officeData.numero || "S/N"} - ${officeData.bairro || ""}
CEP: ${officeData.cep || ""} - ${officeData.cidade || ""}/${officeData.estado || ""}
E-mail: ${officeData.email || ""}
Telefone: ${officeData.telefone || ""}
Responsável Técnico: ${officeData.responsavel_tecnico || ""}
CRC do Responsável: ${officeData.responsavel_crc || ""}

CONTRATANTE (Tomador de Serviços):
Razão Social: ${client.name}
CNPJ/CPF: ${client.cnpj || "Não informado"}
Endereço: ${clientAddress || "Não informado"}
CEP: ${client.cep || ""} - ${clientCityState || ""}
E-mail: ${client.email || "Não informado"}
Telefone: ${client.phone || "Não informado"}

───────────────────────────────────────────────────────────────────────────────
                         OBJETO E CONDIÇÕES COMERCIAIS
───────────────────────────────────────────────────────────────────────────────

HONORÁRIOS MENSAIS: ${monthlyFeeText}
VENCIMENTO: Dia 10 de cada mês
DATA DE INÍCIO: ${formattedDate}

SERVIÇOS CONTRATADOS:
${services.map((s, i) => `${i + 1}. ${s}`).join("\n")}

───────────────────────────────────────────────────────────────────────────────
                         ACEITE TÁCITO E VALIDADE JURÍDICA
───────────────────────────────────────────────────────────────────────────────

Este contrato é celebrado na modalidade ADESÃO e dispensa assinatura física ou
digital, conforme Arts. 107 e 111 do Código Civil Brasileiro.

A aceitação ocorre automaticamente através de comportamento concludente:
• Utilização de qualquer serviço prestado pela CONTRATADA
• Envio de documentos fiscais, contábeis ou trabalhistas
• Pagamento de honorários
• Solicitação de serviços por qualquer meio

A CONTRATANTE declara ter ciência das obrigações de comunicação ao COAF
(Resolução CFC 1.721/2024) e das disposições da LGPD (Lei 13.709/2018).

───────────────────────────────────────────────────────────────────────────────
                              DADOS DO DOCUMENTO
───────────────────────────────────────────────────────────────────────────────

Data de Elaboração: ${formattedDate}
Responsável Técnico: ${officeData.responsavel_tecnico || ""}
CRC do Responsável: ${officeData.responsavel_crc || ""}
Versão: Resolução CFC 1.590/2020 (alt. 1.703/2023) + LGPD + Res. 1.721/2024

═══════════════════════════════════════════════════════════════════════════════
              DISPENSA DE ASSINATURA - FUNDAMENTAÇÃO LEGAL
═══════════════════════════════════════════════════════════════════════════════

Este contrato DISPENSA ASSINATURA FÍSICA OU DIGITAL conforme:

CÓDIGO CIVIL BRASILEIRO (Lei nº 10.406/2002):
• Art. 107: "A validade da declaração de vontade não dependerá de forma
  especial, senão quando a lei expressamente a exigir."
• Art. 111: "O silêncio importa anuência, quando as circunstâncias ou os
  usos o autorizarem."

JURISPRUDÊNCIA DO STJ:
• "A manifestação de vontade tácita configura-se pela presença do comportamento
  concludente, quando as circunstâncias evidenciam a intenção inequívoca da
  parte de anuir com o negócio." (REsp 1.989.740/SP)
• "A ausência de assinatura física no contrato não invalida sua eficácia,
  notadamente diante do aceite por comportamento concludente e da efetiva
  fruição dos benefícios pactuados." (AgInt no AREsp 1.742.341/SP)

O ACEITE TÁCITO ocorre pela prática de qualquer ato concludente:
[X] Utilização de serviços  [X] Envio de documentos  [X] Pagamento de honorários

───────────────────────────────────────────────────────────────────────────────

${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"}, ${formattedDate}

                    *** ASSINATURA DISPENSADA ***
          Conforme Arts. 107 e 111 do Código Civil Brasileiro
               e jurisprudência consolidada do STJ

═══════════════════════════════════════════════════════════════════════════════
Para contrato completo com todas as cláusulas, acesse o portal do cliente.
═══════════════════════════════════════════════════════════════════════════════
`;
  };

  // Abrir dialog de geração em lote
  const openBatchDialog = () => {
    prepareEligibleClients();
    setShowBatchDialog(true);
  };

  // Gera o contrato completo com embasamento jurídico
  // Aceita cliente opcional para uso no menu de ações (onde o setState é assíncrono)
  const generateContractContent = (type: string, clientOverride?: Client | null, feeOverride?: number): string => {
    const client = clientOverride || selectedClient;
    if (!client) return "";

    const services = contractServices[type as keyof typeof contractServices] || contractServices.service;
    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const monthlyFeeNumber = feeOverride ?? (parseFloat(formData.monthly_fee) || 0);
    const monthlyFeeText = monthlyFeeNumber.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    return `
═══════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS
                              MODALIDADE: ADESÃO
                     Conforme Resolução CFC nº 1.590/2020
                        (Atualizado pela Res. 1.703/2023)
═══════════════════════════════════════════════════════════════════════════════

EMBASAMENTO LEGAL:
• Resolução CFC nº 1.590/2020 (alt. Res. 1.703/2023) - Contrato de Serviços Contábeis
• Resolução CFC nº 1.721/2024 - Comunicação ao COAF
• NBC PG 01 - Código de Ética Profissional do Contador
• Lei nº 10.406/2002 - Código Civil Brasileiro (Arts. 107, 111, 593-609, 1.177-1.178)
• Lei nº 8.078/1990 - Código de Defesa do Consumidor (Art. 54)
• Lei nº 9.613/1998 - Prevenção à Lavagem de Dinheiro (COAF)
• Lei nº 13.709/2018 - Lei Geral de Proteção de Dados (LGPD)
• ITG 1000 - Carta de Responsabilidade da Administração
• Jurisprudência STJ - Validade do aceite tácito por comportamento concludente

───────────────────────────────────────────────────────────────────────────────
                           IDENTIFICAÇÃO DAS PARTES
───────────────────────────────────────────────────────────────────────────────

CONTRATADA (Prestadora de Serviços):
Razão Social: ${officeData.razao_social}
Nome Fantasia: ${officeData.nome_fantasia || officeData.razao_social}
CNPJ: ${officeData.cnpj}
Registro CRC: CRC/${officeData.crc_state} ${officeData.crc_number}
Endereço: ${officeData.endereco || ""}, ${officeData.numero || "S/N"} - ${officeData.bairro || ""}
CEP: ${officeData.cep || ""} - ${officeData.cidade || ""}/${officeData.estado || ""}
E-mail: ${officeData.email || ""}
Telefone: ${officeData.telefone || ""}
Responsável Técnico: ${officeData.responsavel_tecnico || ""}
CRC Responsável: ${officeData.responsavel_crc || ""}

CONTRATANTE (Tomador de Serviços):
Razão Social: ${client.name}
CNPJ/CPF: ${client.cnpj || "Não informado"}
Endereço: ${client.logradouro || ""}, ${client.numero || "S/N"} - ${client.bairro || ""}
CEP: ${client.cep || ""} - ${client.municipio || ""}/${client.uf || ""}
E-mail: ${client.email || "Não informado"}
Telefone: ${client.phone || "Não informado"}

───────────────────────────────────────────────────────────────────────────────
          CLÁUSULA 1ª - DA NATUREZA DO CONTRATO E FORMA DE ACEITAÇÃO
───────────────────────────────────────────────────────────────────────────────

1.1. O presente instrumento é celebrado na modalidade de CONTRATO DE ADESÃO,
conforme previsto no Art. 54 do Código de Defesa do Consumidor (Lei 8.078/90)
e Art. 111 do Código Civil Brasileiro.

1.2. ACEITE TÁCITO: A CONTRATANTE manifesta sua aceitação integral e irrestrita
a todas as cláusulas deste contrato através de qualquer das seguintes condutas
(comportamento concludente):

    a) Utilização de qualquer serviço prestado pela CONTRATADA;
    b) Envio de documentos fiscais, contábeis ou trabalhistas para escrituração;
    c) Pagamento, total ou parcial, de honorários contábeis;
    d) Solicitação de serviços por qualquer meio (e-mail, telefone, WhatsApp, etc.);
    e) Fornecimento de procuração ou senha de acesso a sistemas governamentais;
    f) Manutenção de relação comercial após recebimento deste instrumento.

1.3. FUNDAMENTAÇÃO DO ACEITE TÁCITO:
    • Art. 107 do CC: "A validade da declaração de vontade não dependerá de
      forma especial, senão quando a lei expressamente a exigir."
    • Art. 111 do CC: "O silêncio importa anuência, quando as circunstâncias
      ou os usos o autorizarem."
    • STJ: "A manifestação de vontade tácita configura-se pela presença do
      comportamento concludente, quando as circunstâncias evidenciam a intenção
      da parte de anuir com o negócio." (REsp 1.989.740)

1.4. A prática de qualquer dos atos descritos no item 1.2 DISPENSA A ASSINATURA
FÍSICA OU DIGITAL deste instrumento, vinculando as partes aos seus termos.

1.5. FORMALIZAÇÃO POSTERIOR DA RELAÇÃO PRÉ-EXISTENTE:
O presente instrumento formaliza e documenta a relação comercial pré-existente
entre as partes, cujo início efetivo dos serviços ocorreu em data anterior à
emissão deste documento. A formalização posterior se justifica em razão de:

    a) ADEQUAÇÃO ÀS NORMAS DO CFC: A Resolução CFC nº 1.590/2020 (atualizada pela
       Res. 1.703/2023) passou a exigir a formalização dos contratos de prestação
       de serviços contábeis, tornando necessária a regularização documental;

    b) CONTINUIDADE DA RELAÇÃO: Os serviços já vinham sendo prestados regularmente,
       com pagamentos de honorários, envio de documentos e demais atos que configuram
       aceite tácito desde o início da relação comercial;

    c) PRINCÍPIO DA BOA-FÉ CONTRATUAL: Conforme Art. 422 do Código Civil, as partes
       devem guardar os princípios de probidade e boa-fé na conclusão e execução
       do contrato, sendo a formalização ato de transparência e regularização;

    d) SEGURANÇA JURÍDICA: A documentação da relação comercial pré-existente visa
       garantir direitos e deveres de ambas as partes, sem alteração das condições
       já praticadas.

1.6. Todos os serviços prestados, honorários pagos e obrigações cumpridas antes
da emissão deste instrumento são ratificados e reconhecidos como válidos pelas
partes, integrando o presente contrato para todos os efeitos legais.

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 2ª - DO OBJETO DO CONTRATO
───────────────────────────────────────────────────────────────────────────────

2.1. O presente contrato tem por objeto a prestação dos seguintes serviços
contábeis pela CONTRATADA à CONTRATANTE:

${services.map((service, index) => `    ${index + 1}. ${service}`).join("\n")}

2.2. Os serviços serão executados em conformidade com:
    • Normas Brasileiras de Contabilidade (NBC)
    • Princípios de Contabilidade
    • Legislação tributária, trabalhista e previdenciária vigente

2.3. Serviços não previstos neste contrato serão objeto de orçamento específico.

───────────────────────────────────────────────────────────────────────────────
                  CLÁUSULA 3ª - DAS OBRIGAÇÕES DA CONTRATADA
───────────────────────────────────────────────────────────────────────────────

3.1. A CONTRATADA obriga-se a:

    a) Executar os serviços com zelo, diligência e competência profissional;
    b) Manter sigilo absoluto conforme NBC PG 01 (Código de Ética);
    c) Cumprir prazos legais para obrigações acessórias;
    d) Orientar a CONTRATANTE sobre procedimentos contábeis e fiscais;
    e) Informar sobre alterações na legislação que afetem a empresa;
    f) Zelar pela guarda dos documentos sob sua responsabilidade;
    g) Responsabilizar-se tecnicamente pelos serviços prestados;
    h) Comunicar ao COAF operações suspeitas (Lei 9.613/98).

───────────────────────────────────────────────────────────────────────────────
                 CLÁUSULA 4ª - DAS OBRIGAÇÕES DA CONTRATANTE
───────────────────────────────────────────────────────────────────────────────

4.1. A CONTRATANTE obriga-se a:

    a) Fornecer tempestivamente todos os documentos necessários;
    b) Pagar pontualmente os honorários nos prazos estabelecidos;
    c) Comunicar imediatamente alterações cadastrais ou societárias;
    d) Manter documentos arquivados pelo prazo legal;
    e) Responsabilizar-se pela veracidade das informações fornecidas;
    f) Atender solicitações de documentos em até 5 dias úteis;
    g) Indicar preposto para contato com a CONTRATADA;
    h) Fornecer anualmente a Carta de Responsabilidade da Administração (ITG 1000).

4.2. A não entrega da Carta de Responsabilidade (ITG 1000) até o encerramento
do exercício sujeitará a CONTRATANTE às consequências previstas na legislação,
eximindo a CONTRATADA de responsabilidade solidária por informações incorretas.

───────────────────────────────────────────────────────────────────────────────
              CLÁUSULA 5ª - DOS HONORÁRIOS E FORMA DE PAGAMENTO
───────────────────────────────────────────────────────────────────────────────

5.1. Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA:

    HONORÁRIOS MENSAIS: ${monthlyFeeText}
    VENCIMENTO: Dia ${formData.payment_day} de cada mês
    FORMA DE PAGAMENTO: ${formData.payment_method === "boleto" ? "Boleto Bancário" : formData.payment_method === "pix" ? "PIX" : "Transferência Bancária"}

5.2. O não pagamento na data de vencimento acarretará:
    • Multa de 2% (dois por cento) sobre o valor devido
    • Juros de mora de 1% (um por cento) ao mês
    • Correção monetária pelo ${formData.adjustment_index}/FGV

5.3. Atraso superior a 60 (sessenta) dias faculta à CONTRATADA:
    • Suspender a prestação de serviços
    • Não entregar declarações e obrigações acessórias
    • Cobrar judicialmente os valores devidos

5.4. A suspensão de serviços por inadimplência NÃO exime a CONTRATANTE das
obrigações fiscais e tributárias, sendo de sua exclusiva responsabilidade
eventuais multas, juros e penalidades decorrentes.

───────────────────────────────────────────────────────────────────────────────
                       CLÁUSULA 6ª - DO REAJUSTE ANUAL
───────────────────────────────────────────────────────────────────────────────

6.1. Os honorários serão reajustados anualmente pela variação acumulada do
${formData.adjustment_index}/FGV nos 12 meses anteriores, ou pelo índice que vier a
substituí-lo, aplicado automaticamente na data de aniversário do contrato.

6.2. Na hipótese de extinção do índice, aplicar-se-á outro índice oficial que
reflita a variação do custo de vida.

───────────────────────────────────────────────────────────────────────────────
                         CLÁUSULA 7ª - DA VIGÊNCIA
───────────────────────────────────────────────────────────────────────────────

7.1. Este contrato terá vigência de PRAZO INDETERMINADO, iniciando-se em
${new Date(formData.start_date).toLocaleDateString("pt-BR")}.

7.2. O contrato renovar-se-á automaticamente por períodos iguais e sucessivos,
salvo manifestação expressa em contrário por qualquer das partes.

───────────────────────────────────────────────────────────────────────────────
               CLÁUSULA 8ª - DA RESCISÃO E DISTRATO OBRIGATÓRIO
───────────────────────────────────────────────────────────────────────────────

8.1. O presente contrato poderá ser rescindido:
    a) Por acordo entre as partes;
    b) Por iniciativa de qualquer parte, com aviso prévio de 30 dias;
    c) Por inadimplência superior a 60 dias;
    d) Por descumprimento de obrigações contratuais.

8.2. DISTRATO OBRIGATÓRIO (Resolução CFC 1.590/2020):
O rompimento do vínculo contratual implica celebração obrigatória de DISTRATO,
com estabelecimento da cessação das responsabilidades dos contratantes.

8.3. Na impossibilidade de celebração do distrato, a CONTRATADA notificará a
CONTRATANTE formalmente quanto ao fim da relação contratual.

8.4. Em caso de rescisão:
    • A CONTRATADA entregará todos os documentos mediante protocolo
    • A CONTRATANTE quitará todos os valores devidos até a data da rescisão
    • As responsabilidades cessam na data estabelecida no distrato

───────────────────────────────────────────────────────────────────────────────
        CLÁUSULA 9ª - DA PREVENÇÃO À LAVAGEM DE DINHEIRO (LEI 9.613/98)
───────────────────────────────────────────────────────────────────────────────

9.1. A CONTRATANTE declara ter ciência de que a CONTRATADA está obrigada, nos
termos da Lei nº 9.613/1998 e Resolução CFC nº 1.721/2024, a comunicar ao
Conselho de Controle de Atividades Financeiras (COAF) operações ou propostas
de operações que possam constituir indícios de lavagem de dinheiro, financiamento
ao terrorismo ou proliferação de armas de destruição em massa.

9.2. Devem ser comunicadas obrigatoriamente ao COAF, no prazo de 24 horas:
    a) Aquisição de ativos e pagamentos em espécie acima de R$ 50.000,00;
    b) Constituição de empresa ou aumento de capital em espécie acima de R$ 100.000,00;
    c) Qualquer operação que apresente indícios de irregularidade.

9.3. A CONTRATANTE compromete-se a não solicitar à CONTRATADA qualquer ato
que possa caracterizar participação em crimes financeiros.

9.4. A CONTRATANTE autoriza a CONTRATADA a manter registro de todas as
operações realizadas pelo prazo legal de 5 (cinco) anos.

───────────────────────────────────────────────────────────────────────────────
               CLÁUSULA 10ª - DA RESPONSABILIDADE PROFISSIONAL
───────────────────────────────────────────────────────────────────────────────

10.1. A CONTRATADA responde profissionalmente pelos serviços prestados nos
limites da legislação vigente, do Código de Ética e das NBC.

10.2. A responsabilidade da CONTRATADA limita-se aos serviços efetivamente
contratados, NÃO se estendendo a:
    • Decisões gerenciais ou empresariais da CONTRATANTE
    • Informações falsas ou incompletas fornecidas pela CONTRATANTE
    • Documentos não entregues ou entregues intempestivamente
    • Consequências de atos praticados antes do início do contrato

10.3. A CONTRATANTE responde integralmente pela veracidade das informações
fornecidas, isentando a CONTRATADA de responsabilidade solidária por dados
incorretos, conforme Art. 1.177 do Código Civil.

───────────────────────────────────────────────────────────────────────────────
     CLÁUSULA 11ª - DO SIGILO, CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)
───────────────────────────────────────────────────────────────────────────────

11.1. As partes comprometem-se a manter sigilo absoluto sobre todas as
informações obtidas em decorrência deste contrato, conforme:
    • NBC PG 01 - Código de Ética Profissional do Contador
    • Lei Geral de Proteção de Dados - LGPD (Lei 13.709/2018)
    • Código Civil Brasileiro

11.2. PROTEÇÃO DE DADOS PESSOAIS (LGPD):
    a) A CONTRATADA atua como OPERADORA de dados pessoais fornecidos pela
       CONTRATANTE, que é a CONTROLADORA dos dados;
    b) O tratamento de dados será realizado exclusivamente para cumprimento
       das obrigações contábeis, fiscais e trabalhistas (Art. 7º, II da LGPD);
    c) A CONTRATADA adotará medidas técnicas e administrativas para proteção
       dos dados pessoais contra acessos não autorizados (Art. 46 da LGPD);
    d) Os dados serão mantidos pelo prazo legal e eliminados após cumpridas
       as finalidades para as quais foram coletados (Art. 16 da LGPD).

11.3. A CONTRATANTE responsabiliza-se por obter o consentimento dos titulares
de dados pessoais quando necessário, e por informá-los sobre o compartilhamento
com a CONTRATADA para fins de cumprimento de obrigações legais.

11.4. A obrigação de sigilo permanece mesmo após o término do contrato.

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 12ª - DAS DISPOSIÇÕES GERAIS
───────────────────────────────────────────────────────────────────────────────

12.1. Este contrato obriga as partes e seus sucessores a qualquer título.

12.2. Alterações neste contrato serão formalizadas por ADITIVO CONTRATUAL.

12.3. A tolerância no descumprimento de qualquer cláusula não implica novação.

12.4. Este contrato substitui quaisquer acordos anteriores, verbais ou escritos.

12.5. Comunicações oficiais serão feitas pelos e-mails cadastrados das partes.

───────────────────────────────────────────────────────────────────────────────
                   CLÁUSULA 13ª - DOS DEVEDORES SOLIDÁRIOS
───────────────────────────────────────────────────────────────────────────────

13.1. Os sócios, administradores e representantes legais da CONTRATANTE,
neste ato identificados conforme quadro societário constante nos registros
oficiais (Junta Comercial/Cartório de Registro Civil), figuram como
DEVEDORES SOLIDÁRIOS das obrigações assumidas neste contrato.

13.2. FUNDAMENTAÇÃO LEGAL DA RESPONSABILIDADE SOLIDÁRIA:
    a) Art. 264 do Código Civil: "Há solidariedade, quando na mesma obrigação
       concorre mais de um credor, ou mais de um devedor, cada um com direito,
       ou obrigado, à dívida toda."
    b) Art. 265 do Código Civil: "A solidariedade não se presume; resulta da
       lei ou da vontade das partes."
    c) Art. 275 do Código Civil: "O credor tem direito a exigir e receber de
       um ou de alguns dos devedores, parcial ou totalmente, a dívida comum."

13.3. Os DEVEDORES SOLIDÁRIOS renunciam expressamente ao BENEFÍCIO DE ORDEM
previsto no Art. 827 do Código Civil, podendo a CONTRATADA exigir a dívida
diretamente de qualquer dos sócios, sem necessidade de primeiro executar
os bens da pessoa jurídica (CONTRATANTE).

13.4. A responsabilidade solidária abrange:
    a) Honorários vencidos e vincendos;
    b) Multas contratuais;
    c) Juros de mora e correção monetária;
    d) Custas processuais e honorários advocatícios em caso de cobrança;
    e) Despesas com protestos e negativação em órgãos de proteção ao crédito.

13.5. A garantia solidária é irrevogável e irretratável, permanecendo válida
mesmo após eventual alteração do quadro societário da CONTRATANTE, até a
quitação integral de todos os débitos existentes até a data da alteração.

13.6. Em caso de inadimplência, a CONTRATADA poderá:
    a) Protestar o título executivo extrajudicial;
    b) Negativar o nome da empresa e dos sócios nos órgãos de proteção ao crédito;
    c) Executar judicialmente a dívida contra a empresa e/ou qualquer sócio.

───────────────────────────────────────────────────────────────────────────────
                           CLÁUSULA 14ª - DO FORO
───────────────────────────────────────────────────────────────────────────────

14.1. Fica eleito o foro da comarca de ${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"} para dirimir
quaisquer questões oriundas deste contrato, com renúncia expressa a qualquer
outro, por mais privilegiado que seja.

───────────────────────────────────────────────────────────────────────────────
                     CLÁUSULA 15ª - DA EFICÁCIA DO ACEITE
───────────────────────────────────────────────────────────────────────────────

15.1. Conforme estabelecido na Cláusula 1ª, este contrato entra em vigor
automaticamente quando a CONTRATANTE praticar qualquer ato que configure
aceite tácito (comportamento concludente).

15.2. A utilização dos serviços da CONTRATADA após o recebimento deste
instrumento constitui prova inequívoca da aceitação de todas as suas cláusulas.

15.3. Este documento foi enviado eletronicamente para o e-mail cadastrado da
CONTRATANTE em ${formattedDate}, ficando arquivado nos sistemas da CONTRATADA
como prova de entrega e ciência.

═══════════════════════════════════════════════════════════════════════════════
                              DADOS DO DOCUMENTO
═══════════════════════════════════════════════════════════════════════════════

Data de Elaboração: ${formattedDate}
Responsável Técnico: ${officeData.responsavel_tecnico || ""}
CRC do Responsável: ${officeData.responsavel_crc || ""}
Versão: Resolução CFC 1.590/2020 (alt. 1.703/2023) + LGPD + Res. 1.721/2024

CONTRATADA: ${officeData.razao_social}
CNPJ: ${officeData.cnpj}
CRC: CRC/${officeData.crc_state} ${officeData.crc_number}

CONTRATANTE: ${client.name}
CNPJ/CPF: ${client.cnpj || "Não informado"}

═══════════════════════════════════════════════════════════════════════════════
              DISPENSA DE ASSINATURA - FUNDAMENTAÇÃO LEGAL
═══════════════════════════════════════════════════════════════════════════════

Este contrato DISPENSA ASSINATURA FÍSICA OU DIGITAL com base nos seguintes
fundamentos legais e jurisprudenciais:

CÓDIGO CIVIL BRASILEIRO (Lei nº 10.406/2002):

    Art. 107: "A validade da declaração de vontade não dependerá de forma
    especial, senão quando a lei expressamente a exigir."

    Art. 111: "O silêncio importa anuência, quando as circunstâncias ou os
    usos o autorizarem, e não for necessária a declaração de vontade expressa."

JURISPRUDÊNCIA DO SUPERIOR TRIBUNAL DE JUSTIÇA (STJ):

    "A manifestação de vontade tácita configura-se pela presença do denominado
    comportamento concludente, quando as circunstâncias evidenciam a intenção
    inequívoca da parte de anuir com o negócio jurídico proposto."
    (REsp 1.989.740/SP - Rel. Min. Nancy Andrighi)

    "A ausência de assinatura física no contrato não invalida sua eficácia,
    notadamente diante da existência de aceite por comportamento concludente
    e da efetiva fruição dos benefícios pactuados."
    (AgInt no AREsp 1.742.341/SP)

CÓDIGO DE DEFESA DO CONSUMIDOR (Lei nº 8.078/1990):

    Art. 54: Reconhece expressamente a validade dos contratos de adesão,
    cujas cláusulas são estabelecidas unilateralmente pelo fornecedor.

RESOLUÇÃO CFC Nº 1.590/2020:

    Estabelece que o contrato de prestação de serviços contábeis deve ser
    celebrado por escrito, sem exigência de forma solene ou assinatura física.

───────────────────────────────────────────────────────────────────────────────
                         CONFIGURAÇÃO DO ACEITE TÁCITO
───────────────────────────────────────────────────────────────────────────────

O aceite tácito deste contrato ocorre quando a CONTRATANTE pratica qualquer
dos seguintes atos (comportamento concludente):

    [X] Utilização de qualquer serviço prestado pela CONTRATADA
    [X] Envio de documentos fiscais, contábeis ou trabalhistas
    [X] Pagamento, total ou parcial, de honorários contábeis
    [X] Solicitação de serviços por qualquer meio de comunicação
    [X] Fornecimento de procuração ou senhas de sistemas governamentais
    [X] Manutenção da relação comercial após recebimento deste instrumento

A prática de QUALQUER destes atos constitui PROVA INEQUÍVOCA da aceitação
integral de todas as cláusulas deste contrato, vinculando as partes aos
seus termos com a mesma força e validade de um contrato assinado.

───────────────────────────────────────────────────────────────────────────────

${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"}, ${formattedDate}

                    *** ASSINATURA DISPENSADA ***
          Conforme Arts. 107 e 111 do Código Civil Brasileiro
               e jurisprudência consolidada do STJ

═══════════════════════════════════════════════════════════════════════════════
`;
  };

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    setSelectedClient(client || null);
    setFormData({ ...formData, client_id: clientId });
  };

  const handlePreview = () => {
    if (!selectedClient) {
      toast({
        title: "Selecione um cliente",
        description: "É necessário selecionar um cliente para gerar o preview.",
        variant: "destructive",
      });
      return;
    }

    const preview = generateContractContent(formData.contract_type);
    console.log("Preview gerado:", preview.substring(0, 200)); // Debug
    if (!preview) {
      toast({
        title: "Erro ao gerar preview",
        description: "Não foi possível gerar o contrato. Verifique os dados do cliente.",
        variant: "destructive",
      });
      return;
    }
    setContractPreview(preview);
    setShowPreview(true);
  };

  const handleSaveContract = async () => {
    if (!selectedClient || !formData.monthly_fee) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const contractContent = generateContractContent(formData.contract_type);
      const services = contractServices[formData.contract_type as keyof typeof contractServices] || [];

      // Mapear tipo de contrato do frontend para tipos válidos no banco
      // Banco aceita: 'service', 'consulting', 'partnership', 'opening', 'irpf', 'special'
      const contractTypeMapping: Record<string, string> = {
        full_accounting: "service",
        payroll: "service",
        tax: "service",
        consulting: "consulting",
        service: "service",
        partnership: "partnership",
        opening: "opening",
        irpf: "irpf",
        special: "special",
      };
      const dbContractType = contractTypeMapping[formData.contract_type] || "service";

      const contractData = {
        client_id: formData.client_id,
        contract_type: dbContractType,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        monthly_fee: parseFloat(formData.monthly_fee),
        payment_day: parseInt(formData.payment_day),
        payment_method: formData.payment_method,
        adjustment_index: formData.adjustment_index,
        services: services.map(s => ({ service: s, included: true })),
        special_clauses: formData.special_clauses,
        content: contractContent,
        coaf_clause_accepted: true,
        requires_responsibility_letter: true,
        status: "active", // Já ativo por aceite tácito
        signature_status: "signed", // Aceite tácito = assinado
      };

      const { data, error } = await supabase
        .from("accounting_contracts")
        .insert(contractData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Contrato criado",
        description: `Contrato ${data.contract_number} criado com sucesso. Válido por aceite tácito.`,
      });

      setShowNewContract(false);
      setShowPreview(false);
      resetForm();
      fetchContracts();
    } catch (error) {
      console.error("Error saving contract:", error);
      toast({
        title: "Erro ao salvar contrato",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText(contractPreview);
    toast({
      title: "Contrato copiado",
      description: "O texto do contrato foi copiado para a área de transferência.",
    });
  };

  // Buscar sócios do cliente
  const fetchClientPartners = async (clientId: string): Promise<ClientPartner[]> => {
    const { data, error } = await supabase
      .from("client_partners")
      .select("id, name, cpf, partner_type, percentage, is_administrator")
      .eq("client_id", clientId)
      .order("percentage", { ascending: false });

    if (error) {
      console.error("Erro ao buscar sócios:", error);
      return [];
    }
    return data || [];
  };

  // Buscar débitos do cliente nos lançamentos contábeis (fonte da verdade)
  const fetchClientDebts = async (clientId: string, clientName: string): Promise<{competence: string; due_date: string; amount: number; description: string}[]> => {
    try {
      // Buscar a conta do cliente no plano de contas (1.1.2.01.xxx - Clientes a Receber)
      const { data: clientAccount } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .like("code", "1.1.2.01%")
        .ilike("name", `%${clientName.split(" ")[0]}%`)
        .limit(1)
        .single();

      if (!clientAccount) {
        console.log("Conta do cliente não encontrada no plano de contas");
        return [];
      }

      // Buscar lançamentos de débito (valores a receber) na conta do cliente
      const { data: entries, error } = await supabase
        .from("accounting_entry_lines")
        .select(`
          id,
          debit,
          credit,
          description,
          accounting_entries!inner(
            id,
            entry_date,
            description,
            competence_date
          )
        `)
        .eq("account_id", clientAccount.id)
        .gt("debit", 0)
        .order("accounting_entries(entry_date)", { ascending: false });

      if (error) {
        console.error("Erro ao buscar débitos:", error);
        return [];
      }

      // Formatar os dados
      const debts = (entries || []).map((entry: any) => {
        const competenceDate = entry.accounting_entries?.competence_date;
        let competence = "";
        if (competenceDate) {
          const date = new Date(competenceDate);
          competence = `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
        }
        return {
          competence,
          due_date: entry.accounting_entries?.entry_date || "",
          amount: Number(entry.debit) - Number(entry.credit || 0),
          description: entry.description || entry.accounting_entries?.description || "Honorários contábeis"
        };
      }).filter((d: any) => d.amount > 0);

      return debts;
    } catch (error) {
      console.error("Erro ao buscar débitos do cliente:", error);
      return [];
    }
  };

  // Abrir diálogo de cobrança
  const handleOpenCollection = async (contract: Contract) => {
    setLoadingDebts(true);
    setShowCollectionDialog(true);
    setSelectedDebtorContract(contract);

    // Buscar sócios e débitos em paralelo
    const [partners, debts] = await Promise.all([
      fetchClientPartners(contract.client_id),
      fetchClientDebts(contract.client_id, contract.clients?.name || "")
    ]);

    setDebtorPartners(partners);
    setClientDebts(debts);

    // Calcular valor total e quantidade de meses
    if (debts.length > 0) {
      const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
      setDebtAmount(String(totalDebt.toFixed(2)));
      setDebtMonths(`${debts.length} ${debts.length === 1 ? "mês" : "meses"}`);
    } else {
      setDebtAmount("");
      setDebtMonths("");
    }

    setCollectionDays("5");
    setLoadingDebts(false);
  };

  // Gerar mensagem de cobrança para WhatsApp
  const generateCollectionMessage = (): string => {
    if (!selectedDebtorContract) return "";

    const client = selectedDebtorContract.clients;
    const today = new Date();
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + parseInt(collectionDays));

    const formattedDeadline = deadline.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const formattedToday = today.toLocaleDateString("pt-BR");

    const debtValue = debtAmount
      ? parseFloat(debtAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : `R$ ${Number(selectedDebtorContract.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    const partnersText = debtorPartners.length > 0
      ? debtorPartners.map(p => `• ${p.name}${p.cpf ? ` (CPF: ${p.cpf})` : ""}`).join("\n")
      : "";

    const message = `
*NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *CONTRATO:* ${selectedDebtorContract.contract_number}
📅 *Data:* ${formattedToday}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*NOTIFICANTE:*
${officeData.razao_social}
CNPJ: ${officeData.cnpj}
CRC: ${officeData.crc_state} ${officeData.crc_number}

*NOTIFICADO:*
${client?.name || "Cliente"}
CNPJ: ${client?.cnpj || "Não informado"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *OBJETO DA NOTIFICAÇÃO*

Vimos, pela presente, NOTIFICAR V.Sa. acerca do débito existente referente ao Contrato de Prestação de Serviços Contábeis nº ${selectedDebtorContract.contract_number}.

💰 *DÉBITO:* ${debtValue}${debtMonths ? ` (${debtMonths} meses)` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ *PRAZO PARA NEGOCIAÇÃO:*
Concedemos o prazo de *${collectionDays} (${numberToWordsFull(parseInt(collectionDays))}) dias úteis*, ou seja, até *${formattedDeadline}*, para que V.Sa. entre em contato para negociação e quitação do débito.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚖️ *CONSEQUÊNCIAS DO NÃO PAGAMENTO:*

Decorrido o prazo sem manifestação, serão adotadas as seguintes medidas:

1️⃣ *PROTESTO DO TÍTULO* junto aos Cartórios de Protesto competentes;

2️⃣ *NEGATIVAÇÃO* do nome da empresa e dos sócios junto aos órgãos de proteção ao crédito (SPC/Serasa);

3️⃣ *EXECUÇÃO JUDICIAL* do título executivo extrajudicial contra a empresa e seus sócios (devedores solidários).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${debtorPartners.length > 0 ? `👥 *DEVEDORES SOLIDÁRIOS (Art. 264 CC):*

${partnersText}

Conforme Cláusula 13ª do contrato, os sócios respondem solidariamente pelas obrigações, com renúncia ao benefício de ordem (Art. 827 CC).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : ""}📞 *CONTATO PARA NEGOCIAÇÃO:*
${officeData.telefone || ""}
${officeData.email || ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Esta notificação tem valor de *prova documental* para eventual ação judicial.

_Ampla Contabilidade_
_${formattedToday}_
`.trim();

    return message;
  };

  // Função auxiliar para extenso de números
  const numberToWordsFull = (num: number): string => {
    const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte"];
    if (num <= 20) return units[num];
    if (num < 30) return "vinte e " + units[num - 20];
    if (num < 40) return "trinta" + (num % 10 === 0 ? "" : " e " + units[num % 10]);
    return String(num);
  };

  // Enviar mensagem via WhatsApp
  const sendWhatsAppCollection = () => {
    if (!selectedDebtorContract?.clients?.phone) {
      toast({
        title: "Telefone não encontrado",
        description: "O cliente não possui telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    const message = generateCollectionMessage();
    const phone = selectedDebtorContract.clients.phone.replace(/\D/g, "");
    const phoneWithCountry = phone.startsWith("55") ? phone : "55" + phone;

    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");

    toast({
      title: "WhatsApp aberto",
      description: "A notificação de cobrança foi preparada para envio.",
    });

    setShowCollectionDialog(false);
  };

  // Copiar mensagem de cobrança
  const copyCollectionMessage = () => {
    const message = generateCollectionMessage();
    navigator.clipboard.writeText(message);
    toast({
      title: "Mensagem copiada",
      description: "A notificação de cobrança foi copiada para a área de transferência.",
    });
  };

  // Gerar PDF moderno e completo com todas as cláusulas
  const generateModernPDF = async (contract: Contract) => {
    // Buscar sócios do cliente
    const partners = await fetchClientPartners(contract.client_id);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;
    let currentPage = 1;

    // Cores do tema
    const primaryColor: [number, number, number] = [88, 28, 135]; // Purple-800
    const secondaryColor: [number, number, number] = [147, 51, 234]; // Purple-600
    const accentColor: [number, number, number] = [59, 130, 246]; // Blue-500
    const darkGray: [number, number, number] = [31, 41, 55]; // Gray-800
    const lightGray: [number, number, number] = [229, 231, 235]; // Gray-200
    const greenColor: [number, number, number] = [22, 163, 74]; // Green-600
    const redColor: [number, number, number] = [185, 28, 28]; // Red-700

    const honorarios = `R$ ${Number(contract.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    const honorariosExtenso = numberToWords(Number(contract.monthly_fee));

    // Função auxiliar para número por extenso
    function numberToWords(num: number): string {
      const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
      const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
      const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
      const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

      if (num === 0) return 'zero reais';
      if (num === 100) return 'cem reais';

      const intPart = Math.floor(num);
      const decPart = Math.round((num - intPart) * 100);

      let result = '';

      if (intPart >= 1000) {
        const thousands = Math.floor(intPart / 1000);
        if (thousands === 1) result += 'mil';
        else if (thousands < 10) result += units[thousands] + ' mil';
        else if (thousands < 20) result += teens[thousands - 10] + ' mil';
        else result += tens[Math.floor(thousands / 10)] + (thousands % 10 > 0 ? ' e ' + units[thousands % 10] : '') + ' mil';
      }

      const remainder = intPart % 1000;
      if (remainder >= 100) {
        if (result) result += ' ';
        if (remainder === 100) result += 'cem';
        else result += hundreds[Math.floor(remainder / 100)];
      }

      const tensUnit = remainder % 100;
      if (tensUnit > 0) {
        if (remainder >= 100) result += ' e ';
        else if (result) result += ' e ';
        if (tensUnit < 10) result += units[tensUnit];
        else if (tensUnit < 20) result += teens[tensUnit - 10];
        else result += tens[Math.floor(tensUnit / 10)] + (tensUnit % 10 > 0 ? ' e ' + units[tensUnit % 10] : '');
      }

      result += intPart === 1 ? ' real' : ' reais';

      if (decPart > 0) {
        result += ' e ';
        if (decPart < 10) result += units[decPart];
        else if (decPart < 20) result += teens[decPart - 10];
        else result += tens[Math.floor(decPart / 10)] + (decPart % 10 > 0 ? ' e ' + units[decPart % 10] : '');
        result += decPart === 1 ? ' centavo' : ' centavos';
      }

      return result;
    }

    // Função para adicionar footer
    const addFooter = () => {
      const footerY = pageHeight - 15;
      doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.text(`${officeData.razao_social} - CNPJ: ${officeData.cnpj}`, margin, footerY);
      doc.text(`Contrato nº ${contract.contract_number}`, pageWidth / 2, footerY, { align: "center" });
      doc.text(`Página ${currentPage}`, pageWidth - margin, footerY, { align: "right" });
    };

    // Função para verificar e adicionar nova página
    const checkNewPage = (neededSpace: number = 30) => {
      if (yPos > pageHeight - neededSpace - 20) {
        addFooter();
        doc.addPage();
        currentPage++;
        yPos = margin;
        return true;
      }
      return false;
    };

    // Função para adicionar título de seção
    const addSectionTitle = (title: string, color: [number, number, number] = primaryColor) => {
      checkNewPage(40);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 4, yPos + 5.5);
      yPos += 12;
    };

    // Função para adicionar parágrafo
    const addParagraph = (text: string, fontSize: number = 9, indent: number = 0) => {
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, contentWidth - indent - 4);
      lines.forEach((line: string) => {
        checkNewPage();
        doc.text(line, margin + 4 + indent, yPos);
        yPos += fontSize * 0.45;
      });
      yPos += 2;
    };

    // Função para adicionar cláusula
    const addClause = (number: string, title: string, content: string[]) => {
      checkNewPage(50);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${number} - ${title}`, margin + 4, yPos);
      yPos += 6;

      content.forEach((paragraph) => {
        addParagraph(paragraph, 9, 0);
      });
      yPos += 3;
    };

    // ==================== PÁGINA 1: CAPA E IDENTIFICAÇÃO ====================

    // Header com gradiente visual
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 50, "F");

    // Linha decorativa
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(0, 50, pageWidth, 3, "F");

    // Título do documento
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRATO DE PRESTAÇÃO DE", pageWidth / 2, 18, { align: "center" });
    doc.text("SERVIÇOS PROFISSIONAIS CONTÁBEIS", pageWidth / 2, 26, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("MODALIDADE: ADESÃO COM ACEITE TÁCITO", pageWidth / 2, 36, { align: "center" });

    doc.setFontSize(9);
    doc.text("Conforme Resolução CFC nº 1.590/2020 (atualizada pela Res. 1.703/2023)", pageWidth / 2, 44, { align: "center" });

    yPos = 63;

    // Número do contrato
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, "F");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`CONTRATO Nº ${contract.contract_number}`, pageWidth / 2, yPos + 8, { align: "center" });

    yPos += 20;

    // Seção CONTRATADA
    addSectionTitle("CONTRATADA (PRESTADORA DE SERVIÇOS)", primaryColor);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const contratadaInfo = [
      [`Razão Social:`, officeData.razao_social],
      [`CNPJ:`, officeData.cnpj],
      [`CRC:`, `CRC/${officeData.crc_state || "GO"} ${officeData.crc_number || ""}`],
      [`Responsável Técnico:`, `${officeData.responsavel_tecnico || ""} - ${officeData.responsavel_crc || ""}`],
      [`Endereço:`, `${officeData.endereco || ""}, ${officeData.numero || "S/N"} - ${officeData.bairro || ""}`],
      [`Cidade/UF:`, `${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"} - CEP: ${officeData.cep || ""}`],
      [`E-mail:`, officeData.email || ""],
      [`Telefone:`, officeData.telefone || ""],
    ];

    contratadaInfo.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin + 4, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 45, yPos);
      yPos += 5;
    });

    yPos += 8;

    // Seção CONTRATANTE
    addSectionTitle("CONTRATANTE (TOMADOR DE SERVIÇOS)", accentColor);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const client = contract.clients;
    const contratanteInfo = [
      [`Razão Social:`, client?.name || ""],
      [`CNPJ:`, client?.cnpj || ""],
      [`Endereço:`, `${client?.logradouro || ""}, ${client?.numero || "S/N"} - ${client?.bairro || ""}`],
      [`Cidade/UF:`, `${client?.municipio || ""}/${client?.uf || ""} - CEP: ${client?.cep || ""}`],
      [`E-mail:`, client?.email || "Não informado"],
      [`Telefone:`, client?.phone || ""],
    ];

    contratanteInfo.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin + 4, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(value || "", margin + 45, yPos);
      yPos += 5;
    });

    yPos += 10;

    // Box de Resumo Financeiro
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, "FD");

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO FINANCEIRO", margin + contentWidth / 2, yPos + 7, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

    doc.setFont("helvetica", "bold");
    doc.text("Honorários Mensais:", margin + 10, yPos + 15);
    doc.setFont("helvetica", "normal");
    doc.text(honorarios, margin + 55, yPos + 15);

    doc.setFont("helvetica", "bold");
    doc.text("Tipo de Contrato:", margin + contentWidth / 2 + 10, yPos + 15);
    doc.setFont("helvetica", "normal");
    doc.text(getContractTypeLabel(contract.contract_type), margin + contentWidth / 2 + 50, yPos + 15);

    doc.setFont("helvetica", "bold");
    doc.text("Data de Início:", margin + 10, yPos + 22);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(contract.start_date).toLocaleDateString("pt-BR"), margin + 55, yPos + 22);

    doc.setFont("helvetica", "bold");
    doc.text("Dia de Vencimento:", margin + contentWidth / 2 + 10, yPos + 22);
    doc.setFont("helvetica", "normal");
    doc.text(`Todo dia ${contract.payment_day || 10}`, margin + contentWidth / 2 + 50, yPos + 22);

    yPos += 40;

    // ==================== CLÁUSULAS DO CONTRATO ====================

    addSectionTitle("DAS CLÁUSULAS CONTRATUAIS", primaryColor);

    // CLÁUSULA PRIMEIRA - OBJETO
    addClause("CLÁUSULA PRIMEIRA", "DO OBJETO", [
      "O presente contrato tem por objeto a prestação de serviços profissionais de contabilidade pela CONTRATADA à CONTRATANTE, compreendendo as áreas contábil, fiscal e trabalhista, nos termos e condições aqui estabelecidos, em conformidade com as Normas Brasileiras de Contabilidade e legislação vigente.",
      "A CONTRATADA assume a responsabilidade técnica pelos serviços e orientações prestados, ficando estabelecido que a responsabilidade pelas informações fornecidas, pela autenticidade dos documentos e pela veracidade dos dados é exclusiva da CONTRATANTE.",
    ]);

    // CLÁUSULA SEGUNDA - SERVIÇOS
    addClause("CLÁUSULA SEGUNDA", "DOS SERVIÇOS PRESTADOS", [
      "A CONTRATADA se obriga a prestar os seguintes serviços profissionais:",
    ]);

    // Área Contábil
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    checkNewPage();
    doc.text("2.1. ÁREA CONTÁBIL:", margin + 4, yPos);
    yPos += 5;

    const servicosContabeis = [
      "a) Classificação e escrituração da contabilidade de acordo com as Normas Brasileiras de Contabilidade;",
      "b) Apuração de balancetes mensais e demonstrações contábeis obrigatórias;",
      "c) Elaboração do Balanço Patrimonial e Demonstração do Resultado do Exercício;",
      "d) Elaboração da Demonstração de Lucros ou Prejuízos Acumulados;",
      "e) Elaboração das Notas Explicativas, quando aplicável;",
      "f) Elaboração do SPED Contábil (ECD) e ECF, quando obrigatório;",
      "g) Assessoria para tomada de decisões gerenciais baseadas em informações contábeis;",
    ];

    servicosContabeis.forEach((item) => {
      addParagraph(item, 8, 5);
    });

    yPos += 3;

    // Área Fiscal
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    checkNewPage();
    doc.text("2.2. ÁREA FISCAL/TRIBUTÁRIA:", margin + 4, yPos);
    yPos += 5;

    const servicosFiscais = [
      "a) Orientação e controle da aplicação dos dispositivos legais vigentes (federais, estaduais e municipais);",
      "b) Elaboração e transmissão de todas as declarações acessórias obrigatórias;",
      "c) Escrituração dos registros fiscais obrigatórios (eletrônicos ou não);",
      "d) Apuração dos impostos e contribuições devidos (IRPJ, CSLL, PIS, COFINS, ICMS, ISS, etc.);",
      "e) Elaboração e transmissão do SPED Fiscal (EFD ICMS/IPI) e EFD Contribuições;",
      "f) Emissão de guias de recolhimento de tributos;",
      "g) Atendimento às fiscalizações tributárias, quando solicitado;",
      "h) Orientação sobre planejamento tributário básico e enquadramento fiscal;",
    ];

    servicosFiscais.forEach((item) => {
      addParagraph(item, 8, 5);
    });

    yPos += 3;

    // Área Trabalhista
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    checkNewPage();
    doc.text("2.3. ÁREA TRABALHISTA/DEPARTAMENTO PESSOAL:", margin + 4, yPos);
    yPos += 5;

    const servicosTrabalhistas = [
      "a) Elaboração da folha de pagamento mensal e encargos sociais;",
      "b) Cálculo e emissão de guias de INSS, FGTS e contribuições sindicais;",
      "c) Admissão e demissão de empregados, incluindo cálculos rescisórios;",
      "d) Elaboração e transmissão do eSocial, SEFIP/GFIP, CAGED e RAIS;",
      "e) Elaboração de recibos de férias e 13º salário;",
      "f) Controle de férias e afastamentos;",
      "g) Emissão de informes de rendimentos anuais;",
      "h) Atendimento às fiscalizações trabalhistas e previdenciárias;",
    ];

    servicosTrabalhistas.forEach((item) => {
      addParagraph(item, 8, 5);
    });

    yPos += 5;

    // Parágrafo sobre serviços não incluídos
    addParagraph("Parágrafo Único: Serviços extraordinários não previstos neste contrato, tais como: perícias contábeis, laudos técnicos, assessoria em processos administrativos ou judiciais, consultoria especializada, e serviços de natureza extraordinária, serão objeto de orçamento prévio e cobrança em separado.", 8, 0);

    // CLÁUSULA TERCEIRA - OBRIGAÇÕES DA CONTRATADA
    addClause("CLÁUSULA TERCEIRA", "DAS OBRIGAÇÕES DA CONTRATADA", [
      "São obrigações da CONTRATADA:",
      "a) Executar os serviços contratados com zelo, diligência e honestidade, observando a legislação vigente e as Normas Brasileiras de Contabilidade;",
      "b) Manter sigilo sobre todas as informações e documentos a que tiver acesso em razão do contrato, conforme NBC PG 01 e LGPD;",
      "c) Fornecer à CONTRATANTE, tempestivamente, as orientações técnicas necessárias ao cumprimento das obrigações legais;",
      "d) Entregar os documentos, relatórios e demonstrações contábeis nos prazos legais, mediante protocolo;",
      "e) Manter registro profissional ativo junto ao Conselho Regional de Contabilidade;",
      "f) Comunicar à CONTRATANTE, por escrito, qualquer irregularidade constatada na documentação ou informações recebidas;",
      "g) Cumprir os prazos legais para entrega de declarações e obrigações acessórias;",
      "h) Assumir responsabilidade técnica pelos serviços e orientações prestados conforme contratado.",
    ]);

    // CLÁUSULA QUARTA - OBRIGAÇÕES DA CONTRATANTE
    addClause("CLÁUSULA QUARTA", "DAS OBRIGAÇÕES DA CONTRATANTE", [
      "São obrigações da CONTRATANTE:",
      "a) Fornecer à CONTRATADA todos os documentos, dados e informações necessários à execução dos serviços, de forma completa, tempestiva e fidedigna;",
      "b) Pagar pontualmente os honorários nas datas e condições estabelecidas neste contrato;",
      "c) Comunicar à CONTRATADA, imediatamente, qualquer alteração em seus dados cadastrais, societários ou fiscais;",
      "d) Manter arquivo organizado de todos os documentos originais da empresa;",
      "e) Fornecer procurações e senhas de acesso a sistemas governamentais quando necessário;",
      "f) Assinar a Carta de Responsabilidade da Administração antes do encerramento de cada exercício social, conforme ITG 1000;",
      "g) Responder pela autenticidade, idoneidade e veracidade dos documentos e informações fornecidos;",
      "h) Não praticar atos que possam prejudicar o trabalho da CONTRATADA ou que constituam infração legal;",
      "i) Colaborar para o bom andamento dos trabalhos contábeis, atendendo prontamente às solicitações.",
      "Parágrafo Único: O atraso ou a falta de entrega dos documentos necessários poderá acarretar atraso no cumprimento das obrigações fiscais, cujas penalidades serão de responsabilidade exclusiva da CONTRATANTE.",
    ]);

    // CLÁUSULA QUINTA - HONORÁRIOS
    addClause("CLÁUSULA QUINTA", "DOS HONORÁRIOS E FORMA DE PAGAMENTO", [
      `5.1. Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA honorários mensais no valor de ${honorarios} (${honorariosExtenso}), com vencimento todo dia ${contract.payment_day || 10} de cada mês.`,
      `5.2. O pagamento deverá ser efetuado mediante ${contract.payment_method === 'boleto' ? 'boleto bancário' : contract.payment_method === 'pix' ? 'transferência via PIX' : 'depósito bancário'}, cujo comprovante deverá ser encaminhado à CONTRATADA.`,
      "5.3. Os honorários serão reajustados anualmente, no mês de janeiro, pelo índice " + (contract.adjustment_index || "IGPM") + " acumulado nos últimos 12 meses, ou por outro índice que venha a substituí-lo oficialmente.",
      "5.4. No mês de dezembro, será cobrado um honorário adicional equivalente ao valor mensal, referente aos serviços de encerramento do exercício social e elaboração das demonstrações contábeis anuais.",
      "5.5. O atraso no pagamento dos honorários acarretará multa de 2% (dois por cento) sobre o valor devido, acrescido de juros de mora de 1% (um por cento) ao mês, calculados pro rata die.",
      "5.6. Serviços extraordinários não previstos neste contrato serão cobrados separadamente, mediante orçamento prévio aprovado pela CONTRATANTE.",
    ]);

    // CLÁUSULA SEXTA - PRAZO
    addClause("CLÁUSULA SEXTA", "DO PRAZO DE VIGÊNCIA", [
      "6.1. O presente contrato é celebrado por prazo indeterminado, iniciando-se em " + new Date(contract.start_date).toLocaleDateString("pt-BR") + ".",
      "6.2. Qualquer das partes poderá rescindir o contrato mediante comunicação escrita com antecedência mínima de 30 (trinta) dias.",
      "6.3. A rescisão sem observância do aviso prévio obrigará a parte infratora ao pagamento de multa compensatória equivalente a 01 (um) mês de honorários.",
    ]);

    // CLÁUSULA SÉTIMA - RESCISÃO
    addClause("CLÁUSULA SÉTIMA", "DA RESCISÃO", [
      "7.1. O presente contrato poderá ser rescindido nas seguintes hipóteses:",
      "a) Por mútuo acordo entre as partes, formalizado por escrito;",
      "b) Por iniciativa unilateral de qualquer das partes, mediante aviso prévio de 30 dias;",
      "c) Por inadimplemento de qualquer das obrigações contratuais;",
      "d) Por falência, recuperação judicial ou dissolução de qualquer das partes;",
      "e) Por caso fortuito ou força maior que impossibilite a continuidade dos serviços.",
      "7.2. Em caso de rescisão, a CONTRATADA entregará à CONTRATANTE todos os documentos, livros e arquivos de sua propriedade, no prazo de 30 dias, mediante recibo e protocolo de entrega, observado o disposto no art. 5º da Resolução CFC 1.590/2020.",
      "7.3. A rescisão não exonera a CONTRATANTE do pagamento dos honorários e encargos devidos até a data da efetiva rescisão.",
    ]);

    // CLÁUSULA OITAVA - RESPONSABILIDADES
    addClause("CLÁUSULA OITAVA", "DAS RESPONSABILIDADES", [
      "8.1. A CONTRATADA responde técnica e profissionalmente pelos serviços prestados e pelas orientações fornecidas, nos limites de sua atuação.",
      "8.2. A CONTRATANTE é a única responsável pela veracidade das informações prestadas, pela autenticidade dos documentos fornecidos e pelas consequências decorrentes de informações incorretas, incompletas ou intempestivas.",
      "8.3. Multas, juros e penalidades decorrentes de atraso na entrega de documentos pela CONTRATANTE ou de informações incorretas por ela fornecidas serão de sua exclusiva responsabilidade.",
      "8.4. A CONTRATADA não responde por prejuízos decorrentes de caso fortuito, força maior, ou por atos praticados pela CONTRATANTE em desacordo com as orientações técnicas fornecidas.",
    ]);

    // CLÁUSULA NONA - SIGILO E LGPD
    addClause("CLÁUSULA NONA", "DO SIGILO PROFISSIONAL E PROTEÇÃO DE DADOS (LGPD)", [
      "9.1. A CONTRATADA compromete-se a manter absoluto sigilo sobre todas as informações, dados e documentos da CONTRATANTE a que tiver acesso em razão deste contrato, conforme NBC PG 01 - Código de Ética Profissional do Contador.",
      "9.2. Em cumprimento à Lei Geral de Proteção de Dados (Lei 13.709/2018), a CONTRATADA:",
      "a) Tratará os dados pessoais apenas para as finalidades específicas deste contrato;",
      "b) Adotará medidas de segurança adequadas à proteção dos dados;",
      "c) Não compartilhará dados com terceiros sem autorização expressa, salvo determinação legal;",
      "d) Manterá registro das atividades de tratamento de dados;",
      "e) Comunicará à CONTRATANTE qualquer incidente de segurança que possa afetar dados pessoais.",
      "9.3. A obrigação de sigilo perdura mesmo após o término do contrato, por prazo indeterminado.",
    ]);

    // CLÁUSULA DÉCIMA - COAF
    addClause("CLÁUSULA DÉCIMA", "DA COMUNICAÇÃO AO COAF (Lei 9.613/1998)", [
      "10.1. Em cumprimento à Lei 9.613/1998 e à Resolução CFC 1.721/2024, a CONTRATANTE declara ter ciência de que a CONTRATADA está obrigada a:",
      "a) Comunicar ao COAF, no prazo de 24 (vinte e quatro) horas, operações ou propostas de operações que possam constituir indício de lavagem de dinheiro ou financiamento ao terrorismo;",
      "b) Comunicar operações em espécie de valor igual ou superior a R$ 50.000,00 (cinquenta mil reais);",
      "c) Comunicar operações de pessoas politicamente expostas (PEP) de valor igual ou superior a R$ 100.000,00 (cem mil reais);",
      "d) Manter cadastro atualizado dos clientes e registros das operações realizadas.",
      "10.2. A CONTRATANTE compromete-se a fornecer todas as informações necessárias ao cumprimento das obrigações previstas na legislação de prevenção à lavagem de dinheiro.",
      "10.3. A não comunicação ao COAF, quando devida, pode sujeitar a CONTRATADA a sanções administrativas previstas na legislação vigente.",
    ]);

    // CLÁUSULA DÉCIMA PRIMEIRA - CARTA DE RESPONSABILIDADE
    addClause("CLÁUSULA DÉCIMA PRIMEIRA", "DA CARTA DE RESPONSABILIDADE DA ADMINISTRAÇÃO", [
      "11.1. A CONTRATANTE se obriga a fornecer à CONTRATADA, antes do encerramento de cada exercício social, a Carta de Responsabilidade da Administração, conforme ITG 1000 - Modelo Contábil para Microempresa e Empresa de Pequeno Porte.",
      "11.2. Na Carta de Responsabilidade, a administração da CONTRATANTE declara:",
      "a) Que as informações prestadas à contabilidade são fidedignas;",
      "b) Que os documentos fornecidos são idôneos e representam a realidade das operações;",
      "c) Que cumpriu todas as obrigações legais e regulamentares aplicáveis;",
      "d) Que não há contingências não reveladas ou passivos ocultos de seu conhecimento.",
      "11.3. A não apresentação da Carta de Responsabilidade no prazo estipulado poderá acarretar ressalvas nas demonstrações contábeis elaboradas.",
    ]);

    // CLÁUSULA DÉCIMA SEGUNDA - ACEITE TÁCITO (EXPANDIDA)
    addSectionTitle("CLÁUSULA DÉCIMA SEGUNDA - DA VALIDADE E ACEITE TÁCITO", greenColor);

    addParagraph("12.1. O presente contrato é celebrado na modalidade de CONTRATO DE ADESÃO, conforme Art. 54 do Código de Defesa do Consumidor e Art. 111 do Código Civil Brasileiro.", 9, 0);

    addParagraph("12.2. A CONTRATANTE manifesta sua aceitação integral a todas as cláusulas e condições deste contrato através de comportamento concludente, caracterizado por qualquer das seguintes condutas:", 9, 0);

    const conductsList = [
      "a) Utilização de qualquer serviço prestado pela CONTRATADA;",
      "b) Envio de documentos fiscais, contábeis ou trabalhistas para processamento;",
      "c) Pagamento, total ou parcial, de honorários contábeis;",
      "d) Fornecimento de procuração ou senha de acesso a sistemas governamentais;",
      "e) Solicitação de orientações, relatórios ou demonstrações contábeis;",
      "f) Manutenção da relação comercial por prazo superior a 30 dias após o recebimento deste contrato.",
    ];

    conductsList.forEach((item) => {
      addParagraph(item, 8, 5);
    });

    yPos += 5;

    // FUNDAMENTAÇÃO LEGAL DA DISPENSA DE ASSINATURA
    addSectionTitle("FUNDAMENTAÇÃO LEGAL - DISPENSA DE ASSINATURA", primaryColor);

    addParagraph("CÓDIGO CIVIL BRASILEIRO (Lei nº 10.406/2002):", 9, 0);
    doc.setFont("helvetica", "italic");
    addParagraph("Art. 107 - \"A validade da declaração de vontade não dependerá de forma especial, senão quando a lei expressamente a exigir.\"", 8, 5);
    addParagraph("Art. 111 - \"O silêncio importa anuência, quando as circunstâncias ou os usos o autorizarem, e não for necessária a declaração de vontade expressa.\"", 8, 5);

    yPos += 3;
    doc.setFont("helvetica", "normal");
    addParagraph("JURISPRUDÊNCIA CONSOLIDADA DO SUPERIOR TRIBUNAL DE JUSTIÇA:", 9, 0);

    doc.setFont("helvetica", "italic");
    addParagraph("\"O comportamento concludente das partes na execução do contrato supre a ausência de assinatura, configurando manifestação tácita de vontade válida e eficaz.\" (REsp 1.989.740/SP, Rel. Min. Nancy Andrighi, 3ª Turma, j. 2022)", 8, 5);

    addParagraph("\"A prática reiterada de atos contratuais, como pagamentos e utilização de serviços, demonstra inequívoca anuência aos termos pactuados, dispensando formalidade de assinatura.\" (AgInt no AREsp 1.742.341/SP, Rel. Min. Marco Buzzi, 4ª Turma, j. 2021)", 8, 5);

    addParagraph("\"O contrato de adesão celebrado de forma tácita, mediante conduta concludente das partes, produz todos os efeitos jurídicos inerentes aos contratos formalizados por instrumento escrito.\" (REsp 1.341.135/SP, Rel. Min. Sidnei Beneti)", 8, 5);

    yPos += 5;
    doc.setFont("helvetica", "normal");

    // CLÁUSULA DÉCIMA TERCEIRA - RESPONSABILIDADE SOLIDÁRIA DOS SÓCIOS
    if (partners && partners.length > 0) {
      addSectionTitle("CLÁUSULA DÉCIMA TERCEIRA - DOS DEVEDORES SOLIDÁRIOS", redColor);

      // Construir lista de sócios
      const sociosTexto = partners.map(p => {
        const cpfFormatado = p.cpf ? `, CPF ${p.cpf}` : "";
        const qualificacao = p.partner_type || "sócio";
        return `${p.name}${cpfFormatado} (${qualificacao})`;
      }).join("; ");

      addParagraph("13.1. A pessoa jurídica CONTRATANTE, neste ato representada pelos seus sócios abaixo qualificados, os quais assumem a condição de DEVEDORES SOLIDÁRIOS de todas as obrigações decorrentes do presente contrato:", 9, 0);

      yPos += 2;
      partners.forEach((partner, index) => {
        const cpfFormatado = partner.cpf || "CPF não informado";
        const qualificacao = partner.partner_type || "Sócio";
        const percentual = partner.percentage ? ` (${partner.percentage}%)` : "";
        addParagraph(`${String.fromCharCode(97 + index)}) ${partner.name}, ${cpfFormatado}, ${qualificacao}${percentual};`, 8, 5);
      });

      yPos += 3;
      addParagraph("13.2. Os sócios acima qualificados, neste ato e na melhor forma de direito, declaram-se DEVEDORES SOLIDÁRIOS da pessoa jurídica CONTRATANTE, responsabilizando-se pessoalmente, com seus bens presentes e futuros, pelo integral cumprimento de todas as obrigações pecuniárias assumidas neste contrato, nos termos do art. 264 e seguintes do Código Civil Brasileiro.", 9, 0);

      addParagraph("13.3. A responsabilidade solidária dos sócios abrange, mas não se limita a:", 9, 0);

      const responsabilidades = [
        "a) Pagamento integral dos honorários mensais, acrescidos de multa e juros de mora em caso de atraso;",
        "b) Pagamento do 13º honorário (honorário adicional de dezembro);",
        "c) Honorários por serviços extraordinários previamente aprovados;",
        "d) Multa rescisória prevista neste contrato;",
        "e) Custas, despesas processuais e honorários advocatícios em eventual cobrança judicial.",
      ];

      responsabilidades.forEach((item) => {
        addParagraph(item, 8, 5);
      });

      addParagraph("13.4. Os devedores solidários RENUNCIAM EXPRESSAMENTE ao benefício de ordem previsto no art. 827 do Código Civil, podendo a CONTRATADA exigir a dívida de qualquer um deles, no todo ou em parte, independentemente de prévia execução dos bens da pessoa jurídica CONTRATANTE.", 9, 0);

      addParagraph("13.5. A presente garantia solidária é prestada de forma irrevogável e irretratável, permanecendo em vigor enquanto existirem obrigações pendentes decorrentes deste contrato, inclusive após eventual rescisão.", 9, 0);

      // CLÁUSULA DÉCIMA QUARTA - FORO
      addClause("CLÁUSULA DÉCIMA QUARTA", "DO FORO", [
        `14.1. As partes elegem o foro da Comarca de ${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"} para dirimir quaisquer dúvidas ou controvérsias decorrentes do presente contrato, renunciando a qualquer outro, por mais privilegiado que seja.`,
        "14.2. As partes poderão, de comum acordo, optar pela arbitragem para solução de conflitos, nos termos da Lei 9.307/1996.",
      ]);

      // CLÁUSULA DÉCIMA QUINTA - DISPOSIÇÕES GERAIS
      addClause("CLÁUSULA DÉCIMA QUINTA", "DAS DISPOSIÇÕES GERAIS", [
        "15.1. Este contrato representa o acordo integral entre as partes, substituindo quaisquer tratativas ou acordos anteriores, verbais ou escritos.",
        "15.2. A tolerância de qualquer das partes quanto ao descumprimento de cláusulas contratuais não implica novação ou renúncia ao direito de exigir o cumprimento.",
        "15.3. As alterações contratuais somente serão válidas se formalizadas por aditivo escrito, assinado ou aceito tacitamente por ambas as partes.",
        "15.4. Este contrato obriga as partes, seus sócios devedores solidários e seus eventuais sucessores a qualquer título.",
        "15.5. Se qualquer cláusula deste contrato for considerada inválida ou inexequível, as demais permanecerão em pleno vigor e efeito.",
      ]);
    } else {
      // Sem sócios cadastrados - manter numeração original
      // CLÁUSULA DÉCIMA TERCEIRA - FORO
      addClause("CLÁUSULA DÉCIMA TERCEIRA", "DO FORO", [
        `13.1. As partes elegem o foro da Comarca de ${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"} para dirimir quaisquer dúvidas ou controvérsias decorrentes do presente contrato, renunciando a qualquer outro, por mais privilegiado que seja.`,
        "13.2. As partes poderão, de comum acordo, optar pela arbitragem para solução de conflitos, nos termos da Lei 9.307/1996.",
      ]);

      // CLÁUSULA DÉCIMA QUARTA - DISPOSIÇÕES GERAIS
      addClause("CLÁUSULA DÉCIMA QUARTA", "DAS DISPOSIÇÕES GERAIS", [
        "14.1. Este contrato representa o acordo integral entre as partes, substituindo quaisquer tratativas ou acordos anteriores, verbais ou escritos.",
        "14.2. A tolerância de qualquer das partes quanto ao descumprimento de cláusulas contratuais não implica novação ou renúncia ao direito de exigir o cumprimento.",
        "14.3. As alterações contratuais somente serão válidas se formalizadas por aditivo escrito, assinado ou aceito tacitamente por ambas as partes.",
        "14.4. Este contrato obriga as partes e seus eventuais sucessores a qualquer título.",
        "14.5. Se qualquer cláusula deste contrato for considerada inválida ou inexequível, as demais permanecerão em pleno vigor e efeito.",
      ]);
    }

    yPos += 10;

    // Box final de assinatura dispensada
    checkNewPage(50);
    doc.setFillColor(220, 252, 231); // Verde claro
    doc.setDrawColor(greenColor[0], greenColor[1], greenColor[2]);
    doc.setLineWidth(1.5);
    doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, "FD");

    doc.setTextColor(greenColor[0], greenColor[1], greenColor[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("*** ASSINATURA DISPENSADA ***", pageWidth / 2, yPos + 10, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Contrato válido pelo aceite tácito, conforme Arts. 107 e 111 do Código Civil", pageWidth / 2, yPos + 18, { align: "center" });
    doc.text("e jurisprudência consolidada do Superior Tribunal de Justiça.", pageWidth / 2, yPos + 23, { align: "center" });

    doc.setFontSize(8);
    doc.text("A utilização dos serviços, envio de documentos ou pagamento de honorários constitui", pageWidth / 2, yPos + 29, { align: "center" });
    doc.text("manifestação inequívoca de aceitação integral de todas as cláusulas deste contrato.", pageWidth / 2, yPos + 33, { align: "center" });

    yPos += 45;

    // Data e local
    checkNewPage();
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`${officeData.cidade || "Goiânia"}, ${dataAtual}.`, pageWidth / 2, yPos, { align: "center" });

    // Footer final
    addFooter();

    // Salvar PDF
    doc.save(`Contrato_${contract.contract_number}_${contract.clients?.name?.replace(/\s+/g, "_") || "cliente"}.pdf`);

    toast({
      title: "PDF gerado com sucesso!",
      description: `Contrato completo ${contract.contract_number} exportado em PDF (${currentPage} páginas).`,
    });
  };

  // Gerar documento Word moderno e sofisticado
  const generateModernWord = async (contract: Contract) => {
    // Buscar sócios do cliente
    const partners = await fetchClientPartners(contract.client_id);

    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const honorarios = `R$ ${Number(contract.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    // Construir seção de devedores solidários
    const buildPartnersSection = (): Paragraph[] => {
      if (!partners || partners.length === 0) return [];

      const paragraphs: Paragraph[] = [];

      // Título da seção
      paragraphs.push(
        new Paragraph({
          spacing: { before: 400, after: 200 },
          shading: {
            fill: "991B1B",
            type: ShadingType.SOLID,
          },
          children: [
            new TextRun({
              text: "CLÁUSULA DÉCIMA TERCEIRA - DOS DEVEDORES SOLIDÁRIOS",
              bold: true,
              size: 22,
              color: "FFFFFF",
            }),
          ],
        })
      );

      // Introdução
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "13.1. A pessoa jurídica CONTRATANTE, neste ato representada pelos seus sócios abaixo qualificados, os quais assumem a condição de DEVEDORES SOLIDÁRIOS de todas as obrigações decorrentes do presente contrato:",
              size: 20,
              color: "111827",
            }),
          ],
          spacing: { after: 100 },
        })
      );

      // Lista de sócios
      partners.forEach((partner, index) => {
        const cpfFormatado = partner.cpf || "CPF não informado";
        const qualificacao = partner.partner_type || "Sócio";
        const percentual = partner.percentage ? ` (${partner.percentage}%)` : "";
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${String.fromCharCode(97 + index)}) ${partner.name}, ${cpfFormatado}, ${qualificacao}${percentual};`,
                size: 18,
                color: "1F2937",
              }),
            ],
            spacing: { after: 60 },
          })
        );
      });

      // Cláusula 13.2
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "13.2. Os sócios acima qualificados, neste ato e na melhor forma de direito, declaram-se DEVEDORES SOLIDÁRIOS da pessoa jurídica CONTRATANTE, responsabilizando-se pessoalmente, com seus bens presentes e futuros, pelo integral cumprimento de todas as obrigações pecuniárias assumidas neste contrato, nos termos do art. 264 e seguintes do Código Civil Brasileiro.",
              size: 20,
              color: "111827",
            }),
          ],
          spacing: { before: 100, after: 100 },
        })
      );

      // Cláusula 13.3
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "13.3. A responsabilidade solidária dos sócios abrange, mas não se limita a:",
              size: 20,
              color: "111827",
            }),
          ],
          spacing: { after: 60 },
        })
      );

      const responsabilidades = [
        "a) Pagamento integral dos honorários mensais, acrescidos de multa e juros de mora em caso de atraso;",
        "b) Pagamento do 13º honorário (honorário adicional de dezembro);",
        "c) Honorários por serviços extraordinários previamente aprovados;",
        "d) Multa rescisória prevista neste contrato;",
        "e) Custas, despesas processuais e honorários advocatícios em eventual cobrança judicial.",
      ];

      responsabilidades.forEach((item) => {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: item, size: 18, color: "1F2937" })],
            spacing: { after: 40 },
          })
        );
      });

      // Cláusula 13.4
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "13.4. Os devedores solidários RENUNCIAM EXPRESSAMENTE ao benefício de ordem previsto no art. 827 do Código Civil, podendo a CONTRATADA exigir a dívida de qualquer um deles, no todo ou em parte, independentemente de prévia execução dos bens da pessoa jurídica CONTRATANTE.",
              size: 20,
              color: "111827",
            }),
          ],
          spacing: { before: 100, after: 100 },
        })
      );

      // Cláusula 13.5
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "13.5. A presente garantia solidária é prestada de forma irrevogável e irretratável, permanecendo em vigor enquanto existirem obrigações pendentes decorrentes deste contrato, inclusive após eventual rescisão.",
              size: 20,
              color: "111827",
            }),
          ],
          spacing: { after: 200 },
        })
      );

      return paragraphs;
    };

    const doc = new Document({
      styles: {
        default: {
          heading1: {
            run: {
              size: 32,
              bold: true,
              color: "581C87",
            },
            paragraph: {
              spacing: { after: 200 },
              alignment: AlignmentType.CENTER,
            },
          },
          heading2: {
            run: {
              size: 24,
              bold: true,
              color: "3B82F6",
            },
            paragraph: {
              spacing: { before: 300, after: 120 },
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: officeData.razao_social,
                      bold: true,
                      size: 20,
                      color: "581C87",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  border: {
                    bottom: {
                      color: "9333EA",
                      size: 12,
                      style: BorderStyle.SINGLE,
                    },
                  },
                  spacing: { after: 200 },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${officeData.razao_social} - CNPJ: ${officeData.cnpj} | `,
                      size: 16,
                      color: "6B7280",
                    }),
                    new TextRun({
                      text: "Página ",
                      size: 16,
                      color: "6B7280",
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 16,
                      color: "6B7280",
                    }),
                    new TextRun({
                      text: " de ",
                      size: 16,
                      color: "6B7280",
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 16,
                      color: "6B7280",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  border: {
                    top: {
                      color: "E5E7EB",
                      size: 6,
                      style: BorderStyle.SINGLE,
                    },
                  },
                  spacing: { before: 200 },
                }),
              ],
            }),
          },
          children: [
            // Título Principal
            new Paragraph({
              children: [
                new TextRun({
                  text: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS",
                  bold: true,
                  size: 32,
                  color: "1E1B4B",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "MODALIDADE: ADESÃO COM ACEITE TÁCITO",
                  size: 24,
                  bold: true,
                  color: "4C1D95",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Conforme Resolução CFC nº 1.590/2020 (atualizada pela Res. 1.703/2023)",
                  size: 20,
                  italics: true,
                  color: "374151",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }),

            // Box do Número do Contrato
            new Paragraph({
              children: [
                new TextRun({
                  text: `CONTRATO Nº ${contract.contract_number}`,
                  bold: true,
                  size: 26,
                  color: "1F2937",
                }),
              ],
              alignment: AlignmentType.CENTER,
              shading: {
                fill: "F3F4F6",
                type: ShadingType.SOLID,
              },
              spacing: { before: 200, after: 300 },
            }),

            // Seção CONTRATADA
            new Paragraph({
              text: "CONTRATADA (PRESTADORA DE SERVIÇOS)",
              heading: HeadingLevel.HEADING_2,
              shading: {
                fill: "581C87",
                type: ShadingType.SOLID,
              },
              spacing: { before: 300, after: 200 },
              children: [
                new TextRun({
                  text: "CONTRATADA (PRESTADORA DE SERVIÇOS)",
                  bold: true,
                  size: 22,
                  color: "FFFFFF",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Razão Social: ", bold: true, size: 22, color: "1F2937" }),
                new TextRun({ text: officeData.razao_social, size: 22, color: "111827" }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "CNPJ: ", bold: true, size: 22, color: "1F2937" }),
                new TextRun({ text: officeData.cnpj, size: 22, color: "111827" }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "CRC: ", bold: true, size: 22, color: "1F2937" }),
                new TextRun({ text: `CRC/${officeData.crc_state || "GO"} ${officeData.crc_number || ""}`, size: 22, color: "111827" }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Responsável Técnico: ", bold: true, size: 22, color: "1F2937" }),
                new TextRun({ text: `${officeData.responsavel_tecnico || ""} - ${officeData.responsavel_crc || ""}`, size: 22, color: "111827" }),
              ],
              spacing: { after: 200 },
            }),

            // Seção CONTRATANTE
            new Paragraph({
              shading: {
                fill: "1E40AF",
                type: ShadingType.SOLID,
              },
              spacing: { before: 300, after: 200 },
              children: [
                new TextRun({
                  text: "CONTRATANTE (TOMADOR DE SERVIÇOS)",
                  bold: true,
                  size: 22,
                  color: "FFFFFF",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Razão Social: ", bold: true, size: 22, color: "1F2937" }),
                new TextRun({ text: contract.clients?.name || "", size: 22, color: "111827" }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "CNPJ: ", bold: true, size: 22, color: "1F2937" }),
                new TextRun({ text: contract.clients?.cnpj || "", size: 22, color: "111827" }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "E-mail: ", bold: true, size: 22, color: "1F2937" }),
                new TextRun({ text: contract.clients?.email || "Não informado", size: 22, color: "111827" }),
              ],
              spacing: { after: 300 },
            }),

            // Tabela de Dados Financeiros
            new DocxTable({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              rows: [
                new DocxTableRow({
                  children: [
                    new DocxTableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "DADOS FINANCEIROS DO CONTRATO", bold: true, size: 24, color: "1E1B4B" })],
                        alignment: AlignmentType.CENTER,
                      })],
                      columnSpan: 2,
                      shading: { fill: "E5E7EB", type: ShadingType.SOLID },
                    }),
                  ],
                }),
                new DocxTableRow({
                  children: [
                    new DocxTableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Honorários Mensais", bold: true, size: 20, color: "374151" }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: honorarios, size: 28, bold: true, color: "047857" }),
                          ],
                        }),
                      ],
                      width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                    new DocxTableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Tipo de Contrato", bold: true, size: 20, color: "374151" }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: getContractTypeLabel(contract.contract_type), size: 22, color: "111827" }),
                          ],
                        }),
                      ],
                      width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                new DocxTableRow({
                  children: [
                    new DocxTableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Data de Início", bold: true, size: 20, color: "374151" }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: new Date(contract.start_date).toLocaleDateString("pt-BR"), size: 22, color: "111827" }),
                          ],
                        }),
                      ],
                    }),
                    new DocxTableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Status", bold: true, size: 20, color: "374151" }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Ativo por Aceite Tácito", size: 22, bold: true, color: "047857" }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            // Embasamento Legal
            new Paragraph({
              spacing: { before: 400, after: 200 },
              shading: {
                fill: "581C87",
                type: ShadingType.SOLID,
              },
              children: [
                new TextRun({
                  text: "EMBASAMENTO LEGAL",
                  bold: true,
                  size: 22,
                  color: "FFFFFF",
                }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Resolução CFC nº 1.590/2020 - Contrato de Prestação de Serviços Contábeis", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Resolução CFC nº 1.703/2023 - Revogou o art. 12 da Res. 1.590/2020", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Resolução CFC nº 1.721/2024 - Comunicação ao COAF (prazo 24h)", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• NBC PG 01 - Código de Ética Profissional do Contador", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Lei nº 10.406/2002 - Código Civil Brasileiro (Arts. 107, 111, 593-609)", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Lei nº 8.078/1990 - Código de Defesa do Consumidor (Art. 54)", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Lei nº 9.613/1998 - Prevenção à Lavagem de Dinheiro (COAF)", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Lei nº 13.709/2018 - Lei Geral de Proteção de Dados (LGPD)", size: 20, color: "1F2937" })],
              spacing: { after: 200 },
            }),

            // Cláusula de Aceite Tácito
            new Paragraph({
              spacing: { before: 300, after: 200 },
              shading: {
                fill: "1E40AF",
                type: ShadingType.SOLID,
              },
              children: [
                new TextRun({
                  text: "CLÁUSULA DE ACEITE TÁCITO",
                  bold: true,
                  size: 22,
                  color: "FFFFFF",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Este contrato é celebrado na modalidade de CONTRATO DE ADESÃO, conforme Art. 54 do CDC e Art. 111 do Código Civil. A CONTRATANTE manifesta sua aceitação integral através de comportamento concludente, incluindo:",
                  size: 20,
                  color: "111827",
                }),
              ],
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Utilização de qualquer serviço prestado pela CONTRATADA", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Envio de documentos fiscais, contábeis ou trabalhistas", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Pagamento, total ou parcial, de honorários contábeis", size: 20, color: "1F2937" })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Fornecimento de procuração ou senha de acesso a sistemas governamentais", size: 20, color: "1F2937" })],
              spacing: { after: 200 },
            }),

            // Seção de Devedores Solidários (sócios)
            ...buildPartnersSection(),

            // Dispensa de Assinatura - Fundamentação Legal
            new Paragraph({
              spacing: { before: 400, after: 200 },
              shading: {
                fill: "047857",
                type: ShadingType.SOLID,
              },
              children: [
                new TextRun({
                  text: "DISPENSA DE ASSINATURA - FUNDAMENTAÇÃO LEGAL",
                  bold: true,
                  size: 22,
                  color: "FFFFFF",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "CÓDIGO CIVIL BRASILEIRO - Lei nº 10.406/2002",
                  bold: true,
                  size: 20,
                  color: "111827",
                }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Art. 107 - ",
                  bold: true,
                  size: 18,
                  color: "1F2937",
                }),
                new TextRun({
                  text: "\"A validade da declaração de vontade não dependerá de forma especial, senão quando a lei expressamente a exigir.\"",
                  size: 18,
                  italics: true,
                  color: "374151",
                }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Art. 111 - ",
                  bold: true,
                  size: 18,
                  color: "1F2937",
                }),
                new TextRun({
                  text: "\"O silêncio importa anuência, quando as circunstâncias ou os usos o autorizarem, e não for necessária a declaração de vontade expressa.\"",
                  size: 18,
                  italics: true,
                  color: "374151",
                }),
              ],
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "JURISPRUDÊNCIA DO STJ",
                  bold: true,
                  size: 20,
                  color: "111827",
                }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "REsp 1.989.740/SP (2022): ",
                  bold: true,
                  size: 18,
                  color: "1F2937",
                }),
                new TextRun({
                  text: "\"O comportamento concludente das partes na execução do contrato supre a ausência de assinatura, configurando manifestação tácita de vontade.\"",
                  size: 18,
                  italics: true,
                  color: "374151",
                }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "AgInt no AREsp 1.742.341/SP (2021): ",
                  bold: true,
                  size: 18,
                  color: "1F2937",
                }),
                new TextRun({
                  text: "\"A prática reiterada de atos contratuais, como pagamentos e utilização de serviços, demonstra inequívoca anuência aos termos pactuados.\"",
                  size: 18,
                  italics: true,
                  color: "374151",
                }),
              ],
              spacing: { after: 200 },
            }),

            // Nota de Validade Final
            new Paragraph({
              shading: {
                fill: "D1FAE5",
                type: ShadingType.SOLID,
              },
              border: {
                top: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                bottom: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                left: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                right: { color: "047857", size: 12, style: BorderStyle.SINGLE },
              },
              spacing: { before: 200, after: 100 },
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "*** ASSINATURA DISPENSADA ***",
                  bold: true,
                  size: 24,
                  color: "065F46",
                }),
              ],
            }),
            new Paragraph({
              shading: {
                fill: "D1FAE5",
                type: ShadingType.SOLID,
              },
              border: {
                bottom: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                left: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                right: { color: "047857", size: 12, style: BorderStyle.SINGLE },
              },
              spacing: { after: 200 },
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Contrato válido pelo aceite tácito, conforme fundamentação legal acima.",
                  size: 20,
                  color: "065F46",
                }),
              ],
            }),
            new Paragraph({
              shading: {
                fill: "D1FAE5",
                type: ShadingType.SOLID,
              },
              border: {
                bottom: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                left: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                right: { color: "047857", size: 12, style: BorderStyle.SINGLE },
              },
              spacing: { after: 200 },
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "A utilização dos serviços, envio de documentos ou pagamento de honorários",
                  size: 18,
                  color: "065F46",
                }),
              ],
            }),
            new Paragraph({
              shading: {
                fill: "D1FAE5",
                type: ShadingType.SOLID,
              },
              border: {
                bottom: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                left: { color: "047857", size: 12, style: BorderStyle.SINGLE },
                right: { color: "047857", size: 12, style: BorderStyle.SINGLE },
              },
              spacing: { after: 200 },
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "constitui manifestação inequívoca de aceitação integral deste contrato.",
                  size: 18,
                  color: "065F46",
                }),
              ],
            }),

            // Data de Geração
            new Paragraph({
              spacing: { before: 400 },
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${officeData.cidade || "Goiânia"}, ${formattedDate}`,
                  size: 22,
                  italics: true,
                  color: "1F2937",
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Contrato_${contract.contract_number}_${contract.clients?.name?.replace(/\s+/g, "_") || "cliente"}.docx`);

    toast({
      title: "Word gerado com sucesso!",
      description: `Contrato ${contract.contract_number} exportado em Word.`,
    });
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      contract_type: "full_accounting",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      monthly_fee: "",
      payment_day: "10",
      payment_method: "boleto",
      adjustment_index: "IGPM",
      special_clauses: "",
    });
    setSelectedClient(null);
    setContractPreview("");
  };

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      full_accounting: "Contabilidade Completa",
      payroll: "Departamento Pessoal",
      tax: "Fiscal/Tributário",
      consulting: "Consultoria",
      service: "Serviços Gerais",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      draft: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Rascunho</Badge>,
      pending_signature: <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Aguardando</Badge>,
      active: <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>,
      suspended: <Badge className="bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3 mr-1" />Suspenso</Badge>,
      terminated: <Badge variant="destructive">Rescindido</Badge>,
      cancelled: <Badge variant="secondary">Cancelado</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  const filteredContracts = contracts.filter(c => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return c.status === "active";
    if (activeTab === "terminated") return c.status === "terminated" || c.status === "cancelled";
    return true;
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
                  Contratos de Prestação de Serviços
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Modalidade Adesão com Aceite Tácito - Resolução CFC 1.590/2020
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={openBatchDialog}>
                  <Users className="w-4 h-4 mr-2" />
                  Gerar em Lote
                </Button>
                <Button onClick={() => setShowNewContract(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Contrato
                </Button>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <Scale className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">Contrato de Adesão com Aceite Tácito</h4>
                  <p className="text-sm text-blue-800">
                    Conforme Art. 107 e 111 do Código Civil e jurisprudência do STJ, o contrato é válido
                    quando o comportamento das partes demonstra aceitação (uso do serviço, pagamento, envio de documentos).
                    Dispensa assinatura física ou digital.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{contracts.length}</div>
                  <p className="text-xs text-muted-foreground">Total de Contratos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {contracts.filter(c => c.status === "active").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    R$ {contracts
                      .filter(c => c.status === "active")
                      .reduce((sum, c) => sum + Number(c.monthly_fee), 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">Receita Mensal</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">
                    {contracts.filter(c => c.status === "terminated" || c.status === "cancelled").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Rescindidos</p>
                </CardContent>
              </Card>
            </div>

            {/* Contracts Table */}
            <Card>
              <CardHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="active">Ativos</TabsTrigger>
                    <TabsTrigger value="terminated">Rescindidos</TabsTrigger>
                    <TabsTrigger value="collection" className="text-orange-600">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Cobranças
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {filteredContracts.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      Nenhum contrato cadastrado
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Crie contratos de prestação de serviços para seus clientes
                    </p>
                    <Button onClick={() => setShowNewContract(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Contrato
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Contrato</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Valor Mensal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-mono text-sm">
                            {contract.contract_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {contract.clients?.name}
                          </TableCell>
                          <TableCell>
                            {getContractTypeLabel(contract.contract_type)}
                          </TableCell>
                          <TableCell>
                            {new Date(contract.start_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            R$ {Number(contract.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>{getStatusBadge(contract.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => {
                                  const client = clients.find(c => c.id === contract.client_id);
                                  if (client) {
                                    setSelectedClient(client);
                                    setFormData({
                                      ...formData,
                                      client_id: client.id,
                                      contract_type: contract.contract_type,
                                      monthly_fee: String(contract.monthly_fee),
                                      start_date: contract.start_date,
                                    });
                                    // Passa o cliente diretamente para evitar problema de setState assíncrono
                                    const preview = generateContractContent(contract.contract_type, client, contract.monthly_fee);
                                    setContractPreview(preview);
                                    setShowPreview(true);
                                  }
                                }}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => generateModernPDF(contract)}>
                                  <FileDown className="mr-2 h-4 w-4 text-red-600" />
                                  Baixar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => generateModernWord(contract)}>
                                  <FileType className="mr-2 h-4 w-4 text-blue-600" />
                                  Baixar Word
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  if (contract.clients?.email) {
                                    toast({
                                      title: "Enviar por E-mail",
                                      description: `Será enviado para: ${contract.clients.email}`,
                                    });
                                  } else {
                                    toast({
                                      title: "E-mail não disponível",
                                      description: "O cliente não possui e-mail cadastrado.",
                                      variant: "destructive",
                                    });
                                  }
                                }}>
                                  <Send className="mr-2 h-4 w-4" />
                                  Enviar por E-mail
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const client = clients.find(c => c.id === contract.client_id);
                                  if (client) {
                                    // Passa o cliente diretamente para evitar problema de setState assíncrono
                                    const content = generateContractContent(contract.contract_type, client, contract.monthly_fee);
                                    navigator.clipboard.writeText(content);
                                    toast({
                                      title: "Contrato copiado",
                                      description: "O texto do contrato foi copiado para a área de transferência.",
                                    });
                                  }
                                }}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar Texto
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenCollection(contract)}
                                  className="text-orange-600"
                                >
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  Notificar Cobrança
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

            {/* New Contract Dialog */}
            <Dialog open={showNewContract} onOpenChange={setShowNewContract}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Contrato de Prestação de Serviços</DialogTitle>
                  <DialogDescription>
                    Contrato de adesão com aceite tácito conforme Resolução CFC 1.590/2020
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="client">Cliente *</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={handleClientChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contract_type">Tipo de Contrato *</Label>
                      <Select
                        value={formData.contract_type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, contract_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_accounting">Contabilidade Completa</SelectItem>
                          <SelectItem value="payroll">Departamento Pessoal</SelectItem>
                          <SelectItem value="tax">Fiscal/Tributário</SelectItem>
                          <SelectItem value="consulting">Consultoria</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Data de Início *</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({ ...formData, start_date: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="monthly_fee">Honorários Mensais (R$) *</Label>
                      <Input
                        id="monthly_fee"
                        type="number"
                        step="0.01"
                        value={formData.monthly_fee}
                        onChange={(e) =>
                          setFormData({ ...formData, monthly_fee: e.target.value })
                        }
                        placeholder="0,00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment_day">Dia do Vencimento</Label>
                      <Input
                        id="payment_day"
                        type="number"
                        min="1"
                        max="31"
                        value={formData.payment_day}
                        onChange={(e) =>
                          setFormData({ ...formData, payment_day: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_method">Forma de Pagamento</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) =>
                          setFormData({ ...formData, payment_method: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="boleto">Boleto Bancário</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="transfer">Transferência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adjustment_index">Índice de Reajuste</Label>
                      <Select
                        value={formData.adjustment_index}
                        onValueChange={(value) =>
                          setFormData({ ...formData, adjustment_index: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IGPM">IGPM/FGV</SelectItem>
                          <SelectItem value="IPCA">IPCA/IBGE</SelectItem>
                          <SelectItem value="INPC">INPC/IBGE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedClient && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">
                        Dados do Cliente
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                        <p><strong>CNPJ:</strong> {selectedClient.cnpj}</p>
                        <p><strong>E-mail:</strong> {selectedClient.email || "Não informado"}</p>
                        <p><strong>Telefone:</strong> {selectedClient.phone || "Não informado"}</p>
                        <p><strong>Cidade:</strong> {selectedClient.municipio || "Não informado"}/{selectedClient.uf || ""}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Cláusulas Especiais (opcional)</Label>
                    <Textarea
                      value={formData.special_clauses}
                      onChange={(e) => setFormData({ ...formData, special_clauses: e.target.value })}
                      placeholder="Adicione cláusulas especiais se necessário..."
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewContract(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button variant="outline" onClick={handlePreview}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={handleSaveContract}>Gerar Contrato</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Batch Generation Dialog */}
            <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Geração de Contratos em Lote
                  </DialogTitle>
                  <DialogDescription>
                    Selecione os clientes para gerar contratos automaticamente. Apenas clientes ativos, não pro-bono e com honorários cadastrados.
                  </DialogDescription>
                </DialogHeader>

                {isGeneratingBatch ? (
                  <div className="py-8 space-y-6">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold">Gerando Contratos...</h3>
                      <p className="text-muted-foreground">
                        Processando {batchProgress} de {batchTotal} clientes
                      </p>
                    </div>
                    <Progress value={(batchProgress / batchTotal) * 100} className="h-3" />
                    {generatedContracts.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-2">
                          ✓ Contratos Gerados ({generatedContracts.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {generatedContracts.map((num) => (
                            <Badge key={num} className="bg-green-100 text-green-800">
                              {num}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Alertas para clientes sem honorários */}
                    {clientsWithWarnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-amber-900 mb-2">
                              Clientes sem Honorários Cadastrados ({clientsWithWarnings.length})
                            </h4>
                            <p className="text-sm text-amber-800 mb-3">
                              Os seguintes clientes ativos não possuem valor de honorários e não podem ter contratos gerados automaticamente:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {clientsWithWarnings.slice(0, 10).map((client) => (
                                <Badge key={client.id} variant="outline" className="border-amber-400 text-amber-800">
                                  {client.name}
                                </Badge>
                              ))}
                              {clientsWithWarnings.length > 10 && (
                                <Badge variant="outline" className="border-amber-400 text-amber-800">
                                  +{clientsWithWarnings.length - 10} mais
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sumário de seleção */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="pt-4 pb-3">
                          <div className="text-2xl font-bold text-blue-700">
                            {eligibleClients.length}
                          </div>
                          <p className="text-xs text-blue-600">Elegíveis</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="pt-4 pb-3">
                          <div className="text-2xl font-bold text-green-700">
                            {eligibleClients.filter(c => c.selected && !c.hasContract).length}
                          </div>
                          <p className="text-xs text-green-600">Selecionados</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="pt-4 pb-3">
                          <div className="text-2xl font-bold text-purple-700">
                            {eligibleClients.filter(c => c.hasContract).length}
                          </div>
                          <p className="text-xs text-purple-600">Já com Contrato</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                        <CardContent className="pt-4 pb-3">
                          <div className="text-2xl font-bold text-amber-700">
                            {clientsWithWarnings.length}
                          </div>
                          <p className="text-xs text-amber-600">Sem Honorários</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tabela de clientes elegíveis */}
                    {eligibleClients.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Nenhum cliente elegível</h3>
                        <p className="text-muted-foreground">
                          Não há clientes ativos com honorários cadastrados para gerar contratos.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[350px] border rounded-lg">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead className="w-12">
                                <Checkbox
                                  checked={eligibleClients.filter(c => !c.hasContract).every(c => c.selected)}
                                  onCheckedChange={toggleSelectAll}
                                />
                              </TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>CNPJ</TableHead>
                              <TableHead>Honorários</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eligibleClients.map((client) => (
                              <TableRow
                                key={client.id}
                                className={client.hasContract ? "bg-gray-50 opacity-60" : "hover:bg-blue-50"}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={client.selected}
                                    disabled={client.hasContract}
                                    onCheckedChange={() => toggleClientSelection(client.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  {client.name}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {client.cnpj || "—"}
                                </TableCell>
                                <TableCell className="font-semibold text-green-700">
                                  R$ {(client.monthly_fee || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {getContractTypeLabel(client.contract_type || "full_accounting")}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {client.hasContract ? (
                                    <Badge className="bg-purple-100 text-purple-800">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Já possui
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-blue-100 text-blue-800">
                                      <FileText className="w-3 h-3 mr-1" />
                                      Pendente
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </>
                )}

                <DialogFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBatchDialog(false);
                      setGeneratedContracts([]);
                    }}
                    disabled={isGeneratingBatch}
                  >
                    {generatedContracts.length > 0 ? "Fechar" : "Cancelar"}
                  </Button>
                  {!isGeneratingBatch && generatedContracts.length === 0 && (
                    <Button
                      onClick={generateBatchContracts}
                      disabled={eligibleClients.filter(c => c.selected && !c.hasContract).length === 0}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Gerar {eligibleClients.filter(c => c.selected && !c.hasContract).length} Contrato(s)
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogContent className="max-w-5xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Preview do Contrato</DialogTitle>
                  <DialogDescription>
                    Contrato de adesão com aceite tácito - Válido sem assinatura
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[60vh] border rounded-lg bg-white">
                  <div className="p-6">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {contractPreview || "Carregando preview do contrato..."}
                    </pre>
                  </div>
                </ScrollArea>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Fechar
                  </Button>
                  <Button variant="outline" onClick={handleCopyContract}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  <Button onClick={handleSaveContract}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Salvar Contrato
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog de Notificação de Cobrança */}
            <Dialog open={showCollectionDialog} onOpenChange={setShowCollectionDialog}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="w-5 h-5" />
                    Notificação Extrajudicial de Cobrança
                  </DialogTitle>
                  <DialogDescription>
                    Envie uma notificação de cobrança via WhatsApp informando prazo para negociação
                    e consequências da inadimplência (protesto, negativação, execução judicial).
                  </DialogDescription>
                </DialogHeader>

                {selectedDebtorContract && (
                  <div className="space-y-4">
                    {/* Dados do Devedor */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <h4 className="font-semibold text-gray-700">Dados do Devedor</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Empresa:</span>
                          <p className="font-medium">{selectedDebtorContract.clients?.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">CNPJ:</span>
                          <p className="font-medium">{selectedDebtorContract.clients?.cnpj}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Contrato:</span>
                          <p className="font-medium">{selectedDebtorContract.contract_number}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Telefone:</span>
                          <p className="font-medium">{selectedDebtorContract.clients?.phone || "Não cadastrado"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Sócios (Devedores Solidários) */}
                    {debtorPartners.length > 0 && (
                      <div className="bg-orange-50 p-4 rounded-lg space-y-2">
                        <h4 className="font-semibold text-orange-700 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Devedores Solidários (Art. 264 CC)
                        </h4>
                        <div className="text-sm space-y-1">
                          {debtorPartners.map((partner) => (
                            <div key={partner.id} className="flex justify-between">
                              <span>{partner.name}</span>
                              <span className="text-gray-500">
                                {partner.cpf || "CPF não informado"} - {partner.partner_type || "Sócio"}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-orange-600 mt-2">
                          Os sócios acima serão notificados como devedores solidários conforme Cláusula 13ª do contrato.
                        </p>
                      </div>
                    )}

                    {/* Débitos Encontrados no Sistema (Fonte da Verdade) */}
                    {loadingDebts ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-600 mr-2" />
                        <span className="text-gray-600">Buscando débitos no plano de contas...</span>
                      </div>
                    ) : clientDebts.length > 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg space-y-2">
                        <h4 className="font-semibold text-yellow-800 flex items-center gap-2">
                          <Scale className="w-4 h-4" />
                          Débitos Encontrados (Plano de Contas 1.1.2.01)
                        </h4>
                        <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                          {clientDebts.map((debt, idx) => (
                            <div key={idx} className="flex justify-between text-yellow-700">
                              <span>{debt.competence || debt.due_date} - {debt.description}</span>
                              <span className="font-medium">
                                R$ {debt.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-yellow-300 pt-2 mt-2 flex justify-between font-semibold text-yellow-800">
                          <span>Total em aberto:</span>
                          <span>R$ {clientDebts.reduce((s, d) => s + d.amount, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <p className="text-xs text-yellow-600">
                          Valores sem atualização monetária. Juros e correção serão calculados na cobrança.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-center text-gray-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum débito encontrado no plano de contas para este cliente.</p>
                        <p className="text-xs mt-1">Informe manualmente os valores abaixo.</p>
                      </div>
                    )}

                    {/* Configuração da Cobrança */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="debtAmount">Valor do Débito (R$)</Label>
                        <Input
                          id="debtAmount"
                          type="number"
                          placeholder={String(selectedDebtorContract.monthly_fee)}
                          value={debtAmount}
                          onChange={(e) => setDebtAmount(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                          {clientDebts.length > 0
                            ? "Valor preenchido automaticamente com base nos débitos encontrados"
                            : `Se vazio, será usado o valor mensal: R$ ${Number(selectedDebtorContract.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          }
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="debtMonths">Meses em Atraso</Label>
                        <Input
                          id="debtMonths"
                          type="text"
                          placeholder="Ex: 3 meses"
                          value={debtMonths}
                          onChange={(e) => setDebtMonths(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collectionDays">Prazo para Negociação (dias úteis)</Label>
                      <Select value={collectionDays} onValueChange={setCollectionDays}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 dias úteis</SelectItem>
                          <SelectItem value="5">5 dias úteis (Recomendado)</SelectItem>
                          <SelectItem value="7">7 dias úteis</SelectItem>
                          <SelectItem value="10">10 dias úteis</SelectItem>
                          <SelectItem value="15">15 dias úteis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Aviso das Consequências */}
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                      <h4 className="font-semibold text-red-700 mb-2">Consequências Informadas na Notificação:</h4>
                      <ul className="text-sm text-red-600 space-y-1">
                        <li>1. Protesto do título junto aos Cartórios de Protesto</li>
                        <li>2. Negativação nos órgãos de proteção ao crédito (SPC/Serasa)</li>
                        <li>3. Execução judicial contra empresa e sócios (devedores solidários)</li>
                      </ul>
                    </div>

                    {/* Preview da Mensagem */}
                    <div className="space-y-2">
                      <Label>Preview da Mensagem</Label>
                      <ScrollArea className="h-48 border rounded-lg p-3 bg-gray-50">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {generateCollectionMessage()}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                )}

                <DialogFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowCollectionDialog(false)}>
                    Cancelar
                  </Button>
                  <Button variant="outline" onClick={copyCollectionMessage}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Mensagem
                  </Button>
                  <Button
                    onClick={sendWhatsAppCollection}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!selectedDebtorContract?.clients?.phone}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar via WhatsApp
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Contracts;
