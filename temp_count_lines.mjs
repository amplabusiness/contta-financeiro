import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== CONTAGEM DE LINHAS DE LANÇAMENTO ===\n');

  // Contar todas as linhas de janeiro 2025
  const { count: countJan, error: countError } = await supabase
    .from('accounting_entry_lines')
    .select('id', { count: 'exact', head: true })
    .gte('accounting_entries.competence_date', '2025-01-01')
    .lte('accounting_entries.competence_date', '2025-01-31');

  console.log('Erro count (esperado se inner join não funciona com count):', countError ? countError.message : 'nenhum');

  // Buscar TODAS as linhas de janeiro e somar
  const { data: allLines, error: allError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit,
      chart_of_accounts(code, name, nature),
      accounting_entries!inner(competence_date, entry_type)
    `)
    .gte('accounting_entries.competence_date', '2025-01-01')
    .lte('accounting_entries.competence_date', '2025-01-31');

  if (allError) {
    console.log('Erro:', allError.message);
    return;
  }

  console.log('Total de linhas em Janeiro/2025:', allLines ? allLines.length : 0);

  // Agrupar por conta
  const balances = new Map();

  for (const line of allLines || []) {
    const accountCode = line.chart_of_accounts?.code || 'SEM_CONTA';
    const accountName = line.chart_of_accounts?.name || 'Sem nome';
    const nature = line.chart_of_accounts?.nature || 'DEVEDORA';
    const key = accountCode;

    if (!balances.has(key)) {
      balances.set(key, {
        code: accountCode,
        name: accountName,
        nature: nature,
        debits: 0,
        credits: 0
      });
    }

    const b = balances.get(key);
    b.debits += Number(line.debit) || 0;
    b.credits += Number(line.credit) || 0;
  }

  // Ordenar por código
  const sorted = Array.from(balances.values()).sort((a, b) => a.code.localeCompare(b.code));

  console.log('\n=== SALDOS POR CONTA JANEIRO/2025 ===');
  let totalD = 0, totalC = 0;

  for (const b of sorted) {
    if (b.debits > 0 || b.credits > 0) {
      const saldo = b.nature === 'DEVEDORA' ? (b.debits - b.credits) : (b.credits - b.debits);
      console.log(
        b.code.padEnd(15) + ' | ' +
        'D: ' + b.debits.toFixed(2).padStart(12) + ' | ' +
        'C: ' + b.credits.toFixed(2).padStart(12) + ' | ' +
        'S: ' + saldo.toFixed(2).padStart(12) + ' | ' +
        b.name.substring(0, 35)
      );
      totalD += b.debits;
      totalC += b.credits;
    }
  }

  console.log('\n=== TOTAIS ===');
  console.log('Total Débitos:  R$', totalD.toFixed(2));
  console.log('Total Créditos: R$', totalC.toFixed(2));
  console.log('Diferença:      R$', (totalD - totalC).toFixed(2));
}

check().catch(console.error);
