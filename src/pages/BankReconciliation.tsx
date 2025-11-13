import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle2, XCircle, AlertCircle, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BankReconciliation = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string>("ofx");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select(`
          *,
          matched_expense_id:expenses(description),
          matched_invoice_id:invoices(id, clients(name))
        `)
        .order("transaction_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar transações:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", fileType);

      const { data, error } = await supabase.functions.invoke("process-bank-statement", {
        body: formData,
      });

      if (error) throw error;

      setResults(data);
      toast.success(`${data.matched} de ${data.total} transações conciliadas automaticamente!`);
      loadTransactions();
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao processar arquivo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMatchBadge = (tx: any) => {
    if (!tx.matched) {
      return (
        <Badge variant="outline" className="gap-1">
          <XCircle className="w-3 h-3" />
          Não Conciliado
        </Badge>
      );
    }

    const confidence = tx.ai_confidence || 0;
    if (confidence > 0.8) {
      return (
        <Badge className="gap-1 bg-success">
          <CheckCircle2 className="w-3 h-3" />
          Conciliado ({(confidence * 100).toFixed(0)}%)
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="w-3 h-3" />
        Parcial ({(confidence * 100).toFixed(0)}%)
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conciliação Bancária Inteligente</h1>
          <p className="text-muted-foreground">
            Importe extratos bancários e deixe a IA fazer a conciliação automática
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Importar Extrato Bancário</CardTitle>
            <CardDescription>
              Formatos suportados: OFX (Extrato Bancário), CSV, "Zebrinha" do banco
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fileType">Tipo de Arquivo</Label>
                <Select value={fileType} onValueChange={setFileType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ofx">OFX (Extrato Bancário)</SelectItem>
                    <SelectItem value="csv">CSV (Planilha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Arquivo</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".ofx,.csv,.txt"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </div>
            </div>

            {file && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button onClick={handleUpload} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Processar com IA"
                  )}
                </Button>
              </div>
            )}

            {results && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{results.total}</div>
                    <p className="text-xs text-muted-foreground">Total de Transações</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-success">{results.matched}</div>
                    <p className="text-xs text-muted-foreground">Conciliadas Automaticamente</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-warning">
                      {results.total - results.matched}
                    </div>
                    <p className="text-xs text-muted-foreground">Requerem Revisão</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transações Importadas</CardTitle>
            <CardDescription>Últimas 50 transações bancárias</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transação importada ainda</p>
                <p className="text-sm">Importe um extrato bancário para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sugestão da IA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {new Date(tx.transaction_date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex items-center gap-2">
                          {tx.transaction_type === "credit" ? (
                            <TrendingUp className="w-4 h-4 text-success" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-destructive" />
                          )}
                          <span className="truncate">{tx.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            tx.transaction_type === "credit"
                              ? "text-success font-semibold"
                              : "text-destructive font-semibold"
                          }
                        >
                          {tx.transaction_type === "credit" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell>{getMatchBadge(tx)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs">
                        {tx.ai_suggestion || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default BankReconciliation;
