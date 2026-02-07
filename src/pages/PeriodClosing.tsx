import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw, Lock, Unlock, AlertTriangle, CheckCircle2, FileText,
  TrendingUp, TrendingDown, Calculator, Archive, ArrowRight
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PeriodData {
  id?: string;
  year: number;
  month: number;
  status: 'open' | 'closed' | 'locked';
  closed_at?: string;
  notes?: string;
}

interface ClosingData {
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  contasReceber: number;
  saldoBanco: number;
  lancamentosAbertos: number;
  inconsistencias: string[];
}

/**
 * Fechamento de Período Contábil
 *
 * Conforme NBC TG 26 (R5) e Lei 6.404/76:
 * - Zeramento das contas de resultado (Receitas e Despesas)
 * - Transferência do resultado para Patrimônio Líquido
 * - Geração de lançamento de encerramento
 * - Bloqueio do período para alterações
 */
const PeriodClosing = () => {
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [closingData, setClosingData] = useState<ClosingData | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenJustification, setReopenJustification] = useState("");

  // Carregar períodos existentes
  const loadPeriods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_periods')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;

      // Se não existirem períodos, criar os últimos 12 meses
      if (!data || data.length === 0) {
        const now = new Date();
        const periodsToCreate = [];

        for (let i = 0; i < 12; i++) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          periodsToCreate.push({
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            status: 'open'
          });
        }

        const { error: insertError } = await supabase
          .from('accounting_periods')
          .insert(periodsToCreate);

        if (insertError) {
          console.error('Erro ao criar períodos:', insertError);
        }

        // Recarregar
        const { data: newData } = await supabase
          .from('accounting_periods')
          .select('*')
          .order('year', { ascending: false })
          .order('month', { ascending: false });

        setPeriods(newData || []);
      } else {
        setPeriods(data);
      }
    } catch (error: any) {
      console.error('Erro ao carregar períodos:', error);
      toast.error('Erro ao carregar períodos');
    }
  }, []);

  // Carregar dados do período selecionado
  const loadClosingData = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

      // Buscar contas
      const { data: contas } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type')
        .eq('is_active', true)
        .eq('is_analytical', true);

      // Buscar lançamentos do período
      const { data: lancamentos } = await supabase
        .from('accounting_entry_items')
        .select(`
          debit, credit, account_id,
          entry_id(entry_date, entry_type)
        `);

      // Filtrar por período
      const lancamentosPeriodo = lancamentos?.filter((l: any) => {
        const data = l.entry_id?.entry_date;
        if (!data) return false;
        return data >= startDate && data <= endDate;
      }) || [];

      // Calcular totais por conta
      let totalReceitas = 0;
      let totalDespesas = 0;
      let contasReceber = 0;
      let saldoBanco = 0;
      const inconsistencias: string[] = [];

      const contasMap = new Map(contas?.map(c => [c.id, c]) || []);

      lancamentosPeriodo.forEach((l: any) => {
        const conta = contasMap.get(l.account_id);
        if (!conta) return;

        const codigo = conta.code;

        // Receitas (3.x) - natureza credora
        if (codigo.startsWith('3')) {
          totalReceitas += (l.credit || 0) - (l.debit || 0);
        }
        // Despesas (4.x) - natureza devedora
        else if (codigo.startsWith('4')) {
          totalDespesas += (l.debit || 0) - (l.credit || 0);
        }
        // Clientes a Receber (1.1.2)
        else if (codigo.startsWith('1.1.2')) {
          contasReceber += (l.debit || 0) - (l.credit || 0);
        }
        // Banco (1.1.1)
        else if (codigo.startsWith('1.1.1')) {
          saldoBanco += (l.debit || 0) - (l.credit || 0);
        }
      });

      // Verificar inconsistências
      // 1. Verificar partidas dobradas
      const { data: linhas } = await supabase
        .from('accounting_entry_items')
        .select('debit, credit');

      let totalDebitos = 0;
      let totalCreditos = 0;
      linhas?.forEach(l => {
        totalDebitos += l.debit || 0;
        totalCreditos += l.credit || 0;
      });

      if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
        inconsistencias.push(`Partidas dobradas com diferença de ${formatCurrency(Math.abs(totalDebitos - totalCreditos))}`);
      }

      // 2. Verificar lançamentos em contas sintéticas
      const { data: contasSinteticas } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('is_synthetic', true);

      const sinteticasIds = contasSinteticas?.map(c => c.id) || [];

      const lancamentosSinteticas = lancamentosPeriodo.filter((l: any) =>
        sinteticasIds.includes(l.account_id)
      );

      if (lancamentosSinteticas.length > 0) {
        inconsistencias.push(`${lancamentosSinteticas.length} lançamentos em contas sintéticas (não permitido)`);
      }

      // 3. Verificar transações pendentes
      const { count: pendentes } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      if (pendentes && pendentes > 0) {
        inconsistencias.push(`${pendentes} transações bancárias pendentes de conciliação`);
      }

      setClosingData({
        totalReceitas,
        totalDespesas,
        resultado: totalReceitas - totalDespesas,
        contasReceber,
        saldoBanco,
        lancamentosAbertos: lancamentosPeriodo.length,
        inconsistencias
      });

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do período');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      const [year, month] = selectedPeriod.split('-').map(Number);
      loadClosingData(year, month);
    }
  }, [selectedPeriod, loadClosingData]);

  // Fechar período
  const closePeriod = async () => {
    if (!selectedPeriod || !closingData) return;

    const [year, month] = selectedPeriod.split('-').map(Number);

    if (closingData.inconsistencias.length > 0) {
      toast.error('Resolva as inconsistências antes de fechar o período');
      return;
    }

    setLoading(true);
    try {
      // 1. Buscar contas de resultado para zeramento
      const { data: contasResultado } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('is_active', true)
        .eq('is_analytical', true)
        .or('code.like.3%,code.like.4%');

      // 2. Buscar conta de Resultado do Exercício (ou criar)
      let { data: contaResultado } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '5.1.1.01')
        .single();

      if (!contaResultado) {
        // Criar conta de Resultado do Exercício
        const { data: novaConta, error: createError } = await supabase
          .from('chart_of_accounts')
          .insert({
            code: '5.1.1.01',
            name: 'Resultado do Exercício',
            type: 'PATRIMONIO_LIQUIDO',
            nature: 'CREDORA',
            is_active: true,
            is_synthetic: false,
            is_analytical: true
          })
          .select()
          .single();

        if (createError) throw createError;
        contaResultado = novaConta;
      }

      // 3. Calcular saldos das contas de resultado
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

      const { data: lancamentos } = await supabase
        .from('accounting_entry_items')
        .select(`
          debit, credit, account_id,
          entry_id(entry_date)
        `);

      // Filtrar por período
      const lancamentosPeriodo = lancamentos?.filter((l: any) => {
        const data = l.entry_id?.entry_date;
        if (!data) return false;
        return data >= startDate && data <= endDate;
      }) || [];

      // Calcular saldos por conta
      const saldosPorConta: Record<string, number> = {};
      lancamentosPeriodo.forEach((l: any) => {
        const contaId = l.account_id;
        if (!saldosPorConta[contaId]) saldosPorConta[contaId] = 0;
        saldosPorConta[contaId] += (l.debit || 0) - (l.credit || 0);
      });

      // 4. Criar lançamento de encerramento
      const { data: entryEncerramento, error: entryError } = await supabase
        .from('accounting_entries')
        .insert({
          entry_date: endDate,
          competence_date: endDate,
          description: `Encerramento do Exercício - ${month.toString().padStart(2, '0')}/${year}`,
          entry_type: 'encerramento',
          reference_type: 'period_closing',
          reference_id: `${year}-${month}`
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // 5. Criar linhas de zeramento
      const linhasEncerramento = [];

      contasResultado?.forEach(conta => {
        const saldo = saldosPorConta[conta.id] || 0;
        if (Math.abs(saldo) < 0.01) return; // Ignorar contas sem saldo

        const isReceita = conta.code.startsWith('3');

        if (isReceita) {
          // Receita: natureza credora, debitar para zerar
          linhasEncerramento.push({
            entry_id: entryEncerramento.id,
            account_id: conta.id,
            debit: Math.abs(saldo),
            credit: 0,
            description: `Zeramento ${conta.code} - ${conta.name}`
          });
        } else {
          // Despesa: natureza devedora, creditar para zerar
          linhasEncerramento.push({
            entry_id: entryEncerramento.id,
            account_id: conta.id,
            debit: 0,
            credit: Math.abs(saldo),
            description: `Zeramento ${conta.code} - ${conta.name}`
          });
        }
      });

      // 6. Adicionar contrapartida no Resultado do Exercício
      const resultado = closingData.resultado;
      if (Math.abs(resultado) >= 0.01) {
        if (resultado > 0) {
          // Lucro: creditar Resultado do Exercício
          linhasEncerramento.push({
            entry_id: entryEncerramento.id,
            account_id: contaResultado.id,
            debit: 0,
            credit: resultado,
            description: `Apuração do Resultado - Lucro de ${formatCurrency(resultado)}`
          });
        } else {
          // Prejuízo: debitar Resultado do Exercício
          linhasEncerramento.push({
            entry_id: entryEncerramento.id,
            account_id: contaResultado.id,
            debit: Math.abs(resultado),
            credit: 0,
            description: `Apuração do Resultado - Prejuízo de ${formatCurrency(Math.abs(resultado))}`
          });
        }
      }

      // 7. Inserir linhas de encerramento (strip description para accounting_entry_items)
      if (linhasEncerramento.length > 0) {
        const itemsSemDesc = linhasEncerramento.map(({ description, ...rest }: any) => rest);
        const { error: linesError } = await supabase
          .from('accounting_entry_items')
          .insert(itemsSemDesc);

        if (linesError) throw linesError;
      }

      // 8. Atualizar status do período
      const { error: periodError } = await supabase
        .from('accounting_periods')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          notes: closeNotes || `Fechamento com resultado de ${formatCurrency(resultado)}`
        })
        .eq('year', year)
        .eq('month', month);

      if (periodError) throw periodError;

      // 9. Registrar no histórico
      await supabase
        .from('period_close_history')
        .insert({
          year,
          month,
          action: 'closed',
          reason: closeNotes,
          balances: {
            receitas: closingData.totalReceitas,
            despesas: closingData.totalDespesas,
            resultado: closingData.resultado,
            banco: closingData.saldoBanco,
            clientes: closingData.contasReceber
          }
        });

      toast.success(`Período ${month.toString().padStart(2, '0')}/${year} fechado com sucesso!`);
      setShowCloseDialog(false);
      setCloseNotes("");
      loadPeriods();

    } catch (error: any) {
      console.error('Erro ao fechar período:', error);
      toast.error('Erro ao fechar período: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Solicitar reabertura
  const requestReopen = async () => {
    if (!selectedPeriod || !reopenReason || !reopenJustification) {
      toast.error('Preencha o motivo e a justificativa');
      return;
    }

    const [year, month] = selectedPeriod.split('-').map(Number);

    try {
      const { error } = await supabase
        .from('period_reopen_requests')
        .insert({
          year,
          month,
          reason: reopenReason,
          justification: reopenJustification,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Solicitação de reabertura enviada para análise');
      setShowReopenDialog(false);
      setReopenReason("");
      setReopenJustification("");

    } catch (error: any) {
      console.error('Erro ao solicitar reabertura:', error);
      toast.error('Erro ao solicitar reabertura');
    }
  };

  const currentPeriod = periods.find(p => selectedPeriod === `${p.year}-${p.month}`);
  const monthNames = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Fechamento de Período</h1>
            <p className="text-muted-foreground">
              Encerramento contábil conforme NBC TG 26 e Lei 6.404/76
            </p>
          </div>
          <Button onClick={loadPeriods} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Seleção de Período */}
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Período</CardTitle>
            <CardDescription>Escolha o período para fechamento ou consulta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Período</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período..." />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                        <div className="flex items-center gap-2">
                          {monthNames[p.month]}/{p.year}
                          <Badge variant={
                            p.status === 'locked' ? 'destructive' :
                            p.status === 'closed' ? 'secondary' : 'default'
                          }>
                            {p.status === 'locked' ? 'Bloqueado' :
                             p.status === 'closed' ? 'Fechado' : 'Aberto'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentPeriod && (
                <div className="flex gap-2">
                  {currentPeriod.status === 'open' && (
                    <Button
                      onClick={() => setShowCloseDialog(true)}
                      disabled={loading || (closingData?.inconsistencias?.length || 0) > 0}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Fechar Período
                    </Button>
                  )}
                  {currentPeriod.status === 'closed' && (
                    <Button
                      variant="outline"
                      onClick={() => setShowReopenDialog(true)}
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Solicitar Reabertura
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        )}

        {closingData && !loading && (
          <>
            {/* Resumo do Período */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Receitas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(closingData.totalReceitas)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Despesas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(closingData.totalDespesas)}
                  </p>
                </CardContent>
              </Card>

              <Card className={closingData.resultado >= 0 ? 'border-green-500' : 'border-red-500'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Resultado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${
                    closingData.resultado >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {closingData.resultado >= 0 ? 'Lucro: ' : 'Prejuízo: '}
                    {formatCurrency(Math.abs(closingData.resultado))}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Lançamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {closingData.lancamentosAbertos}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Verificações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {closingData.inconsistencias.length === 0 ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Período OK para Fechamento
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Inconsistências Encontradas
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {closingData.inconsistencias.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-green-600 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Partidas dobradas equilibradas
                    </p>
                    <p className="text-green-600 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Todos lançamentos em contas analíticas
                    </p>
                    <p className="text-green-600 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Transações bancárias conciliadas
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {closingData.inconsistencias.map((inc, idx) => (
                      <Alert key={idx} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{inc}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumo do que será feito no fechamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Procedimento de Fechamento
                </CardTitle>
                <CardDescription>
                  O fechamento executará as seguintes ações conforme NBC TG 26
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <p className="font-medium">Zeramento de Receitas</p>
                      <p className="text-sm text-muted-foreground">
                        Débito nas contas do grupo 3.x para zerar {formatCurrency(closingData.totalReceitas)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <p className="font-medium">Zeramento de Despesas</p>
                      <p className="text-sm text-muted-foreground">
                        Crédito nas contas do grupo 4.x para zerar {formatCurrency(closingData.totalDespesas)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">Apuração do Resultado</p>
                        <p className="text-sm text-muted-foreground">
                          {closingData.resultado >= 0 ? 'Crédito' : 'Débito'} em Resultado do Exercício (5.1.1.01)
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                      <Badge variant={closingData.resultado >= 0 ? 'default' : 'destructive'}>
                        {formatCurrency(Math.abs(closingData.resultado))}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</div>
                    <div>
                      <p className="font-medium">Bloqueio do Período</p>
                      <p className="text-sm text-muted-foreground">
                        O período será fechado e não aceitará novos lançamentos
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Saldos Finais */}
            <Card>
              <CardHeader>
                <CardTitle>Saldos para Fechamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Saldo Banco</p>
                    <p className="text-xl font-bold">{formatCurrency(closingData.saldoBanco)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Clientes a Receber</p>
                    <p className="text-xl font-bold">{formatCurrency(closingData.contasReceber)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Dialog de Fechamento */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Fechamento</DialogTitle>
              <DialogDescription>
                Você está prestes a fechar o período {selectedPeriod?.split('-').reverse().join('/')}.
                Esta ação irá zerar as contas de resultado e bloquear o período.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Observações sobre o fechamento..."
                />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Após o fechamento, o período só poderá ser reaberto mediante solicitação formal e aprovação.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={closePeriod} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Confirmar Fechamento
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Reabertura */}
        <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Reabertura</DialogTitle>
              <DialogDescription>
                Preencha o motivo e justificativa para reabertura do período.
                A solicitação será analisada antes de ser aprovada.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Motivo *</Label>
                <Select value={reopenReason} onValueChange={setReopenReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erro_lancamento">Correção de lançamento</SelectItem>
                    <SelectItem value="documento_atrasado">Documento recebido com atraso</SelectItem>
                    <SelectItem value="auditoria">Ajuste de auditoria</SelectItem>
                    <SelectItem value="conciliacao">Correção de conciliação</SelectItem>
                    <SelectItem value="outro">Outro motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Justificativa *</Label>
                <Textarea
                  value={reopenJustification}
                  onChange={(e) => setReopenJustification(e.target.value)}
                  placeholder="Descreva detalhadamente o motivo da reabertura..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReopenDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={requestReopen} disabled={!reopenReason || !reopenJustification}>
                <Unlock className="h-4 w-4 mr-2" />
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PeriodClosing;
