import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, Download, Calendar } from "lucide-react";
import { readOFXFile, OFXStatement, OFXTransaction } from "@/lib/ofxParser";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
}

interface ImportResult {
  success: boolean;
  newTransactions: number;
  duplicateTransactions: number;
  totalAmount: number;
  errors: string[];
}

const BankImport = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<OFXStatement | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [recentImports, setRecentImports] = useState<any[]>([]);

  useEffect(() => {
    loadBankAccounts();
    loadRecentImports();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas bancárias");
    }
  };

  const loadRecentImports = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_imports")
        .select(`
          *,
          bank_accounts (
            name,
            bank_name
          )
        `)
        .order("import_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentImports(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar importações:", error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedAccount) {
      toast.error("Selecione uma conta bancária primeiro");
      event.target.value = "";
      return;
    }

    try {
      setPreviewing(true);
      setParsedData(null);
      setImportResult(null);
      toast.info("Lendo arquivo OFX...");

      const result = await readOFXFile(file);

      if (!result.success || !result.data) {
        toast.error(result.error || "Erro ao processar arquivo OFX");
        return;
      }

      setParsedData(result.data);
      toast.success(`Arquivo processado: ${result.data.transactions.length} transações encontradas`);
    } catch (error: any) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo OFX");
    } finally {
      setPreviewing(false);
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (!parsedData || !selectedAccount) return;

    try {
      setLoading(true);
      toast.info("Importando transações...");

      let newTransactions = 0;
      let duplicateTransactions = 0;
      const errors: string[] = [];
      let totalAmount = 0;

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from("bank_imports")
        .insert({
          bank_account_id: selectedAccount,
          file_name: `Import ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          start_date: format(parsedData.startDate, 'yyyy-MM-dd'),
          end_date: format(parsedData.endDate, 'yyyy-MM-dd'),
          total_transactions: parsedData.transactions.length,
          status: 'processing'
        })
        .select()
        .single();

      if (importError) throw importError;

      // Import each transaction
      for (const txn of parsedData.transactions) {
        try {
          // Check if transaction already exists (by FITID)
          const { data: existing } = await supabase
            .from("bank_transactions")
            .select("id")
            .eq("bank_account_id", selectedAccount)
            .eq("fitid", txn.fitid)
            .single();

          if (existing) {
            duplicateTransactions++;
            continue;
          }

          // Insert transaction
          const { error: txnError } = await supabase
            .from("bank_transactions")
            .insert({
              bank_account_id: selectedAccount,
              transaction_date: format(txn.date, 'yyyy-MM-dd'),
              transaction_type: txn.type.toLowerCase(),
              amount: txn.amount,
              description: txn.description,
              document_number: txn.checkNumber,
              memo: txn.memo,
              fitid: txn.fitid,
              import_id: importRecord.id,
              is_reconciled: false
            });

          if (txnError) {
            errors.push(`Erro na transação ${txn.fitid}: ${txnError.message}`);
            continue;
          }

          newTransactions++;
          totalAmount += txn.type === 'CREDIT' ? txn.amount : -txn.amount;
        } catch (error: any) {
          errors.push(`Erro ao importar transação: ${error.message}`);
        }
      }

      // Calculate totals
      const totalDebits = parsedData.transactions
        .filter(t => t.type === 'DEBIT')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalCredits = parsedData.transactions
        .filter(t => t.type === 'CREDIT')
        .reduce((sum, t) => sum + t.amount, 0);

      // Update import record
      await supabase
        .from("bank_imports")
        .update({
          status: errors.length > 0 ? 'completed' : 'completed',
          new_transactions: newTransactions,
          duplicated_transactions: duplicateTransactions,
          total_debits: totalDebits,
          total_credits: totalCredits,
          error_message: errors.length > 0 ? errors.join('; ') : null
        })
        .eq("id", importRecord.id);

      // Update bank account balance (trigger will handle this)
      setImportResult({
        success: true,
        newTransactions,
        duplicateTransactions,
        totalAmount,
        errors
      });

      if (newTransactions > 0) {
        toast.success(`${newTransactions} transação(ões) importada(s) com sucesso!`);
      } else {
        toast.info("Nenhuma transação nova para importar");
      }

      if (duplicateTransactions > 0) {
        toast.info(`${duplicateTransactions} transação(ões) já existia(m) no sistema`);
      }

      loadRecentImports();
      setParsedData(null);
    } catch (error: any) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar transações");
      setImportResult({
        success: false,
        newTransactions: 0,
        duplicateTransactions: 0,
        totalAmount: 0,
        errors: [error.message]
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Upload className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Importar Extrato Bancário</h1>
            <p className="text-muted-foreground">
              Importe arquivos OFX do seu banco (Sicredi, Banco do Brasil, etc.)
            </p>
          </div>
        </div>

        {/* Import Form */}
        <Card>
          <CardHeader>
            <CardTitle>Importar Arquivo OFX</CardTitle>
            <CardDescription>
              Selecione a conta bancária e faça upload do arquivo .ofx
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_account">Conta Bancária</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {account.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ofx_file">Arquivo OFX</Label>
              <input
                type="file"
                id="ofx_file"
                accept=".ofx,.OFX"
                onChange={handleFileSelect}
                disabled={!selectedAccount || previewing || loading}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-sm text-muted-foreground">
                Arquivos OFX exportados do internet banking do seu banco
              </p>
            </div>

            {previewing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processando arquivo...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        {parsedData && !importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Preview do Arquivo
              </CardTitle>
              <CardDescription>
                Revise as transações antes de importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {formatDate(parsedData.startDate)} - {formatDate(parsedData.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transações</p>
                  <p className="font-medium">{parsedData.transactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conta</p>
                  <p className="font-medium">{parsedData.accountNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Final</p>
                  <p className="font-medium">{formatCurrency(parsedData.balanceAmount)}</p>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.transactions.map((txn, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{formatDate(txn.date)}</TableCell>
                        <TableCell>
                          <Badge variant={txn.type === 'CREDIT' ? 'default' : 'secondary'}>
                            {txn.type === 'CREDIT' ? 'Crédito' : 'Débito'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {txn.description}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={txn.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                            {txn.type === 'CREDIT' ? '+' : '-'}{formatCurrency(txn.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setParsedData(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Importar Transações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Result */}
        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                Resultado da Importação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Novas Transações</p>
                  <p className="text-2xl font-bold text-green-600">{importResult.newTransactions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duplicadas</p>
                  <p className="text-2xl font-bold text-yellow-600">{importResult.duplicateTransactions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Impacto no Saldo</p>
                  <p className={`text-2xl font-bold ${importResult.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(importResult.totalAmount)}
                  </p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-destructive">Erros:</p>
                  <ul className="space-y-1">
                    {importResult.errors.map((error, idx) => (
                      <li key={idx} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={() => setImportResult(null)}>
                Nova Importação
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Imports */}
        <Card>
          <CardHeader>
            <CardTitle>Importações Recentes</CardTitle>
            <CardDescription>Histórico das últimas importações realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentImports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma importação realizada ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Novas</TableHead>
                      <TableHead className="text-center">Duplicadas</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentImports.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell>{formatDate(imp.import_date)}</TableCell>
                        <TableCell>{imp.bank_accounts?.name}</TableCell>
                        <TableCell className="text-sm">
                          {formatDate(imp.start_date)} - {formatDate(imp.end_date)}
                        </TableCell>
                        <TableCell className="text-center">{imp.total_transactions}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">
                          {imp.new_transactions}
                        </TableCell>
                        <TableCell className="text-center text-yellow-600">
                          {imp.duplicated_transactions}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              imp.status === 'completed' ? 'default' :
                              imp.status === 'failed' ? 'destructive' : 'secondary'
                            }
                          >
                            {imp.status === 'completed' ? 'Concluído' :
                             imp.status === 'failed' ? 'Erro' :
                             imp.status === 'processing' ? 'Processando' : imp.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default BankImport;
