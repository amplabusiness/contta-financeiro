/**
 * DETALHAR ENTRIES MANUAIS - JANEIRO/2025
 */

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
    .select('id, entry_date, description')
    .eq('entry_type', 'manual')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31')
    .order('description');

  // Filtrar apenas os 'Outros'
  const outros = (entries || []).filter(e => {
    const desc = e.description || '';
    const isConhecido =
      desc.includes('Adiantamento') || desc.includes('Adiant') ||
      desc.includes('Clientes a Receber') ||
      desc.includes('Honorários') ||
      desc.includes('Obras') || desc.includes('Reforma') ||
      (desc.includes('Despesa') && desc.includes('Classificar')) ||
      desc.includes('ISS') ||
      desc.includes('Bancárias') || desc.includes('Tarifas') ||
      desc.includes('Empréstimo') ||
      desc.includes('ACTION') || desc.includes('JPL') || desc.includes('CANAL PET');
    return !isConhecido;
  });

  console.log('DETALHAMENTO DOS ENTRIES "OUTROS"');
  console.log('═'.repeat(80));

  for (const e of outros) {
    console.log(`${e.entry_date} | ${e.description}`);
  }

  console.log('');
  console.log(`Total: ${outros.length} entries`);
}

main().catch(console.error);
