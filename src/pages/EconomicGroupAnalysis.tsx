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
import { Users, AlertTriangle, TrendingDown, Building2, ChevronDown, ChevronUp, DollarSign, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { formatDocument } from "@/lib/formatters";

interface Partner {
  nome: string;
  qual: string; // qualificação (sócio, administrador, etc)
}

interface ClientWithPartners {
  id: string;
  name: string;
  cnpj: string;
  qsa: Partner[];
  monthly_fee: number;
  total_paid: number;
}

interface EconomicGroup {
  group_key: string;
  partner_names: string[];
  company_count: number;
  companies: ClientWithPartners[];
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
  const { selectedYear, selectedMonth } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<EconomicGroup[]>([]);
  const [stats, setStats] = useState<GroupStats>({
    totalGroups: 0,
    totalCompanies: 0,
    highRiskGroups: 0,
    averageConcentration: 0,
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    loadEconomicGroups();
  }, [selectedYear, selectedMonth]);

  const loadEconomicGroups = async () => {
    setIsLoading(true);
    try {
      const year = selectedYear || new Date().getFullYear();
      const month = selectedMonth || new Date().getMonth() + 1;

      // Definir período
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Buscar clientes ativos com QSA
      // @ts-ignore - Supabase type recursion issue
      const clientsResult = await supabase
        .from('clients')
        .select('id, name, cnpj, qsa, monthly_fee')
        .eq('is_active', true);

      if (clientsResult.error) throw clientsResult.error;
      const clientsData = (clientsResult.data || []) as Array<{
        id: string;
        name: string;
        cnpj: string | null;
        qsa: any;
        monthly_fee: number | null;
      }>;

      // Buscar faturas pagas no período para calcular receita
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('client_id, amount')
        .eq('status', 'paid')
        .gte('paid_date', startDate.toISOString())
        .lte('paid_date', endDate.toISOString());

      if (invoicesError) throw invoicesError;

      // Calcular receita total do período
      const totalRev = (invoicesData || []).reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
      setTotalRevenue(totalRev);

      // Criar mapa de receita por cliente
      const revenueByClient = new Map<string, number>();
      (invoicesData || []).forEach(inv => {
        const current = revenueByClient.get(inv.client_id) || 0;
        revenueByClient.set(inv.client_id, current + Number(inv.amount || 0));
      });

      // Processar clientes e extrair sócios
      const clientsWithPartners: ClientWithPartners[] = (clientsData || [])
        .filter(client => {
          // Verificar se qsa é um array válido com pelo menos um sócio
          if (!client.qsa) return false;
          try {
            const qsa = typeof client.qsa === 'string' ? JSON.parse(client.qsa) : client.qsa;
            return Array.isArray(qsa) && qsa.length > 0;
          } catch {
            return false;
          }
        })
        .map(client => {
          let qsa: Partner[] = [];
          try {
            qsa = typeof client.qsa === 'string' ? JSON.parse(client.qsa) : client.qsa;
          } catch {
            qsa = [];
          }
          return {
            id: client.id,
            name: client.name,
            cnpj: client.cnpj || '',
            qsa: qsa,
            monthly_fee: client.monthly_fee || 0,
            total_paid: revenueByClient.get(client.id) || 0,
          };
        });

      // Criar mapa de sócio -> empresas
      const partnerToCompanies = new Map<string, Set<string>>();

      clientsWithPartners.forEach(client => {
        client.qsa.forEach(partner => {
          if (partner.nome) {
            const normalizedName = partner.nome.trim().toUpperCase();
            if (!partnerToCompanies.has(normalizedName)) {
              partnerToCompanies.set(normalizedName, new Set());
            }
            partnerToCompanies.get(normalizedName)!.add(client.id);
          }
        });
      });

      // Encontrar grupos de empresas conectadas por sócios
      const clientIdToGroup = new Map<string, string>();
      const groupMembers = new Map<string, Set<string>>();
      const groupPartners = new Map<string, Set<string>>();

      // Union-Find para agrupar empresas conectadas
      const findRoot = (id: string): string => {
        if (!clientIdToGroup.has(id)) {
          clientIdToGroup.set(id, id);
        }
        if (clientIdToGroup.get(id) !== id) {
          clientIdToGroup.set(id, findRoot(clientIdToGroup.get(id)!));
        }
        return clientIdToGroup.get(id)!;
      };

      const union = (id1: string, id2: string) => {
        const root1 = findRoot(id1);
        const root2 = findRoot(id2);
        if (root1 !== root2) {
          clientIdToGroup.set(root2, root1);
        }
      };

      // Unir empresas que compartilham sócios
      partnerToCompanies.forEach((companies) => {
        const companyArray = Array.from(companies);
        if (companyArray.length > 1) {
          for (let i = 1; i < companyArray.length; i++) {
            union(companyArray[0], companyArray[i]);
          }
        }
      });

      // Agrupar empresas por grupo
      const clientMap = new Map(clientsWithPartners.map(c => [c.id, c]));

      clientsWithPartners.forEach(client => {
        const root = findRoot(client.id);
        if (!groupMembers.has(root)) {
          groupMembers.set(root, new Set());
          groupPartners.set(root, new Set());
        }
        groupMembers.get(root)!.add(client.id);

        // Adicionar sócios do cliente ao grupo
        client.qsa.forEach(partner => {
          if (partner.nome) {
            groupPartners.get(root)!.add(partner.nome.trim().toUpperCase());
          }
        });
      });

      // Criar grupos econômicos (apenas grupos com 2+ empresas)
      const economicGroups: EconomicGroup[] = [];

      groupMembers.forEach((memberIds, groupKey) => {
        if (memberIds.size >= 2) {
          const companies = Array.from(memberIds).map(id => clientMap.get(id)!).filter(Boolean);
          const groupRevenue = companies.reduce((sum, c) => sum + c.total_paid, 0);
          const percentage = totalRev > 0 ? (groupRevenue / totalRev) * 100 : 0;

          let riskLevel: 'high' | 'medium' | 'low' = 'low';
          if (percentage >= 20) riskLevel = 'high';
          else if (percentage >= 10) riskLevel = 'medium';

          const partners = Array.from(groupPartners.get(groupKey) || []);

          economicGroups.push({
            group_key: groupKey,
            partner_names: partners,
            company_count: companies.length,
            companies: companies,
            total_revenue: groupRevenue,
            percentage_of_total: percentage,
            risk_level: riskLevel,
          });
        }
      });

      // Ordenar por receita (maior primeiro)
      economicGroups.sort((a, b) => b.total_revenue - a.total_revenue);

      setGroups(economicGroups);

      // Calculate stats
      const totalCompanies = economicGroups.reduce((sum, g) => sum + g.company_count, 0);
      const highRisk = economicGroups.filter(g => g.risk_level === 'high').length;
      const avgConcentration = economicGroups.length > 0
        ? economicGroups.reduce((sum, g) => sum + g.percentage_of_total, 0) / economicGroups.length
        : 0;

      setStats({
        totalGroups: economicGroups.length,
        totalCompanies,
        highRiskGroups: highRisk,
        averageConcentration: avgConcentration,
      });

    } catch (error: any) {
      console.error('Error loading economic groups:', error);
      toast.error('Erro ao carregar grupos econômicos');
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise por Sócios</h1>
          <p className="text-muted-foreground">
            Identificação automática de grupos empresariais por sócios em comum
          </p>
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
                Grupos com sócios em comum
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

        {groups.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Nenhum grupo identificado</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                Para identificar grupos econômicos automaticamente, os clientes precisam ter o campo QSA (Quadro de Sócios e Administradores) preenchido.
              </p>
              <p>
                Use a função de <strong>Enriquecimento de Clientes</strong> no menu Ferramentas para buscar automaticamente os dados de sócios da Receita Federal.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {groups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Grupos Econômicos por Sócios</CardTitle>
              <CardDescription>
                Empresas agrupadas automaticamente por sócios/administradores em comum • Receita no período: {formatCurrency(totalRevenue)}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                              <h4 className="font-semibold mb-2">Sócios/Administradores em Comum</h4>
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
                                    <TableHead>CNPJ</TableHead>
                                    <TableHead className="text-right">Honorário Mensal</TableHead>
                                    <TableHead className="text-right">Pago no Período</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.companies.map((company) => (
                                    <TableRow key={company.id}>
                                      <TableCell className="font-medium">{company.name}</TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {company.cnpj ? formatDocument(company.cnpj) : '-'}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(company.monthly_fee)}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(company.total_paid)}
                                      </TableCell>
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
            </CardContent>
          </Card>
        )}

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
                  <p className="font-medium">Sócios em Comum (QSA)</p>
                  <p className="text-sm text-muted-foreground">
                    Empresas que compartilham os mesmos sócios/administradores são agrupadas automaticamente.
                    O QSA é obtido através do enriquecimento de dados da Receita Federal.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline">2</Badge>
                <div>
                  <p className="font-medium">Análise de Receita</p>
                  <p className="text-sm text-muted-foreground">
                    Consolidação da receita paga de todas as empresas do grupo no período selecionado
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
