import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle2, XCircle, AlertCircle, Loader2, TrendingUp, TrendingDown, Split, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportedTransactionsSummary } from "@/components/ImportedTransactionsSummary";
import { ReconciliationKPIs } from "@/components/ReconciliationKPIs";

const BankReconciliation = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileType, setFileType] = useState<string>("ofx");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [importedTransactions, setImportedTransactions] = useState<any[]>([]);
  const [results, setResults] = useState<any>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [kpiData, setKpiData] = useState<any>(null);
  const [splitEntries, setSplitEntries] = useState<any[]>([
    { client_id: "", invoice_id: "", amount: "", description: "" }
  ]);

  const loadClients = useCallback(async () => {
    const { data } = await supabase.from("clients").select("*").eq("is_active", true);
    setClients(data || []);
  }, []);

  const loadInvoices = useCallback(async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(name)")
      .eq("status", "pending");
    setInvoices(data || []);
  }, []);

  const calculateKPIs = useCallback(async (txData: any[]) => {
    const data = txData;

    const matched = data.filter((t: any) => t.matched);
    const unmatched = data.filter((t: any) => !t.matched);

    const credits = data.filter((t: any) => t.transaction_type === "credit");
    const debits = data.filter((t: any) => t.transaction_type === "debit");

    const totalCredit = credits.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
    const totalDebit = debits.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

    const matchedCredit = matched
      .filter((t: any) => t.transaction_type === "credit")
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

    const matchedDebit = matched
      .filter((t: any) => t.transaction_type === "debit")
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

    const avgConfidence = matched.length > 0
      ? matched.reduce((sum: number, t: any) => sum + (t.ai_confidence || 0), 0) / matched.length
      : 0;

    const lastImport = data.length > 0 ? data[0].created_at : null;

    setKpiData({
      totalTransactions: data.length,
      matchedTransactions: matched.length,
      unmatchedTransactions: unmatched.length,
      totalCredit,
      totalDebit,
      matchedCredit,
      matchedDebit,
      averageConfidence: avgConfidence,
      lastImportDate: lastImport,
    });
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select(`
          *,
          matched_expense_id:expenses(description),
          matched_invoice_id:invoices(id, clients(name))
        `)
        .order("transaction_date", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Carregar matches múltiplos para cada transação
      const transactionsWithMatches = await Promise.all(
        (data || []).map(async (tx) => {
          if (tx.has_multiple_matches) {
            const { data: matches } = await supabase
              .from("bank_transaction_matches")
              .select("*, clients(name), invoices(id)")
              .eq("bank_transaction_id", tx.id);
            return { ...tx, matches: matches || [] };
          }
          return tx;
        })
      );

      setTransactions(transactionsWithMatches);
    } catch (error: any) {
      console.error("Erro ao carregar transações:", error);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
    loadClients();
    loadInvoices();
  }, [loadTransactions, loadClients, loadInvoices]);

  useEffect(() => {
    calculateKPIs(transactions);
  }, [calculateKPIs, transactions]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      setResults(null);
      setImportedTransactions([]);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Selecione pelo menos um arquivo");
      return;
    }

    setLoading(true);
    setResults(null);
    const allImportedTx: any[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileType", fileType);

        const { data, error } = await supabase.functions.invoke("process-bank-statement", {
          body: formData,
        });

        if (error) throw error;

        allImportedTx.push(...(data.transactions || []));
        toast.success(`${file.name}: ${data.processed} transações processadas`);
      }

      setImportedTransactions(allImportedTx);
      setResults({
        success: true,
        total: allImportedTx.length,
        matched: allImportedTx.filter((t: any) => t.matched).length,
      });

      await loadTransactions();
      toast.success(`Total: ${allImportedTx.length} transações importadas de ${files.length} arquivo(s)`);
    } catch (error: any) {
      console.error("Erro ao processar:", error);
      toast.error("Erro ao processar extrato: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openSplitDialog = (tx: any) => {
    setSelectedTransaction(tx);
    setSplitEntries([{ client_id: "", invoice_id: "", amount: "", description: "" }]);
    setSplitDialogOpen(true);
  };

  const addSplitEntry = () => {
    setSplitEntries([...splitEntries, { client_id: "", invoice_id: "", amount: "", description: "" }]);
  };

  const removeSplitEntry = (index: number) => {
    setSplitEntries(splitEntries.filter((_, i) => i !== index));
  };

  const updateSplitEntry = (index: number, field: string, value: any) => {
    const updated = [...splitEntries];
    updated[index][field] = value;
    
    // Se selecionou um honorário, preencher automaticamente
    if (field === "invoice_id" && value) {
      const invoice = invoices.find(inv => inv.id === value);
      if (invoice) {
        updated[index].client_id = invoice.client_id;
        updated[index].amount = invoice.amount.toString();
        updated[index].description = `Pagamento honorário - ${invoice.clients?.name}`;
      }
    }
    
    setSplitEntries(updated);
  };

  const saveSplitMatches = async () => {
    if (!selectedTransaction) return;

    try {
      setLoading(true);

      // Validar que a soma bate
      const total = splitEntries.reduce((sum, entry) => sum + parseFloat(entry.amount || 0), 0);
      if (Math.abs(total - selectedTransaction.amount) > 0.01) {
        toast.error(`A soma dos lançamentos (${formatCurrency(total)}) não bate com o valor da transação (${formatCurrency(selectedTransaction.amount)})`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Inserir os matches
      const matchesData = splitEntries.map(entry => ({
        bank_transaction_id: selectedTransaction.id,
        client_id: entry.client_id || null,
        invoice_id: entry.invoice_id || null,
        amount: parseFloat(entry.amount),
        description: entry.description,
        confidence: 1.0,
        created_by: user.id,
      }));

      const { error: matchError } = await supabase
        .from("bank_transaction_matches")
        .insert(matchesData);

      if (matchError) throw matchError;

      // Atualizar transação para indicar múltiplos matches
      await supabase
        .from("bank_transactions")
        .update({ has_multiple_matches: true, matched: true })
        .eq("id", selectedTransaction.id);

      // Atualizar honorários e razão
      for (const entry of splitEntries) {
        if (entry.invoice_id) {
          // Marcar honorário como pago
          await supabase
            .from("invoices")
            .update({ status: "paid", payment_date: selectedTransaction.transaction_date })
            .eq("id", entry.invoice_id);

          // Lançar no razão do cliente
          const { data: lastBalance } = await supabase
            .from("client_ledger")
            .select("balance")
            .eq("client_id", entry.client_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const previousBalance = lastBalance?.balance || 0;
          const newBalance = previousBalance + parseFloat(entry.amount);

          await supabase
            .from("client_ledger")
            .insert({
              client_id: entry.client_id,
              transaction_date: selectedTransaction.transaction_date,
              description: entry.description,
              credit: parseFloat(entry.amount),
              debit: 0,
              balance: newBalance,
              invoice_id: entry.invoice_id,
              reference_type: "bank_transaction",
              reference_id: selectedTransaction.id,
              created_by: user.id,
            });
        }
      }

      toast.success("Lançamentos múltiplos salvos com sucesso!");
      setSplitDialogOpen(false);
      loadTransactions();
      loadInvoices();
    } catch (error: any) {
      console.error("Erro ao salvar lançamentos:", error);
      toast.error("Erro ao salvar lançamentos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMatchBadge = (tx: any) => {
    if (tx.has_multiple_matches) {
      return (
        <Badge className="gap-1 bg-primary">
          <Split className="w-3 h-3" />
          Múltiplos ({tx.matches?.length || 0})
        </Badge>
      );
    }

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
              Formatos suportados: OFX (Extrato Bancário), CSV, "Zebrinha" (detalhamento de pagamentos)
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
                    <SelectItem value="zebrinha">Zebrinha (Detalhamento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Arquivo</Label>
                <Input
                  id="file"
                  type="file"
                  multiple
                  accept=".ofx,.csv,.txt"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm font-medium">{f.name}</span>
                    </div>
                  </div>
                ))}
                <Button onClick={handleUpload} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando {files.length} arquivo(s)...
                    </>
                  ) : (
                    `Processar ${files.length} arquivo(s) com IA`
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

        {kpiData && <ReconciliationKPIs {...kpiData} />}

        {importedTransactions.length > 0 && (
          <ImportedTransactionsSummary 
            transactions={importedTransactions} 
            fileName={files.map(f => f.name).join(", ")} 
          />
        )}

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
                    <TableHead>Ações</TableHead>
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
                        {tx.has_multiple_matches ? (
                          <div className="space-y-1">
                            {tx.matches?.map((match: any, i: number) => (
                              <div key={i} className="text-xs">
                                {match.clients?.name}: {formatCurrency(match.amount)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          tx.ai_suggestion || "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {!tx.matched && tx.transaction_type === "credit" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSplitDialog(tx)}
                          >
                            <Split className="w-4 h-4 mr-1" />
                            Destrinchar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Destrinchar Transação em Múltiplos Lançamentos</DialogTitle>
            <DialogDescription>
              Transação: {selectedTransaction?.description} - {formatCurrency(selectedTransaction?.amount || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {splitEntries.map((entry, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-2">
                      <Label>Honorário Pendente</Label>
                      <Select
                        value={entry.invoice_id}
                        onValueChange={(value) => updateSplitEntry(index, "invoice_id", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o honorário" />
                        </SelectTrigger>
                        <SelectContent>
                          {invoices.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.clients?.name} - {formatCurrency(inv.amount)} - {inv.competence}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Cliente (manual)</Label>
                      <Select
                        value={entry.client_id}
                        onValueChange={(value) => updateSplitEntry(index, "client_id", value)}
                        disabled={!!entry.invoice_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Cliente" />
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

                    <div>
                      <Label>Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.amount}
                        onChange={(e) => updateSplitEntry(index, "amount", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex items-end">
                      {splitEntries.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeSplitEntry(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Descrição</Label>
                    <Input
                      value={entry.description}
                      onChange={(e) => updateSplitEntry(index, "description", e.target.value)}
                      placeholder="Descrição do lançamento"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button type="button" variant="outline" onClick={addSplitEntry} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Mais um Lançamento
            </Button>

            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Total Lançado:</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(splitEntries.reduce((sum, entry) => sum + parseFloat(entry.amount || 0), 0))}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Valor da Transação:</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(selectedTransaction?.amount || 0)}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveSplitMatches} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Lançamentos"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default BankReconciliation;
