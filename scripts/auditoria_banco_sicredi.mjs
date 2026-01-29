/**
 * AUDITORIA BANCO SICREDI - JANEIRO/2025
 * Compara extrato bancário vs razão contábil
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('═'.repeat(100));
  console.log('AUDITORIA COMPLETA: BANCO SICREDI (1.1.1.05) - JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');

  // 1. EXTRATO BANCÁRIO
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, transaction_type, status')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  let extratoCreditos = 0;
  let extratoDebitos = 0;
  const extratoIds = new Set();

  for (const tx of extrato || []) {
    extratoIds.add(tx.id);
    if (tx.transaction_type === 'credit') {
      extratoCreditos += Math.abs(parseFloat(tx.amount));
    } else {
      extratoDebitos += Math.abs(parseFloat(tx.amount));
    }
  }

  console.log('1. EXTRATO BANCÁRIO (bank_transactions)');
  console.log('-'.repeat(60));
  console.log(`   Qtd transações:      ${extrato?.length || 0}`);
  console.log(`   Entradas (créditos): R$ ${extratoCreditos.toFixed(2)}`);
  console.log(`   Saídas (débitos):    R$ ${extratoDebitos.toFixed(2)}`);
  console.log(`   Movimento líquido:   R$ ${(extratoCreditos - extratoDebitos).toFixed(2)}`);
  console.log('');

  // Status das transações
  const porStatus = {};
  for (const tx of extrato || []) {
    porStatus[tx.status] = (porStatus[tx.status] || 0) + 1;
  }
  console.log('   Por status:');
  for (const [status, count] of Object.entries(porStatus)) {
    console.log(`     - ${status}: ${count}`);
  }
  console.log('');

  // 2. RAZÃO BANCO SICREDI
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.05')
    .single();

  const { data: razaoSicredi } = await supabase
    .from('accounting_entry_items')
    .select(`
      id, debit, credit,
      entry:accounting_entries!inner(
        id, entry_date, description, entry_type, reference_type, reference_id
      )
    `)
    .eq('account_id', contaSicredi.id);

  const razaoJan = (razaoSicredi || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  let razaoDebitos = 0;
  let razaoCreditos = 0;
  for (const item of razaoJan) {
    razaoDebitos += parseFloat(item.debit) || 0;
    razaoCreditos += parseFloat(item.credit) || 0;
  }

  console.log('2. RAZÃO CONTÁBIL - Banco Sicredi (1.1.1.05)');
  console.log('-'.repeat(60));
  console.log(`   Qtd lançamentos:     ${razaoJan.length}`);
  console.log(`   Débitos (entradas):  R$ ${razaoDebitos.toFixed(2)}`);
  console.log(`   Créditos (saídas):   R$ ${razaoCreditos.toFixed(2)}`);
  console.log(`   Movimento líquido:   R$ ${(razaoDebitos - razaoCreditos).toFixed(2)}`);
  console.log('');

  // Por entry_type
  const porTipo = {};
  for (const item of razaoJan) {
    const tipo = item.entry?.entry_type || 'SEM_TIPO';
    if (!porTipo[tipo]) porTipo[tipo] = { count: 0, debito: 0, credito: 0 };
    porTipo[tipo].count++;
    porTipo[tipo].debito += parseFloat(item.debit) || 0;
    porTipo[tipo].credito += parseFloat(item.credit) || 0;
  }

  console.log('   Por entry_type:');
  for (const [tipo, dados] of Object.entries(porTipo).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`     ${tipo}: ${dados.count} | D: R$ ${dados.debito.toFixed(2)} | C: R$ ${dados.credito.toFixed(2)}`);
  }
  console.log('');

  // 3. ANÁLISE DE DIFERENÇAS
  console.log('3. ANÁLISE DE DIFERENÇAS');
  console.log('-'.repeat(60));
  console.log(`   Diferença qtd:       ${(extrato?.length || 0) - razaoJan.length} (extrato - razão)`);
  console.log(`   Diferença entradas:  R$ ${(extratoCreditos - razaoDebitos).toFixed(2)}`);
  console.log(`   Diferença saídas:    R$ ${(extratoDebitos - razaoCreditos).toFixed(2)}`);
  console.log('');

  // 4. LANÇAMENTOS SEM TRANSAÇÃO BANCÁRIA CORRESPONDENTE
  const semBankTx = razaoJan.filter(item => {
    const refType = item.entry?.reference_type;
    const refId = item.entry?.reference_id;
    // Se não é bank_transaction ou não tem referência
    return refType !== 'bank_transaction' || !refId || !extratoIds.has(refId);
  });

  console.log('4. LANÇAMENTOS NO RAZÃO SEM TRANSAÇÃO BANCÁRIA');
  console.log('-'.repeat(60));
  console.log(`   Total: ${semBankTx.length} lançamentos`);

  // Agrupar
  const semBankPorTipo = {};
  for (const item of semBankTx) {
    const tipo = item.entry?.entry_type || 'SEM_TIPO';
    if (!semBankPorTipo[tipo]) semBankPorTipo[tipo] = { count: 0, debito: 0, credito: 0, exemplos: [] };
    semBankPorTipo[tipo].count++;
    semBankPorTipo[tipo].debito += parseFloat(item.debit) || 0;
    semBankPorTipo[tipo].credito += parseFloat(item.credit) || 0;
    if (semBankPorTipo[tipo].exemplos.length < 3) {
      semBankPorTipo[tipo].exemplos.push(item.entry?.description?.substring(0, 50));
    }
  }

  console.log('');
  for (const [tipo, dados] of Object.entries(semBankPorTipo).sort((a, b) => b[1].credito - a[1].credito)) {
    console.log(`   ${tipo}: ${dados.count} lanç | C: R$ ${dados.credito.toFixed(2)} | D: R$ ${dados.debito.toFixed(2)}`);
    for (const ex of dados.exemplos) {
      console.log(`      - ${ex}`);
    }
  }

  // 5. TRANSAÇÕES BANCÁRIAS SEM LANÇAMENTO CONTÁBIL
  const comLancamento = new Set(
    razaoJan
      .filter(i => i.entry?.reference_type === 'bank_transaction' && i.entry?.reference_id)
      .map(i => i.entry.reference_id)
  );

  const semLancamento = (extrato || []).filter(tx => !comLancamento.has(tx.id));

  console.log('');
  console.log('5. TRANSAÇÕES DO EXTRATO SEM LANÇAMENTO CONTÁBIL');
  console.log('-'.repeat(60));
  console.log(`   Total: ${semLancamento.length} transações`);

  if (semLancamento.length > 0) {
    let totalSemLanc = 0;
    console.log('');
    for (const tx of semLancamento.slice(0, 20)) {
      const valor = Math.abs(parseFloat(tx.amount));
      totalSemLanc += valor;
      const tipo = tx.transaction_type === 'credit' ? 'ENT' : 'SAI';
      console.log(`   ${tx.transaction_date} | ${tipo} | R$ ${valor.toFixed(2).padStart(10)} | ${tx.description.substring(0, 45)}`);
    }
    if (semLancamento.length > 20) {
      console.log(`   ... e mais ${semLancamento.length - 20} transações`);
    }
    console.log(`   TOTAL SEM LANÇAMENTO: R$ ${totalSemLanc.toFixed(2)}`);
  }

  // 6. RESUMO
  console.log('');
  console.log('═'.repeat(100));
  console.log('RESUMO DA AUDITORIA');
  console.log('═'.repeat(100));

  const entradaOk = Math.abs(extratoCreditos - razaoDebitos) < 0.01;
  const saidaDiferenca = razaoCreditos - extratoDebitos;

  console.log(`   ✅ Entradas: ${entradaOk ? 'OK' : 'DIFERENÇA'} (Extrato: R$ ${extratoCreditos.toFixed(2)} | Razão: R$ ${razaoDebitos.toFixed(2)})`);
  console.log(`   ⚠️  Saídas:   DIFERENÇA de R$ ${saidaDiferenca.toFixed(2)}`);
  console.log(`      Extrato: R$ ${extratoDebitos.toFixed(2)}`);
  console.log(`      Razão:   R$ ${razaoCreditos.toFixed(2)}`);
  console.log('');
  console.log('   POSSÍVEL CAUSA: Lançamentos duplicados ou entries sem transação bancária correspondente');
}

main().catch(console.error);
