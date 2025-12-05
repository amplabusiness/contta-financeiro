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
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
}

interface ReconciliationResult {
  total_ofx_transactions: number;
  total_cnab_transactions: number;
  matched_transactions: number;
  pending_reconciliations: number;
  unmatched_ofx: number;
  unmatched_cnab: number;
  errors: string[];
  matched_details: MatchedDetail[];
}

interface MatchedDetail {
  ofx_amount: number;
  ofx_date: string;
  cnab_document: string;
  cnab_amount: number;
  cnab_date: string;
  invoice_number?: string;
  confidence: number;
  status: string;
}

const ImportCNAB = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [ofxFile, setOfxFile] = useState<File | null>(null);
  const [cnabFile, setCnabFile] = useState<File | null>(null);
  const [ofxContent, setOfxContent] = useState<string>("");
  const [cnabContent, setCnabContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);

  useEffect(() => {
    loadBankAccounts();
  }, []);

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

  const handleOfxFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOfxFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setOfxContent(content);
    };
    reader.readAsText(file);
  };

  const handleCnabFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCnabFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCnabContent(content);
    };
    reader.readAsText(file);
  };

  const handleReconcile = async () => {
    if (!selectedAccount || !ofxContent || !cnabContent) {
      toast.error("Selecione uma conta bancária e carregue AMBOS os arquivos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "reconcile-ofx-cnab-invoices",
        {
          body: {
            ofx_content: ofxContent,
            cnab_content: cnabContent,
            bank_account_id: selectedAccount,
          },
        }
      );

      if (error) throw error;

      setResult(data);

      if (data.pending_reconciliations > 0) {
        toast.success(
          `${data.pending_reconciliations} match(es) encontrado(s)! Revise no próximo passo.`
        );
      }
      if (data.unmatched_ofx > 0 || data.unmatched_cnab > 0) {
        toast.info(
          `${data.unmatched_ofx} transações OFX + ${data.unmatched_cnab} CNAB sem correspondência`
        );
      }
      if (data.errors.length > 0) {
        toast.error(`${data.errors.length} erro(s) durante o processamento`);
      }
    } catch (error: any) {
      toast.error("Erro ao processar arquivos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isReadyToProcess = selectedAccount && ofxContent && cnabContent;
  const successRate = result
    ? Math.round((result.pending_reconciliations / (result.total_ofx_transactions || 1)) * 100)
    : 0;

  const clearOfx = () => {
    setOfxFile(null);
    setOfxContent("");
  };

  const clearCnab = () => {
    setCnabFile(null);
    setCnabContent("");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conciliação OFX + CNAB 400</h1>
          <p className="text-muted-foreground">
            Importe o extrato bancário (OFX) e o arquivo de retorno (CNAB 400) para conciliar
            automaticamente
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Passo 1: Selecione a Conta Bancária</CardTitle>
            <CardDescription>
              Escolha qual conta bancária você está reconciliando
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passo 2: Carregue os Arquivos</CardTitle>
            <CardDescription>
              Ambos os arquivos são necessários para a conciliação correta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* OFX Upload */}
            <div className="space-y-2">
              <Label htmlFor="ofx-file">
                Extrato Bancário (OFX) *
                {ofxFile && (
                  <Badge variant="success" className="ml-2">
                    ✓ Carregado
                  </Badge>
                )}
              </Label>
              <div className="flex items-center gap-4">
                <div className="flex-1 px-4 py-3 border-2 border-dashed rounded-lg hover:border-primary cursor-pointer transition-colors">
                  <input
                    id="ofx-file"
                    type="file"
                    accept=".ofx,.txt"
                    onChange={handleOfxFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="ofx-file"
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {ofxFile ? ofxFile.name : "Clique para selecionar arquivo OFX"}
                    </span>
                  </label>
                </div>
                {ofxFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearOfx}
                    title="Remover arquivo"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {ofxContent && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Arquivo OFX carregado: {ofxFile?.name} ({ofxContent.split("\n").length} linhas)
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* CNAB Upload */}
            <div className="space-y-2">
              <Label htmlFor="cnab-file">
                Arquivo CNAB 400 *
                {cnabFile && (
                  <Badge variant="success" className="ml-2">
                    ✓ Carregado
                  </Badge>
                )}
              </Label>
              <div className="flex items-center gap-4">
                <div className="flex-1 px-4 py-3 border-2 border-dashed rounded-lg hover:border-primary cursor-pointer transition-colors">
                  <input
                    id="cnab-file"
                    type="file"
                    accept=".txt,.cnab,.ret"
                    onChange={handleCnabFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="cnab-file"
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {cnabFile ? cnabFile.name : "Clique para selecionar arquivo CNAB"}
                    </span>
                  </label>
                </div>
                {cnabFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearCnab}
                    title="Remover arquivo"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {cnabContent && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Arquivo CNAB carregado: {cnabFile?.name} ({cnabContent.split("\n").length} linhas)
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Status de Carregamento */}
            <Alert
              className={
                isReadyToProcess ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"
              }
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {!selectedAccount && "⚠️ Selecione uma conta bancária"}
                {selectedAccount && !ofxContent && "⚠️ Carregue o arquivo OFX"}
                {selectedAccount && ofxContent && !cnabContent && "⚠️ Carregue o arquivo CNAB"}
                {isReadyToProcess && "✅ Pronto para processar!"}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            onClick={handleReconcile}
            disabled={!isReadyToProcess || loading}
            size="lg"
            className="flex-1"
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
        </div>

        {result && (
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900">Arquivo Processado com Sucesso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-blue-800">
                  OFX e CNAB foram processados e {result.pending_reconciliations} match(es) foram
                  encontrado(s).
                  <br />
                  Revise e aprove as conciliações sugeridas.
                </p>
                <Button
                  onClick={() => navigate("/pending-reconciliations")}
                  className="w-full"
                >
                  Revisar Conciliações Pendentes
                </Button>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-900">Resumo do Processamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Transações OFX</div>
                    <div className="text-2xl font-bold">{result.total_ofx_transactions}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Registros CNAB</div>
                    <div className="text-2xl font-bold">{result.total_cnab_transactions}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Matches OFX↔CNAB</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {result.matched_transactions}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Pendentes Aprovação</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {result.pending_reconciliations}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taxa de Correspondência</span>
                    <span className="text-sm font-bold">{successRate}%</span>
                  </div>
                  <Progress value={successRate} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">OFX não encontradas</div>
                    <div className="text-lg font-bold text-orange-600">
                      {result.unmatched_ofx}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">CNAB não encontradas</div>
                    <div className="text-lg font-bold text-orange-600">
                      {result.unmatched_cnab}
                    </div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {result.errors.length} erro(s) durante o processamento
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {result.matched_details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes dos Matches Encontrados</CardTitle>
                  <CardDescription>
                    Matches entre transações OFX e CNAB que serão vinculados às faturas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>OFX Data</TableHead>
                          <TableHead>OFX Valor</TableHead>
                          <TableHead>CNAB Doc</TableHead>
                          <TableHead>CNAB Valor</TableHead>
                          <TableHead>Fatura</TableHead>
                          <TableHead>Confiança</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.matched_details.map((match, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {new Date(match.ofx_date).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>{formatCurrency(match.ofx_amount)}</TableCell>
                            <TableCell>{match.cnab_document}</TableCell>
                            <TableCell>{formatCurrency(match.cnab_amount)}</TableCell>
                            <TableCell>
                              {match.invoice_number || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={match.confidence > 0.95 ? "default" : "secondary"}
                              >
                                {Math.round(match.confidence * 100)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Erros Encontrados</CardTitle>
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
