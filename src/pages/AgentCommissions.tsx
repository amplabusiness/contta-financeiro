import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  DollarSign, 
  FileText, 
  Briefcase, 
  TrendingUp,
  Calendar,
  RefreshCw,
  Download
} from "lucide-react";

interface CommissionAgent {
  id: string;
  name: string;
  cpf: string;
  pix_key: string;
  pix_key_type: string;
  is_active: boolean;
}

interface AgentCommission {
  id: string;
  agent_id: string;
  client_id: string | null;
  source_type: string;
  source_description: string;
  client_payment_amount: number;
  agent_percentage: number;
  commission_amount: number;
  competence: string;
  payment_date: string;
  status: string;
  paid_date: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  commission_agents?: { name: string };
  clients?: { name: string } | null;
}

interface AgentSummary {
  agent_id: string;
  agent_name: string;
  honorario: number;
  legalizacao: number;
  adiantamento: number;
  total: number;
}

export default function AgentCommissions() {
  const [agents, setAgents] = useState<CommissionAgent[]>([]);
  const [commissions, setCommissions] = useState<AgentCommission[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedCompetence, setSelectedCompetence] = useState<string>("12/2025");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<AgentSummary[]>([]);
  const { toast } = useToast();

  // Competências disponíveis
  const competencias = [
    "01/2025", "02/2025", "03/2025", "04/2025", "05/2025", "06/2025",
    "07/2025", "08/2025", "09/2025", "10/2025", "11/2025", "12/2025",
    "01/2026"
  ];

  const fetchAgents = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as unknown as any)
      .from("commission_agents")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast({ title: "Erro ao carregar agentes", description: error.message, variant: "destructive" });
    } else {
      setAgents(data || []);
    }
  };

  const fetchCommissions = async () => {
    setLoading(true);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as unknown as any)
      .from("agent_commissions")
      .select("*, commission_agents(name), clients(name)")
      .order("payment_date", { ascending: false });

    if (selectedAgent !== "all") {
      query = query.eq("agent_id", selectedAgent);
    }

    if (selectedCompetence !== "all") {
      query = query.eq("competence", selectedCompetence);
    }

    if (selectedType !== "all") {
      query = query.eq("source_type", selectedType);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Erro ao carregar comissões", description: error.message, variant: "destructive" });
    } else {
      setCommissions(data || []);
      calculateSummaries(data || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
    fetchCommissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent, selectedCompetence, selectedType]);

  const calculateSummaries = (data: AgentCommission[]) => {
    const agentMap: Record<string, AgentSummary> = {};

    data.forEach(c => {
      const agentId = c.agent_id;
      const agentName = c.commission_agents?.name || "N/A";
      
      if (!agentMap[agentId]) {
        agentMap[agentId] = {
          agent_id: agentId,
          agent_name: agentName,
          honorario: 0,
          legalizacao: 0,
          adiantamento: 0,
          total: 0
        };
      }

      const amount = Number(c.commission_amount) || 0;
      agentMap[agentId][c.source_type as keyof Pick<AgentSummary, 'honorario' | 'legalizacao' | 'adiantamento'>] += amount;
      agentMap[agentId].total += amount;
    });

    setSummaries(Object.values(agentMap));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "honorario": return "Honorário";
      case "legalizacao": return "Legalização";
      case "adiantamento": return "Adiantamento";
      default: return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "honorario": return "bg-green-100 text-green-800";
      case "legalizacao": return "bg-blue-100 text-blue-800";
      case "adiantamento": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500">Pago</Badge>;
      case "pending": return <Badge className="bg-yellow-500">Pendente</Badge>;
      case "cancelled": return <Badge className="bg-red-500">Cancelado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const totalGeral = summaries.reduce((acc, s) => acc + s.total, 0);
  const totalHonorarios = summaries.reduce((acc, s) => acc + s.honorario, 0);
  const totalLegalizacao = summaries.reduce((acc, s) => acc + s.legalizacao, 0);
  const totalAdiantamentos = summaries.reduce((acc, s) => acc + s.adiantamento, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comissões de Agentes</h1>
          <p className="text-muted-foreground">
            Victor Hugo e Nayara Cristina - Controle de Honorários e Repasses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCommissions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGeral)}</div>
            <p className="text-xs text-muted-foreground">
              {commissions.length} registros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Honorários</CardTitle>
            <Briefcase className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalHonorarios)}</div>
            <p className="text-xs text-muted-foreground">Clientes fixos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Legalização</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalLegalizacao)}</div>
            <p className="text-xs text-muted-foreground">Abertura/Alteração</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Adiantamentos</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalAdiantamentos)}</div>
            <p className="text-xs text-muted-foreground">Salário/13º</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Agente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map(summary => (
          <Card key={summary.agent_id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {summary.agent_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Honorários:</span>
                  <span className="font-medium text-green-600">{formatCurrency(summary.honorario)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Legalização:</span>
                  <span className="font-medium text-blue-600">{formatCurrency(summary.legalizacao)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adiantamentos:</span>
                  <span className="font-medium text-yellow-600">{formatCurrency(summary.adiantamento)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">TOTAL:</span>
                  <span className="font-bold text-lg">{formatCurrency(summary.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <label className="text-sm font-medium mb-1 block">Agente</label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <label className="text-sm font-medium mb-1 block">Competência</label>
              <Select value={selectedCompetence} onValueChange={setSelectedCompetence}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {competencias.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="honorario">Honorário</SelectItem>
                  <SelectItem value="legalizacao">Legalização</SelectItem>
                  <SelectItem value="adiantamento">Adiantamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Comissões */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="ml-2">Carregando...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map(commission => (
                  <TableRow key={commission.id}>
                    <TableCell>{formatDate(commission.payment_date)}</TableCell>
                    <TableCell className="font-medium">
                      {commission.commission_agents?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeBadgeColor(commission.source_type)}>
                        {getTypeLabel(commission.source_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{commission.clients?.name || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {commission.source_description}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(commission.commission_amount))}
                    </TableCell>
                    <TableCell>{getStatusBadge(commission.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && commissions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma comissão encontrada com os filtros selecionados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
