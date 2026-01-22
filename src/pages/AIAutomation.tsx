import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePeriod } from "@/contexts/PeriodContext";
import { PeriodFilter } from "@/components/PeriodFilter";
import {
  Brain,
  Bot,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Users,
  Activity,
  RefreshCw,
  Play,
  Pause,
  Settings,
  Shield,
  Target,
  Sparkles,
  CircleDot,
  ArrowRight,
  Bell,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tipos para o sistema de automação
interface AutomationTask {
  id: string;
  name: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  message: string;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
}

interface AgentMetrics {
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  status: 'active' | 'idle' | 'working';
  tasksCompleted: number;
  tasksToday: number;
  lastAction: string;
  accuracy: number;
}

interface SystemAlert {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  agent: string;
  title: string;
  message: string;
  action?: string;
  timestamp: Date;
  resolved: boolean;
}

interface FinancialSummary {
  receitas: number;
  despesas: number;
  lucro: number;
  margem: number;
  inadimplencia: number;
  conciliacao: number;
  clientesAtivos: number;
  transacoesPendentes: number;
}

interface HumanIntervention {
  id: string;
  type: 'classification' | 'reconciliation' | 'unknown';
  description: string;
  data: any;
  reason: string;
  timestamp: Date;
}

// Estatísticas de identificação de pagadores (Sprint 1)
interface PayerIdentificationStats {
  totalIdentified: number;
  byCnpj: number;
  byQsa: number;
  pendingReview: number;
  lastRun?: Date;
}

// Alertas do sistema (tabela system_alerts)
interface DatabaseAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

const AIAutomation = () => {
  // Usar período selecionado do contexto global
  const { selectedYear, selectedMonth } = usePeriod();

  // Referência para o intervalo de automação
  const automationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Estados de dados principais
  const [isAutomationActive, setIsAutomationActive] = useState(true);
  const [currentTasks, setCurrentTasks] = useState<AutomationTask[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [cycleCount, setCycleCount] = useState(0);
  const [humanInterventions, setHumanInterventions] = useState<HumanIntervention[]>([]);
  const [classificationsProcessed, setClassificationsProcessed] = useState(0);
  const [extractsProcessed, setExtractsProcessed] = useState(0);
  const [payerStats, setPayerStats] = useState<PayerIdentificationStats>({
    totalIdentified: 0,
    byCnpj: 0,
    byQsa: 0,
    pendingReview: 0
  });
  const [databaseAlerts, setDatabaseAlerts] = useState<DatabaseAlert[]>([]);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>([
    {
      name: "Dr. Cícero",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      status: 'idle',
      tasksCompleted: 0,
      tasksToday: 0,
      lastAction: "Inicializando...",
      accuracy: 98.5,
    },
    {
      name: "Gestor IA",
      icon: Brain,
      color: "text-violet-600",
      bgColor: "bg-violet-100",
      status: 'idle',
      tasksCompleted: 0,
      tasksToday: 0,
      lastAction: "Inicializando...",
      accuracy: 97.2,
    },
  ]);

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  // Adicionar alerta ao sistema
  const addAlert = useCallback((alert: Omit<SystemAlert, 'id' | 'timestamp' | 'resolved'>) => {
    const newAlert: SystemAlert = {
      ...alert,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      resolved: false,
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 20));
  }, []);

  // Atualizar status do agente
  const updateAgent = useCallback((name: string, updates: Partial<AgentMetrics>) => {
    setAgentMetrics(prev => prev.map(agent =>
      agent.name === name ? { ...agent, ...updates } : agent
    ));
  }, []);

  // Adicionar tarefa
  const addTask = useCallback((task: Omit<AutomationTask, 'id' | 'startedAt'>) => {
    const newTask: AutomationTask = {
      ...task,
      id: Math.random().toString(36).substr(2, 9),
      startedAt: new Date(),
    };
    setCurrentTasks(prev => [...prev, newTask]);
    return newTask.id;
  }, []);

  // Atualizar tarefa
  const updateTask = useCallback((id: string, updates: Partial<AutomationTask>) => {
    setCurrentTasks(prev => prev.map(task =>
      task.id === id ? { ...task, ...updates } : task
    ));
  }, []);

  // Remover tarefas completadas antigas
  const cleanupTasks = useCallback(() => {
    setCurrentTasks(prev => prev.filter(task =>
      task.status !== 'completed' ||
      (task.completedAt && (new Date().getTime() - task.completedAt.getTime()) < 30000)
    ));
  }, []);

  // =====================================================
  // FUNÇÕES DE AUTOMAÇÃO
  // =====================================================

  // AUTOMAÇÃO 1: CARREGAR DADOS FINANCEIROS (USANDO LÓGICA DA DRE)
  const loadFinancialData = useCallback(async () => {
    const taskId = addTask({
      name: 'Carregar dados financeiros',
      agent: 'Gestor IA',
      status: 'running',
      progress: 0,
      message: 'Buscando dados da DRE...',
    });

    updateAgent('Gestor IA', { status: 'working', lastAction: 'Carregando DRE...' });

    try {
      const today = new Date();
      // Usar período selecionado no filtro (mesmo da DRE)
      const year = selectedYear || today.getFullYear();
      const month = selectedMonth || (today.getMonth() + 1);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      updateTask(taskId, { progress: 20, message: 'Buscando contas contábeis...' });

      // Buscar contas de receita (3.x) e despesa (4.x) - mesma lógica da DRE
      const { data: allAccounts } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type, is_synthetic')
        .eq('is_active', true)
        .order('code');

      const accounts = allAccounts?.filter(acc =>
        acc.code.startsWith('3') || acc.code.startsWith('4')
      ) || [];

      updateTask(taskId, { progress: 40, message: 'Buscando lançamentos contábeis...' });

      // Buscar TODOS os lançamentos contábeis (mesma lógica da DRE)
      const { data: allLines } = await supabase
        .from('accounting_entry_lines')
        .select(`
          debit,
          credit,
          account_id,
          entry_id(entry_date, competence_date)
        `);

      // Filtrar por data usando competence_date (mesma lógica da DRE)
      const filteredLines = allLines?.filter((line: any) => {
        const lineDate = line.entry_id?.competence_date || line.entry_id?.entry_date;
        if (!lineDate) return true;
        return lineDate >= startDate && lineDate <= endDate;
      }) || [];

      updateTask(taskId, { progress: 60, message: 'Calculando receitas e despesas...' });

      // Criar mapa de saldos por conta
      const accountTotals = new Map<string, { debit: number; credit: number }>();
      filteredLines.forEach((line: any) => {
        const current = accountTotals.get(line.account_id) || { debit: 0, credit: 0 };
        current.debit += line.debit || 0;
        current.credit += line.credit || 0;
        accountTotals.set(line.account_id, current);
      });

      // Calcular receitas e despesas (mesma lógica da DRE)
      let totalReceitas = 0;
      let totalDespesas = 0;

      for (const account of accounts) {
        if (account.is_synthetic) continue; // Pular contas sintéticas

        const accountTotal = accountTotals.get(account.id);
        if (!accountTotal) continue;

        const isRevenue = account.code.startsWith('3');
        // Receita: crédito - débito | Despesa: débito - crédito
        const total = isRevenue
          ? accountTotal.credit - accountTotal.debit
          : accountTotal.debit - accountTotal.credit;

        if (isRevenue) {
          totalReceitas += Math.abs(total);
        } else {
          totalDespesas += Math.abs(total);
        }
      }

      updateTask(taskId, { progress: 80, message: 'Calculando indicadores...' });

      // Buscar dados adicionais
      const [
        { data: clients },
        { data: invoices },
        { data: transactions },
      ] = await Promise.all([
        supabase.from('clients').select('id, is_active').eq('is_active', true),
        supabase.from('invoices').select('id, amount, due_date, status'),
        supabase.from('bank_transactions').select('id, matched'),
      ]);

      const lucro = totalReceitas - totalDespesas;
      const margem = totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0;

      // Inadimplência
      const vencidas = invoices?.filter(i =>
        i.status !== 'paid' && new Date(i.due_date) < today
      ) || [];
      const totalVencido = vencidas.reduce((s, i) => s + Number(i.amount), 0);
      const inadimplencia = totalReceitas > 0 ? (totalVencido / totalReceitas) * 100 : 0;

      // Conciliação
      const pendentes = transactions?.filter(t => !t.matched).length || 0;
      const conciliadas = transactions?.filter(t => t.matched).length || 0;
      const taxaConciliacao = (conciliadas / (conciliadas + pendentes || 1)) * 100;

      updateTask(taskId, { progress: 100, message: 'DRE carregada!' });

      setFinancialSummary({
        receitas: totalReceitas,
        despesas: totalDespesas,
        lucro,
        margem,
        inadimplencia,
        conciliacao: taxaConciliacao,
        clientesAtivos: clients?.length || 0,
        transacoesPendentes: pendentes,
      });

      updateTask(taskId, {
        status: 'completed',
        completedAt: new Date(),
        result: { receitas: totalReceitas, despesas: totalDespesas, lucro }
      });

      updateAgent('Gestor IA', {
        status: 'active',
        lastAction: `DRE: ${formatCurrency(totalReceitas)}`,
        tasksCompleted: prev => prev.tasksCompleted + 1,
        tasksToday: prev => prev.tasksToday + 1,
      });

      return { receitas: totalReceitas, despesas: totalDespesas, lucro, margem, inadimplencia, pendentes };

    } catch (error: any) {
      updateTask(taskId, { status: 'error', message: error.message });
      updateAgent('Gestor IA', { status: 'idle', lastAction: 'Erro ao carregar DRE' });
      return null;
    }
  }, [addTask, updateTask, updateAgent, selectedYear, selectedMonth]);

  // =====================================================
  // AUTOMAÇÃO 2: CONCILIAÇÃO AUTOMÁTICA
  // =====================================================
  const runAutoReconciliation = useCallback(async () => {
    const taskId = addTask({
      name: 'Conciliação automática',
      agent: 'Dr. Cícero',
      status: 'running',
      progress: 0,
      message: 'Buscando transações pendentes...',
    });

    updateAgent('Dr. Cícero', { status: 'working', lastAction: 'Conciliando transações...' });

    try {
      // Buscar transações não conciliadas
      const { data: pendingTx } = await supabase
        .from('bank_transactions')
        .select('id, description, amount, transaction_date, transaction_type, matched')
        .eq('matched', false)
        .limit(10);

      if (!pendingTx || pendingTx.length === 0) {
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          message: 'Nenhuma transação pendente',
          completedAt: new Date()
        });
        updateAgent('Dr. Cícero', { status: 'active', lastAction: 'Sem pendências' });
        return { processed: 0, matched: 0 };
      }

      updateTask(taskId, { progress: 30, message: `Processando ${pendingTx.length} transações...` });

      let matchedCount = 0;

      // Processar cada transação
      for (let i = 0; i < pendingTx.length; i++) {
        const tx = pendingTx[i];

        updateTask(taskId, {
          progress: 30 + (i / pendingTx.length) * 60,
          message: `Analisando transação ${i + 1}/${pendingTx.length}...`
        });

        // Tentar encontrar despesa correspondente
        if (tx.transaction_type === 'debit') {
          const { data: matchingExpense } = await supabase
            .from('expenses')
            .select('id, amount, due_date, status')
            .eq('status', 'paid')
            .gte('due_date', new Date(new Date(tx.transaction_date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .lte('due_date', new Date(new Date(tx.transaction_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('due_date')
            .limit(1);

          if (matchingExpense && matchingExpense.length > 0) {
            const expense = matchingExpense[0];
            if (Math.abs(expense.amount - Math.abs(tx.amount)) < 0.01) {
              // Marcar como conciliada
              await supabase
                .from('bank_transactions')
                .update({
                  matched: true,
                  ai_suggestion: `Dr. Cícero: Conciliado automaticamente com despesa #${expense.id}`
                })
                .eq('id', tx.id);

              matchedCount++;
            }
          }
        }

        // Tentar encontrar fatura correspondente (crédito)
        if (tx.transaction_type === 'credit') {
          const { data: matchingInvoice } = await supabase
            .from('invoices')
            .select('id, amount, due_date, status')
            .eq('status', 'paid')
            .gte('due_date', new Date(new Date(tx.transaction_date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .lte('due_date', new Date(new Date(tx.transaction_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('due_date')
            .limit(1);

          if (matchingInvoice && matchingInvoice.length > 0) {
            const invoice = matchingInvoice[0];
            if (Math.abs(invoice.amount - Math.abs(tx.amount)) < 0.01) {
              await supabase
                .from('bank_transactions')
                .update({
                  matched: true,
                  ai_suggestion: `Dr. Cícero: Conciliado automaticamente com fatura #${invoice.id}`
                })
                .eq('id', tx.id);

              matchedCount++;
            }
          }
        }
      }

      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: `${matchedCount} transações conciliadas`,
        completedAt: new Date(),
        result: { processed: pendingTx.length, matched: matchedCount }
      });

      updateAgent('Dr. Cícero', {
        status: 'active',
        lastAction: `${matchedCount} conciliações`,
        tasksCompleted: prev => prev.tasksCompleted + 1,
        tasksToday: prev => prev.tasksToday + matchedCount,
      });

      if (matchedCount > 0) {
        addAlert({
          type: 'success',
          agent: 'Dr. Cícero',
          title: 'Conciliação Automática',
          message: `${matchedCount} transações foram conciliadas automaticamente.`,
        });
      }

      return { processed: pendingTx.length, matched: matchedCount };

    } catch (error: any) {
      updateTask(taskId, { status: 'error', message: error.message });
      updateAgent('Dr. Cícero', { status: 'idle', lastAction: 'Erro na conciliação' });
      return null;
    }
  }, [addTask, updateTask, updateAgent, addAlert]);

  // =====================================================
  // AUTOMAÇÃO 3: CLASSIFICAÇÃO AUTOMÁTICA DE DESPESAS (DR. CÍCERO)
  // =====================================================
  const runAutoClassification = useCallback(async () => {
    const taskId = addTask({
      name: 'Classificação automática de despesas',
      agent: 'Dr. Cícero',
      status: 'running',
      progress: 0,
      message: 'Buscando transações não classificadas...',
    });

    updateAgent('Dr. Cícero', { status: 'working', lastAction: 'Classificando despesas...' });

    try {
      // Buscar transações não classificadas (sem ai_suggestion ou categoria)
      const { data: unclassified } = await supabase
        .from('bank_transactions')
        .select('id, description, amount, transaction_date, transaction_type, ai_suggestion')
        .is('ai_suggestion', null)
        .eq('matched', false)
        .limit(20);

      if (!unclassified || unclassified.length === 0) {
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          message: 'Nenhuma transação para classificar',
          completedAt: new Date()
        });
        updateAgent('Dr. Cícero', { status: 'active', lastAction: 'Tudo classificado' });
        return { processed: 0, classified: 0, needsHuman: 0 };
      }

      updateTask(taskId, { progress: 20, message: `Analisando ${unclassified.length} transações...` });

      let classifiedCount = 0;
      let needsHumanCount = 0;

      // Regras de classificação automática baseadas em padrões comuns
      const classificationRules: { pattern: RegExp; category: string; account: string; confidence: number }[] = [
        // Energia/Luz
        { pattern: /cemig|copel|light|enel|celpe|coelba|energia|eletric/i, category: 'Energia Elétrica', account: '4.1.03.01', confidence: 0.95 },
        // Água
        { pattern: /copasa|sabesp|cedae|saneago|embasa|agua|sanea/i, category: 'Água e Esgoto', account: '4.1.03.02', confidence: 0.95 },
        // Internet/Telefone
        { pattern: /vivo|tim|claro|oi|net|telecom|internet|fibra/i, category: 'Telecomunicações', account: '4.1.03.03', confidence: 0.92 },
        // Aluguel
        { pattern: /aluguel|locacao|imobil/i, category: 'Aluguel', account: '4.1.03.04', confidence: 0.90 },
        // Impostos
        { pattern: /darf|gps|inss|fgts|irrf|simples|das|iss|iptu|ipva/i, category: 'Impostos e Taxas', account: '4.1.04.01', confidence: 0.93 },
        // Bancárias
        { pattern: /tar\.?bancaria|iof|taxa.*manut|anuidade|ted|doc|pix.*taxa/i, category: 'Despesas Bancárias', account: '4.1.05.01', confidence: 0.90 },
        // Software/Assinaturas
        { pattern: /google|microsoft|adobe|dropbox|slack|zoom|notion|aws|azure|github/i, category: 'Software e Licenças', account: '4.1.06.01', confidence: 0.88 },
        // Combustível
        { pattern: /posto|shell|br|ipiranga|petrobras|gasolina|etanol|diesel|combust/i, category: 'Combustível', account: '4.1.07.01', confidence: 0.90 },
        // Alimentação
        { pattern: /ifood|rappi|uber.*eats|restaurante|lanchonete|padaria|mercado|supermercado|refeic/i, category: 'Alimentação', account: '4.1.07.02', confidence: 0.85 },
        // Material de Escritório
        { pattern: /kalunga|staples|papelaria|material.*escrit/i, category: 'Material de Escritório', account: '4.1.08.01', confidence: 0.88 },
        // Salários (transferências recorrentes)
        { pattern: /salario|folha|pagto.*func|adiantamento.*func/i, category: 'Salários', account: '4.2.01.01', confidence: 0.92 },
        // Pro-labore
        { pattern: /pro.*labore|prolabore|retirada.*socio/i, category: 'Pro-Labore', account: '4.2.02.01', confidence: 0.93 },
        // Honorários contábeis próprios
        { pattern: /honorario|contabil|escriturac/i, category: 'Honorários Contábeis', account: '4.1.09.01', confidence: 0.90 },
        // Condomínio
        { pattern: /condominio|cond\./i, category: 'Condomínio', account: '4.1.03.05', confidence: 0.92 },
        // Seguros
        { pattern: /seguro|porto.*seguro|sulamerica|bradesco.*seg|mapfre/i, category: 'Seguros', account: '4.1.10.01', confidence: 0.90 },
        // Cartório
        { pattern: /cartorio|registro|tabelio|autent/i, category: 'Cartório e Registros', account: '4.1.11.01', confidence: 0.88 },
      ];

      for (let i = 0; i < unclassified.length; i++) {
        const tx = unclassified[i];

        updateTask(taskId, {
          progress: 20 + (i / unclassified.length) * 70,
          message: `Classificando ${i + 1}/${unclassified.length}: ${tx.description?.substring(0, 30)}...`
        });

        // Tentar classificar pela descrição
        let matched = false;
        for (const rule of classificationRules) {
          if (rule.pattern.test(tx.description || '')) {
            // Classificação automática encontrada
            await supabase
              .from('bank_transactions')
              .update({
                ai_suggestion: `Dr. Cícero (${(rule.confidence * 100).toFixed(0)}%): ${rule.category} | Conta: ${rule.account}`
              })
              .eq('id', tx.id);

            classifiedCount++;
            matched = true;
            break;
          }
        }

        // Se não conseguiu classificar automaticamente, verificar se precisa de humano
        if (!matched) {
          // Verificar se o valor é significativo (maior que R$ 100)
          if (Math.abs(tx.amount) > 100) {
            // Adicionar à fila de intervenção humana apenas se realmente não identificável
            setHumanInterventions(prev => {
              // Evitar duplicatas
              if (prev.find(h => h.data?.id === tx.id)) return prev;
              return [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                type: 'classification',
                description: tx.description || 'Sem descrição',
                data: tx,
                reason: `Transação de ${formatCurrency(Math.abs(tx.amount))} não identificada automaticamente`,
                timestamp: new Date(),
              }].slice(-50); // Manter apenas últimos 50
            });
            needsHumanCount++;
          } else {
            // Transações pequenas: classificar como "Outras Despesas"
            await supabase
              .from('bank_transactions')
              .update({
                ai_suggestion: `Dr. Cícero (75%): Outras Despesas | Conta: 4.1.99.01 | Valor baixo, classificação automática`
              })
              .eq('id', tx.id);
            classifiedCount++;
          }
        }
      }

      setClassificationsProcessed(prev => prev + classifiedCount);

      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: `${classifiedCount} classificadas, ${needsHumanCount} pendentes`,
        completedAt: new Date(),
        result: { processed: unclassified.length, classified: classifiedCount, needsHuman: needsHumanCount }
      });

      updateAgent('Dr. Cícero', {
        status: 'active',
        lastAction: `${classifiedCount} classificações`,
        tasksCompleted: prev => prev.tasksCompleted + 1,
        tasksToday: prev => prev.tasksToday + classifiedCount,
      });

      if (classifiedCount > 0) {
        addAlert({
          type: 'success',
          agent: 'Dr. Cícero',
          title: 'Classificação Automática',
          message: `${classifiedCount} transações foram classificadas automaticamente.`,
        });
      }

      if (needsHumanCount > 0) {
        addAlert({
          type: 'info',
          agent: 'Dr. Cícero',
          title: 'Intervenção Necessária',
          message: `${needsHumanCount} transações precisam de classificação manual (valores altos sem padrão identificável).`,
          action: 'Revisar transações na fila de intervenção',
        });
      }

      return { processed: unclassified.length, classified: classifiedCount, needsHuman: needsHumanCount };

    } catch (error: any) {
      updateTask(taskId, { status: 'error', message: error.message });
      updateAgent('Dr. Cícero', { status: 'idle', lastAction: 'Erro na classificação' });
      return null;
    }
  }, [addTask, updateTask, updateAgent, addAlert]);

  // =====================================================
  // AUTOMAÇÃO 4: PROCESSAMENTO DE EXTRATOS IMPORTADOS
  // =====================================================
  const runExtractProcessing = useCallback(async () => {
    const taskId = addTask({
      name: 'Processar extratos importados',
      agent: 'Dr. Cícero',
      status: 'running',
      progress: 0,
      message: 'Verificando importações pendentes...',
    });

    updateAgent('Dr. Cícero', { status: 'working', lastAction: 'Processando extratos...' });

    try {
      // Buscar importações recentes que ainda não foram totalmente processadas
      const { data: recentImports } = await supabase
        .from('bank_imports')
        .select('id, file_name, status, created_at, processed_count, total_count')
        .order('created_at', { ascending: false })
        .limit(5);

      updateTask(taskId, { progress: 30, message: 'Analisando lotes importados...' });

      // Buscar transações recém-importadas (últimas 24h) sem processamento
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: recentTx } = await supabase
        .from('bank_transactions')
        .select('id, description, amount, transaction_date, transaction_type, matched, ai_suggestion, created_at')
        .gte('created_at', yesterday.toISOString())
        .is('ai_suggestion', null)
        .limit(50);

      if (!recentTx || recentTx.length === 0) {
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          message: 'Nenhum extrato novo para processar',
          completedAt: new Date()
        });
        return { processed: 0 };
      }

      updateTask(taskId, { progress: 50, message: `Processando ${recentTx.length} transações novas...` });

      let processed = 0;

      // Processar automaticamente: identificar tipo (crédito/débito) e categorizar
      for (const tx of recentTx) {
        // Se valor positivo e não marcado como crédito, atualizar
        if (tx.amount > 0 && tx.transaction_type !== 'credit') {
          await supabase
            .from('bank_transactions')
            .update({ transaction_type: 'credit' })
            .eq('id', tx.id);
        }

        // Se valor negativo e não marcado como débito, atualizar
        if (tx.amount < 0 && tx.transaction_type !== 'debit') {
          await supabase
            .from('bank_transactions')
            .update({ transaction_type: 'debit' })
            .eq('id', tx.id);
        }

        processed++;
      }

      setExtractsProcessed(prev => prev + processed);

      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: `${processed} transações processadas`,
        completedAt: new Date(),
        result: { processed }
      });

      updateAgent('Dr. Cícero', {
        status: 'active',
        lastAction: `${processed} extratos processados`,
      });

      return { processed };

    } catch (error: any) {
      updateTask(taskId, { status: 'error', message: error.message });
      return null;
    }
  }, [addTask, updateTask, updateAgent]);

  // =====================================================
  // AUTOMAÇÃO 5: ANÁLISE E ALERTAS AUTOMÁTICOS
  // =====================================================
  const runAutoAnalysis = useCallback(async (data: any) => {
    if (!data) return;

    const taskId = addTask({
      name: 'Análise de indicadores',
      agent: 'Gestor IA',
      status: 'running',
      progress: 0,
      message: 'Analisando indicadores...',
    });

    updateAgent('Gestor IA', { status: 'working', lastAction: 'Analisando...' });

    try {
      updateTask(taskId, { progress: 25, message: 'Verificando inadimplência...' });

      // Análise de inadimplência
      if (data.inadimplencia > 10) {
        addAlert({
          type: 'danger',
          agent: 'Gestor IA',
          title: 'Inadimplência Crítica',
          message: `Taxa de ${formatPercent(data.inadimplencia)} está muito acima da meta de 5%. Ação urgente necessária.`,
          action: 'Iniciar cobrança imediata dos maiores devedores',
        });
      } else if (data.inadimplencia > 5) {
        addAlert({
          type: 'warning',
          agent: 'Gestor IA',
          title: 'Inadimplência Alta',
          message: `Taxa de ${formatPercent(data.inadimplencia)} está acima da meta de 5%.`,
          action: 'Revisar régua de cobrança',
        });
      }

      updateTask(taskId, { progress: 50, message: 'Verificando margem de lucro...' });

      // Análise de margem
      if (data.margem < 0) {
        addAlert({
          type: 'danger',
          agent: 'Gestor IA',
          title: 'Prejuízo Operacional',
          message: `Empresa operando com prejuízo. Margem negativa de ${formatPercent(data.margem)}.`,
          action: 'Revisão urgente de custos e precificação',
        });
      } else if (data.margem < 15) {
        addAlert({
          type: 'warning',
          agent: 'Gestor IA',
          title: 'Margem Baixa',
          message: `Margem de ${formatPercent(data.margem)} está abaixo do ideal (30%).`,
          action: 'Otimizar estrutura de custos',
        });
      } else if (data.margem >= 30) {
        addAlert({
          type: 'success',
          agent: 'Gestor IA',
          title: 'Excelente Performance',
          message: `Margem de ${formatPercent(data.margem)} acima da meta!`,
        });
      }

      updateTask(taskId, { progress: 75, message: 'Verificando pendências...' });

      // Análise de transações pendentes
      if (data.pendentes > 50) {
        addAlert({
          type: 'warning',
          agent: 'Dr. Cícero',
          title: 'Muitas Transações Pendentes',
          message: `${data.pendentes} transações aguardando conciliação.`,
          action: 'Executar conciliação em lote',
        });
      }

      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: 'Análise concluída',
        completedAt: new Date()
      });

      updateAgent('Gestor IA', {
        status: 'active',
        lastAction: 'Análise concluída',
        tasksCompleted: prev => prev.tasksCompleted + 1,
        tasksToday: prev => prev.tasksToday + 1,
      });

    } catch (error: any) {
      updateTask(taskId, { status: 'error', message: error.message });
    }
  }, [addTask, updateTask, updateAgent, addAlert]);

  // =====================================================
  // AUTOMAÇÃO 6: IDENTIFICAÇÃO AUTOMÁTICA DE PAGADORES (SPRINT 1)
  // =====================================================
  const runPayerIdentification = useCallback(async () => {
    const taskId = addTask({
      name: 'Identificar pagadores automaticamente',
      agent: 'Dr. Cícero',
      status: 'running',
      progress: 0,
      message: 'Buscando transações com metadados extraídos...',
    });

    updateAgent('Dr. Cícero', { status: 'working', lastAction: 'Identificando pagadores...' });

    try {
      // Buscar transações com CNPJ/CPF extraído mas sem cliente sugerido
      const { data: pendingTx } = await supabase
        .from('bank_transactions')
        .select('id, description, extracted_cnpj, extracted_cpf, suggested_client_id')
        .or('extracted_cnpj.not.is.null,extracted_cpf.not.is.null')
        .is('suggested_client_id', null)
        .limit(50);

      if (!pendingTx || pendingTx.length === 0) {
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          message: 'Nenhuma transação pendente de identificação',
          completedAt: new Date()
        });
        updateAgent('Dr. Cícero', { status: 'active', lastAction: 'Identificação em dia' });
        return { processed: 0, identified: 0 };
      }

      updateTask(taskId, { progress: 20, message: `Identificando ${pendingTx.length} transações...` });

      let identifiedCount = 0;
      let byCnpj = 0;
      let byQsa = 0;

      for (let i = 0; i < pendingTx.length; i++) {
        const tx = pendingTx[i];

        updateTask(taskId, {
          progress: 20 + (i / pendingTx.length) * 70,
          message: `Identificando ${i + 1}/${pendingTx.length}...`
        });

        // Chamar função do banco que identifica o pagador
        const { data: result, error } = await supabase
          .rpc('fn_identify_payer', { p_transaction_id: tx.id });

        if (!error && result?.success) {
          identifiedCount++;
          if (result.method === 'cnpj_match') byCnpj++;
          if (result.method === 'qsa_match') byQsa++;
        }
      }

      // Atualizar estatísticas
      const { data: reviewCount } = await supabase
        .from('bank_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('needs_review', true);

      setPayerStats(prev => ({
        totalIdentified: prev.totalIdentified + identifiedCount,
        byCnpj: prev.byCnpj + byCnpj,
        byQsa: prev.byQsa + byQsa,
        pendingReview: reviewCount?.length || 0,
        lastRun: new Date()
      }));

      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: `${identifiedCount} pagadores identificados`,
        completedAt: new Date(),
        result: { identified: identifiedCount, byCnpj, byQsa }
      });

      updateAgent('Dr. Cícero', {
        status: 'active',
        lastAction: `${identifiedCount} pagadores ID`,
        tasksCompleted: (prev: any) => prev.tasksCompleted + 1,
        tasksToday: (prev: any) => prev.tasksToday + identifiedCount,
      });

      if (identifiedCount > 0) {
        addAlert({
          type: 'success',
          agent: 'Dr. Cícero',
          title: 'Identificação de Pagadores',
          message: `${identifiedCount} pagadores identificados automaticamente (${byCnpj} por CNPJ, ${byQsa} por QSA).`,
        });
      }

      return { processed: pendingTx.length, identified: identifiedCount, byCnpj, byQsa };

    } catch (error: any) {
      console.error('Erro na identificação de pagadores:', error);
      updateTask(taskId, { status: 'error', message: error.message });
      updateAgent('Dr. Cícero', { status: 'idle', lastAction: 'Erro na identificação' });
      return null;
    }
  }, [addTask, updateTask, updateAgent, addAlert]);

  // =====================================================
  // AUTOMAÇÃO 7: CARREGAR ALERTAS DO BANCO DE DADOS
  // =====================================================
  const loadDatabaseAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setDatabaseAlerts(data);

        // Converter alertas do banco para o formato do sistema
        const newAlerts = data.map(dbAlert => ({
          type: dbAlert.severity === 'error' ? 'danger' : dbAlert.severity as 'warning' | 'info' | 'success',
          agent: 'Sistema',
          title: dbAlert.title,
          message: dbAlert.message,
          action: dbAlert.entity_type ? `Ver ${dbAlert.entity_type}` : undefined,
        }));

        // Adicionar apenas alertas novos (não duplicados)
        newAlerts.forEach(alert => {
          const exists = alerts.some(a => a.title === alert.title && a.message === alert.message);
          if (!exists) {
            addAlert(alert);
          }
        });
      }
    } catch (error) {
      console.error('Erro ao carregar alertas do banco:', error);
    }
  }, [addAlert, alerts]);

  // =====================================================
  // AUTOMAÇÃO 8: GERAR ALERTAS DIÁRIOS
  // =====================================================
  const generateDailyAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('fn_generate_daily_alerts');
      if (!error && data) {
        // Recarregar alertas após gerar novos
        await loadDatabaseAlerts();
      }
    } catch (error) {
      console.error('Erro ao gerar alertas diários:', error);
    }
  }, [loadDatabaseAlerts]);

  // =====================================================
  // CICLO PRINCIPAL DE AUTOMAÇÃO (8 ETAPAS)
  // =====================================================
  const runAutomationCycle = useCallback(async () => {
    if (!isAutomationActive) return;

    setCycleCount(prev => prev + 1);
    cleanupTasks();

    // 1. Carregar dados financeiros
    const data = await loadFinancialData();

    // 2. Processar extratos importados recentemente
    await runExtractProcessing();

    // 3. Classificar despesas automaticamente (Dr. Cícero)
    await runAutoClassification();

    // 4. Executar conciliação automática
    await runAutoReconciliation();

    // 5. Identificar pagadores automaticamente (Sprint 1)
    await runPayerIdentification();

    // 6. Executar análise e gerar alertas
    await runAutoAnalysis(data);

    // 7. Gerar alertas diários do sistema
    await generateDailyAlerts();

    // 8. Carregar alertas do banco
    await loadDatabaseAlerts();

    setLastUpdate(new Date());
  }, [isAutomationActive, loadFinancialData, runExtractProcessing, runAutoClassification, runAutoReconciliation, runPayerIdentification, runAutoAnalysis, generateDailyAlerts, loadDatabaseAlerts, cleanupTasks]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  // Recarregar dados quando o período mudar
  useEffect(() => {
    if (isAutomationActive) {
      loadFinancialData();
    }
  }, [selectedYear, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Iniciar/parar automação
  useEffect(() => {
    if (isAutomationActive) {
      // Executar imediatamente
      runAutomationCycle();

      // Configurar intervalo (a cada 60 segundos)
      automationIntervalRef.current = setInterval(runAutomationCycle, 60000);
    } else {
      if (automationIntervalRef.current) {
        clearInterval(automationIntervalRef.current);
      }
    }

    return () => {
      if (automationIntervalRef.current) {
        clearInterval(automationIntervalRef.current);
      }
    };
  }, [isAutomationActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // =====================================================
  // FUNÇÕES AUXILIARES DE UI
  // =====================================================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'working': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAlertBg = (type: string) => {
    switch (type) {
      case 'danger': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      case 'success': return 'bg-green-50 border-green-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      default: return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header com Status Global */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="relative">
                <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-violet-600" />
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              Central de Automação IA
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Sistema 100% autônomo - Zero intervenção humana
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Classificações</div>
              <div className="font-bold text-lg text-blue-600">{classificationsProcessed}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Extratos</div>
              <div className="font-bold text-lg text-green-600">{extractsProcessed}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Pagadores ID</div>
              <div className="font-bold text-lg text-violet-600">{payerStats.totalIdentified}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Ciclos</div>
              <div className="font-bold text-lg">{cycleCount}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Atualização</div>
              <div className="font-medium">{lastUpdate.toLocaleTimeString('pt-BR')}</div>
            </div>
            <Badge
              variant={isAutomationActive ? "default" : "secondary"}
              className={cn(
                "px-4 py-2 text-sm",
                isAutomationActive && "bg-green-600 animate-pulse"
              )}
            >
              {isAutomationActive ? (
                <>
                  <CircleDot className="h-4 w-4 mr-2 animate-pulse" />
                  AUTOMAÇÃO ATIVA
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  PAUSADA
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Filtro de Período - Usar mesmo período da DRE */}
        <PeriodFilter />

        {/* Status dos Agentes */}
        <div className="grid grid-cols-2 gap-4">
          {agentMetrics.map((agent, idx) => (
            <Card key={idx} className="relative overflow-hidden">
              <div className={cn("absolute top-0 left-0 w-1 h-full", agent.bgColor)} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-3 rounded-xl", agent.bgColor)}>
                      <agent.icon className={cn("h-6 w-6", agent.color)} />
                    </div>
                    <div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        {agent.name}
                        <span className={cn("w-2 h-2 rounded-full", getStatusColor(agent.status))} />
                      </div>
                      <div className="text-sm text-muted-foreground">{agent.lastAction}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{agent.tasksToday}</div>
                    <div className="text-xs text-muted-foreground">ações hoje</div>
                    <div className="text-xs text-green-600 mt-1">
                      {formatPercent(agent.accuracy)} precisão
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Card de Identificação de Pagadores (Sprint 1) */}
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-violet-800">
              <Sparkles className="h-5 w-5" />
              Identificação Automática de Pagadores
              <Badge variant="secondary" className="ml-2 bg-violet-100 text-violet-700">Sprint 1</Badge>
            </CardTitle>
            <CardDescription>
              Sistema de reconhecimento inteligente baseado em CNPJ/CPF extraídos do extrato bancário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-3xl font-bold text-violet-600">{payerStats.totalIdentified}</div>
                <div className="text-xs text-muted-foreground">Total Identificados</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-3xl font-bold text-blue-600">{payerStats.byCnpj}</div>
                <div className="text-xs text-muted-foreground">Por CNPJ (100%)</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-3xl font-bold text-purple-600">{payerStats.byQsa}</div>
                <div className="text-xs text-muted-foreground">Por QSA/CPF (95%)</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-3xl font-bold text-amber-600">{payerStats.pendingReview}</div>
                <div className="text-xs text-muted-foreground">Revisão Pendente</div>
              </div>
            </div>
            {payerStats.lastRun && (
              <div className="mt-3 text-xs text-muted-foreground text-right">
                Última execução: {payerStats.lastRun.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas do Sistema (Banco de Dados) */}
        {databaseAlerts.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <Bell className="h-5 w-5" />
                Alertas do Sistema
                <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">{databaseAlerts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {databaseAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-lg border flex items-start gap-3",
                    alert.severity === 'error' ? 'bg-red-50 border-red-200' :
                    alert.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                    'bg-blue-50 border-blue-200'
                  )}
                >
                  {alert.severity === 'error' ? <AlertCircle className="h-5 w-5 text-red-500 shrink-0" /> :
                   alert.severity === 'warning' ? <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" /> :
                   <Bell className="h-5 w-5 text-blue-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{alert.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{alert.message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(alert.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tarefas em Execução */}
        {currentTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
                Tarefas em Execução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentTasks.map((task) => (
                <div key={task.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", getTaskStatusColor(task.status))}>
                        {task.name}
                      </span>
                      <Badge variant="outline" className="text-xs">{task.agent}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{task.message}</span>
                  </div>
                  {task.status === 'running' && (
                    <Progress value={task.progress} className="h-2" />
                  )}
                  {task.status === 'completed' && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      Concluído
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Receitas</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(financialSummary?.receitas || 0)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700 font-medium">Despesas</p>
                  <p className="text-2xl font-bold text-red-800">
                    {formatCurrency(financialSummary?.despesas || 0)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "bg-gradient-to-br border-2",
            (financialSummary?.lucro || 0) >= 0
              ? "from-blue-50 to-indigo-50 border-blue-200"
              : "from-orange-50 to-amber-50 border-orange-200"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Resultado</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {formatCurrency(financialSummary?.lucro || 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Margem</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {formatPercent(financialSummary?.margem || 0)}
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Métricas Secundárias */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{financialSummary?.clientesAtivos || 0}</p>
              <p className="text-xs text-muted-foreground">Clientes Ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-600 mb-2" />
              <p className="text-2xl font-bold text-amber-600">
                {formatPercent(financialSummary?.inadimplencia || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Inadimplência</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-600">
                {formatPercent(financialSummary?.conciliacao || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Conciliação</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 mx-auto text-gray-600 mb-2" />
              <p className="text-2xl font-bold">{financialSummary?.transacoesPendentes || 0}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* FILA DE INTERVENÇÃO HUMANA (só quando necessário) */}
        {humanInterventions.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Intervenção Humana Necessária
                <Badge variant="destructive">{humanInterventions.length}</Badge>
              </CardTitle>
              <CardDescription className="text-amber-700">
                Apenas transações que a IA não conseguiu identificar automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[300px] overflow-auto">
              {humanInterventions.map((item) => (
                <div key={item.id} className="p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-amber-900">{item.description}</div>
                    <div className="text-sm text-amber-700">{item.reason}</div>
                    <div className="text-xs text-amber-600 mt-1">
                      {item.timestamp.toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-800">
                      {formatCurrency(Math.abs(item.data?.amount || 0))}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.type === 'classification' ? 'Classificar' : 'Conciliar'}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Alertas Gerados */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-amber-500" />
                Alertas e Ações da IA
                <Badge variant="secondary">{alerts.length}</Badge>
              </CardTitle>
              <CardDescription>
                Alertas gerados automaticamente pelos agentes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn("p-4 rounded-lg border flex items-start gap-3", getAlertBg(alert.type))}
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alert.title}</span>
                      <Badge variant="outline" className="text-xs">{alert.agent}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {alert.timestamp.toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    {alert.action && (
                      <p className="text-sm font-medium mt-2 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {alert.action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Rodapé com Info */}
        <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-violet-600" />
                <div>
                  <p className="font-semibold text-violet-800">Sistema 100% Autônomo</p>
                  <p className="text-sm text-violet-600">
                    Os agentes executam automaticamente a cada 60 segundos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-600" />
                <span className="text-sm text-violet-700">
                  Todas as ações são registradas e auditáveis
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AIAutomation;
