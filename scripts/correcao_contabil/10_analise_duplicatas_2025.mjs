// scripts/correcao_contabil/10_analise_duplicatas_2025.mjs
// Analisa e identifica duplicatas em TODO o ano de 2025
// Objetivo: Garantir que apenas OFX (bank_transaction) seja fonte de verdade

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Período de análise - TODO 2025
const PERIODO_INICIO = '2025-01-01';
const PERIODO_FIM = '2025-12-31';

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

function formatMoney(valor) {
  const num = parseFloat(valor) || 0;
  const sinal = num < 0 ? '-' : '';
  return `${sinal}R$ ${Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function analisarDuplicatas2025() {
  console.log('\n' + '='.repeat(80));
  console.log(`🔍 ANÁLISE DE DUPLICATAS - ANO 2025 COMPLETO | MODO: ${MODO}`);
  console.log('='.repeat(80));

  // 1. Buscar todos os entries de 2025
  console.log('\n📍 Buscando lançamentos de 2025...');

  const { data: entries, error: errEntries } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      description,
      source_type,
      reference_type,
      reference_id
    `)
    .gte('entry_date', PERIODO_INICIO)
    .lte('entry_date', PERIODO_FIM);

  if (errEntries) {
    console.error('❌ Erro ao buscar entries:', errEntries);
    return;
  }

  console.log(`   Total de entries em 2025: ${entries.length}`);

  // 2. Buscar todas as linhas desses entries
  const entryIds = entries.map(e => e.id);

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, account_id, debit, credit')
    .in('entry_id', entryIds);

  console.log(`   Total de linhas: ${linhas?.length || 0}`);

  // 3. Buscar conta do banco
  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.05')
    .single();

  // 4. Agrupar por mês e source_type
  console.log('\n📊 DISTRIBUIÇÃO POR MÊS E SOURCE_TYPE:');
  console.log('-'.repeat(80));

  const porMes = {};
  for (const entry of entries) {
    const mes = entry.entry_date?.substring(0, 7) || 'null';
    const source = entry.source_type || 'null';

    if (!porMes[mes]) porMes[mes] = {};
    if (!porMes[mes][source]) porMes[mes][source] = { qtd: 0, entryIds: [] };

    porMes[mes][source].qtd++;
    porMes[mes][source].entryIds.push(entry.id);
  }

  // Mostrar tabela
  console.log('\n' + 'MÊS'.padEnd(10) + 'bank_transaction'.padStart(18) + 'invoice'.padStart(12) + 'invoices'.padStart(12) + 'expenses'.padStart(12) + 'null'.padStart(10) + 'TOTAL'.padStart(10));
  console.log('-'.repeat(84));

  const meses = Object.keys(porMes).sort();
  for (const mes of meses) {
    const dados = porMes[mes];
    const bt = dados['bank_transaction']?.qtd || 0;
    const inv = dados['invoice']?.qtd || 0;
    const invs = dados['invoices']?.qtd || 0;
    const exp = dados['expenses']?.qtd || 0;
    const nul = dados['null']?.qtd || 0;
    const total = bt + inv + invs + exp + nul;

    console.log(
      mes.padEnd(10) +
      String(bt).padStart(18) +
      String(inv).padStart(12) +
      String(invs).padStart(12) +
      String(exp).padStart(12) +
      String(nul).padStart(10) +
      String(total).padStart(10)
    );
  }

  // 5. Identificar o PROBLEMA
  console.log('\n' + '='.repeat(80));
  console.log('🔴 ANÁLISE DO PROBLEMA DE DUPLICAÇÃO');
  console.log('='.repeat(80));

  console.log(`
O problema de duplicação ocorre quando:

1. BANK_TRANSACTION (OFX): Registra entrada do dinheiro no banco
   - D: Banco (1.1.1.05)
   - C: Cliente ou Transitória

2. INVOICE ou INVOICES: Registra a mesma receita novamente
   - D: Cliente
   - C: Receita (3.x.x.x)

Resultado: O mesmo dinheiro é contado 2x nas receitas!

SOLUÇÃO CORRETA (Arquitetura):
- OFX é a ÚNICA fonte de verdade para movimentação bancária
- Invoice/Invoices só devem criar lançamentos de PROVISÃO (não caixa)
- Ou usar conta transitória para conciliação
`);

  // 6. Identificar entries para análise/remoção
  // Entries de invoice/invoices que podem ser duplicados
  const duplicatasPotenciais = entries.filter(e =>
    e.source_type === 'invoice' || e.source_type === 'invoices'
  );

  console.log('\n📊 ENTRIES POTENCIALMENTE DUPLICADOS:');
  console.log(`   invoice: ${entries.filter(e => e.source_type === 'invoice').length}`);
  console.log(`   invoices: ${entries.filter(e => e.source_type === 'invoices').length}`);
  console.log(`   TOTAL: ${duplicatasPotenciais.length}`);

  // Calcular impacto no banco
  if (contaBanco) {
    const linhasBancoDuplicatas = linhas.filter(l => {
      const entry = entries.find(e => e.id === l.entry_id);
      return entry &&
        (entry.source_type === 'invoice' || entry.source_type === 'invoices') &&
        l.account_id === contaBanco.id;
    });

    let debitosDuplicados = 0;
    let creditosDuplicados = 0;

    for (const l of linhasBancoDuplicatas) {
      debitosDuplicados += parseFloat(l.debit) || 0;
      creditosDuplicados += parseFloat(l.credit) || 0;
    }

    console.log(`\n   Linhas no banco de invoice/invoices: ${linhasBancoDuplicatas.length}`);
    console.log(`   Débitos duplicados no banco: ${formatMoney(debitosDuplicados)}`);
    console.log(`   Créditos duplicados no banco: ${formatMoney(creditosDuplicados)}`);
  }

  // 7. Opções de ação
  console.log('\n' + '='.repeat(80));
  console.log('📋 OPÇÕES DE CORREÇÃO');
  console.log('='.repeat(80));

  console.log(`
OPÇÃO 1 - CONSERVADORA (Recomendada):
   Primeiro executar scripts 08 e 09 para limpar anomalias estruturais
   (linhas órfãs, entries desbalanceados, entries vazios)

   Comando: node scripts/correcao_contabil/09_limpar_anomalias.mjs --executar

OPÇÃO 2 - AGRESSIVA:
   Deletar TODOS os entries de invoice/invoices e manter apenas bank_transaction

   ⚠️ CUIDADO: Isso pode remover lançamentos de provisão válidos!

OPÇÃO 3 - HÍBRIDA:
   1. Limpar anomalias (script 09)
   2. Verificar equação
   3. Se ainda houver problema, analisar caso a caso
`);

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FEITA');
    console.log('='.repeat(80));

    console.log('\n🚀 PRÓXIMOS PASSOS RECOMENDADOS:');
    console.log('   1. node scripts/correcao_contabil/09_limpar_anomalias.mjs --executar');
    console.log('   2. node scripts/correcao_contabil/04_validar_equacao_contabil.mjs');
    console.log('   3. Se ainda houver problema, execute este script com --executar');

    return {
      totalEntries2025: entries.length,
      bankTransaction: entries.filter(e => e.source_type === 'bank_transaction').length,
      invoice: entries.filter(e => e.source_type === 'invoice').length,
      invoices: entries.filter(e => e.source_type === 'invoices').length,
      expenses: entries.filter(e => e.source_type === 'expenses').length
    };
  }

  // MODO EXECUÇÃO - Limpar entries de invoice/invoices
  console.log('\n' + '='.repeat(80));
  console.log('🗑️  EXECUTANDO LIMPEZA DE DUPLICATAS...');
  console.log('='.repeat(80));

  // Coletar IDs
  const idsParaDeletar = duplicatasPotenciais.map(e => e.id);

  console.log(`\n📍 Deletando ${idsParaDeletar.length} entries de invoice/invoices...`);

  // Deletar linhas primeiro
  let linhasDeletadas = 0;
  for (let i = 0; i < idsParaDeletar.length; i += 100) {
    const lote = idsParaDeletar.slice(i, i + 100);
    const { count } = await supabase
      .from('accounting_entry_lines')
      .delete({ count: 'exact' })
      .in('entry_id', lote);
    linhasDeletadas += count || 0;
  }

  console.log(`   ✅ ${linhasDeletadas} linhas deletadas`);

  // Deletar entries
  let entriesDeletados = 0;
  for (let i = 0; i < idsParaDeletar.length; i += 100) {
    const lote = idsParaDeletar.slice(i, i + 100);
    const { count } = await supabase
      .from('accounting_entries')
      .delete({ count: 'exact' })
      .in('id', lote);
    entriesDeletados += count || 0;
  }

  console.log(`   ✅ ${entriesDeletados} entries deletados`);

  // Verificação final
  console.log('\n📊 VERIFICAÇÃO FINAL:');

  const { data: linhasFinais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = linhasFinais.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCreditos = linhasFinais.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const diferenca = Math.abs(totalDebitos - totalCreditos);

  console.log(`   Total Débitos:  ${formatMoney(totalDebitos)}`);
  console.log(`   Total Créditos: ${formatMoney(totalCreditos)}`);
  console.log(`   Diferença:      ${formatMoney(diferenca)}`);

  if (diferenca < 0.01) {
    console.log('\n   ✅ EQUAÇÃO CONTÁBIL BALANCEADA!');
  } else {
    console.log('\n   ⚠️ Ainda há diferença. Execute o script 08 para diagnóstico.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ ANÁLISE/LIMPEZA CONCLUÍDA!');
  console.log('='.repeat(80));

  return {
    linhasDeletadas,
    entriesDeletados,
    diferencaFinal: diferenca
  };
}

analisarDuplicatas2025().catch(console.error);
