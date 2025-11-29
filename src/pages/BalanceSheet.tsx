import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, FileDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountBalance {
  code: string;
  name: string;
  type: string;
  is_synthetic: boolean;
  debit: number;
  credit: number;
  balance: number;
  level: number;
}

const BalanceSheet = () => {
  const [loading, setLoading] = useState(false);
  const [activeAccounts, setActiveAccounts] = useState<AccountBalance[]>([]);
  const [passiveAccounts, setPassiveAccounts] = useState<AccountBalance[]>([]);
  const [plAccounts, setPlAccounts] = useState<AccountBalance[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [totalPassive, setTotalPassive] = useState(0);
  const [totalPL, setTotalPL] = useState(0);
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  const loadBalances = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar TODAS as contas ativas (sem filtro de código - filtrar depois em JS)
      const { data: allAccounts, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, type, is_synthetic")
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;

      // Filtrar contas de Ativo (1.x), Passivo (2.x), Receita (3.x), Despesa (4.x) e PL (5.x) em JavaScript
      const accounts = allAccounts?.filter(acc =>
        acc.code.startsWith('1') || acc.code.startsWith('2') ||
        acc.code.startsWith('3') || acc.code.startsWith('4') || acc.code.startsWith('5')
      ) || [];

      // Buscar TODOS os lançamentos contábeis (sem filtro de data na query)
      const { data: entries, error: entriesError } = await supabase
        .from("accounting_entry_lines")
        .select(`
          account_id,
          debit,
          credit,
          entry_id(entry_date)
        `);

      if (entriesError) throw entriesError;

      // Filtrar por data em JavaScript (mais confiável)
      const filteredEntries = entries?.filter((entry: any) => {
        if (!endDate || !entry.entry_id?.entry_date) return true;
        return entry.entry_id.entry_date <= endDate;
      }) || [];

      // Calcular saldos por conta usando os lançamentos filtrados
      const accountBalances: Record<string, { debit: number; credit: number }> = {};

      filteredEntries.forEach((entry: any) => {
        if (!accountBalances[entry.account_id]) {
          accountBalances[entry.account_id] = { debit: 0, credit: 0 };
        }
        accountBalances[entry.account_id].debit += parseFloat(entry.debit?.toString() || "0");
        accountBalances[entry.account_id].credit += parseFloat(entry.credit?.toString() || "0");
      });

      console.log('Accounts loaded:', accounts?.length);
      console.log('Entries loaded:', filteredEntries.length);
      console.log('Account balances:', Object.keys(accountBalances).length);

      // Separar contas por tipo baseado no CÓDIGO
      const activeList: AccountBalance[] = [];
      const passiveList: AccountBalance[] = [];
      const plList: AccountBalance[] = [];
      let sumActive = 0;
      let sumPassive = 0;
      let sumPL = 0;
      let sumReceita = 0;  // Para calcular Resultado do Exercício
      let sumDespesa = 0;  // Para calcular Resultado do Exercício

      accounts?.forEach(account => {
        const primeiroDigito = account.code.charAt(0);
        const balance = accountBalances[account.id] || { debit: 0, credit: 0 };

        // Calcular saldo baseado na natureza da conta pelo CÓDIGO:
        // 1 = Ativo (natureza devedora): saldo = débito - crédito
        // 2 = Passivo (natureza credora): saldo = crédito - débito
        // 5 = PL (natureza credora): saldo = crédito - débito
        const isDevedora = primeiroDigito === '1';
        let netBalance = isDevedora
          ? balance.debit - balance.credit
          : balance.credit - balance.debit;

        // Para contas sintéticas, somar os saldos das contas filhas analíticas
        if (account.is_synthetic) {
          const childAccounts = accounts.filter(a =>
            a.code.startsWith(account.code + '.') && !a.is_synthetic
          );

          netBalance = childAccounts.reduce((sum, child) => {
            const childBalance = accountBalances[child.id] || { debit: 0, credit: 0 };
            const childIsDevedora = child.code.charAt(0) === '1';
            const childNet = childIsDevedora
              ? childBalance.debit - childBalance.credit
              : childBalance.credit - childBalance.debit;
            return sum + childNet;
          }, 0);
        }

        // Inferir tipo baseado no código
        const tipoInferido = (() => {
          switch (primeiroDigito) {
            case '1': return 'ATIVO';
            case '2': return 'PASSIVO';
            case '5': return 'PATRIMONIO_LIQUIDO';
            default: return 'OUTROS';
          }
        })();

        const accountBalance: AccountBalance = {
          code: account.code,
          name: account.name,
          type: tipoInferido,
          is_synthetic: account.is_synthetic,
          debit: balance.debit,
          credit: balance.credit,
          balance: netBalance,
          level: account.code.split(".").length,
        };

        // Separar por grupo baseado no código
        if (primeiroDigito === '1') {
          activeList.push(accountBalance);
          // Somar apenas contas analíticas com saldo positivo para totais
          if (!account.is_synthetic && netBalance > 0) {
            sumActive += netBalance;
          }
        } else if (primeiroDigito === '2') {
          passiveList.push(accountBalance);
          if (!account.is_synthetic && netBalance > 0) {
            sumPassive += netBalance;
          }
        } else if (primeiroDigito === '5') {
          plList.push(accountBalance);
          if (!account.is_synthetic && netBalance > 0) {
            sumPL += netBalance;
          }
        } else if (primeiroDigito === '3') {
          // Receitas (natureza credora): crédito - débito
          if (!account.is_synthetic) {
            sumReceita += balance.credit - balance.debit;
          }
        } else if (primeiroDigito === '4') {
          // Despesas (natureza devedora): débito - crédito
          if (!account.is_synthetic) {
            sumDespesa += balance.debit - balance.credit;
          }
        }
      });

      // Calcular Resultado do Exercício (Receitas - Despesas)
      const resultadoExercicio = sumReceita - sumDespesa;

      // Adicionar Resultado do Exercício à lista de PL
      if (resultadoExercicio !== 0) {
        plList.push({
          code: '5.1.1',
          name: 'Resultado do Exercício',
          type: 'PATRIMONIO_LIQUIDO',
          is_synthetic: false,
          debit: 0,
          credit: resultadoExercicio,
          balance: resultadoExercicio,
          level: 3,
        });
      }

      // Total de PL inclui Resultado do Exercício
      const totalPLComResultado = sumPL + resultadoExercicio;

      setActiveAccounts(activeList);
      setPassiveAccounts(passiveList);
      setPlAccounts(plList);
      setTotalActive(sumActive);
      setTotalPassive(sumPassive);
      setTotalPL(totalPLComResultado);

      const totalPassivoPL = sumPassive + totalPLComResultado;
      if (Math.abs(sumActive - totalPassivoPL) > 0.01) {
        toast.warning("Atenção: Balanço desbalanceado!");
      } else {
        toast.success("Balanço patrimonial balanceado!");
      }

      console.log('Resultado do Exercício:', resultadoExercicio);
      console.log('Total PL com Resultado:', totalPLComResultado);
    } catch (error: any) {
      toast.error("Erro ao carregar balanço: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [endDate]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const totalPassivoPL = totalPassive + totalPL;
  const isBalanced = Math.abs(totalActive - totalPassivoPL) < 0.01;

  const getRowStyle = (account: AccountBalance) => {
    if (account.level === 1) {
      return "font-bold text-base bg-primary/10";
    }
    if (account.level === 2) {
      return "font-semibold bg-muted/50";
    }
    if (account.level === 3) {
      return "pl-4";
    }
    return "pl-8 text-sm";
  };

  const renderAccountsTable = (accounts: AccountBalance[], title: string, total: number, colorClass: string) => (
    <div>
      <h3 className="text-lg font-bold mb-3 text-primary">{title}</h3>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Código</th>
            <th className="text-left p-2">Conta</th>
            <th className="text-right p-2">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-4 text-center text-muted-foreground">
                Nenhuma conta encontrada
              </td>
            </tr>
          ) : (
            accounts.map((account) => (
              <tr key={account.code} className={`border-b ${getRowStyle(account)}`}>
                <td className="p-2 font-mono text-sm">{account.code}</td>
                <td className="p-2">{account.name}</td>
                <td className="p-2 text-right font-medium">
                  {account.balance !== 0 ? formatCurrency(Math.abs(account.balance)) : "-"}
                </td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-t-primary font-bold bg-primary/5">
            <td colSpan={2} className="p-2">TOTAL {title.toUpperCase()}</td>
            <td className={`p-2 text-right ${colorClass}`}>
              {formatCurrency(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Balanço Patrimonial</h1>
            <p className="text-muted-foreground">
              Posição patrimonial da empresa (dados contábeis)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast.info("Em desenvolvimento")}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={loadBalances} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filtro de Data */}
        <Card>
          <CardHeader>
            <CardTitle>Período</CardTitle>
            <CardDescription>Posição patrimonial até a data selecionada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div>
                <Label htmlFor="endDate">Data Base</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button onClick={loadBalances} disabled={loading}>
                Aplicar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status do Balanço */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isBalanced ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Balanço Equilibrado
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Balanço Desbalanceado
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isBalanced
                ? "Ativo = Passivo + Patrimônio Líquido"
                : `Diferença: ${formatCurrency(Math.abs(totalActive - totalPassivoPL))}`}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Ativo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalActive)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Passivo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPassive)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Patrimônio Líquido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPL)}</p>
            </CardContent>
          </Card>

          <Card className={isBalanced ? "border-green-500" : "border-red-500"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Passivo + PL</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${isBalanced ? "text-purple-600" : "text-red-600"}`}>
                {formatCurrency(totalPassivoPL)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Balanço Patrimonial */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              {renderAccountsTable(activeAccounts, "ATIVO", totalActive, "text-blue-600")}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-6">
              {renderAccountsTable(passiveAccounts, "PASSIVO", totalPassive, "text-red-600")}

              <div className="border-t pt-4">
                {renderAccountsTable(plAccounts, "PATRIMÔNIO LÍQUIDO", totalPL, "text-green-600")}
              </div>

              {/* Total Passivo + PL */}
              <div className="border-t-2 border-primary pt-4">
                <div className="flex justify-between items-center font-bold text-lg bg-primary/10 p-3 rounded">
                  <span>TOTAL PASSIVO + PL</span>
                  <span className="text-purple-600">{formatCurrency(totalPassivoPL)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Observação */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Nota:</strong> Os valores refletem os lançamentos contábeis até {new Date(endDate).toLocaleDateString('pt-BR')}.
            Equação fundamental: <strong>Ativo = Passivo + Patrimônio Líquido</strong>
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
};

export default BalanceSheet;
