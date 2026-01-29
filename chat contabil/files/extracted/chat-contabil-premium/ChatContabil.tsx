// src/components/ChatContabil/index.tsx
// Interface de Chat Premium para o Sistema Contábil AMPLA

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, Download, Mail, BarChart3, FileText, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TIPOS
// ============================================

interface Mensagem {
  id: string;
  tipo: 'usuario' | 'assistente';
  conteudo: string;
  timestamp: Date;
  resposta?: RespostaVisual;
  carregando?: boolean;
}

interface RespostaVisual {
  tipo: 'card' | 'tabela' | 'grafico' | 'lista' | 'resumo' | 'alerta';
  titulo: string;
  subtitulo?: string;
  resumo?: {
    itens: Array<{
      label: string;
      valor: string | number;
      variacao?: number;
      icone?: string;
    }>;
  };
  dados?: any[];
  grafico?: {
    tipo: 'bar' | 'line' | 'pie' | 'area';
    series: any[];
  };
  acoes?: Array<{
    id: string;
    label: string;
    icone: string;
    acao: string;
  }>;
  observacao?: string;
  alerta?: {
    tipo: 'info' | 'warning' | 'error' | 'success';
    mensagem: string;
  };
}

// ============================================
// SUGESTÕES DE PERGUNTAS
// ============================================

const SUGESTOES = [
  "Quantos PIX recebemos este mês?",
  "Quais clientes estão em atraso?",
  "Como está o financeiro da empresa?",
  "Quais foram as maiores despesas?",
  "Quando o cliente ACME pagou?",
  "Qual o saldo do banco Sicredi?",
];

// ============================================
// COMPONENTES VISUAIS
// ============================================

const CardResumo: React.FC<{ dados: RespostaVisual }> = ({ dados }) => (
  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-xl border border-slate-700">
    <div className="flex items-center gap-3 mb-4">
      <div className="text-2xl">{dados.resumo?.itens?.[0]?.icone || '📊'}</div>
      <div>
        <h3 className="text-lg font-bold text-white">{dados.titulo}</h3>
        {dados.subtitulo && <p className="text-sm text-slate-400">{dados.subtitulo}</p>}
      </div>
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      {dados.resumo?.itens?.map((item, i) => (
        <div key={i} className="bg-slate-800/50 rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">{item.icone}</div>
          <div className="text-xl font-bold text-white">{item.valor}</div>
          <div className="text-xs text-slate-400">{item.label}</div>
          {item.variacao !== undefined && (
            <div className={`text-xs mt-1 ${item.variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.variacao >= 0 ? '▲' : '▼'} {Math.abs(item.variacao)}%
            </div>
          )}
        </div>
      ))}
    </div>
    
    {dados.alerta && (
      <div className={`p-3 rounded-lg text-sm ${
        dados.alerta.tipo === 'success' ? 'bg-green-500/20 text-green-300' :
        dados.alerta.tipo === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
        dados.alerta.tipo === 'error' ? 'bg-red-500/20 text-red-300' :
        'bg-blue-500/20 text-blue-300'
      }`}>
        {dados.alerta.mensagem}
      </div>
    )}
  </div>
);

const TabelaDados: React.FC<{ dados: RespostaVisual }> = ({ dados }) => (
  <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700">
    {/* Header */}
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
      <h3 className="text-lg font-bold text-white">{dados.titulo}</h3>
      {dados.subtitulo && <p className="text-sm text-blue-100">{dados.subtitulo}</p>}
    </div>
    
    {/* Resumo */}
    {dados.resumo && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800/50">
        {dados.resumo.itens.map((item, i) => (
          <div key={i} className="text-center">
            <div className="text-lg font-bold text-white">{item.valor}</div>
            <div className="text-xs text-slate-400">{item.label}</div>
          </div>
        ))}
      </div>
    )}
    
    {/* Tabela */}
    {dados.dados && dados.dados.length > 0 && (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              {Object.keys(dados.dados[0]).map((key) => (
                <th key={key} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.dados.map((row, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                {Object.values(row).map((val: any, j) => (
                  <td key={j} className="px-4 py-3 text-sm text-slate-200">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    
    {/* Observação */}
    {dados.observacao && (
      <div className="p-4 bg-slate-800/30 text-sm text-slate-400 italic">
        💡 {dados.observacao}
      </div>
    )}
    
    {/* Ações */}
    {dados.acoes && (
      <div className="flex gap-2 p-4 border-t border-slate-700">
        {dados.acoes.map((acao) => (
          <button
            key={acao.id}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
          >
            {acao.icone === '📄' && <FileText className="w-4 h-4" />}
            {acao.icone === '📧' && <Mail className="w-4 h-4" />}
            {acao.icone === '📊' && <BarChart3 className="w-4 h-4" />}
            {acao.icone === '⬇️' && <Download className="w-4 h-4" />}
            {acao.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

const GraficoBarra: React.FC<{ dados: any }> = ({ dados }) => {
  if (!dados.grafico?.series) return null;
  
  const maxValue = Math.max(...dados.grafico.series.map((s: any) => s.value));
  
  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">{dados.titulo}</h3>
      <div className="space-y-3">
        {dados.grafico.series.map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-32 text-sm text-slate-400 truncate">{item.name}</div>
            <div className="flex-1 h-8 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / maxValue) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-end pr-2"
              >
                <span className="text-xs text-white font-medium">
                  R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </span>
              </motion.div>
            </div>
            <div className="w-16 text-right text-sm text-slate-400">
              {item.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LoadingDots: React.FC = () => (
  <div className="flex items-center gap-1">
    <motion.div
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity }}
      className="w-2 h-2 bg-blue-400 rounded-full"
    />
    <motion.div
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
      className="w-2 h-2 bg-blue-400 rounded-full"
    />
    <motion.div
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
      className="w-2 h-2 bg-blue-400 rounded-full"
    />
  </div>
);

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const ChatContabil: React.FC = () => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: '1',
      tipo: 'assistente',
      conteudo: 'Olá! Sou o Dr. Cícero, seu assistente contábil. Posso ajudá-lo com informações financeiras, relatórios, análises de clientes e muito mais. O que você gostaria de saber?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);
  
  const enviarMensagem = async (texto?: string) => {
    const pergunta = texto || input;
    if (!pergunta.trim() || carregando) return;
    
    const novaMensagem: Mensagem = {
      id: Date.now().toString(),
      tipo: 'usuario',
      conteudo: pergunta,
      timestamp: new Date(),
    };
    
    setMensagens(prev => [...prev, novaMensagem]);
    setInput('');
    setCarregando(true);
    
    // Mensagem de carregando
    const loadingId = (Date.now() + 1).toString();
    setMensagens(prev => [...prev, {
      id: loadingId,
      tipo: 'assistente',
      conteudo: '',
      timestamp: new Date(),
      carregando: true,
    }]);
    
    try {
      // Chamar Edge Function
      const response = await fetch('/functions/v1/mcp-financeiro-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta }),
      });
      
      const data = await response.json();
      
      // Substituir mensagem de loading pela resposta
      setMensagens(prev => prev.map(m => 
        m.id === loadingId
          ? {
              ...m,
              conteudo: `Aqui está o que encontrei:`,
              resposta: data.resultado,
              carregando: false,
            }
          : m
      ));
      
    } catch (error) {
      setMensagens(prev => prev.map(m => 
        m.id === loadingId
          ? {
              ...m,
              conteudo: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
              carregando: false,
            }
          : m
      ));
    }
    
    setCarregando(false);
  };
  
  const renderResposta = (resposta: RespostaVisual) => {
    switch (resposta.tipo) {
      case 'card':
      case 'resumo':
        return <CardResumo dados={resposta} />;
      case 'tabela':
      case 'lista':
        return <TabelaDados dados={resposta} />;
      default:
        if (resposta.grafico) {
          return <GraficoBarra dados={resposta} />;
        }
        return <CardResumo dados={resposta} />;
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-xl">🧮</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Dr. Cícero</h1>
            <p className="text-xs text-slate-400">Assistente Contábil AMPLA</p>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
          <RefreshCw className="w-5 h-5 text-slate-400" />
        </button>
      </div>
      
      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {mensagens.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${msg.tipo === 'usuario' ? 'order-1' : 'order-2'}`}>
                {/* Avatar */}
                {msg.tipo === 'assistente' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-sm">🤖</span>
                    </div>
                    <span className="text-sm text-slate-400">Dr. Cícero</span>
                  </div>
                )}
                
                {/* Conteúdo */}
                <div className={`rounded-2xl p-4 ${
                  msg.tipo === 'usuario'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-slate-800 text-slate-200'
                }`}>
                  {msg.carregando ? (
                    <div className="flex items-center gap-2">
                      <span>Analisando</span>
                      <LoadingDots />
                    </div>
                  ) : (
                    <p>{msg.conteudo}</p>
                  )}
                </div>
                
                {/* Resposta Visual */}
                {msg.resposta && !msg.carregando && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-3"
                  >
                    {renderResposta(msg.resposta)}
                  </motion.div>
                )}
                
                {/* Timestamp */}
                <div className={`text-xs text-slate-500 mt-1 ${msg.tipo === 'usuario' ? 'text-right' : ''}`}>
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      
      {/* Sugestões */}
      {mensagens.length <= 2 && (
        <div className="px-4 py-2">
          <p className="text-xs text-slate-500 mb-2">Sugestões:</p>
          <div className="flex flex-wrap gap-2">
            {SUGESTOES.map((sugestao, i) => (
              <button
                key={i}
                onClick={() => enviarMensagem(sugestao)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-sm text-slate-300 transition-colors"
              >
                {sugestao}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-900/50 backdrop-blur-lg">
        <div className="flex items-center gap-2 bg-slate-800 rounded-2xl p-2">
          <button className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
            <Paperclip className="w-5 h-5 text-slate-400" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
            placeholder="Digite sua pergunta..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
            disabled={carregando}
          />
          <button className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
            <Mic className="w-5 h-5 text-slate-400" />
          </button>
          <button
            onClick={() => enviarMensagem()}
            disabled={!input.trim() || carregando}
            className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatContabil;
