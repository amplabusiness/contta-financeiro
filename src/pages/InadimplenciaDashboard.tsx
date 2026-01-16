import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Download,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  PieChart,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Receipt,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

interface ClientInadimplencia {
  clientId: string;
  clientName: string;
  gerado: number;
  recebido: number;
  divida: number;
  percentual: number;
  qtdBoletos: number;
  qtdPagos: number;
}

interface MonthlyData {
  competencia: string;
  mes: string;
  gerado: number;
  recebido: number;
  inadimplencia: number;
  percentual: number;
  qtdClientes: number;
}

interface ClientDetails {
  id: string;
  name: string;
  trade_name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  monthly_fee: number;
  is_active: boolean;
  created_at: string;
}

interface InvoiceDetail {
  id: string;
  competence: string;
  amount: number;
  status: string;
  due_date: string;
  created_at: string;
}

interface PaymentDetail {
  id: string;
  nosso_numero: string;
  valor_liquidado: number;
  data_liquidacao: string;
  carteira: string;
}

interface ClientRazao {
  competencia: string;
  tipo: 'gerado' | 'recebido';
  valor: number;
  data: string;
  descricao: string;
  saldo: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

const InadimplenciaDashboard = () => {
  const { toast } = useToast();
  const { selectedMonth, selectedYear } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  
  // Dados principais
  const [totalGerado, setTotalGerado] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [totalInadimplencia, setTotalInadimplencia] = useState(0);
  const [percentualInadimplencia, setPercentualInadimplencia] = useState(0);
  const [qtdClientesGerado, setQtdClientesGerado] = useState(0);
  const [qtdClientesInadimplentes, setQtdClientesInadimplentes] = useState(0);
  
  // Listas
  const [inadimplentes, setInadimplentes] = useState<ClientInadimplencia[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [pieData, setPieData] = useState<{name: string; value: number; color: string}[]>([]);

  // Modal de detalhes do cliente
  const [selectedClient, setSelectedClient] = useState<ClientInadimplencia | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [clientInvoices, setClientInvoices] = useState<InvoiceDetail[]>([]);
  const [clientPayments, setClientPayments] = useState<PaymentDetail[]>([]);
  const [clientRazao, setClientRazao] = useState<ClientRazao[]>([]);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [competenciasDevidas, setCompetenciasDevidas] = useState<{competencia: string; valor: number; pago: number; saldo: number}[]>([]);

  const loadClientDetails = async (clientId: string) => {
    setIsLoadingClient(true);
    try {
      // 1. Buscar dados do cliente
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (client) {
        setClientDetails(client as ClientDetails);
      }

      // 2. Buscar TODOS os invoices do cliente (histórico completo)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, competence, amount, status, due_date, created_at')
        .eq('client_id', clientId)
        .order('competence', { ascending: true });

      setClientInvoices(invoices as InvoiceDetail[] || []);

      // 3. Buscar TODOS os pagamentos do cliente
      const { data: payments } = await supabase
        .from('boleto_payments')
        .select('id, nosso_numero, valor_liquidado, data_liquidacao, carteira')
        .eq('client_id', clientId)
        .order('data_liquidacao', { ascending: true });

      setClientPayments(payments as PaymentDetail[] || []);

      // 4. Calcular razão e saldos por competência
      const competencias = new Map<string, { gerado: number; pago: number }>();
      
      // Agrupar invoices por competência
      for (const inv of invoices || []) {
        const comp = inv.competence;
        if (!competencias.has(comp)) {
          competencias.set(comp, { gerado: 0, pago: 0 });
        }
        competencias.get(comp)!.gerado += inv.amount;
      }

      // Agrupar pagamentos por competência (usando mês da liquidação)
      for (const pag of payments || []) {
        const date = new Date(pag.data_liquidacao);
        const comp = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        if (!competencias.has(comp)) {
          competencias.set(comp, { gerado: 0, pago: 0 });
        }
        competencias.get(comp)!.pago += pag.valor_liquidado;
      }

      // Ordenar competências e calcular saldo
      const sortedComps = Array.from(competencias.entries())
        .sort((a, b) => {
          const [mesA, anoA] = a[0].split('/').map(Number);
          const [mesB, anoB] = b[0].split('/').map(Number);
          return anoA !== anoB ? anoA - anoB : mesA - mesB;
        });

      let saldoAcumulado = 0;
      const razaoEntries: ClientRazao[] = [];
      const compDevidasList: {competencia: string; valor: number; pago: number; saldo: number}[] = [];

      // Encontrar competência atual
      const compAtual = `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
      
      for (const [comp, dados] of sortedComps) {
        // Lançamento de débito (gerado)
        if (dados.gerado > 0) {
          saldoAcumulado += dados.gerado;
          razaoEntries.push({
            competencia: comp,
            tipo: 'gerado',
            valor: dados.gerado,
            data: comp,
            descricao: `Boleto gerado - ${comp}`,
            saldo: saldoAcumulado,
          });
        }

        // Lançamento de crédito (pago)
        if (dados.pago > 0) {
          saldoAcumulado -= dados.pago;
          razaoEntries.push({
            competencia: comp,
            tipo: 'recebido',
            valor: dados.pago,
            data: comp,
            descricao: `Pagamento recebido - ${comp}`,
            saldo: saldoAcumulado,
          });
        }

        // Competências com saldo devedor
        const saldoComp = dados.gerado - dados.pago;
        if (saldoComp > 0.01) {
          compDevidasList.push({
            competencia: comp,
            valor: dados.gerado,
            pago: dados.pago,
            saldo: saldoComp,
          });
        }
      }

      // Calcular saldo anterior (competências antes da atual)
      let saldoAnt = 0;
      for (const [comp, dados] of sortedComps) {
        const [mes, ano] = comp.split('/').map(Number);
        const [mesAtual, anoAtual] = [selectedMonth, selectedYear];
        
        if (ano < anoAtual || (ano === anoAtual && mes < mesAtual)) {
          saldoAnt += dados.gerado - dados.pago;
        }
      }

      setSaldoAnterior(saldoAnt);
      setClientRazao(razaoEntries);
      setCompetenciasDevidas(compDevidasList);

    } catch (error) {
      console.error('Erro ao carregar detalhes do cliente:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar ficha do cliente",
        variant: "destructive",
      });
    } finally {
      setIsLoadingClient(false);
    }
  };

  const handleClientClick = (client: ClientInadimplencia) => {
    setSelectedClient(client);
    loadClientDetails(client.clientId);
  };

  const closeModal = () => {
    setSelectedClient(null);
    setClientDetails(null);
    setClientInvoices([]);
    setClientPayments([]);
    setClientRazao([]);
    setSaldoAnterior(0);
    setCompetenciasDevidas([]);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const competencia = `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
      
      // 1. Buscar invoices (boletos gerados) da competência selecionada
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('id, client_id, amount, status, clients(id, name)')
        .eq('competence', competencia);
      
      if (invError) throw invError;

      // 2. Buscar boleto_payments (recebidos) do mês selecionado
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      const { data: pagamentos, error: pagError } = await supabase
        .from('boleto_payments')
        .select('id, client_id, valor_liquidado, clients(id, name)')
        .gte('data_liquidacao', startDate)
        .lte('data_liquidacao', endDate);
      
      if (pagError) throw pagError;

      // 3. Agrupar por cliente
      const clientesMap = new Map<string, ClientInadimplencia>();
      
      // Processar invoices (gerados)
      for (const inv of invoices || []) {
        const clientId = inv.client_id;
        const clientName = (inv.clients as { name?: string } | null)?.name || 'Cliente não identificado';
        
        if (!clientesMap.has(clientId)) {
          clientesMap.set(clientId, {
            clientId,
            clientName,
            gerado: 0,
            recebido: 0,
            divida: 0,
            percentual: 0,
            qtdBoletos: 0,
            qtdPagos: 0,
          });
        }
        
        const cliente = clientesMap.get(clientId)!;
        cliente.gerado += inv.amount;
        cliente.qtdBoletos++;
      }
      
      // Processar pagamentos (recebidos)
      for (const pag of pagamentos || []) {
        const clientId = pag.client_id;
        const clientName = (pag.clients as { name?: string } | null)?.name || 'Cliente não identificado';
        
        if (!clientesMap.has(clientId)) {
          clientesMap.set(clientId, {
            clientId,
            clientName,
            gerado: 0,
            recebido: 0,
            divida: 0,
            percentual: 0,
            qtdBoletos: 0,
            qtdPagos: 0,
          });
        }
        
        const cliente = clientesMap.get(clientId)!;
        cliente.recebido += pag.valor_liquidado;
        cliente.qtdPagos++;
      }
      
      // Calcular dívidas
      let geradoTotal = 0;
      let recebidoTotal = 0;
      const listaInadimplentes: ClientInadimplencia[] = [];
      
      for (const [, cliente] of clientesMap) {
        cliente.divida = cliente.gerado - cliente.recebido;
        cliente.percentual = cliente.gerado > 0 ? (cliente.divida / cliente.gerado) * 100 : 0;
        
        geradoTotal += cliente.gerado;
        recebidoTotal += cliente.recebido;
        
        if (cliente.divida > 0.01) {
          listaInadimplentes.push(cliente);
        }
      }
      
      // Ordenar por dívida (maior primeiro)
      listaInadimplentes.sort((a, b) => b.divida - a.divida);
      
      // Atualizar estados
      setTotalGerado(geradoTotal);
      setTotalRecebido(recebidoTotal);
      setTotalInadimplencia(geradoTotal - recebidoTotal);
      setPercentualInadimplencia(geradoTotal > 0 ? ((geradoTotal - recebidoTotal) / geradoTotal) * 100 : 0);
      setQtdClientesGerado(clientesMap.size);
      setQtdClientesInadimplentes(listaInadimplentes.length);
      setInadimplentes(listaInadimplentes);
      
      // 4. Preparar dados do gráfico de pizza
      const faixas = [
        { name: 'Até R$ 500', value: 0, color: '#22c55e' },
        { name: 'R$ 500 - R$ 1.000', value: 0, color: '#eab308' },
        { name: 'R$ 1.000 - R$ 5.000', value: 0, color: '#f97316' },
        { name: 'R$ 5.000 - R$ 10.000', value: 0, color: '#ef4444' },
        { name: 'Acima R$ 10.000', value: 0, color: '#7f1d1d' },
      ];
      
      for (const inad of listaInadimplentes) {
        if (inad.divida <= 500) faixas[0].value += inad.divida;
        else if (inad.divida <= 1000) faixas[1].value += inad.divida;
        else if (inad.divida <= 5000) faixas[2].value += inad.divida;
        else if (inad.divida <= 10000) faixas[3].value += inad.divida;
        else faixas[4].value += inad.divida;
      }
      
      setPieData(faixas.filter(f => f.value > 0));
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de inadimplência",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, toast]);

  const loadMonthlyData = useCallback(async () => {
    try {
      const monthly: MonthlyData[] = [];
      
      // Carregar últimos 12 meses
      for (let i = 11; i >= 0; i--) {
        const date = new Date(selectedYear, selectedMonth - 1 - i, 1);
        const mes = date.getMonth() + 1;
        const ano = date.getFullYear();
        const competencia = `${String(mes).padStart(2, '0')}/${ano}`;
        const mesLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        // Buscar invoices
        const { data: invs } = await supabase
          .from('invoices')
          .select('amount, client_id')
          .eq('competence', competencia);
        
        // Buscar pagamentos
        const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const lastDay = new Date(ano, mes, 0).getDate();
        const endDate = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`;
        
        const { data: pags } = await supabase
          .from('boleto_payments')
          .select('valor_liquidado')
          .gte('data_liquidacao', startDate)
          .lte('data_liquidacao', endDate);
        
        const gerado = invs?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
        const recebido = pags?.reduce((sum, pag) => sum + pag.valor_liquidado, 0) || 0;
        const inadimplencia = gerado - recebido;
        const percentual = gerado > 0 ? (inadimplencia / gerado) * 100 : 0;
        const qtdClientes = new Set(invs?.map(inv => inv.client_id)).size;
        
        monthly.push({
          competencia,
          mes: mesLabel,
          gerado,
          recebido,
          inadimplencia: Math.max(0, inadimplencia),
          percentual: Math.max(0, percentual),
          qtdClientes,
        });
      }
      
      setMonthlyData(monthly);
    } catch (error) {
      console.error("Erro ao carregar dados mensais:", error);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
    loadMonthlyData();
  }, [loadData, loadMonthlyData]);

  // Filtrar inadimplentes
  const filteredInadimplentes = inadimplentes.filter(inad => {
    const matchSearch = inad.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterSeverity === "all") return matchSearch;
    if (filterSeverity === "critical" && inad.divida > 10000) return matchSearch;
    if (filterSeverity === "high" && inad.divida > 5000 && inad.divida <= 10000) return matchSearch;
    if (filterSeverity === "medium" && inad.divida > 1000 && inad.divida <= 5000) return matchSearch;
    if (filterSeverity === "low" && inad.divida <= 1000) return matchSearch;
    
    return false;
  });

  const getSeverityBadge = (divida: number) => {
    if (divida > 10000) return <Badge variant="destructive">Crítico</Badge>;
    if (divida > 5000) return <Badge className="bg-orange-500">Alto</Badge>;
    if (divida > 1000) return <Badge className="bg-yellow-500">Médio</Badge>;
    return <Badge variant="secondary">Baixo</Badge>;
  };

  const exportToCSV = () => {
    const headers = ['Cliente', 'Gerado', 'Recebido', 'Dívida', '% Inadimplência', 'Boletos', 'Pagos'];
    const rows = filteredInadimplentes.map(i => [
      i.clientName,
      i.gerado.toFixed(2),
      i.recebido.toFixed(2),
      i.divida.toFixed(2),
      i.percentual.toFixed(2) + '%',
      i.qtdBoletos,
      i.qtdPagos,
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inadimplencia_${selectedMonth}_${selectedYear}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Controle de Inadimplência</h1>
              <p className="text-muted-foreground">
                Boletos gerados vs recebidos por competência
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={exportToCSV} size="sm" className="flex-1 sm:flex-none">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Button onClick={() => loadData()} size="sm" className="flex-1 sm:flex-none">
              <span className="text-sm">Atualizar</span>
            </Button>
          </div>
        </div>

        <PeriodFilter />

        {/* Cards de Resumo */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                Boletos Gerados
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">
                {formatCurrency(totalGerado)}
              </div>
              <p className="text-sm text-muted-foreground">
                {qtdClientesGerado} clientes na competência
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Valor Recebido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalRecebido)}
              </div>
              <p className="text-sm text-muted-foreground">
                {((totalRecebido / totalGerado) * 100 || 0).toFixed(1)}% do gerado
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Inadimplência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalInadimplencia)}
              </div>
              <p className="text-sm text-red-600">
                {percentualInadimplencia.toFixed(2)}% do faturado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Clientes Inadimplentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {qtdClientesInadimplentes}
              </div>
              <p className="text-sm text-muted-foreground">
                de {qtdClientesGerado} clientes ({((qtdClientesInadimplentes / qtdClientesGerado) * 100 || 0).toFixed(1)}%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Gráfico de Evolução */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Evolução Mensal (12 meses)
              </CardTitle>
              <CardDescription>
                Comparativo de gerado vs recebido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Competência: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="gerado" name="Gerado" fill="#3b82f6" />
                  <Bar dataKey="recebido" name="Recebido" fill="#22c55e" />
                  <Bar dataKey="inadimplencia" name="Inadimplência" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Distribuição por Faixa de Valor
              </CardTitle>
              <CardDescription>
                Concentração da inadimplência
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Inadimplentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Clientes Inadimplentes</CardTitle>
                <CardDescription>
                  {filteredInadimplentes.length} clientes com dívida na competência selecionada
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    className="pl-8 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="critical">Crítico (&gt; R$ 10k)</SelectItem>
                    <SelectItem value="high">Alto (R$ 5k - 10k)</SelectItem>
                    <SelectItem value="medium">Médio (R$ 1k - 5k)</SelectItem>
                    <SelectItem value="low">Baixo (&lt; R$ 1k)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Gerado</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Dívida</TableHead>
                  <TableHead className="text-right">% Inad.</TableHead>
                  <TableHead className="text-center">Severidade</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInadimplentes.slice(0, 50).map((inad) => (
                  <TableRow 
                    key={inad.clientId} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleClientClick(inad)}
                  >
                    <TableCell className="font-medium">{inad.clientName}</TableCell>
                    <TableCell className="text-right text-blue-600">
                      {formatCurrency(inad.gerado)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(inad.recebido)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {formatCurrency(inad.divida)}
                    </TableCell>
                    <TableCell className="text-right">
                      {inad.percentual.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      {getSeverityBadge(inad.divida)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClientClick(inad);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ficha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredInadimplentes.length > 50 && (
              <div className="text-center text-sm text-muted-foreground mt-4">
                Mostrando 50 de {filteredInadimplentes.length} clientes. Exporte para ver todos.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo por Faixa */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Faixa de Valor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-sm text-green-700">Até R$ 500</div>
                <div className="text-lg font-bold text-green-800">
                  {inadimplentes.filter(i => i.divida <= 500).length} clientes
                </div>
                <div className="text-sm text-green-600">
                  {formatCurrency(inadimplentes.filter(i => i.divida <= 500).reduce((s, i) => s + i.divida, 0))}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="text-sm text-yellow-700">R$ 500 - R$ 1.000</div>
                <div className="text-lg font-bold text-yellow-800">
                  {inadimplentes.filter(i => i.divida > 500 && i.divida <= 1000).length} clientes
                </div>
                <div className="text-sm text-yellow-600">
                  {formatCurrency(inadimplentes.filter(i => i.divida > 500 && i.divida <= 1000).reduce((s, i) => s + i.divida, 0))}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <div className="text-sm text-orange-700">R$ 1.000 - R$ 5.000</div>
                <div className="text-lg font-bold text-orange-800">
                  {inadimplentes.filter(i => i.divida > 1000 && i.divida <= 5000).length} clientes
                </div>
                <div className="text-sm text-orange-600">
                  {formatCurrency(inadimplentes.filter(i => i.divida > 1000 && i.divida <= 5000).reduce((s, i) => s + i.divida, 0))}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="text-sm text-red-700">R$ 5.000 - R$ 10.000</div>
                <div className="text-lg font-bold text-red-800">
                  {inadimplentes.filter(i => i.divida > 5000 && i.divida <= 10000).length} clientes
                </div>
                <div className="text-sm text-red-600">
                  {formatCurrency(inadimplentes.filter(i => i.divida > 5000 && i.divida <= 10000).reduce((s, i) => s + i.divida, 0))}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-red-100 border border-red-300">
                <div className="text-sm text-red-800">Acima R$ 10.000</div>
                <div className="text-lg font-bold text-red-900">
                  {inadimplentes.filter(i => i.divida > 10000).length} clientes
                </div>
                <div className="text-sm text-red-700">
                  {formatCurrency(inadimplentes.filter(i => i.divida > 10000).reduce((s, i) => s + i.divida, 0))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Ficha do Cliente */}
        <Dialog open={!!selectedClient} onOpenChange={() => closeModal()}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Ficha do Cliente - {selectedClient?.clientName}
              </DialogTitle>
              <DialogDescription>
                Histórico completo de cobranças e pagamentos
              </DialogDescription>
            </DialogHeader>

            {isLoadingClient ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Dados do Cliente */}
                  {clientDetails && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Dados Cadastrais
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Razão Social:</span>
                            <p className="font-medium">{clientDetails.name}</p>
                          </div>
                          {clientDetails.trade_name && (
                            <div>
                              <span className="text-muted-foreground">Nome Fantasia:</span>
                              <p className="font-medium">{clientDetails.trade_name}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">CNPJ/CPF:</span>
                            <p className="font-medium">{clientDetails.document || '-'}</p>
                          </div>
                          {clientDetails.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span>{clientDetails.email}</span>
                            </div>
                          )}
                          {clientDetails.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span>{clientDetails.phone}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Honorário Mensal:</span>
                            <p className="font-medium text-blue-600">
                              {formatCurrency(clientDetails.monthly_fee)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={clientDetails.is_active ? "default" : "secondary"} className="ml-2">
                              {clientDetails.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Resumo Financeiro */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <div className="text-sm text-blue-700">Saldo Anterior</div>
                        <div className="text-xl font-bold text-blue-800">
                          {formatCurrency(saldoAnterior)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-50 border-slate-200">
                      <CardContent className="pt-4">
                        <div className="text-sm text-slate-700">Gerado (Competência)</div>
                        <div className="text-xl font-bold text-slate-800">
                          {formatCurrency(selectedClient?.gerado || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <div className="text-sm text-green-700">Recebido (Competência)</div>
                        <div className="text-xl font-bold text-green-800">
                          {formatCurrency(selectedClient?.recebido || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="pt-4">
                        <div className="text-sm text-red-700">Saldo Devedor Total</div>
                        <div className="text-xl font-bold text-red-800">
                          {formatCurrency(saldoAnterior + (selectedClient?.divida || 0))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Competências em Aberto */}
                  {competenciasDevidas.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Competências em Aberto ({competenciasDevidas.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Competência</TableHead>
                              <TableHead className="text-right">Valor Gerado</TableHead>
                              <TableHead className="text-right">Valor Pago</TableHead>
                              <TableHead className="text-right">Saldo Devedor</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {competenciasDevidas.map((comp) => (
                              <TableRow key={comp.competencia}>
                                <TableCell className="font-medium">{comp.competencia}</TableCell>
                                <TableCell className="text-right text-blue-600">
                                  {formatCurrency(comp.valor)}
                                </TableCell>
                                <TableCell className="text-right text-green-600">
                                  {formatCurrency(comp.pago)}
                                </TableCell>
                                <TableCell className="text-right font-bold text-red-600">
                                  {formatCurrency(comp.saldo)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {comp.pago > 0 ? (
                                    <Badge className="bg-yellow-500">Parcial</Badge>
                                  ) : (
                                    <Badge variant="destructive">Em Aberto</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-bold">
                              <TableCell>TOTAL</TableCell>
                              <TableCell className="text-right text-blue-600">
                                {formatCurrency(competenciasDevidas.reduce((s, c) => s + c.valor, 0))}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(competenciasDevidas.reduce((s, c) => s + c.pago, 0))}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {formatCurrency(competenciasDevidas.reduce((s, c) => s + c.saldo, 0))}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Razão/Extrato Analítico */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        Razão Analítico (Histórico Completo)
                      </CardTitle>
                      <CardDescription>
                        Todos os lançamentos de débito e crédito
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Competência</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Débito</TableHead>
                            <TableHead className="text-right">Crédito</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientRazao.map((entry, idx) => (
                            <TableRow key={idx} className={entry.tipo === 'recebido' ? 'bg-green-50' : ''}>
                              <TableCell>{entry.competencia}</TableCell>
                              <TableCell>
                                {entry.tipo === 'gerado' ? (
                                  <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-blue-500" />
                                    {entry.descricao}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-green-700">
                                    <CheckCircle className="w-3 h-3" />
                                    {entry.descricao}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {entry.tipo === 'gerado' ? formatCurrency(entry.valor) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {entry.tipo === 'recebido' ? formatCurrency(entry.valor) : '-'}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${entry.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(entry.saldo)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Últimos Pagamentos */}
                  {clientPayments.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Histórico de Pagamentos ({clientPayments.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data Liquidação</TableHead>
                              <TableHead>Nosso Número</TableHead>
                              <TableHead>Carteira</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientPayments.slice(-10).reverse().map((pag) => (
                              <TableRow key={pag.id}>
                                <TableCell>
                                  {new Date(pag.data_liquidacao).toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell className="font-mono text-sm">{pag.nosso_numero}</TableCell>
                                <TableCell>{pag.carteira}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">
                                  {formatCurrency(pag.valor_liquidado)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {clientPayments.length > 10 && (
                          <p className="text-sm text-muted-foreground text-center mt-2">
                            Mostrando últimos 10 de {clientPayments.length} pagamentos
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default InadimplenciaDashboard;
