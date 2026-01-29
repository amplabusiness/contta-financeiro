import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  // Total de transações por mês
  console.log('📊 TRANSAÇÕES BANCÁRIAS POR MÊS (2025):');
  console.log('─'.repeat(60));

  for (let mes = 1; mes <= 12; mes++) {
    const mesStr = mes.toString().padStart(2, '0');
    const { count } = await supabase
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })
      .gte('transaction_date', `2025-${mesStr}-01`)
      .lte('transaction_date', `2025-${mesStr}-31`);

    console.log(`  ${mesStr}/2025: ${count || 0} transações`);
  }

  // Verificar transações de fevereiro com "LIQ" ou "COBRANCA"
  console.log('\n\n📋 TRANSAÇÕES FEV/2025 com "LIQ" ou "COBRANCA":');
  console.log('─'.repeat(80));

  const { data: liq } = await supabase
    .from('bank_transactions')
    .select('transaction_date, description, amount, transaction_type')
    .gte('transaction_date', '2025-02-01')
    .lte('transaction_date', '2025-02-28')
    .or('description.ilike.%LIQ%,description.ilike.%COBRANCA%')
    .order('transaction_date');

  if (liq && liq.length > 0) {
    liq.forEach(t => {
      const valor = t.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2});
      console.log(`${t.transaction_date} | ${t.transaction_type.padEnd(6)} | R$ ${valor.padStart(12)} | ${t.description.substring(0, 50)}`);
    });
  } else {
    console.log('  Nenhuma transação encontrada');
  }

  // Verificar todas as transações de crédito de fevereiro
  console.log('\n\n💰 TODOS OS CRÉDITOS FEV/2025:');
  console.log('─'.repeat(80));

  const { data: creditos } = await supabase
    .from('bank_transactions')
    .select('transaction_date, description, amount')
    .gte('transaction_date', '2025-02-01')
    .lte('transaction_date', '2025-02-28')
    .eq('transaction_type', 'credit')
    .order('amount', { ascending: false })
    .limit(20);

  if (creditos && creditos.length > 0) {
    let total = 0;
    creditos.forEach(t => {
      const valor = t.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2});
      console.log(`${t.transaction_date} | R$ ${valor.padStart(12)} | ${t.description.substring(0, 55)}`);
      total += t.amount;
    });
    console.log('─'.repeat(80));
    console.log(`TOTAL (top 20): R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  } else {
    console.log('  Nenhum crédito encontrado em Fevereiro/2025');
  }

  // Verificar quantidade total de transações
  const { count: totalTx } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true });

  const { count: totalBoletos } = await supabase
    .from('boleto_payments')
    .select('*', { count: 'exact', head: true });

  console.log('\n\n📈 RESUMO GERAL:');
  console.log('─'.repeat(40));
  console.log(`  Total bank_transactions: ${totalTx}`);
  console.log(`  Total boleto_payments: ${totalBoletos}`);
}

check();
