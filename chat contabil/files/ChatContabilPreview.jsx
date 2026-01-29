import React, { useState } from 'react';
import { Send, FileText, Mail, BarChart3, RefreshCw, Download, ChevronRight } from 'lucide-react';

// Dados simulados
const RESPOSTAS = {
  pix: {
    titulo: '💰 Recebimentos via PIX - Janeiro/2025',
    resumo: [
      { label: 'Total Recebido', valor: 'R$ 47.850,00', icone: '💰' },
      { label: 'Transações', valor: '32', icone: '📊' },
      { label: 'Clientes', valor: '18', icone: '👥' },
      { label: 'Ticket Médio', valor: 'R$ 1.495,31', icone: '📈' },
    ],
    dados: [
      { cliente: 'ACME LTDA', valor: 'R$ 4.500,00', data: '10/01', forma: 'PIX' },
      { cliente: 'XYZ CORPORATION', valor: 'R$ 3.200,00', data: '08/01', forma: 'PIX' },
      { cliente: 'BETA SERVIÇOS', valor: 'R$ 2.800,00', data: '15/01', forma: 'PIX' },
      { cliente: 'GAMA TECH', valor: 'R$ 2.500,00', data: '12/01', forma: 'PIX' },
      { cliente: 'DELTA COMERCIO', valor: 'R$ 2.100,00', data: '18/01', forma: 'PIX' },
    ],
  },
  inadimplentes: {
    titulo: '⚠️ Clientes em Atraso',
    alerta: { tipo: 'warning', mensagem: '8 clientes precisam de atenção!' },
    resumo: [
      { label: 'Total em Atraso', valor: 'R$ 12.800,00', icone: '💸' },
      { label: 'Clientes', valor: '8', icone: '👥' },
      { label: 'Dias Médio', valor: '23', icone: '📅' },
    ],
    dados: [
      { cliente: 'OMEGA LTDA', valor: 'R$ 3.000,00', dias: 45, status: '🔴' },
      { cliente: 'SIGMA CORP', valor: 'R$ 2.500,00', dias: 30, status: '🟠' },
      { cliente: 'KAPPA TECH', valor: 'R$ 1.800,00', dias: 15, status: '🟡' },
      { cliente: 'ZETA COMERCIO', valor: 'R$ 1.500,00', dias: 12, status: '🟡' },
    ],
  },
  dashboard: {
    titulo: '📊 Dashboard Financeiro - Janeiro/2025',
    resumo: [
      { label: 'Receitas', valor: 'R$ 378.000', variacao: 12, icone: '💰' },
      { label: 'Despesas', valor: 'R$ 142.500', variacao: -5, icone: '💸' },
      { label: 'Resultado', valor: 'R$ 235.500', variacao: 23, icone: '📈' },
      { label: 'Saldo Bancos', valor: 'R$ 118.450', icone: '🏦' },
    ],
    grafico: [
      { name: 'Folha', value: 85000, pct: 60 },
      { name: 'Aluguel', value: 18000, pct: 13 },
      { name: 'Impostos', value: 12500, pct: 9 },
      { name: 'Software', value: 8200, pct: 6 },
      { name: 'Outros', value: 18800, pct: 12 },
    ],
  },
};

const SUGESTOES = [
  "Quantos PIX recebemos este mês?",
  "Quais clientes estão em atraso?",
  "Como está o financeiro?",
  "Maiores despesas do mês",
];

export default function ChatContabilPreview() {
  const [mensagens, setMensagens] = useState([
    { id: 1, tipo: 'bot', texto: 'Olá! Sou o Dr. Cícero, seu assistente contábil. O que você gostaria de saber?' }
  ]);
  const [input, setInput] = useState('');
  const [respostaAtual, setRespostaAtual] = useState(null);
  const [loading, setLoading] = useState(false);

  const processarPergunta = (texto) => {
    const lower = texto.toLowerCase();
    if (lower.includes('pix')) return 'pix';
    if (lower.includes('atraso') || lower.includes('inadimpl')) return 'inadimplentes';
    return 'dashboard';
  };

  const enviar = async (texto) => {
    const pergunta = texto || input;
    if (!pergunta.trim()) return;
    
    setMensagens(prev => [...prev, { id: Date.now(), tipo: 'user', texto: pergunta }]);
    setInput('');
    setLoading(true);
    setRespostaAtual(null);
    
    await new Promise(r => setTimeout(r, 1500));
    
    const tipo = processarPergunta(pergunta);
    setRespostaAtual(RESPOSTAS[tipo]);
    setMensagens(prev => [...prev, { id: Date.now() + 1, tipo: 'bot', texto: 'Aqui está o que encontrei:' }]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xl">
            🧮
          </div>
          <div>
            <h1 className="text-white font-bold">Dr. Cícero</h1>
            <p className="text-xs text-slate-400">Assistente Contábil AMPLA</p>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-700 rounded-lg">
          <RefreshCw className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {mensagens.map((msg) => (
          <div key={msg.id} className={`flex ${msg.tipo === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.tipo === 'user' 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-slate-800 text-slate-200'
            }`}>
              {msg.texto}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl px-4 py-3 text-slate-200 flex items-center gap-2">
              Analisando
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div 
                    key={i} 
                    className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Resposta Visual */}
        {respostaAtual && (
          <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
              <h3 className="text-white font-bold">{respostaAtual.titulo}</h3>
            </div>
            
            {respostaAtual.alerta && (
              <div className="m-3 p-3 bg-yellow-500/20 rounded-lg text-yellow-300 text-sm">
                {respostaAtual.alerta.mensagem}
              </div>
            )}
            
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
              {respostaAtual.resumo.map((item, i) => (
                <div key={i} className="bg-slate-700/50 rounded-xl p-3 text-center">
                  <div className="text-xl mb-1">{item.icone}</div>
                  <div className="text-lg font-bold text-white">{item.valor}</div>
                  <div className="text-xs text-slate-400">{item.label}</div>
                  {item.variacao !== undefined && (
                    <div className={`text-xs mt-1 ${item.variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {item.variacao >= 0 ? '▲' : '▼'} {Math.abs(item.variacao)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Tabela */}
            {respostaAtual.dados && (
              <div className="px-4 pb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      {Object.keys(respostaAtual.dados[0]).map((col, i) => (
                        <th key={i} className="text-left py-2 text-slate-400 font-medium capitalize">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {respostaAtual.dados.map((row, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="py-2 text-slate-200">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Gráfico */}
            {respostaAtual.grafico && (
              <div className="px-4 pb-4 space-y-2">
                {respostaAtual.grafico.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-slate-400">{item.name}</div>
                    <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${item.pct}%` }}
                      >
                        <span className="text-xs text-white font-medium">
                          R$ {item.value.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="w-10 text-right text-sm text-slate-400">{item.pct}%</div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Ações */}
            <div className="flex gap-2 p-4 border-t border-slate-700">
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white">
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white">
                <Mail className="w-4 h-4" /> Email
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white">
                <BarChart3 className="w-4 h-4" /> Gráfico
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sugestões */}
      {mensagens.length <= 2 && !respostaAtual && (
        <div className="px-4 py-2">
          <p className="text-xs text-slate-500 mb-2">Sugestões:</p>
          <div className="flex flex-wrap gap-2">
            {SUGESTOES.map((s, i) => (
              <button
                key={i}
                onClick={() => enviar(s)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-sm text-slate-300 flex items-center gap-1"
              >
                {s} <ChevronRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-900/80">
        <div className="flex items-center gap-2 bg-slate-800 rounded-2xl px-4 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && enviar()}
            placeholder="Digite sua pergunta..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
          />
          <button
            onClick={() => enviar()}
            className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
