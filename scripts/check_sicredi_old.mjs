import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: account } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();
  
  // Lançamentos anteriores a Janeiro/2025
  const { data: oldEntries, error } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, accounting_entries!inner(competence_date, entry_type, description)')
    .eq('account_id', account.id)
    .lt('accounting_entries.competence_date', '2025-01-01')
    .order('accounting_entries(competence_date)', { ascending: true });
  
  if (error) {
    console.error('Erro:', error);
    return;
  }
  
  console.log('Lançamentos anteriores a Jan/2025:', oldEntries?.length || 0);
  
  let totalD = 0, totalC = 0;
  oldEntries?.forEach(l => {
    totalD += Number(l.debit) || 0;
    totalC += Number(l.credit) || 0;
  });
  
  console.log('Total Débitos:', totalD.toFixed(2));
  console.log('Total Créditos:', totalC.toFixed(2));
  console.log('Saldo (D-C):', (totalD - totalC).toFixed(2));
  
  // Mostrar os lançamentos
  console.log('\nLançamentos:');
  oldEntries?.forEach(l => {
    const date = l.accounting_entries?.competence_date;
    const type = l.accounting_entries?.entry_type;
    const desc = l.accounting_entries?.description?.substring(0, 40);
    console.log(`  ${date} | D:${l.debit} | C:${l.credit} | ${type} | ${desc}`);
  });
}

main();
