import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, AlertTriangle, TrendingUp, Building2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Partner {
  nome: string;
  cpf?: string;
  qualificacao?: string;
}

interface EconomicGroup {
  partnerName: string;
  partnerCpf: string;
  clients: Array<{
    id: string;
    name: string;
    cnpj: string;
    monthlyFee: number;
    status: string;
  }>;
  totalRevenue: number;
  clientCount: number;
  riskLevel: "low" | "medium" | "high";
}

const EconomicGroups = () => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<EconomicGroup[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const loadGroups = async () => {
    setLoading(true);
    try {
      // Buscar todos os clientes com seus sócios
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active");

      if (clientsError) throw clientsError;

      // Mapear sócios por CPF
      const partnersMap = new Map<string, EconomicGroup>();

      clients?.forEach(client => {
        const qsa = client.qsa as any;
        if (Array.isArray(qsa)) {
          qsa.forEach((partner: Partner) => {
            const cpf = partner.cpf || partner.nome;
            if (!cpf) return;

            if (!partnersMap.has(cpf)) {
              partnersMap.set(cpf, {
                partnerName: partner.nome,
                partnerCpf: cpf,
                clients: [],
                totalRevenue: 0,
                clientCount: 0,
                riskLevel: "low",
              });
            }

            const group = partnersMap.get(cpf)!;
            group.clients.push({
              id: client.id,
              name: client.name,
              cnpj: client.cnpj || "",
              monthlyFee: Number(client.monthly_fee || 0),
              status: client.status,
            });
            group.totalRevenue += Number(client.monthly_fee || 0);
            group.clientCount++;
          });
        }
      });

      // Filtrar apenas grupos com mais de 1 empresa
      const economicGroups = Array.from(partnersMap.values())
        .filter(group => group.clientCount > 1)
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calcular nível de risco
      const totalRev = clients?.reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0) || 0;
      setTotalRevenue(totalRev);

      economicGroups.forEach(group => {
        const concentration = totalRev > 0 ? (group.totalRevenue / totalRev) * 100 : 0;
        if (concentration > 20) {
          group.riskLevel = "high";
        } else if (concentration > 10) {
          group.riskLevel = "medium";
        } else {
          group.riskLevel = "low";
        }
      });

      setGroups(economicGroups);
      toast.success("Grupos econômicos identificados!");
    } catch (error: any) {
      console.error("Erro ao carregar grupos:", error);
      toast.error("Erro ao carregar dados", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "high":
        return <Badge variant="destructive">Alto Risco</Badge>;
      case "medium":
        return <Badge variant="secondary">Médio Risco</Badge>;
      default:
        return <Badge>Baixo Risco</Badge>;
    }
  };

  const highRiskGroups = groups.filter(g => g.riskLevel === "high");
  const totalGroupRevenue = groups.reduce((sum, g) => sum + g.totalRevenue, 0);
  const concentration = totalRevenue > 0 ? (totalGroupRevenue / totalRevenue) * 100 : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">🏢 Grupos Econômicos</h1>
          <p className="text-muted-foreground">
            Mapeamento de sócios e análise de risco de concentração
          </p>
        </div>

        {/* Alertas de Risco */}
        {highRiskGroups.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção: Alta Concentração Detectada</AlertTitle>
            <AlertDescription>
              Foram identificados {highRiskGroups.length} grupo(s) econômico(s) com alta concentração de receita.
              Considere diversificar a carteira de clientes para reduzir o risco.
            </AlertDescription>
          </Alert>
        )}

        {/* Cards Principais */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grupos Identificados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groups.length}</div>
              <p className="text-xs text-muted-foreground">
                Sócios com múltiplas empresas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita de Grupos</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalGroupRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                {concentration.toFixed(1)}% da receita total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grupos de Alto Risco</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{highRiskGroups.length}</div>
              <p className="text-xs text-muted-foreground">
                Concentração &gt; 20% da receita
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Grupos */}
        {groups.map((group, idx) => {
          const groupConcentration = totalRevenue > 0 ? (group.totalRevenue / totalRevenue) * 100 : 0;
          
          return (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {group.partnerName}
                    </CardTitle>
                    <CardDescription>
                      {group.clientCount} empresas • {formatCurrency(group.totalRevenue)}/mês
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRiskBadge(group.riskLevel)}
                    <Badge variant="outline">{groupConcentration.toFixed(1)}% da receita</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead className="text-right">Mensalidade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.cnpj}</TableCell>
                        <TableCell className="text-right">{formatCurrency(client.monthlyFee)}</TableCell>
                        <TableCell>
                          <Badge variant={client.status === "active" ? "default" : "secondary"}>
                            {client.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Impacto */}
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Impacto se o grupo sair</AlertTitle>
                  <AlertDescription>
                    Perda de receita: {formatCurrency(group.totalRevenue)}/mês ({groupConcentration.toFixed(1)}% do faturamento total)
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          );
        })}

        {groups.length === 0 && !loading && (
          <Card>
            <CardContent className="py-10 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum grupo econômico identificado</h3>
              <p className="text-muted-foreground">
                Adicione informações de sócios (QSA) aos seus clientes para identificar grupos econômicos.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default EconomicGroups;
