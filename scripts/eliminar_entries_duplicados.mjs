/**
 * ELIMINAR ENTRIES DUPLICADOS - JANEIRO/2025
 *
 * Remove entries duplicados que estão vinculados à mesma transação bancária
 * Mantém apenas o entry mais antigo (primeiro criado)
 *
 * USO: node scripts/eliminar_entries_duplicados.mjs [--execute]
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
  console.log('ELIMINAR ENTRIES DUPLICADOS - JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');

  if (!EXECUTAR) {
    console.log('🔍 MODO SIMULAÇÃO - Use --execute para aplicar as exclusões');
    console.log('');
  }

  // Buscar todos os entries de janeiro vinculados a bank_transaction
  const { data: entriesJan } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type, reference_type, reference_id, created_at')
    .eq('reference_type', 'bank_transaction')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31')
    .order('created_at');

  // Agrupar por reference_id
  const porRefId = {};
  for (const e of entriesJan || []) {
    if (!e.reference_id) continue;
    if (!porRefId[e.reference_id]) porRefId[e.reference_id] = [];
    porRefId[e.reference_id].push(e);
  }

  // Encontrar duplicados (reference_id com mais de 1 entry)
  const duplicados = Object.entries(porRefId).filter(([, entries]) => entries.length > 1);

  console.log('Transações com entries duplicados:', duplicados.length);
  console.log('');

  // Coletar entries para remover (manter o primeiro, remover os outros)
  const entriesParaRemover = [];

  for (const [refId, entries] of duplicados) {
    // Ordenar por created_at e manter o primeiro
    entries.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const manter = entries[0];
    const remover = entries.slice(1);

    for (const e of remover) {
      entriesParaRemover.push(e);
    }
  }

  console.log('Entries a remover:', entriesParaRemover.length);

  // Calcular valor total
  const contaSicrediId = '10d5892d-a843-4034-8d62-9fec95b8fd56';
  let totalDebitos = 0;
  let totalCreditos = 0;

  for (const entry of entriesParaRemover) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('entry_id', entry.id)
      .eq('account_id', contaSicrediId);

    for (const item of items || []) {
      totalDebitos += parseFloat(item.debit || 0);
      totalCreditos += parseFloat(item.credit || 0);
    }
  }

  console.log('');
  console.log('Valores que serão removidos (conta Sicredi):');
  console.log('  Débitos:', totalDebitos.toFixed(2));
  console.log('  Créditos:', totalCreditos.toFixed(2));
  console.log('');

  // Agrupar por tipo para resumo
  const porTipo = {};
  for (const e of entriesParaRemover) {
    const tipo = e.entry_type || 'SEM_TIPO';
    if (!porTipo[tipo]) porTipo[tipo] = 0;
    porTipo[tipo]++;
  }

  console.log('Por tipo:');
  for (const [tipo, count] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tipo}: ${count}`);
  }

  if (!EXECUTAR) {
    console.log('');
    console.log('⚠️  SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('   Execute com --execute para remover os duplicados');
    return;
  }

  // EXECUTAR REMOÇÃO
  console.log('');
  console.log('Removendo entries duplicados...');

  let removidos = 0;
  let erros = 0;

  for (const entry of entriesParaRemover) {
    // Remover items primeiro
    const { error: itemsError } = await supabase
      .from('accounting_entry_items')
      .delete()
      .eq('entry_id', entry.id);

    if (itemsError) {
      console.log(`   ❌ Erro ao remover items de ${entry.id}: ${itemsError.message}`);
      erros++;
      continue;
    }

    // Remover entry
    const { error: entryError } = await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', entry.id);

    if (entryError) {
      console.log(`   ❌ Erro ao remover entry ${entry.id}: ${entryError.message}`);
      erros++;
      continue;
    }

    removidos++;
  }

  console.log('');
  console.log(`✅ Removidos: ${removidos} entries`);
  if (erros > 0) {
    console.log(`❌ Erros: ${erros}`);
  }

  // Verificação final
  await verificarSaldo();
}

async function verificarSaldo() {
  const contaSicrediId = '10d5892d-a843-4034-8d62-9fec95b8fd56';

  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries(entry_date)')
    .eq('account_id', contaSicrediId);

  let saldoAbertura = 0;
  let debitosJan = 0;
  let creditosJan = 0;

  for (const item of items || []) {
    const data = item.entry?.entry_date;
    const debito = parseFloat(item.debit || 0);
    const credito = parseFloat(item.credit || 0);

    if (data && data <= '2024-12-31') {
      saldoAbertura += debito - credito;
    } else if (data && data >= '2025-01-01' && data <= '2025-01-31') {
      debitosJan += debito;
      creditosJan += credito;
    }
  }

  console.log('');
  console.log('═'.repeat(100));
  console.log('VERIFICAÇÃO FINAL - SALDO BANCO SICREDI');
  console.log('═'.repeat(100));
  console.log('');
  console.log('Saldo de abertura (31/12/2024): R$', saldoAbertura.toFixed(2));
  console.log('Débitos Janeiro/2025:           R$', debitosJan.toFixed(2));
  console.log('Créditos Janeiro/2025:          R$', creditosJan.toFixed(2));
  console.log('Saldo Final (31/01/2025):       R$', (saldoAbertura + debitosJan - creditosJan).toFixed(2));
  console.log('');

  // Conferência com extrato
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('amount, transaction_type')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  let bancoEntradas = 0;
  let bancoSaidas = 0;
  for (const tx of extrato || []) {
    const valor = Math.abs(parseFloat(tx.amount));
    if (tx.transaction_type === 'credit') bancoEntradas += valor;
    else bancoSaidas += valor;
  }

  console.log('CONFERÊNCIA COM EXTRATO:');
  console.log('  Extrato - Entradas: R$', bancoEntradas.toFixed(2));
  console.log('  Contab  - Débitos:  R$', debitosJan.toFixed(2));
  console.log('  Diferença:          R$', (bancoEntradas - debitosJan).toFixed(2));
  console.log('');
  console.log('  Extrato - Saídas:   R$', bancoSaidas.toFixed(2));
  console.log('  Contab  - Créditos: R$', creditosJan.toFixed(2));
  console.log('  Diferença:          R$', (bancoSaidas - creditosJan).toFixed(2));

  if (Math.abs(bancoEntradas - debitosJan) < 0.01 && Math.abs(bancoSaidas - creditosJan) < 0.01) {
    console.log('');
    console.log('✅ BANCO E CONTABILIDADE ESTÃO BATENDO PERFEITAMENTE!');
  }
}

main().catch(console.error);
