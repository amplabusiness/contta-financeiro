import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Zap, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PixMatch {
  transaction: any;
  invoice: any;
  confidence: number;
  matchType: "exact" | "close" | "suspicious";
  differences: string[];
}

const PixReconciliation = () => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [matches, setMatches] = useState<PixMatch[]>([]);
  const [unmatched, setUnmatched] = useState<any[]>([]);

  useEffect(() => {
    analyzePixTransactions();
  }, []);

  const analyzePixTransactions = async () => {
    setAnalyzing(true);
    try {
      // Buscar transações PIX não conciliadas
      const { data: pixTransactions, error: txError } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("matched", false)
        .eq("transaction_type", "credit")
        .or("description.ilike.%PIX%,description.ilike.%pix%")
        .order("transaction_date", { ascending: false });

      if (txError) throw txError;

      // Buscar boletos pendentes ou pagos recentemente
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("*, clients(id, name)")
        .in("status", ["pending", "paid"])
        .order("due_date", { ascending: false });

      if (invError) throw invError;

      // Fazer matching
      const foundMatches: PixMatch[] = [];
      const unmatchedList: any[] = [];

      for (const tx of pixTransactions || []) {
        let bestMatch: PixMatch | null = null;
        let bestScore = 0;

        for (const invoice of invoices || []) {
          const score = calculateMatchScore(tx, invoice);
          
          if (score.confidence > 70 && score.confidence > bestScore) {
            bestScore = score.confidence;
            bestMatch = {
              transaction: tx,
              invoice: invoice,
              confidence: score.confidence,
              matchType: score.matchType,
              differences: score.differences,
            };
          }
        }

        if (bestMatch) {
          foundMatches.push(bestMatch);
        } else {
          unmatchedList.push(tx);
        }
      }

      setMatches(foundMatches);
      setUnmatched(unmatchedList);
      
      if (foundMatches.length > 0) {
        toast.success(`${foundMatches.length} possíveis matches encontrados!`);
      }
    } catch (error: any) {
      toast.error("Erro ao analisar transações: " + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const calculateMatchScore = (transaction: any, invoice: any): any => {
    let confidence = 0;
    const differences: string[] = [];
    let matchType: "exact" | "close" | "suspicious" = "suspicious";

    // Comparar valores (peso 50%)
    const txAmount = Math.abs(transaction.amount);
    const invAmount = invoice.amount;
    const amountDiff = Math.abs(txAmount - invAmount);
    const amountDiffPercent = (amountDiff / invAmount) * 100;

    if (amountDiff === 0) {
      confidence += 50;
      matchType = "exact";
    } else if (amountDiffPercent <= 2) {
      confidence += 45;
      differences.push(`Diferença de valor: R$ ${amountDiff.toFixed(2)} (${amountDiffPercent.toFixed(2)}%)`);
      matchType = "close";
    } else if (amountDiffPercent <= 5) {
      confidence += 35;
      differences.push(`Diferença de valor: R$ ${amountDiff.toFixed(2)} (${amountDiffPercent.toFixed(2)}%)`);
    } else if (amountDiffPercent <= 10) {
      confidence += 20;
      differences.push(`Diferença significativa de valor: R$ ${amountDiff.toFixed(2)} (${amountDiffPercent.toFixed(2)}%)`);
    }

    // Comparar datas (peso 30%)
    const txDate = new Date(transaction.transaction_date);
    const dueDate = new Date(invoice.due_date);
    const paymentDate = invoice.payment_date ? new Date(invoice.payment_date) : null;
    
    const daysDiffDue = Math.abs((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysDiffPayment = paymentDate 
      ? Math.abs((txDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    const minDaysDiff = Math.min(daysDiffDue, daysDiffPayment);

    if (minDaysDiff <= 2) {
      confidence += 30;
    } else if (minDaysDiff <= 7) {
      confidence += 20;
      differences.push(`Pagamento ${minDaysDiff.toFixed(0)} dias ${txDate > dueDate ? 'após' : 'antes'} do vencimento`);
    } else if (minDaysDiff <= 30) {
      confidence += 10;
      differences.push(`Pagamento ${minDaysDiff.toFixed(0)} dias ${txDate > dueDate ? 'após' : 'antes'} do vencimento`);
    }

    // Comparar cliente pelo nome na descrição (peso 20%)
    const clientName = invoice.clients?.name?.toUpperCase() || "";
    const txDescription = transaction.description?.toUpperCase() || "";
    
    if (clientName) {
      const nameWords = clientName.split(" ").filter(w => w.length > 3);
      const matchedWords = nameWords.filter(word => txDescription.includes(word));
      
      if (matchedWords.length === nameWords.length) {
        confidence += 20;
      } else if (matchedWords.length > 0) {
        confidence += 10 * (matchedWords.length / nameWords.length);
        differences.push(`Nome parcialmente encontrado: ${matchedWords.join(" ")}`);
      }
    }

    return { confidence, matchType, differences };
  };

  const handleConfirmMatch = async (match: PixMatch) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Atualizar transação bancária
      const { error: txError } = await supabase
        .from("bank_transactions")
        .update({
          matched: true,
          matched_invoice_id: match.invoice.id,
          ai_confidence: match.confidence,
        })
        .eq("id", match.transaction.id);

      if (txError) throw txError;

      // Atualizar invoice se ainda não foi pago
      if (match.invoice.status === "pending") {
        const { error: invError } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            payment_date: match.transaction.transaction_date,
          })
          .eq("id", match.invoice.id);

        if (invError) throw invError;

        // Criar entrada no razão do cliente
        const { error: ledgerError } = await supabase
          .from("client_ledger")
          .insert({
            client_id: match.invoice.client_id,
            transaction_date: match.transaction.transaction_date,
            description: `Pagamento via PIX - ${match.invoice.description || 'Honorários'}`,
            debit: 0,
            credit: Math.abs(match.transaction.amount),
            balance: 0,
            invoice_id: match.invoice.id,
            reference_type: "invoice",
            notes: `Conciliado automaticamente. PIX: ${match.transaction.bank_reference || match.transaction.description}`,
            created_by: user.id,
          });

        if (ledgerError) throw ledgerError;
      }

      // Se houver divergências, criar log de auditoria
      if (match.differences.length > 0 || match.matchType !== "exact") {
        await supabase.from("audit_logs" as any).insert({
          audit_type: "pix_reconciliation",
          severity: match.matchType === "suspicious" ? "warning" : "info",
          entity_type: "invoice",
          entity_id: match.invoice.id,
          title: `PIX Conciliado com ${match.matchType === "exact" ? "Match Exato" : "Divergências"}`,
          description: `PIX de R$ ${Math.abs(match.transaction.amount).toFixed(2)} conciliado com boleto ${match.invoice.description}. ${match.differences.length > 0 ? "Divergências encontradas: " + match.differences.join("; ") : ""}`,
          metadata: {
            transaction_id: match.transaction.id,
            invoice_id: match.invoice.id,
            cliente: match.invoice.clients?.name,
            valor_pix: Math.abs(match.transaction.amount),
            valor_boleto: match.invoice.amount,
            data_pix: match.transaction.transaction_date,
            vencimento_boleto: match.invoice.due_date,
            confidence: match.confidence,
            differences: match.differences,
          },
          created_by: user.id,
        });
      }

      toast.success("Match confirmado e boleto atualizado!");
      analyzePixTransactions();
    } catch (error: any) {
      toast.error("Erro ao confirmar match: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectMatch = async (match: PixMatch) => {
    // Remove o match da lista mas não faz nada no banco
    setMatches(matches.filter(m => m !== match));
    toast.info("Match rejeitado");
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return <Badge className="bg-green-600">Alta ({confidence}%)</Badge>;
    if (confidence >= 75) return <Badge className="bg-blue-600">Boa ({confidence}%)</Badge>;
    if (confidence >= 60) return <Badge variant="secondary">Média ({confidence}%)</Badge>;
    return <Badge variant="outline">Baixa ({confidence}%)</Badge>;
  };

  const getMatchTypeBadge = (type: string) => {
    if (type === "exact") return <Badge className="bg-green-600">Match Exato</Badge>;
    if (type === "close") return <Badge className="bg-blue-600">Match Próximo</Badge>;
    return <Badge variant="destructive">Suspeito</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reconciliação PIX Automática</h1>
            <p className="text-muted-foreground">
              Identifique automaticamente pagamentos via PIX relacionados a boletos
            </p>
          </div>
          <Button onClick={analyzePixTransactions} disabled={analyzing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? "Analisando..." : "Atualizar Análise"}
          </Button>
        </div>

        {analyzing && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <RefreshCw className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-lg font-medium">Analisando transações PIX...</p>
                <p className="text-sm text-muted-foreground">
                  Buscando matches com boletos cadastrados
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!analyzing && matches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Matches Encontrados ({matches.length})
              </CardTitle>
              <CardDescription>
                Confirme ou rejeite cada match identificado automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {matches.map((match, idx) => (
                  <Card key={idx} className="border-l-4 border-l-blue-600">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(Math.round(match.confidence))}
                            {getMatchTypeBadge(match.matchType)}
                          </div>
                          <CardTitle className="text-lg">
                            {match.invoice.clients?.name}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Transação PIX</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>Valor:</strong> {formatCurrency(Math.abs(match.transaction.amount))}</p>
                            <p><strong>Data:</strong> {format(new Date(match.transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                            <p><strong>Descrição:</strong> {match.transaction.description}</p>
                            {match.transaction.bank_reference && (
                              <p className="text-xs text-muted-foreground">
                                Ref: {match.transaction.bank_reference}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Boleto</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>Valor:</strong> {formatCurrency(match.invoice.amount)}</p>
                            <p><strong>Vencimento:</strong> {format(new Date(match.invoice.due_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                            <p><strong>Competência:</strong> {match.invoice.competence}</p>
                            <p><strong>Status:</strong> {match.invoice.status === "pending" ? "Pendente" : "Pago"}</p>
                          </div>
                        </div>
                      </div>

                      {match.differences.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-md">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Divergências Detectadas:
                              </p>
                              {match.differences.map((diff, i) => (
                                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300">
                                  • {diff}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleConfirmMatch(match)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Confirmar Match
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleRejectMatch(match)}
                          disabled={loading}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rejeitar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!analyzing && matches.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhum match pendente</p>
                <p className="text-sm text-muted-foreground">
                  Todas as transações PIX foram reconciliadas ou não há correspondências
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {unmatched.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Transações PIX sem Match ({unmatched.length})</CardTitle>
              <CardDescription>
                PIX que não foram relacionados a nenhum boleto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatched.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {format(new Date(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell>{formatCurrency(Math.abs(tx.amount))}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default PixReconciliation;
