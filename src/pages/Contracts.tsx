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
  status: string;
  signature_status: string;
  coaf_clause_accepted: boolean;
  created_at: string;
  clients?: { name: string; cnpj: string; email: string };
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

// Dados padrão do escritório (usado como fallback) - CNPJ CORRETO: 23.893.032/0001-69
const defaultOfficeData: AccountingOffice = {
  id: "",
  razao_social: "AMPLA CONTABILIDADE LTDA",
  nome_fantasia: "Ampla Contabilidade",
  cnpj: "23.893.032/0001-69",
  crc_number: "",
  crc_state: "GO",
  responsavel_tecnico: "Sergio Carneiro Leão",
  responsavel_crc: "",
  responsavel_cpf: null,
  endereco: "",
  numero: "",
  complemento: null,
  bairro: "",
  cidade: "Goiânia",
  estado: "GO",
  cep: "",
  telefone: "",
  celular: null,
  email: "",
  website: "",
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
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [officeData, setOfficeData] = useState<AccountingOffice>(defaultOfficeData);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewContract, setShowNewContract] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [contractPreview, setContractPreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Estados para geração em lote
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [eligibleClients, setEligibleClients] = useState<EligibleClient[]>([]);
  const [clientsWithWarnings, setClientsWithWarnings] = useState<EligibleClient[]>([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [generatedContracts, setGeneratedContracts] = useState<string[]>([]);

  // Form state
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

  useEffect(() => {
    fetchAccountingOffice();
    fetchContracts();
    fetchClients();
  }, [fetchAccountingOffice, fetchContracts, fetchClients]);

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

  // Gerar conteúdo de contrato para um cliente específico
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

    return `
═══════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS
                              MODALIDADE: ADESÃO
                     Conforme Resolução CFC nº 1.590/2020
═══════════════════════════════════════════════════════════════════════════════

CONTRATADA: ${officeData.razao_social}
CNPJ: ${officeData.cnpj}

CONTRATANTE: ${client.name}
CNPJ/CPF: ${client.cnpj || "Não informado"}

HONORÁRIOS MENSAIS: ${monthlyFeeText}
DATA DE INÍCIO: ${formattedDate}

SERVIÇOS CONTRATADOS:
${services.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Este contrato dispensa assinatura física conforme Art. 107 e 111 do Código Civil.
A utilização dos serviços configura aceite tácito.

${officeData.cidade || "Goiânia"}, ${formattedDate}
═══════════════════════════════════════════════════════════════════════════════
`;
  };

  // Abrir dialog de geração em lote
  const openBatchDialog = () => {
    prepareEligibleClients();
    setShowBatchDialog(true);
  };

  // Gera o contrato completo com embasamento jurídico
  const generateContractContent = (type: string): string => {
    const client = selectedClient;
    if (!client) return "";

    const services = contractServices[type as keyof typeof contractServices] || contractServices.service;
    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const monthlyFeeNumber = parseFloat(formData.monthly_fee) || 0;
    const monthlyFeeText = monthlyFeeNumber.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    return `
═══════════════════════════════════════════════════════════════════════════════
                    CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS
                              MODALIDADE: ADESÃO
                     Conforme Resolução CFC nº 1.590/2020
═══════════════════════════════════════════════════════════════════════════════

EMBASAMENTO LEGAL:
• Resolução CFC nº 1.590/2020 - Contrato de Prestação de Serviços Contábeis
• NBC PG 01 - Código de Ética Profissional do Contador
• Lei nº 10.406/2002 - Código Civil Brasileiro (Arts. 107, 111, 593-609, 1.177-1.178)
• Lei nº 8.078/1990 - Código de Defesa do Consumidor (Art. 54)
• Lei nº 9.613/1998 - Prevenção à Lavagem de Dinheiro (COAF)
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
termos da Lei nº 9.613/1998 e Resolução CFC nº 1.530/2017, a comunicar ao
Conselho de Controle de Atividades Financeiras (COAF) operações ou propostas
de operações que possam constituir indícios de lavagem de dinheiro.

9.2. A CONTRATANTE compromete-se a não solicitar à CONTRATADA qualquer ato
que possa caracterizar participação em crime de lavagem de dinheiro.

9.3. A CONTRATANTE autoriza a CONTRATADA a manter registro de todas as
operações realizadas, conforme exigido pela legislação vigente.

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
               CLÁUSULA 11ª - DO SIGILO E CONFIDENCIALIDADE
───────────────────────────────────────────────────────────────────────────────

11.1. As partes comprometem-se a manter sigilo absoluto sobre todas as
informações obtidas em decorrência deste contrato, conforme:
    • NBC PG 01 - Código de Ética Profissional do Contador
    • Lei Geral de Proteção de Dados (Lei 13.709/2018)
    • Código Civil Brasileiro

11.2. A obrigação de sigilo permanece mesmo após o término do contrato.

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 12ª - DAS DISPOSIÇÕES GERAIS
───────────────────────────────────────────────────────────────────────────────

12.1. Este contrato obriga as partes e seus sucessores a qualquer título.

12.2. Alterações neste contrato serão formalizadas por ADITIVO CONTRATUAL.

12.3. A tolerância no descumprimento de qualquer cláusula não implica novação.

12.4. Este contrato substitui quaisquer acordos anteriores, verbais ou escritos.

12.5. Comunicações oficiais serão feitas pelos e-mails cadastrados das partes.

───────────────────────────────────────────────────────────────────────────────
                           CLÁUSULA 13ª - DO FORO
───────────────────────────────────────────────────────────────────────────────

13.1. Fica eleito o foro da comarca de ${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"} para dirimir
quaisquer questões oriundas deste contrato, com renúncia expressa a qualquer
outro, por mais privilegiado que seja.

───────────────────────────────────────────────────────────────────────────────
                     CLÁUSULA 14ª - DA EFICÁCIA DO ACEITE
───────────────────────────────────────────────────────────────────────────────

14.1. Conforme estabelecido na Cláusula 1ª, este contrato entra em vigor
automaticamente quando a CONTRATANTE praticar qualquer ato que configure
aceite tácito (comportamento concludente).

14.2. A utilização dos serviços da CONTRATADA após o recebimento deste
instrumento constitui prova inequívoca da aceitação de todas as suas cláusulas.

14.3. Este documento foi enviado eletronicamente para o e-mail cadastrado da
CONTRATANTE em ${formattedDate}, ficando arquivado nos sistemas da CONTRATADA
como prova de entrega e ciência.

═══════════════════════════════════════════════════════════════════════════════
                              DADOS DO DOCUMENTO
═══════════════════════════════════════════════════════════════════════════════

Data de Elaboração: ${formattedDate}
Responsável: ${officeData.responsavel_tecnico || ""} - ${officeData.responsavel_crc || ""}
Versão: Conforme Resolução CFC 1.590/2020

CONTRATADA: ${officeData.razao_social}
CNPJ: ${officeData.cnpj}
CRC: CRC/${officeData.crc_state} ${officeData.crc_number}

CONTRATANTE: ${client.name}
CNPJ/CPF: ${client.cnpj || "Não informado"}

───────────────────────────────────────────────────────────────────────────────
Este contrato dispensa assinatura física ou digital conforme fundamentação
legal apresentada na Cláusula 1ª. A utilização dos serviços configura aceite.
───────────────────────────────────────────────────────────────────────────────
`;
  };

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

  // Gerar PDF moderno e sofisticado
  const generateModernPDF = (contract: Contract) => {
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

    // Cores do tema
    const primaryColor = [88, 28, 135]; // Purple-800
    const secondaryColor = [147, 51, 234]; // Purple-600
    const accentColor = [59, 130, 246]; // Blue-500
    const darkGray = [31, 41, 55]; // Gray-800
    const lightGray = [229, 231, 235]; // Gray-200

    // Header com gradiente visual
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 45, "F");

    // Linha decorativa
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(0, 45, pageWidth, 3, "F");

    // Título do documento
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("CONTÁBEIS - MODALIDADE ADESÃO", pageWidth / 2, 28, { align: "center" });

    doc.setFontSize(10);
    doc.text("Conforme Resolução CFC nº 1.590/2020", pageWidth / 2, 36, { align: "center" });

    yPos = 58;

    // Número do contrato
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, "F");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`CONTRATO Nº ${contract.contract_number}`, pageWidth / 2, yPos + 8, { align: "center" });

    yPos += 20;

    // Seção CONTRATADA
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRATADA (PRESTADORA DE SERVIÇOS)", margin + 4, yPos + 5.5);

    yPos += 12;
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const contratadaInfo = [
      `Razão Social: ${officeData.razao_social}`,
      `CNPJ: ${officeData.cnpj}`,
      `CRC: CRC/${officeData.crc_state || "GO"} ${officeData.crc_number || ""}`,
      `Endereço: ${officeData.endereco || ""}, ${officeData.numero || "S/N"} - ${officeData.bairro || ""}`,
      `Cidade: ${officeData.cidade || "Goiânia"}/${officeData.estado || "GO"} - CEP: ${officeData.cep || ""}`,
    ];

    contratadaInfo.forEach((info) => {
      doc.text(info, margin + 4, yPos);
      yPos += 5;
    });

    yPos += 5;

    // Seção CONTRATANTE
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRATANTE (TOMADOR DE SERVIÇOS)", margin + 4, yPos + 5.5);

    yPos += 12;
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFont("helvetica", "normal");

    const contratanteInfo = [
      `Razão Social: ${contract.clients?.name || ""}`,
      `CNPJ: ${contract.clients?.cnpj || ""}`,
      `E-mail: ${contract.clients?.email || "Não informado"}`,
    ];

    contratanteInfo.forEach((info) => {
      doc.text(info, margin + 4, yPos);
      yPos += 5;
    });

    yPos += 8;

    // Box de Honorários com destaque
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, "FD");

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS FINANCEIROS", margin + contentWidth / 2, yPos + 6, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

    const honorarios = `R$ ${Number(contract.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    doc.text(`Honorários Mensais: ${honorarios}`, margin + 10, yPos + 14);
    doc.text(`Tipo: ${getContractTypeLabel(contract.contract_type)}`, margin + contentWidth / 2 + 10, yPos + 14);
    doc.text(`Início: ${new Date(contract.start_date).toLocaleDateString("pt-BR")}`, margin + 10, yPos + 20);
    doc.text(`Status: Ativo por Aceite Tácito`, margin + contentWidth / 2 + 10, yPos + 20);

    yPos += 35;

    // Seção de Embasamento Legal
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("EMBASAMENTO LEGAL", margin + 4, yPos + 5.5);

    yPos += 12;
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const legalBasis = [
      "• Resolução CFC nº 1.590/2020 - Contrato de Prestação de Serviços Contábeis",
      "• NBC PG 01 - Código de Ética Profissional do Contador",
      "• Lei nº 10.406/2002 - Código Civil Brasileiro (Arts. 107, 111, 593-609)",
      "• Lei nº 8.078/1990 - Código de Defesa do Consumidor (Art. 54)",
      "• Lei nº 9.613/1998 - Prevenção à Lavagem de Dinheiro (COAF)",
    ];

    legalBasis.forEach((item) => {
      doc.text(item, margin + 4, yPos);
      yPos += 4.5;
    });

    yPos += 8;

    // Cláusula de Aceite Tácito
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("CLÁUSULA DE ACEITE TÁCITO", margin + 4, yPos + 5.5);

    yPos += 12;
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const acceptanceText = [
      "Este contrato é celebrado na modalidade de CONTRATO DE ADESÃO. A CONTRATANTE manifesta",
      "sua aceitação integral através de comportamento concludente, incluindo:",
      "",
      "• Utilização de qualquer serviço prestado pela CONTRATADA",
      "• Envio de documentos fiscais, contábeis ou trabalhistas",
      "• Pagamento, total ou parcial, de honorários contábeis",
      "• Fornecimento de procuração ou senha de acesso a sistemas governamentais",
      "",
      "Conforme Art. 107 e 111 do Código Civil Brasileiro, este contrato dispensa assinatura",
      "física ou digital, sendo válido pelo aceite tácito demonstrado pela conduta das partes.",
    ];

    acceptanceText.forEach((line) => {
      doc.text(line, margin + 4, yPos);
      yPos += 4.5;
    });

    // Footer com data e validação
    const footerY = pageHeight - 25;
    doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, margin, footerY + 6);
    doc.text(`${officeData.razao_social} - CNPJ: ${officeData.cnpj}`, pageWidth / 2, footerY + 6, { align: "center" });
    doc.text("Página 1/1", pageWidth - margin, footerY + 6, { align: "right" });

    doc.setFontSize(7);
    doc.text("Válido sem assinatura conforme Art. 107 e 111 do Código Civil", pageWidth / 2, footerY + 11, { align: "center" });

    // Salvar PDF
    doc.save(`Contrato_${contract.contract_number}_${contract.clients?.name?.replace(/\s+/g, "_") || "cliente"}.pdf`);

    toast({
      title: "PDF gerado com sucesso!",
      description: `Contrato ${contract.contract_number} exportado em PDF.`,
    });
  };

  // Gerar documento Word moderno e sofisticado
  const generateModernWord = async (contract: Contract) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const honorarios = `R$ ${Number(contract.monthly_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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
                  color: "581C87",
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
                  color: "9333EA",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Conforme Resolução CFC nº 1.590/2020",
                  size: 20,
                  italics: true,
                  color: "6B7280",
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
                new TextRun({ text: "Razão Social: ", bold: true, size: 22 }),
                new TextRun({ text: officeData.razao_social, size: 22 }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "CNPJ: ", bold: true, size: 22 }),
                new TextRun({ text: officeData.cnpj, size: 22 }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "CRC: ", bold: true, size: 22 }),
                new TextRun({ text: `CRC/${officeData.crc_state || "GO"} ${officeData.crc_number || ""}`, size: 22 }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Responsável Técnico: ", bold: true, size: 22 }),
                new TextRun({ text: officeData.responsavel_tecnico || "", size: 22 }),
              ],
              spacing: { after: 200 },
            }),

            // Seção CONTRATANTE
            new Paragraph({
              shading: {
                fill: "3B82F6",
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
                new TextRun({ text: "Razão Social: ", bold: true, size: 22 }),
                new TextRun({ text: contract.clients?.name || "", size: 22 }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "CNPJ: ", bold: true, size: 22 }),
                new TextRun({ text: contract.clients?.cnpj || "", size: 22 }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "E-mail: ", bold: true, size: 22 }),
                new TextRun({ text: contract.clients?.email || "Não informado", size: 22 }),
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
                        children: [new TextRun({ text: "DADOS FINANCEIROS DO CONTRATO", bold: true, size: 24, color: "581C87" })],
                        alignment: AlignmentType.CENTER,
                      })],
                      columnSpan: 2,
                      shading: { fill: "F9FAFB", type: ShadingType.SOLID },
                    }),
                  ],
                }),
                new DocxTableRow({
                  children: [
                    new DocxTableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Honorários Mensais", bold: true, size: 20 }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: honorarios, size: 28, bold: true, color: "059669" }),
                          ],
                        }),
                      ],
                      width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                    new DocxTableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Tipo de Contrato", bold: true, size: 20 }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: getContractTypeLabel(contract.contract_type), size: 22 }),
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
                            new TextRun({ text: "Data de Início", bold: true, size: 20 }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: new Date(contract.start_date).toLocaleDateString("pt-BR"), size: 22 }),
                          ],
                        }),
                      ],
                    }),
                    new DocxTableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Status", bold: true, size: 20 }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Ativo por Aceite Tácito", size: 22, color: "059669" }),
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
              children: [new TextRun({ text: "• Resolução CFC nº 1.590/2020 - Contrato de Prestação de Serviços Contábeis", size: 20 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• NBC PG 01 - Código de Ética Profissional do Contador", size: 20 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Lei nº 10.406/2002 - Código Civil Brasileiro (Arts. 107, 111, 593-609)", size: 20 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Lei nº 8.078/1990 - Código de Defesa do Consumidor (Art. 54)", size: 20 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Lei nº 9.613/1998 - Prevenção à Lavagem de Dinheiro (COAF)", size: 20 })],
              spacing: { after: 200 },
            }),

            // Cláusula de Aceite Tácito
            new Paragraph({
              spacing: { before: 300, after: 200 },
              shading: {
                fill: "3B82F6",
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
                }),
              ],
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Utilização de qualquer serviço prestado pela CONTRATADA", size: 20 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Envio de documentos fiscais, contábeis ou trabalhistas", size: 20 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Pagamento, total ou parcial, de honorários contábeis", size: 20 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "• Fornecimento de procuração ou senha de acesso a sistemas governamentais", size: 20 })],
              spacing: { after: 200 },
            }),

            // Nota de Validade
            new Paragraph({
              shading: {
                fill: "FEF3C7",
                type: ShadingType.SOLID,
              },
              border: {
                top: { color: "F59E0B", size: 12, style: BorderStyle.SINGLE },
                bottom: { color: "F59E0B", size: 12, style: BorderStyle.SINGLE },
                left: { color: "F59E0B", size: 12, style: BorderStyle.SINGLE },
                right: { color: "F59E0B", size: 12, style: BorderStyle.SINGLE },
              },
              spacing: { before: 300, after: 200 },
              children: [
                new TextRun({
                  text: "IMPORTANTE: ",
                  bold: true,
                  size: 20,
                  color: "92400E",
                }),
                new TextRun({
                  text: "Conforme Art. 107 e 111 do Código Civil Brasileiro, este contrato dispensa assinatura física ou digital, sendo válido pelo aceite tácito demonstrado pela conduta das partes.",
                  size: 20,
                  color: "92400E",
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
          <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">
                      Contratos de Prestação de Serviços
                    </h1>
                    <p className="text-muted-foreground">
                      Modalidade Adesão com Aceite Tácito - Resolução CFC 1.590/2020
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
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
                                    const preview = generateContractContent(contract.contract_type);
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
                                    setSelectedClient(client);
                                    setFormData({
                                      ...formData,
                                      client_id: client.id,
                                      contract_type: contract.contract_type,
                                      monthly_fee: String(contract.monthly_fee),
                                      start_date: contract.start_date,
                                    });
                                    const content = generateContractContent(contract.contract_type);
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

                <ScrollArea className="h-[60vh] border rounded-lg">
                  <pre className="p-6 text-xs font-mono whitespace-pre-wrap bg-white">
                    {contractPreview}
                  </pre>
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
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Contracts;
