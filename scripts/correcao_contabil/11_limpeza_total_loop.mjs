// scripts/correcao_contabil/11_limpeza_total_loop.mjs
// Executa limpeza em loop até não haver mais anomalias

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';
const MAX_ITERACOES = 10;

function formatMoney(valor) {
  const num = parseFloat(valor) || 0;
  const sinal = num < 0 ? '-' : '';
  return `${sinal}R$ ${Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function identificarAnomalias() {
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id');

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, debit, credit');

  const entriesSet = new Set(entries.map(e => e.id));

  // Linhas órfãs
  const linhasOrfas = linhas.filter(l => !entriesSet.has(l.entry_id));

  // Agrupar linhas por entry
  const linhasPorEntry = {};
  for (const l of linhas) {
    if (!entriesSet.has(l.entry_id)) continue;
    if (!linhasPorEntry[l.entry_id]) {
      linhasPorEntry[l.entry_id] = { debitos: 0, creditos: 0, linhaIds: [] };
    }
    linhasPorEntry[l.entry_id].debitos += parseFloat(l.debit) || 0;
    linhasPorEntry[l.entry_id].creditos += parseFloat(l.credit) || 0;
    linhasPorEntry[l.entry_id].linhaIds.push(l.id);
  }

  // Entries desbalanceados
  const entriesDesbalanceados = [];
  for (const [entryId, dados] of Object.entries(linhasPorEntry)) {
    const diff = dados.debitos - dados.creditos;
    if (Math.abs(diff) > 0.01) {
      entriesDesbalanceados.push({ id: entryId, linhaIds: dados.linhaIds });
    }
  }

  // Entries sem linhas
  const entriesSemLinhas = entries.filter(e => !linhasPorEntry[e.id]);

  return {
    linhasOrfas,
    entriesDesbalanceados,
    entriesSemLinhas,
    totalAnomalias: linhasOrfas.length + entriesDesbalanceados.length + entriesSemLinhas.length
  };
}

async function limparAnomalias(anomalias) {
  let totalLinhasDeletadas = 0;
  let totalEntriesDeletados = 0;

  // 1. Deletar linhas órfãs
  if (anomalias.linhasOrfas.length > 0) {
    const ids = anomalias.linhasOrfas.map(l => l.id);
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      const { count } = await supabase
        .from('accounting_entry_lines')
        .delete({ count: 'exact' })
        .in('id', lote);
      totalLinhasDeletadas += count || 0;
    }
  }

  // 2. Deletar linhas de entries desbalanceados
  const linhasDesbal = anomalias.entriesDesbalanceados.flatMap(e => e.linhaIds);
  if (linhasDesbal.length > 0) {
    for (let i = 0; i < linhasDesbal.length; i += 100) {
      const lote = linhasDesbal.slice(i, i + 100);
      const { count } = await supabase
        .from('accounting_entry_lines')
        .delete({ count: 'exact' })
        .in('id', lote);
      totalLinhasDeletadas += count || 0;
    }
  }

  // 3. Deletar entries desbalanceados
  const idsDesbal = anomalias.entriesDesbalanceados.map(e => e.id);
  if (idsDesbal.length > 0) {
    for (let i = 0; i < idsDesbal.length; i += 100) {
      const lote = idsDesbal.slice(i, i + 100);
      const { count } = await supabase
        .from('accounting_entries')
        .delete({ count: 'exact' })
        .in('id', lote);
      totalEntriesDeletados += count || 0;
    }
  }

  // 4. Deletar entries sem linhas
  const idsSemLinhas = anomalias.entriesSemLinhas.map(e => e.id);
  if (idsSemLinhas.length > 0) {
    for (let i = 0; i < idsSemLinhas.length; i += 100) {
      const lote = idsSemLinhas.slice(i, i + 100);
      const { count } = await supabase
        .from('accounting_entries')
        .delete({ count: 'exact' })
        .in('id', lote);
      totalEntriesDeletados += count || 0;
    }
  }

  return { totalLinhasDeletadas, totalEntriesDeletados };
}

async function verificarEquacao() {
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = linhas.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCreditos = linhas.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const diferenca = totalDebitos - totalCreditos;

  return { totalDebitos, totalCreditos, diferenca, totalLinhas: linhas.length };
}

async function limpezaTotalLoop() {
  console.log('\n' + '='.repeat(80));
  console.log(`🔄 LIMPEZA TOTAL EM LOOP | MODO: ${MODO} | MAX: ${MAX_ITERACOES} iterações`);
  console.log('='.repeat(80));

  let iteracao = 0;
  let totalLinhasGeral = 0;
  let totalEntriesGeral = 0;

  while (iteracao < MAX_ITERACOES) {
    iteracao++;
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📍 ITERAÇÃO ${iteracao}`);
    console.log('─'.repeat(80));

    // Identificar anomalias
    const anomalias = await identificarAnomalias();

    console.log(`   Linhas órfãs: ${anomalias.linhasOrfas.length}`);
    console.log(`   Entries desbalanceados: ${anomalias.entriesDesbalanceados.length}`);
    console.log(`   Entries sem linhas: ${anomalias.entriesSemLinhas.length}`);
    console.log(`   TOTAL anomalias: ${anomalias.totalAnomalias}`);

    if (anomalias.totalAnomalias === 0) {
      console.log('\n   ✅ Nenhuma anomalia encontrada! Saindo do loop.');
      break;
    }

    if (MODO === 'SIMULACAO') {
      console.log('\n   ⚠️ Modo simulação - não executando limpeza');
      break;
    }

    // Executar limpeza
    console.log('\n   🗑️ Executando limpeza...');
    const resultado = await limparAnomalias(anomalias);

    console.log(`   ✅ ${resultado.totalLinhasDeletadas} linhas deletadas`);
    console.log(`   ✅ ${resultado.totalEntriesDeletados} entries deletados`);

    totalLinhasGeral += resultado.totalLinhasDeletadas;
    totalEntriesGeral += resultado.totalEntriesDeletados;

    // Verificar equação
    const eq = await verificarEquacao();
    console.log(`\n   📊 Equação: D=${formatMoney(eq.totalDebitos)} C=${formatMoney(eq.totalCreditos)} Diff=${formatMoney(eq.diferenca)}`);

    if (Math.abs(eq.diferenca) < 0.01) {
      console.log('   ✅ EQUAÇÃO BALANCEADA!');
      break;
    }
  }

  // Resultado final
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTADO FINAL');
  console.log('='.repeat(80));

  const eqFinal = await verificarEquacao();

  console.log(`\n   Iterações executadas: ${iteracao}`);
  console.log(`   Total linhas deletadas: ${totalLinhasGeral}`);
  console.log(`   Total entries deletados: ${totalEntriesGeral}`);
  console.log(`\n   Total Débitos:  ${formatMoney(eqFinal.totalDebitos)}`);
  console.log(`   Total Créditos: ${formatMoney(eqFinal.totalCreditos)}`);
  console.log(`   Diferença:      ${formatMoney(eqFinal.diferenca)}`);
  console.log(`   Total linhas restantes: ${eqFinal.totalLinhas}`);

  if (Math.abs(eqFinal.diferenca) < 0.01) {
    console.log('\n   ✅ EQUAÇÃO CONTÁBIL BALANCEADA!');
  } else {
    console.log('\n   ⚠️ Ainda há diferença. Pode ser problema nos dados originais.');
  }

  // Verificar saldo do banco
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

  // Contar entries restantes por source_type
  const { data: entriesRestantes } = await supabase
    .from('accounting_entries')
    .select('source_type');

  const porSource = {};
  for (const e of entriesRestantes || []) {
    const src = e.source_type || 'null';
    porSource[src] = (porSource[src] || 0) + 1;
  }

  console.log('\n   Entries restantes por source_type:');
  for (const [src, qtd] of Object.entries(porSource).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${src}: ${qtd}`);
  }

  console.log('\n' + '='.repeat(80));

  return {
    iteracoes: iteracao,
    linhasDeletadas: totalLinhasGeral,
    entriesDeletados: totalEntriesGeral,
    diferencaFinal: eqFinal.diferenca
  };
}

limpezaTotalLoop().catch(console.error);
