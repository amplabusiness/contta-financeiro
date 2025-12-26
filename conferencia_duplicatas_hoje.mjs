#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

// Ler variáveis de ambiente
let supabaseUrl, supabaseKey;
try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
  supabaseUrl = urlMatch?.[1];
  supabaseKey = keyMatch?.[1];
} catch (e) {
  console.error('❌ Não consegui ler .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

console.log('🔍 CONFERÊNCIA DE LANÇAMENTOS - ' + hoje);
console.log('='.repeat(80));

async function conferirDuplicatas() {
  try {
    // 1. Buscar todos os lançamentos de hoje
    console.log('\n📅 1. LANÇAMENTOS DO DIA');
    console.log('-'.repeat(80));

    const { data: expenses, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', `${hoje}T00:00:00`)
      .lt('created_at', `${hoje}T23:59:59`)
      .order('created_at', { ascending: false });

    if (expenseError) {
      console.error('❌ Erro ao buscar despesas:', expenseError);
      return;
    }

    console.log(`✅ Encontrados ${expenses?.length || 0} lançamentos de despesas hoje\n`);

    if (expenses && expenses.length > 0) {
      // Agrupar por descrição para detectar duplicatas óbvias
      const groupedByDescription = {};
      expenses.forEach((exp) => {
        const key = `${exp.description}_${exp.amount}`;
        if (!groupedByDescription[key]) {
          groupedByDescription[key] = [];
        }
        groupedByDescription[key].push(exp);
      });

      // Mostrar possíveis duplicatas
      console.log('📊 POSSÍVEIS DUPLICATAS (mesma descrição + valor):');
      let temDuplicatas = false;
      Object.entries(groupedByDescription).forEach(([key, items]) => {
        if (items.length > 1) {
          temDuplicatas = true;
          const [desc, amount] = key.split('_');
          console.log(`\n⚠️  ${items.length}x DUPLICADA:`);
          console.log(`    Descrição: ${desc}`);
          console.log(`    Valor: R$ ${parseFloat(amount).toFixed(2)}`);
          items.forEach((item, idx) => {
            console.log(`      ${idx + 1}. ID: ${item.id}`);
            console.log(`         Criado: ${item.created_at}`);
            console.log(`         Usuário: ${item.user_id || 'Desconhecido'}`);
          });
        }
      });

      if (!temDuplicatas) {
        console.log('✅ Nenhuma duplicata óbvia (mesma descrição + valor)');
      }
    }

    // 2. Verificar lançamentos contábeis relacionados
    console.log('\n\n📊 2. LANÇAMENTOS CONTÁBEIS CORRESPONDENTES');
    console.log('-'.repeat(80));

    const { data: entries, error: entryError } = await supabase
      .from('accounting_entries')
      .select('*')
      .gte('created_at', `${hoje}T00:00:00`)
      .lt('created_at', `${hoje}T23:59:59`)
      .eq('reference_type', 'expense')
      .order('created_at', { ascending: false });

    if (entryError) {
      console.error('❌ Erro ao buscar lançamentos contábeis:', entryError);
      return;
    }

    console.log(`✅ Encontrados ${entries?.length || 0} lançamentos contábeis para despesas hoje\n`);

    // 3. Verificar se há lançamentos órfãos
    console.log('3. ANÁLISE DE INTEGRIDADE');
    console.log('-'.repeat(80));

    const expenseIds = new Set(expenses?.map((e) => e.id) || []);
    const entryReferences = new Set(entries?.map((e) => e.reference_id) || []);

    // Lançamentos sem despesa correspondente
    const orphanedEntries = entries?.filter((e) => !expenseIds.has(e.reference_id)) || [];

    if (orphanedEntries.length > 0) {
      console.log(`\n⚠️  LANÇAMENTOS ÓRFÃOS: ${orphanedEntries.length}`);
      orphanedEntries.forEach((entry) => {
        console.log(`\n    Entry ID: ${entry.id}`);
        console.log(`    Referência: ${entry.reference_id}`);
        console.log(`    Descrição: ${entry.description}`);
        console.log(`    Data: ${entry.created_at}`);
      });
    } else {
      console.log('\n✅ Nenhum lançamento órfão encontrado');
    }

    // Despesas sem lançamento correspondente
    const orphanedExpenses = expenses?.filter((e) => !entryReferences.has(e.id)) || [];

    if (orphanedExpenses.length > 0) {
      console.log(`\n⚠️  DESPESAS SEM LANÇAMENTO CONTÁBIL: ${orphanedExpenses.length}`);
      orphanedExpenses.forEach((exp) => {
        console.log(`\n    Expense ID: ${exp.id}`);
        console.log(`    Descrição: ${exp.description}`);
        console.log(`    Valor: R$ ${exp.amount?.toFixed(2)}`);
        console.log(`    Data: ${exp.created_at}`);
      });
    } else {
      console.log('\n✅ Todas as despesas têm lançamento contábil');
    }

    // 4. Verificar rastreamento (se implementado)
    console.log('\n\n4. SISTEMA DE RASTREAMENTO');
    console.log('-'.repeat(80));

    const { data: tracking, error: trackingError } = await supabase
      .from('accounting_entry_tracking')
      .select('*')
      .gte('created_at', `${hoje}T00:00:00`)
      .lt('created_at', `${hoje}T23:59:59`)
      .order('created_at', { ascending: false });

    if (trackingError && trackingError.code !== 'PGRST116') {
      console.log('⚠️  Tabela de rastreamento não existe (não foi criada a migração)');
    } else if (tracking && tracking.length > 0) {
      console.log(`✅ Encontrados ${tracking.length} registros de rastreamento\n`);

      // Verificar códigos duplicados
      const codigosDuplicados = {};
      tracking.forEach((t) => {
        if (!codigosDuplicados[t.codigo_rastreamento]) {
          codigosDuplicados[t.codigo_rastreamento] = [];
        }
        codigosDuplicados[t.codigo_rastreamento].push(t);
      });

      const duplicadosEncontrados = Object.values(codigosDuplicados).filter((v) => v.length > 1);

      if (duplicadosEncontrados.length > 0) {
        console.log(`⚠️  CÓDIGOS DE RASTREAMENTO DUPLICADOS: ${duplicadosEncontrados.length}`);
        duplicadosEncontrados.forEach((group) => {
          console.log(`\n    Código: ${group[0].codigo_rastreamento}`);
          console.log(`    Ocorrências: ${group.length}`);
          group.forEach((item, idx) => {
            console.log(`      ${idx + 1}. Entry ID: ${item.entry_id}`);
            console.log(`         Tipo: ${item.tipo}`);
            console.log(`         Data: ${item.created_at}`);
            console.log(`         Duplicado: ${item.foi_duplicado ? 'SIM ⚠️' : 'Não'}`);
          });
        });
      } else {
        console.log('✅ Todos os códigos de rastreamento são únicos');
      }
    } else {
      console.log('⚠️  Nenhum registro de rastreamento encontrado (sistema não foi inicializado)');
    }

    // 5. Resumo por usuário
    console.log('\n\n5. RESUMO POR USUÁRIO');
    console.log('-'.repeat(80));

    if (expenses && expenses.length > 0) {
      const byUser = {};
      expenses.forEach((exp) => {
        const userId = exp.user_id || 'Desconhecido';
        if (!byUser[userId]) {
          byUser[userId] = { count: 0, total: 0, items: [] };
        }
        byUser[userId].count += 1;
        byUser[userId].total += exp.amount || 0;
        byUser[userId].items.push(exp);
      });

      Object.entries(byUser).forEach(([userId, data]) => {
        console.log(`\n👤 ${userId}`);
        console.log(`   Lançamentos: ${data.count}`);
        console.log(`   Total: R$ ${data.total.toFixed(2)}`);

        // Detectar múltiplos lançamentos do mesmo usuário em curto tempo
        if (data.count > 1) {
          const times = data.items.map((i) => new Date(i.created_at).getTime());
          const minDiff = Math.min(...times.map((t, i, arr) => i > 0 ? t - arr[i - 1] : Infinity));

          if (minDiff < 5000) {
            // Menos de 5 segundos
            console.log(`   ⚠️  Múltiplas despesas em curto intervalo (${minDiff}ms)`);
          }
        }
      });
    }

    // 6. Estatísticas gerais
    console.log('\n\n6. ESTATÍSTICAS GERAIS');
    console.log('-'.repeat(80));

    const totalExpenses = expenses?.length || 0;
    const totalEntries = entries?.length || 0;
    const totalTracking = tracking?.length || 0;

    console.log(`\n📈 RESUMO DO DIA (${hoje}):`);
    console.log(`   • Despesas lançadas: ${totalExpenses}`);
    console.log(`   • Lançamentos contábeis: ${totalEntries}`);
    console.log(`   • Registros de rastreamento: ${totalTracking}`);
    console.log(`   • Lançamentos órfãos: ${orphanedEntries.length}`);
    console.log(`   • Despesas sem lançamento: ${orphanedExpenses.length}`);

    // Status geral
    console.log('\n🎯 STATUS GERAL:');
    if (orphanedEntries.length === 0 && orphanedExpenses.length === 0) {
      console.log('   ✅ SISTEMA ÍNTEGRO - Nenhuma inconsistência detectada');
    } else {
      console.log('   ⚠️  PROBLEMAS DETECTADOS - Veja detalhes acima');
    }

    // 7. Comando para limpar órfãos (se necessário)
    if (orphanedEntries.length > 0 || orphanedExpenses.length > 0) {
      console.log('\n\n⚡ COMANDO PARA VERIFICAÇÃO DE DETALHES:');
      console.log('-'.repeat(80));
      console.log('\nPara limpar lançamentos órfãos, execute:');
      console.log('  node deletar_lancamentos_orfaos.mjs');
    }
  } catch (error) {
    console.error('❌ Erro durante conferência:', error.message);
  }
}

// Executar conferência
await conferirDuplicatas();
console.log('\n' + '='.repeat(80));
console.log('✅ Conferência concluída\n');
