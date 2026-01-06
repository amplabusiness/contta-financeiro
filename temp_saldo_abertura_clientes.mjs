import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== VERIFICANDO SALDO DE ABERTURA DE CLIENTES ===\n');

  // Buscar lançamentos anteriores a janeiro/2025 que debitam clientes a receber
  const { data: anteriores, error: antError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, account_id, debit, credit, description,
      chart_of_accounts(code, name),
      accounting_entries!inner(id, competence_date, entry_type, description)
    `)
    .lt('accounting_entries.competence_date', '2025-01-01')
    .gt('debit', 0);

  if (antError) {
    console.log('Erro:', antError.message);
    return;
  }

  // Filtrar apenas conta 1.1.2.01 (Clientes a Receber)
  const clientesReceber = (anteriores || []).filter(l =>
    l.chart_of_accounts?.code?.startsWith('1.1.2.01')
  );

  console.log('Lançamentos em Clientes a Receber ANTES de Jan/2025:', clientesReceber.length);

  let totalDebitos = 0;
  const byEntryType = new Map();

  for (const l of clientesReceber) {
    const d = Number(l.debit) || 0;
    totalDebitos += d;

    const entryType = l.accounting_entries?.entry_type || 'N/A';
    if (!byEntryType.has(entryType)) {
      byEntryType.set(entryType, { count: 0, total: 0 });
    }
    const t = byEntryType.get(entryType);
    t.count++;
    t.total += d;
  }

  console.log('\n=== POR TIPO DE LANÇAMENTO ===');
  for (const [type, info] of byEntryType) {
    console.log(type.padEnd(25), 'Qtd:', info.count, '| Total: R$', info.total.toFixed(2));
  }

  console.log('\n=== TOTAL DÉBITOS EM CLIENTES (antes Jan/2025) ===');
  console.log('R$', totalDebitos.toFixed(2));

  // Agora verificar os créditos (recebimentos anteriores)
  const { data: creditosAnt, error: credError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, account_id, debit, credit,
      chart_of_accounts(code, name),
      accounting_entries!inner(competence_date, entry_type)
    `)
    .lt('accounting_entries.competence_date', '2025-01-01')
    .gt('credit', 0);

  if (credError) {
    console.log('Erro créditos:', credError.message);
    return;
  }

  const creditosClientes = (creditosAnt || []).filter(l =>
    l.chart_of_accounts?.code?.startsWith('1.1.2.01')
  );

  let totalCreditos = 0;
  for (const l of creditosClientes) {
    totalCreditos += Number(l.credit) || 0;
  }

  console.log('\n=== TOTAL CRÉDITOS EM CLIENTES (antes Jan/2025) ===');
  console.log('R$', totalCreditos.toFixed(2));

  console.log('\n=== SALDO DE ABERTURA CALCULADO ===');
  console.log('Débitos - Créditos = R$', (totalDebitos - totalCreditos).toFixed(2));

  // Verificar se existe lançamento de saldo_abertura específico para clientes
  console.log('\n\n=== LANÇAMENTOS saldo_abertura EM CONTAS 5.x ===');
  const { data: saldosAbertura, error: saldoErr } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit,
      chart_of_accounts(code, name),
      accounting_entries!inner(competence_date, entry_type, description)
    `)
    .eq('accounting_entries.entry_type', 'saldo_abertura');

  if (saldoErr) {
    console.log('Erro:', saldoErr.message);
    return;
  }

  // Filtrar contas que começam com 5 (contrapartida de saldo de abertura)
  const contas5 = (saldosAbertura || []).filter(l =>
    l.chart_of_accounts?.code?.startsWith('5')
  );

  console.log('Lançamentos em contas 5.x:', contas5.length);

  let totalContas5Credito = 0;
  for (const l of contas5) {
    const c = Number(l.credit) || 0;
    if (c > 0) {
      totalContas5Credito += c;
      console.log(
        l.chart_of_accounts?.code?.padEnd(15),
        'C:', c.toFixed(2).padStart(12),
        '|', l.chart_of_accounts?.name?.substring(0, 40)
      );
    }
  }

  console.log('\nTotal Créditos em contas 5.x (saldo_abertura): R$', totalContas5Credito.toFixed(2));
}

check().catch(console.error);
