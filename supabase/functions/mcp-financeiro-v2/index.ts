// supabase/functions/mcp-financeiro-v2/index.ts
// MCP Financeiro COMPLETO - Consultas + Ações + Análises + DRE
// Sistema híbrido: Chat + Menus até 100% confiança

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TIPOS
// ============================================

interface RespostaVisual {
  tipo: 'card' | 'tabela' | 'grafico' | 'dre' | 'comparativo' | 'confirmacao' | 'formulario';
  titulo: string;
  subtitulo?: string;
  resumo?: { itens: Array<{ label: string; valor: string | number; variacao?: number; icone?: string; percentual?: string }> };
  dados?: any[];
  grafico?: { tipo: string; series: any[] };
  acoes?: Array<{ id: string; label: string; icone: string; acao: string; confirmacao?: boolean }>;
  observacao?: string;
  alerta?: { tipo: 'info' | 'warning' | 'error' | 'success'; mensagem: string };
  requerConfirmacao?: boolean;
  dadosConfirmacao?: any;
  campos?: Array<{ nome: string; tipo: string; label: string; obrigatorio?: boolean; opcoes?: any[] }>;
}

// ============================================
// FERRAMENTAS
// ============================================

const FERRAMENTAS = {

  // ==========================================
  // ANÁLISE DE COBRANÇA MENSAL
  // ==========================================

  analisar_cobranca_mes: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { competencia } = params;
    const hoje = new Date();
    const [ano, mes] = competencia ? competencia.split('-') : [
      hoje.getFullYear(),
      String(hoje.getMonth() + 1).padStart(2, '0')
    ];

    // Buscar boletos do mês
    const { data: boletos } = await supabase
      .from('invoices')
      .select('id, amount, status, client_id, due_date, paid_at, paid_amount, clients(name)')
      .eq('competence', `${ano}-${mes}`)
      .order('due_date');

    const totalGerado = boletos?.reduce((s: number, b: any) => s + parseFloat(b.amount), 0) || 0;
    const qtdGerados = boletos?.length || 0;

    const pagos = boletos?.filter((b: any) => b.status === 'paid') || [];
    const pendentes = boletos?.filter((b: any) => b.status === 'pending') || [];
    const atrasados = pendentes.filter((b: any) => new Date(b.due_date) < new Date());

    const totalRecebido = pagos.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || b.amount), 0);
    const totalAtrasado = atrasados.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
    const totalPendente = pendentes.reduce((s: number, b: any) => s + parseFloat(b.amount), 0) - totalAtrasado;

    // Mês anterior
    const mesAnt = mes === '01' ? '12' : String(parseInt(mes) - 1).padStart(2, '0');
    const anoAnt = mes === '01' ? String(parseInt(ano) - 1) : ano;

    const { data: boletosAnt } = await supabase
      .from('invoices')
      .select('amount, status, paid_amount')
      .eq('competence', `${anoAnt}-${mesAnt}`);

    const totalGeradoAnt = boletosAnt?.reduce((s: number, b: any) => s + parseFloat(b.amount), 0) || 0;
    const totalRecebidoAnt = boletosAnt?.filter((b: any) => b.status === 'paid')
      .reduce((s: number, b: any) => s + parseFloat(b.paid_amount || b.amount), 0) || 0;

    const variacaoRecebido = totalRecebidoAnt > 0 ? ((totalRecebido - totalRecebidoAnt) / totalRecebidoAnt * 100) : 0;
    const percentualRecebimento = totalGerado > 0 ? (totalRecebido / totalGerado * 100) : 0;

    return {
      tipo: 'comparativo',
      titulo: `Cobranca ${mes}/${ano}`,
      subtitulo: `Comparativo com ${mesAnt}/${anoAnt}`,
      resumo: {
        itens: [
          { label: 'Gerado', valor: `R$ ${totalGerado.toFixed(2)}`, icone: 'doc', percentual: `${qtdGerados} boletos` },
          { label: 'Recebido', valor: `R$ ${totalRecebido.toFixed(2)}`, icone: 'check', variacao: Math.round(variacaoRecebido), percentual: `${percentualRecebimento.toFixed(0)}%` },
          { label: 'Em Atraso', valor: `R$ ${totalAtrasado.toFixed(2)}`, icone: 'alert', percentual: `${atrasados.length} boletos` },
          { label: 'A Vencer', valor: `R$ ${totalPendente.toFixed(2)}`, icone: 'clock', percentual: `${pendentes.length - atrasados.length} boletos` },
        ]
      },
      grafico: {
        tipo: 'comparativo_barras',
        series: [
          { nome: 'Gerado', atual: totalGerado, anterior: totalGeradoAnt, cor: '#3b82f6' },
          { nome: 'Recebido', atual: totalRecebido, anterior: totalRecebidoAnt, cor: '#22c55e' },
          { nome: 'Atrasado', atual: totalAtrasado, anterior: 0, cor: '#ef4444' },
        ]
      },
      dados: boletos?.map((b: any) => ({
        cliente: b.clients?.name || 'N/D',
        valor: `R$ ${parseFloat(b.amount).toFixed(2)}`,
        vencimento: new Date(b.due_date).toLocaleDateString('pt-BR'),
        status: b.status === 'paid' ? 'Pago' : new Date(b.due_date) < new Date() ? 'Atrasado' : 'Pendente',
        pagamento: b.paid_at ? new Date(b.paid_at).toLocaleDateString('pt-BR') : '-',
      })),
      acoes: [
        { id: 'cobrar', label: 'Enviar Cobrancas', icone: 'mail', acao: 'enviar_cobrancas' },
        { id: 'pdf', label: 'Relatorio PDF', icone: 'doc', acao: 'gerar_relatorio_cobranca' },
        { id: 'evolucao', label: 'Evolucao 6 Meses', icone: 'chart', acao: 'analisar_cobranca_evolucao' },
      ],
      observacao: atrasados.length > 0
        ? `${atrasados.length} cliente(s) em atraso totalizando R$ ${totalAtrasado.toFixed(2)}`
        : 'Todos os boletos vencidos foram pagos!',
    };
  },

  analisar_cobranca_evolucao: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { meses = 6 } = params;
    const evolucao: any[] = [];

    for (let i = 0; i < meses; i++) {
      const data = new Date();
      data.setMonth(data.getMonth() - i);
      const comp = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

      const { data: boletos } = await supabase
        .from('invoices')
        .select('amount, status, paid_amount, due_date')
        .eq('competence', comp);

      const gerado = boletos?.reduce((s: number, b: any) => s + parseFloat(b.amount), 0) || 0;
      const recebido = boletos?.filter((b: any) => b.status === 'paid')
        .reduce((s: number, b: any) => s + parseFloat(b.paid_amount || b.amount), 0) || 0;
      const pendente = boletos?.filter((b: any) => b.status === 'pending')
        .reduce((s: number, b: any) => s + parseFloat(b.amount), 0) || 0;

      evolucao.push({ comp, gerado, recebido, pendente, pct: gerado > 0 ? (recebido/gerado*100) : 0 });
    }

    const mediaRecebimento = evolucao.reduce((s, e) => s + e.pct, 0) / evolucao.length;

    return {
      tipo: 'grafico',
      titulo: `Evolucao de Cobranca - ${meses} Meses`,
      resumo: {
        itens: [
          { label: 'Taxa Media Recebimento', valor: `${mediaRecebimento.toFixed(1)}%`, icone: 'chart' },
          { label: 'Total Gerado', valor: `R$ ${evolucao.reduce((s, e) => s + e.gerado, 0).toFixed(2)}`, icone: 'doc' },
          { label: 'Total Recebido', valor: `R$ ${evolucao.reduce((s, e) => s + e.recebido, 0).toFixed(2)}`, icone: 'check' },
        ]
      },
      grafico: {
        tipo: 'line',
        series: evolucao.reverse().map(e => ({
          mes: e.comp,
          Gerado: e.gerado,
          Recebido: e.recebido,
          Pendente: e.pendente,
        })),
      },
      dados: evolucao.map(e => ({
        competencia: e.comp,
        gerado: `R$ ${e.gerado.toFixed(2)}`,
        recebido: `R$ ${e.recebido.toFixed(2)}`,
        pendente: `R$ ${e.pendente.toFixed(2)}`,
        percentualRecebido: `${e.pct.toFixed(1)}%`,
      })),
    };
  },

  // ==========================================
  // DRE COM ANÁLISE VERTICAL E HORIZONTAL
  // ==========================================

  gerar_dre: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { periodo = 'mes', dataInicio, dataFim } = params;

    const hoje = new Date();
    let inicio: string, fim: string;

    if (dataInicio && dataFim) {
      inicio = dataInicio;
      fim = dataFim;
    } else if (periodo === 'mes') {
      inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
      fim = hoje.toISOString().split('T')[0];
    } else {
      inicio = `${hoje.getFullYear()}-01-01`;
      fim = hoje.toISOString().split('T')[0];
    }

    // RECEITAS
    const { data: receitas } = await supabase.rpc('buscar_receitas_periodo', { p_inicio: inicio, p_fim: fim });
    const totalReceitas = receitas?.reduce((s: number, r: any) => s + parseFloat(r.valor), 0) || 0;

    // DESPESAS por categoria
    const { data: despesas } = await supabase.rpc('buscar_despesas_periodo', { p_inicio: inicio, p_fim: fim });

    // Agrupar despesas
    const despesasPorGrupo: Record<string, { nome: string; valor: number; contas: any[] }> = {};
    let totalDespesas = 0;

    for (const d of despesas || []) {
      const grupo = d.codigo.substring(0, 3); // Ex: 4.1, 4.2
      if (!despesasPorGrupo[grupo]) {
        despesasPorGrupo[grupo] = { nome: getNomeGrupo(grupo), valor: 0, contas: [] };
      }
      despesasPorGrupo[grupo].valor += parseFloat(d.valor);
      despesasPorGrupo[grupo].contas.push(d);
      totalDespesas += parseFloat(d.valor);
    }

    const lucro = totalReceitas - totalDespesas;
    const margemLucro = totalReceitas > 0 ? (lucro / totalReceitas * 100) : 0;

    // Montar linhas do DRE
    const linhasDRE: any[] = [];

    // Receitas
    linhasDRE.push({ tipo: 'titulo', descricao: 'RECEITA OPERACIONAL BRUTA' });
    for (const r of receitas || []) {
      const av = totalReceitas > 0 ? (parseFloat(r.valor) / totalReceitas * 100) : 0;
      linhasDRE.push({
        tipo: 'receita',
        conta: r.codigo,
        descricao: r.nome,
        valor: parseFloat(r.valor),
        av,
      });
    }
    linhasDRE.push({ tipo: 'subtotal', descricao: 'TOTAL RECEITAS', valor: totalReceitas, av: 100 });

    // Despesas
    linhasDRE.push({ tipo: 'titulo', descricao: 'DESPESAS OPERACIONAIS' });
    for (const [grupo, dados] of Object.entries(despesasPorGrupo).sort()) {
      const avGrupo = totalReceitas > 0 ? (dados.valor / totalReceitas * 100) : 0;
      linhasDRE.push({
        tipo: 'grupo_despesa',
        descricao: dados.nome,
        valor: dados.valor,
        av: avGrupo,
      });

      // Detalhamento do grupo
      for (const conta of dados.contas.sort((a: any, b: any) => parseFloat(b.valor) - parseFloat(a.valor)).slice(0, 5)) {
        const avConta = totalReceitas > 0 ? (parseFloat(conta.valor) / totalReceitas * 100) : 0;
        linhasDRE.push({
          tipo: 'despesa',
          conta: conta.codigo,
          descricao: `  ${conta.nome}`,
          valor: parseFloat(conta.valor),
          av: avConta,
        });
      }
    }

    linhasDRE.push({ tipo: 'subtotal', descricao: 'TOTAL DESPESAS', valor: totalDespesas, av: totalReceitas > 0 ? (totalDespesas / totalReceitas * 100) : 0 });

    // Resultado
    linhasDRE.push({ tipo: 'titulo', descricao: '---' });
    linhasDRE.push({
      tipo: 'resultado',
      descricao: lucro >= 0 ? 'LUCRO LIQUIDO' : 'PREJUIZO',
      valor: lucro,
      av: margemLucro
    });

    return {
      tipo: 'dre',
      titulo: 'DRE - Demonstracao do Resultado',
      subtitulo: `Periodo: ${inicio} a ${fim} | Analise Vertical (AV%)`,
      resumo: {
        itens: [
          { label: 'Receita', valor: `R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icone: 'money', percentual: '100%' },
          { label: 'Despesas', valor: `R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icone: 'expense', percentual: `${(totalDespesas/totalReceitas*100).toFixed(1)}%` },
          { label: 'Resultado', valor: `R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icone: lucro >= 0 ? 'up' : 'down', percentual: `${margemLucro.toFixed(1)}%` },
          { label: 'Margem', valor: `${margemLucro.toFixed(1)}%`, icone: margemLucro >= 20 ? 'green' : margemLucro >= 10 ? 'yellow' : 'red' },
        ]
      },
      dados: linhasDRE.map(l => {
        if (l.tipo === 'titulo') return { descricao: l.descricao, valor: '', av: '', barra: '' };
        const barra = l.av > 0 ? '|'.repeat(Math.min(Math.round(l.av / 3), 25)) : '';
        return {
          descricao: l.descricao,
          valor: `R$ ${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          av: `${l.av.toFixed(1)}%`,
          barra,
        };
      }),
      grafico: {
        tipo: 'pizza_despesas',
        series: Object.entries(despesasPorGrupo)
          .map(([grupo, dados]) => ({
            name: dados.nome,
            value: dados.valor,
            pct: totalReceitas > 0 ? (dados.valor / totalReceitas * 100).toFixed(1) : '0',
          }))
          .sort((a, b) => b.value - a.value),
      },
      acoes: [
        { id: 'pdf', label: 'Exportar PDF', icone: 'doc', acao: 'exportar_dre_pdf' },
        { id: 'detalhar', label: 'Ver Detalhes', icone: 'search', acao: 'detalhar_dre' },
        { id: 'comparar', label: 'Comparar Periodos', icone: 'chart', acao: 'comparar_dre' },
      ],
      observacao: `Margem liquida: ${margemLucro.toFixed(1)}% | ${margemLucro >= 15 ? 'Saudavel' : margemLucro >= 5 ? 'Atencao' : 'Critico'}`,
    };
  },

  // ==========================================
  // ANÁLISE CLIENTES VS DESPESAS
  // ==========================================

  analisar_rentabilidade_clientes: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { dataInicio, dataFim } = params;
    const inicio = dataInicio || `${new Date().getFullYear()}-01-01`;
    const fim = dataFim || new Date().toISOString().split('T')[0];

    // Receita por cliente
    const { data: receitaClientes } = await supabase.rpc('buscar_receita_por_cliente', { p_inicio: inicio, p_fim: fim });

    // Total de despesas
    const { data: totalDesp } = await supabase.rpc('buscar_total_despesas', { p_inicio: inicio, p_fim: fim });
    const totalDespesas = totalDesp?.[0]?.total || 0;

    const totalReceita = receitaClientes?.reduce((s: number, c: any) => s + parseFloat(c.receita), 0) || 0;
    const qtdClientes = receitaClientes?.length || 1;
    const custoMedioCliente = totalDespesas / qtdClientes;

    const analise = receitaClientes?.map((c: any) => {
      const receita = parseFloat(c.receita);
      const lucro = receita - custoMedioCliente;
      const margem = (lucro / receita * 100);
      const representatividade = (receita / totalReceita * 100);

      return {
        clienteId: c.cliente_id,
        cliente: c.cliente_nome,
        receita,
        custoAlocado: custoMedioCliente,
        lucro,
        margem,
        representatividade,
        status: margem >= 30 ? 'Rentavel' : margem >= 10 ? 'Marginal' : 'Deficitario',
      };
    }).sort((a: any, b: any) => b.receita - a.receita) || [];

    const lucroTotal = totalReceita - totalDespesas;
    const rentaveis = analise.filter((a: any) => a.margem >= 15).length;

    return {
      tipo: 'tabela',
      titulo: 'Rentabilidade por Cliente',
      subtitulo: `${inicio} a ${fim}`,
      resumo: {
        itens: [
          { label: 'Receita Total', valor: `R$ ${totalReceita.toFixed(2)}`, icone: 'money' },
          { label: 'Despesas', valor: `R$ ${totalDespesas.toFixed(2)}`, icone: 'expense' },
          { label: 'Lucro', valor: `R$ ${lucroTotal.toFixed(2)}`, icone: lucroTotal >= 0 ? 'up' : 'down' },
          { label: 'Rentaveis', valor: `${rentaveis}/${qtdClientes}`, icone: 'users', percentual: `${(rentaveis/qtdClientes*100).toFixed(0)}%` },
        ]
      },
      dados: analise.slice(0, 25).map((a: any) => ({
        cliente: a.cliente?.substring(0, 25) || 'N/D',
        receita: `R$ ${a.receita.toFixed(2)}`,
        percentReceita: `${a.representatividade.toFixed(1)}%`,
        custoAlocado: `R$ ${a.custoAlocado.toFixed(2)}`,
        lucro: `R$ ${a.lucro.toFixed(2)}`,
        margem: `${a.margem.toFixed(1)}%`,
        status: a.status,
      })),
      grafico: {
        tipo: 'bar_horizontal',
        series: analise.slice(0, 10).map((a: any) => ({
          name: a.cliente?.substring(0, 15) || 'N/D',
          receita: a.receita,
          lucro: a.lucro,
        })),
      },
      observacao: `Custo medio/cliente: R$ ${custoMedioCliente.toFixed(2)} | ${rentaveis} de ${qtdClientes} clientes sao rentaveis (>15% margem)`,
    };
  },

  // ==========================================
  // AÇÕES - CRIAR LANÇAMENTO PELO CHAT
  // ==========================================

  criar_lancamento: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { data, descricao, contaDebito, contaCredito, valor, confirmado } = params;

    if (!confirmado) {
      // Preview antes de confirmar
      const { data: contaD } = await supabase.from('chart_of_accounts').select('name').eq('code', contaDebito).single();
      const { data: contaC } = await supabase.from('chart_of_accounts').select('name').eq('code', contaCredito).single();

      return {
        tipo: 'confirmacao',
        titulo: 'Confirmar Lancamento',
        dados: [
          { campo: 'Data', valor: data },
          { campo: 'Descricao', valor: descricao },
          { campo: 'Debito', valor: `${contaDebito} - ${contaD?.name || 'N/D'}` },
          { campo: 'Credito', valor: `${contaCredito} - ${contaC?.name || 'N/D'}` },
          { campo: 'Valor', valor: `R$ ${parseFloat(valor).toFixed(2)}` },
        ],
        requerConfirmacao: true,
        dadosConfirmacao: params,
        acoes: [
          { id: 'confirmar', label: 'Confirmar', icone: 'check', acao: 'criar_lancamento', confirmacao: true },
          { id: 'cancelar', label: 'Cancelar', icone: 'close', acao: 'cancelar' },
        ],
        alerta: { tipo: 'info', mensagem: 'Revise os dados antes de confirmar' },
      };
    }

    try {
      // Buscar IDs das contas
      const { data: contaD } = await supabase.from('chart_of_accounts').select('id, is_analytical').eq('code', contaDebito).single();
      const { data: contaC } = await supabase.from('chart_of_accounts').select('id, is_analytical').eq('code', contaCredito).single();

      if (!contaD || !contaC) {
        throw new Error('Conta nao encontrada');
      }

      // Validar NBC TG 26 - só aceita contas analíticas
      if (!contaD.is_analytical || !contaC.is_analytical) {
        throw new Error('Lancamentos so podem ser feitos em contas analiticas (NBC TG 26)');
      }

      // Criar entry
      const { data: entry, error } = await supabase
        .from('accounting_entries')
        .insert({
          entry_date: data,
          description: descricao,
          entry_type: 'manual',
          source_type: 'chat_contabil',
          status: 'posted',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Criar linhas
      await supabase.from('accounting_entry_lines').insert([
        { entry_id: entry.id, account_id: contaD.id, debit: parseFloat(valor), credit: 0, description: descricao },
        { entry_id: entry.id, account_id: contaC.id, debit: 0, credit: parseFloat(valor), description: descricao },
      ]);

      return {
        tipo: 'card',
        titulo: 'Lancamento Criado!',
        resumo: { itens: [
          { label: 'ID', valor: entry.id.substring(0, 8), icone: 'hash' },
          { label: 'Valor', valor: `R$ ${parseFloat(valor).toFixed(2)}`, icone: 'money' },
        ]},
        alerta: { tipo: 'success', mensagem: 'Lancamento contabilizado com sucesso!' },
      };
    } catch (error: any) {
      return {
        tipo: 'card',
        titulo: 'Erro',
        alerta: { tipo: 'error', mensagem: error.message },
      };
    }
  },

  // ==========================================
  // AÇÕES - CRIAR CONTA CONTÁBIL
  // ==========================================

  criar_conta: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { codigo, nome, tipo, natureza, confirmado } = params;

    if (!confirmado) {
      return {
        tipo: 'confirmacao',
        titulo: 'Criar Conta Contabil',
        dados: [
          { campo: 'Codigo', valor: codigo },
          { campo: 'Nome', valor: nome },
          { campo: 'Tipo', valor: tipo },
          { campo: 'Natureza', valor: natureza },
        ],
        requerConfirmacao: true,
        dadosConfirmacao: params,
        acoes: [
          { id: 'confirmar', label: 'Criar', icone: 'check', acao: 'criar_conta', confirmacao: true },
          { id: 'cancelar', label: 'Cancelar', icone: 'close', acao: 'cancelar' },
        ],
      };
    }

    try {
      // Verificar duplicidade
      const { data: existe } = await supabase.from('chart_of_accounts').select('id').eq('code', codigo).single();
      if (existe) {
        return { tipo: 'card', titulo: 'Conta ja existe', alerta: { tipo: 'warning', mensagem: `Codigo ${codigo} ja cadastrado` }};
      }

      // Buscar parent
      const parentCode = codigo.split('.').slice(0, -1).join('.');
      const { data: parent } = await supabase.from('chart_of_accounts').select('id').eq('code', parentCode).single();

      await supabase.from('chart_of_accounts').insert({
        code: codigo,
        name: nome,
        account_type: tipo,
        nature: natureza,
        parent_id: parent?.id,
        level: codigo.split('.').length,
        is_analytical: true,
        is_synthetic: false,
        is_active: true,
        accepts_entries: true,
      });

      return {
        tipo: 'card',
        titulo: 'Conta Criada!',
        resumo: { itens: [
          { label: 'Codigo', valor: codigo, icone: 'hash' },
          { label: 'Nome', valor: nome, icone: 'text' },
        ]},
        alerta: { tipo: 'success', mensagem: 'Conta criada e ativa!' },
      };
    } catch (error: any) {
      return { tipo: 'card', titulo: 'Erro', alerta: { tipo: 'error', mensagem: error.message }};
    }
  },

  // ==========================================
  // DASHBOARD FINANCEIRO (do v1)
  // ==========================================

  dashboard_financeiro: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { data: dashboard } = await supabase.rpc('dashboard_financeiro');
    const d = dashboard?.[0] || {};

    return {
      tipo: 'card',
      titulo: 'Dashboard Financeiro',
      resumo: {
        itens: [
          { label: 'Receitas', valor: `R$ ${parseFloat(d.receitas || 0).toFixed(2)}`, icone: 'money' },
          { label: 'Despesas', valor: `R$ ${parseFloat(d.despesas || 0).toFixed(2)}`, icone: 'expense' },
          { label: 'Lucro', valor: `R$ ${parseFloat(d.lucro || 0).toFixed(2)}`, icone: d.lucro >= 0 ? 'up' : 'down' },
          { label: 'Saldo Bancos', valor: `R$ ${parseFloat(d.saldo_bancos || 0).toFixed(2)}`, icone: 'bank' },
          { label: 'A Receber', valor: `R$ ${parseFloat(d.a_receber || 0).toFixed(2)}`, icone: 'receive' },
          { label: 'A Pagar', valor: `R$ ${parseFloat(d.a_pagar || 0).toFixed(2)}`, icone: 'pay' },
          { label: 'Inadimplentes', valor: d.clientes_inadimplentes || 0, icone: 'alert' },
          { label: 'Total Inadimpl.', valor: `R$ ${parseFloat(d.total_inadimplencia || 0).toFixed(2)}`, icone: 'warning' },
        ]
      },
    };
  },

  // ==========================================
  // BUSCAR SALDOS BANCOS (do v1)
  // ==========================================

  buscar_saldos_bancos: async (supabase: any, _params: any): Promise<RespostaVisual> => {
    const { data: bancos } = await supabase.rpc('buscar_saldos_bancos');

    const totalSaldo = bancos?.reduce((s: number, b: any) => s + parseFloat(b.saldo), 0) || 0;

    return {
      tipo: 'tabela',
      titulo: 'Saldos Bancarios',
      resumo: {
        itens: [
          { label: 'Total em Bancos', valor: `R$ ${totalSaldo.toFixed(2)}`, icone: 'bank' },
          { label: 'Contas', valor: bancos?.length || 0, icone: 'list' },
        ]
      },
      dados: bancos?.map((b: any) => ({
        banco: b.banco_nome,
        codigo: b.banco_codigo,
        saldo: `R$ ${parseFloat(b.saldo).toFixed(2)}`,
        ultimaMovimentacao: b.ultima_movimentacao ? new Date(b.ultima_movimentacao).toLocaleDateString('pt-BR') : '-',
      })),
    };
  },

  // ==========================================
  // BUSCAR CLIENTES INADIMPLENTES (do v1)
  // ==========================================

  buscar_clientes_inadimplentes: async (supabase: any, params: any): Promise<RespostaVisual> => {
    const { diasMinimo = 1 } = params;
    const { data: inadimplentes } = await supabase.rpc('buscar_clientes_inadimplentes', { p_dias_minimo: diasMinimo });

    const totalDevedor = inadimplentes?.reduce((s: number, c: any) => s + parseFloat(c.saldo_devedor), 0) || 0;

    return {
      tipo: 'tabela',
      titulo: 'Clientes Inadimplentes',
      subtitulo: `Com mais de ${diasMinimo} dia(s) de atraso`,
      resumo: {
        itens: [
          { label: 'Total Devedor', valor: `R$ ${totalDevedor.toFixed(2)}`, icone: 'alert' },
          { label: 'Clientes', valor: inadimplentes?.length || 0, icone: 'users' },
        ]
      },
      dados: inadimplentes?.map((c: any) => ({
        cliente: c.nome,
        cnpj: c.cnpj || '-',
        saldo: `R$ ${parseFloat(c.saldo_devedor).toFixed(2)}`,
        diasAtraso: c.dias_atraso,
        ultimaCobranca: c.ultima_cobranca ? new Date(c.ultima_cobranca).toLocaleDateString('pt-BR') : '-',
        telefone: c.telefone || '-',
      })),
      acoes: [
        { id: 'cobrar', label: 'Enviar Cobranca', icone: 'mail', acao: 'enviar_cobrancas' },
      ],
    };
  },

};

// ============================================
// HELPERS
// ============================================

function getNomeGrupo(codigo: string): string {
  const grupos: Record<string, string> = {
    '4.1': 'Despesas Operacionais',
    '4.2': 'Despesas com Pessoal',
    '4.3': 'Despesas Financeiras',
    '4.4': 'Impostos e Taxas',
    '4.9': 'Outras Despesas',
    '3.1': 'Receitas Operacionais',
    '3.2': 'Outras Receitas',
  };
  return grupos[codigo] || codigo;
}

// ============================================
// HANDLER
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

    const { ferramenta, params } = await req.json();

    if (!FERRAMENTAS[ferramenta as keyof typeof FERRAMENTAS]) {
      return new Response(
        JSON.stringify({ erro: 'Ferramenta nao encontrada', disponiveis: Object.keys(FERRAMENTAS) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const resultado = await FERRAMENTAS[ferramenta as keyof typeof FERRAMENTAS](supabase, params || {});

    return new Response(
      JSON.stringify({ ferramenta, resultado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
