/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║           DASHBOARD EXECUTIVO DEFINITIVO — CONTTA 2026           ║
 * ║                                                                   ║
 * ║  "Entender o negócio em 30 segundos"                             ║
 * ║                                                                   ║
 * ║  Princípios:                                                      ║
 * ║  • Menos números, mais significado                               ║
 * ║  • Visão executiva primeiro, detalhe sob demanda                 ║
 * ║  • Zero poluição visual                                          ║
 * ║  • IA como copiloto silencioso                                   ║
 * ║  • Tudo comparável no tempo                                      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Wallet, TrendingUp, TrendingDown, Users, AlertTriangle,
  ArrowUpRight, ArrowDownRight, ArrowRight, RefreshCw,
  Building2, FileText, Calendar, ChevronRight, Bot,
  BarChart3, LineChart, PieChart, Eye, ExternalLink
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart as ReLineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// Design System
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { usePeriod } from "@/contexts/PeriodContext";
import { getDashboardBalances, getAdiantamentosSocios } from "@/lib/accountMapping";

// Types
interface ExecutiveStats {
  saldoConsolidado: number;
  resultadoPeriodo: number;
  honorariosReceber: number;
  inadimplencia: number;
  clientesAtivos: number;
  projecao30dias: number;
  // Variações
  varSaldo: number;
  varResultado: number;
  varInadimplencia: number;
}

interface ChartData {
  month: string;
  receita: number;
  despesa: number;
  resultado: number;
  saldo: number;
}

interface ClienteResumido {
  id: string;
  nome: string;
  cnpj: string;
  status: 'regular' | 'atencao' | 'critico';
  pendente: number;
  faturas: number;
}

interface DrCiceroInsight {
  id: string;
  tipo: 'alerta' | 'insight' | 'oportunidade';
  titulo: string;
  descricao: string;
  acao?: { label: string; rota: string };
}

// ═══════════════════════════════════════════════════════════════
// 🎨 DESIGN TOKENS (Brand Book Compliance)
// ═══════════════════════════════════════════════════════════════
const colors = {
  primary: {
    50: '#eef9fd',
    100: '#d6f0fa',
    500: '#0a8fc5',
    600: '#0773a0',
    700: '#065a7c',
  },
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
  },
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  ai: '#7c3aed',
};

// ═══════════════════════════════════════════════════════════════
// 📊 KPI CARD COMPONENT (Executivo)
// ═══════════════════════════════════════════════════════════════
interface KPIExecutivoProps {
  titulo: string;
  valor: string;
  subtitulo?: string;
  variacao?: number;
  variacaoLabel?: string;
  icone: React.ReactNode;
  destaque?: boolean;
  onClick?: () => void;
}

function KPIExecutivo({ 
  titulo, 
  valor, 
  subtitulo,
  variacao, 
  variacaoLabel = "vs mês anterior",
  icone,
  destaque = false,
  onClick
}: KPIExecutivoProps) {
  const isPositivo = variacao && variacao >= 0;
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white rounded-lg border p-5 transition-all",
        destaque ? "border-primary-200 shadow-sm" : "border-neutral-200",
        onClick && "cursor-pointer hover:border-primary-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          {titulo}
        </span>
        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
          {icone}
        </div>
      </div>
      
      <div className="mb-2">
        <span className="text-2xl font-bold text-neutral-800 font-mono tracking-tight">
          {valor}
        </span>
      </div>
      
      {(variacao !== undefined || subtitulo) && (
        <div className="flex items-center gap-2">
          {variacao !== undefined && (
            <span className={cn(
              "inline-flex items-center text-xs font-medium",
              isPositivo ? "text-emerald-600" : "text-red-600"
            )}>
              {isPositivo ? (
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-0.5" />
              )}
              {Math.abs(variacao).toFixed(1)}%
            </span>
          )}
          <span className="text-xs text-neutral-400">
            {subtitulo || variacaoLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📈 GRÁFICO DE EVOLUÇÃO
// ═══════════════════════════════════════════════════════════════
function GraficoEvolucao({ 
  dados, 
  tipo 
}: { 
  dados: ChartData[]; 
  tipo: 'saldo' | 'receita-despesa' | 'resultado';
}) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    
    return (
      <div className="bg-white border border-neutral-200 rounded-lg shadow-lg p-3">
        <p className="text-xs font-medium text-neutral-600 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-neutral-600">{entry.name}:</span>
            <span className="font-mono font-medium text-neutral-800">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (tipo === 'saldo') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={dados}>
          <defs>
            <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.primary[500]} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={colors.primary[500]} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 11, fill: colors.neutral[500] }}
            axisLine={{ stroke: colors.neutral[200] }}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: colors.neutral[500] }}
            tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
            axisLine={{ stroke: colors.neutral[200] }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="saldo" 
            name="Saldo"
            stroke={colors.primary[500]} 
            fill="url(#saldoGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'receita-despesa') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 11, fill: colors.neutral[500] }}
            axisLine={{ stroke: colors.neutral[200] }}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: colors.neutral[500] }}
            tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
            axisLine={{ stroke: colors.neutral[200] }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar 
            dataKey="receita" 
            name="Receita" 
            fill={colors.primary[500]} 
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="despesa" 
            name="Despesa" 
            fill={colors.neutral[400]} 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // tipo === 'resultado'
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ReLineChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
        <XAxis 
          dataKey="month" 
          tick={{ fontSize: 11, fill: colors.neutral[500] }}
          axisLine={{ stroke: colors.neutral[200] }}
        />
        <YAxis 
          tick={{ fontSize: 11, fill: colors.neutral[500] }}
          tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
          axisLine={{ stroke: colors.neutral[200] }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line 
          type="monotone" 
          dataKey="resultado" 
          name="Resultado"
          stroke={colors.success} 
          strokeWidth={2}
          dot={{ fill: colors.success, strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🤖 DR. CÍCERO - ÁREA DE IA
// ═══════════════════════════════════════════════════════════════
function DrCiceroArea({ insights }: { insights: DrCiceroInsight[] }) {
  const navigate = useNavigate();
  
  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-neutral-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Bot className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Dr. Cícero</h3>
            <p className="text-xs text-neutral-500">Consultor IA</p>
          </div>
        </div>
        <p className="text-sm text-neutral-500 italic">
          Nenhuma observação relevante no momento. Os indicadores estão dentro dos parâmetros esperados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
          <Bot className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">Dr. Cícero</h3>
          <p className="text-xs text-neutral-500">Consultor IA</p>
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight) => (
          <div 
            key={insight.id}
            className={cn(
              "p-3 rounded-lg border-l-4",
              insight.tipo === 'alerta' && "bg-amber-50 border-l-amber-500",
              insight.tipo === 'insight' && "bg-violet-50 border-l-violet-500",
              insight.tipo === 'oportunidade' && "bg-emerald-50 border-l-emerald-500"
            )}
          >
            <h4 className="text-sm font-medium text-neutral-800 mb-1">
              {insight.titulo}
            </h4>
            <p className="text-xs text-neutral-600 leading-relaxed mb-2">
              {insight.descricao}
            </p>
            {insight.acao && (
              <button
                onClick={() => navigate(insight.acao!.rota)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                {insight.acao.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📋 LISTA DE CLIENTES (Ação Rápida)
// ═══════════════════════════════════════════════════════════════
function ListaClientesRapida({ clientes }: { clientes: ClienteResumido[] }) {
  const navigate = useNavigate();
  
  const statusColors = {
    regular: 'bg-emerald-100 text-emerald-700',
    atencao: 'bg-amber-100 text-amber-700',
    critico: 'bg-red-100 text-red-700',
  };

  const statusLabels = {
    regular: 'Regular',
    atencao: 'Atenção',
    critico: 'Crítico',
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-800">
          Clientes - Ação Rápida
        </h3>
        <button 
          onClick={() => navigate('/clients')}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          Ver todos
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      
      <div className="divide-y divide-neutral-100">
        {clientes.slice(0, 5).map((cliente) => (
          <div 
            key={cliente.id}
            className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800 truncate">
                {cliente.nome}
              </p>
              <p className="text-xs text-neutral-500 font-mono">
                {cliente.cnpj}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded",
                statusColors[cliente.status]
              )}>
                {statusLabels[cliente.status]}
              </span>
              
              {cliente.pendente > 0 && (
                <div className="text-right">
                  <p className="text-xs font-mono font-medium text-neutral-800">
                    {formatCurrency(cliente.pendente)}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {cliente.faturas} faturas
                  </p>
                </div>
              )}
              
              <button 
                onClick={() => navigate(`/clients?id=${cliente.id}`)}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-primary-600 transition-colors"
                title="Ver empresa"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🏠 DASHBOARD EXECUTIVO - COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function DashboardExecutivo() {
  const navigate = useNavigate();
  const { selectedYear, selectedMonth } = usePeriod();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ExecutiveStats>({
    saldoConsolidado: 0,
    resultadoPeriodo: 0,
    honorariosReceber: 0,
    inadimplencia: 0,
    clientesAtivos: 0,
    projecao30dias: 0,
    varSaldo: 0,
    varResultado: 0,
    varInadimplencia: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [clientes, setClientes] = useState<ClienteResumido[]>([]);
  const [drCiceroInsights, setDrCiceroInsights] = useState<DrCiceroInsight[]>([]);

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar saldos contábeis
      const balances = await getDashboardBalances(selectedYear, selectedMonth);
      const adiantamentos = await getAdiantamentosSocios(selectedYear, selectedMonth);

      // Buscar clientes
      const { data: clientsData, count } = await supabase
        .from("clients")
        .select("id, name, cnpj, monthly_fee", { count: "exact" })
        .eq("is_active", true)
        .not("is_pro_bono", "eq", true)
        .order("name")
        .limit(10);

      // Buscar faturas pendentes
      const { data: invoices } = await supabase
        .from("invoices")
        .select("client_id, amount, status, due_date")
        .in("status", ["pending", "overdue"]);

      // Calcular inadimplência (faturas vencidas)
      const overdueInvoices = invoices?.filter(i => i.status === "overdue") || [];
      const totalInadimplencia = overdueInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
      const totalPendente = invoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;

      // Mapear clientes com status
      const clientesMapeados: ClienteResumido[] = (clientsData || []).map(c => {
        const faturasPendentes = invoices?.filter(i => i.client_id === c.id) || [];
        const valorPendente = faturasPendentes.reduce((sum, i) => sum + (i.amount || 0), 0);
        const temVencida = faturasPendentes.some(i => i.status === "overdue");
        
        return {
          id: c.id,
          nome: c.name,
          cnpj: c.cnpj || '---',
          status: temVencida ? 'critico' : valorPendente > 0 ? 'atencao' : 'regular',
          pendente: valorPendente,
          faturas: faturasPendentes.length,
        };
      });

      // Ordenar por status (crítico primeiro)
      clientesMapeados.sort((a, b) => {
        const ordem = { critico: 0, atencao: 1, regular: 2 };
        return ordem[a.status] - ordem[b.status];
      });

      // Stats executivos
      const resultado = balances.totalReceitas - balances.totalDespesas;
      
      setStats({
        saldoConsolidado: balances.saldoBanco,
        resultadoPeriodo: resultado,
        honorariosReceber: balances.contasReceber,
        inadimplencia: totalInadimplencia,
        clientesAtivos: count || 0,
        projecao30dias: resultado * 1.1, // Simplificado
        varSaldo: 5.2, // Mock - implementar cálculo real
        varResultado: resultado > 0 ? 8.3 : -4.2,
        varInadimplencia: totalInadimplencia > 0 ? 12.5 : 0,
      });

      setClientes(clientesMapeados);

      // Gerar dados de gráfico (mock - implementar busca real)
      const meses = ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mockChartData: ChartData[] = meses.map((month, i) => ({
        month,
        receita: balances.totalReceitas * (0.8 + Math.random() * 0.4),
        despesa: balances.totalDespesas * (0.8 + Math.random() * 0.4),
        resultado: resultado * (0.7 + Math.random() * 0.6),
        saldo: balances.saldoBanco * (0.9 + i * 0.02),
      }));
      setChartData(mockChartData);

      // Gerar insights do Dr. Cícero
      const insights: DrCiceroInsight[] = [];
      
      if (totalInadimplencia > 10000) {
        insights.push({
          id: 'inadimplencia',
          tipo: 'alerta',
          titulo: 'Inadimplência em alta',
          descricao: `Detectei ${formatCurrency(totalInadimplencia)} em faturas vencidas. Recomendo análise da carteira de cobrança.`,
          acao: { label: 'Analisar cobrança', rota: '/inadimplencia-dashboard' }
        });
      }

      if (resultado < 0) {
        insights.push({
          id: 'resultado-negativo',
          tipo: 'alerta',
          titulo: 'Resultado negativo no período',
          descricao: 'As despesas superaram as receitas neste período. Verificar principais centros de custo.',
          acao: { label: 'Ver DRE', rota: '/dre' }
        });
      } else if (resultado > balances.totalReceitas * 0.3) {
        insights.push({
          id: 'resultado-otimo',
          tipo: 'oportunidade',
          titulo: 'Excelente margem de resultado',
          descricao: `Margem de ${((resultado / balances.totalReceitas) * 100).toFixed(1)}% sobre a receita. Considerar investimentos.`,
        });
      }

      if (balances.saldoBanco > 100000) {
        insights.push({
          id: 'saldo-alto',
          tipo: 'insight',
          titulo: 'Saldo bancário elevado',
          descricao: 'Considerar aplicações de curto prazo ou antecipação estratégica de pagamentos.',
          acao: { label: 'Ver fluxo de caixa', rota: '/cash-flow' }
        });
      }

      setDrCiceroInsights(insights);

    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Período formatado
  const periodoFormatado = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ════════════════════════════════════════════════════════════
          HEADER FIXO
          ════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo e Empresa */}
            <div className="flex items-center gap-6">
              <img 
                src="/logo-contta.png" 
                alt="Contta" 
                className="h-8"
              />
              <div className="h-6 w-px bg-neutral-200" />
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-700">
                  Ampla Contabilidade
                </span>
              </div>
            </div>

            {/* Período e Ações */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-lg">
                <Calendar className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700 capitalize">
                  {periodoFormatado}
                </span>
              </div>
              
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════
          CONTEÚDO PRINCIPAL
          ════════════════════════════════════════════════════════════ */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        
        {/* ─────────────────────────────────────────────────────────
            KPIs EXECUTIVOS (máximo 6 cards)
            ───────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KPIExecutivo
            titulo="Saldo Consolidado"
            valor={formatCurrency(stats.saldoConsolidado)}
            variacao={stats.varSaldo}
            icone={<Wallet className="h-4 w-4" />}
            destaque
          />
          <KPIExecutivo
            titulo="Resultado do Período"
            valor={formatCurrency(stats.resultadoPeriodo)}
            variacao={stats.varResultado}
            icone={stats.resultadoPeriodo >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          />
          <KPIExecutivo
            titulo="Honorários a Receber"
            valor={formatCurrency(stats.honorariosReceber)}
            subtitulo="em aberto"
            icone={<FileText className="h-4 w-4" />}
          />
          <KPIExecutivo
            titulo="Inadimplência"
            valor={formatCurrency(stats.inadimplencia)}
            variacao={stats.varInadimplencia}
            icone={<AlertTriangle className="h-4 w-4" />}
            onClick={() => navigate('/inadimplencia-dashboard')}
          />
          <KPIExecutivo
            titulo="Clientes Ativos"
            valor={stats.clientesAtivos.toString()}
            subtitulo="pagantes"
            icone={<Users className="h-4 w-4" />}
            onClick={() => navigate('/clients')}
          />
          <KPIExecutivo
            titulo="Projeção 30 dias"
            valor={formatCurrency(stats.projecao30dias)}
            subtitulo="estimativa"
            icone={<BarChart3 className="h-4 w-4" />}
            onClick={() => navigate('/cash-flow-projections')}
          />
        </section>

        {/* ─────────────────────────────────────────────────────────
            GRÁFICOS INTELIGENTES
            ───────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Evolução do Saldo */}
          <div className="bg-white rounded-lg border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-800">
                Evolução do Saldo
              </h3>
              <LineChart className="h-4 w-4 text-neutral-400" />
            </div>
            <GraficoEvolucao dados={chartData} tipo="saldo" />
          </div>

          {/* Receita x Despesa */}
          <div className="bg-white rounded-lg border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-800">
                Receita x Despesa
              </h3>
              <BarChart3 className="h-4 w-4 text-neutral-400" />
            </div>
            <GraficoEvolucao dados={chartData} tipo="receita-despesa" />
          </div>

          {/* Resultado Mensal */}
          <div className="bg-white rounded-lg border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-800">
                Resultado Mensal
              </h3>
              <TrendingUp className="h-4 w-4 text-neutral-400" />
            </div>
            <GraficoEvolucao dados={chartData} tipo="resultado" />
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────
            ÁREA DE IA + LISTA DE CLIENTES
            ───────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Dr. Cícero */}
          <div className="lg:col-span-1">
            <DrCiceroArea insights={drCiceroInsights} />
          </div>

          {/* Lista de Clientes */}
          <div className="lg:col-span-2">
            <ListaClientesRapida clientes={clientes} />
          </div>
        </section>

      </main>

      {/* ════════════════════════════════════════════════════════════
          FOOTER DISCRETO
          ════════════════════════════════════════════════════════════ */}
      <footer className="mt-8 py-4 border-t border-neutral-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Contta — Inteligência Fiscal</span>
            <span>Última atualização: {new Date().toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
