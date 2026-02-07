/**
 * AIAgentSuggestions.tsx
 * 
 * COMPONENTE AI-FIRST: Sugestões Proativas de Classificação
 * 
 * Este componente é a interface principal da abordagem AI-First:
 * - Mostra sugestões automáticas de classificação
 * - Indica qual agente identificou a transação
 * - Permite aplicar sugestão com 1 clique
 * - Escala de confiança visual
 * - Botão de consultar Dr. Cícero para casos complexos
 * 
 * @author Sistema Contta / Ampla Contabilidade
 * @date 31/01/2026
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  classificarTransacaoOFX, 
  ClassificacaoAutomatica,
  CONTAS_AMPLA 
} from '@/lib/classificadorAutomatico';
import { formatCurrency } from '@/data/expensesData';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  Zap,
  MessageSquare,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Calculator,
  Briefcase,
  Building2,
  Wallet,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Bot,
  Loader2
} from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================

interface BankTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  matched?: boolean;
  journal_entry_id?: string;
  extracted_cnpj?: string;
  extracted_cpf?: string;
  suggested_client_name?: string;
  identification_confidence?: number;
}

interface AIAgentSuggestionsProps {
  transaction: BankTransaction | null;
  onApplySuggestion: (classificacao: ClassificacaoAutomatica) => void;
  onAskDrCicero: () => void;
  onReject: (motivo: string) => void;
}

// ============================================================================
// CONFIGURAÇÃO DOS AGENTES
// ============================================================================

const AGENT_CONFIG: Record<string, {
  nome: string;
  icone: React.ComponentType<{ className?: string }>;
  cor: string;
  bgCor: string;
  descricao: string;
}> = {
  'DR_CICERO': {
    nome: 'Dr. Cícero',
    icone: Brain,
    cor: 'text-violet-600',
    bgCor: 'bg-violet-100',
    descricao: 'Contador Responsável - Requer aprovação'
  },
  'AGENTE_FISCAL': {
    nome: 'Agente Fiscal',
    icone: Calculator,
    cor: 'text-emerald-600',
    bgCor: 'bg-emerald-100',
    descricao: 'Especialista em impostos e tarifas'
  },
  'AGENTE_TRABALHISTA': {
    nome: 'Agente Trabalhista',
    icone: Briefcase,
    cor: 'text-blue-600',
    bgCor: 'bg-blue-100',
    descricao: 'Especialista em folha e encargos'
  },
  'AGENTE_ADMINISTRATIVO': {
    nome: 'Agente Administrativo',
    icone: Building2,
    cor: 'text-amber-600',
    bgCor: 'bg-amber-100',
    descricao: 'Especialista em despesas operacionais'
  },
  'AGENTE_FINANCEIRO': {
    nome: 'Agente Financeiro',
    icone: Wallet,
    cor: 'text-cyan-600',
    bgCor: 'bg-cyan-100',
    descricao: 'Especialista em operações bancárias'
  },
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function AIAgentSuggestions({
  transaction,
  onApplySuggestion,
  onAskDrCicero,
  onReject
}: AIAgentSuggestionsProps) {
  const [classificacao, setClassificacao] = useState<ClassificacaoAutomatica | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Processa a classificação quando a transação muda
  useEffect(() => {
    if (!transaction) {
      setClassificacao(null);
      return;
    }
    
    setIsProcessing(true);
    
    // Simula um pequeno delay para efeito visual de "processamento IA"
    const timer = setTimeout(() => {
      const result = classificarTransacaoOFX(transaction.description, transaction.amount);
      setClassificacao(result);
      setIsProcessing(false);
    }, 300);
    
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id, transaction?.description, transaction?.amount]);
  
  // Configuração do agente responsável
  const agentConfig = useMemo(() => {
    if (!classificacao?.agenteResponsavel) return null;
    return AGENT_CONFIG[classificacao.agenteResponsavel] || AGENT_CONFIG['DR_CICERO'];
  }, [classificacao?.agenteResponsavel]);
  
  // Cor da barra de confiança
  const confiancaCor = useMemo(() => {
    if (!classificacao) return 'bg-slate-200';
    if (classificacao.confianca >= 0.95) return 'bg-emerald-500';
    if (classificacao.confianca >= 0.85) return 'bg-blue-500';
    if (classificacao.confianca >= 0.70) return 'bg-amber-500';
    return 'bg-red-500';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classificacao?.confianca]);
  
  // Status textual
  const statusText = useMemo(() => {
    if (!classificacao) return '';
    if (classificacao.confianca >= 0.95) return 'Alta confiança - pode auto-aplicar';
    if (classificacao.confianca >= 0.85) return 'Boa confiança - verificar';
    if (classificacao.confianca >= 0.70) return 'Confiança moderada - recomenda revisão';
    return 'Baixa confiança - consultar Dr. Cícero';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classificacao?.confianca]);
  
  if (!transaction) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Selecione uma transação para</p>
            <p className="text-sm">receber sugestões da IA</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isProcessing) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <Brain className="h-12 w-12 mx-auto text-violet-500 animate-pulse" />
              <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-amber-500 animate-bounce" />
            </div>
            <p className="text-sm text-slate-500 mt-3">Analisando transação...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!classificacao) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center text-slate-400">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
            <p className="text-sm">Não foi possível classificar automaticamente.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={onAskDrCicero}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Consultar Dr. Cícero
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const AgentIcon = agentConfig?.icone || Brain;
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${agentConfig?.bgCor}`}>
              <AgentIcon className={`h-5 w-5 ${agentConfig?.cor}`} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{agentConfig?.nome}</CardTitle>
              <p className="text-xs text-slate-500">{agentConfig?.descricao}</p>
            </div>
          </div>
          
          {classificacao.autoClassificar && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                    <Zap className="h-3 w-3 mr-1" />
                    Auto
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pode ser aplicado automaticamente (alta confiança)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pt-4 space-y-4">
        {/* Barra de Confiança */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Confiança da IA</span>
            <span className="font-semibold">{Math.round(classificacao.confianca * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${confiancaCor} transition-all duration-500`}
              style={{ width: `${classificacao.confianca * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400">{statusText}</p>
        </div>
        
        <Separator />
        
        {/* Sugestão de Lançamento */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
            Sugestão de Lançamento
          </p>
          
          {/* Débito */}
          <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-xs font-bold text-red-600">D</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-slate-500">{classificacao.debito.codigo}</p>
              <p className="text-sm font-medium text-slate-700 truncate">{classificacao.debito.nome}</p>
            </div>
            <span className="text-sm font-semibold text-red-600">
              {formatCurrency(Math.abs(transaction.amount))}
            </span>
          </div>
          
          {/* Seta */}
          <div className="flex justify-center">
            <ChevronRight className="h-4 w-4 text-slate-300 rotate-90" />
          </div>
          
          {/* Crédito */}
          <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-600">C</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-slate-500">{classificacao.credito.codigo}</p>
              <p className="text-sm font-medium text-slate-700 truncate">{classificacao.credito.nome}</p>
            </div>
            <span className="text-sm font-semibold text-emerald-600">
              {formatCurrency(Math.abs(transaction.amount))}
            </span>
          </div>
        </div>
        
        {/* Histórico */}
        <div className="p-2 bg-slate-50 rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Histórico</p>
          <p className="text-xs text-slate-600">{classificacao.historico}</p>
        </div>
        
        {/* Identificação do Cliente (se disponível) */}
        {transaction.suggested_client_name && (
          <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-blue-400 uppercase">Cliente Identificado</p>
                <p className="text-sm font-medium text-blue-700">{transaction.suggested_client_name}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Ações */}
      <div className="p-3 border-t bg-slate-50 space-y-2">
        {classificacao.confianca >= 0.70 && (
          <Button 
            className="w-full"
            onClick={() => onApplySuggestion(classificacao)}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aplicar Classificação
          </Button>
        )}
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1"
            onClick={onAskDrCicero}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Consultar Dr. Cícero
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onReject('Sugestão incorreta')}
                >
                  <ThumbsDown className="h-4 w-4 text-slate-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Marcar como incorreta (ajuda a treinar a IA)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// COMPONENTE DE RESUMO DE CLASSIFICAÇÃO EM LOTE (AI-First)
// ============================================================================

interface AIBatchSummaryProps {
  transactions: BankTransaction[];
  onApplyAll: () => Promise<void>;
  onReviewManually: () => Promise<void> | void;
}

export function AIBatchSummary({ transactions, onApplyAll, onReviewManually }: AIBatchSummaryProps) {
  const [summary, setSummary] = useState({
    autoClassificaveis: 0,
    requeremRevisao: 0,
    naoIdentificados: 0,
    totalValorAuto: 0,
    totalValorRevisao: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    let autoClassificaveis = 0;
    let requeremRevisao = 0;
    let naoIdentificados = 0;
    let totalValorAuto = 0;
    let totalValorRevisao = 0;
    
    transactions.forEach(tx => {
      const classificacao = classificarTransacaoOFX(tx.description, tx.amount);
      
      if (!classificacao || classificacao.confianca === 0) {
        naoIdentificados++;
      } else if (classificacao.autoClassificar && classificacao.confianca >= 0.95) {
        autoClassificaveis++;
        totalValorAuto += Math.abs(tx.amount);
      } else {
        requeremRevisao++;
        totalValorRevisao += Math.abs(tx.amount);
      }
    });
    
    setSummary({
      autoClassificaveis,
      requeremRevisao,
      naoIdentificados,
      totalValorAuto,
      totalValorRevisao
    });
  }, [transactions]);
  
  const percentualAuto = transactions.length > 0 
    ? Math.round((summary.autoClassificaveis / transactions.length) * 100)
    : 0;
  
  return (
    <Card className="bg-gradient-to-br from-violet-50 to-blue-50 border-violet-200">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Brain className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <CardTitle className="text-sm">Análise IA - {transactions.length} Transações</CardTitle>
            <p className="text-xs text-slate-500">
              {percentualAuto}% podem ser classificadas automaticamente
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Barra de progresso visual */}
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-200">
          <div 
            className="bg-emerald-500 transition-all"
            style={{ width: `${(summary.autoClassificaveis / transactions.length) * 100}%` }}
          />
          <div 
            className="bg-amber-500 transition-all"
            style={{ width: `${(summary.requeremRevisao / transactions.length) * 100}%` }}
          />
          <div 
            className="bg-red-400 transition-all"
            style={{ width: `${(summary.naoIdentificados / transactions.length) * 100}%` }}
          />
        </div>
        
        {/* Legenda */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Auto ({summary.autoClassificaveis})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-600">Revisão ({summary.requeremRevisao})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-slate-600">Manual ({summary.naoIdentificados})</span>
          </div>
        </div>
        
        {/* Valores */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-white rounded-lg border">
            <p className="text-[10px] text-slate-400 uppercase">Valor Auto-Classificável</p>
            <p className="text-sm font-bold text-emerald-600">{formatCurrency(summary.totalValorAuto)}</p>
          </div>
          <div className="p-2 bg-white rounded-lg border">
            <p className="text-[10px] text-slate-400 uppercase">Requer Revisão</p>
            <p className="text-sm font-bold text-amber-600">{formatCurrency(summary.totalValorRevisao)}</p>
          </div>
        </div>
        
        {/* Ações */}
        {summary.autoClassificaveis > 0 && (
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={async () => {
              setIsProcessing(true);
              try {
                await onApplyAll();
              } finally {
                setIsProcessing(false);
              }
            }}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Aplicar {summary.autoClassificaveis} Classificações Automáticas
              </>
            )}
          </Button>
        )}
        
        {summary.requeremRevisao > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              setIsProcessing(true);
              try {
                await onReviewManually();
              } finally {
                setIsProcessing(false);
              }
            }}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Dr. Cícero revisando...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Revisar {summary.requeremRevisao} com Dr. Cícero
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default AIAgentSuggestions;
