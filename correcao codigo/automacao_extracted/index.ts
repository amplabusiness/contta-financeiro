// supabase/functions/processar-ofx/index.ts
// Edge Function para processar arquivos OFX automaticamente
// Trigger: Upload de arquivo .ofx no Storage bucket 'imports'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TIPOS
// ============================================

interface TransacaoOFX {
  fitid: string;
  dtposted: string;
  trnamt: number;
  memo: string;
  trntype: string;
}

interface ClassificacaoTransacao {
  tipo: 'cobranca_agrupada' | 'recebimento_identificado' | 'recebimento_pendente' | 'despesa' | 'transferencia';
  linhas: Array<{
    contaCode: string;
    contaId?: string;
    debito: number;
    credito: number;
    descricao?: string;
  }>;
  clienteId?: string;
  cobrancaId?: string;
  categoriaId?: string;
  precisaDesmembramento?: boolean;
  precisaRevisao?: boolean;
}

interface ResultadoProcessamento {
  sucesso: boolean;
  transacoesProcessadas: number;
  cobrancasAgrupadas: number;
  recebimentosIdentificados: number;
  recebimentosPendentes: number;
  despesas: number;
  erros: string[];
}

// ============================================
// CONSTANTES
// ============================================

const CONTA_BANCO_SICREDI = '1.1.1.05';
const CONTA_TRANSITORIA = '1.1.9.01';
const CONTA_PENDENTE_IDENTIFICACAO = '1.1.2.01.9999';

// Padrões para identificar cobranças agrupadas
const PADROES_COBRANCA = [
  /COB\d{6}/i,
  /LIQ\.COBRANCA/i,
  /COBRANCA SIMPLES/i,
  /LIQUIDACAO COB/i,
];

// Padrões para classificar despesas
const PADROES_DESPESA = [
  { pattern: /CELESC|CPFL|ENEL|ENERGIA|LUZ|ELETRO/i, conta: '4.1.1.01', nome: 'Energia Elétrica' },
  { pattern: /SANEPAR|COPASA|SABESP|SANEAGO|AGUA|ESGOTO/i, conta: '4.1.1.02', nome: 'Água e Esgoto' },
  { pattern: /VIVO|CLARO|TIM|OI\s|TELEFON|INTERNET|NET\s|ALGAR/i, conta: '4.1.1.03', nome: 'Telefone/Internet' },
  { pattern: /PAPEL|CANETA|ESCRITORIO|KALUNGA|STAPLES/i, conta: '4.1.2.01', nome: 'Material de Escritório' },
  { pattern: /UBER|99|TAXI|COMBUSTIVEL|POSTO|SHELL|IPIRANGA|BR\s|PETROBRAS/i, conta: '4.1.2.03', nome: 'Combustível/Transporte' },
  { pattern: /RESTAURANTE|ALMOCO|IFOOD|REFEICAO|LANCHONETE/i, conta: '4.1.2.04', nome: 'Alimentação' },
  { pattern: /GOOGLE|MICROSOFT|ADOBE|SOFTWARE|AWS|AZURE|GITHUB|HEROKU/i, conta: '4.1.3.01', nome: 'Software/Licenças' },
  { pattern: /ALUGUEL|LOCACAO|IMOBILIARIA/i, conta: '4.1.4.01', nome: 'Aluguel' },
  { pattern: /CONDOMINIO|COND\./i, conta: '4.1.4.02', nome: 'Condomínio' },
  { pattern: /IPTU|PREFEITURA/i, conta: '4.1.4.03', nome: 'IPTU' },
  { pattern: /INSS|FGTS|GPS|DARF|GRF/i, conta: '4.2.1.02', nome: 'Encargos Sociais' },
  { pattern: /TARIFA|TAR\s|IOF|TAXA\s/i, conta: '4.3.1.02', nome: 'Tarifas Bancárias' },
];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function parseOFX(conteudo: string): TransacaoOFX[] {
  const transacoes: TransacaoOFX[] = [];
  
  // Regex para extrair transações do OFX
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = stmtTrnRegex.exec(conteudo)) !== null) {
    const bloco = match[1];
    
    const fitid = extrairCampo(bloco, 'FITID');
    const dtposted = extrairCampo(bloco, 'DTPOSTED');
    const trnamt = parseFloat(extrairCampo(bloco, 'TRNAMT') || '0');
    const memo = extrairCampo(bloco, 'MEMO') || extrairCampo(bloco, 'NAME') || '';
    const trntype = extrairCampo(bloco, 'TRNTYPE') || '';
    
    if (fitid) {
      transacoes.push({
        fitid,
        dtposted: formatarData(dtposted),
        trnamt,
        memo: memo.trim(),
        trntype,
      });
    }
  }
  
  return transacoes;
}

function extrairCampo(bloco: string, campo: string): string {
  const regex = new RegExp(`<${campo}>([^<\\n]+)`, 'i');
  const match = bloco.match(regex);
  return match ? match[1].trim() : '';
}

function formatarData(dtposted: string): string {
  // Formato OFX: YYYYMMDDHHMMSS ou YYYYMMDD
  if (!dtposted || dtposted.length < 8) return new Date().toISOString().split('T')[0];
  
  const ano = dtposted.substring(0, 4);
  const mes = dtposted.substring(4, 6);
  const dia = dtposted.substring(6, 8);
  
  return `${ano}-${mes}-${dia}`;
}

function isCobrancaAgrupada(memo: string): boolean {
  return PADROES_COBRANCA.some(pattern => pattern.test(memo));
}

function extrairCobrancaId(memo: string): string | null {
  const match = memo.match(/COB(\d{6})/i);
  return match ? `COB${match[1]}` : null;
}

function classificarDespesa(memo: string): { conta: string; nome: string } | null {
  for (const padrao of PADROES_DESPESA) {
    if (padrao.pattern.test(memo)) {
      return { conta: padrao.conta, nome: padrao.nome };
    }
  }
  return null;
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

async function verificarTransacaoExistente(supabase: any, fitid: string): Promise<boolean> {
  const { count } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact' })
    .eq('reference_id', fitid)
    .eq('reference_type', 'bank_transaction');
  
  return (count || 0) > 0;
}

async function identificarCliente(supabase: any, memo: string): Promise<{ id: string; nome: string; contaCode: string } | null> {
  // Normalizar memo para busca
  const memoNormalizado = memo
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();
  
  // Buscar por palavras-chave no nome do cliente
  const palavras = memoNormalizado.split(/\s+/).filter(p => p.length > 3);
  
  if (palavras.length === 0) return null;
  
  // Tentar encontrar cliente por nome
  for (const palavra of palavras) {
    const { data: clientes } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', `%${palavra}%`)
      .limit(1);
    
    if (clientes && clientes.length > 0) {
      // Buscar conta analítica do cliente
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id, code')
        .ilike('name', `%${clientes[0].name}%`)
        .ilike('code', '1.1.2.01.%')
        .limit(1);
      
      if (conta && conta.length > 0) {
        return {
          id: clientes[0].id,
          nome: clientes[0].name,
          contaCode: conta[0].code,
        };
      }
    }
  }
  
  return null;
}

async function classificarTransacao(
  supabase: any,
  tx: TransacaoOFX
): Promise<ClassificacaoTransacao> {
  const valor = Math.abs(tx.trnamt);
  
  // ENTRADA (valor positivo) - Recebimento
  if (tx.trnamt > 0) {
    // É cobrança agrupada?
    if (isCobrancaAgrupada(tx.memo)) {
      const cobrancaId = extrairCobrancaId(tx.memo);
      return {
        tipo: 'cobranca_agrupada',
        linhas: [
          { contaCode: CONTA_BANCO_SICREDI, debito: valor, credito: 0 },
          { contaCode: CONTA_TRANSITORIA, debito: 0, credito: valor },
        ],
        cobrancaId,
        precisaDesmembramento: true,
      };
    }
    
    // Tentar identificar cliente
    const cliente = await identificarCliente(supabase, tx.memo);
    
    if (cliente) {
      return {
        tipo: 'recebimento_identificado',
        linhas: [
          { contaCode: CONTA_BANCO_SICREDI, debito: valor, credito: 0 },
          { contaCode: cliente.contaCode, debito: 0, credito: valor },
        ],
        clienteId: cliente.id,
      };
    }
    
    // Não identificado - vai para pendente
    return {
      tipo: 'recebimento_pendente',
      linhas: [
        { contaCode: CONTA_BANCO_SICREDI, debito: valor, credito: 0 },
        { contaCode: CONTA_PENDENTE_IDENTIFICACAO, debito: 0, credito: valor },
      ],
      precisaRevisao: true,
    };
  }
  
  // SAÍDA (valor negativo) - Despesa
  if (tx.trnamt < 0) {
    const categoria = classificarDespesa(tx.memo);
    
    if (categoria) {
      return {
        tipo: 'despesa',
        linhas: [
          { contaCode: categoria.conta, debito: valor, credito: 0, descricao: categoria.nome },
          { contaCode: CONTA_BANCO_SICREDI, debito: 0, credito: valor },
        ],
      };
    }
    
    // Despesa não classificada
    return {
      tipo: 'despesa',
      linhas: [
        { contaCode: '4.9.9.01', debito: valor, credito: 0, descricao: 'Outras Despesas' },
        { contaCode: CONTA_BANCO_SICREDI, debito: 0, credito: valor },
      ],
      precisaRevisao: true,
    };
  }
  
  // Valor zero - transferência ou ajuste
  return {
    tipo: 'transferencia',
    linhas: [],
    precisaRevisao: true,
  };
}

async function criarLancamentoContabil(
  supabase: any,
  tx: TransacaoOFX,
  classificacao: ClassificacaoTransacao
): Promise<{ sucesso: boolean; entryId?: string; erro?: string }> {
  try {
    // Buscar IDs das contas
    const linhasComIds = await Promise.all(
      classificacao.linhas.map(async (linha) => {
        const conta = await buscarContaPorCodigo(supabase, linha.contaCode);
        if (!conta) {
          throw new Error(`Conta ${linha.contaCode} não encontrada`);
        }
        return { ...linha, contaId: conta.id };
      })
    );
    
    // Validar partidas dobradas
    const totalDebitos = linhasComIds.reduce((s, l) => s + l.debito, 0);
    const totalCreditos = linhasComIds.reduce((s, l) => s + l.credito, 0);
    
    if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
      throw new Error(`Lançamento desbalanceado: D=${totalDebitos} C=${totalCreditos}`);
    }
    
    // Criar entry
    const { data: entry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: tx.dtposted,
        entry_type: classificacao.tipo,
        description: tx.memo.substring(0, 255),
        reference_type: 'bank_transaction',
        reference_id: tx.fitid,
        source_type: 'ofx_import',
        status: 'posted',
        metadata: {
          trntype: tx.trntype,
          classificacao: classificacao.tipo,
          cobrancaId: classificacao.cobrancaId,
          clienteId: classificacao.clienteId,
          precisaDesmembramento: classificacao.precisaDesmembramento,
          precisaRevisao: classificacao.precisaRevisao,
        },
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
      description: linha.descricao || tx.memo.substring(0, 100),
    }));
    
    const { error: linhasError } = await supabase
      .from('accounting_entry_lines')
      .insert(linhasParaInserir);
    
    if (linhasError) throw linhasError;
    
    return { sucesso: true, entryId: entry.id };
    
  } catch (error) {
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
    
    const { bucket, name: filePath, conteudo } = await req.json();
    
    let ofxContent: string;
    
    // Se conteúdo foi passado diretamente
    if (conteudo) {
      ofxContent = conteudo;
    } else {
      // Baixar do Storage
      const { data, error } = await supabase.storage
        .from(bucket || 'imports')
        .download(filePath);
      
      if (error) throw error;
      
      ofxContent = await data.text();
    }
    
    // Parsear OFX
    const transacoes = parseOFX(ofxContent);
    
    console.log(`📂 Processando ${transacoes.length} transações do OFX`);
    
    // Resultado
    const resultado: ResultadoProcessamento = {
      sucesso: true,
      transacoesProcessadas: 0,
      cobrancasAgrupadas: 0,
      recebimentosIdentificados: 0,
      recebimentosPendentes: 0,
      despesas: 0,
      erros: [],
    };
    
    // Processar cada transação
    for (const tx of transacoes) {
      // Verificar idempotência
      const existe = await verificarTransacaoExistente(supabase, tx.fitid);
      if (existe) {
        console.log(`⏭️ Transação ${tx.fitid} já processada, ignorando`);
        continue;
      }
      
      // Classificar transação
      const classificacao = await classificarTransacao(supabase, tx);
      
      // Ignorar transferências sem valor
      if (classificacao.tipo === 'transferencia' && classificacao.linhas.length === 0) {
        continue;
      }
      
      // Criar lançamento
      const lancamento = await criarLancamentoContabil(supabase, tx, classificacao);
      
      if (lancamento.sucesso) {
        resultado.transacoesProcessadas++;
        
        switch (classificacao.tipo) {
          case 'cobranca_agrupada':
            resultado.cobrancasAgrupadas++;
            break;
          case 'recebimento_identificado':
            resultado.recebimentosIdentificados++;
            break;
          case 'recebimento_pendente':
            resultado.recebimentosPendentes++;
            break;
          case 'despesa':
            resultado.despesas++;
            break;
        }
        
        console.log(`✅ ${tx.fitid}: ${classificacao.tipo} - R$ ${Math.abs(tx.trnamt).toFixed(2)}`);
      } else {
        resultado.erros.push(`${tx.fitid}: ${lancamento.erro}`);
        console.log(`❌ ${tx.fitid}: ${lancamento.erro}`);
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`   Processadas: ${resultado.transacoesProcessadas}`);
    console.log(`   Cobranças agrupadas: ${resultado.cobrancasAgrupadas}`);
    console.log(`   Recebimentos identificados: ${resultado.recebimentosIdentificados}`);
    console.log(`   Recebimentos pendentes: ${resultado.recebimentosPendentes}`);
    console.log(`   Despesas: ${resultado.despesas}`);
    console.log(`   Erros: ${resultado.erros.length}`);
    
    return new Response(
      JSON.stringify(resultado),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
