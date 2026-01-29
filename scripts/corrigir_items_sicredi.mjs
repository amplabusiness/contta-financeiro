/**
 * CORRIGIR ITEMS BANCO SICREDI - JANEIRO/2025
 *
 * Adiciona items de crédito no Banco Sicredi para entries que não têm
 *
 * USO: node scripts/corrigir_items_sicredi.mjs [--execute]
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
  const contaSicrediId = '10d5892d-a843-4034-8d62-9fec95b8fd56';

  console.log('═'.repeat(100));
  console.log('CORRIGIR ITEMS BANCO SICREDI - JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');

  if (!EXECUTAR) {
    console.log('🔍 MODO SIMULAÇÃO - Use --execute para aplicar as correções');
    console.log('');
  }

  // 1. Buscar entries vinculados a transações bancárias de débito (saída)
  const { data: txDebito } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount')
    .eq('transaction_type', 'debit')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  const txDebitoIds = new Set((txDebito || []).map(t => t.id));
  const txDebitoMap = new Map((txDebito || []).map(t => [t.id, t]));

  // 2. Buscar entries vinculados a essas transações
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, reference_id')
    .eq('reference_type', 'bank_transaction')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  // Filtrar apenas entries de transações de débito
  const entriesDebito = (entries || []).filter(e => txDebitoIds.has(e.reference_id));

  console.log(`Entries de transações de débito: ${entriesDebito.length}`);

  // 3. Verificar quais entries NÃO têm item na conta Sicredi
  const { data: itemsSicredi } = await supabase
    .from('accounting_entry_items')
    .select('entry_id')
    .eq('account_id', contaSicrediId);

  const entryIdsComItemSicredi = new Set((itemsSicredi || []).map(i => i.entry_id));

  const entriesSemItemSicredi = entriesDebito.filter(e => !entryIdsComItemSicredi.has(e.id));

  console.log(`Entries SEM item na conta Sicredi: ${entriesSemItemSicredi.length}`);
  console.log('');

  if (entriesSemItemSicredi.length === 0) {
    console.log('✅ Todos os entries já têm item na conta Sicredi');
    return;
  }

  // Calcular valor total
  let valorTotal = 0;
  for (const entry of entriesSemItemSicredi) {
    const tx = txDebitoMap.get(entry.reference_id);
    if (tx) {
      valorTotal += Math.abs(parseFloat(tx.amount));
    }
  }

  console.log(`Valor total a adicionar (créditos): R$ ${valorTotal.toFixed(2)}`);
  console.log('');

  // Mostrar alguns exemplos
  console.log('EXEMPLOS DOS ENTRIES A CORRIGIR:');
  console.log('-'.repeat(80));
  for (const entry of entriesSemItemSicredi.slice(0, 10)) {
    const tx = txDebitoMap.get(entry.reference_id);
    const valor = tx ? Math.abs(parseFloat(tx.amount)) : 0;
    console.log(`  ${entry.entry_date} | R$ ${valor.toFixed(2).padStart(10)} | ${entry.description?.substring(0, 50)}`);
  }
  if (entriesSemItemSicredi.length > 10) {
    console.log(`  ... e mais ${entriesSemItemSicredi.length - 10} entries`);
  }
  console.log('');

  if (!EXECUTAR) {
    console.log('⚠️  SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('   Execute com --execute para adicionar os items');
    return;
  }

  // EXECUTAR CORREÇÃO
  console.log('Adicionando items de crédito na conta Sicredi...');
  console.log('');

  let adicionados = 0;
  let erros = 0;

  for (const entry of entriesSemItemSicredi) {
    const tx = txDebitoMap.get(entry.reference_id);
    if (!tx) {
      console.log(`   ⚠️ Transação não encontrada para entry ${entry.id}`);
      erros++;
      continue;
    }

    const valor = Math.abs(parseFloat(tx.amount));

    // Adicionar item de crédito no Banco Sicredi
    const { error } = await supabase
      .from('accounting_entry_items')
      .insert({
        entry_id: entry.id,
        account_id: contaSicrediId,
        debit: 0,
        credit: valor,
        history: `Saída banco - ${tx.description?.substring(0, 50)}`
      });

    if (error) {
      console.log(`   ❌ Erro ao adicionar item: ${error.message}`);
      erros++;
      continue;
    }

    adicionados++;
  }

  console.log('');
  console.log(`✅ Adicionados: ${adicionados} items`);
  if (erros > 0) {
    console.log(`❌ Erros: ${erros}`);
  }

  // Verificação final
  await verificarSaldo(contaSicrediId);
}

async function verificarSaldo(contaSicrediId) {
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
