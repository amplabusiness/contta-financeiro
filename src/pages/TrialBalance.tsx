import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, FileDown } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface AccountBalance {
  code: string;
  name: string;
  type: string;
  is_synthetic: boolean;
  debit: number;
  credit: number;
  balance: number;
}

const TrialBalance = () => {
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    setLoading(true);
    try {
      // Buscar todas as contas
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

      // Montar array de saldos
      const balanceArray: AccountBalance[] = [];
      let totalDebit = 0;
      let totalCredit = 0;

      accounts?.forEach(account => {
        const accountData = account as any;
        const balance = accountBalances[accountData.id] || { debit: 0, credit: 0 };
        const netBalance = balance.debit - balance.credit;

        // Contas sintéticas devem somar as filhas
        let finalDebit = balance.debit;
        let finalCredit = balance.credit;
        
        if (accountData.is_synthetic) {
          const children = accounts.filter(a => {
            const aData = a as any;
            return aData.code.startsWith(accountData.code + ".") && 
              aData.code !== accountData.code;
          });
          
          finalDebit = children.reduce((sum, child) => {
            const childData = child as any;
            const childBalance = accountBalances[childData.id] || { debit: 0, credit: 0 };
            return sum + childBalance.debit;
          }, 0);
          
          finalCredit = children.reduce((sum, child) => {
            const childData = child as any;
            const childBalance = accountBalances[childData.id] || { debit: 0, credit: 0 };
            return sum + childBalance.credit;
          }, 0);
        }

        balanceArray.push({
          code: accountData.code,
          name: accountData.name,
          type: accountData.type,
          is_synthetic: accountData.is_synthetic,
          debit: finalDebit,
          credit: finalCredit,
          balance: finalDebit - finalCredit,
        });

        if (!accountData.is_synthetic) {
          totalDebit += balance.debit;
          totalCredit += balance.credit;
        }
      });

      setBalances(balanceArray);
      setTotals({ debit: totalDebit, credit: totalCredit });
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        toast.warning("Atenção: Balancete desbalanceado!");
      }
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ativo: "ATIVO",
      passivo: "PASSIVO",
      receita: "RECEITA",
      despesa: "DESPESA",
    };
    return labels[type] || type;
  };

  const getRowStyle = (account: AccountBalance) => {
    if (account.code.length === 1) {
      return "font-bold text-lg bg-primary/10";
    }
    if (account.code.split(".").length === 2) {
      return "font-semibold bg-muted/50";
    }
    return "";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Balancete de Verificação</h1>
            <p className="text-muted-foreground">
              Saldos das contas contábeis
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

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Débitos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.debit)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Créditos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.credit)}</p>
            </CardContent>
          </Card>
          
          <Card className={Math.abs(totals.debit - totals.credit) < 0.01 ? "border-green-500" : "border-red-500"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Diferença</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${Math.abs(totals.debit - totals.credit) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(Math.abs(totals.debit - totals.credit))}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Código</th>
                    <th className="text-left p-2">Conta</th>
                    <th className="text-right p-2">Débito</th>
                    <th className="text-right p-2">Crédito</th>
                    <th className="text-right p-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((account) => (
                    <tr key={account.code} className={`border-b ${getRowStyle(account)}`}>
                      <td className="p-2">{account.code}</td>
                      <td className="p-2">{account.name}</td>
                      <td className="p-2 text-right">
                        {account.debit > 0 ? formatCurrency(account.debit) : "-"}
                      </td>
                      <td className="p-2 text-right">
                        {account.credit > 0 ? formatCurrency(account.credit) : "-"}
                      </td>
                      <td className={`p-2 text-right font-medium ${
                        account.balance > 0 ? "text-blue-600" : account.balance < 0 ? "text-red-600" : ""
                      }`}>
                        {account.balance !== 0 ? formatCurrency(Math.abs(account.balance)) : "-"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-t-primary font-bold bg-muted">
                    <td colSpan={2} className="p-2">TOTAIS</td>
                    <td className="p-2 text-right">{formatCurrency(totals.debit)}</td>
                    <td className="p-2 text-right">{formatCurrency(totals.credit)}</td>
                    <td className="p-2 text-right">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TrialBalance;
