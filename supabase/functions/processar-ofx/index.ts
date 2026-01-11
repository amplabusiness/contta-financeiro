/**
 * Edge Function: processar-ofx
 *
 * Processa arquivos OFX automaticamente quando são enviados para o Storage.
 * Implementa o fluxo correto NBC TG 26:
 * - Cobranças agrupadas (COBxxxx) → Conta Transitória 1.1.9.01
 * - Recebimentos identificáveis → Conta analítica do cliente
 * - Recebimentos não identificados → Pendente de Identificação
 * - Despesas → Conta específica de despesa
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

// Contas especiais
const CONTAS = {
  BANCO_SICREDI: '1.1.1.05',          // Banco Sicredi
  TRANSITORIA: '1.1.9.01',             // Recebimentos a Conciliar
  PENDENTE_ID: '1.1.2.01.9999',        // Pendente de Identificação
  ENERGIA: '4.1.1.01',
  AGUA: '4.1.1.02',
  TELEFONE_INTERNET: '4.1.1.03',
  TARIFAS_BANCARIAS: '4.3.1.02',
  DESPESAS_DIVERSAS: '4.9.9.01',
};

// Padrões para identificar tipos de transação
const PADROES = {
  COBRANCA_AGRUPADA: /COB\d+|COBRANCA|LIQ\.?COB|LIQUIDACAO\s*COBRANCA/i,
  PIX_RECEBIDO: /PIX[_\s]?CRED|PIX\s*RECEBIDO|RECEBIMENTO\s*PIX/i,
  PIX_ENVIADO: /PIX[_\s]?DEB|PIX\s*ENVIADO|PAGAMENTO\s*PIX/i,
  TED_RECEBIDO: /TED\s*RECEBIDO|CREDITO\s*TED/i,
  ENERGIA: /CELESC|CPFL|ENEL|ENERGISA|CEMIG|COPEL|EQUATORIAL|ENERGIA|LUZ/i,
  AGUA: /SANEPAR|COPASA|SABESP|SANASA|CAESB|AGUA|ESGOTO/i,
  TELEFONE: /VIVO|CLARO|TIM|OI|TELEFON|INTERNET|NET|GVT/i,
  TARIFA: /TARIFA|TAR\s*MANUT|PACOTE\s*SERVIC|CESTA\s*SERVIC/i,
};

interface Transacao {
  fitid: string;
  date: string;
  amount: number;
  memo: string;
  type: 'credit' | 'debit';
}

interface ClassificacaoResult {
  tipo: string;
  linhas: Array<{ conta: string; debito: number; credito: number }>;
  descricao: string;
  confianca: 'alta' | 'media' | 'baixa';
  precisaDesmembramento?: boolean;
  cobrancaId?: string;
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
    const { action, transacoes, bank_account_id, import_id } = body;

    console.log('[processar-ofx] Action:', action, 'Transações:', transacoes?.length);

    // AÇÃO: Processar lista de transações
    if (action === 'process_transactions') {
      const resultados = [];
      let processadas = 0;
      let erros = 0;

      for (const tx of transacoes) {
        try {
          // 1. Verificar idempotência
          const existe = await verificarSeExiste(supabase, tx.fitid || tx.id);
          if (existe) {
            console.log(`[processar-ofx] Transação ${tx.fitid} já existe, pulando`);
            continue;
          }

          // 2. Classificar transação
          const classificacao = await classificarTransacao(supabase, tx);
          console.log(`[processar-ofx] Classificação:`, classificacao);

          // 3. Criar lançamento contábil
          const lancamento = await criarLancamento(supabase, {
            ...classificacao,
            transacao: tx,
            importId: import_id,
            bankAccountId: bank_account_id
          });

          resultados.push({
            transacaoId: tx.fitid || tx.id,
            tipo: classificacao.tipo,
            lancamentoId: lancamento?.id,
            sucesso: true
          });
          processadas++;

        } catch (err: any) {
          console.error(`[processar-ofx] Erro na transação ${tx.fitid}:`, err);
          resultados.push({
            transacaoId: tx.fitid || tx.id,
            erro: err.message,
            sucesso: false
          });
          erros++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processadas,
        erros,
        resultados,
        message: `${processadas} transações processadas, ${erros} erros`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Classificar uma única transação
    if (action === 'classify_transaction') {
      const { transaction } = body;
      const classificacao = await classificarTransacao(supabase, transaction);
      return new Response(JSON.stringify({
        success: true,
        classificacao
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Ação não reconhecida',
      actions: ['process_transactions', 'classify_transaction']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[processar-ofx] Erro geral:', error);
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
 * Verifica se já existe lançamento para este fitid (idempotência)
 */
async function verificarSeExiste(supabase: any, fitid: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('reference_id', fitid)
    .eq('reference_type', 'bank_transaction')
    .maybeSingle();

  return !!data;
}

/**
 * Classifica a transação e define o lançamento contábil
 */
async function classificarTransacao(supabase: any, tx: Transacao): Promise<ClassificacaoResult> {
  const descricao = tx.memo?.toUpperCase() || '';
  const valor = Math.abs(tx.amount);
  const isCredito = tx.amount > 0;

  // === CRÉDITOS (dinheiro entrando) ===
  if (isCredito) {
    // 1. Cobrança agrupada? → Transitória
    if (PADROES.COBRANCA_AGRUPADA.test(descricao)) {
      const cobrancaId = extrairCobrancaId(descricao);
      return {
        tipo: 'cobranca_agrupada',
        linhas: [
          { conta: CONTAS.BANCO_SICREDI, debito: valor, credito: 0 },
          { conta: CONTAS.TRANSITORIA, debito: 0, credito: valor }
        ],
        descricao: `Cobrança ${cobrancaId} - Aguarda desmembramento`,
        confianca: 'alta',
        precisaDesmembramento: true,
        cobrancaId
      };
    }

    // 2. PIX/TED identificável? → Tentar identificar cliente
    if (PADROES.PIX_RECEBIDO.test(descricao) || PADROES.TED_RECEBIDO.test(descricao)) {
      const cliente = await identificarCliente(supabase, descricao);

      if (cliente) {
        return {
          tipo: 'recebimento_identificado',
          linhas: [
            { conta: CONTAS.BANCO_SICREDI, debito: valor, credito: 0 },
            { conta: cliente.contaCode, debito: 0, credito: valor }
          ],
          descricao: `Recebimento ${cliente.nome}`,
          confianca: 'alta'
        };
      }

      // Cliente não identificado → Pendente
      return {
        tipo: 'recebimento_pendente',
        linhas: [
          { conta: CONTAS.BANCO_SICREDI, debito: valor, credito: 0 },
          { conta: CONTAS.PENDENTE_ID, debito: 0, credito: valor }
        ],
        descricao: `Recebimento não identificado - ${descricao.substring(0, 50)}`,
        confianca: 'baixa'
      };
    }

    // 3. Outro crédito não identificado
    return {
      tipo: 'credito_outros',
      linhas: [
        { conta: CONTAS.BANCO_SICREDI, debito: valor, credito: 0 },
        { conta: CONTAS.TRANSITORIA, debito: 0, credito: valor }
      ],
      descricao: `Crédito a identificar - ${descricao.substring(0, 50)}`,
      confianca: 'baixa'
    };
  }

  // === DÉBITOS (dinheiro saindo) ===
  // Classificar despesa
  const categoriaDespesa = classificarDespesa(descricao);

  return {
    tipo: 'despesa',
    linhas: [
      { conta: categoriaDespesa.conta, debito: valor, credito: 0 },
      { conta: CONTAS.BANCO_SICREDI, debito: 0, credito: valor }
    ],
    descricao: `${categoriaDespesa.nome} - ${descricao.substring(0, 40)}`,
    confianca: categoriaDespesa.confianca
  };
}

/**
 * Extrai o ID da cobrança (COB000xxx) da descrição
 */
function extrairCobrancaId(descricao: string): string {
  const match = descricao.match(/COB\d+/i);
  return match ? match[0].toUpperCase() : 'COB_NAO_IDENTIFICADO';
}

/**
 * Tenta identificar o cliente pelo nome/CNPJ na descrição
 */
async function identificarCliente(supabase: any, descricao: string): Promise<{ nome: string; contaCode: string } | null> {
  // Extrair possível nome do pagador
  const partes = descricao.split(/[-–]/);
  const possiveisNomes = partes.slice(1).map(p => p.trim()).filter(p => p.length > 3);

  for (const nome of possiveisNomes) {
    // Buscar cliente por nome (fuzzy)
    const { data: clientes } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', `%${nome.substring(0, 20)}%`)
      .limit(1);

    if (clientes && clientes.length > 0) {
      // Buscar conta analítica do cliente
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('code')
        .ilike('name', `%${clientes[0].name}%`)
        .like('code', '1.1.2.01.%')
        .maybeSingle();

      if (conta) {
        return {
          nome: clientes[0].name,
          contaCode: conta.code
        };
      }
    }
  }

  // Tentar extrair e buscar por CNPJ
  const cnpjMatch = descricao.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (cnpjMatch) {
    const cnpj = cnpjMatch[0].replace(/\D/g, '');
    const { data: clienteByCnpj } = await supabase
      .from('clients')
      .select('id, name')
      .eq('cnpj', cnpj)
      .maybeSingle();

    if (clienteByCnpj) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('code')
        .ilike('name', `%${clienteByCnpj.name}%`)
        .like('code', '1.1.2.01.%')
        .maybeSingle();

      if (conta) {
        return {
          nome: clienteByCnpj.name,
          contaCode: conta.code
        };
      }
    }
  }

  return null;
}

/**
 * Classifica despesa por padrões na descrição
 */
function classificarDespesa(descricao: string): { conta: string; nome: string; confianca: 'alta' | 'media' | 'baixa' } {
  if (PADROES.ENERGIA.test(descricao)) {
    return { conta: CONTAS.ENERGIA, nome: 'Energia Elétrica', confianca: 'alta' };
  }
  if (PADROES.AGUA.test(descricao)) {
    return { conta: CONTAS.AGUA, nome: 'Água e Esgoto', confianca: 'alta' };
  }
  if (PADROES.TELEFONE.test(descricao)) {
    return { conta: CONTAS.TELEFONE_INTERNET, nome: 'Telefone/Internet', confianca: 'alta' };
  }
  if (PADROES.TARIFA.test(descricao)) {
    return { conta: CONTAS.TARIFAS_BANCARIAS, nome: 'Tarifas Bancárias', confianca: 'alta' };
  }

  // Despesa não identificada
  return { conta: CONTAS.DESPESAS_DIVERSAS, nome: 'Despesas a Classificar', confianca: 'baixa' };
}

/**
 * Cria o lançamento contábil no banco de dados
 */
async function criarLancamento(supabase: any, params: {
  tipo: string;
  linhas: Array<{ conta: string; debito: number; credito: number }>;
  descricao: string;
  transacao: Transacao;
  importId: string;
  bankAccountId: string;
}): Promise<any> {
  const { tipo, linhas, descricao, transacao, importId, bankAccountId } = params;

  // 1. Criar entry principal
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_type: tipo,
      entry_date: transacao.date,
      description: descricao,
      reference_type: 'bank_transaction',
      reference_id: transacao.fitid || transacao.id,
      source_type: 'ofx_import',
      source_module: 'processar-ofx',
      origin_context: `import_${importId}`,
      metadata: {
        original_memo: transacao.memo,
        bank_account_id: bankAccountId,
        import_id: importId
      }
    })
    .select('id')
    .single();

  if (entryError) {
    throw new Error(`Erro ao criar entry: ${entryError.message}`);
  }

  // 2. Criar linhas do lançamento
  const linhasComEntryId = [];
  for (const linha of linhas) {
    // Buscar ID da conta pelo código
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', linha.conta)
      .single();

    if (!conta) {
      throw new Error(`Conta ${linha.conta} não encontrada`);
    }

    linhasComEntryId.push({
      entry_id: entry.id,
      account_id: conta.id,
      debit: linha.debito,
      credit: linha.credito
    });
  }

  const { error: linhasError } = await supabase
    .from('accounting_entry_lines')
    .insert(linhasComEntryId);

  if (linhasError) {
    // Rollback: deletar entry criado
    await supabase.from('accounting_entries').delete().eq('id', entry.id);
    throw new Error(`Erro ao criar linhas: ${linhasError.message}`);
  }

  return entry;
}
