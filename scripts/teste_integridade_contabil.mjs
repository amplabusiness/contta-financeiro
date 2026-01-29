// scripts/teste_integridade_contabil.mjs
// Valida integridade contábil: D=C, sem duplicações, contas corretas
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let erros = 0;
let avisos = 0;

function erro(msg) {
  console.log(`❌ ERRO: ${msg}`);
  erros++;
}

function aviso(msg) {
  console.log(`⚠️  AVISO: ${msg}`);
  avisos++;
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

async function testePartidaDobrada() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTE 1: PARTIDA DOBRADA (Débitos = Créditos)');
  console.log('='.repeat(80));

  // Verificar accounting_entries + accounting_entry_lines
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .order('entry_date', { ascending: false })
    .limit(500);

  let entriesDesbalanceados = 0;

  for (const entry of entries || []) {
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('entry_id', entry.id);

    const totalDebitos = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCreditos = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);

    if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
      erro(`Entry ${entry.id} desbalanceado: D=${totalDebitos.toFixed(2)} C=${totalCreditos.toFixed(2)} - ${entry.description?.substring(0,40)}`);
      entriesDesbalanceados++;
    }
  }

  // Verificar accounting_entry_items
  const { data: entries2 } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description')
    .order('entry_date', { ascending: false })
    .limit(500);

  for (const entry of entries2 || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('entry_id', entry.id);

    if (!items || items.length === 0) continue;

    const totalDebitos = items.reduce((s, i) => s + Number(i.debit || 0), 0);
    const totalCreditos = items.reduce((s, i) => s + Number(i.credit || 0), 0);

    if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
      erro(`Entry ${entry.id} (items) desbalanceado: D=${totalDebitos.toFixed(2)} C=${totalCreditos.toFixed(2)}`);
      entriesDesbalanceados++;
    }
  }

  if (entriesDesbalanceados === 0) {
    ok('Todos os lançamentos estão balanceados (D=C)');
  }
}

async function testeDuplicacoes() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTE 2: DUPLICAÇÕES (reference_id repetido)');
  console.log('='.repeat(80));

  // Buscar entries com mesmo reference_id
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('reference_id, reference_type, count')
    .not('reference_id', 'is', null)
    .neq('reference_id', '');

  const contagem = {};
  for (const e of entries || []) {
    const chave = `${e.reference_type}:${e.reference_id}`;
    contagem[chave] = (contagem[chave] || 0) + 1;
  }

  let duplicados = 0;
  for (const [chave, qtd] of Object.entries(contagem)) {
    if (qtd > 1) {
      erro(`Duplicação: ${chave} aparece ${qtd} vezes`);
      duplicados++;
    }
  }

  if (duplicados === 0) {
    ok('Nenhuma duplicação de reference_id encontrada');
  }
}

async function testeContasSinteticas() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTE 3: LANÇAMENTOS EM CONTAS SINTÉTICAS');
  console.log('='.repeat(80));

  // Buscar contas sintéticas que não aceitam lançamentos
  const { data: contasSinteticas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('is_synthetic', true);

  const idsSinteticas = (contasSinteticas || []).map(c => c.id);
  const mapaCodigos = Object.fromEntries((contasSinteticas || []).map(c => [c.id, c.code]));

  // Verificar em lines
  const { data: linhasSinteticas } = await supabase
    .from('accounting_entry_lines')
    .select('id, account_id, entry_id')
    .in('account_id', idsSinteticas);

  for (const l of linhasSinteticas || []) {
    erro(`Lançamento em conta sintética: entry_id=${l.entry_id} conta=${mapaCodigos[l.account_id]}`);
  }

  // Verificar em items
  const { data: itemsSinteticos } = await supabase
    .from('accounting_entry_items')
    .select('id, account_id, entry_id')
    .in('account_id', idsSinteticas);

  for (const i of itemsSinteticos || []) {
    erro(`Item em conta sintética: entry_id=${i.entry_id} conta=${mapaCodigos[i.account_id]}`);
  }

  if ((linhasSinteticas?.length || 0) + (itemsSinteticos?.length || 0) === 0) {
    ok('Nenhum lançamento em contas sintéticas');
  }
}

async function testeEquacaoPatrimonial() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTE 4: EQUAÇÃO PATRIMONIAL (Ativo = Passivo + PL)');
  console.log('='.repeat(80));

  // Calcular saldo de cada grupo
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, nature');

  const saldos = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  for (const conta of contas || []) {
    const grupo = conta.code.charAt(0);
    if (!['1', '2', '3', '4', '5'].includes(grupo)) continue;

    // Buscar movimentações
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let saldo = 0;
    saldo += (lines || []).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
    saldo += (items || []).reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0);

    saldos[grupo] += saldo;
  }

  console.log(`  Grupo 1 (Ativo):    R$ ${saldos['1'].toFixed(2)}`);
  console.log(`  Grupo 2 (Passivo):  R$ ${Math.abs(saldos['2']).toFixed(2)}`);
  console.log(`  Grupo 3 (Receita):  R$ ${Math.abs(saldos['3']).toFixed(2)}`);
  console.log(`  Grupo 4 (Despesa):  R$ ${saldos['4'].toFixed(2)}`);
  console.log(`  Grupo 5 (PL):       R$ ${Math.abs(saldos['5']).toFixed(2)}`);

  // Resultado = Receita - Despesa
  const resultado = Math.abs(saldos['3']) - saldos['4'];
  console.log(`\n  Resultado (R-D):    R$ ${resultado.toFixed(2)}`);

  // PL ajustado = PL + Resultado
  const plAjustado = Math.abs(saldos['5']) + resultado;
  console.log(`  PL Ajustado:        R$ ${plAjustado.toFixed(2)}`);

  // Equação: Ativo = Passivo + PL Ajustado
  const diferenca = saldos['1'] - (Math.abs(saldos['2']) + plAjustado);
  console.log(`\n  Diferença (A - P - PL): R$ ${diferenca.toFixed(2)}`);

  if (Math.abs(diferenca) < 1) {
    ok('Equação patrimonial balanceada');
  } else {
    erro(`Equação patrimonial desbalanceada: diferença de R$ ${diferenca.toFixed(2)}`);
  }
}

async function testeSaldoBanco() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTE 5: SALDO BANCO SICREDI (1.1.1.05)');
  console.log('='.repeat(80));

  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  if (!conta) {
    erro('Conta 1.1.1.05 não encontrada');
    return;
  }

  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta.id);

  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .eq('account_id', conta.id);

  let saldo = 0;
  saldo += (lines || []).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
  saldo += (items || []).reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0);

  console.log(`  Saldo contábil: R$ ${saldo.toFixed(2)}`);

  // Saldo esperado: R$ 90.725,06 (abertura)
  const saldoEsperado = 90725.06;
  if (Math.abs(saldo - saldoEsperado) < 1) {
    ok(`Saldo confere com abertura (R$ ${saldoEsperado.toFixed(2)})`);
  } else {
    aviso(`Saldo diferente da abertura. Esperado: R$ ${saldoEsperado.toFixed(2)}`);
  }
}

async function testeContaTransitoria() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTE 6: CONTA TRANSITÓRIA (1.1.9.01)');
  console.log('='.repeat(80));

  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .single();

  if (!conta) {
    erro('Conta 1.1.9.01 não encontrada');
    return;
  }

  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta.id);

  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .eq('account_id', conta.id);

  let saldo = 0;
  saldo += (lines || []).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
  saldo += (items || []).reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0);

  console.log(`  Saldo: R$ ${saldo.toFixed(2)}`);

  if (Math.abs(saldo) < 0.01) {
    ok('Conta transitória zerada');
  } else {
    aviso(`Conta transitória com saldo pendente de R$ ${saldo.toFixed(2)}`);
  }
}

async function testeClientesReceber() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTE 7: CLIENTES A RECEBER (1.1.2.01.*)');
  console.log('='.repeat(80));

  // Buscar todas as contas analíticas de clientes
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .neq('code', '1.1.2.01')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  let totalSaldo = 0;
  let contasNegativas = 0;

  for (const conta of contas || []) {
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let saldo = 0;
    saldo += (lines || []).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
    saldo += (items || []).reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0);

    totalSaldo += saldo;

    if (saldo < -0.01) {
      aviso(`Conta ${conta.code} com saldo CREDOR: R$ ${saldo.toFixed(2)} - ${conta.name}`);
      contasNegativas++;
    }
  }

  console.log(`\n  Total contas: ${contas?.length || 0}`);
  console.log(`  Saldo total: R$ ${totalSaldo.toFixed(2)}`);

  if (contasNegativas === 0) {
    ok('Nenhuma conta de cliente com saldo credor');
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('TESTE DE INTEGRIDADE CONTÁBIL - AMPLA CONTABILIDADE');
  console.log('='.repeat(80));
  console.log(`Executado em: ${new Date().toLocaleString('pt-BR')}`);

  await testePartidaDobrada();
  await testeDuplicacoes();
  await testeContasSinteticas();
  await testeEquacaoPatrimonial();
  await testeSaldoBanco();
  await testeContaTransitoria();
  await testeClientesReceber();

  console.log('\n' + '='.repeat(80));
  console.log('RESULTADO FINAL');
  console.log('='.repeat(80));
  console.log(`  Erros: ${erros}`);
  console.log(`  Avisos: ${avisos}`);

  if (erros === 0) {
    console.log('\n✅ SISTEMA ÍNTEGRO - Pronto para processar janeiro 2025');
  } else {
    console.log('\n❌ SISTEMA COM PROBLEMAS - Corrigir antes de continuar');
  }
  console.log('='.repeat(80));
}

main();
