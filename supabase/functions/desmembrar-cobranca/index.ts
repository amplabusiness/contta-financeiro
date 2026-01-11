/**
 * Edge Function: desmembrar-cobranca
 *
 * Desmembra cobranças agrupadas (COBxxxx) para as contas analíticas dos clientes.
 * Estorna a conta transitória 1.1.9.01 e credita cada cliente individualmente.
 *
 * Fluxo:
 * 1. Recebe arquivo de retorno Sicredi OU lista de clientes/valores
 * 2. Para cada cobrança agrupada:
 *    - Verifica se já foi desmembrada (idempotência)
 *    - Cria lançamento: D-Transitória / C-Clientes (múltiplos)
 * 3. Ao final, conta transitória deve ter saldo R$ 0,00
 *
 * @author Dr. Cícero (IA) + Ampla Contabilidade
 * @version 2.0
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Conta transitória
const CONTA_TRANSITORIA = '1.1.9.01';

interface ClienteBoleto {
  clienteId?: string;
  clienteNome: string;
  valor: number;
  numeroBoleto?: string;
  contaCode?: string; // Se já souber a conta analítica
}

interface CobrancaAgrupada {
  cobrancaId: string;  // COB000xxx
  dataLiquidacao: string;
  valorTotal: number;
  clientes: ClienteBoleto[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action } = body;

    console.log('[desmembrar-cobranca] Action:', action);

    // AÇÃO: Desmembrar uma cobrança específica
    if (action === 'desmembrar') {
      const { cobranca }: { cobranca: CobrancaAgrupada } = body;
      const resultado = await desmembrarCobranca(supabase, cobranca);
      return new Response(JSON.stringify(resultado), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Processar arquivo de retorno do Sicredi
    if (action === 'processar_arquivo_retorno') {
      const { arquivoConteudo, data } = body;
      const cobrancas = parseArquivoRetorno(arquivoConteudo, data);

      const resultados = [];
      for (const cobranca of cobrancas) {
        try {
          const resultado = await desmembrarCobranca(supabase, cobranca);
          resultados.push(resultado);
        } catch (err: any) {
          resultados.push({
            cobrancaId: cobranca.cobrancaId,
            sucesso: false,
            erro: err.message
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        cobrancasProcessadas: resultados.filter(r => r.sucesso).length,
        erros: resultados.filter(r => !r.sucesso).length,
        resultados
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Verificar saldo da transitória
    if (action === 'verificar_transitoria') {
      const saldo = await verificarSaldoTransitoria(supabase);
      return new Response(JSON.stringify({
        success: true,
        contaTransitoria: CONTA_TRANSITORIA,
        saldo,
        status: Math.abs(saldo) < 0.01 ? 'ZERADA' : 'PENDENTE_CONCILIACAO'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Listar cobranças pendentes de desmembramento
    if (action === 'listar_pendentes') {
      const pendentes = await listarCobrancasPendentes(supabase);
      return new Response(JSON.stringify({
        success: true,
        pendentes
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Ação não reconhecida',
      actions: ['desmembrar', 'processar_arquivo_retorno', 'verificar_transitoria', 'listar_pendentes']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[desmembrar-cobranca] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Desmembra uma cobrança agrupada para os clientes individuais
 */
async function desmembrarCobranca(supabase: any, cobranca: CobrancaAgrupada): Promise<any> {
  const { cobrancaId, dataLiquidacao, valorTotal, clientes } = cobranca;

  console.log(`[desmembrar-cobranca] Processando ${cobrancaId} com ${clientes.length} clientes`);

  // 1. Verificar idempotência
  const jaProcessada = await verificarSeJaDesmembrada(supabase, cobrancaId);
  if (jaProcessada) {
    return {
      cobrancaId,
      sucesso: true,
      mensagem: 'Cobrança já foi desmembrada anteriormente',
      jaExistia: true
    };
  }

  // 2. Validar que a soma dos clientes = valor total
  const somaClientes = clientes.reduce((s, c) => s + c.valor, 0);
  if (Math.abs(somaClientes - valorTotal) > 0.01) {
    throw new Error(`Soma dos clientes (${somaClientes}) diferente do valor total (${valorTotal})`);
  }

  // 3. Buscar ID da conta transitória
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', CONTA_TRANSITORIA)
    .single();

  if (!contaTransitoria) {
    throw new Error(`Conta transitória ${CONTA_TRANSITORIA} não encontrada`);
  }

  // 4. Montar linhas do lançamento
  const linhas: Array<{ account_id: string; debit: number; credit: number }> = [];

  // Linha 1: Débito na transitória (estorno)
  linhas.push({
    account_id: contaTransitoria.id,
    debit: valorTotal,
    credit: 0
  });

  // Linhas N: Crédito em cada cliente
  for (const cliente of clientes) {
    const contaCliente = await buscarOuCriarContaCliente(supabase, cliente);
    linhas.push({
      account_id: contaCliente.id,
      debit: 0,
      credit: cliente.valor
    });
  }

  // 5. Criar entry principal
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_type: 'desmembramento',
      entry_date: dataLiquidacao,
      description: `Desmembramento ${cobrancaId} - ${clientes.length} clientes`,
      reference_type: 'cobranca_desmembramento',
      reference_id: cobrancaId,
      source_type: 'super_conciliacao',
      source_module: 'desmembrar-cobranca',
      origin_context: `desmembramento_${cobrancaId}`,
      metadata: {
        cobrancaId,
        totalClientes: clientes.length,
        valorTotal,
        clientes: clientes.map(c => ({
          nome: c.clienteNome,
          valor: c.valor,
          contaCode: c.contaCode
        }))
      }
    })
    .select('id')
    .single();

  if (entryError) {
    throw new Error(`Erro ao criar entry: ${entryError.message}`);
  }

  // 6. Criar linhas do lançamento
  const linhasComEntryId = linhas.map(l => ({
    ...l,
    entry_id: entry.id
  }));

  const { error: linhasError } = await supabase
    .from('accounting_entry_lines')
    .insert(linhasComEntryId);

  if (linhasError) {
    // Rollback
    await supabase.from('accounting_entries').delete().eq('id', entry.id);
    throw new Error(`Erro ao criar linhas: ${linhasError.message}`);
  }

  console.log(`[desmembrar-cobranca] ${cobrancaId} desmembrada com sucesso`);

  return {
    cobrancaId,
    sucesso: true,
    entryId: entry.id,
    totalClientes: clientes.length,
    valorTotal,
    mensagem: `Desmembramento concluído: ${clientes.length} clientes baixados`
  };
}

/**
 * Verifica se a cobrança já foi desmembrada
 */
async function verificarSeJaDesmembrada(supabase: any, cobrancaId: string): Promise<boolean> {
  const { data } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('reference_type', 'cobranca_desmembramento')
    .eq('reference_id', cobrancaId)
    .maybeSingle();

  return !!data;
}

/**
 * Busca ou cria conta analítica para o cliente
 */
async function buscarOuCriarContaCliente(supabase: any, cliente: ClienteBoleto): Promise<{ id: string; code: string }> {
  // Se já tem contaCode, buscar pelo código
  if (cliente.contaCode) {
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id, code')
      .eq('code', cliente.contaCode)
      .single();

    if (conta) return conta;
  }

  // Buscar por nome do cliente
  const { data: contaExistente } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .ilike('name', `%${cliente.clienteNome.substring(0, 30)}%`)
    .like('code', '1.1.2.01.%')
    .maybeSingle();

  if (contaExistente) return contaExistente;

  // Criar nova conta analítica
  // Buscar próximo código disponível
  const { data: ultimaConta } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .like('code', '1.1.2.01.%')
    .order('code', { ascending: false })
    .limit(1)
    .single();

  let proximoNumero = 1;
  if (ultimaConta) {
    const partes = ultimaConta.code.split('.');
    proximoNumero = parseInt(partes[partes.length - 1]) + 1;
  }

  const novoCodigo = `1.1.2.01.${String(proximoNumero).padStart(4, '0')}`;

  // Buscar ID do pai (1.1.2.01)
  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  // Criar conta
  const { data: novaConta, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code: novoCodigo,
      name: `Cliente: ${cliente.clienteNome.substring(0, 50)}`,
      account_type: 'ATIVO',
      nature: 'DEVEDORA',
      level: 5,
      is_analytical: true,
      is_synthetic: false,
      accepts_entries: true,
      parent_id: contaPai?.id
    })
    .select('id, code')
    .single();

  if (error) {
    throw new Error(`Erro ao criar conta para ${cliente.clienteNome}: ${error.message}`);
  }

  console.log(`[desmembrar-cobranca] Criada conta ${novoCodigo} para ${cliente.clienteNome}`);
  return novaConta;
}

/**
 * Verifica saldo atual da conta transitória
 */
async function verificarSaldoTransitoria(supabase: any): Promise<number> {
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', CONTA_TRANSITORIA)
    .single();

  if (!conta) return 0;

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta.id);

  const saldo = (linhas || []).reduce(
    (acc: number, l: any) => acc + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0),
    0
  );

  return saldo;
}

/**
 * Lista cobranças que ainda não foram desmembradas
 */
async function listarCobrancasPendentes(supabase: any): Promise<any[]> {
  // Buscar entries que são cobranças agrupadas na transitória
  const { data: cobrancas } = await supabase
    .from('accounting_entries')
    .select('id, reference_id, entry_date, description, metadata')
    .eq('reference_type', 'bank_transaction')
    .ilike('description', '%COB%')
    .order('entry_date', { ascending: false });

  if (!cobrancas) return [];

  // Filtrar apenas as que não foram desmembradas
  const pendentes = [];
  for (const cob of cobrancas) {
    const cobrancaId = cob.reference_id?.match(/COB\d+/i)?.[0];
    if (!cobrancaId) continue;

    const jaDesmembrada = await verificarSeJaDesmembrada(supabase, cobrancaId);
    if (!jaDesmembrada) {
      // Buscar valor
      const { data: linhas } = await supabase
        .from('accounting_entry_lines')
        .select('credit')
        .eq('entry_id', cob.id);

      const valor = (linhas || []).reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);

      pendentes.push({
        cobrancaId,
        data: cob.entry_date,
        valor,
        entryId: cob.id
      });
    }
  }

  return pendentes;
}

/**
 * Parse do arquivo de retorno do Sicredi (CSV)
 */
function parseArquivoRetorno(conteudo: string, dataFiltro?: string): CobrancaAgrupada[] {
  const linhas = conteudo.trim().split(/\r?\n/);
  const cobrancasMap = new Map<string, CobrancaAgrupada>();

  // Pular cabeçalho
  for (let i = 1; i < linhas.length; i++) {
    const partes = linhas[i].split(';').map(p => p.trim());
    if (partes.length < 7) continue;

    const [documento, numeroBoleto, pagador, dataVenc, dataLiq, valorBoleto, valorRecebido] = partes;

    // Filtrar por data se especificada
    if (dataFiltro && dataLiq !== dataFiltro) continue;

    const cobrancaId = documento?.toUpperCase().replace(/^C?OB/, 'COB') || 'COB_DESCONHECIDO';
    const valor = parseFloat(valorRecebido?.replace(/\./g, '').replace(',', '.')) || 0;

    if (!cobrancasMap.has(cobrancaId)) {
      cobrancasMap.set(cobrancaId, {
        cobrancaId,
        dataLiquidacao: dataLiq || new Date().toISOString().split('T')[0],
        valorTotal: 0,
        clientes: []
      });
    }

    const cobranca = cobrancasMap.get(cobrancaId)!;
    cobranca.valorTotal += valor;
    cobranca.clientes.push({
      clienteNome: pagador || 'Cliente',
      valor,
      numeroBoleto
    });
  }

  return Array.from(cobrancasMap.values());
}
