import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('='.repeat(80));
  console.log('DIAGNÓSTICO DO SCHEMA CONTÁBIL - Dr. Cícero');
  console.log('='.repeat(80));
  console.log();

  // 1. Verificar tabelas existentes
  console.log('1. TABELAS CONTÁBEIS:');
  console.log('-'.repeat(40));
  
  const tables = [
    'accounting_entries',
    'accounting_entry_lines',
    'accounting_entry_items',
    'accounting_entry_tracking'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ❌ ${table}: NÃO EXISTE ou ERRO - ${error.message}`);
    } else {
      console.log(`   ✅ ${table}: ${count} registros`);
    }
  }

  // 2. Verificar colunas de accounting_entries
  console.log('\n2. COLUNAS DE accounting_entries:');
  console.log('-'.repeat(40));
  
  const { data: entryRow } = await supabase
    .from('accounting_entries')
    .select('*')
    .limit(1);
  
  if (entryRow && entryRow.length > 0) {
    const cols = Object.keys(entryRow[0]);
    console.log(`   Colunas (${cols.length}):`, cols.join(', '));
    
    // Verificar colunas críticas
    const requiredCols = ['id', 'tenant_id', 'entry_date', 'description', 'internal_code', 'source_type'];
    const missingCols = requiredCols.filter(c => !cols.includes(c));
    if (missingCols.length > 0) {
      console.log(`   ⚠️  FALTANDO COLUNAS CRÍTICAS: ${missingCols.join(', ')}`);
    } else {
      console.log('   ✅ Todas colunas críticas presentes');
    }
  } else {
    console.log('   Tabela vazia - verificando estrutura...');
    // Inserir e deletar para ver erro
    const { error: insertError } = await supabase
      .from('accounting_entries')
      .insert({ entry_date: '2025-01-01', description: 'TEST' });
    
    if (insertError) {
      console.log(`   Erro de estrutura: ${insertError.message}`);
    }
  }

  // 3. Verificar colunas de accounting_entry_lines
  console.log('\n3. COLUNAS DE accounting_entry_lines:');
  console.log('-'.repeat(40));
  
  const { data: lineRow, error: lineError } = await supabase
    .from('accounting_entry_lines')
    .select('*')
    .limit(1);
  
  if (lineRow) {
    if (lineRow.length > 0) {
      const cols = Object.keys(lineRow[0]);
      console.log(`   Colunas (${cols.length}):`, cols.join(', '));
      
      // Verificar tenant_id
      if (!cols.includes('tenant_id')) {
        console.log('   ⚠️  FALTANDO tenant_id - PROBLEMA CRÍTICO DE RLS!');
      }
    } else {
      console.log('   Tabela vazia');
    }
  } else if (lineError) {
    console.log(`   ERRO: ${lineError.message}`);
  }

  // 4. Verificar se items também existe
  console.log('\n4. VERIFICAR DUPLICIDADE (entry_lines vs entry_items):');
  console.log('-'.repeat(40));
  
  const { count: linesCount } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true });
  
  const { count: itemsCount, error: itemsError } = await supabase
    .from('accounting_entry_items')
    .select('*', { count: 'exact', head: true });
  
  if (!itemsError) {
    console.log(`   accounting_entry_lines: ${linesCount} registros`);
    console.log(`   accounting_entry_items: ${itemsCount} registros`);
    
    if (itemsCount > 0 && linesCount > 0) {
      console.log('   ⚠️  AMBAS TABELAS TÊM DADOS - POSSÍVEL DUPLICIDADE!');
    } else if (itemsCount > 0) {
      console.log('   ℹ️  Apenas entry_items tem dados');
    } else if (linesCount > 0) {
      console.log('   ℹ️  Apenas entry_lines tem dados');
    }
  } else {
    console.log('   accounting_entry_items: NÃO EXISTE');
  }

  // 5. Verificar entries órfãos
  console.log('\n5. VERIFICAR ENTRIES ÓRFÃOS (sem linhas):');
  console.log('-'.repeat(40));
  
  const { data: allEntries } = await supabase
    .from('accounting_entries')
    .select('id');
  
  const { data: allLines } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id');
  
  const entryIds = new Set((allEntries || []).map(e => e.id));
  const linkedIds = new Set((allLines || []).map(l => l.entry_id));
  
  const orphanIds = [...entryIds].filter(id => !linkedIds.has(id));
  
  console.log(`   Total entries: ${entryIds.size}`);
  console.log(`   Entries com linhas: ${linkedIds.size}`);
  console.log(`   Entries ÓRFÃOS: ${orphanIds.length}`);
  
  if (orphanIds.length > 0) {
    console.log('   ⚠️  EXISTEM ENTRIES SEM LINHAS - SERÃO DELETADOS PELO CLEANUP!');
  }

  // 6. Verificar transações bancárias órfãs
  console.log('\n6. VERIFICAR BANK_TRANSACTIONS vs ENTRIES:');
  console.log('-'.repeat(40));
  
  const { count: totalTx } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true });
  
  const { count: txWithEntry } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .not('journal_entry_id', 'is', null);
  
  const { count: txReconciled } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('is_reconciled', true);
  
  console.log(`   Total transações: ${totalTx}`);
  console.log(`   Com journal_entry_id: ${txWithEntry}`);
  console.log(`   Marcadas reconciliadas: ${txReconciled}`);
  
  if (txWithEntry > 0 && entryIds.size === 0) {
    console.log('   ❌ TRANSAÇÕES APONTAM PARA ENTRIES QUE NÃO EXISTEM!');
  }

  // 7. Verificar uso de internal_code
  console.log('\n7. VERIFICAR RASTREABILIDADE (internal_code):');
  console.log('-'.repeat(40));
  
  const { data: entriesWithCode } = await supabase
    .from('accounting_entries')
    .select('internal_code')
    .not('internal_code', 'is', null)
    .limit(10);
  
  const { data: entriesWithoutCode } = await supabase
    .from('accounting_entries')
    .select('id')
    .is('internal_code', null);
  
  if (entriesWithCode && entriesWithCode.length > 0) {
    console.log(`   Exemplo de códigos: ${entriesWithCode.map(e => e.internal_code).join(', ')}`);
  }
  console.log(`   Entries SEM internal_code: ${entriesWithoutCode?.length || 0}`);

  // 8. Resumo
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO DO DIAGNÓSTICO:');
  console.log('='.repeat(80));
  
  const problems = [];
  
  if (orphanIds.length > 0) {
    problems.push(`${orphanIds.length} entries órfãos serão deletados pelo cleanup_orphans`);
  }
  
  if (txWithEntry > 0 && entryIds.size === 0) {
    problems.push('Transações apontam para entries inexistentes');
  }
  
  if (!itemsError && itemsCount > 0 && linesCount > 0) {
    problems.push('Duas tabelas de linhas com dados (entry_lines E entry_items)');
  }
  
  if (problems.length === 0) {
    console.log('✅ Nenhum problema crítico encontrado');
  } else {
    console.log('❌ PROBLEMAS ENCONTRADOS:');
    problems.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
  }
  
  console.log('\n');
}

diagnose().catch(console.error);
