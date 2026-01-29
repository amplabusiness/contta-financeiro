/**
 * VERIFICAR SALDO BANCO SICREDI
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
  console.log('VERIFICAÇÃO DE SALDO - BANCO SICREDI (1.1.1.05)');
  console.log('═'.repeat(80));
  console.log('');

  // Buscar conta Banco Sicredi
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, opening_balance')
    .eq('code', '1.1.1.05')
    .single();

  if (!contaSicredi) {
    console.log('❌ Conta Banco Sicredi não encontrada');
    return;
  }

  const saldoInicial = parseFloat(contaSicredi.opening_balance) || 0;
  console.log(`Saldo Inicial (opening_balance): R$ ${saldoInicial.toFixed(2)}`);

  // Buscar movimentação do razão em janeiro/2025
  const { data: razao } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries!inner(entry_date)')
    .eq('account_id', contaSicredi.id);

  const razaoJan = (razao || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  let debitos = 0;
  let creditos = 0;
  for (const item of razaoJan) {
    debitos += parseFloat(item.debit) || 0;
    creditos += parseFloat(item.credit) || 0;
  }

  const movimentoJan = debitos - creditos;
  const saldoFinalContabil = saldoInicial + movimentoJan;

  console.log('');
  console.log('Movimento Janeiro/2025 (Contabilidade):');
  console.log(`  Débitos (entradas):  R$ ${debitos.toFixed(2)}`);
  console.log(`  Créditos (saídas):   R$ ${creditos.toFixed(2)}`);
  console.log(`  Movimento líquido:   R$ ${movimentoJan.toFixed(2)}`);
  console.log('');
  console.log(`Saldo Final Contábil:  R$ ${saldoFinalContabil.toFixed(2)}`);

  // Buscar saldo do extrato
  console.log('');
  console.log('-'.repeat(80));
  console.log('');

  // Verificar se há campo balance nas transações
  const { data: txComBalance } = await supabase
    .from('bank_transactions')
    .select('transaction_date, balance, description')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .not('balance', 'is', null)
    .order('transaction_date', { ascending: false })
    .limit(5);

  if (txComBalance && txComBalance.length > 0) {
    console.log('Últimos saldos do extrato:');
    for (const tx of txComBalance) {
      console.log(`  ${tx.transaction_date} | R$ ${parseFloat(tx.balance).toFixed(2)} | ${tx.description.substring(0, 40)}`);
    }

    const saldoExtrato = parseFloat(txComBalance[0].balance);
    console.log('');
    console.log(`Saldo Final Extrato:   R$ ${saldoExtrato.toFixed(2)}`);
    console.log(`Saldo Final Contábil:  R$ ${saldoFinalContabil.toFixed(2)}`);
    console.log('');

    const diferenca = saldoFinalContabil - saldoExtrato;
    if (Math.abs(diferenca) < 0.01) {
      console.log('✅ SALDOS BATEM PERFEITAMENTE!');
    } else {
      console.log(`❌ DIFERENÇA: R$ ${diferenca.toFixed(2)}`);
    }
  } else {
    console.log('⚠️ Campo balance não disponível nas transações');

    // Calcular saldo pelo movimento do extrato
    const { data: todasTx } = await supabase
      .from('bank_transactions')
      .select('amount, transaction_type')
      .gte('transaction_date', '2025-01-01')
      .lte('transaction_date', '2025-01-31');

    let extratoEntradas = 0;
    let extratoSaidas = 0;
    for (const tx of todasTx || []) {
      const valor = Math.abs(parseFloat(tx.amount));
      if (tx.transaction_type === 'credit') extratoEntradas += valor;
      else extratoSaidas += valor;
    }

    const movimentoExtrato = extratoEntradas - extratoSaidas;

    console.log('');
    console.log('Movimento Janeiro/2025 (Extrato):');
    console.log(`  Entradas: R$ ${extratoEntradas.toFixed(2)}`);
    console.log(`  Saídas:   R$ ${extratoSaidas.toFixed(2)}`);
    console.log(`  Movimento: R$ ${movimentoExtrato.toFixed(2)}`);
    console.log('');

    const difMovimento = movimentoJan - movimentoExtrato;
    if (Math.abs(difMovimento) < 0.01) {
      console.log('✅ MOVIMENTOS BATEM! (Saldo depende do saldo inicial correto)');
    } else {
      console.log(`❌ DIFERENÇA NO MOVIMENTO: R$ ${difMovimento.toFixed(2)}`);
    }
  }
}

main().catch(console.error);
