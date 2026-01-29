// scripts/correcao_contabil/70_verificar_pendentes_sem_lancamento.cjs
// Verificar quais honorários PENDENTES não têm lançamento contábil

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO HONORÁRIOS PENDENTES SEM LANÇAMENTO');
  console.log('='.repeat(100));

  // 1. Buscar honorários PENDENTES
  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('id, client_id, competence, amount, paid_amount, status, clients(name)')
    .neq('status', 'paid')
    .order('clients(name)')
    .order('competence');

  console.log(`\n📋 Honorários PENDENTES: ${pendentes?.length || 0}`);

  let semLancamento = [];
  let comLancamento = 0;
  let valorSemLancamento = 0;

  for (const hon of pendentes || []) {
    const clienteName = hon.clients?.name || '';
    const valor = Number(hon.amount || 0) - Number(hon.paid_amount || 0);

    // Buscar a conta do cliente
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .like('code', '1.1.2.01.%')
      .ilike('name', `%${clienteName.substring(0, 15)}%`)
      .not('name', 'ilike', '%[CONSOLIDADO]%')
      .limit(1)
      .single();

    if (!contaCliente) {
      semLancamento.push({ ...hon, motivo: 'Conta não encontrada' });
      valorSemLancamento += valor;
      continue;
    }

    // Buscar lançamentos na conta com valor aproximado
    const valorHon = Number(hon.amount || 0);

    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit')
      .eq('account_id', contaCliente.id)
      .gte('debit', valorHon - 1)
      .lte('debit', valorHon + 1);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit')
      .eq('account_id', contaCliente.id)
      .gte('debit', valorHon - 1)
      .lte('debit', valorHon + 1);

    if ((items?.length || 0) === 0 && (lines?.length || 0) === 0) {
      semLancamento.push({ ...hon, contaCode: contaCliente.code, motivo: 'Sem lançamento' });
      valorSemLancamento += valor;
    } else {
      comLancamento++;
    }
  }

  console.log(`\n📊 RESULTADO:`);
  console.log(`   Com lançamento: ${comLancamento}`);
  console.log(`   SEM lançamento: ${semLancamento.length}`);
  console.log(`   Valor sem lançamento: R$ ${valorSemLancamento.toFixed(2)}`);

  if (semLancamento.length > 0) {
    console.log('\n📋 HONORÁRIOS PENDENTES SEM LANÇAMENTO:');

    // Agrupar por cliente
    const porCliente = {};
    semLancamento.forEach(h => {
      const cliente = h.clients?.name || 'SEM CLIENTE';
      if (!porCliente[cliente]) porCliente[cliente] = { qtd: 0, valor: 0, items: [] };
      porCliente[cliente].qtd++;
      porCliente[cliente].valor += Number(h.amount || 0) - Number(h.paid_amount || 0);
      porCliente[cliente].items.push(h);
    });

    Object.entries(porCliente).forEach(([cliente, dados]) => {
      console.log(`\n   ${cliente}: ${dados.qtd} honorários | R$ ${dados.valor.toFixed(2)}`);
      dados.items.forEach(h => {
        console.log(`      - ${h.competence} | R$ ${(Number(h.amount || 0) - Number(h.paid_amount || 0)).toFixed(2)} | ${h.motivo}`);
      });
    });
  }

  console.log('\n' + '='.repeat(100));
}

verificar().catch(console.error);
