// supabase/functions/gerar-honorarios/index.ts
// Edge Function para gerar honorários mensais automaticamente
// Trigger: Cron job no dia 28 de cada mês às 8h

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TIPOS
// ============================================

interface Cliente {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  valorHonorarios: number;
  ativo: boolean;
  contaAnaliticaCode?: string;
}

interface ResultadoGeracao {
  sucesso: boolean;
  competencia: string;
  clientesProcessados: number;
  invoicesGeradas: number;
  lancamentosContabeis: number;
  valorTotal: number;
  erros: string[];
}

// ============================================
// CONSTANTES
// ============================================

const CONTA_RECEITA_HONORARIOS = '3.1.1.01';

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function calcularCompetencia(dataBase?: string): string {
  const data = dataBase ? new Date(dataBase) : new Date();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function calcularDataVencimento(competencia: string, diaVencimento: number = 10): string {
  const [ano, mes] = competencia.split('-').map(Number);

  // Próximo mês
  let mesVenc = mes + 1;
  let anoVenc = ano;
  if (mesVenc > 12) {
    mesVenc = 1;
    anoVenc++;
  }

  // Ajustar dia se necessário (ex: fevereiro não tem dia 31)
  const ultimoDia = new Date(anoVenc, mesVenc, 0).getDate();
  const dia = Math.min(diaVencimento, ultimoDia);

  return `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

async function buscarClientesAtivos(supabase: any): Promise<Cliente[]> {
  const { data: clientes, error } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      cnpj,
      email,
      monthly_fee,
      status
    `)
    .eq('status', 'active')
    .gt('monthly_fee', 0);

  if (error) throw error;

  return clientes.map((c: any) => ({
    id: c.id,
    name: c.name,
    cnpj: c.cnpj,
    email: c.email,
    valorHonorarios: parseFloat(c.monthly_fee) || 0,
    ativo: c.status === 'active',
    contaAnaliticaCode: undefined, // Será buscado na função buscarOuCriarContaCliente
  }));
}

async function buscarOuCriarContaCliente(supabase: any, cliente: Cliente): Promise<string> {
  // Se já tem conta definida, verificar se existe
  if (cliente.contaAnaliticaCode) {
    const { data: contaExistente } = await supabase
      .from('chart_of_accounts')
      .select('code')
      .eq('code', cliente.contaAnaliticaCode)
      .single();

    if (contaExistente) return contaExistente.code;
  }

  // Buscar conta pelo nome
  const { data: contaPorNome } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .ilike('name', `%${cliente.name}%`)
    .ilike('code', '1.1.2.01.%')
    .limit(1);

  if (contaPorNome && contaPorNome.length > 0) {
    return contaPorNome[0].code;
  }

  // Criar nova conta
  const { data: ultimaConta } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .ilike('code', '1.1.2.01.%')
    .order('code', { ascending: false })
    .limit(1);

  const ultimoNumero = ultimaConta?.[0]?.code
    ? parseInt(ultimaConta[0].code.split('.').pop() || '0')
    : 0;

  const novoCodigo = `1.1.2.01.${String(ultimoNumero + 1).padStart(4, '0')}`;

  // Buscar parent_id
  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  // Inserir nova conta
  await supabase.from('chart_of_accounts').insert({
    code: novoCodigo,
    name: `Cliente: ${cliente.name}`,
    account_type: 'ATIVO',
    nature: 'DEVEDORA',
    parent_id: contaPai?.id,
    level: 5,
    is_analytical: true,
    is_synthetic: false,
    is_active: true,
    accepts_entries: true,
    description: `Conta a receber do cliente ${cliente.name}`,
  });

  console.log(`[gerar-honorarios] Conta criada: ${novoCodigo} para ${cliente.name}`);

  return novoCodigo;
}

async function verificarHonorariosExistentes(supabase: any, clienteId: string, competencia: string): Promise<boolean> {
  const referenceId = `hon_${clienteId}_${competencia}`;

  const { count } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact' })
    .eq('reference_id', referenceId)
    .eq('reference_type', 'honorarios');

  return (count || 0) > 0;
}

async function gerarHonorariosCliente(
  supabase: any,
  cliente: Cliente,
  competencia: string
): Promise<{ sucesso: boolean; invoiceId?: string; entryId?: string; erro?: string }> {
  try {
    // Verificar idempotência
    const jaGerou = await verificarHonorariosExistentes(supabase, cliente.id, competencia);
    if (jaGerou) {
      console.log(`[gerar-honorarios] Honorários já gerados para ${cliente.name} em ${competencia}`);
      return { sucesso: true };
    }

    // Buscar ou criar conta analítica
    const contaCode = await buscarOuCriarContaCliente(supabase, cliente);

    // Buscar ID das contas
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', contaCode)
      .single();

    const { data: contaReceita } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', CONTA_RECEITA_HONORARIOS)
      .single();

    if (!contaCliente || !contaReceita) {
      throw new Error(`Contas não encontradas: cliente=${contaCode} receita=${CONTA_RECEITA_HONORARIOS}`);
    }

    // Calcular datas
    const dataLancamento = `${competencia}-28`; // Último dia útil aproximado
    const dataVencimento = calcularDataVencimento(competencia, 10);

    // Criar invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        client_id: cliente.id,
        amount: cliente.valorHonorarios,
        due_date: dataVencimento,
        status: 'pending',
        competence: competencia,
        description: `Honorários contábeis ${competencia}`,
        metadata: {
          tipo: 'honorarios_mensais',
          gerado_automaticamente: true,
        },
      })
      .select('id')
      .single();

    if (invoiceError) throw invoiceError;

    // Criar lançamento contábil
    const referenceId = `hon_${cliente.id}_${competencia}`;

    const { data: entry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: dataLancamento,
        entry_type: 'receita_honorarios',
        description: `Honorários contábeis ${competencia} - ${cliente.name}`,
        reference_type: 'honorarios',
        reference_id: referenceId,
        source_type: 'geracao_honorarios',
        source_module: 'gerar-honorarios',
        status: 'posted',
        metadata: {
          clienteId: cliente.id,
          invoiceId: invoice.id,
          competencia,
        },
      })
      .select('id')
      .single();

    if (entryError) throw entryError;

    // Criar linhas do lançamento
    const { error: linhasError } = await supabase
      .from('accounting_entry_lines')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: cliente.valorHonorarios,
          credit: 0,
          description: `Honorários ${competencia} - ${cliente.name}`,
        },
        {
          entry_id: entry.id,
          account_id: contaReceita.id,
          debit: 0,
          credit: cliente.valorHonorarios,
          description: `Receita honorários ${competencia} - ${cliente.name}`,
        },
      ]);

    if (linhasError) throw linhasError;

    console.log(`[gerar-honorarios] ${cliente.name}: R$ ${cliente.valorHonorarios.toFixed(2)}`);

    return { sucesso: true, invoiceId: invoice.id, entryId: entry.id };

  } catch (error: any) {
    console.error(`[gerar-honorarios] ${cliente.name}: ${error.message}`);
    return { sucesso: false, erro: error.message };
  }
}

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

    const body = await req.json().catch(() => ({}));
    const competencia = body.competencia || calcularCompetencia();

    console.log(`\n[gerar-honorarios] Gerando honorários para competência: ${competencia}`);
    console.log('='.repeat(50));

    // Buscar clientes ativos
    const clientes = await buscarClientesAtivos(supabase);
    console.log(`[gerar-honorarios] Clientes ativos encontrados: ${clientes.length}`);

    // Resultado
    const resultado: ResultadoGeracao = {
      sucesso: true,
      competencia,
      clientesProcessados: 0,
      invoicesGeradas: 0,
      lancamentosContabeis: 0,
      valorTotal: 0,
      erros: [],
    };

    // Processar cada cliente
    for (const cliente of clientes) {
      const geracao = await gerarHonorariosCliente(supabase, cliente, competencia);

      resultado.clientesProcessados++;

      if (geracao.sucesso) {
        if (geracao.invoiceId) resultado.invoicesGeradas++;
        if (geracao.entryId) resultado.lancamentosContabeis++;
        resultado.valorTotal += cliente.valorHonorarios;
      } else {
        resultado.erros.push(`${cliente.name}: ${geracao.erro}`);
      }
    }

    resultado.sucesso = resultado.erros.length === 0;

    console.log('\n' + '='.repeat(50));
    console.log(`[gerar-honorarios] Resumo:`);
    console.log(`   Clientes processados: ${resultado.clientesProcessados}`);
    console.log(`   Invoices geradas: ${resultado.invoicesGeradas}`);
    console.log(`   Lançamentos contábeis: ${resultado.lancamentosContabeis}`);
    console.log(`   Valor total: R$ ${resultado.valorTotal.toFixed(2)}`);
    console.log(`   Erros: ${resultado.erros.length}`);

    return new Response(
      JSON.stringify(resultado),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: resultado.sucesso ? 200 : 207 // 207 = Multi-Status (parcial)
      }
    );

  } catch (error: any) {
    console.error('[gerar-honorarios] Erro:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
