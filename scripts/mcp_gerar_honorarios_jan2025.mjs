// scripts/mcp_gerar_honorarios_jan2025.mjs
// Gera honorários de janeiro 2025 usando a lógica do MCP Guardião
// Dr. Cícero: "Cada lançamento DEVE passar pela validação do Guardião"

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuração
const COMPETENCIA = '2025-01';
const DATA_LANCAMENTO = '2025-01-28';
const CONTA_RECEITA = '3.1.1.01';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ============================================
// GUARDIÃO MCP - FUNÇÕES DE VALIDAÇÃO
// ============================================

async function validarLancamento(tipo, linhas, referenceId, referenceType) {
  const erros = [];
  const avisos = [];

  // Regra 1: Partida dobrada
  const totalDebitos = linhas.reduce((s, l) => s + (l.debito || 0), 0);
  const totalCreditos = linhas.reduce((s, l) => s + (l.credito || 0), 0);

  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    erros.push(`BLOQUEADO: Débitos (${formatCurrency(totalDebitos)}) ≠ Créditos (${formatCurrency(totalCreditos)})`);
  }

  // Regra 2: Contas sintéticas
  for (const linha of linhas) {
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('code, name, is_synthetic')
      .eq('code', linha.conta_code)
      .single();

    if (!conta) {
      erros.push(`BLOQUEADO: Conta ${linha.conta_code} não encontrada`);
    } else if (conta.is_synthetic) {
      erros.push(`BLOQUEADO: Conta ${linha.conta_code} (${conta.name}) é SINTÉTICA - use conta analítica`);
    }
  }

  // Regra 3: Idempotência (usando internal_code)
  if (referenceId && referenceType) {
    const { count } = await supabase
      .from('accounting_entries')
      .select('id', { count: 'exact' })
      .eq('internal_code', referenceId)
      .eq('reference_type', referenceType);

    if ((count || 0) > 0) {
      erros.push(`BLOQUEADO: Já existe lançamento com reference_id=${referenceId}`);
    }
  } else {
    avisos.push('AVISO: Sem reference_id - risco de duplicação');
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    totalDebitos,
    totalCreditos
  };
}

async function criarLancamentoContabil(tipo, data, competencia, descricao, linhas, referenceId, referenceType) {
  // Primeiro, validar
  const validacao = await validarLancamento(tipo, linhas, referenceId, referenceType);

  if (!validacao.valido) {
    return {
      sucesso: false,
      bloqueado_pelo_guardiao: true,
      erros: validacao.erros,
      mensagem: '❌ Lançamento REJEITADO pelo Guardião MCP'
    };
  }

  // Criar entry (note: reference_id é UUID, então usamos internal_code para idempotência)
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: data,
      competence_date: competencia,
      entry_type: tipo,
      description: descricao,
      reference_type: referenceType,
      internal_code: referenceId, // usar internal_code em vez de reference_id (que é UUID)
      total_debit: validacao.totalDebitos,
      total_credit: validacao.totalCreditos,
      balanced: true
    })
    .select('id')
    .single();

  if (entryError) {
    return { sucesso: false, erro: entryError.message };
  }

  // Criar linhas
  const linhasParaInserir = [];
  for (const linha of linhas) {
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', linha.conta_code)
      .single();

    if (conta) {
      linhasParaInserir.push({
        entry_id: entry.id,
        account_id: conta.id,
        debit: linha.debito || 0,
        credit: linha.credito || 0,
        description: linha.historico || descricao
      });
    }
  }

  const { error: linhasError } = await supabase
    .from('accounting_entry_lines')
    .insert(linhasParaInserir);

  if (linhasError) {
    // Rollback
    await supabase.from('accounting_entries').delete().eq('id', entry.id);
    return { sucesso: false, erro: linhasError.message };
  }

  return {
    sucesso: true,
    entry_id: entry.id,
    valor: formatCurrency(validacao.totalDebitos),
    validado_por: 'Guardião MCP + Dr. Cícero'
  };
}

async function buscarOuCriarContaCliente(clienteId, clienteNome) {
  // Buscar conta existente de várias formas
  // 1. Tentar pelo início do nome
  let contaExistente = null;

  // Buscar por diferentes partes do nome
  const nomeNormalizado = clienteNome.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  const partes = nomeNormalizado.split(' ').filter(p => p.length > 3);

  // Tentar pelo início do nome (primeiras 15 letras)
  const { data: conta1 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', `%${clienteNome.substring(0, 15)}%`)
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .limit(1)
    .maybeSingle();

  if (conta1) {
    return { sucesso: true, conta_code: conta1.code, criada: false };
  }

  // Tentar pela primeira palavra significativa
  if (partes.length > 0) {
    const { data: conta2 } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .ilike('name', `%${partes[0]}%`)
      .like('code', '1.1.2.01.%')
      .not('name', 'ilike', '%[CONSOLIDADO]%')
      .limit(1)
      .maybeSingle();

    if (conta2) {
      return { sucesso: true, conta_code: conta2.code, criada: false };
    }
  }

  // Se não encontrou, buscar próximo código disponível COM LOCK para evitar duplicação
  const { data: todasContas } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .order('code', { ascending: false });

  // Encontrar o maior número
  let maiorNumero = 0;
  for (const c of todasContas || []) {
    const num = parseInt(c.code.split('.').pop() || '0');
    if (num > maiorNumero) maiorNumero = num;
  }

  const novoCodigo = `1.1.2.01.${String(maiorNumero + 1).padStart(4, '0')}`;

  // Verificar se já existe
  const { data: jaExiste } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', novoCodigo)
    .maybeSingle();

  if (jaExiste) {
    // Tentar o próximo
    const novoCodigo2 = `1.1.2.01.${String(maiorNumero + 2).padStart(4, '0')}`;
    const { data: contaPai } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '1.1.2.01')
      .single();

    const { data: novaConta, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: novoCodigo2,
        name: clienteNome.substring(0, 60),
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        level: 5,
        is_analytical: true,
        is_synthetic: false,
        accepts_entries: true,
        parent_id: contaPai?.id
      })
      .select('id, code, name')
      .single();

    if (error) {
      return { sucesso: false, erro: error.message };
    }

    console.log(`   + Conta criada: ${novoCodigo2} - ${clienteNome.substring(0, 30)}`);
    return { sucesso: true, conta_code: novaConta.code, criada: true };
  }

  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: novaConta, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code: novoCodigo,
      name: clienteNome.substring(0, 60),
      account_type: 'ATIVO',
      nature: 'DEVEDORA',
      level: 5,
      is_analytical: true,
      is_synthetic: false,
      accepts_entries: true,
      parent_id: contaPai?.id
    })
    .select('id, code, name')
    .single();

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  console.log(`   + Conta criada: ${novoCodigo} - ${clienteNome.substring(0, 30)}`);
  return { sucesso: true, conta_code: novaConta.code, criada: true };
}

// ============================================
// PROCESSAMENTO PRINCIPAL
// ============================================

async function gerarHonorariosJaneiro2025() {
  console.log('='.repeat(80));
  console.log('🎩 DR. CÍCERO + GUARDIÃO MCP - GERAÇÃO DE HONORÁRIOS');
  console.log('='.repeat(80));
  console.log(`Competência: ${COMPETENCIA}`);
  console.log(`Data do lançamento: ${DATA_LANCAMENTO}`);
  console.log('');

  // Buscar clientes ativos
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee')
    .eq('status', 'active')
    .gt('monthly_fee', 0)
    .order('name');

  console.log(`📋 Clientes ativos: ${clientes?.length || 0}`);
  console.log('');

  let gerados = 0;
  let jaExistentes = 0;
  let erros = 0;
  let valorTotal = 0;

  for (const cliente of clientes || []) {
    const referenceId = `hon_${cliente.id}_${COMPETENCIA}`;

    // Verificar se já existe (idempotência via internal_code)
    const { count } = await supabase
      .from('accounting_entries')
      .select('id', { count: 'exact' })
      .eq('internal_code', referenceId)
      .eq('reference_type', 'honorarios');

    if ((count || 0) > 0) {
      jaExistentes++;
      continue;
    }

    // Buscar ou criar conta do cliente
    const contaCliente = await buscarOuCriarContaCliente(cliente.id, cliente.name);
    if (!contaCliente.sucesso) {
      console.log(`❌ ${cliente.name}: ${contaCliente.erro}`);
      erros++;
      continue;
    }

    // Criar lançamento via Guardião
    const resultado = await criarLancamentoContabil(
      'receita_honorarios',
      DATA_LANCAMENTO,
      `${COMPETENCIA}-01`,
      `Honorários ${COMPETENCIA} - ${cliente.name.substring(0, 40)}`,
      [
        { conta_code: contaCliente.conta_code, debito: cliente.monthly_fee, credito: 0, historico: `Honorários ${COMPETENCIA}` },
        { conta_code: CONTA_RECEITA, debito: 0, credito: cliente.monthly_fee, historico: `Receita honorários ${COMPETENCIA}` }
      ],
      referenceId,
      'honorarios'
    );

    if (resultado.sucesso) {
      gerados++;
      valorTotal += Number(cliente.monthly_fee);
      if (gerados <= 10 || gerados % 20 === 0) {
        console.log(`✅ ${cliente.name.substring(0, 35).padEnd(35)} ${formatCurrency(cliente.monthly_fee)}`);
      }
    } else {
      console.log(`❌ ${cliente.name}: ${resultado.erros?.join(', ') || resultado.erro}`);
      erros++;
    }
  }

  if (gerados > 10) {
    console.log(`   ... e mais ${gerados - 10} clientes`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('📊 RESULTADO FINAL');
  console.log('='.repeat(80));
  console.log(`   Clientes processados: ${clientes?.length || 0}`);
  console.log(`   Honorários gerados: ${gerados}`);
  console.log(`   Já existentes (idempotência): ${jaExistentes}`);
  console.log(`   Erros: ${erros}`);
  console.log(`   Valor total: ${formatCurrency(valorTotal)}`);
  console.log('');
  console.log(`✅ Validado por: Guardião MCP + Dr. Cícero (Contador Oficial)`);
  console.log('='.repeat(80));

  // Verificar integridade
  console.log('\n🔍 VERIFICAÇÃO DE INTEGRIDADE...');

  const { data: entriesHon } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('entry_type', 'receita_honorarios')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  let desbalanceados = 0;
  for (const entry of entriesHon || []) {
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('entry_id', entry.id);

    const totalD = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalC = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);

    if (Math.abs(totalD - totalC) > 0.01) {
      desbalanceados++;
    }
  }

  if (desbalanceados === 0) {
    console.log('✅ Todos os lançamentos estão balanceados (D = C)');
  } else {
    console.log(`❌ ${desbalanceados} lançamentos desbalanceados!`);
  }

  // Verificar total no DRE
  const { data: contaRec } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', CONTA_RECEITA)
    .single();

  if (contaRec) {
    const { data: movsReceita } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit, accounting_entries(entry_date)')
      .eq('account_id', contaRec.id);

    const receitaJan = (movsReceita || [])
      .filter(m => m.accounting_entries?.entry_date?.startsWith('2025-01'))
      .reduce((s, m) => s + Number(m.credit || 0) - Number(m.debit || 0), 0);

    console.log(`\n📈 Receita de Janeiro 2025: ${formatCurrency(receitaJan)}`);
  }

  console.log('='.repeat(80));
}

gerarHonorariosJaneiro2025().catch(console.error);
