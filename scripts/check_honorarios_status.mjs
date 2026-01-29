import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Contar entries de receita_honorarios e seus items
const { data: entries } = await supabase
  .from('accounting_entries')
  .select('id, entry_date, description, entry_type')
  .eq('entry_type', 'receita_honorarios')
  .gte('entry_date', '2025-01-01')
  .lte('entry_date', '2025-01-31');

console.log('Entries receita_honorarios janeiro/2025:', entries?.length || 0);

let comItems = 0;
let semItems = 0;

for (const e of entries || []) {
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('id')
    .eq('entry_id', e.id);

  if (items && items.length > 0) {
    comItems++;
  } else {
    semItems++;
  }
}

console.log('Com items (D/C):', comItems);
console.log('Sem items (órfãos):', semItems);
