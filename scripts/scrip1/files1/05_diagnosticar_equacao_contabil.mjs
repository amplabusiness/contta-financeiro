// scripts/05_diagnosticar_equacao_contabil.mjs
// Identifica e corrige problemas na equação contábil após limpeza de duplicatas

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatMoney(valor) {
  return `R$ ${(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function diagnosticarEquacao() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 DIAGNÓSTICO DA EQUAÇÃO CONTÁBIL');
  console.log('='.repeat(70));

  // 1. Totais gerais
  console.log('\n📊 1. TOTAIS GERAIS');
  console.log('-'.repeat(70));

  const { data: totais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = totais.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCreditos = totais.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const diferenca = totalDebitos - totalCreditos;

  console.log(`   Total Débitos:  ${formatMoney(totalDebitos)}`);
  console.log(`   Total Créditos: ${formatMoney(totalCreditos)}`);
  console.log(`   Diferença:      ${formatMoney(diferenca)}`);

  // 2. Verificar entries desbalanceados
  console.log('\n📊 2. ENTRIES DESBALANCEADOS (Débito ≠ Crédito)');
  console.log('-'.repeat(70));

  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, source_type, reference_type');

  let desbalanceados = [];
  let totalDesbalanceamento = 0;

  // Processar em lotes
  for (let i = 0; i < entries.length; i += 100) {
    const lote = entries.slice(i, i + 100);
    const ids = lote.map(e => e.id);

    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('entry_id, debit, credit')
      .in('entry_id', ids);

    // Agrupar por entry_id
    const porEntry = {};
    for (const l of linhas || []) {
      if (!porEntry[l.entry_id]) {
        porEntry[l.entry_id] = { debitos: 0, creditos: 0 };
      }
      porEntry[l.entry_id].debitos += parseFloat(l.debit) || 0;
      porEntry[l.entry_id].creditos += parseFloat(l.credit) || 0;
    }

    // Verificar desbalanceamento
    for (const entry of lote) {
      const somas = porEntry[entry.id] || { debitos: 0, creditos: 0 };
      const diff = Math.abs(somas.debitos - somas.creditos);
      
      if (diff > 0.01) {
        desbalanceados.push({
          ...entry,
          debitos: somas.debitos,
          creditos: somas.creditos,
          diferenca: somas.debitos - somas.creditos
        });
        totalDesbalanceamento += somas.debitos - somas.creditos;
      }
    }
  }

  console.log(`   Entries desbalanceados: ${desbalanceados.length}`);
  console.log(`   Total desbalanceamento: ${formatMoney(totalDesbalanceamento)}`);

  if (desbalanceados.length > 0) {
    // Agrupar por source_type
    const porSource = {};
    for (const e of desbalanceados) {
      const source = e.source_type || 'null';
      if (!porSource[source]) {
        porSource[source] = { qtd: 0, diferenca: 0 };
      }
      porSource[source].qtd++;
      porSource[source].diferenca += e.diferenca;
    }

    console.log('\n   Por source_type:');
    for (const [source, dados] of Object.entries(porSource).sort((a, b) => Math.abs(b[1].diferenca) - Math.abs(a[1].diferenca))) {
      console.log(`   ${source.padEnd(25)} ${String(dados.qtd).padStart(6)} entries  ${formatMoney(dados.diferenca).padStart(18)}`);
    }

    // Mostrar amostra
    console.log('\n   Amostra (10 primeiros):');
    for (const e of desbalanceados.slice(0, 10)) {
      console.log(`   ${e.entry_date?.substring(0, 10)} | ${(e.source_type || '').padEnd(20)} | D: ${formatMoney(e.debitos).padStart(15)} C: ${formatMoney(e.creditos).padStart(15)} | Diff: ${formatMoney(e.diferenca)}`);
    }
  }

  // 3. Verificar entries sem linhas
  console.log('\n📊 3. ENTRIES SEM LINHAS (Órfãos)');
  console.log('-'.repeat(70));

  const { data: entriesSemLinhas } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, source_type')
    .not('id', 'in', 
      supabase.from('accounting_entry_lines').select('entry_id')
    );

  // Alternativa: buscar manualmente
  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id');
  
  const entryIdsComLinhas = new Set(todasLinhas.map(l => l.entry_id));
  const entriesOrfaos = entries.filter(e => !entryIdsComLinhas.has(e.id));

  console.log(`   Entries sem linhas: ${entriesOrfaos.length}`);

  if (entriesOrfaos.length > 0) {
    const porSource = {};
    for (const e of entriesOrfaos) {
      const source = e.source_type || 'null';
      if (!porSource[source]) porSource[source] = 0;
      porSource[source]++;
    }

    console.log('\n   Por source_type:');
    for (const [source, qtd] of Object.entries(porSource).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${source.padEnd(25)} ${qtd} entries`);
    }
  }

  // 4. Verificar linhas sem entry
  console.log('\n📊 4. LINHAS SEM ENTRY (Órfãs)');
  console.log('-'.repeat(70));

  const entryIdsExistentes = new Set(entries.map(e => e.id));
  const linhasOrfas = todasLinhas.filter(l => !entryIdsExistentes.has(l.entry_id));

  console.log(`   Linhas órfãs: ${linhasOrfas.length}`);

  // 5. Análise por natureza de conta
  console.log('\n📊 5. SALDOS POR NATUREZA DE CONTA');
  console.log('-'.repeat(70));

  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, nature');

  const contasPorId = new Map(contas.map(c => [c.id, c]));

  const { data: todasLinhasCompletas } = await supabase
    .from('accounting_entry_lines')
    .select('account_id, debit, credit');

  const porTipo = {};
  for (const linha of todasLinhasCompletas) {
    const conta = contasPorId.get(linha.account_id);
    const tipo = conta?.account_type || 'DESCONHECIDO';
    
    if (!porTipo[tipo]) {
      porTipo[tipo] = { debitos: 0, creditos: 0, saldo: 0 };
    }
    porTipo[tipo].debitos += parseFloat(linha.debit) || 0;
    porTipo[tipo].creditos += parseFloat(linha.credit) || 0;
  }

  // Calcular saldos
  for (const tipo of Object.keys(porTipo)) {
    const dados = porTipo[tipo];
    // ATIVO e DESPESA: saldo = débitos - créditos
    // PASSIVO, RECEITA, PATRIMÔNIO: saldo = créditos - débitos
    if (tipo === 'ATIVO' || tipo === 'DESPESA') {
      dados.saldo = dados.debitos - dados.creditos;
    } else {
      dados.saldo = dados.creditos - dados.debitos;
    }
  }

  console.log('   ' + 'Tipo'.padEnd(15) + 'Débitos'.padStart(20) + 'Créditos'.padStart(20) + 'Saldo'.padStart(20));
  console.log('   ' + '-'.repeat(75));

  for (const [tipo, dados] of Object.entries(porTipo).sort()) {
    console.log(
      '   ' + tipo.padEnd(15) +
      formatMoney(dados.debitos).padStart(20) +
      formatMoney(dados.creditos).padStart(20) +
      formatMoney(dados.saldo).padStart(20)
    );
  }

  // 6. Recomendações
  console.log('\n' + '='.repeat(70));
  console.log('📋 RECOMENDAÇÕES');
  console.log('='.repeat(70));

  if (desbalanceados.length > 0) {
    console.log('\n❌ PROBLEMA: Entries desbalanceados');
    console.log('   CAUSA PROVÁVEL: Ao deletar boleto_sicredi, foram deletadas linhas');
    console.log('                   mas os entries ficaram com contrapartidas pendentes.');
    console.log('   SOLUÇÃO: Deletar os entries desbalanceados completamente');
    console.log('            ou restaurar as linhas faltantes.');
    console.log(`\n   Para deletar entries desbalanceados, execute:`);
    console.log('   node scripts/06_limpar_entries_desbalanceados.mjs --executar');
  }

  if (entriesOrfaos.length > 0) {
    console.log('\n⚠️ AVISO: Entries sem linhas');
    console.log('   Esses entries não afetam a contabilidade mas podem ser lixo.');
    console.log('   Considere deletá-los para limpeza.');
  }

  if (linhasOrfas.length > 0) {
    console.log('\n⚠️ AVISO: Linhas sem entry');
    console.log('   Essas linhas estão AFETANDO a contabilidade indevidamente!');
    console.log('   URGENTE: Deletar linhas órfãs.');
  }

  console.log('\n' + '='.repeat(70));

  return {
    totalDebitos,
    totalCreditos,
    diferenca,
    desbalanceados: desbalanceados.length,
    entriesOrfaos: entriesOrfaos.length,
    linhasOrfas: linhasOrfas.length
  };
}

diagnosticarEquacao().catch(console.error);
