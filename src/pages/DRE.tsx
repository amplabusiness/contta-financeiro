import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";

interface AccountBalance {
  account_code: string;
  account_name: string;
  total: number;
  parent_id: string | null;
}

const DRE = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    loadDREData();
  }, [selectedYear, selectedMonth]);

  const loadDREData = async () => {
    try {
      setLoading(true);
      
      // Carregar receitas (honorários pagos)
      let revenueQuery = supabase
        .from("invoices")
        .select("amount")
        .eq("status", "paid");

      if (selectedYear && selectedMonth) {
        const monthStr = selectedMonth.toString().padStart(2, '0');
        const competence = `${monthStr}/${selectedYear}`;
        revenueQuery = revenueQuery.eq("competence", competence);
      } else if (selectedYear) {
        revenueQuery = revenueQuery.like("competence", `%/${selectedYear}`);
      }

      const { data: invoices, error: invoicesError } = await revenueQuery;
      if (invoicesError) throw invoicesError;

      const revenue = invoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      setTotalRevenue(revenue);

      // Carregar despesas com plano de contas - FILTRAR APENAS CONTAS QUE COMEÇAM COM 4 (DESPESAS)
      let expensesQuery = supabase
        .from("expenses")
        .select(`
          amount,
          account_id,
          chart_of_accounts!inner (
            code,
            name,
            parent_id,
            type
          )
        `)
        .eq("status", "paid");

      if (selectedYear && selectedMonth) {
        const monthStr = selectedMonth.toString().padStart(2, '0');
        const competence = `${monthStr}/${selectedYear}`;
        expensesQuery = expensesQuery.eq("competence", competence);
      } else if (selectedYear) {
        expensesQuery = expensesQuery.like("competence", `%/${selectedYear}`);
      }

      const { data: expenses, error: expensesError } = await expensesQuery;
      if (expensesError) throw expensesError;

      // Organizar despesas por conta - Filtrar apenas contas que começam com 3 ou 4
      const balanceMap = new Map<string, AccountBalance>();
      
      expenses?.forEach((expense: any) => {
        if (expense.chart_of_accounts) {
          const code = expense.chart_of_accounts.code;
          // Filtrar apenas contas que começam com 3 (receita) ou 4 (despesa)
          if (code.startsWith('3') || code.startsWith('4')) {
            const key = code;
            const existing = balanceMap.get(key);
            
            if (existing) {
              existing.total += Number(expense.amount);
            } else {
              balanceMap.set(key, {
                account_code: code,
                account_name: expense.chart_of_accounts.name,
                total: Number(expense.amount),
                parent_id: expense.chart_of_accounts.parent_id,
              });
            }
          }
        }
      });

      const balances = Array.from(balanceMap.values()).sort((a, b) => 
        a.account_code.localeCompare(b.account_code)
      );

      setAccountBalances(balances);
      
      const totalExp = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
      setTotalExpenses(totalExp);

    } catch (error: any) {
      toast.error("Erro ao carregar dados da DRE");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const netResult = totalRevenue - totalExpenses;
  const isProfit = netResult >= 0;

  const getIndentLevel = (code: string) => {
    return code.split('.').length - 1;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">DRE - Demonstração do Resultado do Exercício</h1>
          <p className="text-muted-foreground">Análise de receitas, despesas e resultado líquido</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período para análise</CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="font-semibold text-lg">Receitas Totais (Honorários)</span>
                  <span className="text-xl font-bold text-success">{formatCurrency(totalRevenue)}</span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="font-semibold text-lg">Despesas Totais</span>
                  <span className="text-xl font-bold text-destructive">({formatCurrency(totalExpenses)})</span>
                </div>

                <div className={`flex justify-between items-center p-6 rounded-lg ${isProfit ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  <div className="flex items-center gap-2">
                    {isProfit ? (
                      <TrendingUp className="w-6 h-6 text-success" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-destructive" />
                    )}
                    <span className="font-bold text-xl">Resultado Líquido</span>
                  </div>
                  <span className={`text-2xl font-bold ${isProfit ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(Math.abs(netResult))}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Receitas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="font-medium">Honorários de Clientes</span>
                    <span className="font-bold text-success">{formatCurrency(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 font-bold bg-success/5 px-4 rounded">
                    <span>Total de Receitas</span>
                    <span className="text-success">{formatCurrency(totalRevenue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Despesas</CardTitle>
                <CardDescription>Organizadas por plano de contas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {accountBalances.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma despesa no período selecionado
                    </p>
                  ) : (
                    <>
                      {accountBalances.map((balance) => {
                        const indent = getIndentLevel(balance.account_code);
                        const isParent = balance.account_code.split('.').length <= 2;
                        
                        return (
                          <div
                            key={balance.account_code}
                            className={`flex justify-between items-center py-2 ${
                              isParent ? 'font-semibold bg-muted/50 px-3 rounded mt-2' : 'pl-3'
                            }`}
                            style={{ paddingLeft: `${indent * 1.5 + 0.75}rem` }}
                          >
                            <span className={isParent ? 'text-base' : 'text-sm'}>
                              {balance.account_code} - {balance.account_name}
                            </span>
                            <span className={`${isParent ? 'font-bold' : 'font-medium'} text-destructive`}>
                              {formatCurrency(balance.total)}
                            </span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between items-center py-3 mt-4 font-bold bg-destructive/5 px-4 rounded">
                        <span>Total de Despesas</span>
                        <span className="text-destructive">({formatCurrency(totalExpenses)})</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className={isProfit ? 'border-success' : 'border-destructive'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isProfit ? (
                    <>
                      <TrendingUp className="w-5 h-5 text-success" />
                      Lucro do Período
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-5 h-5 text-destructive" />
                      Prejuízo do Período
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-lg">
                    <span>Receitas Totais</span>
                    <span className="text-success font-semibold">{formatCurrency(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span>(-) Despesas Totais</span>
                    <span className="text-destructive font-semibold">({formatCurrency(totalExpenses)})</span>
                  </div>
                  <div className="border-t-2 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold">(=) Resultado Líquido</span>
                      <span className={`text-2xl font-bold ${isProfit ? 'text-success' : 'text-destructive'}`}>
                        {isProfit ? '' : '-'}{formatCurrency(Math.abs(netResult))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default DRE;
