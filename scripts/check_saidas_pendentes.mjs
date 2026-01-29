/**
 * CHECK SAÍDAS PENDENTES - JANEIRO/2025
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
  // Buscar transações de saída (débito) do extrato
  const { data: saidas } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, status')
    .eq('transaction_type', 'debit')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  // Agrupar por status
  const porStatus = { pending: { count: 0, valor: 0 }, reconciled: { count: 0, valor: 0 } };

  for (const tx of saidas || []) {
    const status = tx.status || 'pending';
    if (!porStatus[status]) porStatus[status] = { count: 0, valor: 0 };
    porStatus[status].count++;
    porStatus[status].valor += Math.abs(parseFloat(tx.amount));
  }

  console.log('TRANSAÇÕES DE SAÍDA DO EXTRATO - JANEIRO/2025');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Por status:');
  for (const [status, dados] of Object.entries(porStatus)) {
    console.log(`  ${status}: ${dados.count} transações = R$ ${dados.valor.toFixed(2)}`);
  }

  const total = porStatus.pending.valor + porStatus.reconciled.valor;
  console.log('');
  console.log(`Total saídas: ${saidas?.length || 0} transações = R$ ${total.toFixed(2)}`);
  console.log('');
  console.log(`✅ Reconciliadas (com lançamento): ${porStatus.reconciled.count} = R$ ${porStatus.reconciled.valor.toFixed(2)}`);
  console.log(`⚠️  Pendentes (SEM lançamento): ${porStatus.pending.count} = R$ ${porStatus.pending.valor.toFixed(2)}`);
  console.log('');

  // Mostrar detalhes das pendentes
  const pendentes = (saidas || []).filter(tx => tx.status === 'pending');

  console.log('DETALHES DAS SAÍDAS PENDENTES:');
  console.log('-'.repeat(80));

  for (const tx of pendentes.slice(0, 30)) {
    const valor = Math.abs(parseFloat(tx.amount));
    console.log(`${tx.transaction_date} | R$ ${valor.toFixed(2).padStart(10)} | ${tx.description.substring(0, 50)}`);
  }
  if (pendentes.length > 30) {
    console.log(`... e mais ${pendentes.length - 30} transações`);
  }
}

main().catch(console.error);
