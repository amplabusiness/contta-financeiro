import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Verificando entries órfãos...\n');

  // Buscar conta 1.1.2.01
  const { data: conta } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.2.01').single();

  // Buscar linhas
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id')
    .eq('account_id', conta.id)
    .limit(200);

  const entryIds = [...new Set(linhas.map(l => l.entry_id))];
  console.log('Entry IDs únicos:', entryIds.length);

  // Verificar se entries existem
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, source_type, description')
    .in('id', entryIds);

  console.log('Entries encontrados:', entries?.length || 0);

  const idsEncontrados = new Set(entries?.map(e => e.id) || []);
  const naoEncontrados = entryIds.filter(id => !idsEncontrados.has(id));
  console.log('Órfãos:', naoEncontrados.length);

  if (naoEncontrados.length > 0) {
    console.log('\nIDs órfãos:', naoEncontrados.slice(0, 5));
  }

  // Contar por source_type
  const porTipo = {};
  for (const e of entries || []) {
    const t = e.source_type || 'null';
    porTipo[t] = (porTipo[t] || 0) + 1;
  }

  console.log('\nPor source_type:');
  for (const [t, c] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
    console.log('  ', t, ':', c);
  }

  // Mostrar exemplos
  console.log('\nExemplos de entries:');
  for (const e of (entries || []).slice(0, 10)) {
    console.log(`  ${e.source_type || 'null'}: ${(e.description || '').substring(0, 60)}`);
  }
}

main().catch(console.error);
