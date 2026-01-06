#!/usr/bin/env node

/**
 * auto_post_bank_fees.mjs
 *
 * Cria lançamentos contábeis automáticos para tarifas bancárias
 * identificadas nas transações (ex: "TARIFA COM R LIQUIDACAO-COB000007").
 *
 * Critérios:
 * - bank_transactions.amount < 0 (saída)
 * - bank_transactions.description ILIKE '%TARIFA%' OU '%LIQUIDACAO%'
 * - Ainda sem lançamento em accounting_entries para a referência
 *
 * Lançamento criado:
 * - Tipo: 'pagamento_despesa'
 * - Débito: 4.1.3.02 (Tarifas Bancárias)
 * - Crédito: Banco (via smart-accounting)
 * - reference_type: 'bank_transaction'
 * - reference_id: bank_transactions.id
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env.local não encontrado ao lado do script.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const supabaseUrl = urlMatch?.[1];
const supabaseKey = keyMatch?.[1];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY ausentes em .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { month: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      opts.month = args[i + 1]; // Ex: 2025-01
      i++;
    }
  }
  return opts;
}

function getMonthRange(monthStr) {
  // monthStr: YYYY-MM
  if (!monthStr) return null;
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // último dia do mês
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  return { startStr, endStr };
}

async function fetchBankFees(monthRange) {
  let query = supabase
    .from('bank_transactions')
    .select('id, amount, transaction_date, description');

  // amount < 0 (saída)
  query = query.lt('amount', 0);
  // descrição contém TARIFA ou LIQUIDACAO
  query = query.or('description.ilike.%TARIFA%,description.ilike.%LIQUIDACAO%');

  if (monthRange) {
    query = query.gte('transaction_date', monthRange.startStr).lte('transaction_date', monthRange.endStr);
  }

  const { data, error } = await query.order('transaction_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function hasAccountingEntryFor(txId) {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('reference_type', 'bank_transaction')
    .eq('reference_id', String(txId))
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data?.id;
}

async function createFeeEntry(tx) {
  const amountAbs = Math.abs(Number(tx.amount || 0));
  if (!amountAbs) return { success: false, error: 'Valor zero' };

  const { data, error } = await supabase.functions.invoke('smart-accounting', {
    body: {
      action: 'create_entry',
      entry_type: 'pagamento_despesa',
      amount: amountAbs,
      date: tx.transaction_date,
      description: tx.description || 'Tarifa Bancária',
      reference_type: 'bank_transaction',
      reference_id: String(tx.id),
      expense_category: 'tarifas', // 4.1.3.02
      metadata: {
        source_module: 'AutoPostBankFees',
        origin_context: 'batch_script',
        created_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: data?.success, entryId: data?.entry_id, message: data?.message };
}

async function run() {
  try {
    const { month } = parseArgs();
    const monthRange = month ? getMonthRange(month) : null;

    console.log('🔎 Buscando tarifas bancárias...', monthRange ? `(Mês ${month})` : '(Todas)');
    const txs = await fetchBankFees(monthRange);
    if (!txs.length) {
      console.log('⚠️ Nenhuma transação de tarifa encontrada.');
      return;
    }

    let created = 0;
    for (const tx of txs) {
      const exists = await hasAccountingEntryFor(tx.id);
      if (exists) {
        console.log(`↷ Já possui lançamento: TX ${tx.id} - ${tx.transaction_date} - ${tx.description}`);
        continue;
      }
      const res = await createFeeEntry(tx);
      if (res.success) {
        created++;
        console.log(`✅ Lançamento criado (entryId=${res.entryId}): TX ${tx.id} - ${tx.transaction_date} - ${tx.description}`);
      } else {
        console.log(`❌ Falha ao criar lançamento para TX ${tx.id}: ${res.error}`);
      }
    }

    console.log(`\n📊 Concluído. Lançamentos criados: ${created}/${txs.length}`);
  } catch (err) {
    console.error('❌ Erro:', err.message || err);
    process.exit(1);
  }
}

await run();
