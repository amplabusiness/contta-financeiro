import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, CheckCircle2, Clock, AlertCircle, Zap, ArrowRight, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface NFSeSummary {
  authorized: number;
  pending: number;
  error: number;
  valorTotal: number;
  clientesSemNota: number;
}

interface RecentNFSe {
  id: string;
  numero_rps: string;
  numero_nfse: string | null;
  tomador_razao_social: string;
  valor_servicos: number;
  status: string;
  data_emissao: string;
}

export function NFSeWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<NFSeSummary>({
    authorized: 0,
    pending: 0,
    error: 0,
    valorTotal: 0,
    clientesSemNota: 0
  });
  const [recentNFSe, setRecentNFSe] = useState<RecentNFSe[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const mesAtual = format(new Date(), 'yyyy-MM');
      const inicioMes = `${mesAtual}-01`;

      // Buscar NFS-e do mês
      const { data: nfses } = await supabase
        .from('nfse')
        .select('id, numero_rps, numero_nfse, tomador_razao_social, valor_servicos, status, data_emissao, client_id')
        .gte('competencia', inicioMes)
        .order('created_at', { ascending: false });

      // Buscar clientes ativos (sem filtro de monthly_fee no banco para evitar erro 400)
      const { data: clientesAtivos } = await supabase
        .from('clients')
        .select('id, monthly_fee')
        .eq('status', 'active');

      const totalClientes = (clientesAtivos || []).filter(c => c.monthly_fee && c.monthly_fee > 0).length;

      if (nfses) {
        const authorized = nfses.filter(n => n.status === 'authorized');
        const pending = nfses.filter(n => n.status === 'pending' || n.status === 'processing');
        const error = nfses.filter(n => n.status === 'error');

        // Clientes únicos com nota no mês
        const clientesComNota = new Set(nfses.map(n => n.client_id).filter(Boolean));

        setSummary({
          authorized: authorized.length,
          pending: pending.length,
          error: error.length,
          valorTotal: authorized.reduce((sum, n) => sum + (n.valor_servicos || 0), 0),
          clientesSemNota: totalClientes - clientesComNota.size
        });

        setRecentNFSe(nfses.slice(0, 5));
      }
    } catch (err) {
      console.error('Erro ao carregar dados NFS-e:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: any }> = {
      authorized: { variant: 'default', icon: CheckCircle2 },
      pending: { variant: 'secondary', icon: Clock },
      processing: { variant: 'secondary', icon: Clock },
      error: { variant: 'destructive', icon: AlertCircle }
    };
    const { variant, icon: Icon } = variants[status] || { variant: 'secondary', icon: Clock };
    return (
      <Badge variant={variant} className="h-5 px-1">
        <Icon className="h-3 w-3" />
      </Badge>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">NFS-e</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/nfse')}>
            Ver tudo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <CardDescription>
          Notas fiscais de {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-xl font-bold text-green-600">{summary.authorized}</div>
            <div className="text-xs text-muted-foreground">Autorizadas</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded-lg">
            <div className="text-xl font-bold text-yellow-600">{summary.pending}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <div className="text-xl font-bold text-red-600">{summary.error}</div>
            <div className="text-xs text-muted-foreground">Com Erro</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="text-xl font-bold text-blue-600">{summary.clientesSemNota}</div>
            <div className="text-xs text-muted-foreground">Sem Nota</div>
          </div>
        </div>

        {/* Valor Total */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Valor Total Autorizado</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.valorTotal)}</div>
        </div>

        {/* Ação Rápida */}
        {summary.clientesSemNota > 0 && (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => navigate('/nfse')}
          >
            <Zap className="h-4 w-4 mr-2" />
            Emitir {summary.clientesSemNota} notas pendentes
          </Button>
        )}

        {/* Lista Recente */}
        {recentNFSe.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Últimas Emissões</div>
            <ScrollArea className="h-[120px]">
              <div className="space-y-2">
                {recentNFSe.map(nfse => (
                  <div key={nfse.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStatusBadge(nfse.status)}
                      <span className="truncate">{nfse.tomador_razao_social.substring(0, 20)}</span>
                    </div>
                    <span className="font-medium text-xs">{formatCurrency(nfse.valor_servicos)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
