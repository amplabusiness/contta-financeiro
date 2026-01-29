// Script para investigar discrepância na partida dobrada
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function investigar() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  INVESTIGAÇÃO PARTIDA DOBRADA                                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // 1. Buscar entries desbalanceados
  console.log('1. BUSCANDO ENTRIES DESBALANCEADOS...');
  const { data: entries, error: entriesError } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      description,
      source_type,
      is_draft,
      items:accounting_entry_items(id, debit, credit, account_id)
    `)
    .eq('is_draft', false)
    .order('entry_date', { ascending: false });

  if (entriesError) {
    console.log(`   ❌ Erro: ${entriesError.message}`);
    return;
  }

  let totalDesbalanceado = 0;
  const entriesDesbalanceados = [];

  for (const entry of entries || []) {
    const totalDebit = entry.items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const totalCredit = entry.items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    const diff = Math.abs(totalDebit - totalCredit);

    if (diff > 0.01) {
      totalDesbalanceado += diff;
      entriesDesbalanceados.push({
        id: entry.id,
        date: entry.entry_date,
        description: entry.description?.substring(0, 50),
        source: entry.source_type,
        debit: totalDebit,
        credit: totalCredit,
        diff: diff
      });
    }
  }

  console.log(`   Total de entries: ${entries?.length || 0}`);
  console.log(`   Entries desbalanceados: ${entriesDesbalanceados.length}`);
  console.log(`   Valor total desbalanceado: R$ ${totalDesbalanceado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);

  if (entriesDesbalanceados.length > 0) {
    console.log('2. DETALHES DOS ENTRIES DESBALANCEADOS (primeiros 20):');
    console.log('─'.repeat(100));
    for (const e of entriesDesbalanceados.slice(0, 20)) {
      console.log(`   ${e.date} | ${e.source?.padEnd(15)} | D: ${e.debit.toFixed(2).padStart(12)} | C: ${e.credit.toFixed(2).padStart(12)} | Diff: ${e.diff.toFixed(2).padStart(10)} | ${e.description}`);
    }
    if (entriesDesbalanceados.length > 20) {
      console.log(`   ... e mais ${entriesDesbalanceados.length - 20} entries`);
    }
  }

  // 3. Agrupar por source_type
  console.log('\n3. DESBALANCEAMENTO POR TIPO DE FONTE:');
  const porTipo = {};
  for (const e of entriesDesbalanceados) {
    const tipo = e.source || 'unknown';
    if (!porTipo[tipo]) porTipo[tipo] = { count: 0, total: 0 };
    porTipo[tipo].count++;
    porTipo[tipo].total += e.diff;
  }

  for (const [tipo, data] of Object.entries(porTipo)) {
    console.log(`   ${tipo.padEnd(20)}: ${String(data.count).padStart(5)} entries | R$ ${data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  // 4. Verificar items órfãos (sem entry válido)
  console.log('\n4. VERIFICANDO ITEMS ÓRFÃOS...');
  const { data: itemsOrfaos, error: orfaosError } = await supabase
    .from('accounting_entry_items')
    .select('id, entry_id, debit, credit')
    .is('entry_id', null);

  if (orfaosError) {
    console.log(`   ❌ Erro: ${orfaosError.message}`);
  } else {
    const totalOrfaosDebit = itemsOrfaos?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const totalOrfaosCredit = itemsOrfaos?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    console.log(`   Items órfãos: ${itemsOrfaos?.length || 0}`);
    console.log(`   Total débitos órfãos: R$ ${totalOrfaosDebit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Total créditos órfãos: R$ ${totalOrfaosCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  // 5. Verificar items com entry cancelado/draft
  console.log('\n5. VERIFICANDO ITEMS DE ENTRIES DRAFT/CANCELADOS...');
  const { data: itemsDraft, error: draftError } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, credit, entry:accounting_entries!inner(id, is_draft)')
    .eq('entry.is_draft', true);

  if (draftError) {
    console.log(`   ❌ Erro: ${draftError.message}`);
  } else {
    const totalDraftDebit = itemsDraft?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const totalDraftCredit = itemsDraft?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    console.log(`   Items de entries draft: ${itemsDraft?.length || 0}`);
    console.log(`   Total débitos draft: R$ ${totalDraftDebit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Total créditos draft: R$ ${totalDraftCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  // 6. Recalcular totais corretos (somente entries publicados e balanceados)
  console.log('\n6. TOTAIS CORRETOS (entries publicados):');
  const { data: todosItems, error: todosError } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries!inner(is_draft)')
    .eq('entry.is_draft', false);

  if (todosError) {
    console.log(`   ❌ Erro: ${todosError.message}`);
  } else {
    const totalDebitos = todosItems?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const totalCreditos = todosItems?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    const diferenca = Math.abs(totalDebitos - totalCreditos);

    console.log(`   Total Débitos: R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Diferença: R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Status: ${diferenca < 0.01 ? '✅ BALANCEADO' : '⚠️ DESBALANCEADO'}`);
  }

  console.log('\n╚════════════════════════════════════════════════════════════════════╝');
}

investigar().catch(console.error);
