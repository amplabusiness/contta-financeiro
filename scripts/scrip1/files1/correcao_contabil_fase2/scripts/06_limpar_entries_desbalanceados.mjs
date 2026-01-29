// scripts/06_limpar_entries_desbalanceados.mjs
// Remove entries que ficaram desbalanceados após limpeza de duplicatas

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
  return `R$ ${(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function limparDesbalanceados() {
  console.log('\n' + '='.repeat(70));
  console.log(`🧹 LIMPEZA DE ENTRIES DESBALANCEADOS | MODO: ${MODO}`);
  console.log('='.repeat(70));

  // 1. Buscar todos os entries
  console.log('\n📍 Buscando entries...');
  
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, source_type, reference_type');

  console.log(`   Total de entries: ${entries.length}`);

  // 2. Buscar todas as linhas
  console.log('\n📍 Buscando linhas...');
  
  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id, debit, credit');

  console.log(`   Total de linhas: ${todasLinhas.length}`);

  // 3. Agrupar linhas por entry_id
  const linhasPorEntry = {};
  for (const l of todasLinhas) {
    if (!linhasPorEntry[l.entry_id]) {
      linhasPorEntry[l.entry_id] = { debitos: 0, creditos: 0 };
    }
    linhasPorEntry[l.entry_id].debitos += parseFloat(l.debit) || 0;
    linhasPorEntry[l.entry_id].creditos += parseFloat(l.credit) || 0;
  }

  // 4. Identificar entries desbalanceados
  const desbalanceados = [];
  const orfaos = [];

  for (const entry of entries) {
    const somas = linhasPorEntry[entry.id];
    
    if (!somas) {
      // Entry sem linhas
      orfaos.push(entry);
    } else {
      const diff = Math.abs(somas.debitos - somas.creditos);
      if (diff > 0.01) {
        desbalanceados.push({
          ...entry,
          debitos: somas.debitos,
          creditos: somas.creditos,
          diferenca: somas.debitos - somas.creditos
        });
      }
    }
  }

  console.log(`\n📊 IDENTIFICADOS:`);
  console.log(`   Entries desbalanceados: ${desbalanceados.length}`);
  console.log(`   Entries órfãos (sem linhas): ${orfaos.length}`);

  // 5. Calcular totais
  const totalDiferenca = desbalanceados.reduce((acc, e) => acc + e.diferenca, 0);
  console.log(`   Total desbalanceamento: ${formatMoney(totalDiferenca)}`);

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

  if (desbalanceados.length === 0 && orfaos.length === 0) {
    console.log('\n✅ Nenhum entry problemático encontrado!');
    return { success: true };
  }

  // 6. Coletar IDs para deletar
  const idsParaDeletar = [
    ...desbalanceados.map(e => e.id),
    ...orfaos.map(e => e.id)
  ];

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FEITA');
    console.log('='.repeat(70));

    console.log('\n📝 Amostra de entries desbalanceados (10 primeiros):');
    for (const e of desbalanceados.slice(0, 10)) {
      console.log(`   ${e.entry_date?.substring(0, 10)} | ${(e.source_type || '').padEnd(20)} | D: ${formatMoney(e.debitos).padStart(12)} C: ${formatMoney(e.creditos).padStart(12)}`);
    }

    console.log(`\n🚀 Para executar a limpeza de ${idsParaDeletar.length} entries, rode:`);
    console.log('   node scripts/06_limpar_entries_desbalanceados.mjs --executar');

    return { success: true, modo: 'SIMULACAO', aLimpar: idsParaDeletar.length };
  }

  // 7. EXECUÇÃO
  console.log('\n' + '='.repeat(70));
  console.log('🗑️  EXECUTANDO LIMPEZA...');
  console.log('='.repeat(70));

  // 7.1 Deletar linhas dos entries problemáticos
  console.log('\n📍 Deletando linhas...');
  
  let linhasDeletadas = 0;
  for (let i = 0; i < idsParaDeletar.length; i += 50) {
    const lote = idsParaDeletar.slice(i, i + 50);
    const { count } = await supabase
      .from('accounting_entry_lines')
      .delete({ count: 'exact' })
      .in('entry_id', lote);
    
    linhasDeletadas += count || 0;
  }

  console.log(`   ✅ ${linhasDeletadas} linhas deletadas`);

  // 7.2 Deletar entries
  console.log('\n📍 Deletando entries...');
  
  let entriesDeletados = 0;
  for (let i = 0; i < idsParaDeletar.length; i += 50) {
    const lote = idsParaDeletar.slice(i, i + 50);
    const { count } = await supabase
      .from('accounting_entries')
      .delete({ count: 'exact' })
      .in('id', lote);
    
    entriesDeletados += count || 0;
  }

  console.log(`   ✅ ${entriesDeletados} entries deletados`);

  // 8. Verificar equação após limpeza
  console.log('\n📊 VERIFICAÇÃO APÓS LIMPEZA:');

  const { data: totaisFinais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = totaisFinais.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCreditos = totaisFinais.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const diferencaFinal = Math.abs(totalDebitos - totalCreditos);

  console.log(`   Total Débitos:  ${formatMoney(totalDebitos)}`);
  console.log(`   Total Créditos: ${formatMoney(totalCreditos)}`);
  console.log(`   Diferença:      ${formatMoney(diferencaFinal)}`);

  if (diferencaFinal < 0.01) {
    console.log('\n✅ EQUAÇÃO CONTÁBIL BALANCEADA!');
  } else {
    console.log('\n⚠️ Ainda há diferença. Pode haver outros problemas.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ LIMPEZA CONCLUÍDA!');
  console.log('='.repeat(70));

  return {
    success: true,
    linhasDeletadas,
    entriesDeletados,
    diferencaFinal
  };
}

limparDesbalanceados().catch(console.error);
