// src/components/DREAnaliseVertical/index.tsx
// Componente de DRE com Análise Vertical Premium

import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend 
} from 'recharts';
import { Download, TrendingUp, TrendingDown, ChevronRight, FileText, RefreshCw } from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface LinhaDRE {
  tipo: 'titulo' | 'receita' | 'despesa' | 'grupo_despesa' | 'subtotal' | 'resultado';
  conta?: string;
  descricao: string;
  valor: number;
  av: number; // Análise Vertical %
  ah?: number; // Análise Horizontal %
}

interface DREData {
  titulo: string;
  subtitulo: string;
  periodo: { inicio: string; fim: string };
  resumo: {
    receitas: number;
    despesas: number;
    lucro: number;
    margem: number;
  };
  linhas: LinhaDRE[];
  despesasPorGrupo: Array<{ name: string; value: number; pct: number }>;
}

// ============================================
// CORES
// ============================================

const CORES = {
  receita: '#22c55e',
  despesa: '#ef4444',
  lucro: '#3b82f6',
  grupos: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#f43f5e'],
};

// ============================================
// COMPONENTE: BARRA DE PROGRESSO AV
// ============================================

const BarraAV: React.FC<{ valor: number; max?: number; cor?: string }> = ({ valor, max = 50, cor = '#3b82f6' }) => {
  const largura = Math.min((valor / max) * 100, 100);
  return (
    <div className="w-32 h-4 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${largura}%`, backgroundColor: cor }}
      />
    </div>
  );
};

// ============================================
// COMPONENTE: CARD RESUMO
// ============================================

const CardResumo: React.FC<{ 
  label: string; 
  valor: number; 
  variacao?: number; 
  icone: React.ReactNode;
  cor: string;
}> = ({ label, valor, variacao, icone, cor }) => (
  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
    <div className="flex items-center justify-between mb-2">
      <span className="text-slate-400 text-sm">{label}</span>
      <div className={`p-2 rounded-lg`} style={{ backgroundColor: `${cor}20` }}>
        {icone}
      </div>
    </div>
    <div className="text-2xl font-bold text-white">
      R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    </div>
    {variacao !== undefined && (
      <div className={`flex items-center gap-1 text-sm mt-1 ${variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {variacao >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        {Math.abs(variacao).toFixed(1)}% vs mês anterior
      </div>
    )}
  </div>
);

// ============================================
// COMPONENTE: TABELA DRE
// ============================================

const TabelaDRE: React.FC<{ linhas: LinhaDRE[] }> = ({ linhas }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-700 text-slate-400">
          <th className="text-left py-3 px-4 font-medium">Descrição</th>
          <th className="text-right py-3 px-4 font-medium">Valor (R$)</th>
          <th className="text-right py-3 px-4 font-medium">AV %</th>
          <th className="py-3 px-4 font-medium">Representação</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => {
          const isTitulo = linha.tipo === 'titulo';
          const isSubtotal = linha.tipo === 'subtotal';
          const isResultado = linha.tipo === 'resultado';
          const isReceita = linha.tipo === 'receita';
          const isDespesa = linha.tipo === 'despesa' || linha.tipo === 'grupo_despesa';
          
          return (
            <tr 
              key={i} 
              className={`
                border-b border-slate-700/50 
                ${isTitulo ? 'bg-slate-800' : ''}
                ${isSubtotal ? 'bg-slate-700/30 font-bold' : ''}
                ${isResultado ? 'bg-gradient-to-r from-blue-900/30 to-purple-900/30 font-bold' : ''}
              `}
            >
              <td className={`py-3 px-4 ${isTitulo ? 'text-slate-300 font-semibold' : 'text-slate-200'}`}>
                {linha.descricao}
              </td>
              <td className={`py-3 px-4 text-right ${isTitulo ? '' : 'font-mono'} ${
                isReceita ? 'text-green-400' : 
                isDespesa ? 'text-red-400' : 
                isResultado && linha.valor >= 0 ? 'text-green-400' : 
                isResultado && linha.valor < 0 ? 'text-red-400' : 
                'text-white'
              }`}>
                {isTitulo ? '' : linha.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right text-slate-300 font-mono">
                {isTitulo ? '' : `${linha.av.toFixed(1)}%`}
              </td>
              <td className="py-3 px-4">
                {!isTitulo && linha.av > 0 && (
                  <BarraAV 
                    valor={linha.av} 
                    cor={isReceita ? CORES.receita : isDespesa ? CORES.despesa : CORES.lucro}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ============================================
// COMPONENTE: GRÁFICO PIZZA DESPESAS
// ============================================

const GraficoPizzaDespesas: React.FC<{ dados: Array<{ name: string; value: number; pct: number }> }> = ({ dados }) => (
  <div className="h-80">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={dados}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, pct }) => `${name}: ${pct}%`}
          labelLine={false}
        >
          {dados.map((_, index) => (
            <Cell key={index} fill={CORES.grupos[index % CORES.grupos.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

// ============================================
// COMPONENTE PRINCIPAL: DRE
// ============================================

export const DREAnaliseVertical: React.FC<{ dados: DREData }> = ({ dados }) => {
  const [viewMode, setViewMode] = useState<'tabela' | 'grafico'>('tabela');
  
  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{dados.titulo}</h2>
            <p className="text-blue-100 mt-1">{dados.subtitulo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setViewMode('tabela')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'tabela' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              Tabela
            </button>
            <button 
              onClick={() => setViewMode('grafico')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'grafico' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              Gráficos
            </button>
            <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
              <Download className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
        <CardResumo 
          label="Receita Total" 
          valor={dados.resumo.receitas} 
          icone={<TrendingUp className="w-5 h-5" style={{ color: CORES.receita }} />}
          cor={CORES.receita}
        />
        <CardResumo 
          label="Despesas" 
          valor={dados.resumo.despesas} 
          icone={<TrendingDown className="w-5 h-5" style={{ color: CORES.despesa }} />}
          cor={CORES.despesa}
        />
        <CardResumo 
          label="Resultado" 
          valor={dados.resumo.lucro} 
          icone={dados.resumo.lucro >= 0 ? 
            <TrendingUp className="w-5 h-5" style={{ color: CORES.lucro }} /> : 
            <TrendingDown className="w-5 h-5" style={{ color: CORES.despesa }} />
          }
          cor={dados.resumo.lucro >= 0 ? CORES.lucro : CORES.despesa}
        />
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Margem Líquida</span>
          </div>
          <div className={`text-3xl font-bold ${
            dados.resumo.margem >= 20 ? 'text-green-400' : 
            dados.resumo.margem >= 10 ? 'text-yellow-400' : 
            'text-red-400'
          }`}>
            {dados.resumo.margem.toFixed(1)}%
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-3 h-3 rounded-full ${
              dados.resumo.margem >= 20 ? 'bg-green-400' : 
              dados.resumo.margem >= 10 ? 'bg-yellow-400' : 
              'bg-red-400'
            }`} />
            <span className="text-xs text-slate-400">
              {dados.resumo.margem >= 20 ? 'Saudável' : dados.resumo.margem >= 10 ? 'Atenção' : 'Crítico'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Conteúdo Principal */}
      <div className="p-6 pt-0">
        {viewMode === 'tabela' ? (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700">
            <TabelaDRE linhas={dados.linhas} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Gráfico de Barras - Receita vs Despesa */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <h3 className="text-white font-semibold mb-4">Receitas vs Despesas</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Receitas', valor: dados.resumo.receitas },
                    { name: 'Despesas', valor: dados.resumo.despesas },
                    { name: 'Lucro', valor: dados.resumo.lucro },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    />
                    <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Gráfico Pizza - Composição de Despesas */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <h3 className="text-white font-semibold mb-4">Composição de Despesas</h3>
              <GraficoPizzaDespesas dados={dados.despesasPorGrupo} />
            </div>
          </div>
        )}
      </div>
      
      {/* Footer com Ações */}
      <div className="flex items-center justify-between p-6 border-t border-slate-700">
        <div className="text-sm text-slate-400">
          Análise Vertical: cada linha representa % sobre Receita Total
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors">
            <FileText className="w-4 h-4" /> Exportar PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors">
            <ChevronRight className="w-4 h-4" /> Ver Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};

export default DREAnaliseVertical;
