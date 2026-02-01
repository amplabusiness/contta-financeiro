import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MonthlyDefault {
  month: string;
  amount: number;
  count: number;
}

export function DefaultEvolutionChart() {
  const [data, setData] = useState<MonthlyDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<"up" | "down" | "stable">("stable");

  useEffect(() => {
    loadDefaultEvolution();
  }, []);

  const loadDefaultEvolution = async () => {
    setLoading(true);
    try {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("competence, amount, due_date")
        .in("status", ["pending", "overdue"])
        .order("competence", { ascending: true });

      if (error) throw error;

      // Agrupar por mês de competência
      const monthlyMap = new Map<string, { amount: number; count: number }>();

      invoices?.forEach((invoice) => {
        const competence = invoice.competence || "Sem competência";
        
        if (!monthlyMap.has(competence)) {
          monthlyMap.set(competence, { amount: 0, count: 0 });
        }

        const monthly = monthlyMap.get(competence)!;
        monthly.amount += Number(invoice.amount);
        monthly.count += 1;
      });

      // Converter para array e ordenar
      const monthlyArray = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          amount: data.amount,
          count: data.count,
        }))
        .sort((a, b) => {
          // Ordenar por mês/ano
          const [monthA, yearA] = a.month.split("/");
          const [monthB, yearB] = b.month.split("/");
          return new Date(`${yearA}-${monthA}`).getTime() - new Date(`${yearB}-${monthB}`).getTime();
        })
        .slice(-12); // Últimos 12 meses

      setData(monthlyArray);

      // Calcular tendência
      if (monthlyArray.length >= 2) {
        const lastMonth = monthlyArray[monthlyArray.length - 1].amount;
        const previousMonth = monthlyArray[monthlyArray.length - 2].amount;
        const diff = lastMonth - previousMonth;
        
        if (diff > previousMonth * 0.05) {
          setTrend("up");
        } else if (diff < -previousMonth * 0.05) {
          setTrend("down");
        } else {
          setTrend("stable");
        }
      }
    } catch (error) {
      console.error("Erro ao carregar evolução da inadimplência:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    amount: {
      label: "Inadimplência",
      color: "hsl(var(--destructive))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Evolução da Inadimplência</CardTitle>
            <CardDescription>Últimos 12 meses - valores em atraso</CardDescription>
          </div>
          {!loading && data.length >= 2 && (
            <div className="flex items-center gap-2">
              {trend === "up" && (
                <>
                  <TrendingUp className="h-5 w-5 text-destructive" />
                  <span className="text-sm text-destructive font-medium">Aumentando</span>
                </>
              )}
              {trend === "down" && (
                <>
                  <TrendingDown className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-500 font-medium">Diminuindo</span>
                </>
              )}
              {trend === "stable" && (
                <span className="text-sm text-muted-foreground font-medium">Estável</span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado de inadimplência encontrado
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full !aspect-auto">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickFormatter={(value) => formatCurrency(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(Number(value))}</span>
                      </div>
                    )}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      return (
                        <div className="space-y-1">
                          <div className="font-medium">{label}</div>
                          {item && (
                            <div className="text-xs text-muted-foreground">
                              {item.count} fatura{item.count !== 1 ? "s" : ""} em atraso
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--destructive))"
                fillOpacity={1}
                fill="url(#colorAmount)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
