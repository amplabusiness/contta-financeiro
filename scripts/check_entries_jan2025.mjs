/**
 * VERIFICAR ENTRIES DE JANEIRO/2025
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
  // Buscar todos entries de janeiro/2025
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type, source_type')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31')
    .order('entry_type')
    .order('entry_date');

  console.log('ENTRIES DE JANEIRO/2025');
  console.log('═'.repeat(100));

  // Agrupar por tipo
  const porTipo = {};

  for (const e of entries || []) {
    const tipo = e.entry_type || e.source_type || 'SEM_TIPO';
    if (!porTipo[tipo]) {
      porTipo[tipo] = { count: 0, entries: [] };
    }
    porTipo[tipo].count++;
    porTipo[tipo].entries.push(e);
  }

  for (const tipo of Object.keys(porTipo).sort()) {
    const dados = porTipo[tipo];
    console.log('');
    console.log(`${tipo}: ${dados.count} entries`);
    console.log('-'.repeat(80));

    // Mostrar até 5 exemplos
    const exemplos = dados.entries.slice(0, 5);
    for (const e of exemplos) {
      console.log(`  ${e.entry_date} | ${(e.description || '').substring(0, 65)}`);
    }
    if (dados.entries.length > 5) {
      console.log(`  ... e mais ${dados.entries.length - 5} entries`);
    }
  }

  console.log('');
  console.log('═'.repeat(100));
  console.log(`TOTAL: ${entries?.length || 0} entries`);
}

main().catch(console.error);
