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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}

// Dados do escritório (em produção, viria do perfil da empresa)
const officeData = {
  name: "AMPLA ASSESSORIA CONTABIL LTDA",
  tradeName: "Ampla Business",
  cnpj: "21.565.040/0001-07",
  crc: "CRC/GO 007640/O",
  address: "Rua 1, Qd. 24, Lt. 08",
  number: "S/N",
  neighborhood: "Setor Maracanã",
  city: "Goiânia",
  state: "GO",
  zip: "74.680-320",
  email: "contato@amplabusiness.com.br",
  website: "www.amplabusiness.com.br",
  phone: "(62) 3932-1365",
  accountant: "Sérgio Rosa de Carvalho",
  accountantCpf: "CPF do Contador",
  accountantCrc: "CRC/GO 024.270/O-5",
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
  const [isLoading, setIsLoading] = useState(false);
  const [showNewContract, setShowNewContract] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [contractPreview, setContractPreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

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
    fetchContracts();
    fetchClients();
  }, [fetchContracts, fetchClients]);

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
Razão Social: ${officeData.name}
Nome Fantasia: ${officeData.tradeName}
CNPJ: ${officeData.cnpj}
Registro CRC: ${officeData.crc}
Endereço: ${officeData.address}, ${officeData.number} - ${officeData.neighborhood}
CEP: ${officeData.zip} - ${officeData.city}/${officeData.state}
E-mail: ${officeData.email}
Telefone: ${officeData.phone}
Responsável Técnico: ${officeData.accountant}
CRC Responsável: ${officeData.accountantCrc}

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

13.1. Fica eleito o foro da comarca de ${officeData.city}/${officeData.state} para dirimir
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
Responsável: ${officeData.accountant} - ${officeData.accountantCrc}
Versão: Conforme Resolução CFC 1.590/2020

CONTRATADA: ${officeData.name}
CNPJ: ${officeData.cnpj}
CRC: ${officeData.crc}

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

      const contractData = {
        client_id: formData.client_id,
        contract_type: formData.contract_type,
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
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost">
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
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
