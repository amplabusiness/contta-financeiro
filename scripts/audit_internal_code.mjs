/**
 * AUDITORIA DR. CÍCERO - INTERNAL_CODE
 *
 * Verifica se TODOS os lançamentos contábeis possuem código interno de rastreabilidade
 *
 * Regra Suprema: NENHUM lançamento pode existir sem número de origem interna
 *
 * Fundamentação: NBC TG 26, ITG 2000
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditInternalCode() {
  console.log('='.repeat(80));
  console.log('AUDITORIA DR. CÍCERO - RASTREABILIDADE DE LANÇAMENTOS CONTÁBEIS');
  console.log('='.repeat(80));
  console.log('\nData:', new Date().toLocaleString('pt-BR'));
  console.log('Fundamentação: NBC TG 26, ITG 2000\n');

  // 1. Buscar TODOS os lançamentos contábeis
  console.log('1. Buscando todos os lançamentos em accounting_entries...\n');

  const { data: entries, error: entriesError } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      competence_date,
      description,
      reference_type,
      reference_id,
      internal_code,
      source_type,
      source_id,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (entriesError) {
    console.error('❌ Erro ao buscar lançamentos:', entriesError.message);
    return;
  }

  const totalEntries = entries?.length || 0;
  console.log(`Total de lançamentos encontrados: ${totalEntries}\n`);

  // 2. Classificar lançamentos
  const withInternalCode = entries?.filter(e => e.internal_code) || [];
  const withoutInternalCode = entries?.filter(e => !e.internal_code) || [];
  const withoutReferenceType = entries?.filter(e => !e.reference_type) || [];
  const withoutReferenceId = entries?.filter(e => !e.reference_id) || [];

  // 3. Relatório de conformidade
  console.log('='.repeat(80));
  console.log('RELATÓRIO DE CONFORMIDADE');
  console.log('='.repeat(80));

  console.log(`\n📊 ESTATÍSTICAS GERAIS:`);
  console.log(`   Total de lançamentos:           ${totalEntries}`);
  console.log(`   ✅ Com internal_code:           ${withInternalCode.length} (${((withInternalCode.length / totalEntries) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Sem internal_code:           ${withoutInternalCode.length} (${((withoutInternalCode.length / totalEntries) * 100).toFixed(1)}%)`);
  console.log(`   ⚠️  Sem reference_type:         ${withoutReferenceType.length}`);
  console.log(`   ⚠️  Sem reference_id:           ${withoutReferenceId.length}`);

  // 4. Listar lançamentos sem internal_code
  if (withoutInternalCode.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ VIOLAÇÕES: LANÇAMENTOS SEM INTERNAL_CODE');
    console.log('='.repeat(80));
    console.log('\nEsses lançamentos NÃO possuem rastreabilidade adequada:\n');

    // Agrupar por reference_type
    const byType = {};
    for (const entry of withoutInternalCode) {
      const type = entry.reference_type || 'SEM_TIPO';
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(entry);
    }

    for (const [type, typeEntries] of Object.entries(byType)) {
      console.log(`\n📁 ${type.toUpperCase()} (${typeEntries.length} lançamentos):`);
      console.log('-'.repeat(70));

      // Mostrar os primeiros 10 de cada tipo
      const sample = typeEntries.slice(0, 10);
      for (const entry of sample) {
        console.log(`   ID: ${entry.id}`);
        console.log(`   Data: ${entry.entry_date || entry.competence_date || 'N/A'}`);
        console.log(`   Descrição: ${(entry.description || 'Sem descrição').substring(0, 60)}`);
        console.log(`   Ref ID: ${entry.reference_id || 'NULO'}`);
        console.log(`   Criado em: ${entry.created_at}`);
        console.log('');
      }

      if (typeEntries.length > 10) {
        console.log(`   ... e mais ${typeEntries.length - 10} lançamentos`);
      }
    }
  }

  // 5. Verificar lançamentos sem reference_type ou reference_id
  if (withoutReferenceType.length > 0 || withoutReferenceId.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️ VIOLAÇÕES: LANÇAMENTOS SEM RASTREABILIDADE');
    console.log('='.repeat(80));

    if (withoutReferenceType.length > 0) {
      console.log(`\n⚠️ ${withoutReferenceType.length} lançamentos SEM reference_type:`);
      for (const entry of withoutReferenceType.slice(0, 5)) {
        console.log(`   - ${entry.id}: ${(entry.description || 'Sem descrição').substring(0, 50)}`);
      }
    }

    if (withoutReferenceId.length > 0) {
      console.log(`\n⚠️ ${withoutReferenceId.length} lançamentos SEM reference_id:`);
      for (const entry of withoutReferenceId.slice(0, 5)) {
        console.log(`   - ${entry.id}: ${(entry.description || 'Sem descrição').substring(0, 50)}`);
      }
    }
  }

  // 6. Verificar linhas de lançamento (accounting_entry_lines)
  console.log('\n' + '='.repeat(80));
  console.log('AUDITORIA DE LINHAS DE LANÇAMENTO');
  console.log('='.repeat(80));

  const { data: lines, error: linesError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      entry_id,
      account_id,
      debit,
      credit,
      chart_of_accounts!inner(code, name)
    `);

  if (linesError) {
    console.error('❌ Erro ao buscar linhas:', linesError.message);
  } else {
    const totalLines = lines?.length || 0;
    const withAccount = lines?.filter(l => l.account_id && l.chart_of_accounts) || [];
    const withoutAccount = lines?.filter(l => !l.account_id || !l.chart_of_accounts) || [];

    console.log(`\n📊 LINHAS DE LANÇAMENTO:`);
    console.log(`   Total de linhas:                ${totalLines}`);
    console.log(`   ✅ Com conta vinculada:         ${withAccount.length}`);
    console.log(`   ❌ Sem conta vinculada:         ${withoutAccount.length}`);

    if (withoutAccount.length > 0) {
      console.log('\n❌ LINHAS SEM CONTA VINCULADA:');
      for (const line of withoutAccount.slice(0, 10)) {
        console.log(`   - Entry ID: ${line.entry_id}, D: ${line.debit}, C: ${line.credit}`);
      }
    }
  }

  // 7. Verificar entries órfãos (sem linhas)
  console.log('\n' + '='.repeat(80));
  console.log('AUDITORIA DE LANÇAMENTOS ÓRFÃOS');
  console.log('='.repeat(80));

  const entryIds = new Set(entries?.map(e => e.id) || []);
  const lineEntryIds = new Set(lines?.map(l => l.entry_id) || []);

  const orphanEntries = [...entryIds].filter(id => !lineEntryIds.has(id));

  console.log(`\n📊 LANÇAMENTOS ÓRFÃOS (sem linhas D/C):`);
  console.log(`   Total: ${orphanEntries.length}`);

  if (orphanEntries.length > 0) {
    console.log('\n❌ LANÇAMENTOS SEM LINHAS (VIOLAÇÃO PARTIDAS DOBRADAS):');
    for (const id of orphanEntries.slice(0, 10)) {
      const entry = entries?.find(e => e.id === id);
      if (entry) {
        console.log(`   - ${id}: ${(entry.description || 'Sem descrição').substring(0, 50)}`);
      }
    }
    if (orphanEntries.length > 10) {
      console.log(`   ... e mais ${orphanEntries.length - 10} lançamentos`);
    }
  }

  // 8. Resumo final
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO DA AUDITORIA - DR. CÍCERO');
  console.log('='.repeat(80));

  const issues = [];
  if (withoutInternalCode.length > 0) {
    issues.push(`${withoutInternalCode.length} lançamentos sem internal_code`);
  }
  if (withoutReferenceType.length > 0) {
    issues.push(`${withoutReferenceType.length} lançamentos sem reference_type`);
  }
  if (withoutReferenceId.length > 0) {
    issues.push(`${withoutReferenceId.length} lançamentos sem reference_id`);
  }
  if (orphanEntries.length > 0) {
    issues.push(`${orphanEntries.length} lançamentos sem linhas D/C`);
  }

  if (issues.length === 0) {
    console.log('\n✅ AUDITORIA APROVADA!');
    console.log('   Todos os lançamentos estão em conformidade com as normas NBC TG 26 e ITG 2000.');
    console.log('   - Todos possuem internal_code');
    console.log('   - Todos possuem reference_type e reference_id');
    console.log('   - Todos possuem linhas de débito e crédito');
  } else {
    console.log('\n❌ AUDITORIA REPROVADA!');
    console.log('   Foram encontradas as seguintes violações:\n');
    for (const issue of issues) {
      console.log(`   • ${issue}`);
    }
    console.log('\n   AÇÃO NECESSÁRIA: Corrigir os lançamentos pendentes.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Assinado: Dr. Cícero - Agente IA Contábil');
  console.log('Fundamentação: NBC TG 26, ITG 2000, NBC TG 00');
  console.log('='.repeat(80));

  // Retornar dados para possível correção
  return {
    totalEntries,
    withoutInternalCode,
    withoutReferenceType,
    withoutReferenceId,
    orphanEntries
  };
}

// Executar auditoria
auditInternalCode().catch(console.error);
