import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, CheckCircle2, AlertCircle, Search, DollarSign,
  Users, Calendar, ArrowRight, Target, RefreshCw, Split
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAccounting } from "@/hooks/useAccounting";

interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  matched: boolean;
  is_opening_balance: boolean;
}

interface ClientOpeningBalance {
  id: string;
  client_id: string;
  competence: string;
  amount: number;
  due_date: string;
  description: string;
  status: string;
  paid_amount: number;
  clients: { name: string; cnpj?: string; cpf?: string };
  selected?: boolean;
}

// Extrair documento (CPF/CNPJ) da descrição do PIX
const extractDocumentFromPix = (description: string): string | null => {
  // PIX_CRED seguido de 11 dígitos (CPF) ou 14 dígitos (CNPJ)
  const match = description.match(/PIX_CRED\s+(\d{11,14})\s/i);
  if (match) return match[1];

  // Tentar encontrar qualquer sequência de 11 ou 14 dígitos
  const anyDoc = description.match(/\b(\d{11}|\d{14})\b/);
  if (anyDoc) return anyDoc[1];

  return null;
};

const OpeningBalanceReconciliation = () => {
  // Hook de contabilidade - OBRIGATÓRIO para lançamentos D/C (Dr. Cícero - NBC TG 26)
  const { registrarRecebimento } = useAccounting({ showToasts: false, sourceModule: 'OpeningBalanceReconciliation' });

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [clientBalances, setClientBalances] = useState<ClientOpeningBalance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog de conciliação
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [selectedBalances, setSelectedBalances] = useState<string[]>([]);
  const [suggestedClient, setSuggestedClient] = useState<{ name: string; document: string; balances: ClientOpeningBalance[] } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar transações de crédito de Janeiro/2025 (saldo de abertura)
      const { data: txData, error: txError } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("transaction_type", "credit")
        .gte("transaction_date", "2025-01-01")
        .lte("transaction_date", "2025-01-31")
        .order("transaction_date", { ascending: true });

      if (txError) throw txError;

      // Mapear para interface
      const mappedTx = (txData || []).map(tx => ({
        ...tx,
        transaction_type: (tx.transaction_type || tx.type || 'credit') as 'credit' | 'debit',
        amount: Math.abs(tx.amount)
      }));

      setTransactions(mappedTx);

      // Carregar saldos de abertura dos clientes (apenas pendentes)
      const { data: balanceData, error: balanceError } = await supabase
        .from("client_opening_balance")
        .select("*, clients(name, cnpj)")
        .eq("status", "pending")
        .order("clients(name)", { ascending: true });

      if (balanceError) throw balanceError;
      setClientBalances(balanceData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Filtrar transações não conciliadas
  const pendingTransactions = useMemo(() => {
    return transactions.filter(tx => !tx.matched);
  }, [transactions]);

  // Filtrar saldos de abertura por busca
  const filteredBalances = useMemo(() => {
    if (!searchTerm) return clientBalances;
    const term = searchTerm.toLowerCase();
    return clientBalances.filter(b =>
      b.clients?.name?.toLowerCase().includes(term) ||
      b.competence?.toLowerCase().includes(term) ||
      b.amount.toString().includes(term)
    );
  }, [clientBalances, searchTerm]);

  // Calcular total selecionado
  const selectedTotal = useMemo(() => {
    return selectedBalances.reduce((sum, id) => {
      const balance = clientBalances.find(b => b.id === id);
      return sum + (balance?.amount || 0);
    }, 0);
  }, [selectedBalances, clientBalances]);

  // Diferença entre transação e selecionados
  const difference = useMemo(() => {
    if (!selectedTransaction) return 0;
    return selectedTransaction.amount - selectedTotal;
  }, [selectedTransaction, selectedTotal]);

  // Abrir dialog de conciliação
  const openReconciliation = (tx: BankTransaction) => {
    setSelectedTransaction(tx);
    setSelectedBalances([]);
    setSuggestedClient(null);

    // Tentar encontrar cliente pelo documento do PIX
    const document = extractDocumentFromPix(tx.description);
    if (document) {
      // Limpar documento (remover formatação)
      const cleanDoc = document.replace(/\D/g, '');

      // Buscar cliente com esse CPF/CNPJ
      const matchingBalances = clientBalances.filter(b => {
        const clientCnpj = b.clients?.cnpj?.replace(/\D/g, '') || '';
        const clientCpf = b.clients?.cpf?.replace(/\D/g, '') || '';
        return clientCnpj === cleanDoc || clientCpf === cleanDoc;
      });

      if (matchingBalances.length > 0) {
        // Encontrou cliente! Pré-selecionar os honorários
        setSuggestedClient({
          name: matchingBalances[0].clients?.name || 'Cliente',
          document: cleanDoc,
          balances: matchingBalances
        });

        // Se o valor bate exatamente com algum honorário, pré-selecionar
        const exactMatch = matchingBalances.find(b => Math.abs(b.amount - tx.amount) < 0.01);
        if (exactMatch) {
          setSelectedBalances([exactMatch.id]);
        } else {
          // Pré-selecionar todos do cliente
          setSelectedBalances(matchingBalances.map(b => b.id));
        }
      }
    }

    setDialogOpen(true);
  };

  // Toggle seleção de saldo de abertura
  const toggleBalance = (id: string) => {
    setSelectedBalances(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
  };

  // Salvar conciliação
  const saveReconciliation = async () => {
    if (!selectedTransaction || selectedBalances.length === 0) {
      toast.error("Selecione pelo menos um cliente");
      return;
    }

    if (Math.abs(difference) > 0.01) {
      toast.error(`Diferença de ${formatCurrency(Math.abs(difference))} não conciliada`);
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Atualizar cada saldo de abertura como pago
      for (const balanceId of selectedBalances) {
        const balance = clientBalances.find(b => b.id === balanceId);
        if (!balance) continue;

        await supabase
          .from("client_opening_balance")
          .update({
            status: "paid",
            paid_amount: balance.amount,
            paid_date: selectedTransaction.transaction_date
          })
          .eq("id", balanceId);

        // LANÇAMENTO CONTÁBIL OBRIGATÓRIO (Dr. Cícero - NBC TG 26)
        // D: Banco (1.1.1.xx) - entrada de dinheiro
        // C: Clientes a Receber (1.1.2.01) - baixa do crédito de saldo de abertura
        await registrarRecebimento({
          paymentId: selectedTransaction.id,
          invoiceId: balanceId, // Usando balanceId como referência
          clientId: balance.client_id,
          clientName: balance.clients?.name || 'Cliente',
          amount: balance.amount,
          paymentDate: selectedTransaction.transaction_date,
          description: `Recebimento Saldo Abertura: ${balance.competence} - ${balance.description}`,
        });
      }

      // Inserir matches se houver múltiplos
      if (selectedBalances.length > 1) {
        const matchesData = selectedBalances.map(balanceId => {
          const balance = clientBalances.find(b => b.id === balanceId);
          return {
            bank_transaction_id: selectedTransaction.id,
            client_id: balance?.client_id,
            opening_balance_id: balanceId,
            amount: balance?.amount || 0,
            description: `Saldo Abertura: ${balance?.clients?.name} - ${balance?.competence}`,
            confidence: 1.0,
            created_by: user.id
          };
        });

        await supabase
          .from("bank_transaction_matches")
          .insert(matchesData);

        // Marcar transação com múltiplos matches
        await supabase
          .from("bank_transactions")
          .update({
            matched: true,
            has_multiple_matches: true,
            is_opening_balance: true,
            opening_balance_note: `Conciliado com ${selectedBalances.length} honorários de saldo de abertura`
          })
          .eq("id", selectedTransaction.id);
      } else {
        // Match único
        const balance = clientBalances.find(b => b.id === selectedBalances[0]);
        await supabase
          .from("bank_transactions")
          .update({
            matched: true,
            is_opening_balance: true,
            opening_balance_note: `Conciliado: ${balance?.clients?.name} - ${balance?.competence}`
          })
          .eq("id", selectedTransaction.id);
      }

      toast.success(`Conciliado! ${selectedBalances.length} honorário(s) baixado(s)`);
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Estatísticas
  const stats = useMemo(() => {
    const totalPending = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalBalances = clientBalances.reduce((sum, b) => sum + b.amount, 0);
    return {
      pendingCount: pendingTransactions.length,
      pendingTotal: totalPending,
      balancesCount: clientBalances.length,
      balancesTotal: totalBalances
    };
  }, [pendingTransactions, clientBalances]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="h-8 w-8 text-amber-600" />
              Conciliação Saldo de Abertura
            </h1>
            <p className="text-muted-foreground">
              Concilie as entradas de Janeiro/2025 com honorários de períodos anteriores
            </p>
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entradas Jan/2025 Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.pendingCount}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.pendingTotal)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldos de Abertura Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.balancesCount}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.balancesTotal)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conciliados Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {transactions.filter(t => t.matched).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Diferença
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.pendingTotal - stats.balancesTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(stats.pendingTotal - stats.balancesTotal))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Transações Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle>Entradas de Janeiro/2025 (Saldo de Abertura)</CardTitle>
            <CardDescription>
              Clique em "Conciliar" para vincular a entrada aos honorários dos clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>Todas as entradas de Janeiro foram conciliadas!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-full bg-green-100 text-green-600">
                      <DollarSign className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{tx.description}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>

                    <div className="text-lg font-bold text-green-600">
                      +{formatCurrency(tx.amount)}
                    </div>

                    <Button onClick={() => openReconciliation(tx)}>
                      <Split className="h-4 w-4 mr-2" />
                      Conciliar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Conciliação */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-600" />
                Conciliar Entrada com Saldo de Abertura
              </DialogTitle>
              <DialogDescription>
                Selecione os clientes que compõem este depósito
              </DialogDescription>
            </DialogHeader>

            {selectedTransaction && (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Info da transação */}
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{selectedTransaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedTransaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedTransaction.amount)}
                    </div>
                  </div>
                </div>

                {/* Sugestão automática */}
                {suggestedClient && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-amber-600" />
                      <span className="font-medium text-amber-800 dark:text-amber-200">
                        Cliente identificado automaticamente!
                      </span>
                    </div>
                    <p className="text-sm">
                      <strong>{suggestedClient.name}</strong> - CPF/CNPJ: {suggestedClient.document}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestedClient.balances.length} honorário(s) pendente(s) pré-selecionado(s).
                      Confira os valores e clique em "Confirmar" se estiver correto.
                    </p>
                  </div>
                )}

                {/* Busca */}
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, competência ou valor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                {/* Lista de saldos de abertura */}
                <ScrollArea className="flex-1 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalances.map((balance) => (
                        <TableRow
                          key={balance.id}
                          className={`cursor-pointer ${selectedBalances.includes(balance.id) ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
                          onClick={() => toggleBalance(balance.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedBalances.includes(balance.id)}
                              onCheckedChange={() => toggleBalance(balance.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {balance.clients?.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{balance.competence}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {balance.description}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(balance.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Resumo */}
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Valor da Entrada:</span>
                    <span className="font-medium">{formatCurrency(selectedTransaction.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Selecionado ({selectedBalances.length} honorários):</span>
                    <span className="font-medium">{formatCurrency(selectedTotal)}</span>
                  </div>
                  <div className={`flex justify-between text-lg font-bold ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    <span>Diferença:</span>
                    <span>{formatCurrency(Math.abs(difference))}</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
                Cancelar
              </Button>
              <Button
                onClick={saveReconciliation}
                disabled={processing || selectedBalances.length === 0 || Math.abs(difference) > 0.01}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Conciliação
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default OpeningBalanceReconciliation;
