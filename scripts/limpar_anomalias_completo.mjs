import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

async function buscarTodos(tabela, campos = '*') {
  let todos = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(tabela)
      .select(campos)
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error) {
      console.log(`Erro ao buscar ${tabela}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return todos;
}

async function limparAnomalias() {
  console.log('='.repeat(80));
  console.log(`🧹 LIMPEZA COMPLETA DE ANOMALIAS | MODO: ${MODO}`);
  console.log('='.repeat(80));

  // 1. Buscar TODOS os entries e linhas
  console.log('\n📍 Carregando TODOS os dados...');
  const entries = await buscarTodos('accounting_entries', 'id, source_type');
  const linhas = await buscarTodos('accounting_entry_lines', 'id, entry_id, debit, credit, account_id');

  console.log(`   Entries: ${entries.length}`);
  console.log(`   Linhas: ${linhas.length}`);

  const entryIds = new Set(entries.map(e => e.id));

  // 2. Identificar linhas órfãs
  console.log('\n' + '-'.repeat(80));
  console.log('🔍 FASE 1: Linhas órfãs (entry_id não existe)');
  console.log('-'.repeat(80));

  const linhasOrfas = linhas.filter(l => !entryIds.has(l.entry_id));
  const debitosOrfaos = linhasOrfas.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const creditosOrfaos = linhasOrfas.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

  console.log(`   Quantidade: ${linhasOrfas.length}`);
  console.log(`   Débitos: R$ ${debitosOrfaos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Créditos: R$ ${creditosOrfaos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Impacto: R$ ${(debitosOrfaos - creditosOrfaos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 3. Identificar entries desbalanceados
  console.log('\n' + '-'.repeat(80));
  console.log('🔍 FASE 2: Entries desbalanceados');
  console.log('-'.repeat(80));

  const linhasPorEntry = {};
  for (const l of linhas) {
    if (!linhasPorEntry[l.entry_id]) linhasPorEntry[l.entry_id] = { d: 0, c: 0, linhas: [] };
    linhasPorEntry[l.entry_id].d += parseFloat(l.debit) || 0;
    linhasPorEntry[l.entry_id].c += parseFloat(l.credit) || 0;
    linhasPorEntry[l.entry_id].linhas.push(l.id);
  }

  const entriesDesbalanceados = [];
  let totalDesbal = 0;
  for (const e of entries) {
    const dados = linhasPorEntry[e.id];
    if (!dados) continue; // entry sem linhas
    const diff = Math.abs(dados.d - dados.c);
    if (diff > 0.01) {
      entriesDesbalanceados.push({ ...e, diff: dados.d - dados.c, linhas: dados.linhas });
      totalDesbal += dados.d - dados.c;
    }
  }

  console.log(`   Quantidade: ${entriesDesbalanceados.length}`);
  console.log(`   Desbalanceamento total: R$ ${totalDesbal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 4. Identificar entries sem linhas
  console.log('\n' + '-'.repeat(80));
  console.log('🔍 FASE 3: Entries sem linhas');
  console.log('-'.repeat(80));

  const entriesSemLinhas = entries.filter(e => !linhasPorEntry[e.id]);
  console.log(`   Quantidade: ${entriesSemLinhas.length}`);

  // 5. Resumo
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMO DAS AÇÕES');
  console.log('='.repeat(80));

  const linhasADeletar = linhasOrfas.length + entriesDesbalanceados.reduce((s, e) => s + e.linhas.length, 0);
  const entriesADeletar = entriesDesbalanceados.length + entriesSemLinhas.length;

  console.log(`\n   1. Deletar ${linhasOrfas.length} linhas órfãs`);
  console.log(`   2. Deletar ${entriesDesbalanceados.length} entries desbalanceados + ${entriesDesbalanceados.reduce((s, e) => s + e.linhas.length, 0)} linhas`);
  console.log(`   3. Deletar ${entriesSemLinhas.length} entries sem linhas`);
  console.log(`\n   Total: ${linhasADeletar} linhas + ${entriesADeletar} entries`);

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FEITA');
    console.log('='.repeat(80));
    console.log('\n🚀 Para executar: node scripts/limpar_anomalias_completo.mjs --executar');
    return;
  }

  // 6. Executar limpeza
  console.log('\n' + '='.repeat(80));
  console.log('🗑️  EXECUTANDO LIMPEZA...');
  console.log('='.repeat(80));

  // 6.1 Deletar linhas órfãs em lotes
  console.log('\n📍 Deletando linhas órfãs...');
  const idsOrfas = linhasOrfas.map(l => l.id);
  let deletadasOrfas = 0;
  for (let i = 0; i < idsOrfas.length; i += 100) {
    const lote = idsOrfas.slice(i, i + 100);
    await supabase.from('accounting_entry_lines').delete().in('id', lote);
    deletadasOrfas += lote.length;
    if ((i + 100) % 500 === 0) console.log(`   Progresso: ${i + 100}/${idsOrfas.length}`);
  }
  console.log(`   ✅ ${deletadasOrfas} linhas órfãs deletadas`);

  // 6.2 Deletar linhas de entries desbalanceados
  console.log('\n📍 Deletando linhas de entries desbalanceados...');
  const idsLinhasDesbal = entriesDesbalanceados.flatMap(e => e.linhas);
  let deletadasDesbal = 0;
  for (let i = 0; i < idsLinhasDesbal.length; i += 100) {
    const lote = idsLinhasDesbal.slice(i, i + 100);
    await supabase.from('accounting_entry_lines').delete().in('id', lote);
    deletadasDesbal += lote.length;
  }
  console.log(`   ✅ ${deletadasDesbal} linhas deletadas`);

  // 6.3 Deletar entries desbalanceados
  console.log('\n📍 Deletando entries desbalanceados...');
  const idsEntriesDesbal = entriesDesbalanceados.map(e => e.id);
  let deletadosDesbal = 0;
  for (let i = 0; i < idsEntriesDesbal.length; i += 100) {
    const lote = idsEntriesDesbal.slice(i, i + 100);
    await supabase.from('accounting_entries').delete().in('id', lote);
    deletadosDesbal += lote.length;
  }
  console.log(`   ✅ ${deletadosDesbal} entries deletados`);

  // 6.4 Deletar entries sem linhas
  console.log('\n📍 Deletando entries sem linhas...');
  const idsEntriesSemLinhas = entriesSemLinhas.map(e => e.id);
  let deletadosSemLinhas = 0;
  for (let i = 0; i < idsEntriesSemLinhas.length; i += 100) {
    const lote = idsEntriesSemLinhas.slice(i, i + 100);
    await supabase.from('accounting_entries').delete().in('id', lote);
    deletadosSemLinhas += lote.length;
  }
  console.log(`   ✅ ${deletadosSemLinhas} entries vazios deletados`);

  // 7. Verificação final
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  const linhasFinal = await buscarTodos('accounting_entry_lines', 'debit, credit');
  const totalD = linhasFinal.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalC = linhasFinal.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

  console.log(`\n   Total Débitos:  R$ ${totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Total Créditos: R$ ${totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Diferença:      R$ ${(totalD - totalC).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  if (Math.abs(totalD - totalC) < 0.01) {
    console.log('\n   ✅ EQUAÇÃO CONTÁBIL BALANCEADA!');
  } else {
    console.log('\n   ⚠️ Ainda há diferença. Execute novamente ou verifique manualmente.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ LIMPEZA CONCLUÍDA!');
  console.log('='.repeat(80));
}

limparAnomalias();
