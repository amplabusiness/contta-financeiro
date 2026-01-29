/**
 * Teste rápido de integridade - Janeiro 2025
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
  console.log('═'.repeat(80));
  console.log('TESTE RÁPIDO DE INTEGRIDADE - JANEIRO 2025');
  console.log('═'.repeat(80));

  // 1. Contar entries de janeiro
  const { count: totalEntries } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true })
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log(`\n📊 Total de entries em janeiro/2025: ${totalEntries}`);

  // 2. Verificar entries desbalanceados
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  let desbalanceados = 0;
  let orfaos = 0;

  for (const entry of entries || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('entry_id', entry.id);

    if (!items || items.length === 0) {
      orfaos++;
      continue;
    }

    const totalDebitos = items.reduce((sum, i) => sum + Number(i.debit || 0), 0);
    const totalCreditos = items.reduce((sum, i) => sum + Number(i.credit || 0), 0);

    if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
      desbalanceados++;
      console.log(`\n❌ Desbalanceado: ${entry.entry_date} | ${entry.description?.substring(0, 50)}`);
      console.log(`   D: ${totalDebitos.toFixed(2)} | C: ${totalCreditos.toFixed(2)}`);
    }
  }

  // 3. Saldo do Banco Sicredi
  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  if (contaBanco) {
    const { data: itemsBanco } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit, entry_id')
      .eq('account_id', contaBanco.id);

    // Filtrar por entries de janeiro
    let saldoInicial = 0;
    let movimentoDebito = 0;
    let movimentoCredito = 0;

    for (const item of itemsBanco || []) {
      const { data: entry } = await supabase
        .from('accounting_entries')
        .select('entry_date, entry_type')
        .eq('id', item.entry_id)
        .single();

      if (!entry) continue;

      if (entry.entry_type === 'SALDO_INICIAL') {
        saldoInicial += Number(item.debit || 0) - Number(item.credit || 0);
      } else if (entry.entry_date >= '2025-01-01' && entry.entry_date <= '2025-01-31') {
        movimentoDebito += Number(item.debit || 0);
        movimentoCredito += Number(item.credit || 0);
      }
    }

    const saldoFinal = saldoInicial + movimentoDebito - movimentoCredito;

    console.log('\n' + '─'.repeat(80));
    console.log('SALDO BANCO SICREDI (1.1.1.05)');
    console.log('─'.repeat(80));
    console.log(`Saldo Inicial:     R$ ${saldoInicial.toFixed(2)}`);
    console.log(`(+) Entradas:      R$ ${movimentoDebito.toFixed(2)}`);
    console.log(`(-) Saídas:        R$ ${movimentoCredito.toFixed(2)}`);
    console.log(`= Saldo Final:     R$ ${saldoFinal.toFixed(2)}`);
  }

  // 4. Resumo
  console.log('\n' + '═'.repeat(80));
  console.log('RESUMO');
  console.log('═'.repeat(80));
  console.log(`Total entries janeiro/2025: ${totalEntries}`);
  console.log(`Desbalanceados: ${desbalanceados}`);
  console.log(`Órfãos (sem items): ${orfaos}`);

  if (desbalanceados === 0 && orfaos === 0) {
    console.log('\n✅ INTEGRIDADE OK - Todos os lançamentos estão corretos!');
  } else {
    console.log('\n⚠️  Há problemas a corrigir');
  }

  console.log('═'.repeat(80));
}

main().catch(console.error);
