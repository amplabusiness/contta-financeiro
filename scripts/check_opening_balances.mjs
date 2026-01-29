/**
 * VERIFICAR SALDOS DE ABERTURA DE CLIENTES
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('📊 VERIFICAÇÃO DE SALDOS DE ABERTURA\n');

  // Buscar entries de saldo de abertura
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, source_type')
    .eq('source_type', 'client_opening_balance')
    .order('entry_date');

  if (error) {
    console.log('Erro:', error.message);
    return;
  }

  console.log(`Total de entries de saldo de abertura: ${entries?.length}`);

  // Buscar linhas desses entries
  const entryIds = entries?.map(e => e.id) || [];

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id, account_id, debit, credit, description')
    .in('entry_id', entryIds);

  console.log(`Total de linhas: ${linhas?.length}`);

  // Buscar contas
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name');

  const mapContas = {};
  contas?.forEach(c => mapContas[c.id] = `${c.code} ${c.name}`);

  // Mostrar detalhes
  console.log('\n\n📋 ENTRIES DE SALDO DE ABERTURA:');
  console.log('='.repeat(90));

  let totalDebitos = 0;
  let totalCreditos = 0;

  for (const entry of entries || []) {
    const linhasEntry = linhas?.filter(l => l.entry_id === entry.id) || [];

    console.log(`\n${entry.entry_date} | ${entry.description}`);

    linhasEntry.forEach(l => {
      const conta = mapContas[l.account_id] || l.account_id;
      const d = parseFloat(l.debit) || 0;
      const c = parseFloat(l.credit) || 0;
      totalDebitos += d;
      totalCreditos += c;
      console.log(`   ${conta.substring(0, 40).padEnd(42)} | D: ${d.toString().padStart(10)} | C: ${c.toString().padStart(10)}`);
    });
  }

  console.log('\n\n' + '='.repeat(90));
  console.log(`Total Débitos: R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Saldo: R$ ${(totalDebitos - totalCreditos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar todos os source_types
  console.log('\n\n📋 TODOS OS SOURCE_TYPES NO SISTEMA:');
  console.log('='.repeat(50));

  const { data: allEntries } = await supabase
    .from('accounting_entries')
    .select('source_type');

  const porTipo = {};
  allEntries?.forEach(e => {
    const tipo = e.source_type || 'null';
    porTipo[tipo] = (porTipo[tipo] || 0) + 1;
  });

  Object.entries(porTipo).sort((a, b) => b[1] - a[1]).forEach(([tipo, qtd]) => {
    console.log(`   ${tipo.padEnd(30)}: ${qtd}`);
  });
}

main().catch(console.error);
