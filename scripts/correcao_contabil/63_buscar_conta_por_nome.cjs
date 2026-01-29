// scripts/correcao_contabil/63_buscar_conta_por_nome.cjs
// Buscar contas por nome para encontrar onde estão os lançamentos

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function buscar() {
  console.log('='.repeat(100));
  console.log('BUSCANDO CONTAS POR NOME');
  console.log('='.repeat(100));

  const nomes = ['RESTAURANTE IUVACI', 'VERDI', 'TIMES NEGOCIOS'];

  for (const nome of nomes) {
    console.log(`\n📊 Buscando: "${nome}"`);

    const { data: contas } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .ilike('name', `%${nome}%`)
      .order('code');

    console.log(`   Encontradas: ${contas?.length || 0} contas`);

    for (const conta of contas || []) {
      // Buscar lançamentos em items
      const { data: items } = await supabase
        .from('accounting_entry_items')
        .select('debit, credit')
        .eq('account_id', conta.id);

      // Buscar lançamentos em lines
      const { data: lines } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', conta.id);

      const totalD = (items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0) +
                    (lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0);
      const totalC = (items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0) +
                    (lines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0);

      const saldo = totalD - totalC;

      if (saldo !== 0 || items?.length || lines?.length) {
        console.log(`   ✓ ${conta.code} - ${conta.name.substring(0, 40)}`);
        console.log(`      Items: ${items?.length || 0} | Lines: ${lines?.length || 0}`);
        console.log(`      D: ${totalD.toFixed(2)} | C: ${totalC.toFixed(2)} | Saldo: ${saldo.toFixed(2)}`);
      } else {
        console.log(`   - ${conta.code} - ${conta.name.substring(0, 40)} (sem lançamentos)`);
      }
    }
  }

  // Verificar se há contas duplicadas ou com CONSOLIDADO
  console.log('\n' + '='.repeat(100));
  console.log('VERIFICANDO CONTAS [CONSOLIDADO]');
  console.log('='.repeat(100));

  const { data: consolidadas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%[CONSOLIDADO]%')
    .or('name.ilike.%RESTAURANTE%,name.ilike.%VERDI%,name.ilike.%TIMES%');

  console.log(`\nContas CONSOLIDADO encontradas: ${consolidadas?.length || 0}`);
  for (const conta of consolidadas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const totalD = items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const totalC = items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;

    console.log(`   ${conta.code} - ${conta.name.substring(0, 50)}`);
    console.log(`      D: ${totalD.toFixed(2)} | C: ${totalC.toFixed(2)} | Saldo: ${(totalD - totalC).toFixed(2)}`);
  }
}

buscar().catch(console.error);
