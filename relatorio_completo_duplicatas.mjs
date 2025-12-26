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

console.log('📊 RELATÓRIO COMPLETO DE DUPLICATAS');
console.log('='.repeat(100));

async function analisarDuplicatas() {
  try {
    // 1. Buscar últimos 30 dias
    console.log('\n📅 1. ANÁLISE DOS ÚLTIMOS 30 DIAS');
    console.log('-'.repeat(100));

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);
    const dataLimiteStr = dataLimite.toISOString().split('T')[0];

    const { data: expenses, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', dataLimiteStr)
      .order('created_at', { ascending: false });

    if (expenseError) {
      console.error('❌ Erro ao buscar despesas:', expenseError);
      return;
    }

    console.log(`✅ Encontrados ${expenses?.length || 0} lançamentos nos últimos 30 dias\n`);

    // Agrupar por dia
    const byDay = {};
    expenses?.forEach((exp) => {
      const day = exp.created_at.split('T')[0];
      if (!byDay[day]) {
        byDay[day] = [];
      }
      byDay[day].push(exp);
    });

    // Mostrar resumo por dia
    console.log('📊 RESUMO POR DIA (últimos 30 dias):');
    Object.entries(byDay)
      .sort()
      .reverse()
      .slice(0, 10)
      .forEach(([day, items]) => {
        const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        console.log(`  ${day}: ${items.length} despesas - R$ ${total.toFixed(2)}`);
      });

    // 2. Detectar possíveis padrões de duplicação
    console.log('\n\n🔍 2. ANÁLISE DE PADRÕES SUSPEITOS');
    console.log('-'.repeat(100));

    const suspeitos = [];

    expenses?.forEach((exp) => {
      // Procurar por despesas com mesma descrição e valor criadas em sequência
      const matches = expenses.filter(
        (e) =>
          e.description === exp.description &&
          e.amount === exp.amount &&
          e.id !== exp.id &&
          e.category === exp.category
      );

      if (matches.length > 0) {
        suspeitos.push({
          description: exp.description,
          amount: exp.amount,
          category: exp.category,
          occurrences: matches.length + 1,
          ids: [exp.id, ...matches.map((m) => m.id)],
          dates: [exp.created_at, ...matches.map((m) => m.created_at)],
        });
      }
    });

    // Remover duplicatas da lista suspeitos
    const suspeitosUnicos = [];
    const seen = new Set();
    suspeitos.forEach((s) => {
      const key = `${s.description}_${s.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        suspeitosUnicos.push(s);
      }
    });

    if (suspeitosUnicos.length > 0) {
      console.log(`⚠️  ENCONTRADOS ${suspeitosUnicos.length} PADRÕES SUSPEITOS:\n`);

      suspeitosUnicos.forEach((s, idx) => {
        console.log(`${idx + 1}. Descrição: "${s.description}"`);
        console.log(`   Valor: R$ ${s.amount.toFixed(2)}`);
        console.log(`   Categoria: ${s.category}`);
        console.log(`   Vezes duplicada: ${s.occurrences}x`);
        console.log(`   IDs: ${s.ids.slice(0, 3).join(', ')}${s.ids.length > 3 ? '...' : ''}`);
        console.log(`   Datas:`);
        s.dates.forEach((d) => {
          console.log(`     • ${d}`);
        });
        console.log();
      });
    } else {
      console.log('✅ Nenhum padrão suspeito de duplicação encontrado');
    }

    // 3. Verificar integridade com lançamentos contábeis
    console.log('\n\n📊 3. INTEGRIDADE DESPESAS <-> LANÇAMENTOS CONTÁBEIS');
    console.log('-'.repeat(100));

    const { data: entries, error: entryError } = await supabase
      .from('accounting_entries')
      .select('*')
      .gte('created_at', dataLimiteStr)
      .eq('reference_type', 'expense');

    if (entryError) {
      console.error('❌ Erro ao buscar lançamentos:', entryError);
      return;
    }

    const expenseIds = new Set(expenses?.map((e) => e.id) || []);
    const orphanedEntries = entries?.filter((e) => !expenseIds.has(e.reference_id)) || [];
    const orphanedExpenses = expenses?.filter((e) => !entries?.map((en) => en.reference_id).includes(e.id)) || [];

    console.log(`✅ Lançamentos contábeis: ${entries?.length || 0}`);
    console.log(`   Correspondência: ${(expenseIds.size === entries?.length ? '✅ 1:1' : '⚠️ Desalinhada')}`);

    if (orphanedEntries.length > 0) {
      console.log(`\n⚠️  LANÇAMENTOS ÓRFÃOS: ${orphanedEntries.length}`);
      orphanedEntries.forEach((entry) => {
        console.log(
          `   • Entry ID: ${entry.id} (Referência: ${entry.reference_id}) - ${entry.created_at.split('T')[0]}`
        );
      });
    }

    if (orphanedExpenses.length > 0) {
      console.log(`\n⚠️  DESPESAS SEM LANÇAMENTO: ${orphanedExpenses.length}`);
      orphanedExpenses.forEach((exp) => {
        console.log(
          `   • Expense ID: ${exp.id} (${exp.description}) - R$ ${exp.amount.toFixed(2)} - ${exp.created_at.split('T')[0]}`
        );
      });
    }

    if (orphanedEntries.length === 0 && orphanedExpenses.length === 0) {
      console.log('\n✅ Integridade perfeita - todas as despesas têm lançamentos correspondentes');
    }

    // 4. Estatísticas gerais
    console.log('\n\n📈 4. ESTATÍSTICAS GERAIS');
    console.log('-'.repeat(100));

    const categorias = {};
    const usuarios = {};
    let totalAmount = 0;

    expenses?.forEach((exp) => {
      // Por categoria
      if (!categorias[exp.category]) {
        categorias[exp.category] = { count: 0, amount: 0 };
      }
      categorias[exp.category].count += 1;
      categorias[exp.category].amount += exp.amount || 0;

      // Por usuário
      const userId = exp.user_id || 'Desconhecido';
      if (!usuarios[userId]) {
        usuarios[userId] = { count: 0, amount: 0 };
      }
      usuarios[userId].count += 1;
      usuarios[userId].amount += exp.amount || 0;

      totalAmount += exp.amount || 0;
    });

    console.log(`\nPeriodo: Últimos 30 dias`);
    console.log(`Total de Despesas: ${expenses?.length || 0}`);
    console.log(`Valor Total: R$ ${totalAmount.toFixed(2)}`);
    console.log(`Média por Despesa: R$ ${(totalAmount / (expenses?.length || 1)).toFixed(2)}`);

    console.log('\nPor Categoria:');
    Object.entries(categorias)
      .sort((a, b) => b[1].amount - a[1].amount)
      .forEach(([cat, data]) => {
        const pct = ((data.amount / totalAmount) * 100).toFixed(1);
        console.log(`  • ${cat || 'Sem Categoria'}: ${data.count} (R$ ${data.amount.toFixed(2)}) - ${pct}%`);
      });

    console.log('\nPor Usuário:');
    Object.entries(usuarios)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([user, data]) => {
        console.log(`  • ${user}: ${data.count} despesas (R$ ${data.amount.toFixed(2)})`);
      });

    // 5. Verificar duplicatas por descrição + valor + criado no mesmo dia
    console.log('\n\n🔐 5. VERIFICAÇÃO STRICT (MESMA DATA + DESCRIÇÃO + VALOR)');
    console.log('-'.repeat(100));

    const duplicatasMesmaData = {};

    expenses?.forEach((exp) => {
      const day = exp.created_at.split('T')[0];
      const key = `${day}_${exp.description}_${exp.amount}`;

      if (!duplicatasMesmaData[key]) {
        duplicatasMesmaData[key] = [];
      }
      duplicatasMesmaData[key].push(exp);
    });

    const dupsEncontrados = Object.values(duplicatasMesmaData).filter((v) => v.length > 1);

    if (dupsEncontrados.length > 0) {
      console.log(`⚠️  DUPLICATAS EXATAS ENCONTRADAS: ${dupsEncontrados.length}\n`);

      dupsEncontrados.forEach((group, idx) => {
        console.log(`${idx + 1}. Data: ${group[0].created_at.split('T')[0]}`);
        console.log(`   Descrição: "${group[0].description}"`);
        console.log(`   Valor: R$ ${group[0].amount.toFixed(2)}`);
        console.log(`   Ocorrências: ${group.length}`);
        console.log(`   IDs: ${group.map((g) => g.id.slice(0, 8)).join(', ')}`);
        group.forEach((item, i) => {
          console.log(`     ${i + 1}. Criado: ${item.created_at} | Usuário: ${item.user_id || 'Desconhecido'}`);
        });
        console.log();
      });
    } else {
      console.log('✅ Nenhuma duplicata exata encontrada (mesma data + descrição + valor)');
    }

    // 6. Recomendações
    console.log('\n\n💡 6. RECOMENDAÇÕES');
    console.log('-'.repeat(100));

    console.log(`\n✅ SISTEMA SEGURO: ${dupsEncontrados.length === 0 ? 'SIM' : 'NÃO'}`);

    if (dupsEncontrados.length > 0) {
      console.log(`\n⚠️  AÇÕES RECOMENDADAS:`);
      console.log(`  1. Revisar com usuários por que houve duplicação`);
      console.log(`  2. Usar comando: node deletar_lancamentos_orfaos.mjs`);
      console.log(`  3. Considerar implementar sistema de rastreamento`);
      console.log(`  4. Validar com contador`);
    }

    if (orphanedEntries.length > 0 || orphanedExpenses.length > 0) {
      console.log(`\n⚠️  INTEGRIDADE: Há inconsistências entre despesas e lançamentos`);
      console.log(`  1. Execute: node deletar_lancamentos_orfaos.mjs`);
      console.log(`  2. Verifique os resultados`);
      console.log(`  3. Valide no contador`);
    } else {
      console.log(`\n✅ INTEGRIDADE: Perfeita - sem inconsistências`);
    }

    if (suspeitosUnicos.length > 0) {
      console.log(`\n⚠️  VIGILÂNCIA: ${suspeitosUnicos.length} padrões suspeitos detectados`);
      console.log(`  1. Não são necessariamente duplicatas`);
      console.log(`  2. Podem ser despesas legítimas repetidas`);
      console.log(`  3. Valide manualmente com os usuários`);
    } else {
      console.log(`\n✅ VIGILÂNCIA: Sem padrões suspeitos`);
    }
  } catch (error) {
    console.error('❌ Erro durante análise:', error.message);
  }
}

// Executar análise
await analisarDuplicatas();
console.log('\n' + '='.repeat(100));
console.log('✅ Relatório concluído\n');
