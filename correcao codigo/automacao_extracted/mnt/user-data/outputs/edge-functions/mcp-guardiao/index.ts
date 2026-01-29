// supabase/functions/mcp-guardiao/index.ts
// Edge Function que atua como GUARDIÃO do sistema contábil
// Valida TODAS as operações antes de permitir execução
// Ensina qualquer IA o fluxo correto

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TIPOS
// ============================================

interface LinhaLancamento {
  contaCode: string;
  contaId?: string;
  debito: number;
  credito: number;
  descricao?: string;
}

interface OperacaoContabil {
  tipo: string;
  linhas: LinhaLancamento[];
  referenceType: string;
  referenceId: string;
  descricao?: string;
  data?: string;
  metadata?: Record<string, any>;
}

interface ResultadoValidacao {
  valido: boolean;
  podeExecutar: boolean;
  erros: string[];
  avisos: string[];
  sugestoes: string[];
}

interface ResultadoExecucao {
  sucesso: boolean;
  entryId?: string;
  erro?: string;
  validacao: ResultadoValidacao;
}

// ============================================
// CONSTANTES - REGRAS DE NEGÓCIO
// ============================================

// Contas que NUNCA podem receber lançamentos diretos (sintéticas)
const CONTAS_BLOQUEADAS = [
  '1.1.2.01',       // Clientes a Receber (sintética)
  '1.1.2',          // Créditos (sintética)
  '1.1',            // Ativo Circulante (sintética)
  '1',              // Ativo (sintética)
  '2.1',            // Passivo Circulante (sintética)
  '3.1',            // Receitas Operacionais (sintética)
  '4.1',            // Despesas Operacionais (sintética)
];

// Padrões de descrição que indicam cobrança agrupada
const PADROES_COBRANCA_AGRUPADA = [
  /COB\d{6}/i,
  /COBRANCA/i,
  /LIQ\.COB/i,
];

// Conta transitória obrigatória para cobranças
const CONTA_TRANSITORIA = '1.1.9.01';

// ============================================
// REGRAS DE VALIDAÇÃO
// ============================================

async function validarOperacao(supabase: any, operacao: OperacaoContabil): Promise<ResultadoValidacao> {
  const erros: string[] = [];
  const avisos: string[] = [];
  const sugestoes: string[] = [];
  
  // ==========================================
  // REGRA 1: CONTA SINTÉTICA (BLOQUEIO TOTAL)
  // ==========================================
  for (const linha of operacao.linhas) {
    // Verificar lista de bloqueio direto
    if (CONTAS_BLOQUEADAS.includes(linha.contaCode)) {
      erros.push(
        `🚫 BLOQUEADO: Conta ${linha.contaCode} é SINTÉTICA e não aceita lançamentos. ` +
        `Use uma conta analítica (ex: ${linha.contaCode}.xxxx).`
      );
      sugestoes.push(
        `Para clientes, use contas como 1.1.2.01.0001, 1.1.2.01.0002, etc. ` +
        `Use a ferramenta 'criar_conta_cliente' se necessário.`
      );
    }
    
    // Verificar no banco de dados
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('code, name, is_synthetic, accepts_entries')
      .eq('code', linha.contaCode)
      .single();
    
    if (!conta) {
      erros.push(`❌ Conta ${linha.contaCode} não existe no plano de contas.`);
    } else {
      if (conta.is_synthetic) {
        erros.push(
          `🚫 BLOQUEADO: Conta ${linha.contaCode} (${conta.name}) é SINTÉTICA. ` +
          `NBC TG 26 proíbe lançamentos em contas sintéticas.`
        );
      }
      if (conta.accepts_entries === false) {
        erros.push(`🚫 BLOQUEADO: Conta ${linha.contaCode} está configurada para não aceitar lançamentos.`);
      }
    }
  }
  
  // ==========================================
  // REGRA 2: PARTIDAS DOBRADAS (OBRIGATÓRIO)
  // ==========================================
  const totalDebitos = operacao.linhas.reduce((s, l) => s + (l.debito || 0), 0);
  const totalCreditos = operacao.linhas.reduce((s, l) => s + (l.credito || 0), 0);
  
  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    erros.push(
      `🚫 BLOQUEADO: Lançamento desbalanceado! ` +
      `Débitos (R$ ${totalDebitos.toFixed(2)}) ≠ Créditos (R$ ${totalCreditos.toFixed(2)}). ` +
      `Diferença: R$ ${Math.abs(totalDebitos - totalCreditos).toFixed(2)}`
    );
  }
  
  if (operacao.linhas.length < 2) {
    erros.push(
      `🚫 BLOQUEADO: Lançamento com menos de 2 linhas. ` +
      `Partidas dobradas exigem mínimo 1 débito e 1 crédito.`
    );
  }
  
  // ==========================================
  // REGRA 3: IDEMPOTÊNCIA (EVITAR DUPLICAÇÃO)
  // ==========================================
  if (!operacao.referenceId) {
    avisos.push(
      `⚠️ AVISO: referenceId não informado. ` +
      `Sem esse campo, não há proteção contra duplicação.`
    );
  } else {
    const { count } = await supabase
      .from('accounting_entries')
      .select('id', { count: 'exact' })
      .eq('reference_id', operacao.referenceId)
      .eq('reference_type', operacao.referenceType || 'unknown');
    
    if ((count || 0) > 0) {
      erros.push(
        `🚫 BLOQUEADO: Já existe lançamento com ` +
        `referenceType='${operacao.referenceType}' e referenceId='${operacao.referenceId}'. ` +
        `Operação duplicada não permitida.`
      );
    }
  }
  
  // ==========================================
  // REGRA 4: COBRANÇA AGRUPADA → TRANSITÓRIA
  // ==========================================
  const descricaoCompleta = [
    operacao.descricao || '',
    ...operacao.linhas.map(l => l.descricao || ''),
  ].join(' ');
  
  const isCobrancaAgrupada = PADROES_COBRANCA_AGRUPADA.some(p => p.test(descricaoCompleta));
  
  if (isCobrancaAgrupada && operacao.tipo !== 'cobranca_desmembramento') {
    const usaTransitoria = operacao.linhas.some(l => l.contaCode === CONTA_TRANSITORIA);
    
    if (!usaTransitoria) {
      erros.push(
        `🚫 BLOQUEADO: Cobrança agrupada detectada mas não está usando conta transitória. ` +
        `Cobranças agrupadas DEVEM creditar a conta ${CONTA_TRANSITORIA} primeiro. ` +
        `O desmembramento por cliente é feito depois.`
      );
      sugestoes.push(
        `Fluxo correto: ` +
        `1) OFX → D-Banco C-Transitória | ` +
        `2) Desmembramento → D-Transitória C-Clientes`
      );
    }
  }
  
  // ==========================================
  // REGRA 5: VALIDAÇÕES ADICIONAIS
  // ==========================================
  
  // Verificar se há linha só com débito ou só com crédito zerado (ok, mas avisar)
  const linhasZeradas = operacao.linhas.filter(l => l.debito === 0 && l.credito === 0);
  if (linhasZeradas.length > 0) {
    avisos.push(`⚠️ ${linhasZeradas.length} linha(s) com débito e crédito zerados.`);
  }
  
  // Verificar valores negativos
  const valoresNegativos = operacao.linhas.some(l => l.debito < 0 || l.credito < 0);
  if (valoresNegativos) {
    erros.push(`🚫 BLOQUEADO: Valores negativos não são permitidos. Use a natureza correta (débito/crédito).`);
  }
  
  return {
    valido: erros.length === 0,
    podeExecutar: erros.length === 0,
    erros,
    avisos,
    sugestoes,
  };
}

// ============================================
// EXECUÇÃO DO LANÇAMENTO
// ============================================

async function executarLancamento(supabase: any, operacao: OperacaoContabil): Promise<ResultadoExecucao> {
  // Primeiro, validar
  const validacao = await validarOperacao(supabase, operacao);
  
  if (!validacao.podeExecutar) {
    return {
      sucesso: false,
      erro: validacao.erros.join(' | '),
      validacao,
    };
  }
  
  try {
    // Buscar IDs das contas
    const linhasComIds = await Promise.all(
      operacao.linhas.map(async (linha) => {
        const { data: conta } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('code', linha.contaCode)
          .single();
        
        return { ...linha, contaId: conta?.id };
      })
    );
    
    // Criar entry
    const { data: entry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: operacao.data || new Date().toISOString().split('T')[0],
        entry_type: operacao.tipo,
        description: operacao.descricao || `Lançamento ${operacao.tipo}`,
        reference_type: operacao.referenceType,
        reference_id: operacao.referenceId,
        source_type: 'mcp_guardiao',
        status: 'posted',
        metadata: operacao.metadata,
      })
      .select('id')
      .single();
    
    if (entryError) throw entryError;
    
    // Criar linhas
    const linhasParaInserir = linhasComIds.map((linha) => ({
      entry_id: entry.id,
      account_id: linha.contaId,
      debit: linha.debito,
      credit: linha.credito,
      description: linha.descricao || operacao.descricao,
    }));
    
    const { error: linhasError } = await supabase
      .from('accounting_entry_lines')
      .insert(linhasParaInserir);
    
    if (linhasError) throw linhasError;
    
    return {
      sucesso: true,
      entryId: entry.id,
      validacao,
    };
    
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
      validacao,
    };
  }
}

// ============================================
// FERRAMENTAS EXPOSTAS (MCP TOOLS)
// ============================================

const FERRAMENTAS = {
  // Validar operação sem executar
  validar_lancamento: async (supabase: any, params: any) => {
    return await validarOperacao(supabase, params);
  },
  
  // Criar lançamento (com validação)
  criar_lancamento: async (supabase: any, params: any) => {
    return await executarLancamento(supabase, params);
  },
  
  // Verificar equação contábil
  verificar_equacao_contabil: async (supabase: any) => {
    const { data } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit');
    
    const totalDebitos = data.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
    const totalCreditos = data.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);
    const diferenca = Math.abs(totalDebitos - totalCreditos);
    
    return {
      totalDebitos,
      totalCreditos,
      diferenca,
      balanceada: diferenca < 0.01,
      status: diferenca < 0.01 ? '✅ BALANCEADA' : '❌ DESBALANCEADA',
    };
  },
  
  // Verificar saldo da transitória
  verificar_saldo_transitoria: async (supabase: any) => {
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', CONTA_TRANSITORIA)
      .single();
    
    if (!conta) {
      return { erro: 'Conta transitória não encontrada', saldo: null };
    }
    
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);
    
    const saldo = (linhas || []).reduce(
      (s: number, l: any) => s + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0),
      0
    );
    
    return {
      contaCode: CONTA_TRANSITORIA,
      saldo,
      status: Math.abs(saldo) < 0.01 ? '✅ ZERADA' : '⚠️ PENDENTE',
      mensagem: Math.abs(saldo) < 0.01
        ? 'Todas as conciliações foram feitas'
        : `R$ ${saldo.toFixed(2)} pendentes de desmembramento`,
    };
  },
  
  // Diagnóstico completo
  diagnostico_completo: async (supabase: any) => {
    // Equação
    const equacao = await FERRAMENTAS.verificar_equacao_contabil(supabase);
    
    // Transitória
    const transitoria = await FERRAMENTAS.verificar_saldo_transitoria(supabase);
    
    // Lançamentos na sintética
    const { count: sintetica } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact' })
      .in('account_id', 
        supabase.from('chart_of_accounts').select('id').eq('code', '1.1.2.01')
      );
    
    // Linhas órfãs
    const { data: entries } = await supabase.from('accounting_entries').select('id');
    const { data: linhas } = await supabase.from('accounting_entry_lines').select('entry_id');
    
    const entryIds = new Set(entries.map((e: any) => e.id));
    const linhasOrfas = linhas.filter((l: any) => !entryIds.has(l.entry_id)).length;
    
    // Entries desbalanceados
    // (simplificado - em produção faria query mais eficiente)
    
    return {
      equacaoContabil: equacao,
      contaTransitoria: transitoria,
      lancamentosSintetica: sintetica || 0,
      linhasOrfas,
      status: equacao.balanceada && (sintetica || 0) === 0 && linhasOrfas === 0
        ? '✅ SISTEMA ÍNTEGRO'
        : '⚠️ PROBLEMAS DETECTADOS',
    };
  },
  
  // Listar regras do guardião (para ensinar outras IAs)
  listar_regras: async () => {
    return {
      regras: [
        {
          numero: 1,
          nome: 'CONTA_SINTETICA',
          descricao: 'Nunca lançar em contas sintéticas (1.1.2.01, etc)',
          acao: 'BLOQUEAR',
        },
        {
          numero: 2,
          nome: 'PARTIDAS_DOBRADAS',
          descricao: 'Débitos DEVEM ser iguais a Créditos',
          acao: 'BLOQUEAR',
        },
        {
          numero: 3,
          nome: 'IDEMPOTENCIA',
          descricao: 'Verificar duplicidade por reference_id antes de criar',
          acao: 'BLOQUEAR',
        },
        {
          numero: 4,
          nome: 'COBRANCA_TRANSITORIA',
          descricao: 'Cobranças agrupadas DEVEM ir para conta transitória primeiro',
          acao: 'BLOQUEAR',
        },
      ],
      contaTransitoria: CONTA_TRANSITORIA,
      contasBloqueadas: CONTAS_BLOQUEADAS,
      padroesCobranca: PADROES_COBRANCA_AGRUPADA.map(p => p.source),
    };
  },
};

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { ferramenta, params } = await req.json();
    
    // Verificar se ferramenta existe
    if (!FERRAMENTAS[ferramenta as keyof typeof FERRAMENTAS]) {
      return new Response(
        JSON.stringify({
          erro: `Ferramenta '${ferramenta}' não encontrada`,
          ferramentasDisponiveis: Object.keys(FERRAMENTAS),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Executar ferramenta
    const resultado = await FERRAMENTAS[ferramenta as keyof typeof FERRAMENTAS](supabase, params);
    
    return new Response(
      JSON.stringify({ ferramenta, resultado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
