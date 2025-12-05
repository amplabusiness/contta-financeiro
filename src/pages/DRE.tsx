import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { Button } from "@/components/ui/button";

interface DREAccount {
  account_code: string;
  account_name: string;
  total: number;
  isSynthetic: boolean;
}

interface DREData {
  revenueAccounts: DREAccount[];
  expenseAccounts: DREAccount[];
  totalRevenue: number;
  totalExpenses: number;
}

const DRE = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const [loading, setLoading] = useState(true);
  const [dreData, setDreData] = useState<DREData>({
    revenueAccounts: [],
    expenseAccounts: [],
    totalRevenue: 0,
    totalExpenses: 0
  });

  const syncExpensesToAccounting = useCallback(async (start: string | null, end: string | null) => {
    if (!start || !end) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: {
          action: 'generate_retroactive',
          table: 'expenses',
          start_date: start,
          end_date: end
        }
      });

      if (error) throw error;

      if (data?.created) {
        console.log(`[DRE] ${data.created} lançamentos de despesas sincronizados para o período.`);
      }
    } catch (syncError) {
      console.error("Erro ao sincronizar despesas para a DRE:", syncError);
    }
  }, []);

  const loadDREData = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar TODAS as contas ativas (filtrar em JS para evitar problemas com .or())
      const { data: allAccounts, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type, is_synthetic')
        .eq('is_active', true)
        .order('code');

      if (accountsError) throw accountsError;

      // Filtrar contas de receita (3.x) e despesa (4.x) em JavaScript
      const accounts = allAccounts?.filter(acc =>
        acc.code.startsWith('3') || acc.code.startsWith('4')
      ) || [];

      if (accounts.length === 0) {
        setDreData({
          revenueAccounts: [],
          expenseAccounts: [],
          totalRevenue: 0,
          totalExpenses: 0
        });
        return;
      }

      // Construir filtro de data baseado no período selecionado
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (selectedYear && selectedMonth) {
        // Período específico (mês/ano)
        const year = selectedYear;
        const month = selectedMonth;
        startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        // Último dia do mês
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      } else if (selectedYear) {
        // Ano inteiro
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
      }

      await syncExpensesToAccounting(startDate, endDate);

      // Buscar TODOS os lançamentos contábeis (sem filtro na query)
      const { data: allLines, error: linesError } = await supabase
        .from('accounting_entry_lines')
        .select(`
          debit,
          credit,
          account_id,
          entry_id(entry_date, competence_date)
        `);

      if (linesError) throw linesError;

      // Filtrar por data em JavaScript (usar competence_date se disponível, senão entry_date)
      const filteredLines = allLines?.filter((line: any) => {
        if (!startDate || !endDate) return true;

        // Usar competence_date se disponível, senão entry_date
        const lineDate = line.entry_id?.competence_date || line.entry_id?.entry_date;
        if (!lineDate) return true; // Incluir se não tiver data

        return lineDate >= startDate && lineDate <= endDate;
      }) || [];

      // Criar mapa de saldos por conta usando linhas filtradas
      const accountTotals = new Map<string, { debit: number; credit: number }>();

      filteredLines.forEach((line: any) => {
        const current = accountTotals.get(line.account_id) || { debit: 0, credit: 0 };
        current.debit += line.debit || 0;
        current.credit += line.credit || 0;
        accountTotals.set(line.account_id, current);
      });

      // Processar contas
      const revenueAccounts: DREAccount[] = [];
      const expenseAccounts: DREAccount[] = [];

      for (const account of accounts) {
        let totalDebito = 0;
        let totalCredito = 0;

        if (account.is_synthetic) {
          // Para contas sintéticas, somar os valores das contas filhas
          const childAccounts = accounts.filter(a =>
            a.code.startsWith(account.code + '.') && !a.is_synthetic
          );

          childAccounts.forEach(child => {
            const childTotals = accountTotals.get(child.id);
            if (childTotals) {
              totalDebito += childTotals.debit;
              totalCredito += childTotals.credit;
            }
          });
        } else {
          // Para contas analíticas, usar os valores diretos
          const accountTotal = accountTotals.get(account.id);
          if (accountTotal) {
            totalDebito = accountTotal.debit;
            totalCredito = accountTotal.credit;
          }
        }

        // Pular contas sem movimento
        if (totalDebito === 0 && totalCredito === 0) {
          continue;
        }

        const isRevenue = account.code.startsWith('3');

        // Para DRE:
        // Receita (3.x): natureza credora - valor = crédito - débito
        // Despesa (4.x): natureza devedora - valor = débito - crédito
        const total = isRevenue
          ? totalCredito - totalDebito  // Receita: crédito aumenta, débito diminui
          : totalDebito - totalCredito; // Despesa: débito aumenta, crédito diminui

        const dreAccount: DREAccount = {
          account_code: account.code,
          account_name: account.name,
          total: Math.abs(total), // Sempre positivo para exibição
          isSynthetic: account.is_synthetic
        };

        if (isRevenue) {
          revenueAccounts.push(dreAccount);
        } else {
          expenseAccounts.push(dreAccount);
        }
      }

      // Calcular totais usando apenas contas analíticas
      const analyticalRevenue = revenueAccounts.filter(a => !a.isSynthetic);
      const analyticalExpenses = expenseAccounts.filter(a => !a.isSynthetic);

      const totalRevenue = analyticalRevenue.reduce((sum, acc) => sum + acc.total, 0);
      const totalExpenses = analyticalExpenses.reduce((sum, acc) => sum + acc.total, 0);

      setDreData({
        revenueAccounts,
        expenseAccounts,
        totalRevenue,
        totalExpenses
      });

    } catch (error: any) {
      toast.error("Erro ao carregar dados da DRE");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, syncExpensesToAccounting]);

  useEffect(() => {
    loadDREData();
  }, [loadDREData]);

  const netResult = dreData.totalRevenue - dreData.totalExpenses;
  const isProfit = netResult >= 0;

  const getIndentLevel = (code: string) => {
    return code.split('.').length - 1;
  };

  const renderAccountList = (accounts: DREAccount[], isExpense: boolean) => {
    if (accounts.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">
          Nenhum lançamento no período selecionado
        </p>
      );
    }

    return (
      <>
        {accounts.map((account) => {
          const indent = getIndentLevel(account.account_code);
          const isParent = account.isSynthetic;

          return (
            <div
              key={account.account_code}
              className={`flex justify-between items-center py-2 ${
                isParent ? 'font-semibold bg-muted/50 px-3 rounded mt-2' : 'pl-3'
              }`}
              style={{ paddingLeft: `${indent * 1.5 + 0.75}rem` }}
            >
              <span className={isParent ? 'text-base' : 'text-sm'}>
                {account.account_code} - {account.account_name}
              </span>
              <span className={`${isParent ? 'font-bold' : 'font-medium'} ${isExpense ? 'text-destructive' : 'text-success'}`}>
                {formatCurrency(account.total)}
              </span>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">DRE - Demonstração do Resultado do Exercício</h1>
            <p className="text-muted-foreground">Análise de receitas, despesas e resultado líquido (dados contábeis)</p>
          </div>
          <Button onClick={loadDREData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período para análise (baseado em competence_date)</CardDescription>
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
                  <span className="font-semibold text-lg">Receitas Totais</span>
                  <span className="text-xl font-bold text-success">{formatCurrency(dreData.totalRevenue)}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="font-semibold text-lg">Despesas Totais</span>
                  <span className="text-xl font-bold text-destructive">({formatCurrency(dreData.totalExpenses)})</span>
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
                    {isProfit ? '' : '-'}{formatCurrency(Math.abs(netResult))}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Receitas</CardTitle>
                <CardDescription>Contas do grupo 3 - Receitas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {renderAccountList(dreData.revenueAccounts, false)}
                  <div className="flex justify-between items-center py-3 mt-4 font-bold bg-success/5 px-4 rounded">
                    <span>Total de Receitas</span>
                    <span className="text-success">{formatCurrency(dreData.totalRevenue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Despesas</CardTitle>
                <CardDescription>Contas do grupo 4 - Despesas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {renderAccountList(dreData.expenseAccounts, true)}
                  <div className="flex justify-between items-center py-3 mt-4 font-bold bg-destructive/5 px-4 rounded">
                    <span>Total de Despesas</span>
                    <span className="text-destructive">({formatCurrency(dreData.totalExpenses)})</span>
                  </div>
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
                    <span className="text-success font-semibold">{formatCurrency(dreData.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span>(-) Despesas Totais</span>
                    <span className="text-destructive font-semibold">({formatCurrency(dreData.totalExpenses)})</span>
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
