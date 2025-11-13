import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { TrendingUp, TrendingDown, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transaction {
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: "credit" | "debit";
  matched: boolean;
  ai_confidence?: number;
  ai_suggestion?: string;
  category?: string;
}

interface ImportedTransactionsSummaryProps {
  transactions: Transaction[];
  fileName: string;
}

export function ImportedTransactionsSummary({ transactions, fileName }: ImportedTransactionsSummaryProps) {
  // Calcular estatísticas
  const credits = transactions.filter(t => t.transaction_type === "credit");
  const debits = transactions.filter(t => t.transaction_type === "debit");
  const matched = transactions.filter(t => t.matched);
  const unmatched = transactions.filter(t => !t.matched);
  
  const totalCredit = credits.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalDebit = debits.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const balance = totalCredit - totalDebit;

  // Agrupar por data
  const transactionsByDate = transactions.reduce((acc, t) => {
    const date = t.transaction_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const sortedDates = Object.keys(transactionsByDate).sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Importação</CardTitle>
          <CardDescription>Arquivo: {fileName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total de Transações</p>
              <p className="text-2xl font-bold">{transactions.length}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <p className="text-sm text-muted-foreground">Entradas</p>
              </div>
              <p className="text-2xl font-bold text-success">{formatCurrency(totalCredit)}</p>
              <p className="text-xs text-muted-foreground">{credits.length} transações</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <p className="text-sm text-muted-foreground">Saídas</p>
              </div>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDebit)}</p>
              <p className="text-xs text-muted-foreground">{debits.length} transações</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo Líquido</p>
              <p className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <div>
                <p className="text-sm font-medium">Conciliadas</p>
                <p className="text-xs text-muted-foreground">
                  {matched.length} ({((matched.length / transactions.length) * 100).toFixed(0)}%)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-medium">Não Conciliadas</p>
                <p className="text-xs text-muted-foreground">
                  {unmatched.length} ({((unmatched.length / transactions.length) * 100).toFixed(0)}%)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <div>
                <p className="text-sm font-medium">Período</p>
                <p className="text-xs text-muted-foreground">
                  {sortedDates.length > 0 && format(new Date(sortedDates[0]), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                  {sortedDates.length > 0 && format(new Date(sortedDates[sortedDates.length - 1]), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transações por Data</CardTitle>
          <CardDescription>Classificadas cronologicamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 max-h-96 overflow-y-auto">
            {sortedDates.map((date) => {
              const dayTransactions = transactionsByDate[date];
              const dayCredits = dayTransactions.filter(t => t.transaction_type === "credit").reduce((s, t) => s + Math.abs(t.amount), 0);
              const dayDebits = dayTransactions.filter(t => t.transaction_type === "debit").reduce((s, t) => s + Math.abs(t.amount), 0);
              
              return (
                <div key={date} className="border-l-2 border-primary/20 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">
                      {format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-success">+ {formatCurrency(dayCredits)}</span>
                      <span className="text-destructive">- {formatCurrency(dayDebits)}</span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayTransactions.map((tx, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{tx.description}</TableCell>
                          <TableCell>
                            {tx.transaction_type === "credit" ? (
                              <Badge variant="default" className="bg-success">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Entrada
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Saída
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={tx.transaction_type === "credit" ? "text-success" : "text-destructive"}>
                            {tx.transaction_type === "credit" ? "+" : "-"} {formatCurrency(Math.abs(tx.amount))}
                          </TableCell>
                          <TableCell>
                            {tx.matched ? (
                              <Badge variant="default">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Conciliado
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
