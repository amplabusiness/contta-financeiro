// scripts/correcao_contabil/79_criar_3_faltantes.cjs
// Criar os 3 lançamentos faltantes específicos

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTA_PL = '5.2.1.01';
const DATA_COMPETENCIA = '2024-12-01';
const DATA_ENTRY = '2024-12-31';

// Lançamentos específicos a criar
const LANCAMENTOS_CRIAR = [
  { conta: '1.1.2.01.0006', cliente: 'TIMES NEGOCIOS IMOBILIARIOS LTDA', competencia: '13/2024', valor: 1051.46 },
  { conta: '1.1.2.01.0007', cliente: 'VERDI E ECD EMPREENDIMENTOS IMOBILIARIOS SPE LTDA', competencia: '12/2024', valor: 2118.07 },
  { conta: '1.1.2.01.0007', cliente: 'VERDI E ECD EMPREENDIMENTOS IMOBILIARIOS SPE LTDA', competencia: '13/2024', valor: 2118.07 },
];

async function criarFaltantes() {
  console.log('='.repeat(100));
  console.log('CRIANDO 3 LANÇAMENTOS FALTANTES ESPECÍFICOS');
  console.log('='.repeat(100));

  // Buscar conta PL
  const { data: contaPL } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_PL)
    .single();

  if (!contaPL) {
    console.error('❌ Conta PL não encontrada!');
    return;
  }

  console.log(`\n📊 Conta PL: ${contaPL.code} - ${contaPL.name}`);

  let criados = 0;
  let valorTotal = 0;

  for (const lanc of LANCAMENTOS_CRIAR) {
    console.log(`\n📋 Processando: ${lanc.cliente.substring(0, 30)} | ${lanc.competencia} | R$ ${lanc.valor.toFixed(2)}`);

    // Buscar conta do cliente
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', lanc.conta)
      .single();

    if (!contaCliente) {
      console.log(`   ❌ Conta ${lanc.conta} não encontrada!`);
      continue;
    }

    console.log(`   Conta encontrada: ${contaCliente.code} - ${contaCliente.name}`);

    // Criar entry
    const descricao = `Saldo de abertura - ${lanc.competencia} - ${lanc.cliente.substring(0, 40)}`;

    const { data: entry, error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: DATA_ENTRY,
        competence_date: DATA_COMPETENCIA,
        entry_type: 'SALDO_ABERTURA',
        description: descricao,
        total_debit: lanc.valor,
        total_credit: lanc.valor,
        balanced: true
      })
      .select()
      .single();

    if (errEntry) {
      console.error(`   ❌ Erro ao criar entry: ${errEntry.message}`);
      continue;
    }

    console.log(`   ✅ Entry criado: ${entry.id}`);

    // Criar items
    const { error: errItems } = await supabase
      .from('accounting_entry_items')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: lanc.valor,
          credit: 0,
          history: `Saldo devedor - ${lanc.competencia}`
        },
        {
          entry_id: entry.id,
          account_id: contaPL.id,
          debit: 0,
          credit: lanc.valor,
          history: `Contrapartida saldo abertura - ${lanc.competencia}`
        }
      ]);

    if (errItems) {
      console.error(`   ❌ Erro ao criar items: ${errItems.message}`);
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      continue;
    }

    console.log(`   ✅ Items criados com sucesso!`);
    criados++;
    valorTotal += lanc.valor;
  }

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESULTADO:');
  console.log('='.repeat(100));
  console.log(`   Lançamentos criados: ${criados}`);
  console.log(`   Valor total: R$ ${valorTotal.toFixed(2)}`);

  // Verificar saldo final
  console.log('\n📊 Verificando saldo final...');

  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  let totalDebitos = 0;

  for (const conta of subcontas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    totalDebitos += (items?.reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0) || 0);
    totalDebitos += (lines?.reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0) || 0);
  }

  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount')
    .neq('status', 'paid');

  const saldoPendente = pendentes?.reduce((s, h) => s + Number(h.amount || 0) - Number(h.paid_amount || 0), 0) || 0;

  console.log(`   Saldo contábil: R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Saldo pendente: R$ ${saldoPendente.toFixed(2)}`);
  console.log(`   Diferença: R$ ${(saldoPendente - totalDebitos).toFixed(2)}`);

  if (Math.abs(totalDebitos - saldoPendente) < 1) {
    console.log('\n✅ SALDOS CONFEREM!');
  } else {
    console.log('\n⚠️  Ainda há diferença');
  }

  console.log('='.repeat(100));
}

criarFaltantes().catch(console.error);
