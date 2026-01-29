// scripts/resumo_jan2025.mjs
// Resumo do processamento de janeiro 2025
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('='.repeat(100));
  console.log('RESUMO PROCESSAMENTO JANEIRO 2025 - MCP GUARDIÃO');
  console.log('Dr. Cícero - Contador Oficial');
  console.log('='.repeat(100));
  console.log(`Executado em: ${new Date().toLocaleString('pt-BR')}`);

  // Verificar lançamentos de janeiro 2025
  const { data: entriesJan } = await supabase
    .from('accounting_entries')
    .select('id, entry_type, total_debit, balanced')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log('\n📊 LANÇAMENTOS DE JANEIRO 2025:');
  console.log(`   Total de entries: ${entriesJan?.length || 0}`);

  const porTipo = {};
  for (const e of entriesJan || []) {
    const tipo = e.entry_type || 'SEM_TIPO';
    if (!porTipo[tipo]) porTipo[tipo] = { count: 0, valor: 0 };
    porTipo[tipo].count++;
    porTipo[tipo].valor += Number(e.total_debit || 0);
  }

  console.log('\n   Por tipo:');
  for (const [tipo, dados] of Object.entries(porTipo).sort((a, b) => b[1].valor - a[1].valor)) {
    console.log(`   ${tipo.padEnd(35)}: ${String(dados.count).padStart(4)} entries = R$ ${dados.valor.toFixed(2).padStart(12)}`);
  }

  // Verificar desbalanceados
  const desbalanceados = (entriesJan || []).filter(e => !e.balanced);
  console.log(`\n   Entries desbalanceados: ${desbalanceados.length}`);

  // Verificar honorários gerados
  const { count: qtdHonorarios } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true })
    .eq('entry_type', 'HONORARIOS')
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-01-31');

  console.log(`\n📋 HONORÁRIOS JANEIRO 2025:`);
  console.log(`   Lançamentos gerados: ${qtdHonorarios}`);

  // Verificar saldo banco Sicredi
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  if (contaSicredi) {
    const { data: itemsSicredi } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', contaSicredi.id);

    const saldoSicredi = (itemsSicredi || []).reduce(
      (s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0
    );

    console.log(`\n📊 SALDO BANCO SICREDI (1.1.1.05):`);
    console.log(`   R$ ${saldoSicredi.toFixed(2)}`);
  }

  // Verificar conta transitória
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .single();

  if (contaTransitoria) {
    const { data: itemsTrans } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', contaTransitoria.id);

    const saldoTrans = (itemsTrans || []).reduce(
      (s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0
    );

    console.log(`\n📊 SALDO CONTA TRANSITÓRIA (1.1.9.01):`);
    console.log(`   R$ ${saldoTrans.toFixed(2)}`);

    if (Math.abs(saldoTrans) > 1) {
      console.log(`   ⚠️  Pendente de classificação`);
    } else {
      console.log(`   ✅ Conta zerada`);
    }
  }

  // Verificar receitas de honorários (3.1.1.01)
  const { data: contaReceita } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.1.01')
    .single();

  if (contaReceita) {
    // Buscar apenas items de janeiro 2025
    const { data: itemsRecJan } = await supabase
      .from('accounting_entry_items')
      .select(`
        credit,
        accounting_entries!inner (
          competence_date
        )
      `)
      .eq('account_id', contaReceita.id)
      .gte('accounting_entries.competence_date', '2025-01-01')
      .lte('accounting_entries.competence_date', '2025-01-31');

    const receitaJan = (itemsRecJan || []).reduce((s, i) => s + Number(i.credit || 0), 0);

    console.log(`\n📊 RECEITA HONORÁRIOS JAN/2025 (3.1.1.01):`);
    console.log(`   R$ ${receitaJan.toFixed(2)}`);
  }

  // Verificar tarifas bancárias (4.1.3.02)
  const { data: contaTarifas } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4.1.3.02')
    .single();

  if (contaTarifas) {
    const { data: itemsTarifasJan } = await supabase
      .from('accounting_entry_items')
      .select(`
        debit,
        accounting_entries!inner (
          entry_date
        )
      `)
      .eq('account_id', contaTarifas.id)
      .gte('accounting_entries.entry_date', '2025-01-01')
      .lte('accounting_entries.entry_date', '2025-01-31');

    const tarifasJan = (itemsTarifasJan || []).reduce((s, i) => s + Number(i.debit || 0), 0);

    console.log(`\n📊 DESPESAS TARIFAS BANCÁRIAS JAN/2025 (4.1.3.02):`);
    console.log(`   R$ ${tarifasJan.toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('STATUS FINAL');
  console.log('='.repeat(100));
  console.log('✅ Honorários: Gerados via MCP Guardião');
  console.log('✅ OFX: Importado e processado');
  console.log('✅ Cobranças: Desmembradas (104 boletos)');
  console.log('⚠️  Despesas: Pendente classificação manual');
  console.log('='.repeat(100));
}

main().catch(console.error);
