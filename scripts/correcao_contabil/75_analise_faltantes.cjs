// scripts/correcao_contabil/75_analise_faltantes.cjs
// Análise detalhada dos honorários faltantes

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analisar() {
  console.log('='.repeat(100));
  console.log('ANÁLISE DETALHADA DOS HONORÁRIOS PENDENTES');
  console.log('='.repeat(100));

  // Buscar TODOS os honorários PENDENTES com cliente
  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('id, client_id, competence, amount, paid_amount, status, clients(id, name)')
    .neq('status', 'paid')
    .order('competence');

  console.log(`\nTotal de honorários pendentes: ${pendentes?.length || 0}`);

  // Agrupar por cliente
  const porCliente = {};
  for (const h of pendentes || []) {
    const nome = h.clients?.name || 'DESCONHECIDO';
    if (!porCliente[nome]) {
      porCliente[nome] = { total: 0, honorarios: [] };
    }
    const saldo = Number(h.amount || 0) - Number(h.paid_amount || 0);
    porCliente[nome].total += saldo;
    porCliente[nome].honorarios.push({ competence: h.competence, valor: saldo });
  }

  console.log('\n📋 HONORÁRIOS POR CLIENTE (client_opening_balance):');
  console.log('-'.repeat(100));

  let totalPendentes = 0;
  for (const [nome, dados] of Object.entries(porCliente).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n${nome}`);
    console.log(`   Total: R$ ${dados.total.toFixed(2)}`);
    totalPendentes += dados.total;
  }
  console.log('-'.repeat(100));
  console.log(`TOTAL GERAL PENDENTES: R$ ${totalPendentes.toFixed(2)}`);

  // Agora verificar saldo contábil por cliente
  console.log('\n\n📊 SALDO CONTÁBIL POR CONTA (1.1.2.01.*):');
  console.log('-'.repeat(100));

  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .order('code');

  let totalContabil = 0;
  const saldosPorConta = {};

  for (const conta of contas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const saldo = (items?.reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0) || 0) +
                  (lines?.reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0) || 0);

    if (saldo !== 0) {
      saldosPorConta[conta.code] = { nome: conta.name, saldo };
      totalContabil += saldo;
      console.log(`${conta.code.padEnd(15)} | ${conta.name.substring(0, 40).padEnd(40)} | R$ ${saldo.toFixed(2).padStart(12)}`);
    }
  }
  console.log('-'.repeat(100));
  console.log(`TOTAL CONTÁBIL: R$ ${totalContabil.toFixed(2)}`);
  console.log(`\nDIFERENÇA: R$ ${(totalPendentes - totalContabil).toFixed(2)}`);

  // Verificar KORSICA especificamente
  console.log('\n\n🔍 VERIFICANDO KORSICA:');
  const { data: korsicaConta } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%KORSICA%');

  console.log('Contas com KORSICA:', korsicaConta?.length);
  korsicaConta?.forEach(c => console.log(`   ${c.code} - ${c.name}`));

  const { data: korsicaHon } = await supabase
    .from('client_opening_balance')
    .select('id, competence, amount, status, clients(name)')
    .ilike('clients.name', '%KORSICA%');

  console.log('\nHonorários KORSICA:', korsicaHon?.length);
  korsicaHon?.forEach(h => console.log(`   ${h.competence} | R$ ${h.amount} | ${h.status} | ${h.clients?.name}`));

  // Verificar PM ADMINISTRAÇÃO
  console.log('\n\n🔍 VERIFICANDO PM ADMINISTRAÇÃO:');
  const { data: pmConta } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%PM ADM%');

  console.log('Contas com PM ADM:', pmConta?.length);
  pmConta?.forEach(c => console.log(`   ${c.code} - ${c.name}`));

  const { data: pmHon } = await supabase
    .from('client_opening_balance')
    .select('id, competence, amount, status, clients(name)')
    .ilike('clients.name', '%PM ADM%');

  console.log('\nHonorários PM:', pmHon?.length);
  pmHon?.forEach(h => console.log(`   ${h.competence} | R$ ${h.amount} | ${h.status} | ${h.clients?.name}`));

  console.log('='.repeat(100));
}

analisar().catch(console.error);
