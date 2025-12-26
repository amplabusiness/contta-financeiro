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

console.log('🔍 VERIFICAÇÃO DETALHADA DE JANEIRO/2025');
console.log('='.repeat(100));

async function verificarDados() {
  try {
    // 1. Verificar tabelas de contabilidade
    console.log('\n📊 1. DADOS CONTÁBEIS:');
    console.log('-'.repeat(100));

    // Despesas de janeiro
    const { data: expJan, count: countExp, error: errExp } = await supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .gte('created_at', '2025-01-01T00:00:00')
      .lte('created_at', '2025-01-31T23:59:59')
      .order('created_at', { ascending: false });

    console.log(`\n💰 Tabela 'expenses' - Janeiro/2025:`);
    if (errExp) {
      console.log(`   ❌ Erro: ${errExp.message}`);
    } else {
      console.log(`   ✅ Total encontrado: ${countExp || 0} despesas`);
      if (expJan && expJan.length > 0) {
        console.log(`   Primeiras 5:`);
        expJan.slice(0, 5).forEach((exp, i) => {
          console.log(`     ${i + 1}. ${exp.description} - R$ ${exp.amount?.toFixed(2)} (${exp.created_at?.split('T')[0]})`);
        });
      }
    }

    // Lançamentos contábeis de janeiro
    const { data: entJan, count: countEnt, error: errEnt } = await supabase
      .from('accounting_entries')
      .select('*', { count: 'exact' })
      .gte('created_at', '2025-01-01T00:00:00')
      .lte('created_at', '2025-01-31T23:59:59')
      .order('created_at', { ascending: false });

    console.log(`\n📝 Tabela 'accounting_entries' - Janeiro/2025:`);
    if (errEnt) {
      console.log(`   ❌ Erro: ${errEnt.message}`);
    } else {
      console.log(`   ✅ Total encontrado: ${countEnt || 0} lançamentos`);
      if (entJan && entJan.length > 0) {
        console.log(`   Primeiros 5:`);
        entJan.slice(0, 5).forEach((ent, i) => {
          console.log(`     ${i + 1}. ${ent.description} (${ent.reference_type}) - ${ent.created_at?.split('T')[0]}`);
        });
      }
    }

    // 2. Verificar todas as despesas independente de data
    console.log('\n\n📊 2. TODAS AS DESPESAS (SEM FILTRO DE DATA):');
    console.log('-'.repeat(100));

    const { data: allExp, count: allCount, error: allErr } = await supabase
      .from('expenses')
      .select('*', { count: 'exact' });

    if (allErr) {
      console.log(`❌ Erro: ${allErr.message}`);
    } else {
      console.log(`✅ Total geral: ${allCount || 0} despesas`);

      if (allCount && allCount > 0) {
        // Agrupar por data
        const byDate = {};
        allExp?.forEach((exp) => {
          const date = exp.created_at?.split('T')[0];
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push(exp);
        });

        console.log('\nDistribuição por data:');
        Object.entries(byDate)
          .sort()
          .reverse()
          .slice(0, 10)
          .forEach(([date, items]) => {
            const total = items.reduce((sum, i) => sum + (i.amount || 0), 0);
            console.log(`  ${date}: ${items.length} despesas - R$ ${total.toFixed(2)}`);
          });
      }
    }

    // 3. Verificar clientes
    console.log('\n\n📊 3. CLIENTES E RELACIONAMENTOS:');
    console.log('-'.repeat(100));

    const { count: clientCount, error: errClients } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    console.log(`📌 Clientes: ${clientCount || 0}`);

    // 4. Verificar se há dados em outras tabelas
    console.log('\n\n📊 4. TODAS AS TABELAS - CONTAGEM:');
    console.log('-'.repeat(100));

    const tablesToCheck = [
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
      'accounting_entry_tracking',
    ];

    for (const table of tablesToCheck) {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      const status = error && error.code === 'PGRST116' ? '❌ Não existe' : count || 0;
      console.log(`  • ${table.padEnd(35)} : ${status.toString().padStart(10)}`);
    }

    // 5. Verificar schema de expenses
    console.log('\n\n📊 5. SCHEMA DA TABELA EXPENSES:');
    console.log('-'.repeat(100));

    const { data: columns, error: schemaErr } = await supabase
      .from('expenses')
      .select()
      .limit(1);

    if (schemaErr && schemaErr.code === 'PGRST116') {
      console.log('❌ Tabela expenses não existe');
    } else if (schemaErr) {
      console.log(`❌ Erro: ${schemaErr.message}`);
    } else if (columns && columns.length > 0) {
      console.log('✅ Colunas existentes:');
      Object.keys(columns[0]).forEach((col) => {
        console.log(`   • ${col}`);
      });
    } else {
      console.log('⚠️ Tabela existe mas está vazia');
    }

    // 6. Tentar buscar dados de forma alternativa
    console.log('\n\n📊 6. VERIFICAÇÃO ALTERNATIVA - RAW SQL:');
    console.log('-'.repeat(100));

    console.log('⚠️ Nota: Dados podem estar em outra aplicação/banco');
    console.log('         Os valores mostrados no frontend (R$ 129.426,75) não estão no Supabase');
    console.log('         Possibilidades:');
    console.log('         1. Dados vêm de outra fonte/API');
    console.log('         2. Frontend faz cache local');
    console.log('         3. Banco diferente está sendo usado');
    console.log('         4. Dados não foram sincronizados');
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  }
}

await verificarDados();
console.log('\n' + '='.repeat(100));
console.log('✅ Verificação concluída\n');
