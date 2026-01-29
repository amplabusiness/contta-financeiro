/**
 * LANÇAR TARIFAS BANCÁRIAS FALTANTES - JANEIRO/2025
 *
 * Cria lançamentos para as tarifas bancárias que estão no extrato
 * mas não têm lançamento contábil vinculado
 *
 * USO: node scripts/lancar_tarifas_faltantes.mjs [--execute]
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

// Mapeamento de tarifas para contas analíticas
function classificarTarifa(descricao) {
  const desc = descricao.toUpperCase();

  if (desc.includes('MANUTENCAO DE TITULOS')) {
    return { conta: '4.1.3.02.01', nome: 'Manutenção de Títulos' };
  }
  if (desc.includes('TARIFA COM R LIQUIDACAO') || desc.includes('TARIFA LIQUIDACAO')) {
    return { conta: '4.1.3.02.02', nome: 'Tarifa Liquidação Cobrança' };
  }
  if (desc.includes('CESTA DE RELACIONAMENTO')) {
    return { conta: '4.1.3.02.03', nome: 'Cesta de Relacionamento' };
  }
  // Fallback
  return { conta: '4.1.3.02.99', nome: 'Outras Tarifas Bancárias' };
}

async function buscarConta(code) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .single();
  return data;
}

async function main() {
  console.log('═'.repeat(100));
  console.log('LANÇAR TARIFAS BANCÁRIAS FALTANTES - JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');

  if (!EXECUTAR) {
    console.log('🔍 MODO SIMULAÇÃO - Use --execute para criar os lançamentos');
    console.log('');
  }

  // Buscar conta Banco Sicredi
  const contaBanco = await buscarConta('1.1.1.05');
  if (!contaBanco) {
    console.log('❌ Conta Banco Sicredi não encontrada');
    return;
  }

  // Buscar transações de saída (tarifas) que são reconciled mas sem entry
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount')
    .eq('transaction_type', 'debit')
    .eq('status', 'reconciled')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .or('description.ilike.%TARIFA%,description.ilike.%MANUTENCAO%,description.ilike.%CESTA%');

  // Buscar entries existentes
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, reference_id')
    .eq('reference_type', 'bank_transaction')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const idsComEntry = new Set((entries || []).map(e => e.reference_id).filter(Boolean));

  // Filtrar apenas as que não têm entry
  const semEntry = (extrato || []).filter(tx => !idsComEntry.has(tx.id));

  console.log(`Tarifas sem lançamento: ${semEntry.length}`);
  console.log('');

  if (semEntry.length === 0) {
    console.log('✅ Todas as tarifas já têm lançamento contábil');
    return;
  }

  // Mostrar resumo
  let total = 0;
  console.log('TARIFAS A LANÇAR:');
  console.log('-'.repeat(80));
  for (const tx of semEntry) {
    const valor = Math.abs(parseFloat(tx.amount));
    const classif = classificarTarifa(tx.description);
    total += valor;
    console.log(`${tx.transaction_date} | R$ ${valor.toFixed(2).padStart(8)} | ${classif.conta} | ${tx.description.substring(0, 40)}`);
  }
  console.log('-'.repeat(80));
  console.log(`TOTAL: R$ ${total.toFixed(2)}`);
  console.log('');

  if (!EXECUTAR) {
    console.log('⚠️  SIMULAÇÃO - Nenhum lançamento foi criado');
    console.log('   Execute com --execute para criar os lançamentos');
    return;
  }

  // Cache de contas
  const cacheContas = { '1.1.1.05': contaBanco };

  // Criar lançamentos
  console.log('Criando lançamentos...');

  let criados = 0;
  let erros = 0;

  for (const tx of semEntry) {
    const valor = Math.abs(parseFloat(tx.amount));
    const classif = classificarTarifa(tx.description);

    // Buscar conta de débito (despesa)
    if (!cacheContas[classif.conta]) {
      cacheContas[classif.conta] = await buscarConta(classif.conta);
    }
    const contaDespesa = cacheContas[classif.conta];

    if (!contaDespesa) {
      console.log(`   ❌ Conta ${classif.conta} não encontrada`);
      erros++;
      continue;
    }

    // Criar entry
    const { data: entry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: tx.transaction_date,
        competence_date: tx.transaction_date,
        description: tx.description,
        entry_type: 'DESPESA_BANCARIA',
        is_draft: false,
        reference_type: 'bank_transaction',
        reference_id: tx.id
      })
      .select()
      .single();

    if (entryError) {
      console.log(`   ❌ Erro ao criar entry: ${entryError.message}`);
      erros++;
      continue;
    }

    // Criar items
    const { error: itemsError } = await supabase
      .from('accounting_entry_items')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaDespesa.id,
          debit: valor,
          credit: 0,
          history: classif.nome
        },
        {
          entry_id: entry.id,
          account_id: contaBanco.id,
          debit: 0,
          credit: valor,
          history: `Tarifa bancária - ${tx.description.substring(0, 30)}`
        }
      ]);

    if (itemsError) {
      console.log(`   ❌ Erro ao criar items: ${itemsError.message}`);
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      erros++;
      continue;
    }

    criados++;
  }

  console.log('');
  console.log(`✅ Criados: ${criados} lançamentos`);
  if (erros > 0) {
    console.log(`❌ Erros: ${erros}`);
  }

  // Verificação final
  console.log('');
  console.log('═'.repeat(100));
  console.log('VERIFICAÇÃO FINAL');
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
    .eq('account_id', contaBanco.id);

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
