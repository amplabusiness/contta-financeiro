// Script para validar partida dobrada sem limite de registros
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function validar() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  VALIDAÇÃO COMPLETA DA PARTIDA DOBRADA                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // 1. Contar total de registros
  const { count } = await supabase
    .from('accounting_entry_items')
    .select('*', { count: 'exact', head: true });

  console.log(`Total de items contábeis: ${count}\n`);

  // 2. Somar usando RPC ou query com agregação
  const { data: totais, error } = await supabase.rpc('fn_verificar_partida_dobrada');

  if (error && error.code !== 'PGRST202') {
    console.log(`Erro na RPC: ${error.message}`);
    console.log('Tentando via query direta...\n');

    // Fallback: buscar em lotes e somar
    let totalDebitos = 0;
    let totalCreditos = 0;
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: items } = await supabase
        .from('accounting_entry_items')
        .select('debit, credit, entry:accounting_entries!inner(is_draft)')
        .eq('entry.is_draft', false)
        .range(offset, offset + batchSize - 1);

      if (!items || items.length === 0) {
        hasMore = false;
      } else {
        totalDebitos += items.reduce((s, i) => s + Number(i.debit || 0), 0);
        totalCreditos += items.reduce((s, i) => s + Number(i.credit || 0), 0);
        offset += batchSize;
        console.log(`  Processados ${offset} items...`);
      }
    }

    const diferenca = Math.abs(totalDebitos - totalCreditos);

    console.log('\n═════════════════════════════════════════════════════════════════════');
    console.log(`  Total Débitos: R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Diferença: R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Status: ${diferenca < 0.01 ? '✅ BALANCEADO' : '⚠️ DESBALANCEADO'}`);
    console.log('═════════════════════════════════════════════════════════════════════');
  } else if (totais) {
    console.log(`  Total Débitos: R$ ${Number(totais.total_debitos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Créditos: R$ ${Number(totais.total_creditos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    const diferenca = Math.abs(Number(totais.total_debitos) - Number(totais.total_creditos));
    console.log(`  Diferença: R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Status: ${diferenca < 0.01 ? '✅ BALANCEADO' : '⚠️ DESBALANCEADO'}`);
  }

  // 3. Verificar se existem entries ainda desbalanceados
  console.log('\n\nVerificando entries individuais desbalanceados...');
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      description,
      items:accounting_entry_items(debit, credit)
    `)
    .eq('is_draft', false);

  let totalDesbal = 0;
  const entriesDesbal = [];

  for (const e of entries || []) {
    const d = e.items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const c = e.items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    if (Math.abs(d - c) > 0.01) {
      totalDesbal += Math.abs(d - c);
      entriesDesbal.push({
        id: e.id,
        date: e.entry_date,
        desc: e.description?.substring(0, 40),
        diff: Math.abs(d - c)
      });
    }
  }

  if (entriesDesbal.length > 0) {
    console.log(`\n⚠️ Encontrados ${entriesDesbal.length} entries desbalanceados:`);
    console.log(`   Total desbalanceado: R$ ${totalDesbal.toFixed(2)}`);
    console.log('\n   Primeiros 10:');
    for (const e of entriesDesbal.slice(0, 10)) {
      console.log(`   ${e.date} | R$ ${e.diff.toFixed(2).padStart(10)} | ${e.desc}`);
    }
  } else {
    console.log('✅ Todos os entries estão balanceados individualmente!');
  }
}

validar().catch(console.error);
