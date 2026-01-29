// scripts/correcao_contabil/09_limpar_anomalias.mjs
// Limpa TODAS as anomalias: linhas órfãs, entries desbalanceados, entries vazios

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

function formatMoney(valor) {
  const num = parseFloat(valor) || 0;
  const sinal = num < 0 ? '-' : '';
  return `${sinal}R$ ${Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function limparAnomalias() {
  console.log('\n' + '='.repeat(80));
  console.log(`🧹 LIMPEZA DE TODAS AS ANOMALIAS | MODO: ${MODO}`);
  console.log('='.repeat(80));

  // ============================================
  // 1. CARREGAR DADOS
  // ============================================
  console.log('\n📍 Carregando dados...');

  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id');

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, debit, credit');

  console.log(`   Entries: ${entries.length}`);
  console.log(`   Linhas: ${linhas.length}`);

  const entriesSet = new Set(entries.map(e => e.id));

  // ============================================
  // 2. IDENTIFICAR LINHAS ÓRFÃS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('🔍 FASE 1: Identificando linhas órfãs...');
  console.log('-'.repeat(80));

  const linhasOrfas = linhas.filter(l => !entriesSet.has(l.entry_id));

  let debitosOrfaos = 0;
  let creditosOrfaos = 0;
  for (const l of linhasOrfas) {
    debitosOrfaos += parseFloat(l.debit) || 0;
    creditosOrfaos += parseFloat(l.credit) || 0;
  }

  console.log(`   Linhas órfãs: ${linhasOrfas.length}`);
  console.log(`   Débitos: ${formatMoney(debitosOrfaos)}`);
  console.log(`   Créditos: ${formatMoney(creditosOrfaos)}`);
  console.log(`   Impacto: ${formatMoney(debitosOrfaos - creditosOrfaos)}`);

  // ============================================
  // 3. IDENTIFICAR ENTRIES DESBALANCEADOS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('🔍 FASE 2: Identificando entries desbalanceados...');
  console.log('-'.repeat(80));

  const linhasValidas = linhas.filter(l => entriesSet.has(l.entry_id));
  const linhasPorEntry = {};

  for (const l of linhasValidas) {
    if (!linhasPorEntry[l.entry_id]) {
      linhasPorEntry[l.entry_id] = { debitos: 0, creditos: 0, linhaIds: [] };
    }
    linhasPorEntry[l.entry_id].debitos += parseFloat(l.debit) || 0;
    linhasPorEntry[l.entry_id].creditos += parseFloat(l.credit) || 0;
    linhasPorEntry[l.entry_id].linhaIds.push(l.id);
  }

  const entriesDesbalanceados = [];
  let totalDesbalanceamento = 0;

  for (const [entryId, dados] of Object.entries(linhasPorEntry)) {
    const diff = dados.debitos - dados.creditos;
    if (Math.abs(diff) > 0.01) {
      entriesDesbalanceados.push({
        id: entryId,
        linhaIds: dados.linhaIds,
        diferenca: diff
      });
      totalDesbalanceamento += diff;
    }
  }

  console.log(`   Entries desbalanceados: ${entriesDesbalanceados.length}`);
  console.log(`   Total desbalanceamento: ${formatMoney(totalDesbalanceamento)}`);

  // ============================================
  // 4. IDENTIFICAR ENTRIES SEM LINHAS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('🔍 FASE 3: Identificando entries sem linhas...');
  console.log('-'.repeat(80));

  const entriesSemLinhas = entries.filter(e => !linhasPorEntry[e.id]);

  console.log(`   Entries sem linhas: ${entriesSemLinhas.length}`);

  // ============================================
  // 5. RESUMO DO QUE SERÁ FEITO
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMO DAS AÇÕES');
  console.log('='.repeat(80));

  const linhasOrfasIds = linhasOrfas.map(l => l.id);
  const entriesDesbalanceadosIds = entriesDesbalanceados.map(e => e.id);
  const linhasDeEntriesDesbalanceados = entriesDesbalanceados.flatMap(e => e.linhaIds);
  const entriesSemLinhasIds = entriesSemLinhas.map(e => e.id);

  console.log(`\n   1. Deletar ${linhasOrfasIds.length} linhas órfãs`);
  console.log(`      Impacto: ${formatMoney(debitosOrfaos - creditosOrfaos)}`);

  console.log(`\n   2. Deletar ${entriesDesbalanceadosIds.length} entries desbalanceados`);
  console.log(`      + ${linhasDeEntriesDesbalanceados.length} linhas associadas`);
  console.log(`      Impacto: ${formatMoney(totalDesbalanceamento)}`);

  console.log(`\n   3. Deletar ${entriesSemLinhasIds.length} entries vazios`);
  console.log(`      Impacto: R$ 0,00 (lixo)`);

  const impactoTotal = (debitosOrfaos - creditosOrfaos) + totalDesbalanceamento;
  console.log(`\n   📊 IMPACTO TOTAL ESPERADO: ${formatMoney(impactoTotal)}`);

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FEITA');
    console.log('='.repeat(80));
    console.log('\n🚀 Para executar a limpeza, rode:');
    console.log('   node scripts/correcao_contabil/09_limpar_anomalias.mjs --executar');
    return;
  }

  // ============================================
  // 6. EXECUTAR LIMPEZA
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('🗑️  EXECUTANDO LIMPEZA...');
  console.log('='.repeat(80));

  let totalLinhasDeletadas = 0;
  let totalEntriesDeletados = 0;

  // 6.1 Deletar linhas órfãs
  if (linhasOrfasIds.length > 0) {
    console.log('\n📍 Deletando linhas órfãs...');

    for (let i = 0; i < linhasOrfasIds.length; i += 100) {
      const lote = linhasOrfasIds.slice(i, i + 100);
      const { count, error } = await supabase
        .from('accounting_entry_lines')
        .delete({ count: 'exact' })
        .in('id', lote);

      if (error) {
        console.log(`   ⚠️ Erro no lote ${i}: ${error.message}`);
      } else {
        totalLinhasDeletadas += count || 0;
      }
    }
    console.log(`   ✅ ${totalLinhasDeletadas} linhas órfãs deletadas`);
  }

  // 6.2 Deletar linhas de entries desbalanceados
  if (linhasDeEntriesDesbalanceados.length > 0) {
    console.log('\n📍 Deletando linhas de entries desbalanceados...');

    let linhasDesbalDeletadas = 0;
    for (let i = 0; i < linhasDeEntriesDesbalanceados.length; i += 100) {
      const lote = linhasDeEntriesDesbalanceados.slice(i, i + 100);
      const { count, error } = await supabase
        .from('accounting_entry_lines')
        .delete({ count: 'exact' })
        .in('id', lote);

      if (error) {
        console.log(`   ⚠️ Erro no lote ${i}: ${error.message}`);
      } else {
        linhasDesbalDeletadas += count || 0;
      }
    }
    totalLinhasDeletadas += linhasDesbalDeletadas;
    console.log(`   ✅ ${linhasDesbalDeletadas} linhas deletadas`);
  }

  // 6.3 Deletar entries desbalanceados
  if (entriesDesbalanceadosIds.length > 0) {
    console.log('\n📍 Deletando entries desbalanceados...');

    for (let i = 0; i < entriesDesbalanceadosIds.length; i += 100) {
      const lote = entriesDesbalanceadosIds.slice(i, i + 100);
      const { count, error } = await supabase
        .from('accounting_entries')
        .delete({ count: 'exact' })
        .in('id', lote);

      if (error) {
        console.log(`   ⚠️ Erro no lote ${i}: ${error.message}`);
      } else {
        totalEntriesDeletados += count || 0;
      }
    }
    console.log(`   ✅ ${totalEntriesDeletados} entries desbalanceados deletados`);
  }

  // 6.4 Deletar entries sem linhas
  if (entriesSemLinhasIds.length > 0) {
    console.log('\n📍 Deletando entries vazios...');

    let entriesVaziosDeletados = 0;
    for (let i = 0; i < entriesSemLinhasIds.length; i += 100) {
      const lote = entriesSemLinhasIds.slice(i, i + 100);
      const { count, error } = await supabase
        .from('accounting_entries')
        .delete({ count: 'exact' })
        .in('id', lote);

      if (error) {
        console.log(`   ⚠️ Erro no lote ${i}: ${error.message}`);
      } else {
        entriesVaziosDeletados += count || 0;
      }
    }
    totalEntriesDeletados += entriesVaziosDeletados;
    console.log(`   ✅ ${entriesVaziosDeletados} entries vazios deletados`);
  }

  // ============================================
  // 7. VERIFICAÇÃO FINAL
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  const { data: linhasFinais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = linhasFinais.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCreditos = linhasFinais.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const diferenca = Math.abs(totalDebitos - totalCreditos);

  console.log(`\n   Total Débitos:  ${formatMoney(totalDebitos)}`);
  console.log(`   Total Créditos: ${formatMoney(totalCreditos)}`);
  console.log(`   Diferença:      ${formatMoney(diferenca)}`);

  if (diferenca < 0.01) {
    console.log('\n   ✅ EQUAÇÃO CONTÁBIL BALANCEADA!');
  } else {
    console.log('\n   ⚠️ Ainda há diferença. Verifique se há mais anomalias.');
    console.log('   Execute o script 08 novamente para diagnóstico.');
  }

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

    console.log(`\n   Saldo Banco Sicredi: ${formatMoney(saldoBanco)}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ LIMPEZA CONCLUÍDA!');
  console.log('='.repeat(80));
  console.log(`\n   Total linhas deletadas: ${totalLinhasDeletadas}`);
  console.log(`   Total entries deletados: ${totalEntriesDeletados}`);

  return {
    linhasDeletadas: totalLinhasDeletadas,
    entriesDeletados: totalEntriesDeletados,
    diferencaFinal: diferenca
  };
}

limparAnomalias().catch(console.error);
