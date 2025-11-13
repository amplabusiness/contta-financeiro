import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/data/expensesData";
import { TrendingUp, TrendingDown, CheckCircle2, XCircle, AlertCircle, Clock, Target, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ReconciliationKPIsProps {
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  totalCredit: number;
  totalDebit: number;
  matchedCredit: number;
  matchedDebit: number;
  averageConfidence: number;
  lastImportDate?: string;
}

export function ReconciliationKPIs({
  totalTransactions,
  matchedTransactions,
  unmatchedTransactions,
  totalCredit,
  totalDebit,
  matchedCredit,
  matchedDebit,
  averageConfidence,
  lastImportDate,
}: ReconciliationKPIsProps) {
  const matchRate = totalTransactions > 0 ? (matchedTransactions / totalTransactions) * 100 : 0;
  const creditMatchRate = totalCredit > 0 ? (matchedCredit / totalCredit) * 100 : 0;
  const debitMatchRate = totalDebit > 0 ? (matchedDebit / totalDebit) * 100 : 0;
  const unmatchedCreditValue = totalCredit - matchedCredit;
  const unmatchedDebitValue = totalDebit - matchedDebit;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conciliação</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matchRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {matchedTransactions} de {totalTransactions} transações
            </p>
            <Progress value={matchRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confiança Média</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageConfidence.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              Dos matches realizados
            </p>
            <Progress value={averageConfidence} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente Análise</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unmatchedTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Transações não conciliadas
            </p>
            <div className="mt-2 text-xs">
              <div className="flex justify-between">
                <span className="text-success">Entradas:</span>
                <span>{formatCurrency(unmatchedCreditValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-destructive">Saídas:</span>
                <span>{formatCurrency(unmatchedDebitValue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Importação</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastImportDate ? new Date(lastImportDate).toLocaleDateString("pt-BR") : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Data do último extrato
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análise de Entradas</CardTitle>
            <CardDescription>Receitas e recebimentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="font-medium">Total de Entradas</span>
              </div>
              <span className="text-lg font-bold text-success">{formatCurrency(totalCredit)}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Conciliadas</span>
                <span className="font-medium">{formatCurrency(matchedCredit)}</span>
              </div>
              <Progress value={creditMatchRate} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{creditMatchRate.toFixed(1)}% conciliado</span>
                <span>{formatCurrency(unmatchedCreditValue)} pendente</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análise de Saídas</CardTitle>
            <CardDescription>Despesas e pagamentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <span className="font-medium">Total de Saídas</span>
              </div>
              <span className="text-lg font-bold text-destructive">{formatCurrency(totalDebit)}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Conciliadas</span>
                <span className="font-medium">{formatCurrency(matchedDebit)}</span>
              </div>
              <Progress value={debitMatchRate} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{debitMatchRate.toFixed(1)}% conciliado</span>
                <span>{formatCurrency(unmatchedDebitValue)} pendente</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
