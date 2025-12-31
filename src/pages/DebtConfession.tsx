import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Plus,
  Eye,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Copy,
  Send,
  Calculator,
  DollarSign,
  Calendar,
  MoreHorizontal,
  Trash2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DebtConfession {
  id: string;
  confession_number: string;
  client_id: string;
  total_debt: number;
  discount_amount: number;
  final_amount: number;
  installments: number;
  installment_value: number;
  first_due_date: string;
  status: string;
  created_at: string;
  clients?: { name: string; cnpj: string };
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

interface PendingInvoice {
  id: string;
  client_id: string;
  invoice_number: string;
  reference_month: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  selected?: boolean;
  source?: "invoice" | "accounting" | "opening_balance"; // Fonte do débito
  description?: string; // Descrição do lançamento
}

// Interface para dados do escritório
interface OfficeData {
  name: string;
  tradeName: string;
  cnpj: string;
  crc: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  accountant: string;
  accountantCrc: string;
}

// Dados padrão do escritório (fallback) - CNPJ CORRETO: 23.893.032/0001-69
const defaultOfficeData: OfficeData = {
  name: "AMPLA ASSESSORIA CONTABIL LTDA",
  tradeName: "Ampla Business",
  cnpj: "23.893.032/0001-69",
  crc: "CRC/GO 007640/O",
  address: "Rua 1, Qd. 24, Lt. 08, S/N - Setor Maracanã",
  city: "Goiânia",
  state: "GO",
  zip: "74.680-320",
  email: "contato@amplabusiness.com.br",
  phone: "(62) 3932-1365",
  accountant: "Sergio Carneiro Leão",
  accountantCrc: "CRC/GO 007640/O",
};

const DebtConfession = () => {
  const { toast } = useToast();
  const [confessions, setConfessions] = useState<DebtConfession[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNewConfession, setShowNewConfession] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [confessionToDelete, setConfessionToDelete] = useState<DebtConfession | null>(null);
  const [confessionToView, setConfessionToView] = useState<DebtConfession | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [confessionPreview, setConfessionPreview] = useState("");
  const [officeData, setOfficeData] = useState<OfficeData>(defaultOfficeData);

  const [formData, setFormData] = useState({
    client_id: "",
    discount_percentage: "0",
    installments: "1",
    first_due_date: "",
    payment_day: "10",
    notes: "",
  });

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  const fetchOfficeData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("accounting_office")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error) {
        console.log("Usando dados padrão do escritório");
        return;
      }

      if (data) {
        setOfficeData({
          name: data.razao_social || defaultOfficeData.name,
          tradeName: data.nome_fantasia || defaultOfficeData.tradeName,
          cnpj: data.cnpj || defaultOfficeData.cnpj,
          crc: data.crc_number ? `CRC/${data.crc_state} ${data.crc_number}` : "",
          address: `${data.endereco || ""}, ${data.numero || "S/N"} - ${data.bairro || ""}`.trim(),
          city: data.cidade || defaultOfficeData.city,
          state: data.estado || defaultOfficeData.state,
          zip: data.cep || "",
          email: data.email || "",
          phone: data.telefone || "",
          accountant: data.responsavel_tecnico || defaultOfficeData.accountant,
          accountantCrc: data.responsavel_crc || "",
        });
      }
    } catch (error) {
      console.error("Error fetching office data:", error);
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

  const fetchPendingInvoices = useCallback(async (clientId: string) => {
    try {
      const today = new Date();
      const allDebts: PendingInvoice[] = [];

      // 1. Buscar invoices pendentes (método antigo)
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      if (!invoicesError && invoicesData) {
        invoicesData.forEach(invoice => {
          allDebts.push({
            ...invoice,
            days_overdue: Math.floor((today.getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)),
            selected: false,
            source: "invoice",
            description: `Honorários ${invoice.reference_month}`,
          });
        });
      }

      // 2. Buscar o nome do cliente para encontrar a conta no plano de contas
      const { data: clientData } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      if (clientData?.name) {
        // 3. Buscar a conta do cliente no plano de contas (1.1.2.01.xxx - Clientes a Receber)
        const clientNameParts = clientData.name.split(" ");
        const searchTerms = clientNameParts.slice(0, 2).join(" "); // Primeiras 2 palavras

        const { data: clientAccounts } = await supabase
          .from("chart_of_accounts")
          .select("id, code, name")
          .like("code", "1.1.2.01%")
          .ilike("name", `%${searchTerms}%`);

        if (clientAccounts && clientAccounts.length > 0) {
          const accountIds = clientAccounts.map(a => a.id);

          // 4. Buscar lançamentos de débito na conta do cliente
          const { data: entries, error: entriesError } = await supabase
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
                competence_date,
                entry_type
              )
            `)
            .in("account_id", accountIds)
            .gt("debit", 0);

          if (!entriesError && entries) {
            // Agrupar por competência para calcular saldo
            const balanceByCompetence: Record<string, { debit: number; credit: number; entries: any[] }> = {};

            entries.forEach((entry: any) => {
              // Formatar competence_date como MM/YYYY
              const competenceDate = entry.accounting_entries?.competence_date;
              let competence = "Abertura";
              if (competenceDate) {
                const date = new Date(competenceDate);
                competence = `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
              }
              if (!balanceByCompetence[competence]) {
                balanceByCompetence[competence] = { debit: 0, credit: 0, entries: [] };
              }
              balanceByCompetence[competence].debit += Number(entry.debit) || 0;
              balanceByCompetence[competence].credit += Number(entry.credit) || 0;
              balanceByCompetence[competence].entries.push(entry);
            });

            // Criar débitos para cada competência com saldo positivo
            Object.entries(balanceByCompetence).forEach(([competence, data]) => {
              const saldo = data.debit - data.credit;
              if (saldo > 0) {
                // Verificar se já existe um invoice para esta competência
                const existingInvoice = allDebts.find(d =>
                  d.source === "invoice" && d.reference_month === competence
                );

                if (!existingInvoice) {
                  const firstEntry = data.entries[0];
                  const entryDate = firstEntry?.accounting_entries?.entry_date || new Date().toISOString();
                  const isOpeningBalance = competence === "Abertura" ||
                    firstEntry?.accounting_entries?.entry_type === "opening_balance" ||
                    (firstEntry?.description || "").toLowerCase().includes("abertura");

                  allDebts.push({
                    id: `acc_${competence.replace(/\//g, "_")}_${clientId}`,
                    client_id: clientId,
                    invoice_number: isOpeningBalance ? "SALDO-ABERTURA" : `CONT-${competence.replace("/", "")}`,
                    reference_month: competence,
                    amount: saldo,
                    due_date: entryDate,
                    days_overdue: Math.floor((today.getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)),
                    selected: false,
                    source: isOpeningBalance ? "opening_balance" : "accounting",
                    description: isOpeningBalance
                      ? "Saldo de Abertura - Clientes a Receber"
                      : `Honorários contábeis ${competence}`,
                  });
                }
              }
            });
          }
        }
      }

      // Ordenar por data de vencimento
      allDebts.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      setPendingInvoices(allDebts);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      setPendingInvoices([]);
    }
  }, []);

  const fetchConfessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("debt_confessions")
        .select(`
          *,
          clients:client_id (name, cnpj)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConfessions(data || []);
    } catch (error) {
      console.error("Error fetching confessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfficeData();
    fetchClients();
    fetchConfessions();
  }, [fetchOfficeData, fetchClients, fetchConfessions]);

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setSelectedClient(client || null);
    setFormData({ ...formData, client_id: clientId });
    setSelectedInvoices([]);
    if (clientId) {
      fetchPendingInvoices(clientId);
    } else {
      setPendingInvoices([]);
    }
  };

  const handleInvoiceToggle = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === pendingInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(pendingInvoices.map(inv => inv.id));
    }
  };

  const calculateTotals = () => {
    const selectedItems = pendingInvoices.filter(inv => selectedInvoices.includes(inv.id));
    const totalDebt = selectedItems.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const discountPercentage = parseFloat(formData.discount_percentage) || 0;
    const discountAmount = totalDebt * (discountPercentage / 100);
    const finalAmount = totalDebt - discountAmount;
    const installments = parseInt(formData.installments) || 1;
    const installmentValue = finalAmount / installments;

    return {
      totalDebt,
      discountAmount,
      finalAmount,
      installmentValue,
      invoiceCount: selectedItems.length,
    };
  };

  const generateConfessionContent = (): string => {
    const client = selectedClient;
    if (!client) return "";

    const totals = calculateTotals();
    const selectedItems = pendingInvoices.filter(inv => selectedInvoices.includes(inv.id));
    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const installments = parseInt(formData.installments) || 1;
    const firstDueDate = formData.first_due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Gerar parcelas
    const installmentsList = [];
    for (let i = 0; i < installments; i++) {
      const dueDate = new Date(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      installmentsList.push({
        number: i + 1,
        value: totals.installmentValue,
        dueDate: dueDate.toLocaleDateString("pt-BR"),
      });
    }

    return `
═══════════════════════════════════════════════════════════════════════════════
              INSTRUMENTO PARTICULAR DE CONFISSÃO DE DÍVIDA
                    E COMPROMISSO DE PAGAMENTO
═══════════════════════════════════════════════════════════════════════════════

EMBASAMENTO LEGAL:
• Código Civil Brasileiro - Arts. 389 a 420 (Das Obrigações)
• Art. 585, II do CPC - Título Executivo Extrajudicial
• Lei nº 10.406/2002 - Arts. 927, 944 e seguintes

───────────────────────────────────────────────────────────────────────────────
                           IDENTIFICAÇÃO DAS PARTES
───────────────────────────────────────────────────────────────────────────────

CREDORA:
Razão Social: ${officeData.name}
Nome Fantasia: ${officeData.tradeName}
CNPJ: ${officeData.cnpj}
CRC: ${officeData.crc}
Endereço: ${officeData.address}
CEP: ${officeData.zip} - ${officeData.city}/${officeData.state}
E-mail: ${officeData.email}
Telefone: ${officeData.phone}

DEVEDORA (CONFITENTE):
Razão Social: ${client.name}
CNPJ/CPF: ${client.cnpj || "Não informado"}
Endereço: ${client.logradouro || ""}, ${client.numero || "S/N"} - ${client.bairro || ""}
CEP: ${client.cep || ""} - ${client.municipio || ""}/${client.uf || ""}
E-mail: ${client.email || "Não informado"}
Telefone: ${client.phone || "Não informado"}

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 1ª - DA CONFISSÃO DA DÍVIDA
───────────────────────────────────────────────────────────────────────────────

1.1. Pelo presente instrumento particular, a DEVEDORA reconhece e confessa
dever à CREDORA a importância total de ${totals.totalDebt.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
(${extenso(totals.totalDebt)}), referente aos seguintes débitos de honorários
contábeis:

DÉBITOS CONFESSADOS:
─────────────────────────────────────────────────────────────────────────────
Nº     │ Competência      │ Vencimento    │ Dias Atraso  │ Valor
─────────────────────────────────────────────────────────────────────────────
${selectedItems.map((inv, idx) =>
  `${String(idx + 1).padStart(2, "0")}     │ ${inv.reference_month.padEnd(16)} │ ${new Date(inv.due_date).toLocaleDateString("pt-BR").padEnd(13)} │ ${String(inv.days_overdue).padStart(12)} │ ${Number(inv.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
).join("\n")}
─────────────────────────────────────────────────────────────────────────────
TOTAL DA DÍVIDA ORIGINAL: ${totals.totalDebt.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
─────────────────────────────────────────────────────────────────────────────

1.2. A DEVEDORA declara que a dívida acima discriminada é líquida, certa e
exigível, renunciando expressamente ao direito de questionar sua origem,
natureza ou valor.

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 2ª - DO DESCONTO CONCEDIDO
───────────────────────────────────────────────────────────────────────────────
${parseFloat(formData.discount_percentage) > 0 ? `
2.1. Por liberalidade, a CREDORA concede à DEVEDORA desconto de
${formData.discount_percentage}% (${extensoPercentual(formData.discount_percentage)}),
correspondente a ${totals.discountAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.

2.2. VALOR FINAL DA DÍVIDA COM DESCONTO: ${totals.finalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
(${extenso(totals.finalAmount)})

2.3. O desconto concedido é condicionado ao cumprimento integral do acordo,
sendo automaticamente revogado em caso de inadimplência, retornando a dívida
ao seu valor original acrescido de encargos.
` : `
2.1. Não há desconto concedido neste acordo.

2.2. VALOR TOTAL A PAGAR: ${totals.finalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
(${extenso(totals.finalAmount)})
`}
───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 3ª - DA FORMA DE PAGAMENTO
───────────────────────────────────────────────────────────────────────────────

3.1. A DEVEDORA compromete-se a pagar o valor de ${totals.finalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
em ${installments} (${extensoNumero(installments)}) parcela(s), conforme abaixo:

PLANO DE PAGAMENTO:
─────────────────────────────────────────────────────────────────────────────
Parcela    │ Vencimento           │ Valor
─────────────────────────────────────────────────────────────────────────────
${installmentsList.map(p =>
  `${String(p.number).padStart(2, "0")}/de ${String(installments).padStart(2, "0")}   │ ${p.dueDate.padEnd(20)} │ ${p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
).join("\n")}
─────────────────────────────────────────────────────────────────────────────

3.2. O pagamento deverá ser efetuado através de:
    [ ] Boleto Bancário
    [ ] PIX - Chave: ${officeData.cnpj}
    [ ] Transferência Bancária (dados a serem fornecidos)

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 4ª - DOS ENCARGOS MORATÓRIOS
───────────────────────────────────────────────────────────────────────────────

4.1. O não pagamento de qualquer parcela na data de vencimento acarretará:
    a) Multa de 2% (dois por cento) sobre o valor da parcela;
    b) Juros de mora de 1% (um por cento) ao mês;
    c) Correção monetária pelo IGPM/FGV.

4.2. O atraso de qualquer parcela por prazo superior a 30 (trinta) dias
caracterizará o vencimento antecipado de todas as parcelas vincendas,
tornando imediatamente exigível a totalidade do débito.

4.3. Em caso de inadimplência, o desconto eventualmente concedido será
automaticamente revogado, retornando a dívida ao valor original.

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 5ª - DO TÍTULO EXECUTIVO
───────────────────────────────────────────────────────────────────────────────

5.1. O presente instrumento constitui TÍTULO EXECUTIVO EXTRAJUDICIAL, nos
termos do art. 585, inciso II, do Código de Processo Civil, podendo a
CREDORA, em caso de descumprimento, promover a competente ação de execução.

5.2. A DEVEDORA autoriza, desde já, a inclusão de seu nome nos órgãos de
proteção ao crédito (SPC, SERASA e similares) em caso de inadimplência.

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 6ª - DA SUSPENSÃO DE SERVIÇOS
───────────────────────────────────────────────────────────────────────────────

6.1. Enquanto perdurar o presente acordo, a CREDORA manterá a prestação
regular dos serviços contábeis, condicionada ao cumprimento das obrigações
aqui assumidas.

6.2. O descumprimento do presente acordo autoriza a CREDORA a:
    a) Suspender imediatamente a prestação de serviços;
    b) Não entregar declarações e obrigações acessórias;
    c) Proceder ao distrato do contrato de prestação de serviços.

───────────────────────────────────────────────────────────────────────────────
                    CLÁUSULA 7ª - DAS DISPOSIÇÕES GERAIS
───────────────────────────────────────────────────────────────────────────────

7.1. A DEVEDORA declara que está ciente de todas as condições deste acordo
e que o aceita de livre e espontânea vontade.

7.2. A tolerância de uma parte com a outra não implica em novação ou renúncia.

7.3. Qualquer alteração neste instrumento deverá ser formalizada por escrito.

───────────────────────────────────────────────────────────────────────────────
                           CLÁUSULA 8ª - DO FORO
───────────────────────────────────────────────────────────────────────────────

8.1. Fica eleito o foro da comarca de ${officeData.city}/${officeData.state} para dirimir
quaisquer questões oriundas deste instrumento.

═══════════════════════════════════════════════════════════════════════════════
                              ASSINATURAS
═══════════════════════════════════════════════════════════════════════════════

${officeData.city}, ${formattedDate}



_________________________________________
CREDORA: ${officeData.name}
CNPJ: ${officeData.cnpj}
Representante: ${officeData.accountant}



_________________________________________
DEVEDORA (CONFITENTE): ${client.name}
CNPJ/CPF: ${client.cnpj || "___________________"}
Representante Legal: ___________________
CPF: ___________________



TESTEMUNHAS:

_________________________________________
Nome: ___________________
CPF: ___________________


_________________________________________
Nome: ___________________
CPF: ___________________

═══════════════════════════════════════════════════════════════════════════════
IMPORTANTE: Este documento constitui título executivo extrajudicial conforme
Art. 585, II do CPC. Guarde uma via assinada para seus registros.
═══════════════════════════════════════════════════════════════════════════════
`;
  };

  // Função auxiliar para número por extenso (simplificada)
  const extenso = (valor: number): string => {
    return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} reais`;
  };

  const extensoPercentual = (valor: string): string => {
    return `${valor} por cento`;
  };

  const extensoNumero = (num: number): string => {
    const numeros = ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze"];
    return numeros[num] || num.toString();
  };

  const handlePreview = () => {
    if (!selectedClient) {
      toast({
        title: "Selecione um cliente",
        variant: "destructive",
      });
      return;
    }

    if (selectedInvoices.length === 0) {
      toast({
        title: "Selecione os débitos",
        description: "Selecione pelo menos um débito para incluir na confissão.",
        variant: "destructive",
      });
      return;
    }

    const preview = generateConfessionContent();
    setConfessionPreview(preview);
    setShowPreview(true);
  };

  const handleSaveConfession = async () => {
    if (!selectedClient || selectedInvoices.length === 0) {
      toast({
        title: "Dados incompletos",
        variant: "destructive",
      });
      return;
    }

    try {
      const totals = calculateTotals();
      const confessionData = {
        client_id: formData.client_id,
        total_debt: totals.totalDebt,
        discount_percentage: parseFloat(formData.discount_percentage) || 0,
        discount_amount: totals.discountAmount,
        final_amount: totals.finalAmount,
        installments: parseInt(formData.installments) || 1,
        installment_value: totals.installmentValue,
        first_due_date: formData.first_due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        invoice_ids: selectedInvoices,
        content: confessionPreview,
        notes: formData.notes,
        status: "draft",
      };

      const { data, error } = await supabase
        .from("debt_confessions")
        .insert(confessionData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Confissão de dívida criada",
        description: `Documento ${data.confession_number} gerado com sucesso.`,
      });

      setShowNewConfession(false);
      setShowPreview(false);
      resetForm();
      fetchConfessions();
    } catch (error) {
      console.error("Error saving confession:", error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleCopyDocument = () => {
    navigator.clipboard.writeText(confessionPreview);
    toast({
      title: "Documento copiado",
      description: "O texto foi copiado para a área de transferência.",
    });
  };

  // Funções para ações da tabela
  const handleViewConfession = (confession: DebtConfession) => {
    setConfessionToView(confession);
    setShowViewDialog(true);
  };

  const handleCopyConfessionDocument = (confession: DebtConfession) => {
    if (confession.content) {
      navigator.clipboard.writeText(confession.content);
      toast({
        title: "Documento copiado",
        description: "O texto foi copiado para a área de transferência.",
      });
    } else {
      toast({
        title: "Documento não disponível",
        description: "Esta confissão não possui conteúdo gerado.",
        variant: "destructive",
      });
    }
  };

  const handleSendToClient = async (confession: DebtConfession) => {
    const client = clients.find(c => c.id === confession.client_id);
    if (!client?.email) {
      toast({
        title: "E-mail não encontrado",
        description: "O cliente não possui e-mail cadastrado.",
        variant: "destructive",
      });
      return;
    }

    // Simulação de envio - integrar com sistema de e-mail posteriormente
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: `O documento será enviado para ${client.email} em breve.`,
    });
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      discount_percentage: "0",
      installments: "1",
      first_due_date: "",
      payment_day: "10",
      notes: "",
    });
    setSelectedClient(null);
    setSelectedInvoices([]);
    setPendingInvoices([]);
    setConfessionPreview("");
  };

  const handleDeleteConfession = (confession: DebtConfession) => {
    setConfessionToDelete(confession);
    setShowDeleteDialog(true);
  };

  const confirmDeleteConfession = async () => {
    if (!confessionToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("debt_confessions")
        .delete()
        .eq("id", confessionToDelete.id);

      if (error) throw error;

      toast({
        title: "Confissão excluída",
        description: `Documento ${confessionToDelete.confession_number} foi excluído.`,
      });

      setShowDeleteDialog(false);
      setConfessionToDelete(null);
      fetchConfessions();
    } catch (error) {
      console.error("Error deleting confession:", error);
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      draft: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Rascunho</Badge>,
      sent: <Badge className="bg-blue-100 text-blue-800"><Send className="w-3 h-3 mr-1" />Enviado</Badge>,
      signed: <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Assinado</Badge>,
      active: <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1" />Em Dia</Badge>,
      defaulted: <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Inadimplente</Badge>,
      completed: <Badge className="bg-gray-100 text-gray-800"><CheckCircle className="w-3 h-3 mr-1" />Quitado</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  const totals = calculateTotals();

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
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Confissão de Dívida</h1>
                    <p className="text-muted-foreground">
                      Título Executivo Extrajudicial - Art. 585, II do CPC
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowNewConfession(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Confissão
                </Button>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900">Título Executivo Extrajudicial</h4>
                  <p className="text-sm text-amber-800">
                    A confissão de dívida assinada pelo devedor constitui título executivo extrajudicial,
                    permitindo a execução direta em caso de inadimplência, sem necessidade de processo
                    de conhecimento prévio.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{confessions.length}</div>
                  <p className="text-xs text-muted-foreground">Total de Confissões</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {confessions.filter(c => c.status === "active" || c.status === "signed").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    R$ {confessions
                      .filter(c => c.status === "active" || c.status === "signed")
                      .reduce((sum, c) => sum + Number(c.final_amount), 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">Valor em Acordos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-emerald-600">
                    {confessions.filter(c => c.status === "completed").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Quitados</p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Confissões de Dívida</CardTitle>
                <CardDescription>Acordos de parcelamento firmados com clientes</CardDescription>
              </CardHeader>
              <CardContent>
                {confessions.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma confissão registrada</h3>
                    <p className="text-muted-foreground mb-4">
                      Crie confissões de dívida para formalizar acordos
                    </p>
                    <Button onClick={() => setShowNewConfession(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Confissão
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Documento</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor Original</TableHead>
                        <TableHead>Valor Final</TableHead>
                        <TableHead>Parcelas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {confessions.map((confession) => (
                        <TableRow key={confession.id}>
                          <TableCell className="font-mono text-sm">
                            {confession.confession_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {confession.clients?.name}
                          </TableCell>
                          <TableCell>
                            R$ {Number(confession.total_debt).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="font-medium">
                            R$ {Number(confession.final_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {confession.installments}x de R$ {Number(confession.installment_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>{getStatusBadge(confession.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewConfession(confession)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopyConfessionDocument(confession)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copiar Documento
                                </DropdownMenuItem>
                                {confession.status !== "completed" && (
                                  <DropdownMenuItem onClick={() => handleSendToClient(confession)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Enviar ao Cliente
                                  </DropdownMenuItem>
                                )}
                                {confession.status === "draft" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDeleteConfession(confession)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir Rascunho
                                    </DropdownMenuItem>
                                  </>
                                )}
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

            {/* New Confession Dialog */}
            <Dialog open={showNewConfession} onOpenChange={setShowNewConfession}>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Confissão de Dívida</DialogTitle>
                  <DialogDescription>
                    Selecione o cliente e os débitos para gerar o termo de confissão
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Cliente */}
                  <div className="space-y-2">
                    <Label>Cliente Devedor *</Label>
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
                            {client.name} {client.cnpj && `- ${client.cnpj}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Débitos Pendentes */}
                  {selectedClient && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Débitos Pendentes</Label>
                        <Button variant="outline" size="sm" onClick={handleSelectAll}>
                          {selectedInvoices.length === pendingInvoices.length ? "Desmarcar Todos" : "Selecionar Todos"}
                        </Button>
                      </div>

                      {pendingInvoices.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg bg-muted/50">
                          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">
                            Este cliente não possui débitos pendentes
                          </p>
                        </div>
                      ) : (
                        <div className="border rounded-lg max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Dias Atraso</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingInvoices.map((invoice) => (
                                <TableRow key={invoice.id} className={invoice.source === "opening_balance" ? "bg-yellow-50" : ""}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedInvoices.includes(invoice.id)}
                                      onCheckedChange={() => handleInvoiceToggle(invoice.id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {invoice.reference_month}
                                      {invoice.source === "opening_balance" && (
                                        <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                                          Abertura
                                        </Badge>
                                      )}
                                      {invoice.source === "accounting" && (
                                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                                          Contábil
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {invoice.description || `Honorários ${invoice.reference_month}`}
                                  </TableCell>
                                  <TableCell>{new Date(invoice.due_date).toLocaleDateString("pt-BR")}</TableCell>
                                  <TableCell>
                                    <Badge variant={invoice.days_overdue > 60 ? "destructive" : "outline"}>
                                      {invoice.days_overdue} dias
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    R$ {Number(invoice.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Condições do Acordo */}
                  {selectedInvoices.length > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Desconto (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="50"
                            value={formData.discount_percentage}
                            onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº de Parcelas</Label>
                          <Select
                            value={formData.installments}
                            onValueChange={(value) => setFormData({ ...formData, installments: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>1º Vencimento</Label>
                          <Input
                            type="date"
                            value={formData.first_due_date}
                            onChange={(e) => setFormData({ ...formData, first_due_date: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Resumo */}
                      <div className="bg-muted rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Calculator className="w-4 h-4" />
                          Resumo do Acordo
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Débitos selecionados</p>
                            <p className="font-medium">{totals.invoiceCount} fatura(s)</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valor original</p>
                            <p className="font-medium">R$ {totals.totalDebt.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Desconto</p>
                            <p className="font-medium text-green-600">
                              - R$ {totals.discountAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valor final</p>
                            <p className="font-bold text-lg">
                              R$ {totals.finalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="font-medium">
                            {formData.installments}x de R$ {totals.installmentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowNewConfession(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button variant="outline" onClick={handlePreview} disabled={selectedInvoices.length === 0}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogContent className="max-w-5xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Confissão de Dívida - Preview</DialogTitle>
                  <DialogDescription>
                    Documento para assinatura do cliente devedor
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[60vh] border rounded-lg">
                  <pre className="p-6 text-xs font-mono whitespace-pre-wrap bg-white">
                    {confessionPreview}
                  </pre>
                </ScrollArea>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Fechar
                  </Button>
                  <Button variant="outline" onClick={handleCopyDocument}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  <Button onClick={handleSaveConfession}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Salvar Documento
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* View Confession Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {confessionToView?.confession_number}
                  </DialogTitle>
                  <DialogDescription>
                    Confissão de Dívida - {confessionToView?.clients?.name}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Original</p>
                      <p className="font-semibold">
                        R$ {Number(confessionToView?.original_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Final</p>
                      <p className="font-semibold">
                        R$ {Number(confessionToView?.final_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Parcelas</p>
                      <p className="font-semibold">
                        {confessionToView?.installments}x de R$ {Number(confessionToView?.installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      {confessionToView && getStatusBadge(confessionToView.status)}
                    </div>
                  </div>

                  {/* Documento */}
                  <div className="border rounded-lg p-4 bg-white">
                    <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                      {confessionToView?.content || "Documento não disponível"}
                    </pre>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confessionToView?.content) {
                        navigator.clipboard.writeText(confessionToView.content);
                        toast({
                          title: "Documento copiado",
                          description: "O texto foi copiado para a área de transferência.",
                        });
                      }
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button onClick={() => setShowViewDialog(false)}>
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Confissão de Dívida</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir o documento "{confessionToDelete?.confession_number}"?
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmDeleteConfession}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DebtConfession;
