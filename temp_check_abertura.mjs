import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Buscar o lançamento de saldo de abertura de clientes (conta 5.3.02.02)
  const { data, error } = await supabase
    .from('accounting_entries')
    .select(`
      id, entry_date, competence_date, entry_type, description,
      accounting_entry_lines(
        debit, credit,
        chart_of_accounts(code, name)
      )
    `)
    .eq('entry_type', 'saldo_abertura')
    .ilike('description', '%cliente%')
    .limit(5);

  if (error) {
    console.log('Erro:', error.message);
    return;
  }

  console.log('=== LANÇAMENTOS DE SALDO DE ABERTURA COM "CLIENTE" ===');
  for (const e of data || []) {
    console.log('\n--- Entry ---');
    console.log('ID:', e.id);
    console.log('Entry Date:', e.entry_date);
    console.log('Competence Date:', e.competence_date);
    console.log('Entry Type:', e.entry_type);
    console.log('Description:', e.description);
    console.log('Lines:');
    for (const l of e.accounting_entry_lines || []) {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      console.log('  ', l.chart_of_accounts?.code, d > 0 ? `D: ${d}` : `C: ${c}`);
    }
  }

  // Buscar especificamente pela conta 5.3.02.02
  console.log('\n\n=== BUSCANDO PELA CONTA 5.3.02.02 ===');
  const { data: linhas, error: linhasErr } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit,
      chart_of_accounts!inner(code, name),
      accounting_entries(id, entry_date, competence_date, entry_type, description)
    `)
    .eq('chart_of_accounts.code', '5.3.02.02');

  if (linhasErr) {
    console.log('Erro linhas:', linhasErr.message);
    return;
  }

  console.log('Linhas encontradas:', linhas?.length || 0);
  for (const l of linhas || []) {
    console.log('\nAccount:', l.chart_of_accounts?.code, l.chart_of_accounts?.name);
    console.log('Credit:', l.credit);
    console.log('Entry Date:', l.accounting_entries?.entry_date);
    console.log('Competence Date:', l.accounting_entries?.competence_date);
    console.log('Description:', l.accounting_entries?.description?.substring(0, 60));
  }
}

check().catch(console.error);
