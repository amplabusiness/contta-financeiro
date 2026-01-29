// scripts/processar_janeiro_2025.mjs
// Processa o mês de janeiro 2025 seguindo a arquitetura automatizada
// ETAPA 1: Gerar honorários (provisão)
// ETAPA 2: Importar OFX (transações bancárias)
// ETAPA 3: Desmembrar cobranças (COBxxxx)
// ETAPA 4: Classificar despesas (cada uma separada)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurações
const COMPETENCIA = '2025-01';
const DATA_LANCAMENTO = '2025-01-28';
const DATA_VENCIMENTO = '2025-02-10';

// Contas
const CONTAS = {
  BANCO_SICREDI: '1.1.1.05',
  TRANSITORIA: '1.1.9.01',
  RECEITA_HONORARIOS: '3.1.1.01',
  LUCROS_ACUMULADOS: '5.2.1.01'
};

// Cache de contas
const cacheContas = new Map();

async function getContaId(code) {
  if (cacheContas.has(code)) return cacheContas.get(code);

  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', code)
    .single();

  if (data) cacheContas.set(code, data.id);
  return data?.id;
}

// ============================================
// ETAPA 1: GERAR HONORÁRIOS
// ============================================

async function gerarHonorarios() {
  console.log('\n' + '='.repeat(80));
  console.log('ETAPA 1: GERAR HONORÁRIOS JANEIRO 2025');
  console.log('='.repeat(80));

  // Buscar clientes ativos com honorários
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee')
    .eq('status', 'active')
    .gt('monthly_fee', 0);

  console.log(`\nClientes ativos: ${clientes?.length || 0}`);

  let gerados = 0;
  let jaExistentes = 0;
  let valorTotal = 0;
  let erros = 0;

  for (const cliente of clientes || []) {
    const referenceId = `hon_${cliente.id}_${COMPETENCIA}`;

    // Verificar idempotência
    const { data: existe } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('reference_type', 'honorarios')
      .maybeSingle();

    if (existe) {
      jaExistentes++;
      continue;
    }

    // Buscar ou criar conta analítica do cliente
    let contaCliente = await buscarOuCriarContaCliente(cliente);
    if (!contaCliente) {
      console.log(`❌ Não foi possível criar conta para ${cliente.name}`);
      erros++;
      continue;
    }

    // Criar lançamento
    const { data: entry, error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: DATA_LANCAMENTO,
        competence_date: COMPETENCIA + '-01',
        entry_type: 'receita_honorarios',
        description: `Honorários ${COMPETENCIA} - ${cliente.name.substring(0,40)}`,
        reference_type: 'honorarios',
        reference_id: referenceId,
        source_type: 'geracao_honorarios',
        source_module: 'processar_janeiro_2025',
        total_debit: cliente.monthly_fee,
        total_credit: cliente.monthly_fee,
        balanced: true
      })
      .select('id')
      .single();

    if (errEntry) {
      console.log(`❌ Erro ao criar entry para ${cliente.name}: ${errEntry.message}`);
      erros++;
      continue;
    }

    // Criar linhas
    const contaReceita = await getContaId(CONTAS.RECEITA_HONORARIOS);

    const { error: errLines } = await supabase
      .from('accounting_entry_lines')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: cliente.monthly_fee,
          credit: 0,
          description: `Honorários ${COMPETENCIA}`
        },
        {
          entry_id: entry.id,
          account_id: contaReceita,
          debit: 0,
          credit: cliente.monthly_fee,
          description: `Receita honorários ${COMPETENCIA}`
        }
      ]);

    if (errLines) {
      console.log(`❌ Erro ao criar linhas para ${cliente.name}: ${errLines.message}`);
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      erros++;
      continue;
    }

    gerados++;
    valorTotal += Number(cliente.monthly_fee);
  }

  console.log(`\n📊 RESULTADO:`);
  console.log(`   Gerados: ${gerados}`);
  console.log(`   Já existentes: ${jaExistentes}`);
  console.log(`   Erros: ${erros}`);
  console.log(`   Valor total: R$ ${valorTotal.toFixed(2)}`);

  return { gerados, jaExistentes, erros, valorTotal };
}

async function buscarOuCriarContaCliente(cliente) {
  // Buscar por nome
  const { data: contaExistente } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .ilike('name', `%${cliente.name.substring(0, 20)}%`)
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .limit(1)
    .maybeSingle();

  if (contaExistente) return contaExistente;

  // Criar nova conta
  const { data: ultimaConta } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .order('code', { ascending: false })
    .limit(1)
    .single();

  const ultimoNumero = ultimaConta ? parseInt(ultimaConta.code.split('.').pop()) : 0;
  const novoCodigo = `1.1.2.01.${String(ultimoNumero + 1).padStart(4, '0')}`;

  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: novaConta, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code: novoCodigo,
      name: cliente.name.substring(0, 60),
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
    console.log(`   Erro ao criar conta: ${error.message}`);
    return null;
  }

  console.log(`   + Nova conta criada: ${novoCodigo} - ${cliente.name.substring(0,30)}`);
  return novaConta;
}

// ============================================
// VERIFICAÇÃO FINAL
// ============================================

async function verificarIntegridade() {
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO DE INTEGRIDADE');
  console.log('='.repeat(80));

  // Verificar balanceamento dos honorários gerados
  const { data: entriesHonorarios } = await supabase
    .from('accounting_entries')
    .select('id, description')
    .eq('entry_type', 'receita_honorarios')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  let desbalanceados = 0;

  for (const entry of entriesHonorarios || []) {
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('entry_id', entry.id);

    const totalD = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalC = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);

    if (Math.abs(totalD - totalC) > 0.01) {
      console.log(`❌ Entry desbalanceado: ${entry.id} D=${totalD} C=${totalC}`);
      desbalanceados++;
    }
  }

  if (desbalanceados === 0) {
    console.log('✅ Todos os lançamentos estão balanceados');
  } else {
    console.log(`❌ ${desbalanceados} lançamentos desbalanceados`);
  }

  // Verificar duplicações
  const { data: entriesRef } = await supabase
    .from('accounting_entries')
    .select('reference_id')
    .eq('entry_type', 'receita_honorarios')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31')
    .not('reference_id', 'is', null);

  const contagem = {};
  for (const e of entriesRef || []) {
    contagem[e.reference_id] = (contagem[e.reference_id] || 0) + 1;
  }

  let duplicados = 0;
  for (const [ref, qtd] of Object.entries(contagem)) {
    if (qtd > 1) {
      console.log(`❌ Duplicação: ${ref} aparece ${qtd} vezes`);
      duplicados++;
    }
  }

  if (duplicados === 0) {
    console.log('✅ Nenhuma duplicação encontrada');
  }

  return { desbalanceados, duplicados };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('='.repeat(80));
  console.log('PROCESSAMENTO JANEIRO 2025 - AMPLA CONTABILIDADE');
  console.log('='.repeat(80));
  console.log(`Iniciado em: ${new Date().toLocaleString('pt-BR')}`);

  // ETAPA 1: Gerar honorários
  const resultHonorarios = await gerarHonorarios();

  // Verificação
  await verificarIntegridade();

  console.log('\n' + '='.repeat(80));
  console.log('PROCESSAMENTO CONCLUÍDO');
  console.log('='.repeat(80));
  console.log('\nPróximas etapas:');
  console.log('  1. Importar OFX de janeiro 2025');
  console.log('  2. Desmembrar cobranças (COBxxxx)');
  console.log('  3. Classificar despesas');
}

main().catch(console.error);
