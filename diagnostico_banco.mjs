#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

// Ler variáveis de ambiente
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const supabaseUrl = urlMatch?.[1];
const supabaseKey = keyMatch?.[1];

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('📋 DIAGNÓSTICO DO BANCO DE DADOS');
console.log('='.repeat(80));

async function diagnose() {
  try {
    // 1. Contar registros
    console.log('\n📊 CONTAGEM DE REGISTROS:');
    console.log('-'.repeat(80));

    const tables = [
      'expenses',
      'accounting_entries',
      'accounting_entry_lines',
      'clients',
      'invoices',
      'employees',
      'payrolls',
      'bank_accounts',
      'bank_transactions',
      'chart_of_accounts',
    ];

    for (const table of tables) {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });

      if (error && error.code === 'PGRST116') {
        console.log(`  • ${table}: ❌ Não existe`);
      } else if (error) {
        console.log(`  • ${table}: ⚠️ Erro - ${error.message}`);
      } else {
        console.log(`  • ${table}: ${count || 0} registros`);
      }
    }

    // 2. Últimos lançamentos de despesas
    console.log('\n\n📝 ÚLTIMOS LANÇAMENTOS DE DESPESAS:');
    console.log('-'.repeat(80));

    const { data: lastExpenses, error: expError } = await supabase
      .from('expenses')
      .select('id, description, amount, category, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (expError && expError.code === 'PGRST116') {
      console.log('❌ Tabela "expenses" não existe');
    } else if (expError) {
      console.log('❌ Erro:', expError.message);
    } else if (!lastExpenses || lastExpenses.length === 0) {
      console.log('⚠️ Nenhuma despesa encontrada');
    } else {
      lastExpenses.forEach((exp, idx) => {
        console.log(`\n${idx + 1}. ${exp.description}`);
        console.log(`   ID: ${exp.id}`);
        console.log(`   Valor: R$ ${exp.amount?.toFixed(2) || '0.00'}`);
        console.log(`   Categoria: ${exp.category || 'Sem categoria'}`);
        console.log(`   Data: ${exp.created_at}`);
      });
    }

    // 3. Últimos lançamentos contábeis
    console.log('\n\n💼 ÚLTIMOS LANÇAMENTOS CONTÁBEIS:');
    console.log('-'.repeat(80));

    const { data: lastEntries, error: entryError } = await supabase
      .from('accounting_entries')
      .select('id, description, reference_type, reference_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (entryError && entryError.code === 'PGRST116') {
      console.log('❌ Tabela "accounting_entries" não existe');
    } else if (entryError) {
      console.log('❌ Erro:', entryError.message);
    } else if (!lastEntries || lastEntries.length === 0) {
      console.log('⚠️ Nenhum lançamento contábil encontrado');
    } else {
      lastEntries.forEach((entry, idx) => {
        console.log(`\n${idx + 1}. ${entry.description}`);
        console.log(`   ID: ${entry.id}`);
        console.log(`   Tipo: ${entry.reference_type}`);
        console.log(`   Referência: ${entry.reference_id}`);
        console.log(`   Data: ${entry.created_at}`);
      });
    }

    // 4. Verificar data de hoje vs histórico
    console.log('\n\n📅 DESPESAS POR PERÍODO:');
    console.log('-'.repeat(80));

    const hoje = new Date().toISOString().split('T')[0];
    const periods = [
      { label: 'Hoje', days: 0 },
      { label: 'Últimas 24h', days: 1 },
      { label: 'Últimos 7 dias', days: 7 },
      { label: 'Últimos 30 dias', days: 30 },
      { label: 'Tudo', days: 999999 },
    ];

    for (const period of periods) {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - period.days);
      const dataInicioStr = dataInicio.toISOString().split('T')[0];

      const { count, error } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dataInicioStr);

      if (!error) {
        console.log(`  • ${period.label.padEnd(15)}: ${(count || 0).toString().padStart(5)} registros`);
      }
    }

    // 5. Verificar tabela de rastreamento
    console.log('\n\n🔐 SISTEMA DE RASTREAMENTO:');
    console.log('-'.repeat(80));

    const { count: trackingCount, error: trackingError } = await supabase
      .from('accounting_entry_tracking')
      .select('id', { count: 'exact', head: true });

    if (trackingError && trackingError.code === 'PGRST116') {
      console.log('❌ Tabela "accounting_entry_tracking" não existe');
      console.log('   → Migração não foi aplicada ainda');
      console.log('   → Execute: supabase migrations up');
    } else if (trackingError) {
      console.log('❌ Erro:', trackingError.message);
    } else {
      console.log(`✅ Tabela existe com ${trackingCount || 0} registros`);
    }

    // 6. Status do sistema
    console.log('\n\n🎯 STATUS DO SISTEMA:');
    console.log('-'.repeat(80));

    const allGood = !expError && !entryError;
    const trackingReady = !trackingError;

    console.log(`\n• Tabela de Despesas: ${!expError ? '✅ OK' : '❌ Erro'}`);
    console.log(`• Lançamentos Contábeis: ${!entryError ? '✅ OK' : '❌ Erro'}`);
    console.log(`• Sistema de Rastreamento: ${trackingReady ? '✅ OK' : '❌ Não implementado'}`);

    if (allGood && lastExpenses?.length === 0) {
      console.log(`\n⚠️ Banco está funcional mas SEM DADOS`);
      console.log(`   → Nenhuma despesa foi lançada ainda`);
      console.log(`   → Sistema aguarda primeiros lançamentos dos funcionários`);
    } else if (allGood) {
      console.log(`\n✅ Sistema OPERACIONAL e com dados`);
    }
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  }
}

await diagnose();
console.log('\n' + '='.repeat(80));
console.log('✅ Diagnóstico concluído\n');
