import { useState, useEffect, useRef } from "react";
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
  const fallbackNoticeShown = useRef(false);
  const rpcRecoveredNoticeShown = useRef(false);

  const applyGroupData = (groupData: EconomicGroup[]) => {
    const totalCompanies = groupData.reduce((sum, g) => sum + g.company_count, 0);
    const highRisk = groupData.filter((g) => g.risk_level === 'high').length;
    const avgConcentration = groupData.length > 0
      ? groupData.reduce((sum, g) => sum + g.percentage_of_total, 0) / groupData.length
      : 0;

    setGroups(groupData);
    setStats({
      totalGroups: groupData.length,
      totalCompanies,
      highRiskGroups: highRisk,
      averageConcentration: avgConcentration,
    });
    setExpandedGroups(new Set());
  };

  const buildErrorMessage = (error: unknown) => {
    if (!error) return 'Erro desconhecido';
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;

    try {
      const err = error as any;
      return err.message || err.details || err.hint || JSON.stringify(err);
    } catch {
      return 'Erro ao processar resposta do servidor';
    }
  };

  const shouldAttemptFallback = (message: string) => {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return (
      normalized.includes('body stream already read') ||
      normalized.includes('function') ||
      normalized.includes('does not exist') ||
      normalized.includes('undefined')
    );
  };

  const computeRiskLevel = (percentage: number): EconomicGroup['risk_level'] => {
    if (percentage >= 20) return 'high';
    if (percentage >= 10) return 'medium';
    return 'low';
  };

  const handleLoadError = (message: string) => {
    let finalMessage = message || 'Erro ao carregar grupos econômicos';

    if (finalMessage.toLowerCase().includes('body stream already read')) {
      finalMessage = 'Falha ao interpretar a resposta do Supabase. Reaplique a função get_economic_group_impact usando a migração supabase/migrations/20251120_fix_economic_group_return_types.sql.';
    }

    if (finalMessage.length > 200) {
      finalMessage = `${finalMessage.substring(0, 197)}...`;
    }

    console.error('Error loading economic groups:', finalMessage);

    toast({
      title: "Erro ao carregar grupos econômicos",
      description: finalMessage,
      variant: "destructive",
    });

    setGroups([]);
    setStats({
      totalGroups: 0,
      totalCompanies: 0,
      highRiskGroups: 0,
      averageConcentration: 0,
    });
  };

  const fetchEconomicGroupsViaRPC = async (year: number) => {
    const { data, error } = await supabase.rpc('get_economic_group_impact', {
      p_year: year,
    });

    if (error) {
      throw error;
    }

    return (data || []) as EconomicGroup[];
  };

  const loadEconomicGroupsFallback = async (year: number): Promise<EconomicGroup[]> => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [{ data: partners, error: partnersError }, { data: invoices, error: invoicesError }] = await Promise.all([
      supabase.from('client_partners').select('client_id, cpf, name'),
      supabase
        .from('invoices')
        .select('client_id, amount, payment_date')
        .eq('status', 'paid')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate),
    ]);

    if (partnersError) throw partnersError;
    if (invoicesError) throw invoicesError;

    const partnersByClient = new Map<string, string[]>();

    (partners || []).forEach((partner) => {
      const identifier = partner?.cpf?.trim() || partner?.name?.trim();
      if (!identifier) {
        return;
      }

      const existing = partnersByClient.get(partner.client_id) || [];
      if (!existing.includes(identifier)) {
        partnersByClient.set(partner.client_id, [...existing, identifier]);
      }
    });

    const groupsMap = new Map<string, { partners: string[]; companyIds: string[] }>();

    partnersByClient.forEach((partnerList, clientId) => {
      if (!partnerList.length) {
        return;
      }

      const uniquePartners = Array.from(new Set(partnerList)).sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      );
      const groupKey = uniquePartners.join('|');
      const entry = groupsMap.get(groupKey);

      if (entry) {
        entry.companyIds.push(clientId);
      } else {
        groupsMap.set(groupKey, {
          partners: uniquePartners,
          companyIds: [clientId],
        });
      }
    });

    const groupedEntries = Array.from(groupsMap.entries()).filter(([, value]) => value.companyIds.length > 1);

    if (!groupedEntries.length) {
      return [];
    }

    const invoicesList = invoices || [];
    let totalYearRevenue = invoicesList.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

    if (!totalYearRevenue || totalYearRevenue <= 0) {
      totalYearRevenue = 1;
    }

    const revenueByClient = new Map<string, number>();
    invoicesList.forEach((invoice) => {
      const amount = Number(invoice.amount || 0);
      if (!invoice.client_id) return;
      const current = revenueByClient.get(invoice.client_id) || 0;
      revenueByClient.set(invoice.client_id, current + amount);
    });

    const clientIds = new Set<string>();
    groupedEntries.forEach(([, value]) => {
      value.companyIds.forEach((id) => clientIds.add(id));
    });

    let clientNameMap = new Map<string, string>();

    if (clientIds.size > 0) {
      const { data: clientRows, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', Array.from(clientIds));

      if (clientsError) throw clientsError;

      clientNameMap = new Map(
        (clientRows || []).map((client) => [client.id, client.name || 'Empresa sem nome'])
      );
    }

    const fallbackGroups: EconomicGroup[] = groupedEntries
      .map(([groupKey, value]) => {
        const companyIds = value.companyIds;
        const totalRevenue = companyIds.reduce((sum, id) => sum + (revenueByClient.get(id) || 0), 0);

        if (totalRevenue <= 0) {
          return null;
        }

        const percentage = Number(((totalRevenue / totalYearRevenue) * 100).toFixed(2));

        return {
          group_key: groupKey,
          partner_names: value.partners,
          company_count: companyIds.length,
          company_names: companyIds.map((id) => clientNameMap.get(id) || 'Empresa sem nome'),
          company_ids: companyIds,
          total_revenue: totalRevenue,
          percentage_of_total: percentage,
          risk_level: computeRiskLevel(percentage),
        };
      })
      .filter((group): group is EconomicGroup => Boolean(group))
      .sort((a, b) => b.total_revenue - a.total_revenue);

    return fallbackGroups;
  };

  useEffect(() => {
    loadEconomicGroups();
  }, [selectedYear]);

  const loadEconomicGroups = async () => {
    setIsLoading(true);
    const year = selectedYear || new Date().getFullYear();

    try {
      const rpcGroups = await fetchEconomicGroupsViaRPC(year);
      applyGroupData(rpcGroups);
    } catch (error) {
      const errorMessage = buildErrorMessage(error);
      const recoverable = shouldAttemptFallback(errorMessage);

      if (recoverable) {
        try {
          const fallbackGroups = await loadEconomicGroupsFallback(year);
          applyGroupData(fallbackGroups);

          toast({
            title: "Modo alternativo aplicado",
            description: "Carregamos os grupos diretamente das tabelas porque a função RPC apresentou erro. Reaplique a migração para restabelecer o modo otimizado.",
          });

          return;
        } catch (fallbackError) {
          const fallbackMessage = buildErrorMessage(fallbackError);
          handleLoadError(fallbackMessage);
          return;
        }
      }

      handleLoadError(errorMessage);
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
