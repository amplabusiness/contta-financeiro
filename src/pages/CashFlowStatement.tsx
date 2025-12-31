import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, FileDown, TrendingUp, TrendingDown, Building2, Wallet, Banknote, Info } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CashFlowItem {
  code: string;
  name: string;
  value: number;
  isSubtotal?: boolean;
  tooltip?: string;
}

interface CashFlowData {
  operacional: CashFlowItem[];
  investimento: CashFlowItem[];
  financiamento: CashFlowItem[];
  saldoInicial: number;
  saldoFinal: number;
  variacaoLiquida: number;
}

/**
 * DFC - Demonstração do Fluxo de Caixa
 * Conforme NBC TG 03 (R3) - Demonstração dos Fluxos de Caixa
 *
 * Método Indireto:
 * - Parte do Lucro Líquido
 * - Ajusta por itens não caixa
 * - Classifica em 3 atividades: Operacional, Investimento, Financiamento
 */
const CashFlowStatement = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const [loading, setLoading] = useState(false);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData>({
    operacional: [],
    investimento: [],
    financiamento: [],
    saldoInicial: 0,
    saldoFinal: 0,
    variacaoLiquida: 0
  });

  const loadCashFlow = useCallback(async () => {
    setLoading(true);
    try {
      // Construir filtro de data baseado no período selecionado
      let startDate: string | null = null;
      let endDate: string | null = null;
      let previousEndDate: string | null = null;

      if (selectedYear && selectedMonth) {
        const year = selectedYear;
        const month = selectedMonth;
        startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

        // Data final do período anterior (para saldo inicial)
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
        previousEndDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${prevLastDay}`;
      } else if (selectedYear) {
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
        previousEndDate = `${selectedYear - 1}-12-31`;
      } else {
        // Sem filtro - usar ano atual
        const now = new Date();
        startDate = `${now.getFullYear()}-01-01`;
        endDate = now.toISOString().split('T')[0];
        previousEndDate = `${now.getFullYear() - 1}-12-31`;
      }

      // 1. Buscar contas de caixa/banco (1.1.1.xx)
      const { data: contasCaixa, error: contasCaixaError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('is_active', true)
        .like('code', '1.1.1.%');

      if (contasCaixaError) throw contasCaixaError;

      const contasCaixaIds = contasCaixa?.map(c => c.id) || [];

      // 2. Buscar saldo inicial de caixa (até o período anterior)
      const { data: saldoInicialData } = await supabase
        .from('accounting_entry_lines')
        .select(`
          debit, credit, account_id,
          entry_id(entry_date)
        `)
        .in('account_id', contasCaixaIds);

      let saldoInicial = 0;
      saldoInicialData?.forEach((line: any) => {
        if (previousEndDate && line.entry_id?.entry_date <= previousEndDate) {
          saldoInicial += (line.debit || 0) - (line.credit || 0);
        }
      });

      // 3. Buscar saldo final de caixa (até o final do período)
      let saldoFinal = 0;
      saldoInicialData?.forEach((line: any) => {
        if (endDate && line.entry_id?.entry_date <= endDate) {
          saldoFinal += (line.debit || 0) - (line.credit || 0);
        }
      });

      // 4. Buscar todas as contas para classificação
      const { data: todasContas } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type')
        .eq('is_active', true)
        .eq('is_analytical', true);

      // 5. Buscar todos os lançamentos do período
      const { data: lancamentos } = await supabase
        .from('accounting_entry_lines')
        .select(`
          debit, credit, account_id,
          entry_id(entry_date, description, entry_type)
        `);

      // Filtrar por período
      const lancamentosPeriodo = lancamentos?.filter((l: any) => {
        const data = l.entry_id?.entry_date;
        if (!data) return false;
        return data >= startDate && data <= endDate;
      }) || [];

      // Mapa de contas por código
      const contasMap = new Map(todasContas?.map(c => [c.id, c]) || []);

      // Classificar movimentações
      const operacional: Record<string, number> = {};
      const investimento: Record<string, number> = {};
      const financiamento: Record<string, number> = {};

      // Para método indireto, precisamos do lucro líquido
      let receitaTotal = 0;
      let despesaTotal = 0;

      lancamentosPeriodo.forEach((l: any) => {
        const conta = contasMap.get(l.account_id);
        if (!conta) return;

        const codigo = conta.code;
        const valor = (l.debit || 0) - (l.credit || 0);
        const valorCredito = (l.credit || 0) - (l.debit || 0);

        // Receitas (3.x) - natureza credora
        if (codigo.startsWith('3')) {
          receitaTotal += valorCredito;
          return;
        }

        // Despesas (4.x) - natureza devedora
        if (codigo.startsWith('4')) {
          despesaTotal += valor;
          return;
        }

        // Ativo Circulante operacional (exceto caixa)
        if (codigo.startsWith('1.1.') && !codigo.startsWith('1.1.1.')) {
          // Clientes a Receber (1.1.2)
          if (codigo.startsWith('1.1.2')) {
            operacional['Variação Clientes a Receber'] = (operacional['Variação Clientes a Receber'] || 0) - valor;
          }
          // Estoques (1.1.4)
          else if (codigo.startsWith('1.1.4')) {
            operacional['Variação Estoques'] = (operacional['Variação Estoques'] || 0) - valor;
          }
          // Adiantamentos a Sócios (1.1.3) - considerado financiamento
          else if (codigo.startsWith('1.1.3')) {
            financiamento['Adiantamento a Sócios'] = (financiamento['Adiantamento a Sócios'] || 0) - valor;
          }
          // Outros ativos circulantes
          else {
            operacional['Variação Outros Ativos Circulantes'] = (operacional['Variação Outros Ativos Circulantes'] || 0) - valor;
          }
        }

        // Ativo Não Circulante (1.2) - Investimento
        if (codigo.startsWith('1.2')) {
          investimento['Aquisição de Ativos'] = (investimento['Aquisição de Ativos'] || 0) - valor;
        }

        // Passivo Circulante (2.1)
        if (codigo.startsWith('2.1')) {
          // Fornecedores
          if (codigo.startsWith('2.1.1')) {
            operacional['Variação Fornecedores'] = (operacional['Variação Fornecedores'] || 0) + valorCredito;
          }
          // Obrigações trabalhistas
          else if (codigo.startsWith('2.1.2') || codigo.startsWith('2.1.3')) {
            operacional['Variação Obrigações Trabalhistas'] = (operacional['Variação Obrigações Trabalhistas'] || 0) + valorCredito;
          }
          // Obrigações tributárias
          else if (codigo.startsWith('2.1.4') || codigo.startsWith('2.1.5')) {
            operacional['Variação Obrigações Tributárias'] = (operacional['Variação Obrigações Tributárias'] || 0) + valorCredito;
          }
          // Empréstimos
          else if (codigo.startsWith('2.1.6')) {
            financiamento['Empréstimos Recebidos'] = (financiamento['Empréstimos Recebidos'] || 0) + valorCredito;
          }
          else {
            operacional['Variação Outras Obrigações'] = (operacional['Variação Outras Obrigações'] || 0) + valorCredito;
          }
        }

        // Passivo Não Circulante (2.2) - Financiamento
        if (codigo.startsWith('2.2')) {
          financiamento['Financiamentos'] = (financiamento['Financiamentos'] || 0) + valorCredito;
        }

        // Patrimônio Líquido (5.x) - Financiamento
        if (codigo.startsWith('5')) {
          // Capital Social
          if (codigo.startsWith('5.1')) {
            financiamento['Integralização de Capital'] = (financiamento['Integralização de Capital'] || 0) + valorCredito;
          }
          // Distribuição de lucros
          else if (codigo.startsWith('5.2')) {
            financiamento['Distribuição de Lucros'] = (financiamento['Distribuição de Lucros'] || 0) - valorCredito;
          }
        }
      });

      // Calcular lucro líquido
      const lucroLiquido = receitaTotal - despesaTotal;

      // Montar arrays de fluxo de caixa
      const operacionalItems: CashFlowItem[] = [
        { code: '', name: 'Lucro Líquido do Período', value: lucroLiquido, tooltip: 'Resultado do período (Receitas - Despesas)' }
      ];

      // Adicionar itens operacionais
      Object.entries(operacional).forEach(([name, value]) => {
        if (Math.abs(value) > 0.01) {
          operacionalItems.push({ code: '', name, value });
        }
      });

      const totalOperacional = operacionalItems.reduce((sum, item) => sum + item.value, 0);
      operacionalItems.push({
        code: '',
        name: 'Caixa Líquido Atividades Operacionais',
        value: totalOperacional,
        isSubtotal: true,
        tooltip: 'NBC TG 03: Fluxos de caixa das operações principais geradoras de receita'
      });

      // Itens de Investimento
      const investimentoItems: CashFlowItem[] = [];
      Object.entries(investimento).forEach(([name, value]) => {
        if (Math.abs(value) > 0.01) {
          investimentoItems.push({ code: '', name, value });
        }
      });
      const totalInvestimento = investimentoItems.reduce((sum, item) => sum + item.value, 0);
      if (investimentoItems.length > 0) {
        investimentoItems.push({
          code: '',
          name: 'Caixa Líquido Atividades de Investimento',
          value: totalInvestimento,
          isSubtotal: true,
          tooltip: 'NBC TG 03: Aquisição e venda de ativos de longo prazo'
        });
      }

      // Itens de Financiamento
      const financiamentoItems: CashFlowItem[] = [];
      Object.entries(financiamento).forEach(([name, value]) => {
        if (Math.abs(value) > 0.01) {
          financiamentoItems.push({ code: '', name, value });
        }
      });
      const totalFinanciamento = financiamentoItems.reduce((sum, item) => sum + item.value, 0);
      if (financiamentoItems.length > 0) {
        financiamentoItems.push({
          code: '',
          name: 'Caixa Líquido Atividades de Financiamento',
          value: totalFinanciamento,
          isSubtotal: true,
          tooltip: 'NBC TG 03: Mudanças no capital próprio e empréstimos'
        });
      }

      // Variação líquida de caixa
      const variacaoLiquida = totalOperacional + totalInvestimento + totalFinanciamento;

      setCashFlowData({
        operacional: operacionalItems,
        investimento: investimentoItems,
        financiamento: financiamentoItems,
        saldoInicial,
        saldoFinal,
        variacaoLiquida
      });

      // Verificar conciliação
      const diferencaConciliacao = Math.abs(variacaoLiquida - (saldoFinal - saldoInicial));
      if (diferencaConciliacao > 0.01) {
        toast.warning(`Atenção: Diferença de conciliação de ${formatCurrency(diferencaConciliacao)}`);
      } else {
        toast.success('DFC conciliada com sucesso!');
      }

    } catch (error: any) {
      toast.error('Erro ao carregar DFC: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadCashFlow();
  }, [loadCashFlow]);

  const renderFlowSection = (
    title: string,
    items: CashFlowItem[],
    icon: React.ReactNode,
    colorClass: string
  ) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Sem movimentação no período
            </p>
          ) : (
            items.map((item, idx) => (
              <div
                key={idx}
                className={`flex justify-between items-center py-2 px-3 rounded ${
                  item.isSubtotal
                    ? 'bg-primary/10 font-bold border-t-2 border-primary mt-2'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={item.isSubtotal ? 'text-primary' : ''}>
                    {item.name}
                  </span>
                  {item.tooltip && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{item.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <span className={`font-medium ${
                  item.value >= 0 ? 'text-green-600' : 'text-red-600'
                } ${item.isSubtotal ? 'text-lg' : ''}`}>
                  {item.value >= 0 ? '' : '-'}{formatCurrency(Math.abs(item.value))}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );

  const saldoVerificado = Math.abs(
    cashFlowData.variacaoLiquida - (cashFlowData.saldoFinal - cashFlowData.saldoInicial)
  ) < 0.01;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">DFC - Demonstração do Fluxo de Caixa</h1>
            <p className="text-muted-foreground">
              Conforme NBC TG 03 (R3) - Método Indireto
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast.info("Em desenvolvimento")}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={loadCashFlow} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filtro de Período */}
        <Card>
          <CardHeader>
            <CardTitle>Período</CardTitle>
            <CardDescription>Selecione o período para análise do fluxo de caixa</CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Saldo Inicial</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(cashFlowData.saldoInicial)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    {cashFlowData.variacaoLiquida >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    Variação Líquida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${
                    cashFlowData.variacaoLiquida >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {cashFlowData.variacaoLiquida >= 0 ? '+' : ''}{formatCurrency(cashFlowData.variacaoLiquida)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Saldo Final</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(cashFlowData.saldoFinal)}</p>
                </CardContent>
              </Card>

              <Card className={saldoVerificado ? 'border-green-500' : 'border-red-500'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Verificação</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-lg font-bold ${saldoVerificado ? 'text-green-600' : 'text-red-600'}`}>
                    {saldoVerificado ? 'Conciliado' : 'Divergência'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    SI + Variação = SF
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Seções do Fluxo de Caixa */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {renderFlowSection(
                'Atividades Operacionais',
                cashFlowData.operacional,
                <Wallet className="h-5 w-5 text-blue-500" />,
                'text-blue-600'
              )}

              {renderFlowSection(
                'Atividades de Investimento',
                cashFlowData.investimento,
                <Building2 className="h-5 w-5 text-purple-500" />,
                'text-purple-600'
              )}

              {renderFlowSection(
                'Atividades de Financiamento',
                cashFlowData.financiamento,
                <Banknote className="h-5 w-5 text-green-500" />,
                'text-green-600'
              )}
            </div>

            {/* Conciliação Final */}
            <Card className="border-primary">
              <CardHeader>
                <CardTitle>Conciliação de Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2">
                    <span>Saldo Inicial de Caixa</span>
                    <span className="font-medium">{formatCurrency(cashFlowData.saldoInicial)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span>(+/-) Variação Líquida de Caixa</span>
                    <span className={`font-medium ${
                      cashFlowData.variacaoLiquida >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(cashFlowData.variacaoLiquida)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t-2 border-primary font-bold bg-primary/5 px-3 rounded">
                    <span>(=) Saldo Final de Caixa</span>
                    <span className="text-primary text-lg">{formatCurrency(cashFlowData.saldoFinal)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 text-sm text-muted-foreground">
                    <span>Conferência: SI + Variação</span>
                    <span>{formatCurrency(cashFlowData.saldoInicial + cashFlowData.variacaoLiquida)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notas sobre NBC TG 03 */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>NBC TG 03 (R3) - Demonstração dos Fluxos de Caixa</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li><strong>Atividades Operacionais:</strong> Principais atividades geradoras de receita</li>
                  <li><strong>Atividades de Investimento:</strong> Aquisição e venda de ativos de longo prazo</li>
                  <li><strong>Atividades de Financiamento:</strong> Mudanças no capital próprio e empréstimos</li>
                  <li><strong>Método utilizado:</strong> Indireto (parte do lucro líquido e ajusta por itens não caixa)</li>
                </ul>
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </Layout>
  );
};

export default CashFlowStatement;
