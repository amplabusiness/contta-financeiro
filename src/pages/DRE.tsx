import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { TrendingUp, TrendingDown, RefreshCw, ArrowRightLeft, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { isEdgeFunctionError } from "@/lib/edgeFunctionUtils";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DREAccount {
  account_code: string;
  account_name: string;
  account_id: string;
  total: number;
  isSynthetic: boolean;
}

interface AccountEntry {
  id: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  reference_type: string;
}

interface DREData {
  revenueAccounts: DREAccount[];
  expenseAccounts: DREAccount[];
  totalRevenue: number;
  totalExpenses: number;
}

interface AvailableAccount {
  id: string;
  code: string;
  name: string;
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

  // Estado para modal de detalhes
  const [selectedAccount, setSelectedAccount] = useState<DREAccount | null>(null);
  const [accountEntries, setAccountEntries] = useState<AccountEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Estado para reclassificação
  const [availableAccounts, setAvailableAccounts] = useState<AvailableAccount[]>([]);
  const [reclassifyingEntryId, setReclassifyingEntryId] = useState<string | null>(null);
  const [selectedNewAccount, setSelectedNewAccount] = useState<string>("");

  const syncExpensesToAccounting = useCallback(async (start: string | null, end: string | null) => {
    if (!start || !end) {
      return;
    }

    try {
      // Timeout de 30 segundos para evitar travamentos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const { data, error } = await supabase.functions.invoke('smart-accounting', {
        body: {
          action: 'generate_retroactive',
          table: 'expenses',
          start_date: start,
          end_date: end
        }
      });

      clearTimeout(timeoutId);

      if (error) throw error;

      if (data?.created) {
        console.log(`[DRE] ${data.created} lançamentos de despesas sincronizados para o período.`);
        toast.success(`${data.created} lançamentos sincronizados`);
      }
    } catch (syncError: any) {
      // Ignorar erros de timeout/rede/Edge Function silenciosamente
      if (syncError?.name === 'AbortError' || syncError?.message?.includes('timeout')) {
        console.log('[DRE] Sincronização ignorada por timeout');
      } else if (isEdgeFunctionError(syncError)) {
        console.log('[DRE] Sincronização ignorada - Edge Function indisponível');
      } else {
        console.error("Erro ao sincronizar despesas para a DRE:", syncError);
      }
    }
  }, []);

  const loadDREData = useCallback(async (shouldSync: boolean = false) => {
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

      // Só sincroniza se explicitamente solicitado (evita loop infinito)
      if (shouldSync) {
        await syncExpensesToAccounting(startDate, endDate);
      }

      // Buscar TODOS os lançamentos contábeis com paginação (Supabase limita a 1000 por padrão)
      const allLines: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data: pageData, error: linesError } = await supabase
          .from('accounting_entry_lines')
          .select(`
            debit,
            credit,
            account_id,
            entry_id(entry_date, competence_date)
          `)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (linesError) throw linesError;

        if (!pageData || pageData.length === 0) break;
        allLines.push(...pageData);

        if (pageData.length < pageSize) break;
        page++;
      }

      console.log(`[DRE] Carregadas ${allLines.length} linhas contábeis`);

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
          account_id: account.id,
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

  // Carregar dados quando o período mudar (sem sincronizar automaticamente)
  useEffect(() => {
    loadDREData(false);
  }, [selectedYear, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const netResult = dreData.totalRevenue - dreData.totalExpenses;
  const isProfit = netResult >= 0;

  const getIndentLevel = (code: string) => {
    return code.split('.').length - 1;
  };

  // Função para carregar lançamentos de uma conta
  const loadAccountEntries = async (account: DREAccount) => {
    if (account.isSynthetic) return; // Não carregar para contas sintéticas

    setSelectedAccount(account);
    setLoadingEntries(true);

    try {
      // Construir filtro de data
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (selectedYear && selectedMonth) {
        startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDay}`;
      } else if (selectedYear) {
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
      }

      // Buscar lançamentos da conta com paginação
      const data: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data: pageData, error } = await supabase
          .from('accounting_entry_lines')
          .select(`
            id,
            debit,
            credit,
            description,
            entry_id (
              id,
              entry_date,
              competence_date,
              description,
              reference_type
            )
          `)
          .eq('account_id', account.account_id)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (!pageData || pageData.length === 0) break;
        data.push(...pageData);

        if (pageData.length < pageSize) break;
        page++;
      }

      // Filtrar por data e formatar
      const entries: AccountEntry[] = (data || [])
        .filter((line: any) => {
          if (!startDate || !endDate) return true;
          const lineDate = line.entry_id?.competence_date || line.entry_id?.entry_date;
          if (!lineDate) return true;
          return lineDate >= startDate && lineDate <= endDate;
        })
        .filter((line: any) => (line.debit || 0) > 0 || (line.credit || 0) > 0)
        .map((line: any) => ({
          id: line.id,
          entry_date: line.entry_id?.competence_date || line.entry_id?.entry_date || '',
          description: line.entry_id?.description || line.description || 'Sem descrição',
          debit: line.debit || 0,
          credit: line.credit || 0,
          reference_type: line.entry_id?.reference_type || ''
        }))
        .sort((a: AccountEntry, b: AccountEntry) => b.debit - a.debit); // Ordenar por valor

      setAccountEntries(entries);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
      toast.error('Erro ao carregar detalhes da conta');
    } finally {
      setLoadingEntries(false);
    }
  };

  // Toggle para expandir/contrair conta inline
  const toggleAccountExpansion = (accountCode: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountCode)) {
      newExpanded.delete(accountCode);
    } else {
      newExpanded.add(accountCode);
    }
    setExpandedAccounts(newExpanded);
  };

  // Carregar contas disponíveis para reclassificação
  const loadAvailableAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('is_active', true)
        .eq('is_analytical', true)
        .or('code.like.3.%,code.like.4.%,code.like.1.1.3.%') // Receitas, Despesas e Adiantamentos
        .order('code');

      if (error) throw error;
      setAvailableAccounts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  // Carregar contas disponíveis ao montar o componente
  useEffect(() => {
    loadAvailableAccounts();
  }, []);

  // Função para reclassificar um lançamento
  const reclassifyEntry = async (entryLineId: string, newAccountId: string) => {
    if (!newAccountId) {
      toast.error('Selecione uma conta de destino');
      return;
    }

    try {
      const { error } = await supabase
        .from('accounting_entry_lines')
        .update({ account_id: newAccountId })
        .eq('id', entryLineId);

      if (error) throw error;

      // Encontrar nome da nova conta
      const newAccount = availableAccounts.find(a => a.id === newAccountId);
      toast.success(`Lançamento movido para ${newAccount?.code} - ${newAccount?.name}`);

      // Recarregar lançamentos da conta atual
      if (selectedAccount) {
        loadAccountEntries(selectedAccount);
      }

      // Recarregar DRE
      loadDREData(false);

      // Limpar estado de reclassificação
      setReclassifyingEntryId(null);
      setSelectedNewAccount("");

    } catch (error) {
      console.error('Erro ao reclassificar:', error);
      toast.error('Erro ao reclassificar lançamento');
    }
  };

  const renderAccountList = (accounts: DREAccount[], isExpense: boolean) => {
    if (accounts.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">
          Nenhum lançamento no período selecionado
        </p>
      );
    }

    type DRENode = DREAccount & { children?: DRENode[] };

    const buildHierarchy = (items: DREAccount[]) => {
      const nodesByCode = new Map<string, DRENode>();

      items
        .sort((a, b) => a.account_code.localeCompare(b.account_code))
        .forEach((acc) => {
          nodesByCode.set(acc.account_code, { ...acc, children: [] });
        });

      const roots: DRENode[] = [];

      nodesByCode.forEach((node, code) => {
        const parentCode = code.split(".").slice(0, -1).join(".");
        if (parentCode && nodesByCode.has(parentCode)) {
          nodesByCode.get(parentCode)!.children!.push(node);
        } else {
          roots.push(node);
        }
      });

      nodesByCode.forEach((node) =>
        node.children?.sort((a, b) => a.account_code.localeCompare(b.account_code))
      );

      return roots.sort((a, b) => a.account_code.localeCompare(b.account_code));
    };

    const renderNode = (node: DRENode, level: number): JSX.Element[] => {
      const hasChildren = (node.children?.length || 0) > 0;
      const isExpanded = expandedAccounts.has(node.account_code);
      const isParent = node.isSynthetic;
      const isClickable = !isParent;

      const row = (
        <div
          key={node.account_code}
          className={`py-2 ${
            isParent ? "font-semibold bg-muted/50 px-3 rounded mt-2" : "pl-3"
          }`}
          style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
        >
          <div
            className={`flex justify-between items-center ${
              isClickable ? "cursor-pointer hover:bg-muted/30 rounded px-2 py-1 -mx-2 transition-colors" : ""
            }`}
            onClick={() => isClickable && loadAccountEntries(node)}
          >
            <span className={`flex items-center gap-2 ${isParent ? "text-base" : "text-sm"}`}>
              {hasChildren && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleAccountExpansion(node.account_code);
                  }}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              <span className={isClickable ? "text-primary hover:underline" : ""}>
                {node.account_code} - {node.account_name}
              </span>
            </span>
            <span className={`${isParent ? "font-bold" : "font-medium"} ${isExpense ? "text-destructive" : "text-success"}`}>
              {formatCurrency(node.total)}
            </span>
          </div>
        </div>
      );

      if (!hasChildren || !isExpanded) {
        return [row];
      }

      const children = node.children!.flatMap((child) => renderNode(child, level + 1));
      return [row, ...children];
    };

    const tree = buildHierarchy(accounts);

    return (
      <>
        {tree.flatMap((node) => renderNode(node, 0))}
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
          <Button onClick={() => loadDREData(true)} disabled={loading}>
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

        {/* Modal de detalhes da conta */}
        <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedAccount?.account_code} - {selectedAccount?.account_name}
              </DialogTitle>
              <DialogDescription>
                Lançamentos que compõem o valor de {formatCurrency(selectedAccount?.total || 0)}
              </DialogDescription>
            </DialogHeader>

            {loadingEntries ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : accountEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum lançamento encontrado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Reclassificar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="line-clamp-2">{entry.description}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : formatCurrency(entry.credit)}
                      </TableCell>
                      <TableCell>
                        {reclassifyingEntryId === entry.id ? (
                          <div className="flex items-center gap-2">
                            <Select value={selectedNewAccount} onValueChange={setSelectedNewAccount}>
                              <SelectTrigger className="w-[280px] h-8 text-xs">
                                <SelectValue placeholder="Selecione a conta..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {availableAccounts
                                  .filter(a => a.id !== selectedAccount?.account_id)
                                  .map((account) => (
                                    <SelectItem key={account.id} value={account.id} className="text-xs">
                                      {account.code} - {account.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 px-2"
                              onClick={() => reclassifyEntry(entry.id, selectedNewAccount)}
                              disabled={!selectedNewAccount}
                            >
                              OK
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => {
                                setReclassifyingEntryId(null);
                                setSelectedNewAccount("");
                              }}
                            >
                              X
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => setReclassifyingEntryId(entry.id)}
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                            Mover
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {accountEntries.length} lançamento(s)
              </span>
              <span className="text-sm font-medium">
                Total: <strong>{formatCurrency(accountEntries.reduce((sum, e) => sum + (e.debit || e.credit), 0))}</strong>
              </span>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default DRE;
