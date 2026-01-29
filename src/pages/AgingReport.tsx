import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { toast } from "sonner";
import { AlertTriangle, Clock, Calendar, TrendingDown, Users, RefreshCw, Download } from "lucide-react";

// Interface conforme view vw_aging_inadimplencia
interface AgingData {
  client_id: string;
  client_name: string;
  cnpj: string;
  email: string;
  phone: string;
  faixa_0_30: number;
  faixa_31_60: number;
  faixa_61_90: number;
  faixa_mais_90: number;
  total_em_aberto: number;
  dias_atraso_max: number;
  nivel_risco: string;
  nivel_risco_numero: number;
}

// Interface conforme view vw_aging_resumo
interface AgingResumo {
  total_clientes_inadimplentes: number;
  total_0_30_dias: number;
  total_31_60_dias: number;
  total_61_90_dias: number;
  total_mais_90_dias: number;
  total_geral_inadimplencia: number;
  clientes_criticos: number;
  clientes_alto_risco: number;
  clientes_medio_risco: number;
  clientes_baixo_risco: number;
}

const AgingReport = () => {
  const [loading, setLoading] = useState(true);
  const [agingData, setAgingData] = useState<AgingData[]>([]);
  const [resumo, setResumo] = useState<AgingResumo | null>(null);

  const loadAgingData = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar dados detalhados de aging
      const { data: aging, error: agingError } = await supabase
        .from('vw_aging_inadimplencia')
        .select('*')
        .order('dias_atraso_max', { ascending: false });

      if (agingError) throw agingError;

      // Buscar resumo consolidado
      const { data: resumoData, error: resumoError } = await supabase
        .from('vw_aging_resumo')
        .select('*')
        .single();

      if (resumoError && resumoError.code !== 'PGRST116') throw resumoError;

      setAgingData(aging || []);
      setResumo(resumoData || null);

    } catch (error: any) {
      console.error("Erro ao carregar aging:", error);
      toast.error("Erro ao carregar dados de aging: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgingData();
  }, [loadAgingData]);

  const getRiskBadge = (nivel: string) => {
    switch (nivel) {
      case 'CRÍTICO':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Crítico</Badge>;
      case 'ALTO':
        return <Badge variant="default" className="gap-1 bg-orange-500"><TrendingDown className="h-3 w-3" />Alto</Badge>;
      case 'MÉDIO':
        return <Badge variant="default" className="gap-1 bg-yellow-500"><Clock className="h-3 w-3" />Médio</Badge>;
      case 'BAIXO':
        return <Badge variant="default" className="gap-1 bg-blue-500"><Calendar className="h-3 w-3" />Baixo</Badge>;
      default:
        return <Badge variant="secondary">Em dia</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = ['Cliente', 'CNPJ', '0-30 dias', '31-60 dias', '61-90 dias', '+90 dias', 'Total', 'Dias Atraso', 'Risco'];
    const rows = agingData.map(item => [
      item.client_name,
      item.cnpj || '',
      item.faixa_0_30.toFixed(2),
      item.faixa_31_60.toFixed(2),
      item.faixa_61_90.toFixed(2),
      item.faixa_mais_90.toFixed(2),
      item.total_em_aberto.toFixed(2),
      item.dias_atraso_max.toString(),
      item.nivel_risco
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aging_inadimplencia_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Aging de Inadimplência</h1>
            <p className="text-muted-foreground">
              Análise por faixas de dias: 0-30, 31-60, 61-90, +90 dias
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAgingData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={exportToCSV} disabled={loading || agingData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">0-30 dias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(resumo.total_0_30_dias)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">31-60 dias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(resumo.total_31_60_dias)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">61-90 dias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(resumo.total_61_90_dias)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">+90 dias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(resumo.total_mais_90_dias)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(resumo.total_geral_inadimplencia)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumo.total_clientes_inadimplentes} clientes
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cards de Risco */}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-600">Críticos</span>
                </div>
                <div className="text-3xl font-bold text-red-600 mt-2">
                  {resumo.clientes_criticos}
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-600">Alto Risco</span>
                </div>
                <div className="text-3xl font-bold text-orange-600 mt-2">
                  {resumo.clientes_alto_risco}
                </div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-600">Médio Risco</span>
                </div>
                <div className="text-3xl font-bold text-yellow-600 mt-2">
                  {resumo.clientes_medio_risco}
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-600">Baixo Risco</span>
                </div>
                <div className="text-3xl font-bold text-blue-600 mt-2">
                  {resumo.clientes_baixo_risco}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela Detalhada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Detalhamento por Cliente
            </CardTitle>
            <CardDescription>
              Valores em aberto por faixa de dias de atraso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando...</span>
              </div>
            ) : agingData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum cliente com valores em atraso.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">0-30 dias</TableHead>
                    <TableHead className="text-right">31-60 dias</TableHead>
                    <TableHead className="text-right">61-90 dias</TableHead>
                    <TableHead className="text-right">+90 dias</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Dias Atraso</TableHead>
                    <TableHead className="text-center">Risco</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingData.map((item) => (
                    <TableRow key={item.client_id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{item.client_name}</span>
                          {item.cnpj && (
                            <span className="text-xs text-muted-foreground block">
                              {item.cnpj}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.faixa_0_30 > 0 ? (
                          <span className="text-blue-600">{formatCurrency(item.faixa_0_30)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.faixa_31_60 > 0 ? (
                          <span className="text-yellow-600">{formatCurrency(item.faixa_31_60)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.faixa_61_90 > 0 ? (
                          <span className="text-orange-600">{formatCurrency(item.faixa_61_90)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.faixa_mais_90 > 0 ? (
                          <span className="text-red-600 font-medium">{formatCurrency(item.faixa_mais_90)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(item.total_em_aberto)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-medium ${
                          item.dias_atraso_max > 90 ? 'text-red-600' :
                          item.dias_atraso_max > 60 ? 'text-orange-600' :
                          item.dias_atraso_max > 30 ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                          {item.dias_atraso_max}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getRiskBadge(item.nivel_risco)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AgingReport;
