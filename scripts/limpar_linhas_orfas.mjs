/**
 * LIMPAR LINHAS ÓRFÃS DA TABELA accounting_entry_lines
 *
 * Este script remove linhas que referenciam entries que não existem mais.
 *
 * Uso:
 *   node limpar_linhas_orfas.mjs           # Simulação
 *   node limpar_linhas_orfas.mjs --execute # Execução real
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = !process.argv.includes('--execute');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  🧹 LIMPEZA DE LINHAS ÓRFÃS                                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🔧 Modo: ${DRY_RUN ? '⚠️  SIMULAÇÃO (use --execute para apagar)' : '✅ EXECUÇÃO REAL'}`);
  console.log('');

  // Buscar TODAS as linhas com paginação
  console.log('Buscando linhas...');
  let todasLinhas = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('accounting_entry_lines').select('id, entry_id').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    todasLinhas.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  // Buscar TODOS os entries com paginação
  console.log('Buscando entries...');
  let todosEntries = [];
  page = 0;
  while (true) {
    const { data } = await supabase.from('accounting_entries').select('id').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    todosEntries.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  const entryIds = new Set(todosEntries?.map(e => e.id) || []);

  // Identificar linhas órfãs
  const linhasOrfas = todasLinhas?.filter(l => !entryIds.has(l.entry_id)) || [];

  console.log(`Total de linhas: ${todasLinhas?.length}`);
  console.log(`Total de entries: ${todosEntries?.length}`);
  console.log(`Linhas órfãs encontradas: ${linhasOrfas.length}`);

  if (linhasOrfas.length === 0) {
    console.log('\n✅ Nenhuma linha órfã para remover.');
    return;
  }

  // IDs das linhas órfãs
  const idsOrfas = linhasOrfas.map(l => l.id);

  console.log(`\nEntry IDs órfãos únicos: ${new Set(linhasOrfas.map(l => l.entry_id)).size}`);

  if (!DRY_RUN) {
    console.log('\n🗑️  Removendo linhas órfãs...');

    // Remover em lotes de 100
    let removidas = 0;
    for (let i = 0; i < idsOrfas.length; i += 100) {
      const lote = idsOrfas.slice(i, i + 100);
      const { error } = await supabase
        .from('accounting_entry_lines')
        .delete()
        .in('id', lote);

      if (error) {
        console.log(`❌ Erro ao remover lote ${i}-${i + lote.length}: ${error.message}`);
      } else {
        removidas += lote.length;
        process.stdout.write(`   ${removidas}/${idsOrfas.length}\r`);
      }
    }

    console.log(`\n\n✅ ${removidas} linhas órfãs removidas com sucesso!`);
  } else {
    console.log('\n' + '═'.repeat(70));
    console.log('⚠️  MODO SIMULAÇÃO - Nenhum dado foi apagado.');
    console.log('   Para executar de verdade:');
    console.log('   node scripts/limpar_linhas_orfas.mjs --execute');
    console.log('═'.repeat(70));
  }
}

main().catch(console.error);
