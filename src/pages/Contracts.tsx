import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Eye,
  Download,
  Send,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Contract {
  id: string;
  client_id: string;
  client_name: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  monthly_fee: number;
  status: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
}

const Contracts = () => {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showNewContract, setShowNewContract] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [contractPreview, setContractPreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    client_id: "",
    contract_type: "full_accounting",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    monthly_fee: "",
    services: [] as string[],
    payment_day: "10",
    payment_method: "boleto",
  });

  // Contract service options
  const contractServices = {
    full_accounting: [
      "Escrituração contábil completa",
      "Elaboração de balancetes mensais",
      "Apuração de impostos (IRPJ, CSLL, PIS, COFINS)",
      "Declaração de Imposto de Renda Pessoa Jurídica (DIPJ)",
      "Declaração de Débitos e Créditos Tributários (DCTF)",
      "Escrituração Contábil Digital (ECD)",
      "Escrituração Contábil Fiscal (ECF)",
      "Assessoria contábil mensal",
    ],
    payroll: [
      "Folha de pagamento mensal",
      "Cálculo de encargos sociais (INSS, FGTS)",
      "Emissão de guias de recolhimento",
      "Admissão e demissão de funcionários",
      "Férias e 13º salário",
      "eSocial",
      "CAGED",
      "RAIS",
    ],
    tax: [
      "Apuração de impostos federais",
      "Apuração de impostos estaduais (ICMS)",
      "Apuração de impostos municipais (ISS)",
      "Declarações acessórias",
      "Planejamento tributário",
      "Consultoria fiscal",
    ],
    consulting: [
      "Consultoria empresarial",
      "Análise de viabilidade econômica",
      "Planejamento estratégico",
      "Assessoria em decisões gerenciais",
      "Relatórios gerenciais",
    ],
  };

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
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
      // TODO: Create contracts table and query
      // For now, using mock data
      setContracts([]);
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

  const getContractTemplate = (type: string): string => {
    const firmData = {
      name: "AMPLA CONTABILIDADE LTDA",
      tradeName: "Ampla Business",
      cnpj: "00.000.000/0000-00",
      address: "Rua Exemplo, 123",
      city: "São Paulo",
      state: "SP",
      crc: "CRC/SP 000000",
      accountant: "Nome do Contador Responsável",
      cpf: "000.000.000-00",
    };

    const client = selectedClient;
    if (!client) return "";

    const services =
      contractServices[type as keyof typeof contractServices] || [];

    const today = new Date();
    const contractNumber = `${today.getFullYear()}/${String(
      Math.floor(Math.random() * 10000)
    ).padStart(4, "0")}`;

    return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS
Nº ${contractNumber}

Pelo presente instrumento particular de prestação de serviços, de um lado:

CONTRATANTE:
Razão Social: ${client.name}
CNPJ: ${client.cnpj}
Endereço: ${client.address || "Não informado"}
Cidade/UF: ${client.city || ""} - ${client.state || ""}
E-mail: ${client.email || ""}
Telefone: ${client.phone || ""}

Doravante denominada simplesmente CONTRATANTE,

E de outro lado:

CONTRATADA:
Razão Social: ${firmData.name}
Nome Fantasia: ${firmData.tradeName}
CNPJ: ${firmData.cnpj}
CRC: ${firmData.crc}
Endereço: ${firmData.address}
Cidade/UF: ${firmData.city} - ${firmData.state}
Website: www.amplabusiness.com.br
Representante Legal: ${firmData.accountant}
CPF: ${firmData.cpf}

Doravante denominada simplesmente CONTRATADA,

Têm entre si justo e contratado o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS, que se regerá pelas cláusulas e condições seguintes:

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de contabilidade pela CONTRATADA à CONTRATANTE, conforme disposto nas Normas Brasileiras de Contabilidade editadas pelo Conselho Federal de Contabilidade - CFC.

CLÁUSULA SEGUNDA - DOS SERVIÇOS CONTRATADOS
A CONTRATADA se compromete a executar os seguintes serviços:

${services.map((service, index) => `${index + 1}. ${service}`).join("\n")}

Parágrafo Único: Os serviços serão executados em conformidade com as Normas Brasileiras de Contabilidade (NBC), Princípios Fundamentais de Contabilidade e legislação vigente.

CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DA CONTRATADA
São obrigações da CONTRATADA:

a) Executar os serviços contratados com zelo, diligência e competência profissional;
b) Manter sigilo absoluto sobre as informações e documentos da CONTRATANTE, conforme NBC PG 01 - Código de Ética Profissional do Contador;
c) Cumprir os prazos estabelecidos pela legislação para entrega de obrigações acessórias;
d) Orientar a CONTRATANTE sobre procedimentos contábeis e fiscais;
e) Manter a CONTRATANTE informada sobre alterações na legislação que afetem suas atividades;
f) Zelar pela boa guarda dos documentos sob sua responsabilidade;
g) Responsabilizar-se tecnicamente pelos serviços prestados.

CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATANTE
São obrigações da CONTRATANTE:

a) Fornecer à CONTRATADA, tempestivamente, todos os documentos e informações necessários à execução dos serviços;
b) Pagar pontualmente os honorários nos valores e prazos estabelecidos neste contrato;
c) Comunicar à CONTRATADA, de imediato, qualquer alteração em sua situação cadastral, societária ou operacional;
d) Manter arquivados os documentos fiscais e contábeis pelo prazo legal;
e) Responsabilizar-se pela veracidade das informações fornecidas;
f) Atender prontamente às solicitações da CONTRATADA quanto ao fornecimento de documentos;
g) Indicar preposto para contato direto com a CONTRATADA.

CLÁUSULA QUINTA - DOS HONORÁRIOS E FORMA DE PAGAMENTO
Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA a quantia mensal de R$ ${
      formData.monthly_fee || "0,00"
    } (valor por extenso), devida até o dia ${
      formData.payment_day
    } de cada mês, através de ${
      formData.payment_method === "boleto"
        ? "boleto bancário"
        : formData.payment_method === "pix"
        ? "PIX"
        : "transferência bancária"
    }.

§1º - O não pagamento dos honorários na data estabelecida sujeitará a CONTRATANTE à multa de 2% (dois por cento) sobre o valor devido, acrescida de juros de mora de 1% (um por cento) ao mês, além de correção monetária pelo IGPM/FGV.

§2º - O atraso superior a 60 (sessenta) dias no pagamento dos honorários facultará à CONTRATADA a suspensão da prestação dos serviços, sem prejuízo da cobrança das parcelas vencidas.

§3º - Serviços extraordinários, não previstos neste contrato, serão objeto de orçamento à parte e aprovação prévia da CONTRATANTE.

CLÁUSULA SEXTA - DO REAJUSTE
Os honorários serão reajustados anualmente pela variação do IGPM/FGV acumulada nos 12 (doze) meses anteriores, ou na data base da categoria, o que ocorrer primeiro.

CLÁUSULA SÉTIMA - DA VIGÊNCIA
Este contrato terá vigência de ${
      formData.end_date
        ? `12 (doze) meses, iniciando-se em ${formData.start_date} e encerrando-se em ${formData.end_date}`
        : `prazo indeterminado, iniciando-se em ${formData.start_date}`
    }.

CLÁUSULA OITAVA - DA RESCISÃO
O presente contrato poderá ser rescindido:

a) Por acordo entre as partes;
b) Por iniciativa de qualquer das partes, mediante aviso prévio de 30 (trinta) dias;
c) Por inadimplência de qualquer das obrigações contratuais;
d) Por impossibilidade de cumprimento do objeto contratual.

Parágrafo Único: Em caso de rescisão, a CONTRATADA deverá entregar à CONTRATANTE todos os documentos e informações sob sua guarda, mediante recibo, e a CONTRATANTE deverá quitar todos os valores devidos até a data da rescisão.

CLÁUSULA NONA - DA RESPONSABILIDADE PROFISSIONAL
A CONTRATADA responderá profissionalmente pelos serviços prestados, nos termos da legislação vigente, do Código de Ética Profissional do Contador e das Normas Brasileiras de Contabilidade.

Parágrafo Único: A responsabilidade da CONTRATADA limita-se aos serviços efetivamente contratados, não se estendendo a decisões gerenciais ou empresariais da CONTRATANTE.

CLÁUSULA DÉCIMA - DO SIGILO
As partes se comprometem a manter sigilo absoluto sobre todas as informações, dados, documentos e conhecimentos obtidos em decorrência deste contrato, conforme determina a NBC PG 01 e o Código Civil Brasileiro.

CLÁUSULA DÉCIMA PRIMEIRA - DAS DISPOSIÇÕES GERAIS
a) Este contrato obriga as partes e seus sucessores a qualquer título;
b) Qualquer alteração deste contrato deverá ser formalizada por escrito, através de termo aditivo;
c) A tolerância de uma parte com a outra quanto ao descumprimento de qualquer cláusula não implicará em novação ou renúncia;
d) Este contrato substitui e cancela quaisquer acordos anteriores, verbais ou escritos.

CLÁUSULA DÉCIMA SEGUNDA - DO FORO
Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer questões oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

E por estarem assim justos e contratados, assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas.

${firmData.city}, ${new Date(formData.start_date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}


_________________________________________
CONTRATANTE: ${client.name}
CNPJ: ${client.cnpj}


_________________________________________
CONTRATADA: ${firmData.name}
Representante: ${firmData.accountant}
CRC: ${firmData.crc}


TESTEMUNHAS:

_________________________________________
Nome:
CPF:

_________________________________________
Nome:
CPF:
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

    const preview = getContractTemplate(formData.contract_type);
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

    toast({
      title: "Contrato criado",
      description: "O contrato foi criado com sucesso. Em breve será possível salvá-lo no banco de dados.",
    });

    // TODO: Save to database when contracts table is created
  };

  const handleDownloadPDF = () => {
    toast({
      title: "Função em desenvolvimento",
      description: "A geração de PDF será implementada em breve.",
    });
  };

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      full_accounting: "Contabilidade Completa",
      payroll: "Departamento Pessoal",
      tax: "Fiscal/Tributário",
      consulting: "Consultoria",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      draft: <Badge variant="outline">Rascunho</Badge>,
      sent: <Badge className="bg-blue-100 text-blue-800">Enviado</Badge>,
      signed: <Badge className="bg-green-100 text-green-800">Assinado</Badge>,
      active: <Badge className="bg-green-100 text-green-800">Ativo</Badge>,
      cancelled: <Badge variant="destructive">Cancelado</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

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
                      Gestão de contratos conforme normas CFC
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowNewContract(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Contrato
                </Button>
              </div>
            </div>

            {/* Contracts Table */}
            <Card>
              <CardHeader>
                <CardTitle>Contratos Ativos</CardTitle>
                <CardDescription>
                  Lista de contratos cadastrados no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      Nenhum contrato cadastrado
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Crie seu primeiro contrato de prestação de serviços
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
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Valor Mensal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">
                            {contract.client_name}
                          </TableCell>
                          <TableCell>
                            {getContractTypeLabel(contract.contract_type)}
                          </TableCell>
                          <TableCell>
                            {new Date(contract.start_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            R$ {Number(contract.monthly_fee).toFixed(2)}
                          </TableCell>
                          <TableCell>{getStatusBadge(contract.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost">
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <Download className="w-3 h-3" />
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
                    Preencha os dados para gerar o contrato conforme normas do CFC
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
                          <SelectItem value="full_accounting">
                            Contabilidade Completa
                          </SelectItem>
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
                      <Label htmlFor="end_date">Data de Término (opcional)</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, end_date: e.target.value })
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  {selectedClient && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">
                        Dados do Cliente
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                        <p>
                          <strong>CNPJ:</strong> {selectedClient.cnpj}
                        </p>
                        <p>
                          <strong>E-mail:</strong> {selectedClient.email || "Não informado"}
                        </p>
                        <p>
                          <strong>Telefone:</strong> {selectedClient.phone || "Não informado"}
                        </p>
                        <p>
                          <strong>Cidade:</strong> {selectedClient.city || "Não informado"}/{selectedClient.state || ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewContract(false);
                      setSelectedClient(null);
                      setFormData({
                        client_id: "",
                        contract_type: "full_accounting",
                        start_date: new Date().toISOString().split("T")[0],
                        end_date: "",
                        monthly_fee: "",
                        services: [],
                        payment_day: "10",
                        payment_method: "boleto",
                      });
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
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Preview do Contrato</DialogTitle>
                  <DialogDescription>
                    Visualize o contrato antes de salvar ou enviar
                  </DialogDescription>
                </DialogHeader>

                <div className="bg-white border rounded-lg p-8 whitespace-pre-wrap font-serif text-sm">
                  {contractPreview}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Fechar
                  </Button>
                  <Button variant="outline" onClick={handleDownloadPDF}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
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
