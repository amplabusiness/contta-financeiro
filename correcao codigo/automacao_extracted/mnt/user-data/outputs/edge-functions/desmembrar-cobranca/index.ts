// supabase/functions/desmembrar-cobranca/index.ts
// Edge Function para desmembrar cobranças agrupadas (COB000xxx) por cliente
// Usa arquivo de retorno do Sicredi ou lista manual de clientes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TIPOS
// ============================================

interface BoletoRetorno {
  nossoNumero: string;
  valorPago: number;
  dataPagamento: string;
  clienteId?: string;
  clienteNome?: string;
  clienteCNPJ?: string;
}

interface ClienteDesmembramento {
  clienteId: string;
  clienteNome: string;
  contaCode: string;
  contaId?: string;
  valor: number;
}

interface ResultadoDesmembramento {
  sucesso: boolean;
  cobrancaId: string;
  valorTotal: number;
  clientesBaixados: number;
  entryId?: string;
  erro?: string;
}

// ============================================
// CONSTANTES
// ============================================

const CONTA_TRANSITORIA = '1.1.9.01';

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function parseArquivoRetornoCNAB240(conteudo: string): BoletoRetorno[] {
  const boletos: BoletoRetorno[] = [];
  const linhas = conteudo.split('\n');
  
  for (const linha of linhas) {
    // Registro tipo 3 - Segmento T (Título)
    if (linha.length >= 240 && linha.substring(7, 8) === '3' && linha.substring(13, 14) === 'T') {
      const nossoNumero = linha.substring(37, 57).trim();
      const valorPago = parseFloat(linha.substring(81, 96)) / 100;
      const dataPagamento = formatarDataCNAB(linha.substring(145, 153));
      
      if (valorPago > 0) {
        boletos.push({
          nossoNumero,
          valorPago,
          dataPagamento,
        });
      }
    }
  }
  
  return boletos;
}

function parseArquivoRetornoCNAB400(conteudo: string): BoletoRetorno[] {
  const boletos: BoletoRetorno[] = [];
  const linhas = conteudo.split('\n');
  
  for (const linha of linhas) {
    // Registro tipo 1 - Detalhe
    if (linha.length >= 400 && linha.substring(0, 1) === '1') {
      const nossoNumero = linha.substring(62, 73).trim();
      const valorPago = parseFloat(linha.substring(152, 165)) / 100;
      const dataPagamento = formatarDataCNAB(linha.substring(110, 116));
      
      if (valorPago > 0) {
        boletos.push({
          nossoNumero,
          valorPago,
          dataPagamento,
        });
      }
    }
  }
  
  return boletos;
}

function parseCSVRetorno(conteudo: string): BoletoRetorno[] {
  const boletos: BoletoRetorno[] = [];
  const linhas = conteudo.split('\n');
  
  // Pular cabeçalho
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    
    // Tentar separador ; ou ,
    const separador = linha.includes(';') ? ';' : ',';
    const campos = linha.split(separador).map(c => c.replace(/"/g, '').trim());
    
    // Formato esperado: nosso_numero, valor, data, cliente_nome, cliente_cnpj
    if (campos.length >= 3) {
      boletos.push({
        nossoNumero: campos[0],
        valorPago: parseFloat(campos[1].replace(',', '.')),
        dataPagamento: campos[2],
        clienteNome: campos[3] || undefined,
        clienteCNPJ: campos[4] || undefined,
      });
    }
  }
  
  return boletos;
}

function formatarDataCNAB(data: string): string {
  if (data.length === 6) {
    // DDMMAA
    return `20${data.substring(4, 6)}-${data.substring(2, 4)}-${data.substring(0, 2)}`;
  }
  if (data.length === 8) {
    // DDMMAAAA ou AAAAMMDD
    if (data.substring(0, 2) === '20') {
      return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
    }
    return `${data.substring(4, 8)}-${data.substring(2, 4)}-${data.substring(0, 2)}`;
  }
  return new Date().toISOString().split('T')[0];
}

function detectarFormatoArquivo(conteudo: string): 'cnab240' | 'cnab400' | 'csv' {
  const primeiraLinha = conteudo.split('\n')[0];
  
  if (primeiraLinha.length >= 240) return 'cnab240';
  if (primeiraLinha.length >= 400) return 'cnab400';
  return 'csv';
}

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

async function buscarContaPorCodigo(supabase: any, codigo: string): Promise<{ id: string; code: string } | null> {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .eq('code', codigo)
    .single();
  
  return data;
}

async function buscarClientePorNossoNumero(supabase: any, nossoNumero: string): Promise<{ clienteId: string; clienteNome: string } | null> {
  // Buscar invoice pelo nosso número (normalmente está em metadata ou campo específico)
  const { data: invoice } = await supabase
    .from('invoices')
    .select('client_id, clients(id, name)')
    .or(`reference.eq.${nossoNumero},metadata->nosso_numero.eq.${nossoNumero}`)
    .single();
  
  if (invoice?.clients) {
    return {
      clienteId: invoice.clients.id,
      clienteNome: invoice.clients.name,
    };
  }
  
  return null;
}

async function buscarOuCriarContaCliente(supabase: any, clienteId: string, clienteNome: string): Promise<string> {
  // Buscar conta existente
  const { data: contaExistente } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .ilike('name', `%${clienteNome}%`)
    .ilike('code', '1.1.2.01.%')
    .limit(1);
  
  if (contaExistente && contaExistente.length > 0) {
    return contaExistente[0].code;
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
    name: `Cliente: ${clienteNome}`,
    account_type: 'ATIVO',
    nature: 'DEVEDORA',
    parent_id: contaPai?.id,
    level: 5,
    is_analytical: true,
    is_synthetic: false,
    is_active: true,
    accepts_entries: true,
    description: `Conta a receber do cliente ${clienteNome}`,
  });
  
  return novoCodigo;
}

async function verificarDesmembramentoExistente(supabase: any, cobrancaId: string): Promise<boolean> {
  const { count } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact' })
    .eq('reference_id', cobrancaId)
    .eq('reference_type', 'cobranca_desmembramento');
  
  return (count || 0) > 0;
}

async function processarDesmembramento(
  supabase: any,
  cobrancaId: string,
  clientes: ClienteDesmembramento[],
  dataDesmembramento: string
): Promise<ResultadoDesmembramento> {
  try {
    // Calcular total
    const valorTotal = clientes.reduce((s, c) => s + c.valor, 0);
    
    // Buscar conta transitória
    const contaTransitoria = await buscarContaPorCodigo(supabase, CONTA_TRANSITORIA);
    if (!contaTransitoria) {
      throw new Error('Conta transitória 1.1.9.01 não encontrada');
    }
    
    // Buscar/criar contas de clientes e obter IDs
    const clientesComContas = await Promise.all(
      clientes.map(async (c) => {
        const contaCode = await buscarOuCriarContaCliente(supabase, c.clienteId, c.clienteNome);
        const conta = await buscarContaPorCodigo(supabase, contaCode);
        return { ...c, contaCode, contaId: conta?.id };
      })
    );
    
    // Validar que todos têm conta
    const semConta = clientesComContas.filter(c => !c.contaId);
    if (semConta.length > 0) {
      throw new Error(`Clientes sem conta: ${semConta.map(c => c.clienteNome).join(', ')}`);
    }
    
    // Criar entry de desmembramento
    const { data: entry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: dataDesmembramento,
        entry_type: 'recebimento',
        description: `Desmembramento ${cobrancaId} - ${clientes.length} clientes`,
        reference_type: 'cobranca_desmembramento',
        reference_id: cobrancaId,
        source_type: 'super_conciliacao',
        status: 'posted',
        metadata: {
          clientes: clientesComContas.map(c => ({
            id: c.clienteId,
            nome: c.clienteNome,
            valor: c.valor,
          })),
        },
      })
      .select('id')
      .single();
    
    if (entryError) throw entryError;
    
    // Montar linhas: 1 débito na transitória + N créditos nos clientes
    const linhas = [
      // Débito na transitória (estorno)
      {
        entry_id: entry.id,
        account_id: contaTransitoria.id,
        debit: valorTotal,
        credit: 0,
        description: `Estorno transitória - ${cobrancaId}`,
      },
      // Créditos nos clientes
      ...clientesComContas.map(c => ({
        entry_id: entry.id,
        account_id: c.contaId,
        debit: 0,
        credit: c.valor,
        description: `Baixa ${cobrancaId} - ${c.clienteNome}`,
      })),
    ];
    
    // Inserir linhas
    const { error: linhasError } = await supabase
      .from('accounting_entry_lines')
      .insert(linhas);
    
    if (linhasError) throw linhasError;
    
    // Atualizar invoices como pagas (se existirem)
    for (const cliente of clientesComContas) {
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: dataDesmembramento,
          paid_amount: cliente.valor,
        })
        .eq('client_id', cliente.clienteId)
        .eq('status', 'pending')
        .lte('amount', cliente.valor * 1.01); // 1% tolerância
    }
    
    return {
      sucesso: true,
      cobrancaId,
      valorTotal,
      clientesBaixados: clientes.length,
      entryId: entry.id,
    };
    
  } catch (error) {
    return {
      sucesso: false,
      cobrancaId,
      valorTotal: 0,
      clientesBaixados: 0,
      erro: error.message,
    };
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
    
    const body = await req.json();
    
    // Modo 1: Arquivo de retorno (CNAB ou CSV)
    if (body.arquivoRetorno) {
      const formato = detectarFormatoArquivo(body.arquivoRetorno);
      let boletos: BoletoRetorno[];
      
      switch (formato) {
        case 'cnab240':
          boletos = parseArquivoRetornoCNAB240(body.arquivoRetorno);
          break;
        case 'cnab400':
          boletos = parseArquivoRetornoCNAB400(body.arquivoRetorno);
          break;
        default:
          boletos = parseCSVRetorno(body.arquivoRetorno);
      }
      
      console.log(`📂 Arquivo ${formato}: ${boletos.length} boletos encontrados`);
      
      // Agrupar boletos por cobrança (se houver padrão COB no arquivo)
      // Por padrão, processar como uma única cobrança
      const cobrancaId = body.cobrancaId || `COB_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
      
      // Identificar clientes
      const clientes: ClienteDesmembramento[] = [];
      
      for (const boleto of boletos) {
        let clienteInfo = boleto.clienteId && boleto.clienteNome
          ? { clienteId: boleto.clienteId, clienteNome: boleto.clienteNome }
          : await buscarClientePorNossoNumero(supabase, boleto.nossoNumero);
        
        if (clienteInfo) {
          clientes.push({
            clienteId: clienteInfo.clienteId,
            clienteNome: clienteInfo.clienteNome,
            contaCode: '', // Será preenchido depois
            valor: boleto.valorPago,
          });
        } else {
          console.log(`⚠️ Boleto ${boleto.nossoNumero} sem cliente identificado`);
        }
      }
      
      if (clientes.length === 0) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Nenhum cliente identificado nos boletos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Verificar se já foi desmembrado
      const jaProcessado = await verificarDesmembramentoExistente(supabase, cobrancaId);
      if (jaProcessado) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: `Cobrança ${cobrancaId} já foi desmembrada` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Processar desmembramento
      const resultado = await processarDesmembramento(
        supabase,
        cobrancaId,
        clientes,
        boletos[0]?.dataPagamento || new Date().toISOString().split('T')[0]
      );
      
      return new Response(
        JSON.stringify(resultado),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: resultado.sucesso ? 200 : 500 }
      );
    }
    
    // Modo 2: Lista manual de clientes
    if (body.cobrancaId && body.clientes) {
      const cobrancaId = body.cobrancaId;
      const dataDesmembramento = body.data || new Date().toISOString().split('T')[0];
      
      // Verificar se já foi desmembrado
      const jaProcessado = await verificarDesmembramentoExistente(supabase, cobrancaId);
      if (jaProcessado) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: `Cobrança ${cobrancaId} já foi desmembrada` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Validar e processar clientes
      const clientes: ClienteDesmembramento[] = body.clientes.map((c: any) => ({
        clienteId: c.clienteId || c.client_id,
        clienteNome: c.clienteNome || c.nome || c.name,
        contaCode: c.contaCode || '',
        valor: parseFloat(c.valor || c.value || 0),
      }));
      
      // Processar desmembramento
      const resultado = await processarDesmembramento(
        supabase,
        cobrancaId,
        clientes,
        dataDesmembramento
      );
      
      return new Response(
        JSON.stringify(resultado),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: resultado.sucesso ? 200 : 500 }
      );
    }
    
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Parâmetros inválidos. Envie arquivoRetorno ou (cobrancaId + clientes)' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
