import { MetricCard } from "@/components/MetricCard";
import { ExpensesChart } from "@/components/ExpensesChart";
import { DistributionChart } from "@/components/DistributionChart";
import { ExpensesTable } from "@/components/ExpensesTable";
import { AIAccountantWidget } from "@/components/AIAccountantWidget";
import { expensesData, formatCurrency } from "@/data/expensesData";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Building, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const novemberData = expensesData.november;
  const decemberData = expensesData.december;

  const comparisonData = [
    {
      category: "Contas Fixas",
      november: novemberData.ampla.contasFixas,
      december: decemberData.ampla.contasFixas,
    },
    {
      category: "Impostos",
      november: novemberData.ampla.impostos,
      december: decemberData.ampla.impostos,
    },
    {
      category: "Variáveis",
      november: novemberData.ampla.contasVariaveis,
      december: decemberData.ampla.contasVariaveis,
    },
    {
      category: "Terceiros",
      november: novemberData.ampla.servicosTerceiros,
      december: decemberData.ampla.servicosTerceiros,
    },
    {
      category: "Folha",
      november: novemberData.ampla.folhaPagamento,
      december: decemberData.ampla.folhaPagamento,
    },
  ];

  const decemberDistribution = [
    { name: "Contas Fixas", value: decemberData.ampla.contasFixas },
    { name: "Impostos", value: decemberData.ampla.impostos },
    { name: "Variáveis", value: decemberData.ampla.contasVariaveis },
    { name: "Terceiros", value: decemberData.ampla.servicosTerceiros },
    { name: "Folha", value: decemberData.ampla.folhaPagamento },
    { name: "Material", value: decemberData.ampla.materialConsumo },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Dashboard Financeiro
          </h1>
          <p className="text-muted-foreground">
            Controle de Despesas - Novembro e Dezembro 2024
          </p>
        </header>

        <Tabs defaultValue="december" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="november">Novembro</TabsTrigger>
            <TabsTrigger value="december">Dezembro</TabsTrigger>
          </TabsList>

          <TabsContent value="november" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Faturamento"
                value={formatCurrency(novemberData.faturamento)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="Total Recebido"
                value={formatCurrency(novemberData.totalRecebido)}
                icon={TrendingUp}
                variant="success"
              />
              <MetricCard
                title="Total Despesas"
                value={formatCurrency(novemberData.totalSaidas)}
                icon={Wallet}
                variant="warning"
              />
              <MetricCard
                title="Resultado"
                value={formatCurrency(novemberData.resultado)}
                icon={TrendingUp}
                variant="success"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard
                title="Despesas Sérgio"
                value={formatCurrency(novemberData.sergio.total)}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Despesas Ampla"
                value={formatCurrency(novemberData.ampla.total)}
                icon={Building}
                variant="default"
              />
            </div>

            <ExpensesTable
              data={novemberData.sergio.items}
              title="Detalhamento - Despesas Sérgio"
              description="Novembro 2024"
            />
          </TabsContent>

          <TabsContent value="december" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Faturamento"
                value={formatCurrency(decemberData.faturamento)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="Total Recebido"
                value={formatCurrency(decemberData.totalRecebido)}
                icon={TrendingUp}
                variant="success"
              />
              <MetricCard
                title="Total Despesas"
                value={formatCurrency(decemberData.totalSaidas)}
                icon={Wallet}
                variant="warning"
              />
              <MetricCard
                title="Resultado"
                value={formatCurrency(decemberData.resultado)}
                icon={TrendingDown}
                variant="destructive"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard
                title="Despesas Sérgio"
                value={formatCurrency(decemberData.sergio.total)}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Despesas Ampla"
                value={formatCurrency(decemberData.ampla.total)}
                icon={Building}
                variant="default"
              />
            </div>

            <ExpensesTable
              data={decemberData.sergio.items}
              title="Detalhamento - Despesas Sérgio"
              description="Dezembro 2024"
            />
          </TabsContent>
        </Tabs>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <ExpensesChart data={comparisonData} />
          <DistributionChart
            data={decemberDistribution}
            title="Distribuição de Gastos Ampla"
            description="Dezembro 2024"
          />
          <AIAccountantWidget />
        </div>
      </div>
    </div>
  );
};

export default Index;
