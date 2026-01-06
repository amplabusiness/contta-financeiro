import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, ChevronDown, X, Edit, Save } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useExpenseUpdate } from "@/contexts/ExpenseUpdateContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#84cc16", // Lime
  "#0ea5e9", // Sky
];

const CostCenterAssets = () => {
  const [loading, setLoading] = useState(true);
  const [costCenterData, setCostCenterData] = useState<any[]>([]);
  const [costCenterWithoutData, setCostCenterWithoutData] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [allCostCenters, setAllCostCenters] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth_, setSelectedMonth_] = useState<string | null>(null);
  const [selectedCostCenter, setSelectedCostCenter] = useState<any | null>(null);
  const [costCenterExpenses, setCostCenterExpenses] = useState<any[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [chartAccounts, setChartAccounts] = useState<any[]>([]);
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [savingCenterId, setSavingCenterId] = useState<string | null>(null);
  const [centerAccounts, setCenterAccounts] = useState<Map<string, string[]>>(new Map());
  const showMonthlyComparison = false;

  const months = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const { subscribeToExpenseChanges } = useExpenseUpdate();

  const loadCostCenterExpenses = async (costCenter: any) => {
    try {
      setLoadingExpenses(true);
      setSelectedCostCenter(costCenter);

      console.log("Buscando lançamentos para centro:", costCenter);

      let allExpenses: any[] = [];

      // Busca 1: Despesas com status="paid" - BUSCAR POR CÓDIGO OU NOME
      try {
        let query = supabase
          .from("vw_expenses_with_accounts")
          .select("*")
          .eq("status", "paid");

        if (selectedMonth_) {
          const competence = `${selectedMonth_}/${selectedYear}`;
          query = query.eq("competence", competence);
        } else {
          query = query.like("competence", `%/${selectedYear}`);
        }

        const { data: allExpenseData, error: expenseError } = await query;

        console.log("Total despesas pagas no período:", allExpenseData?.length);

        if (!expenseError && allExpenseData) {
          // Filtrar manualmente por código OU nome (case-insensitive)
          const filtered = allExpenseData.filter((expense: any) => {
            const expCenterCode = (expense.cost_center_code || "").toLowerCase();
            const expCenterName = (expense.cost_center_name || "").toLowerCase();
            const searchCode = costCenter.code.toLowerCase();
            const searchName = costCenter.name.toLowerCase();

            return expCenterCode === searchCode || expCenterName === searchName;
          });

          console.log("Despesas filtradas para", costCenter.name, ":", filtered.length);
          if (filtered.length > 0) {
            console.log("Primeiras despesas encontradas:", filtered.slice(0, 3).map(e => ({
              description: e.description,
              amount: e.amount,
              cost_center_name: e.cost_center_name,
              cost_center_code: e.cost_center_code
            })));
          }

          allExpenses = [...allExpenses, ...filtered];
        }
      } catch (err) {
        console.error("Erro ao buscar despesas:", err);
      }

      // Busca 2: Lançamentos contábeis que mencionam "Ampla Saúde" (SIMPLIFICADO)
      try {
        // Busca direta usando SQL para "Ampla Saúde"
        const { data: matchingEntries, error: entriesError } = await supabase
          .from("accounting_entries")
          .select("id, description, entry_date, entry_type")
          .ilike("description", `%${costCenter.name}%`);

        console.log("Lançamentos contábeis encontrados:", matchingEntries?.length);

        if (!entriesError && matchingEntries && matchingEntries.length > 0) {
          // Para cada lançamento, buscar as linhas
          const entriesWithLines = await Promise.all(
            matchingEntries.map(async (entry: any) => {
              const { data: lines } = await supabase
                .from("accounting_entry_lines")
                .select("debit, credit")
                .eq("entry_id", entry.id);

              const debitValue = lines?.reduce((sum, line) => sum + Number(line.debit || 0), 0) || 0;
              const creditValue = lines?.reduce((sum, line) => sum + Number(line.credit || 0), 0) || 0;
              const value = debitValue || creditValue;

              const entryDate = entry.entry_date || new Date().toISOString();
              const [year, month] = entryDate.split('-');

              return {
                id: entry.id,
                description: entry.description,
                expense_date: entryDate,
                created_at: entryDate,
                account_code: entry.entry_type,
                competence: month && year ? `${month}/${year}` : '',
                amount: value,
                name: entry.description
              };
            })
          );

          const validEntries = entriesWithLines.filter(entry => entry.amount > 0);
          console.log("Lançamentos com valor:", validEntries.length, validEntries);
          allExpenses = [...allExpenses, ...validEntries];
        }
      } catch (err) {
        console.error("Erro ao buscar lançamentos contábeis:", err);
      }

      console.log("Total de lançamentos encontrados:", allExpenses.length);

      // Ordena por data decrescente
      allExpenses.sort((a, b) => {
        const dateA = new Date(a.expense_date || a.created_at).getTime();
        const dateB = new Date(b.expense_date || b.created_at).getTime();
        return dateB - dateA;
      });

      setCostCenterExpenses(allExpenses);
    } catch (error: any) {
      console.error("Erro ao carregar lançamentos:", error);
      toast.error("Erro ao carregar lançamentos do centro de custo");
      setCostCenterExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  };

  useEffect(() => {
    loadAllCostCenters().then((centers) => {
      loadCostCenterData(centers);
    });
    loadChartAccounts();
  }, [selectedYear, selectedMonth_]);

  // Subscribe to expense changes and reload data automatically
  useEffect(() => {
    const unsubscribe = subscribeToExpenseChanges(() => {
      loadAllCostCenters().then((centers) => {
        loadCostCenterData(centers);
      });
    });

    return unsubscribe;
  }, [subscribeToExpenseChanges, selectedYear, selectedMonth_]);

  // Calcular centros sem movimentação
  useEffect(() => {
    if (allCostCenters.length > 0 && costCenterData.length >= 0) {
      const centrosComDados = new Set(costCenterData.map(c => c.code));
      const centersSemDados = allCostCenters.filter(
        center => !centrosComDados.has(center.code)
      );
      setCostCenterWithoutData(centersSemDados);
    }
  }, [allCostCenters, costCenterData]);

  const loadAllCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name, description, is_active, parent_id, default_chart_account_id, center_type")
        .eq("is_active", true)
        .eq("center_type", "assets")
        .order("order_index, code");

      if (error) throw error;

      const centers = data || [];
      setAllCostCenters(centers);

      // Carregar contas vinculadas para cada centro
      await loadCenterAccounts(centers);

      return centers;
    } catch (error: any) {
      console.error("Erro ao carregar centros de custo:", error);
      toast.error("Erro ao carregar centros de custo");
      return [];
    }
  };

  const loadCenterAccounts = async (centers: any[]) => {
    try {
      const accountMap = new Map<string, string[]>();

      for (const center of centers) {
        const { data } = await supabase
          .from("cost_center_accounts")
          .select("chart_account_id")
          .eq("cost_center_id", center.id);

        if (data && data.length > 0) {
          accountMap.set(center.id, data.map(item => item.chart_account_id));
        } else if (center.default_chart_account_id) {
          // Fallback para conta antiga
          accountMap.set(center.id, [center.default_chart_account_id]);
        } else {
          accountMap.set(center.id, []);
        }
      }

      setCenterAccounts(accountMap);
    } catch (error) {
      console.error("Erro ao carregar contas dos centros:", error);
    }
  };

  const loadChartAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setChartAccounts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar plano de contas:", error);
      toast.error("Erro ao carregar plano de contas");
    }
  };

  const handleAccountToggle = async (centerId: string, accountId: string, isSelected: boolean) => {
    try {
      setSavingCenterId(centerId);

      if (isSelected) {
        // Remover vínculo
        const { error } = await supabase
          .from("cost_center_accounts")
          .delete()
          .eq("cost_center_id", centerId)
          .eq("chart_account_id", accountId);

        if (error) throw error;
      } else {
        // Adicionar vínculo
        const { error } = await supabase
          .from("cost_center_accounts")
          .insert({ cost_center_id: centerId, chart_account_id: accountId });

        if (error) throw error;
      }

      toast.success(isSelected ? "Conta removida" : "Conta adicionada");
      await loadAllCostCenters();
    } catch (error: any) {
      console.error("Erro ao atualizar vínculo:", error);
      toast.error("Erro ao atualizar vínculo");
    } finally {
      setSavingCenterId(null);
    }
  };

  const loadCostCenterData = async (centersParam?: any[]) => {
    const costCentersToUse = centersParam || allCostCenters;
    try {
      setLoading(true);

      // Se não há centros de custo do tipo 'assets', retornar vazio
      if (costCentersToUse.length === 0) {
        setCostCenterData([]);
        setTotalExpenses(0);
        setLoading(false);
        return;
      }

      // Buscar despesas pagas com centros de custo
      let query = supabase
        .from("vw_expenses_with_accounts")
        .select("*")
        .eq("status", "paid");

      if (selectedMonth_) {
        // Se houver filtro de mês específico
        const competence = `${selectedMonth_}/${selectedYear}`;
        query = query.eq("competence", competence);
      } else {
        // Por padrão, mostrar todo o ano
        query = query.like("competence", `%/${selectedYear}`);
      }

      const { data: allExpenses, error } = await query;

      if (error) throw error;

      // Filtrar despesas apenas para centros de custo do tipo 'assets'
      const centerCodes = new Set(costCentersToUse.map(c => c.code));
      const expenses = allExpenses?.filter((expense: any) =>
        centerCodes.has(expense.cost_center_code)
      ) || [];

      // Buscar também saldos de abertura (lançamentos contábeis de abertura) com valores
      // Buscar tanto 'saldo_abertura' quanto 'opening_balance'
      const { data: openingBalancesType1 } = await supabase
        .from("accounting_entries")
        .select(`
          id,
          description,
          entry_date,
          accounting_entry_lines(debit, credit)
        `)
        .eq("entry_type", "saldo_abertura")
        .lte("entry_date", `${selectedYear}-12-31`);

      const { data: openingBalancesType2 } = await supabase
        .from("accounting_entries")
        .select(`
          id,
          description,
          entry_date,
          accounting_entry_lines(debit, credit)
        `)
        .eq("entry_type", "opening_balance")
        .lte("entry_date", `${selectedYear}-12-31`);

      const openingBalances = [...(openingBalancesType1 || []), ...(openingBalancesType2 || [])];

      // Agrupar por centro de custo (usando code + name)
      const costCenterMap = new Map<string, { total: number; code: string }>();
      let total = 0;

      // Processar despesas
      expenses?.forEach((expense) => {
        const costCenterName = (expense as any).cost_center_name || "Não Classificado";
        const costCenterCode = (expense as any).cost_center_code || "";
        const accountCode = (expense as any).account_code || "";
        const amount = Number(expense.amount);

        const key = `${costCenterCode} - ${costCenterName}`;
        const existing = costCenterMap.get(key) || { total: 0, code: costCenterCode };
        costCenterMap.set(key, {
          total: existing.total + amount,
          code: costCenterCode
        });
        total += amount;
      });

      // Processar saldos de abertura (extrair centro de custo da descrição)
      if (openingBalances && costCentersToUse.length > 0) {
        openingBalances.forEach((entry: any) => {
          const description = entry.description || "";
          // Procurar por padrão como "Saldo de Abertura - NOME" ou "Saldo de Abertura: NOME"
          // Tenta ambos os formatos (com hífen ou com dois-pontos)
          let match = description.match(/Saldo de Abertura\s*-\s*(.+?)(?:\s*\(|$)/);
          if (!match) {
            // Tenta formato com dois-pontos
            match = description.match(/Saldo de Abertura\s*:\s*(.+?)(?:\s*\(|$)/);
          }

          if (match) {
            const centerName = match[1].trim();
            // Procurar o centro correspondente (flexível para maiúsculas/minúsculas)
            const center = costCentersToUse.find(c =>
              c.name.toLowerCase() === centerName.toLowerCase()
            );
            if (center) {
              const centerCode = center.code || "";
              const key = `${centerCode} - ${center.name}`;
              // Extrair o valor do débito
              const lines = entry.accounting_entry_lines || [];
              const debitValue = lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);

              console.log(`Saldo encontrado: ${centerCode} = R$ ${debitValue}`);

              if (debitValue > 0) {
                const existing = costCenterMap.get(key) || { total: 0, code: centerCode };
                costCenterMap.set(key, {
                  total: existing.total + debitValue,
                  code: centerCode
                });
                total += debitValue;
              }
            } else {
              console.log(`Centro não encontrado: "${centerName}"`);
              console.log(`Centros disponíveis:`, costCentersToUse.map(c => c.name));
            }
          } else {
            console.log(`Descrição não correspondeu ao padrão esperado: "${description}"`);
          }
        });
      }

      // Converter para array e calcular percentuais
      const costCenterArray = Array.from(costCenterMap.entries())
        .map(([name, data]) => ({
          name,
          value: data.total,
          code: data.code,
          percentage: ((data.total / total) * 100).toFixed(2),
        }))
        .sort((a, b) => b.value - a.value);

      setCostCenterData(costCenterArray);
      setTotalExpenses(total);

      // Carregar comparação mensal (últimos 6 meses) - desabilitado pois a seção está oculta
      // await loadMonthlyComparison();
    } catch (error: any) {
      toast.error("Erro ao carregar dados de centro de custos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyComparison = async () => {
    try {
      const { data: expenses, error } = await supabase
        .from("vw_expenses_with_accounts")
        .select("*")
        .eq("status", "paid")
        .like("competence", `%/${selectedYear}`)

      if (error) throw error;

      // Agrupar por mês e centro de custo
      const monthlyMap = new Map<string, Map<string, number>>();

      expenses?.forEach((expense) => {
        const month = expense.competence?.split("/")[0];
        if (!month) return;

        const costCenterName = (expense as any).cost_center_name || "Não Classificado";
        const costCenterCode = (expense as any).cost_center_code || "";
        const costCenter = `${costCenterCode} - ${costCenterName}`;
        const amount = Number(expense.amount);

        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, new Map());
        }

        const centerMap = monthlyMap.get(month)!;
        centerMap.set(costCenter, (centerMap.get(costCenter) || 0) + amount);
      });

      // Converter para formato do gráfico
      const monthlyArray = Array.from(monthlyMap.entries())
        .map(([month, centerMap]) => {
          const monthData: any = { month: months.find((m) => m.value === month)?.label || month };
          centerMap.forEach((value, center) => {
            monthData[center] = value;
          });
          return monthData;
        })
        .sort((a, b) => {
          const monthA = months.findIndex((m) => m.label === a.month);
          const monthB = months.findIndex((m) => m.label === b.month);
          return monthA - monthB;
        });

      setMonthlyComparison(monthlyArray);
    } catch (error) {
      console.error("Erro ao carregar comparação mensal:", error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Centro de Custo Ativo</h1>
          <p className="text-muted-foreground">
            Visualize a alocação de ativos por departamento e controle sua distribuição
          </p>
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ChevronDown className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  Filtros Opcionais
                </CardTitle>
                <CardDescription>
                  {selectedMonth_ ? `${months.find(m => m.value === selectedMonth_)?.label}/${selectedYear}` : `Exibindo: Ano inteiro (${selectedYear})`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ano</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mês (Opcional)</label>
                  <select
                    value={selectedMonth_ || ''}
                    onChange={(e) => setSelectedMonth_(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
                  >
                    <option value="">Todos os meses</option>
                    {months.map(month => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedYear(new Date().getFullYear());
                  setSelectedMonth_(null);
                }}>
                  Resetar Filtros
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Total de Ativos</CardTitle>
              <CardDescription>Valor total de ativos no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{formatCurrency(totalExpenses)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Centro com Maior Valor</CardTitle>
              <CardDescription>Departamento com maior quantidade de ativos</CardDescription>
            </CardHeader>
            <CardContent>
              {costCenterData.length > 0 ? (
                <div>
                  <div className="text-2xl font-bold">{costCenterData[0].name}</div>
                  <div className="text-3xl font-bold text-destructive mt-2">
                    {formatCurrency(costCenterData[0].value)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {costCenterData[0].percentage}% do total
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Sem dados disponíveis</p>
              )}
            </CardContent>
          </Card>
        </div>

        {costCenterData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Centro de Custo</CardTitle>
              <CardDescription>Gráfico de pizza mostrando a participação de cada departamento</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {costCenterData.length > 0 ? (
                <div className="flex items-center gap-8">
                  <div style={{ width: "45%", height: "400px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costCenterData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          cursor="pointer"
                        >
                          {costCenterData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label: string) => label}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "2px solid #333",
                            borderRadius: "8px",
                            padding: "12px 16px",
                            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
                            zIndex: 9999,
                            opacity: 1,
                          }}
                          cursor="pointer"
                          wrapperStyle={{ outline: "none" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[400px]">
                    <div className="space-y-2">
                      {costCenterData.map((center, index) => (
                        <div key={center.name} className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm">{center.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados para exibir</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{costCenterData.length > 1 ? "Ranking de Valor por Centro de Custo" : "Centros de Custo"}</CardTitle>
            <CardDescription>Departamentos ordenados por valor de ativos (clique para ver lançamentos)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costCenterData.map((center, index) => (
                <div
                  key={center.name}
                  className="flex items-center gap-4 p-3 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => loadCostCenterExpenses(center)}
                >
                  <div className="text-2xl font-bold text-muted-foreground w-8">{index + 1}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{center.name}</span>
                      <span className="font-bold">{formatCurrency(center.value)}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${center.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{center.percentage}% do total</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {showMonthlyComparison && monthlyComparison.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evolução Mensal por Centro de Custo</CardTitle>
              <CardDescription>Comparação de ativos ao longo do ano</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                  <YAxis
                    stroke="hsl(var(--foreground))"
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  {costCenterData.map((center, index) => (
                    <Bar
                      key={center.name}
                      dataKey={center.name}
                      fill={COLORS[index % COLORS.length]}
                      radius={[8, 8, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {costCenterWithoutData.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900">
            <CardHeader>
              <CardTitle className="text-yellow-800 dark:text-yellow-200">Centros de Custo sem Ativos</CardTitle>
              <CardDescription className="text-yellow-700 dark:text-yellow-300">
                {costCenterWithoutData.length} centro(s) cadastrado(s) sem ativos registrado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {costCenterWithoutData.map((center) => (
                  <li key={center.id} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                    <span className="font-mono font-bold text-yellow-700 dark:text-yellow-400 min-w-fit">
                      {center.code}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {center.name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Vincular Centros de Custo ao Plano de Contas
            </CardTitle>
            <CardDescription>
              Configure qual conta contábil está vinculada a cada centro de custo. Este vínculo é usado para lançamentos automáticos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allCostCenters.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[400px]">Conta Contábil Padrão</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCostCenters.map((center) => {
                      const linkedAccount = chartAccounts.find(acc => acc.id === center.default_chart_account_id);
                      const isEditing = editingCenterId === center.id;
                      const isSaving = savingCenterId === center.id;

                      return (
                        <TableRow key={center.id}>
                          <TableCell className="font-mono font-medium">
                            {center.code}
                          </TableCell>
                          <TableCell className="font-medium">{center.name}</TableCell>
                          <TableCell>
                            {isEditing ? (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {chartAccounts.map((account) => {
                                  const linkedAccountIds = centerAccounts.get(center.id) || [];
                                  const isSelected = linkedAccountIds.includes(account.id);
                                  const level = (account.code.match(/\./g) || []).length;
                                  const indent = level * 20;

                                  return (
                                    <div key={account.id} className="flex items-center space-x-2" style={{ paddingLeft: `${indent}px` }}>
                                      <Checkbox
                                        id={`${center.id}-${account.id}`}
                                        checked={isSelected}
                                        onCheckedChange={() => handleAccountToggle(center.id, account.id, isSelected)}
                                        disabled={isSaving}
                                      />
                                      <label
                                        htmlFor={`${center.id}-${account.id}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                      >
                                        {account.code} - {account.name}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {(() => {
                                  const linkedAccountIds = centerAccounts.get(center.id) || [];
                                  const linkedAccs = chartAccounts.filter(acc =>
                                    linkedAccountIds.includes(acc.id) &&
                                    !acc.code.includes('.') // Apenas contas PAI (sem ponto no código)
                                  );

                                  if (linkedAccs.length === 0) {
                                    return <span className="text-muted-foreground italic">Nenhuma conta vinculada</span>;
                                  }

                                  return linkedAccs.map(acc => (
                                    <div key={acc.id} className="text-sm">
                                      <span className="font-mono font-medium">{acc.code}</span>
                                      <span className="text-muted-foreground"> - {acc.name}</span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingCenterId(null)}
                                disabled={isSaving}
                              >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingCenterId(center.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum centro de custo cadastrado</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={selectedCostCenter !== null} onOpenChange={(open) => {
          if (!open) {
            setSelectedCostCenter(null);
            setCostCenterExpenses([]);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCostCenter?.name}</DialogTitle>
              <DialogDescription>
                Lançamentos que compõem o valor de {formatCurrency(selectedCostCenter?.value || 0)}
              </DialogDescription>
            </DialogHeader>

            {loadingExpenses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : costCenterExpenses.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costCenterExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-sm">
                          {new Date(expense.expense_date || expense.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {expense.description || expense.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {expense.account_code || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {expense.competence || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(expense.amount) || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum lançamento encontrado para este centro de custo no período selecionado.
              </div>
            )}

            <div className="mt-6 pt-4 border-t flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total de lançamentos: {costCenterExpenses.length}</p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  Subtotal: {formatCurrency(
                    costCenterExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
                  )}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CostCenterAssets;
