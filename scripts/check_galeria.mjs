import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .ilike('description', '%ENERGISA%')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log('Lançamentos com GALERIA NACIONAL:', entries?.length || 0);

  for (const e of entries || []) {
    console.log(`\n[${e.entry_date}] ${e.description?.substring(0, 70)}`);
    console.log(`   Tipo: ${e.entry_type}`);

    // Buscar items e suas contas
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id, debit, credit, account_id')
      .eq('entry_id', e.id);

    for (const item of items || []) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('code, name')
        .eq('id', item.account_id)
        .single();

      const valor = item.debit > 0 ? `D ${item.debit}` : `C ${item.credit}`;
      console.log(`   ${valor} → ${conta?.code} ${conta?.name}`);
    }
  }
}
main().catch(console.error);
