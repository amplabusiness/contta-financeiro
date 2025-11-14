import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, FileDown, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [totalActive, setTotalActive] = useState(0);
  const [totalPassive, setTotalPassive] = useState(0);

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    setLoading(true);
    try {
      // Buscar todas as contas ativas
      const { data: accounts, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;

      // Buscar todos os lançamentos
      const { data: entries, error: entriesError } = await supabase
        .from("accounting_entry_lines" as any)
        .select("account_id, debit, credit");

      if (entriesError) throw entriesError;

      // Calcular saldos por conta
      const accountBalances: Record<string, { debit: number; credit: number }> = {};
      
      (entries as any)?.forEach((entry: any) => {
        if (!accountBalances[entry.account_id]) {
          accountBalances[entry.account_id] = { debit: 0, credit: 0 };
        }
        accountBalances[entry.account_id].debit += parseFloat(entry.debit?.toString() || "0");
        accountBalances[entry.account_id].credit += parseFloat(entry.credit?.toString() || "0");
      });

      // Separar contas de ATIVO e PASSIVO
      const activeList: AccountBalance[] = [];
      const passiveList: AccountBalance[] = [];
      let sumActive = 0;
      let sumPassive = 0;

      accounts?.forEach(account => {
        const accountData = account as any;
        const balance = accountBalances[accountData.id] || { debit: 0, credit: 0 };
        
        // Para ATIVO: saldo = débito - crédito
        // Para PASSIVO: saldo = crédito - débito
        const netBalance = accountData.type === 'ativo' 
          ? balance.debit - balance.credit 
          : balance.credit - balance.debit;

        // Calcular saldos das contas sintéticas somando as filhas
        let finalBalance = netBalance;
        
        if (accountData.is_synthetic) {
          const children = accounts.filter(a => {
            const aData = a as any;
            return aData.code.startsWith(accountData.code + ".") && 
              aData.code !== accountData.code;
          });
          
          finalBalance = children.reduce((sum, child) => {
            const childData = child as any;
            const childBalance = accountBalances[childData.id] || { debit: 0, credit: 0 };
            const childNet = childData.type === 'ativo' 
              ? childBalance.debit - childBalance.credit 
              : childBalance.credit - childBalance.debit;
            return sum + childNet;
          }, 0);
        }

        const accountBalance: AccountBalance = {
          code: accountData.code,
          name: accountData.name,
          type: accountData.type,
          is_synthetic: accountData.is_synthetic,
          debit: balance.debit,
          credit: balance.credit,
          balance: finalBalance,
          level: accountData.code.split(".").length,
        };

        if (accountData.code.startsWith('1')) {
          activeList.push(accountBalance);
          if (!accountData.is_synthetic && finalBalance > 0) {
            sumActive += finalBalance;
          }
        } else if (accountData.code.startsWith('2')) {
          passiveList.push(accountBalance);
          if (!accountData.is_synthetic && finalBalance > 0) {
            sumPassive += finalBalance;
          }
        }
      });

      setActiveAccounts(activeList);
      setPassiveAccounts(passiveList);
      setTotalActive(sumActive);
      setTotalPassive(sumPassive);
      
      if (Math.abs(sumActive - sumPassive) > 0.01) {
        toast.warning("Atenção: Balanço desbalanceado!");
      }
    } catch (error: any) {
      toast.error("Erro ao carregar balanço: " + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  const renderAccountsTable = (accounts: AccountBalance[], title: string) => (
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
          {accounts.map((account) => (
            <tr key={account.code} className={`border-b ${getRowStyle(account)}`}>
              <td className="p-2">{account.code}</td>
              <td className="p-2">{account.name}</td>
              <td className="p-2 text-right font-medium">
                {account.balance !== 0 ? formatCurrency(account.balance) : "-"}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-t-primary font-bold bg-primary/5">
            <td colSpan={2} className="p-2">TOTAL {title.toUpperCase()}</td>
            <td className="p-2 text-right text-primary">
              {formatCurrency(title === "ATIVO" ? totalActive : totalPassive)}
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
              Posição patrimonial da empresa
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

        {/* Alerta sobre balanço */}
        {Math.abs(totalActive - totalPassive) > 0.01 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O balanço está desbalanceado. Diferença: {formatCurrency(Math.abs(totalActive - totalPassive))}
            </AlertDescription>
          </Alert>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <CardTitle className="text-sm">Total Passivo + PL</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalPassive)}</p>
            </CardContent>
          </Card>
          
          <Card className={Math.abs(totalActive - totalPassive) < 0.01 ? "border-green-500" : "border-red-500"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Diferença</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${Math.abs(totalActive - totalPassive) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(Math.abs(totalActive - totalPassive))}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Balanço Patrimonial */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              {renderAccountsTable(activeAccounts, "ATIVO")}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {renderAccountsTable(passiveAccounts, "PASSIVO + PATRIMÔNIO LÍQUIDO")}
            </CardContent>
          </Card>
        </div>

        {/* Observação sobre lançamentos */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Nota:</strong> Os valores refletem os lançamentos contábeis registrados no sistema. 
            Certifique-se de que todas as receitas estão sendo lançadas nas contas adequadas (contas 3.x) 
            e não apenas como movimentação de ativo.
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
};

export default BalanceSheet;
