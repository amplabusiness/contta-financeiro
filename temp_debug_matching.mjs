import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // 1. Carregar todas as contas do plano
  const { data: accounts, error: accError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .order('code');

  if (accError) {
    console.log('Erro ao carregar contas:', accError.message);
    return;
  }

  console.log('=== CONTAS NO PLANO ===');
  console.log('Total de contas:', accounts.length);

  const accountMap = new Map();
  for (const a of accounts) {
    accountMap.set(a.id, a);
  }

  // 2. Carregar lançamentos de janeiro 2025
  const { data: periodData, error: periodError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      account_id,
      debit,
      credit,
      accounting_entries!inner(
        competence_date,
        entry_type
      )
    `)
    .gte('accounting_entries.competence_date', '2025-01-01')
    .lte('accounting_entries.competence_date', '2025-01-31')
    .neq('accounting_entries.entry_type', 'saldo_abertura');

  if (periodError) {
    console.log('Erro ao carregar lançamentos:', periodError.message);
    return;
  }

  console.log('\n=== LANÇAMENTOS DO PERÍODO (exceto saldo_abertura) ===');
  console.log('Total de linhas:', periodData.length);

  // 3. Verificar matching
  let matched = 0;
  let unmatched = 0;
  const unmatchedIds = new Set();
  const matchedAccounts = new Map();

  for (const line of periodData) {
    if (accountMap.has(line.account_id)) {
      matched++;
      const acc = accountMap.get(line.account_id);
      if (!matchedAccounts.has(line.account_id)) {
        matchedAccounts.set(line.account_id, {
          code: acc.code,
          name: acc.name,
          debits: 0,
          credits: 0
        });
      }
      const m = matchedAccounts.get(line.account_id);
      m.debits += Number(line.debit) || 0;
      m.credits += Number(line.credit) || 0;
    } else {
      unmatched++;
      unmatchedIds.add(line.account_id);
    }
  }

  console.log('\n=== RESULTADO DO MATCHING ===');
  console.log('Linhas associadas:', matched);
  console.log('Linhas NÃO associadas:', unmatched);

  if (unmatchedIds.size > 0) {
    console.log('\n=== IDs NÃO ENCONTRADOS NO PLANO ===');
    for (const id of unmatchedIds) {
      console.log('  -', id);
    }
  }

  // 4. Mostrar saldos por conta que TEM movimento
  console.log('\n=== CONTAS COM MOVIMENTO EM JANEIRO/2025 ===');
  const sorted = Array.from(matchedAccounts.values()).sort((a, b) => a.code.localeCompare(b.code));

  let totalD = 0, totalC = 0;
  for (const acc of sorted) {
    if (acc.debits > 0 || acc.credits > 0) {
      console.log(
        acc.code.padEnd(15),
        'D:', acc.debits.toFixed(2).padStart(12),
        'C:', acc.credits.toFixed(2).padStart(12),
        acc.name.substring(0, 40)
      );
      totalD += acc.debits;
      totalC += acc.credits;
    }
  }

  console.log('\n=== TOTAIS ===');
  console.log('Total Débitos:', totalD.toFixed(2));
  console.log('Total Créditos:', totalC.toFixed(2));
  console.log('Diferença:', (totalD - totalC).toFixed(2));

  // 5. Verificar lançamentos de saldo_abertura
  console.log('\n\n=== LANÇAMENTOS DE SALDO_ABERTURA JANEIRO/2025 ===');
  const { data: saldoData, error: saldoError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      account_id,
      debit,
      credit,
      accounting_entries!inner(
        competence_date,
        entry_type,
        description
      )
    `)
    .gte('accounting_entries.competence_date', '2025-01-01')
    .lte('accounting_entries.competence_date', '2025-01-31')
    .eq('accounting_entries.entry_type', 'saldo_abertura');

  if (saldoError) {
    console.log('Erro:', saldoError.message);
  } else {
    console.log('Total de linhas saldo_abertura:', saldoData?.length || 0);

    let saldoD = 0, saldoC = 0;
    for (const line of saldoData || []) {
      const acc = accountMap.get(line.account_id);
      const code = acc?.code || 'N/A';
      const name = acc?.name || 'Conta não encontrada';
      const d = Number(line.debit) || 0;
      const c = Number(line.credit) || 0;
      saldoD += d;
      saldoC += c;
      console.log(
        code.padEnd(15),
        'D:', d.toFixed(2).padStart(12),
        'C:', c.toFixed(2).padStart(12),
        name.substring(0, 40)
      );
    }
    console.log('\nTotal saldo_abertura: D:', saldoD.toFixed(2), '| C:', saldoC.toFixed(2));
  }
}

check().catch(console.error);
