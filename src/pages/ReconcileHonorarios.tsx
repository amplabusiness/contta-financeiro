import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Search
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { useAccounting } from "@/hooks/useAccounting";

interface InvoiceMatch {
  id: string;
  client_name: string;
  amount: number;
  competence: string;
  status: string;
  due_date: string;
  confidence: number;
  reason: string;
}

const ReconcileHonorarios = () => {
  const { registrarRecebimento } = useAccounting({ showToasts: false });
  const [loading, setLoading] = useState(false);
  const [transactionDate, setTransactionDate] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDesc, setTransactionDesc] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [matches, setMatches] = useState<InvoiceMatch[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  useEffect(() => {
    loadBankAccounts();
    loadClients();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setBankAccounts(data || []);
      if (data && data.length > 0) {
        setBankAccountId(data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar contas bancárias:", error);
      toast.error("Erro ao carregar contas bancárias");
    }
  };

  const loadClients = async () => {
    try {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setClients(data || []);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast.error("Erro ao carregar clientes");
    }
  };

  const handleSearch = async () => {
    if (!transactionAmount || !transactionDate) {
      toast.error("Data e valor são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "reconcile-cross-period-invoice",
        {
          body: {
            action: "find_invoices",
            data: {
              transactionAmount: parseFloat(transactionAmount),
              transactionDate,
              transactionDescription: transactionDesc,
              clientId: selectedClientId || undefined,
            },
          },
        }
      );

      if (error) throw error;

      if (data.success) {
        setMatches(data.invoices || []);
        if (data.invoices?.length === 0) {
          toast.info("Nenhuma fatura encontrada para reconciliar");
        } else {
          toast.success(`${data.invoices?.length} fatura(s) encontrada(s)`);
        }
      } else {
        throw new Error(data.error || "Erro ao buscar faturas");
      }
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao buscar faturas");
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (invoiceId: string) => {
    if (!bankAccountId) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    setLoading(true);
    try {
      const invoice = matches.find(m => m.id === invoiceId);
      if (!invoice) throw new Error("Fatura não encontrada");

      // 1. Executar reconciliação via Edge Function
      const { data: reconData, error: reconError } = await supabase.functions.invoke(
        "reconcile-cross-period-invoice",
        {
          body: {
            action: "reconcile_transaction",
            data: {
              invoiceId,
              transactionDate,
              transactionAmount: parseFloat(transactionAmount),
              bankAccountId,
            },
          },
        }
      );

      if (reconError) throw reconError;

      // 2. Registrar lançamento contábil (recebimento)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const accountingResult = await registrarRecebimento({
        paymentId: `payment_${invoiceId}_${transactionDate}`,
        invoiceId,
        clientId: "", // Será obtido da fatura
        clientName: invoice.client_name,
        amount: invoice.amount,
        paymentDate: transactionDate,
        bankAccountId,
        description: `Recebimento de ${invoice.client_name} - Honorários ${invoice.competence}`,
      });

      if (accountingResult.success) {
        toast.success(
          `✅ Reconciliação concluída!\n` +
          `Fatura: ${invoice.competence}\n` +
          `Pagamento: ${transactionDate}`
        );
        
        // Limpar formulário
        setTransactionAmount("");
        setTransactionDesc("");
        setMatches([]);
        setSelectedInvoice(null);
      } else {
        throw new Error(accountingResult.error || "Erro ao registrar lançamento contábil");
      }
    } catch (error: any) {
      console.error("Erro na reconciliação:", error);
      toast.error(error.message || "Erro ao reconciliar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Reconciliar Honorários
          </h1>
          <p className="text-muted-foreground mt-1">
            Reconciliar pagamentos de períodos anteriores (ex: pagamento de janeiro para fatura de dezembro)
          </p>
        </div>

        {/* Alert Informativo */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Como funciona:</strong> Este fluxo permite reconciliar transações bancárias com faturas de períodos anteriores,
            respeitando o princípio contábil de competência. A fatura mantém sua data original, mas o pagamento é registrado
            na data da transação bancária.
          </AlertDescription>
        </Alert>

        {/* Formulário de Busca */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Transação Bancária</CardTitle>
            <CardDescription>
              Informe os detalhes da transação que você deseja reconciliar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tx-date">Data da Transação</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="tx-amount">Valor</Label>
                <Input
                  id="tx-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="bank-account">Conta Bancária</Label>
                <select
                  id="bank-account"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="">Selecionar...</option>
                  {bankAccounts.map((ba) => (
                    <option key={ba.id} value={ba.id}>
                      {ba.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tx-desc">Descrição da Transação (opcional)</Label>
                <Input
                  id="tx-desc"
                  placeholder="Ex: Transferência do cliente XYZ, PIX, DOC, etc"
                  value={transactionDesc}
                  onChange={(e) => setTransactionDesc(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="client-filter">Cliente (opcional)</Label>
                <select
                  id="client-filter"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="">Todos os clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Buscar Faturas Compatíveis
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        {matches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Faturas Encontradas</CardTitle>
              <CardDescription>
                Clique em uma fatura para reconciliá-la com a transação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedInvoice === match.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedInvoice(match.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{match.client_name}</h4>
                          <Badge variant={match.status === "paid" ? "secondary" : "outline"}>
                            {match.status === "paid" ? "Já Paga" : "Pendente"}
                          </Badge>
                          <Badge variant="default" className="ml-auto">
                            {Math.round(match.confidence * 100)}% confiança
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Competência: {match.competence}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span>{formatCurrency(match.amount)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs">{match.reason}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedInvoice === match.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <div className="bg-blue-50 p-3 rounded text-sm">
                          <p className="font-medium text-blue-900 mb-1">✓ Detalhes da Reconciliação:</p>
                          <ul className="text-blue-800 space-y-1 text-xs">
                            <li>• Fatura de <strong>{match.competence}</strong></li>
                            <li>• Pagamento em <strong>{transactionDate}</strong></li>
                            <li>• Valor: <strong>{formatCurrency(parseFloat(transactionAmount))}</strong></li>
                          </ul>
                        </div>
                        <Button
                          onClick={() => handleReconcile(match.id)}
                          disabled={loading}
                          className="w-full"
                          variant="default"
                        >
                          {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Reconciliar Esta Fatura
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info adicional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-medium">1️⃣ Buscar Faturas</p>
              <p className="text-muted-foreground">
                Informe a data e valor da transação bancária. O sistema buscará todas as faturas pendentes
                ou recentemente pagas que correspondam ao valor.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">2️⃣ Selecionar Fatura</p>
              <p className="text-muted-foreground">
                Escolha a fatura que corresponde à transação. O sistema mostrará a confiança do match
                e o motivo da sugestão.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">3️⃣ Reconciliar</p>
              <p className="text-muted-foreground">
                Ao clicar em "Reconciliar", o sistema atualizará a fatura como paga e criará automaticamente
                o lançamento contábil de recebimento na data correta.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded">
              <p className="text-xs text-amber-900">
                <strong>⚠️ Importante:</strong> Este processo segue o princípio contábil de competência.
                A fatura mantém sua data original (competência), enquanto o pagamento é registrado
                na data da transação bancária.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ReconcileHonorarios;
