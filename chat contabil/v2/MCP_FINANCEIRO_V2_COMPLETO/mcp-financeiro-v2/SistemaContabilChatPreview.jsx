import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Mail, BarChart3, RefreshCw, Download, ChevronRight, Upload, Plus, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

// Dados simulados
const DADOS = {
  cobranca: {
    titulo: '📊 Cobrança Janeiro/2025',
    subtitulo: 'Comparativo com Dezembro/2024',
    resumo: [
      { label: 'Gerado', valor: 'R$ 378.000,00', icone: '📄', percentual: '252 boletos' },
      { label: 'Recebido', valor: 'R$ 342.500,00', icone: '✅', variacao: 12, percentual: '90.6%' },
      { label: 'Em Atraso', valor: 'R$ 18.500,00', icone: '🔴', percentual: '8 boletos' },
      { label: 'A Vencer', valor: 'R$ 17.000,00', icone: '🟡', percentual: '12 boletos' },
    ],
    comparativo: [
      { nome: 'Gerado', atual: 378000, anterior: 352000, cor: '#3b82f6' },
      { nome: 'Recebido', atual: 342500, anterior: 318000, cor: '#22c55e' },
      { nome: 'Atrasado', atual: 18500, anterior: 22000, cor: '#ef4444' },
    ],
    dados: [
      { cliente: 'ACME LTDA', valor: 'R$ 4.500,00', vencimento: '10/01', status: '✅ Pago', pagamento: '08/01' },
      { cliente: 'XYZ CORPORATION', valor: 'R$ 3.200,00', vencimento: '10/01', status: '✅ Pago', pagamento: '10/01' },
      { cliente: 'BETA SERVIÇOS', valor: 'R$ 2.800,00', vencimento: '10/01', status: '🔴 Atrasado', pagamento: '-' },
      { cliente: 'GAMA TECH', valor: 'R$ 2.500,00', vencimento: '15/01', status: '🟡 Pendente', pagamento: '-' },
      { cliente: 'DELTA COMERCIO', valor: 'R$ 2.100,00', vencimento: '10/01', status: '✅ Pago', pagamento: '09/01' },
    ],
    observacao: '⚠️ 8 clientes em atraso totalizando R$ 18.500,00',
  },
  
  dre: {
    titulo: '📊 DRE - Análise Vertical',
    subtitulo: 'Janeiro/2025 | % sobre Receita Total',
    resumo: [
      { label: 'Receita', valor: 'R$ 378.000,00', icone: '💰', percentual: '100%' },
      { label: 'Despesas', valor: 'R$ 142.500,00', icone: '💸', percentual: '37.7%' },
      { label: 'Resultado', valor: 'R$ 235.500,00', icone: '📈', percentual: '62.3%' },
      { label: 'Margem', valor: '62.3%', icone: '🟢' },
    ],
    linhas: [
      { tipo: 'titulo', descricao: '═══ RECEITAS ═══', valor: '', av: '' },
      { tipo: 'receita', descricao: '  Honorários Contábeis', valor: 'R$ 350.000,00', av: '92.6%', barra: 93 },
      { tipo: 'receita', descricao: '  Consultoria Tributária', valor: 'R$ 28.000,00', av: '7.4%', barra: 7 },
      { tipo: 'subtotal', descricao: '▸ TOTAL RECEITAS', valor: 'R$ 378.000,00', av: '100%', barra: 100 },
      { tipo: 'titulo', descricao: '═══ DESPESAS ═══', valor: '', av: '' },
      { tipo: 'despesa', descricao: '▸ Pessoal (Folha)', valor: 'R$ 85.000,00', av: '22.5%', barra: 23 },
      { tipo: 'despesa', descricao: '▸ Ocupação (Aluguel)', valor: 'R$ 18.000,00', av: '4.8%', barra: 5 },
      { tipo: 'despesa', descricao: '▸ Impostos', valor: 'R$ 15.200,00', av: '4.0%', barra: 4 },
      { tipo: 'despesa', descricao: '▸ Software/TI', valor: 'R$ 8.200,00', av: '2.2%', barra: 2 },
      { tipo: 'despesa', descricao: '▸ Outras', valor: 'R$ 16.100,00', av: '4.3%', barra: 4 },
      { tipo: 'subtotal', descricao: '▸ TOTAL DESPESAS', valor: 'R$ 142.500,00', av: '37.7%', barra: 38 },
      { tipo: 'titulo', descricao: '═══════════════════', valor: '', av: '' },
      { tipo: 'resultado', descricao: '✅ LUCRO LÍQUIDO', valor: 'R$ 235.500,00', av: '62.3%', barra: 62 },
    ],
    despesas: [
      { name: 'Pessoal', value: 85000, pct: 59.6 },
      { name: 'Ocupação', value: 18000, pct: 12.6 },
      { name: 'Impostos', value: 15200, pct: 10.7 },
      { name: 'Software', value: 8200, pct: 5.8 },
      { name: 'Outras', value: 16100, pct: 11.3 },
    ],
  },
  
  rentabilidade: {
    titulo: '📊 Rentabilidade por Cliente',
    subtitulo: 'Janeiro/2025 | Análise de Margem',
    resumo: [
      { label: 'Receita Total', valor: 'R$ 378.000,00', icone: '💰' },
      { label: 'Despesas', valor: 'R$ 142.500,00', icone: '💸' },
      { label: 'Lucro', valor: 'R$ 235.500,00', icone: '📈' },
      { label: 'Rentáveis', valor: '186/252', icone: '👥', percentual: '74%' },
    ],
    dados: [
      { cliente: 'ACME LTDA', receita: 'R$ 4.500,00', pctReceita: '1.2%', custoAloc: 'R$ 565,00', lucro: 'R$ 3.935,00', margem: '87.4%', status: '🟢 Rentável' },
      { cliente: 'XYZ CORPORATION', receita: 'R$ 3.200,00', pctReceita: '0.8%', custoAloc: 'R$ 565,00', lucro: 'R$ 2.635,00', margem: '82.3%', status: '🟢 Rentável' },
      { cliente: 'BETA SERVIÇOS', receita: 'R$ 2.800,00', pctReceita: '0.7%', custoAloc: 'R$ 565,00', lucro: 'R$ 2.235,00', margem: '79.8%', status: '🟢 Rentável' },
      { cliente: 'GAMA TECH', receita: 'R$ 2.500,00', pctReceita: '0.7%', custoAloc: 'R$ 565,00', lucro: 'R$ 1.935,00', margem: '77.4%', status: '🟢 Rentável' },
      { cliente: 'EPSILON MICRO', receita: 'R$ 800,00', pctReceita: '0.2%', custoAloc: 'R$ 565,00', lucro: 'R$ 235,00', margem: '29.4%', status: '🟡 Marginal' },
      { cliente: 'ZETA SMALL', receita: 'R$ 500,00', pctReceita: '0.1%', custoAloc: 'R$ 565,00', lucro: '-R$ 65,00', margem: '-13.0%', status: '🔴 Deficitário' },
    ],
    observacao: 'Custo médio/cliente: R$ 565,48 | 186 de 252 clientes são rentáveis (>15% margem)',
  },
  
  confirmacao: {
    titulo: '📝 Confirmar Lançamento',
    dados: [
      { campo: 'Data', valor: '11/01/2025' },
      { campo: 'Descrição', valor: 'Pagamento de energia elétrica' },
      { campo: 'Débito', valor: '4.1.1.01 - Energia Elétrica' },
      { campo: 'Crédito', valor: '1.1.1.05 - Banco Sicredi' },
      { campo: 'Valor', valor: 'R$ 1.850,00' },
    ],
    alerta: { tipo: 'info', mensagem: 'Revise os dados antes de confirmar' },
  },
};

const SUGESTOES = [
  "Este mês quanto gerei de boleto?",
  "Quanto recebi e quanto está atrasado?",
  "Gere o DRE com análise vertical",
  "Qual cliente é mais rentável?",
  "Fazer lançamento de despesa",
  "Criar conta contábil",
  "Importar extrato OFX",
];

const CORES_GRUPOS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function SistemaContabilChat() {
  const [mensagens, setMensagens] = useState([
    { id: 1, tipo: 'bot', texto: 'Olá Sérgio! Sou o Dr. Cícero, seu assistente contábil. Posso consultar, analisar e até fazer lançamentos. O que você precisa?' }
  ]);
  const [input, setInput] = useState('');
  const [resposta, setResposta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modoConfirmacao, setModoConfirmacao] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, resposta]);

  const processarPergunta = (texto) => {
    const lower = texto.toLowerCase();
    if (lower.includes('boleto') || lower.includes('gerei') || lower.includes('atras')) return 'cobranca';
    if (lower.includes('dre') || lower.includes('vertical') || lower.includes('despesa')) return 'dre';
    if (lower.includes('rentab') || lower.includes('cliente')) return 'rentabilidade';
    if (lower.includes('lança') || lower.includes('criar')) return 'confirmacao';
    return 'cobranca';
  };

  const enviar = async (texto) => {
    const pergunta = texto || input;
    if (!pergunta.trim()) return;
    
    setMensagens(prev => [...prev, { id: Date.now(), tipo: 'user', texto: pergunta }]);
    setInput('');
    setLoading(true);
    setResposta(null);
    setModoConfirmacao(false);
    
    await new Promise(r => setTimeout(r, 1200));
    
    const tipo = processarPergunta(pergunta);
    setResposta({ tipo, dados: DADOS[tipo] });
    setModoConfirmacao(tipo === 'confirmacao');
    setMensagens(prev => [...prev, { id: Date.now() + 1, tipo: 'bot', texto: tipo === 'confirmacao' ? 'Preparei o lançamento. Por favor, confirme os dados:' : 'Aqui está a análise solicitada:' }]);
    setLoading(false);
  };

  const renderBarraComparativo = (atual, anterior, max, cor) => {
    const pctAtual = (atual / max) * 100;
    const pctAnterior = (anterior / max) * 100;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12">Atual</span>
          <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pctAtual}%`, backgroundColor: cor }} />
          </div>
          <span className="text-xs text-white w-20 text-right">R$ {(atual/1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-12">Ant.</span>
          <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full opacity-50" style={{ width: `${pctAnterior}%`, backgroundColor: cor }} />
          </div>
          <span className="text-xs text-slate-500 w-20 text-right">R$ {(anterior/1000).toFixed(0)}k</span>
        </div>
      </div>
    );
  };

  const renderResposta = () => {
    if (!resposta) return null;
    const { tipo, dados } = resposta;

    // Card de Confirmação de Ação
    if (tipo === 'confirmacao') {
      return (
        <div className="bg-slate-800 rounded-2xl overflow-hidden border border-amber-500/50">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3">
            <h3 className="text-white font-bold">{dados.titulo}</h3>
          </div>
          <div className="p-4 space-y-3">
            {dados.dados.map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">{item.campo}</span>
                <span className="text-white font-medium">{item.valor}</span>
              </div>
            ))}
            <div className="p-3 bg-amber-500/20 rounded-lg text-amber-300 text-sm">
              {dados.alerta.mensagem}
            </div>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white font-medium">
                ✅ Confirmar Lançamento
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white">
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
          <h3 className="text-white font-bold">{dados.titulo}</h3>
          <p className="text-blue-100 text-sm">{dados.subtitulo}</p>
        </div>
        
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          {dados.resumo.map((item, i) => (
            <div key={i} className="bg-slate-700/50 rounded-xl p-3 text-center">
              <div className="text-xl mb-1">{item.icone}</div>
              <div className="text-lg font-bold text-white">{item.valor}</div>
              <div className="text-xs text-slate-400">{item.label}</div>
              {item.variacao !== undefined && (
                <div className={`text-xs mt-1 flex items-center justify-center gap-1 ${item.variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {item.variacao >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(item.variacao)}%
                </div>
              )}
              {item.percentual && <div className="text-xs text-slate-500">{item.percentual}</div>}
            </div>
          ))}
        </div>

        {/* Gráfico Comparativo (para cobrança) */}
        {tipo === 'cobranca' && dados.comparativo && (
          <div className="px-4 pb-4">
            <h4 className="text-white font-medium mb-3">Comparativo Mensal</h4>
            <div className="space-y-4">
              {dados.comparativo.map((item, i) => (
                <div key={i}>
                  <div className="text-sm text-slate-400 mb-1">{item.nome}</div>
                  {renderBarraComparativo(item.atual, item.anterior, 400000, item.cor)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gráfico Pizza Despesas (para DRE) */}
        {tipo === 'dre' && dados.despesas && (
          <div className="px-4 pb-4">
            <h4 className="text-white font-medium mb-3">Composição de Despesas</h4>
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {dados.despesas.reduce((acc, item, i) => {
                    const start = acc.offset;
                    const length = (item.pct / 100) * 283;
                    acc.elements.push(
                      <circle
                        key={i}
                        cx="50" cy="50" r="45"
                        fill="none"
                        stroke={CORES_GRUPOS[i % CORES_GRUPOS.length]}
                        strokeWidth="10"
                        strokeDasharray={`${length} ${283 - length}`}
                        strokeDashoffset={-start}
                      />
                    );
                    acc.offset += length;
                    return acc;
                  }, { offset: 0, elements: [] }).elements}
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                {dados.despesas.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CORES_GRUPOS[i % CORES_GRUPOS.length] }} />
                    <span className="text-slate-300 flex-1">{item.name}</span>
                    <span className="text-white font-medium">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Dados */}
        {dados.linhas ? (
          <div className="px-4 pb-4">
            <table className="w-full text-sm">
              <tbody>
                {dados.linhas.map((linha, i) => (
                  <tr key={i} className={`border-b border-slate-700/50 ${
                    linha.tipo === 'titulo' ? 'bg-slate-800' : 
                    linha.tipo === 'subtotal' ? 'bg-slate-700/30' :
                    linha.tipo === 'resultado' ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30' : ''
                  }`}>
                    <td className={`py-2 px-3 ${linha.tipo === 'titulo' ? 'text-slate-300 font-semibold' : 'text-slate-200'}`}>
                      {linha.descricao}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono ${
                      linha.tipo === 'receita' ? 'text-green-400' :
                      linha.tipo === 'despesa' ? 'text-red-400' :
                      linha.tipo === 'resultado' ? 'text-green-400 font-bold' : 'text-white'
                    }`}>{linha.valor}</td>
                    <td className="py-2 px-3 text-right text-slate-400 font-mono">{linha.av}</td>
                    <td className="py-2 px-3 w-24">
                      {linha.barra > 0 && (
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              linha.tipo === 'receita' ? 'bg-green-500' :
                              linha.tipo === 'despesa' ? 'bg-red-500' :
                              linha.tipo === 'resultado' ? 'bg-blue-500' : 'bg-slate-500'
                            }`}
                            style={{ width: `${linha.barra}%` }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : dados.dados && (
          <div className="px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  {Object.keys(dados.dados[0]).map((col, i) => (
                    <th key={i} className="text-left py-2 text-slate-400 font-medium capitalize">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.dados.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="py-2 text-slate-200">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Observação */}
        {dados.observacao && (
          <div className="px-4 pb-4">
            <div className="p-3 bg-slate-700/50 rounded-lg text-sm text-slate-300">
              💡 {dados.observacao}
            </div>
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
            <BarChart3 className="w-4 h-4" /> Detalhes
          </button>
        </div>
      </div>
    );
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
            <p className="text-xs text-slate-400">Sistema Contábil AMPLA</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-slate-700 rounded-lg" title="Importar Arquivo">
            <Upload className="w-5 h-5 text-slate-400" />
          </button>
          <button className="p-2 hover:bg-slate-700 rounded-lg" title="Novo Lançamento">
            <Plus className="w-5 h-5 text-slate-400" />
          </button>
          <button className="p-2 hover:bg-slate-700 rounded-lg">
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </button>
        </div>
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
                  <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {renderResposta()}
        <div ref={messagesEnd} />
      </div>

      {/* Sugestões */}
      {mensagens.length <= 2 && !resposta && (
        <div className="px-4 py-2">
          <p className="text-xs text-slate-500 mb-2">Experimente perguntar:</p>
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
            placeholder="Digite sua pergunta ou comando..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
          />
          <button
            onClick={() => enviar()}
            disabled={loading}
            className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl disabled:opacity-50"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
