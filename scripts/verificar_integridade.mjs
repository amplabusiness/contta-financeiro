/**
 * VERIFICAR INTEGRIDADE DOS DADOS CONTÁBEIS
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
  console.log('📊 VERIFICAÇÃO DE INTEGRIDADE DOS DADOS CONTÁBEIS\n');

  // 1. Buscar todas as linhas
  const { data: todasLinhas, count: totalLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact' });

  // 2. Buscar todos os entries
  const { data: todosEntries, count: totalEntries } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact' });

  console.log(`Total de ENTRIES: ${totalEntries}`);
  console.log(`Total de LINHAS: ${totalLinhas}`);

  // Criar set de IDs de entries
  const entryIds = new Set(todosEntries?.map(e => e.id) || []);

  // 3. Verificar linhas órfãs
  const linhasOrfas = todasLinhas?.filter(l => !entryIds.has(l.entry_id)) || [];
  const linhasValidas = todasLinhas?.filter(l => entryIds.has(l.entry_id)) || [];

  console.log(`\nLinhas VÁLIDAS (com entry existente): ${linhasValidas.length}`);
  console.log(`Linhas ÓRFÃS (entry não existe): ${linhasOrfas.length}`);

  // 4. Verificar entries sem linhas
  const entryIdsComLinhas = new Set(linhasValidas.map(l => l.entry_id));
  const entriesSemLinhas = todosEntries?.filter(e => !entryIdsComLinhas.has(e.id)) || [];

  console.log(`\nEntries COM linhas: ${entryIdsComLinhas.size}`);
  console.log(`Entries SEM linhas: ${entriesSemLinhas.length}`);

  // 5. Resumo por source_type
  console.log('\n\n📋 ENTRIES POR SOURCE_TYPE:');
  console.log('='.repeat(50));

  const porTipo = {};
  todosEntries?.forEach(e => {
    const tipo = e.source_type || 'null';
    if (!porTipo[tipo]) porTipo[tipo] = { qtd: 0, comLinhas: 0, semLinhas: 0 };
    porTipo[tipo].qtd++;
    if (entryIdsComLinhas.has(e.id)) {
      porTipo[tipo].comLinhas++;
    } else {
      porTipo[tipo].semLinhas++;
    }
  });

  Object.entries(porTipo).forEach(([tipo, vals]) => {
    console.log(`${tipo.padEnd(25)}: ${vals.qtd} entries (${vals.comLinhas} com linhas, ${vals.semLinhas} sem linhas)`);
  });

  // 6. Mostrar exemplos de entries sem linhas
  if (entriesSemLinhas.length > 0) {
    console.log('\n\n📋 EXEMPLOS DE ENTRIES SEM LINHAS:');
    console.log('='.repeat(70));
    entriesSemLinhas.slice(0, 10).forEach(e => {
      console.log(`${e.entry_date} | ${e.source_type} | ${e.description?.substring(0, 50)}`);
    });
  }

  // 7. Mostrar exemplos de linhas válidas
  console.log('\n\n📋 EXEMPLOS DE LINHAS VÁLIDAS:');
  console.log('='.repeat(70));

  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name');

  const mapContas = {};
  contas?.forEach(c => mapContas[c.id] = `${c.code} ${c.name}`);

  linhasValidas.slice(0, 10).forEach(l => {
    const entry = todosEntries?.find(e => e.id === l.entry_id);
    const conta = mapContas[l.account_id] || l.account_id;
    console.log(`${entry?.entry_date} | D: ${l.debit} C: ${l.credit}`);
    console.log(`   Conta: ${conta.substring(0, 40)}`);
    console.log(`   Entry: ${entry?.description?.substring(0, 50)}`);
    console.log('');
  });

  // 8. Diagnóstico final
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 DIAGNÓSTICO:');
  console.log('='.repeat(70));

  if (linhasOrfas.length > 0) {
    console.log(`⚠️  ${linhasOrfas.length} linhas órfãs precisam ser removidas`);
  }

  if (entriesSemLinhas.length > 0) {
    console.log(`⚠️  ${entriesSemLinhas.length} entries estão sem linhas`);
  }

  if (linhasValidas.length === 0) {
    console.log('❌ CRÍTICO: Nenhuma linha válida encontrada!');
  }

  // Total de débitos e créditos das linhas válidas
  let totalDebitos = 0;
  let totalCreditos = 0;
  linhasValidas.forEach(l => {
    totalDebitos += parseFloat(l.debit) || 0;
    totalCreditos += parseFloat(l.credit) || 0;
  });

  console.log(`\nTotal Débitos (linhas válidas): R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total Créditos (linhas válidas): R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    console.log(`⚠️  DESBALANCEADO: Diferença de R$ ${(totalDebitos - totalCreditos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  } else {
    console.log('✅ Débitos e créditos balanceados');
  }
}

main().catch(console.error);
