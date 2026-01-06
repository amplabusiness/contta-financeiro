import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== VERIFICANDO HONORÁRIOS JANEIRO/2025 ===\n');

  // 1. Buscar lançamentos contábeis de janeiro 2025
  const { data: entries, error: entriesError } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, competence_date, description, entry_type')
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-01-31')
    .limit(20);

  if (entriesError) {
    console.log('Erro ao buscar lançamentos:', entriesError.message);
    return;
  }

  console.log('Lançamentos em Janeiro/2025:', entries ? entries.length : 0);
  if (entries && entries.length > 0) {
    for (const e of entries) {
      const desc = e.description || '';
      console.log('  - ' + e.competence_date + ' | ' + (e.entry_type || 'N/A') + ' | ' + desc.substring(0, 60));
    }
  }

  // 2. Buscar linhas de lançamento de janeiro
  const { data: lines, error: linesError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit, description,
      chart_of_accounts(code, name),
      accounting_entries!inner(competence_date, entry_type)
    `)
    .gte('accounting_entries.competence_date', '2025-01-01')
    .lte('accounting_entries.competence_date', '2025-01-31')
    .limit(30);

  if (linesError) {
    console.log('\nErro ao buscar linhas:', linesError.message);
    return;
  }

  console.log('\n=== LINHAS DE LANÇAMENTO JANEIRO/2025 ===');
  console.log('Total:', lines ? lines.length : 0);

  let totalDebitos = 0;
  let totalCreditos = 0;

  if (lines && lines.length > 0) {
    for (const l of lines) {
      const conta = l.chart_of_accounts ? l.chart_of_accounts.code + ' ' + l.chart_of_accounts.name : 'Conta não encontrada';
      const debit = Number(l.debit) || 0;
      const credit = Number(l.credit) || 0;
      totalDebitos += debit;
      totalCreditos += credit;
      console.log('  D: ' + debit.toFixed(2).padStart(12) + ' | C: ' + credit.toFixed(2).padStart(12) + ' | ' + conta.substring(0, 50));
    }
    console.log('\n  TOTAL DÉBITOS:  ' + totalDebitos.toFixed(2));
    console.log('  TOTAL CRÉDITOS: ' + totalCreditos.toFixed(2));
    console.log('  DIFERENÇA:      ' + (totalDebitos - totalCreditos).toFixed(2));
  }

  // 3. Verificar contas de Clientes a Receber (1.1.2.01)
  console.log('\n=== CONTAS DE CLIENTES A RECEBER (1.1.2.01) ===');
  const { data: clientAccounts, error: clientError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01%')
    .limit(10);

  if (clientError) {
    console.log('Erro:', clientError.message);
  } else {
    console.log('Contas encontradas:', clientAccounts ? clientAccounts.length : 0);
    if (clientAccounts) {
      for (const a of clientAccounts) {
        console.log('  - ' + a.code + ' ' + a.name);
      }
    }
  }

  // 4. Verificar contas de Receita de Honorários (3.1)
  console.log('\n=== CONTAS DE RECEITA (3.1) ===');
  const { data: revenueAccounts, error: revenueError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '3.1%')
    .limit(10);

  if (revenueError) {
    console.log('Erro:', revenueError.message);
  } else {
    console.log('Contas encontradas:', revenueAccounts ? revenueAccounts.length : 0);
    if (revenueAccounts) {
      for (const a of revenueAccounts) {
        console.log('  - ' + a.code + ' ' + a.name);
      }
    }
  }

  // 5. Verificar faturas de janeiro 2025
  console.log('\n=== FATURAS DE JANEIRO/2025 ===');
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, invoice_number, client_id, amount, reference_month, due_date, status')
    .eq('reference_month', '2025-01')
    .limit(10);

  if (invoicesError) {
    console.log('Erro:', invoicesError.message);
  } else {
    console.log('Faturas encontradas:', invoices ? invoices.length : 0);
    if (invoices && invoices.length > 0) {
      let totalFaturas = 0;
      for (const i of invoices) {
        totalFaturas += Number(i.amount) || 0;
        console.log('  - ' + (i.invoice_number || 'N/A') + ' | R$ ' + Number(i.amount).toFixed(2) + ' | Venc: ' + i.due_date + ' | ' + i.status);
      }
      console.log('  TOTAL FATURAS: R$ ' + totalFaturas.toFixed(2));
    }
  }
}

check().catch(console.error);
