// scripts/correcao_contabil/12_verificar_integridade.mjs
// Script para verificação completa de integridade contábil
// Executa todas as verificações em um único script

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatMoney(valor) {
  const num = parseFloat(valor) || 0;
  const sinal = num < 0 ? '-' : '';
  return `${sinal}R$ ${Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function verificarIntegridade() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 VERIFICAÇÃO DE INTEGRIDADE CONTÁBIL');
  console.log('='.repeat(80));

  const problemas = [];
  const avisos = [];

  // ============================================
  // 1. EQUAÇÃO CONTÁBIL
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 1. EQUAÇÃO CONTÁBIL (Débitos = Créditos)');
  console.log('-'.repeat(80));

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = linhas.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCreditos = linhas.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const diferenca = Math.abs(totalDebitos - totalCreditos);

  console.log(`   Total Débitos:  ${formatMoney(totalDebitos)}`);
  console.log(`   Total Créditos: ${formatMoney(totalCreditos)}`);
  console.log(`   Diferença:      ${formatMoney(diferenca)}`);

  if (diferenca > 0.01) {
    problemas.push(`Equação contábil desbalanceada: diferença de ${formatMoney(diferenca)}`);
    console.log('   ❌ ERRO: Equação desbalanceada!');
  } else {
    console.log('   ✅ OK');
  }

  // ============================================
  // 2. LINHAS ÓRFÃS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 2. LINHAS ÓRFÃS (sem entry)');
  console.log('-'.repeat(80));

  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id');

  const entriesSet = new Set(entries.map(e => e.id));

  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id');

  const linhasOrfas = todasLinhas.filter(l => !entriesSet.has(l.entry_id));

  console.log(`   Total linhas: ${todasLinhas.length}`);
  console.log(`   Linhas órfãs: ${linhasOrfas.length}`);

  if (linhasOrfas.length > 0) {
    problemas.push(`${linhasOrfas.length} linhas órfãs encontradas`);
    console.log('   ❌ ERRO: Existem linhas órfãs!');
  } else {
    console.log('   ✅ OK');
  }

  // ============================================
  // 3. ENTRIES DESBALANCEADOS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 3. ENTRIES DESBALANCEADOS (D ≠ C)');
  console.log('-'.repeat(80));

  const { data: linhasComEntry } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id, debit, credit');

  const somasPorEntry = {};
  for (const l of linhasComEntry) {
    if (!entriesSet.has(l.entry_id)) continue;
    if (!somasPorEntry[l.entry_id]) {
      somasPorEntry[l.entry_id] = { d: 0, c: 0 };
    }
    somasPorEntry[l.entry_id].d += parseFloat(l.debit) || 0;
    somasPorEntry[l.entry_id].c += parseFloat(l.credit) || 0;
  }

  const desbalanceados = Object.entries(somasPorEntry)
    .filter(([_, s]) => Math.abs(s.d - s.c) > 0.01);

  console.log(`   Total entries: ${entries.length}`);
  console.log(`   Entries desbalanceados: ${desbalanceados.length}`);

  if (desbalanceados.length > 0) {
    problemas.push(`${desbalanceados.length} entries desbalanceados`);
    console.log('   ❌ ERRO: Existem entries desbalanceados!');
  } else {
    console.log('   ✅ OK');
  }

  // ============================================
  // 4. ENTRIES SEM LINHAS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 4. ENTRIES SEM LINHAS (vazios)');
  console.log('-'.repeat(80));

  const entriesSemLinhas = entries.filter(e => !somasPorEntry[e.id]);

  console.log(`   Entries vazios: ${entriesSemLinhas.length}`);

  if (entriesSemLinhas.length > 0) {
    avisos.push(`${entriesSemLinhas.length} entries vazios (sem impacto contábil)`);
    console.log('   ⚠️ AVISO: Existem entries vazios');
  } else {
    console.log('   ✅ OK');
  }

  // ============================================
  // 5. CONTA SINTÉTICA 1.1.2.01
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 5. CONTA SINTÉTICA 1.1.2.01 (não deve ter lançamentos)');
  console.log('-'.repeat(80));

  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  if (contaSintetica) {
    const { count: lancamentosSintetica } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact' })
      .eq('account_id', contaSintetica.id);

    console.log(`   Lançamentos na sintética: ${lancamentosSintetica || 0}`);

    if (lancamentosSintetica > 0) {
      problemas.push(`${lancamentosSintetica} lançamentos diretos na conta sintética 1.1.2.01`);
      console.log('   ❌ ERRO: NBC TG 26 violada!');
    } else {
      console.log('   ✅ OK');
    }
  }

  // ============================================
  // 6. SOURCE_TYPES SUSPEITOS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 6. SOURCE_TYPES (verificar duplicatas)');
  console.log('-'.repeat(80));

  const { data: entriesPorSource } = await supabase
    .from('accounting_entries')
    .select('source_type');

  const sourceTypeCounts = {};
  for (const e of entriesPorSource) {
    const source = e.source_type || 'null';
    sourceTypeCounts[source] = (sourceTypeCounts[source] || 0) + 1;
  }

  console.log('   Por source_type:');
  for (const [source, count] of Object.entries(sourceTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${source.padEnd(25)} ${count}`);
  }

  // Verificar source_types problemáticos
  const sourcesSuspeitos = ['sicredi_boleto', 'boleto_sicredi', 'boleto_payment'];
  for (const source of sourcesSuspeitos) {
    if (sourceTypeCounts[source] > 0) {
      avisos.push(`source_type '${source}' encontrado (${sourceTypeCounts[source]} entries) - verificar se são duplicatas`);
    }
  }

  if (!sourcesSuspeitos.some(s => sourceTypeCounts[s] > 0)) {
    console.log('\n   ✅ Nenhum source_type suspeito encontrado');
  }

  // ============================================
  // 7. BANCO SICREDI
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 7. SALDO BANCO SICREDI (1.1.1.05)');
  console.log('-'.repeat(80));

  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  if (contaBanco) {
    const { data: linhasBanco } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', contaBanco.id);

    const saldoBanco = linhasBanco.reduce((acc, l) =>
      acc + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0), 0);

    console.log(`   Saldo atual: ${formatMoney(saldoBanco)}`);

    if (saldoBanco < 0) {
      problemas.push(`Saldo do Banco Sicredi negativo: ${formatMoney(saldoBanco)}`);
      console.log('   ❌ ERRO: Saldo negativo!');
    } else {
      console.log('   ✅ OK');
    }
  }

  // ============================================
  // 8. CONTA TRANSITÓRIA 1.1.9.01
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('📊 8. CONTA TRANSITÓRIA 1.1.9.01');
  console.log('-'.repeat(80));

  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .single();

  if (contaTransitoria) {
    const { data: linhasTransitoria } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', contaTransitoria.id);

    const saldoTransitoria = (linhasTransitoria || []).reduce((acc, l) =>
      acc + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0), 0);

    console.log(`   Saldo: ${formatMoney(saldoTransitoria)}`);

    if (Math.abs(saldoTransitoria) > 0.01) {
      avisos.push(`Conta transitória com saldo pendente: ${formatMoney(saldoTransitoria)}`);
      console.log('   ⚠️ AVISO: Saldo não zerado');
    } else {
      console.log('   ✅ OK');
    }
  }

  // ============================================
  // RESUMO FINAL
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMO DA VERIFICAÇÃO');
  console.log('='.repeat(80));

  console.log(`\n   ❌ Problemas críticos: ${problemas.length}`);
  for (const p of problemas) {
    console.log(`      - ${p}`);
  }

  console.log(`\n   ⚠️ Avisos: ${avisos.length}`);
  for (const a of avisos) {
    console.log(`      - ${a}`);
  }

  if (problemas.length === 0) {
    console.log('\n   ✅ SISTEMA CONTÁBIL ÍNTEGRO!');
  } else {
    console.log('\n   ❌ AÇÃO NECESSÁRIA: Execute os scripts de correção');
    console.log('      node scripts/correcao_contabil/11_limpeza_total_loop.mjs');
  }

  console.log('\n' + '='.repeat(80));

  return {
    integro: problemas.length === 0,
    problemas,
    avisos,
    totais: {
      debitos: totalDebitos,
      creditos: totalCreditos,
      entries: entries.length,
      linhas: todasLinhas.length
    }
  };
}

verificarIntegridade().catch(console.error);
