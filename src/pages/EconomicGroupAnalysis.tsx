import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Users,
  AlertTriangle,
  TrendingDown,
  Building2,
  Network,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Partner {
  id: string;
  name: string;
  cpf: string;
  companies_count: number;
  total_revenue: number;
  percentage_of_total: number;
}

interface EconomicGroup {
  group_name: string;
  partners: string[];
  companies: Array<{ id: string; name: string; revenue: number }>;
  total_revenue: number;
  percentage_of_total: number;
  risk_level: "high" | "medium" | "low";
}

const EconomicGroupAnalysis = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [economicGroups, setEconomicGroups] = useState<EconomicGroup[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch partners (shareholders)
      const { data: partnersData, error: partnersError } = await supabase
        .from("client_partners")
        .select(`
          *,
          clients (
            id,
            name
          )
        `);

      if (partnersError) throw partnersError;

      // Fetch invoices for the current year
      const currentYear = new Date().getFullYear();
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("client_id, amount, status")
        .like("competence", `%/${currentYear}`);

      if (invoicesError) throw invoicesError;

      // Calculate revenue per client
      const clientRevenueMap = new Map<string, number>();
      const totalRev = invoicesData?.reduce((sum, inv) => {
        const amount = Number(inv.amount);
        clientRevenueMap.set(
          inv.client_id,
          (clientRevenueMap.get(inv.client_id) || 0) + amount
        );
        return sum + amount;
      }, 0) || 0;

      setTotalRevenue(totalRev);

      // Group by partner
      const partnerMap = new Map<
        string,
        { name: string; cpf: string; companies: Set<string>; revenue: number }
      >();

      partnersData?.forEach((partner: any) => {
        const key = partner.cpf || partner.name;
        if (!partnerMap.has(key)) {
          partnerMap.set(key, {
            name: partner.name,
            cpf: partner.cpf,
            companies: new Set(),
            revenue: 0,
          });
        }

        const partnerData = partnerMap.get(key)!;
        partnerData.companies.add(partner.client_id);

        const clientRevenue = clientRevenueMap.get(partner.client_id) || 0;
        partnerData.revenue += clientRevenue;
      });

      // Create partners array
      const partnersArray: Partner[] = Array.from(partnerMap.entries())
        .map(([key, data]) => ({
          id: key,
          name: data.name,
          cpf: data.cpf,
          companies_count: data.companies.size,
          total_revenue: data.revenue,
          percentage_of_total: totalRev > 0 ? (data.revenue / totalRev) * 100 : 0,
        }))
        .filter((p) => p.companies_count > 1) // Only partners with multiple companies
        .sort((a, b) => b.total_revenue - a.total_revenue);

      setPartners(partnersArray);

      // Identify economic groups (partners who share multiple companies)
      identifyEconomicGroups(partnersData || [], clientRevenueMap, totalRev);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const identifyEconomicGroups = (
    partnersData: any[],
    clientRevenueMap: Map<string, number>,
    totalRev: number
  ) => {
    // Group companies by shared partners
    const companyPartnersMap = new Map<string, Set<string>>();

    partnersData.forEach((partner: any) => {
      const clientId = partner.client_id;
      const partnerKey = partner.cpf || partner.name;

      if (!companyPartnersMap.has(clientId)) {
        companyPartnersMap.set(clientId, new Set());
      }
      companyPartnersMap.get(clientId)!.add(partnerKey);
    });

    // Find groups where companies share partners
    const groups = new Map<string, Set<string>>();
    const processedCompanies = new Set<string>();

    companyPartnersMap.forEach((partners, companyId) => {
      if (processedCompanies.has(companyId)) return;

      const groupKey = Array.from(partners).sort().join("|");

      if (!groups.has(groupKey)) {
        groups.set(groupKey, new Set());
      }

      groups.get(groupKey)!.add(companyId);
      processedCompanies.add(companyId);
    });

    // Create economic groups array
    const economicGroupsArray: EconomicGroup[] = [];

    groups.forEach((companyIds, partnersKey) => {
      if (companyIds.size <= 1) return; // Only groups with multiple companies

      const partnersList = partnersKey.split("|");
      const companiesData: Array<{ id: string; name: string; revenue: number }> = [];
      let groupRevenue = 0;

      companyIds.forEach((companyId) => {
        const revenue = clientRevenueMap.get(companyId) || 0;
        groupRevenue += revenue;

        // Get company name
        const partnerRecord = partnersData.find((p: any) => p.client_id === companyId);
        companiesData.push({
          id: companyId,
          name: partnerRecord?.clients?.name || "Desconhecido",
          revenue,
        });
      });

      const percentage = totalRev > 0 ? (groupRevenue / totalRev) * 100 : 0;

      let riskLevel: "high" | "medium" | "low" = "low";
      if (percentage >= 20) riskLevel = "high";
      else if (percentage >= 10) riskLevel = "medium";

      economicGroupsArray.push({
        group_name: `Grupo ${partnersList[0].substring(0, 20)}`,
        partners: partnersList,
        companies: companiesData,
        total_revenue: groupRevenue,
        percentage_of_total: percentage,
        risk_level: riskLevel,
      });
    });

    economicGroupsArray.sort((a, b) => b.total_revenue - a.total_revenue);
    setEconomicGroups(economicGroupsArray);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return value.toFixed(2) + "%";
  };

  const getRiskBadge = (level: string) => {
    const badges: Record<string, JSX.Element> = {
      high: <Badge variant="destructive">Risco Alto</Badge>,
      medium: <Badge className="bg-orange-500">Risco Médio</Badge>,
      low: <Badge className="bg-green-500">Risco Baixo</Badge>,
    };
    return badges[level] || <Badge>{level}</Badge>;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Network className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Análise de Grupo Econômico</h1>
                    <p className="text-muted-foreground">
                      Mapeamento de sócios, relacionamentos e análise de risco
                    </p>
                  </div>
                </div>
                <Button onClick={fetchData}>Atualizar</Button>
              </div>
            </div>

            {/* Risk Alert */}
            {economicGroups.some((g) => g.risk_level === "high") && (
              <Alert className="mb-6 border-red-300 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">
                  🚨 Risco de Concentração em Grupos Econômicos
                </AlertTitle>
                <AlertDescription className="text-red-700">
                  Existem grupos econômicos que representam mais de 20% da sua receita. Se um
                  desses grupos decidir sair, o impacto financeiro será significativo.
                </AlertDescription>
              </Alert>
            )}

            {/* Economic Groups */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Grupos Econômicos Identificados
                </CardTitle>
                <CardDescription>
                  Empresas que compartilham sócios em comum • Análise de força e impacto
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Carregando dados...</p>
                  </div>
                ) : economicGroups.length === 0 ? (
                  <div className="text-center py-12">
                    <Network className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum grupo identificado</h3>
                    <p className="text-muted-foreground">
                      Não foram encontradas empresas com sócios em comum
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {economicGroups.map((group, index) => (
                      <Card
                        key={index}
                        className={`${
                          group.risk_level === "high"
                            ? "border-red-300 bg-red-50"
                            : group.risk_level === "medium"
                            ? "border-orange-300 bg-orange-50"
                            : "border-green-300 bg-green-50"
                        }`}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>{group.group_name}</CardTitle>
                              <CardDescription>
                                {group.companies.length} empresas • {group.partners.length}{" "}
                                sócio(s)
                              </CardDescription>
                            </div>
                            {getRiskBadge(group.risk_level)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">Receita Total</p>
                              <p className="text-xl font-bold">
                                {formatCurrency(group.total_revenue)}
                              </p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                % do Faturamento
                              </p>
                              <p className="text-xl font-bold">
                                {formatPercent(group.percentage_of_total)}
                              </p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">Impacto se Sair</p>
                              <p className="text-xl font-bold text-red-600 flex items-center gap-2">
                                <TrendingDown className="w-5 h-5" />
                                -{formatPercent(group.percentage_of_total)}
                              </p>
                            </div>
                          </div>

                          <div className="mb-3">
                            <p className="text-sm font-semibold mb-2">Sócios:</p>
                            <div className="flex flex-wrap gap-2">
                              {group.partners.map((partner, idx) => (
                                <Badge key={idx} variant="outline">
                                  {partner}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-semibold mb-2">Empresas:</p>
                            <div className="space-y-2">
                              {group.companies.map((company) => (
                                <div
                                  key={company.id}
                                  className="flex items-center justify-between p-2 bg-white/50 rounded"
                                >
                                  <span className="font-medium">{company.name}</span>
                                  <span className="text-sm">
                                    {formatCurrency(company.revenue)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Partners with Multiple Companies */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Sócios com Múltiplas Empresas
                </CardTitle>
                <CardDescription>
                  Pessoas que participam de várias empresas clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Carregando dados...</p>
                  </div>
                ) : partners.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      Nenhum sócio com múltiplas empresas
                    </h3>
                    <p className="text-muted-foreground">
                      Não foram encontrados sócios que participam de mais de uma empresa
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sócio</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead className="text-center">Empresas</TableHead>
                        <TableHead className="text-right">Receita Total</TableHead>
                        <TableHead className="text-right">% do Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((partner) => (
                        <TableRow key={partner.id}>
                          <TableCell className="font-medium">{partner.name}</TableCell>
                          <TableCell>{partner.cpf || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{partner.companies_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(partner.total_revenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              className={
                                partner.percentage_of_total >= 20
                                  ? "bg-red-600"
                                  : partner.percentage_of_total >= 10
                                  ? "bg-orange-500"
                                  : "bg-green-600"
                              }
                            >
                              {formatPercent(partner.percentage_of_total)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EconomicGroupAnalysis;
