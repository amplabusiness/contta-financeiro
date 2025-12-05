import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
}

interface ReconciliationResult {
  total_processed: number;
  reconciled: number;
  unmatched: number;
  errors: string[];
  matched_invoices: MatchedInvoice[];
}

interface MatchedInvoice {
  invoice_id: string;
  invoice_number: string;
  cnab_document: string;
  amount: number;
  payment_date: string;
  confidence: number;
}

const ImportCNAB = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [cnabFile, setCnabFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [fileContent, setFileContent] = useState<string>("");

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name")
        .eq("is_active", true);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar contas bancárias");
      console.error(error);
    }
  };

  useEffect(() => {
    loadBankAccounts();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCnabFile(file);

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleReconcile = async () => {
    if (!selectedAccount || !fileContent) {
      toast.error("Selecione uma conta bancária e um arquivo CNAB");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "reconcile-cnab-invoices",
        {
          body: {
            cnab_content: fileContent,
            bank_account_id: selectedAccount,
          },
        }
      );

      if (error) throw error;

      setResult(data);

      if (data.reconciled > 0) {
        toast.success(`${data.reconciled} matches encontrados! Revise no próximo passo.`);
      }
      if (data.unmatched > 0) {
        toast.info(`${data.unmatched} transações não encontraram correspondência`);
      }
      if (data.errors.length > 0) {
        toast.error(`${data.errors.length} erros durante o processamento`);
      }
    } catch (error: any) {
      toast.error("Erro ao processar arquivo CNAB");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const successRate = result
    ? Math.round((result.reconciled / result.total_processed) * 100)
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar CNAB 400</h1>
          <p className="text-muted-foreground">
            Importe arquivo CNAB 400 do seu banco para conciliar faturas automaticamente
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar Arquivo</CardTitle>
            <CardDescription>
              Carregue o arquivo CNAB 400 (retorno de boletos) do seu banco
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account">Conta Bancária *</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta bancária" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.bank_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnab-file">Arquivo CNAB 400 *</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1 px-4 py-3 border-2 border-dashed rounded-lg hover:border-primary cursor-pointer transition-colors">
                  <input
                    id="cnab-file"
                    type="file"
                    accept=".txt,.cnab,.ret"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="cnab-file"
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {cnabFile ? cnabFile.name : "Clique para selecionar arquivo"}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {fileContent && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Arquivo carregado: {cnabFile?.name} ({fileContent.split("\n").length} linhas)
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleReconcile}
              disabled={!selectedAccount || !fileContent || loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Processar e Reconciliar
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900">Arquivo Processado com Sucesso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-blue-800">
                  O arquivo foi processado e {result.reconciled} match(es) foram encontrado(s).
                  <br />
                  Revise e aprove as conciliações sugeridas.
                </p>
                <Button onClick={() => navigate("/pending-reconciliations")} className="w-full">
                  Revisar Conciliações Pendentes
                </Button>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-900">Resumo do Processamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Processado</div>
                    <div className="text-2xl font-bold">{result.total_processed}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Reconciliadas</div>
                    <div className="text-2xl font-bold text-green-600">
                      {result.reconciled}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Não Encontradas</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {result.unmatched}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taxa de Sucesso</span>
                    <span className="text-sm font-bold">{successRate}%</span>
                  </div>
                  <Progress value={successRate} className="h-2" />
                </div>

                {result.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {result.errors.length} erro(s) durante o processamento
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {result.matched_invoices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Faturas Reconciliadas</CardTitle>
                  <CardDescription>
                    {result.matched_invoices.length} fatura(s) foram automaticamente marcadas como pagas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número da Fatura</TableHead>
                        <TableHead>Documento CNAB</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data de Pagamento</TableHead>
                        <TableHead>Confiança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.matched_invoices.map((match) => (
                        <TableRow key={match.invoice_id}>
                          <TableCell className="font-medium">
                            {match.invoice_number}
                          </TableCell>
                          <TableCell>{match.cnab_document}</TableCell>
                          <TableCell>{formatCurrency(match.amount)}</TableCell>
                          <TableCell>
                            {new Date(match.payment_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={match.confidence > 0.95 ? "default" : "secondary"}>
                              {Math.round(match.confidence * 100)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {result.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Erros</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.errors.map((error, idx) => (
                      <li key={idx} className="text-sm text-destructive">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ImportCNAB;
