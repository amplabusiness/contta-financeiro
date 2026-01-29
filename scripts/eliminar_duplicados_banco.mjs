/**
 * ELIMINAR LANÇAMENTOS DUPLICADOS - BANCO SICREDI
 *
 * Remove entries que creditam o banco mas NÃO estão vinculados a transações bancárias
 * Para que a contabilidade bata exatamente com o extrato
 *
 * USO: node scripts/eliminar_duplicados_banco.mjs [--execute]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTAR = process.argv.includes('--execute');

async function main() {
  console.log('═'.repeat(100));
  console.log('ELIMINAR LANÇAMENTOS DUPLICADOS - BANCO SICREDI');
  console.log('═'.repeat(100));
  console.log('');

  if (!EXECUTAR) {
    console.log('🔍 MODO SIMULAÇÃO - Use --execute para aplicar as exclusões');
    console.log('');
  }

  // 1. Buscar conta Banco Sicredi
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  // 2. Buscar IDs das transações do extrato janeiro/2025
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('id')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  const extratoIds = new Set((extrato || []).map(t => t.id));

  // 3. Buscar todos os items que creditam o banco (saídas) em janeiro/2025
  const { data: itensCredito } = await supabase
    .from('accounting_entry_items')
    .select(`
      id, credit,
      entry:accounting_entries!inner(id, entry_date, description, entry_type, reference_type, reference_id)
    `)
    .eq('account_id', contaSicredi.id)
    .gt('credit', 0);

  const itensJan = (itensCredito || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  // 4. Identificar items SEM transação bancária vinculada (duplicados)
  const duplicados = itensJan.filter(item => {
    const refType = item.entry?.reference_type;
    const refId = item.entry?.reference_id;
    // É duplicado se NÃO está vinculado a uma transação do extrato
    return refType !== 'bank_transaction' || !refId || !extratoIds.has(refId);
  });

  // Agrupar por entry_type
  const porTipo = {};
  let totalValor = 0;

  for (const item of duplicados) {
    const tipo = item.entry?.entry_type || 'SEM_TIPO';
    if (!porTipo[tipo]) porTipo[tipo] = { count: 0, valor: 0, entries: [] };
    porTipo[tipo].count++;
    porTipo[tipo].valor += parseFloat(item.credit) || 0;
    porTipo[tipo].entries.push(item.entry.id);
    totalValor += parseFloat(item.credit) || 0;
  }

  console.log('LANÇAMENTOS DUPLICADOS A REMOVER:');
  console.log('-'.repeat(80));

  for (const [tipo, dados] of Object.entries(porTipo).sort((a, b) => b[1].valor - a[1].valor)) {
    console.log(`  ${tipo.padEnd(35)} ${String(dados.count).padStart(3)} lanç  R$ ${dados.valor.toFixed(2).padStart(12)}`);
  }

  console.log('-'.repeat(80));
  console.log(`  TOTAL: ${duplicados.length} lançamentos = R$ ${totalValor.toFixed(2)}`);
  console.log('');

  // Coletar todos os entry_ids únicos para remover
  const entryIdsParaRemover = [...new Set(duplicados.map(d => d.entry.id))];

  console.log(`Entries únicos a remover: ${entryIdsParaRemover.length}`);
  console.log('');

  if (!EXECUTAR) {
    console.log('⚠️  SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('   Execute com --execute para remover os duplicados');
    return;
  }

  // 5. EXECUTAR REMOÇÃO
  console.log('Removendo lançamentos duplicados...');
  console.log('');

  let removidos = 0;
  let erros = 0;

  for (const entryId of entryIdsParaRemover) {
    // Remover items primeiro
    const { error: itemsError } = await supabase
      .from('accounting_entry_items')
      .delete()
      .eq('entry_id', entryId);

    if (itemsError) {
      console.log(`   ❌ Erro ao remover items de ${entryId}: ${itemsError.message}`);
      erros++;
      continue;
    }

    // Remover entry
    const { error: entryError } = await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', entryId);

    if (entryError) {
      console.log(`   ❌ Erro ao remover entry ${entryId}: ${entryError.message}`);
      erros++;
      continue;
    }

    removidos++;
  }

  console.log(`✅ Removidos: ${removidos} entries`);
  if (erros > 0) {
    console.log(`❌ Erros: ${erros}`);
  }

  // 6. VERIFICAÇÃO FINAL
  console.log('');
  console.log('═'.repeat(100));
  console.log('VERIFICAÇÃO APÓS REMOÇÃO');
  console.log('═'.repeat(100));

  // Recalcular
  const { data: extratoFinal } = await supabase
    .from('bank_transactions')
    .select('amount, transaction_type')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  let bancoEntradas = 0;
  let bancoSaidas = 0;
  for (const tx of extratoFinal || []) {
    const valor = Math.abs(parseFloat(tx.amount));
    if (tx.transaction_type === 'credit') bancoEntradas += valor;
    else bancoSaidas += valor;
  }

  const { data: razaoFinal } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries!inner(entry_date)')
    .eq('account_id', contaSicredi.id);

  const razaoJanFinal = (razaoFinal || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  let contabilDebitos = 0;
  let contabilCreditos = 0;
  for (const item of razaoJanFinal) {
    contabilDebitos += parseFloat(item.debit) || 0;
    contabilCreditos += parseFloat(item.credit) || 0;
  }

  console.log('');
  console.log('EXTRATO BANCÁRIO:');
  console.log(`  Entradas: R$ ${bancoEntradas.toFixed(2)}`);
  console.log(`  Saídas:   R$ ${bancoSaidas.toFixed(2)}`);
  console.log('');
  console.log('CONTABILIDADE:');
  console.log(`  Débitos (entradas):  R$ ${contabilDebitos.toFixed(2)}`);
  console.log(`  Créditos (saídas):   R$ ${contabilCreditos.toFixed(2)}`);
  console.log('');

  const difEntradas = Math.abs(bancoEntradas - contabilDebitos);
  const difSaidas = Math.abs(bancoSaidas - contabilCreditos);

  if (difEntradas < 0.01 && difSaidas < 0.01) {
    console.log('✅ BANCO E CONTABILIDADE ESTÃO BATENDO PERFEITAMENTE!');
  } else {
    console.log('⚠️  Ainda há diferenças:');
    console.log(`   Entradas: R$ ${(bancoEntradas - contabilDebitos).toFixed(2)}`);
    console.log(`   Saídas:   R$ ${(bancoSaidas - contabilCreditos).toFixed(2)}`);
  }
}

main().catch(console.error);
