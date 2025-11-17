import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Users, AlertTriangle, TrendingDown, Building2, ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";

interface EconomicGroup {
  group_key: string;
  partner_names: string[];
  company_count: number;
  company_names: string[];
  company_ids: string[];
  total_revenue: number;
  percentage_of_total: number;
  risk_level: 'high' | 'medium' | 'low';
}

interface GroupStats {
  totalGroups: number;
  totalCompanies: number;
  highRiskGroups: number;
  averageConcentration: number;
}

const EconomicGroupAnalysis = () => {
  const { toast } = useToast();
  const { selectedYear } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<EconomicGroup[]>([]);
  const [stats, setStats] = useState<GroupStats>({
    totalGroups: 0,
    totalCompanies: 0,
    highRiskGroups: 0,
    averageConcentration: 0,
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEconomicGroups();
  }, [selectedYear]);

  const loadEconomicGroupsFromTables = async (year: number): Promise<EconomicGroup[]> => {
    try {
      // Fetch all client partners
      const { data: partners, error: partnersError } = await supabase
        .from('client_partners')
        .select('id, client_id, name, cpf');

      if (partnersError) throw partnersError;

      // Fetch invoices for the year
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('client_id, amount, payment_date')
        .eq('status', 'paid');

      if (invoicesError) throw invoicesError;

      // Fetch clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name');

      if (clientsError) throw clientsError;

      if (!partners || !invoices || !clients) {
        return [];
      }

      // Calculate total revenue for the year
      const totalYearRevenue = invoices
        .filter((inv: any) => {
          const invYear = new Date(inv.payment_date).getFullYear();
          return invYear === year;
        })
        .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);

      // Group partners by client
      const clientPartnersMap = new Map<string, string[]>();
      partners.forEach((p: any) => {
        const key = p.client_id;
        const partnerKey = p.cpf || p.name;
        if (!clientPartnersMap.has(key)) {
          clientPartnersMap.set(key, []);
        }
        const arr = clientPartnersMap.get(key)!;
        if (!arr.includes(partnerKey)) {
          arr.push(partnerKey);
        }
      });

      // Group clients by partners
      const groupMap = new Map<string, string[]>();
      clientPartnersMap.forEach((partners: string[], clientId: string) => {
        const key = partners.sort().join('|');
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(clientId);
      });

      // Create economic groups (only those with 2+ companies)
      const groups: EconomicGroup[] = [];
      groupMap.forEach((companyIds: string[], groupKey: string) => {
        if (companyIds.length > 1) {
          const groupInvoices = invoices.filter((inv: any) => {
            const invYear = new Date(inv.payment_date).getFullYear();
            return invYear === year && companyIds.includes(inv.client_id);
          });

          const totalRevenue = groupInvoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
          const percentageOfTotal = totalYearRevenue > 0 ? (totalRevenue / totalYearRevenue) * 100 : 0;

          groups.push({
            group_key: groupKey,
            partner_names: groupKey.split('|'),
            company_count: companyIds.length,
            company_names: companyIds.map(id => clients.find((c: any) => c.id === id)?.name || 'Unknown').filter(Boolean),
            company_ids: companyIds,
            total_revenue: totalRevenue,
            percentage_of_total: percentageOfTotal,
            risk_level: percentageOfTotal >= 20 ? 'high' : percentageOfTotal >= 10 ? 'medium' : 'low',
          });
        }
      });

      return groups.sort((a, b) => b.total_revenue - a.total_revenue);
    } catch (error) {
      console.error('Error loading economic groups from tables:', error);
      return [];
    }
  };

  const loadEconomicGroups = async () => {
    setIsLoading(true);
    try {
      const year = selectedYear || new Date().getFullYear();
      let groupData: EconomicGroup[] = [];

      // Try RPC first
      const { data, error } = await supabase.rpc('get_economic_group_impact', {
        p_year: year
      });

      if (error || !data) {
        // Fallback to direct table queries
        console.warn('RPC function unavailable, using fallback method to load economic groups');
        groupData = await loadEconomicGroupsFromTables(year);
      } else {
        groupData = (data || []) as EconomicGroup[];
      }

      setGroups(groupData);

      // Calculate stats
      const totalCompanies = groupData.reduce((sum, g) => sum + g.company_count, 0);
      const highRisk = groupData.filter(g => g.risk_level === 'high').length;
      const avgConcentration = groupData.length > 0
        ? groupData.reduce((sum, g) => sum + g.percentage_of_total, 0) / groupData.length
        : 0;

      setStats({
        totalGroups: groupData.length,
        totalCompanies,
        highRiskGroups: highRisk,
        averageConcentration: avgConcentration,
      });

    } catch (error) {
      // Catch any errors including "body stream already read"
      let errorMessage = 'Erro ao carregar grupos econômicos';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        try {
          // Try to get message property if it exists
          const err = error as any;
          errorMessage = err.message || String(error).substring(0, 200) || errorMessage;
        } catch (e) {
          // Fallback if anything goes wrong
          errorMessage = 'Erro desconhecido ao carregar dados';
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      if (errorMessage.toLowerCase().includes('body stream already read')) {
        errorMessage = 'Falha ao interpretar a resposta do Supabase. Aplique a migração 20251120_fix_economic_group_return_types.sql para atualizar a função get_economic_group_impact.';
      }

      console.error('Error loading economic groups:', errorMessage);

      // Truncate if too long
      if (errorMessage && errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 197) + '...';
      }

      toast({
        title: "Erro ao carregar grupos econômicos",
        description: errorMessage || 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const getRiskBadge = (riskLevel: string) => {
    const config = {
      high: { variant: "destructive" as const, label: "Alto Risco" },
      medium: { variant: "default" as const, label: "Risco Médio" },
      low: { variant: "secondary" as const, label: "Baixo Risco" },
    };
    const risk = config[riskLevel as keyof typeof config] || config.low;
    return <Badge variant={risk.variant}>{risk.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Grupos Econômicos</h1>
          <p className="text-muted-foreground">Identificação e análise de grupos empresariais relacionados</p>
        </div>

        <PeriodFilter />

        {stats.highRiskGroups > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção: Alta Concentração de Risco</AlertTitle>
            <AlertDescription>
              {stats.highRiskGroups} grupo(s) econômico(s) representa(m) mais de 20% da receita total.
              Recomenda-se diversificar a carteira de clientes para reduzir dependência.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Grupos Identificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGroups}</div>
              <p className="text-xs text-muted-foreground">
                Grupos com empresas relacionadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresas Vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompanies}</div>
              <p className="text-xs text-muted-foreground">
                Total de empresas em grupos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Grupos de Alto Risco
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.highRiskGroups}</div>
              <p className="text-xs text-muted-foreground">
                {'>'} 20% da receita total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Concentração Média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageConcentration.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Concentração média por grupo
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grupos Econômicos Identificados</CardTitle>
            <CardDescription>
              Empresas agrupadas por sócios/administradores em comum
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum grupo econômico identificado no período selecionado.
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <Collapsible
                    key={group.group_key}
                    open={expandedGroups.has(group.group_key)}
                    onOpenChange={() => toggleGroup(group.group_key)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-lg">
                                  {group.partner_names.slice(0, 2).join(', ')}
                                  {group.partner_names.length > 2 && ` +${group.partner_names.length - 2}`}
                                </CardTitle>
                                {getRiskBadge(group.risk_level)}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-4 w-4" />
                                  {group.company_count} empresa(s)
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-4 w-4" />
                                  {formatCurrency(group.total_revenue)}
                                </span>
                                <span>
                                  {group.percentage_of_total.toFixed(1)}% da receita total
                                </span>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              {expandedGroups.has(group.group_key) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Sócios/Administradores</h4>
                              <div className="flex flex-wrap gap-2">
                                {group.partner_names.map((partner, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {partner}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Empresas do Grupo</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Empresa</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.company_names.map((company, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{company}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A análise de grupos econômicos identifica relacionamentos entre empresas através de:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline">1</Badge>
                <div>
                  <p className="font-medium">Sócios em Comum</p>
                  <p className="text-sm text-muted-foreground">
                    Empresas que compartilham os mesmos sócios/administradores são agrupadas automaticamente
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline">2</Badge>
                <div>
                  <p className="font-medium">Análise de Receita</p>
                  <p className="text-sm text-muted-foreground">
                    Consolidaç��o da receita paga de todas as empresas do grupo no período selecionado
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline">3</Badge>
                <div>
                  <p className="font-medium">Detecção de Riscos</p>
                  <p className="text-sm text-muted-foreground">
                    Alto Risco: ≥20% | Risco Médio: ≥10% | Baixo Risco: {'<'}10% da receita total
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EconomicGroupAnalysis;
