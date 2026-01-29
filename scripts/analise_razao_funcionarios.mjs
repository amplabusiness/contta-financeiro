/**
 * DR. CÍCERO / MCP - ANÁLISE DO RAZÃO DE FUNCIONÁRIOS
 *
 * Verifica os lançamentos de salários por funcionário
 * - Adiantamento: dia 14 ou 15
 * - Pagamento: dia 29 ou 30
 * - Terceirizados: dia 10
 *
 * Objetivo: Verificar se no último dia do mês o saldo está R$ 0,00
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Funcionários CLT da Ampla
const FUNCIONARIOS_CLT = [
  'JOSIMAR',
  'ROSEMEIRE',
  'TAYLANE',
  'LILIAN',
  'FABIANA',
  'DEUZA',
  'THAYNARA'
];

// Terceirizados PJ (pago dia 10)
const TERCEIRIZADOS = [
  'DANIEL RODRIGUES',
  'FABRICIO',
  'ANDREA',
  'CORACI',
  'ALEXSSANDRA'
];

async function main() {
  console.log('═'.repeat(100));
  console.log('ANÁLISE DO RAZÃO DE FUNCIONÁRIOS - JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');
  console.log('Verificando: Adiantamento (dia 14/15) + Pagamento (dia 29/30) = Saldo 0');
  console.log('');

  // 1. Buscar conta de Salários a Pagar (passivo)
  const { data: contaSalariosPagar } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '2.1.2.01')
    .single();

  console.log(`Conta Salários a Pagar: ${contaSalariosPagar?.code} - ${contaSalariosPagar?.name}`);

  // 2. Buscar lançamentos na conta 2.1.2.01 em janeiro/2025
  const { data: itemsPassivo } = await supabase
    .from('accounting_entry_items')
    .select(`
      id, debit, credit,
      entry:accounting_entries!inner (id, entry_date, description, entry_type)
    `)
    .eq('account_id', contaSalariosPagar?.id);

  const lancamentosPassivoJan = (itemsPassivo || []).filter(i => {
    const data = i.entry?.entry_date;
    return data >= '2025-01-01' && data <= '2025-01-31';
  });

  console.log(`Lançamentos em 2.1.2.01 (jan/2025): ${lancamentosPassivoJan.length}`);

  if (lancamentosPassivoJan.length > 0) {
    console.log('');
    console.log('RAZÃO DA CONTA 2.1.2.01 - Salários a Pagar:');
    console.log('-'.repeat(100));

    let totalDebito = 0;
    let totalCredito = 0;

    for (const item of lancamentosPassivoJan.sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date))) {
      const dia = new Date(item.entry.entry_date).getDate();
      const debito = parseFloat(item.debit) || 0;
      const credito = parseFloat(item.credit) || 0;
      totalDebito += debito;
      totalCredito += credito;

      let tipoOp = credito > 0 ? 'PROVISÃO' : 'PAGAMENTO';
      console.log(`${item.entry.entry_date} (dia ${dia}) | ${tipoOp.padEnd(10)} | D: ${debito.toFixed(2).padStart(10)} | C: ${credito.toFixed(2).padStart(10)}`);
      console.log(`   ${item.entry.description?.substring(0, 80)}`);
    }

    const saldoPassivo = totalCredito - totalDebito;
    console.log('-'.repeat(100));
    console.log(`TOTAL: Débito R$ ${totalDebito.toFixed(2)} | Crédito R$ ${totalCredito.toFixed(2)} | Saldo: R$ ${saldoPassivo.toFixed(2)}`);
    console.log('');
  }

  // 3. Buscar transações bancárias com nomes de funcionários
  console.log('═'.repeat(100));
  console.log('TRANSAÇÕES BANCÁRIAS POR FUNCIONÁRIO CLT:');
  console.log('═'.repeat(100));
  console.log('');

  for (const func of FUNCIONARIOS_CLT) {
    const { data: txs } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount, status, journal_entry_id')
      .gte('transaction_date', '2025-01-01')
      .lte('transaction_date', '2025-01-31')
      .ilike('description', `%${func}%`)
      .order('transaction_date');

    if (txs && txs.length > 0) {
      console.log(`👤 ${func}:`);
      let total = 0;

      for (const tx of txs) {
        const dia = new Date(tx.transaction_date).getDate();
        let tipoData = '';

        if (dia >= 14 && dia <= 15) tipoData = '← ADIANTAMENTO';
        else if (dia >= 29 || dia <= 2) tipoData = '← PAGAMENTO';
        else if (dia >= 9 && dia <= 11) tipoData = '← TERCEIRIZADO?';

        const valor = Math.abs(parseFloat(tx.amount));
        total += valor;

        console.log(`   ${tx.transaction_date} (dia ${String(dia).padStart(2)}) | R$ ${valor.toFixed(2).padStart(10)} | ${tx.status.padEnd(10)} ${tipoData}`);
      }
      console.log(`   TOTAL: R$ ${total.toFixed(2)}`);
      console.log('');
    }
  }

  // 4. Terceirizados (dia 10)
  console.log('═'.repeat(100));
  console.log('TRANSAÇÕES BANCÁRIAS - TERCEIRIZADOS (PJ - dia 10):');
  console.log('═'.repeat(100));
  console.log('');

  for (const terc of TERCEIRIZADOS) {
    const { data: txs } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount, status')
      .gte('transaction_date', '2025-01-01')
      .lte('transaction_date', '2025-01-31')
      .ilike('description', `%${terc}%`)
      .order('transaction_date');

    if (txs && txs.length > 0) {
      console.log(`📋 ${terc}:`);

      for (const tx of txs) {
        const dia = new Date(tx.transaction_date).getDate();
        const valor = Math.abs(parseFloat(tx.amount));
        console.log(`   ${tx.transaction_date} (dia ${dia}) | R$ ${valor.toFixed(2).padStart(10)} | ${tx.status}`);
      }
      console.log('');
    }
  }

  // 5. Verificar entries de despesa com pessoal
  console.log('═'.repeat(100));
  console.log('LANÇAMENTOS DE DESPESAS COM PESSOAL (4.1.1.x):');
  console.log('═'.repeat(100));
  console.log('');

  const { data: contasDespPessoal } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '4.1.1.01%')
    .eq('is_analytical', true);

  let totalDespPessoalJan = 0;

  for (const conta of contasDespPessoal || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select(`
        debit, credit,
        entry:accounting_entries!inner (entry_date, description)
      `)
      .eq('account_id', conta.id);

    const itemsJan = (items || []).filter(i => {
      const data = i.entry?.entry_date;
      return data >= '2025-01-01' && data <= '2025-01-31';
    });

    if (itemsJan.length > 0) {
      let totalConta = 0;
      for (const item of itemsJan) {
        totalConta += parseFloat(item.debit) || 0;
      }
      if (totalConta > 0) {
        console.log(`${conta.code} - ${conta.name}: R$ ${totalConta.toFixed(2)}`);
        totalDespPessoalJan += totalConta;
      }
    }
  }

  console.log('-'.repeat(50));
  console.log(`TOTAL DESPESAS COM PESSOAL JAN/2025: R$ ${totalDespPessoalJan.toFixed(2)}`);
  console.log('');

  console.log('═'.repeat(100));
  console.log('FIM DA ANÁLISE');
  console.log('═'.repeat(100));
}

main().catch(console.error);
