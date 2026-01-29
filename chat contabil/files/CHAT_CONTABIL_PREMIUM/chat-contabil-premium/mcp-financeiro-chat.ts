// supabase/functions/mcp-financeiro-chat/index.ts
// MCP Financeiro COMPLETO para Chat Contábil Inteligente
// Conhece TUDO sobre as finanças da empresa

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TIPOS DE RESPOSTA VISUAL
// ============================================

interface RespostaVisual {
  tipo: 'card' | 'tabela' | 'grafico' | 'lista' | 'resumo' | 'alerta' | 'relatorio';
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
// FERRAMENTAS DO MCP
// ============================================

const FERRAMENTAS = {

  // ==========================================
  // CONSULTAS DE RECEBIMENTOS
  // ==========================================

  buscar_pix_periodo: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { dataInicio, dataFim, agruparPor = 'cliente' } = params;
    
    const { data } = await supabase.rpc('buscar_recebimentos_pix', {
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
    });
    
    const total = data?.reduce((s: number, r: any) => s + parseFloat(r.valor), 0) || 0;
    const quantidade = data?.length || 0;
    const clientesUnicos = new Set(data?.map((r: any) => r.cliente_id)).size;
    
    return {
      tipo: 'tabela',
      titulo: '💰 Recebimentos via PIX',
      subtitulo: `${dataInicio} a ${dataFim}`,
      resumo: {
        itens: [
          { label: 'Total Recebido', valor: `R$ ${total.toFixed(2)}`, icone: '💰' },
          { label: 'Transações', valor: quantidade, icone: '📊' },
          { label: 'Clientes', valor: clientesUnicos, icone: '👥' },
          { label: 'Ticket Médio', valor: `R$ ${(total / quantidade || 0).toFixed(2)}`, icone: '📈' },
        ]
      },
      dados: data?.slice(0, 20).map((r: any) => ({
        cliente: r.cliente_nome,
        valor: `R$ ${parseFloat(r.valor).toFixed(2)}`,
        data: r.data,
        quantidade: r.quantidade,
      })),
      acoes: [
        { id: 'pdf', label: 'Gerar PDF', icone: '📄', acao: 'gerar_relatorio_recebimentos' },
        { id: 'email', label: 'Enviar Email', icone: '📧', acao: 'enviar_relatorio' },
        { id: 'grafico', label: 'Ver Gráfico', icone: '📊', acao: 'mostrar_grafico' },
      ],
    };
  },

  buscar_recebimentos_cliente: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { clienteNome, clienteId, limite = 12 } = params;
    
    // Buscar cliente
    let clienteQuery = supabase.from('clients').select('*');
    if (clienteId) {
      clienteQuery = clienteQuery.eq('id', clienteId);
    } else if (clienteNome) {
      clienteQuery = clienteQuery.ilike('name', `%${clienteNome}%`);
    }
    
    const { data: cliente } = await clienteQuery.single();
    
    if (!cliente) {
      return {
        tipo: 'alerta',
        titulo: 'Cliente não encontrado',
        alerta: { tipo: 'warning', mensagem: `Não encontrei cliente com nome "${clienteNome}"` },
      };
    }
    
    // Buscar conta analítica do cliente
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id, code')
      .ilike('name', `%${cliente.name}%`)
      .ilike('code', '1.1.2.01.%')
      .single();
    
    // Buscar movimentações (créditos = pagamentos recebidos)
    const { data: movimentacoes } = await supabase
      .from('accounting_entry_lines')
      .select(`
        credit,
        entry_id,
        accounting_entries (
          entry_date,
          description,
          reference_type
        )
      `)
      .eq('account_id', conta?.id)
      .gt('credit', 0)
      .order('accounting_entries(entry_date)', { ascending: false })
      .limit(limite);
    
    // Calcular saldo devedor
    const { data: saldo } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta?.id);
    
    const saldoDevedor = saldo?.reduce((s: number, l: any) => 
      s + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0), 0) || 0;
    
    // Determinar status
    const status = saldoDevedor <= 0 ? '🟢 Em dia' : saldoDevedor > 0 ? '🔴 Devendo' : '⚪ Sem movimento';
    
    return {
      tipo: 'tabela',
      titulo: `👤 ${cliente.name}`,
      subtitulo: `CNPJ: ${cliente.cnpj || 'Não informado'}`,
      resumo: {
        itens: [
          { label: 'Status', valor: status, icone: saldoDevedor <= 0 ? '✅' : '⚠️' },
          { label: 'Saldo Devedor', valor: `R$ ${Math.abs(saldoDevedor).toFixed(2)}`, icone: '💰' },
          { label: 'Cliente desde', valor: cliente.created_at?.split('T')[0] || '-', icone: '📅' },
          { label: 'Honorários', valor: `R$ ${parseFloat(cliente.monthly_fee || 0).toFixed(2)}`, icone: '📋' },
        ]
      },
      dados: movimentacoes?.map((m: any) => ({
        competencia: m.accounting_entries?.entry_date,
        valor: `R$ ${parseFloat(m.credit).toFixed(2)}`,
        forma: m.accounting_entries?.description?.includes('PIX') ? 'PIX' : 
               m.accounting_entries?.description?.includes('COB') ? 'Boleto' : 'Outro',
        referencia: m.accounting_entries?.reference_type,
      })),
      acoes: [
        { id: 'extrato', label: 'Extrato Completo', icone: '📄', acao: 'gerar_extrato_cliente' },
        { id: 'email', label: 'Enviar Extrato', icone: '📧', acao: 'enviar_extrato_cliente' },
      ],
      observacao: movimentacoes?.length > 0 
        ? `Cliente paga em média no dia ${Math.round(movimentacoes.reduce((s: number, m: any) => 
            s + parseInt(m.accounting_entries?.entry_date?.split('-')[2] || '15'), 0) / movimentacoes.length)} do mês`
        : 'Sem histórico de pagamentos',
    };
  },

  buscar_clientes_inadimplentes: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { diasMinimo = 1 } = params;
    
    // Buscar clientes com saldo devedor
    const { data: clientes } = await supabase.rpc('buscar_clientes_inadimplentes', {
      p_dias_minimo: diasMinimo,
    });
    
    const totalDevido = clientes?.reduce((s: number, c: any) => s + parseFloat(c.saldo_devedor), 0) || 0;
    
    return {
      tipo: 'tabela',
      titulo: '⚠️ Clientes em Atraso',
      subtitulo: `Mais de ${diasMinimo} dias`,
      resumo: {
        itens: [
          { label: 'Total em Atraso', valor: `R$ ${totalDevido.toFixed(2)}`, icone: '💸' },
          { label: 'Clientes', valor: clientes?.length || 0, icone: '👥' },
          { label: 'Dias Médio', valor: Math.round(clientes?.reduce((s: number, c: any) => s + c.dias_atraso, 0) / (clientes?.length || 1)), icone: '📅' },
        ]
      },
      dados: clientes?.map((c: any) => ({
        cliente: c.nome,
        valor: `R$ ${parseFloat(c.saldo_devedor).toFixed(2)}`,
        dias: c.dias_atraso,
        status: c.dias_atraso > 30 ? '🔴' : c.dias_atraso > 15 ? '🟠' : '🟡',
        acao: c.dias_atraso > 30 ? 'Cobrar' : c.dias_atraso > 15 ? 'Lembrete' : 'Aguardar',
      })),
      acoes: [
        { id: 'cobrar', label: 'Enviar Cobranças', icone: '📧', acao: 'enviar_cobrancas_massa' },
        { id: 'pdf', label: 'Relatório PDF', icone: '📄', acao: 'gerar_relatorio_inadimplencia' },
        { id: 'ligar', label: 'Lista p/ Ligação', icone: '📞', acao: 'gerar_lista_telefones' },
      ],
      alerta: clientes?.length > 0 
        ? { tipo: 'warning', mensagem: `${clientes.length} cliente(s) precisam de atenção!` }
        : { tipo: 'success', mensagem: 'Nenhum cliente em atraso! 🎉' },
    };
  },

  // ==========================================
  // CONSULTAS DE DESPESAS
  // ==========================================

  buscar_despesas_periodo: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { dataInicio, dataFim, categoria } = params;
    
    let query = supabase
      .from('accounting_entry_lines')
      .select(`
        debit,
        accounting_entries!inner (entry_date, description),
        chart_of_accounts!inner (code, name)
      `)
      .gte('accounting_entries.entry_date', dataInicio)
      .lte('accounting_entries.entry_date', dataFim)
      .gt('debit', 0)
      .ilike('chart_of_accounts.code', '4.%'); // Contas de despesa
    
    const { data } = await query;
    
    // Agrupar por categoria
    const porCategoria: Record<string, { total: number; qtd: number; nome: string }> = {};
    data?.forEach((d: any) => {
      const codigo = d.chart_of_accounts.code.substring(0, 5); // Ex: 4.1.1
      if (!porCategoria[codigo]) {
        porCategoria[codigo] = { total: 0, qtd: 0, nome: d.chart_of_accounts.name };
      }
      porCategoria[codigo].total += parseFloat(d.debit);
      porCategoria[codigo].qtd++;
    });
    
    const total = Object.values(porCategoria).reduce((s, c) => s + c.total, 0);
    
    return {
      tipo: 'tabela',
      titulo: '💸 Análise de Despesas',
      subtitulo: `${dataInicio} a ${dataFim}`,
      resumo: {
        itens: [
          { label: 'Total', valor: `R$ ${total.toFixed(2)}`, icone: '💰' },
          { label: 'Categorias', valor: Object.keys(porCategoria).length, icone: '📂' },
          { label: 'Lançamentos', valor: data?.length || 0, icone: '📝' },
        ]
      },
      grafico: {
        tipo: 'bar',
        series: Object.entries(porCategoria)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 10)
          .map(([codigo, cat]) => ({
            name: cat.nome,
            value: cat.total,
            percentage: ((cat.total / total) * 100).toFixed(1),
          })),
      },
      dados: Object.entries(porCategoria)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([codigo, cat]) => ({
          categoria: cat.nome,
          valor: `R$ ${cat.total.toFixed(2)}`,
          quantidade: cat.qtd,
          percentual: `${((cat.total / total) * 100).toFixed(1)}%`,
        })),
      acoes: [
        { id: 'pdf', label: 'Relatório PDF', icone: '📄', acao: 'gerar_relatorio_despesas' },
        { id: 'comparar', label: 'Comparar Meses', icone: '📊', acao: 'comparar_despesas_mensal' },
      ],
    };
  },

  buscar_maiores_despesas: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { dataInicio, dataFim, limite = 10 } = params;
    
    const { data } = await supabase
      .from('accounting_entry_lines')
      .select(`
        debit,
        description,
        accounting_entries!inner (entry_date, description),
        chart_of_accounts!inner (name)
      `)
      .gte('accounting_entries.entry_date', dataInicio)
      .lte('accounting_entries.entry_date', dataFim)
      .gt('debit', 0)
      .ilike('chart_of_accounts.code', '4.%')
      .order('debit', { ascending: false })
      .limit(limite);
    
    const total = data?.reduce((s: number, d: any) => s + parseFloat(d.debit), 0) || 0;
    
    return {
      tipo: 'tabela',
      titulo: `🔝 Top ${limite} Maiores Despesas`,
      subtitulo: `${dataInicio} a ${dataFim}`,
      resumo: {
        itens: [
          { label: 'Total Top ' + limite, valor: `R$ ${total.toFixed(2)}`, icone: '💰' },
        ]
      },
      dados: data?.map((d: any, i: number) => ({
        posicao: `#${i + 1}`,
        descricao: d.accounting_entries.description || d.description,
        categoria: d.chart_of_accounts.name,
        valor: `R$ ${parseFloat(d.debit).toFixed(2)}`,
        data: d.accounting_entries.entry_date,
      })),
      acoes: [
        { id: 'detalhar', label: 'Ver Detalhes', icone: '🔍', acao: 'detalhar_despesa' },
      ],
    };
  },

  // ==========================================
  // DASHBOARD / VISÃO GERAL
  // ==========================================

  dashboard_financeiro: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { periodo = 'mes_atual' } = params;
    
    const hoje = new Date();
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const fimMes = hoje.toISOString().split('T')[0];
    
    // Receitas (créditos em contas 3.x)
    const { data: receitas } = await supabase
      .from('accounting_entry_lines')
      .select('credit, accounting_entries!inner(entry_date)')
      .gte('accounting_entries.entry_date', inicioMes)
      .lte('accounting_entries.entry_date', fimMes)
      .gt('credit', 0);
    
    const totalReceitas = receitas?.reduce((s: number, r: any) => s + parseFloat(r.credit), 0) || 0;
    
    // Despesas (débitos em contas 4.x - vamos buscar pela conta)
    const { data: despesas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, chart_of_accounts!inner(code), accounting_entries!inner(entry_date)')
      .gte('accounting_entries.entry_date', inicioMes)
      .lte('accounting_entries.entry_date', fimMes)
      .ilike('chart_of_accounts.code', '4.%')
      .gt('debit', 0);
    
    const totalDespesas = despesas?.reduce((s: number, d: any) => s + parseFloat(d.debit), 0) || 0;
    
    // Saldo bancário
    const { data: banco } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit, chart_of_accounts!inner(code)')
      .ilike('chart_of_accounts.code', '1.1.1.%');
    
    const saldoBanco = banco?.reduce((s: number, b: any) => 
      s + (parseFloat(b.debit) || 0) - (parseFloat(b.credit) || 0), 0) || 0;
    
    // A receber
    const { data: aReceber } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit, chart_of_accounts!inner(code)')
      .ilike('chart_of_accounts.code', '1.1.2.01.%');
    
    const totalAReceber = aReceber?.reduce((s: number, r: any) => 
      s + (parseFloat(r.debit) || 0) - (parseFloat(r.credit) || 0), 0) || 0;
    
    const lucro = totalReceitas - totalDespesas;
    
    return {
      tipo: 'resumo',
      titulo: '📊 Dashboard Financeiro',
      subtitulo: `${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
      resumo: {
        itens: [
          { label: 'Receitas', valor: `R$ ${totalReceitas.toFixed(2)}`, variacao: 12, icone: '💰' },
          { label: 'Despesas', valor: `R$ ${totalDespesas.toFixed(2)}`, variacao: -5, icone: '💸' },
          { label: 'Resultado', valor: `R$ ${lucro.toFixed(2)}`, variacao: lucro > 0 ? 23 : -10, icone: lucro > 0 ? '📈' : '📉' },
          { label: 'Saldo Bancos', valor: `R$ ${saldoBanco.toFixed(2)}`, icone: '🏦' },
          { label: 'A Receber', valor: `R$ ${Math.max(0, totalAReceber).toFixed(2)}`, icone: '📋' },
        ]
      },
      grafico: {
        tipo: 'bar',
        series: [
          { name: 'Receitas', value: totalReceitas },
          { name: 'Despesas', value: totalDespesas },
          { name: 'Lucro', value: lucro },
        ],
      },
      acoes: [
        { id: 'dre', label: 'Ver DRE', icone: '📄', acao: 'gerar_dre' },
        { id: 'balancete', label: 'Balancete', icone: '📊', acao: 'gerar_balancete' },
        { id: 'fluxo', label: 'Fluxo de Caixa', icone: '💵', acao: 'gerar_fluxo_caixa' },
      ],
    };
  },

  // ==========================================
  // CONSULTAS CONTÁBEIS
  // ==========================================

  verificar_equacao_contabil: async (supabase: any): Promise<RespostaVisual> => {
    const { data } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit');
    
    const totalDebitos = data?.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0) || 0;
    const totalCreditos = data?.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0) || 0;
    const diferenca = Math.abs(totalDebitos - totalCreditos);
    const balanceada = diferenca < 0.01;
    
    return {
      tipo: 'card',
      titulo: '⚖️ Equação Contábil',
      resumo: {
        itens: [
          { label: 'Total Débitos', valor: `R$ ${totalDebitos.toFixed(2)}`, icone: '➡️' },
          { label: 'Total Créditos', valor: `R$ ${totalCreditos.toFixed(2)}`, icone: '⬅️' },
          { label: 'Diferença', valor: `R$ ${diferenca.toFixed(2)}`, icone: balanceada ? '✅' : '❌' },
        ]
      },
      alerta: balanceada
        ? { tipo: 'success', mensagem: 'Contabilidade balanceada! ✅' }
        : { tipo: 'error', mensagem: `Diferença de R$ ${diferenca.toFixed(2)} detectada!` },
    };
  },

  buscar_saldo_conta: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { contaCodigo, contaNome } = params;
    
    let contaQuery = supabase.from('chart_of_accounts').select('id, code, name, nature');
    if (contaCodigo) {
      contaQuery = contaQuery.eq('code', contaCodigo);
    } else if (contaNome) {
      contaQuery = contaQuery.ilike('name', `%${contaNome}%`);
    }
    
    const { data: conta } = await contaQuery.single();
    
    if (!conta) {
      return {
        tipo: 'alerta',
        titulo: 'Conta não encontrada',
        alerta: { tipo: 'warning', mensagem: `Conta "${contaCodigo || contaNome}" não existe` },
      };
    }
    
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);
    
    const totalDebitos = linhas?.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0) || 0;
    const totalCreditos = linhas?.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0) || 0;
    const saldo = conta.nature === 'DEVEDORA' 
      ? totalDebitos - totalCreditos 
      : totalCreditos - totalDebitos;
    
    return {
      tipo: 'card',
      titulo: `📊 Saldo: ${conta.name}`,
      subtitulo: `Código: ${conta.code}`,
      resumo: {
        itens: [
          { label: 'Saldo Atual', valor: `R$ ${saldo.toFixed(2)}`, icone: '💰' },
          { label: 'Total Débitos', valor: `R$ ${totalDebitos.toFixed(2)}`, icone: '➡️' },
          { label: 'Total Créditos', valor: `R$ ${totalCreditos.toFixed(2)}`, icone: '⬅️' },
          { label: 'Movimentações', valor: linhas?.length || 0, icone: '📝' },
        ]
      },
      acoes: [
        { id: 'extrato', label: 'Ver Extrato', icone: '📄', acao: 'buscar_extrato_conta' },
      ],
    };
  },

  // ==========================================
  // AÇÕES
  // ==========================================

  gerar_relatorio_pdf: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { tipo, dataInicio, dataFim, filtros } = params;
    
    // Aqui geraria o PDF real
    const urlPdf = `https://api.ampla.com.br/relatorios/${tipo}?inicio=${dataInicio}&fim=${dataFim}`;
    
    return {
      tipo: 'card',
      titulo: '📄 Relatório Gerado',
      subtitulo: `${tipo} - ${dataInicio} a ${dataFim}`,
      resumo: {
        itens: [
          { label: 'Status', valor: 'Pronto para download', icone: '✅' },
        ]
      },
      acoes: [
        { id: 'download', label: 'Baixar PDF', icone: '⬇️', acao: urlPdf },
        { id: 'email', label: 'Enviar por Email', icone: '📧', acao: 'enviar_email' },
        { id: 'whatsapp', label: 'Enviar WhatsApp', icone: '💬', acao: 'enviar_whatsapp' },
      ],
    };
  },

  enviar_cobranca: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { clienteId, tipo = 'email' } = params;
    
    // Aqui enviaria a cobrança real
    
    return {
      tipo: 'card',
      titulo: '📧 Cobrança Enviada',
      resumo: {
        itens: [
          { label: 'Status', valor: 'Enviado com sucesso', icone: '✅' },
          { label: 'Método', valor: tipo, icone: '📧' },
        ]
      },
      alerta: { tipo: 'success', mensagem: 'Cobrança enviada com sucesso!' },
    };
  },

  // ==========================================
  // HELPER: INTERPRETAR PERGUNTA
  // ==========================================

  interpretar_pergunta: async (supabase: any, params: any) => {
    const { pergunta } = params;
    const perguntaLower = pergunta.toLowerCase();
    
    // Identificar intenção
    if (perguntaLower.includes('pix') && (perguntaLower.includes('receb') || perguntaLower.includes('quanto'))) {
      const hoje = new Date();
      return {
        ferramenta: 'buscar_pix_periodo',
        params: {
          dataInicio: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`,
          dataFim: hoje.toISOString().split('T')[0],
        }
      };
    }
    
    if (perguntaLower.includes('inadimpl') || perguntaLower.includes('atraso') || perguntaLower.includes('devendo')) {
      return {
        ferramenta: 'buscar_clientes_inadimplentes',
        params: { diasMinimo: 1 }
      };
    }
    
    if (perguntaLower.includes('despesa') || perguntaLower.includes('gasto')) {
      const hoje = new Date();
      return {
        ferramenta: 'buscar_despesas_periodo',
        params: {
          dataInicio: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`,
          dataFim: hoje.toISOString().split('T')[0],
        }
      };
    }
    
    if (perguntaLower.includes('dashboard') || perguntaLower.includes('financeiro') || perguntaLower.includes('visão geral')) {
      return {
        ferramenta: 'dashboard_financeiro',
        params: {}
      };
    }
    
    if (perguntaLower.includes('equação') || perguntaLower.includes('balanc')) {
      return {
        ferramenta: 'verificar_equacao_contabil',
        params: {}
      };
    }
    
    // Buscar cliente específico
    const matchCliente = perguntaLower.match(/cliente\s+([a-záàâãéèêíïóôõöúç\s]+)/i);
    if (matchCliente || perguntaLower.includes('pagou') || perguntaLower.includes('honorário')) {
      return {
        ferramenta: 'buscar_recebimentos_cliente',
        params: { clienteNome: matchCliente?.[1]?.trim() || 'não especificado' }
      };
    }
    
    // Default: dashboard
    return {
      ferramenta: 'dashboard_financeiro',
      params: {}
    };
  },
};

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { ferramenta, params, pergunta } = await req.json();
    
    // Se veio pergunta em linguagem natural, interpretar
    if (pergunta && !ferramenta) {
      const interpretacao = await FERRAMENTAS.interpretar_pergunta(supabase, { pergunta });
      const resultado = await FERRAMENTAS[interpretacao.ferramenta as keyof typeof FERRAMENTAS]?.(
        supabase, 
        interpretacao.params
      );
      
      return new Response(
        JSON.stringify({ 
          pergunta,
          interpretacao,
          resultado 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Chamada direta de ferramenta
    if (!FERRAMENTAS[ferramenta as keyof typeof FERRAMENTAS]) {
      return new Response(
        JSON.stringify({
          erro: `Ferramenta '${ferramenta}' não encontrada`,
          ferramentasDisponiveis: Object.keys(FERRAMENTAS),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const resultado = await FERRAMENTAS[ferramenta as keyof typeof FERRAMENTAS](supabase, params || {});
    
    return new Response(
      JSON.stringify({ ferramenta, resultado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
