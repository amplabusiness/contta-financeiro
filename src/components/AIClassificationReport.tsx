import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/data/expensesData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2,
  Download,
  Building2,
  User,
  FileText,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Brain,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AIClassifiedTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  extracted_cnpj: string | null;
  extracted_cpf: string | null;
  extracted_cob: string | null;
  suggested_client_id: string | null;
  suggested_client_name: string | null;
  identification_confidence: number | null;
  identification_method: string | null;
  identification_reasoning: string | null;
  auto_matched: boolean;
  matched: boolean;
  reconciled_at: string | null;
}

interface AIClassificationReportProps {
  startDate: string;
  endDate: string;
}

const METHOD_LABELS: Record<string, { label: string; icon: typeof Building2; color: string }> = {
  'cnpj_match': { label: 'CNPJ', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  'cpf_match': { label: 'CPF', icon: User, color: 'bg-purple-100 text-purple-700' },
  'qsa_match': { label: 'Sócio (QSA)', icon: User, color: 'bg-indigo-100 text-indigo-700' },
  'invoice_match': { label: 'Fatura', icon: FileText, color: 'bg-green-100 text-green-700' },
  'pattern_learned': { label: 'Padrão Aprendido', icon: Brain, color: 'bg-amber-100 text-amber-700' },
  'none': { label: 'Não Identificado', icon: Search, color: 'bg-gray-100 text-gray-500' }
};

export function AIClassificationReport({ startDate, endDate }: AIClassificationReportProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<AIClassifiedTransaction[]>([]);
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stats, setStats] = useState({
    total: 0,
    autoMatched: 0,
    pendingReview: 0,
    totalAmount: 0,
    byMethod: {} as Record<string, number>,
    avgConfidence: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar transações classificadas pela IA
      let query = supabase
        .from('bank_transactions')
        .select(`
          id,
          transaction_date,
          description,
          amount,
          extracted_cnpj,
          extracted_cpf,
          extracted_cob,
          suggested_client_id,
          identification_confidence,
          identification_method,
          identification_reasoning,
          auto_matched,
          matched,
          reconciled_at,
          suggested_client:clients!bank_transactions_suggested_client_id_fkey(id, name)
        `)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .not('identification_method', 'is', null)
        .order('transaction_date', { ascending: false });

      if (methodFilter !== 'all') {
        query = query.eq('identification_method', methodFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: AIClassifiedTransaction[] = (data || []).map(tx => ({
        id: tx.id,
        transaction_date: tx.transaction_date,
        description: tx.description,
        amount: Number(tx.amount),
        extracted_cnpj: tx.extracted_cnpj,
        extracted_cpf: tx.extracted_cpf,
        extracted_cob: tx.extracted_cob,
        suggested_client_id: tx.suggested_client_id,
        suggested_client_name: (tx.suggested_client as any)?.name || null,
        identification_confidence: tx.identification_confidence,
        identification_method: tx.identification_method,
        identification_reasoning: tx.identification_reasoning,
        auto_matched: tx.auto_matched || false,
        matched: tx.matched || false,
        reconciled_at: tx.reconciled_at
      }));

      setTransactions(mapped);

      // Calcular estatísticas
      const byMethod: Record<string, number> = {};
      let totalConfidence = 0;
      let confidenceCount = 0;

      mapped.forEach(tx => {
        const method = tx.identification_method || 'none';
        byMethod[method] = (byMethod[method] || 0) + 1;
        if (tx.identification_confidence) {
          totalConfidence += tx.identification_confidence;
          confidenceCount++;
        }
      });

      setStats({
        total: mapped.length,
        autoMatched: mapped.filter(t => t.auto_matched && t.matched).length,
        pendingReview: mapped.filter(t => !t.matched).length,
        totalAmount: mapped.reduce((sum, t) => sum + Math.abs(t.amount), 0),
        byMethod,
        avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0
      });

    } catch (err) {
      console.error('Erro ao buscar classificações:', err);
      toast.error('Erro ao carregar relatório de classificações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, methodFilter]);

  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'Data',
      'Descrição',
      'Valor',
      'Cliente Identificado',
      'Método',
      'Confiança',
      'Raciocínio',
      'CNPJ Extraído',
      'CPF Extraído',
      'Auto Conciliado',
      'Conciliado'
    ];

    const rows = transactions.map(tx => [
      format(new Date(tx.transaction_date), 'dd/MM/yyyy'),
      `"${tx.description?.replace(/"/g, '""') || ''}"`,
      tx.amount.toFixed(2),
      `"${tx.suggested_client_name || ''}"`,
      METHOD_LABELS[tx.identification_method || 'none']?.label || tx.identification_method,
      tx.identification_confidence ? `${tx.identification_confidence}%` : '',
      `"${tx.identification_reasoning?.replace(/"/g, '""') || ''}"`,
      tx.extracted_cnpj || '',
      tx.extracted_cpf || '',
      tx.auto_matched ? 'Sim' : 'Não',
      tx.matched ? 'Sim' : 'Não'
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `classificacoes-ia-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast.success('Relatório exportado com sucesso!');
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return null;

    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline';
    let colorClass = 'bg-gray-100 text-gray-600';

    if (confidence >= 90) {
      colorClass = 'bg-emerald-100 text-emerald-700';
    } else if (confidence >= 70) {
      colorClass = 'bg-amber-100 text-amber-700';
    } else {
      colorClass = 'bg-red-100 text-red-700';
    }

    return (
      <Badge className={`${colorClass} text-[10px] font-mono`}>
        {confidence}%
      </Badge>
    );
  };

  // Filtrar transações pelo termo de busca
  const filteredTransactions = transactions.filter(tx => {
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(term) ||
      tx.suggested_client_name?.toLowerCase().includes(term) ||
      tx.extracted_cnpj?.includes(term) ||
      tx.extracted_cpf?.includes(term) ||
      tx.extracted_cob?.toLowerCase().includes(term) ||
      tx.identification_reasoning?.toLowerCase().includes(term) ||
      tx.amount.toString().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-medium">Total Analisado</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Auto Conciliados</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">{stats.autoMatched}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Search className="h-4 w-4" />
              <span className="text-xs font-medium">Aguardando Revisão</span>
            </div>
            <div className="text-2xl font-bold text-amber-700">{stats.pendingReview}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Valor Total</span>
            </div>
            <div className="text-lg font-bold text-purple-700">{formatCurrency(stats.totalAmount)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Brain className="h-4 w-4" />
              <span className="text-xs font-medium">Confiança Média</span>
            </div>
            <div className="text-2xl font-bold text-indigo-700">{stats.avgConfidence.toFixed(0)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown por método */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Classificações por Método</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.byMethod).map(([method, count]) => {
              const config = METHOD_LABELS[method] || METHOD_LABELS['none'];
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const Icon = config.icon;

              return (
                <div key={method} className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${config.color}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filtros e ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, cliente, CNPJ, CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 w-[280px] text-xs"
            />
          </div>

          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filtrar por método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os métodos</SelectItem>
              <SelectItem value="cnpj_match">CNPJ</SelectItem>
              <SelectItem value="cpf_match">CPF</SelectItem>
              <SelectItem value="qsa_match">Sócio (QSA)</SelectItem>
              <SelectItem value="invoice_match">Fatura</SelectItem>
              <SelectItem value="pattern_learned">Padrão Aprendido</SelectItem>
              <SelectItem value="none">Não Identificado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
            <RefreshCw className="h-3 w-3" />
            Atualizar
          </Button>
          <Button variant="default" size="sm" onClick={exportToCSV} className="gap-1">
            <Download className="h-3 w-3" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Separator />

      {/* Lista de transações */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhes das Classificações</CardTitle>
          <CardDescription className="text-xs">
            {searchTerm ? `${filteredTransactions.length} de ${transactions.length} transações` : `${transactions.length} transações no período`}
          </CardDescription>
        </CardHeader>
        <ScrollArea className="h-[400px]">
          <div className="p-3 space-y-2">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>{searchTerm ? 'Nenhuma classificação encontrada para a busca' : 'Nenhuma classificação encontrada no período'}</p>
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const methodConfig = METHOD_LABELS[tx.identification_method || 'none'] || METHOD_LABELS['none'];
                const Icon = methodConfig.icon;

                return (
                  <div
                    key={tx.id}
                    className={`p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors ${
                      tx.matched ? 'border-emerald-200' : tx.auto_matched ? 'border-blue-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(tx.transaction_date), 'dd/MM/yyyy')}
                          </span>
                          <Badge className={methodConfig.color + ' text-[10px]'}>
                            <Icon className="h-2.5 w-2.5 mr-1" />
                            {methodConfig.label}
                          </Badge>
                          {getConfidenceBadge(tx.identification_confidence)}
                          {tx.matched && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                              Conciliado
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm font-medium truncate" title={tx.description}>
                          {tx.description}
                        </p>

                        {tx.suggested_client_name && (
                          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Cliente: {tx.suggested_client_name}
                          </p>
                        )}

                        {tx.identification_reasoning && (
                          <p className="text-[11px] text-muted-foreground mt-1 italic">
                            {tx.identification_reasoning}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          {tx.extracted_cnpj && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              CNPJ: {tx.extracted_cnpj}
                            </span>
                          )}
                          {tx.extracted_cpf && (
                            <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                              CPF: {tx.extracted_cpf}
                            </span>
                          )}
                          {tx.extracted_cob && (
                            <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                              COB: {tx.extracted_cob}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={`text-right shrink-0 ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        <div className="font-bold">
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
