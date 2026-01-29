import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: conta } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.2.01').single();

  // Buscar TODAS as linhas
  let todas = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('accounting_entry_lines').select('id, entry_id, description, debit, credit').eq('account_id', conta.id).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    todas.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  const entryIds = [...new Set(todas.map(l => l.entry_id))];
  console.log('Linhas:', todas.length);
  console.log('Entry IDs únicos:', entryIds.length);

  // Buscar entries existentes
  const entries = [];
  for (let i = 0; i < entryIds.length; i += 500) {
    const lote = entryIds.slice(i, i + 500);
    const { data } = await supabase.from('accounting_entries').select('id').in('id', lote);
    if (data) entries.push(...data);
  }

  const existentes = new Set(entries.map(e => e.id));
  console.log('Entries existentes:', existentes.size);

  const linhasOrfas = todas.filter(l => !existentes.has(l.entry_id));
  console.log('\nLinhas órfãs (entry não existe):', linhasOrfas.length);

  // Calcular valor das órfãs
  let totalD = 0, totalC = 0;
  linhasOrfas.forEach(l => {
    totalD += parseFloat(l.debit) || 0;
    totalC += parseFloat(l.credit) || 0;
  });
  console.log('Débitos órfãos:', totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('Créditos órfãos:', totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

  // Mostrar amostra
  console.log('\nAMOSTRA DE LINHAS ÓRFÃS:');
  console.log('='.repeat(80));
  for (const l of linhasOrfas.slice(0, 20)) {
    console.log('');
    console.log('Desc:', (l.description || '').substring(0, 70));
    console.log('D:', l.debit, 'C:', l.credit);
  }
}

main().catch(console.error);
